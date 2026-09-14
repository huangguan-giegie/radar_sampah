"""Iteration 2 API test suite with reviewed contract corrections.

The teammate's full suite is kept byte-for-byte in ``api_tests_core.py``. We
load it here, remove the obsolete ID-only recovery and broad duplicate
expectations, then add regression coverage for the reviewed contracts.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys


_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

_core_path = Path(__file__).with_name("api_tests_core.py")
_spec = importlib.util.spec_from_file_location("radar_sampah_api_tests_core", _core_path)
assert _spec is not None and _spec.loader is not None
_core = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_core)

for _name, _value in vars(_core).items():
    if not _name.startswith("__"):
        globals()[_name] = _value

globals().pop("test_restore_accepts_current_id_only_contract_and_rejects_wrong_optional_token", None)
globals().pop("test_id_only_restore_matches_current_main_and_optional_token_is_checked", None)
globals().pop("test_partial_main_database_is_migrated_to_contract_rules", None)


def test_restore_requires_recovery_token(api):
    _application, client = api
    session, _headers = signup(client)
    participant_id = session["user"]["participantId"]

    missing = client.post("/auth/restore", json={"participantId": participant_id})
    wrong = client.post(
        "/auth/restore",
        json={"participantId": participant_id, "token": "RS-WRONG-TOKEN"},
    )
    restored = client.post(
        "/auth/restore",
        json={"participantId": participant_id, "token": session["recoveryToken"]},
    )

    assert missing.status_code == 401
    assert missing.get_json()["code"] == "INVALID_RECOVERY_TOKEN"
    assert wrong.status_code == 401
    assert wrong.get_json()["code"] == "INVALID_RECOVERY_TOKEN"
    assert restored.status_code == 200
    assert restored.get_json()["user"] == session["user"]


def test_duplicate_requires_exact_same_categories_and_quantities(api):
    _application, client = api
    _session, headers = signup(client)

    def submit(quantities):
        photo = upload(client, headers)
        response = client.post(
            "/reports",
            headers=headers,
            json=report_payload(photo["photoKey"], quantities=quantities),
        )
        assert response.status_code == 201
        return response.get_json()

    first = submit({"Plastic": "Small"})
    different_quantity = submit({"Plastic": "Medium"})
    exact_repeat = submit({"Plastic": "Small"})

    assert first["status"] == "Counted"
    assert different_quantity["status"] == "Counted"
    assert exact_repeat["status"] == "Duplicate"


def test_partial_main_database_migrates_without_broad_duplicate_reclassification(tmp_path):
    database_path = tmp_path / "partial-main-exact.db"
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
    assert rows[1].status == "Counted"
    assert rows[1].qty_plastic == "Small"


def test_restart_preserves_non_exact_same_day_reports(tmp_path):
    database_path = tmp_path / "restart-exact-duplicates.db"
    photo_dir = tmp_path / "photos"
    application = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=photo_dir,
    )
    client = application.test_client()
    _session, headers = signup(client)

    first_photo = upload(client, headers)
    second_photo = upload(client, headers)
    first = client.post(
        "/reports",
        headers=headers,
        json=report_payload(first_photo["photoKey"], quantities={"Plastic": "Small"}),
    )
    second = client.post(
        "/reports",
        headers=headers,
        json=report_payload(second_photo["photoKey"], quantities={"Plastic": "Medium"}),
    )
    assert first.get_json()["status"] == "Counted"
    assert second.get_json()["status"] == "Counted"

    restarted = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=photo_dir,
    )
    restarted_client = restarted.test_client()
    statuses = [
        report["status"]
        for report in restarted_client.get("/reports/mine", headers=headers).get_json()
    ]
    assert statuses == ["Counted", "Counted"]


def test_cleanup_recomputes_each_report_then_keeps_beach_median(api):
    _application, client = api
    created = []
    headers_by_report = []
    for counts in (
        {"Plastic": 1},
        {"Fishing gear": 8},
        {"Fishing gear": 60},
    ):
        _session, headers = signup(client)
        photo = upload(client, headers)
        response = client.post(
            "/reports",
            headers=headers,
            json={
                "beachId": "morib",
                "photoKey": photo["photoKey"],
                "locationSource": "manual",
                "itemCounts": counts,
            },
        )
        assert response.status_code == 201
        created.append(response.get_json())
        headers_by_report.append(headers)

    before = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert before["attentionScore"] == 2.0
    assert before["severity"] == "Moderate"

    cleanup = client.post(
        "/cleanup-actions",
        headers=headers_by_report[0],
        json={
            "targetReportId": created[1]["id"],
            "removed": {"Fishing gear": 8},
            "handling": "Collected for disposal",
            "idempotencyKey": "median-regression-cleanup",
        },
    )
    assert cleanup.status_code == 201

    after = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert after["attentionScore"] == 0.85
    assert after["severity"] == "Low"
