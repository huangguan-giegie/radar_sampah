from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--classes", type=int, default=6)
    args = parser.parse_args()
    root = args.root.resolve()
    splits = ("train", "val", "test")
    report = {"root": str(root), "splits": {}, "class_counts": Counter(), "issues": []}
    seen_hashes = defaultdict(list)
    for split in splits:
        image_dir = root / "images" / split
        label_dir = root / "labels" / split
        images = sorted(image_dir.glob("*"))
        labels = sorted(label_dir.glob("*.txt"))
        image_stems = {item.stem for item in images}
        label_stems = {item.stem for item in labels}
        info = Counter(images=len(images), labels=len(labels), boxes=0, empty_labels=0)
        info["missing_labels"] = len(image_stems - label_stems)
        info["orphan_labels"] = len(label_stems - image_stems)
        for image_path in images:
            try:
                with Image.open(image_path) as image:
                    image.verify()
            except Exception as exc:
                report["issues"].append(f"corrupt image {image_path}: {exc}")
            seen_hashes[digest(image_path)].append(f"{split}/{image_path.name}")
        for label_path in labels:
            lines = [line.strip() for line in label_path.read_text(encoding="utf-8").splitlines() if line.strip()]
            if not lines:
                info["empty_labels"] += 1
            for line_number, line in enumerate(lines, 1):
                fields = line.split()
                if len(fields) != 5:
                    report["issues"].append(f"field count {label_path}:{line_number}")
                    continue
                try:
                    class_raw = float(fields[0])
                    class_id = int(class_raw)
                    values = [float(value) for value in fields[1:]]
                except ValueError:
                    report["issues"].append(f"nonnumeric {label_path}:{line_number}")
                    continue
                if class_raw != class_id or not 0 <= class_id < args.classes:
                    report["issues"].append(f"class id {label_path}:{line_number}: {fields[0]}")
                if any(value < 0 or value > 1 for value in values) or values[2] <= 0 or values[3] <= 0:
                    report["issues"].append(f"box {label_path}:{line_number}: {' '.join(fields[1:])}")
                info["boxes"] += 1
                report["class_counts"][class_id] += 1
        report["splits"][split] = dict(info)
    report["class_counts"] = dict(sorted(report["class_counts"].items()))
    report["exact_duplicate_groups_across_splits"] = [
        locations for locations in seen_hashes.values() if len({item.split("/", 1)[0] for item in locations}) > 1
    ]
    report["totals"] = {
        "images": sum(item["images"] for item in report["splits"].values()),
        "labels": sum(item["labels"] for item in report["splits"].values()),
        "boxes": sum(item["boxes"] for item in report["splits"].values()),
    }
    report_path = root / "validation-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {
        "splits": report["splits"],
        "totals": report["totals"],
        "class_counts": report["class_counts"],
        "issues": len(report["issues"]),
        "exact_duplicate_groups_across_splits": len(report["exact_duplicate_groups_across_splits"]),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if report["issues"] or report["exact_duplicate_groups_across_splits"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
