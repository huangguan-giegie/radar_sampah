"""API contract tests for the Marine Observation MVP."""

from __future__ import annotations

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
