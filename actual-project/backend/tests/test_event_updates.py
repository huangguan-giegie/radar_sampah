"""Tests for the privacy-safe event contract and automatic attendance."""

from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

from sqlalchemy import insert

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup, upload, report_payload
from app import events_table


def _event(application, event_id="privacy-event"):
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(events_table).values(
            id=event_id,
            beach_id="morib",
            starts_at=now - timedelta(minutes=30),
            ends_at=now + timedelta(minutes=30),
            status="Open",
            source="moderator",
            created_at=now,
            updated_at=now,
        ))
    return event_id


def test_successful_check_in_records_attendance_without_evidence_or_participant_ids(api):
    application, client = api
    _session, headers = signup(client)
    event_id = _event(application)

    assert client.post(f"/cleanup-events/{event_id}/join", headers=headers).status_code == 200
    response = client.post(
        f"/cleanup-events/{event_id}/check-in",
        headers=headers,
        json={"lat": 2.74614, "lng": 101.44024},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["joined"] is True
    assert body["checkedIn"] is True
    assert body["attendanceConfirmed"] is True
    assert body["attendanceCount"] == 1
    assert not ({"joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"} & body.keys())

    retry = client.post(
        f"/cleanup-events/{event_id}/check-in",
        headers=headers,
        json={"lat": 2.74614, "lng": 101.44024},
    )
    assert retry.status_code == 200
    assert retry.get_json()["attendanceCount"] == 1


def test_joined_filter_and_public_list_are_privacy_safe(api):
    application, client = api
    _session, headers = signup(client)
    event_id = _event(application, "privacy-list-event")
    assert client.post(f"/cleanup-events/{event_id}/join", headers=headers).status_code == 200

    rows = client.get("/cleanup-events", headers=headers).get_json()
    row = next(item for item in rows if item["id"] == event_id)
    assert row["joined"] is True
    assert row["participantCount"] == 1
    assert not ({"joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"} & row.keys())

    joined = client.get("/cleanup-events?joined=true", headers=headers)
    assert joined.status_code == 200
    assert [item["id"] for item in joined.get_json()] == [event_id]


def test_current_event_list_generates_four_weekly_slots_without_legacy_route(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    for _ in range(3):
        assert client.post('/reports', headers=headers, json=report_payload(photo['photoKey'], quantities={'Fishing gear': 'Very Large'})).status_code == 201
    first = client.get('/cleanup-events?beachId=morib').get_json()
    assert len(first) == 4
    assert {row['id'] for row in client.get('/cleanup-events?beachId=morib').get_json()} == {row['id'] for row in first}
