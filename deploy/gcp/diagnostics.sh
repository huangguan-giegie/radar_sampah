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

for path in ("/", "/api/health", "/api/beaches", "/api/events", "/api/insights"):
    for attempt in (1, 2):
        started = time.monotonic()
        with urllib.request.urlopen("http://127.0.0.1:5000" + path, timeout=90) as response:
            body = response.read()
            print(f"{path} attempt={attempt} HTTP={response.status} seconds={time.monotonic()-started:.3f} bytes={len(body)}")
            if path == "/api/health":
                health = json.loads(body)
                print(json.dumps(health))
                assert health.get("database") == "connected", "Database is unavailable"
PY
