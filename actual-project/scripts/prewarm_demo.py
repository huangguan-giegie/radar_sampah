#!/usr/bin/env python3
"""Warm the public read endpoints before an Iteration 3 demo.

This deliberately performs GET requests only. It does not retry or submit any
write operation, preserving the Iteration 2 decision not to add write retries.
"""

from __future__ import annotations

import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_API = "https://team04-marine-observation-api.onrender.com"
PATHS = ("/health", "/beaches", "/cleanup-events")


def main() -> int:
    base = (sys.argv[1] if len(sys.argv) > 1 else os.getenv("RADAR_API_BASE_URL", DEFAULT_API)).rstrip("/")
    print(f"Warming {base}")
    for path in PATHS:
        url = base + path
        started = time.perf_counter()
        try:
            with urlopen(Request(url, headers={"User-Agent": "radar-sampah-demo-prewarm/1.0"}), timeout=90) as response:
                response.read(256)
                elapsed = time.perf_counter() - started
                print(f"{response.status} {path} {elapsed:.2f}s")
                if response.status < 200 or response.status >= 300:
                    return 1
        except (HTTPError, URLError, TimeoutError) as exc:
            elapsed = time.perf_counter() - started
            print(f"FAIL {path} {elapsed:.2f}s: {exc}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
