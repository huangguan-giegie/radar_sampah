#!/usr/bin/env bash
set -euo pipefail

RADAR_ROOT="${RADAR_ROOT:-/opt/radar-sampah}"
cd "${RADAR_ROOT}/deploy/gcp"

# The full dependency preflight belongs to first-time provisioning. Incremental
# GitHub Actions deployments should restart the service without requiring the
# database secret to be sourced by the shell test.
if [ "${RUN_IPV6_PREFLIGHT:-0}" = "1" ]; then
  ./test-ipv6-dependencies.sh
fi

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

echo "Waiting for updated application health..."
for _ in $(seq 1 75); do
  APP_ID=$("${COMPOSE[@]}" ps -q app)
  if [ "$(sudo docker inspect --format='{{.State.Health.Status}}' "$APP_ID")" = "healthy" ] \
    && "${COMPOSE[@]}" exec -T app python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)" </dev/null >/dev/null 2>&1; then
    echo "Update healthy."
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 4
done

echo "Updated container failed its health check."
"${COMPOSE[@]}" logs --tail=160 app
exit 1
