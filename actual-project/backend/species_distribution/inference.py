"""Load the validated offline OBIS baseline once and serve contextual scores."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


class ModelInputError(ValueError):
    """Raised when a prediction coordinate is not valid."""


class ModelAreaError(ValueError):
    """Raised when a coordinate is outside the supported Malaysian EEZ."""


def _point_on_segment(x: float, y: float, x1: float, y1: float, x2: float, y2: float) -> bool:
    tolerance = 1e-12
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    return abs(cross) <= tolerance and min(x1, x2) - tolerance <= x <= max(x1, x2) + tolerance and min(y1, y2) - tolerance <= y <= max(y1, y2) + tolerance


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    previous = ring[-1]
    for current in ring:
        x1, y1 = float(previous[0]), float(previous[1])
        x2, y2 = float(current[0]), float(current[1])
        if _point_on_segment(lon, lat, x1, y1, x2, y2):
            return True
        if (y1 > lat) != (y2 > lat):
            x_at_latitude = (x2 - x1) * (lat - y1) / (y2 - y1) + x1
            if lon < x_at_latitude:
                inside = not inside
        previous = current
    return inside


def _point_in_geometry(lon: float, lat: float, geometry: dict[str, Any]) -> bool:
    coordinates = geometry["coordinates"]
    polygons = [coordinates] if geometry["type"] == "Polygon" else coordinates
    if geometry["type"] not in {"Polygon", "MultiPolygon"}:
        raise ValueError(f"Unsupported EEZ geometry: {geometry['type']}")
    for polygon in polygons:
        if polygon and _point_in_ring(lon, lat, polygon[0]) and not any(_point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            return True
    return False


class SpeciesDistributionModel:
    """The four-model registry is loaded once during application startup."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = root or Path(__file__).resolve().parent
        manifest_path = self.root / "models" / "model_manifest.json"
        with manifest_path.open(encoding="utf-8") as handle:
            manifest = json.load(handle)
        if manifest.get("features") != ["latitude", "longitude"]:
            raise RuntimeError("The species model manifest has unsupported features.")
        eez_path = self.root / "reference" / "malaysia_eez_marineregions_v12.geojson"
        with eez_path.open(encoding="utf-8") as handle:
            collection = json.load(handle)
        features = collection.get("features", [])
        if len(features) != 1 or "geometry" not in features[0]:
            raise RuntimeError("The Malaysian EEZ reference geometry is invalid.")
        self.geometry = features[0]["geometry"]
        self.model_version = str(manifest.get("trained_at_utc", ""))[:10] or "offline-baseline"
        self.models: list[dict[str, Any]] = []
        for entry in manifest.get("species", []):
            path = self.root / "models" / Path(str(entry["selected_model_path"])).name
            if not path.is_file():
                raise RuntimeError(f"Missing species model: {path.name}")
            artifact = joblib.load(path)
            model = artifact.get("model") if isinstance(artifact, dict) else artifact
            if model is None or not hasattr(model, "predict_proba"):
                raise RuntimeError(f"Species model cannot produce probabilities: {path.name}")
            self.models.append({"entry": entry, "model": model})
        if len(self.models) != 4:
            raise RuntimeError("Exactly four species models are required.")

    def predict(self, latitude: float, longitude: float) -> dict[str, Any]:
        if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise ModelInputError("latitude and longitude must be valid coordinates.")
        if not _point_in_geometry(longitude, latitude, self.geometry):
            raise ModelAreaError("The coordinate is outside the supported Malaysian EEZ.")
        features = pd.DataFrame([{"latitude": latitude, "longitude": longitude}])
        predictions = []
        for item in self.models:
            entry = item["entry"]
            model = item["model"]
            probabilities = model.predict_proba(features)[0]
            classes = list(getattr(model, "classes_", [0, 1]))
            positive_index = classes.index(1) if 1 in classes else len(probabilities) - 1
            predictions.append(
                {
                    "speciesSlug": entry["slug"],
                    "scientificName": entry["scientific_name"],
                    "commonNameEn": entry["common_name_en"],
                    "relativeOccurrenceScore": round(float(probabilities[positive_index]), 6),
                    "selectedModel": entry["selected_model"],
                }
            )
        return {
            "insideMalaysianEez": True,
            "scoreType": "relative_occurrence",
            "calibratedProbability": False,
            "predictions": predictions,
            "modelVersion": self.model_version,
        }
