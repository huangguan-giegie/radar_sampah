#!/usr/bin/env bash
set -euo pipefail

RADAR_ROOT="${RADAR_ROOT:-/opt/radar-sampah}"
RADAR_REF="${RADAR_REF:-main}"

cd "${RADAR_ROOT}"
git fetch origin --prune
git checkout "${RADAR_REF}"
git pull --ff-only origin "${RADAR_REF}"

cd deploy/oracle

if sudo docker compose version >/dev/null 2>&1; then
  COMPOSE=(sudo docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(sudo docker-compose)
else
  echo "Docker Compose is unavailable."
  exit 1
fi

"${COMPOSE[@]}" build app
"${COMPOSE[@]}" up -d --no-deps app

echo "Waiting for application health..."
for _ in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T app python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)" >/dev/null 2>&1; then
    echo "Update healthy."
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 4
done

echo "Updated container failed its health check."
"${COMPOSE[@]}" logs --tail=120 app
exit 1
