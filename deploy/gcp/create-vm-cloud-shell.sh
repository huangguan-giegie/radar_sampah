#!/usr/bin/env bash
set -euo pipefail

NAME="${NAME:-radar-sampah}"
ZONE="${ZONE:-us-west1-b}"
REGION="${ZONE%-*}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-micro}"
DISK_SIZE="${DISK_SIZE:-30GB}"

echo "Project: $(gcloud config get-value project 2>/dev/null)"
echo "Creating/verifying ${NAME} in ${ZONE}"
echo "Machine: ${MACHINE_TYPE}; disk: ${DISK_SIZE} pd-standard"

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [ -z "${PROJECT}" ] || [ "${PROJECT}" = "(unset)" ]; then
  echo "No active Google Cloud project. Run: gcloud config set project PROJECT_ID"
  exit 2
fi

gcloud services enable compute.googleapis.com

if ! gcloud compute firewall-rules describe radar-sampah-web >/dev/null 2>&1; then
  gcloud compute firewall-rules create radar-sampah-web     --network=default     --direction=INGRESS     --priority=1000     --action=ALLOW     --rules=tcp:80,tcp:443     --source-ranges=0.0.0.0/0     --target-tags=radar-sampah-web
fi

if gcloud compute instances describe "${NAME}" --zone="${ZONE}" >/dev/null 2>&1; then
  echo "Instance already exists; leaving it unchanged."
else
  gcloud compute instances create "${NAME}"     --zone="${ZONE}"     --machine-type="${MACHINE_TYPE}"     --provisioning-model=STANDARD     --image-family=debian-12     --image-project=debian-cloud     --boot-disk-size="${DISK_SIZE}"     --boot-disk-type=pd-standard     --tags=radar-sampah-web
fi

echo
gcloud compute instances describe "${NAME}" --zone="${ZONE}"   --format='table(name,zone.basename(),machineType.basename(),status,networkInterfaces[0].accessConfigs[0].natIP:label=EXTERNAL_IP,disks[0].diskSizeGb:label=DISK_GB)'

echo
echo "Next command:"
echo "gcloud compute ssh ${NAME} --zone=${ZONE}"
