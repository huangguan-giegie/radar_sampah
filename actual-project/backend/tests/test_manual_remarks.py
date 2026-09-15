from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from sqlalchemy import select

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, signup, upload
from app import create_app, events_table, reports_table


def _create_report(client, headers, payload, beach_id="morib"):
    photo = upload(client, headers)
    body = {
        "beachId": beach_id,
        "photoKey": photo["photoKey"],
        "locationSource": "manual",
        **payload,
    }
    return client.post("/reports", headers=headers, json=body)


def _create_gps_report(client, headers, quantities, *, lat=2.74614, lng=101.44024):
    return _create_report(
        client,
        headers,
        {
            "quantities": quantities,
            "locationSource": "gps",
            "coords": {"lat": lat, "lng": lng},
        },
    )


def _report_row(application, report_id):
    with application.extensions["marine_engine"].connect() as connection:
        return connection.execute(select(reports_table).where(reports_table.c.id == report_id)).one()


def _seed_attention(client, beach_id, quantities, count=3):
    created = []
    for _ in range(count):
        _session, headers = signup(client)
        response = _create_report(client, headers, {"quantities": quantities}, beach_id=beach_id)
        assert response.status_code == 201, response.get_json()
        assert response.get_json()["status"] == "Counted"
        created.append((response.get_json(), headers))
    return created


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


def test_gps_band_reports_store_only_privacy_reference(api):
    application, client = api
    _session, headers = signup(client)

    response = _create_gps_report(client, headers, {"Plastic": "Medium"})

    assert response.status_code == 201
    row = _report_row(application, response.get_json()["id"])
    assert row.lat is None and row.lng is None
    assert isinstance(row.proximity_ref, str) and len(row.proximity_ref) == 64


def test_within_10m_equal_normalized_active_map_is_duplicate(api):
    _application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)

    first = _create_gps_report(
        client,
        first_headers,
        {"Plastic": "Medium", "Glass": "Small"},
    )
    second = _create_gps_report(
        client,
        second_headers,
        {"Plastic": "Medium", "Metal": "Small"},
        lat=2.74619,
    )

    assert first.status_code == second.status_code == 201
    assert first.get_json()["status"] == "Counted"
    assert second.get_json()["status"] == "Duplicate"


def test_within_10m_changed_category_is_counted_and_refreshes_target_reference(api):
    application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)

    first = _create_gps_report(client, first_headers, {"Plastic": "Medium"})
    assert first.status_code == 201
    before_ref = _report_row(application, first.get_json()["id"]).proximity_ref

    second = _create_gps_report(client, second_headers, {"Glass": "Medium"}, lat=2.74619)

    assert second.status_code == 201
    assert second.get_json()["status"] == "Counted"
    after_ref = _report_row(application, first.get_json()["id"]).proximity_ref
    assert before_ref and after_ref and after_ref != before_ref


def test_within_10m_changed_band_is_counted(api):
    _application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)

    first = _create_gps_report(client, first_headers, {"Plastic": "Medium"})
    second = _create_gps_report(client, second_headers, {"Plastic": "Large"}, lat=2.74619)

    assert first.status_code == second.status_code == 201
    assert second.get_json()["status"] == "Counted"


def test_more_than_10m_equal_map_is_independent_and_does_not_refresh_target(api):
    application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)

    first = _create_gps_report(client, first_headers, {"Plastic": "Medium"})
    assert first.status_code == 201
    before_ref = _report_row(application, first.get_json()["id"]).proximity_ref

    second = _create_gps_report(client, second_headers, {"Plastic": "Medium"}, lat=2.74634)

    assert second.status_code == 201
    assert second.get_json()["status"] == "Counted"
    assert _report_row(application, first.get_json()["id"]).proximity_ref == before_ref


def test_resolved_nearby_target_does_not_block_new_report(api):
    _application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)

    first = _create_gps_report(client, first_headers, {"Plastic": "Medium"})
    assert first.status_code == 201
    cleanup = client.post(
        "/cleanup-actions",
        headers=first_headers,
        json={
            "targetReportId": first.get_json()["id"],
            "remainingQuantities": {"Plastic": "Small"},
            "handling": "Collected for disposal",
            "idempotencyKey": "resolve-before-nearby-report",
        },
    )
    assert cleanup.status_code == 201
    assert cleanup.get_json()["resolved"] is True

    second = _create_gps_report(client, second_headers, {"Plastic": "Medium"}, lat=2.74619)

    assert second.status_code == 201
    assert second.get_json()["status"] == "Counted"


def test_prior_day_nearby_changed_map_is_not_blanket_rejected(api):
    application, client = api
    _first, first_headers = signup(client)
    _second, second_headers = signup(client)

    first = _create_gps_report(client, first_headers, {"Plastic": "Medium"})
    assert first.status_code == 201
    prior_day = datetime.now(timezone.utc) - timedelta(days=1)
    with application.extensions["marine_engine"].begin() as connection:
        connection.execute(
            reports_table.update()
            .where(reports_table.c.id == first.get_json()["id"])
            .values(created_at=prior_day, updated_at=prior_day)
        )

    second = _create_gps_report(client, second_headers, {"Glass": "Large"}, lat=2.74619)

    assert second.status_code == 201
    assert second.get_json()["status"] == "Counted"


def test_10m_boundary_matrix(api):
    _application, client = api
    for suffix, lat, expected in (
        ("inside", 2.74622, "Duplicate"),
        ("boundary", 2.74623, "Duplicate"),
        ("outside", 2.74626, "Counted"),
    ):
        first_session, first_headers = signup(client)
        second_session, second_headers = signup(client)
        lng = 101.44024 + len(suffix) * 0.001
        first = _create_gps_report(client, first_headers, {"Fishing gear": "Medium"}, lng=lng)
        assert first.status_code == 201, (suffix, first.get_json())
        second = _create_gps_report(
            client,
            second_headers,
            {"Fishing gear": "Medium"},
            lat=lat,
            lng=lng,
        )
        assert second.status_code == 201, (suffix, second.get_json())
        assert second.get_json()["status"] == expected, suffix
        assert first_session["user"]["id"] != second_session["user"]["id"]


def test_same_user_far_equal_gps_reports_stay_counted_after_restart(tmp_path):
    database_path = tmp_path / "restart-far-gps.db"
    photo_dir = tmp_path / "photos"
    application = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=photo_dir,
    )
    client = application.test_client()
    _session, headers = signup(client)

    first = _create_gps_report(client, headers, {"Plastic": "Medium"}, lat=2.74614)
    second = _create_gps_report(client, headers, {"Plastic": "Medium"}, lat=2.74634)
    assert first.status_code == second.status_code == 201
    assert first.get_json()["status"] == "Counted"
    assert second.get_json()["status"] == "Counted"

    restarted = create_app(
        database_url=f"sqlite:///{database_path}",
        testing=True,
        photo_storage_dir=photo_dir,
    )
    statuses = [
        report["status"]
        for report in restarted.test_client().get("/reports/mine", headers=headers).get_json()
    ]
    assert statuses == ["Counted", "Counted"]


def test_weekly_events_are_created_only_for_moderate_high_and_severe_beaches(api):
    _application, client = api
    _seed_attention(client, "morib", {"Fishing gear": "Medium"})
    _seed_attention(client, "remis", {"Fishing gear": "Large"})
    _seed_attention(client, "kelanang", {"Fishing gear": "Very Large"})
    _seed_attention(client, "bagan", {"Paper": "Medium"})

    severities = {item["id"]: item["severity"] for item in client.get("/beaches").get_json()}
    assert severities == {
        "morib": "Moderate",
        "remis": "High",
        "kelanang": "Severe",
        "bagan": "Low",
    }

    events = client.get("/events").get_json()
    weekly_by_beach = {
        beach_id: [event for event in events if event["source"] == "weekly" and event["beachId"] == beach_id]
        for beach_id in severities
    }
    assert len(weekly_by_beach["morib"]) == 4
    assert len(weekly_by_beach["remis"]) == 4
    assert len(weekly_by_beach["kelanang"]) == 4
    assert weekly_by_beach["bagan"] == []


def test_weekly_event_gate_skips_beaches_with_insufficient_data(api):
    _application, client = api

    events = client.get("/events").get_json()

    assert [event for event in events if event["source"] == "weekly"] == []


def test_existing_weekly_events_survive_later_attention_drop(api):
    application, client = api
    seeded = _seed_attention(client, "morib", {"Fishing gear": "Medium"})
    first_events = client.get("/events?beachId=morib").get_json()
    first_ids = [event["id"] for event in first_events if event["source"] == "weekly"]
    assert len(first_ids) == 4

    for index, (report, headers) in enumerate(seeded):
        cleanup = client.post(
            "/cleanup-actions",
            headers=headers,
            json={
                "targetReportId": report["id"],
                "remainingQuantities": {"Fishing gear": "Small"},
                "handling": "Collected for disposal",
                "idempotencyKey": f"event-gate-resolve-{index}",
            },
        )
        assert cleanup.status_code == 201
        assert cleanup.get_json()["resolved"] is True

    morib = client.get("/beaches/morib").get_json()
    assert morib["severity"] is None
    assert morib["insufficientData"] is True

    second_events = client.get("/events?beachId=morib").get_json()
    second_ids = [event["id"] for event in second_events if event["source"] == "weekly"]
    assert second_ids == first_ids

    with application.extensions["marine_engine"].connect() as connection:
        stored_ids = connection.execute(
            select(events_table.c.id).where(events_table.c.beach_id == "morib")
        ).scalars().all()
    assert sorted(stored_ids) == sorted(first_ids)


def test_weekly_event_generation_is_idempotent_when_band_is_eligible(api):
    application, client = api
    _seed_attention(client, "morib", {"Fishing gear": "Large"})

    first = client.get("/events?beachId=morib").get_json()
    second = client.get("/events?beachId=morib").get_json()

    first_ids = [event["id"] for event in first if event["source"] == "weekly"]
    second_ids = [event["id"] for event in second if event["source"] == "weekly"]
    assert len(first_ids) == 4
    assert second_ids == first_ids
    with application.extensions["marine_engine"].connect() as connection:
        count = connection.execute(
            select(events_table.c.id).where(events_table.c.beach_id == "morib")
        ).scalars().all()
    assert sorted(count) == sorted(first_ids)
