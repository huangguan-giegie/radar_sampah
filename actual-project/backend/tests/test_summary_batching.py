import pytest
from sqlalchemy import event

from api_tests_core import api, signup, upload, report_payload


@pytest.mark.parametrize('size', [6, 60])
def test_beach_cards_use_two_selects_for_all_beaches(api, size):
    application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    for index in range(size):
        if index and index % 20 == 0:
            _, headers = signup(client)
            photo = upload(client, headers)
        assert client.post('/reports', headers=headers, json=report_payload(photo['photoKey'])).status_code == 201
    statements = []
    engine = application.extensions['marine_engine']

    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith('SELECT'):
            statements.append(statement)

    event.listen(engine, 'before_cursor_execute', capture)
    try:
        response = client.get('/beaches')
    finally:
        event.remove(engine, 'before_cursor_execute', capture)
    assert response.status_code == 200
    assert len([statement for statement in statements if 'reports' in statement.lower() or 'cleanup_actions' in statement.lower()]) == 2


def test_batch_and_detail_scores_agree_when_small_categories_are_present(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    for _ in range(3):
        assert client.post('/reports', headers=headers, json=report_payload(photo['photoKey'], quantities={'Fishing gear': 'Small', 'Paper': 'Medium'})).status_code == 201
    card = next(row for row in client.get('/beaches').get_json() if row['id'] == 'morib')
    detail = client.get('/beaches/morib').get_json()
    assert card['attentionScore'] == detail['attentionScore'] == 0.7
