#!/usr/bin/env bash
set -euo pipefail

echo "== IPv6 preflight =="

for url in   https://deb.debian.org/   https://registry-1.docker.io/v2/   https://pypi.org/simple/   https://registry.npmjs.org/react
do
  echo "Checking IPv6 HTTPS: ${url}"
  curl -6 -sSI --connect-timeout 8 --max-time 15 "${url}" >/dev/null
done

if [ ! -f .env ]; then
  echo ".env is missing; cannot test DATABASE_URL."
  exit 2
fi

set -a
. ./.env
set +a

python3 - <<'PY'
import os
import socket
from urllib.parse import urlparse

raw = os.environ.get("DATABASE_URL", "").strip()
if not raw:
    raise SystemExit("DATABASE_URL is missing.")
u = urlparse(raw)
host = u.hostname
port = u.port or 5432
if not host:
    raise SystemExit("DATABASE_URL has no hostname.")

records = socket.getaddrinfo(host, port, socket.AF_INET6, socket.SOCK_STREAM)
if not records:
    raise SystemExit(f"Database host {host} has no IPv6 address.")

last_error = None
for family, socktype, proto, _, sockaddr in records:
    s = socket.socket(family, socktype, proto)
    s.settimeout(6)
    try:
        s.connect(sockaddr)
        print(f"Database IPv6 TCP reachable: {host}:{port}")
        break
    except OSError as exc:
        last_error = exc
    finally:
        s.close()
else:
    raise SystemExit(f"Database has IPv6 DNS but TCP connection failed: {last_error}")
PY

echo "IPv6 preflight passed."
