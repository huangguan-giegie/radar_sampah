"""Serve the v2 frontend and API together; public API lives under /api."""
from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, abort, send_from_directory
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.serving import run_simple

from app import create_app as create_api


def create_app(*, testing=False, database_url=None, frontend_dir=None):
    if os.getenv("RADAR_ENV") == "production":
        configured = os.getenv("DATABASE_URL", "").strip()
        if not configured:
            raise RuntimeError("Production requires DATABASE_URL. Configure PostgreSQL before starting.")
        if not configured.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
            raise RuntimeError("Production requires PostgreSQL rather than an ephemeral local database.")
    directory = Path(frontend_dir or os.getenv("FRONTEND_DIST_DIR", "") or Path(__file__).parent.parent / "frontend" / "dist").resolve()
    if not (directory / "index.html").is_file():
        raise RuntimeError("Frontend build is missing. Build frontend with VITE_API_BASE_URL=/api first.")
    frontend = Flask("radar_frontend", static_folder=None)

    @frontend.get("/")
    @frontend.get("/<path:path>")
    def frontend_file(path=""):
        candidate = (directory / path).resolve()
        if directory not in candidate.parents and candidate != directory:
            abort(404)
        if candidate.is_file():
            response = send_from_directory(directory, path)
            if path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response
        if path.startswith(("assets/", "images/")) or Path(path).suffix:
            abort(404)
        response = send_from_directory(directory, "index.html")
        response.headers["Cache-Control"] = "no-cache"
        return response

    api = create_api(testing=testing, database_url=database_url)
    application = DispatcherMiddleware(frontend, {"/api": api})
    if os.getenv("TRUST_PROXY_HEADERS") == "1":
        application = ProxyFix(application, x_for=1, x_proto=1, x_host=1)
    return application


if __name__ == "__main__":
    run_simple("127.0.0.1", int(os.getenv("PORT", "5000")), create_app(), threaded=True)
