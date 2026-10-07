# Radar Sampah — Oracle A1 deployment

This directory deploys the existing production application as one Docker image
behind Caddy. PostgreSQL remains external, so the migration does not move or
rewrite production data.

## Target

- OCI Compute: `VM.Standard.A1.Flex`
- Recommended initial size: 1 OCPU / 2 GB RAM
- Ubuntu 24.04 ARM64
- 2 GB swap
- Public ports: 22 (restricted to the administrator if practical), 80, 443
- Application container is not exposed directly; Caddy proxies to port 5000.

## Safe migration sequence

1. Keep the current Render frontend/API running.
2. Create the Oracle VM in the account's home region using an Always Free
   eligible A1 shape.
3. Allow inbound TCP 80/443 in the OCI VCN security list or NSG.
4. SSH to the VM.
5. Clone this repository and check out `deploy/oracle-a1`.
6. Run `deploy/oracle/bootstrap.sh`.
7. The first run creates `deploy/oracle/.env` and stops before deployment.
8. Copy the current Render production values into `.env`. Do not rotate
   `AUTH_JWT_SECRET` or `GEO_PRIVACY_HMAC_KEY` during migration.
9. Rerun `bootstrap.sh`.
10. Test the VM by public IP while `SITE_ADDRESS=:80`.
11. Verify health, homepage, login, report creation, cleanup, litter
    recognition and species prediction.
12. Only after successful verification, point the production hostname to the
    Oracle public IP and change `SITE_ADDRESS` to that hostname. Running
    `docker compose up -d` lets Caddy obtain HTTPS automatically.
13. Keep Render available as a rollback target until the new deployment has
    been stable.

## Bootstrap

From a checked-out repository:

```bash
chmod +x deploy/oracle/bootstrap.sh deploy/oracle/update.sh
./deploy/oracle/bootstrap.sh
```

The first execution intentionally exits after creating `.env` if production
secrets have not been supplied.

## Required environment values

```env
SITE_ADDRESS=:80
RADAR_ENV=production
PORT=5000
TRUST_PROXY_HEADERS=1
DATABASE_URL=...
AUTH_JWT_SECRET=...
GEO_PRIVACY_HMAC_KEY=...
```

Copy optional recognition/database variables from the current Render service
only when they are set there.

## Verification

On the VM:

```bash
cd /opt/radar-sampah/deploy/oracle
sudo docker compose ps
curl -fsS http://127.0.0.1/api/health
sudo docker compose logs --tail=100 app
```

From another machine:

```bash
curl -fsS http://ORACLE_PUBLIC_IP/api/health
```

The current Render deployment should remain untouched until these checks and
the application's manual acceptance checks have passed.

## Updating after cutover

After this deployment support is merged to `main`:

```bash
cd /opt/radar-sampah
RADAR_REF=main ./deploy/oracle/update.sh
```

The updater builds the replacement image before recreating the application
container and fails if the new container does not become healthy.
