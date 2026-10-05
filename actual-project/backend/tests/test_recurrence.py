from datetime import datetime, timedelta, timezone

import app_core as impl
from sqlalchemy import insert

from api_tests_core import api, signup
from recurrence import (
    AWAITING, CALLOUT, SUPERSEDED, calculate_recurrence,
    install_recurrence, summarize_beach_recurrence,
)


NOW = datetime(2026, 10, 5, 10, tzinfo=timezone.utc)


def cleanup(identifier, recorded, beach="morib", event=None):
    return {"id": identifier, "created_at": recorded, "beach_id": beach, "event_id": event}


def report(submitted, beach="morib", status="Counted", **extra):
    return {"created_at": submitted, "beach_id": beach, "status": status, **extra}


def test_followup_is_strictly_later_and_bounded_by_next_cleanup():
    first = NOW - timedelta(days=10)
    second = NOW - timedelta(days=5)
    rows = calculate_recurrence(
        [cleanup("first", first), cleanup("second", second)],
        [report(first), report(second), report(second + timedelta(days=2))], NOW,
    )
    assert rows[0]["status"] == SUPERSEDED
    assert rows[0]["intervalDays"] is None
    assert rows[1]["intervalDays"] == 2
    assert rows[1]["followUpDate"] == "2026-10-02"


def test_each_cleanup_uses_first_counted_report_and_beach_assignment():
    recorded = NOW - timedelta(days=6)
    rows = calculate_recurrence([cleanup("c", recorded)], [
        report(recorded + timedelta(days=1), "bagan-lalang"),
        report(recorded + timedelta(days=1), status="Duplicate"),
        report(recorded + timedelta(days=1), status="Incomplete"),
        report(recorded + timedelta(days=2), deleted_at=NOW),
        report(recorded + timedelta(days=3), current_state="Resolved"),
        report(recorded + timedelta(days=4)),
    ], NOW)
    assert rows[0]["intervalDays"] == 3
    assert "lat" not in rows[0] and "lng" not in rows[0]
    assert "reportId" not in rows[0]


def test_calendar_days_use_malaysia_midnight_and_same_day_zero():
    recorded = datetime(2026, 10, 3, 15, 59, tzinfo=timezone.utc)
    rows = calculate_recurrence([cleanup("c", recorded)], [
        report(recorded + timedelta(minutes=2)),
    ], recorded + timedelta(hours=1))
    assert rows[0]["intervalDays"] == 1
    assert rows[0]["daysSinceCleanup"] == 1
    same_day = calculate_recurrence([cleanup("c", NOW - timedelta(hours=2))], [report(NOW - timedelta(hours=1))], NOW)
    assert same_day[0]["intervalDays"] == 0


def test_missing_followup_and_median_require_three_intervals():
    recorded = NOW - timedelta(days=12)
    no_followup = calculate_recurrence([cleanup("latest", recorded)], [], NOW)
    assert no_followup[0]["status"] == AWAITING
    assert no_followup[0]["calloutStatus"] == CALLOUT
    assert no_followup[0]["daysSinceCleanup"] == 12
    assert summarize_beach_recurrence(no_followup, "morib")["medianDays"] is None
    cleanups = [cleanup(str(index), NOW - timedelta(days=20 - index * 4)) for index in range(4)]
    reports = [report(action["created_at"] + timedelta(days=days)) for action, days in zip(cleanups, [1, 3, 2, 2])]
    rows = calculate_recurrence(cleanups, reports, NOW)
    summary = summarize_beach_recurrence(rows[:2], "morib")
    assert summary["medianDays"] is None
    summary = summarize_beach_recurrence(rows[:3], "morib")
    assert summary["medianDays"] == 2
    assert summary["provisional"] is True
    assert "Provisional" in summary["medianLabel"]
    summary = summarize_beach_recurrence(rows, "morib")
    assert summary["medianDays"] == 2
    assert summarize_beach_recurrence(rows, "bagan-lalang") is None


def test_same_time_cleanups_and_old_records_do_not_share_a_report():
    recorded = NOW - timedelta(days=150)
    rows = calculate_recurrence([cleanup("a", recorded), cleanup("b", recorded)], [report(recorded + timedelta(days=35))], NOW)
    assert rows[0]["status"] == SUPERSEDED
    assert rows[1]["intervalDays"] == 35


def test_future_reports_and_cleanups_do_not_affect_current_status():
    rows = calculate_recurrence([cleanup("a", NOW - timedelta(days=3)), cleanup("future", NOW + timedelta(days=1))], [report(NOW + timedelta(days=2))], NOW)
    assert len(rows) == 1
    assert rows[0]["status"] == AWAITING


def test_api_empty_unknown_and_cleanup_status_refresh(api):
    application, client = api
    engine = application.extensions["marine_engine"]
    install_recurrence(application, engine, impl.auth_jwt_secret(True), impl)
    assert client.get("/beaches/morib/recurrence").get_json() is None
    assert client.get("/beaches/unknown/recurrence").status_code == 404
    session, _headers = signup(client)
    recorded = datetime.now(timezone.utc) - timedelta(days=4)
    with engine.begin() as connection:
        connection.execute(insert(impl.cleanup_actions_table).values(
            id="test-recurrence", participant_id=session["user"]["id"], beach_id="morib",
            target_report_id=None, event_id=None, rows='[]', cleanup_score=2,
            removed_quantities='{"Plastic":"Medium"}', handling="Not recorded", note="",
            idempotency_key="test-recurrence", request_fingerprint="test", created_at=recorded,
        ))
    view = client.get("/cleanups/test-recurrence").get_json()
    assert view["status"] == AWAITING
    beach = client.get("/beaches/morib").get_json()
    assert beach["cleanupStatus"] == CALLOUT
    with engine.begin() as connection:
        connection.execute(insert(impl.reports_table).values(
            id="later-recurrence", reporter_id=session["user"]["id"], beach_id="morib",
            location_source="manual", photo_key="private-test", photo_mime="image/jpeg",
            category="Plastic", quantity="Medium", qty_plastic="Medium", quantities='{"Plastic":"Medium"}',
            status="Counted", created_at=recorded + timedelta(days=2), updated_at=recorded + timedelta(days=2),
        ))
    view = client.get("/cleanups/test-recurrence").get_json()
    assert view["recurrence"]["intervalDays"] == 2
    assert view["status"] == "2 days until next Counted report"
    beach = client.get("/beaches/morib").get_json()
    assert beach["cleanupStatus"] == view["status"]
