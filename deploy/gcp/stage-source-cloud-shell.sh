#!/usr/bin/env bash
set -euo pipefail

NAME="${NAME:-radar-sampah}"
ZONE="${ZONE:-us-west1-b}"
REPO="${REPO:-https://github.com/huangguan-giegie/radar_sampah.git}"
REF="${REF:-deploy/gcp-e2-micro}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

echo "Cloning ${REF} in Cloud Shell..."
git clone --depth=1 --branch "${REF}" "${REPO}" "${WORKDIR}/repo"

if ! command -v git-lfs >/dev/null 2>&1; then
  echo "git-lfs is required in Cloud Shell to stage the ONNX detector weights."
  exit 2
fi
git -C "${WORKDIR}/repo" lfs pull

tar -C "${WORKDIR}/repo"   --exclude=.git   -czf "${WORKDIR}/radar-sampah.tgz" .

echo "Copying source to VM through IAP (no public IPv4 required)..."
gcloud compute scp "${WORKDIR}/radar-sampah.tgz"   "${NAME}:/tmp/radar-sampah.tgz"   --zone="${ZONE}"   --tunnel-through-iap

gcloud compute ssh "${NAME}"   --zone="${ZONE}"   --tunnel-through-iap   --command='sudo rm -rf /opt/radar-sampah && sudo mkdir -p /opt/radar-sampah && sudo tar -xzf /tmp/radar-sampah.tgz -C /opt/radar-sampah && sudo chown -R "$(id -un)":"$(id -gn)" /opt/radar-sampah && chmod +x /opt/radar-sampah/deploy/gcp/*.sh && /opt/radar-sampah/deploy/gcp/bootstrap.sh'
