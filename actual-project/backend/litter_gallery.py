from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from flask import jsonify, request, send_file
from sqlalchemy import select


GALLERY_TOKEN_PURPOSE = "litter-gallery-photo"
GALLERY_TOKEN_TTL = timedelta(minutes=5)
GALLERY_HMAC_CONTEXT = b"radar-sampah-litter-gallery-v1"


def _photo_binding(beach_id: str, report_id: str, photo_key: str, secret: str) -> str:
    payload = b"|".join(
        (
            GALLERY_HMAC_CONTEXT,
            beach_id.encode("utf-8"),
            report_id.encode("utf-8"),
            photo_key.encode("utf-8"),
        )
    )
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _issue_gallery_token(report: Any, secret: str, impl: Any) -> str:
    now = datetime.now(timezone.utc)
    return impl.jwt.encode(
        {
            "purpose": GALLERY_TOKEN_PURPOSE,
            "beachId": report.beach_id,
            "reportId": report.id,
            # Bind the token to the current private photo without disclosing
            # the raw photo_key in the readable JWT payload.
            "photoRef": _photo_binding(report.beach_id, report.id, report.photo_key, secret),
            "iat": now,
            "exp": now + GALLERY_TOKEN_TTL,
        },
        secret,
        algorithm=impl.AUTH_JWT_ALGORITHM,
    )


def _decode_gallery_token(token: str, secret: str, impl: Any) -> dict[str, Any] | None:
    try:
        claims = impl.jwt.decode(token, secret, algorithms=[impl.AUTH_JWT_ALGORITHM])
    except impl.jwt.PyJWTError:
        return None
    if (
        claims.get("purpose") != GALLERY_TOKEN_PURPOSE
        or not isinstance(claims.get("beachId"), str)
        or not isinstance(claims.get("reportId"), str)
        or not isinstance(claims.get("photoRef"), str)
    ):
        return None
    return claims


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


def install_litter_gallery(application: Any, engine: Any, jwt_secret: str, impl: Any) -> None:
    """Install the public, beach-scoped historical litter-photo gallery."""
    directory = Path(application.extensions["photo_storage_dir"])
    valid_beach_ids = {beach["id"] for beach in impl.load_beaches(engine)}

    @application.get("/beaches/<beach_id>/litter-gallery")
    def list_litter_gallery(beach_id: str):
        if beach_id not in valid_beach_ids:
            return impl.error_response(404, "NOT_FOUND", "Beach not found.")

        with engine.connect() as connection:
            reports = connection.execute(
                select(impl.reports_table)
                .where(
                    impl.reports_table.c.beach_id == beach_id,
                    impl.reports_table.c.status == "Counted",
                )
                .order_by(impl.reports_table.c.created_at.desc(), impl.reports_table.c.id.desc())
            ).all()

        entries = []
        for report in reports:
            if _available_photo(report, directory, impl) is None:
                continue
            token = _issue_gallery_token(report, jwt_secret, impl)
            entries.append(
                {
                    "reportId": report.id,
                    "reportedAt": impl.contract_timestamp(report.created_at),
                    "photoUrl": (
                        f"/beaches/{quote(beach_id, safe='')}/litter-gallery/"
                        f"{quote(report.id, safe='')}/photo?token={quote(token, safe='')}"
                    ),
                }
            )
        return jsonify(entries)

    @application.get("/beaches/<beach_id>/litter-gallery/<report_id>/photo")
    def read_litter_gallery_photo(beach_id: str, report_id: str):
        token = request.args.get("token", "")
        claims = _decode_gallery_token(token, jwt_secret, impl) if token else None
        if claims is None:
            return impl.error_response(401, "GALLERY_LINK_INVALID", "This gallery photo link is invalid or has expired.")
        if claims["beachId"] != beach_id or claims["reportId"] != report_id:
            return impl.error_response(401, "GALLERY_LINK_INVALID", "This gallery photo link is invalid or has expired.")

        with engine.connect() as connection:
            report = connection.execute(
                select(impl.reports_table).where(
                    impl.reports_table.c.id == report_id,
                    impl.reports_table.c.beach_id == beach_id,
                    impl.reports_table.c.status == "Counted",
                )
            ).first()
        if report is None:
            return impl.error_response(404, "NOT_FOUND", "Gallery photo not found.")

        expected_ref = _photo_binding(beach_id, report_id, report.photo_key, jwt_secret)
        if not hmac.compare_digest(claims["photoRef"], expected_ref):
            return impl.error_response(401, "GALLERY_LINK_INVALID", "This gallery photo link is invalid or has expired.")

        photo_path = _available_photo(report, directory, impl)
        if photo_path is None:
            return impl.error_response(404, "NOT_FOUND", "Gallery photo not found.")

        response = send_file(photo_path, mimetype="image/jpeg", max_age=0, conditional=True)
        response.headers["Cache-Control"] = "private, no-store"
        return response
