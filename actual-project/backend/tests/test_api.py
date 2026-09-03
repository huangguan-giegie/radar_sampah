"""Contract tests for frontend/API.md and frontend/API.en.md."""

from __future__ import annotations

import io
import os
import re
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from PIL import Image
from sqlalchemy import event, inspect as sqlalchemy_inspect
from sqlalchemy import insert, select, text

os.environ.setdefault("AUTH_JWT_SECRET", "test-only-secret-not-for-production")

from app import (
    create_app,
    load_beaches,
    photo_file_path,
    read_photo_metadata,
    reports_table,
    seed_reference_data,
    sweep_orphan_photos,
    users_table,
    write_photo_metadata,
)


@pytest.fixture
def api(tmp_path):
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'radar_test.db'}",
        testing=True,
        photo_storage_dir=tmp_path / "private-photos",
    )
    return application, application.test_client()


def test_startup_creates_all_six_contract_tables(tmp_path):
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'six-tables.db'}",
        testing=True,
        photo_storage_dir=tmp_path / "photos",
    )
    names = set(sqlalchemy_inspect(application.extensions["marine_engine"]).get_table_names())
    assert {"users", "beaches", "dim_threat", "dim_species", "area_species", "reports"} <= names


def test_startup_seeds_reference_tables_idempotently(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'reference.db'}"
    create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    second = create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    engine = second.extensions["marine_engine"]
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM beaches")).scalar_one() == 4
        assert connection.execute(text("SELECT COUNT(*) FROM area_species")).scalar_one() == 11
        assert connection.execute(text("SELECT COUNT(*) FROM reports")).scalar_one() == 0


def test_startup_repairs_partial_reference_seed_without_touching_reports(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'partial-reference.db'}"
    first = create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    with first.extensions["marine_engine"].begin() as connection:
        connection.execute(text("DELETE FROM area_species WHERE area_id <> 'morib'"))
        connection.execute(text("DELETE FROM beaches WHERE id <> 'morib'"))
    second = create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    with second.extensions["marine_engine"].connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM beaches")).scalar_one() == 4
        assert connection.execute(text("SELECT COUNT(*) FROM area_species")).scalar_one() == 11
        assert connection.execute(text("SELECT COUNT(*) FROM reports")).scalar_one() == 0


def signup(client):
    response = client.post("/auth/anonymous")
    assert response.status_code == 201
    session = response.get_json()
    return session, {"Authorization": "Bearer " + session["token"]}


def test_demo_participant_1637_is_seeded_idempotently(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_PARTICIPANT_ID", "1637")
    database_url = f"sqlite:///{tmp_path / 'demo-participant.db'}"
    application = create_app(
        database_url=database_url,
        testing=True,
        photo_storage_dir=tmp_path / "private-photos",
    )
    client = application.test_client()

    restored = client.post("/auth/restore", json={"participantId": "1637"})

    assert restored.status_code == 200
    assert restored.get_json()["user"] == {
        "id": "u_demo_1637",
        "participantId": "1637",
        "role": "volunteer",
    }

    second_application = create_app(
        database_url=database_url,
        testing=True,
        photo_storage_dir=tmp_path / "private-photos",
    )
    second_response = second_application.test_client().post(
        "/auth/restore", json={"participantId": "1637"}
    )
    assert second_response.status_code == 200
    assert second_response.get_json()["user"]["id"] == "u_demo_1637"


def test_demo_participant_id_must_be_four_digits(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_PARTICIPANT_ID", "163")

    with pytest.raises(RuntimeError, match="DEMO_PARTICIPANT_ID must be a four-digit participant ID"):
        create_app(
            database_url=f"sqlite:///{tmp_path / 'invalid-demo.db'}",
            testing=True,
            photo_storage_dir=tmp_path / "private-photos",
        )


def test_demo_participant_runs_report_flow(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_PARTICIPANT_ID", "1637")
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'demo-flow.db'}",
        testing=True,
        photo_storage_dir=tmp_path / "private-photos",
    )
    client = application.test_client()
    restored = client.post("/auth/restore", json={"participantId": "1637"})
    headers = {"Authorization": "Bearer " + restored.get_json()["token"]}

    photo = upload(client, headers)
    created = client.post(
        "/reports",
        headers=headers,
        json=report_payload(photo["photoKey"], quantities={"Plastic": "Large", "Glass": "Small"}),
    )
    assert created.status_code == 201
    assert client.get("/auth/me", headers=headers).get_json()["participantId"] == "1637"
    assert created.get_json()["status"] == "Counted"
    assert client.get("/reports/mine", headers=headers).status_code == 200
    assert client.get("/reports/mine/counts", headers=headers).get_json()["counted"] == 1


def test_species_distribution_predicts_from_packaged_models(api):
    _application, client = api
    response = client.post(
        "/api/species-distribution/predict",
        json={"latitude": 2.746, "longitude": 101.44},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["insideMalaysianEez"] is True
    assert payload["scoreType"] == "relative_occurrence"
    assert payload["calibratedProbability"] is False
    assert {prediction["speciesSlug"] for prediction in payload["predictions"]} == {
        "green_sea_turtle",
        "ocellaris_clownfish",
        "irrawaddy_dolphin",
        "moorish_idol",
    }


def test_species_distribution_rejects_coordinates_outside_model_area(api):
    _application, client = api
    response = client.post(
        "/api/species-distribution/predict",
        json={"latitude": 0, "longitude": 0},
    )

    assert response.status_code == 422
    assert response.get_json() == {
        "code": "OUTSIDE_MODEL_AREA",
        "message": "The coordinate is outside the supported Malaysian EEZ.",
    }


def test_species_distribution_rejects_malformed_coordinates(api):
    _application, client = api
    response = client.post("/api/species-distribution/predict", json={"latitude": "north", "longitude": 101.44})
    assert response.status_code == 400
    assert response.get_json() == {
        "code": "VALIDATION_FAILED",
        "message": "latitude and longitude must be numbers.",
    }


def test_species_distribution_does_not_write_to_database(api):
    application, client = api
    engine = application.extensions["marine_engine"]
    with engine.connect() as connection:
        before_users = connection.execute(select(users_table)).all()
        before_reports = connection.execute(select(reports_table)).all()

    response = client.post("/api/species-distribution/predict", json={"latitude": 2.746, "longitude": 101.44})
    assert response.status_code == 200

    with engine.connect() as connection:
        assert connection.execute(select(users_table)).all() == before_users
        assert connection.execute(select(reports_table)).all() == before_reports


def jpeg_bytes(size=(40, 30), with_metadata=False):
    output = io.BytesIO()
    image = Image.new("RGB", size, (44, 110, 145))
    if with_metadata:
        exif = Image.Exif()
        exif[0x010E] = "private metadata"
        image.save(output, "JPEG", exif=exif)
    else:
        image.save(output, "JPEG")
    return output.getvalue()


def upload(client, headers, *, size=(40, 30), with_metadata=False):
    response = client.post(
        "/uploads/photos",
        headers=headers,
        data={"photo": (io.BytesIO(jpeg_bytes(size, with_metadata)), "beach.jpg")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 201
    return response.get_json()


def report_payload(photo_key, beach_id="morib", quantities=None, location_source="manual"):
    value = {
        "beachId": beach_id,
        "quantities": quantities or {"Plastic": "Large"},
        "photoKey": photo_key,
        "locationSource": location_source,
    }
    if location_source == "gps":
        value["coords"] = {"lat": 2.74614, "lng": 101.44024}
    return value


def test_health_and_legacy_routes(api):
    _application, client = api
    assert client.get("/health").get_json() == {"status": "ok", "database": "configured"}

    response = client.get("/api/options")
    assert response.status_code == 404
    assert response.get_json() == {"code": "NOT_FOUND", "message": "The requested resource was not found."}


def test_render_requirements_pin_available_psycopg_binary_release():
    requirements = (Path(__file__).parents[1] / "requirements.txt").read_text(encoding="utf-8")
    assert "psycopg[binary]==3.2.13" in requirements


def test_partial_main_database_is_migrated_to_contract_rules(tmp_path):
    database_path = tmp_path / "partial-main.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
          id VARCHAR(80) PRIMARY KEY, participant_id VARCHAR(4) NOT NULL UNIQUE,
          role VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL
        );
        CREATE TABLE frontend_reports (
          id VARCHAR(40) PRIMARY KEY, reporter_id VARCHAR(80) NOT NULL,
          beach_id VARCHAR(80) NOT NULL, beach_name VARCHAR(160) NOT NULL,
          quantities TEXT NOT NULL, category VARCHAR(40) NOT NULL,
          quantity VARCHAR(20) NOT NULL, photo_key VARCHAR(500) NOT NULL,
          location_source VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL,
          created_at DATETIME NOT NULL
        );
        INSERT INTO users VALUES ('u_legacy', '1637', 'volunteer', '2026-08-31 00:00:00');
        INSERT INTO frontend_reports VALUES
          ('r_first', 'u_legacy', 'morib', 'Pantai Morib',
           '{"Plastic":"Very Large","Fishing gear":"Small"}', 'Plastic', 'Very Large',
           'old-one', 'manual', 'Counted', '2026-08-31 01:00:00'),
          ('r_second', 'u_legacy', 'morib', 'Pantai Morib',
           '{"Plastic":"Small"}', 'Plastic', 'Small',
           'old-two', 'manual', 'Counted', '2026-08-31 02:00:00');
        """
    )
    connection.close()

    application = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=tmp_path / "photos",
    )
    engine = application.extensions["marine_engine"]
    assert {"users", "beaches", "dim_threat", "dim_species", "area_species", "reports"} <= set(
        sqlalchemy_inspect(engine).get_table_names()
    )
    assert {"photo_mime", "photo_stripped", "lat", "lng", "updated_at", "qty_plastic", "qty_fishing_gear"} <= {
        column["name"] for column in sqlalchemy_inspect(engine).get_columns("reports")
    }
    with engine.connect() as db_connection:
        rows = db_connection.execute(select(reports_table).order_by(reports_table.c.created_at)).all()
    assert (rows[0].category, rows[0].quantity, rows[0].status) == ("Plastic", "Very Large", "Counted")
    assert (rows[0].qty_plastic, rows[0].qty_fishing_gear) == ("Very Large", "Small")
    assert rows[1].status == "Duplicate"


def test_standard_schema_database_gets_runtime_compatibility_columns(tmp_path):
    database_path = tmp_path / "standard-schema.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
          id TEXT PRIMARY KEY, participant_id TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL, created_at TIMESTAMP NOT NULL
        );
        CREATE TABLE beaches (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL,
          lat REAL NOT NULL, lng REAL NOT NULL, habitat TEXT NOT NULL,
          habitat_tag TEXT NOT NULL, sensitivity TEXT NOT NULL,
          primary_species_glyph TEXT NOT NULL, cover_image_url TEXT,
          scene TEXT NOT NULL, ecological_note TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL
        );
        CREATE TABLE reports (
          id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, beach_id TEXT NOT NULL,
          location_source TEXT NOT NULL, photo_key TEXT NOT NULL,
          photo_mime TEXT NOT NULL, photo_stripped BOOLEAN NOT NULL,
          qty_plastic TEXT, qty_fishing_gear TEXT, qty_glass TEXT,
          qty_metal TEXT, qty_paper TEXT, qty_other TEXT,
          category TEXT NOT NULL, quantity TEXT NOT NULL,
          lat NUMERIC, lng NUMERIC, status TEXT NOT NULL, status_note TEXT,
          created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
          deleted_at TIMESTAMP
        );
        INSERT INTO users VALUES ('u_standard', '1637', 'volunteer', '2026-08-31 00:00:00');
        INSERT INTO beaches VALUES
          ('morib', 'Pantai Morib', 'Banting, Selangor', 2.746, 101.44,
           'Intertidal mudflat & sandy shore', 'MUDFLAT', 'Migratory feeding ground',
           'turtle', NULL, 'scene', 'note', '2026-08-31 00:00:00');
        """
    )
    connection.close()

    application = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=tmp_path / "photos",
    )
    report_columns = {column["name"] for column in sqlalchemy_inspect(application.extensions["marine_engine"]).get_columns("reports")}
    assert {"beach_name", "quantities"} <= report_columns
    assert application.test_client().get("/beaches").status_code == 200


def test_new_contract_schema_rejects_invalid_reference_values(tmp_path):
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'constraints.db'}",
        testing=True,
        photo_storage_dir=tmp_path / "photos",
    )
    engine = application.extensions["marine_engine"]
    with pytest.raises(Exception, match="CHECK constraint failed"):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO dim_species "
                    "(species_id, scientific_name, common_name, threat_id, glyph, picture_url, created_at) "
                    "VALUES ('bad', 'Bad species', 'Bad', NULL, 'invalid', NULL, CURRENT_TIMESTAMP)"
                )
            )


def test_reference_seed_is_safe_for_concurrent_startups(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'concurrent-seed.db'}"
    application = create_app(database_url=database_url, testing=True, photo_storage_dir=tmp_path / "photos")
    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM area_species"))
        connection.execute(text("DELETE FROM dim_species"))
        connection.execute(text("DELETE FROM beaches"))

    barrier = threading.Barrier(2)
    lock = threading.Lock()
    first_beach_selects = 0

    def pause_first_selects(_connection, _cursor, statement, _parameters, _context, _executemany):
        nonlocal first_beach_selects
        if "FROM beaches" not in statement or not statement.lstrip().upper().startswith("SELECT"):
            return
        with lock:
            first_beach_selects += 1
            should_wait = first_beach_selects <= 2
        if should_wait:
            barrier.wait(timeout=5)

    event.listen(engine, "before_cursor_execute", pause_first_selects)
    errors = []

    def seed():
        try:
            seed_reference_data(engine, load_beaches())
        except Exception as error:  # pragma: no cover - assertion reports the concrete backend error
            errors.append(error)

    workers = [threading.Thread(target=seed) for _ in range(2)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=10)
    event.remove(engine, "before_cursor_execute", pause_first_selects)

    assert all(not worker.is_alive() for worker in workers)
    assert errors == []


def test_report_creation_keeps_legacy_required_columns_compatible(tmp_path):
    database_path = tmp_path / "legacy-write.db"
    connection = sqlite3.connect(database_path)
    connection.executescript(
        """
        CREATE TABLE users (
          id VARCHAR(80) PRIMARY KEY, participant_id VARCHAR(4) NOT NULL UNIQUE,
          role VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL
        );
        CREATE TABLE frontend_reports (
          id VARCHAR(40) PRIMARY KEY, reporter_id VARCHAR(80) NOT NULL,
          beach_id VARCHAR(80) NOT NULL, beach_name VARCHAR(160) NOT NULL,
          quantities TEXT NOT NULL, category VARCHAR(40) NOT NULL,
          quantity VARCHAR(20) NOT NULL, photo_key VARCHAR(500) NOT NULL,
          location_source VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL,
          created_at DATETIME NOT NULL
        );
        """
    )
    connection.close()
    application = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=tmp_path / "photos",
    )
    client = application.test_client()
    _session, headers = signup(client)
    photo = upload(client, headers)
    response = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"]))
    assert response.status_code == 201


def test_anonymous_auth_restore_and_me(api):
    _application, client = api
    session, headers = signup(client)
    assert re.fullmatch(r"\d{4}", session["user"]["participantId"])
    assert session["user"]["role"] == "volunteer"
    assert client.get("/auth/me", headers=headers).get_json() == session["user"]

    restored = client.post("/auth/restore", json={"participantId": session["user"]["participantId"]})
    assert restored.status_code == 200
    assert restored.get_json()["user"] == session["user"]
    assert client.post("/auth/logout", headers=headers).status_code == 204


@pytest.mark.parametrize("participant_id", ["123", "abcd", "00000", None])
def test_unknown_participant_has_contract_error(api, participant_id):
    _application, client = api
    response = client.post("/auth/restore", json={"participantId": participant_id})
    assert response.status_code == 404
    assert response.get_json()["code"] == "UNKNOWN_PARTICIPANT"


def test_protected_routes_require_a_bearer_token(api):
    _application, client = api
    for method, path in (("get", "/auth/me"), ("post", "/geo/resolve-beach"), ("get", "/reports/mine")):
        response = getattr(client, method)(path)
        assert response.status_code == 401
        assert response.get_json()["code"] == "UNAUTHENTICATED"


def test_beach_summary_and_detail_shapes_are_strict(api):
    _application, client = api
    response = client.get("/beaches")
    assert response.status_code == 200
    beaches = response.get_json()
    assert len(beaches) == 4
    expected_summary_fields = {
        "id", "name", "area", "lat", "lng", "severity", "band", "insufficientData",
        "validReports", "lastReportedAt", "freshnessKind", "habitat", "habitatTag",
        "sensitivity", "primarySpeciesGlyph", "speciesNames", "coverImageUrl", "scene",
        "attentionScore", "eligibleReportCount",
    }
    assert set(beaches[0]) == expected_summary_fields
    assert beaches[0]["severity"] is None
    assert beaches[0]["band"] is None
    assert beaches[0]["insufficientData"] is True
    assert beaches[0]["freshnessKind"] == "stale"

    detail = client.get("/beaches/morib").get_json()
    assert set(detail) == expected_summary_fields | {"composition", "compositionSource", "species", "ecologicalNote"}
    assert detail["composition"] is None
    assert detail["compositionSource"] is None
    assert [species["name"] for species in detail["species"]] == detail["speciesNames"]


def test_geo_resolution_is_authenticated_and_does_not_persist_coordinates(api):
    _application, client = api
    _session, headers = signup(client)
    near = client.post("/geo/resolve-beach", headers=headers, json={"lat": 2.746, "lng": 101.440})
    assert near.status_code == 200
    assert near.get_json()["id"] == "morib"
    assert client.post("/geo/resolve-beach", headers=headers, json={"lat": 0, "lng": 0}).get_json() is None


def test_scoring_method_matches_published_contract(api):
    _application, client = api
    body = client.get("/scoring-method").get_json()
    assert body["categoryWeights"] == [
        {"category": "Fishing gear", "weight": 1.0},
        {"category": "Plastic", "weight": 0.85},
        {"category": "Glass", "weight": 0.7},
        {"category": "Metal", "weight": 0.6},
        {"category": "Other", "weight": 0.5},
        {"category": "Paper", "weight": 0.35},
    ]
    assert body["windowDays"] == 90
    assert body["minReports"] == 3
    assert [band["range"] for band in body["bands"]] == ["below 1.5", "1.5 – <2.5", "2.5 – <3.5", "3.5 and above"]
    assert body["reportAggregation"] == "max"
    assert body["beachAggregation"] == "median"
    assert body["ruleVersion"] == "radar-sampah-scoring-v2"


def test_photo_upload_strips_metadata_resizes_and_uses_signed_url(api):
    _application, client = api
    _session, headers = signup(client)
    uploaded = upload(client, headers, size=(3000, 1000), with_metadata=True)
    assert re.fullmatch(r"[0-9a-f]{32}\.jpg", uploaded["photoKey"])
    assert uploaded["metadataStripped"] is True

    unsigned = client.get("/uploads/photos/" + uploaded["photoKey"])
    assert unsigned.status_code == 401

    url = urlsplit(uploaded["previewUrl"])
    response = client.get(url.path + "?" + url.query)
    assert response.status_code == 200
    with Image.open(io.BytesIO(response.data)) as processed:
        assert max(processed.size) <= 2048
        assert not processed.getexif()


def test_photo_preview_url_can_be_renewed_by_owner(api):
    _application, client = api
    _session, headers = signup(client)
    uploaded = upload(client, headers)

    renewed = client.get(
        "/uploads/photos/" + uploaded["photoKey"] + "/preview-url",
        headers=headers,
    )
    assert renewed.status_code == 200
    refreshed_url = renewed.get_json()["previewUrl"]
    assert refreshed_url != uploaded["previewUrl"] or "token=" in refreshed_url

    url = urlsplit(refreshed_url)
    assert client.get(url.path + "?" + url.query).status_code == 200

    _other_session, other_headers = signup(client)
    forbidden = client.get(
        "/uploads/photos/" + uploaded["photoKey"] + "/preview-url",
        headers=other_headers,
    )
    assert forbidden.status_code == 404
    assert forbidden.get_json()["code"] == "NOT_FOUND"


def test_empty_photo_is_rejected(api):
    _application, client = api
    _session, headers = signup(client)
    response = client.post(
        "/uploads/photos",
        headers=headers,
        data={"photo": (io.BytesIO(b""), "empty.jpg")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION_FAILED"


def test_photo_upload_error_codes(api):
    _application, client = api
    _session, headers = signup(client)
    unsupported = client.post(
        "/uploads/photos",
        headers=headers,
        data={"photo": (io.BytesIO(b"not an image"), "photo.gif")},
        content_type="multipart/form-data",
    )
    assert unsupported.status_code == 400
    assert unsupported.get_json()["code"] == "PHOTO_UNSUPPORTED_TYPE"

    oversized = client.post(
        "/uploads/photos",
        headers=headers,
        data={"photo": (io.BytesIO(b"x" * (10 * 1024 * 1024 + 1)), "photo.jpg")},
        content_type="multipart/form-data",
    )
    assert oversized.status_code == 400
    assert oversized.get_json()["code"] == "PHOTO_TOO_LARGE"


def test_unattached_photo_is_swept_after_24_hours(api):
    application, client = api
    _session, headers = signup(client)
    uploaded = upload(client, headers)
    directory = application.extensions["photo_storage_dir"]
    metadata_value = read_photo_metadata(directory, uploaded["photoKey"])
    metadata_value["createdAt"] = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    write_photo_metadata(directory, uploaded["photoKey"], metadata_value)

    sweep_orphan_photos(application.extensions["marine_engine"], directory)
    assert not photo_file_path(directory, uploaded["photoKey"]).exists()


def test_create_report_returns_full_contract_and_hides_private_fields(api):
    application, client = api
    _session, headers = signup(client)
    uploaded = upload(client, headers)
    payload = report_payload(
        uploaded["photoKey"],
        quantities={"Plastic": "Very Large", "Fishing gear": "Small", "Paper": "Large"},
        location_source="gps",
    )
    response = client.post("/reports", headers=headers, json=payload)
    assert response.status_code == 201
    report = response.get_json()
    assert report["status"] == "Counted"
    assert report["quantities"] == payload["quantities"]
    assert report["category"] == "Plastic"
    assert report["quantity"] == "Very Large"
    assert report["reportScore"] == 3.4
    assert report["categoryScores"] == {
        "Plastic": 3.4,
        "Fishing gear": 1.0,
        "Paper": 1.05,
    }
    assert report["createdAt"].endswith("+08:00")
    assert "lat" not in report and "lng" not in report and report["photoKey"] == uploaded["photoKey"]
    assert "token=" in report["photoUrl"]

    engine = application.extensions["marine_engine"]
    with engine.connect() as connection:
        row = connection.execute(select(reports_table)).one()
    assert row.lat == 2.746
    assert row.lng == 101.44


def test_duplicate_rule_and_counts(api):
    _application, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)
    payload = report_payload(photo["photoKey"])
    first = client.post("/reports", headers=headers, json=payload).get_json()
    second = client.post("/reports", headers=headers, json=payload).get_json()
    assert first["status"] == "Counted"
    assert second["status"] == "Duplicate"
    assert second["statusNote"] == (
        "Same participant, beach and local day as an existing counted report. "
        "Saved here but excluded from the beach score."
    )
    assert client.get("/reports/mine/counts", headers=headers).get_json() == {
        "counted": 1,
        "duplicate": 1,
        "incomplete": 0,
    }
    duplicate_only = client.get("/reports/mine?status=Duplicate", headers=headers).get_json()
    assert [item["id"] for item in duplicate_only] == [second["id"]]


def test_duplicate_rule_is_scoped_to_reporter(api):
    _application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)
    first_photo = upload(client, first_headers)
    second_photo = upload(client, second_headers)
    assert client.post("/reports", headers=first_headers, json=report_payload(first_photo["photoKey"])).get_json()["status"] == "Counted"
    assert client.post("/reports", headers=second_headers, json=report_payload(second_photo["photoKey"])).get_json()["status"] == "Counted"


def test_duplicate_rule_is_scoped_to_beach_and_ignores_incomplete(api):
    application, client = api
    _session, headers = signup(client)
    first_photo = upload(client, headers)
    first = client.post("/reports", headers=headers, json=report_payload(first_photo["photoKey"])).get_json()

    other_beach_photo = upload(client, headers)
    other_beach = client.post(
        "/reports",
        headers=headers,
        json=report_payload(other_beach_photo["photoKey"], beach_id="remis"),
    ).get_json()
    assert first["status"] == "Counted"
    assert other_beach["status"] == "Counted"

    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(
            reports_table.update().where(reports_table.c.id == first["id"]).values(status="Incomplete")
        )

    after_incomplete_photo = upload(client, headers)
    after_incomplete = client.post(
        "/reports",
        headers=headers,
        json=report_payload(after_incomplete_photo["photoKey"]),
    ).get_json()
    assert after_incomplete["status"] == "Counted"


def test_duplicate_rule_resets_on_a_new_local_day(api):
    application, client = api
    _session, headers = signup(client)
    first_photo = upload(client, headers)
    first = client.post("/reports", headers=headers, json=report_payload(first_photo["photoKey"])).get_json()
    engine = application.extensions["marine_engine"]
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    with engine.begin() as connection:
        connection.execute(
            reports_table.update().where(reports_table.c.id == first["id"]).values(created_at=yesterday)
        )
    second_photo = upload(client, headers)
    second = client.post("/reports", headers=headers, json=report_payload(second_photo["photoKey"])).get_json()
    assert first["status"] == "Counted"
    assert second["status"] == "Counted"


def test_photo_key_is_private_to_uploader(api):
    _application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)
    first_photo = upload(client, first_headers)
    response = client.post("/reports", headers=second_headers, json=report_payload(first_photo["photoKey"]))
    assert response.status_code == 404
    assert response.get_json()["code"] == "NOT_FOUND"


def test_patch_enforces_ownership_and_rechecks_status(api):
    application, client = api
    _owner, owner_headers = signup(client)
    _other, other_headers = signup(client)
    photo = upload(client, owner_headers)
    report = client.post("/reports", headers=owner_headers, json=report_payload(photo["photoKey"])).get_json()

    forbidden = client.patch("/reports/" + report["id"], headers=other_headers, json={"quantities": {"Glass": "Small"}})
    assert forbidden.status_code == 403
    assert forbidden.get_json()["code"] == "NOT_OWNER"

    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(
            reports_table.update().where(reports_table.c.id == report["id"]).values(status="Incomplete")
        )
    corrected = client.patch("/reports/" + report["id"], headers=owner_headers, json={"quantities": {"Glass": "Small"}})
    assert corrected.status_code == 200
    assert corrected.get_json()["status"] == "Counted"


def test_beach_attention_uses_median_report_scores_and_latest_composition(api):
    _application, client = api
    report_ids = []
    for quantities in (
        {"Fishing gear": "Small"},
        {"Fishing gear": "Small", "Paper": "Small"},
        {"Fishing gear": "Large"},
    ):
        _session, headers = signup(client)
        photo = upload(client, headers)
        report = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"], quantities=quantities)).get_json()
        report_ids.append(report["id"])

    morib = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert morib["validReports"] == 3
    assert morib["severity"] == "Low"
    assert morib["band"] == 1
    assert morib["attentionScore"] == 1.0
    assert morib["eligibleReportCount"] == 3
    assert morib["insufficientData"] is False

    detail = client.get("/beaches/morib").get_json()
    assert detail["composition"] == [
        {"category": "Fishing gear", "quantity": "Large"},
    ]
    assert detail["compositionSource"]["reportId"] == report_ids[-1]


def test_beach_attention_uses_median_for_even_count(api):
    _application, client = api
    for quantities in (
        {"Fishing gear": "Small"},
        {"Fishing gear": "Small"},
        {"Fishing gear": "Large"},
        {"Fishing gear": "Very Large"},
    ):
        _session, headers = signup(client)
        photo = upload(client, headers)
        assert client.post("/reports", headers=headers, json=report_payload(photo["photoKey"], quantities=quantities)).status_code == 201

    morib = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert morib["attentionScore"] == 2.0
    assert morib["severity"] == "Moderate"


def test_old_counted_report_is_not_eligible_but_still_drives_freshness(api):
    application, client = api
    session, _headers = signup(client)
    old_time = datetime.now(timezone.utc) - timedelta(days=100)
    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(
            insert(reports_table).values(
                id="r_old",
                reporter_id=session["user"]["id"],
                beach_id="morib",
                photo_mime="image/jpeg",
                photo_stripped=True,
                qty_plastic="Large",
                category="Plastic",
                quantity="Large",
                photo_key="legacy-photo-key",
                location_source="manual",
                status="Counted",
                created_at=old_time,
                updated_at=old_time,
            )
        )
    morib = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert morib["validReports"] == 0
    assert morib["severity"] is None
    assert morib["lastReportedAt"] is not None
    assert morib["freshnessKind"] == "stale"


def test_report_validation_errors_are_contract_shaped(api):
    _application, client = api
    _session, headers = signup(client)
    missing_photo = client.post(
        "/reports",
        headers=headers,
        json={"beachId": "morib", "quantities": {"Plastic": "Small"}, "locationSource": "manual"},
    )
    assert missing_photo.status_code == 400
    assert missing_photo.get_json()["code"] == "PHOTO_REQUIRED"
    assert set(missing_photo.get_json()) == {"code", "message"}

    invalid_filter = client.get("/reports/mine?status=Pending", headers=headers)
    assert invalid_filter.status_code == 400
    assert invalid_filter.get_json()["code"] == "VALIDATION_FAILED"


def test_report_rate_limit_is_per_user(api):
    _application, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)
    payload = report_payload(photo["photoKey"])
    for _ in range(30):
        assert client.post("/reports", headers=headers, json=payload).status_code == 201
    limited = client.post("/reports", headers=headers, json=payload)
    assert limited.status_code == 429
    assert limited.get_json()["code"] == "RATE_LIMITED"
