"""Read-only HTTP smoke check for the standalone model service."""
from __future__ import annotations

import argparse
import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

EXPECTED_VERSION = "iteration3-upgrade-40-species-20261003"


def call(base: str, path: str, body: dict | None = None, timeout: float = 15) -> tuple[int, dict]:
    request = Request(base.rstrip("/") + path,
                      data=None if body is None else json.dumps(body).encode("utf-8"),
                      headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, json.load(response)
    except HTTPError as response:
        return response.code, json.load(response)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    parser.add_argument("--wait-seconds", type=float, default=0, help="Allow the service time to start, at most 45 seconds.")
    args = parser.parse_args()
    if not args.base_url.startswith(("http://", "https://")) or not 0 <= args.wait_seconds <= 45:
        parser.error("Use an HTTP(S) base URL and a wait from 0 to 45 seconds.")
    deadline = time.monotonic() + args.wait_seconds
    while True:
        try:
            status, health = call(args.base_url, "/health", timeout=5)
            if status == 200:
                break
        except (URLError, TimeoutError):
            if time.monotonic() >= deadline:
                raise
        if time.monotonic() >= deadline:
            raise RuntimeError("The model service did not become ready.")
        time.sleep(0.5)
    require(health.get("modelCount") == 40 and health.get("modelVersion") == EXPECTED_VERSION, "Wrong model service version or count.")

    results = []
    for latitude, longitude in [(2.601, 101.688), (2.789, 101.415), (2.746, 101.44), (3.218, 101.302)]:
        status, result = call(args.base_url, "/predict", {"latitude": latitude, "longitude": longitude, "mode": "nearby_marine", "topK": 5})
        require(status == 200 and len(result.get("predictions", [])) == 40 and len(result.get("topPredictions", [])) == 5, "Incomplete nearby prediction response.")
        require(result.get("modelVersion") == EXPECTED_VERSION and result.get("calibratedProbability") is False, "Prediction version or meaning mismatch.")
        context = result["coordinateContext"]
        require(context["method"] == "nearest_marine_grid" and 0 <= context["distanceKm"] <= 15 and context["maxDistanceKm"] == 15, "Invalid nearby coordinate context.")
        results.append({"latitude": latitude, "longitude": longitude, "distanceKm": round(context["distanceKm"], 3)})
    for body, expected in [({"latitude": "2.789", "longitude": 101.415}, 400),
                           ({"latitude": 0, "longitude": 0}, 422),
                           ({"latitude": 2.789, "longitude": 101.415}, 422)]:
        status, _ = call(args.base_url, "/predict", body)
        require(status == expected, f"Expected HTTP {expected}, received {status}.")
    print(json.dumps({"passed": True, "modelVersion": EXPECTED_VERSION, "modelCount": 40, "nearbyCoordinates": results}, indent=2))


if __name__ == "__main__":
    main()
