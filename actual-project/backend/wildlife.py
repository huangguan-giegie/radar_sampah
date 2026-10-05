"""Approved conservation content and deterministic, source-grounded answers."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Any

from flask import jsonify, request


MVP_BEACHES = frozenset({"morib", "remis", "kelanang", "bagan"})
CONTENT_FILE = Path(__file__).with_name("data") / "wildlife_content.json"
QUESTIONS = (
    "Where does it usually live?",
    "How can marine litter affect it?",
    "What can I do?",
)


def load_content() -> dict[str, Any]:
    return json.loads(CONTENT_FILE.read_text(encoding="utf-8"))


def _source_valid(source: Any) -> bool:
    return isinstance(source, dict) and bool(source.get("label")) and str(source.get("url", "")).startswith("https://")


def _reviewed(value: Any) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except (TypeError, ValueError):
        return False


def approved_card(card: dict[str, Any]) -> bool:
    return bool(
        card.get("approved") is True
        and card.get("id") and card.get("name") and card.get("scientificName")
        and card.get("intro") and card.get("image") and card.get("credit")
        and card.get("sources") and all(_source_valid(source) for source in card["sources"])
        and _reviewed(card.get("reviewDate"))
        and _source_valid(card.get("photoPermission"))
        and str(card.get("photoSource", "")).startswith("https://")
        and len(card.get("answers", [])) == 3
        and all(answer.get("text") for answer in card["answers"])
    )


def conservation_cards(engine: Any, impl: Any, beach_id: str | None = None) -> list[dict[str, Any]]:
    if beach_id is not None and beach_id not in MVP_BEACHES:
        return []
    cards = [deepcopy(card) for card in load_content().get("species", []) if approved_card(card)]
    for card in cards:
        card.pop("approved", None)
        card["questions"] = [{"id": str(index), "text": question} for index, question in enumerate(QUESTIONS)]
        card["destination"] = "/species/" + card["id"]
        card["evidence"] = "Published conservation context; not a confirmed sighting or a model probability."
    return cards


def risk_entries() -> list[dict[str, Any]]:
    entries = []
    for entry in load_content().get("risks", []):
        if (
            entry.get("approved") is True and entry.get("category") in {"Plastic", "Fishing gear"}
            and entry.get("riskType") and entry.get("speciesGroups") and entry.get("explanation")
            and entry.get("practicalTip") and _source_valid(entry.get("source"))
            and _reviewed(entry.get("reviewDate"))
        ):
            public = deepcopy(entry)
            public.pop("approved", None)
            entries.append(public)
    return entries


def wildlife_guidance() -> dict[str, Any]:
    guidance = deepcopy(load_content()["guidance"])
    guidance["tips"] = guidance["tips"][:5]
    return guidance


def wildlife_panel(application: Any, engine: Any, impl: Any) -> dict[str, Any]:
    cards = {card["scientificName"]: card for card in conservation_cards(engine, impl)}
    rows = []
    for beach in impl.load_beaches(engine):
        if beach["id"] not in MVP_BEACHES:
            continue
        predictions = []
        try:
            result = application.extensions["species_distribution_model"].predict(beach["lat"], beach["lng"])
            predictions = result.get("predictions", [])
        except (KeyError, ValueError, RuntimeError):
            pass
        modelled = []
        for prediction in sorted(predictions, key=lambda value: value.get("relativeOccurrenceScore", 0), reverse=True):
            card = cards.get(prediction.get("scientificName"))
            if card is None:
                continue
            modelled.append({"id": card["id"], "name": card["name"], "scientificName": card["scientificName"],
                             "relativeOccurrenceScore": prediction.get("relativeOccurrenceScore"),
                             "source": {"label": "OBIS packaged relative-occurrence model", "url": "https://obis.org/"},
                             "sources": card["sources"], "reviewDate": card["reviewDate"], "destination": card["destination"]})
        rows.append({"beachId": beach["id"], "beachName": beach["name"], "species": modelled[:2],
                     "ecologicalNote": "Approved species cards provide general conservation context; this panel does not record local sightings.",
                     "sourceStatus": "ready" if modelled else "unavailable"})
    return {"beaches": rows, "note": "Modelled relative scores are not probabilities or confirmed sightings and do not change Beach Attention."}


def install_wildlife(application: Any, engine: Any, impl: Any) -> None:
    application.extensions["insights_wildlife"] = lambda: wildlife_panel(application, engine, impl)
    def cards_for_request():
        beach_id = request.args.get("beachId")
        if beach_id and beach_id not in MVP_BEACHES:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        return jsonify(conservation_cards(engine, impl, beach_id))

    def card_by_id(card_id: str):
        return next((card for card in conservation_cards(engine, impl) if card["id"] == card_id), None)

    def read_card(card_id: str):
        card = card_by_id(card_id)
        return jsonify(card) if card else impl.error_response(404, "NOT_FOUND", "Species card not found.")

    def answer_question(card_id: str):
        card = card_by_id(card_id)
        if card is None:
            return impl.error_response(404, "NOT_FOUND", "Species card not found.")
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or set(payload) != {"questionId"} or payload["questionId"] not in {"0", "1", "2"}:
            return impl.error_response(400, "VALIDATION_FAILED", "Choose one of the three suggested questions.")
        index = int(payload["questionId"])
        return jsonify({
            "questionId": str(index), "question": QUESTIONS[index],
            "answer": card["answers"][index]["text"], "sources": card["sources"],
            "reviewDate": card["reviewDate"], "mode": "prepared", "aiAssisted": False,
            "validation": "approved_prepared_answer", "fallback": True,
        })

    application.add_url_rule("/species-cards", "list_species_cards", cards_for_request)
    application.add_url_rule("/species-cards/<card_id>", "read_species_card", read_card)
    application.add_url_rule("/species-cards/<card_id>/answers", "answer_species_question", answer_question, methods=["POST"])
    application.add_url_rule("/wildlife-risks", "read_wildlife_risks", lambda: jsonify(risk_entries()))
    application.add_url_rule("/wildlife-guidance", "read_wildlife_guidance", lambda: jsonify(wildlife_guidance()))
    application.add_url_rule("/insights/wildlife", "read_insights_wildlife", lambda: jsonify(wildlife_panel(application, engine, impl)))

    @application.after_request
    def attach_wildlife_event_guidance(response: Any):
        if request.endpoint not in {"get_event", "v3_get_event", "check_in_event", "v3_check_in"} or response.status_code != 200:
            return response
        body = response.get_json(silent=True)
        if not isinstance(body, dict):
            return response
        guidance = wildlife_guidance()
        if request.method == "GET":
            body["wildlifeGuidance"] = guidance
        elif body.get("attendanceConfirmed") or body.get("locationPassed") or body.get("attendanceStatus") == "Recorded":
            body["wildlifeReminder"] = guidance["reminder"]
        else:
            return response
        response.set_data(impl.json.dumps(body, separators=(",", ":")))
        return response
