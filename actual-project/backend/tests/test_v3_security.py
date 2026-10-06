"""Cleanup eligibility follows current beach evidence without exposing users."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup
from app import cleanup_actions_table, reports_table
from test_v3_contract import cleanup, event, report


def update_report(application, report_id, **changes):
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == report_id).values(**changes))


def test_deleted_report_cannot_be_linked_as_event_evidence(api):
    application, client = api
    _, headers = signup(client)
    active = event(application)
    assert client.post(f"/cleanup-events/{active}/join", headers=headers).status_code == 200
    assert client.post(f"/cleanup-events/{active}/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024}).status_code == 200
    target = report(client, headers)["id"]
    update_report(application, target, deleted_at=datetime.now(timezone.utc))
    response = client.post(f"/cleanup-events/{active}/reports/{target}", headers=headers)
    assert response.status_code == 400
    with application.extensions["marine_engine"].connect() as connection:
        saved = connection.execute(select(reports_table).where(reports_table.c.id == target)).first()
    assert saved.event_id is None


def invalidate(application, report_id, reason):
    if reason == "stale":
        update_report(application, report_id, created_at=datetime.now(timezone.utc) - timedelta(days=91))
    elif reason == "deleted":
        update_report(application, report_id, deleted_at=datetime.now(timezone.utc))
    elif reason == "duplicate":
        update_report(application, report_id, status="Duplicate")


@pytest.mark.parametrize("reason", ["stale", "deleted", "duplicate"])
def test_cleanup_target_routes_skip_ineligible_reports_and_keep_current_evidence(api, reason):
    application, client = api
    _, headers = signup(client)
    eligible = report(client, headers)["id"]
    excluded = report(client, headers)["id"]
    invalidate(application, excluded, reason)

    assert client.get("/cleanup-targets/morib").get_json()["reportId"] == eligible
    targets = client.get("/cleanup-targets?beachId=morib").get_json()
    assert [target["reportId"] for target in targets] == [eligible]
    assert client.get(f"/cleanup-targets?reportId={excluded}").get_json() == []
    beach = client.get("/beaches/morib").get_json()
    assert beach["eligibleReportCount"] == 1
    assert beach["compositionSource"]["activeReportCount"] == 1


@pytest.mark.parametrize("route", ["/cleanups", "/cleanup-actions"])
@pytest.mark.parametrize("reason", ["stale", "deleted", "duplicate"])
def test_cleanup_writes_reject_ineligible_target_without_recording_action(api, route, reason):
    application, client = api
    _, headers = signup(client)
    target = report(client, headers)["id"]
    invalidate(application, target, reason)
    body = {
        "targetReportId": target,
        "handling": "Collected for disposal",
        "idempotencyKey": "ineligible",
        "afterBands" if route == "/cleanups" else "remainingQuantities": {"Plastic": "Large"},
    }
    response = client.post(route, headers=headers, json=body)
    assert response.status_code == 404
    assert response.get_json()["code"] == "CLEANUP_TARGET_NOT_FOUND"
    assert client.get("/cleanup-targets/morib").get_json() is None
    with application.extensions["marine_engine"].connect() as connection:
        assert connection.execute(select(cleanup_actions_table)).all() == []


@pytest.mark.parametrize("reason", ["stale", "deleted", "duplicate", "resolved"])
def test_completed_cleanup_retry_still_returns_original_action_after_target_changes(api, reason):
    application, client = api
    _, headers = signup(client)
    target = report(client, headers)["id"]
    original = cleanup(client, headers, target, "Small")
    assert original.status_code == 201
    invalidate(application, target, reason)

    retry = cleanup(client, headers, target, "Small")
    assert retry.status_code == 200
    assert retry.get_json() == original.get_json()
    conflict = cleanup(client, headers, target, "Large")
    assert conflict.status_code == 409
    assert conflict.get_json()["code"] == "IDEMPOTENCY_CONFLICT"
    new_action = cleanup(client, headers, target, "Small", key="new-key")
    assert new_action.status_code == (409 if reason == "resolved" else 404)
    with application.extensions["marine_engine"].connect() as connection:
        assert len(connection.execute(select(cleanup_actions_table)).all()) == 1


def test_public_cleanup_reads_omit_participant_identity_for_all_viewers(api):
    application, client = api
    owner, headers = signup(client)
    _, other_headers = signup(client)
    active = event(application)
    client.post(f"/cleanup-events/{active}/join", headers=headers)
    checked_in = client.post(f"/cleanup-events/{active}/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024})
    assert checked_in.status_code == 200
    target = report(client, headers)["id"]
    saved = cleanup(client, headers, target, "Large", eventId=active)
    assert saved.status_code == 201
    action = saved.get_json()
    assert action["participantId"] == owner["user"]["participantId"]

    for viewer_headers in ({}, headers, other_headers):
        for path in (
            f"/cleanups/{action['id']}",
            f"/cleanups/by-target/{target}",
            "/beaches/morib/cleanups/latest",
        ):
            response = client.get(path, headers=viewer_headers)
            assert response.status_code == 200
            assert "participantId" not in response.get_json()
            assert response.get_json()["id"] == action["id"]
        event_actions = client.get(f"/cleanup-events/{active}/cleanups", headers=viewer_headers).get_json()
        assert event_actions[0]["id"] == action["id"]
        assert "participantId" not in event_actions[0]

    own_actions = client.get("/cleanups/mine", headers=headers).get_json()
    assert own_actions[0]["id"] == action["id"]
    assert own_actions[0]["participantId"] == owner["user"]["participantId"]
