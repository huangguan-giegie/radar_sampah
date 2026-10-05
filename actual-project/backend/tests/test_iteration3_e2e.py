"""Independent acceptance journeys across Iteration 3 API modules."""

from datetime import datetime, timedelta, timezone
import json
import sqlite3
from pathlib import Path
import sys

from sqlalchemy import insert
from sqlalchemy.dialects import sqlite
from sqlalchemy.schema import CreateTable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup, upload, report_payload
from app import beaches_table, cleanup_actions_table, create_app, events_table, reports_table


CORE_BEACHES = {"morib", "remis", "kelanang", "bagan"}
FORBIDDEN_PUBLIC_FIELDS = {
    "userId", "participantId", "reporterId", "ownerId", "nickname", "email",
    "phone", "coords", "photoUrl", "photoKey", "proximityRef", "reportId",
    "targetReportId", "cleanupId", "reportIds", "cleanupIds", "reporter_id",
}


def assert_public_fields(value):
    if isinstance(value, dict):
        assert not FORBIDDEN_PUBLIC_FIELDS.intersection(value)
        for nested in value.values():
            assert_public_fields(nested)
    elif isinstance(value, list):
        for nested in value:
            assert_public_fields(nested)


def seed_event(application, event_id, beach_id="morib"):
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(events_table).values(
            id=event_id, beach_id=beach_id, starts_at=now - timedelta(minutes=30),
            ends_at=now + timedelta(minutes=30), status="Open", source="moderator",
            created_at=now, updated_at=now,
        ))
    return event_id


def counted_report(client, headers, beach_id="morib", band="Very Large"):
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json={
        **report_payload(photo["photoKey"], quantities={"Plastic": band}),
        "beachId": beach_id,
    })
    assert response.status_code == 201, response.get_json()
    assert response.get_json()["status"] == "Counted"
    return response.get_json()


def joined_attendee(client, event_id):
    session, headers = signup(client)
    assert client.post(f"/events/{event_id}/join", headers=headers).status_code == 200
    response = client.post(f"/events/{event_id}/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024})
    assert response.status_code == 200, response.get_json()
    return session, headers


def test_iteration3_full_participant_journey(api):
    """AC10.8.4 joins attendance, awarded points, recurrence and consent changes."""
    application, client = api
    event_id = seed_event(application, "i3-acceptance-event")
    for _ in range(3):
        joined_attendee(client, event_id)
    initial = client.get("/insights/summary").get_json()
    assert initial["participation"]["steps"][1]["count"] == 3

    session, headers = joined_attendee(client, event_id)
    preferred = client.patch("/profile", headers=headers, json={"nickname": "TideWatcher", "joinedLeaderboard": True})
    assert preferred.status_code == 200
    target = counted_report(client, headers)
    before = client.get("/contributions", headers=headers).get_json()
    assert before["points"] == 1
    assert before["recordedAttendances"] == 0
    assert client.get("/insights/summary").get_json()["participation"]["steps"][1]["count"] == 4

    cleanup = client.post("/cleanups", headers=headers, json={
        "targetReportId": target["id"], "eventId": event_id,
        "afterBands": {"Plastic": "Large"}, "handling": "Collected for disposal",
        "idempotencyKey": "i3-e2e-cleanup",
    })
    assert cleanup.status_code == 201, cleanup.get_json()
    cleanup_id = cleanup.get_json()["id"]
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == target["id"]).values(created_at=now - timedelta(days=3)))
        connection.execute(cleanup_actions_table.update().where(cleanup_actions_table.c.id == cleanup_id).values(created_at=now - timedelta(days=2)))

    contributions = client.get("/contributions", headers=headers).get_json()
    assert contributions["points"] == 6
    assert contributions["recordedAttendances"] == 1
    assert client.get("/contributions", headers=headers).get_json() == contributions
    leaderboard = client.get("/leaderboard").get_json()
    assert {"nickname": "TideWatcher", "points": 6, "rank": 1} in leaderboard
    assert all(set(row) == {"nickname", "points", "rank"} for row in leaderboard)

    pending = client.get("/beaches/morib/recurrence").get_json()
    assert pending["intervalDays"] is None
    assert pending["status"] == "No follow-up report yet"
    assert client.get("/beaches/morib").get_json()["cleanupStatus"] == "Cleanup recorded — awaiting follow-up"
    counted_report(client, headers)
    recurrence = client.get("/beaches/morib/recurrence").get_json()
    assert recurrence["intervalDays"] == 2
    assert recurrence["medianDays"] is None
    summary = client.get("/insights/summary").get_json()
    assert summary["participation"]["steps"][2]["count"] == 4
    assert next(row for row in summary["cleanup"]["recurrence"]["beaches"] if row["beachId"] == "morib")["intervalDays"] == 2
    assert_public_fields(summary)
    assert session["user"]["id"] not in json.dumps(summary)

    updated = client.patch("/profile", headers=headers, json={"nickname": "CoastWatcher"})
    assert updated.get_json()["joinedLeaderboard"] is True
    assert any(row["nickname"] == "CoastWatcher" for row in client.get("/leaderboard").get_json())
    points = client.get("/contributions", headers=headers).get_json()
    assert client.patch("/profile", headers=headers, json={"joinedLeaderboard": False}).status_code == 200
    assert client.get("/leaderboard").get_json() == []
    assert client.get("/profile", headers=headers).get_json()["nickname"] == "CoastWatcher"
    assert client.get("/contributions", headers=headers).get_json() == points


def test_iteration3_public_scope_and_small_count_privacy(api):
    application, client = api
    event_id = seed_event(application, "i3-small-count-event")
    joined_attendee(client, event_id)
    response = client.get("/insights/summary")
    assert response.status_code == 200
    summary = response.get_json()
    assert set(summary["scope"]["beachIds"]) == CORE_BEACHES
    assert {row["id"] for row in summary["beaches"]} == CORE_BEACHES
    assert all(step["count"] == "Fewer than 3" for step in summary["participation"]["steps"])
    assert all(step["beaches"] is None for step in summary["participation"]["steps"])
    assert_public_fields(summary)
    assert summary["headlines"] == []
    assert all(row["trend"]["eligible"] is False for row in summary["beaches"])


def test_iteration3_private_endpoints_cannot_read_another_owner(api):
    _, client = api
    for path in ("/profile", "/contributions", "/personal-insights"):
        assert client.get(path).status_code == 401
    first_session, first_headers = signup(client)
    _, second_headers = signup(client)
    counted_report(client, first_headers)
    assert client.get("/contributions", headers=second_headers).get_json()["points"] == 0
    own = client.get("/personal-insights", headers=second_headers)
    assert own.status_code == 200
    assert own.get_json()["aggregate"] == []
    assert "private" in own.headers["Cache-Control"]
    assert client.get(f"/personal-insights?userId={first_session['user']['id']}", headers=second_headers).status_code == 400
    assert client.get("/recommendations/next-action", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_iteration3_expanded_beach_without_coordinates_supports_manual_evidence(api):
    application, client = api
    catalogue = client.get("/beaches").get_json()
    assert len(catalogue) == 86
    unknown = next(row for row in catalogue if row["id"] not in CORE_BEACHES and row["lat"] is None)
    assert unknown["lng"] is None
    assert unknown["severity"] is None
    targets = []
    for _ in range(3):
        _, headers = signup(client)
        targets.append((counted_report(client, headers, unknown["id"]), headers))
    detail = client.get("/beaches/" + unknown["id"]).get_json()
    assert detail["severity"] == "High"
    assert detail["eligibleReportCount"] == 3
    target, headers = targets[0]
    cleanup = client.post("/cleanups", headers=headers, json={
        "targetReportId": target["id"], "afterBands": {"Plastic": "Small"},
        "handling": "Not recorded", "idempotencyKey": "expanded-e2e-cleanup",
    })
    assert cleanup.status_code == 201, cleanup.get_json()
    assert client.get("/beaches/" + unknown["id"]).get_json()["eligibleReportCount"] == 2
    event_id = seed_event(application, "i3-unlocated-event", unknown["id"])
    assert client.post(f"/events/{event_id}/join", headers=headers).status_code == 200
    check_in = client.post(f"/events/{event_id}/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024})
    assert check_in.status_code in {403, 422}, check_in.get_json()
    summary = client.get("/insights/summary").get_json()
    assert summary["overview"]["countedReports"] == 0
    assert unknown["id"] not in summary["scope"]["beachIds"]


def test_iteration3_profile_preferences_survive_restart(api, tmp_path):
    application, client = api
    session, headers = signup(client)
    counted_report(client, headers)
    assert client.patch("/profile", headers=headers, json={"nickname": "SavedCoast", "joinedLeaderboard": True}).status_code == 200
    restored_app = create_app(database_url=str(application.extensions["marine_engine"].url), testing=True, photo_storage_dir=tmp_path / "fresh-photos")
    restored = restored_app.test_client()
    assert restored.get("/profile", headers=headers).get_json() == {"nickname": "SavedCoast", "joinedLeaderboard": True}
    assert restored.get("/contributions", headers=headers).get_json()["points"] == 1
    assert restored.get("/leaderboard").get_json() == [{"nickname": "SavedCoast", "points": 1, "rank": 1}]
    assert restored.post("/auth/restore", json={"participantId": session["user"]["participantId"], "token": session["recoveryToken"]}).status_code == 200


def test_iteration3_upgrades_legacy_sqlite_beach_coordinates(tmp_path):
    """The previous four-beach SQLite schema requires a nullable-coordinate upgrade."""
    database_path = tmp_path / "legacy-notnull-beaches.db"
    application = create_app(database_url=f"sqlite:///{database_path}", testing=True, photo_storage_dir=tmp_path / "photos")
    client = application.test_client()
    _, headers = signup(client)
    original_report = counted_report(client, headers)
    application.extensions["marine_engine"].dispose()
    schema = str(CreateTable(beaches_table).compile(dialect=sqlite.dialect()))
    schema = schema.replace("lat FLOAT", "lat FLOAT NOT NULL").replace("lng FLOAT", "lng FLOAT NOT NULL")
    with sqlite3.connect(database_path) as connection:
        connection.execute("PRAGMA foreign_keys=OFF")
        connection.execute(schema.replace("CREATE TABLE beaches", "CREATE TABLE legacy_beaches"))
        connection.execute("INSERT INTO legacy_beaches SELECT * FROM beaches WHERE id IN ('morib', 'remis', 'kelanang', 'bagan')")
        connection.execute("DROP TABLE beaches")
        connection.execute("ALTER TABLE legacy_beaches RENAME TO beaches")
    application = create_app(database_url=f"sqlite:///{database_path}", testing=True, photo_storage_dir=tmp_path / "photos")
    client = application.test_client()
    beaches = client.get("/beaches").get_json()
    assert len(beaches) == 86
    assert {row["id"] for row in beaches if row["lat"] is not None}.issuperset(CORE_BEACHES)
    with sqlite3.connect(database_path) as connection:
        columns = {row[1]: row for row in connection.execute("PRAGMA table_info(beaches)")}
    assert columns["lat"][3] == 0
    assert columns["lng"][3] == 0
    assert client.get("/reports/mine", headers=headers).get_json()[0]["id"] == original_report["id"]
    with sqlite3.connect(database_path) as connection:
        assert list(connection.execute("PRAGMA foreign_key_check")) == []
    application.extensions["marine_engine"].dispose()
    restarted = create_app(database_url=f"sqlite:///{database_path}", testing=True, photo_storage_dir=tmp_path / "photos").test_client()
    assert len(restarted.get("/beaches").get_json()) == 86
    assert restarted.get("/reports/mine", headers=headers).get_json()[0]["id"] == original_report["id"]
