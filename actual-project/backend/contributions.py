"""Private contribution history and an explicitly consented public leaderboard."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import re
import unicodedata
from typing import Any

from flask import jsonify, request
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, func, insert, select
from sqlalchemy.exc import IntegrityError


REPORT_POINTS = 1
ATTENDANCE_POINTS = 5
MVP_BEACH_IDS = ("morib", "remis", "kelanang", "bagan")
PRIVATE_LOCATION_WORDS = re.compile(
    r"\b(?:street|road|avenue|lane|jalan|lorong|postcode|postal|latitude|longitude|gps|apartment|unit|block)\b",
    re.IGNORECASE,
)
INAPPROPRIATE_WORDS = {"fuck", "fucking", "shit", "bitch", "cunt", "nigger", "nigga", "puki", "pukimak", "babi", "anjing", "bodoh"}


def configure_contribution_schema(impl: Any) -> Any:
    """Keep nickname preferences separate from credentials and cleanup scores."""
    existing = impl.metadata.tables.get("participant_profiles")
    if existing is None:
        existing = Table(
            "participant_profiles", impl.metadata,
            Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
            Column("nickname", String(30)),
            Column("nickname_key", String(120), unique=True),
            Column("leaderboard_consent", Boolean, nullable=False, default=False),
            Column("updated_at", DateTime(timezone=True), nullable=False),
        )
    impl.participant_profiles_table = existing
    return existing


def validate_nickname(value: Any) -> str | None:
    """Allow an empty preference, while rejecting private or inappropriate input."""
    if not isinstance(value, str):
        raise ValueError("Nickname must be text.")
    nickname = unicodedata.normalize("NFKC", value).strip()
    if not nickname:
        return None
    if not 3 <= len(nickname) <= 30:
        raise ValueError("Use a nickname of 3–30 characters.")
    if any(not (character.isalnum() or character in " _-'") for character in nickname):
        raise ValueError("Use letters, numbers, spaces, underscores, hyphens or apostrophes only.")
    if sum(character.isdecimal() for character in nickname) >= 7 or PRIVATE_LOCATION_WORDS.search(nickname):
        raise ValueError("Nickname must not contain a phone number, address or exact location.")
    words = re.findall(r"[a-z]+", nickname.casefold())
    normalized = nickname.casefold().translate(str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t"}))
    compact = re.sub(r"[^a-z]", "", normalized)
    if INAPPROPRIATE_WORDS.intersection(words) or any(word in compact for word in INAPPROPRIATE_WORDS):
        raise ValueError("Choose an appropriate public nickname.")
    return nickname


def recorded_attendance_query(impl: Any, now: datetime | None = None):
    """Include legacy successful check-ins without duplicating V3 attendance."""
    attendance = impl.community_event_attendance_table
    members = impl.event_members_table
    confirmed = select(attendance.c.event_id, attendance.c.participant_id)
    legacy = select(members.c.event_id, members.c.participant_id).where(
        members.c.location_passed.is_(True), members.c.checked_in_at.is_not(None),
    )
    if now is not None:
        current = impl.utc_datetime(now)
        confirmed = confirmed.where(attendance.c.confirmed_at <= current)
        legacy = legacy.where(members.c.checked_in_at <= current)
    return confirmed.union(legacy)


def contribution_histories(
    engine: Any, impl: Any, user_ids: list[str] | None = None,
    beach_ids: tuple[str, ...] | None = None,
) -> dict[str, dict[str, Any]]:
    """Derive points once per eligible report and once per attended cleanup event."""
    current = datetime.now(timezone.utc)
    histories: dict[str, list[dict[str, Any]]] = defaultdict(list)
    report_query = select(
        impl.reports_table.c.id, impl.reports_table.c.reporter_id,
        impl.reports_table.c.created_at, impl.reports_table.c.beach_id,
        impl.beaches_table.c.name.label("beach_name"),
    ).select_from(impl.reports_table.join(impl.beaches_table, impl.reports_table.c.beach_id == impl.beaches_table.c.id)).where(
        impl.reports_table.c.status == "Counted",
        impl.reports_table.c.deleted_at.is_(None),
        impl.reports_table.c.created_at <= current,
    )
    attendance = recorded_attendance_query(impl, current).subquery("recorded_attendance")
    events = impl.events_table
    cleanups = impl.cleanup_actions_table
    beaches = impl.beaches_table
    attendance_query = select(
        attendance.c.participant_id, events.c.id.label("event_id"), events.c.beach_id,
        beaches.c.name.label("beach_name"), func.min(cleanups.c.created_at).label("created_at"),
    ).select_from(
        attendance.join(events, attendance.c.event_id == events.c.id)
        .join(cleanups, (cleanups.c.event_id == events.c.id) & (cleanups.c.beach_id == events.c.beach_id))
        .join(beaches, events.c.beach_id == beaches.c.id)
    ).where(
        func.coalesce(cleanups.c.cleanup_score, cleanups.c.total_removed, 0) > 0,
        cleanups.c.created_at <= current,
    ).group_by(attendance.c.participant_id, events.c.id, events.c.beach_id, beaches.c.name)
    if user_ids is not None:
        if not user_ids:
            return {}
        report_query = report_query.where(impl.reports_table.c.reporter_id.in_(user_ids))
        attendance_query = attendance_query.where(attendance.c.participant_id.in_(user_ids))
    if beach_ids is not None:
        report_query = report_query.where(impl.reports_table.c.beach_id.in_(beach_ids))
        attendance_query = attendance_query.where(events.c.beach_id.in_(beach_ids))
    with engine.connect() as connection:
        reports = connection.execute(report_query).all()
        activities = connection.execute(attendance_query).all()
    for report in reports:
        histories[report.reporter_id].append({
            "kind": "report", "reportId": report.id, "points": REPORT_POINTS,
            "createdAt": impl.contract_timestamp(report.created_at),
            "beachId": report.beach_id, "beachName": report.beach_name,
        })
    for activity in activities:
        histories[activity.participant_id].append({
            "kind": "attendance", "eventId": activity.event_id, "points": ATTENDANCE_POINTS,
            "createdAt": impl.contract_timestamp(activity.created_at),
            "beachId": activity.beach_id, "beachName": activity.beach_name,
        })
    result = {}
    for user_id in set(histories) | set(user_ids or []):
        history = sorted(histories[user_id], key=lambda row: (row["createdAt"], row.get("reportId", row.get("eventId", ""))), reverse=True)
        report_count = sum(row["kind"] == "report" for row in history)
        attendance_count = sum(row["kind"] == "attendance" for row in history)
        result[user_id] = {
            "points": report_count * REPORT_POINTS + attendance_count * ATTENDANCE_POINTS,
            "reportPoints": report_count * REPORT_POINTS,
            "attendancePoints": attendance_count * ATTENDANCE_POINTS,
            "countedReports": report_count,
            "recordedAttendances": attendance_count,
            "history": history,
        }
    return result


def contribution_badges(engine: Any, impl: Any, user_id: str) -> list[dict[str, Any]]:
    """Derive the first-cleanup badge from a recorded, non-empty cleanup."""
    with engine.connect() as connection:
        cleanups = connection.execute(select(impl.cleanup_actions_table).where(
            impl.cleanup_actions_table.c.participant_id == user_id,
        )).all()
    valid = [
        row for row in cleanups
        if (getattr(row, "cleanup_score", None) or getattr(row, "total_removed", None) or 0) > 0
    ]
    if not valid:
        return []
    first = min(valid, key=lambda row: (row.created_at, row.id))
    return [{
        "id": "shoreline-scout",
        "name": "Shoreline Scout",
        "description": "Recorded your first cleanup.",
        "earnedAt": impl.contract_timestamp(first.created_at),
    }]


def install_contributions(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Install profile preference, signup, history and consent-controlled reads."""
    if application.extensions.get("iteration3_contributions_installed"):
        return
    application.extensions["iteration3_contributions_installed"] = True
    profiles = configure_contribution_schema(impl)
    profiles.create(engine, checkfirst=True)

    def current_user():
        header = request.headers.get("Authorization", "")
        token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
        user_id = impl.decode_token_subject(token, jwt_secret) if token else None
        if not user_id:
            return None
        with engine.connect() as connection:
            return connection.execute(select(impl.users_table).where(impl.users_table.c.id == user_id)).first()

    def preference(row: Any) -> dict[str, Any]:
        return {"nickname": row.nickname or "" if row is not None else "", "joinedLeaderboard": bool(row and row.leaderboard_consent)}

    def validate_payload(payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict) or set(payload) - {"nickname", "joinedLeaderboard"}:
            raise ValueError("Use nickname and joinedLeaderboard profile fields only.")
        values = {}
        if "nickname" in payload:
            nickname = validate_nickname(payload["nickname"])
            values.update(nickname=nickname, nickname_key=nickname.casefold() if nickname else None)
        if "joinedLeaderboard" in payload:
            if type(payload["joinedLeaderboard"]) is not bool:
                raise ValueError("joinedLeaderboard must be true or false.")
            values["leaderboard_consent"] = payload["joinedLeaderboard"]
        return values

    def read_profile():
        user = current_user()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        with engine.connect() as connection:
            row = connection.execute(select(profiles).where(profiles.c.user_id == user.id)).first()
        return jsonify(preference(row))

    def update_profile():
        user = current_user()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        try:
            values = validate_payload(request.get_json(silent=True))
        except ValueError as error:
            return impl.error_response(400, "INVALID_NICKNAME", str(error))
        try:
            with engine.begin() as connection:
                old = connection.execute(select(profiles).where(profiles.c.user_id == user.id).with_for_update()).first()
                if old is None:
                    connection.execute(insert(profiles).values(
                        user_id=user.id, nickname=None, nickname_key=None,
                        leaderboard_consent=False, updated_at=datetime.now(timezone.utc),
                    ))
                if values:
                    connection.execute(profiles.update().where(profiles.c.user_id == user.id).values(**values, updated_at=datetime.now(timezone.utc)))
                row = connection.execute(select(profiles).where(profiles.c.user_id == user.id)).first()
        except IntegrityError:
            return impl.error_response(409, "NICKNAME_UNAVAILABLE", "That nickname is already in use. Choose another nickname.")
        return jsonify(preference(row))

    def read_contributions():
        user = current_user()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        return jsonify(contribution_histories(engine, impl, [user.id])[user.id])

    def read_leaderboard():
        with engine.connect() as connection:
            participants = connection.execute(select(
                profiles.c.user_id, profiles.c.nickname, impl.users_table.c.participant_id,
            ).select_from(profiles.join(impl.users_table, profiles.c.user_id == impl.users_table.c.id)).where(
                profiles.c.leaderboard_consent.is_(True),
            )).all()
        contributions = contribution_histories(engine, impl, [row.user_id for row in participants], MVP_BEACH_IDS)
        ranked = sorted(participants, key=lambda row: (-contributions[row.user_id]["points"], (row.nickname or "").casefold(), row.participant_id))
        public = []
        previous_points = None
        rank = 0
        for index, row in enumerate(ranked, 1):
            points = contributions[row.user_id]["points"]
            if points != previous_points:
                rank = index
            public.append({"rank": rank, "nickname": row.nickname or f"Volunteer {row.participant_id}", "points": points})
            previous_points = points
        return jsonify(public)

    def read_badges():
        user = current_user()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to view your badges.")
        return jsonify(contribution_badges(engine, impl, user.id))

    original_signup = application.view_functions["create_anonymous_participant"]

    def signup_with_profile():
        payload = request.get_json(silent=True)
        if payload is None and not request.data:
            return original_signup()
        try:
            values = validate_payload(payload)
        except ValueError as error:
            return impl.error_response(400, "INVALID_NICKNAME", str(error))
        recovery_token = impl.create_recovery_token()
        now = datetime.now(timezone.utc)
        try:
            with engine.begin() as connection:
                participant_id = impl.generate_participant_id(connection)
                user_id = "u_" + impl.secrets.token_hex(12)
                connection.execute(insert(impl.users_table).values(
                    id=user_id, participant_id=participant_id, role=impl.DEFAULT_VOLUNTEER_ROLE,
                    user_token=impl.recovery_token_digest(recovery_token), created_at=now,
                ))
                connection.execute(insert(profiles).values(
                    user_id=user_id, nickname=values.get("nickname"), nickname_key=values.get("nickname_key"),
                    leaderboard_consent=values.get("leaderboard_consent", False), updated_at=now,
                ))
        except IntegrityError:
            return impl.error_response(409, "NICKNAME_UNAVAILABLE", "That nickname is already in use. Choose another nickname.")
        except RuntimeError as error:
            return impl.error_response(500, "INTERNAL_ERROR", str(error))
        return jsonify({
            "token": impl.issue_token(user_id, jwt_secret), "recoveryToken": recovery_token,
            "user": {"id": user_id, "participantId": participant_id, "role": impl.DEFAULT_VOLUNTEER_ROLE},
            "profile": {"nickname": values.get("nickname") or "", "joinedLeaderboard": values.get("leaderboard_consent", False)},
        }), 201

    application.view_functions["create_anonymous_participant"] = signup_with_profile
    application.add_url_rule("/profile", "get_contribution_profile", read_profile, methods=["GET"])
    application.add_url_rule("/profile", "update_contribution_profile", update_profile, methods=["PATCH"])
    application.add_url_rule("/contributions", "get_contributions", read_contributions, methods=["GET"])
    application.add_url_rule("/leaderboard", "get_leaderboard", read_leaderboard, methods=["GET"])
    application.add_url_rule("/badges", "get_badges", read_badges, methods=["GET"])

    @application.after_request
    def contribution_cache_policy(response):
        if request.endpoint in {"get_contribution_profile", "update_contribution_profile", "get_contributions", "get_badges"}:
            response.headers["Cache-Control"] = "private, no-store"
            response.vary.add("Authorization")
        elif request.endpoint == "get_leaderboard":
            response.headers["Cache-Control"] = "no-store"
        return response
