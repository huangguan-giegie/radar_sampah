"""Reviewed Radar Sampah API entry point.

The Iteration 2 backend implementation lives in ``app_core.py``. This thin
entry point keeps that implementation intact while enforcing the reviewed
Iteration 2 contracts that must not regress during integration:

* account recovery always requires the recovery token;
* duplicate detection accepts either an exact participant/category signature
  or a same-beach, same-day privacy-preserving GPS match within 10 metres;
* cleanup changes each report's current score before the beach median is taken;
* PostgreSQL Iteration 2 tables receive the same integrity constraints as the
  release migration, even if an application process creates them first.
"""

from __future__ import annotations

import hashlib
import hmac
from pathlib import Path
from statistics import median
from typing import Any

from flask import current_app, g, jsonify, request
from sqlalchemy import inspect, select, text

import app_core as _impl
from app_core import *  # noqa: F401,F403 - preserve the public module contract
from standalone_cleanup import configure_cleanup_schema, install_cleanup_route


# Iteration 2 originally required every cleanup to point at a counted report.
# The reviewed product rule now also allows a beach-level standalone cleanup.
configure_cleanup_schema(_impl)

_original_create_app = _impl.create_app
_original_initialise_database = _impl.initialise_database
_original_nearby_proximity_refs = _impl.nearby_proximity_refs
GEO_DUPLICATE_NOTE_PREFIX = "Privacy-proximity duplicate:"
GEO_DUPLICATE_NOTE = (
    GEO_DUPLICATE_NOTE_PREFIX
    + " another Counted GPS report exists at the same beach, on the same Malaysia-local day, within 10 metres."
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
    """Repair legacy broad duplicates while preserving reviewed GPS duplicates."""

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


def _same_day_nearby_gps_duplicate(lat: float, lng: float, secret: str) -> bool:
    """Detect a same-beach, same-local-day report within the protected 10 m grid."""

    if request.endpoint != "create_report":
        return False
    cached = getattr(g, "same_day_nearby_gps_duplicate", None)
    if cached is not None:
        return bool(cached)

    payload = request.get_json(silent=True)
    beach_id = str(payload.get("beachId") or "").strip() if isinstance(payload, dict) else ""
    if not beach_id:
        g.same_day_nearby_gps_duplicate = False
        return False

    candidate_day = _impl.datetime.now(_impl.timezone.utc).astimezone(_impl.KUALA_LUMPUR).date()
    engine = current_app.extensions["marine_engine"]
    with engine.connect() as connection:
        rows = connection.execute(
            select(_impl.reports_table).where(
                _impl.reports_table.c.beach_id == beach_id,
                _impl.reports_table.c.status == "Counted",
                _impl.reports_table.c.item_counts.is_not(None),
                _impl.reports_table.c.proximity_ref.is_not(None),
            )
        ).all()

    for row in rows:
        if _impl.utc_datetime(row.created_at).astimezone(_impl.KUALA_LUMPUR).date() != candidate_day:
            continue
        candidate_refs = _original_nearby_proximity_refs(lat, lng, row.id, secret)
        if row.proximity_ref in candidate_refs:
            g.same_day_nearby_gps_duplicate = True
            g.nearby_duplicate_report_id = row.id
            return True

    g.same_day_nearby_gps_duplicate = False
    return False


def _nearby_proximity_refs_reviewed(lat: float, lng: float, target_id: str, secret: str) -> set[str]:
    """Let same-day nearby reports save as Duplicate instead of returning 409."""

    refs = _original_nearby_proximity_refs(lat, lng, target_id, secret)
    if _same_day_nearby_gps_duplicate(lat, lng, secret):
        return set()
    return refs


def _duplicate_status(
    connection: Any,
    reporter_id: str,
    beach_id: str,
    created_at: Any,
    exclude_report_id: str | None = None,
) -> str:
    """Apply either reviewed duplicate rule without treating participant ID as location identity."""

    if request.endpoint == "create_report" and getattr(g, "same_day_nearby_gps_duplicate", False):
        return "Duplicate"

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
            "reportEligibility": "Counted reports in the latest 90 days with remaining litter after cleanup; fully cleared count-backed reports are excluded from the active count but retained in history",
            "remainingCountAggregation": "per-report-after-cleanup",
            "reportAggregation": "max-category-score",
            "beachAggregation": "median-of-active-reports",
            "modelClassMapping": [
                {"modelClass": model_class, "category": category}
                for model_class, category in _impl.ITERATION2_CATEGORIES.items()
            ],
            "cleanupScore": "number-of-items-removed",
            "cleanupPoints": 0,
        })

    @application.after_request
    def persist_location_duplicate_note(response):
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
    application.view_functions["restore_anonymous_participant"] = restore_anonymous_participant_strict
    application.view_functions["get_iteration2_scoring_method"] = get_iteration2_scoring_method_reviewed
    return application


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(_impl.os.getenv("PORT", "5000")))
