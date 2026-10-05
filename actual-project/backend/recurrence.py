"""Beach-level follow-up evidence from recorded cleanups and Counted reports."""

from __future__ import annotations

from bisect import bisect_right
from collections import defaultdict
from datetime import datetime, timezone
from statistics import median
from typing import Any
from zoneinfo import ZoneInfo

from flask import jsonify
from sqlalchemy import select


MALAYSIA = ZoneInfo("Asia/Kuala_Lumpur")
MIN_INTERVALS = 3
AWAITING = "No follow-up report yet"
SUPERSEDED = "No follow-up report before the next cleanup"
CALLOUT = "Cleanup recorded — awaiting follow-up"
EVIDENCE_NOTE = "Based only on available Counted reports; this is reporting evidence, not a prediction of when litter returned."


def _value(row: Any, name: str, default: Any = None) -> Any:
    return row.get(name, default) if isinstance(row, dict) else getattr(row, name, default)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _stamp(value: datetime) -> str:
    return _utc(value).astimezone(MALAYSIA).isoformat()


def _day(value: datetime):
    return _utc(value).astimezone(MALAYSIA).date()


def calculate_recurrence(
    cleanups: list[Any], reports: list[Any], now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Give each cleanup its first later report, bounded by the next cleanup."""
    current = _utc(now or datetime.now(timezone.utc))
    actions: dict[str, list[Any]] = defaultdict(list)
    observations: dict[str, list[datetime]] = defaultdict(list)
    for action in cleanups:
        if _utc(_value(action, "created_at")) <= current:
            actions[_value(action, "beach_id")].append(action)
    for report in reports:
        if _value(report, "status") != "Counted" or _value(report, "deleted_at") is not None:
            continue
        submitted = _utc(_value(report, "created_at"))
        if submitted <= current:
            observations[_value(report, "beach_id")].append(submitted)
    results = []
    for beach_id, beach_actions in actions.items():
        beach_actions.sort(key=lambda row: (_utc(_value(row, "created_at")), _value(row, "id")))
        timestamps = sorted(observations[beach_id])
        for index, action in enumerate(beach_actions):
            recorded = _utc(_value(action, "created_at"))
            next_cleanup = _utc(_value(beach_actions[index + 1], "created_at")) if index + 1 < len(beach_actions) else None
            position = bisect_right(timestamps, recorded)
            follow_up = timestamps[position] if position < len(timestamps) else None
            if follow_up is not None and next_cleanup is not None and follow_up >= next_cleanup:
                follow_up = None
            days = (_day(follow_up) - _day(recorded)).days if follow_up is not None else None
            status = f"{days} days until next Counted report" if days is not None else (SUPERSEDED if next_cleanup else AWAITING)
            results.append({
                "cleanupId": _value(action, "id"),
                "eventId": _value(action, "event_id"),
                "beachId": beach_id,
                "cleanupAt": _stamp(recorded),
                "cleanupDate": _day(recorded).isoformat(),
                "followUpAt": _stamp(follow_up) if follow_up is not None else None,
                "followUpDate": _day(follow_up).isoformat() if follow_up is not None else None,
                "intervalDays": days,
                "daysSinceCleanup": max(0, (_day(current) - _day(recorded)).days),
                "status": status,
                "calloutStatus": status if days is not None or next_cleanup else CALLOUT,
            })
    return sorted(results, key=lambda row: (row["cleanupAt"], row["cleanupId"]))


def recurrence_records(engine: Any, impl: Any, now: datetime | None = None) -> list[dict[str, Any]]:
    """Read current eligible records without the active-report age cutoff."""
    current = _utc(now or datetime.now(timezone.utc))
    with engine.connect() as connection:
        cleanups = connection.execute(select(impl.cleanup_actions_table).where(
            impl.cleanup_actions_table.c.created_at <= current,
        )).all()
        reports = connection.execute(select(
            impl.reports_table.c.beach_id, impl.reports_table.c.created_at,
            impl.reports_table.c.status, impl.reports_table.c.deleted_at,
        ).where(
            impl.reports_table.c.status == "Counted",
            impl.reports_table.c.deleted_at.is_(None),
            impl.reports_table.c.created_at <= current,
        )).all()
    return calculate_recurrence(cleanups, reports, current)


def summarize_beach_recurrence(records: list[dict[str, Any]], beach_id: str) -> dict[str, Any] | None:
    rows = [row for row in records if row["beachId"] == beach_id]
    if not rows:
        return None
    latest = max(rows, key=lambda row: (row["cleanupAt"], row["cleanupId"]))
    intervals = [row["intervalDays"] for row in rows if row["intervalDays"] is not None]
    sufficient = len(intervals) >= MIN_INTERVALS
    return {
        **latest,
        "intervalCount": len(intervals),
        "medianDays": median(intervals) if sufficient else None,
        "provisional": sufficient,
        "medianLabel": "Provisional median recurrence interval" if sufficient else None,
        "evidenceNote": EVIDENCE_NOTE,
    }


def beach_recurrence(engine: Any, impl: Any, beach_id: str, now: datetime | None = None) -> dict[str, Any] | None:
    return summarize_beach_recurrence(recurrence_records(engine, impl, now), beach_id)


def install_recurrence(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Add recurrence reads and update existing cleanup/result response wording."""
    del jwt_secret
    if application.extensions.get("iteration3_recurrence_installed"):
        return
    application.extensions["iteration3_recurrence_installed"] = True

    def get_recurrence(beach_id: str):
        with engine.connect() as connection:
            found = connection.execute(select(impl.beaches_table.c.id).where(impl.beaches_table.c.id == beach_id)).first()
        if found is None:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        return jsonify(beach_recurrence(engine, impl, beach_id))

    application.add_url_rule("/beaches/<beach_id>/recurrence", "get_beach_recurrence", get_recurrence, methods=["GET"])

    def decorate_response(original: Any, kind: str):
        def decorated(*args: Any, **kwargs: Any):
            response = application.make_response(original(*args, **kwargs))
            payload = response.get_json(silent=True)
            if response.status_code >= 400 or payload is None:
                return response
            records = recurrence_records(engine, impl)
            by_id = {row["cleanupId"]: row for row in records}
            if kind == "beach" and isinstance(payload, dict):
                value = summarize_beach_recurrence(records, payload.get("id", ""))
                if value is not None:
                    payload["recurrence"] = value
                    payload["cleanupStatus"] = value["calloutStatus"]
            else:
                entries = payload if isinstance(payload, list) else [payload]
                for entry in entries:
                    if not isinstance(entry, dict):
                        continue
                    recurrence = by_id.get(entry.get("id"))
                    if recurrence is not None:
                        entry["recurrence"] = recurrence
                        entry["status"] = recurrence["status"]
                        if entry.get("resolved"):
                            entry["resolutionStatus"] = "Resolved — source report kept in history"
                if kind == "event" and isinstance(payload, list) and payload:
                    latest = max((row for row in payload if row.get("recurrence")), key=lambda row: (row["recurrence"]["cleanupAt"], row["id"]), default=None)
                    if latest is not None:
                        for row in payload:
                            row["eventFollowUpStatus"] = latest["recurrence"]["status"]
            response.set_data(impl.json.dumps(payload, separators=(",", ":")))
            return response
        return decorated

    endpoints = {
        "get_beach": "beach",
        "create_cleanup_action": "cleanup", "list_my_cleanup_actions": "cleanup",
        "list_event_cleanups": "event", "v3_create_cleanup": "cleanup",
        "v3_cleanup": "cleanup", "v3_target_cleanup": "cleanup",
        "v3_latest_cleanup": "cleanup", "v3_event_cleanups": "event",
    }
    for endpoint, kind in endpoints.items():
        original = application.view_functions.get(endpoint)
        if original is not None:
            application.view_functions[endpoint] = decorate_response(original, kind)
