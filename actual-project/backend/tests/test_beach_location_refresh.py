"""Existing database reference locations must track sourced catalogue updates."""

from pathlib import Path
from datetime import datetime, timedelta, timezone
import csv
import json
import sys

from sqlalchemy import event, insert, select, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup, upload, report_payload
from app import beaches_table, create_app, events_table


def test_sourced_catalogue_preserves_names_ids_and_honest_location_metadata():
    data = Path(__file__).resolve().parents[1] / 'data'
    catalogue = json.loads((data / 'expanded_beaches.json').read_text(encoding='utf-8'))
    with (data / 'beach_names.csv').open(encoding='utf-8-sig', newline='') as source:
        names = [row['Beach Name'] for row in csv.DictReader(source)]
    rows = catalogue['beaches']
    assert [row['name'] for row in rows] == names
    assert len(rows) == len({row['id'] for row in rows}) == 82
    assert [row['catalogueSource']['sourceRow'] for row in rows] == list(range(1, 83))
    located = [row for row in rows if row['lat'] is not None]
    assert len(located) == catalogue['metadata']['coordinateCount']
    assert len(located) > 4
    for row in rows:
        assert (row['lat'] is None) == (row['lng'] is None)
        assert row['species'] == [] and row['habitatTag'] == 'UNAVAILABLE'
        if row['lat'] is not None:
            assert type(row['lat']) in (float, int) and type(row['lng']) in (float, int)
            assert 0.8 < row['lat'] < 7.5 and 99 < row['lng'] < 120
            assert row['region'] in {'north', 'perak', 'selangor', 'nsm', 'johor', 'pahang', 'tganu', 'kelantan', 'borneo'}
            assert row['locationSource']['sourceUrl'].startswith('https://')
            assert row['locationSource']['providerPage'].startswith('https://')
            assert row['locationSource']['precision']
        else:
            assert row['locationSource'] is None


def test_all_sourced_beach_points_resolve_without_entering_public_insights(api):
    _, client = api
    _, headers = signup(client)
    beaches = client.get('/beaches').get_json()
    for beach in beaches:
        if beach['validatedCore'] or beach['lat'] is None:
            continue
        result = client.post('/geo/resolve-beach', headers=headers,
                             json={'lat': beach['lat'], 'lng': beach['lng']})
        assert result.status_code == 200
        assert result.get_json()['id'] == beach['id']
        assert beach['validReports'] == 0
        assert beach['severity'] is None
    summary = client.get('/insights/summary').get_json()
    assert set(summary['scope']['beachIds']) == {'morib', 'remis', 'kelanang', 'bagan'}
    assert summary['overview']['countedReports'] == 0


def test_existing_locations_are_backfilled_without_replacing_reports(api, tmp_path):
    application, client = api
    catalogue = client.get('/beaches').get_json()
    sourced = next(row for row in catalogue if not row['validatedCore'] and row['lat'] is not None)
    _, headers = signup(client)
    photo = upload(client, headers)
    report = client.post('/reports', headers=headers, json={
        **report_payload(photo['photoKey']), 'beachId': sourced['id'],
    })
    assert report.status_code == 201
    with application.extensions['marine_engine'].begin() as connection:
        connection.execute(beaches_table.update().where(beaches_table.c.id == sourced['id'])
                           .values(lat=None, lng=None, area='Malaysia — region not yet verified'))
        # The four validated core records remain database-owned.
        connection.execute(beaches_table.update().where(beaches_table.c.id == 'morib').values(lat=2.74615))
    restarted = create_app(database_url=str(application.extensions['marine_engine'].url), testing=True,
                           photo_storage_dir=tmp_path / 'restart-photos')
    restored = restarted.test_client()
    upgraded = restored.get('/beaches/' + sourced['id']).get_json()
    assert (upgraded['lat'], upgraded['lng'], upgraded['area']) == (sourced['lat'], sourced['lng'], sourced['area'])
    assert restored.get('/beaches/morib').get_json()['lat'] == 2.74615
    assert restored.get('/reports/mine', headers=headers).get_json()[0]['id'] == report.get_json()['id']
    with restarted.extensions['marine_engine'].connect() as connection:
        assert connection.execute(text('PRAGMA foreign_key_check')).all() == []
        assert len(connection.execute(select(beaches_table.c.id)).all()) == 86


def test_located_export_beach_uses_existing_report_checkin_and_points_rules(api):
    application, client = api
    beach = next(row for row in client.get('/beaches').get_json()
                 if row['id'] == 'bs-rawa-island-beach-1')
    assert beach['lat'] is not None
    _, headers = signup(client)
    photo = upload(client, headers)
    coords = {'lat': beach['lat'], 'lng': beach['lng']}
    response = client.post('/reports', headers=headers, json={
        **report_payload(photo['photoKey'], beach_id=beach['id'], location_source='gps'), 'coords': coords,
    })
    assert response.status_code == 201, response.get_json()
    assert response.get_json()['status'] == 'Counted'
    assert client.get('/contributions', headers=headers).get_json()['points'] == 1
    now = datetime.now(timezone.utc)
    with application.extensions['marine_engine'].begin() as connection:
        connection.execute(insert(events_table).values(
            id='located-export-event', beach_id=beach['id'], starts_at=now - timedelta(minutes=5),
            ends_at=now + timedelta(minutes=5), status='Open', source='moderator', created_at=now, updated_at=now,
        ))
    assert client.post('/events/located-export-event/join', headers=headers).status_code == 200
    assert client.post('/events/located-export-event/check-in', headers=headers, json=coords).status_code == 200
    assert client.post('/events/located-export-event/check-in', headers=headers,
                       json={'lat': 0, 'lng': 0}).status_code == 403
    assert client.get('/contributions', headers=headers).get_json()['points'] == 1
    assert client.get('/insights/summary').get_json()['overview']['countedReports'] == 0


def test_location_refresh_is_idempotent_and_uses_one_batch(api):
    import app
    from expanded_beaches import refresh_expanded_beach_locations
    application, _ = api
    engine = application.extensions['marine_engine']
    catalogue = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'expanded_beaches.json').read_text(encoding='utf-8'))
    ids = [row['id'] for row in catalogue['beaches'] if row['lat'] is not None and row['locationSource']]
    with engine.begin() as connection:
        connection.execute(beaches_table.update().where(beaches_table.c.id.in_(ids)).values(lat=None, lng=None))
    writes = []
    def observe(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith('UPDATE BEACHES'):
            writes.append(executemany)
    event.listen(engine, 'before_cursor_execute', observe)
    try:
        refresh_expanded_beach_locations(engine, app._impl)
        assert writes == [True]
        refresh_expanded_beach_locations(engine, app._impl)
        assert writes == [True]
    finally:
        event.remove(engine, 'before_cursor_execute', observe)
