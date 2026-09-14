"""Reviewed Radar Sampah API entry point.

The Iteration 2 backend implementation lives in ``app_core.py``.  This thin
entry point keeps that implementation intact while enforcing the reviewed
Iteration 2 contracts that must not regress during integration:

* account recovery always requires the recovery token;
* exact-duplicate detection includes the category/quantity signature;
* cleanup changes each report's current score before the beach median is taken;
* PostgreSQL Iteration 2 tables receive the same integrity constraints as the
  release migration, even if an application process creates them first.
"""

from __future__ import annotations

import hashlib
import hmac
from statistics import median
from typing import Any

from flask import jsonify, request
from sqlalchemy import select, text

import app_core as _impl
from app_core import *  # noqa: F401,F403 - preserve the public module contract


_original_create_app = _impl.create_app
_original_initialise_database = _impl.initialise_database


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


def _initialise_database(engine: Any) -> None:
    _original_initialise_database(engine)
    _ensure_postgres_iteration2_contract(engine)


def _candidate_quantities(connection: Any, exclude_report_id: str | None) -> dict[str, str] | None:
    payload = request.get_json(silent=True)
    if isinstance(payload, dict):
        quantities = payload.get("quantities")
        if isinstance(quantities, dict) and quantities:
            normalised = {
                str(category): str(quantity)
                for category, quantity in quantities.items()
                if category in _impl.QUANTITY_WEIGHTS and quantity in _impl.QUANTITY_WEIGHTS
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


def _duplicate_status(
    connection: Any,
    reporter_id: str,
    beach_id: str,
    created_at: Any,
    exclude_report_id: str | None = None,
) -> str:
    """Only an exact same-day category/quantity signature is a duplicate."""

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
    """Apply cleanup per report, then keep the existing beach median rule."""

    if len(rows) < 3:
        return None

    count_backed_ids = [row.id for row in rows if getattr(row, "item_counts", None)]
    actions_by_report: dict[str, list[Any]] = {report_id: [] for report_id in count_backed_ids}
    if count_backed_ids:
        with engine.connect() as connection:
            actions = connection.execute(
                select(_impl.cleanup_actions_table).where(
                    _impl.cleanup_actions_table.c.target_report_id.in_(count_backed_ids)
                )
            ).all()
        for action in actions:
            actions_by_report.setdefault(action.target_report_id, []).append(action)

    scores: list[float] = []
    for row in rows:
        if getattr(row, "item_counts", None):
            remaining = _impl.remaining_counts_for(row, actions_by_report.get(row.id, []))
            if not remaining:
                scores.append(0.0)
                continue
            quantities = _impl.quantity_bands_for_counts(remaining)
        else:
            quantities = _impl.quantities_from_row(row)
        scores.append(_impl.report_score_for(quantities) if quantities else 0.0)

    return float(median(scores))


_impl.initialise_database = _initialise_database
_impl.duplicate_status = _duplicate_status
_impl.remaining_count_attention = _remaining_count_attention


def create_app(
    database_url: str | None = None,
    testing: bool = False,
    photo_storage_dir: str | Any | None = None,
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
            "ruleVersion": "radar-sampah-scoring-i2-v2",
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
            "remainingCountAggregation": "per-report-after-cleanup",
            "reportAggregation": "max-category-score",
            "beachAggregation": "median",
            "modelClassMapping": [
                {"modelClass": model_class, "category": category}
                for model_class, category in _impl.ITERATION2_CATEGORIES.items()
            ],
            "cleanupScore": "number-of-items-removed",
            "cleanupPoints": 0,
        })

    application.view_functions["restore_anonymous_participant"] = restore_anonymous_participant_strict
    application.view_functions["get_iteration2_scoring_method"] = get_iteration2_scoring_method_reviewed
    return application


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(_impl.os.getenv("PORT", "5000")))
