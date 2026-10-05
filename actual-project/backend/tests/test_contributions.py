from datetime import datetime, timedelta, timezone

import app_core as impl
import pytest
from sqlalchemy import insert, select

from api_tests_core import api, signup
from contributions import install_contributions, validate_nickname


def install(api):
    application, client = api
    engine = application.extensions["marine_engine"]
    install_contributions(application, engine, impl.auth_jwt_secret(True), impl)
    return application, client, engine


def add_report(engine, user_id, identifier, status="Counted", days=1):
    created = datetime.now(timezone.utc) - timedelta(days=days)
    with engine.begin() as connection:
        connection.execute(insert(impl.reports_table).values(
            id=identifier, reporter_id=user_id, beach_id="morib", location_source="manual",
            photo_key="private-test", photo_mime="image/jpeg", category="Plastic",
            quantity="Medium", qty_plastic="Medium", quantities='{"Plastic":"Medium"}',
            status=status, created_at=created, updated_at=created,
        ))


def add_event(engine, identifier, user_ids=(), cleanup_count=1):
    created = datetime.now(timezone.utc) - timedelta(days=2)
    with engine.begin() as connection:
        connection.execute(insert(impl.events_table).values(
            id=identifier, beach_id="morib", starts_at=created, ends_at=created + timedelta(hours=2),
            status="Closed", source="moderator", created_at=created, updated_at=created,
        ))
        for user_id in user_ids:
            connection.execute(insert(impl.community_event_attendance_table).values(
                event_id=identifier, participant_id=user_id, confirmed_at=created,
            ))
        for index in range(cleanup_count):
            connection.execute(insert(impl.cleanup_actions_table).values(
                id=f"{identifier}-c{index}", participant_id=user_ids[0], beach_id="morib",
                target_report_id=None, event_id=identifier, rows='[]', cleanup_score=2,
                removed_quantities='{"Plastic":"Medium"}', handling="Not recorded", note="",
                idempotency_key=f"{identifier}-c{index}", request_fingerprint="test", created_at=created + timedelta(minutes=index),
            ))


def test_profile_defaults_are_private_and_require_authentication(api):
    _application, client, _engine = install(api)
    assert client.get("/profile").status_code == 401
    assert client.patch("/profile", json={"nickname": "TideWatcher"}).status_code == 401
    assert client.get("/contributions").status_code == 401
    session, headers = signup(client)
    assert client.get("/profile", headers=headers).get_json() == {"nickname": "", "joinedLeaderboard": False}
    assert client.get("/leaderboard").get_json() == []
    points = client.get("/contributions", headers=headers).get_json()
    assert points["points"] == 0 and points["history"] == []
    spoof = client.patch("/profile", headers=headers, json={"userId": session["user"]["id"], "joinedLeaderboard": True})
    assert spoof.status_code == 400


def test_private_response_cache_policy_and_query_arguments_cannot_select_another_user(api):
    _application, client, engine = install(api)
    first, first_headers = signup(client)
    second, second_headers = signup(client)
    add_report(engine, second["user"]["id"], "private-second")
    client.patch("/profile", headers=second_headers, json={"nickname": "PrivateBuddy"})
    for path in ["/profile", "/contributions"]:
        response = client.get(path + "?participantId=" + second["user"]["participantId"], headers=first_headers)
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "private, no-store"
        assert "Authorization" in response.headers["Vary"]
        body = response.get_json()
        assert "PrivateBuddy" not in str(body)
        assert "private-second" not in str(body)
    assert client.get("/contributions", headers=first_headers).get_json()["points"] == 0
    assert client.get("/leaderboard").headers["Cache-Control"] == "no-store"


def test_points_are_recomputed_from_counted_reports_and_recorded_attendance_once(api):
    _application, client, engine = install(api)
    first, first_headers = signup(client)
    second, second_headers = signup(client)
    first_id, second_id = first["user"]["id"], second["user"]["id"]
    add_report(engine, first_id, "old-report", days=160)
    add_report(engine, first_id, "excluded-duplicate", status="Duplicate")
    add_report(engine, first_id, "excluded-incomplete", status="Incomplete")
    add_event(engine, "recorded", [first_id, second_id], cleanup_count=2)
    add_event(engine, "unrecorded", [first_id], cleanup_count=0)
    before = client.get("/contributions", headers=first_headers).get_json()
    assert before["points"] == 6
    assert before["reportPoints"] == 1 and before["attendancePoints"] == 5
    assert before["countedReports"] == 1 and before["recordedAttendances"] == 1
    assert len(before["history"]) == 2
    assert client.get("/contributions", headers=first_headers).get_json() == before
    assert client.get("/contributions", headers=second_headers).get_json()["points"] == 5
    with engine.begin() as connection:
        connection.execute(impl.reports_table.update().where(impl.reports_table.c.id == "old-report").values(status="Duplicate"))
    assert client.get("/contributions", headers=first_headers).get_json()["points"] == 5
    with engine.begin() as connection:
        connection.execute(impl.community_event_attendance_table.delete().where(
            impl.community_event_attendance_table.c.participant_id == first_id,
        ))
    assert client.get("/contributions", headers=first_headers).get_json()["points"] == 0


def test_resolved_reports_still_earn_report_points_and_standalone_cleanup_does_not(api):
    _application, client, engine = install(api)
    session, headers = signup(client)
    user_id = session["user"]["id"]
    add_report(engine, user_id, "resolved-source")
    with engine.begin() as connection:
        connection.execute(insert(impl.cleanup_actions_table).values(
            id="resolved", participant_id=user_id, beach_id="morib", target_report_id="resolved-source",
            event_id=None, rows='[]', cleanup_score=1, remaining_quantities='{"Plastic":"Small"}',
            handling="Not recorded", note="", idempotency_key="resolved", request_fingerprint="test",
            created_at=datetime.now(timezone.utc),
        ))
    body = client.get("/contributions", headers=headers).get_json()
    assert body["points"] == 1 and body["recordedAttendances"] == 0


def test_legacy_recorded_attendance_is_counted_once_with_v3_records(api):
    _application, client, engine = install(api)
    session, headers = signup(client)
    user_id = session["user"]["id"]
    add_event(engine, "legacy-attendance", [user_id], cleanup_count=1)
    checked_in = datetime.now(timezone.utc) - timedelta(days=2)
    with engine.begin() as connection:
        connection.execute(insert(impl.event_members_table).values(
            event_id="legacy-attendance", participant_id=user_id, joined_at=checked_in,
            checked_in_at=checked_in, location_passed=True,
        ))
    assert client.get("/contributions", headers=headers).get_json()["points"] == 5
    with engine.begin() as connection:
        connection.execute(impl.community_event_attendance_table.delete().where(
            impl.community_event_attendance_table.c.event_id == "legacy-attendance",
        ))
    body = client.get("/contributions", headers=headers).get_json()
    assert body["points"] == 5 and body["recordedAttendances"] == 1


def test_leaderboard_consent_nickname_update_withdrawal_and_private_fields(api):
    _application, client, engine = install(api)
    first, headers = signup(client)
    first_id = first["user"]["id"]
    add_report(engine, first_id, "first")
    client.patch("/profile", headers=headers, json={"nickname": "TideWatcher"})
    assert client.get("/leaderboard").get_json() == []
    assert client.patch("/profile", headers=headers, json={"joinedLeaderboard": True}).status_code == 200
    assert client.get("/leaderboard").get_json() == [{"rank": 1, "nickname": "TideWatcher", "points": 1}]
    history = client.get("/contributions", headers=headers).get_json()
    assert client.patch("/profile", headers=headers, json={"nickname": "BeachBuddy"}).status_code == 200
    assert client.get("/leaderboard").get_json()[0]["nickname"] == "BeachBuddy"
    assert client.get("/profile", headers=headers).get_json()["joinedLeaderboard"] is True
    client.patch("/profile", headers=headers, json={"joinedLeaderboard": False})
    assert client.get("/leaderboard").get_json() == []
    assert client.get("/profile", headers=headers).get_json()["nickname"] == "BeachBuddy"
    assert client.get("/contributions", headers=headers).get_json() == history
    second, second_headers = signup(client)
    duplicate = client.patch("/profile", headers=second_headers, json={"nickname": "beachbuddy", "joinedLeaderboard": True})
    assert duplicate.status_code == 409
    assert client.get("/profile", headers=second_headers).get_json() == {"nickname": "", "joinedLeaderboard": False}
    client.patch("/profile", headers=second_headers, json={"joinedLeaderboard": True})
    public = client.get("/leaderboard").get_json()
    assert public == [{"rank": 1, "nickname": f"Volunteer {second['user']['participantId']}", "points": 0}]
    assert set(public[0]) == {"rank", "nickname", "points"}


def test_equal_points_share_rank_and_zero_points_do_not_break_ranking(api):
    _application, client, engine = install(api)
    for index, nickname in enumerate(["Alpha", "Bravo", "Charlie"]):
        session, headers = signup(client)
        if index < 2:
            add_report(engine, session["user"]["id"], f"r{index}")
        client.patch("/profile", headers=headers, json={"nickname": nickname, "joinedLeaderboard": True})
    assert client.get("/leaderboard").get_json() == [
        {"rank": 1, "nickname": "Alpha", "points": 1},
        {"rank": 1, "nickname": "Bravo", "points": 1},
        {"rank": 3, "nickname": "Charlie", "points": 0},
    ]


@pytest.mark.parametrize("nickname", ["AB", "x" * 31, "person@example.com", "012 345 6789", "+60-12-345-6789", "3.12,101.44", "12 Jalan Ampang", "fuck", "f-u-c-k", "sh1t", "https://site.test", None, 123])
def test_invalid_nicknames_do_not_modify_saved_preference(api, nickname):
    _application, client, _engine = install(api)
    _session, headers = signup(client)
    client.patch("/profile", headers=headers, json={"nickname": "TideWatcher"})
    response = client.patch("/profile", headers=headers, json={"nickname": nickname, "joinedLeaderboard": True})
    assert response.status_code == 400
    assert client.get("/profile", headers=headers).get_json() == {"nickname": "TideWatcher", "joinedLeaderboard": False}


def test_signup_preferences_are_atomic_and_do_not_replace_identity(api):
    _application, client, engine = install(api)
    created = client.post("/auth/anonymous", json={"nickname": "ShoreScout", "joinedLeaderboard": True})
    assert created.status_code == 201
    session = created.get_json()
    assert session["profile"] == {"nickname": "ShoreScout", "joinedLeaderboard": True}
    headers = {"Authorization": "Bearer " + session["token"]}
    original_user = client.get("/auth/me", headers=headers).get_json()
    client.patch("/profile", headers=headers, json={"nickname": "BeachBuddy"})
    assert client.get("/auth/me", headers=headers).get_json() == original_user
    with engine.connect() as connection:
        before = len(connection.execute(select(impl.users_table.c.id)).all())
    duplicate = client.post("/auth/anonymous", json={"nickname": "beachbuddy"})
    assert duplicate.status_code == 409
    with engine.connect() as connection:
        assert len(connection.execute(select(impl.users_table.c.id)).all()) == before


def test_profile_preference_persists_across_restart_and_empty_nickname_uses_fallback(api):
    from app import create_app

    application, client, engine = install(api)
    session, headers = signup(client)
    client.patch("/profile", headers=headers, json={"nickname": "  TideWatcher  ", "joinedLeaderboard": True})
    assert client.get("/profile", headers=headers).get_json()["nickname"] == "TideWatcher"
    restarted = create_app(database_url=str(engine.url), testing=True)
    install_contributions(restarted, restarted.extensions["marine_engine"], impl.auth_jwt_secret(True), impl)
    assert restarted.test_client().get("/profile", headers=headers).get_json() == {"nickname": "TideWatcher", "joinedLeaderboard": True}
    assert client.patch("/profile", headers=headers, json={"nickname": ""}).status_code == 200
    assert client.get("/leaderboard").get_json()[0]["nickname"] == f"Volunteer {session['user']['participantId']}"
    assert validate_nickname("PenyuPal") == "PenyuPal"
    assert validate_nickname("海岸守护者") == "海岸守护者"


def test_public_leaderboard_covers_only_mvp_beaches_while_private_history_keeps_expanded_beaches(api):
    _application, client, engine = install(api)
    session, headers = signup(client)
    user_id = session["user"]["id"]
    add_report(engine, user_id, "outside-mvp")
    with engine.begin() as connection:
        other_beach = connection.execute(select(impl.beaches_table.c.id).where(~impl.beaches_table.c.id.in_(["morib", "remis", "kelanang", "bagan"]))).scalar()
        if other_beach is None:
            connection.execute(insert(impl.beaches_table).values(
                id="expanded", name="Expanded beach", area="Malaysia", lat=1.0, lng=100.0,
                habitat="Coastal", sensitivity="Not recorded", primary_species_glyph="turtle",
            ))
            other_beach = "expanded"
        connection.execute(impl.reports_table.update().where(impl.reports_table.c.id == "outside-mvp").values(beach_id=other_beach))
    client.patch("/profile", headers=headers, json={"nickname": "BeachBuddy", "joinedLeaderboard": True})
    assert client.get("/contributions", headers=headers).get_json()["points"] == 1
    assert client.get("/leaderboard").get_json() == [{"rank": 1, "nickname": "BeachBuddy", "points": 0}]
