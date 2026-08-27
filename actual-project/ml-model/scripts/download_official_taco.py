from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image


def valid_image(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size == 0:
        return False
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except Exception:
        return False


def fetch(url: str, destination: Path, retries: int = 4) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 TACO dataset downloader"})
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(destination.suffix + ".part")
            temporary.write_bytes(payload)
            if not valid_image(temporary):
                raise ValueError("downloaded payload is not a valid image")
            temporary.replace(destination)
            return
        except Exception as exc:
            last_error = exc
            time.sleep(2 ** attempt)
    raise RuntimeError(str(last_error))


def download_one(root: Path, image: dict) -> dict:
    destination = root / image["file_name"]
    if valid_image(destination):
        return {"status": "existing", "file": image["file_name"], "source": "existing"}
    errors = []
    for source, url in (("original", image.get("flickr_url")), ("flickr_640", image.get("flickr_640_url"))):
        if not url:
            continue
        try:
            fetch(url, destination)
            return {"status": "downloaded", "file": image["file_name"], "source": source}
        except Exception as exc:
            errors.append(f"{source}: {exc}")
    return {"status": "failed", "file": image["file_name"], "errors": errors}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    root = args.annotations.resolve().parent
    dataset = json.loads(args.annotations.read_text(encoding="utf-8"))
    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(download_one, root, image) for image in dataset["images"]]
        for index, future in enumerate(as_completed(futures), 1):
            result = future.result()
            results.append(result)
            if index % 25 == 0 or result["status"] == "failed":
                counts = {key: sum(r["status"] == key for r in results) for key in ("downloaded", "existing", "failed")}
                print(f"{index}/{len(futures)} downloaded={counts['downloaded']} existing={counts['existing']} failed={counts['failed']}", flush=True)
    report = {
        "total": len(results),
        "downloaded_original": sum(r.get("source") == "original" for r in results),
        "downloaded_flickr_640": sum(r.get("source") == "flickr_640" for r in results),
        "existing": sum(r["status"] == "existing" for r in results),
        "failed": [r for r in results if r["status"] == "failed"],
    }
    report_path = root / "download-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in report.items()}, indent=2))
    if report["failed"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
