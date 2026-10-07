#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${RADAR_REPO_URL:-https://github.com/huangguan-giegie/radar_sampah.git}"
RADAR_REF="${RADAR_REF:-deploy/oracle-a1}"
RADAR_ROOT="${RADAR_ROOT:-/opt/radar-sampah}"

echo "== Radar Sampah Oracle bootstrap =="
echo "Architecture: $(uname -m)"
echo "Target: ${RADAR_ROOT} @ ${RADAR_REF}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl git docker.io
if ! sudo docker compose version >/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-v2 ||     sudo apt-get install -y docker-compose-plugin ||     sudo apt-get install -y docker-compose
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

if [ ! -d "${RADAR_ROOT}/.git" ]; then
  sudo mkdir -p "${RADAR_ROOT}"
  sudo chown "${USER}":"${USER}" "${RADAR_ROOT}"
  git clone "${REPO_URL}" "${RADAR_ROOT}"
fi

cd "${RADAR_ROOT}"
git fetch origin --prune
git checkout "${RADAR_REF}"
git pull --ff-only origin "${RADAR_REF}"

cd deploy/oracle
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo
  echo "Created ${RADAR_ROOT}/deploy/oracle/.env."
  echo "Copy the current Render production secrets into it, then rerun this script."
  exit 2
fi

if grep -q 'replace-me' .env; then
  echo "Refusing to deploy: .env still contains replace-me placeholders."
  exit 2
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
"${COMPOSE[@]}" up -d

echo "Waiting for /api/health..."
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null; then
    echo "Radar Sampah is healthy on this VM."
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 4
done

echo "Health check did not become ready."
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=120 app caddy
exit 1
