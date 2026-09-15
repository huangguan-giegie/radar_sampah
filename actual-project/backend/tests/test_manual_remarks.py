from __future__ import annotations

from pathlib import Path
import sys

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, signup, upload


def _create_report(client, headers, payload, beach_id="morib"):
    photo = upload(client, headers)
    body = {
        "beachId": beach_id,
        "photoKey": photo["photoKey"],
        "locationSource": "manual",
        **payload,
    }
    return client.post("/reports", headers=headers, json=body)


def test_new_report_accepts_quantity_bands_without_exact_counts(api):
    _application, client = api
    _session, headers = signup(client)

    response = _create_report(
        client,
        headers,
        {"quantities": {"Plastic": "Medium", "Glass": "Large"}},
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["quantities"] == {"Plastic": "Medium", "Glass": "Large"}
    assert not body.get("itemCounts")


def test_legacy_exact_count_only_input_remains_a_compatibility_adapter(api):
    _application, client = api
    _session, headers = signup(client)

    response = _create_report(client, headers, {"itemCounts": {"Plastic": 8}})

    assert response.status_code == 201
    assert response.get_json()["quantities"] == {"Plastic": "Medium"}


def test_small_only_report_is_not_persisted_as_counted_evidence(api):
    _application, client = api
    _session, headers = signup(client)

    response = _create_report(client, headers, {"quantities": {"Plastic": "Small"}})

    assert response.status_code == 422
    assert response.get_json()["code"] == "SMALL_ONLY_REPORT"
    assert client.get("/reports/mine", headers=headers).get_json() == []


def test_linked_cleanup_accepts_remaining_bands_and_logically_resolves_target(api):
    _application, client = api
    _session, headers = signup(client)
    report_response = _create_report(
        client,
        headers,
        {"quantities": {"Plastic": "Medium", "Glass": "Large"}},
    )
    assert report_response.status_code == 201
    report = report_response.get_json()

    cleanup = client.post(
        "/cleanup-actions",
        headers=headers,
        json={
            "targetReportId": report["id"],
            "remainingQuantities": {"Plastic": "Small", "Glass": "Small"},
            "handling": "Collected for disposal",
            "idempotencyKey": "manual-remarks-linked-bands",
        },
    )

    assert cleanup.status_code == 201
    body = cleanup.get_json()
    assert body["remainingQuantities"] == {"Plastic": "Small", "Glass": "Small"}
    assert body["resolved"] is True
    assert body["score"] == 3

    # Audit evidence stays available even though the active target is resolved.
    mine = client.get("/reports/mine", headers=headers).get_json()
    assert any(item["id"] == report["id"] for item in mine)
    targets = client.get("/cleanup-targets?beachId=morib", headers=headers).get_json()
    assert all(item["reportId"] != report["id"] for item in targets)


def test_standalone_cleanup_records_removed_bands_without_touching_reports(api):
    _application, client = api
    _session, headers = signup(client)

    before = client.get("/reports/mine", headers=headers).get_json()
    cleanup = client.post(
        "/cleanup-actions",
        headers=headers,
        json={
            "beachId": "kelanang",
            "removedQuantities": {"Plastic": "Large", "Glass": "Small"},
            "handling": "Collected for disposal",
            "idempotencyKey": "manual-remarks-standalone-bands",
        },
    )

    assert cleanup.status_code == 201
    body = cleanup.get_json()
    assert body["removedQuantities"] == {"Plastic": "Large", "Glass": "Small"}
    assert body["score"] == 4
    assert body["targetReportId"] is None
    assert client.get("/reports/mine", headers=headers).get_json() == before
