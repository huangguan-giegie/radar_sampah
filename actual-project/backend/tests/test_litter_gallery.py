from __future__ import annotations

import json
from pathlib import Path
import sys
from urllib.parse import urlsplit

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, signup, upload


def _create_report(client, headers, *, beach_id: str, quantities: dict[str, str], location_source: str = "manual", coords=None):
    photo = upload(client, headers)
    body = {
        "beachId": beach_id,
        "photoKey": photo["photoKey"],
        "locationSource": location_source,
        "quantities": quantities,
    }
    if coords is not None:
        body["coords"] = coords
    response = client.post("/reports", headers=headers, json=body)
    return response, photo


def test_litter_gallery_is_beach_scoped_and_exposes_only_minimal_metadata(api):
    _application, client = api
    _morib_session, morib_headers = signup(client)
    _remis_session, remis_headers = signup(client)

    morib, _morib_photo = _create_report(
        client,
        morib_headers,
        beach_id="morib",
        quantities={"Plastic": "Medium"},
    )
    remis, _remis_photo = _create_report(
        client,
        remis_headers,
        beach_id="remis",
        quantities={"Glass": "Large"},
    )
    assert morib.status_code == remis.status_code == 201

    response = client.get("/beaches/morib/litter-gallery")

    assert response.status_code == 200
    entries = response.get_json()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["reportId"] == morib.get_json()["id"]
    assert entry["reportedAt"].endswith("+08:00")
    assert entry["photoUrl"].startswith(f"/beaches/morib/litter-gallery/{entry['reportId']}/photo?")
    assert remis.get_json()["id"] not in json.dumps(entries)
    serialized = json.dumps(entries).lower()
    for forbidden in ("photokey", "reporter", "participant", "proximityref", '"lat"', '"lng"'):
        assert forbidden not in serialized

    photo = client.get(entry["photoUrl"])
    assert photo.status_code == 200
    assert photo.mimetype == "image/jpeg"
    assert photo.headers["Cache-Control"] == "private, no-store"

    unsigned_path = urlsplit(entry["photoUrl"]).path
    unsigned = client.get(unsigned_path)
    assert unsigned.status_code == 401


def test_litter_gallery_keeps_resolved_history_but_excludes_duplicate_reports(api):
    _application, client = api
    _first_session, first_headers = signup(client)
    _second_session, second_headers = signup(client)

    first, _first_photo = _create_report(
        client,
        first_headers,
        beach_id="morib",
        quantities={"Plastic": "Medium"},
        location_source="gps",
        coords={"lat": 2.74614, "lng": 101.44024},
    )
    duplicate, _duplicate_photo = _create_report(
        client,
        second_headers,
        beach_id="morib",
        quantities={"Plastic": "Medium"},
        location_source="gps",
        coords={"lat": 2.74619, "lng": 101.44024},
    )
    assert first.status_code == duplicate.status_code == 201
    assert first.get_json()["status"] == "Counted"
    assert duplicate.get_json()["status"] == "Duplicate"

    cleanup = client.post(
        "/cleanup-actions",
        headers=first_headers,
        json={
            "targetReportId": first.get_json()["id"],
            "remainingQuantities": {"Plastic": "Small"},
            "handling": "Collected for disposal",
            "idempotencyKey": "gallery-resolved-history",
        },
    )
    assert cleanup.status_code == 201
    assert cleanup.get_json()["resolved"] is True

    entries = client.get("/beaches/morib/litter-gallery").get_json()
    ids = [entry["reportId"] for entry in entries]
    assert first.get_json()["id"] in ids
    assert duplicate.get_json()["id"] not in ids


def test_standalone_cleanup_does_not_create_gallery_media(api):
    _application, client = api
    _session, headers = signup(client)

    before = client.get("/beaches/kelanang/litter-gallery")
    assert before.status_code == 200
    assert before.get_json() == []

    cleanup = client.post(
        "/cleanup-actions",
        headers=headers,
        json={
            "beachId": "kelanang",
            "removedQuantities": {"Plastic": "Medium"},
            "handling": "Collected for disposal",
            "idempotencyKey": "gallery-no-cleanup-media",
        },
    )
    assert cleanup.status_code == 201

    after = client.get("/beaches/kelanang/litter-gallery")
    assert after.status_code == 200
    assert after.get_json() == []


def test_litter_gallery_unknown_beach_is_not_found(api):
    _application, client = api

    response = client.get("/beaches/not-a-beach/litter-gallery")

    assert response.status_code == 404
    assert response.get_json()["code"] == "NOT_FOUND"
