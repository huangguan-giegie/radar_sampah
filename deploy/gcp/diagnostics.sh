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

# One-time cleanup of the exact fixture from the interrupted closeout run.
# Remove this block after the cleanup has been verified.
import io
import psycopg
from psycopg import sql
from PIL import Image

with psycopg.connect(os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://", 1)) as connection:
    connection.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(os.environ.get("DATABASE_SCHEMA", "").strip() or "public")))
    fixture_key = "8dee5e18fc84ce255f88264a0cc2639b.jpg"
    photo = connection.execute("SELECT owner_id, data, created_at FROM report_photos WHERE photo_key = %s", (fixture_key,)).fetchone()
    if photo:
        user_id, data, created_at = photo
        assert user_id.startswith("u_") and len(user_id) == 26
        assert created_at.isoformat().startswith("2026-10-07T20:05:")
        with Image.open(io.BytesIO(bytes(data))) as fixture:
            assert fixture.size == (64, 64) and fixture.convert("RGB").getextrema() == ((255, 255),) * 3
        assert connection.execute("SELECT COUNT(*) FROM reports WHERE reporter_id = %s", (user_id,)).fetchone()[0] <= 1
        connection.execute("DELETE FROM community_event_members WHERE participant_id = %s", (user_id,))
        connection.execute("DELETE FROM cleanup_actions WHERE participant_id = %s", (user_id,))
        connection.execute("DELETE FROM reports WHERE reporter_id = %s AND photo_key = %s", (user_id, fixture_key))
        connection.execute("DELETE FROM report_photos WHERE owner_id = %s AND photo_key = %s", (user_id, fixture_key))
        connection.execute("DELETE FROM users WHERE id = %s", (user_id,))
        assert connection.execute("SELECT COUNT(*) FROM users WHERE id = %s", (user_id,)).fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM report_photos WHERE photo_key = %s", (fixture_key,)).fetchone()[0] == 0
    print("Interrupted acceptance fixture absent; cleanup verified.", flush=True)

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
