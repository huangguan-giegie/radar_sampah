"""V2 catalogue, database health and deployed same-origin routing contracts."""
import io
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from sqlalchemy import text
from werkzeug.test import Client
from werkzeug.wrappers import Response

from api_tests_core import api, signup, upload, report_payload
from wsgi import create_app as create_site


def test_entire_v2_catalogue_is_live_and_has_no_preview_reports(api):
    application, client = api
    beaches = client.get("/beaches").json
    assert len(beaches) == 101
    assert len({b["id"] for b in beaches}) == 101
    assert all(b["insufficientData"] and b["validReports"] == 0 and b["severity"] is None for b in beaches)
    assert all(-90 <= b["lat"] <= 90 and -180 <= b["lng"] <= 180 for b in beaches)
    _, headers = signup(client)
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json={**report_payload(photo["photoKey"]), "beachId": "pantai-batu-laut"})
    assert response.status_code == 201
    assert client.get("/beaches/pantai-batu-laut").json["validReports"] == 1
    with application.extensions["marine_engine"].connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM reports")).scalar_one() == 1


def test_health_queries_database_and_returns_503_when_connection_fails(api, monkeypatch):
    application, client = api
    assert client.get("/health").json["database"] == "connected"
    def fail():
        raise RuntimeError("unavailable")
    monkeypatch.setattr(application.extensions["marine_engine"], "connect", fail)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json == {"status": "unavailable", "database": "unavailable"}


def test_same_origin_routes_and_signed_photo_prefix(tmp_path, monkeypatch):
    monkeypatch.delenv("RADAR_ENV", raising=False)
    monkeypatch.setenv("AUTH_JWT_SECRET", "test-v2-delivery-secret")
    dist = tmp_path / "frontend"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>v2</html>", encoding="utf-8")
    (dist / "assets" / "app.js").write_text("// app", encoding="utf-8")
    site = create_site(testing=True, database_url=f"sqlite:///{tmp_path / 'site.db'}", frontend_dir=dist)
    client = Client(site, Response)
    assert client.get("/map").text == "<html>v2</html>"
    assert client.get("/insights/trends/pantai-batu-laut").status_code == 200
    assert client.get("/species/green-sea-turtle").status_code == 200
    assert client.get("/assets/app.js").headers["Cache-Control"].endswith("immutable")
    assert client.get("/species/missing.jpg").status_code == 404
    assert client.get("/api/health").json["database"] == "connected"
    assert client.get("/api/not-a-route").status_code == 404
    session = client.post("/api/auth/anonymous").json
    headers = {"Authorization": "Bearer " + session["token"]}
    from PIL import Image
    source = io.BytesIO()
    Image.new("RGB", (24, 24), "blue").save(source, format="JPEG")
    source.seek(0)
    response = client.post("/api/uploads/photos", headers=headers, data={"photo": (source, "sample.jpg")})
    assert response.status_code == 201
    path = urlsplit(response.json["previewUrl"])
    assert path.path.startswith("/api/uploads/photos/")
    assert client.get(path.path + "?" + path.query).status_code == 200


def test_production_requires_database_url(monkeypatch):
    monkeypatch.setenv("RADAR_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="Production requires DATABASE_URL"):
        create_site()


def test_production_rejects_ephemeral_sqlite(monkeypatch):
    monkeypatch.setenv("RADAR_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///production.db")
    with pytest.raises(RuntimeError, match="Production requires PostgreSQL"):
        create_site()
