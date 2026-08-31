"""Radar Sampah Iteration 1 API.

The routes and response shapes in this module follow frontend/API.md and
frontend/API.en.md. Report coordinates and photo storage keys are private
server-side data and are deliberately excluded from response serializers.
"""

from __future__ import annotations

import json
import math
import os
import re
import secrets
import tempfile
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from io import BytesIO
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode

import jwt
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from PIL import Image, ImageOps, UnidentifiedImageError
from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    insert,
    inspect,
    select,
    text,
)
from sqlalchemy.engine import Engine
from werkzeug.exceptions import HTTPException
from werkzeug.exceptions import RequestEntityTooLarge

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover - dependency is installed in deployed builds
    register_heif_opener = None


# Local development settings are intentionally loaded from the ignored .env.
load_dotenv(Path(__file__).with_name(".env"))


LOCAL_DATABASE_URL = "sqlite:///radar_sampah.db"
KUALA_LUMPUR = timezone(timedelta(hours=8))
AUTH_JWT_ALGORITHM = "HS256"
AUTH_TOKEN_TTL_DAYS = 30
PHOTO_URL_TTL_MINUTES = 15
PHOTO_MAX_BYTES = 10 * 1024 * 1024
PHOTO_MAX_EDGE = 2048
PHOTO_ORPHAN_TTL = timedelta(hours=24)
PARTICIPANT_ID_MIN = 1000
PARTICIPANT_ID_MAX = 9999
DEFAULT_VOLUNTEER_ROLE = "volunteer"

FRONTEND_CATEGORIES = ("Fishing gear", "Plastic", "Glass", "Metal", "Other", "Paper")
CATEGORY_WEIGHTS = {
    "Fishing gear": 1.0,
    "Plastic": 0.85,
    "Glass": 0.70,
    "Metal": 0.60,
    "Other": 0.50,
    "Paper": 0.35,
}
QUANTITY_WEIGHTS = {"Small": 1, "Medium": 2, "Large": 3, "Very Large": 4}
REPORT_STATUSES = {"Counted", "Duplicate", "Incomplete"}
REPORT_STATUS_NOTES = {
    "Duplicate": "Matched an existing record for the same beach on the same day — excluded from the severity calculation.",
    "Incomplete": "Photo unreadable — excluded until you correct and save the record.",
}
SCORING_BANDS = (
    {"band": "Low", "range": "below 1.5", "color": "#7CA98B"},
    {"band": "Moderate", "range": "1.5 – 2.4", "color": "#D9A24B"},
    {"band": "High", "range": "2.5 – 3.4", "color": "#CE6B45"},
    {"band": "Severe", "range": "3.5 and above", "color": "#B84A3F"},
)
PHOTO_MIME_TYPES = {"image/jpeg", "image/png", "image/heic", "image/heif"}
REPORT_INPUT_FIELDS = {"beachId", "quantities", "photoKey", "locationSource", "coords"}
BEACH_SUMMARY_FIELDS = (
    "id",
    "name",
    "area",
    "lat",
    "lng",
    "habitat",
    "habitatTag",
    "sensitivity",
    "primarySpeciesGlyph",
    "speciesNames",
    "coverImageUrl",
    "scene",
)


metadata = MetaData()
users_table = Table(
    "users",
    metadata,
    Column("id", String(80), primary_key=True),
    Column("participant_id", String(4), nullable=False, unique=True),
    Column("role", String(20), nullable=False, default=DEFAULT_VOLUNTEER_ROLE),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

# The database contract in schema.sql stores one nullable column per litter
# category.  Keep this mapping at the boundary so the API can continue to use
# the frontend's compact `{category: quantity}` shape.
QUANTITY_COLUMNS = {
    "Plastic": "qty_plastic",
    "Fishing gear": "qty_fishing_gear",
    "Glass": "qty_glass",
    "Metal": "qty_metal",
    "Paper": "qty_paper",
    "Other": "qty_other",
}

reports_table = Table(
    "reports",
    metadata,
    Column("id", String(40), primary_key=True),
    Column("reporter_id", ForeignKey("users.id"), nullable=False),
    Column("beach_id", String(80), nullable=False),
    Column("location_source", String(20), nullable=False),
    Column("photo_key", String(500), nullable=False),
    Column("photo_mime", String(64), nullable=False),
    Column("photo_stripped", Boolean, nullable=False, default=False),
    *(Column(column, String(20)) for column in QUANTITY_COLUMNS.values()),
    Column("category", String(40), nullable=False),
    Column("quantity", String(20), nullable=False),
    Column("lat", Float),
    Column("lng", Float),
    Column("status", String(20), nullable=False),
    Column("status_note", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("deleted_at", DateTime(timezone=True)),
)


def normalise_database_url(database_url: str | None) -> str:
    value = (database_url or LOCAL_DATABASE_URL).strip()
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def create_engine_for_url(database_url: str) -> Engine:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, future=True, connect_args=connect_args)
    if database_url.startswith("sqlite"):
        return engine
    # Neon poolers can reset session settings between transactions. Translate
    # unqualified SQLAlchemy tables into the configured schema at compile time
    # instead of relying on a connection-level `SET search_path`.
    return engine.execution_options(schema_translate_map={None: database_schema()})


def database_schema() -> str:
    schema = os.getenv("DATABASE_SCHEMA", "app").strip()
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", schema):
        raise RuntimeError("DATABASE_SCHEMA must be a valid PostgreSQL schema name")
    return schema


def initialise_database(engine: Engine) -> None:
    """Create the schema and preserve reports written under the former name."""
    migrate_legacy_reports_table(engine)
    metadata.create_all(engine)
    ensure_report_columns(engine)
    repair_existing_reports(engine)


def migrate_legacy_reports_table(engine: Engine) -> None:
    """Rename the pre-PR-13 table before SQLAlchemy creates ``reports``.

    The standalone PostgreSQL equivalent lives in migrations/001_*.sql.  This
    startup guard keeps local SQLite databases and Render deployments safe when
    the migration has not been run as a separate release step.
    """
    schema = database_schema() if engine.dialect.name != "sqlite" else None
    table_names = set(inspect(engine).get_table_names(schema=schema))
    if "frontend_reports" not in table_names or "reports" in table_names:
        return
    legacy_table = "frontend_reports" if schema is None else f'"{schema}".frontend_reports'
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {legacy_table} RENAME TO reports"))


def ensure_report_columns(engine: Engine) -> None:
    """Add contract fields that were absent from the former partial table."""
    schema = database_schema() if engine.dialect.name != "sqlite" else None
    if "reports" not in inspect(engine).get_table_names(schema=schema):
        return
    existing = {column["name"] for column in inspect(engine).get_columns("reports", schema=schema)}
    additions = {
        "photo_mime": "VARCHAR(64)",
        "photo_stripped": "BOOLEAN",
        **{column: "VARCHAR(20)" for column in QUANTITY_COLUMNS.values()},
        "lat": "DOUBLE PRECISION",
        "lng": "DOUBLE PRECISION",
        "status_note": "TEXT",
        "updated_at": "TIMESTAMP WITH TIME ZONE",
        "deleted_at": "TIMESTAMP WITH TIME ZONE",
    }
    report_table = "reports" if schema is None else f'"{schema}".reports'
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE {report_table} ADD COLUMN {name} {sql_type}"))


def repair_existing_reports(engine: Engine) -> None:
    """Backfill quantity columns and retain duplicate handling for legacy rows."""
    schema = database_schema() if engine.dialect.name != "sqlite" else None
    columns = {column["name"] for column in inspect(engine).get_columns("reports", schema=schema)}
    if "quantities" not in columns:
        return
    report_table = "reports" if schema is None else f'"{schema}".reports'
    with engine.begin() as connection:
        rows = connection.execute(text(
            f"SELECT id, reporter_id, beach_id, quantities, status, created_at FROM {report_table} "
            "ORDER BY created_at, id"
        )).mappings().all()
        first_counted_by_day: set[tuple[str, str, Any]] = set()
        for row in rows:
            try:
                quantities = json.loads(row["quantities"])
                category, quantity = derive_category_quantity(quantities)
            except (TypeError, ValueError, StopIteration):
                continue
            status = row["status"]
            if status != "Incomplete":
                created_at = row["created_at"]
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                local_day = utc_datetime(created_at).astimezone(KUALA_LUMPUR).date()
                duplicate_key = (row["reporter_id"], row["beach_id"], local_day)
                status = "Duplicate" if duplicate_key in first_counted_by_day else "Counted"
                first_counted_by_day.add(duplicate_key)
            values: dict[str, Any] = {"category": category, "quantity": quantity, "status": status}
            values.update(quantity_values(quantities))
            set_clause = ", ".join(f"{name} = :{name}" for name in values)
            connection.execute(
                text(f"UPDATE {report_table} SET {set_clause} WHERE id = :id"),
                {**values, "id": row["id"]},
            )


def load_beaches(engine: Engine | None = None) -> list[dict[str, Any]]:
    """Prefer the seeded database records, with JSON only as local-test fallback."""
    with (Path(__file__).parent / "data" / "beaches.json").open(encoding="utf-8") as data_file:
        fallback = json.load(data_file)
    schema = database_schema() if engine is not None and engine.dialect.name != "sqlite" else None
    if engine is None or "beaches" not in inspect(engine).get_table_names(schema=schema):
        return fallback
    beach_table = "beaches" if schema is None else f'"{schema}".beaches'
    with engine.connect() as connection:
        rows = connection.execute(
            text(f"""
                SELECT id, name, area, lat, lng, habitat, habitat_tag, sensitivity,
                       primary_species_glyph, cover_image_url, scene, ecological_note
                FROM {beach_table} ORDER BY id
            """)
        ).mappings().all()
    if not rows:
        return fallback
    fallback_by_id = {beach["id"]: beach for beach in fallback}
    beaches: list[dict[str, Any]] = []
    for row in rows:
        base = fallback_by_id.get(row["id"], {})
        beaches.append(
            {
                **base,
                "id": row["id"], "name": row["name"], "area": row["area"],
                "lat": row["lat"], "lng": row["lng"], "habitat": row["habitat"],
                "habitatTag": row["habitat_tag"], "sensitivity": row["sensitivity"],
                "primarySpeciesGlyph": row["primary_species_glyph"],
                "coverImageUrl": row["cover_image_url"], "scene": row["scene"],
                "ecologicalNote": row["ecological_note"],
            }
        )
    return beaches


def error_response(status: int, code: str, message: str):
    return jsonify({"code": code, "message": message}), status


def auth_jwt_secret(testing: bool) -> str:
    secret = os.getenv("AUTH_JWT_SECRET", "").strip()
    if secret:
        return secret
    if testing:
        return "test-only-secret-not-for-production"
    raise RuntimeError("AUTH_JWT_SECRET must be configured outside tests")


def generate_participant_id(connection: Any) -> str:
    taken = set(connection.execute(select(users_table.c.participant_id)).scalars().all())
    available = [str(value) for value in range(PARTICIPANT_ID_MIN, PARTICIPANT_ID_MAX + 1) if str(value) not in taken]
    if not available:
        raise RuntimeError("No participant IDs are available")
    return secrets.choice(available)


def issue_token(user_id: str, jwt_secret: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + timedelta(days=AUTH_TOKEN_TTL_DAYS)},
        jwt_secret,
        algorithm=AUTH_JWT_ALGORITHM,
    )


def decode_token_subject(token: str, jwt_secret: str) -> str | None:
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=[AUTH_JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None


def user_dict(row: Any) -> dict[str, Any]:
    return {"id": row.id, "participantId": row.participant_id, "role": row.role}


def utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def contract_timestamp(value: datetime) -> str:
    return utc_datetime(value).astimezone(KUALA_LUMPUR).isoformat()


def derive_category_quantity(quantities: dict[str, str]) -> tuple[str, str]:
    """Use the documented fallback: highest category weight, then its band."""

    category = next(category for category in FRONTEND_CATEGORIES if category in quantities)
    return category, quantities[category]


def quantities_from_row(row: Any) -> dict[str, str]:
    return {
        category: getattr(row, column)
        for category, column in QUANTITY_COLUMNS.items()
        if getattr(row, column) is not None
    }


def quantity_values(quantities: dict[str, str]) -> dict[str, str | None]:
    return {column: quantities.get(category) for category, column in QUANTITY_COLUMNS.items()}


def severity_for(rows: list[Any]) -> tuple[str | None, int | None]:
    if len(rows) < 3:
        return None, None
    scores: list[float] = []
    for row in rows:
        quantities = quantities_from_row(row)
        category, quantity = derive_category_quantity(quantities)
        scores.append(CATEGORY_WEIGHTS[category] * QUANTITY_WEIGHTS[quantity])
    mean_score = sum(scores) / len(scores)
    if mean_score < 1.5:
        return "Low", 1
    if mean_score < 2.5:
        return "Moderate", 2
    if mean_score < 3.5:
        return "High", 3
    return "Severe", 4


def beach_summary(engine: Engine, beach: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    current_time = now or datetime.now(timezone.utc)
    cutoff = current_time - timedelta(days=90)
    with engine.connect() as connection:
        all_counted = connection.execute(
            select(reports_table).where(
                reports_table.c.beach_id == beach["id"],
                reports_table.c.status == "Counted",
            )
        ).all()
    eligible = [row for row in all_counted if utc_datetime(row.created_at) >= cutoff]
    severity, band = severity_for(eligible)
    newest = max(all_counted, key=lambda row: utc_datetime(row.created_at), default=None)
    newest_at = utc_datetime(newest.created_at) if newest else None
    if newest_at is None:
        freshness = "stale"
    else:
        age = current_time - newest_at
        freshness = "ok" if age < timedelta(days=30) else "aging" if age <= timedelta(days=90) else "stale"
    summary = {field: beach[field] for field in BEACH_SUMMARY_FIELDS}
    summary.update(
        {
            "severity": severity,
            "band": band,
            "insufficientData": severity is None,
            "validReports": len(eligible),
            "lastReportedAt": contract_timestamp(newest.created_at) if newest else None,
            "freshnessKind": freshness,
        }
    )
    return summary


def photo_storage_path(configured: str | Path | None) -> Path:
    value = configured or os.getenv("PHOTO_STORAGE_DIR")
    path = Path(value) if value else Path(tempfile.gettempdir()) / "radar-sampah-private-photos"
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def photo_file_path(directory: Path, photo_key: str) -> Path | None:
    if not re.fullmatch(r"[0-9a-f]{32}\.jpg", photo_key):
        return None
    path = (directory / photo_key).resolve()
    return path if directory in path.parents else None


def photo_metadata_path(directory: Path, photo_key: str) -> Path | None:
    photo_path = photo_file_path(directory, photo_key)
    return photo_path.with_name(photo_path.name + ".meta.json") if photo_path else None


def read_photo_metadata(directory: Path, photo_key: str) -> dict[str, Any] | None:
    path = photo_metadata_path(directory, photo_key)
    if path is None or not path.is_file():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def write_photo_metadata(directory: Path, photo_key: str, value: dict[str, Any]) -> None:
    path = photo_metadata_path(directory, photo_key)
    assert path is not None
    path.write_text(json.dumps(value, separators=(",", ":")), encoding="utf-8")


def process_photo(raw: bytes) -> bytes:
    try:
        with Image.open(BytesIO(raw)) as source:
            image = ImageOps.exif_transpose(source)
            image.thumbnail((PHOTO_MAX_EDGE, PHOTO_MAX_EDGE), Image.Resampling.LANCZOS)
            if image.mode not in {"RGB", "L"}:
                background = Image.new("RGB", image.size, "white")
                if "A" in image.getbands():
                    background.paste(image, mask=image.getchannel("A"))
                else:
                    background.paste(image)
                image = background
            elif image.mode == "L":
                image = image.convert("RGB")
            output = BytesIO()
            image.save(output, format="JPEG", quality=90, optimize=True)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise ValueError("The photo could not be read. Please choose another image.") from error


def signed_photo_url(photo_key: str, owner_id: str, jwt_secret: str, directory: Path) -> str | None:
    metadata_value = read_photo_metadata(directory, photo_key)
    path = photo_file_path(directory, photo_key)
    if metadata_value is None or metadata_value.get("ownerId") != owner_id or path is None or not path.is_file():
        return None
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": owner_id,
            "photoKey": photo_key,
            "purpose": "photo-preview",
            "iat": now,
            "exp": now + timedelta(minutes=PHOTO_URL_TTL_MINUTES),
        },
        jwt_secret,
        algorithm=AUTH_JWT_ALGORITHM,
    )
    return request.host_url.rstrip("/") + "/uploads/photos/" + photo_key + "?" + urlencode({"token": token})


def delete_photo(directory: Path, photo_key: str) -> None:
    for path in (photo_file_path(directory, photo_key), photo_metadata_path(directory, photo_key)):
        if path is not None and path.is_file():
            path.unlink(missing_ok=True)


def delete_photo_if_unreferenced(engine: Engine, directory: Path, photo_key: str) -> None:
    with engine.connect() as connection:
        referenced = connection.execute(
            select(reports_table.c.id).where(reports_table.c.photo_key == photo_key)
        ).first()
    if referenced is None:
        delete_photo(directory, photo_key)


def sweep_orphan_photos(engine: Engine, directory: Path) -> None:
    cutoff = datetime.now(timezone.utc) - PHOTO_ORPHAN_TTL
    with engine.connect() as connection:
        referenced = set(connection.execute(select(reports_table.c.photo_key)).scalars().all())
    for metadata_path in directory.glob("*.jpg.meta.json"):
        photo_key = metadata_path.name.removesuffix(".meta.json")
        if photo_key in referenced:
            continue
        metadata_value = read_photo_metadata(directory, photo_key)
        try:
            created_at = datetime.fromisoformat(str((metadata_value or {}).get("createdAt", "")))
        except ValueError:
            created_at = datetime.fromtimestamp(metadata_path.stat().st_mtime, tz=timezone.utc)
        if utc_datetime(created_at) < cutoff:
            delete_photo(directory, photo_key)


def schedule_orphan_cleanup(engine: Engine, directory: Path, photo_key: str, created_at: datetime) -> threading.Timer:
    delay = max(0.0, (utc_datetime(created_at) + PHOTO_ORPHAN_TTL - datetime.now(timezone.utc)).total_seconds())
    timer = threading.Timer(delay, delete_photo_if_unreferenced, args=(engine, directory, photo_key))
    timer.daemon = True
    timer.start()
    return timer


def report_dict(row: Any, viewer_id: str, jwt_secret: str, directory: Path, beach_names: dict[str, str]) -> dict[str, Any]:
    # lat, lng and photo_key are intentionally never copied into this response.
    value: dict[str, Any] = {
        "id": row.id,
        "beachId": row.beach_id,
        "beachName": beach_names.get(row.beach_id, row.beach_id),
        "quantities": quantities_from_row(row),
        "category": row.category,
        "quantity": row.quantity,
        "createdAt": contract_timestamp(row.created_at),
        "status": row.status,
    }
    if row.status in REPORT_STATUS_NOTES:
        value["statusNote"] = REPORT_STATUS_NOTES[row.status]
    if viewer_id == row.reporter_id:
        photo_url = signed_photo_url(row.photo_key, row.reporter_id, jwt_secret, directory)
        if photo_url:
            value["photoUrl"] = photo_url
    return value


def report_problem(status: int, code: str, message: str) -> tuple[int, str, str]:
    return status, code, message


def validate_report_payload(
    payload: Any,
    beaches: list[dict[str, Any]],
    owner_id: str,
    directory: Path,
    require_uploaded_photo: bool,
) -> tuple[dict[str, Any] | None, tuple[int, str, str] | None]:
    if not isinstance(payload, dict):
        return None, report_problem(400, "VALIDATION_FAILED", "A JSON object is required.")
    if set(payload) - REPORT_INPUT_FIELDS:
        return None, report_problem(400, "VALIDATION_FAILED", "The report contains unsupported fields.")

    photo_key = str(payload.get("photoKey") or "").strip()
    if not photo_key:
        return None, report_problem(400, "PHOTO_REQUIRED", "A photo is required.")

    quantities = payload.get("quantities")
    if (
        not isinstance(quantities, dict)
        or not quantities
        or any(category not in CATEGORY_WEIGHTS or quantity not in QUANTITY_WEIGHTS for category, quantity in quantities.items())
    ):
        return None, report_problem(400, "VALIDATION_FAILED", "Choose at least one valid category and quantity band.")

    beach_id = str(payload.get("beachId") or "").strip()
    beach = next((item for item in beaches if item["id"] == beach_id), None)
    if beach is None:
        return None, report_problem(404, "NOT_FOUND", "Beach not found.")

    location_source = payload.get("locationSource")
    if location_source not in {"gps", "manual"}:
        return None, report_problem(400, "VALIDATION_FAILED", "locationSource must be gps or manual.")

    lat = lng = None
    coords = payload.get("coords")
    if location_source == "gps":
        if not isinstance(coords, dict) or set(coords) != {"lat", "lng"}:
            return None, report_problem(400, "VALIDATION_FAILED", "GPS reports require lat and lng.")
        try:
            raw_lat, raw_lng = float(coords["lat"]), float(coords["lng"])
        except (TypeError, ValueError):
            return None, report_problem(400, "VALIDATION_FAILED", "lat and lng must be numbers.")
        if not math.isfinite(raw_lat) or not math.isfinite(raw_lng) or not -90 <= raw_lat <= 90 or not -180 <= raw_lng <= 180:
            return None, report_problem(400, "VALIDATION_FAILED", "lat or lng is outside its valid range.")
        lat, lng = round(raw_lat, 3), round(raw_lng, 3)
    elif coords is not None:
        return None, report_problem(400, "VALIDATION_FAILED", "Manual reports must not include coordinates.")

    photo_metadata = read_photo_metadata(directory, photo_key)
    if require_uploaded_photo and (photo_metadata is None or photo_metadata.get("ownerId") != owner_id):
        return None, report_problem(404, "NOT_FOUND", "Photo not found.")

    category, quantity = derive_category_quantity(quantities)
    return {
        "beach": beach,
        "quantities": quantities,
        "category": category,
        "quantity": quantity,
        "photo_key": photo_key,
        "photo_mime": (photo_metadata or {}).get("mime"),
        "photo_stripped": (photo_metadata or {}).get("metadataStripped"),
        "location_source": location_source,
        "lat": lat,
        "lng": lng,
    }, None


def duplicate_status(
    connection: Any,
    reporter_id: str,
    beach_id: str,
    created_at: datetime,
    exclude_report_id: str | None = None,
) -> str:
    query = select(reports_table.c.id, reports_table.c.created_at).where(
        reports_table.c.reporter_id == reporter_id,
        reports_table.c.beach_id == beach_id,
        reports_table.c.status == "Counted",
    )
    rows = connection.execute(query).all()
    local_day = utc_datetime(created_at).astimezone(KUALA_LUMPUR).date()
    for row in rows:
        if row.id != exclude_report_id and utc_datetime(row.created_at).astimezone(KUALA_LUMPUR).date() == local_day:
            return "Duplicate"
    return "Counted"


def create_app(
    database_url: str | None = None,
    testing: bool = False,
    photo_storage_dir: str | Path | None = None,
) -> Flask:
    jwt_secret = auth_jwt_secret(testing)
    application = Flask(__name__)
    application.config.update(TESTING=testing, MAX_CONTENT_LENGTH=12 * 1024 * 1024)
    CORS(application, resources={r"/*": {"origins": os.getenv("FRONTEND_ORIGINS", "*").split(",")}})

    engine = create_engine_for_url(normalise_database_url(database_url or os.getenv("DATABASE_URL")))
    initialise_database(engine)
    directory = photo_storage_path(photo_storage_dir)
    beaches = load_beaches(engine)
    beach_names = {beach["id"]: beach["name"] for beach in beaches}
    application.extensions["marine_engine"] = engine
    application.extensions["photo_storage_dir"] = directory
    application.extensions["photo_cleanup_timers"] = []
    sweep_orphan_photos(engine, directory)
    for metadata_path in directory.glob("*.jpg.meta.json"):
        photo_key = metadata_path.name.removesuffix(".meta.json")
        metadata_value = read_photo_metadata(directory, photo_key)
        try:
            created_at = datetime.fromisoformat(str((metadata_value or {}).get("createdAt", "")))
        except ValueError:
            created_at = datetime.fromtimestamp(metadata_path.stat().st_mtime, tz=timezone.utc)
        application.extensions["photo_cleanup_timers"].append(
            schedule_orphan_cleanup(engine, directory, photo_key, created_at)
        )
    rate_events: defaultdict[tuple[str, str], deque[float]] = defaultdict(deque)

    def require_auth(view: Callable[..., Any]):
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

    def rate_limited(bucket: str, limit: int):
        def decorator(view: Callable[..., Any]):
            @wraps(view)
            def wrapper(*args: Any, **kwargs: Any):
                now = time.monotonic()
                events = rate_events[(bucket, request.current_user.id)]
                while events and events[0] <= now - 3600:
                    events.popleft()
                if len(events) >= limit:
                    return error_response(429, "RATE_LIMITED", "Too many requests. Please try again later.")
                events.append(now)
                return view(*args, **kwargs)

            return wrapper

        return decorator

    @application.errorhandler(RequestEntityTooLarge)
    def payload_too_large(_error: RequestEntityTooLarge):
        return error_response(413, "PAYLOAD_TOO_LARGE", "The upload payload is too large.")

    @application.errorhandler(404)
    def route_not_found(_error: Any):
        return error_response(404, "NOT_FOUND", "The requested resource was not found.")

    @application.errorhandler(Exception)
    def contract_error(error: Exception):
        if application.testing and not isinstance(error, HTTPException):
            raise error
        if isinstance(error, HTTPException):
            status = error.code or 500
            code = "VALIDATION_FAILED" if status < 500 else "INTERNAL_ERROR"
            return error_response(status, code, error.description or "The request could not be completed.")
        application.logger.exception("Unhandled API error", exc_info=error)
        return error_response(500, "INTERNAL_ERROR", "Something went wrong. Please try again later.")

    @application.get("/")
    def root():
        return jsonify({"project": "Radar Sampah", "status": "ready", "apiVersion": "1.0.0"})

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
            user_id = "u_" + secrets.token_hex(12)
            now = datetime.now(timezone.utc)
            connection.execute(
                insert(users_table).values(
                    id=user_id,
                    participant_id=participant_id,
                    role=DEFAULT_VOLUNTEER_ROLE,
                    created_at=now,
                )
            )
        return jsonify({"token": issue_token(user_id, jwt_secret), "user": {"id": user_id, "participantId": participant_id, "role": DEFAULT_VOLUNTEER_ROLE}}), 201

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
        return jsonify({"token": issue_token(row.id, jwt_secret), "user": user_dict(row)})

    @application.post("/auth/logout")
    @require_auth
    def logout_anonymous_participant():
        return "", 204

    @application.get("/auth/me")
    @require_auth
    def get_current_participant():
        return jsonify(user_dict(request.current_user))

    @application.get("/beaches")
    def get_beaches():
        now = datetime.now(timezone.utc)
        return jsonify([beach_summary(engine, beach, now) for beach in beaches])

    @application.get("/beaches/<beach_id>")
    def get_beach(beach_id: str):
        beach = next((item for item in beaches if item["id"] == beach_id), None)
        if beach is None:
            return error_response(404, "NOT_FOUND", "Beach not found.")
        detail = beach_summary(engine, beach)
        detail.update({"species": beach.get("species", []), "ecologicalNote": beach.get("ecologicalNote", "")})
        with engine.connect() as connection:
            row = connection.execute(
                select(reports_table)
                .where(
                    reports_table.c.beach_id == beach_id,
                    reports_table.c.status == "Counted",
                )
                .order_by(reports_table.c.created_at.desc())
            ).first()
        if row is None:
            detail.update({"composition": None, "compositionSource": None})
        else:
            quantities = quantities_from_row(row)
            detail.update(
                {
                    "composition": [
                        {"category": category, "quantity": quantities[category]}
                        for category in FRONTEND_CATEGORIES
                        if category in quantities
                    ],
                    "compositionSource": {"reportId": row.id, "createdAt": contract_timestamp(row.created_at)},
                }
            )
        return jsonify(detail)

    @application.get("/scoring-method")
    def get_scoring_method():
        return jsonify(
            {
                "categoryWeights": [{"category": category, "weight": CATEGORY_WEIGHTS[category]} for category in FRONTEND_CATEGORIES],
                "quantityWeights": [{"quantity": quantity, "weight": weight} for quantity, weight in QUANTITY_WEIGHTS.items()],
                "bands": list(SCORING_BANDS),
                "windowDays": 90,
                "minReports": 3,
            }
        )

    @application.post("/geo/resolve-beach")
    @require_auth
    def resolve_beach():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or set(payload) != {"lat", "lng"}:
            return error_response(400, "VALIDATION_FAILED", "lat and lng are required.")
        try:
            lat, lng = float(payload["lat"]), float(payload["lng"])
        except (TypeError, ValueError):
            return error_response(400, "VALIDATION_FAILED", "lat and lng must be numbers.")
        if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            return error_response(400, "VALIDATION_FAILED", "lat or lng is outside its valid range.")
        nearest: dict[str, Any] | None = None
        nearest_distance = float("inf")
        for beach in beaches:
            phi1, phi2 = math.radians(lat), math.radians(beach["lat"])
            dphi = math.radians(beach["lat"] - lat)
            dlambda = math.radians(beach["lng"] - lng)
            haversine = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            distance = 6371 * 2 * math.asin(math.sqrt(haversine))
            if distance < nearest_distance:
                nearest, nearest_distance = beach, distance
        return jsonify(beach_summary(engine, nearest)) if nearest is not None and nearest_distance <= 25 else jsonify(None)

    @application.post("/uploads/photos")
    @require_auth
    @rate_limited("photo-upload", 60)
    def upload_photo():
        photo = request.files.get("photo")
        if photo is None or not photo.filename:
            return error_response(400, "PHOTO_REQUIRED", "A photo is required.")
        mime = (photo.mimetype or "").lower().split(";", 1)[0]
        if mime not in PHOTO_MIME_TYPES:
            return error_response(400, "PHOTO_UNSUPPORTED_TYPE", "Only JPEG, PNG, or HEIC photos are accepted.")
        raw = photo.read(PHOTO_MAX_BYTES + 1)
        if len(raw) > PHOTO_MAX_BYTES:
            return error_response(400, "PHOTO_TOO_LARGE", "Photo exceeds the 10 MB limit.")
        try:
            processed = process_photo(raw)
        except ValueError as error:
            return error_response(400, "VALIDATION_FAILED", str(error))
        sweep_orphan_photos(engine, directory)
        photo_key = secrets.token_hex(16) + ".jpg"
        path = photo_file_path(directory, photo_key)
        assert path is not None
        path.write_bytes(processed)
        write_photo_metadata(
            directory,
            photo_key,
            {
                "ownerId": request.current_user.id,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "mime": "image/jpeg",
                "metadataStripped": True,
            },
        )
        application.extensions["photo_cleanup_timers"].append(
            schedule_orphan_cleanup(engine, directory, photo_key, datetime.now(timezone.utc))
        )
        preview_url = signed_photo_url(photo_key, request.current_user.id, jwt_secret, directory)
        return jsonify({"photoKey": photo_key, "previewUrl": preview_url, "metadataStripped": True}), 201

    @application.get("/uploads/photos/<photo_key>")
    def view_signed_photo(photo_key: str):
        token = request.args.get("token", "")
        try:
            claims = jwt.decode(token, jwt_secret, algorithms=[AUTH_JWT_ALGORITHM])
        except jwt.PyJWTError:
            return error_response(401, "UNAUTHENTICATED", "This photo link is invalid or has expired.")
        if claims.get("purpose") != "photo-preview" or claims.get("photoKey") != photo_key:
            return error_response(401, "UNAUTHENTICATED", "This photo link is invalid or has expired.")
        metadata_value = read_photo_metadata(directory, photo_key)
        path = photo_file_path(directory, photo_key)
        if metadata_value is None or metadata_value.get("ownerId") != claims.get("sub") or path is None or not path.is_file():
            return error_response(404, "NOT_FOUND", "Photo not found.")
        return send_file(path, mimetype="image/jpeg", max_age=0, conditional=True)

    @application.post("/reports")
    @require_auth
    @rate_limited("report-create", 30)
    def create_report():
        data, problem = validate_report_payload(request.get_json(silent=True), beaches, request.current_user.id, directory, True)
        if problem:
            return error_response(*problem)
        assert data is not None
        now = datetime.now(timezone.utc)
        report_id = "r_" + secrets.token_hex(10)
        with engine.begin() as connection:
            status = duplicate_status(connection, request.current_user.id, data["beach"]["id"], now)
            connection.execute(
                insert(reports_table).values(
                    id=report_id,
                    reporter_id=request.current_user.id,
                    beach_id=data["beach"]["id"],
                    category=data["category"],
                    quantity=data["quantity"],
                    photo_key=data["photo_key"],
                    photo_mime=data["photo_mime"] or "image/jpeg",
                    photo_stripped=bool(data["photo_stripped"]),
                    location_source=data["location_source"],
                    lat=data["lat"],
                    lng=data["lng"],
                    status=status,
                    created_at=now,
                    updated_at=now,
                    **quantity_values(data["quantities"]),
                )
            )
            row = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
        return jsonify(report_dict(row, request.current_user.id, jwt_secret, directory, beach_names)), 201

    @application.get("/reports/mine")
    @require_auth
    def get_my_reports():
        status = request.args.get("status")
        if status is not None and status not in REPORT_STATUSES:
            return error_response(400, "VALIDATION_FAILED", "status is not valid.")
        query = (
            select(reports_table)
            .where(reports_table.c.reporter_id == request.current_user.id)
            .order_by(reports_table.c.created_at.desc())
        )
        if status:
            query = query.where(reports_table.c.status == status)
        with engine.connect() as connection:
            rows = connection.execute(query).all()
        return jsonify([report_dict(row, request.current_user.id, jwt_secret, directory, beach_names) for row in rows])

    @application.get("/reports/mine/counts")
    @require_auth
    def get_my_report_counts():
        with engine.connect() as connection:
            statuses = connection.execute(
                select(reports_table.c.status).where(reports_table.c.reporter_id == request.current_user.id)
            ).scalars().all()
        return jsonify(
            {
                "counted": statuses.count("Counted"),
                "duplicate": statuses.count("Duplicate"),
                "incomplete": statuses.count("Incomplete"),
            }
        )

    @application.patch("/reports/<report_id>")
    @require_auth
    def update_report(report_id: str):
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not payload or set(payload) - REPORT_INPUT_FIELDS:
            return error_response(400, "VALIDATION_FAILED", "Send at least one supported report field.")
        with engine.connect() as connection:
            old = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
        if old is None:
            return error_response(404, "NOT_FOUND", "Report not found.")
        if old.reporter_id != request.current_user.id:
            return error_response(403, "NOT_OWNER", "You can only correct your own report.")

        if "locationSource" in payload or "coords" in payload:
            location_source = payload.get("locationSource", old.location_source)
            coords = payload.get("coords")
        else:
            location_source = old.location_source
            coords = {"lat": old.lat, "lng": old.lng} if old.location_source == "gps" else None
        merged = {
            "beachId": payload.get("beachId", old.beach_id),
            "quantities": payload.get("quantities", quantities_from_row(old)),
            "photoKey": payload.get("photoKey", old.photo_key),
            "locationSource": location_source,
        }
        if coords is not None:
            merged["coords"] = coords
        require_uploaded_photo = "photoKey" in payload and payload["photoKey"] != old.photo_key
        data, problem = validate_report_payload(merged, beaches, request.current_user.id, directory, require_uploaded_photo)
        if problem:
            return error_response(*problem)
        assert data is not None
        created_at = utc_datetime(old.created_at)
        now = datetime.now(timezone.utc)
        with engine.begin() as connection:
            status = duplicate_status(
                connection,
                request.current_user.id,
                data["beach"]["id"],
                created_at,
                exclude_report_id=report_id,
            )
            connection.execute(
                reports_table.update()
                .where(reports_table.c.id == report_id)
                .values(
                    beach_id=data["beach"]["id"],
                    category=data["category"],
                    quantity=data["quantity"],
                    photo_key=data["photo_key"],
                    photo_mime=data["photo_mime"] or old.photo_mime,
                    photo_stripped=bool(data["photo_stripped"]) if data["photo_stripped"] is not None else old.photo_stripped,
                    location_source=data["location_source"],
                    lat=data["lat"],
                    lng=data["lng"],
                    status=status,
                    updated_at=now,
                    **quantity_values(data["quantities"]),
                )
            )
            row = connection.execute(select(reports_table).where(reports_table.c.id == report_id)).first()
        if old.photo_key != data["photo_key"]:
            delete_photo_if_unreferenced(engine, directory, old.photo_key)
        return jsonify(report_dict(row, request.current_user.id, jwt_secret, directory, beach_names))

    return application


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
