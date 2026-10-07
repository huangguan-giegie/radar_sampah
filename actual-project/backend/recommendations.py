"""Private, deterministic next actions and personal aggregate insights."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import jsonify, request
from sqlalchemy import Column, DateTime, Float, Integer, MetaData, String, Table, Text, delete, insert, select

from standalone_cleanup import _current_band_state
from v3_contract import _user
from wildlife import MVP_BEACHES, conservation_cards, risk_entries


aggregate_metadata = MetaData()
user_litter_aggregate_table = Table(
    "user_litter_aggregate", aggregate_metadata,
    Column("user_id", String(80), primary_key=True),
    Column("beach_id", String(80), primary_key=True),
    Column("category", String(40), primary_key=True),
    Column("report_count", Integer, nullable=False),
    Column("band_counts", Text, nullable=False),
    Column("weighted_score", Float, nullable=False),
    Column("report_ids", Text, nullable=False),
    Column("cleanup_ids", Text, nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

REASONS = {
    "CHECK_IN": ("Check in", "Your joined cleanup event is in progress."),
    "VIEW_JOINED_EVENT": ("View joined event", "Your joined cleanup event starts within seven days."),
    "SUBMIT_FOLLOW_UP": ("Submit follow-up report", "Your recorded cleanup has no follow-up report yet."),
    "JOIN_NEEDS_VOLUNTEERS": ("Join a cleanup", "Recorded beach attention and cleanup activity indicate a need for volunteers."),
    "LEARN_MARINE_LIFE": ("Learn about marine life", "Approved species cards explain general conservation context; they are not confirmed sightings."),
    "REPORT_LITTER": ("Report litter", "A litter report can add community evidence for a supported beach."),
    "GUEST": ("Find a beach cleanup", "Explore available beach cleanup events."),
}


def _records(engine: Any, impl: Any, user_id: str, connection: Any = None):
    if connection is None:
        with engine.connect() as current_connection:
            return _records(engine, impl, user_id, current_connection)
    reports = connection.execute(select(impl.reports_table).where(
            impl.reports_table.c.reporter_id == user_id,
            impl.reports_table.c.status == "Counted",
            impl.reports_table.c.deleted_at.is_(None),
    )).all()
    cleanups = connection.execute(select(impl.cleanup_actions_table).where(
            impl.cleanup_actions_table.c.participant_id == user_id,
    )).all()
    return reports, cleanups


def refresh_user_aggregate(engine: Any, impl: Any, user_id: str, now: datetime | None = None) -> list[dict[str, Any]]:
    """Rebuild the owner's rows from Counted source evidence, including resolved history."""
    current_time = now or datetime.now(timezone.utc)
    with engine.begin() as connection:
        connection.execute(select(impl.users_table.c.id).where(impl.users_table.c.id == user_id).with_for_update()).first()
        connection.execute(delete(user_litter_aggregate_table).where(user_litter_aggregate_table.c.user_id == user_id))
        reports, cleanups = _records(engine, impl, user_id, connection)
        by_category: dict[tuple[str, str], dict[str, Any]] = {}
        cleanup_ids: defaultdict[str, list[str]] = defaultdict(list)
        for action in cleanups:
            if action.target_report_id:
                cleanup_ids[action.target_report_id].append(action.id)
        for report in reports:
            for category, band in impl.quantities_from_row(report).items():
                if category not in impl.CATEGORY_WEIGHTS or band not in impl.QUANTITY_WEIGHTS:
                    continue
                row = by_category.setdefault((report.beach_id, category), {
                    "beachId": report.beach_id, "category": category, "reportCount": 0,
                    "bandCounts": {key: 0 for key in impl.QUANTITY_WEIGHTS}, "weightedScore": 0.0,
                    "reportIds": [], "cleanupIds": [],
                })
                row["reportCount"] += 1
                row["bandCounts"][band] += 1
                row["weightedScore"] += impl.CATEGORY_WEIGHTS[category] * impl.QUANTITY_WEIGHTS[band]
                row["reportIds"].append(report.id)
                row["cleanupIds"].extend(cleanup_ids[report.id])
        rows = sorted(by_category.values(), key=lambda item: (item["beachId"], item["category"]))
        if rows:
            connection.execute(insert(user_litter_aggregate_table), [{
                "user_id": user_id, "beach_id": row["beachId"], "category": row["category"],
                "report_count": row["reportCount"], "band_counts": json.dumps(row["bandCounts"]),
                "weighted_score": row["weightedScore"], "report_ids": json.dumps(row["reportIds"]),
                "cleanup_ids": json.dumps(sorted(set(row["cleanupIds"]))), "updated_at": current_time,
            } for row in rows])
    return rows


def _card(code: str, destination: dict[str, Any], facts: dict[str, Any]) -> dict[str, Any]:
    label, reason = REASONS[code]
    identity = hashlib.sha256((code + json.dumps(destination, sort_keys=True)).encode()).hexdigest()[:24]
    return {"id": identity, "actionLabel": label, "reasonCode": code, "reason": reason,
            "destination": destination, "sourceContext": facts, "fallback": True,
            "aiAssisted": False, "dismissible": True}


def _recurrence(engine: Any, impl: Any, now: datetime):
    from recurrence import recurrence_records
    return recurrence_records(engine, impl, now)


def next_action(engine: Any, impl: Any, user_id: str | None, now: datetime | None = None) -> dict[str, Any]:
    current_time = now or datetime.now(timezone.utc)
    if user_id is None:
        return _card("GUEST", {"type": "event_list", "path": "/community"}, {"guest": True}) | {
            "loginPrompt": "Log in for a personal next step", "loginPath": "/identity?next=/home",
        }
    beaches = {beach["id"]: beach for beach in impl.load_beaches(engine) if beach["id"] in MVP_BEACHES}
    with engine.connect() as connection:
        events = connection.execute(select(impl.events_table).where(
            impl.events_table.c.beach_id.in_(beaches), impl.events_table.c.status == "Open",
        )).all()
        members = connection.execute(select(impl.event_members_table)).all()
        all_cleanups = connection.execute(select(impl.cleanup_actions_table).where(impl.cleanup_actions_table.c.beach_id.in_(beaches))).all()
    events = sorted(events, key=lambda event: (impl.utc_datetime(event.starts_at), event.id))
    own_members = {member.event_id: member for member in members if member.participant_id == user_id}
    for event in events:
        member = own_members.get(event.id)
        if member and not member.location_passed and impl.utc_datetime(event.starts_at) <= current_time < impl.utc_datetime(event.ends_at):
            return _card("CHECK_IN", {"type": "check_in", "id": event.id, "path": f"/events/{event.id}/check-in"}, {
                "beachName": beaches[event.beach_id]["name"], "eventInProgress": True,
            })
    for event in events:
        if event.id in own_members and current_time < impl.utc_datetime(event.starts_at) <= current_time + timedelta(days=7):
            return _card("VIEW_JOINED_EVENT", {"type": "event", "id": event.id, "path": f"/events/{event.id}"}, {
                "beachName": beaches[event.beach_id]["name"], "startsAt": impl.utc_datetime(event.starts_at).isoformat(),
            })
    owned = {action.id for action in all_cleanups if action.participant_id == user_id}
    for record in sorted(_recurrence(engine, impl, current_time), key=lambda item: item["cleanupAt"], reverse=True):
        if record["cleanupId"] in owned and record["status"] == "No follow-up report yet" and record["beachId"] in beaches:
            return _card("SUBMIT_FOLLOW_UP", {"type": "report", "beachId": record["beachId"], "path": "/report/photo?beach=" + record["beachId"]}, {
                "beachName": beaches[record["beachId"]]["name"], "followUpStatus": "No follow-up report yet",
            })
    summaries = impl.beach_summaries_batch(engine, list(beaches.values()), current_time)
    ranked = sorted(summaries, key=lambda item: (-{"Severe": 4, "High": 3, "Moderate": 2}.get(item["severity"], 0), item["name"]))
    for beach in ranked:
        if beach["severity"] not in {"Moderate", "High", "Severe"}:
            continue
        upcoming = next((event for event in events if event.beach_id == beach["id"] and impl.utc_datetime(event.ends_at) > current_time), None)
        recent = any(action.beach_id == beach["id"] and current_time - timedelta(days=30) <= impl.utc_datetime(action.created_at) <= current_time for action in all_cleanups)
        joined = sum(member.event_id == upcoming.id for member in members) if upcoming else 0
        if upcoming and upcoming.id not in own_members and (not recent or joined < 3):
            return _card("JOIN_NEEDS_VOLUNTEERS", {"type": "event", "id": upcoming.id, "path": f"/events/{upcoming.id}"}, {
                "beachName": beach["name"], "attentionBand": beach["severity"],
                "noRecentCleanup": not recent, "joinedCount": joined if joined >= 3 else "Fewer than 3",
            })
    cards = conservation_cards(engine, impl)
    if cards:
        return _card("LEARN_MARINE_LIFE", {"type": "species_cards", "path": "/marine-life"}, {"approvedSpeciesCardsAvailable": True})
    return _card("REPORT_LITTER", {"type": "report", "path": "/report/photo"}, {"supportedBeachesAvailable": bool(beaches)})


def _cleanup_bands(action: Any, impl: Any) -> list[dict[str, str]]:
    try:
        rows = json.loads(action.rows or "[]")
    except (TypeError, ValueError):
        return []
    return [{"category": row["category"], "beforeBand": row.get("beforeBand", row.get("before")),
             "afterBand": row.get("afterBand", row.get("after"))}
            for row in rows if isinstance(row, dict) and row.get("category") in impl.CATEGORY_WEIGHTS
            and row.get("beforeBand", row.get("before")) in impl.QUANTITY_WEIGHTS
            and row.get("afterBand", row.get("after")) in impl.QUANTITY_WEIGHTS]


def _personal_cleanup_bands(engine: Any, impl: Any, cleanups: list[Any]) -> list[list[dict[str, str]]]:
    """Include unchanged categories and earlier actions by other participants."""
    target_ids = {action.target_report_id for action in cleanups if action.target_report_id}
    if not target_ids:
        return [_cleanup_bands(action, impl) for action in cleanups]
    with engine.connect() as connection:
        sources = connection.execute(select(impl.reports_table).where(impl.reports_table.c.id.in_(target_ids))).all()
        history = connection.execute(select(impl.cleanup_actions_table).where(impl.cleanup_actions_table.c.target_report_id.in_(target_ids))).all()
    reports = {report.id: report for report in sources}
    history.sort(key=lambda action: (impl.utc_datetime(action.created_at), action.id))
    previous: defaultdict[str, list[Any]] = defaultdict(list)
    owned = {action.id for action in cleanups}
    results = [_cleanup_bands(action, impl) for action in cleanups if not action.target_report_id]
    for action in history:
        source = reports.get(action.target_report_id)
        if source is None:
            continue
        before = _current_band_state(impl, source, previous[source.id])
        after = _current_band_state(impl, source, [*previous[source.id], action])
        for row in _cleanup_bands(action, impl):
            before[row["category"]] = row["beforeBand"]
            after[row["category"]] = row["afterBand"]
        if action.id in owned:
            results.append([{"category": category, "beforeBand": band, "afterBand": after.get(category, "Small")}
                            for category, band in before.items()])
        previous[source.id].append(action)
    return results


def personal_insights(engine: Any, impl: Any, user_id: str, now: datetime | None = None) -> dict[str, Any]:
    current_time = now or datetime.now(timezone.utc)
    aggregate = refresh_user_aggregate(engine, impl, user_id, current_time)
    _reports, cleanups = _records(engine, impl, user_id)
    risks = {entry["category"]: entry for entry in risk_entries()}
    totals: defaultdict[str, float] = defaultdict(float)
    report_counts: defaultdict[str, int] = defaultdict(int)
    for row in aggregate:
        totals[row["category"]] += row["weightedScore"]
        report_counts[row["category"]] += row["reportCount"]
    sections = []
    matching = sorted((category for category in totals if category in risks), key=lambda category: (-totals[category], category))
    if matching:
        category = matching[0]
        risk = risks[category]
        sections.append({
            "id": "litter_wildlife", "title": "Your litter and wildlife",
            "text": f"{category} is your largest weighted reported category with approved context and may affect {', '.join(risk['speciesGroups']).lower()} through {risk['riskType'].lower()}. General literature does not establish harm at this beach.",
            "facts": {"category": category, "reportCount": report_counts[category], "riskType": risk["riskType"], "speciesGroups": risk["speciesGroups"]},
            "sources": [risk["source"]], "reviewDate": risk["reviewDate"],
            "action": {"label": "Explore marine life", "path": "/marine-life"}, "aiAssisted": False,
        })
    owned = {action.id for action in cleanups}
    own_intervals = [row for row in _recurrence(engine, impl, current_time) if row["cleanupId"] in owned]
    if own_intervals:
        record = max(own_intervals, key=lambda row: row["cleanupAt"])
        beach = next((item for item in impl.load_beaches(engine) if item["id"] == record["beachId"]), None)
        if beach:
            days = record["intervalDays"]
            text = (f"A Counted report followed your cleanup at {beach['name']} after {days} calendar days. This describes community reporting only."
                    if days is not None else f"Your cleanup at {beach['name']}: {record['status']}. Missing follow-up is not evidence of beach condition.")
            sections.append({
                "id": "since_cleanup", "title": "Since your cleanup", "text": text,
                "facts": {"beachId": record["beachId"], "beachName": beach["name"], "intervalDays": days,
                          "daysSinceCleanup": record["daysSinceCleanup"], "followUpStatus": record["status"]},
                "sources": [{"label": "Your recorded cleanup and Counted beach reports", "url": "/beach/" + record["beachId"]}],
                "action": {"label": "Report litter", "path": "/report/photo?beach=" + record["beachId"]}, "aiAssisted": False,
            })
    included: defaultdict[str, int] = defaultdict(int)
    remained: defaultdict[str, int] = defaultdict(int)
    for cleanup_rows in _personal_cleanup_bands(engine, impl, cleanups):
        for row in cleanup_rows:
            if row["beforeBand"] != "Small":
                included[row["category"]] += 1
                remained[row["category"]] += row["afterBand"] != "Small"
    qualified = [category for category, count in included.items() if count >= 3]
    if qualified and max(remained[category] / included[category] for category in qualified) > max(
        (remained[category] / included[category] for category in qualified if category in risks), default=-1,
    ):
        qualified = []
    qualified = [category for category in qualified if category in risks]
    if qualified:
        category = min(qualified, key=lambda item: (-remained[item] / included[item], item))
        risk = risks[category]
        rate = round(remained[category] * 100 / included[category], 2)
        sections.append({
            "id": "persistent_litter", "title": "Your most persistent litter",
            "text": f"{category} remained above Small in {remained[category]} of your {included[category]} eligible cleanups. {risk['practicalTip']}",
            "facts": {"category": category, "includedCleanupCount": included[category], "remainingCleanupCount": remained[category], "remainingRate": rate},
            "sources": [risk["source"]], "reviewDate": risk["reviewDate"],
            "action": {"label": "Wildlife guidance", "path": "/community/wildlife-help"}, "aiAssisted": False,
        })
    public_aggregate = [{key: value for key, value in row.items() if key not in {"reportIds", "cleanupIds"}} for row in aggregate]
    return {"sections": sections[:3], "aggregate": public_aggregate, "private": True, "aiAssisted": False,
            "fallback": True, "emptyStateReason": None if sections else "NO_ELIGIBLE_PERSONAL_INSIGHTS",
            "emptyStateMessage": None if sections else "Report litter or finish a cleanup to unlock personal insights.",
            "links": {"map": "/map", "insights": "/insights"}}


def install_recommendations(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    aggregate_metadata.create_all(engine)
    application.extensions["refresh_user_litter_aggregate"] = lambda user_id: refresh_user_aggregate(engine, impl, user_id)

    def authorised():
        user = _user(engine, impl, jwt_secret)
        return user

    def private_response(payload: dict[str, Any]):
        response = jsonify(payload)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Vary"] = "Authorization"
        return response

    def read_action():
        user = authorised()
        if request.headers.get("Authorization") and user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        return private_response(next_action(engine, impl, user.id if user else None))

    def read_personal():
        user = authorised()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to view your personal insights.")
        if any(key in request.args for key in {"userId", "participantId", "reporterId", "ownerId"}):
            return impl.error_response(400, "VALIDATION_FAILED", "Personal insights use the signed-in participant only.")
        return private_response(personal_insights(engine, impl, user.id))

    application.add_url_rule("/recommendations/next-action", "read_next_action", read_action)
    application.add_url_rule("/personal-insights", "read_personal_insights", read_personal)
