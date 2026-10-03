"""Read-only smoke check for an Iteration 3 API deployment (standard library only)."""
from __future__ import annotations

import argparse
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen

EXPECTED_VERSION = "iteration3-upgrade-40-species-20261003"


def request_json(base: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    request = Request(
        base.rstrip("/") + path,
        data=None if body is None else json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "RadarSampah-ReleaseCheck"},
    )
    try:
        with urlopen(request, timeout=60) as response:
            return response.status, json.load(response)
    except HTTPError as response:
        return response.code, json.load(response)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url", help="API origin, for example http://127.0.0.1:5000")
    args = parser.parse_args()
    require(args.base_url.startswith(("http://", "https://")), "Supply an HTTP(S) API origin.")

    status, _ = request_json(args.base_url, "/health")
    require(status == 200, f"Health check failed: HTTP {status}.")
    status, catalog = request_json(args.base_url, "/api/species-distribution/catalog")
    require(status == 200 and catalog.get("modelCount") == 40, "The deployed catalogue must contain 40 models.")
    require(catalog.get("modelVersion") == EXPECTED_VERSION, "The deployed catalogue has a different model version.")
    names = {row["scientificName"] for row in catalog.get("species", [])}
    require(len(names) == 40, "The catalogue must contain 40 unique species.")

    beaches = {
        "Bagan Lalang": (2.601, 101.688), "Kelanang": (2.789, 101.415),
        "Morib": (2.746, 101.44), "Remis": (3.218, 101.302),
    }
    results = []
    for name, (latitude, longitude) in beaches.items():
        status, result = request_json(args.base_url, "/api/species-distribution/predict", {
            "latitude": latitude, "longitude": longitude, "mode": "nearby_marine", "topK": 5,
        })
        require(status == 200, f"{name} nearby prediction failed: HTTP {status}.")
        require(result.get("modelVersion") == EXPECTED_VERSION, f"{name}: prediction/catalogue version mismatch.")
        predictions, top = result.get("predictions", []), result.get("topPredictions", [])
        require(len(predictions) == 40 and {row["scientificName"] for row in predictions} == names, f"{name}: incomplete prediction registry.")
        require(len(top) == 5, f"{name}: expected five suggestions for this frozen snapshot.")
        require(result.get("calibratedProbability") is False and result.get("crossSpeciesRankingValidated") is False, "Score interpretation flags are missing.")
        context = result.get("coordinateContext", {})
        require(context.get("method") == "nearest_marine_grid" and context.get("maxDistanceKm") == 15, "Nearby coordinate context is missing.")
        require(context.get("requestedLatitude") == latitude and context.get("requestedLongitude") == longitude, "The requested coordinates were lost.")
        require(0 <= context.get("distanceKm", -1) <= 15, "Nearby coordinate displacement is invalid.")
        for row in predictions:
            require(0 <= row["relativeOccurrenceScore"] <= 1 and 0 <= row["locationMatchScore"] <= 1, "A score is outside its range.")
        results.append({"beach": name, "distanceKm": round(context["distanceKm"], 3), "top5": [row["scientificName"] for row in top]})

    for body, expected_status in [
        ({"latitude": "2.789", "longitude": 101.415}, 400),
        ({"latitude": 0, "longitude": 0}, 422),
        ({"latitude": 2.789, "longitude": 101.415}, 422),
    ]:
        status, _ = request_json(args.base_url, "/api/species-distribution/predict", body)
        require(status == expected_status, f"Input/domain validation returned {status}; expected {expected_status}.")

    print(json.dumps({"passed": True, "modelVersion": EXPECTED_VERSION, "modelCount": 40, "beaches": results}, indent=2))


if __name__ == "__main__":
    main()
