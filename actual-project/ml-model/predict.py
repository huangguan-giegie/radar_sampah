from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Sea-TACO litter detection.")
    parser.add_argument("--source", required=True, help="Image, directory, video, URL, or camera index")
    parser.add_argument(
        "--weights",
        type=Path,
        default=ROOT / "models" / "sea_taco_yolo11m_best.pt",
    )
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--iou", type=float, default=0.7)
    parser.add_argument("--device", default=None)
    parser.add_argument("--project", type=Path, default=ROOT / "runs")
    parser.add_argument("--name", default="predict")
    args = parser.parse_args()

    model = YOLO(str(args.weights.resolve()))
    model.predict(
        source=args.source,
        conf=args.conf,
        iou=args.iou,
        device=args.device,
        save=True,
        project=str(args.project.resolve()),
        name=args.name,
    )


if __name__ == "__main__":
    main()
