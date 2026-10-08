"""Public, deterministic summaries of saved reports and cleanup evidence.

Reference content is context, never a sighting, forecast or measured impact.
No synthetic activity is inserted and no participant identity is returned.
"""
from __future__ import annotations

import json
import math
import os
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any

from flask import jsonify, request
from sqlalchemy import func, select

from standalone_cleanup import BAND_UNITS, _active_quantities, _current_band_state


def _month_start(value: datetime, offset: int = 0) -> datetime:
    ordinal = value.year * 12 + value.month - 1 + offset
    return value.replace(year=ordinal // 12, month=ordinal % 12 + 1, day=1,
                         hour=0, minute=0, second=0, microsecond=0)


def _map(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _percentages(weighted: dict[str, float], order: list[str]) -> list[list[Any]]:
    rows = [(key, weighted[key]) for key in order if weighted.get(key, 0) > 0]
    total = sum(value for _, value in rows)
    if not total:
        return []
    exact = [(key, value * 100 / total) for key, value in rows]
    whole = {key: math.floor(value) for key, value in exact}
    for key, _ in sorted(exact, key=lambda row: row[1] - math.floor(row[1]), reverse=True)[:100 - sum(whole.values())]:
        whole[key] += 1
    return [[key, whole[key]] for key, _ in rows]


def build_insights(engine: Any, impl: Any, *, now: datetime | None = None,
                   beach_id: str | None = None) -> dict[str, Any]:
    current = impl.utc_datetime(now or datetime.now(timezone.utc))
    local = current.astimezone(impl.KUALA_LUMPUR)
    cutoff = current - timedelta(days=90)
    previous = current - timedelta(days=30)
    beaches = [b for b in impl.load_beaches(engine) if not beach_id or b["id"] == beach_id]
    beach_ids = [b["id"] for b in beaches]
    with engine.connect() as connection:
        reports = connection.execute(select(impl.reports_table).where(
            impl.reports_table.c.beach_id.in_(beach_ids),
            impl.reports_table.c.created_at <= current,
        ).order_by(impl.reports_table.c.created_at, impl.reports_table.c.id)).all()
        actions = connection.execute(select(impl.cleanup_actions_table).where(
            impl.cleanup_actions_table.c.beach_id.in_(beach_ids),
            impl.cleanup_actions_table.c.created_at <= current,
        ).order_by(impl.cleanup_actions_table.c.created_at, impl.cleanup_actions_table.c.id)).all()
        events = connection.execute(select(impl.events_table).where(
            impl.events_table.c.beach_id.in_(beach_ids),
            impl.events_table.c.starts_at >= cutoff,
            impl.events_table.c.starts_at <= current,
        )).all()
        event_ids = [event.id for event in events]
        members = connection.execute(select(impl.event_members_table).where(
            impl.event_members_table.c.event_id.in_(event_ids),
            impl.event_members_table.c.joined_at <= current,
        )).all() if event_ids else []
        attendance_table = getattr(impl, "community_event_attendance_table", None)
        attendance = connection.execute(select(attendance_table).where(
            attendance_table.c.event_id.in_(event_ids),
            attendance_table.c.confirmed_at <= current,
        )).all() if event_ids and attendance_table is not None else []
        upcoming_events = connection.execute(select(impl.events_table).where(
            impl.events_table.c.beach_id.in_(beach_ids),
            impl.events_table.c.status == "Open",
            impl.events_table.c.ends_at > current,
        ).order_by(impl.events_table.c.starts_at, impl.events_table.c.id)).all()
        upcoming_ids = [event.id for event in upcoming_events]
        upcoming_joined = dict(connection.execute(select(
            impl.event_members_table.c.event_id, func.count(),
        ).where(impl.event_members_table.c.event_id.in_(upcoming_ids))
            .group_by(impl.event_members_table.c.event_id)).all()) if upcoming_ids else {}

    # Current stored status/value is authoritative. The database does not retain
    # historical edit versions, so prior bands are explicitly reconstructions.
    report_by_id = {r.id: r for r in reports}
    reports = [r for r in reports if r.status == "Counted" and getattr(r, "deleted_at", None) is None]
    reports_by_beach: dict[str, list[Any]] = defaultdict(list)
    actions_by_report: dict[str, list[Any]] = defaultdict(list)
    for report in reports:
        reports_by_beach[report.beach_id].append(report)
    for action in actions:
        if action.target_report_id:
            actions_by_report[action.target_report_id].append(action)
    next_event_joined = {}
    for event in upcoming_events:
        next_event_joined.setdefault(event.beach_id, upcoming_joined.get(event.id, 0))
    latest_cleanup = {}
    for action in actions:
        latest_cleanup[action.beach_id] = impl.utc_datetime(action.created_at)

    def active_rows(rows: list[Any], at: datetime) -> list[tuple[Any, dict[str, str]]]:
        result = []
        for report in rows:
            if not at - timedelta(days=90) <= impl.utc_datetime(report.created_at) <= at:
                continue
            saved_actions = [a for a in actions_by_report[report.id] if impl.utc_datetime(a.created_at) <= at]
            quantities = _active_quantities(_current_band_state(impl, report, saved_actions))
            if quantities:
                result.append((report, quantities))
        return result

    def band_for(rows: list[tuple[Any, dict[str, str]]]) -> tuple[str | None, float | None]:
        score = float(median(impl.report_score_for(q) for _, q in rows)) if len(rows) >= 3 else None
        return impl.severity_from_score(score)[0], score

    beach_rows = []
    categories = list(impl.FRONTEND_CATEGORIES)
    months = [_month_start(local, index - 11) for index in range(12)]
    for beach in beaches:
        saved = reports_by_beach[beach["id"]]
        active = active_rows(saved, current)
        old_active = active_rows(saved, previous)
        current_band, score = band_for(active)
        past_band, _ = band_for(old_active)
        # Same H15 rule as frontend/volunteerNeeds.ts: rated beaches need help
        # if no cleanup exists in 30 days, or the next available event has fewer
        # than three current members. Missing events are not treated as zero.
        last_cleanup = latest_cleanup.get(beach["id"])
        next_joined = next_event_joined.get(beach["id"])
        needs_help = current_band in {"Moderate", "High", "Severe"} and (
            last_cleanup is None or current - last_cleanup >= timedelta(days=30)
            or (next_joined is not None and next_joined < 3)
        )
        weights: dict[str, float] = defaultdict(float)
        for _, quantities in active:
            for category, band in quantities.items():
                weights[category] += impl.CATEGORY_WEIGHTS[category] * BAND_UNITS[band]
        recent = [r for r in saved if impl.utc_datetime(r.created_at) >= cutoff]
        prior_30 = [r for r in saved if previous - timedelta(days=30) <= impl.utc_datetime(r.created_at) < previous]
        latest_30 = [r for r in saved if impl.utc_datetime(r.created_at) >= previous]
        monthly = []
        for start in months:
            end = _month_start(start, 1)
            monthly.append({"month": start.strftime("%Y-%m"), "label": start.strftime("%b"),
                            "count": sum(start <= impl.utc_datetime(r.created_at).astimezone(impl.KUALA_LUMPUR) < end for r in saved)})
        beach_rows.append({
            "id": beach["id"], "name": beach["name"], "area": beach["area"],
            "photo": beach.get("coverImageUrl"), "from": past_band, "to": current_band,
            "activeReports": len(active), "reports": len(recent),
            "reportsLast30Days": len(latest_30), "reportsPrevious30Days": len(prior_30),
            "attentionScore": round(score, 2) if score is not None else None,
            "needsHelp": needs_help,
            "monthlyReports": monthly, "composition": _percentages(weights, categories),
            "habitat": beach.get("habitat") or "Reference context not available",
            "species": beach.get("species", []),
            "speciesNames": beach.get("speciesNames") or [s.get("name") for s in beach.get("species", []) if s.get("name")],
        })

    recent_actions = [a for a in actions if impl.utc_datetime(a.created_at) >= cutoff]
    beach_names = {b["id"]: b["name"] for b in beaches}
    history = []
    remainder_totals: dict[str, int] = defaultdict(int)
    remainder_present: dict[str, int] = defaultdict(int)
    evaluated = 0
    handling: dict[str, float] = defaultdict(float)
    for action in recent_actions:
        handling[action.handling] += 1
        target = report_by_id.get(action.target_report_id)
        preceding = [a for a in actions_by_report.get(action.target_report_id, [])
                     if (impl.utc_datetime(a.created_at), a.id) < (impl.utc_datetime(action.created_at), action.id)]
        before = _current_band_state(impl, target, preceding) if target is not None else {}
        after = _current_band_state(impl, target, [*preceding, action]) if target is not None else None
        # A cleanup's immutable rows are stronger evidence of its before-state
        # than a report that may have been edited after the cleanup. Canonical
        # actions also retain a complete after-state, including unchanged rows.
        try:
            saved_rows = json.loads(action.rows or "[]")
        except (TypeError, ValueError):
            saved_rows = []
        saved_bands = [row for row in saved_rows if isinstance(row, dict)
                       and row.get("category") in categories
                       and (row.get("beforeBand") or row.get("before")) in BAND_UNITS] if isinstance(saved_rows, list) else []
        if saved_bands and after is not None:
            before = dict(after)
            for row in saved_bands:
                before[row["category"]] = row.get("beforeBand") or row["before"]
        rows = []
        if after is not None:
            evaluated += 1
            for category in categories:
                if category not in before:
                    continue
                after_band = after.get(category, "Small")
                rows.append({"category": category, "beforeBand": before[category], "afterBand": after_band})
                if before[category] != "Small":
                    remainder_totals[category] += 1
                    remainder_present[category] += int(after_band != "Small")
        else:
            removed = _map(getattr(action, "removed_quantities", None))
            rows = [{"category": category, "removedBand": band} for category, band in removed.items()]
        following = next((r for r in reports_by_beach[action.beach_id]
                          if impl.utc_datetime(r.created_at) > impl.utc_datetime(action.created_at)), None)
        elapsed = ((impl.utc_datetime(following.created_at) if following else current) - impl.utc_datetime(action.created_at)).total_seconds() / 86400
        history.append({
            "id": action.id, "beachId": action.beach_id, "beachName": beach_names.get(action.beach_id, action.beach_id),
            "targetReportId": action.target_report_id, "eventId": action.event_id,
            "createdAt": impl.contract_timestamp(action.created_at), "handling": action.handling,
            "rows": rows, "linked": action.target_report_id is not None,
            "nextReportedAt": impl.contract_timestamp(following.created_at) if following else None,
            "daysUntilNextReport": round(elapsed, 1) if following else None,
            "daysSinceCleanup": round(elapsed, 1) if following is None else None,
        })
    history.reverse()
    remaining = [[c, round(remainder_present[c] * 100 / remainder_totals[c]), remainder_totals[c]]
                 for c in categories if remainder_totals[c]]
    remaining.sort(key=lambda row: -row[1])

    event_to_beach = {e.id: e.beach_id for e in events}
    joined = {(m.event_id, m.participant_id) for m in members}
    attended = {(a.event_id, a.participant_id) for a in attendance}
    cleaned = {(a.event_id, a.participant_id) for a in recent_actions if a.event_id in event_to_beach}
    participation = {}
    for key in ["all", *beach_ids]:
        includes = lambda pair: key == "all" or event_to_beach.get(pair[0]) == key
        participation[key] = [sum(includes(p) for p in group) for group in (joined, attended, cleaned)]
    rank = {"Low": 1, "Moderate": 2, "High": 3, "Severe": 4}
    comparable = [b for b in beach_rows if b["from"] is not None and b["to"] is not None]
    moved_up = sum(rank[b["to"]] > rank[b["from"]] for b in comparable)
    moved_down = sum(rank[b["to"]] < rank[b["from"]] for b in comparable)
    return {
        "asOf": impl.contract_timestamp(current), "windowDays": 90,
        "comparisonAt": impl.contract_timestamp(previous),
        "comparisonBasis": "Earlier bands are reconstructed from saved reports and dated cleanup records. Later report corrections or review changes can alter this comparison.",
        "overview": {"reports": sum(b["reports"] for b in beach_rows), "cleanups": len(recent_actions),
                     "joined": len(joined), "needHelp": sum(b["needsHelp"] for b in beach_rows),
                     "registeredBeaches": len(beach_rows), "beachesWithReports": sum(b["activeReports"] > 0 for b in beach_rows),
                     "beachesWithBand": sum(b["to"] is not None for b in beach_rows)},
        "trendSummary": {"changed": moved_up + moved_down, "movedUp": moved_up, "movedDown": moved_down,
                         "noBand": sum(b["to"] is None for b in beach_rows), "comparable": len(comparable)},
        "beaches": beach_rows,
        "cleanup": {"total": len(recent_actions), "evaluatedCleanups": evaluated, "remaining": remaining,
                    "handling": _percentages(handling, ["Collected for disposal", "Recycled / handled", "Not recorded"]),
                    "history": history},
        "participation": participation,
        "participationBasis": "Person-event records for events that started in the last 90 days. Joining reflects current memberships; attendance and cleanup are recorded actions. Steps are independent counts, not a conversion rate.",
        "wildlife": [{"beachId": b["id"], "name": b["name"], "habitat": b["habitat"],
                      "species": b["speciesNames"], "activeReports": b["activeReports"],
                      "composition": b["composition"]} for b in beach_rows if b["speciesNames"]],
    }


def install_insights(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    cache_lock = threading.Lock()
    cached_results: dict[str | None, tuple[float, dict[str, Any]]] = {}
    try:
        cache_ttl = max(5.0, float(os.getenv("INSIGHTS_CACHE_TTL_SECONDS", "60")))
    except ValueError:
        cache_ttl = 60.0
    cache_enabled = not application.testing

    def invalidate_cache() -> None:
        with cache_lock:
            cached_results.clear()

    def read_cached(beach_id: str | None, current: datetime) -> dict[str, Any]:
        if not cache_enabled:
            scheduler = application.extensions.get("ensure_scheduled_events")
            if scheduler is not None:
                scheduler(current)
            return build_insights(engine, impl, now=current, beach_id=beach_id)
        now = time.monotonic()
        with cache_lock:
            cached = cached_results.get(beach_id)
            if cached is not None and now - cached[0] < cache_ttl:
                return cached[1]
            # Keep the lock while building the snapshot so concurrent page
            # loads share one expensive cross-region database calculation.
            scheduler = application.extensions.get("ensure_scheduled_events")
            if scheduler is not None:
                scheduler(current)
            result = build_insights(engine, impl, now=current, beach_id=beach_id)
            cached_results[beach_id] = (time.monotonic(), result)
            return result

    def prewarm() -> None:
        read_cached(None, datetime.now(timezone.utc))

    application.extensions["invalidate_insights_cache"] = invalidate_cache
    application.extensions["prewarm_insights"] = prewarm

    @application.after_request
    def clear_insights_after_write(response: Any):
        if request.method not in {"GET", "HEAD", "OPTIONS"} and response.status_code < 400:
            invalidate_cache()
        return response

    @application.get("/insights")
    def insights_summary():
        beach_id = request.args.get("beachId")
        if beach_id is not None and not any(b["id"] == beach_id for b in impl.load_beaches(engine)):
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")
        current = datetime.now(timezone.utc)
        # Community reads create eligible weekly slots lazily. The shared
        # snapshot keeps that scheduler and the Insights query off the hot path
        # for repeated mobile navigations.
        response = jsonify(read_cached(beach_id, current))
        response.headers["Cache-Control"] = "no-store"
        return response
