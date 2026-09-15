"""Reviewed Radar Sampah API entry point.

The Iteration 2 backend implementation lives in ``app_core.py``. This thin
entry point keeps that implementation intact while enforcing the reviewed
Iteration 2 contracts that must not regress during integration:

* account recovery always requires the recovery token;
* GPS duplicate detection compares active unresolved category/band state inside
  the privacy-preserving 10 metre boundary;
* cleanup changes each report's current score before the active-report beach median is taken;
* fully cleared reports stay in history but leave the current score and active count;
* PostgreSQL Iteration 2 tables receive the same integrity constraints as the
  release migration, even if an application process creates them first.
"""

from __future__ import annotations

import hashlib
import hmac
from pathlib import Path
from statistics import median
from typing import Any

from flask import g, jsonify, request
from sqlalchemy import inspect, select, text

import app_core as _impl
from app_core import *  # noqa: F401,F403 - preserve the public module contract
from standalone_cleanup import (
    _active_quantities,
    _current_band_state,
    configure_cleanup_schema,
    install_cleanup_route,
)


# Iteration 2 originally required every cleanup to point at a counted report.
# The reviewed product rule now also allows a beach-level standalone cleanup.
configure_cleanup_schema(_impl)

_original_create_app = _impl.create_app
_original_initialise_database = _impl.initialise_database
_original_nearby_proximity_refs = _impl.nearby_proximity_refs
GEO_DUPLICATE_NOTE_PREFIX = "Privacy-proximity duplicate:"
GEO_DUPLICATE_NOTE = (
    GEO_DUPLICATE_NOTE_PREFIX
    + " an active unresolved report within 10 metres has the same non-Small category and quantity-band map."
)


def _qualified_table(name: str) -> str:
    schema = _impl.database_schema()
    return f'"{schema}".{name}' if schema else name


def _constraint_exists(connection: Any, table_name: str, constraint_name: str) -> bool:
    schema_name = _impl.database_schema()
    if not schema_name:
        schema_name = connection.execute(text("SELECT current_schema()" )).scalar_one()
    return connection.execute(
        text(
            """
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE c.conname = :constraint_name
              AND t.relname = :table_name
              AND n.nspname = :schema_name
            """
        ),
        {
            "constraint_name": constraint_name,
            "table_name": table_name,
            "schema_name": schema_name,
        },
    ).first() is not None


def _ensure_postgres_iteration2_contract(engine: Any) -> None:
    """Bring runtime-created PostgreSQL tables up to the migration contract."""

    if engine.dialect.name != "postgresql":
        return

    q = _qualified_table
    definitions = [
        ("community_events", "community_events_beach_fk", f"FOREIGN KEY (beach_id) REFERENCES {q('beaches')}(id)"),
        ("community_events", "community_events_created_by_fk", f"FOREIGN KEY (created_by) REFERENCES {q('users')}(id)"),
        ("community_events", "community_events_status_check", "CHECK (status IN ('Open','Closed'))"),
        ("community_events", "community_events_source_check", "CHECK (source IN ('scheduled','moderator'))"),
        ("community_events", "community_events_time_check", "CHECK (ends_at > starts_at)"),
        ("community_event_members", "community_event_members_event_fk", f"FOREIGN KEY (event_id) REFERENCES {q('community_events')}(id) ON DELETE CASCADE"),
        ("community_event_members", "community_event_members_participant_fk", f"FOREIGN KEY (participant_id) REFERENCES {q('users')}(id)"),
        ("community_event_members", "community_event_members_location_check", "CHECK (location_passed = (checked_in_at IS NOT NULL))"),
        ("cleanup_actions", "cleanup_actions_target_report_fk", f"FOREIGN KEY (target_report_id) REFERENCES {q('reports')}(id)"),
        ("cleanup_actions", "cleanup_actions_participant_fk", f"FOREIGN KEY (participant_id) REFERENCES {q('users')}(id)"),
        ("cleanup_actions", "cleanup_actions_event_fk", f"FOREIGN KEY (event_id) REFERENCES {q('community_events')}(id)"),
        ("cleanup_actions", "cleanup_actions_beach_fk", f"FOREIGN KEY (beach_id) REFERENCES {q('beaches')}(id)"),
        ("cleanup_actions", "cleanup_actions_total_removed_check", "CHECK (total_removed > 0)"),
        ("cleanup_actions", "cleanup_actions_handling_check", "CHECK (handling IN ('Collected for disposal','Recycled / handled','Not recorded'))"),
        ("reports", "reports_event_fk", f"FOREIGN KEY (event_id) REFERENCES {q('community_events')}(id)"),
    ]

    with engine.begin() as connection:
        connection.execute(
            text(
                f"ALTER TABLE {q('cleanup_actions')} "
                "ALTER COLUMN target_report_id DROP NOT NULL"
            )
        )
        for table_name, constraint_name, definition in definitions:
            if _constraint_exists(connection, table_name, constraint_name):
                continue
            connection.execute(
                text(
                    f'ALTER TABLE {q(table_name)} '
                    f'ADD CONSTRAINT "{constraint_name}" {definition}'
                )
            )

        schema = _impl.database_schema()
        index_name = f'"{schema}".cleanup_actions_target' if schema else "cleanup_actions_target"
        connection.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
        connection.execute(
            text(
                f"CREATE INDEX cleanup_actions_target "
                f"ON {q('cleanup_actions')} (target_report_id, created_at)"
            )
        )


def _repair_exact_duplicate_statuses(engine: Any) -> None:
    """Keep the existing legacy repair until old rows are retired."""

    with engine.begin() as connection:
        rows = connection.execute(
            select(_impl.reports_table)
            .where(_impl.reports_table.c.status != "Incomplete")
            .order_by(_impl.reports_table.c.created_at, _impl.reports_table.c.id)
        ).all()
        seen: set[tuple[str, str, Any, tuple[tuple[str, str], ...]]] = set()
        for row in rows:
            if row.status == "Duplicate" and str(getattr(row, "status_note", "") or "").startswith(
                GEO_DUPLICATE_NOTE_PREFIX
            ):
                continue
            quantities = _impl.quantities_from_row(row)
            signature = tuple(
                (category, quantities[category])
                for category in _impl.FRONTEND_CATEGORIES
                if category in quantities
            )
            local_day = _impl.utc_datetime(row.created_at).astimezone(_impl.KUALA_LUMPUR).date()
            key = (row.reporter_id, row.beach_id, local_day, signature)
            desired = "Duplicate" if key in seen else "Counted"
            seen.add(key)
            if row.status == desired:
                continue
            values: dict[str, Any] = {"status": desired}
            if desired == "Counted":
                values["status_note"] = None
            connection.execute(
                _impl.reports_table.update()
                .where(_impl.reports_table.c.id == row.id)
                .values(**values)
            )


def _ensure_report_columns_single_connection(engine: Any) -> None:
    """Apply startup report DDL without reflecting through a second pooled connection."""

    schema = _impl.database_schema() if engine.dialect.name != "sqlite" else None
    inspector = inspect(engine)
    if "reports" not in inspector.get_table_names(schema=schema):
        return
    column_info = inspector.get_columns("reports", schema=schema)
    existing = {column["name"] for column in column_info}
    column_types = {
        column["name"]: column["type"].__class__.__name__.lower()
        for column in column_info
    }
    additions = {
        "beach_name": "VARCHAR(160)",
        "quantities": "TEXT",
        "photo_mime": "VARCHAR(64)",
        "photo_stripped": "BOOLEAN",
        **{column: "VARCHAR(20)" for column in _impl.QUANTITY_COLUMNS.values()},
        "lat": "DOUBLE PRECISION",
        "lng": "DOUBLE PRECISION",
        "item_counts": "TEXT",
        "proximity_ref": "VARCHAR(64)",
        "event_id": "VARCHAR(100)",
        "status_note": "TEXT",
        "updated_at": "TIMESTAMP WITH TIME ZONE",
        "deleted_at": "TIMESTAMP WITH TIME ZONE",
    }
    report_table = "reports" if schema is None else f'"{schema}".reports'
    with engine.begin() as connection:
        for name, sql_type in additions.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE {report_table} ADD COLUMN {name} {sql_type}"))
        if engine.dialect.name == "postgresql":
            for column in _impl.QUANTITY_COLUMNS.values():
                if "int" in column_types.get(column, ""):
                    connection.execute(text(
                        f"ALTER TABLE {report_table} ALTER COLUMN {column} TYPE VARCHAR(20) "
                        f"USING CASE {column} WHEN 1 THEN 'Small' WHEN 2 THEN 'Medium' "
                        f"WHEN 3 THEN 'Large' WHEN 4 THEN 'Very Large' ELSE NULL END"
                    ))


def _initialise_database(engine: Any) -> None:
    original_ensure_report_columns = _impl.ensure_report_columns
    _impl.ensure_report_columns = _ensure_report_columns_single_connection
    try:
        _original_initialise_database(engine)
    finally:
        _impl.ensure_report_columns = original_ensure_report_columns
    _repair_exact_duplicate_statuses(engine)
    _ensure_postgres_iteration2_contract(engine)


def _candidate_quantities(connection: Any, exclude_report_id: str | None) -> dict[str, str] | None:
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        quantities = payload.get("quantities")
        if isinstance(quantities, dict) and quantities:
            normalised = {
                str(category): str(quantity)
                for category, quantity in quantities.items()
                if category in _impl.CATEGORY_WEIGHTS and quantity in _impl.QUANTITY_WEIGHTS
            }
            if len(normalised) == len(quantities):
                return normalised

        if "itemCounts" in payload:
            item_counts = _impl.validate_item_counts(payload.get("itemCounts"))
            if item_counts:
                return _impl.quantity_bands_for_counts(item_counts)

    if exclude_report_id:
        row = connection.execute(
            select(_impl.reports_table).where(_impl.reports_table.c.id == exclude_report_id)
        ).first()
        if row is not None:
            return _impl.quantities_from_row(row)
    return None


def _nearby_proximity_refs_reviewed(lat: float, lng: float, target_id: str, secret: str) -> set[str]:
    """The reviewed create flow handles nearby active targets itself."""

    if request.endpoint == "create_report":
        return set()
    return _original_nearby_proximity_refs(lat, lng, target_id, secret)


def _duplicate_status(
    connection: Any,
    reporter_id: str,
    beach_id: str,
    created_at: Any,
    exclude_report_id: str | None = None,
) -> str:
    """Retain exact-signature duplicate handling for non-GPS legacy/manual flows."""

    candidate = _candidate_quantities(connection, exclude_report_id)
    if not candidate:
        return "Counted"

    rows = connection.execute(
        select(_impl.reports_table).where(
            _impl.reports_table.c.reporter_id == reporter_id,
            _impl.reports_table.c.beach_id == beach_id,
            _impl.reports_table.c.status == "Counted",
        )
    ).all()
    local_day = _impl.utc_datetime(created_at).astimezone(_impl.KUALA_LUMPUR).date()
    for row in rows:
        if row.id == exclude_report_id:
            continue
        if _impl.utc_datetime(row.created_at).astimezone(_impl.KUALA_LUMPUR).date() != local_day:
            continue
        if _impl.quantities_from_row(row) == candidate:
            return "Duplicate"
    return "Counted"


def _remaining_count_attention(engine: Any, rows: list[Any]) -> float | None:
    """Apply cleanup per report and take the median of active reports only."""

    active = _impl.active_attention_rows(engine, rows)
    if len(active) < 3:
        return None
    return float(median(_impl.report_score_for(quantities) for _, quantities in active))


def _geo_secret(jwt_secret: str) -> str:
    return _impl.os.getenv("GEO_PRIVACY_HMAC_KEY", "").strip() or hmac.new(
        jwt_secret.encode("utf-8"), b"radar-sampah-geo-key-v1", hashlib.sha256
    ).hexdigest()


def _normalised_active_payload(payload: Any) -> dict[str, str]:
    if not isinstance(payload, dict):
        return {}
    quantities = payload.get("quantities")
    if isinstance(quantities, dict) and quantities:
        valid = {
            str(category): str(band)
            for category, band in quantities.items()
            if category in _impl.FRONTEND_CATEGORIES and band in _impl.QUANTITY_WEIGHTS
        }
        if len(valid) == len(quantities):
            return _active_quantities(valid)
    if "itemCounts" in payload:
        counts = _impl.validate_item_counts(payload.get("itemCounts"))
        if counts:
            return _active_quantities(_impl.quantity_bands_for_counts(counts))
    return {}


def _projected_xy(lat: float, lng: float) -> tuple[float, float]:
    latitude = min(85.05112878, max(-85.05112878, lat))
    radius = 6_378_137.0
    x = radius * _impl.math.radians(lng)
    y = radius * _impl.math.log(_impl.math.tan(_impl.math.pi / 4 + _impl.math.radians(latitude) / 2))
    return x, y


def _distance_to_stored_cell(
    lat: float,
    lng: float,
    target_id: str,
    stored_ref: str,
    secret: str,
) -> float | None:
    """Match an HMAC cell without recovering or persisting the target coordinate."""

    x, y = _projected_xy(lat, lng)
    grid = float(_impl.GEO_GRID_METRES)
    base_x = _impl.math.floor(x / grid)
    base_y = _impl.math.floor(y / grid)
    cells = int(_impl.math.ceil(10.0 / grid)) + 1
    for offset_x in range(-cells, cells + 1):
        for offset_y in range(-cells, cells + 1):
            cell_x, cell_y = base_x + offset_x, base_y + offset_y
            candidate_ref = _impl.proximity_ref_for_cell(cell_x, cell_y, target_id, secret)
            if not hmac.compare_digest(candidate_ref, stored_ref):
                continue
            min_x, max_x = cell_x * grid, (cell_x + 1) * grid
            min_y, max_y = cell_y * grid, (cell_y + 1) * grid
            dx = min_x - x if x < min_x else x - max_x if x > max_x else 0.0
            dy = min_y - y if y < min_y else y - max_y if y > max_y else 0.0
            return _impl.math.hypot(dx, dy)
    return None


def _gps_proximity_decision(engine: Any, payload: Any, secret: str) -> tuple[str, str | None]:
    """Return desired status and optional active target whose reference moves."""

    if not isinstance(payload, dict) or payload.get("locationSource") != "gps":
        return "Counted", None
    coords = payload.get("coords")
    if not isinstance(coords, dict):
        return "Counted", None
    try:
        lat, lng = float(coords["lat"]), float(coords["lng"])
    except (KeyError, TypeError, ValueError):
        return "Counted", None
    beach_id = str(payload.get("beachId") or "").strip()
    candidate = _normalised_active_payload(payload)
    if not beach_id or not candidate:
        return "Counted", None

    changed_targets: list[tuple[float, str]] = []
    with engine.connect() as connection:
        targets = connection.execute(
            select(_impl.reports_table).where(
                _impl.reports_table.c.beach_id == beach_id,
                _impl.reports_table.c.status == "Counted",
                _impl.reports_table.c.proximity_ref.is_not(None),
            )
        ).all()
        for target in targets:
            distance = _distance_to_stored_cell(lat, lng, target.id, target.proximity_ref, secret)
            if distance is None or distance > 10.0:
                continue
            actions = connection.execute(
                select(_impl.cleanup_actions_table)
                .where(_impl.cleanup_actions_table.c.target_report_id == target.id)
                .order_by(_impl.cleanup_actions_table.c.created_at)
            ).all()
            active = _active_quantities(_current_band_state(_impl, target, actions))
            if not active:
                continue
            if active == candidate:
                return "Duplicate", None
            changed_targets.append((distance, target.id))
    if not changed_targets:
        return "Counted", None
    changed_targets.sort(key=lambda item: (item[0], item[1]))
    return "Counted", changed_targets[0][1]


def _repair_gps_privacy_rows(engine: Any, secret: str) -> None:
    """Convert any transient/raw GPS rows to a privacy reference and clear raw coordinates."""

    with engine.begin() as connection:
        rows = connection.execute(
            select(_impl.reports_table).where(
                _impl.reports_table.c.location_source == "gps",
                _impl.reports_table.c.lat.is_not(None),
                _impl.reports_table.c.lng.is_not(None),
            )
        ).all()
        for row in rows:
            reference = row.proximity_ref or _impl.proximity_ref(float(row.lat), float(row.lng), row.id, secret)
            connection.execute(
                _impl.reports_table.update()
                .where(_impl.reports_table.c.id == row.id)
                .values(lat=None, lng=None, proximity_ref=reference)
            )


_impl.initialise_database = _initialise_database
_impl.duplicate_status = _duplicate_status
_impl.remaining_count_attention = _remaining_count_attention
_impl.nearby_proximity_refs = _nearby_proximity_refs_reviewed


def create_app(
    database_url: str | None = None,
    testing: bool = False,
    photo_storage_dir: str | Path | None = None,
):
    application = _original_create_app(
        database_url=database_url,
        testing=testing,
        photo_storage_dir=photo_storage_dir,
    )
    engine = application.extensions["marine_engine"]
    jwt_secret = _impl.auth_jwt_secret(testing)
    geo_secret = _geo_secret(jwt_secret)
    _repair_gps_privacy_rows(engine, geo_secret)

    def restore_anonymous_participant_strict():
        payload = request.get_json(silent=True)
        participant_id = str(payload.get("participantId") or "").strip() if isinstance(payload, dict) else ""
        supplied_recovery_token = str(payload.get("token") or "").strip() if isinstance(payload, dict) else ""
        if not _impl.re.fullmatch(r"\d{4}", participant_id):
            return _impl.error_response(404, "UNKNOWN_PARTICIPANT", "That participant ID was not found.")
        with engine.connect() as connection:
            row = connection.execute(
                select(_impl.users_table).where(_impl.users_table.c.participant_id == participant_id)
            ).first()
        if row is None:
            return _impl.error_response(404, "UNKNOWN_PARTICIPANT", "That participant ID was not found.")
        stored_digest = getattr(row, "user_token", None)
        digest_match = bool(
            supplied_recovery_token
            and stored_digest
            and hmac.compare_digest(
                stored_digest,
                hashlib.sha256(supplied_recovery_token.encode("utf-8")).hexdigest(),
            )
        )
        legacy_match = bool(
            supplied_recovery_token
            and _impl.recovery_token_matches(row.id, supplied_recovery_token, jwt_secret)
        )
        if not (digest_match or legacy_match):
            return _impl.error_response(
                401,
                "INVALID_RECOVERY_TOKEN",
                "That participant ID and recovery token do not match.",
            )
        return jsonify({"token": _impl.issue_token(row.id, jwt_secret), "user": _impl.user_dict(row)})

    def get_iteration2_scoring_method_reviewed():
        return jsonify({
            "ruleVersion": "radar-sampah-scoring-i2-v3",
            "categoryWeights": [
                {"category": category, "weight": _impl.CATEGORY_WEIGHTS[category]}
                for category in _impl.FRONTEND_CATEGORIES
            ],
            "itemCountBands": [
                {"minimum": 1, "maximum": 5, "quantity": "Small", "weight": 1},
                {"minimum": 6, "maximum": 20, "quantity": "Medium", "weight": 2},
                {"minimum": 21, "maximum": 50, "quantity": "Large", "weight": 3},
                {"minimum": 51, "maximum": None, "quantity": "Very Large", "weight": 4},
            ],
            "windowDays": 90,
            "minReports": 3,
            "reportEligibility": "Counted reports in the latest 90 days with active non-Small litter after cleanup; resolved reports remain in history",
            "remainingCountAggregation": "per-report-after-cleanup",
            "reportAggregation": "max-category-score",
            "beachAggregation": "median-of-active-reports",
            "modelClassMapping": [
                {"modelClass": model_class, "category": category}
                for model_class, category in _impl.ITERATION2_CATEGORIES.items()
            ],
            "cleanupScore": "quantity-band-unit-reduction",
            "cleanupPoints": 0,
        })

    @application.after_request
    def persist_location_duplicate_note(response):
        # Retained for old pre-band requests. New GPS duplicate status/note is
        # set atomically by the reviewed wrapper below.
        if (
            request.endpoint == "create_report"
            and response.status_code == 201
            and getattr(g, "same_day_nearby_gps_duplicate", False)
        ):
            payload = response.get_json(silent=True)
            report_id = payload.get("id") if isinstance(payload, dict) else None
            if report_id:
                with engine.begin() as connection:
                    connection.execute(
                        _impl.reports_table.update()
                        .where(_impl.reports_table.c.id == report_id)
                        .values(status_note=GEO_DUPLICATE_NOTE)
                    )
                payload["statusNote"] = GEO_DUPLICATE_NOTE
                response.set_data(_impl.json.dumps(payload, separators=(",", ":")))
        return response

    install_cleanup_route(application, engine, jwt_secret, _impl)

    original_create_report = application.view_functions["create_report"]

    def create_report_with_reviewed_proximity():
        payload = request.get_json(silent=True)
        decision = _gps_proximity_decision(engine, payload, geo_secret)
        response = application.make_response(original_create_report())
        if response.status_code != 201 or not isinstance(payload, dict) or payload.get("locationSource") != "gps":
            return response
        coords = payload.get("coords")
        body = response.get_json(silent=True)
        if not isinstance(coords, dict) or not isinstance(body, dict) or not body.get("id"):
            return response
        try:
            lat, lng = float(coords["lat"]), float(coords["lng"])
        except (KeyError, TypeError, ValueError):
            return response
        report_id = str(body["id"])
        desired_status, refresh_target_id = decision
        new_reference = _impl.proximity_ref(lat, lng, report_id, geo_secret)
        values: dict[str, Any] = {
            "lat": None,
            "lng": None,
            "proximity_ref": new_reference,
            "status": desired_status,
            "status_note": GEO_DUPLICATE_NOTE if desired_status == "Duplicate" else None,
        }
        with engine.begin() as connection:
            connection.execute(
                _impl.reports_table.update()
                .where(_impl.reports_table.c.id == report_id)
                .values(**values)
            )
            if refresh_target_id and desired_status == "Counted":
                connection.execute(
                    _impl.reports_table.update()
                    .where(_impl.reports_table.c.id == refresh_target_id)
                    .values(proximity_ref=_impl.proximity_ref(lat, lng, refresh_target_id, geo_secret))
                )
        body["status"] = desired_status
        if desired_status == "Duplicate":
            body["statusNote"] = GEO_DUPLICATE_NOTE
        else:
            body.pop("statusNote", None)
        response.set_data(_impl.json.dumps(body, separators=(",", ":")))
        return response

    application.view_functions["create_report"] = create_report_with_reviewed_proximity
    application.view_functions["restore_anonymous_participant"] = restore_anonymous_participant_strict
    application.view_functions["get_iteration2_scoring_method"] = get_iteration2_scoring_method_reviewed
    return application


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(_impl.os.getenv("PORT", "5000")))
