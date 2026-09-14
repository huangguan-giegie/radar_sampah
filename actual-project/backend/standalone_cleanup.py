from __future__ import annotations

from collections import defaultdict, deque
import hashlib
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from flask import jsonify, request
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError


def configure_cleanup_schema(impl: Any) -> None:
    """Allow new databases to store a cleanup without a report target."""
    impl.cleanup_actions_table.c.target_report_id.nullable = True


def install_cleanup_route(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Replace the target-only Iteration 2 cleanup route with an optional-target contract."""
    rate_events: defaultdict[str, deque[float]] = defaultdict(deque)

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
        return {
            "id": action.id,
            "participantId": participant or action.participant_id,
            "targetReportId": action.target_report_id,
            "eventId": action.event_id,
            "beachId": action.beach_id,
            "beachName": beach_name or action.beach_id,
            "createdAt": impl.contract_timestamp(action.created_at),
            "rows": json.loads(action.rows),
            "score": action.total_removed,
            "handling": action.handling,
            "note": action.note or "",
            "status": "Cleanup recorded — awaiting follow-up",
        }

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
        required = {"handling"}
        allowed = required | {
            "targetReportId",
            "beachId",
            "removed",
            "removedCounts",
            "eventId",
            "note",
            "idempotencyKey",
        }
        if (
            not isinstance(payload, dict)
            or not required <= set(payload)
            or set(payload) - allowed
            or ("removed" in payload) == ("removedCounts" in payload)
        ):
            return impl.error_response(
                400,
                "VALIDATION_FAILED",
                "removed and handling are required; targetReportId is optional when beachId is supplied.",
            )

        target_report_id = str(payload.get("targetReportId") or "").strip() or None
        requested_beach_id = str(payload.get("beachId") or "").strip() or None
        if target_report_id is None and requested_beach_id is None:
            return impl.error_response(400, "VALIDATION_FAILED", "beachId is required when targetReportId is omitted.")

        handling = payload.get("handling")
        removed_counts = impl.validate_item_counts(payload.get("removed", payload.get("removedCounts")))
        note = payload.get("note")
        event_id = payload.get("eventId")
        idempotency_key = str(
            payload.get("idempotencyKey")
            or request.headers.get("Idempotency-Key")
            or secrets.token_urlsafe(24)
        ).strip()

        if not removed_counts:
            return impl.error_response(400, "VALIDATION_FAILED", "removedCounts must contain positive whole-item counts.")
        if handling not in impl.EVENT_HANDLING_VALUES:
            return impl.error_response(400, "VALIDATION_FAILED", "handling is not a supported value.")
        if note is not None and (not isinstance(note, str) or len(note) > 500):
            return impl.error_response(400, "VALIDATION_FAILED", "note must be 500 characters or fewer.")
        if event_id is not None and (not isinstance(event_id, str) or not event_id.strip() or len(event_id) > 100):
            return impl.error_response(400, "VALIDATION_FAILED", "eventId must be a valid event identifier.")
        if len(idempotency_key) > 128:
            return impl.error_response(400, "VALIDATION_FAILED", "idempotencyKey must be at most 128 characters.")

        fingerprint_value = {
            "targetReportId": target_report_id or "",
            "removedCounts": dict(sorted(removed_counts.items())),
            "handling": handling,
            "note": note,
            "eventId": event_id,
        }
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
                    return impl.error_response(
                        409,
                        "IDEMPOTENCY_CONFLICT",
                        "This idempotency key was already used for a different cleanup.",
                    )
                return jsonify(cleanup_action_dict(existing)), 200

            target = None
            if target_report_id is not None:
                target = connection.execute(
                    select(impl.reports_table)
                    .where(impl.reports_table.c.id == target_report_id)
                    .with_for_update()
                ).first()
                if target is None or target.status != "Counted" or not target.item_counts:
                    return impl.error_response(
                        404,
                        "CLEANUP_TARGET_NOT_FOUND",
                        "The cleanup target is no longer available.",
                    )
                beach_id = target.beach_id
                if requested_beach_id is not None and requested_beach_id != beach_id:
                    return impl.error_response(
                        400,
                        "VALIDATION_FAILED",
                        "beachId must match the cleanup target beach.",
                    )
                prior_actions = connection.execute(
                    select(impl.cleanup_actions_table).where(
                        impl.cleanup_actions_table.c.target_report_id == target_report_id
                    )
                ).all()
                remaining = impl.remaining_counts_for(target, prior_actions)
                if not remaining:
                    return impl.error_response(
                        409,
                        "CLEANUP_TARGET_COMPLETE",
                        "This cleanup target has already been fully cleared.",
                    )
                if any(
                    category not in remaining or count > remaining[category]
                    for category, count in removed_counts.items()
                ):
                    return impl.error_response(
                        409,
                        "REMOVED_COUNT_EXCEEDS_REMAINING",
                        "Removed counts cannot exceed the target's remaining item counts.",
                    )
                rows = [
                    {
                        "category": category,
                        "removed": removed_counts[category],
                        "before": remaining[category],
                        "after": remaining[category] - removed_counts[category],
                    }
                    for category in impl.FRONTEND_CATEGORIES
                    if removed_counts.get(category, 0) > 0
                ]
            else:
                beach_id = requested_beach_id
                beach = connection.execute(
                    select(impl.beaches_table.c.id).where(impl.beaches_table.c.id == beach_id)
                ).first()
                if beach is None:
                    return impl.error_response(404, "NOT_FOUND", "Beach not found.")
                rows = [
                    {
                        "category": category,
                        "removed": removed_counts[category],
                        "before": None,
                        "after": None,
                    }
                    for category in impl.FRONTEND_CATEGORIES
                    if removed_counts.get(category, 0) > 0
                ]

            if event_id is not None:
                event = connection.execute(
                    select(impl.events_table).where(impl.events_table.c.id == event_id)
                ).first()
                member = connection.execute(
                    select(impl.event_members_table).where(
                        impl.event_members_table.c.event_id == event_id,
                        impl.event_members_table.c.participant_id == user.id,
                    )
                ).first()
                now = datetime.now(timezone.utc)
                if event is None or event.beach_id != beach_id:
                    return impl.error_response(
                        400,
                        "VALIDATION_FAILED",
                        "eventId must refer to an event at the cleanup beach.",
                    )
                if member is None or not member.location_passed:
                    return impl.error_response(
                        409,
                        "EVENT_CHECKIN_REQUIRED",
                        "Join and check in to the event before linking this cleanup.",
                    )
                if event.status != "Open" or not (
                    impl.utc_datetime(event.starts_at) <= now <= impl.utc_datetime(event.ends_at)
                ):
                    return impl.error_response(
                        409,
                        "EVENT_NOT_ACTIVE",
                        "An event-linked cleanup must be recorded during the event.",
                    )

            now = datetime.now(timezone.utc)
            action_id = "c_" + secrets.token_hex(10)
            try:
                with connection.begin_nested():
                    connection.execute(
                        insert(impl.cleanup_actions_table).values(
                            id=action_id,
                            target_report_id=target_report_id,
                            participant_id=user.id,
                            event_id=event_id,
                            beach_id=beach_id,
                            removed_counts=json.dumps(removed_counts, separators=(",", ":")),
                            rows=json.dumps(rows, separators=(",", ":")),
                            total_removed=sum(removed_counts.values()),
                            handling=handling,
                            note=note,
                            idempotency_key=idempotency_key,
                            request_fingerprint=fingerprint,
                            created_at=now,
                        )
                    )
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
                    return impl.error_response(
                        409,
                        "IDEMPOTENCY_CONFLICT",
                        "This idempotency key was already used for a different cleanup.",
                    )
                response_status = 200

        return jsonify(cleanup_action_dict(action)), response_status

    application.view_functions["create_cleanup_action"] = create_cleanup_action_reviewed
