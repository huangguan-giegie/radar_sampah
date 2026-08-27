from __future__ import annotations

import argparse
import json
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path


CLASS_NAMES = [
    "plastic",
    "metal",
    "glass",
    "paper_cardboard",
    "styrofoam",
    "fishing_gear",
]

# SEA v44 source classes:
# Glass, Metal, Net, PET_Bottle, Plastic_Buoy, Plastic_Buoy_China,
# Plastic_ETC, Rope, Styrofoam_Box, Styrofoam_Buoy, Styrofoam_Piece.
SEA_CLASS_ID_MAP = {
    0: 2,
    1: 1,
    2: 5,
    3: 0,
    4: 5,
    5: 5,
    6: 0,
    7: 5,
    8: 4,
    9: 4,
    10: 4,
}

TACO_CATEGORY_MAP = {
    "Aluminium foil": "metal",
    "Battery": None,
    "Aluminium blister pack": None,
    "Carded blister pack": None,
    "Other plastic bottle": "plastic",
    "Clear plastic bottle": "plastic",
    "Glass bottle": "glass",
    "Plastic bottle cap": "plastic",
    "Metal bottle cap": "metal",
    "Broken glass": "glass",
    "Food Can": "metal",
    "Aerosol": "metal",
    "Drink can": "metal",
    "Toilet tube": "paper_cardboard",
    "Other carton": "paper_cardboard",
    "Egg carton": "paper_cardboard",
    "Drink carton": "paper_cardboard",
    "Corrugated carton": "paper_cardboard",
    "Meal carton": "paper_cardboard",
    "Pizza box": "paper_cardboard",
    "Paper cup": "paper_cardboard",
    "Disposable plastic cup": "plastic",
    "Foam cup": "styrofoam",
    "Glass cup": "glass",
    "Other plastic cup": "plastic",
    "Food waste": None,
    "Glass jar": "glass",
    "Plastic lid": "plastic",
    "Metal lid": "metal",
    "Other plastic": "plastic",
    "Magazine paper": "paper_cardboard",
    "Tissues": "paper_cardboard",
    "Wrapping paper": "paper_cardboard",
    "Normal paper": "paper_cardboard",
    "Paper bag": "paper_cardboard",
    "Plastified paper bag": "paper_cardboard",
    "Plastic film": "plastic",
    "Six pack rings": "plastic",
    "Garbage bag": "plastic",
    "Other plastic wrapper": "plastic",
    "Single-use carrier bag": "plastic",
    "Polypropylene bag": "plastic",
    "Crisp packet": "plastic",
    "Spread tub": "plastic",
    "Tupperware": "plastic",
    "Disposable food container": "plastic",
    "Foam food container": "styrofoam",
    "Other plastic container": "plastic",
    "Plastic glooves": "plastic",
    "Plastic utensils": "plastic",
    "Pop tab": "metal",
    "Rope & strings": "fishing_gear",
    "Scrap metal": "metal",
    "Shoe": None,
    "Squeezable tube": "plastic",
    "Plastic straw": "plastic",
    "Paper straw": "paper_cardboard",
    "Styrofoam piece": "styrofoam",
    "Unlabeled litter": None,
    "Cigarette": None,
}

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}


def prepare_output(output: Path) -> None:
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(f"Output directory is not empty: {output}")
    for split in ("train", "val", "test"):
        (output / "images" / split).mkdir(parents=True, exist_ok=True)
        (output / "labels" / split).mkdir(parents=True, exist_ok=True)


def add_sea(sea_root: Path, output: Path, stats: dict) -> None:
    source_splits = {"train": "train", "val": "valid", "test": "test"}
    for target_split, source_split in source_splits.items():
        image_dir = sea_root / source_split / "images"
        label_dir = sea_root / source_split / "labels"
        if not image_dir.is_dir() or not label_dir.is_dir():
            raise FileNotFoundError(f"SEA split is incomplete: {sea_root / source_split}")

        for image_path in sorted(image_dir.iterdir()):
            if not image_path.is_file() or image_path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            output_name = f"sea__{image_path.name}"
            shutil.copy2(image_path, output / "images" / target_split / output_name)
            source_label = label_dir / f"{image_path.stem}.txt"
            converted = []
            if source_label.exists():
                for line_number, line in enumerate(source_label.read_text(encoding="utf-8").splitlines(), 1):
                    if not line.strip():
                        continue
                    fields = line.split()
                    if len(fields) != 5:
                        raise ValueError(f"Invalid SEA label {source_label}:{line_number}")
                    source_id = int(fields[0])
                    if source_id not in SEA_CLASS_ID_MAP:
                        raise ValueError(f"Unmapped SEA class {source_id} in {source_label}:{line_number}")
                    target_id = SEA_CLASS_ID_MAP[source_id]
                    converted.append(" ".join([str(target_id), *fields[1:]]))
                    stats[target_split]["boxes"] += 1
                    stats[target_split]["classes"][CLASS_NAMES[target_id]] += 1
                    stats[target_split]["sources"]["sea"] += 1
            target_label = output / "labels" / target_split / f"{Path(output_name).stem}.txt"
            target_label.write_text("\n".join(converted) + ("\n" if converted else ""), encoding="utf-8")
            stats[target_split]["images"]["sea"] += 1


def add_taco(annotations_path: Path, output: Path, seed: int, stats: dict, dropped: Counter) -> None:
    taco_root = annotations_path.resolve().parent
    dataset = json.loads(annotations_path.read_text(encoding="utf-8"))
    categories = {item["id"]: item["name"] for item in dataset["categories"]}
    missing = sorted(set(categories.values()) - set(TACO_CATEGORY_MAP))
    if missing:
        raise ValueError(f"Unmapped TACO categories: {missing}")

    shuffled = list(dataset["images"])
    random.Random(seed).shuffle(shuffled)
    count = len(shuffled)
    split_by_id = {}
    for index, image in enumerate(shuffled):
        split = "train" if index < int(count * 0.8) else "val" if index < int(count * 0.9) else "test"
        split_by_id[image["id"]] = split

    annotations_by_image = defaultdict(list)
    for annotation in dataset["annotations"]:
        annotations_by_image[annotation["image_id"]].append(annotation)
    class_ids = {name: index for index, name in enumerate(CLASS_NAMES)}

    for image in dataset["images"]:
        split = split_by_id[image["id"]]
        source_image = taco_root / image["file_name"]
        if not source_image.is_file():
            raise FileNotFoundError(source_image)
        flat_name = image["file_name"].replace("/", "__").replace("\\", "__")
        output_name = f"taco__{flat_name}"
        shutil.copy2(source_image, output / "images" / split / output_name)

        width = float(image["width"])
        height = float(image["height"])
        lines = []
        for annotation in annotations_by_image.get(image["id"], []):
            source_name = categories[annotation["category_id"]]
            target_name = TACO_CATEGORY_MAP[source_name]
            if target_name is None:
                dropped[source_name] += 1
                continue
            x, y, box_width, box_height = map(float, annotation["bbox"])
            x1, y1 = max(0.0, x), max(0.0, y)
            x2, y2 = min(width, x + box_width), min(height, y + box_height)
            if x2 <= x1 or y2 <= y1:
                continue
            target_id = class_ids[target_name]
            xc = ((x1 + x2) / 2.0) / width
            yc = ((y1 + y2) / 2.0) / height
            bw = (x2 - x1) / width
            bh = (y2 - y1) / height
            lines.append(f"{target_id} {xc:.8f} {yc:.8f} {bw:.8f} {bh:.8f}")
            stats[split]["boxes"] += 1
            stats[split]["classes"][target_name] += 1
            stats[split]["sources"]["taco"] += 1
        target_label = output / "labels" / split / f"{Path(output_name).stem}.txt"
        target_label.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        stats[split]["images"]["taco"] += 1


def serialise_stats(stats: dict) -> dict:
    return {
        split: {
            "images": dict(values["images"]),
            "boxes": values["boxes"],
            "classes": dict(values["classes"]),
            "sources": dict(values["sources"]),
        }
        for split, values in stats.items()
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the six-class combined SEA + TACO YOLO dataset.")
    parser.add_argument("--sea", type=Path, required=True, help="Roboflow SEA export root")
    parser.add_argument("--taco-annotations", type=Path, required=True, help="Official TACO annotations.json")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=20260825)
    args = parser.parse_args()

    sea_root = args.sea.resolve()
    annotations_path = args.taco_annotations.resolve()
    output = args.output.resolve()
    prepare_output(output)
    stats = {
        split: {
            "images": Counter(),
            "boxes": 0,
            "classes": Counter(),
            "sources": Counter(),
        }
        for split in ("train", "val", "test")
    }
    dropped = Counter()
    add_sea(sea_root, output, stats)
    add_taco(annotations_path, output, args.seed, stats, dropped)

    yaml_lines = [
        "path: .",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "",
        f"nc: {len(CLASS_NAMES)}",
        "names:",
        *[f"  {index}: {name}" for index, name in enumerate(CLASS_NAMES)],
    ]
    (output / "data.yaml").write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")
    report = {
        "classes": CLASS_NAMES,
        "sea_class_id_map": SEA_CLASS_ID_MAP,
        "taco_category_map": TACO_CATEGORY_MAP,
        "seed": args.seed,
        "stats": serialise_stats(stats),
        "taco_dropped_categories": dict(dropped),
    }
    (output / "build-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
