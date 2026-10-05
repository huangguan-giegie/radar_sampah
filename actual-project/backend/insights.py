"""Public, privacy-safe Iteration 3 beach insights from recorded evidence."""

from __future__ import annotations

from collections import Counter, defaultdict
from calendar import monthrange
from datetime import datetime, timedelta, timezone
import json
import re
from statistics import median
from typing import Any

from flask import jsonify
from sqlalchemy import select

from standalone_cleanup import _active_quantities, _current_band_state


MVP_BEACH_IDS = ("morib", "remis", "kelanang", "bagan")
MIN_REPORTS = 3
WINDOW_DAYS = 90
COMPARISON_DAYS = 30
MIN_PUBLIC_COUNT = 3
MIN_CLEANUPS = 3
RECENT_CLEANUP_LIMIT = 10
INSUFFICIENT_COMPARISON = "Insufficient data to compare"
NO_CLEANUPS = "Not enough cleanups recorded yet."
NO_HEADLINES = "Not enough recent reports to generate insights yet."
FRESHNESS_LABELS = {"ok": "Recently reported", "stale": "Not recently reported"}


def public_count(count: int) -> int | str:
    return count if count >= MIN_PUBLIC_COUNT else "Fewer than 3"


def _date(impl: Any, value: datetime | None) -> str | None:
    return impl.utc_datetime(value).astimezone(impl.KUALA_LUMPUR).date().isoformat() if value is not None else None


def _months_before(value: datetime, months: int) -> datetime:
    index = value.year * 12 + value.month - 1 - months
    year, month = index // 12, index % 12 + 1
    return value.replace(year=year, month=month, day=min(value.day, monthrange(year, month)[1]))


def _records(engine: Any, impl: Any, now: datetime):
    from contributions import recorded_attendance_query

    with engine.connect() as connection:
        reports = connection.execute(select(impl.reports_table).where(
            impl.reports_table.c.beach_id.in_(MVP_BEACH_IDS),
            impl.reports_table.c.created_at <= now,
            impl.reports_table.c.deleted_at.is_(None),
        )).all()
        cleanups = connection.execute(select(impl.cleanup_actions_table).where(
            impl.cleanup_actions_table.c.beach_id.in_(MVP_BEACH_IDS),
            impl.cleanup_actions_table.c.created_at <= now,
        ).order_by(impl.cleanup_actions_table.c.created_at, impl.cleanup_actions_table.c.id)).all()
        events = connection.execute(select(impl.events_table).where(
            impl.events_table.c.beach_id.in_(MVP_BEACH_IDS),
        ).order_by(impl.events_table.c.starts_at, impl.events_table.c.id)).all()
        members = connection.execute(select(impl.event_members_table).where(
            impl.event_members_table.c.event_id.in_([event.id for event in events]),
            impl.event_members_table.c.joined_at <= now,
        )).all() if events else []
        recorded_attendance = set(connection.execute(recorded_attendance_query(impl, now)).all())
    return reports, cleanups, events, members, recorded_attendance


def attention_as_of(impl: Any, beach_id: str, reports: list[Any], cleanups: list[Any], end: datetime) -> dict[str, Any]:
    """Reuse the canonical scoring and cleanup state with a historical cutoff."""
    end = impl.utc_datetime(end)
    by_report: dict[str, list[Any]] = defaultdict(list)
    for action in cleanups:
        if action.target_report_id and impl.utc_datetime(action.created_at) <= end:
            by_report[action.target_report_id].append(action)
    active = []
    for report in reports:
        if (report.beach_id != beach_id or report.status != "Counted"
                or getattr(report, "deleted_at", None) is not None
                or not end - timedelta(days=WINDOW_DAYS) <= impl.utc_datetime(report.created_at) <= end):
            continue
        quantities = _active_quantities(_current_band_state(impl, report, by_report[report.id]))
        if quantities:
            active.append((report, quantities))
    score = float(median(impl.report_score_for(quantities) for _, quantities in active)) if len(active) >= MIN_REPORTS else None
    severity, band = impl.severity_from_score(score)
    latest = max((impl.utc_datetime(report.created_at) for report, _ in active), default=None)
    age = end - latest if latest else None
    freshness = "stale" if age is None else "ok" if age < timedelta(days=30) else "aging" if age <= timedelta(days=90) else "stale"
    return {
        "severity": severity, "band": band,
        "attentionScore": round(score, 2) if score is not None else None,
        "eligibleReportCount": len(active),
        "latestContributingReportAt": impl.contract_timestamp(latest) if latest else None,
        "freshnessKind": freshness, "activeRows": active,
    }


def _leading_categories(impl: Any, active: list[Any]) -> list[str]:
    totals: Counter[str] = Counter()
    for _, quantities in active:
        totals.update(impl.category_scores_for(quantities))
    maximum = max(totals.values(), default=0)
    return [category for category in impl.FRONTEND_CATEGORIES if maximum > 0 and abs(totals[category] - maximum) < 1e-9]


def _volunteer_context(impl: Any, beach: dict[str, Any], context: dict[str, Any], cleanups: list[Any], events: list[Any], members: list[Any], now: datetime):
    candidates = [event for event in events if event.beach_id == beach["id"] and event.status == "Open" and impl.utc_datetime(event.ends_at) >= now]
    upcoming = min(candidates, key=lambda event: (impl.utc_datetime(event.starts_at), event.id), default=None)
    joined = sum(member.event_id == upcoming.id for member in members) if upcoming else 0
    recent = any(action.beach_id == beach["id"] and impl.utc_datetime(action.created_at) >= now - timedelta(days=30) for action in cleanups)
    reasons = []
    if context["severity"] in {"Moderate", "High", "Severe"}:
        if not recent:
            reasons.append("no_recent_cleanup")
        if joined < MIN_PUBLIC_COUNT:
            reasons.append("low_sign_up")
    return {
        "flag": bool(reasons), "reasons": reasons,
        "nextEventId": upcoming.id if upcoming else None,
        "nextEventJoinedCount": public_count(joined),
        "href": f"/events/{upcoming.id}" if upcoming else f"/beach/{beach['id']}",
        "message": "Needs volunteers" if reasons else None,
        "eventMessage": None if upcoming else "No upcoming event scheduled",
    }


def _monthly_reports(impl: Any, reports: list[Any], now: datetime):
    local = now.astimezone(impl.KUALA_LUMPUR)
    month_index = local.year * 12 + local.month - 1
    months = [f"{index // 12:04d}-{index % 12 + 1:02d}" for index in range(month_index - 11, month_index + 1)]
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    for report in reports:
        if report.status == "Counted":
            month = impl.utc_datetime(report.created_at).astimezone(impl.KUALA_LUMPUR).strftime("%Y-%m")
            counts[report.beach_id][month] += 1
    return {
        "months": months, "timezone": "Asia/Kuala_Lumpur",
        "beaches": [{"beachId": beach_id, "counts": [counts[beach_id][month] for month in months]} for beach_id in MVP_BEACH_IDS],
        "caption": "Report counts reflect reporting activity, not the true amount of litter. Zero means no reports, not zero litter.",
    }


def _cleanup_context(impl: Any, reports: list[Any], cleanups: list[Any], beach_names: dict[str, str], now: datetime):
    from recurrence import calculate_recurrence

    by_id = {report.id: report for report in reports}
    earlier: dict[str, list[Any]] = defaultdict(list)
    rows = []
    included: Counter[str] = Counter()
    remaining: Counter[str] = Counter()
    handling = Counter({"Collected for disposal": 0, "Recycled / handled": 0, "Not recorded": 0})
    follow_up = {row["cleanupId"]: row["calloutStatus"] for row in calculate_recurrence(cleanups, reports, now)}
    for action in cleanups:
        status = action.handling if action.handling in handling else "Not recorded"
        handling[status] += 1
        report = by_id.get(action.target_report_id)
        if report is None or report.beach_id != action.beach_id:
            continue
        before = _current_band_state(impl, report, earlier[report.id])
        after = _current_band_state(impl, report, [*earlier[report.id], action])
        try:
            stored_rows = json.loads(action.rows or "[]")
        except (TypeError, ValueError):
            stored_rows = []
        for row in stored_rows if isinstance(stored_rows, list) else []:
            category = row.get("category") if isinstance(row, dict) else None
            if category not in impl.FRONTEND_CATEGORIES:
                continue
            recorded_before = row.get("beforeBand", row.get("before"))
            recorded_after = row.get("afterBand", row.get("after"))
            if recorded_before in impl.QUANTITY_WEIGHTS:
                before[category] = recorded_before
            if recorded_after in impl.QUANTITY_WEIGHTS:
                after[category] = recorded_after
        for category, band in before.items():
            if band != "Small":
                included[category] += 1
                remaining[category] += int(after.get(category, "Small") != "Small")
        score = getattr(action, "cleanup_score", None)
        if score is None:
            score = getattr(action, "total_removed", None)
        resolved = not _active_quantities(after)
        rows.append({
            "beachId": action.beach_id, "beachName": beach_names[action.beach_id],
            "date": _date(impl, action.created_at),
            "categories": [{"category": category, "beforeBand": before.get(category, "Small"), "afterBand": after.get(category, "Small")} for category in impl.FRONTEND_CATEGORIES if category in before or category in after],
            "beforeBands": before, "afterBands": after, "cleanupScore": score,
            "handling": status, "status": "Resolved — source report kept in history" if resolved else follow_up.get(action.id, "Cleanup recorded — awaiting follow-up"),
        })
        earlier[report.id].append(action)
    ranked = [
        {"category": category, "includedCleanups": count, "remainingCleanups": remaining[category], "percentage": round(remaining[category] * 100 / count, 2)}
        for category, count in included.items() if count >= MIN_CLEANUPS
    ]
    ranked.sort(key=lambda row: (-row["percentage"], row["category"]))
    total = len(cleanups)
    return {
        "recent": list(reversed(rows))[:RECENT_CLEANUP_LIMIT],
        "emptyState": None if rows else NO_CLEANUPS,
        "hardestToClear": {"eligible": bool(ranked), "categories": ranked[:3], "emptyState": None if ranked else NO_CLEANUPS},
        "handling": {
            "eligible": total >= MIN_CLEANUPS,
            "statuses": [{"status": status, "count": count, "percentage": round(count * 100 / total, 2)} for status, count in handling.items()] if total >= MIN_CLEANUPS else [],
            "label": "Participant-recorded handling; this does not verify disposal or recycling.",
            "emptyState": None if total >= MIN_CLEANUPS else NO_CLEANUPS,
        },
    }


def _participation(impl: Any, cleanups: list[Any], events: list[Any], members: list[Any], recorded_attendance: set[Any], now: datetime):
    occurred = {event.id: event for event in events if now - timedelta(days=WINDOW_DAYS) <= impl.utc_datetime(event.starts_at) <= now}
    cleanup_events = {action.event_id for action in cleanups if action.event_id in occurred}
    counts = {beach_id: [0, 0, 0] for beach_id in MVP_BEACH_IDS}
    for member in members:
        event = occurred.get(member.event_id)
        if event is None:
            continue
        counts[event.beach_id][0] += 1
        attended = (member.event_id, member.participant_id) in recorded_attendance
        counts[event.beach_id][1] += int(attended)
        counts[event.beach_id][2] += int(attended and event.id in cleanup_events)
    overall = [sum(values[index] for values in counts.values()) for index in range(3)]
    labels = ("Joined participants", "Recorded attendances", "Recorded attendances at events whose cleanup was recorded")
    keys = ("joined", "recordedAttendance", "attendedCleanup")
    steps = []
    for index, key in enumerate(keys):
        per_beach = None
        if all(values[index] >= MIN_PUBLIC_COUNT for values in counts.values()):
            per_beach = [{"beachId": beach_id, "count": values[index]} for beach_id, values in counts.items()]
        steps.append({"key": key, "label": labels[index], "count": public_count(overall[index]), "beaches": per_beach})
    conversions = []
    for index in (0, 1):
        eligible = overall[index] >= MIN_PUBLIC_COUNT and overall[index + 1] >= MIN_PUBLIC_COUNT
        per_beach = None
        if steps[index]["beaches"] is not None and steps[index + 1]["beaches"] is not None:
            per_beach = [{"beachId": beach_id, "percentage": round(values[index + 1] * 100 / values[index], 2)} for beach_id, values in counts.items()]
        conversions.append({"from": keys[index], "to": keys[index + 1], "percentage": round(overall[index + 1] * 100 / overall[index], 2) if eligible else None, "beaches": per_beach})
    beach_conversions = None
    if all(step["beaches"] is not None for step in steps):
        beach_conversions = [{"beachId": beach_id, "percentages": [round(values[index + 1] * 100 / values[index], 2) for index in (0, 1)]} for beach_id, values in counts.items()]
    return {
        "windowDays": WINDOW_DAYS, "steps": steps, "conversions": conversions, "beachConversions": beach_conversions,
        "caption": "Recorded attendance means a coarse location match at Check-in; it does not prove cleanup work was completed.",
    }


def _recurrence(reports: list[Any], cleanups: list[Any], now: datetime):
    from recurrence import calculate_recurrence, summarize_beach_recurrence

    allowed = {"beachId", "cleanupAt", "cleanupDate", "followUpAt", "followUpDate", "intervalDays", "daysSinceCleanup", "status", "calloutStatus", "intervalCount", "medianDays", "provisional", "medianLabel", "evidenceNote"}
    rows = []
    records = calculate_recurrence(cleanups, reports, now)
    for beach_id in MVP_BEACH_IDS:
        row = summarize_beach_recurrence(records, beach_id)
        if row is not None:
            rows.append({key: value for key, value in row.items() if key in allowed})
    return {"beaches": rows, "emptyState": None if rows else NO_CLEANUPS}


def _headlines(beaches: list[dict[str, Any]], cleanup: dict[str, Any]):
    candidates = []
    for beach in beaches:
        trend = beach["trend"]
        if trend["eligible"] and trend["direction"] in {"up", "down"}:
            priority = 0 if trend["direction"] == "up" else 4
            candidates.append((priority, -(beach["band"] or 0), beach["name"], {
                "type": "band_change", "beachId": beach["id"], "beachName": beach["name"], "eligible": True,
                "direction": trend["direction"], "previousBand": trend["previousBand"], "currentBand": trend["currentBand"],
                "text": f"{beach['name']}'s recorded Beach Attention changed from {trend['previousBand']} to {trend['currentBand']} compared with 30 days ago.",
                "href": f"/insights/trends/{beach['id']}",
            }))
        if beach["needsVolunteers"]["flag"]:
            candidates.append((1, -(beach["band"] or 0), beach["name"], {
                "type": "needs_volunteers", "beachId": beach["id"], "beachName": beach["name"], "eligible": True,
                "text": f"{beach['name']} needs volunteers based on recorded cleanup and event activity.", "href": beach["needsVolunteers"]["href"],
            }))
        if beach["eligibleReportCount"] >= MIN_REPORTS and beach["leadingCategories"]:
            categories = " and ".join(beach["leadingCategories"])
            candidates.append((2, -(beach["band"] or 0), beach["name"], {
                "type": "composition", "beachId": beach["id"], "beachName": beach["name"], "eligible": True,
                "categories": beach["leadingCategories"],
                "text": f"{categories} has the largest share of weighted reported composition at {beach['name']}.", "href": f"/insights/trends/{beach['id']}",
            }))
    if cleanup["recent"]:
        row = cleanup["recent"][0]
        candidates.append((3, 0, row["beachName"], {
            "type": "cleanup_outcome", "beachId": row["beachId"], "beachName": row["beachName"], "eligible": True,
            "text": f"The latest recorded cleanup at {row['beachName']} has before and after quantity bands available.", "href": "/insights/cleanup",
        }))
    return [candidate[3] for candidate in sorted(candidates, key=lambda candidate: candidate[:3])[:4]]


def grounded_trend_insights(beaches: list[dict[str, Any]], *, enabled: bool = False, service: Any = None):
    facts = [{
        "beachId": beach["id"], "beachName": beach["name"], "metric": "Beach Attention band",
        "comparisonPeriod": "3 months ago", "currentBand": beach["advancedComparison"]["currentBand"],
        "previousBand": beach["advancedComparison"]["previousBand"], "direction": beach["advancedComparison"]["direction"],
    } for beach in beaches if beach["advancedComparison"]["eligible"] and beach["advancedComparison"]["direction"] in {"up", "down"}]
    result = {"enabled": enabled, "mode": "template", "sourceAggregates": facts, "explanations": [], "fallbackState": "disabled"}
    if not enabled:
        return result
    result["fallbackState"] = "insufficient_data" if not any(beach["advancedComparison"]["eligible"] for beach in beaches) else "no_meaningful_change" if not facts else "service_unavailable"
    if not facts or not callable(service):
        return result
    try:
        explanations = service(facts)
        if not isinstance(explanations, list) or len(explanations) != len(facts):
            raise ValueError("Invalid explanation response")
        for fact, explanation in zip(facts, explanations):
            if not isinstance(explanation, dict) or set(explanation) != {"beachId", "text"} or explanation["beachId"] != fact["beachId"]:
                raise ValueError("Invalid explanation facts")
            text = explanation["text"]
            verbs = "increased|rose" if fact["direction"] == "up" else "decreased|fell"
            pattern = (
                r"(?:Based on recorded reports, )?" + re.escape(fact["beachName"])
                + r"'s (?:recorded )?Beach Attention band (?:" + verbs + r") from "
                + re.escape(fact["previousBand"]) + r" to " + re.escape(fact["currentBand"])
                + r" compared with 3 months ago\.?"
            )
            # Accept only reviewed fact-preserving phrasing. A failed rephrase
            # cannot introduce an unrecorded cause, inverted change or claim.
            if not isinstance(text, str) or re.fullmatch(pattern, text, re.I) is None:
                raise ValueError("Unsupported explanation")
        result.update(mode="ai", explanations=explanations, fallbackState=None)
    except Exception:
        result["fallbackState"] = "validation_or_service_failure"
    return result


def build_insights_summary(engine: Any, impl: Any, now: datetime | None = None) -> dict[str, Any]:
    now = impl.utc_datetime(now or datetime.now(timezone.utc))
    beach_map = {beach["id"]: beach for beach in impl.load_beaches(engine) if beach["id"] in MVP_BEACH_IDS}
    reports, cleanups, events, members, recorded_attendance = _records(engine, impl, now)
    beaches = []
    evidence_rows = []
    for beach_id in MVP_BEACH_IDS:
        beach = beach_map[beach_id]
        current = attention_as_of(impl, beach_id, reports, cleanups, now)
        previous = attention_as_of(impl, beach_id, reports, cleanups, now - timedelta(days=COMPARISON_DAYS))
        baseline = attention_as_of(impl, beach_id, reports, cleanups, _months_before(now.astimezone(impl.KUALA_LUMPUR), 3))
        eligible = current["band"] is not None and previous["band"] is not None
        direction = "up" if eligible and current["band"] > previous["band"] else "down" if eligible and current["band"] < previous["band"] else "unchanged" if eligible else None
        active = current.pop("activeRows")
        previous.pop("activeRows")
        statuses = {"countedActive": 0, "countedResolved": 0, "duplicate": 0, "incomplete": 0}
        active_ids = {report.id for report, _ in active}
        for report in reports:
            if report.beach_id != beach_id or impl.utc_datetime(report.created_at) < now - timedelta(days=WINDOW_DAYS):
                continue
            status = "countedActive" if report.id in active_ids else "countedResolved" if report.status == "Counted" else report.status.lower()
            if status in statuses:
                statuses[status] += 1
        latest = max((impl.utc_datetime(report.created_at) for report, _ in active), default=None)
        freshness_label = FRESHNESS_LABELS.get(current["freshnessKind"], f"Reported {(now.astimezone(impl.KUALA_LUMPUR).date() - latest.astimezone(impl.KUALA_LUMPUR).date()).days} days ago" if latest else "Not recently reported")
        evidence = {"sufficiency": "Sufficient data" if current["band"] is not None else "Insufficient data", "freshnessKind": current["freshnessKind"], "freshnessLabel": freshness_label}
        advanced_eligible = current["band"] is not None and baseline["band"] is not None
        advanced_direction = "up" if advanced_eligible and current["band"] > baseline["band"] else "down" if advanced_eligible and current["band"] < baseline["band"] else "unchanged" if advanced_eligible else None
        item = {
            "id": beach_id, "name": beach["name"], "beachId": beach_id, "beachName": beach["name"], "area": beach["area"], **current,
            "trend": {"eligible": eligible, "currentBand": current["severity"], "previousBand": previous["severity"], "currentScore": current["attentionScore"], "previousScore": previous["attentionScore"], "currentReportCount": current["eligibleReportCount"], "previousReportCount": previous["eligibleReportCount"], "direction": direction, "previousAsOf": _date(impl, now - timedelta(days=COMPARISON_DAYS)), "message": None if eligible else INSUFFICIENT_COMPARISON},
            "composition": impl.active_composition_percentages(active) if active else [],
            "leadingCategories": _leading_categories(impl, active),
            "advancedComparison": {"eligible": advanced_eligible, "currentBand": current["severity"], "previousBand": baseline["severity"], "direction": advanced_direction, "baselineAsOf": _date(impl, _months_before(now.astimezone(impl.KUALA_LUMPUR), 3))},
            "evidence": evidence,
            "needsVolunteers": _volunteer_context(impl, beach, current, cleanups, events, members, now),
        }
        beaches.append(item)
        evidence_rows.append({"beachId": beach_id, "beachName": beach["name"], "statuses": statuses, "eligibleReportCount": current["eligibleReportCount"], "latestContributingReportAt": current["latestContributingReportAt"], **evidence})
    cleanup = _cleanup_context(impl, reports, cleanups, {key: value["name"] for key, value in beach_map.items()}, now)
    cleanup["recurrence"] = _recurrence(reports, cleanups, now)
    participation = _participation(impl, cleanups, events, members, recorded_attendance, now)
    sufficient = sum(beach["band"] is not None for beach in beaches)
    headlines = _headlines(beaches, cleanup)
    return {
        "asOf": _date(impl, now), "timezone": "Asia/Kuala_Lumpur",
        "scope": {"beachIds": list(MVP_BEACH_IDS), "beachCount": len(MVP_BEACH_IDS), "windowDays": WINDOW_DAYS, "minimumReports": MIN_REPORTS},
        "overview": {"countedReports": sum(report.status == "Counted" and impl.utc_datetime(report.created_at) >= now - timedelta(days=WINDOW_DAYS) for report in reports), "recordedCleanups": sum(impl.utc_datetime(action.created_at) >= now - timedelta(days=WINDOW_DAYS) for action in cleanups), "joinedParticipants": participation["steps"][0]["count"], "sufficientBeaches": sufficient, "needsVolunteers": sum(beach["needsVolunteers"]["flag"] for beach in beaches)},
        "headlines": headlines, "headlinesEmptyState": None if headlines else NO_HEADLINES,
        "beaches": beaches,
        "trends": {"beaches": beaches, "monthlyReports": _monthly_reports(impl, reports, now), "groundedInsights": grounded_trend_insights(beaches)},
        "cleanup": cleanup, "participation": participation,
        "evidence": {"windowDays": WINDOW_DAYS, "countedNote": "Counted is community evidence accepted for calculation, not expert verification.", "sufficientBeachCount": sufficient, "beaches": evidence_rows},
    }


def install_insights(application: Any, engine: Any, impl: Any) -> None:
    """Install read-only public summary and topic views without personal fields."""
    application.extensions["build_insights_summary"] = lambda now=None: build_insights_summary(engine, impl, now)

    def payload():
        now = datetime.now(timezone.utc)
        scheduler = application.extensions.get("ensure_scheduled_events")
        if scheduler is not None:
            scheduler(now)
        data = build_insights_summary(engine, impl, now)
        data["trends"]["groundedInsights"] = grounded_trend_insights(data["beaches"], enabled=bool(application.config.get("ADVANCED_INSIGHTS_ENABLED", False)), service=application.extensions.get("insights_explanation_service"))
        biodiversity = application.extensions.get("insights_wildlife")
        if biodiversity is not None:
            data["wildlife"] = biodiversity()
        return data

    def summary():
        return jsonify(payload())

    def topic(topic_name: str):
        data = payload()
        return jsonify({"asOf": data["asOf"], "timezone": data["timezone"], **data[topic_name]})

    application.add_url_rule("/insights/summary", "insights_summary", summary, methods=["GET"])
    for topic_name in ("trends", "cleanup", "participation", "evidence"):
        application.add_url_rule(f"/insights/{topic_name}", f"insights_{topic_name}", lambda topic_name=topic_name: topic(topic_name), methods=["GET"])
