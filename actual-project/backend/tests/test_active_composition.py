"""Regression tests for current unresolved litter composition."""

from __future__ import annotations

from pathlib import Path
import sys

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, signup, upload


def _submit_count_report(client, counts):
    """Legacy count-backed fixture retained to prove compatibility normalisation."""
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
    return response.get_json(), headers


def _composition_by_category(client):
    detail = client.get("/beaches/morib").get_json()
    composition = detail["composition"] or []
    return detail, {row["category"]: row["percentage"] for row in composition}


def test_composition_uses_same_non_small_active_evidence_as_attention(api):
    _application, client = api

    plastic, plastic_headers = _submit_count_report(client, {"Plastic": 6})      # Medium
    _metal, metal_headers = _submit_count_report(client, {"Metal": 1})           # Small: inactive
    glass, glass_headers = _submit_count_report(client, {"Glass": 21})           # Large

    detail, composition = _composition_by_category(client)
    assert composition == {"Plastic": 40, "Glass": 60}
    assert detail["compositionSource"] == {
        "method": "active_report_estimate",
        "activeReportCount": 2,
        "windowDays": 90,
    }

    # A standalone cleanup never subtracts from unrelated report evidence.
    standalone = client.post(
        "/cleanup-actions",
        headers=metal_headers,
        json={
            "beachId": "morib",
            "removed": {"Plastic": 50},
            "handling": "Collected for disposal",
            "idempotencyKey": "composition-standalone-cleanup",
        },
    )
    assert standalone.status_code == 201
    assert standalone.get_json()["targetReportId"] is None

    _detail, composition = _composition_by_category(client)
    assert composition == {"Plastic": 40, "Glass": 60}

    # Reducing the Medium Plastic legacy target to one remaining item re-bands it
    # to Small, so it leaves the active composition without deleting history.
    partial = client.post(
        "/cleanup-actions",
        headers=plastic_headers,
        json={
            "targetReportId": plastic["id"],
            "removed": {"Plastic": 5},
            "handling": "Collected for disposal",
            "idempotencyKey": "composition-partial-cleanup",
        },
    )
    assert partial.status_code == 201

    detail, composition = _composition_by_category(client)
    assert composition == {"Glass": 100}
    assert detail["compositionSource"]["activeReportCount"] == 1

    cleared = client.post(
        "/cleanup-actions",
        headers=glass_headers,
        json={
            "targetReportId": glass["id"],
            "removed": {"Glass": 21},
            "handling": "Collected for disposal",
            "idempotencyKey": "composition-full-cleanup",
        },
    )
    assert cleared.status_code == 201

    detail, composition = _composition_by_category(client)
    assert composition == {}
    assert detail["composition"] is None
    assert detail["compositionSource"] is None
