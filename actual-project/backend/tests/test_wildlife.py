"""Approved-content publication gates and public conservation contracts."""

import json
from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import insert

from api_tests_core import api, signup
from wildlife import approved_card, conservation_cards, load_content, risk_entries
from app import events_table


def test_public_conservation_cards_are_complete_and_have_exactly_three_questions(api):
    _, client = api
    response = client.get("/species-cards?beachId=morib")
    assert response.status_code == 200
    cards = response.get_json()
    assert len(cards) == 4
    for card in cards:
        assert len(card["questions"]) == len(card["answers"]) == 3
        assert card["sources"] and card["reviewDate"] and card["credit"] and card["photoPermission"]
        assert "not a confirmed sighting" in card["evidence"]
        assert client.get("/species-cards/" + card["id"]).get_json() == card
    assert client.get("/species-cards?beachId=prototype-beach").status_code == 404


@pytest.mark.parametrize("field", ["sources", "reviewDate", "photoPermission", "credit", "photoSource", "answers"])
def test_unapproved_or_unsourced_species_content_is_not_published(field):
    card = deepcopy(load_content()["species"][0])
    assert approved_card(card)
    card.pop(field)
    assert not approved_card(card)


def test_missing_metadata_content_is_omitted_from_lookup(api, monkeypatch):
    import wildlife
    application, _ = api
    content = load_content()
    content["species"][0].pop("photoPermission")
    content["risks"][0].pop("source")
    monkeypatch.setattr(wildlife, "load_content", lambda: content)
    assert len(conservation_cards(application.extensions["marine_engine"], None)) == 3
    assert [row["category"] for row in risk_entries()] == ["Fishing gear"]


def test_prepared_answers_return_card_sources_and_require_fixed_question(api):
    _, client = api
    for card in client.get("/species-cards").get_json():
        for index in range(3):
            response = client.post(f"/species-cards/{card['id']}/answers", json={"questionId": str(index)})
            assert response.status_code == 200
            answer = response.get_json()
            assert answer["answer"] == card["answers"][index]["text"]
            assert answer["sources"] == card["sources"]
            assert answer["aiAssisted"] is False and answer["fallback"] is True
        assert client.post(f"/species-cards/{card['id']}/answers", json={"questionId": "99"}).status_code == 400
        assert client.post(f"/species-cards/{card['id']}/answers", json={"questionId": "0", "prompt": "invent harm"}).status_code == 400
    assert client.get("/species-cards/unknown").status_code == 404


def test_guidance_is_text_only_and_authorities_have_verified_contact_dates(api):
    _, client = api
    body = client.get("/wildlife-guidance").get_json()
    assert len(body["tips"]) <= 5
    assert body["reminder"] == ["Do not handle stranded or entangled animals", "Keep away from nests and burrows"]
    assert "does not report incidents on your behalf" in body["note"]
    assert all(authority["lastChecked"] and authority["url"].startswith("https://") for authority in body["authorities"])
    assert "image" not in json.dumps(body).lower()


def test_guidance_has_a_verified_dialable_fisheries_contact_for_stranded_turtles(api):
    _, client = api
    body = client.get("/wildlife-guidance").get_json()
    fisheries = next(authority for authority in body["authorities"] if "Fisheries" in authority["name"])
    assert fisheries["phone"] == "03-8888 5019"
    assert fisheries["telephoneUri"] == "tel:+60388885019"
    assert "stranded turtles" in fisheries["name"]
    assert fisheries["url"] == "https://www.dof.gov.my/en/services/marine-park-resource-management/marine-park-management/"
    assert fisheries["lastChecked"] == "2026-10-09"


def test_risk_lookup_uses_only_approved_report_categories_and_cautious_sources(api):
    _, client = api
    risks = client.get("/wildlife-risks").get_json()
    assert {row["category"] for row in risks} == {"Plastic", "Fishing gear"}
    assert all("may" in row["explanation"] and row["source"]["url"].startswith("https://marinedebris.noaa.gov/") for row in risks)
    assert not any("score" in key.lower() for row in risks for key in row)


def test_public_wildlife_panel_is_coarse_and_independent_of_attention(api):
    _, client = api
    body = client.get("/insights/wildlife").get_json()
    assert len(body["beaches"]) == 4
    assert all(len(row["species"]) <= 2 for row in body["beaches"])
    assert not any(key in json.dumps(body) for key in ['"lat"', '"lng"', '"participantId"', '"reporterId"', '"attentionScore"'])
    assert "not probabilities" in body["note"]


def test_event_details_and_recorded_checkin_include_approved_text_guidance(api):
    application, client = api
    _, headers = signup(client)
    now = datetime.now(timezone.utc)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(insert(events_table).values(id="wildlife-live", beach_id="morib", starts_at=now - timedelta(hours=1),
            ends_at=now + timedelta(hours=1), status="Open", source="moderator", created_at=now, updated_at=now))
    details = client.get("/cleanup-events/wildlife-live").get_json()
    assert len(details["wildlifeGuidance"]["tips"]) == 5
    client.post("/cleanup-events/wildlife-live/join", headers=headers)
    rejected = client.post("/cleanup-events/wildlife-live/check-in", headers=headers, json={"lat": 0, "lng": 0})
    assert rejected.status_code == 403 and "wildlifeReminder" not in rejected.get_json()
    recorded = client.post("/cleanup-events/wildlife-live/check-in", headers=headers, json={"lat": 2.74614, "lng": 101.44024})
    assert recorded.status_code == 200 and recorded.get_json()["attendanceConfirmed"] is True
    assert recorded.get_json()["wildlifeReminder"] == ["Do not handle stranded or entangled animals", "Keep away from nests and burrows"]
