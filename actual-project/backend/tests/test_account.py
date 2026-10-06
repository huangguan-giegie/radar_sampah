"""Real ledger evidence backs profiles, contribution history and public ranks."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import insert, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import signup, upload, report_payload
from app import create_app, events_table, reports_table


@pytest.fixture
def api(tmp_path):
    application = create_app(database_url=f"sqlite:///{tmp_path / 'account.db'}", testing=True,
                             photo_storage_dir=tmp_path / "photos")
    return application, application.test_client()


def report(client, headers):
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"]))
    assert response.status_code == 201
    return response.get_json()["id"]


def attend(application, client, headers, event_id="account-event"):
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(events_table).values(
            id=event_id, beach_id="morib", starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(hours=1), status="Open", source="moderator",
            created_at=now, updated_at=now,
        ))
    assert client.post(f"/cleanup-events/{event_id}/join", headers=headers).status_code == 200
    for _ in range(2):
        checked = client.post(f"/cleanup-events/{event_id}/check-in", headers=headers,
                              json={"lat": 2.74614, "lng": 101.44024})
        assert checked.status_code == 200
        assert checked.get_json()["attendanceConfirmed"] is True
    return event_id


def test_account_requires_auth_and_does_not_accept_a_client_user_id(api):
    _, client = api
    for method, path in (("get", "/account/profile"), ("get", "/account/contributions"),
                         ("patch", "/account/profile")):
        assert getattr(client, method)(path, json={"nickname": "BeachPal"}).status_code == 401
    _, headers = signup(client)
    assert client.patch("/account/profile", headers=headers,
                        json={"nickname": "BeachPal", "userId": "another-user"}).status_code == 400
    assert client.get("/leaderboard").get_json()["entries"] == []


@pytest.mark.parametrize("nickname", ["", "ab", "x" * 31, "pal@example.com", "1234567890", "+60 12-345-6789", "Bad\nName", 123, None])
def test_account_rejects_invalid_nicknames_without_mutation(api, nickname):
    _, client = api
    _, headers = signup(client)
    response = client.patch("/account/profile", headers=headers, json={"nickname": nickname})
    assert response.status_code == 400
    assert response.get_json()["code"] == "INVALID_NICKNAME"
    assert client.get("/account/profile", headers=headers).get_json()["nickname"] == ""


def test_account_join_requires_nickname_but_opt_out_always_works(api):
    application, client = api
    session, headers = signup(client)
    assert client.patch("/account/profile", headers=headers, json={"joinedLeaderboard": True}).status_code == 400
    assert client.patch("/account/profile", headers=headers, json={"joinedLeaderboard": "false"}).status_code == 400
    assert client.patch("/account/profile", headers=headers, json={"joinedLeaderboard": False}).status_code == 200
    joined = client.patch("/account/profile", headers=headers,
                          json={"nickname": "  BeachPal  ", "joinedLeaderboard": True})
    assert joined.get_json()["nickname"] == "BeachPal"
    # Even a legacy malformed profile must be able to withdraw its consent.
    profiles = application.extensions["account_profiles_table"]
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(profiles.update().where(profiles.c.user_id == session["user"]["id"]).values(nickname=""))
    left = client.patch("/account/profile", headers=headers, json={"joinedLeaderboard": False})
    assert left.status_code == 200
    assert left.get_json()["joinedLeaderboard"] is False
    assert client.get("/leaderboard").get_json()["entries"] == []


def test_account_profile_survives_service_restart_and_account_restore(api, tmp_path):
    application, client = api
    session, headers = signup(client)
    client.patch("/account/profile", headers=headers, json={"nickname": "OceanPal", "joinedLeaderboard": True})
    second = create_app(database_url=f"sqlite:///{tmp_path / 'account.db'}", testing=True,
                        photo_storage_dir=tmp_path / "photos").test_client()
    restored = second.post("/auth/restore", json={"participantId": session["user"]["participantId"],
                                                 "token": session["recoveryToken"]})
    assert restored.status_code == 200
    profile = second.get("/account/profile", headers={"Authorization": "Bearer " + restored.get_json()["token"]}).get_json()
    assert profile == {"nickname": "OceanPal", "joinedLeaderboard": True, "points": 0, "rank": 1}
    assert second.get("/leaderboard").get_json()["entries"] == [{"nickname": "OceanPal", "points": 0, "rank": 1}]


def test_account_points_and_history_include_past_attendance_without_double_count(api):
    application, client = api
    _, headers = signup(client)
    report_ids = [report(client, headers) for _ in range(4)]
    event_id = attend(application, client, headers)
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == report_ids[1]).values(status="Duplicate"))
        connection.execute(reports_table.update().where(reports_table.c.id == report_ids[2]).values(status="Incomplete"))
        connection.execute(reports_table.update().where(reports_table.c.id == report_ids[3]).values(deleted_at=now))
        connection.execute(events_table.update().where(events_table.c.id == event_id).values(
            starts_at=now - timedelta(days=3), ends_at=now - timedelta(days=3, hours=-2), status="Closed",
        ))
    assert client.get("/cleanup-events?joined=true", headers=headers).get_json() == []
    summary = client.get("/account/contributions", headers=headers).get_json()
    assert summary["points"] == 6
    assert summary["countedReports"] == 1
    assert summary["attendanceCount"] == 1
    assert summary["reportCount"] == 3
    assert summary["reportCounts"] == {"counted": 1, "duplicate": 1, "incomplete": 1}
    assert {item["id"] for item in summary["history"]} == {report_ids[0], event_id}
    assert {item["kind"]: item["points"] for item in summary["history"]} == {"report": 1, "attendance": 5}
    assert all(set(item) == {"kind", "id", "beachId", "beachName", "createdAt", "points"} for item in summary["history"])
    assert client.get("/account/profile", headers=headers).get_json()["points"] == 6


def test_account_leaderboard_is_opt_in_scoped_and_has_no_private_identifiers(api):
    application, client = api
    first, first_headers = signup(client)
    second, second_headers = signup(client)
    _, hidden_headers = signup(client)
    for headers, name in ((first_headers, "SeaPal"), (second_headers, "BeachPal")):
        assert client.patch("/account/profile", headers=headers,
                            json={"nickname": name, "joinedLeaderboard": True}).status_code == 200
        report(client, headers)
    client.patch("/account/profile", headers=hidden_headers, json={"nickname": "PrivatePal"})
    report(client, hidden_headers)
    attend(application, client, first_headers)
    body = client.get("/leaderboard").get_json()
    assert body["entries"] == [
        {"nickname": "SeaPal", "points": 6, "rank": 1},
        {"nickname": "BeachPal", "points": 1, "rank": 2},
    ]
    assert all(set(row) == {"nickname", "rank", "points"} for row in body["entries"])
    raw = client.get("/leaderboard").get_data(as_text=True)
    for sensitive in (first["user"]["id"], second["user"]["id"], first["user"]["participantId"], first["recoveryToken"], first["token"]):
        assert sensitive not in raw
    own = client.get("/account/contributions", headers=second_headers).get_json()
    assert own["attendanceCount"] == 0
    assert own["points"] == 1
    client.patch("/account/profile", headers=first_headers, json={"joinedLeaderboard": False})
    assert client.get("/leaderboard").get_json()["entries"] == [{"nickname": "BeachPal", "points": 1, "rank": 1}]
    assert client.get("/account/contributions", headers=first_headers).get_json()["points"] == 6


def test_account_leaderboard_ties_share_rank_without_inflating_ledger_points(api):
    _, client = api
    for nickname in ("WavePal", "BeachPal", "SeaPal"):
        _, headers = signup(client)
        report(client, headers)
        client.patch("/account/profile", headers=headers, json={"nickname": nickname, "joinedLeaderboard": True})
    rows = client.get("/leaderboard").get_json()["entries"]
    assert [row["nickname"] for row in rows] == ["BeachPal", "SeaPal", "WavePal"]
    assert [row["rank"] for row in rows] == [1, 1, 1]
    assert [row["points"] for row in rows] == [1, 1, 1]
