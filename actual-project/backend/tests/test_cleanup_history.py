from datetime import datetime, timedelta, timezone

from sqlalchemy import event, update

from api_tests_core import api, signup, upload, report_payload
from app import cleanup_actions_table


def test_public_cleanup_history_batches_dates_and_includes_empty_beaches(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    target = client.post('/reports', headers=headers, json=report_payload(
        photo['photoKey'], quantities={'Plastic': 'Very Large'},
    )).get_json()['id']
    earlier = client.post('/cleanups', headers=headers, json={
        'targetReportId': target, 'afterBands': {'Plastic': 'Large'},
        'handling': 'Collected for disposal', 'idempotencyKey': 'history-target',
    })
    later = client.post('/cleanup-actions', headers=headers, json={
        'beachId': 'morib', 'removed': {'Plastic': 1},
        'handling': 'Collected for disposal', 'idempotencyKey': 'history-standalone',
    })
    assert earlier.status_code == later.status_code == 201
    now = datetime.now(timezone.utc).replace(microsecond=0)
    engine = application.extensions['marine_engine']
    with engine.begin() as connection:
        connection.execute(update(cleanup_actions_table).where(
            cleanup_actions_table.c.id == earlier.get_json()['id'],
        ).values(created_at=now - timedelta(days=2)))
        connection.execute(update(cleanup_actions_table).where(
            cleanup_actions_table.c.id == later.get_json()['id'],
        ).values(created_at=now))

    statements = []
    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)
    event.listen(engine, 'before_cursor_execute', capture)
    try:
        response = client.get('/cleanups/latest-by-beach')
    finally:
        event.remove(engine, 'before_cursor_execute', capture)
    assert response.status_code == 200
    dates = response.get_json()
    assert datetime.fromisoformat(dates['morib']) == now
    assert dates['remis'] is None
    assert len(dates) > 4
    assert len(statements) == 2
    assert all(value is None or isinstance(value, str) for value in dates.values())


def test_cleanup_history_empty_database_is_not_a_request_failure(api):
    _, client = api
    response = client.get('/cleanups/latest-by-beach')
    assert response.status_code == 200
    assert response.get_json()
    assert set(response.get_json().values()) == {None}
