"""Optional local YOLO inference for report and cleanup photos.

The detector is loaded once per Flask process. A missing LFS checkout or an
uninstalled optional dependency leaves the API available and returns a
manual-confirmation state instead of preventing the backend from starting.
"""

from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
from typing import Any

from PIL import Image


MODEL_CLASSES = {
    "plastic": "Plastic",
    "metal": "Metal",
    "glass": "Glass",
    "paper_cardboard": "Paper",
    "styrofoam": "Other",
    "fishing_gear": "Fishing gear",
}
FRONTEND_CATEGORIES = ("Fishing gear", "Plastic", "Glass", "Metal", "Other", "Paper")
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "ml-model" / "models" / "sea_taco_yolo11m_best.pt"
DEFAULT_INFERENCE_SIZE = 320


class LitterRecognizer:
    def __init__(
        self,
        model: Any | None,
        version: str,
        unavailable_reason: str | None = None,
        inference_size: int = DEFAULT_INFERENCE_SIZE,
    ):
        self.model = model
        self.version = version
        self.unavailable_reason = unavailable_reason
        self.inference_size = inference_size

    @classmethod
    def load(cls) -> "LitterRecognizer":
        model_path = Path(os.getenv("LITTER_MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser()
        version = os.getenv("LITTER_MODEL_VERSION", "sea-taco-yolo11m-best/1")
        try:
            inference_size = int(os.getenv("LITTER_INFERENCE_SIZE", str(DEFAULT_INFERENCE_SIZE)))
            if inference_size <= 0:
                raise ValueError("LITTER_INFERENCE_SIZE must be positive")
            if not model_path.is_file():
                return cls(None, version, "weights_missing", inference_size=inference_size)
            with model_path.open("rb") as model_file:
                if model_file.read(64).startswith(b"version https://git-lfs.github.com/spec/v1"):
                    return cls(None, version, "git_lfs_weights_not_downloaded", inference_size=inference_size)
            from ultralytics import YOLO

            recognizer = cls(YOLO(str(model_path)), version, inference_size=inference_size)
            warmup_source = Image.new("RGB", (inference_size, inference_size), "black")
            try:
                recognizer._predict(warmup_source)
            finally:
                warmup_source.close()
            return recognizer
        except Exception as error:  # startup must remain available for manual entry
            return cls(None, version, f"model_load_failed:{type(error).__name__}")

    def _predict(self, source: Image.Image) -> Any:
        return self.model.predict(
            source=source,
            conf=0.25,
            iou=0.7,
            imgsz=self.inference_size,
            device="cpu",
            batch=1,
            verbose=False,
        )

    def recognise(self, image_bytes: bytes) -> dict[str, Any]:
        if self.model is None:
            return {
                "state": "unavailable",
                "modelVersion": self.version,
                "counts": {category: 0 for category in FRONTEND_CATEGORIES},
                "detections": [],
                "reason": self.unavailable_reason,
            }
        try:
            with Image.open(BytesIO(image_bytes)) as image:
                source = image.convert("RGB")
                results = self._predict(source)
            counts = {category: 0 for category in FRONTEND_CATEGORIES}
            detections: list[dict[str, Any]] = []
            for result in results:
                boxes = getattr(result, "boxes", None)
                if boxes is None:
                    continue
                names = getattr(result, "names", getattr(self.model, "names", {}))
                class_ids = boxes.cls.tolist() if getattr(boxes, "cls", None) is not None else []
                confidences = boxes.conf.tolist() if getattr(boxes, "conf", None) is not None else []
                coordinates = boxes.xyxy.tolist() if getattr(boxes, "xyxy", None) is not None else []
                for index, class_id in enumerate(class_ids):
                    label = names.get(int(class_id), str(class_id)) if isinstance(names, dict) else str(class_id)
                    model_class = str(label).strip().lower().replace(" ", "_")
                    category = MODEL_CLASSES.get(model_class)
                    if category is None:
                        continue
                    counts[category] += 1
                    detections.append({
                        "modelClass": model_class,
                        "category": category,
                        "confidence": round(float(confidences[index]), 4) if index < len(confidences) else None,
                        "box": [round(float(value), 2) for value in coordinates[index]] if index < len(coordinates) else None,
                    })
            return {
                "state": "ready",
                "modelVersion": self.version,
                "counts": counts,
                "detections": detections,
                "reason": None,
            }
        except Exception as error:
            return {
                "state": "failed",
                "modelVersion": self.version,
                "counts": {category: 0 for category in FRONTEND_CATEGORIES},
                "detections": [],
                "reason": f"inference_failed:{type(error).__name__}",
            }
