"""Beach coordinates require explicit nearby-water inference when outside EEZ."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api


def _predict(client, latitude, longitude, **options):
    return client.post("/api/species-distribution/predict", json={"latitude": latitude, "longitude": longitude, **options})


def test_kelanang_requires_explicit_nearby_marine_mode(api):
    _, client = api
    assert _predict(client, 2.789, 101.415).status_code == 422
    response = _predict(client, 2.789, 101.415, mode="nearby_marine")
    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body["insideMalaysianEez"] is True
    context = body["coordinateContext"]
    assert context["requestedInsideMalaysianEez"] is False
    assert context["moved"] is True
    assert 8 < context["distanceKm"] < 9
    assert context["maxDistanceKm"] == 15
    assert context["usedLatitude"] == 2.75
    assert context["usedLongitude"] == 101.35
    assert len(body["predictions"]) == body["modelCount"]


def test_every_project_beach_gets_scores(api):
    """All four known beaches have a nearby marine grid within the fixed limit."""
    _, client = api

    for latitude, longitude in ((2.601, 101.688), (2.789, 101.415), (2.746, 101.44), (3.218, 101.302)):
        response = _predict(client, latitude, longitude, mode="nearby_marine")
        assert response.status_code == 200, (latitude, longitude, response.get_data(as_text=True))


def test_far_away_coordinates_are_still_rejected(api):
    _, client = api

    response = _predict(client, 0, 0)

    assert response.status_code == 422
    assert response.get_json() == {
        "code": "OUTSIDE_MODEL_AREA",
        "message": "The coordinate is outside the supported Malaysian EEZ.",
    }


def test_an_inland_point_far_from_the_coast_is_rejected(api):
    """Nearby-water mode must not accept arbitrary inland coordinates."""
    _, client = api

    response = _predict(client, 4.6, 101.1, mode="nearby_marine")

    assert response.status_code == 422
