from sqlalchemy import select

from app import reports_table
from api_tests_core import api, signup, upload, report_payload
from test_v3_contract import cleanup
from datetime import datetime, timedelta, timezone


def test_patch_all_small_rejects_without_mutating_report(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    payload = report_payload(photo['photoKey'])
    payload['quantities'] = {'Plastic': 'Medium'}
    created = client.post('/reports', headers=headers, json=payload)
    assert created.status_code == 201
    report_id = created.get_json()['id']
    response = client.patch(f'/reports/{report_id}', headers=headers, json={'quantities': {'Plastic': 'Small'}})
    assert response.status_code == 422
    assert response.get_json()['code'] == 'SMALL_ONLY_REPORT'
    stored = client.get('/reports/mine', headers=headers).get_json()[0]
    assert stored['quantities'] == {'Plastic': 'Medium'}


def test_patch_gps_keeps_coordinates_private_and_reference_changes(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    payload = report_payload(photo['photoKey'])
    payload.update({'locationSource': 'gps', 'coords': {'lat': 3.141592, 'lng': 101.6869}})
    created = client.post('/reports', headers=headers, json=payload)
    assert created.status_code == 201
    report_id = created.get_json()['id']
    with application.extensions['marine_engine'].connect() as connection:
        before = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
    response = client.patch(f'/reports/{report_id}', headers=headers, json={'coords': {'lat': 3.142001, 'lng': 101.6872}})
    assert response.status_code == 200
    with application.extensions['marine_engine'].connect() as connection:
        after = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
    assert after.lat is None and after.lng is None
    assert after.proximity_ref and after.proximity_ref != before.proximity_ref


def test_gps_edit_without_new_coordinates_preserves_reference_and_duplicate(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    payload = report_payload(photo['photoKey'], quantities={'Plastic': 'Medium'})
    payload.update(locationSource='gps', coords={'lat': 2.74614, 'lng': 101.44024})
    first = client.post('/reports', headers=headers, json=payload).get_json()
    second = client.post('/reports', headers=headers, json=payload).get_json()
    assert second['status'] == 'Duplicate'
    engine = application.extensions['marine_engine']
    with engine.connect() as connection:
        before = connection.execute(select(reports_table).where(reports_table.c.id == second['id'])).first()
    edited = client.patch('/reports/' + second['id'], headers=headers, json={'quantities': {'Plastic': 'Medium'}})
    assert edited.status_code == 200
    assert edited.get_json()['status'] == 'Duplicate'
    with engine.connect() as connection:
        after = connection.execute(select(reports_table).where(reports_table.c.id == second['id'])).first()
    assert after.proximity_ref == before.proximity_ref
    assert after.lat is None and after.lng is None
    own = client.patch('/reports/' + first['id'], headers=headers, json={'coords': payload['coords']})
    assert own.status_code == 200 and own.get_json()['status'] == 'Counted'


def test_resolved_and_expired_reports_remain_in_history_without_contributing(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    current = client.post('/reports', headers=headers, json=report_payload(photo['photoKey'], quantities={'Plastic': 'Large'})).get_json()
    expired = client.post('/reports', headers=headers, json=report_payload(photo['photoKey'], quantities={'Paper': 'Large'})).get_json()
    with application.extensions['marine_engine'].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == expired['id']).values(created_at=datetime.now(timezone.utc) - timedelta(days=91)))
    assert cleanup(client, headers, current['id'], 'Small').status_code == 201
    rows = {row['id']: row for row in client.get('/reports/mine', headers=headers).get_json()}
    assert rows[current['id']]['currentState'] == 'resolved'
    assert rows[expired['id']]['currentState'] == 'excluded'
    assert rows[current['id']]['photoUrl']
    card = next(row for row in client.get('/beaches').get_json() if row['id'] == 'morib')
    assert card['validReports'] == 0
    assert card['latestContributingReportAt'] is None
