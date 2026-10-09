"""Approved conservation content and deterministic, source-grounded answers."""

from __future__ import annotations

import json
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from flask import jsonify, request
from sqlalchemy import Column, DateTime, String, Table, insert, select
from sqlalchemy.exc import IntegrityError

from standalone_cleanup import _active_quantities, _current_band_state
from v3_contract import _user


MVP_BEACHES = frozenset({"morib", "remis", "kelanang", "bagan"})
CONTENT_FILE = Path(__file__).with_name("data") / "wildlife_content.json"
QUESTIONS = (
    "Where does it usually live?",
    "How can marine litter affect it?",
    "What can I do?",
)
QUIZ_DISTRACTORS = (
    "The card does not provide this information.",
    "This would be a confirmed local sighting.",
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


def quiz_payload(card: dict[str, Any], completed: bool = False) -> dict[str, Any]:
    """Build quiz questions only from the approved species-card answers."""
    questions = []
    for index, question in enumerate(card["questions"]):
        questions.append({
            "id": str(index),
            "question": question["text"],
            "options": [
                {"id": "approved", "text": card["answers"][index]["text"]},
                {"id": "context", "text": QUIZ_DISTRACTORS[0]},
                {"id": "sighting", "text": QUIZ_DISTRACTORS[1]},
            ],
        })
    return {
        "cardId": card["id"],
        "title": "Check your understanding",
        "questions": questions,
        "completed": completed,
        "completionNote": "This is an educational activity, not a scientific certification.",
    }


def beach_risk_entries(engine: Any, impl: Any, beach_id: str) -> list[dict[str, Any]]:
    """Return up to three approved risk cards for active beach categories."""
    if not any(beach["id"] == beach_id for beach in impl.load_beaches(engine)):
        return []
    now = datetime.now(timezone.utc)
    with engine.connect() as connection:
        reports = connection.execute(select(impl.reports_table).where(
            impl.reports_table.c.beach_id == beach_id,
            impl.reports_table.c.status == "Counted",
            impl.reports_table.c.created_at >= now - timedelta(days=90),
            impl.reports_table.c.created_at <= now,
            impl.reports_table.c.deleted_at.is_(None),
        )).all()
        actions = connection.execute(select(impl.cleanup_actions_table).where(
            impl.cleanup_actions_table.c.target_report_id.in_([row.id for row in reports])
        )).all() if reports else []
    actions_by_report: dict[str, list[Any]] = {}
    for action in actions:
        actions_by_report.setdefault(action.target_report_id, []).append(action)
    active = [
        (report, _active_quantities(_current_band_state(impl, report, actions_by_report.get(report.id, []))))
        for report in reports
    ]
    active = [(report, quantities) for report, quantities in active if quantities]
    shares = impl.active_composition_percentages(active) if active else []
    approved = {entry["category"]: entry for entry in risk_entries()}
    result = []
    for share in sorted(shares, key=lambda item: (-item["percentage"], item["category"])):
        entry = approved.get(share["category"])
        if entry is None:
            continue
        result.append({
            "category": entry["category"],
            "riskType": entry["riskType"],
            "speciesGroups": entry["speciesGroups"],
            "explanation": entry["explanation"],
            "practicalTip": entry["practicalTip"],
            "source": entry["source"],
            "reviewDate": entry["reviewDate"],
            "reportedShare": share["percentage"],
            "evidence": "Beach-level reported category context; not evidence of local harm.",
        })
    return result[:3]


def wildlife_panel(application: Any, engine: Any, impl: Any, beach_id: str | None = None) -> dict[str, Any]:
    """One row per registered beach, with published or explicitly modelled context.

    Published references and nearby-marine predictions are different evidence
    classes. Neither represents confirmed observations at a named beach.
    """
    cards = {card["scientificName"]: card for card in conservation_cards(engine, impl)}
    cached = application.extensions.setdefault("wildlife_nearby_cache", {})
    model = application.extensions.get("species_distribution_model")
    rows = []
    for beach in impl.load_beaches(engine):
        if beach_id is not None and beach["id"] != beach_id:
            continue
        current_beach_id = beach["id"]
        published = beach.get("species") or []
        predictions = []
        result = {}
        # Curated beaches retain their published references. Only the four
        # pilot cards and beaches missing those references need model inference.
        if model is not None and (current_beach_id in MVP_BEACHES or not published):
            lat, lng = beach.get("lat"), beach.get("lng")
            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                key = (float(lat), float(lng))
                try:
                    if key not in cached:
                        cached[key] = model.predict_nearby_marine(lat, lng, max_distance_km=15, top_k=40)
                    result = cached[key]
                    predictions = result.get("topPredictions", [])
                except (AttributeError, KeyError, ValueError, RuntimeError):
                    pass

        species = []
        source_status = "unavailable"
        if current_beach_id in MVP_BEACHES:
            for prediction in predictions:
                card = cards.get(prediction.get("scientificName"))
                if card is None:
                    continue
                species.append({
                    "id": card["id"], "name": card["name"],
                    "scientificName": card["scientificName"],
                    "relativeOccurrenceScore": prediction.get("relativeOccurrenceScore"),
                    "locationMatchScore": prediction.get("locationMatchScore"),
                    "source": {"label": "OBIS packaged relative-occurrence model", "url": "https://obis.org/"},
                    "sources": card["sources"], "reviewDate": card["reviewDate"],
                    "destination": card["destination"], "evidenceType": "modelled",
                })
            species = species[:2]
            source_status = "modelled" if species else "unavailable"
        elif published:
            for reference in published:
                source = reference.get("source") or {}
                if not reference.get("name") or not str(source.get("url", "")).startswith("https://"):
                    continue
                species.append({
                    "id": reference.get("scientificName") or reference["name"],
                    "name": reference["name"], "scientificName": reference.get("scientificName"),
                    "relativeOccurrenceScore": None, "locationMatchScore": None,
                    "source": {"label": source.get("citation") or "Published coastal reference",
                               "url": source["url"]},
                    "sources": [{"label": source.get("citation") or "Published coastal reference",
                                 "url": source["url"]}],
                    "reviewDate": None, "destination": "/beach/" + current_beach_id,
                    "evidenceType": "published_reference",
                })
                if len(species) == 2:
                    break
            source_status = "published_reference" if species else "unavailable"
        else:
            for prediction in predictions[:2]:
                species.append({
                    "id": prediction["speciesSlug"],
                    "name": prediction.get("commonNameEn") or prediction["scientificName"],
                    "scientificName": prediction["scientificName"],
                    "relativeOccurrenceScore": prediction.get("relativeOccurrenceScore"),
                    "locationMatchScore": prediction.get("locationMatchScore"),
                    "source": {"label": "OBIS-derived marine-grid model", "url": "https://obis.org/"},
                    "sources": prediction.get("sources", []),
                    "reviewDate": None, "destination": "/beach/" + current_beach_id,
                    "evidenceType": "modelled",
                })
            source_status = "modelled" if species else "unavailable"
        rows.append({
            "beachId": current_beach_id, "beachName": beach["name"], "species": species,
            "coordinateContext": result.get("coordinateContext"),
            "modelCount": result.get("modelCount"), "modelVersion": result.get("modelVersion"),
            "ecologicalNote": "Published context or nearby marine-grid estimates; not beach sightings or measured wildlife impact.",
            "sourceStatus": source_status,
        })
    return {
        "beaches": rows,
        "note": "All registered beaches are shown. Published references and modelled nearby marine-grid estimates are distinct. Model scores are not probabilities or confirmed sightings, and do not change Beach Attention.",
    }


def install_wildlife(application: Any, engine: Any, impl: Any, jwt_secret: str | None = None) -> None:
    completions = impl.metadata.tables.get("species_quiz_completions")
    if completions is None:
        completions = Table(
            "species_quiz_completions", impl.metadata,
            Column("user_id", String(80), primary_key=True),
            Column("card_id", String(100), primary_key=True),
            Column("completed_at", DateTime(timezone=True), nullable=False),
        )
    completions.create(engine, checkfirst=True)

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

    def read_quiz(card_id: str):
        card = card_by_id(card_id)
        if card is None:
            return impl.error_response(404, "NOT_FOUND", "Species card not found.")
        completed = False
        if jwt_secret:
            user = _user(engine, impl, jwt_secret)
            if user is not None:
                with engine.connect() as connection:
                    completed = connection.execute(select(completions).where(
                        completions.c.user_id == user.id,
                        completions.c.card_id == card_id,
                    )).first() is not None
        return jsonify(quiz_payload(card, completed))

    def answer_quiz(card_id: str):
        card = card_by_id(card_id)
        if card is None:
            return impl.error_response(404, "NOT_FOUND", "Species card not found.")
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or set(payload) != {"questionId", "optionId"}:
            return impl.error_response(400, "VALIDATION_FAILED", "questionId and optionId are required.")
        question_id = str(payload["questionId"])
        if question_id not in {"0", "1", "2"} or not isinstance(payload["optionId"], str) or payload["optionId"] not in {"approved", "context", "sighting"}:
            return impl.error_response(400, "VALIDATION_FAILED", "Choose an option for one of the three quiz questions.")
        return jsonify({
            "questionId": question_id,
            "correct": payload["optionId"] == "approved",
            "explanation": card["answers"][int(question_id)]["text"],
            "sources": card["sources"],
            "complete": False,
        })

    def complete_quiz(card_id: str):
        card = card_by_id(card_id)
        if card is None:
            return impl.error_response(404, "NOT_FOUND", "Species card not found.")
        user = _user(engine, impl, jwt_secret) if jwt_secret else None
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to save quiz completion.")
        payload = request.get_json(silent=True)
        answers = payload.get("answers") if isinstance(payload, dict) and set(payload) == {"answers"} else None
        valid_options = {"approved", "context", "sighting"}
        valid_rows = isinstance(answers, list) and all(
            isinstance(row, dict)
            and set(row) == {"questionId", "optionId"}
            and isinstance(row["optionId"], str)
            and row["optionId"] in valid_options
            for row in answers
        )
        ids = [str(row["questionId"]) for row in answers] if valid_rows else []
        if len(ids) != 3 or set(ids) != {"0", "1", "2"}:
            return impl.error_response(400, "VALIDATION_FAILED", "Answer each quiz question exactly once.")
        recorded = False
        try:
            with engine.begin() as connection:
                with connection.begin_nested():
                    connection.execute(insert(completions).values(
                        user_id=user.id,
                        card_id=card_id,
                        completed_at=datetime.now(timezone.utc),
                    ))
                    recorded = True
        except IntegrityError:
            recorded = False
        return jsonify({"cardId": card_id, "completed": True, "recorded": recorded})

    def beach_wildlife(beach_id: str):
        result = wildlife_panel(application, engine, impl, beach_id=beach_id)
        if not result["beaches"]:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        return jsonify(result["beaches"][0])

    def beach_risks(beach_id: str):
        if not any(beach["id"] == beach_id for beach in impl.load_beaches(engine)):
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        return jsonify(beach_risk_entries(engine, impl, beach_id))

    application.add_url_rule("/species-cards", "list_species_cards", cards_for_request)
    application.add_url_rule("/species-cards/<card_id>", "read_species_card", read_card)
    application.add_url_rule("/species-cards/<card_id>/answers", "answer_species_question", answer_question, methods=["POST"])
    application.add_url_rule("/species-cards/<card_id>/quiz", "read_species_quiz", read_quiz, methods=["GET"])
    application.add_url_rule("/species-cards/<card_id>/quiz/answer", "answer_species_quiz", answer_quiz, methods=["POST"])
    application.add_url_rule("/species-cards/<card_id>/quiz/complete", "complete_species_quiz", complete_quiz, methods=["POST"])
    application.add_url_rule("/wildlife-risks", "read_wildlife_risks", lambda: jsonify(risk_entries()))
    application.add_url_rule("/beaches/<beach_id>/wildlife-risks", "read_beach_wildlife_risks", beach_risks)
    application.add_url_rule("/wildlife-guidance", "read_wildlife_guidance", lambda: jsonify(wildlife_guidance()))
    application.add_url_rule("/insights/wildlife", "read_insights_wildlife", lambda: jsonify(wildlife_panel(application, engine, impl)))
    application.add_url_rule("/beaches/<beach_id>/wildlife", "read_beach_wildlife", beach_wildlife)

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

    @application.after_request
    def protect_personal_quiz_state(response: Any):
        if request.endpoint == "read_species_quiz" and response.status_code == 200:
            response.headers["Cache-Control"] = "private, no-store"
            response.vary.add("Authorization")
        return response
