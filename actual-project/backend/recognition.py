"""Optional local YOLO inference for report and cleanup photos.

The production detector uses an embedded-NMS ONNX export so the 512 MiB
Render service does not need PyTorch or Ultralytics at runtime. A missing LFS
checkout or unavailable runtime still leaves manual confirmation available.
"""

from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import numpy as np
from PIL import Image


MODEL_CLASS_NAMES = {
    0: "plastic",
    1: "metal",
    2: "glass",
    3: "paper_cardboard",
    4: "styrofoam",
    5: "fishing_gear",
}
MODEL_CLASSES = {
    "plastic": "Plastic",
    "metal": "Metal",
    "glass": "Glass",
    "paper_cardboard": "Paper",
    "styrofoam": "Other",
    "fishing_gear": "Fishing gear",
}
FRONTEND_CATEGORIES = ("Fishing gear", "Plastic", "Glass", "Metal", "Other", "Paper")
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "ml-model" / "models" / "sea_taco_yolo11m_best.onnx"
DEFAULT_INFERENCE_SIZE = 320


class OnnxYoloModel:
    """Small adapter that preserves the result shape expected by LitterRecognizer."""

    names = MODEL_CLASS_NAMES

    def __init__(self, session: Any):
        self.session = session
        self.input_name = session.get_inputs()[0].name

    @staticmethod
    def _letterbox(source: Image.Image, size: int) -> tuple[np.ndarray, float, float, float]:
        width, height = source.size
        if width <= 0 or height <= 0:
            raise ValueError("Image dimensions must be positive")
        scale = min(size / width, size / height)
        resized_width = max(1, min(size, round(width * scale)))
        resized_height = max(1, min(size, round(height * scale)))
        resized = source.resize((resized_width, resized_height), Image.Resampling.BILINEAR)
        canvas = Image.new("RGB", (size, size), (114, 114, 114))
        pad_x = (size - resized_width) / 2
        pad_y = (size - resized_height) / 2
        canvas.paste(resized, (round(pad_x), round(pad_y)))
        array = np.asarray(canvas, dtype=np.float32) / 255.0
        tensor = np.ascontiguousarray(array.transpose(2, 0, 1)[None, ...])
        resized.close()
        canvas.close()
        return tensor, scale, pad_x, pad_y

    def predict(
        self,
        *,
        source: Image.Image,
        conf: float = 0.25,
        iou: float = 0.7,
        imgsz: int = DEFAULT_INFERENCE_SIZE,
        device: str = "cpu",
        batch: int = 1,
        verbose: bool = False,
    ) -> list[Any]:
        del iou, verbose
        if device != "cpu" or batch != 1:
            raise ValueError("ONNX production inference is CPU-only with batch=1")
        tensor, scale, pad_x, pad_y = self._letterbox(source, imgsz)
        outputs = self.session.run(None, {self.input_name: tensor})
        if not outputs:
            rows = np.empty((0, 6), dtype=np.float32)
        else:
            rows = np.asarray(outputs[0], dtype=np.float32)
            if rows.ndim == 3:
                rows = rows[0]
            if rows.ndim != 2 or rows.shape[-1] < 6:
                raise ValueError(f"Unexpected ONNX output shape: {rows.shape}")

        class_ids: list[float] = []
        confidences: list[float] = []
        coordinates: list[list[float]] = []
        original_width, original_height = source.size
        for row in rows:
            confidence = float(row[4])
            class_id = int(round(float(row[5])))
            if confidence < conf or class_id not in self.names:
                continue
            x1 = (float(row[0]) - pad_x) / scale
            y1 = (float(row[1]) - pad_y) / scale
            x2 = (float(row[2]) - pad_x) / scale
            y2 = (float(row[3]) - pad_y) / scale
            x1 = min(max(x1, 0.0), float(original_width))
            y1 = min(max(y1, 0.0), float(original_height))
            x2 = min(max(x2, 0.0), float(original_width))
            y2 = min(max(y2, 0.0), float(original_height))
            if x2 <= x1 or y2 <= y1:
                continue
            class_ids.append(float(class_id))
            confidences.append(confidence)
            coordinates.append([x1, y1, x2, y2])

        boxes = SimpleNamespace(
            cls=np.asarray(class_ids, dtype=np.float32),
            conf=np.asarray(confidences, dtype=np.float32),
            xyxy=np.asarray(coordinates, dtype=np.float32).reshape(-1, 4),
        )
        return [SimpleNamespace(boxes=boxes, names=self.names)]


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
        model_path = Path(os.getenv("LITTER_ONNX_MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser()
        version = os.getenv("LITTER_MODEL_VERSION", "sea-taco-yolo11m-best-onnx/1")
        try:
            inference_size = int(os.getenv("LITTER_INFERENCE_SIZE", str(DEFAULT_INFERENCE_SIZE)))
            if inference_size <= 0:
                raise ValueError("LITTER_INFERENCE_SIZE must be positive")
            if not model_path.is_file():
                return cls(None, version, "weights_missing", inference_size=inference_size)
            with model_path.open("rb") as model_file:
                if model_file.read(64).startswith(b"version https://git-lfs.github.com/spec/v1"):
                    return cls(None, version, "git_lfs_weights_not_downloaded", inference_size=inference_size)

            import onnxruntime as ort

            session_options = ort.SessionOptions()
            session_options.intra_op_num_threads = 1
            session_options.inter_op_num_threads = 1
            session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            session = ort.InferenceSession(
                str(model_path),
                sess_options=session_options,
                providers=["CPUExecutionProvider"],
            )
            recognizer = cls(OnnxYoloModel(session), version, inference_size=inference_size)
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
            try:
                results = self._predict(source)
            finally:
                source.close()
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
