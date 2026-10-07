# Radar Sampah — GCP Free Tier + IPv6 + Cloudflare

This deployment targets a near-zero/zero monthly infrastructure bill while
keeping the existing Render deployment untouched until acceptance testing is
complete.

## Target architecture

- Compute Engine `e2-micro` in `us-west1` (Oregon)
- 1 GB RAM
- 30 GB `pd-standard` boot disk
- 2 GB swap
- No external IPv4 address
- One static regional external IPv6 range
- IAP TCP forwarding for SSH administration
- Cloudflare proxied AAAA record for public HTTP/HTTPS
- Existing external PostgreSQL database stays in place
- Existing Render deployment remains the rollback target

The Google Cloud Free Tier currently covers one non-preemptible e2-micro in
us-west1/us-central1/us-east1, 30 GB-month standard persistent disk, and 1 GB
of eligible outbound data transfer per month. External IPv6 assigned to a VM
is not billed. Usage above the Free Tier limits can still incur charges.

## Why dual-stack internally

The VM keeps an internal RFC1918 IPv4 address for Google internal services and
IAP administration, but it has no external IPv4 address. Its only public origin
address is IPv6.

## Step 1 — create the VM from Cloud Shell

Clone/check out this deployment branch in Google Cloud Shell, then run:

```bash
chmod +x deploy/gcp/*.sh
./deploy/gcp/create-vm-cloud-shell.sh
```

The script creates:

- custom VPC `radar-sampah-vpc`
- dual-stack subnet in `us-west1`
- static external IPv6 for the VM
- firewall rules for IPv6 HTTP/HTTPS
- IAP-only SSH access
- `e2-micro` with 30 GB standard persistent disk
- no external IPv4

Confirm that the printed `EXTERNAL_IPV4` column is empty.

## Step 2 — stage source without requiring GitHub access from the VM

Run in Cloud Shell:

```bash
./deploy/gcp/stage-source-cloud-shell.sh
```

The script transfers the repository through IAP and runs the first bootstrap.
The first bootstrap intentionally stops after creating:

```
/opt/radar-sampah/deploy/gcp/.env
```

## Step 3 — preserve production secrets

Copy the exact current Render production values into the new `.env`.

Required:

```env
SITE_ADDRESS=:80
RADAR_ENV=production
PORT=5000
TRUST_PROXY_HEADERS=1
DATABASE_URL=...
AUTH_JWT_SECRET=...
GEO_PRIVACY_HMAC_KEY=...
```

Do not rotate `AUTH_JWT_SECRET` or `GEO_PRIVACY_HMAC_KEY` during migration.

Copy these only when they exist in current production:

```env
DATABASE_SCHEMA=
DEMO_PARTICIPANT_ID=
LITTER_RECOGNITION_ENABLED=
LITTER_RECOGNITION_API_URL=
LITTER_RECOGNITION_API_KEY=
LITTER_ONNX_MODEL_PATH=
LITTER_MODEL_VERSION=
LITTER_INFERENCE_SIZE=
```

## Step 4 — mandatory IPv6/database preflight

The bootstrap runs `test-ipv6-dependencies.sh` before building.

It verifies IPv6 HTTPS reachability for:

- Debian package infrastructure
- Docker Hub Registry
- PyPI
- npm Registry

It then extracts the PostgreSQL hostname from `DATABASE_URL`, requires an
IPv6 DNS result, and requires a TCP connection to the database over IPv6.

If the current PostgreSQL endpoint does not support IPv6, deployment stops.
Cloudflare cannot fix application-to-database outbound connectivity.

## Step 5 — deploy and validate by IPv6

After filling `.env`:

```bash
gcloud compute ssh radar-sampah \
  --zone=us-west1-b \
  --tunnel-through-iap \
  --command='cd /opt/radar-sampah/deploy/gcp && ./bootstrap.sh'
```

Then test the origin from an IPv6-capable environment:

```bash
curl -6 http://[STATIC_IPV6]/api/health
```

Keep Render live while validating:

- homepage
- login/token continuity
- beach pages
- create report
- cleanup
- image upload/read
- ONNX litter recognition
- 40-species prediction
- event flows

## Step 6 — Cloudflare cutover

In the chosen Cloudflare-managed DNS zone create:

- Type: `AAAA`
- Name: chosen Radar Sampah hostname
- Content: the VM static external IPv6
- Proxy status: **Proxied** (orange cloud)

Then update `.env`:

```env
SITE_ADDRESS=radar.example.com
```

and restart Caddy:

```bash
cd /opt/radar-sampah/deploy/gcp
sudo docker compose up -d caddy
```

Caddy can then serve the hostname over HTTPS while Cloudflare proxies traffic
to the IPv6-only public origin.

Do not delete the Render deployment until the GCP deployment has passed the
full acceptance test and remained stable.

## Administration

The VM deliberately has no external IPv4. Use IAP:

```bash
gcloud compute ssh radar-sampah \
  --zone=us-west1-b \
  --tunnel-through-iap
```

## Cost guardrails

To remain at $0 under the current Free Tier:

- keep the machine type at `e2-micro`
- keep the VM in `us-west1`, `us-central1`, or `us-east1`
- keep standard persistent disk usage at or below the free allowance
- do not add an external IPv4
- watch monthly outbound transfer; the Compute Engine Free Tier includes only
  the stated free outbound allowance
- avoid paid load balancers, Cloud NAT, GPUs, extra paid disks, and other
  non-Free-Tier resources

Cloudflare proxying does not make Google origin egress unlimited; dynamic
responses sent from GCP to Cloudflare still count as GCP outbound traffic.
