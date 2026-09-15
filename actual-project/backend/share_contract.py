from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import quote

from flask import jsonify, request, send_file
from sqlalchemy import select

from standalone_cleanup import _current_band_state


def _viewer_id(jwt_secret: str, impl: Any) -> str | None:
    header = request.headers.get("Authorization", "")
    token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
    return impl.decode_token_subject(token, jwt_secret) if token else None


def _available_photo(report: Any, directory: Path, impl: Any) -> Path | None:
    metadata = impl.read_photo_metadata(directory, report.photo_key)
    path = impl.photo_file_path(directory, report.photo_key)
    if (
        metadata is None
        or metadata.get("ownerId") != report.reporter_id
        or path is None
        or not path.is_file()
    ):
        return None
    return path


def install_reviewed_share_contract(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Keep report sharing available after quantities became band-native."""
    directory = Path(application.extensions["photo_storage_dir"])
    get_event = application.view_functions["get_event"]

    def issue_share_link_reviewed():
        event_id = request.args.get("eventId")
        report_id = request.args.get("reportId")
        if not event_id and not report_id:
            return impl.error_response(400, "VALIDATION_FAILED", "eventId or reportId is required.")

        with engine.connect() as connection:
            event = connection.execute(
                select(impl.events_table).where(impl.events_table.c.id == event_id)
            ).first() if event_id else None
            report = connection.execute(
                select(impl.reports_table).where(impl.reports_table.c.id == report_id)
            ).first() if report_id else None

        if event_id and event is None:
            return impl.error_response(404, "NOT_FOUND", "Event not found.")
        if report_id and (report is None or report.status != "Counted"):
            return impl.error_response(404, "NOT_FOUND", "Shareable report not found.")
        if report is not None and _viewer_id(jwt_secret, impl) != report.reporter_id:
            return impl.error_response(404, "NOT_FOUND", "Shareable report not found.")
        if event is not None and report is not None and event.beach_id != report.beach_id:
            return impl.error_response(400, "VALIDATION_FAILED", "The report and event must refer to the same beach.")

        token = impl.create_share_token(event_id, report_id, jwt_secret)
        return jsonify({"token": token, "path": "/share/" + quote(token, safe="")})

    def read_share_link_reviewed(token: str):
        claims = impl.decode_share_token(token, jwt_secret)
        if claims is None:
            return impl.error_response(404, "NOT_FOUND", "Shared item not found.")
        event_id, report_id = claims["eventId"], claims["reportId"]

        with engine.connect() as connection:
            event = connection.execute(
                select(impl.events_table).where(impl.events_table.c.id == event_id)
            ).first() if event_id else None
            report = connection.execute(
                select(impl.reports_table).where(impl.reports_table.c.id == report_id)
            ).first() if report_id else None
            actions = connection.execute(
                select(impl.cleanup_actions_table)
                .where(impl.cleanup_actions_table.c.target_report_id == report_id)
                .order_by(impl.cleanup_actions_table.c.created_at)
            ).all() if report_id else []

        if event_id and event is None:
            return impl.error_response(404, "NOT_FOUND", "Shared item not found.")
        if report_id and (report is None or report.status != "Counted"):
            return impl.error_response(404, "NOT_FOUND", "Shared item not found.")
        if event is not None and report is not None and event.beach_id != report.beach_id:
            return impl.error_response(404, "NOT_FOUND", "Shared item not found.")

        shared_report = None
        if report is not None:
            shared_report = {
                "id": report.id,
                "beachId": report.beach_id,
                "beachName": next(
                    (beach["name"] for beach in impl.load_beaches(engine) if beach["id"] == report.beach_id),
                    report.beach_id,
                ),
                "reportedAt": impl.contract_timestamp(report.created_at),
                "status": report.status,
                "quantities": impl.quantities_from_row(report),
                "remainingQuantities": _current_band_state(impl, report, actions),
                "photoAvailable": _available_photo(report, directory, impl) is not None,
            }
            # Historical count-backed links stay readable for deployed clients,
            # but new band-native reports never expose or synthesize exact counts.
            if getattr(report, "item_counts", None):
                try:
                    item_counts = impl.json.loads(report.item_counts or "{}")
                except (TypeError, ValueError):
                    item_counts = {}
                remaining_counts = impl.remaining_counts_for(report, actions)
                shared_report.update({
                    "itemCounts": item_counts,
                    "remainingItemCounts": remaining_counts,
                    "remainingTotal": sum(remaining_counts.values()),
                })

        event_payload = None
        if event_id:
            event_response = application.make_response(get_event(event_id))
            if event_response.status_code != 200:
                return impl.error_response(404, "NOT_FOUND", "Shared item not found.")
            event_payload = event_response.get_json()

        return jsonify({"event": event_payload, "report": shared_report})

    def read_shared_report_photo_reviewed(token: str):
        claims = impl.decode_share_token(token, jwt_secret)
        report_id = claims.get("reportId") if claims else None
        if not report_id:
            return impl.error_response(404, "NOT_FOUND", "Shared photo not found.")
        with engine.connect() as connection:
            report = connection.execute(
                select(impl.reports_table).where(impl.reports_table.c.id == report_id)
            ).first()
        if report is None or report.status != "Counted":
            return impl.error_response(404, "NOT_FOUND", "Shared photo not found.")
        photo_path = _available_photo(report, directory, impl)
        if photo_path is None:
            return impl.error_response(404, "NOT_FOUND", "Shared photo not found.")
        response = send_file(photo_path, mimetype="image/jpeg", max_age=0, conditional=True)
        response.headers["Cache-Control"] = "private, no-store"
        return response

    application.view_functions["issue_share_link"] = issue_share_link_reviewed
    application.view_functions["read_share_link"] = read_share_link_reviewed
    application.view_functions["read_shared_report_photo"] = read_shared_report_photo_reviewed
