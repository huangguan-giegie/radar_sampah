"""Small HTTP adapters for the Iteration 2 V3 frontend contract.

The reviewed main implementation remains the source of truth for validation,
cleanup state, photos, and scoring. This module only translates route names and
response shapes at the boundary.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from flask import g, jsonify, request
from sqlalchemy import Column, DateTime, Integer, String, Table, delete, insert, select
from sqlalchemy.exc import IntegrityError

from standalone_cleanup import _active_quantities, _current_band_state


def _response_parts(result: Any) -> tuple[Any, int]:
    if isinstance(result, tuple):
        return result[0], int(result[1])
    return result, int(getattr(result, "status_code", 200))


def _json(response: Any) -> Any:
    response, _status = _response_parts(response)
    return response.get_json(silent=True)


def _user(engine: Any, impl: Any, secret: str):
    header = request.headers.get("Authorization", "")
    token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
    user_id = impl.decode_token_subject(token, secret) if token else None
    if not user_id:
        return None
    with engine.connect() as connection:
        return connection.execute(select(impl.users_table).where(impl.users_table.c.id == user_id)).first()


def _required_user(engine: Any, impl: Any, secret: str):
    user = _user(engine, impl, secret)
    return user if user is not None else impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")


def _beach(engine: Any, impl: Any, beach_id: str) -> dict[str, Any] | None:
    return next((item for item in impl.load_beaches(engine) if item["id"] == beach_id), None)


def _event_payloads(engine: Any, impl: Any, events: list[Any], viewer_id: str | None, attendance_table: Any) -> list[dict[str, Any]]:
    if not events:
        return []
    event_ids = [event.id for event in events]
    with engine.connect() as connection:
        members = connection.execute(
            select(impl.event_members_table).where(impl.event_members_table.c.event_id.in_(event_ids)).order_by(impl.event_members_table.c.joined_at)
        ).all()
        confirmed = connection.execute(select(attendance_table.c.event_id, attendance_table.c.participant_id).where(attendance_table.c.event_id.in_(event_ids))).all()

    members_by_event: dict[str, list[Any]] = {}
    for member in members:
        members_by_event.setdefault(member.event_id, []).append(member)
    confirmed_by_event: dict[str, set[str]] = {}
    for row in confirmed:
        confirmed_by_event.setdefault(row.event_id, set()).add(row.participant_id)

    beaches = {item["id"]: item for item in impl.load_beaches(engine)}
    payloads = []
    for event in events:
        event_members = members_by_event.get(event.id, [])
        viewer_member = next((member for member in event_members if member.participant_id == viewer_id), None)
        local_start = impl.utc_datetime(event.starts_at).astimezone(impl.KUALA_LUMPUR)
        local_end = impl.utc_datetime(event.ends_at).astimezone(impl.KUALA_LUMPUR)
        beach = beaches.get(event.beach_id, {})
        payloads.append({
            "id": event.id,
            "beachId": event.beach_id,
            "beachName": beach.get("name", event.beach_id),
            "area": beach.get("area", event.beach_id),
            "date": local_start.date().isoformat(),
            "startsAt": local_start.strftime("%H:%M"),
            "endsAt": local_end.strftime("%H:%M"),
            "meetingPoint": getattr(event, "meeting_point", None),
            "status": event.status,
            "source": "weekly" if event.source == "scheduled" else "admin",
            "participantCount": len(event_members),
            "attendanceCount": len(confirmed_by_event.get(event.id, set())),
            "joined": bool(viewer_member),
            "checkedIn": bool(viewer_member and viewer_member.location_passed),
            "attendanceConfirmed": bool(viewer_member and viewer_member.participant_id in confirmed_by_event.get(event.id, set())),
        })
    return payloads


def _event_payload(engine: Any, impl: Any, event: Any, viewer_id: str | None, attendance_table: Any) -> dict[str, Any]:
    return _event_payloads(engine, impl, [event], viewer_id, attendance_table)[0]


def _event_by_id(engine: Any, impl: Any, event_id: str):
    with engine.connect() as connection:
        return connection.execute(select(impl.events_table).where(impl.events_table.c.id == event_id)).first()


def _read_map(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _action_payload(engine: Any, impl: Any, action: Any) -> dict[str, Any]:
    with engine.connect() as connection:
        participant = connection.execute(select(impl.users_table.c.participant_id).where(impl.users_table.c.id == action.participant_id)).scalar_one_or_none()
        beach_name = connection.execute(select(impl.beaches_table.c.name).where(impl.beaches_table.c.id == action.beach_id)).scalar_one_or_none()
    rows = []
    try:
        stored_rows = json.loads(action.rows or "[]")
    except (TypeError, ValueError):
        stored_rows = []
    for row in stored_rows if isinstance(stored_rows, list) else []:
        if "beforeBand" in row:
            rows.append(row)
        elif "before" in row and isinstance(row.get("before"), str):
            rows.append({
                "category": row.get("category"),
                "beforeBand": row.get("before"),
                "afterBand": row.get("after", row.get("before")),
                "score": row.get("removedUnits", 0),
            })
        else:
            rows.append({"category": row.get("category"), "score": row.get("removed", 0)})
    remaining = _read_map(getattr(action, "remaining_quantities", None)) if getattr(action, "remaining_quantities", None) is not None else None
    removed = _read_map(getattr(action, "removed_quantities", None)) if getattr(action, "removed_quantities", None) is not None else None
    score = getattr(action, "cleanup_score", None)
    if score is None:
        score = getattr(action, "total_removed", 0)
    return {
        "id": action.id,
        "participantId": participant or action.participant_id,
        "targetReportId": action.target_report_id,
        "eventId": action.event_id,
        "beachId": action.beach_id,
        "beachName": beach_name or action.beach_id,
        "createdAt": impl.contract_timestamp(action.created_at),
        "rows": rows,
        "score": score,
        "remainingQuantities": remaining,
        "remainingBands": remaining,
        "removedQuantities": removed,
        "resolved": bool(remaining is not None and not _active_quantities(remaining)),
        "handling": action.handling,
        "note": action.note or "",
        "status": "Cleanup recorded — awaiting follow-up",
    }


def _action(engine: Any, impl: Any, action_id: str):
    with engine.connect() as connection:
        return connection.execute(select(impl.cleanup_actions_table).where(impl.cleanup_actions_table.c.id == action_id)).first()


def _latest_action(engine: Any, impl: Any, *, target_id: str | None = None, beach_id: str | None = None):
    query = select(impl.cleanup_actions_table).order_by(impl.cleanup_actions_table.c.created_at.desc())
    if target_id is not None:
        query = query.where(impl.cleanup_actions_table.c.target_report_id == target_id)
    if beach_id is not None:
        query = query.where(impl.cleanup_actions_table.c.beach_id == beach_id)
    with engine.connect() as connection:
        return connection.execute(query).first()


def install_v3_contract(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    attendance = impl.i2_metadata.tables.get("community_event_attendance")
    if attendance is None:
        attendance = Table(
            "community_event_attendance", impl.i2_metadata,
            Column("event_id", String(100), primary_key=True),
            Column("participant_id", String(80), primary_key=True),
            Column("confirmed_at", DateTime(timezone=True), nullable=False),
            extend_existing=True,
        )
    impl.community_event_attendance_table = attendance
    attendance.create(engine, checkfirst=True)

    def events_v3():
        viewer = _user(engine, impl, jwt_secret)
        if request.args.get("joined") == "true" and viewer is None:
            return jsonify([])
        beach_id = request.args.get("beachId")
        if beach_id and _beach(engine, impl, beach_id) is None:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        now = datetime.now(timezone.utc)
        application.extensions["ensure_scheduled_events"](now)
        with engine.connect() as connection:
            query = select(impl.events_table).where(
                impl.events_table.c.status == "Open",
                impl.events_table.c.ends_at >= now,
            ).order_by(impl.events_table.c.starts_at, impl.events_table.c.id)
            if beach_id:
                query = query.where(impl.events_table.c.beach_id == beach_id)
            rows = connection.execute(query).all()
        # Automatic weekly slots are capped at four per beach. Moderator-created
        # activities remain visible as labelled extras.
        automatic = {}
        events = []
        for row in rows:
            if row.source == "scheduled":
                count = automatic.get(row.beach_id, 0)
                if count >= 4:
                    continue
                automatic[row.beach_id] = count + 1
            events.append(row)
        payloads = _event_payloads(engine, impl, events, viewer.id if viewer else None, attendance)
        result = [payload for payload in payloads if request.args.get("joined") != "true" or payload["joined"]]
        return jsonify(result)

    def event_v3(event_id: str):
        # Keep the scheduler and event-not-found behavior of the old route.
        old = application.view_functions["get_event"](event_id)
        _old_json, status = _response_parts(old)
        if status != 200:
            return old
        event = _event_by_id(engine, impl, event_id)
        viewer = _user(engine, impl, jwt_secret)
        return jsonify(_event_payload(engine, impl, event, viewer.id if viewer else None, attendance))

    def delegate_event(action_name: str, event_id: str):
        result = application.view_functions[action_name](event_id)
        _old_json, status = _response_parts(result)
        if status < 200 or status >= 300:
            return result
        event = _event_by_id(engine, impl, event_id)
        viewer = _required_user(engine, impl, jwt_secret)
        if not hasattr(viewer, "id"):
            return viewer
        return jsonify(_event_payload(engine, impl, event, viewer.id, attendance))

    def leave_v3(event_id: str):
        result = application.view_functions["leave_event"](event_id)
        _old_json, status = _response_parts(result)
        if status < 200 or status >= 300:
            return result
        user = _required_user(engine, impl, jwt_secret)
        if not hasattr(user, "id"):
            return user
        with engine.begin() as connection:
            connection.execute(delete(attendance).where(
                attendance.c.event_id == event_id,
                attendance.c.participant_id == user.id,
            ))
        event = _event_by_id(engine, impl, event_id)
        return jsonify(_event_payload(engine, impl, event, user.id, attendance))

    def check_in_v3(event_id: str):
        result = application.view_functions["check_in_event"](event_id)
        _old_json, status = _response_parts(result)
        if status < 200 or status >= 300:
            return result
        event = _event_by_id(engine, impl, event_id)
        viewer = _required_user(engine, impl, jwt_secret)
        if not hasattr(viewer, "id"):
            return viewer
        # A successful in-window check-in is the attendance action. The unique
        # key makes retries idempotent, and no report or cleanup evidence is
        # required for attendance.
        now = datetime.now(timezone.utc)
        if event.status == "Open" and impl.utc_datetime(event.starts_at) <= now <= impl.utc_datetime(event.ends_at):
            try:
                with engine.begin() as connection:
                    with connection.begin_nested():
                        connection.execute(insert(attendance).values(
                            event_id=event_id,
                            participant_id=viewer.id,
                            confirmed_at=now,
                        ))
            except IntegrityError:
                pass
        return jsonify(_event_payload(engine, impl, event, viewer.id, attendance))

    def confirm_attendance(event_id: str):
        user = _required_user(engine, impl, jwt_secret)
        if not hasattr(user, "id"):
            return user
        event = _event_by_id(engine, impl, event_id)
        if event is None:
            return impl.error_response(404, "NOT_FOUND", "Event not found.")
        now = datetime.now(timezone.utc)
        with engine.connect() as connection:
            member = connection.execute(select(impl.event_members_table).where(
                impl.event_members_table.c.event_id == event_id,
                impl.event_members_table.c.participant_id == user.id,
            )).first()
        if member is None or not member.location_passed:
            return impl.error_response(409, "EVENT_CHECKIN_REQUIRED", "Check in before confirming attendance.")
        if event.status != "Open" or not (impl.utc_datetime(event.starts_at) <= now <= impl.utc_datetime(event.ends_at)):
            return impl.error_response(409, "EVENT_NOT_ACTIVE", "Attendance can only be confirmed during the event.")
        try:
            with engine.begin() as connection:
                with connection.begin_nested():
                    connection.execute(insert(attendance).values(event_id=event_id, participant_id=user.id, confirmed_at=now))
        except IntegrityError:
            pass
        return jsonify(_event_payload(engine, impl, event, user.id, attendance))

    def link_report(event_id: str, report_id: str):
        user = _required_user(engine, impl, jwt_secret)
        if not hasattr(user, "id"):
            return user
        event = _event_by_id(engine, impl, event_id)
        if event is None:
            return impl.error_response(404, "NOT_FOUND", "Event not found.")
        now = datetime.now(timezone.utc)
        with engine.connect() as connection:
            member = connection.execute(select(impl.event_members_table).where(
                impl.event_members_table.c.event_id == event_id,
                impl.event_members_table.c.participant_id == user.id,
            )).first()
            report = connection.execute(select(impl.reports_table).where(impl.reports_table.c.id == report_id)).first()
        if member is None:
            return impl.error_response(409, "JOIN_REQUIRED", "Join and check in before linking evidence.")
        if not member.location_passed:
            return impl.error_response(409, "EVENT_CHECKIN_REQUIRED", "Check in before linking evidence.")
        if event.status != "Open" or not (impl.utc_datetime(event.starts_at) <= now <= impl.utc_datetime(event.ends_at)):
            return impl.error_response(409, "EVENT_NOT_ACTIVE", "Evidence can only be linked during the event.")
        if report is None or report.reporter_id != user.id:
            return impl.error_response(403, "REPORT_NOT_OWNED", "Only your own report can be linked.")
        if report.status != "Counted" or report.beach_id != event.beach_id:
            return impl.error_response(400, "VALIDATION_FAILED", "The report must be a Counted report from this beach.")
        if not (impl.utc_datetime(report.created_at) >= impl.utc_datetime(event.starts_at) and impl.utc_datetime(report.created_at) <= impl.utc_datetime(event.ends_at)):
            return impl.error_response(409, "REPORT_OUTSIDE_EVENT", "The report was not created during this event.")
        if report.event_id and report.event_id != event_id:
            return impl.error_response(409, "REPORT_ALREADY_LINKED", "The report is already linked to another event.")
        if not report.event_id:
            with engine.begin() as connection:
                connection.execute(impl.reports_table.update().where(impl.reports_table.c.id == report_id).values(event_id=event_id))
        return jsonify(_event_payload(engine, impl, event, user.id, attendance))

    def targets_v3(beach_id: str):
        if _beach(engine, impl, beach_id) is None:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        with engine.connect() as connection:
            reports = connection.execute(select(impl.reports_table).where(
                impl.reports_table.c.beach_id == beach_id,
                impl.reports_table.c.status == "Counted",
            ).order_by(impl.reports_table.c.created_at.desc(), impl.reports_table.c.id.desc())).all()
            for report in reports:
                actions = connection.execute(select(impl.cleanup_actions_table).where(
                    impl.cleanup_actions_table.c.target_report_id == report.id
                ).order_by(impl.cleanup_actions_table.c.created_at)).all()
                remaining = _current_band_state(impl, report, actions)
                if _active_quantities(remaining):
                    return jsonify({
                        "reportId": report.id, "beachId": report.beach_id,
                        "beachName": (_beach(engine, impl, beach_id) or {}).get("name", beach_id),
                        "reportedAt": impl.contract_timestamp(report.created_at),
                        "remainingBands": remaining,
                    })
        return jsonify(None)

    def create_cleanup_v3():
        viewer = _required_user(engine, impl, jwt_secret)
        if not hasattr(viewer, "id"):
            return viewer
        payload = request.get_json(silent=True)
        allowed = {"targetReportId", "eventId", "afterBands", "handling", "note", "idempotencyKey"}
        if not isinstance(payload, dict) or set(payload) - allowed or not {"targetReportId", "afterBands", "handling", "idempotencyKey"} <= set(payload):
            return impl.error_response(400, "VALIDATION_FAILED", "targetReportId, afterBands, handling and idempotencyKey are required.")
        key = payload.get("idempotencyKey")
        if not isinstance(key, str) or not key.strip() or len(key) > 128:
            return impl.error_response(400, "VALIDATION_FAILED", "idempotencyKey must be a non-empty string of at most 128 characters.")
        if not isinstance(payload.get("afterBands"), dict):
            return impl.error_response(400, "VALIDATION_FAILED", "afterBands must be a quantity-band map.")
        g.v3_cleanup_payload = {
            "targetReportId": payload.get("targetReportId"),
            "eventId": payload.get("eventId"),
            "remainingQuantities": payload.get("afterBands"),
            "handling": payload.get("handling"),
            "note": payload.get("note", ""),
            "idempotencyKey": key.strip(),
        }
        try:
            result = application.view_functions["create_cleanup_action"]()
        finally:
            if hasattr(g, "v3_cleanup_payload"):
                delattr(g, "v3_cleanup_payload")
        _old_json, status = _response_parts(result)
        data = _json(result)
        action = _action(engine, impl, data.get("id") if isinstance(data, dict) else "")
        return (jsonify(_action_payload(engine, impl, action)), status) if action is not None else result

    def read_cleanup(cleanup_id: str):
        action = _action(engine, impl, cleanup_id)
        return jsonify(_action_payload(engine, impl, action)) if action is not None else impl.error_response(404, "NOT_FOUND", "Cleanup not found.")

    def read_cleanup_target(report_id: str):
        action = _latest_action(engine, impl, target_id=report_id)
        return jsonify(_action_payload(engine, impl, action)) if action is not None else jsonify(None)

    def read_latest_cleanup(beach_id: str):
        if _beach(engine, impl, beach_id) is None:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        action = _latest_action(engine, impl, beach_id=beach_id)
        return jsonify(_action_payload(engine, impl, action)) if action is not None else jsonify(None)

    def read_event_cleanups(event_id: str):
        if _event_by_id(engine, impl, event_id) is None:
            return impl.error_response(404, "NOT_FOUND", "Event not found.")
        with engine.connect() as connection:
            actions = connection.execute(select(impl.cleanup_actions_table).where(
                impl.cleanup_actions_table.c.event_id == event_id
            ).order_by(impl.cleanup_actions_table.c.created_at)).all()
        payloads = []
        for action in actions:
            payload = _action_payload(engine, impl, action)
            # Event result pages show aggregate cleanup rows only. Participant
            # identity belongs to the authenticated user's own action view.
            payload.pop("participantId", None)
            payloads.append(payload)
        return jsonify(payloads)

    def create_event_v3():
        result = application.view_functions["create_moderator_event"]()
        data, status = _response_parts(result)
        payload = _json(result)
        event_id = payload.get("id") if isinstance(payload, dict) else None
        event = _event_by_id(engine, impl, event_id) if event_id else None
        user = _user(engine, impl, jwt_secret)
        return (jsonify(_event_payload(engine, impl, event, user.id if user else None, attendance)), status) if event is not None else result

    def gallery_v3(beach_id: str):
        view = application.view_functions.get("list_litter_gallery")
        if view is None:
            return impl.error_response(500, "GALLERY_UNAVAILABLE", "The litter gallery is unavailable.")
        result = view(beach_id)
        entries = _json(result)
        if not isinstance(entries, list):
            return result
        report_ids = [entry.get("reportId") for entry in entries if isinstance(entry, dict)]
        with engine.connect() as connection:
            reports = connection.execute(select(impl.reports_table).where(impl.reports_table.c.id.in_(report_ids))).all() if report_ids else []
        by_id = {report.id: report for report in reports}
        name = (_beach(engine, impl, beach_id) or {}).get("name", beach_id)
        enriched = []
        for entry in entries:
            report = by_id.get(entry.get("reportId"))
            if report is None:
                continue
            enriched.append({**entry, "beachName": name, "createdAt": entry.get("reportedAt"), "quantities": impl.quantities_from_row(report)})
        return jsonify(enriched)

    application.add_url_rule("/cleanup-events", "v3_list_events", events_v3, methods=["GET"])
    application.add_url_rule("/cleanup-events/<event_id>", "v3_get_event", event_v3, methods=["GET"])
    application.add_url_rule("/cleanup-events", "v3_create_event", create_event_v3, methods=["POST"])
    application.add_url_rule("/cleanup-events/<event_id>/join", "v3_join_event", lambda event_id: delegate_event("join_event", event_id), methods=["POST"])
    application.add_url_rule("/cleanup-events/<event_id>/join", "v3_leave_event", leave_v3, methods=["DELETE"])
    application.add_url_rule("/cleanup-events/<event_id>/check-in", "v3_check_in", check_in_v3, methods=["POST"])
    application.add_url_rule("/cleanup-events/<event_id>/attendance", "v3_attendance", confirm_attendance, methods=["POST"])
    application.add_url_rule("/cleanup-events/<event_id>/reports/<report_id>", "v3_link_report", link_report, methods=["POST"])
    application.add_url_rule("/cleanup-events/<event_id>/cleanups", "v3_event_cleanups", read_event_cleanups, methods=["GET"])
    application.add_url_rule("/cleanup-targets/<beach_id>", "v3_target", targets_v3, methods=["GET"])
    application.add_url_rule("/cleanups", "v3_create_cleanup", create_cleanup_v3, methods=["POST"])
    application.add_url_rule("/cleanups/<cleanup_id>", "v3_cleanup", read_cleanup, methods=["GET"])
    application.add_url_rule("/cleanups/by-target/<report_id>", "v3_target_cleanup", read_cleanup_target, methods=["GET"])
    application.add_url_rule("/beaches/<beach_id>/cleanups/latest", "v3_latest_cleanup", read_latest_cleanup, methods=["GET"])
    application.add_url_rule("/beaches/<beach_id>/gallery", "v3_gallery", gallery_v3, methods=["GET"])
