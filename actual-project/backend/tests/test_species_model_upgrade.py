"""Verify the integrated 40-model contract against the frozen reference matrix."""
import json
from pathlib import Path
import sys

import numpy as np
import pytest
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api
from app import reports_table, users_table, seed_reference_data

ROOT = Path(__file__).resolve().parents[1] / "species_distribution"


def post(client, **options):
    return client.post("/api/species-distribution/predict", json={
        "latitude": 2.75, "longitude": 101.35, **options,
    })


def test_catalog_and_predictions_share_all_40_scientific_identities(api):
    app, client = api
    catalog = client.get("/api/species-distribution/species").get_json()
    result = post(client).get_json()
    assert catalog["modelVersion"] == result["modelVersion"] == "iteration3-upgrade-40-species-20261003"
    assert catalog["modelCount"] == result["modelCount"] == 40
    assert {row["scientificName"] for row in catalog["species"]} == {row["scientificName"] for row in result["predictions"]}
    assert all(row["introEn"] and row["sources"] for row in catalog["species"])
    assert all(row["imageAvailable"] is False for row in catalog["species"])
    assert result["calibratedProbability"] is False
    assert result["crossSpeciesRankingValidated"] is False


def test_strict_coordinates_are_preserved_and_scores_match_saved_reference(api):
    _, client = api
    body = post(client).get_json()
    context = body["coordinateContext"]
    assert context["method"] == "exact_coordinate" and context["moved"] is False
    assert context["requestedLatitude"] == context["usedLatitude"] == 2.75
    assert context["requestedLongitude"] == context["usedLongitude"] == 101.35
    assert body["inferenceSource"] == "direct_model"
    with np.load(ROOT / "marine_grid_scores.npz", allow_pickle=False) as saved:
        index = np.flatnonzero((saved["latitude"] == 2.75) & (saved["longitude"] == 101.35)).item()
        names = list(saved["scientific_names"])
        for row in body["predictions"]:
            column = names.index(row["scientificName"])
            assert row["relativeOccurrenceScore"] == pytest.approx(saved["scores"][index, column], abs=1e-12)


@pytest.mark.parametrize("latitude,longitude", [(2.601, 101.688), (2.789, 101.415), (2.746, 101.44), (3.218, 101.302)])
def test_nearby_top_five_percentiles_match_the_independent_matrix(api, latitude, longitude):
    _, client = api
    response = post(client, latitude=latitude, longitude=longitude, mode="nearby_marine", topK=5)
    assert response.status_code == 200
    body = response.get_json()
    context = body["coordinateContext"]
    assert context["requestedLatitude"] == latitude and context["requestedLongitude"] == longitude
    assert context["method"] == "nearest_marine_grid" and context["maxDistanceKm"] == 15
    assert context["distanceKm"] <= 15
    assert body["inferenceSource"] == "precomputed_final_model_grid_scores"
    with np.load(ROOT / "marine_grid_scores.npz", allow_pickle=False) as saved:
        index = list(saved["cell_ids"]).index(context["gridCellId"])
        names = list(saved["scientific_names"])
        assert context["usedLatitude"] == saved["latitude"][index]
        assert context["usedLongitude"] == saved["longitude"][index]
        for row in body["predictions"]:
            values = saved["scores"][:, names.index(row["scientificName"])]
            score = saved["scores"][index, names.index(row["scientificName"])]
            assert row["relativeOccurrenceScore"] == score
            expected = (np.count_nonzero(values < score) + .5 * np.count_nonzero(values == score)) / len(values)
            assert row["locationMatchScore"] == expected
    eligible = [row for row in body["predictions"] if row["defaultRecommendation"] and row["relativeOccurrenceScore"] > 0]
    expected = sorted(eligible, key=lambda row: (-row["locationMatchScore"], row["scientificName"]))[:5]
    assert body["topPredictions"] == expected
    assert len(body["predictions"]) == 40


@pytest.mark.parametrize("top_k", [0, 1, 40, 100])
def test_top_k_only_changes_the_display_list(api, top_k):
    _, client = api
    response = post(client, topK=top_k)
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["predictions"]) == 40
    assert len(body["topPredictions"]) == min(top_k, body["recommendationContext"]["eligibleSpecies"])


@pytest.mark.parametrize("options", [
    {"topK": True}, {"topK": -1}, {"topK": 1.5}, {"topK": "5"}, {"topK": None},
    {"mode": "automatic"}, {"mode": None}, {"mode": {}},
    {"latitude": True}, {"longitude": False}, {"latitude": 91}, {"longitude": -181},
    {"latitude": None}, {"latitude": "north"}, {"latitude": 10 ** 400}, {"maxDistanceKm": 1000},
])
def test_invalid_options_are_rejected_without_expanding_the_search_area(api, options):
    _, client = api
    response = post(client, **options)
    assert response.status_code == 400
    assert response.get_json()["code"] == "VALIDATION_FAILED"


def test_api_factories_reuse_one_loaded_registry(api, tmp_path):
    app, _ = api
    from app import create_app
    second = create_app(database_url=f"sqlite:///{tmp_path / 'second.db'}", testing=True, photo_storage_dir=tmp_path / "photos")
    assert second.extensions["species_distribution_model"] is app.extensions["species_distribution_model"]


def test_predictions_and_catalog_do_not_write_coordinates_or_reports(api):
    app, client = api
    engine = app.extensions["marine_engine"]
    with engine.connect() as connection:
        before = (connection.execute(select(users_table)).all(), connection.execute(select(reports_table)).all())
    assert client.get("/api/species-distribution/species").status_code == 200
    assert post(client, mode="nearby_marine").status_code == 200
    assert post(client).status_code == 200
    with engine.connect() as connection:
        assert (connection.execute(select(users_table)).all(), connection.execute(select(reports_table)).all()) == before


def test_wildlife_insights_distinguish_published_references_and_nearby_predictions(api):
    app, client = api
    expanded = json.loads((Path(__file__).resolve().parents[1] / "data" / "expanded_beaches.json").read_text(encoding="utf-8"))
    seed_reference_data(app.extensions["marine_engine"], expanded["beaches"])
    body = client.get("/insights/wildlife").get_json()
    cards = {row["scientificName"] for row in client.get("/species-cards").get_json()}
    from app import load_beaches
    beaches = {row["id"]: row for row in load_beaches(app.extensions["marine_engine"])}
    model = app.extensions["species_distribution_model"]
    assert len(body["beaches"]) == len(beaches) == 179
    for row in body["beaches"]:
        beach = beaches[row["beachId"]]
        if row["beachId"] in {"morib", "remis", "kelanang", "bagan"}:
            result = model.predict_nearby_marine(beach["lat"], beach["lng"], top_k=40)
            expected = [prediction for prediction in result["topPredictions"] if prediction["scientificName"] in cards][:2]
            assert [item["scientificName"] for item in row["species"]] == [item["scientificName"] for item in expected]
            assert row["coordinateContext"] == result["coordinateContext"]
            for item, prediction in zip(row["species"], expected):
                assert item["locationMatchScore"] == prediction["locationMatchScore"]
                assert client.get("/species-cards/" + item["id"]).status_code == 200
        elif beach["speciesNames"]:
            assert row["sourceStatus"] == "published_reference"
            assert row["coordinateContext"] is None
            assert all(item["evidenceType"] == "published_reference" for item in row["species"])
        else:
            result = model.predict_nearby_marine(beach["lat"], beach["lng"], top_k=40)
            expected = result["topPredictions"][:2]
            assert row["sourceStatus"] == "modelled"
            assert [item["scientificName"] for item in row["species"]] == [item["scientificName"] for item in expected]
            assert row["coordinateContext"] == result["coordinateContext"]
            assert row["modelCount"] == 40
            for item, prediction in zip(row["species"], expected):
                assert item["locationMatchScore"] == prediction["locationMatchScore"]
                assert item["destination"] == "/beach/" + beach["id"]
                assert item["evidenceType"] == "modelled"
