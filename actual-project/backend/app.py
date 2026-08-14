"""Flask API for the Team 04 Marine Observation MVP.

The service stores synthetic/public litter observations, exposes a small
source-visible OBIS context layer, and calculates transparent illustrative
priority labels. It does not call external AI or store personal information.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request
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


metadata = MetaData()
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


def create_engine_for_url(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, future=True, connect_args=connect_args)


def initialise_database(engine: Engine) -> None:
    metadata.create_all(engine)
    samples = load_context_samples()
    sample_ids = {sample["id"] for sample in samples}
    with engine.begin() as connection:
        existing_ids = set(connection.execute(select(context_table.c.id)).scalars().all())
        # 仅同步静态 context 表，清理旧占位记录；观察记录和派生结果不受影响。
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


def parse_payload(payload: Any) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(payload, dict):
        return None, "A JSON object is required"
    if PERSONAL_IDENTIFIER_FIELDS.intersection(payload):
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


def create_app(database_url: str | None = None, testing: bool = False) -> Flask:
    """Build an app with PostgreSQL when configured, otherwise SQLite."""
    application = Flask(__name__)
    application.config["TESTING"] = testing
    origins = os.getenv("FRONTEND_ORIGINS", "*").split(",")
    CORS(application, resources={r"/api/*": {"origins": origins}})

    engine = create_engine_for_url(normalise_database_url(database_url or os.getenv("DATABASE_URL")))
    initialise_database(engine)
    application.extensions["marine_engine"] = engine

    @application.get("/")
    def root():
        return jsonify(
            {
                "project": "Team 04 Marine Observation MVP",
                "status": "ready",
                "data_boundary": "synthetic/public demonstration data only",
            }
        )

    @application.get("/health")
    def health():
        return jsonify({"status": "ok", "database": "configured"})

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

    return application


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
