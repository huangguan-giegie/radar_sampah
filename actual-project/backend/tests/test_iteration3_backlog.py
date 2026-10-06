"""Contract coverage for the Iteration 3 backlog interfaces."""

import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import insert

import app_core as impl
from api_tests_core import api, signup


def add_counted_report(engine, user_id, report_id, *, created_at=None, quantities=None):
    quantities = quantities or {"Plastic": "Medium"}
    created_at = created_at or datetime.now(timezone.utc) - timedelta(days=1)
    category, quantity = impl.derive_category_quantity(quantities)
    with engine.begin() as connection:
        connection.execute(insert(impl.reports_table).values(
            id=report_id,
            reporter_id=user_id,
            beach_id="morib",
            beach_name="Pantai Morib",
            quantities=json.dumps(quantities),
            location_source="manual",
            photo_key=f"{report_id}.jpg",
            photo_mime="image/jpeg",
            category=category,
            quantity=quantity,
            status="Counted",
            created_at=created_at,
            updated_at=created_at,
            deleted_at=None,
            **impl.quantity_values(quantities),
        ))


def test_species_quiz_is_public_answerable_and_idempotently_recorded(api):
    _application, client = api
    card = client.get("/species-cards").get_json()[0]
    quiz_path = f"/species-cards/{card['id']}/quiz"
    quiz = client.get(quiz_path).get_json()
    assert quiz["cardId"] == card["id"]
    assert len(quiz["questions"]) == 3
    assert all({option["id"] for option in question["options"]} == {"approved", "context", "sighting"} for question in quiz["questions"])
    answer = client.post(f"{quiz_path}/answer", json={"questionId": "1", "optionId": "approved"})
    assert answer.status_code == 200
    assert answer.get_json()["correct"] is True
    assert client.post(f"{quiz_path}/answer", json={"questionId": "9", "optionId": "approved"}).status_code == 400
    assert client.post(f"{quiz_path}/complete", json={"answers": []}).status_code == 401

    _session, headers = signup(client)
    answers = [{"questionId": str(index), "optionId": "approved"} for index in range(3)]
    first = client.post(f"{quiz_path}/complete", headers=headers, json={"answers": answers})
    second = client.post(f"{quiz_path}/complete", headers=headers, json={"answers": answers})
    assert first.status_code == 200 and first.get_json() == {"cardId": card["id"], "completed": True, "recorded": True}
    assert second.status_code == 200 and second.get_json() == {"cardId": card["id"], "completed": True, "recorded": False}
    assert client.get(quiz_path, headers=headers).get_json()["completed"] is True
    malformed = [{"questionId": str(index), "optionId": "unknown"} for index in range(3)]
    assert client.post(f"{quiz_path}/complete", headers=headers, json={"answers": malformed}).status_code == 400


def test_beach_risk_cards_use_current_active_report_composition(api):
    application, client = api
    session, _headers = signup(client)
    add_counted_report(application.extensions["marine_engine"], session["user"]["id"], "risk-report")
    response = client.get("/beaches/morib/wildlife-risks")
    assert response.status_code == 200
    cards = response.get_json()
    assert cards and cards[0]["category"] == "Plastic"
    assert cards[0]["reportedShare"] == 100
    assert "not evidence of local harm" in cards[0]["evidence"]
    assert client.get("/beaches/unknown/wildlife-risks").status_code == 404


def test_weekly_reporting_activity_is_exposed_in_insights(api):
    application, client = api
    session, _headers = signup(client)
    engine = application.extensions["marine_engine"]
    now = datetime.now(timezone.utc)
    for index in range(3):
        add_counted_report(engine, session["user"]["id"], f"weekly-{index}", created_at=now - timedelta(hours=index))
    weekly = client.get("/insights/participation").get_json()["weeklyReporting"]
    assert len(weekly["weeks"]) == 12
    current = weekly["weeks"][-1]
    assert current["countedReports"] == 3
    assert current["distinctReporters"] == "Fewer than 3"
    assert weekly["timezone"] == "Asia/Kuala_Lumpur"


def test_first_cleanup_badge_requires_a_non_empty_cleanup(api):
    application, client = api
    session, headers = signup(client)
    assert client.get("/badges").status_code == 401
    assert client.get("/badges", headers=headers).get_json() == []
    created = datetime.now(timezone.utc) - timedelta(days=1)
    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(insert(impl.cleanup_actions_table).values(
            id="badge-cleanup",
            participant_id=session["user"]["id"],
            target_report_id=None,
            event_id=None,
            beach_id="morib",
            removed_counts="{}",
            rows="[]",
            total_removed=0,
            cleanup_score=2,
            remaining_quantities="{}",
            removed_quantities=json.dumps({"Plastic": "Medium"}),
            handling="Collected for disposal",
            note="",
            idempotency_key="badge-cleanup",
            request_fingerprint="badge-cleanup",
            created_at=created,
        ))
    assert client.get("/badges", headers=headers).get_json() == [{
        "id": "shoreline-scout",
        "name": "Shoreline Scout",
        "description": "Recorded your first cleanup.",
        "earnedAt": impl.contract_timestamp(created),
    }]
