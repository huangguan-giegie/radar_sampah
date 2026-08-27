from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def download_range(url: str, path: Path, start: int, end: int, retries: int = 6) -> dict:
    expected = end - start + 1
    path.parent.mkdir(parents=True, exist_ok=True)
    current = path.stat().st_size if path.exists() else 0
    if current > expected:
        raise ValueError(f"Oversized part {path}: {current} > {expected}")
    if current == expected:
        return {"part": path.name, "bytes": current, "status": "existing"}
    for attempt in range(retries):
        offset = path.stat().st_size if path.exists() else 0
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 reproducible dataset downloader",
                "Range": f"bytes={start + offset}-{end}",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response, path.open("ab") as destination:
                if response.status != 206:
                    raise RuntimeError(f"Expected HTTP 206, got {response.status}")
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    destination.write(chunk)
            if path.stat().st_size == expected:
                return {"part": path.name, "bytes": expected, "status": "downloaded"}
        except Exception:
            if attempt + 1 == retries:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--size", type=int, required=True)
    parser.add_argument("--md5", required=True)
    parser.add_argument("--parts", type=int, default=16)
    parser.add_argument("--seed-first-part", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    part_dir = output.parent / f"{output.name}.parts"
    part_dir.mkdir(parents=True, exist_ok=True)
    chunk_size = (args.size + args.parts - 1) // args.parts
    ranges = []
    for index in range(args.parts):
        start = index * chunk_size
        end = min(args.size - 1, (index + 1) * chunk_size - 1)
        if start <= end:
            ranges.append((index, start, end, part_dir / f"part-{index:03d}"))
    if args.seed_first_part and args.seed_first_part.exists() and not ranges[0][3].exists():
        if args.seed_first_part.stat().st_size <= ranges[0][2] - ranges[0][1] + 1:
            shutil.move(str(args.seed_first_part), str(ranges[0][3]))

    results = []
    with ThreadPoolExecutor(max_workers=args.parts) as executor:
        future_map = {executor.submit(download_range, args.url, path, start, end): index for index, start, end, path in ranges}
        for future in as_completed(future_map):
            result = future.result()
            results.append(result)
            complete = sum(item["bytes"] for item in results)
            print(f"completed_parts={len(results)}/{len(ranges)} newly_confirmed_bytes={complete}", flush=True)

    assembling = output.parent / f"{output.name}.assembling"
    md5 = hashlib.md5()
    with assembling.open("wb") as destination:
        for _, _, _, part in ranges:
            with part.open("rb") as source:
                while True:
                    chunk = source.read(4 * 1024 * 1024)
                    if not chunk:
                        break
                    destination.write(chunk)
                    md5.update(chunk)
    actual_size = assembling.stat().st_size
    actual_md5 = md5.hexdigest()
    if actual_size != args.size or actual_md5.lower() != args.md5.lower():
        raise RuntimeError(f"Verification failed: size={actual_size}, md5={actual_md5}")
    assembling.replace(output)
    shutil.rmtree(part_dir)
    report = {"url": args.url, "output": str(output), "bytes": actual_size, "md5": actual_md5, "parts": len(ranges)}
    (output.parent / f"{output.name}.download.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
