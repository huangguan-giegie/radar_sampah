#!/usr/bin/env bash
set -euo pipefail

NAME="${NAME:-radar-sampah}"
ZONE="${ZONE:-us-west1-b}"
REGION="${ZONE%-*}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-micro}"
DISK_SIZE="${DISK_SIZE:-30GB}"
NETWORK="${NETWORK:-radar-sampah-vpc}"
SUBNET="${SUBNET:-radar-sampah-us-west1}"

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [ -z "${PROJECT}" ] || [ "${PROJECT}" = "(unset)" ]; then
  echo "No active Google Cloud project."
  echo "Run: gcloud config set project PROJECT_ID"
  exit 2
fi

echo "Project: ${PROJECT}"
echo "Target: ${NAME} / ${ZONE}"
echo "Machine: ${MACHINE_TYPE}; disk: ${DISK_SIZE} pd-standard"
echo "Network: internal IPv4 + external IPv6; NO external IPv4"

gcloud services enable compute.googleapis.com iap.googleapis.com

if ! gcloud compute networks describe "${NETWORK}" >/dev/null 2>&1; then
  gcloud compute networks create "${NETWORK}" --subnet-mode=custom
fi

if ! gcloud compute networks subnets describe "${SUBNET}" --region="${REGION}" >/dev/null 2>&1; then
  gcloud compute networks subnets create "${SUBNET}"     --network="${NETWORK}"     --range=10.42.0.0/24     --stack-type=IPV4_IPV6     --ipv6-access-type=EXTERNAL     --ipv6-network-tier=PREMIUM     --region="${REGION}"
fi

if ! gcloud compute firewall-rules describe radar-sampah-web-v6 >/dev/null 2>&1; then
  gcloud compute firewall-rules create radar-sampah-web-v6     --network="${NETWORK}"     --direction=INGRESS     --priority=1000     --action=ALLOW     --rules=tcp:80,tcp:443     --source-ranges='::/0'     --target-tags=radar-sampah-web
fi

if ! gcloud compute firewall-rules describe radar-sampah-iap-ssh >/dev/null 2>&1; then
  gcloud compute firewall-rules create radar-sampah-iap-ssh     --network="${NETWORK}"     --direction=INGRESS     --priority=1000     --action=ALLOW     --rules=tcp:22     --source-ranges=35.235.240.0/20     --target-tags=radar-sampah-iap
fi

if gcloud compute instances describe "${NAME}" --zone="${ZONE}" >/dev/null 2>&1; then
  echo "Instance already exists; leaving it unchanged."
else
  gcloud compute instances create "${NAME}"     --zone="${ZONE}"     --machine-type="${MACHINE_TYPE}"     --provisioning-model=STANDARD     --image-family=debian-12     --image-project=debian-cloud     --boot-disk-size="${DISK_SIZE}"     --boot-disk-type=pd-standard     --network-interface="subnet=${SUBNET},stack-type=IPV4_IPV6,no-address,ipv6-network-tier=PREMIUM"     --tags=radar-sampah-web,radar-sampah-iap
fi

echo
echo "Created/verified VM:"
gcloud compute instances describe "${NAME}" --zone="${ZONE}"   --format='table(name,zone.basename(),machineType.basename(),status,networkInterfaces[0].networkIP:label=INTERNAL_IPV4,networkInterfaces[0].ipv6AccessConfigs[0].externalIpv6:label=EXTERNAL_IPV6,networkInterfaces[0].accessConfigs[0].natIP:label=EXTERNAL_IPV4,disks[0].diskSizeGb:label=DISK_GB)'

echo
echo "The EXTERNAL_IPV4 column must be empty."
echo "Admin access uses IAP:"
echo "gcloud compute ssh ${NAME} --zone=${ZONE} --tunnel-through-iap"
