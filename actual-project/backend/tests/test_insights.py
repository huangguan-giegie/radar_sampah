"""Saved activity aggregates, rolling windows and anonymous public payloads."""
from __future__ import annotations

import json
import sys
import time as wall_time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import insert

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, report_payload, signup, upload
from app import create_app
import app_core as impl
import insights as insights_module
from insights import build_insights

NOW = datetime(2026, 10, 6, 6, 0, tzinfo=timezone.utc)


def saved_report(application, user, key, days=10, beach="morib", quantities=None, status="Counted", deleted=False, at=None):
    quantities = quantities or {"Plastic": "Very Large"}
    category, quantity = impl.derive_category_quantity(quantities)
    created = at or NOW - timedelta(days=days)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(impl.reports_table).values(
            id=key, reporter_id=user, beach_id=beach, beach_name=beach,
            quantities=json.dumps(quantities), category=category, quantity=quantity,
            location_source="manual", photo_key=f"{key}.jpg", photo_mime="image/jpeg",
            photo_stripped=True, status=status, created_at=created, updated_at=created,
            deleted_at=created if deleted else None, **impl.quantity_values(quantities),
        ))
    return key


def saved_cleanup(application, user, key, report=None, days=2, beach="morib", after=None,
                  handling="Collected for disposal", event=None, removed=None, rows=None):
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(impl.cleanup_actions_table).values(
            id=key, target_report_id=report, participant_id=user, event_id=event,
            beach_id=beach, removed_counts=None, rows=json.dumps(rows or []), total_removed=1,
            remaining_quantities=json.dumps(after) if after is not None else None,
            removed_quantities=json.dumps(removed) if removed is not None else None,
            cleanup_score=1, handling=handling, idempotency_key=key,
            request_fingerprint=key, created_at=NOW - timedelta(days=days),
        ))


def summary(application, beach=None):
    return build_insights(application.extensions["marine_engine"], impl, now=NOW, beach_id=beach)


def test_empty_database_uses_zero_activity_and_no_invented_bands(api):
    application, client = api
    data = summary(application)
    assert data["overview"]["reports"] == data["overview"]["cleanups"] == data["overview"]["joined"] == 0
    assert data["overview"]["registeredBeaches"] >= 4
    assert data["overview"]["beachesWithBand"] == data["overview"]["needHelp"] == 0
    assert data["cleanup"]["history"] == data["cleanup"]["remaining"] == []
    assert all(beach["from"] is None and beach["to"] is None and beach["composition"] == [] for beach in data["beaches"])
    response = client.get("/insights")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert client.get("/insights?beachId=does-not-exist").status_code == 404


def test_legacy_seed_report_ids_are_excluded_from_public_beach_and_insights_evidence(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    saved_report(application, user, "r1", beach="morib", at=datetime(2026, 8, 14, tzinfo=timezone.utc))
    for index in range(2):
        saved_report(application, user, f"real-{index}", beach="morib")

    beach = client.get("/beaches/morib").get_json()
    batch = {row["id"]: row for row in client.get("/beaches").get_json()}["morib"]
    insights = client.get("/insights?beachId=morib").get_json()["beaches"][0]

    assert beach["validReports"] == batch["validReports"] == insights["activeReports"] == 2
    assert insights["reports"] == 2
    assert beach["lastReportedAt"] == batch["lastReportedAt"] == impl.contract_timestamp(NOW - timedelta(days=10))


def test_prior_band_uses_only_cleanup_actions_existing_at_that_time(api):
    application, client = api
    session, _ = signup(client)
    user = session["user"]["id"]
    for index in range(3):
        target = saved_report(application, user, f"trend-{index}", days=50)
        saved_cleanup(application, user, f"cleanup-{index}", target, after={"Plastic": "Medium"})
    data = summary(application, "morib")
    beach = data["beaches"][0]
    assert (beach["from"], beach["to"]) == ("High", "Moderate")
    assert beach["activeReports"] == 3
    assert beach["attentionScore"] == 1.7
    assert data["trendSummary"]["movedDown"] == data["trendSummary"]["changed"] == 1
    assert data["cleanup"]["evaluatedCleanups"] == 3
    assert data["cleanup"]["remaining"] == [["Plastic", 100, 3]]
    assert data["cleanup"]["history"][0]["rows"] == [{"category": "Plastic", "beforeBand": "Very Large", "afterBand": "Medium"}]


def test_old_deleted_duplicate_incomplete_future_and_resolved_rows_are_excluded(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    saved_report(application, user, "active", quantities={"Glass": "Large"})
    saved_report(application, user, "old", days=91)
    saved_report(application, user, "deleted", deleted=True)
    saved_report(application, user, "duplicate", status="Duplicate")
    saved_report(application, user, "incomplete", status="Incomplete")
    saved_report(application, user, "future", days=-1)
    target = saved_report(application, user, "resolved")
    saved_cleanup(application, user, "resolved-cleanup", target, after={"Plastic": "Small"})
    data = summary(application, "morib")
    beach = data["beaches"][0]
    assert beach["activeReports"] == 1
    assert beach["to"] is None
    assert beach["composition"] == [["Glass", 100]]
    # Saved Counted submissions includes resolved history, unlike active evidence.
    assert data["overview"]["reports"] == 2
    assert sum(month["count"] for month in beach["monthlyReports"]) == 3


def test_composition_uses_category_weights_and_rounds_to_100(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    saved_report(application, user, "plastic", quantities={"Plastic": "Medium", "Paper": "Small"})
    saved_report(application, user, "glass", quantities={"Glass": "Large"})
    data = summary(application, "morib")
    assert data["beaches"][0]["composition"] == [["Plastic", 45], ["Glass", 55]]
    assert sum(value for _, value in data["beaches"][0]["composition"]) == 100


def test_standalone_cleanup_does_not_change_reports_and_is_not_residual_evidence(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    saved_report(application, user, "standalone-target")
    saved_cleanup(application, user, "standalone", removed={"Plastic": "Very Large"}, handling="Recycled / handled")
    data = summary(application, "morib")
    assert data["beaches"][0]["composition"] == [["Plastic", 100]]
    assert data["cleanup"]["evaluatedCleanups"] == 0
    assert data["cleanup"]["remaining"] == []
    assert data["cleanup"]["handling"] == [["Recycled / handled", 100]]
    assert data["cleanup"]["history"][0]["rows"] == [{"category": "Plastic", "removedBand": "Very Large"}]


def test_beach_filter_scopes_cleanup_totals_and_history_together(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    saved_cleanup(application, user, "morib-cleanup", beach="morib", removed={"Plastic": "Medium"})
    saved_cleanup(application, user, "remis-cleanup", beach="remis", removed={"Glass": "Large"})

    all_data = summary(application)
    morib_data = summary(application, "morib")

    assert all_data["cleanup"]["total"] == 2
    assert len(all_data["cleanup"]["history"]) == 2
    assert morib_data["overview"]["registeredBeaches"] == 1
    assert morib_data["overview"]["cleanups"] == morib_data["cleanup"]["total"] == 1
    assert [row["beachId"] for row in morib_data["cleanup"]["history"]] == ["morib"]


def test_cleanup_history_retains_linked_before_bands_when_report_is_later_edited_or_excluded(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    target = saved_report(application, user, "edited-target", quantities={"Plastic": "Medium"}, status="Duplicate")
    saved_cleanup(application, user, "immutable", target, after={"Plastic": "Small"}, rows=[
        {"category": "Plastic", "before": "Very Large", "after": "Small", "removedUnits": 3},
    ])
    data = summary(application, "morib")
    assert data["overview"]["reports"] == 0
    assert data["cleanup"]["history"][0]["linked"] is True
    assert data["cleanup"]["history"][0]["rows"] == [{"category": "Plastic", "beforeBand": "Very Large", "afterBand": "Small"}]
    assert data["cleanup"]["remaining"] == [["Plastic", 0, 1]]


def test_next_report_interval_is_beach_scoped_and_not_an_assertion_of_recurrence(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    target = saved_report(application, user, "before", days=20)
    saved_cleanup(application, user, "cleaned", target, days=10, after={"Plastic": "Small"})
    saved_report(application, user, "other-beach", days=9, beach="remis")
    saved_report(application, user, "next", days=6)
    data = summary(application, "morib")
    record = data["cleanup"]["history"][0]
    assert record["daysUntilNextReport"] == 4
    assert record["daysSinceCleanup"] is None
    assert record["nextReportedAt"] == impl.contract_timestamp(NOW - timedelta(days=6))
    assert "recurrence" not in record


def test_participation_retains_past_events_deduplicates_multiple_cleanups_and_excludes_future(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        for key, start in [("past", NOW - timedelta(days=5)), ("future", NOW + timedelta(days=5))]:
            connection.execute(insert(impl.events_table).values(
                id=key, beach_id="morib", starts_at=start, ends_at=start + timedelta(hours=2),
                status="Closed" if key == "past" else "Open", source="moderator", created_at=start, updated_at=start,
            ))
            connection.execute(insert(impl.event_members_table).values(event_id=key, participant_id=user, joined_at=NOW - timedelta(days=6), location_passed=False))
        connection.execute(insert(impl.community_event_attendance_table).values(event_id="past", participant_id=user, confirmed_at=NOW - timedelta(days=5)))
    saved_cleanup(application, user, "first", event="past", removed={"Plastic": "Medium"})
    saved_cleanup(application, user, "second", event="past", removed={"Glass": "Medium"})
    data = summary(application)
    assert data["participation"]["all"] == [1, 1, 1]
    assert data["participation"]["morib"] == [1, 1, 1]
    assert data["participation"]["remis"] == [0, 0, 0]
    serialised = json.dumps(data)
    assert user not in serialised
    assert session_identity_keys(serialised) is False


def session_identity_keys(serialised):
    return any(key in serialised for key in ('"participantId"', '"reporterId"', '"joinedBy"'))


def test_monthly_counts_use_local_calendar_boundaries_and_include_zero_months(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    # September 30 16:30 UTC is October 1 00:30 in Malaysia.
    saved_report(application, user, "october-local", at=datetime(2026, 9, 30, 16, 30, tzinfo=timezone.utc))
    saved_report(application, user, "september-local", at=datetime(2026, 9, 30, 15, 30, tzinfo=timezone.utc))
    months = summary(application, "morib")["beaches"][0]["monthlyReports"]
    assert len(months) == 12
    assert months[0]["month"] == "2025-11"
    assert months[-2]["month"] == "2026-09" and months[-2]["count"] == 1
    assert months[-1]["month"] == "2026-10" and months[-1]["count"] == 1
    assert all(month["count"] == 0 for month in months[:-2])


@pytest.mark.parametrize("cleanup_days,joined,expected", [
    (None, 3, True), (30, 3, True), (29, 3, False),
    (2, 2, True), (2, 3, False), (2, None, False),
])
def test_needs_help_matches_community_cleanup_and_next_event_rule(api, cleanup_days, joined, expected):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    for index in range(3):
        saved_report(application, user, f"needs-report-{index}", days=40)
    if cleanup_days is not None:
        saved_cleanup(application, user, "needs-cleanup", days=cleanup_days, removed={"Plastic": "Medium"})
    if joined is not None:
        start = NOW + timedelta(days=3)
        with application.extensions["marine_engine"].begin() as connection:
            connection.execute(insert(impl.events_table).values(
                id="next-needs-event", beach_id="morib", starts_at=start, ends_at=start + timedelta(hours=3),
                status="Open", source="moderator", created_at=NOW, updated_at=NOW,
            ))
        for index in range(joined):
            member = signup(client)[0]["user"]["id"]
            with application.extensions["marine_engine"].begin() as connection:
                connection.execute(insert(impl.event_members_table).values(
                    event_id="next-needs-event", participant_id=member, joined_at=NOW,
                    location_passed=False,
                ))
    data = summary(application, "morib")
    assert data["beaches"][0]["to"] == "High"
    assert data["beaches"][0]["needsHelp"] is expected
    assert data["overview"]["needHelp"] == int(expected)


def test_recent_cleanup_with_no_band_never_becomes_a_help_recommendation(api):
    application, client = api
    user = signup(client)[0]["user"]["id"]
    saved_report(application, user, "insufficient-needs")
    assert summary(application, "morib")["beaches"][0]["needsHelp"] is False


def test_insights_runs_same_lazy_scheduler_as_community(api):
    application, client = api
    calls = []
    application.extensions["ensure_scheduled_events"] = lambda now: calls.append(now)
    assert client.get("/insights").status_code == 200
    assert len(calls) == 1 and calls[0].tzinfo is not None


def test_public_insights_refresh_ahead_and_report_upload_triggers_refresh(tmp_path, monkeypatch):
    monkeypatch.setenv("RADAR_PREWARM_PUBLIC_VIEWS", "0")
    calls = []

    def fake_build(_engine, _impl, *, now=None, beach_id=None):
        calls.append((now, beach_id))
        return {"marker": len(calls)}

    monkeypatch.setattr(insights_module, "build_insights", fake_build)
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'refresh-ahead.db'}",
        photo_storage_dir=tmp_path / "private-photos",
    )
    client = application.test_client()
    _session, headers = signup(client)
    photo = upload(client, headers)
    application.extensions["prewarm_insights"]()

    first = client.get("/insights")
    assert first.get_json() == {"marker": 1}

    application.extensions["invalidate_insights_cache"]()
    second = client.get("/insights")
    assert second.get_json() == {"marker": 1}
    deadline = wall_time.monotonic() + 1.0
    while len(calls) < 2 and wall_time.monotonic() < deadline:
        wall_time.sleep(0.01)
    assert len(calls) >= 2

    before_upload = len(calls)
    created = client.post(
        "/reports",
        headers=headers,
        json=report_payload(photo["photoKey"]),
    )
    assert created.status_code == 201
    deadline = wall_time.monotonic() + 1.0
    while len(calls) <= before_upload and wall_time.monotonic() < deadline:
        wall_time.sleep(0.01)
    assert len(calls) > before_upload
