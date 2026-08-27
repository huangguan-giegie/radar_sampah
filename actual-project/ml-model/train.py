from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the six-class Sea-TACO detector.")
    parser.add_argument("--data", type=Path, required=True, help="Combined dataset data.yaml")
    parser.add_argument("--model", default="yolo11m.pt", help="Initial weights or model definition")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="0")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--project", type=Path, default=Path("runs"))
    parser.add_argument("--name", default="yolo11m_sea_taco_6class_100e")
    parser.add_argument("--seed", type=int, default=20260827)
    args = parser.parse_args()

    model = YOLO(args.model)
    model.train(
        data=str(args.data.resolve()),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        amp=True,
        patience=20,
        save_period=10,
        project=str(args.project.resolve()),
        name=args.name,
        seed=args.seed,
        deterministic=True,
    )


if __name__ == "__main__":
    main()
