"""Exercise the optional service with the real frozen 40-model package."""
from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from serve import create_app

MANIFEST = json.loads((ROOT / "models/model_manifest.json").read_text(encoding="utf-8"))
NAMES = {row["scientific_name"] for row in MANIFEST["species"]}


@pytest.fixture(scope="module")
def app():
    application = create_app()
    application.config["TESTING"] = True
    return application


@pytest.fixture
def client(app):
    return app.test_client()


def post(client, **options):
    return client.post("/predict", json={"latitude": 2.75, "longitude": 101.35, **options})


def test_health_catalog_and_factories_share_one_loaded_registry(app, client):
    health = client.get("/health").get_json()
    assert health == {"status": "ok", "modelVersion": MANIFEST["model_version"], "modelCount": len(NAMES)}
    catalog = client.get("/species").get_json()
    assert catalog["modelVersion"] == health["modelVersion"]
    assert catalog["modelCount"] == len(NAMES) == 40
    assert {row["scientificName"] for row in catalog["species"]} == NAMES
    assert create_app(ROOT).extensions["species_model"] is app.extensions["species_model"]


def test_coordinate_only_exact_request_retains_every_model(client):
    response = post(client)
    assert response.status_code == 200
    body = response.get_json()
    assert body["modelVersion"] == MANIFEST["model_version"]
    assert body["modelCount"] == len(body["predictions"]) == len(NAMES)
    assert {row["scientificName"] for row in body["predictions"]} == NAMES
    assert body["coordinateContext"]["method"] == "exact_coordinate"
    assert body["coordinateContext"]["moved"] is False
    assert body["inferenceSource"] == "direct_model"
    assert body["calibratedProbability"] is False and body["crossSpeciesRankingValidated"] is False


@pytest.mark.parametrize("latitude,longitude", [(2.601,101.688),(2.789,101.415),(2.746,101.44),(3.218,101.302)])
def test_explicit_nearby_scores_and_ranking_match_frozen_cells(client, latitude, longitude):
    response = post(client, latitude=latitude, longitude=longitude, mode="nearby_marine", topK=5)
    assert response.status_code == 200
    body = response.get_json()
    context = body["coordinateContext"]
    assert context["requestedLatitude"] == latitude and context["requestedLongitude"] == longitude
    assert context["method"] == "nearest_marine_grid"
    assert context["maxDistanceKm"] == 15 and 0 <= context["distanceKm"] <= 15
    assert context["moved"] == (context["distanceKm"] > 1e-9)
    assert body["inferenceSource"] == "precomputed_final_model_grid_scores"
    assert len(body["predictions"]) == 40
    with np.load(ROOT / "marine_grid_scores.npz", allow_pickle=False) as saved:
        names = list(saved["scientific_names"])
        index = list(saved["cell_ids"]).index(context["gridCellId"])
        assert context["usedLatitude"] == saved["latitude"][index]
        assert context["usedLongitude"] == saved["longitude"][index]
        for row in body["predictions"]:
            reference = saved["scores"][:, names.index(row["scientificName"])]
            raw = row["relativeOccurrenceScore"]
            assert raw == reference[index]
            assert row["locationMatchScore"] == (np.count_nonzero(reference < raw) + 0.5 * np.count_nonzero(reference == raw)) / len(reference)
    eligible = [row for row in body["predictions"] if row["defaultRecommendation"] and row["relativeOccurrenceScore"] > 0 and row["kingdom"] == "Animalia"]
    assert body["topPredictions"] == sorted(eligible, key=lambda row: (-row["locationMatchScore"], row["scientificName"]))[:5]


def test_kelanang_requires_explicit_coordinate_movement(client):
    assert post(client, latitude=2.789, longitude=101.415).status_code == 422
    body = post(client, latitude=2.789, longitude=101.415, mode="nearby_marine").get_json()
    assert body["coordinateContext"]["requestedInsideMalaysianEez"] is False
    assert 8 < body["coordinateContext"]["distanceKm"] < 9


def test_top_k_changes_only_suggestions(client):
    for count in (0, 1, 7):
        body = post(client, topK=count).get_json()
        assert len(body["predictions"]) == 40
        assert len(body["topPredictions"]) <= count
        assert body["recommendationContext"]["requestedTopK"] == count
    assert post(client, topK=0).get_json()["topPredictions"] == []


@pytest.mark.parametrize("options", [{"latitude":"2.75"},{"latitude":True},{"latitude":float("nan")},
    {"latitude":float("inf")},{"latitude":91},{"longitude":-181},{"latitude":10**1000},
    {"mode":"near_coastal"},{"mode":None},{"mode":[]},{"topK":True},{"topK":-1},{"topK":2.5},
    {"topK":"5"},{"maxDistanceKm":100}])
def test_invalid_options_and_coordinates_return_400(client, options):
    response = post(client, **options)
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION_FAILED"


@pytest.mark.parametrize("payload", [None, [], {}, {"latitude":2.75}])
def test_missing_coordinate_object_returns_400(client, payload):
    response = client.post("/predict", json=payload)
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION_FAILED"


@pytest.mark.parametrize("mode", ["exact", "nearby_marine"])
def test_far_outside_coordinate_is_rejected_without_fallback(client, mode):
    response = post(client, latitude=0, longitude=0, mode=mode)
    assert response.status_code == 422
    assert response.get_json()["code"] == "OUTSIDE_MODEL_AREA"
