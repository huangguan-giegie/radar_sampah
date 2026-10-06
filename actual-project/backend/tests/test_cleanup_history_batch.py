"""All catalogue cleanup dates require one public, anonymous grouped query."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import event, update

from api_tests_core import api, signup
from app import cleanup_actions_table
from test_v3_contract import cleanup, report


def test_batch_history_has_every_registered_beach_and_one_select(api):
    application, client = api
    statements = []
    def capture(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)
    engine = application.extensions["marine_engine"]
    event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.get("/beaches/cleanup-history")
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert response.status_code == 200
    assert len(response.json) == 101
    assert all(value is None for value in response.json.values())
    assert len(statements) == 1


def test_batch_history_returns_latest_timestamp_without_private_fields(api):
    application, client = api
    _, headers = signup(client)
    target = report(client, headers)["id"]
    first_response = cleanup(client, headers, target, "Large", "history-first")
    second_response = cleanup(client, headers, target, "Medium", "history-second")
    assert first_response.status_code == second_response.status_code == 201
    first, second = first_response.json, second_response.json
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(update(cleanup_actions_table).where(cleanup_actions_table.c.id == first["id"]).values(created_at=now - timedelta(days=2)))
        connection.execute(update(cleanup_actions_table).where(cleanup_actions_table.c.id == second["id"]).values(created_at=now - timedelta(days=1)))
    response = client.get("/beaches/cleanup-history")
    latest = datetime.fromisoformat(response.json["morib"].replace("Z", "+00:00"))
    assert abs((latest - (now - timedelta(days=1))).total_seconds()) < 1
    assert response.json["pantai-batu-laut"] is None
    assert all(isinstance(value, str) or value is None for value in response.json.values())
