"""Fields the Iteration 2 prototype screens need, added to the existing routes."""

import sys
from pathlib import Path

from sqlalchemy import select, update

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api, report_payload, signup, upload
from app import users_table


def _submit(client, headers, photo_key, quantities, location_source="manual"):
    response = client.post(
        "/reports",
        headers=headers,
        json=report_payload(photo_key, quantities=quantities, location_source=location_source),
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()


def test_beach_composition_rows_carry_the_highest_current_band(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    _submit(client, headers, photo["photoKey"], {"Plastic": "Medium", "Glass": "Very Large"})
    _submit(client, headers, photo["photoKey"], {"Plastic": "Large"})

    detail = client.get("/beaches/morib").get_json()
    rows = {row["category"]: row for row in detail["composition"]}

    assert rows["Plastic"]["band"] == "Large"
    assert rows["Glass"]["band"] == "Very Large"
    assert sum(row["percentage"] for row in detail["composition"]) == 100


def test_recent_report_bands_archive_the_newest_reports(api):
    _application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    for band in ("Medium", "Large", "Very Large", "Large", "Medium"):
        _submit(client, headers, photo["photoKey"], {"Plastic": band})

    detail = client.get("/beaches/morib").get_json()
    archived = detail["recentReportBands"]

    assert len(archived) == 4
    assert archived[0]["bands"] == {"Plastic": "Medium"}
    # Newest first.
    assert [entry["reportedAt"] for entry in archived] == sorted(
        (entry["reportedAt"] for entry in archived), reverse=True
    )

    # The archive is the history of what volunteers recorded, so cleaning a
    # report up must not remove its band. A beach with no public band is usually
    # a beach whose reports were all cleaned.
    cleared = archived[0]["reportId"]
    response = client.post("/cleanup-actions", headers=headers, json={
        "targetReportId": cleared,
        "remainingQuantities": {"Plastic": "Small"},
        "handling": "Collected for disposal",
        "idempotencyKey": "archive-clear",
    })
    assert response.status_code == 201

    refreshed = client.get("/beaches/morib").get_json()["recentReportBands"]
    kept = next(entry for entry in refreshed if entry["reportId"] == cleared)
    assert kept["bands"] == {"Plastic": "Medium"}


def test_recent_report_bands_still_show_a_cleared_beach(api):
    _application, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    for index, band in enumerate(("Large", "Very Large", "Large")):
        report = _submit(client, headers, photo["photoKey"], {"Plastic": band})
        response = client.post("/cleanup-actions", headers=headers, json={
            "targetReportId": report["id"],
            "remainingQuantities": {"Plastic": "Small"},
            "handling": "Collected for disposal",
            "idempotencyKey": f"cleared-archive-{index}",
        })
        assert response.status_code == 201

    detail = client.get("/beaches/morib").get_json()

    assert detail["severity"] is None and detail["insufficientData"] is True
    assert [entry["bands"] for entry in detail["recentReportBands"]] == [
        {"Plastic": "Large"},
        {"Plastic": "Very Large"},
        {"Plastic": "Large"},
    ]


def test_gallery_entries_carry_report_metadata(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers, with_metadata=True)
    submitted = _submit(client, headers, photo["photoKey"], {"Plastic": "Large", "Glass": "Small"})

    gallery = client.get("/beaches/morib/litter-gallery").get_json()
    entry = next(item for item in gallery if item["reportId"] == submitted["id"])

    assert entry["categories"] == ["Plastic", "Glass"]
    assert entry["bands"] == {"Plastic": "Large", "Glass": "Small"}
    assert entry["status"] == "Counted"
    assert entry["metadataStripped"] is True
    # The public gallery stays unattributed on purpose.
    assert "participantId" not in entry
    assert "lat" not in entry and "lng" not in entry and "proximityRef" not in entry


def test_create_report_reports_a_nearby_match_that_moved_the_reference(api):
    _, client = api
    _, headers = signup(client)
    first_photo = upload(client, headers)
    first = _submit(client, headers, first_photo["photoKey"], {"Plastic": "Large"}, "gps")
    assert "nearbyReportFound" not in first

    second_photo = upload(client, headers)
    second = _submit(client, headers, second_photo["photoKey"], {"Plastic": "Medium"}, "gps")

    assert second["nearbyReportFound"] is True
    assert second["locationReferenceUpdated"] is True
    assert second["status"] == "Counted"
    # The other report is never identified in the response.
    assert "nearbyReportId" not in second


def test_duplicate_note_describes_the_rule_the_api_applies(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    _submit(client, headers, photo["photoKey"], {"Plastic": "Large"}, "gps")
    duplicate = _submit(client, headers, photo["photoKey"], {"Plastic": "Large"}, "gps")

    assert duplicate["status"] == "Duplicate"
    note = duplicate["statusNote"]
    assert "10 metres" in note
    assert "current categories and quantity bands" in note
    assert "left out of the beach rating" in note


def test_event_payload_carries_an_optional_meeting_point(api):
    application, client = api
    session, headers = signup(client)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(update(users_table).where(users_table.c.id == session["user"]["id"]).values(role="moderator"))

    created = client.post(
        "/events",
        headers=headers,
        json={"beachId": "remis", "date": "2026-11-07", "meetingPoint": "  Meet at the car park entrance  "},
    )
    assert created.status_code == 201, created.get_data(as_text=True)
    event_id = created.get_json()["id"]

    listed = client.get("/cleanup-events/" + event_id).get_json()
    assert listed["meetingPoint"] == "Meet at the car park entrance"
    assert listed["startsAt"] and listed["endsAt"]

    scheduled = client.get("/cleanup-events").get_json()[0]
    assert "meetingPoint" in scheduled

    too_long = client.post(
        "/events",
        headers=headers,
        json={"beachId": "kelanang", "date": "2026-11-14", "meetingPoint": "x" * 161},
    )
    assert too_long.status_code == 400
