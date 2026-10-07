#!/usr/bin/env bash
set -euo pipefail

RADAR_ROOT="${RADAR_ROOT:-/opt/radar-sampah}"
DEPLOY_DIR="${RADAR_ROOT}/deploy/gcp"

echo "== Radar Sampah GCP bootstrap =="
echo "Architecture: $(uname -m)"
echo "Root: ${RADAR_ROOT}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl docker.io python3

if ! sudo docker compose version >/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-plugin ||     sudo apt-get install -y docker-compose || true
fi
sudo systemctl enable --now docker

if ! sudo swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile
fi
if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if [ ! -d "${DEPLOY_DIR}" ]; then
  echo "Deployment source is missing at ${RADAR_ROOT}."
  echo "Stage the repository from Cloud Shell first."
  exit 2
fi

cd "${DEPLOY_DIR}"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo
  echo "Created ${DEPLOY_DIR}/.env."
  echo "Copy the current Render production secrets into it, then rerun bootstrap.sh."
  exit 2
fi

if grep -q 'replace-me' .env; then
  echo "Refusing to deploy: .env still contains replace-me placeholders."
  exit 2
fi

./test-ipv6-dependencies.sh

if sudo docker compose version >/dev/null 2>&1; then
  COMPOSE=(sudo docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(sudo docker-compose)
else
  echo "Docker Compose is unavailable."
  exit 1
fi

echo
echo "Memory before build:"
free -h

"${COMPOSE[@]}" build app
"${COMPOSE[@]}" up -d

echo "Waiting for /api/health..."
for _ in $(seq 1 45); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null; then
    echo "Radar Sampah is healthy."
    "${COMPOSE[@]}" ps
    echo
    free -h
    exit 0
  fi
  sleep 4
done

echo "Health check did not become ready."
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=160 app caddy
exit 1
