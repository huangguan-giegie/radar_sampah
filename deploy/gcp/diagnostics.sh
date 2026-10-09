#!/usr/bin/env bash
set -euo pipefail
cd "${RADAR_ROOT:-/opt/radar-sampah}/deploy/gcp"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(docker-compose)
fi

"${COMPOSE[@]}" ps
free -h
swapon --show
docker stats --no-stream
vmstat 1 5

# Query the running service without starting another memory-heavy app instance.
"${COMPOSE[@]}" exec -T app python - <<'PY'
import json
import os
import time
import urllib.request

for name in ("LITTER_PRELOAD", "EVENT_SCHEDULER_TTL_SECONDS", "INSIGHTS_CACHE_TTL_SECONDS", "RADAR_PREWARM_PUBLIC_VIEWS"):
    print(f"{name}={os.environ.get(name, 'unset')}")

for path in ("/", "/api/health", "/api/beaches", "/api/events", "/api/insights", "/api/api/species-distribution/species"):
    for attempt in (1, 2):
        started = time.monotonic()
        with urllib.request.urlopen("http://127.0.0.1:5000" + path, timeout=90) as response:
            body = response.read()
            print(f"{path} attempt={attempt} HTTP={response.status} seconds={time.monotonic()-started:.3f} bytes={len(body)}")
            if path == "/api/health":
                health = json.loads(body)
                print(json.dumps(health))
                assert health.get("database") == "connected", "Database is unavailable"
            elif path.endswith("/species-distribution/species"):
                catalog = json.loads(body)
                assert catalog["modelCount"] == len(catalog["species"]) == 40
                print("Species model catalogue ready: 40 models.")

for attempt in (1, 2):
    started = time.monotonic()
    request = urllib.request.Request("http://127.0.0.1:5000/api/api/species-distribution/predict",
        data=json.dumps({"latitude": 2.74614, "longitude": 101.44024, "mode": "nearby_marine", "topK": 5}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=90) as response:
        prediction = json.load(response)
        assert response.status == 200 and prediction["modelCount"] == len(prediction["predictions"]) == 40
        print(f"Species prediction attempt={attempt} HTTP=200 models=40 seconds={time.monotonic()-started:.3f}")
PY
