from __future__ import annotations

from pathlib import Path
import sys

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, signup, upload


def _create_report(client, headers, payload):
    photo = upload(client, headers)
    body = {
        "beachId": "morib",
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


def test_new_report_rejects_exact_count_only_contract(api):
    _application, client = api
    _session, headers = signup(client)

    response = _create_report(client, headers, {"itemCounts": {"Plastic": 8}})

    assert response.status_code == 422
    assert response.get_json()["code"] == "QUANTITY_BANDS_REQUIRED"


def test_small_only_report_is_not_persisted_as_counted_evidence(api):
    _application, client = api
    _session, headers = signup(client)

    response = _create_report(client, headers, {"quantities": {"Plastic": "Small"}})

    assert response.status_code == 422
    assert response.get_json()["code"] == "SMALL_ONLY_REPORT"
    assert client.get("/reports/mine", headers=headers).get_json() == []
