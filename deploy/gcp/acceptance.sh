#!/usr/bin/env bash
set -euo pipefail
cd "${RADAR_ROOT:-/opt/radar-sampah}/deploy/gcp"
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(docker-compose)
fi
"${COMPOSE[@]}" exec -T app python - < acceptance.py
