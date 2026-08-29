"""API contract tests for the Radar Sampah litter MVP."""

from __future__ import annotations

import re
from datetime import datetime, timezone

import pytest

from app import context_table, create_app


@pytest.fixture
def client(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'marine_test.db'}"
    application = create_app(database_url=database_url, testing=True)
    return application.test_client()


def valid_observation():
    return {
        "category": "Plastic packaging",
        "area": "Selected Malaysian coastal area",
        "latitude": 3.139,
        "longitude": 101.6869,
        "observed_at": datetime(2026, 8, 14, 10, 0, tzinfo=timezone.utc).isoformat(),
        "image_url": "/assets/demo-plastic.jpg",
        "note": "Synthetic demonstration record",
    }


def test_health_reports_ready_status(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_options_endpoint_exposes_source_labelled_form_choices(client):
    response = client.get("/api/options")

    assert response.status_code == 200
    body = response.get_json()
    assert body["demo"] is True
    assert body["category_source"]["license"] == "Open Government Licence v3.0"
    assert {item["value"] for item in body["categories"]} == {
        "Plastic packaging",
        "Fishing gear",
        "Glass",
        "Metal",
        "Other",
    }
    assert len(body["areas"]) >= 4
    assert all("latitude" in item and "longitude" in item for item in body["areas"])
    assert all(item["sensitivity"] == "aggregated" for item in body["areas"])


def test_creating_valid_observation_returns_saved_rule_based_result(client):
    response = client.post("/api/observations", json=valid_observation())

    assert response.status_code == 201
    body = response.get_json()
    assert body["observation"]["category"] == "Plastic packaging"
    assert body["classification"] == {
        "label": "Plastic packaging",
        "method": "Fixed demonstration category selected by the reporter.",
        "rule": "category_passthrough_v1",
    }
    assert body["priority"]["level"] == "medium"
    assert body["priority"]["illustrative"] is True
    assert "not a pollution-source proof" in body["priority"]["disclaimer"].lower()
    assert body["context"]["source"] == "OBIS"
    assert body["source"] == "synthetic/public demonstration data"
    assert body["data_version"] == "marine-observation-v1"
    assert body["demo"] is True


def test_saved_observation_is_returned_by_list_endpoint(client):
    created = client.post("/api/observations", json=valid_observation()).get_json()

    response = client.get("/api/observations")

    assert response.status_code == 200
    observations = response.get_json()["observations"]
    assert len(observations) == 1
    item = observations[0]
    assert item["id"] == created["observation"]["id"]
    assert item["category"] == "Plastic packaging"
    assert item["observed_at"] == "2026-08-14T10:00:00+00:00"
    assert item["classification"]["rule"] == "category_passthrough_v1"
    assert item["priority"]["illustrative"] is True


@pytest.mark.parametrize(
    ("change", "expected_error"),
    [
        ({"category": ""}, "Missing required fields"),
        ({"category": "Cigarette waste"}, "Unsupported category"),
        ({"latitude": 91}, "Coordinates are out of range"),
        ({"observed_at": "tomorrow"}, "observed_at must be a valid ISO 8601 timestamp"),
        ({"image_url": "http://example.test/demo.jpg"}, "image_url must use HTTPS or a local /assets/ path"),
        ({"name": "Example Person"}, "Personal identifier fields are not accepted"),
    ],
)
def test_invalid_or_personal_observation_data_is_rejected(client, change, expected_error):
    payload = valid_observation()
    payload.update(change)

    response = client.post("/api/observations", json=payload)

    assert response.status_code == 400
    assert response.get_json()["error"] == expected_error


def test_context_endpoint_exposes_source_and_safety_metadata(client):
    response = client.get("/api/context")

    assert response.status_code == 200
    body = response.get_json()
    assert body["source"] == "OBIS"
    assert body["data_version"] == "obis-malaysia-public-2026-08-14-v1"
    assert body["demo"] is True
    assert len(body["context"]) >= 5
    assert len({item["id"] for item in body["context"]}) == len(body["context"])
    sample = body["context"][0]
    assert {
        "source_url",
        "retrieved_at",
        "license",
        "approximate_location",
        "taxon_or_context_label",
        "sensitivity",
    } <= sample.keys()
    assert all(item["source"] == "OBIS" for item in body["context"])
    assert all(item["sensitivity"] == "aggregated" for item in body["context"])


def test_context_initialisation_removes_stale_static_records(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'marine_test.db'}"
    application = create_app(database_url=database_url, testing=True)
    engine = application.extensions["marine_engine"]
    with engine.begin() as connection:
        connection.execute(
            context_table.insert().values(
                id="obsolete-demo-context",
                source="OBIS",
                source_url="https://obis.org/",
                retrieved_at="2026-08-14",
                license="OBIS data policy",
                latitude=3.14,
                longitude=101.69,
                taxon_or_context_label="Obsolete placeholder",
                sensitivity="aggregated",
            )
        )

    refreshed = create_app(database_url=database_url, testing=True)
    context = refreshed.test_client().get("/api/context").get_json()["context"]

    assert len(context) == 5
    assert all(item["id"] != "obsolete-demo-context" for item in context)


def test_radar_catalogue_recognition_and_report_flow_are_anonymous_and_region_level(client, monkeypatch):
    """The Radar Sampah routes keep the anonymous, region-level contract."""
    monkeypatch.setenv("LITTER_RECOGNITION_ENABLED", "false")
    monkeypatch.setenv("LITTER_RECOGNITION_API_URL", "https://recognition.example.test")
    monkeypatch.setattr("recognition_adapter.urlopen", lambda *args, **kwargs: pytest.fail("disabled recognition contacted a provider"))
    options = client.get("/api/litter-options")
    assert options.status_code == 200
    assert options.get_json()["areas"][0]["id"]
    assert "latitude" not in options.get_json()["areas"][0]

    recognition = client.post(
        "/api/litter-recognize",
        json={"image_url": "/assets/demo-plastic.jpg", "category_hint": "plastic packaging"},
    )
    assert recognition.status_code == 200
    assert recognition.get_json()["recognition"]["method"] == "local_demo_fallback"
    assert recognition.get_json()["recognition"]["category"] == "Plastic packaging"

    rejected = client.post(
        "/api/litter-reports",
        json={"area_id": "tioman-coast", "category": "plastic packaging", "latitude": 2.8},
    )
    assert rejected.status_code == 400
    assert "coordinate" in rejected.get_json()["error"].lower()

    created = client.post(
        "/api/litter-reports",
        json={
            "area_id": "tioman-coast",
            "category": "plastic packaging",
            "image_url": "/assets/demo-plastic.jpg",
            "note": "Bottle and wrapper in the tide line",
        },
    )
    assert created.status_code == 201
    report = created.get_json()["report"]
    assert report["area_id"] == "tioman-coast"
    assert "latitude" not in report
    assert "longitude" not in report
    assert report["quantity"] == 1
    assert report["detection"] == "reporter_selected"
    assert report["priority"] == "medium"

    reports = client.get("/api/litter-reports")
    heatmap = client.get("/api/litter-heatmap")
    assert reports.status_code == 200
    assert reports.get_json()["reports"] == [report]
    assert heatmap.status_code == 200
    assert heatmap.get_json()["areas"][0]["report_count"] == 1
    assert "coordinates" not in heatmap.get_json()["areas"][0]
    assert heatmap.get_json()["areas"][0]["severity_score"] == 20
    assert heatmap.get_json()["areas"][0]["no_exact_location"] is True


def test_radar_cleanup_progress_flow_uses_anonymous_counters(client):
    """Removing missions, joining, evidence, or progress aggregation must fail."""
    missions = client.get("/api/cleanup-missions")
    assert missions.status_code == 200
    mission = missions.get_json()["missions"][0]

    joined = client.post(f"/api/cleanup-missions/{mission['id']}/join", json={})
    assert joined.status_code == 201
    assert joined.get_json()["mission"]["joined_count"] == mission["joined_count"] + 1

    evidence = client.post(
        "/api/cleanup-evidence",
        json={"mission_id": mission["id"], "item_count": 4, "before_image_url": "/assets/demo-before.jpg", "after_image_url": "/assets/demo-after.jpg", "impact_note": "Four items removed"},
    )
    assert evidence.status_code == 201
    assert evidence.get_json()["evidence"]["item_count"] == 4
    assert evidence.get_json()["evidence"]["after_image_url"] == "/assets/demo-after.jpg"

    progress = client.get("/api/community-progress")
    assert progress.status_code == 200
    assert progress.get_json()["progress"]["mission_join_count"] == 1
    assert progress.get_json()["progress"]["verified_item_count"] == 4


def test_radar_report_returns_illustrative_detection_and_priority(client):
    payload = {
        "area_id": "tioman-coast",
        "category": "Fishing gear",
        "quantity": 3,
        "observed_at": "2026-08-15T10:00:00Z",
        "image_url": "/assets/demo-fishing-gear.jpg",
        "note": "Synthetic demonstration record",
        "detection_confirmed": True,
    }
    response = client.post("/api/litter-reports", json=payload)

    assert response.status_code == 201
    body = response.get_json()
    assert body["detection"]["needs_user_confirmation"] is False
    assert body["detection"]["illustrative"] is True
    assert 0 <= body["priority"]["severity_score"] <= 100
    assert body["priority"]["illustrative"] is True
    assert "enforcement" in body["priority"]["disclaimer"].lower()


def test_radar_recognition_fallback_exposes_privacy_boundary(client):
    response = client.post(
        "/api/litter-recognize",
        json={"image_url": "/assets/demo-plastic.jpg", "category_hint": "Plastic packaging"},
    )

    assert response.status_code == 200
    detection = response.get_json()["recognition"]
    assert detection["data_sent_to_provider"] is False
    assert detection["illustrative"] is True


def test_radar_before_after_evidence_returns_illustrative_impact(client):
    before = client.post(
        "/api/litter-reports",
        json={
            "area_id": "tioman-coast",
            "category": "Plastic packaging",
            "quantity": 20,
            "observed_at": "2026-08-15T10:00:00Z",
            "detection_confirmed": True,
        },
    ).get_json()["report"]
    after = client.post(
        "/api/litter-reports",
        json={
            "area_id": "tioman-coast",
            "category": "Plastic packaging",
            "quantity": 2,
            "observed_at": "2026-08-16T10:00:00Z",
            "detection_confirmed": True,
        },
    ).get_json()["report"]

    response = client.post(
        "/api/cleanup-evidence",
        json={"before_report_id": before["id"], "after_report_id": after["id"]},
    )

    assert response.status_code == 201
    impact = response.get_json()["impact"]
    assert impact["level"] == "improved"
    assert impact["illustrative"] is True


def test_radar_rejects_case_variant_personal_and_coordinate_keys(client):
    """Changing key casing must not bypass the anonymous, region-level boundary."""
    for field, value in (("Email", "person@example.test"), ("Latitude", 2.8)):
        response = client.post(
            "/api/litter-reports",
            json={"area_id": "tioman-coast", "category": "plastic packaging", field: value},
        )
        assert response.status_code == 400


def test_cleanup_evidence_compares_anonymous_before_and_after_reports(client):
    """Dropping report references or impact classification must fail this contract."""
    before = client.post("/api/litter-reports", json={"area_id": "tioman-coast", "category": "plastic packaging", "quantity": 8}).get_json()["report"]
    after = client.post("/api/litter-reports", json={"area_id": "tioman-coast", "category": "plastic packaging", "quantity": 3}).get_json()["report"]

    response = client.post("/api/cleanup-evidence", json={"before_report_id": before["id"], "after_report_id": after["id"], "item_count": 5})

    assert response.status_code == 201
    assert response.get_json()["evidence"]["before_report_id"] == before["id"]
    assert response.get_json()["evidence"]["impact"] == "improved"


def test_anonymous_signup_issues_a_token_and_a_random_4_digit_participant_id(client):
    response = client.post("/auth/anonymous")

    assert response.status_code == 201
    body = response.get_json()
    assert body["token"]
    user = body["user"]
    assert user["id"].startswith("u_")
    assert re.fullmatch(r"\d{4}", user["participantId"])
    assert user["role"] == "volunteer"
    assert "name" not in user and "email" not in user and "password" not in user


def test_two_anonymous_signups_get_different_participant_ids(client):
    first = client.post("/auth/anonymous").get_json()["user"]["participantId"]
    second = client.post("/auth/anonymous").get_json()["user"]["participantId"]

    assert first != second


def test_restore_with_a_known_participant_id_returns_a_working_token(client):
    created = client.post("/auth/anonymous").get_json()["user"]

    restored = client.post("/auth/restore", json={"participantId": created["participantId"]})

    assert restored.status_code == 200
    body = restored.get_json()
    assert body["user"]["id"] == created["id"]
    assert body["token"]


def test_restore_with_an_unknown_participant_id_is_404_not_401(client):
    """The app shows a different message for 'never existed' than for 'not signed in'."""
    response = client.post("/auth/restore", json={"participantId": "9999"})

    assert response.status_code == 404
    assert response.get_json()["code"] == "UNKNOWN_PARTICIPANT"


@pytest.mark.parametrize("bad_participant_id", ["163", "16377", "abcd", "", None])
def test_restore_rejects_anything_that_is_not_exactly_4_digits(client, bad_participant_id):
    response = client.post("/auth/restore", json={"participantId": bad_participant_id})

    assert response.status_code == 404
    assert response.get_json()["code"] == "UNKNOWN_PARTICIPANT"


def test_me_without_a_token_is_401_unauthenticated(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.get_json()["code"] == "UNAUTHENTICATED"


def test_me_with_an_invalid_token_is_401_unauthenticated(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401
    assert response.get_json()["code"] == "UNAUTHENTICATED"


def test_me_with_a_valid_token_returns_the_signed_up_user(client):
    created = client.post("/auth/anonymous").get_json()
    token = created["token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.get_json() == created["user"]


def test_logout_without_a_token_is_401_and_with_one_is_204(client):
    unauthenticated = client.post("/auth/logout")
    assert unauthenticated.status_code == 401

    token = client.post("/auth/anonymous").get_json()["token"]
    response = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204
    assert response.get_data() == b""
