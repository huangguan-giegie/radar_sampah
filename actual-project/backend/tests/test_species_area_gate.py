"""The model's area gate must accept the beaches the app actually asks about.

The reference geometry is a maritime EEZ polygon, while the app sends beach
coordinates that sit on land at the waterline. Measured against the geometry,
the four project beaches are between 0.15 km and 0.96 km from its boundary, so a
strict containment test made one of them (Pantai Kelanang, 0.54 km outside)
permanently report no scores.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api


def _predict(client, latitude, longitude):
    return client.post("/api/species-distribution/predict", json={"latitude": latitude, "longitude": longitude})


def test_near_shore_beach_inside_the_eez_boundary_is_served(api):
    _, client = api

    response = _predict(client, 2.789, 101.415)

    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body["insideMalaysianEez"] is True
    assert len(body["predictions"]) == 4


def test_every_project_beach_gets_scores(api):
    """All four coordinates in the beach dataset must pass the gate."""
    _, client = api

    for latitude, longitude in ((2.601, 101.688), (2.789, 101.415), (2.746, 101.44), (3.218, 101.302)):
        response = _predict(client, latitude, longitude)
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
    """The tolerance is for the waterline, not for anywhere in Malaysia."""
    _, client = api

    response = _predict(client, 4.6, 101.1)

    assert response.status_code == 422
