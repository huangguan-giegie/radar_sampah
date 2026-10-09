"""Persistent volunteer profiles and database-backed contribution summaries."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from flask import jsonify, request
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, MetaData, String, Table, func, select
from sqlalchemy.exc import IntegrityError

from contributions import recorded_attendance_query, validate_nickname


def valid_nickname(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    value = value.strip()
    return (
        3 <= len(value) <= 30
        and "@" not in value
        and not re.search(r"[\x00-\x1f\x7f]", value)
        and not re.search(r"\d{7,}", re.sub(r"[\s()+-]", "", value))
    )


def install_account(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Install after the event contract creates the attendance ledger."""
    if application.extensions.get("account_profiles_table") is not None:
        return
    profiles = Table(
        "account_profiles", MetaData(),
        Column("user_id", ForeignKey(impl.users_table.c.id, ondelete="CASCADE"), primary_key=True),
        Column("nickname", String(30), nullable=False, default=""),
        Column("joined_leaderboard", Boolean, nullable=False, default=False),
        Column("updated_at", DateTime(timezone=True), nullable=False),
    )
    profiles.create(engine, checkfirst=True)
    application.extensions["account_profiles_table"] = profiles
    attendance = impl.community_event_attendance_table

    def viewer():
        header = request.headers.get("Authorization", "")
        token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
        user_id = impl.decode_token_subject(token, jwt_secret) if token else None
        if user_id:
            with engine.connect() as connection:
                return connection.execute(select(impl.users_table).where(impl.users_table.c.id == user_id)).first()
        return None

    def eligible_attendance_query():
        attendance_rows = recorded_attendance_query(impl).subquery("recorded_attendance")
        return select(attendance_rows.c.participant_id, attendance_rows.c.event_id).select_from(
            attendance_rows.join(impl.events_table, attendance_rows.c.event_id == impl.events_table.c.id)
            .join(impl.cleanup_actions_table, (impl.cleanup_actions_table.c.event_id == impl.events_table.c.id)
                  & (impl.cleanup_actions_table.c.beach_id == impl.events_table.c.beach_id))
        ).where(func.coalesce(impl.cleanup_actions_table.c.cleanup_score, impl.cleanup_actions_table.c.total_removed, 0) > 0).distinct()

    def leaderboard_rows() -> list[dict[str, Any]]:
        # Group each ledger separately; joining raw report and attendance rows
        # would multiply points for volunteers who have both kinds of evidence.
        with engine.connect() as connection:
            opted = connection.execute(select(profiles).where(profiles.c.joined_leaderboard.is_(True))).all()
            user_ids = [row.user_id for row in opted]
            if not user_ids:
                return []
            reports = dict(connection.execute(select(
                impl.reports_table.c.reporter_id, func.count(),
            ).where(
                impl.reports_table.c.reporter_id.in_(user_ids),
                impl.reports_table.c.status == "Counted",
                impl.reports_table.c.deleted_at.is_(None),
            ).group_by(impl.reports_table.c.reporter_id)).all())
            eligible_base = eligible_attendance_query().subquery("eligible_base")
            eligible = select(eligible_base.c.participant_id, eligible_base.c.event_id).where(eligible_base.c.participant_id.in_(user_ids)).subquery("eligible")
            attended = dict(connection.execute(select(eligible.c.participant_id, func.count()).group_by(eligible.c.participant_id)).all())
        rows = [
            {"user_id": row.user_id, "nickname": row.nickname,
             "points": reports.get(row.user_id, 0) + 5 * attended.get(row.user_id, 0)}
            for row in opted if valid_nickname(row.nickname)
        ]
        rows.sort(key=lambda row: (-row["points"], row["nickname"].casefold(), row["user_id"]))
        last_points = None
        rank = 0
        for index, row in enumerate(rows, start=1):
            if row["points"] != last_points:
                rank = index
                last_points = row["points"]
            row["rank"] = rank
        return rows

    def contribution_payload(user_id: str) -> dict[str, Any]:
        with engine.connect() as connection:
            reports = connection.execute(select(impl.reports_table).where(
                impl.reports_table.c.reporter_id == user_id,
                impl.reports_table.c.deleted_at.is_(None),
            )).all()
            # Completed events stay in contribution history. Upcoming-event
            # lists intentionally exclude these rows and cannot count points.
            eligible_base = eligible_attendance_query().subquery("eligible_base")
            eligible = select(eligible_base.c.participant_id, eligible_base.c.event_id).where(eligible_base.c.participant_id == user_id).subquery("eligible")
            attended = connection.execute(
                select(eligible.c.event_id, attendance.c.confirmed_at,
                       impl.events_table.c.beach_id, impl.events_table.c.starts_at)
                .select_from(
                    eligible.join(attendance, (attendance.c.event_id == eligible.c.event_id)
                                  & (attendance.c.participant_id == eligible.c.participant_id))
                    .join(impl.events_table, attendance.c.event_id == impl.events_table.c.id)
                )
            ).all()
            names = dict(connection.execute(select(impl.beaches_table.c.id, impl.beaches_table.c.name)).all())
        counts = Counter(row.status for row in reports)
        history = [
            {"kind": "report", "id": row.id, "beachId": row.beach_id,
             "beachName": names.get(row.beach_id, row.beach_id),
             "createdAt": impl.contract_timestamp(row.created_at), "points": 1}
            for row in reports if row.status == "Counted"
        ]
        history.extend(
            {"kind": "attendance", "id": row.event_id, "beachId": row.beach_id,
             "beachName": names.get(row.beach_id, row.beach_id),
             "createdAt": impl.contract_timestamp(row.confirmed_at), "points": 5}
            for row in attended
        )
        history.sort(key=lambda row: (row["createdAt"], row["kind"], row["id"]), reverse=True)
        return {
            "points": counts["Counted"] + 5 * len(attended),
            "countedReports": counts["Counted"], "attendanceCount": len(attended),
            "reportCount": len(reports),
            "reportCounts": {"counted": counts["Counted"], "duplicate": counts["Duplicate"], "incomplete": counts["Incomplete"]},
            "history": history, "asOf": impl.contract_timestamp(datetime.now(timezone.utc)),
        }

    def profile_payload(user_id: str) -> dict[str, Any]:
        with engine.connect() as connection:
            row = connection.execute(select(profiles).where(profiles.c.user_id == user_id)).first()
        summary = contribution_payload(user_id)
        rank = next((entry["rank"] for entry in leaderboard_rows() if entry["user_id"] == user_id), None)
        return {"nickname": row.nickname if row else "", "joinedLeaderboard": bool(row and row.joined_leaderboard),
                "points": summary["points"], "rank": rank}

    def own_profile():
        user = viewer()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        return jsonify(profile_payload(user.id))

    def update_profile():
        user = viewer()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not payload or set(payload) - {"nickname", "joinedLeaderboard"}:
            return impl.error_response(400, "VALIDATION_FAILED", "Send nickname or joinedLeaderboard.")
        if "nickname" in payload:
            try:
                validate_nickname(payload["nickname"])
            except ValueError as error:
                return impl.error_response(400, "INVALID_NICKNAME", str(error))
            if not valid_nickname(payload["nickname"]):
                return impl.error_response(400, "INVALID_NICKNAME", "Use 3-30 characters without an email address or phone number.")
        if "joinedLeaderboard" in payload and type(payload["joinedLeaderboard"]) is not bool:
            return impl.error_response(400, "VALIDATION_FAILED", "joinedLeaderboard must be true or false.")
        with engine.begin() as connection:
            old = connection.execute(select(profiles).where(profiles.c.user_id == user.id)).first()
            nickname = payload["nickname"].strip() if "nickname" in payload else old.nickname if old else ""
            if "nickname" in payload and nickname:
                duplicate = connection.execute(select(profiles.c.user_id).where(
                    func.lower(profiles.c.nickname) == nickname.casefold(), profiles.c.user_id != user.id,
                )).first()
                if duplicate:
                    return impl.error_response(409, "NICKNAME_UNAVAILABLE", "That nickname is already in use. Choose another nickname.")
            joined = payload.get("joinedLeaderboard", bool(old and old.joined_leaderboard))
            if joined and not valid_nickname(nickname):
                return impl.error_response(400, "INVALID_NICKNAME", "Choose a nickname before joining the leaderboard.")
            values = {"nickname": nickname, "joined_leaderboard": joined, "updated_at": datetime.now(timezone.utc)}
            # PATCH only owns the fields supplied by this request. Reusing the
            # read snapshot here can undo a concurrent leaderboard opt-out.
            changes = {"updated_at": values["updated_at"]}
            if "nickname" in payload:
                changes["nickname"] = nickname
            if "joinedLeaderboard" in payload:
                changes["joined_leaderboard"] = joined
            if engine.dialect.name == "postgresql":
                from sqlalchemy.dialects.postgresql import insert as dialect_insert
            else:
                from sqlalchemy.dialects.sqlite import insert as dialect_insert
            statement = dialect_insert(profiles).values(user_id=user.id, **values).on_conflict_do_update(
                index_elements=[profiles.c.user_id], set_=changes,
            )
            connection.execute(statement)
        return jsonify(profile_payload(user.id))

    def own_contributions():
        user = viewer()
        if user is None:
            return impl.error_response(401, "UNAUTHENTICATED", "Sign in to continue.")
        return jsonify(contribution_payload(user.id))

    def public_leaderboard():
        return jsonify({"entries": [
            {"nickname": row["nickname"], "points": row["points"], "rank": row["rank"]}
            for row in leaderboard_rows()
        ], "asOf": impl.contract_timestamp(datetime.now(timezone.utc))})

    application.add_url_rule("/account/profile", "account_profile", own_profile, methods=["GET"])
    application.add_url_rule("/account/profile", "account_update_profile", update_profile, methods=["PATCH"])
    application.add_url_rule("/account/contributions", "account_contributions", own_contributions, methods=["GET"])
    application.add_url_rule("/leaderboard", "public_leaderboard", public_leaderboard, methods=["GET"])
