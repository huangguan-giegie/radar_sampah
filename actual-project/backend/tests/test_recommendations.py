"""Rule ordering, own-history isolation and derived private aggregates."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import insert, select

from api_tests_core import api, signup, upload, report_payload
from app import cleanup_actions_table, event_members_table, events_table, reports_table
from recommendations import REASONS, next_action, personal_insights, refresh_user_aggregate, user_litter_aggregate_table


def _report(client, headers, category="Plastic", band="Large"):
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"], quantities={category: band}))
    assert response.status_code == 201
    return response.get_json()["id"]


def _event(application, owner, name="now", start=-1, end=1, joined=True, status="Open"):
    now = datetime.now(timezone.utc)
    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(insert(events_table).values(id=name, beach_id="morib", starts_at=now + timedelta(hours=start),
            ends_at=now + timedelta(hours=end), status=status, source="moderator", created_at=now, updated_at=now))
        if joined:
            connection.execute(insert(event_members_table).values(event_id=name, participant_id=owner, joined_at=now,
                checked_in_at=None, location_passed=False))
    return name


def _cleanup(application, owner, name="own", offset=-1, beach="morib", target=None, rows=None):
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(cleanup_actions_table).values(id=name, target_report_id=target, participant_id=owner,
            event_id=None, beach_id=beach, rows=json.dumps(rows or []), remaining_quantities='{"Plastic":"Medium"}',
            removed_quantities='{"Plastic":"Small"}', cleanup_score=1, handling="Not recorded",
            idempotency_key=name, request_fingerprint="a" * 64, created_at=now + timedelta(days=offset)))


def _impl():
    import app_core
    return app_core


def test_guest_next_action_is_generic_and_private_endpoints_require_auth(api):
    _, client = api
    guest = client.get("/recommendations/next-action").get_json()
    assert guest["reasonCode"] == "GUEST"
    assert guest["destination"]["path"] == "/community"
    assert guest["sourceContext"] == {"guest": True}
    assert client.get("/personal-insights").status_code == 401
    assert client.get("/recommendations/next-action", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_next_action_prioritises_checkin_then_joined_event_then_followup(api):
    application, client = api
    session, headers = signup(client)
    owner = session["user"]["id"]
    _event(application, owner)
    _event(application, owner, "soon", start=24, end=27)
    _cleanup(application, owner)
    path = "/recommendations/next-action"
    assert client.get(path, headers=headers).get_json()["reasonCode"] == "CHECK_IN"
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(events_table.update().where(events_table.c.id == "now").values(status="Closed"))
    assert client.get(path, headers=headers).get_json()["reasonCode"] == "VIEW_JOINED_EVENT"
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(events_table.update().where(events_table.c.id == "soon").values(status="Closed"))
    assert client.get(path, headers=headers).get_json()["reasonCode"] == "SUBMIT_FOLLOW_UP"


def test_unavailable_or_distant_joined_event_is_skipped_and_attended_event_is_not_rechecked(api):
    application, client = api
    session, headers = signup(client)
    owner = session["user"]["id"]
    _event(application, owner, "closed", status="Closed")
    _event(application, owner, "distant", start=24 * 8, end=24 * 8 + 3)
    _event(application, owner, "attended")
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(event_members_table.update().where(event_members_table.c.event_id == "attended")
            .values(checked_in_at=datetime.now(timezone.utc), location_passed=True))
    assert client.get("/recommendations/next-action", headers=headers).get_json()["reasonCode"] == "LEARN_MARINE_LIFE"


def test_other_participant_activity_cannot_select_private_action(api):
    application, client = api
    first, _ = signup(client)
    _, second_headers = signup(client)
    _event(application, first["user"]["id"])
    _cleanup(application, first["user"]["id"])
    body = client.get("/recommendations/next-action", headers=second_headers).get_json()
    assert body["reasonCode"] == "LEARN_MARINE_LIFE"
    assert first["user"]["id"] not in json.dumps(body)


def test_volunteer_rule_requires_sufficient_attention_and_real_open_destination(api):
    application, client = api
    session, headers = signup(client)
    for _ in range(3):
        _report(client, headers)
    _event(application, session["user"]["id"], "needs", start=48, end=51, joined=False)
    body = client.get("/recommendations/next-action", headers=headers).get_json()
    assert body["reasonCode"] == "JOIN_NEEDS_VOLUNTEERS"
    assert body["destination"]["id"] == "needs"
    assert body["sourceContext"]["joinedCount"] == "Fewer than 3"


def test_report_default_is_available_when_approved_cards_are_unavailable(api, monkeypatch):
    import recommendations
    application, client = api
    session, _ = signup(client)
    monkeypatch.setattr(recommendations, "conservation_cards", lambda *args: [])
    card = next_action(application.extensions["marine_engine"], _impl(), session["user"]["id"])
    assert card["reasonCode"] == "REPORT_LITTER" and card["destination"]["path"] == "/report/photo"


def test_all_reason_templates_are_short_and_recommendation_selection_does_not_write_actions(api):
    application, client = api
    session, headers = signup(client)
    _event(application, session["user"]["id"])
    for _, text in REASONS.values():
        assert len(text.split()) <= 20
        assert not any(word in text.lower().split() for word in ["clean", "unsafe", "saved", "protected", "verified"])
    engine = application.extensions["marine_engine"]
    with engine.connect() as connection:
        before = {table.name: len(connection.execute(select(table)).all()) for table in [events_table, event_members_table, reports_table, cleanup_actions_table]}
    for _ in range(3):
        response = client.get("/recommendations/next-action", headers=headers)
        assert response.headers["Cache-Control"] == "private, no-store"
        assert not any(key in json.dumps(response.get_json()) for key in ['"participantId"', '"reporterId"', '"lat"', '"lng"', '"photoKey"'])
    with engine.connect() as connection:
        assert before == {table.name: len(connection.execute(select(table)).all()) for table in [events_table, event_members_table, reports_table, cleanup_actions_table]}


def test_new_user_has_neutral_personal_insight_empty_state_and_no_next_action(api):
    _, client = api
    _, headers = signup(client)
    response = client.get("/personal-insights", headers=headers)
    body = response.get_json()
    assert body["sections"] == [] and body["emptyStateReason"] == "NO_ELIGIBLE_PERSONAL_INSIGHTS"
    assert body["links"] == {"map": "/map", "insights": "/insights"}
    assert "reasonCode" not in body
    assert response.headers["Cache-Control"] == "private, no-store"


def test_personal_aggregate_uses_counted_history_and_recalculates_corrections(api):
    application, client = api
    session, headers = signup(client)
    counted = _report(client, headers)
    excluded = _report(client, headers, "Fishing gear")
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == excluded).values(status="Duplicate"))
    body = client.get("/personal-insights", headers=headers).get_json()
    assert body["aggregate"] == [{"beachId": "morib", "category": "Plastic", "reportCount": 1,
        "bandCounts": {"Small": 0, "Medium": 0, "Large": 1, "Very Large": 0}, "weightedScore": 2.55}]
    assert [section["id"] for section in body["sections"]] == ["litter_wildlife"]
    _cleanup(application, session["user"]["id"], target=counted)
    repeated = client.get("/personal-insights", headers=headers).get_json()
    assert repeated["aggregate"] == body["aggregate"]
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(reports_table.update().where(reports_table.c.id == counted).values(status="Incomplete"))
    corrected = client.get("/personal-insights", headers=headers).get_json()
    assert corrected["aggregate"] == []
    with application.extensions["marine_engine"].connect() as connection:
        assert connection.execute(select(user_litter_aggregate_table).where(user_litter_aggregate_table.c.user_id == session["user"]["id"])).all() == []


def test_personal_sources_and_audit_rows_stay_owner_scoped(api):
    application, client = api
    first, first_headers = signup(client)
    second, second_headers = signup(client)
    private_id = _report(client, first_headers, "Fishing gear")
    _report(client, second_headers, "Plastic")
    first_body = client.get("/personal-insights", headers=first_headers).get_json()
    second_body = client.get("/personal-insights", headers=second_headers).get_json()
    assert first_body["aggregate"][0]["category"] == "Fishing gear"
    assert second_body["aggregate"][0]["category"] == "Plastic"
    assert private_id not in json.dumps(first_body) + json.dumps(second_body)
    assert client.get("/personal-insights?userId=" + first["user"]["id"], headers=second_headers).status_code == 400


def test_persistent_section_requires_three_own_cleanups_and_approved_mapping(api):
    application, client = api
    first, first_headers = signup(client)
    second, _ = signup(client)
    rows = [{"category": "Fishing gear", "beforeBand": "Large", "afterBand": "Medium"}]
    for index in range(2):
        _cleanup(application, first["user"]["id"], f"own-{index}", offset=-index - 1, rows=rows)
    _cleanup(application, second["user"]["id"], "other", rows=rows)
    first_body = client.get("/personal-insights", headers=first_headers).get_json()
    assert "persistent_litter" not in {section["id"] for section in first_body["sections"]}
    _cleanup(application, first["user"]["id"], "own-3", rows=rows)
    enough = client.get("/personal-insights", headers=first_headers).get_json()
    persistent = next(section for section in enough["sections"] if section["id"] == "persistent_litter")
    assert persistent["facts"]["includedCleanupCount"] == 3
    assert persistent["facts"]["remainingRate"] == 100
    assert persistent["sources"] and persistent["aiAssisted"] is False


def test_simultaneous_personal_aggregate_reads_do_not_duplicate_rows(api):
    application, client = api
    session, headers = signup(client)
    _report(client, headers)
    engine = application.extensions["marine_engine"]
    owner = session["user"]["id"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(lambda _: refresh_user_aggregate(engine, _impl(), owner), range(8)))
    assert all(value == values[0] for value in values)
    with engine.connect() as connection:
        rows = connection.execute(select(user_litter_aggregate_table).where(user_litter_aggregate_table.c.user_id == owner)).all()
    assert len(rows) == 1 and rows[0].report_count == 1


def test_unsupported_highest_remaining_category_does_not_invent_a_risk_tip(api):
    application, client = api
    session, headers = signup(client)
    rows = [{"category": "Plastic", "beforeBand": "Large", "afterBand": "Small"},
            {"category": "Glass", "beforeBand": "Large", "afterBand": "Medium"}]
    for index in range(3):
        _cleanup(application, session["user"]["id"], f"with-glass-{index}", rows=rows)
    body = client.get("/personal-insights", headers=headers).get_json()
    assert "persistent_litter" not in {section["id"] for section in body["sections"]}


def test_unchanged_categories_are_included_in_personal_remaining_rate(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"],
        quantities={"Plastic": "Very Large", "Fishing gear": "Large"}))
    assert response.status_code == 201
    target = response.get_json()["id"]
    for index, band in enumerate(["Large", "Medium", "Small"]):
        action = client.post("/cleanups", headers=headers, json={
            "targetReportId": target, "afterBands": {"Plastic": band, "Fishing gear": "Large"},
            "handling": "Not recorded", "idempotencyKey": f"unchanged-{index}",
        })
        assert action.status_code == 201
    body = client.get("/personal-insights", headers=headers).get_json()
    persistent = next(section for section in body["sections"] if section["id"] == "persistent_litter")
    assert persistent["facts"]["category"] == "Fishing gear"
    assert persistent["facts"]["includedCleanupCount"] == 3 and persistent["facts"]["remainingRate"] == 100
