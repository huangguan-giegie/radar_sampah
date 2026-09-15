"""Iteration 2 API test suite with reviewed contract corrections.

The teammate's full suite is kept in ``api_tests_core.py``. We load it here,
remove obsolete expectations, then add regression coverage for the reviewed
contracts.
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

for _obsolete in (
    "test_restore_accepts_current_id_only_contract_and_rejects_wrong_optional_token",
    "test_id_only_restore_matches_current_main_and_optional_token_is_checked",
    "test_partial_main_database_is_migrated_to_contract_rules",
    "test_iteration2_gps_rejects_a_report_near_an_active_target",
    "test_beach_attention_uses_median_report_scores_and_latest_composition",
    "test_beach_attention_uses_median_for_even_count",
    "test_report_validation_errors_are_contract_shaped",
    "test_share_links_are_stable_and_scoped_to_one_event_and_report",
):
    globals().pop(_obsolete, None)


def test_iteration2_scoring_metadata_publishes_active_report_rule(api):
    _application, client = api
    body = client.get("/scoring-method/iteration2").get_json()
    assert body["ruleVersion"] == "radar-sampah-scoring-i2-v3"
    assert body["remainingCountAggregation"] == "per-report-after-cleanup"
    assert body["beachAggregation"] == "median-of-active-reports"
    assert "fully cleared count-backed reports are excluded" in body["reportEligibility"]


def test_restore_requires_recovery_token(api):
    _application, client = api
    session, _headers = signup(client)
    participant_id = session["user"]["participantId"]

    missing = client.post("/auth/restore", json={"participantId": participant_id})
    wrong = client.post("/auth/restore", json={"participantId": participant_id, "token": "RS-WRONG-TOKEN"})
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


def test_beach_attention_even_count_uses_non_small_reports_only(api):
    _application, client = api
    for quantities in (
        {"Fishing gear": "Medium"},
        {"Fishing gear": "Medium"},
        {"Fishing gear": "Large"},
        {"Fishing gear": "Very Large"},
    ):
        _session, headers = signup(client)
        photo = upload(client, headers)
        response = client.post(
            "/reports",
            headers=headers,
            json=report_payload(photo["photoKey"], quantities=quantities),
        )
        assert response.status_code == 201

    morib = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert morib["attentionScore"] == 2.5
    assert morib["severity"] == "High"
    assert morib["eligibleReportCount"] == 4


def test_report_validation_errors_remain_contract_shaped_with_band_contract(api):
    _application, client = api
    _session, headers = signup(client)
    missing_photo = client.post(
        "/reports",
        headers=headers,
        json={"beachId": "morib", "quantities": {"Plastic": "Medium"}, "locationSource": "manual"},
    )
    assert missing_photo.status_code == 400
    assert missing_photo.get_json()["code"] == "PHOTO_REQUIRED"
    assert set(missing_photo.get_json()) == {"code", "message"}

    invalid_filter = client.get("/reports/mine?status=Pending", headers=headers)
    assert invalid_filter.status_code == 400
    assert invalid_filter.get_json()["code"] == "VALIDATION_FAILED"


def test_share_links_still_work_for_legacy_count_backed_non_small_reports(api):
    _application, client = api
    _session, headers = signup(client)
    event = next(item for item in client.get("/events?beachId=morib").get_json() if item["beachId"] == "morib")

    first_photo = upload(client, headers)
    first_payload = report_payload(first_photo["photoKey"], quantities={"Plastic": "Medium"})
    first_payload["itemCounts"] = {"Plastic": 8}
    first_report = client.post("/reports", headers=headers, json=first_payload)
    assert first_report.status_code == 201
    first_id = first_report.get_json()["id"]
    assert client.get(f"/share-links?reportId={first_id}").status_code == 404
    _other_session, other_headers = signup(client)
    assert client.get(f"/share-links?reportId={first_id}", headers=other_headers).status_code == 404

    second_photo = upload(client, headers)
    second_payload = report_payload(second_photo["photoKey"], beach_id="remis", quantities={"Glass": "Medium"})
    second_payload["itemCounts"] = {"Glass": 8}
    second_report = client.post("/reports", headers=headers, json=second_payload)
    assert second_report.status_code == 201
    second_id = second_report.get_json()["id"]

    query = f"/share-links?eventId={event['id']}&reportId={first_id}"
    first_link = client.get(query, headers=headers)
    retry_link = client.get(query, headers=headers)
    assert first_link.status_code == retry_link.status_code == 200
    share = first_link.get_json()
    assert share["token"] == retry_link.get_json()["token"]
    assert share["path"] == f"/share/{share['token']}"

    shared = client.get(f"/share-links/{share['token']}")
    assert shared.status_code == 200
    body = shared.get_json()
    assert body["event"]["id"] == event["id"]
    assert body["report"]["id"] == first_id
    assert body["report"]["remainingItemCounts"] == {"Plastic": 8}
    assert body["report"]["photoAvailable"] is True
    assert second_id not in shared.get_data(as_text=True)

    photo_response = client.get(f"/share-links/{share['token']}/photo")
    assert photo_response.status_code == 200
    assert photo_response.mimetype == "image/jpeg"
    assert photo_response.headers["Cache-Control"] == "private, no-store"

    token = share["token"]
    forged = token[:-1] + ("A" if token[-1] != "A" else "B")
    assert client.get(f"/share-links/{forged}").status_code == 404
    mismatch = client.get(f"/share-links?eventId={event['id']}&reportId={second_id}", headers=headers)
    assert mismatch.status_code == 400


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

    first = submit({"Plastic": "Medium"})
    different_quantity = submit({"Plastic": "Large"})
    exact_repeat = submit({"Plastic": "Medium"})

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
        "/reports", headers=headers,
        json=report_payload(first_photo["photoKey"], quantities={"Plastic": "Medium"}),
    )
    second = client.post(
        "/reports", headers=headers,
        json=report_payload(second_photo["photoKey"], quantities={"Plastic": "Large"}),
    )
    assert first.get_json()["status"] == "Counted"
    assert second.get_json()["status"] == "Counted"

    restarted = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=photo_dir,
    )
    restarted_client = restarted.test_client()
    statuses = [report["status"] for report in restarted_client.get("/reports/mine", headers=headers).get_json()]
    assert statuses == ["Counted", "Counted"]


def test_cleanup_recomputes_each_report_then_keeps_beach_median(api):
    _application, client = api
    created = []
    headers_by_report = []
    for counts in (
        {"Plastic": 6},
        {"Fishing gear": 8},
        {"Fishing gear": 60},
    ):
        _session, headers = signup(client)
        photo = upload(client, headers)
        response = client.post(
            "/reports",
            headers=headers,
            json={"beachId": "morib", "photoKey": photo["photoKey"], "locationSource": "manual", "itemCounts": counts},
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
    assert after["attentionScore"] is None
    assert after["severity"] is None
    assert after["band"] is None
    assert after["eligibleReportCount"] == 2
    assert after["validReports"] == 2


def test_fully_cleared_reports_are_excluded_from_five_report_median(api):
    _application, client = api
    created = []
    headers_by_report = []
    for counts in (
        {"Plastic": 1},
        {"Fishing gear": 1},
        {"Plastic": 6},
        {"Fishing gear": 8},
        {"Fishing gear": 21},
    ):
        _session, headers = signup(client)
        photo = upload(client, headers)
        response = client.post(
            "/reports",
            headers=headers,
            json={"beachId": "morib", "photoKey": photo["photoKey"], "locationSource": "manual", "itemCounts": counts},
        )
        assert response.status_code == 201
        created.append(response.get_json())
        headers_by_report.append(headers)

    for index, removed in enumerate(({"Plastic": 1}, {"Fishing gear": 1})):
        response = client.post(
            "/cleanup-actions",
            headers=headers_by_report[index],
            json={
                "targetReportId": created[index]["id"],
                "removed": removed,
                "handling": "Collected for disposal",
                "idempotencyKey": f"five-report-cleared-{index}",
            },
        )
        assert response.status_code == 201

    morib = next(item for item in client.get("/beaches").get_json() if item["id"] == "morib")
    assert morib["eligibleReportCount"] == 3
    assert morib["validReports"] == 3
    assert morib["attentionScore"] == 2.0
    assert morib["severity"] == "Moderate"


def _submit_gps_item_count_report(client, headers, *, lat, lng, item_counts):
    photo = upload(client, headers)
    return client.post(
        "/reports",
        headers=headers,
        json={
            "beachId": "morib",
            "photoKey": photo["photoKey"],
            "locationSource": "gps",
            "coords": {"lat": lat, "lng": lng},
            "itemCounts": item_counts,
        },
    )


def test_same_day_nearby_gps_reports_are_duplicate_across_users(api):
    _application, client = api
    _first_session, first_headers = signup(client)
    _second_session, second_headers = signup(client)

    first = _submit_gps_item_count_report(client, first_headers, lat=2.74614, lng=101.44024, item_counts={"Plastic": 2})
    second = _submit_gps_item_count_report(client, second_headers, lat=2.74620, lng=101.44024, item_counts={"Metal": 7})

    assert first.status_code == 201
    assert first.get_json()["status"] == "Counted"
    assert second.status_code == 201
    assert second.get_json()["status"] == "Duplicate"


def test_prior_day_nearby_active_target_still_conflicts(api):
    application, client = api
    _first_session, first_headers = signup(client)
    _second_session, second_headers = signup(client)

    first = _submit_gps_item_count_report(client, first_headers, lat=2.74614, lng=101.44024, item_counts={"Plastic": 2})
    assert first.status_code == 201

    prior_day = datetime.now(timezone.utc) - timedelta(days=1)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(
            reports_table.update()
            .where(reports_table.c.id == first.get_json()["id"])
            .values(created_at=prior_day, updated_at=prior_day)
        )

    second = _submit_gps_item_count_report(client, second_headers, lat=2.74620, lng=101.44024, item_counts={"Metal": 7})

    assert second.status_code == 409
    assert second.get_json()["code"] == "ACTIVE_CLEANUP_TARGET_NEARBY"
