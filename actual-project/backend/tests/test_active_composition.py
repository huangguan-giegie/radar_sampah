"""Regression tests for current unresolved litter composition."""

from __future__ import annotations

from pathlib import Path
import sys

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, signup, upload


def _submit_count_report(client, counts):
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
    return detail, {row["category"]: row["percentage"] for row in detail["composition"]}


def test_composition_uses_same_active_reports_and_remaining_bands_as_attention(api):
    _application, client = api

    plastic, plastic_headers = _submit_count_report(client, {"Plastic": 6})
    _metal, metal_headers = _submit_count_report(client, {"Metal": 1})
    glass, glass_headers = _submit_count_report(client, {"Glass": 21})

    detail, composition = _composition_by_category(client)
    assert composition == {"Plastic": 33, "Glass": 50, "Metal": 17}
    assert detail["compositionSource"] == {
        "method": "active_report_estimate",
        "activeReportCount": 3,
        "windowDays": 90,
    }

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
    assert composition == {"Plastic": 33, "Glass": 50, "Metal": 17}

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
    assert composition == {"Plastic": 20, "Glass": 60, "Metal": 20}
    assert detail["compositionSource"]["activeReportCount"] == 3

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
    assert composition == {"Plastic": 50, "Metal": 50}
    assert detail["compositionSource"] == {
        "method": "active_report_estimate",
        "activeReportCount": 2,
        "windowDays": 90,
    }
