"""Tests for the privacy-safe event contract and automatic attendance."""

from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

import pytest
from sqlalchemy import insert, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup, upload, report_payload
from app import event_members_table, events_table, KUALA_LUMPUR


def _seed_attention(client, quantities, count=3):
    reports = []
    for _ in range(count):
        session, headers = signup(client)
        photo = upload(client, headers)
        response = client.post('/reports', headers=headers, json=report_payload(photo['photoKey'], quantities=quantities))
        assert response.status_code == 201, response.get_json()
        reports.append((response.get_json(), headers, session['user']['id']))
    return reports


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


@pytest.mark.parametrize('quantity, severity', [('Medium', 'Moderate'), ('Large', 'High'), ('Very Large', 'Severe')])
def test_current_event_list_generates_four_saturdays_only_for_eligible_bands(api, quantity, severity):
    application, client = api
    _seed_attention(client, {'Fishing gear': quantity})
    assert client.get('/beaches/morib').get_json()['severity'] == severity

    first = client.get('/cleanup-events?beachId=morib').get_json()
    dates = [datetime.fromisoformat(row['date']).date() for row in first]
    local_now = datetime.now(timezone.utc).astimezone(KUALA_LUMPUR)
    next_saturday = local_now.date() + timedelta(days=(5 - local_now.weekday()) % 7)
    if local_now.weekday() == 5 and local_now.hour >= 12:
        next_saturday += timedelta(days=7)
    assert len(first) == 4
    assert dates == [next_saturday + timedelta(days=7 * offset) for offset in range(4)]
    assert all(row['source'] == 'weekly' for row in first)
    assert all(day.weekday() == 5 for day in dates)
    assert all(later - earlier == timedelta(days=7) for earlier, later in zip(dates, dates[1:]))
    assert {row['id'] for row in client.get('/cleanup-events?beachId=morib').get_json()} == {row['id'] for row in first}
    with application.extensions['marine_engine'].connect() as connection:
        assert len(connection.execute(select(events_table.c.id)).all()) == 4


@pytest.mark.parametrize('quantities, count, expected', [({'Paper': 'Medium'}, 3, 'Low'), ({'Fishing gear': 'Medium'}, 2, None), ({'Fishing gear': 'Medium'}, 0, None)])
def test_current_event_list_creates_no_slots_for_low_or_insufficient_data(api, quantities, count, expected):
    application, client = api
    _seed_attention(client, quantities, count)
    assert client.get('/beaches/morib').get_json()['severity'] == expected
    assert client.get('/cleanup-events?beachId=morib').get_json() == []
    assert client.get('/events?beachId=morib').get_json() == []
    with application.extensions['marine_engine'].connect() as connection:
        assert connection.execute(select(events_table.c.id)).all() == []


@pytest.mark.parametrize('new_band', ['Low', None])
def test_current_event_band_drop_preserves_planned_slots_and_registrations(api, new_band):
    application, client = api
    reports = _seed_attention(client, {'Fishing gear': 'Medium'})
    first = client.get('/cleanup-events?beachId=morib').get_json()
    first_ids = {row['id'] for row in first}
    assert len(first_ids) == 4
    _report, member_headers, member_id = reports[0]
    event_id = first[0]['id']
    assert client.post(f'/cleanup-events/{event_id}/join', headers=member_headers).status_code == 200

    for index, (report, headers, _user_id) in enumerate(reports):
        response = client.post('/cleanup-actions', headers=headers, json={
            'targetReportId': report['id'],
            'remainingQuantities': {'Fishing gear': 'Small'},
            'handling': 'Collected for disposal',
            'idempotencyKey': f'band-drop-{index}',
        })
        assert response.status_code == 201, response.get_json()
    if new_band == 'Low':
        _seed_attention(client, {'Paper': 'Medium'})
    assert client.get('/beaches/morib').get_json()['severity'] == new_band

    remaining = client.get('/cleanup-events?beachId=morib', headers=member_headers).get_json()
    assert {row['id'] for row in remaining} == first_ids
    assert next(row for row in remaining if row['id'] == event_id)['joined'] is True
    assert [row['id'] for row in client.get('/cleanup-events?joined=true', headers=member_headers).get_json()] == [event_id]

    # Advancing the schedule window would add another date if the gate were lost.
    application.extensions['ensure_scheduled_events'](datetime.now(timezone.utc) + timedelta(days=7))
    with application.extensions['marine_engine'].connect() as connection:
        assert set(connection.execute(select(events_table.c.id)).scalars()) == first_ids
        assert connection.execute(select(event_members_table.c.participant_id).where(event_members_table.c.event_id == event_id)).scalars().all() == [member_id]
