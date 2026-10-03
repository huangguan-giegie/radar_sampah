"""Real packaged-model API checks for the expanded species registry."""
from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api
from app import create_app

ROOT = Path(__file__).resolve().parents[1] / "species_distribution"
MANIFEST = json.loads((ROOT / "models/model_manifest.json").read_text(encoding="utf-8"))
NAMES = {row["scientific_name"] for row in MANIFEST["species"]}


def post(client, **options):
    return client.post("/api/species-distribution/predict", json={"latitude": 2.75, "longitude": 101.35, **options})


def test_exact_coordinate_only_request_retains_full_registry(api):
    application, client = api
    response = post(client)
    assert response.status_code == 200
    body = response.get_json()
    assert body["modelCount"] == body["registrySpeciesCount"] == len(NAMES)
    assert {row["scientificName"] for row in body["predictions"]} == NAMES
    assert body["modelVersion"] == MANIFEST["model_version"]
    assert body["inferenceSource"] == "direct_model"
    assert body["coordinateContext"]["method"] == "exact_coordinate"
    assert body["coordinateContext"]["moved"] is False
    assert body["coordinateContext"]["distanceKm"] == 0
    assert body["calibratedProbability"] is False
    assert body["crossSpeciesRankingValidated"] is False
    assert body["rankingMethod"] == "heuristic_within_species_percentile"
    assert len(body["topPredictions"]) <= 5
    # Requests reuse the loaded registry, rather than reopening model files.
    registry = application.extensions["species_distribution_model"]
    assert post(client, topK=1).status_code == 200
    assert application.extensions["species_distribution_model"] is registry


def test_nearby_raw_scores_percentiles_and_top_k_match_frozen_reference(api):
    _, client = api
    response = post(client, latitude=2.789, longitude=101.415, mode="nearby_marine", topK=7)
    assert response.status_code == 200
    body = response.get_json()
    context = body["coordinateContext"]
    assert context["requestedLatitude"] == 2.789 and context["requestedLongitude"] == 101.415
    assert context["method"] == "nearest_marine_grid" and context["moved"]
    assert context["maxDistanceKm"] == 15 and 0 < context["distanceKm"] <= 15
    assert body["inferenceSource"] == "precomputed_final_model_grid_scores"
    with np.load(ROOT / "marine_grid_scores.npz", allow_pickle=False) as saved:
        names = list(saved["scientific_names"])
        grid_row = list(saved["cell_ids"]).index(context["gridCellId"])
        for row in body["predictions"]:
            reference = saved["scores"][:, names.index(row["scientificName"])]
            raw = row["relativeOccurrenceScore"]
            assert raw == reference[grid_row]
            expected = (np.count_nonzero(reference < raw) + 0.5 * np.count_nonzero(reference == raw)) / len(reference)
            assert row["locationMatchScore"] == expected
    eligible = [row for row in body["predictions"] if row["defaultRecommendation"] and row["relativeOccurrenceScore"] > 0 and row["kingdom"] == "Animalia"]
    expected_top = sorted(eligible, key=lambda row: (-row["locationMatchScore"], row["scientificName"]))[:7]
    assert body["topPredictions"] == expected_top
    assert body["recommendationContext"]["requestedTopK"] == 7


def test_zero_top_k_keeps_all_predictions(api):
    _, client = api
    body = post(client, topK=0).get_json()
    assert body["topPredictions"] == []
    assert len(body["predictions"]) == len(NAMES)


def test_catalog_and_prediction_content_use_same_scientific_names(api):
    _, client = api
    catalog_response = client.get("/api/species-distribution/catalog")
    assert catalog_response.status_code == 200
    catalog = catalog_response.get_json()
    assert catalog["modelCount"] == len(NAMES)
    assert catalog["modelVersion"] == MANIFEST["model_version"]
    entries = {row["scientificName"]: row for row in catalog["species"]}
    assert set(entries) == NAMES
    assert sum(row["imageAvailable"] for row in entries.values()) == 4
    body = post(client).get_json()
    for row in body["predictions"]:
        content = entries[row["scientificName"]]
        assert row["speciesSlug"] == content["speciesSlug"]
        for key in ("category", "introEn", "introZh", "commonNameEn", "sources", "imageAvailable"):
            assert row[key] == content[key]
        assert row["introEn"] and row["introZh"] and row["category"] and row["sources"]


@pytest.mark.parametrize("options", [
    {"mode": "near_coastal"}, {"mode": None}, {"mode": []},
    {"topK": True}, {"topK": -1}, {"topK": 2.5}, {"topK": "5"},
    {"maxDistanceKm": 100}, {"nearbyMarine": True},
    {"latitude": True}, {"latitude": float("nan")}, {"latitude": float("inf")},
    {"latitude": 91}, {"longitude": -181}, {"latitude": 10**1000},
])
def test_invalid_options_or_coordinates_return_400(api, options):
    _, client = api
    response = post(client, **options)
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION_FAILED"


@pytest.mark.parametrize("payload", [None, [], {}, {"latitude": 2.75}])
def test_missing_coordinate_object_returns_400(api, payload):
    _, client = api
    response = client.post("/api/species-distribution/predict", json=payload)
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION_FAILED"


@pytest.mark.parametrize("mode", ["exact", "nearby_marine"])
def test_outside_coordinate_returns_422_without_silent_fallback(api, mode):
    _, client = api
    response = post(client, latitude=0, longitude=0, mode=mode)
    assert response.status_code == 422
    assert response.get_json()["code"] == "OUTSIDE_MODEL_AREA"


def test_model_registry_is_reused_across_application_factories(api, tmp_path):
    application, _ = api
    second = create_app(database_url=f"sqlite:///{tmp_path / 'second.db'}", testing=True, photo_storage_dir=tmp_path / "second-photos")
    assert second.extensions["species_distribution_model"] is application.extensions["species_distribution_model"]
