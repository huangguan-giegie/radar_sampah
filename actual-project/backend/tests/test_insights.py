"""Iteration 3 Insights AC checks using stored reports and cleanup history."""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import insert, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api
import app_core as impl
from insights import attention_as_of, build_insights_summary, grounded_trend_insights, install_insights


NOW = datetime(2026, 10, 5, 4, 0, tzinfo=timezone.utc)


@pytest.fixture
def insights_api(api):
    application, client = api
    if "insights_summary" not in application.view_functions:
        install_insights(application, application.extensions["marine_engine"], impl)
    return application, client


def add_report(application, identifier, beach="morib", *, days=5, quantities=None, status="Counted", when=None, deleted=False):
    quantities = quantities or {"Plastic": "Large"}
    created = when or NOW - timedelta(days=days)
    category, quantity = impl.derive_category_quantity(quantities)
    with application.extensions["marine_engine"].begin() as connection:
        if connection.execute(select(impl.users_table.c.id).where(impl.users_table.c.id == "insights-private-person")).first() is None:
            connection.execute(insert(impl.users_table).values(id="insights-private-person", participant_id="9021", role="volunteer", created_at=NOW))
        connection.execute(insert(impl.reports_table).values(
            id=identifier, reporter_id="insights-private-person", beach_id=beach, beach_name=beach,
            quantities=json.dumps(quantities), category=category, quantity=quantity,
            location_source="manual", photo_key="private-report-photo.jpg", photo_mime="image/jpeg",
            status=status, created_at=created, updated_at=created,
            deleted_at=NOW if deleted else None, **impl.quantity_values(quantities),
        ))


def add_cleanup(application, identifier, target, after, *, days=2, before=None, beach="morib", event_id=None, handling="Not recorded", when=None):
    before = before or {"Plastic": "Large"}
    rows = [{"category": category, "before": band, "after": after.get(category, band), "removedUnits": impl.QUANTITY_WEIGHTS[band] - impl.QUANTITY_WEIGHTS[after.get(category, band)]} for category, band in before.items()]
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(impl.cleanup_actions_table).values(
            id=identifier, target_report_id=target, participant_id="insights-private-person", beach_id=beach,
            event_id=event_id, rows=json.dumps(rows), remaining_quantities=json.dumps(after),
            cleanup_score=sum(row["removedUnits"] for row in rows), handling=handling,
            idempotency_key=identifier, request_fingerprint=identifier,
            created_at=when or NOW - timedelta(days=days),
        ))


def summary(application):
    return build_insights_summary(application.extensions["marine_engine"], impl, NOW)


def beach(data, identifier="morib"):
    return next(row for row in data["beaches"] if row["id"] == identifier)


def test_public_summary_empty_state_and_topic_routes(insights_api):
    application, client = insights_api
    for path in ("/insights/summary", "/insights/trends", "/insights/cleanup", "/insights/participation", "/insights/evidence"):
        response = client.get(path)
        assert response.status_code == 200
        assert response.get_json()["timezone"] == "Asia/Kuala_Lumpur"
    data = summary(application)
    assert data["scope"]["beachIds"] == ["morib", "remis", "kelanang", "bagan"]
    assert data["headlines"] == []
    assert data["headlinesEmptyState"] == "Not enough recent reports to generate insights yet."
    assert all(row["trend"]["message"] == "Insufficient data to compare" for row in data["beaches"])
    assert all(not row["needsVolunteers"]["flag"] for row in data["beaches"])
    assert data["cleanup"]["recent"] == []
    assert data["cleanup"]["handling"]["statuses"] == []
    assert data["participation"]["steps"][0]["count"] == "Fewer than 3"


@pytest.mark.parametrize("old_band,new_band,expected", [("Medium", "Very Large", "up"), ("Very Large", "Medium", "down"), ("Large", "Large", "unchanged")])
def test_band_direction_uses_each_cutoff_and_reuses_map_scoring(insights_api, old_band, new_band, expected):
    application, client = insights_api
    for index in range(3):
        add_report(application, f"old-{index}", days=100, quantities={"Fishing gear": old_band})
        add_report(application, f"new-{index}", days=5, quantities={"Fishing gear": new_band})
    data = summary(application)
    current = beach(data)
    assert current["trend"]["direction"] == expected
    assert current["trend"]["previousBand"] == impl.severity_from_score(impl.QUANTITY_WEIGHTS[old_band])[0]
    assert current["trend"]["currentBand"] == impl.severity_from_score(impl.QUANTITY_WEIGHTS[new_band])[0]
    map_beach = client.get("/beaches/morib").get_json()
    assert current["severity"] == map_beach["severity"]
    assert current["attentionScore"] == map_beach["attentionScore"]
    assert current["eligibleReportCount"] == map_beach["eligibleReportCount"]
    assert current["composition"] == map_beach["composition"]


@pytest.mark.parametrize("after", [{"Plastic": "Medium"}, {"Plastic": "Small"}])
def test_later_cleanup_never_changes_past_band(insights_api, after):
    application, _ = insights_api
    for index in range(3):
        add_report(application, f"target-{index}", days=40)
        add_cleanup(application, f"cleanup-{index}", f"target-{index}", after, days=10)
    data = summary(application)
    current = beach(data)
    assert current["trend"]["previousBand"] == "High"
    assert current["trend"]["previousReportCount"] == 3
    assert current["eligibleReportCount"] == (0 if after["Plastic"] == "Small" else 3)
    if after["Plastic"] == "Small":
        assert not current["trend"]["eligible"]
        assert data["evidence"]["beaches"][0]["statuses"]["countedResolved"] == 3
        assert all(row["status"] == "Resolved — source report kept in history" for row in data["cleanup"]["recent"])


def test_excluded_deleted_old_future_and_non_mvp_reports_do_not_enter_current_scores(insights_api):
    application, _ = insights_api
    for index in range(3):
        add_report(application, f"valid-{index}")
    for identifier, options in (("duplicate", {"status": "Duplicate"}), ("incomplete", {"status": "Incomplete"}), ("deleted", {"deleted": True}), ("old", {"days": 91}), ("future", {"days": -1}), ("outside", {"beach": "not-an-mvp-beach"})):
        add_report(application, identifier, quantities={"Fishing gear": "Very Large"}, **options)
    data = summary(application)
    current = beach(data)
    assert current["eligibleReportCount"] == 3
    assert current["severity"] == "High"
    assert data["overview"]["countedReports"] == 3
    assert data["evidence"]["beaches"][0]["statuses"] == {"countedActive": 3, "countedResolved": 0, "duplicate": 1, "incomplete": 1}
    assert "not-an-mvp-beach" not in json.dumps(data)


def test_composition_ties_use_exact_weighted_scores(insights_api):
    application, client = insights_api
    for index in range(3):
        add_report(application, f"paper-{index}", quantities={"Paper": "Very Large"})
        add_report(application, f"glass-{index}", quantities={"Glass": "Medium"})
    current = beach(summary(application))
    assert current["leadingCategories"] == ["Glass", "Paper"]
    assert sum(row["percentage"] for row in current["composition"]) == 100
    assert current["composition"] == client.get("/beaches/morib").get_json()["composition"]


def test_insufficient_reports_withhold_headlines_but_allow_composition(insights_api):
    application, _ = insights_api
    add_report(application, "only-report")
    current = beach(summary(application))
    assert current["severity"] is None
    assert current["composition"]
    assert not current["needsVolunteers"]["flag"]
    assert summary(application)["headlines"] == []


def test_month_grouping_uses_malaysia_and_historical_resolved_counted_reports(insights_api):
    application, _ = insights_api
    add_report(application, "month-before", when=datetime(2026, 9, 30, 15, 59, tzinfo=timezone.utc))
    add_report(application, "month-after", when=datetime(2026, 9, 30, 16, 0, tzinfo=timezone.utc))
    add_cleanup(application, "month-resolved", "month-after", {"Plastic": "Small"}, when=datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc))
    add_report(application, "not-counted", status="Duplicate", days=1)
    add_report(application, "month-old", when=datetime(2025, 11, 1, 1, 0, tzinfo=timezone.utc))
    data = summary(application)["trends"]["monthlyReports"]
    assert data["months"] == ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
    assert data["beaches"][0]["counts"] == [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
    assert "not zero litter" in data["caption"]


def add_event(application, identifier, beach_id, *, days=5, joined=0, attendance=0, cleanup=False):
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(impl.events_table).values(id=identifier, beach_id=beach_id, starts_at=NOW - timedelta(days=days), ends_at=NOW - timedelta(days=days) + timedelta(hours=3), status="Open" if days < 0 else "Closed", source="moderator", created_at=NOW, updated_at=NOW))
        for index in range(joined):
            connection.execute(insert(impl.event_members_table).values(event_id=identifier, participant_id=f"private-{identifier}-{index}", joined_at=NOW - timedelta(days=abs(days) + 1), checked_in_at=NOW - timedelta(days=days) + timedelta(hours=1) if index < attendance else None, location_passed=index < attendance))
    if cleanup:
        add_report(application, f"report-{identifier}", beach_id, days=days + 1)
        add_cleanup(application, f"cleanup-{identifier}", f"report-{identifier}", {"Plastic": "Small"}, beach=beach_id, event_id=identifier, days=days)


@pytest.mark.parametrize("cleanup_present,joined,reasons", [(False, 1, ["no_recent_cleanup", "low_sign_up"]), (True, 1, ["low_sign_up"]), (False, 3, ["no_recent_cleanup"]), (True, 3, [])])
def test_needs_volunteers_all_reasons_and_safe_event_link(insights_api, cleanup_present, joined, reasons):
    application, _ = insights_api
    for index in range(3):
        add_report(application, f"attention-{index}")
    add_event(application, "next-open", "morib", days=-2, joined=joined)
    if cleanup_present:
        add_report(application, "cleanup-source")
        add_cleanup(application, "recent-cleanup", "cleanup-source", {"Plastic": "Small"})
    current = beach(summary(application))
    assert current["needsVolunteers"]["reasons"] == reasons
    assert current["needsVolunteers"]["nextEventJoinedCount"] == (joined if joined >= 3 else "Fewer than 3")
    assert current["needsVolunteers"]["href"] == "/events/next-open"


def test_missing_event_and_low_band_never_exaggerate_volunteer_need(insights_api):
    application, _ = insights_api
    for index in range(3):
        add_report(application, f"low-{index}", quantities={"Paper": "Medium"})
    current = beach(summary(application))
    assert current["severity"] == "Low"
    assert not current["needsVolunteers"]["flag"]
    assert current["needsVolunteers"]["eventMessage"] == "No upcoming event scheduled"
    assert current["needsVolunteers"]["href"] == "/beach/morib"


def test_cross_cleanup_formulas_and_latest_ten_no_score_aggregation(insights_api):
    application, _ = insights_api
    for index in range(12):
        quantities = {"Plastic": "Large", "Glass": "Medium"}
        add_report(application, f"source-{index}", days=20, quantities=quantities)
        after = {"Plastic": "Medium" if index < 6 else "Small", "Glass": "Small"}
        add_cleanup(application, f"action-{index}", f"source-{index}", after, days=12 - index, before=quantities, handling="Collected for disposal" if index < 4 else "Recycled / handled" if index < 8 else "Not recorded")
    cleanup = summary(application)["cleanup"]
    assert len(cleanup["recent"]) == 10
    assert cleanup["recent"][0]["date"] > cleanup["recent"][-1]["date"]
    assert cleanup["hardestToClear"]["categories"] == [
        {"category": "Plastic", "includedCleanups": 12, "remainingCleanups": 6, "percentage": 50.0},
        {"category": "Glass", "includedCleanups": 12, "remainingCleanups": 0, "percentage": 0.0},
    ]
    assert all(row["count"] == 4 for row in cleanup["handling"]["statuses"])
    assert all("cleanupScore" in row for row in cleanup["recent"])
    assert "totalScore" not in json.dumps(cleanup)
    assert "averageScore" not in json.dumps(cleanup)


def test_before_state_uses_previous_cleanup_and_recorded_snapshot(insights_api):
    application, _ = insights_api
    add_report(application, "multi-cleanup", days=20, quantities={"Plastic": "Very Large"})
    add_cleanup(application, "first", "multi-cleanup", {"Plastic": "Large"}, before={"Plastic": "Very Large"}, days=10)
    add_cleanup(application, "second", "multi-cleanup", {"Plastic": "Medium"}, before={"Plastic": "Large"}, days=5)
    recent = summary(application)["cleanup"]["recent"]
    assert recent[0]["beforeBands"] == {"Plastic": "Large"}
    assert recent[1]["beforeBands"] == {"Plastic": "Very Large"}
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(impl.reports_table.update().where(impl.reports_table.c.id == "multi-cleanup").values(quantities='{"Plastic":"Large"}', qty_plastic="Large", quantity="Large"))
    assert summary(application)["cleanup"]["recent"][1]["beforeBands"] == {"Plastic": "Very Large"}


def test_partial_cleanup_awaiting_status_ends_when_follow_up_is_recorded(insights_api):
    application, _ = insights_api
    add_report(application, "partial-source", days=20)
    add_cleanup(application, "partial-cleanup", "partial-source", {"Plastic": "Medium"}, days=5)
    assert summary(application)["cleanup"]["recent"][0]["status"] == "Cleanup recorded — awaiting follow-up"
    add_report(application, "later-observation", days=3)
    data = summary(application)
    assert data["cleanup"]["recent"][0]["status"] == "2 days until next Counted report"
    assert data["cleanup"]["recurrence"]["beaches"][0]["intervalDays"] == 2


@pytest.mark.parametrize("counts,expected", [([3, 3, 3, 2], None), ([3, 3, 3, 3], "visible")])
def test_funnel_small_counts_hide_beach_steps_before_response(insights_api, counts, expected):
    application, _ = insights_api
    for beach_id, count in zip(("morib", "remis", "kelanang", "bagan"), counts):
        add_event(application, f"event-{beach_id}", beach_id, joined=count, attendance=count, cleanup=True)
    participation = summary(application)["participation"]
    assert [step["count"] for step in participation["steps"]] == [sum(counts)] * 3
    assert all((step["beaches"] is not None) == (expected == "visible") for step in participation["steps"])
    assert all(step["percentage"] == 100 for step in participation["conversions"])
    assert "private-event" not in json.dumps(participation)


def test_funnel_hidden_overall_counts_withhold_conversion(insights_api):
    application, _ = insights_api
    add_event(application, "small", "morib", joined=3, attendance=2, cleanup=True)
    participation = summary(application)["participation"]
    assert [step["count"] for step in participation["steps"]] == [3, "Fewer than 3", "Fewer than 3"]
    assert all(step["percentage"] is None for step in participation["conversions"])
    assert all(step["beaches"] is None for step in participation["steps"])


@pytest.mark.parametrize("future,expected", [(False, 3), (True, "Fewer than 3")])
def test_funnel_unions_legacy_and_canonical_attendance_without_duplicates_or_future_rows(insights_api, future, expected):
    application, _ = insights_api
    add_event(application, "union-event", "morib", joined=3, attendance=2, cleanup=True)
    with application.extensions["marine_engine"].begin() as connection:
        for index in (0, 2):
            connection.execute(insert(impl.community_event_attendance_table).values(event_id="union-event", participant_id=f"private-union-event-{index}", confirmed_at=NOW + timedelta(days=1) if index == 2 and future else NOW - timedelta(days=5)))
    counts = [step["count"] for step in summary(application)["participation"]["steps"]]
    assert counts == [3, expected, expected]


def test_funnel_keeps_only_conversions_whose_beach_counts_are_visible(insights_api):
    application, _ = insights_api
    for beach_id in ("morib", "remis", "kelanang", "bagan"):
        add_event(application, f"conversion-{beach_id}", beach_id, joined=4, attendance=3)
    participation = summary(application)["participation"]
    assert participation["steps"][0]["beaches"] is not None
    assert participation["steps"][1]["beaches"] is not None
    assert participation["steps"][2]["beaches"] is None
    assert all(row["percentage"] == 75 for row in participation["conversions"][0]["beaches"])
    assert participation["conversions"][1]["beaches"] is None


def test_summary_contains_no_precise_coordinates_personal_fields_or_record_ids(insights_api):
    application, _ = insights_api
    add_report(application, "private-report-identifier")
    add_cleanup(application, "private-cleanup-identifier", "private-report-identifier", {"Plastic": "Small"})
    data = summary(application)
    raw = json.dumps(data)
    for value in ("insights-private-person", "private-report-photo", "private-report-identifier", "private-cleanup-identifier", "9021"):
        assert value not in raw
    forbidden = {"lat", "lng", "latitude", "longitude", "photoUrl", "photoKey", "reportId", "targetReportId", "cleanupId", "participantId", "reporterId", "email", "nickname", "note"}
    def inspect(value):
        if isinstance(value, dict):
            assert not forbidden.intersection(value)
            for item in value.values():
                inspect(item)
        elif isinstance(value, list):
            for item in value:
                inspect(item)
    inspect(data)
    assert data["cleanup"]["recurrence"]["beaches"][0]["status"] == "No follow-up report yet"


def test_headline_priority_and_limit(insights_api):
    application, _ = insights_api
    for beach_id in ("morib", "remis", "kelanang", "bagan"):
        for index in range(3):
            add_report(application, f"old-{beach_id}-{index}", beach_id, days=100, quantities={"Fishing gear": "Medium"})
            add_report(application, f"now-{beach_id}-{index}", beach_id, quantities={"Fishing gear": "Very Large"})
    headlines = summary(application)["headlines"]
    assert len(headlines) == 4
    assert all(row["type"] == "band_change" for row in headlines)
    assert [row["beachName"] for row in headlines] == sorted(row["beachName"] for row in headlines)


def test_advanced_three_month_comparison_and_service_failure_fallback(insights_api):
    application, _ = insights_api
    for index in range(3):
        add_report(application, f"baseline-{index}", days=100, quantities={"Fishing gear": "Medium"})
        add_report(application, f"current-{index}", days=5, quantities={"Fishing gear": "Very Large"})
    beaches = summary(application)["beaches"]
    assert beach({"beaches": beaches})["advancedComparison"]["baselineAsOf"] == "2026-07-05"
    default = grounded_trend_insights(beaches)
    assert default["mode"] == "template"
    assert default["fallbackState"] == "disabled"
    failing = grounded_trend_insights(beaches, enabled=True, service=lambda facts: (_ for _ in ()).throw(RuntimeError("offline")))
    assert failing["fallbackState"] == "validation_or_service_failure"
    assert failing["mode"] == "template"
    assert failing["sourceAggregates"][0]["comparisonPeriod"] == "3 months ago"
    rejected = grounded_trend_insights(beaches, enabled=True, service=lambda facts: [{"beachId": fact["beachId"], "text": f"{fact['beachName']} changed from Moderate to Severe compared with 3 months ago because tourism caused pollution."} for fact in facts])
    assert rejected["fallbackState"] == "validation_or_service_failure"
    assert rejected["explanations"] == []
    approved = grounded_trend_insights(beaches, enabled=True, service=lambda facts: [{"beachId": fact["beachId"], "text": f"Based on recorded reports, {fact['beachName']}'s Beach Attention band increased from Moderate to Severe compared with 3 months ago."} for fact in facts])
    assert approved["mode"] == "ai"
    assert approved["fallbackState"] is None
    inverted = grounded_trend_insights(beaches, enabled=True, service=lambda facts: [{"beachId": fact["beachId"], "text": f"{fact['beachName']}'s Beach Attention band decreased from Moderate to Severe compared with 3 months ago."} for fact in facts])
    assert inverted["mode"] == "template"
    assert inverted["explanations"] == []


def test_advanced_no_change_and_insufficient_data_never_call_service(insights_api):
    application, _ = insights_api
    calls = []
    service = lambda facts: calls.append(facts)
    insufficient = grounded_trend_insights(summary(application)["beaches"], enabled=True, service=service)
    assert insufficient["mode"] == "template"
    assert not calls
    for index in range(3):
        add_report(application, f"baseline-equal-{index}", days=100, quantities={"Fishing gear": "Large"})
        add_report(application, f"current-equal-{index}", days=5, quantities={"Fishing gear": "Large"})
    unchanged = grounded_trend_insights(summary(application)["beaches"], enabled=True, service=service)
    assert unchanged["fallbackState"] == "no_meaningful_change"
    assert not calls


def test_freshness_reuses_map_wording_and_calendar_days(insights_api):
    application, _ = insights_api
    for index in range(3):
        add_report(application, f"aging-{index}", days=31)
    current = beach(summary(application))
    assert current["freshnessKind"] == "aging"
    assert current["evidence"]["freshnessLabel"] == "Reported 31 days ago"
