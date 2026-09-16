from __future__ import annotations

from collections import defaultdict, deque
import hashlib
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from flask import jsonify, request
from sqlalchemy import Column, Integer, Text, inspect, insert, select, text
from sqlalchemy.exc import IntegrityError


BAND_UNITS = {"Small": 1, "Medium": 2, "Large": 3, "Very Large": 4}


def configure_cleanup_schema(impl: Any) -> None:
    """Prepare fresh databases for standalone and band-based cleanup actions."""
    table = impl.cleanup_actions_table
    table.c.target_report_id.nullable = True
    table.c.removed_counts.nullable = True
    table.c.total_removed.nullable = True
    if "remaining_quantities" not in table.c:
        table.append_column(Column("remaining_quantities", Text, nullable=True))
    if "removed_quantities" not in table.c:
        table.append_column(Column("removed_quantities", Text, nullable=True))
    if "cleanup_score" not in table.c:
        table.append_column(Column("cleanup_score", Integer, nullable=True))


def _qualified_cleanup_table(impl: Any) -> str:
    schema = impl.database_schema()
    return f'"{schema}".cleanup_actions' if schema else "cleanup_actions"


def ensure_cleanup_band_columns(engine: Any, impl: Any) -> None:
    """Idempotently upgrade an already-created cleanup_actions table."""
    schema = impl.database_schema() if engine.dialect.name != "sqlite" else None
    inspector = inspect(engine)
    if "cleanup_actions" not in inspector.get_table_names(schema=schema):
        return
    existing = {column["name"] for column in inspector.get_columns("cleanup_actions", schema=schema)}
    table = _qualified_cleanup_table(impl)
    with engine.begin() as connection:
        if "remaining_quantities" not in existing:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN remaining_quantities TEXT"))
        if "removed_quantities" not in existing:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN removed_quantities TEXT"))
        if "cleanup_score" not in existing:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN cleanup_score INTEGER"))
        if engine.dialect.name == "postgresql":
            connection.execute(text(f"ALTER TABLE {table} ALTER COLUMN removed_counts DROP NOT NULL"))
            connection.execute(text(f"ALTER TABLE {table} ALTER COLUMN total_removed DROP NOT NULL"))


def _json_map(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return dict(parsed) if isinstance(parsed, dict) else {}


def _valid_band_map(value: Any, impl: Any, *, allow_empty: bool) -> dict[str, str] | None:
    if not isinstance(value, dict):
        return None
    if not value and not allow_empty:
        return None
    normalised: dict[str, str] = {}
    for category, band in value.items():
        if category not in impl.FRONTEND_CATEGORIES or band not in BAND_UNITS:
            return None
        normalised[str(category)] = str(band)
    return normalised


def _is_resolved(quantities: dict[str, str]) -> bool:
    return not any(band != "Small" for band in quantities.values())


def _current_band_state(impl: Any, report: Any, actions: list[Any]) -> dict[str, str]:
    """Return the immutable report's current unresolved band state."""
    canonical_actions = sorted(
        (
            action
            for action in actions
            if getattr(action, "remaining_quantities", None) is not None
        ),
        key=lambda action: impl.utc_datetime(action.created_at),
    )
    if canonical_actions:
        latest = _valid_band_map(
            _json_map(canonical_actions[-1].remaining_quantities),
            impl,
            allow_empty=True,
        )
        return latest or {}

    # Legacy count-backed actions remain readable and are normalised once at
    # this compatibility boundary. New actions never need exact counts.
    if getattr(report, "item_counts", None):
        remaining = impl.remaining_counts_for(report, actions)
        if remaining:
            return impl.quantity_bands_for_counts(remaining)
        return {}
    return impl.quantities_from_row(report)


def _active_quantities(quantities: dict[str, str]) -> dict[str, str]:
    return {category: band for category, band in quantities.items() if band != "Small"}


def install_cleanup_route(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Install the final Iteration 2 cleanup and active-evidence contract."""
    ensure_cleanup_band_columns(engine, impl)
    rate_events: defaultdict[str, deque[float]] = defaultdict(deque)

    # PR #46 already centralised active evidence in this helper. Replace its
    # count-only view with a compatibility-aware band state so report scoring,
    # composition, and cleanup targets all consume the same state.
    def active_band_rows(active_engine: Any, rows: list[Any]):
        filtered: list[tuple[Any, dict[str, str]]] = []
        counted = [row for row in rows if row.status == "Counted"]
        if not counted:
            return filtered
        actions_by_report: dict[str, list[Any]] = defaultdict(list)
        with active_engine.connect() as connection:
            actions = connection.execute(
                select(impl.cleanup_actions_table)
                .where(impl.cleanup_actions_table.c.target_report_id.in_([row.id for row in counted]))
                .order_by(impl.cleanup_actions_table.c.created_at)
            ).all()
        for action in actions:
            actions_by_report[action.target_report_id].append(action)
        for row in counted:
            active = _active_quantities(_current_band_state(impl, row, actions_by_report[row.id]))
            if active:
                filtered.append((row, active))
        return filtered

    impl.active_attention_rows = active_band_rows
    impl._manual_remarks_active_filter_installed = True

    @application.before_request
    def reject_small_only_new_report():
        if request.endpoint != "create_report":
            return None
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return None
        quantities = payload.get("quantities")
        if (
            isinstance(quantities, dict)
            and quantities
            and all(quantity == "Small" for quantity in quantities.values())
        ):
            return impl.error_response(
                422,
                "SMALL_ONLY_REPORT",
                "This report is below the active litter threshold because every confirmed category is Small.",
            )
        return None

    def current_user():
        header = request.headers.get("Authorization", "")
        token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
        user_id = impl.decode_token_subject(token, jwt_secret) if token else None
        if user_id is None:
            return None
        with engine.connect() as connection:
            return connection.execute(select(impl.users_table).where(impl.users_table.c.id == user_id)).first()

    def cleanup_action_dict(action: Any) -> dict[str, Any]:
        with engine.connect() as connection:
            participant = connection.execute(
                select(impl.users_table.c.participant_id).where(impl.users_table.c.id == action.participant_id)
            ).scalar_one_or_none()
            beach_name = connection.execute(
                select(impl.beaches_table.c.name).where(impl.beaches_table.c.id == action.beach_id)
            ).scalar_one_or_none()
        remaining_quantities = _valid_band_map(
            _json_map(getattr(action, "remaining_quantities", None)), impl, allow_empty=True
        ) if getattr(action, "remaining_quantities", None) is not None else None
        removed_quantities = _valid_band_map(
            _json_map(getattr(action, "removed_quantities", None)), impl, allow_empty=False
        ) if getattr(action, "removed_quantities", None) is not None else None
        cleanup_score = getattr(action, "cleanup_score", None)
        return {
            "id": action.id,
            "participantId": participant or action.participant_id,
            "targetReportId": action.target_report_id,
            "eventId": action.event_id,
            "beachId": action.beach_id,
            "beachName": beach_name or action.beach_id,
            "createdAt": impl.contract_timestamp(action.created_at),
            "rows": json.loads(action.rows),
            "score": cleanup_score if cleanup_score is not None else action.total_removed,
            "remainingQuantities": remaining_quantities,
            "removedQuantities": removed_quantities,
            "resolved": bool(action.target_report_id and remaining_quantities is not None and _is_resolved(remaining_quantities)),
            "handling": action.handling,
            "note": action.note or "",
            "status": "Cleanup recorded — awaiting follow-up",
        }

    def active_composition_percentages(active_rows: list[tuple[Any, dict[str, str]]]) -> list[dict[str, Any]]:
        aggregate = {
            category: sum(
                impl.QUANTITY_WEIGHTS[quantities[category]]
                for _row, quantities in active_rows
                if category in quantities
            )
            for category in impl.FRONTEND_CATEGORIES
        }
        weighted = [(category, aggregate[category]) for category in impl.FRONTEND_CATEGORIES if aggregate[category] > 0]
        total = sum(weight for _category, weight in weighted)
        if total <= 0:
            return []
        exact = [(category, weight * 100 / total) for category, weight in weighted]
        whole = {category: impl.math.floor(value) for category, value in exact}
        remainder = 100 - sum(whole.values())
        for category, _value in sorted(
            exact,
            key=lambda item: item[1] - impl.math.floor(item[1]),
            reverse=True,
        )[:remainder]:
            whole[category] += 1
        return [{"category": category, "percentage": whole[category]} for category, _weight in weighted]

    original_get_beach = application.view_functions["get_beach"]

    def get_beach_with_active_composition(beach_id: str):
        response = application.make_response(original_get_beach(beach_id))
        if response.status_code != 200:
            return response

        detail = response.get_json()
        current_time = datetime.now(timezone.utc)
        cutoff = current_time - impl.timedelta(days=90)
        with engine.connect() as connection:
            all_counted = connection.execute(
                select(impl.reports_table).where(
                    impl.reports_table.c.beach_id == beach_id,
                    impl.reports_table.c.status == "Counted",
                )
            ).all()
        eligible = [row for row in all_counted if impl.utc_datetime(row.created_at) >= cutoff]
        active_rows = impl.active_attention_rows(engine, eligible)

        if not active_rows:
            detail["composition"] = None
            detail["compositionSource"] = None
        else:
            detail["composition"] = active_composition_percentages(active_rows)
            detail["compositionSource"] = {
                "method": "active_report_estimate",
                "activeReportCount": len(active_rows),
                "windowDays": 90,
            }
        return jsonify(detail)

    def list_cleanup_targets_reviewed():
        beach_id = request.args.get("beachId")
        report_id = request.args.get("reportId")
        if beach_id and not any(beach["id"] == beach_id for beach in impl.load_beaches()):
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        query = select(impl.reports_table).where(impl.reports_table.c.status == "Counted").order_by(
            impl.reports_table.c.created_at.desc()
        )
        if beach_id:
            query = query.where(impl.reports_table.c.beach_id == beach_id)
        if report_id:
            query = query.where(impl.reports_table.c.id == report_id)
        targets: list[dict[str, Any]] = []
        with engine.connect() as connection:
            reports = connection.execute(query).all()
            for report in reports:
                actions = connection.execute(
                    select(impl.cleanup_actions_table)
                    .where(impl.cleanup_actions_table.c.target_report_id == report.id)
                    .order_by(impl.cleanup_actions_table.c.created_at)
                ).all()
                remaining_quantities = _current_band_state(impl, report, actions)
                if _is_resolved(remaining_quantities):
                    continue
                legacy_counts = impl.remaining_counts_for(report, actions) if getattr(report, "item_counts", None) else {}
                targets.append({
                    "reportId": report.id,
                    "beachId": report.beach_id,
                    "beachName": next(
                        (beach["name"] for beach in impl.load_beaches() if beach["id"] == report.beach_id),
                        report.beach_id,
                    ),
                    "reportedAt": impl.contract_timestamp(report.created_at),
                    "remainingQuantities": remaining_quantities,
                    # Deprecated compatibility fields for already-deployed clients.
                    "itemCounts": legacy_counts or None,
                    "remainingItemCounts": legacy_counts or None,
                })
        return jsonify(targets)

    def _validate_event_link(connection: Any, event_id: Any, beach_id: str, user_id: str):
        if event_id is None:
            return None
        if not isinstance(event_id, str) or not event_id.strip() or len(event_id) > 100:
            return impl.error_response(400, "VALIDATION_FAILED", "eventId must be a valid event identifier.")
        event = connection.execute(select(impl.events_table).where(impl.events_table.c.id == event_id)).first()
        member = connection.execute(
            select(impl.event_members_table).where(
                impl.event_members_table.c.event_id == event_id,
                impl.event_members_table.c.participant_id == user_id,
            )
        ).first()
        now = datetime.now(timezone.utc)
        if event is None or event.beach_id != beach_id:
            return impl.error_response(400, "VALIDATION_FAILED", "eventId must refer to an event at the cleanup beach.")
        if member is None or not member.location_passed:
            return impl.error_response(409, "EVENT_CHECKIN_REQUIRED", "Join and check in to the event before linking this cleanup.")
        if event.status != "Open" or not (impl.utc_datetime(event.starts_at) <= now <= impl.utc_datetime(event.ends_at)):
            return impl.error_response(409, "EVENT_NOT_ACTIVE", "An event-linked cleanup must be recorded during the event.")
        return None

    def create_cleanup_action_reviewed():
        user = current_user()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        request.current_user = user

        now_monotonic = time.monotonic()
        events = rate_events[user.id]
        while events and events[0] <= now_monotonic - 3600:
            events.popleft()
        if len(events) >= 60:
            return impl.error_response(429, "RATE_LIMITED", "Too many requests. Please try again later.")
        events.append(now_monotonic)

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return impl.error_response(400, "VALIDATION_FAILED", "A cleanup object is required.")
        allowed = {
            "targetReportId", "beachId", "remainingQuantities", "removedQuantities",
            "removed", "removedCounts", "eventId", "handling", "note", "idempotencyKey",
        }
        if "handling" not in payload or set(payload) - allowed:
            return impl.error_response(400, "VALIDATION_FAILED", "Cleanup fields are invalid.")

        target_report_id = str(payload.get("targetReportId") or "").strip() or None
        requested_beach_id = str(payload.get("beachId") or "").strip() or None
        canonical_linked = "remainingQuantities" in payload
        canonical_standalone = "removedQuantities" in payload
        legacy_removed = "removed" in payload or "removedCounts" in payload
        mode_count = sum((canonical_linked, canonical_standalone, legacy_removed))
        if mode_count != 1:
            return impl.error_response(400, "VALIDATION_FAILED", "Send one cleanup quantity contract only.")
        if canonical_linked and target_report_id is None:
            return impl.error_response(400, "VALIDATION_FAILED", "targetReportId is required with remainingQuantities.")
        if canonical_standalone and target_report_id is not None:
            return impl.error_response(400, "VALIDATION_FAILED", "removedQuantities is for standalone cleanup only.")
        if target_report_id is None and requested_beach_id is None:
            return impl.error_response(400, "VALIDATION_FAILED", "beachId is required when targetReportId is omitted.")

        handling = payload.get("handling")
        note = payload.get("note")
        event_id = payload.get("eventId")
        idempotency_key = str(
            payload.get("idempotencyKey")
            or request.headers.get("Idempotency-Key")
            or secrets.token_urlsafe(24)
        ).strip()
        if handling not in impl.EVENT_HANDLING_VALUES:
            return impl.error_response(400, "VALIDATION_FAILED", "handling is not a supported value.")
        if note is not None and (not isinstance(note, str) or len(note) > 500):
            return impl.error_response(400, "VALIDATION_FAILED", "note must be 500 characters or fewer.")
        if len(idempotency_key) > 128:
            return impl.error_response(400, "VALIDATION_FAILED", "idempotencyKey must be at most 128 characters.")

        remaining_quantities = _valid_band_map(payload.get("remainingQuantities"), impl, allow_empty=True) if canonical_linked else None
        removed_quantities = _valid_band_map(payload.get("removedQuantities"), impl, allow_empty=False) if canonical_standalone else None
        removed_counts = impl.validate_item_counts(payload.get("removed", payload.get("removedCounts"))) if legacy_removed else None
        if canonical_linked and remaining_quantities is None:
            return impl.error_response(400, "VALIDATION_FAILED", "remainingQuantities must contain supported quantity bands.")
        if canonical_standalone and not removed_quantities:
            return impl.error_response(400, "VALIDATION_FAILED", "removedQuantities must contain supported quantity bands.")
        if legacy_removed and not removed_counts:
            return impl.error_response(400, "VALIDATION_FAILED", "removedCounts must contain positive whole-item counts.")

        fingerprint_value: dict[str, Any] = {
            "targetReportId": target_report_id or "",
            "handling": handling,
            "note": note,
            "eventId": event_id,
        }
        if canonical_linked:
            fingerprint_value["remainingQuantities"] = dict(sorted((remaining_quantities or {}).items()))
        elif canonical_standalone:
            fingerprint_value["removedQuantities"] = dict(sorted((removed_quantities or {}).items()))
        else:
            fingerprint_value["removedCounts"] = dict(sorted((removed_counts or {}).items()))
        if target_report_id is None:
            fingerprint_value["beachId"] = requested_beach_id
        fingerprint = hashlib.sha256(
            json.dumps(fingerprint_value, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

        with engine.begin() as connection:
            existing = connection.execute(
                select(impl.cleanup_actions_table).where(
                    impl.cleanup_actions_table.c.participant_id == user.id,
                    impl.cleanup_actions_table.c.idempotency_key == idempotency_key,
                )
            ).first()
            if existing is not None:
                if existing.request_fingerprint != fingerprint:
                    return impl.error_response(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different cleanup.")
                return jsonify(cleanup_action_dict(existing)), 200

            target = None
            rows: list[dict[str, Any]] = []
            cleanup_score: int | None = None
            if target_report_id is not None:
                target = connection.execute(
                    select(impl.reports_table)
                    .where(impl.reports_table.c.id == target_report_id)
                    .with_for_update()
                ).first()
                if target is None or target.status != "Counted":
                    return impl.error_response(404, "CLEANUP_TARGET_NOT_FOUND", "The cleanup target is no longer available.")
                beach_id = target.beach_id
                if requested_beach_id is not None and requested_beach_id != beach_id:
                    return impl.error_response(400, "VALIDATION_FAILED", "beachId must match the cleanup target beach.")
                prior_actions = connection.execute(
                    select(impl.cleanup_actions_table)
                    .where(impl.cleanup_actions_table.c.target_report_id == target_report_id)
                    .order_by(impl.cleanup_actions_table.c.created_at)
                ).all()

                if canonical_linked:
                    before = _current_band_state(impl, target, prior_actions)
                    if _is_resolved(before):
                        return impl.error_response(409, "CLEANUP_TARGET_COMPLETE", "This cleanup target has already been resolved.")
                    assert remaining_quantities is not None
                    if any(category not in before for category in remaining_quantities):
                        return impl.error_response(400, "VALIDATION_FAILED", "A cleanup cannot add a new litter category to its target.")
                    if any(BAND_UNITS[band] > BAND_UNITS[before[category]] for category, band in remaining_quantities.items()):
                        return impl.error_response(409, "CLEANUP_STATE_INCREASED", "Remaining litter cannot increase during a cleanup.")
                    cleanup_score = sum(
                        max(0, BAND_UNITS[before_band] - BAND_UNITS.get(remaining_quantities.get(category, ""), 0))
                        for category, before_band in before.items()
                    )
                    if cleanup_score <= 0:
                        return impl.error_response(400, "VALIDATION_FAILED", "Record at least one reduction in the cleanup result.")
                    rows = [
                        {
                            "category": category,
                            "before": before_band,
                            "after": remaining_quantities.get(category),
                            "removedUnits": max(0, BAND_UNITS[before_band] - BAND_UNITS.get(remaining_quantities.get(category, ""), 0)),
                        }
                        for category, before_band in before.items()
                        if BAND_UNITS[before_band] != BAND_UNITS.get(remaining_quantities.get(category, ""), 0)
                    ]
                else:
                    # Deprecated exact-count compatibility for historical clients.
                    if not target.item_counts:
                        return impl.error_response(409, "LEGACY_COUNTS_UNAVAILABLE", "This target uses quantity bands; update the client to record remaining bands.")
                    remaining_counts = impl.remaining_counts_for(target, prior_actions)
                    if not remaining_counts:
                        return impl.error_response(409, "CLEANUP_TARGET_COMPLETE", "This cleanup target has already been fully cleared.")
                    assert removed_counts is not None
                    if any(category not in remaining_counts or count > remaining_counts[category] for category, count in removed_counts.items()):
                        return impl.error_response(409, "REMOVED_COUNT_EXCEEDS_REMAINING", "Removed counts cannot exceed the target's remaining item counts.")
                    rows = [
                        {
                            "category": category,
                            "removed": removed_counts[category],
                            "before": remaining_counts[category],
                            "after": remaining_counts[category] - removed_counts[category],
                        }
                        for category in impl.FRONTEND_CATEGORIES
                        if removed_counts.get(category, 0) > 0
                    ]
            else:
                beach_id = requested_beach_id
                beach = connection.execute(select(impl.beaches_table.c.id).where(impl.beaches_table.c.id == beach_id)).first()
                if beach is None:
                    return impl.error_response(404, "NOT_FOUND", "Beach not found.")
                if canonical_standalone:
                    assert removed_quantities is not None
                    cleanup_score = sum(BAND_UNITS[band] for band in removed_quantities.values())
                    rows = [
                        {"category": category, "removedBand": removed_quantities[category]}
                        for category in impl.FRONTEND_CATEGORIES
                        if category in removed_quantities
                    ]
                else:
                    assert removed_counts is not None
                    rows = [
                        {"category": category, "removed": removed_counts[category], "before": None, "after": None}
                        for category in impl.FRONTEND_CATEGORIES
                        if removed_counts.get(category, 0) > 0
                    ]

            event_error = _validate_event_link(connection, event_id, beach_id, user.id)
            if event_error is not None:
                return event_error

            now = datetime.now(timezone.utc)
            action_id = "c_" + secrets.token_hex(10)
            values = dict(
                id=action_id,
                target_report_id=target_report_id,
                participant_id=user.id,
                event_id=event_id,
                beach_id=beach_id,
                rows=json.dumps(rows, separators=(",", ":")),
                handling=handling,
                note=note,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                created_at=now,
                remaining_quantities=(
                    json.dumps(remaining_quantities, separators=(",", ":")) if canonical_linked else None
                ),
                removed_quantities=(
                    json.dumps(removed_quantities, separators=(",", ":")) if canonical_standalone else None
                ),
                cleanup_score=cleanup_score,
                removed_counts=(json.dumps(removed_counts, separators=(",", ":")) if legacy_removed else None),
                total_removed=(sum((removed_counts or {}).values()) if legacy_removed else None),
            )
            try:
                with connection.begin_nested():
                    connection.execute(insert(impl.cleanup_actions_table).values(**values))
                action = connection.execute(
                    select(impl.cleanup_actions_table).where(impl.cleanup_actions_table.c.id == action_id)
                ).first()
                response_status = 201
            except IntegrityError:
                action = connection.execute(
                    select(impl.cleanup_actions_table).where(
                        impl.cleanup_actions_table.c.participant_id == user.id,
                        impl.cleanup_actions_table.c.idempotency_key == idempotency_key,
                    )
                ).first()
                if action is None or action.request_fingerprint != fingerprint:
                    return impl.error_response(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was already used for a different cleanup.")
                response_status = 200

        return jsonify(cleanup_action_dict(action)), response_status

    def list_my_cleanup_actions_reviewed():
        user = current_user()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        with engine.connect() as connection:
            actions = connection.execute(
                select(impl.cleanup_actions_table)
                .where(impl.cleanup_actions_table.c.participant_id == user.id)
                .order_by(impl.cleanup_actions_table.c.created_at.desc())
            ).all()
        return jsonify([cleanup_action_dict(action) for action in actions])

    def list_event_cleanups_reviewed(event_id: str):
        with engine.connect() as connection:
            event = connection.execute(select(impl.events_table.c.id).where(impl.events_table.c.id == event_id)).first()
            if event is None:
                return impl.error_response(404, "NOT_FOUND", "Event not found.")
            actions = connection.execute(
                select(impl.cleanup_actions_table)
                .where(impl.cleanup_actions_table.c.event_id == event_id)
                .order_by(impl.cleanup_actions_table.c.created_at)
            ).all()
        return jsonify([cleanup_action_dict(action) for action in actions])

    application.view_functions["get_beach"] = get_beach_with_active_composition
    application.view_functions["list_cleanup_targets"] = list_cleanup_targets_reviewed
    application.view_functions["create_cleanup_action"] = create_cleanup_action_reviewed
    application.view_functions["list_my_cleanup_actions"] = list_my_cleanup_actions_reviewed
    application.view_functions["list_event_cleanups"] = list_event_cleanups_reviewed
