"""Flask API for the Team 04 Radar Sampah demonstration.

The service exposes broad-area marine litter reports, illustrative severity
results and cleanup progress. It uses synthetic/public data and never stores
personal identifiers or exact litter coordinates in the main flow.
"""

from __future__ import annotations

import json
import math
import os
import re
import secrets
import tempfile
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any

import jwt
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    insert,
    select,
)
from sqlalchemy.engine import Engine

from recognition_adapter import recognise_litter


DATA_VERSION = "marine-observation-v1"
OBIS_DATA_VERSION = "obis-malaysia-public-2026-08-14-v1"
SOURCE_LABEL = "synthetic/public demonstration data"
ALLOWED_CATEGORIES = {
    "plastic packaging": "Plastic packaging",
    "fishing gear": "Fishing gear",
    "glass": "Glass",
    "metal": "Metal",
    "other": "Other",
}
PERSONAL_IDENTIFIER_FIELDS = {
    "name",
    "full_name",
    "email",
    "phone",
    "telephone",
    "account",
    "account_id",
    "username",
    "password",
    "secret",
    "api_key",
}
LOCAL_DATABASE_URL = "sqlite:///marine_observation.db"
PRECISE_LOCATION_FIELDS = {"latitude", "longitude", "coordinates", "gps", "exact_location"}
FRONTEND_CATEGORIES = ("Plastic", "Fishing gear", "Glass", "Metal", "Paper", "Other")
QUANTITY_WEIGHTS = {"Small": 1, "Medium": 2, "Large": 3, "Very Large": 4}
CATEGORY_WEIGHTS = {"Fishing gear": 1.0, "Plastic": 0.85, "Glass": 0.7, "Metal": 0.6, "Other": 0.5, "Paper": 0.35}
REPORT_STATUS_NOTES = {
    "Duplicate": "Matched an existing record for the same beach and day — excluded from the severity calculation.",
    "Incomplete": "Photo unreadable — excluded until you correct and save the record.",
}
KUALA_LUMPUR = timezone(timedelta(hours=8))

# Anonymous participant auth (API.md §1). No name, email, phone or password is
# collected. The four-digit participant ID is suitable only for this demo.
AUTH_JWT_ALGORITHM = "HS256"
AUTH_TOKEN_TTL_DAYS = 30
PARTICIPANT_ID_MIN = 1000
PARTICIPANT_ID_MAX = 9999
PARTICIPANT_ID_POOL_SIZE = PARTICIPANT_ID_MAX - PARTICIPANT_ID_MIN + 1
PARTICIPANT_ID_MAX_ATTEMPTS = 20
DEFAULT_VOLUNTEER_ROLE = "volunteer"


metadata = MetaData()
# Users store a random participant ID and role, without personal identity data.
users_table = Table(
    "users",
    metadata,
    Column("id", String(80), primary_key=True),
    Column("participant_id", String(4), nullable=False, unique=True),
    Column("role", String(20), nullable=False, default=DEFAULT_VOLUNTEER_ROLE),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
observations_table = Table(
    "observations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("category", String(64), nullable=False),
    Column("area", String(160), nullable=False),
    Column("latitude", Float, nullable=False),
    Column("longitude", Float, nullable=False),
    Column("observed_at", String(40), nullable=False),
    Column("image_url", String(500)),
    Column("note", Text),
    Column("source", String(80), nullable=False),
    Column("demo", Boolean, nullable=False, default=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
classifications_table = Table(
    "observation_classifications",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("observation_id", ForeignKey("observations.id"), nullable=False, unique=True),
    Column("label", String(64), nullable=False),
    Column("rule", String(80), nullable=False),
    Column("method", Text, nullable=False),
)
priorities_table = Table(
    "observation_priorities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("observation_id", ForeignKey("observations.id"), nullable=False, unique=True),
    Column("level", String(12), nullable=False),
    Column("reason", Text, nullable=False),
    Column("disclaimer", Text, nullable=False),
    Column("illustrative", Boolean, nullable=False, default=True),
)
context_table = Table(
    "marine_context",
    metadata,
    Column("id", String(80), primary_key=True),
    Column("source", String(40), nullable=False),
    Column("source_url", String(500), nullable=False),
    Column("retrieved_at", String(40), nullable=False),
    Column("license", String(160), nullable=False),
    Column("latitude", Float, nullable=False),
    Column("longitude", Float, nullable=False),
    Column("taxon_or_context_label", String(240), nullable=False),
    Column("sensitivity", String(40), nullable=False),
)
litter_reports_table = Table(
    "litter_reports",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("area_id", String(80), nullable=False),
    Column("category", String(64), nullable=False),
    Column("quantity", Integer, nullable=False, default=1),
    Column("observed_at", String(40), nullable=False),
    Column("detection", String(80), nullable=False),
    Column("priority", String(12), nullable=False),
    Column("image_url", String(500)),
    Column("note", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
litter_detections_table = Table(
    "litter_detections",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("report_id", ForeignKey("litter_reports.id"), nullable=False, unique=True),
    Column("method", String(80), nullable=False),
    Column("status", String(40), nullable=False),
    Column("category", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
litter_priorities_table = Table(
    "litter_priorities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("report_id", ForeignKey("litter_reports.id"), nullable=False, unique=True),
    Column("level", String(12), nullable=False),
    Column("severity_score", Integer, nullable=False),
    Column("reason", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
cleanup_missions_table = Table(
    "cleanup_missions",
    metadata,
    Column("id", String(80), primary_key=True),
    Column("title", String(160), nullable=False),
    Column("area_id", String(80), nullable=False),
    Column("region", String(80), nullable=False),
    Column("scheduled_for", String(40), nullable=False),
)
cleanup_joins_table = Table(
    "cleanup_joins",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("mission_id", ForeignKey("cleanup_missions.id"), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
cleanup_evidence_table = Table(
    "cleanup_evidence",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("mission_id", ForeignKey("cleanup_missions.id")),
    Column("before_report_id", ForeignKey("litter_reports.id")),
    Column("after_report_id", ForeignKey("litter_reports.id")),
    Column("item_count", Integer, nullable=False),
    Column("image_url", String(500)),
    Column("before_image_url", String(500)),
    Column("after_image_url", String(500)),
    Column("impact_note", Text),
    Column("note", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
frontend_reports_table = Table(
    "frontend_reports",
    metadata,
    Column("id", String(40), primary_key=True),
    Column("reporter_id", ForeignKey("users.id"), nullable=False),
    Column("beach_id", String(80), nullable=False),
    Column("beach_name", String(160), nullable=False),
    Column("quantities", Text, nullable=False),
    Column("category", String(40), nullable=False),
    Column("quantity", String(20), nullable=False),
    Column("photo_key", String(500), nullable=False),
    Column("location_source", String(20), nullable=False),
    Column("status", String(20), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


def normalise_database_url(database_url: str | None) -> str:
    """Return a SQLAlchemy-compatible database URL with a safe local fallback."""
    value = (database_url or LOCAL_DATABASE_URL).strip()
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg2://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg2://", 1)
    return value


def load_context_samples() -> list[dict[str, Any]]:
    data_path = Path(__file__).parent / "data" / "obis_context.json"
    with data_path.open(encoding="utf-8") as context_file:
        return json.load(context_file)


def load_option_catalog() -> dict[str, Any]:
    data_path = Path(__file__).parent / "data" / "litter_options.json"
    with data_path.open(encoding="utf-8") as options_file:
        return json.load(options_file)


def load_data_file(filename: str) -> dict[str, Any]:
    with (Path(__file__).parent / "data" / filename).open(encoding="utf-8") as data_file:
        return json.load(data_file)


def contains_personal_identifier(payload: Any) -> bool:
    if isinstance(payload, dict):
        return bool(PERSONAL_IDENTIFIER_FIELDS.intersection(str(key).lower() for key in payload)) or any(
            contains_personal_identifier(value) for value in payload.values()
        )
    if isinstance(payload, list):
        return any(contains_personal_identifier(value) for value in payload)
    return False


def contains_precise_location(payload: Any) -> bool:
    return isinstance(payload, dict) and bool(PRECISE_LOCATION_FIELDS.intersection(str(key).lower() for key in payload))


def create_engine_for_url(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, future=True, connect_args=connect_args)


def error_response(status: int, code: str, message: str):
    return jsonify({"code": code, "message": message}), status


def auth_jwt_secret(testing: bool) -> str:
    secret = os.getenv("AUTH_JWT_SECRET", "").strip()
    if secret:
        return secret
    if testing:
        return "test-only-secret-not-for-production"
    raise RuntimeError("AUTH_JWT_SECRET must be configured outside tests")


def generate_user_id() -> str:
    return "u_" + secrets.token_hex(12)


def issue_token(user_id: str, jwt_secret: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=AUTH_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, jwt_secret, algorithm=AUTH_JWT_ALGORITHM)


def decode_token_subject(token: str, jwt_secret: str) -> str | None:
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=[AUTH_JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


def generate_participant_id(connection: Any) -> str:
    """Pick a random, unused 4-digit participant ID (API.md §1: random, not sequential)."""
    for _ in range(PARTICIPANT_ID_MAX_ATTEMPTS):
        candidate = str(secrets.randbelow(PARTICIPANT_ID_POOL_SIZE) + PARTICIPANT_ID_MIN)
        taken = connection.execute(
            select(users_table.c.id).where(users_table.c.participant_id == candidate)
        ).first()
        if taken is None:
            return candidate
    raise RuntimeError("No participant IDs are available")


def user_dict(row: Any) -> dict[str, Any]:
    return {"id": row.id, "participantId": row.participant_id, "role": row.role}


def initialise_database(engine: Engine) -> None:
    metadata.create_all(engine)
    samples = load_context_samples()
    tidetrace_catalog = load_data_file("tidetrace_catalog.json")
    sample_ids = {sample["id"] for sample in samples}
    with engine.begin() as connection:
        existing_ids = set(connection.execute(select(context_table.c.id)).scalars().all())
        # Sync static context rows without changing observations or derived results.
        for stale_id in existing_ids - sample_ids:
            connection.execute(context_table.delete().where(context_table.c.id == stale_id))
        for sample in samples:
            existing = connection.execute(
                select(context_table.c.id).where(context_table.c.id == sample["id"])
            ).first()
            if existing is None:
                location = sample["approximate_location"]
                connection.execute(
                    insert(context_table).values(
                        id=sample["id"],
                        source=sample["source"],
                        source_url=sample["source_url"],
                        retrieved_at=sample["retrieved_at"],
                        license=sample["license"],
                        latitude=location["latitude"],
                        longitude=location["longitude"],
                        taxon_or_context_label=sample["taxon_or_context_label"],
                        sensitivity=sample["sensitivity"],
                    )
                )
        for mission in tidetrace_catalog["missions"]:
            if connection.execute(select(cleanup_missions_table.c.id).where(cleanup_missions_table.c.id == mission["id"])).first() is None:
                connection.execute(insert(cleanup_missions_table).values(**mission))


def parse_payload(payload: Any) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(payload, dict):
        return None, "A JSON object is required"
    if contains_personal_identifier(payload):
        return None, "Personal identifier fields are not accepted"

    required = ("category", "area", "latitude", "longitude", "observed_at")
    missing = [field for field in required if payload.get(field) in (None, "")]
    if missing:
        return None, "Missing required fields"

    category_key = str(payload["category"]).strip().lower()
    category = ALLOWED_CATEGORIES.get(category_key)
    if category is None:
        return None, "Unsupported category"

    area = str(payload["area"]).strip()
    if not area or len(area) > 160:
        return None, "area must be between 1 and 160 characters"

    try:
        latitude = float(payload["latitude"])
        longitude = float(payload["longitude"])
    except (TypeError, ValueError):
        return None, "Coordinates must be numeric"
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None, "Coordinates are out of range"

    timestamp = str(payload["observed_at"]).strip()
    try:
        parsed_time = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None, "observed_at must be a valid ISO 8601 timestamp"
    if parsed_time.tzinfo is None:
        parsed_time = parsed_time.replace(tzinfo=timezone.utc)
    observed_at = parsed_time.isoformat()

    image_url = str(payload.get("image_url") or "").strip() or None
    if image_url and not (image_url.startswith("/assets/") or image_url.startswith("https://")):
        return None, "image_url must use HTTPS or a local /assets/ path"
    if image_url and len(image_url) > 500:
        return None, "image_url must be at most 500 characters"

    note = str(payload.get("note") or "").strip() or None
    if note and len(note) > 600:
        return None, "note must be at most 600 characters"

    return {
        "category": category,
        "area": area,
        "latitude": latitude,
        "longitude": longitude,
        "observed_at": observed_at,
        "image_url": image_url,
        "note": note,
    }, None


def classification_for(category: str) -> dict[str, str]:
    return {
        "label": category,
        "rule": "category_passthrough_v1",
        "method": "Fixed demonstration category selected by the reporter.",
    }


def priority_for(category: str, existing_area_count: int) -> dict[str, Any]:
    disclaimer = (
        "Illustrative demo priority only; this is not a pollution-source proof, "
        "scientific finding, or enforcement decision."
    )
    if category == "Fishing gear":
        level = "high"
        reason = "Fishing gear is shown as a higher illustrative clean-up priority because of potential entanglement risk."
    elif existing_area_count >= 2:
        level = "high"
        reason = "Repeated synthetic reports in this selected area raise the illustrative clean-up priority."
    elif category in {"Plastic packaging", "Glass", "Metal"}:
        level = "medium"
        reason = "This fixed demonstration category receives a medium illustrative clean-up priority."
    else:
        level = "low"
        reason = "This fixed demonstration category receives a low illustrative clean-up priority."
    return {"level": level, "reason": reason, "disclaimer": disclaimer, "illustrative": True}


def observation_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "category": row.category,
        "area": row.area,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "observed_at": row.observed_at,
        "image_url": row.image_url,
        "note": row.note,
        "demo": bool(row.demo),
    }


def context_dict(row: Any) -> dict[str, Any]:
    return {
        "id": row.id,
        "source": row.source,
        "source_url": row.source_url,
        "retrieved_at": row.retrieved_at,
        "license": row.license,
        "approximate_location": {"latitude": row.latitude, "longitude": row.longitude},
        "taxon_or_context_label": row.taxon_or_context_label,
        "sensitivity": row.sensitivity,
    }


def context_payload(engine: Engine) -> dict[str, Any]:
    with engine.connect() as connection:
        rows = connection.execute(select(context_table).order_by(context_table.c.id)).all()
    return {
        "context": [context_dict(row) for row in rows],
        "source": "OBIS",
        "data_version": OBIS_DATA_VERSION,
        "demo": True,
    }


def result_for_observation(engine: Engine, observation_id: int) -> dict[str, Any]:
    statement = (
        select(observations_table, classifications_table, priorities_table)
        .join(classifications_table, classifications_table.c.observation_id == observations_table.c.id)
        .join(priorities_table, priorities_table.c.observation_id == observations_table.c.id)
        .where(observations_table.c.id == observation_id)
    )
    with engine.connect() as connection:
        row = connection.execute(statement).first()
    if row is None:
        raise LookupError("Observation was not found after saving")
    context = context_payload(engine)
    return {
        "observation": observation_dict(row),
        "classification": {"label": row.label, "rule": row.rule, "method": row.method},
        "priority": {
            "level": row.level,
            "reason": row.reason,
            "disclaimer": row.disclaimer,
            "illustrative": bool(row.illustrative),
        },
        "context": context["context"][0] if context["context"] else None,
        "source": SOURCE_LABEL,
        "data_version": DATA_VERSION,
        "demo": True,
    }


def tidetrace_catalogue() -> dict[str, Any]:
    return load_data_file("tidetrace_catalog.json")


def parse_litter_report_payload(payload: Any, area_ids: set[str]) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(payload, dict):
        return None, "A JSON object is required"
    if contains_personal_identifier(payload):
        return None, "Personal identifier fields are not accepted"
    if contains_precise_location(payload):
        return None, "Exact coordinate fields are not accepted"
    area_id = str(payload.get("area_id") or "").strip()
    category = ALLOWED_CATEGORIES.get(str(payload.get("category") or "").strip().lower())
    if area_id not in area_ids or category is None:
        return None, "A known area_id and supported category are required"
    try:
        quantity = int(payload.get("quantity", 1))
    except (TypeError, ValueError):
        return None, "quantity must be a positive whole number"
    if quantity < 1 or quantity > 500:
        return None, "quantity must be between 1 and 500"
    timestamp = str(payload.get("observed_at") or datetime.now(timezone.utc).isoformat()).strip()
    try:
        observed_at = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None, "observed_at must be a valid ISO 8601 timestamp"
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    image_url = str(payload.get("image_url") or "").strip() or None
    if image_url and not (image_url.startswith("/assets/") or image_url.startswith("https://")):
        return None, "image_url must use HTTPS or a local /assets/ path"
    note = str(payload.get("note") or "").strip() or None
    if note and len(note) > 600:
        return None, "note must be at most 600 characters"
    priority = "high" if category == "Fishing gear" else "medium" if category in {"Plastic packaging", "Glass", "Metal"} else "low"
    return {"area_id": area_id, "category": category, "quantity": quantity, "observed_at": observed_at.isoformat(), "detection": "reporter_selected", "priority": priority, "image_url": image_url, "note": note}, None


def litter_report_dict(row: Any) -> dict[str, Any]:
    return {"id": row.id, "area_id": row.area_id, "category": row.category, "quantity": row.quantity, "observed_at": row.observed_at, "detection": row.detection, "priority": row.priority, "image_url": row.image_url, "note": row.note, "created_at": row.created_at.isoformat(), "location_precision": "area", "demo": True}


def litter_assessments(engine: Engine, report_id: int) -> tuple[dict[str, Any], dict[str, Any]]:
    with engine.connect() as connection:
        detection = connection.execute(select(litter_detections_table).where(litter_detections_table.c.report_id == report_id)).first()
        priority = connection.execute(select(litter_priorities_table).where(litter_priorities_table.c.report_id == report_id)).first()
    return (
        {"method": detection.method, "status": detection.status, "category": detection.category, "needs_user_confirmation": False, "illustrative": True},
        {"level": priority.level, "severity_score": priority.severity_score, "reason": priority.reason, "illustrative": True, "disclaimer": "Illustrative demonstration priority only; it is not an enforcement decision."},
    )


def mission_dict(engine: Engine, row: Any) -> dict[str, Any]:
    with engine.connect() as connection:
        joined_count = connection.execute(select(func.count()).select_from(cleanup_joins_table).where(cleanup_joins_table.c.mission_id == row.id)).scalar_one()
    return {"id": row.id, "title": row.title, "area_id": row.area_id, "region": row.region, "scheduled_for": row.scheduled_for, "joined_count": joined_count, "demo": True}


def parse_cleanup_evidence_payload(payload: Any, mission_ids: set[str], report_ids: set[int]) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(payload, dict):
        return None, "A JSON object is required"
    if contains_personal_identifier(payload):
        return None, "Personal identifier fields are not accepted"
    if contains_precise_location(payload):
        return None, "Exact coordinate fields are not accepted"
    mission_id = str(payload.get("mission_id") or "").strip()
    before_report_id = payload.get("before_report_id")
    after_report_id = payload.get("after_report_id")
    try:
        before_report_id = int(before_report_id) if before_report_id is not None else None
        after_report_id = int(after_report_id) if after_report_id is not None else None
    except (TypeError, ValueError):
        return None, "before_report_id and after_report_id must be report IDs"
    try:
        item_count = int(payload.get("item_count", 0))
    except (TypeError, ValueError):
        return None, "item_count must be a positive whole number"
    if (mission_id and mission_id not in mission_ids) or item_count < 0 or item_count > 10000:
        return None, "item_count must be between 0 and 10000 and mission_id must be known when supplied"
    if before_report_id is not None and before_report_id not in report_ids:
        return None, "before_report_id must reference a known report"
    if after_report_id is not None and after_report_id not in report_ids:
        return None, "after_report_id must reference a known report"
    if not mission_id and before_report_id is None and after_report_id is None:
        return None, "mission_id or a before_report_id/after_report_id is required"
    image_url = str(payload.get("image_url") or "").strip() or None
    before_image_url = str(payload.get("before_image_url") or "").strip() or None
    after_image_url = str(payload.get("after_image_url") or "").strip() or None
    for field, value in (("image_url", image_url), ("before_image_url", before_image_url), ("after_image_url", after_image_url)):
        if value and not (value.startswith("/assets/") or value.startswith("https://")):
            return None, f"{field} must use HTTPS or a local /assets/ path"
    note = str(payload.get("note") or "").strip() or None
    if note and len(note) > 600:
        return None, "note must be at most 600 characters"
    impact_note = str(payload.get("impact_note") or "").strip() or None
    if impact_note and len(impact_note) > 600:
        return None, "impact_note must be at most 600 characters"
    return {"mission_id": mission_id or None, "before_report_id": before_report_id, "after_report_id": after_report_id, "item_count": item_count, "image_url": image_url, "before_image_url": before_image_url, "after_image_url": after_image_url, "impact_note": impact_note, "note": note}, None


def frontend_beaches() -> list[dict[str, Any]]:
    return load_data_file("beaches.json")


def frontend_score(rows: list[Any]) -> tuple[str | None, int | None]:
    if len(rows) < 3:
        return None, None
    mean = sum(max(CATEGORY_WEIGHTS[c] * QUANTITY_WEIGHTS[q] for c, q in json.loads(row.quantities).items()) for row in rows) / len(rows)
    if mean < 1.5:
        return "Low", 1
    if mean < 2.5:
        return "Moderate", 2
    if mean < 3.5:
        return "High", 3
    return "Severe", 4


def frontend_report_dict(row: Any, include_photo: bool = True) -> dict[str, Any]:
    result = {
        "id": row.id, "beachId": row.beach_id, "beachName": row.beach_name,
        "quantities": json.loads(row.quantities), "category": row.category,
        "quantity": row.quantity, "createdAt": row.created_at.isoformat(), "status": row.status,
    }
    if row.status in REPORT_STATUS_NOTES:
        result["statusNote"] = REPORT_STATUS_NOTES[row.status]
    if include_photo and row.photo_key:
        result["photoUrl"] = request.host_url.rstrip("/") + "/uploads/photos/" + row.photo_key
    return result


def create_app(database_url: str | None = None, testing: bool = False) -> Flask:
    """Build an app with PostgreSQL when configured, otherwise SQLite."""
    jwt_secret = auth_jwt_secret(testing)
    application = Flask(__name__)
    application.config["TESTING"] = testing
    origins = os.getenv("FRONTEND_ORIGINS", "*").split(",")
    CORS(application, resources={r"/*": {"origins": origins}})

    engine = create_engine_for_url(normalise_database_url(database_url or os.getenv("DATABASE_URL")))
    initialise_database(engine)
    application.extensions["marine_engine"] = engine

    def require_auth(view):
        @wraps(view)
        def wrapper(*args: Any, **kwargs: Any):
            header = request.headers.get("Authorization", "")
            token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
            user_id = decode_token_subject(token, jwt_secret) if token else None
            if user_id is None:
                return error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
            with engine.connect() as connection:
                row = connection.execute(select(users_table).where(users_table.c.id == user_id)).first()
            if row is None:
                return error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
            request.current_user = row
            return view(*args, **kwargs)

        return wrapper

    @application.get("/")
    def root():
        return jsonify(
            {
                "project": "Radar Sampah - Marine litter reporting",
                "status": "ready",
                "data_boundary": "synthetic/public demonstration data only",
            }
        )

    @application.get("/health")
    def health():
        return jsonify({"status": "ok", "database": "configured"})

    @application.post("/auth/anonymous")
    def create_anonymous_participant():
        with engine.begin() as connection:
            try:
                participant_id = generate_participant_id(connection)
            except RuntimeError as error:
                return error_response(500, "INTERNAL_ERROR", str(error))
            user_id = generate_user_id()
            connection.execute(
                insert(users_table).values(
                    id=user_id,
                    participant_id=participant_id,
                    role=DEFAULT_VOLUNTEER_ROLE,
                    created_at=datetime.now(timezone.utc),
                )
            )
        token = issue_token(user_id, jwt_secret)
        return jsonify(
            {"token": token, "user": {"id": user_id, "participantId": participant_id, "role": DEFAULT_VOLUNTEER_ROLE}}
        ), 201

    @application.post("/auth/restore")
    def restore_anonymous_participant():
        payload = request.get_json(silent=True)
        participant_id = str(payload.get("participantId") or "").strip() if isinstance(payload, dict) else ""
        if not re.fullmatch(r"\d{4}", participant_id):
            return error_response(404, "UNKNOWN_PARTICIPANT", "That participant ID was not found.")
        with engine.connect() as connection:
            row = connection.execute(select(users_table).where(users_table.c.participant_id == participant_id)).first()
        if row is None:
            return error_response(404, "UNKNOWN_PARTICIPANT", "That participant ID was not found.")
        token = issue_token(row.id, jwt_secret)
        return jsonify({"token": token, "user": user_dict(row)})

    # Logout is stateless: the client removes its token. This endpoint does not revoke it.
    @application.post("/auth/logout")
    @require_auth
    def logout_anonymous_participant():
        return "", 204

    @application.get("/auth/me")
    @require_auth
    def get_current_participant():
        return jsonify(user_dict(request.current_user))

    @application.get("/beaches")
    def get_frontend_beaches():
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=90)
        result = []
        with engine.connect() as connection:
            rows = connection.execute(select(frontend_reports_table).where(frontend_reports_table.c.status == "Counted")).all()
        for beach in frontend_beaches():
            counted = [r for r in rows if r.beach_id == beach["id"] and r.created_at >= cutoff]
            severity, band = frontend_score(counted)
            newest = max(counted, key=lambda r: r.created_at) if counted else None
            age = (now - newest.created_at).days if newest else 999
            result.append({**beach, "severity": severity, "band": band, "insufficientData": severity is None,
                           "validReports": len(counted), "lastReportedAt": newest.created_at.isoformat() if newest else None,
                           "freshnessKind": "ok" if age < 30 else "aging" if age <= 90 else "stale"})
        return jsonify(result)

    @application.get("/beaches/<beach_id>")
    def get_frontend_beach(beach_id: str):
        beach = next((item for item in frontend_beaches() if item["id"] == beach_id), None)
        if beach is None:
            return error_response(404, "NOT_FOUND", "Beach not found.")
        summary = get_frontend_beaches().get_json()
        item = next(item for item in summary if item["id"] == beach_id)
        with engine.connect() as connection:
            row = connection.execute(select(frontend_reports_table).where(frontend_reports_table.c.beach_id == beach_id, frontend_reports_table.c.status == "Counted").order_by(frontend_reports_table.c.created_at.desc())).first()
        detail = {**item, "species": beach.get("species", []), "ecologicalNote": beach.get("ecologicalNote", "")}
        if row is None:
            detail.update({"composition": None, "compositionSource": None})
        else:
            values = json.loads(row.quantities)
            detail.update({"composition": [{"category": c, "quantity": q} for c, q in sorted(values.items(), key=lambda pair: -CATEGORY_WEIGHTS[pair[0]])],
                           "compositionSource": {"reportId": row.id, "createdAt": row.created_at.isoformat()}})
        return jsonify(detail)

    @application.get("/scoring-method")
    def get_scoring_method():
        return jsonify({"categoryWeights": [{"category": c, "weight": w} for c, w in CATEGORY_WEIGHTS.items()], "quantityWeights": [{"quantity": q, "weight": w} for q, w in QUANTITY_WEIGHTS.items()], "bands": [{"band": "Low", "range": "below 1.5", "color": "#7CA98B"}, {"band": "Moderate", "range": "1.5 – 2.4", "color": "#D9A24B"}, {"band": "High", "range": "2.5 – 3.4", "color": "#CE6B45"}, {"band": "Severe", "range": "3.5 and above", "color": "#B84A3F"}], "windowDays": 90, "minReports": 3})

    @application.post("/geo/resolve-beach")
    def resolve_frontend_beach():
        payload = request.get_json(silent=True) or {}
        try:
            lat, lng = float(payload["lat"]), float(payload["lng"])
        except (KeyError, TypeError, ValueError):
            return error_response(400, "VALIDATION_FAILED", "lat and lng are required.")
        nearest, distance = None, float("inf")
        for beach in frontend_beaches():
            phi1, phi2 = math.radians(lat), math.radians(beach["lat"])
            dphi, dlambda = math.radians(beach["lat"] - lat), math.radians(beach["lng"] - lng)
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            current = 6371 * 2 * math.asin(math.sqrt(a))
            if current < distance:
                nearest, distance = beach, current
        if distance > 25:
            return jsonify(None)
        return jsonify(next(item for item in get_frontend_beaches().get_json() if item["id"] == nearest["id"]))

    @application.post("/uploads/photos")
    @require_auth
    def upload_frontend_photo():
        photo = request.files.get("photo")
        if photo is None or not photo.filename:
            return error_response(400, "PHOTO_REQUIRED", "A photo is required.")
        if photo.mimetype not in {"image/jpeg", "image/png", "image/heic"}:
            return error_response(400, "VALIDATION_FAILED", "Only JPEG, PNG, or HEIC photos are accepted.")
        raw = photo.read()
        if len(raw) > 10 * 1024 * 1024:
            return error_response(413, "PHOTO_TOO_LARGE", "Photo must be 10 MB or smaller.")
        directory = Path(tempfile.gettempdir()) / "radar-sampah-photos"
        directory.mkdir(parents=True, exist_ok=True)
        key = f"{request.current_user.id}_{secrets.token_hex(12)}{Path(photo.filename).suffix.lower() or '.jpg'}"
        path = directory / key
        path.write_bytes(raw)
        preview = request.host_url.rstrip("/") + "/uploads/photos/" + key
        return jsonify({"photoKey": key, "previewUrl": preview, "metadataStripped": True}), 201

    @application.get("/uploads/photos/<path:photo_key>")
    @require_auth
    def serve_frontend_photo(photo_key: str):
        directory = Path(tempfile.gettempdir()) / "radar-sampah-photos"
        path = (directory / photo_key).resolve()
        if directory.resolve() not in path.parents or not path.is_file():
            return error_response(404, "NOT_FOUND", "Photo not found.")
        return send_file(path)

    @application.get("/uploads/photos")
    @require_auth
    def get_frontend_photo():
        key = request.args.get("photoKey", "")
        path = (Path(tempfile.gettempdir()) / "radar-sampah-photos" / key).resolve()
        if not key or not path.is_file():
            return error_response(404, "NOT_FOUND", "Photo not found.")
        return jsonify({"previewUrl": request.host_url.rstrip("/") + "/uploads/photos/" + key})

    def validate_frontend_report(payload: Any):
        if not isinstance(payload, dict) or contains_personal_identifier(payload):
            return None, "VALIDATION_FAILED"
        beach_id = str(payload.get("beachId") or "")
        beach = next((b for b in frontend_beaches() if b["id"] == beach_id), None)
        quantities = payload.get("quantities")
        if beach is None or not isinstance(quantities, dict) or not quantities or any(c not in FRONTEND_CATEGORIES or q not in QUANTITY_WEIGHTS for c, q in quantities.items()):
            return None, "VALIDATION_FAILED"
        photo_key = str(payload.get("photoKey") or "").strip()
        if not photo_key:
            return None, "PHOTO_REQUIRED"
        top = max(quantities, key=lambda c: CATEGORY_WEIGHTS[c])
        coords = payload.get("coords") if payload.get("locationSource") == "gps" else None
        lat = lng = None
        if coords is not None:
            try:
                lat, lng = round(float(coords["lat"]), 3), round(float(coords["lng"]), 3)
            except (KeyError, TypeError, ValueError):
                return None, "VALIDATION_FAILED"
        return {"beach": beach, "quantities": quantities, "category": top, "quantity": quantities[top], "photo_key": photo_key, "location_source": payload.get("locationSource", "manual")}, None

    @application.post("/reports")
    @require_auth
    def create_frontend_report():
        data, error = validate_frontend_report(request.get_json(silent=True))
        if error:
            return error_response(400, error, "A photo is required." if error == "PHOTO_REQUIRED" else "Report data is invalid.")
        now = datetime.now(timezone.utc)
        local_day = now.astimezone(KUALA_LUMPUR).date()
        with engine.begin() as connection:
            report_id = "r_" + secrets.token_hex(10)
            connection.execute(insert(frontend_reports_table).values(id=report_id, reporter_id=request.current_user.id, beach_id=data["beach"]["id"], beach_name=data["beach"]["name"], quantities=json.dumps(data["quantities"]), category=data["category"], quantity=data["quantity"], photo_key=data["photo_key"], location_source=data["location_source"], status="Counted", created_at=now))
            row = connection.execute(select(frontend_reports_table).where(frontend_reports_table.c.id == report_id)).first()
        return jsonify(frontend_report_dict(row)), 201

    @application.get("/reports/mine")
    @require_auth
    def get_frontend_reports():
        with engine.connect() as connection:
            query = select(frontend_reports_table).where(frontend_reports_table.c.reporter_id == request.current_user.id).order_by(frontend_reports_table.c.created_at.desc())
            status = request.args.get("status")
            if status in {"Counted", "Duplicate", "Incomplete"}:
                query = query.where(frontend_reports_table.c.status == status)
            rows = connection.execute(query).all()
        return jsonify([frontend_report_dict(row) for row in rows])

    @application.get("/reports/mine/counts")
    @require_auth
    def get_frontend_report_counts():
        with engine.connect() as connection:
            rows = connection.execute(select(frontend_reports_table.c.status).where(frontend_reports_table.c.reporter_id == request.current_user.id)).scalars().all()
        return jsonify({"counted": rows.count("Counted"), "duplicate": rows.count("Duplicate"), "incomplete": rows.count("Incomplete")})

    @application.patch("/reports/<report_id>")
    @require_auth
    def update_frontend_report(report_id: str):
        with engine.connect() as connection:
            old = connection.execute(select(frontend_reports_table).where(frontend_reports_table.c.id == report_id, frontend_reports_table.c.reporter_id == request.current_user.id)).first()
        if old is None:
            return error_response(404, "NOT_FOUND", "Report not found.")
        payload = request.get_json(silent=True) or {}
        merged = {"beachId": payload.get("beachId", old.beach_id), "quantities": payload.get("quantities", json.loads(old.quantities)), "photoKey": payload.get("photoKey", old.photo_key), "locationSource": payload.get("locationSource", old.location_source), "coords": payload.get("coords")}
        data, error = validate_frontend_report(merged)
        if error:
            return error_response(400, error, "Report data is invalid.")
        with engine.begin() as connection:
            connection.execute(frontend_reports_table.update().where(frontend_reports_table.c.id == report_id).values(beach_id=data["beach"]["id"], beach_name=data["beach"]["name"], quantities=json.dumps(data["quantities"]), category=data["category"], quantity=data["quantity"], photo_key=data["photo_key"], location_source=data["location_source"], status="Counted"))
            row = connection.execute(select(frontend_reports_table).where(frontend_reports_table.c.id == report_id)).first()
        return jsonify(frontend_report_dict(row))

    @application.get("/api/context")
    def get_context():
        return jsonify(context_payload(engine))

    @application.get("/api/options")
    def get_options():
        return jsonify(load_option_catalog())

    @application.get("/api/observations")
    def get_observations():
        with engine.connect() as connection:
            ids = connection.execute(select(observations_table.c.id).order_by(observations_table.c.id)).scalars().all()
        records = []
        for observation_id in ids:
            result = result_for_observation(engine, observation_id)
            record = result["observation"]
            record["classification"] = result["classification"]
            record["priority"] = result["priority"]
            records.append(record)
        return jsonify({"observations": records, "source": SOURCE_LABEL, "data_version": DATA_VERSION, "demo": True})

    @application.post("/api/observations")
    def create_observation():
        data, error = parse_payload(request.get_json(silent=True))
        if error:
            return jsonify({"error": error}), 400
        assert data is not None

        with engine.begin() as connection:
            existing_area_count = connection.execute(
                select(func.count()).select_from(observations_table).where(observations_table.c.area == data["area"])
            ).scalar_one()
            inserted = connection.execute(
                insert(observations_table).values(
                    **data,
                    source=SOURCE_LABEL,
                    demo=True,
                    created_at=datetime.now(timezone.utc),
                )
            )
            observation_id = inserted.inserted_primary_key[0]
            classification = classification_for(data["category"])
            priority = priority_for(data["category"], existing_area_count)
            connection.execute(insert(classifications_table).values(observation_id=observation_id, **classification))
            connection.execute(insert(priorities_table).values(observation_id=observation_id, **priority))

        return jsonify(result_for_observation(engine, observation_id)), 201

    @application.get("/api/litter-options")
    def get_litter_options():
        catalog = tidetrace_catalogue()
        return jsonify({"categories": catalog["categories"], "areas": catalog["areas"], "demo": True, "data_version": catalog["version"]})

    @application.post("/api/litter-recognize")
    def recognize_litter():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "A JSON object is required"}), 400
        if contains_personal_identifier(payload) or contains_precise_location(payload):
            return jsonify({"error": "Personal identifier and exact coordinate fields are not accepted"}), 400
        image_url = str(payload.get("image_url") or "").strip()
        if not image_url or not (image_url.startswith("/assets/") or image_url.startswith("https://")):
            return jsonify({"error": "image_url must use HTTPS or a local /assets/ path"}), 400
        catalog = tidetrace_catalogue()
        categories = {item["value"] for item in catalog["categories"]}
        result = {**recognise_litter(image_url, str(payload.get("category_hint") or "").strip() or None, categories), "image_url": image_url, "demo": True}
        # Keep both names while the team moves from the older recognition wording.
        return jsonify({"detection": result, "recognition": result, "data_version": catalog["version"]})

    @application.get("/api/litter-reports")
    def get_litter_reports():
        with engine.connect() as connection:
            rows = connection.execute(select(litter_reports_table).order_by(litter_reports_table.c.id)).all()
        return jsonify({"reports": [litter_report_dict(row) for row in rows], "demo": True, "data_version": tidetrace_catalogue()["version"]})

    @application.post("/api/litter-reports")
    def create_litter_report():
        catalog = tidetrace_catalogue()
        data, error = parse_litter_report_payload(request.get_json(silent=True), {item["id"] for item in catalog["areas"]})
        if error:
            return jsonify({"error": error}), 400
        assert data is not None
        with engine.begin() as connection:
            inserted = connection.execute(insert(litter_reports_table).values(**data, created_at=datetime.now(timezone.utc)))
            report_id = inserted.inserted_primary_key[0]
            severity_score = 90 if data["priority"] == "high" else 55 if data["priority"] == "medium" else 25
            connection.execute(insert(litter_detections_table).values(report_id=report_id, method=data["detection"], status="reporter_suggestion", category=data["category"], created_at=datetime.now(timezone.utc)))
            connection.execute(insert(litter_priorities_table).values(report_id=report_id, level=data["priority"], severity_score=severity_score, reason="Illustrative priority derived from the selected litter category.", created_at=datetime.now(timezone.utc)))
            row = connection.execute(select(litter_reports_table).where(litter_reports_table.c.id == report_id)).first()
        detection, priority = litter_assessments(engine, report_id)
        return jsonify({"report": litter_report_dict(row), "detection": detection, "priority": priority, "demo": True, "data_version": catalog["version"]}), 201

    @application.get("/api/litter-heatmap")
    def get_litter_heatmap():
        catalog = tidetrace_catalogue()
        with engine.connect() as connection:
            rows = connection.execute(select(litter_reports_table.c.area_id, litter_reports_table.c.category)).all()
        areas = []
        for area in catalog["areas"]:
            area_reports = [row for row in rows if row.area_id == area["id"]]
            category_counts = {category: sum(row.category == category for row in area_reports) for category in ALLOWED_CATEGORIES.values()}
            high_risk_count = category_counts["Fishing gear"]
            severity_score = min(100, sum(30 if row.category == "Fishing gear" else 20 if row.category in {"Plastic packaging", "Glass", "Metal"} else 10 for row in area_reports))
            priority = "high" if high_risk_count or severity_score >= 60 else "medium" if severity_score else "low"
            areas.append({**area, "report_count": len(area_reports), "category_counts": category_counts, "severity_score": severity_score, "priority": priority, "approximate": True, "no_exact_location": True})
        return jsonify({"areas": areas, "demo": True, "data_version": catalog["version"]})

    @application.get("/api/cleanup-missions")
    def get_cleanup_missions():
        with engine.connect() as connection:
            rows = connection.execute(select(cleanup_missions_table).order_by(cleanup_missions_table.c.scheduled_for)).all()
        return jsonify({"missions": [mission_dict(engine, row) for row in rows], "demo": True, "data_version": tidetrace_catalogue()["version"]})

    @application.post("/api/cleanup-missions/<mission_id>/join")
    def join_cleanup_mission(mission_id: str):
        payload = request.get_json(silent=True)
        if payload not in ({}, None) or (isinstance(payload, dict) and (contains_personal_identifier(payload) or PRECISE_LOCATION_FIELDS.intersection(payload))):
            return jsonify({"error": "Anonymous join requests do not accept personal or location data"}), 400
        with engine.begin() as connection:
            row = connection.execute(select(cleanup_missions_table).where(cleanup_missions_table.c.id == mission_id)).first()
            if row is None:
                return jsonify({"error": "Unknown cleanup mission"}), 404
            connection.execute(insert(cleanup_joins_table).values(mission_id=mission_id, created_at=datetime.now(timezone.utc)))
        return jsonify({"mission": mission_dict(engine, row), "demo": True, "data_version": tidetrace_catalogue()["version"]}), 201

    @application.post("/api/cleanup-evidence")
    def create_cleanup_evidence():
        with engine.connect() as connection:
            mission_ids = set(connection.execute(select(cleanup_missions_table.c.id)).scalars().all())
            report_ids = set(connection.execute(select(litter_reports_table.c.id)).scalars().all())
        data, error = parse_cleanup_evidence_payload(request.get_json(silent=True), mission_ids, report_ids)
        if error:
            return jsonify({"error": error}), 400
        assert data is not None
        with engine.begin() as connection:
            inserted = connection.execute(insert(cleanup_evidence_table).values(**data, created_at=datetime.now(timezone.utc)))
            row = connection.execute(select(cleanup_evidence_table).where(cleanup_evidence_table.c.id == inserted.inserted_primary_key[0])).first()
        impact = "stable"
        if row.before_report_id is not None and row.after_report_id is not None:
            with engine.connect() as connection:
                before_quantity = connection.execute(select(litter_reports_table.c.quantity).where(litter_reports_table.c.id == row.before_report_id)).scalar_one()
                after_quantity = connection.execute(select(litter_reports_table.c.quantity).where(litter_reports_table.c.id == row.after_report_id)).scalar_one()
            impact = "improved" if after_quantity < before_quantity else "higher" if after_quantity > before_quantity else "stable"
        evidence = {"id": row.id, "mission_id": row.mission_id, "before_report_id": row.before_report_id, "after_report_id": row.after_report_id, "item_count": row.item_count, "image_url": row.image_url, "before_image_url": row.before_image_url, "after_image_url": row.after_image_url, "impact_note": row.impact_note, "impact": impact, "note": row.note, "created_at": row.created_at.isoformat(), "demo": True}
        impact_payload = {"level": impact, "illustrative": True, "disclaimer": "Illustrative before/after comparison only; not an enforcement finding."}
        return jsonify({"evidence": evidence, "impact": impact_payload, "demo": True, "data_version": tidetrace_catalogue()["version"]}), 201

    @application.get("/api/community-progress")
    def get_community_progress():
        with engine.connect() as connection:
            report_count = connection.execute(select(func.count()).select_from(litter_reports_table)).scalar_one()
            join_count = connection.execute(select(func.count()).select_from(cleanup_joins_table)).scalar_one()
            item_count = connection.execute(select(func.coalesce(func.sum(cleanup_evidence_table.c.item_count), 0))).scalar_one()
            mission_count = connection.execute(select(func.count()).select_from(cleanup_missions_table)).scalar_one()
        return jsonify({"progress": {"report_count": report_count, "mission_join_count": join_count, "verified_item_count": item_count, "mission_count": mission_count, "privacy_note": "Anonymous, region-level demonstration counters only."}, "demo": True, "data_version": tidetrace_catalogue()["version"]})

    return application


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
