"""Exercise the v3 API against the reviewed database and canonical routes."""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit

import pytest
from sqlalchemy import insert, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup, upload, report_payload
from app import create_app, events_table, reports_table, cleanup_actions_table, users_table


def report(client, headers, band="Very Large", **fields):
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json={
        **report_payload(photo["photoKey"], quantities={"Plastic": band}), **fields,
    })
    assert response.status_code == 201
    return response.get_json()


def event(application, event_id="v3-event", offset=0, beach="morib"):
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(events_table).values(
            id=event_id, beach_id=beach, starts_at=now + timedelta(hours=offset - 1),
            ends_at=now + timedelta(hours=offset + 1), status="Open", source="moderator",
            created_at=now, updated_at=now,
        ))
    return event_id


def cleanup(client, headers, target, band, key="v3-1", **fields):
    return client.post("/cleanups", headers=headers, json={
        "targetReportId": target, "afterBands": {"Plastic": band},
        "handling": "Collected for disposal", "idempotencyKey": key, **fields,
    })


def test_v3_partial_cleanup_uses_canonical_state_and_retry_identity(api):
    application, client = api
    assert client.post("/cleanups", json={}).status_code == 401
    _, headers = signup(client)
    target = report(client, headers)["id"]
    first = cleanup(client, headers, target, "Large")
    assert first.status_code == 201
    body = first.get_json()
    assert body["score"] == 1
    assert body["rows"] == [{"category": "Plastic", "beforeBand": "Very Large", "afterBand": "Large", "score": 1}]
    retry = cleanup(client, headers, target, "Large")
    assert retry.status_code == 200
    assert retry.get_json()["id"] == body["id"]
    assert cleanup(client, headers, target, "Medium").status_code == 409
    second = cleanup(client, headers, target, "Medium", "v3-2")
    assert second.status_code == 201
    assert second.get_json()["id"] != body["id"]
    assert client.get("/cleanup-targets/morib").get_json()["remainingBands"] == {"Plastic": "Medium"}
    canonical = client.get("/cleanup-targets?beachId=morib").get_json()
    assert canonical[0]["remainingQuantities"] == {"Plastic": "Medium"}
    for path in (f"/cleanups/{second.get_json()['id']}", f"/cleanups/by-target/{target}", "/beaches/morib/cleanups/latest"):
        result = client.get(path)
        assert result.status_code == 200
        assert result.get_json() == second.get_json()
    with application.extensions["marine_engine"].connect() as connection:
        rows = connection.execute(select(cleanup_actions_table)).all()
        assert len(rows) == 2
        assert json.loads(rows[-1].remaining_quantities) == {"Plastic": "Medium"}
        assert rows[-1].removed_counts is None


@pytest.mark.parametrize("key", [None, "", " ", 123, "x" * 129])
def test_v3_cleanup_requires_valid_idempotency_key(api, key):
    _, client = api
    _, headers = signup(client)
    target = report(client, headers)["id"]
    assert cleanup(client, headers, target, "Large", key).status_code == 400
    assert client.get("/cleanup-targets?beachId=morib").get_json()[0]["remainingQuantities"] == {"Plastic": "Very Large"}


def test_v3_targets_skip_resolved_latest_and_clear_scoring_without_deleting_history(api):
    _, client = api
    _, headers = signup(client)
    older = report(client, headers)["id"]
    newer = report(client, headers)["id"]
    completed = cleanup(client, headers, newer, "Small")
    assert completed.status_code == 201
    assert client.get("/cleanup-targets/morib").get_json()["reportId"] == older
    assert cleanup(client, headers, newer, "Small").status_code == 200
    assert cleanup(client, headers, newer, "Small", "another").status_code == 409
    assert client.get("/beaches/morib").get_json()["eligibleReportCount"] == 1
    assert len(client.get("/reports/mine", headers=headers).get_json()) == 2


def test_v3_legacy_count_target_uses_remaining_counts(api):
    application, client = api
    _, headers = signup(client)
    target = report(client, headers)["id"]
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == target).values(item_counts='{"Plastic":30}'))
    removed = client.post("/cleanup-actions", headers=headers, json={
        "targetReportId": target, "removedCounts": {"Plastic": 20}, "handling": "Not recorded", "idempotencyKey": "old",
    })
    assert removed.status_code == 201
    assert client.get("/cleanup-targets/morib").get_json()["remainingBands"] == {"Plastic": "Medium"}
    final = cleanup(client, headers, target, "Small")
    assert final.status_code == 201
    assert final.get_json()["rows"][0]["beforeBand"] == "Medium"
    assert client.get("/cleanup-targets/morib").get_json() is None


def test_v3_gallery_survives_restart_and_requires_signed_photo(api, tmp_path):
    application, client = api
    _, headers = signup(client)
    created = report(client, headers)
    restarted = create_app(database_url=str(application.extensions["marine_engine"].url), testing=True, photo_storage_dir=tmp_path / "fresh")
    client = restarted.test_client()
    response = client.get("/beaches/morib/gallery")
    assert response.status_code == 200
    entry = response.get_json()[0]
    assert entry["reportId"] == created["id"]
    assert entry["quantities"] == {"Plastic": "Very Large"}
    assert entry["beachName"] == "Pantai Morib"
    assert entry["createdAt"] == created["createdAt"]
    assert "token=" in entry["photoUrl"]
    photo = client.get(entry["photoUrl"])
    assert photo.status_code == 200
    assert photo.headers["Cache-Control"] == "private, no-store"
    assert client.get(urlsplit(entry["photoUrl"]).path).status_code == 401
    assert client.get(entry["photoUrl"].replace("/morib/", "/remis/")).status_code == 401


def test_v3_checkin_reuses_server_time_and_distance_validation(api):
    application, client = api
    session, headers = signup(client)
    active = event(application)
    assert client.post(f"/cleanup-events/{active}/join", headers=headers).status_code == 200
    path = f"/cleanup-events/{active}/check-in"
    assert client.post(path, headers=headers, json={"state": "within_area"}).status_code == 400
    assert client.post(path, headers=headers, json={"lat": 0, "lng": 0}).status_code == 403
    passed = client.post(path, headers=headers, json={"lat": 2.74614, "lng": 101.44024})
    assert passed.status_code == 200
    assert passed.get_json()["checkedIn"] is True
    assert passed.get_json()["attendanceConfirmed"] is True
    assert not ({"joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"} & passed.get_json().keys())
    future = event(application, "future", offset=48)
    client.post(f"/cleanup-events/{future}/join", headers=headers)
    assert client.post(f"/cleanup-events/{future}/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024}).status_code == 409


def test_v3_checkin_records_attendance_and_keeps_event_payload_private(api):
    application, client = api
    session, headers = signup(client)
    participant = session["user"]["participantId"]
    active = event(application)
    assert client.post(f"/cleanup-events/{active}/join", headers=headers).status_code == 200
    client.post(f"/cleanup-events/{active}/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024})
    checked = client.post(f"/cleanup-events/{active}/attendance", headers=headers)
    assert checked.status_code == 200
    assert checked.get_json()["attendanceConfirmed"] is True
    target = report(client, headers)["id"]
    linked = client.post(f"/cleanup-events/{active}/reports/{target}", headers=headers)
    assert linked.status_code == 200
    assert linked.get_json()["attendanceConfirmed"] is True
    assert not ({"joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"} & linked.get_json().keys())
    old_payload = client.get(f"/events/{active}", headers=headers).get_json()
    assert old_payload["attendanceConfirmed"] is True
    assert not ({"joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"} & old_payload.keys())
    for _ in range(2):
        confirmed = client.post(f"/cleanup-events/{active}/attendance", headers=headers)
        assert confirmed.status_code == 200
        assert confirmed.get_json()["attendanceConfirmed"] is True
    assert client.get("/cleanup-events?joined=true", headers=headers).get_json()[0]["id"] == active
    assert client.get("/cleanup-events?joined=true").get_json() == []
    assert cleanup(client, headers, target, "Large", eventId=active).status_code == 201
    actions = client.get(f"/cleanup-events/{active}/cleanups").get_json()
    assert actions[0]["rows"][0]["afterBand"] == "Large"
    left = client.delete(f"/cleanup-events/{active}/join", headers=headers).get_json()
    assert left["joined"] is False
    assert left["attendanceConfirmed"] is False
    rejoined = client.post(f"/cleanup-events/{active}/join", headers=headers).get_json()
    assert rejoined["joined"] is True
    assert rejoined["attendanceConfirmed"] is False


@pytest.mark.parametrize("invalid", ["owner", "beach", "old", "duplicate", "relink", "future", "not_joined"])
def test_v3_report_link_rejects_invalid_evidence_without_mutation(api, invalid):
    application, client = api
    _, headers = signup(client)
    active = event(application, offset=48 if invalid == "future" else 0)
    client.post(f"/events/{active}/join", headers=headers)
    target = report(client, headers)["id"]
    changes = {}
    if invalid == "owner":
        _, headers = signup(client)
        client.post(f"/events/{active}/join", headers=headers)
    elif invalid == "beach":
        changes["beach_id"] = "remis"
    elif invalid == "old":
        changes["created_at"] = datetime.now(timezone.utc) - timedelta(days=1)
    elif invalid == "duplicate":
        changes["status"] = "Duplicate"
    elif invalid == "relink":
        changes["event_id"] = event(application, "previous", offset=-48)
    elif invalid == "not_joined":
        client.delete(f"/events/{active}/join", headers=headers)
    if changes:
        with application.extensions["marine_engine"].begin() as connection:
            connection.execute(reports_table.update().where(reports_table.c.id == target).values(**changes))
    result = client.post(f"/cleanup-events/{active}/reports/{target}", headers=headers)
    assert result.status_code in (400, 403, 409), result.get_json()
    with application.extensions["marine_engine"].connect() as connection:
        assert connection.execute(select(reports_table.c.event_id).where(reports_table.c.id == target)).scalar_one() == changes.get("event_id")


def test_v3_admin_creation_is_authorized_and_read_routes_handle_missing_data(api):
    application, client = api
    session, headers = signup(client)
    payload = {"beachId": "morib", "date": "2030-09-21"}
    assert client.post("/cleanup-events", headers=headers, json=payload).status_code == 403
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(users_table.update().where(users_table.c.id == session["user"]["id"]).values(role="moderator"))
    created = client.post("/cleanup-events", headers=headers, json=payload)
    assert created.status_code == 201
    created_body = created.get_json()
    assert created_body["joined"] is False
    assert created_body["attendanceConfirmed"] is False
    assert not ({"joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"} & created_body.keys())
    assert client.get("/cleanup-events/missing").status_code == 404
    assert client.get("/cleanups/missing").status_code == 404
    assert client.get("/cleanups/by-target/missing").get_json() is None
    assert client.get("/beaches/missing/cleanups/latest").status_code == 404


def test_failed_recognition_exposes_unreadable_state(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    application.extensions["litter_recognizer"] = SimpleNamespace(recognise=lambda raw: {"state": "failed", "counts": {}, "modelVersion": "test"})
    result = client.post("/recognitions", headers=headers, json={"photoKey": photo["photoKey"]})
    assert result.status_code == 200
    assert result.get_json()["modelState"] == "unreadable"
