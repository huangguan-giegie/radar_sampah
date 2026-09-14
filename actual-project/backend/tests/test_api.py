"""Iteration 2 API test suite with reviewed contract corrections.

The teammate's full suite is kept byte-for-byte in ``api_tests_core.py``. We
load it here, remove only the two obsolete ID-only recovery expectations, and
add regression coverage for strict recovery, exact duplicates, restart repair,
and cleanup-aware median scoring.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path


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
