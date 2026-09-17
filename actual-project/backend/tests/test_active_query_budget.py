from sqlalchemy import event

from api_tests_core import api, signup, upload, report_payload


def test_active_beach_summary_batches_cleanup_queries(api):
    application, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)
    for _ in range(6):
        response = client.post('/reports', headers=headers, json=report_payload(photo['photoKey']))
        assert response.status_code == 201
    queries = []
    engine = application.extensions['marine_engine']

    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith('SELECT') and 'cleanup_actions' in statement:
            queries.append(statement)

    event.listen(engine, 'before_cursor_execute', capture)
    try:
        response = client.get('/beaches')
    finally:
        event.remove(engine, 'before_cursor_execute', capture)
    assert response.status_code == 200
    morib = next(beach for beach in response.get_json() if beach['id'] == 'morib')
    assert morib['eligibleReportCount'] == 6
    assert len(queries) == 1


def test_gallery_batches_photo_availability_without_loading_bytes(api):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    for _ in range(6):
        assert client.post('/reports', headers=headers, json=report_payload(photo['photoKey'])).status_code == 201
    queries = []
    engine = application.extensions['marine_engine']

    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            queries.append(statement)

    event.listen(engine, 'before_cursor_execute', capture)
    try:
        response = client.get('/beaches/morib/litter-gallery')
    finally:
        event.remove(engine, 'before_cursor_execute', capture)
    assert response.status_code == 200
    assert len(response.get_json()) == 6
    # One joined report/photo query and one batch of current cleanup states.
    assert len(queries) == 2
    assert 'report_photos.data' not in queries[0]
