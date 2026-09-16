"""The restore endpoint must never hand out a session from a public ID alone.

A participant ID is printed on reports, event signups and share pages, and the
ID space is only four digits wide. Restoring on the ID alone therefore lets
anybody take over an account they can enumerate, so these tests fail if the
participant-ID-only path is ever reintroduced.
"""

import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, signup
from app import auth_jwt_secret, issue_recovery_token, users_table


def _internal_user_id(application, participant_id):
    with application.extensions["marine_engine"].connect() as connection:
        row = connection.execute(
            select(users_table).where(users_table.c.participant_id == participant_id)
        ).first()
    return row.id


def test_restore_requires_a_recovery_token(api):
    _, client = api
    session, _headers = signup(client)

    response = client.post("/auth/restore", json={"participantId": session["user"]["participantId"]})

    assert response.status_code == 401
    assert response.get_json()["code"] == "RECOVERY_TOKEN_REQUIRED"


def test_restore_rejects_a_wrong_token(api):
    _, client = api
    session, _headers = signup(client)

    response = client.post(
        "/auth/restore",
        json={"participantId": session["user"]["participantId"], "token": "RS-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA"},
    )

    assert response.status_code == 401
    assert response.get_json()["code"] == "INVALID_RECOVERY_TOKEN"


def test_restore_accepts_the_saved_recovery_token(api):
    _, client = api
    session, _headers = signup(client)

    response = client.post(
        "/auth/restore",
        json={"participantId": session["user"]["participantId"], "token": session["recoveryToken"]},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["user"] == session["user"]
    me = client.get("/auth/me", headers={"Authorization": "Bearer " + body["token"]})
    assert me.status_code == 200
    assert me.get_json()["participantId"] == session["user"]["participantId"]


def test_restore_still_accepts_a_legacy_derived_token(api):
    application, client = api
    session, _headers = signup(client)
    participant_id = session["user"]["participantId"]
    user_id = _internal_user_id(application, participant_id)
    legacy_token = issue_recovery_token(user_id, auth_jwt_secret(testing=True))

    response = client.post("/auth/restore", json={"participantId": participant_id, "token": legacy_token})

    assert response.status_code == 200


def test_restore_still_reports_an_unknown_participant(api):
    _, client = api

    response = client.post("/auth/restore", json={"participantId": "9999", "token": "RS-AAAA"})

    assert response.status_code == 404
