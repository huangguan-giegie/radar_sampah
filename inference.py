"""Packaged coordinate-only historical occurrence scores and species content.

Exact prediction never moves coordinates. Nearby marine-grid selection is an
explicit method and reports the requested and used coordinates separately.
"""
from __future__ import annotations

import csv
import json
import math
from numbers import Integral, Real
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd


class ModelInputError(ValueError):
    """A coordinate or prediction option is invalid."""


class ModelAreaError(ValueError):
    """A strict coordinate or explicitly selected nearby cell is unsupported."""


def _point_on_segment(x: float, y: float, x1: float, y1: float, x2: float, y2: float) -> bool:
    tolerance = 1e-12
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    return abs(cross) <= tolerance and min(x1, x2) - tolerance <= x <= max(x1, x2) + tolerance and min(y1, y2) - tolerance <= y <= max(y1, y2) + tolerance


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    if not ring:
        return False
    inside, previous = False, ring[-1]
    for current in ring:
        x1, y1 = float(previous[0]), float(previous[1])
        x2, y2 = float(current[0]), float(current[1])
        if _point_on_segment(lon, lat, x1, y1, x2, y2):
            return True
        if (y1 > lat) != (y2 > lat):
            if lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                inside = not inside
        previous = current
    return inside


def _point_in_geometry(lon: float, lat: float, geometry: dict[str, Any]) -> bool:
    if geometry.get("type") not in {"Polygon", "MultiPolygon"}:
        raise ValueError(f"Unsupported EEZ geometry: {geometry.get('type')}")
    coordinates = geometry["coordinates"]
    polygons = [coordinates] if geometry["type"] == "Polygon" else coordinates
    return any(
        polygon and _point_in_ring(lon, lat, polygon[0])
        and not any(_point_in_ring(lon, lat, hole) for hole in polygon[1:])
        for polygon in polygons
    )


def _coordinate(latitude: float, longitude: float) -> tuple[float, float]:
    if any(isinstance(value, bool) or not isinstance(value, Real) for value in (latitude, longitude)):
        raise ModelInputError("latitude and longitude must be numbers.")
    try:
        latitude, longitude = float(latitude), float(longitude)
    except (ValueError, OverflowError):
        raise ModelInputError("latitude and longitude must be valid finite coordinates.") from None
    if not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise ModelInputError("latitude and longitude must be valid finite coordinates.")
    return latitude, longitude


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    term = math.sin(math.radians(lat2 - lat1) / 2) ** 2
    term += math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(min(1.0, math.sqrt(max(0.0, term))))


class SpeciesDistributionModel:
    """Load the manifest registry and frozen reference once per API process."""

    def __init__(self, root: Path | str | None = None) -> None:
        self.root = Path(root) if root is not None else Path(__file__).resolve().parent
        manifest = json.loads((self.root / "models/model_manifest.json").read_text(encoding="utf-8"))
        if manifest.get("features") != ["latitude", "longitude"]:
            raise RuntimeError("The species model manifest has unsupported features.")
        if manifest.get("package_complete") is False:
            raise RuntimeError("The species model package is incomplete.")
        collection = json.loads((self.root / "reference/malaysia_eez_marineregions_v12.geojson").read_text(encoding="utf-8"))
        features = collection.get("features", [])
        if len(features) != 1 or "geometry" not in features[0]:
            raise RuntimeError("The Malaysian EEZ reference geometry is invalid.")
        self.geometry = features[0]["geometry"]
        self.manifest = manifest
        self.model_version = str(manifest.get("model_version") or manifest.get("trained_at_utc", "")[:10] or "offline-baseline")
        self.models: list[dict[str, Any]] = []
        names, slugs = set(), set()
        for entry in manifest.get("species", []):
            name, species_slug = entry["scientific_name"], entry["slug"]
            if name in names or species_slug in slugs:
                raise RuntimeError(f"Duplicate species identity in manifest: {name}")
            names.add(name)
            slugs.add(species_slug)
            path = self.root / str(entry["selected_model_path"])
            if not path.is_file():
                raise RuntimeError(f"Missing species model: {path}")
            artifact = joblib.load(path)
            model = artifact.get("model") if isinstance(artifact, dict) else artifact
            if model is None or not hasattr(model, "predict_proba"):
                raise RuntimeError(f"Species model cannot produce scores: {path.name}")
            if isinstance(artifact, dict) and artifact.get("features", manifest["features"]) != manifest["features"]:
                raise RuntimeError(f"Species model feature order is unsupported: {path.name}")
            self.models.append({"entry": entry, "model": model})
        if not self.models:
            raise RuntimeError("The species registry contains no models.")
        self._catalog_by_name = self._load_catalog(names)
        with np.load(self.root / "marine_grid_scores.npz", allow_pickle=False) as reference:
            reference_names = [str(name) for name in reference["scientific_names"]]
            reference_values = np.asarray(reference["scores"], dtype=np.float64)
            reference_cell_ids = [str(cell) for cell in reference["cell_ids"]]
            reference_latitude = np.asarray(reference["latitude"], dtype=np.float64)
            reference_longitude = np.asarray(reference["longitude"], dtype=np.float64)
        if len(reference_names) != len(set(reference_names)) or set(reference_names) != names:
            raise RuntimeError("The marine-grid score reference does not match the species registry.")
        if reference_values.shape != (4227, len(reference_names)):
            raise RuntimeError("The score reference must contain 4,227 marine-grid rows for every registry species.")
        if not np.isfinite(reference_values).all() or not np.all((reference_values >= 0) & (reference_values <= 1)):
            raise RuntimeError("The marine-grid score reference contains invalid scores.")
        if len(reference_cell_ids) != 4227 or len(set(reference_cell_ids)) != 4227 or reference_latitude.shape != (4227,) or reference_longitude.shape != (4227,):
            raise RuntimeError("The marine-grid score reference has invalid cell identities or coordinates.")
        if not np.isfinite(reference_latitude).all() or not np.isfinite(reference_longitude).all():
            raise RuntimeError("The marine-grid score reference has non-finite coordinates.")
        self.reference_cell_count = int(reference_values.shape[0])
        self._reference_scores = {name: np.sort(reference_values[:, column]) for column, name in enumerate(reference_names)}
        self._reference_columns = {name: column for column, name in enumerate(reference_names)}
        self._grid_scores = reference_values
        self._grid_scores.setflags(write=False)
        for values in self._reference_scores.values():
            values.setflags(write=False)
        self._marine_grid: list[dict[str, Any]] | None = None
        grid = self._load_grid()
        if len(grid) != 4227 or [row["cell_id"] for row in grid] != reference_cell_ids or not np.allclose([row["latitude"] for row in grid], reference_latitude, rtol=0, atol=1e-10) or not np.allclose([row["longitude"] for row in grid], reference_longitude, rtol=0, atol=1e-10):
            raise RuntimeError("The saved grid scores and marine-grid CSV identities or coordinates differ.")

    def _load_catalog(self, names: set[str]) -> dict[str, dict[str, Any]]:
        path = self.root / "species_catalog.json"
        if not path.is_file():
            return {}
        catalog = json.loads(path.read_text(encoding="utf-8"))
        rows = catalog.get("species", [])
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise RuntimeError("The species content catalog is invalid.")
        by_name = {row.get("scientificName"): row for row in rows}
        if len(by_name) != len(rows) or set(by_name) != names:
            raise RuntimeError("The species content catalog does not match the model registry.")
        if catalog.get("modelCount") != len(self.models) or catalog.get("modelVersion") != self.model_version:
            raise RuntimeError("The species content catalog has a different model count or version.")
        for item in self.models:
            entry = item["entry"]
            if by_name[entry["scientific_name"]].get("speciesSlug") != entry["slug"]:
                raise RuntimeError("The species content catalog has a different species identity.")
        return by_name

    def catalog(self) -> dict[str, Any]:
        """Return content keyed to this loaded registry, without prediction data."""
        rows = []
        for item in self.models:
            entry = item["entry"]
            content = self._catalog_by_name.get(entry["scientific_name"], {})
            rows.append({
                "speciesSlug": entry["slug"], "scientificName": entry["scientific_name"],
                "commonNameEn": content.get("commonNameEn") or entry.get("common_name_en") or entry["scientific_name"],
                "category": content.get("category"),
                "introEn": content.get("introEn", ""), "introZh": content.get("introZh", ""),
                "sources": content.get("sources", []), "imageAvailable": content.get("imageAvailable") is True,
                "recordYears": {"min": entry.get("min_year"), "max": entry.get("max_year")},
                "presenceCells": entry.get("presence_cells"), "testPresences": entry.get("test_presences"),
            })
        return {"schemaVersion": 1, "modelVersion": self.model_version, "modelCount": len(rows),
                "scoreType": "relative_occurrence", "calibratedProbability": False,
                "crossSpeciesRankingValidated": False, "species": rows}

    def _options(self, top_k: int, kingdom: str | None) -> tuple[int, str | None]:
        if isinstance(top_k, bool) or not isinstance(top_k, Integral) or top_k < 0:
            raise ModelInputError("top_k must be a non-negative integer.")
        if kingdom is None:
            return int(top_k), None
        if not isinstance(kingdom, str) or not kingdom.strip():
            raise ModelInputError("kingdom must be Animalia, Plantae, a registry kingdom, or all.")
        normalized = kingdom.strip().casefold()
        aliases = {"animals": "animalia", "animal": "animalia", "plants": "plantae", "plant": "plantae"}
        normalized = aliases.get(normalized, normalized)
        if normalized in {"all", "any", "*"}:
            return int(top_k), None
        available = {"animalia", "plantae"} | {str(item["entry"].get("kingdom_name") or "").casefold() for item in self.models}
        if normalized not in available:
            raise ModelInputError("kingdom is not present in the species registry.")
        return int(top_k), normalized

    def _predict_at(self, latitude: float, longitude: float, top_k: int, kingdom: str | None, coordinate_context: dict, precomputed_scores: dict[str, float] | None = None) -> dict[str, Any]:
        if not _point_in_geometry(longitude, latitude, self.geometry):
            raise ModelAreaError("The coordinate is outside the supported Malaysian EEZ.")
        top_k, kingdom_filter = self._options(top_k, kingdom)
        features = pd.DataFrame([{"latitude": latitude, "longitude": longitude}])
        predictions = []
        for item in self.models:
            entry, model = item["entry"], item["model"]
            content = self._catalog_by_name.get(entry["scientific_name"], {})
            if precomputed_scores is None:
                probabilities = model.predict_proba(features)[0]
                classes = list(getattr(model, "classes_", []))
                if 1 not in classes:
                    raise RuntimeError(f"Species model has no positive-label class: {entry['scientific_name']}")
                score = float(probabilities[classes.index(1)])
            else:
                score = float(precomputed_scores[entry["scientific_name"]])
            if not math.isfinite(score) or not 0 <= score <= 1:
                raise RuntimeError(f"Species model returned an invalid score: {entry['scientific_name']}")
            reference = self._reference_scores[entry["scientific_name"]]
            less = int(np.searchsorted(reference, score, side="left"))
            less_or_equal = int(np.searchsorted(reference, score, side="right"))
            location_match = (less + less_or_equal) / (2 * self.reference_cell_count)
            predictions.append({
                "speciesSlug": entry["slug"], "scientificName": entry["scientific_name"],
                "commonNameEn": content.get("commonNameEn") or entry.get("common_name_en") or entry["scientific_name"],
                "commonNameZh": entry.get("common_name_zh") or "",
                "category": content.get("category"),
                "introEn": content.get("introEn", ""), "introZh": content.get("introZh", ""),
                "sources": content.get("sources", []), "imageAvailable": content.get("imageAvailable") is True,
                "kingdom": entry.get("kingdom_name"),
                "relativeOccurrenceScore": score,
                "locationMatchScore": location_match,
                "selectedModel": entry.get("selected_model"),
                "defaultRecommendation": entry.get("default_recommendation") is True,
                "validationStatus": entry.get("validation_status"),
                "testMetrics": entry.get("test_metrics", {}),
                "presenceCells": entry.get("presence_cells"),
                "recordYears": {"min": entry.get("min_year"), "max": entry.get("max_year")},
            })
        eligible = [row for row in predictions if row["defaultRecommendation"] and row["relativeOccurrenceScore"] > 0 and (kingdom_filter is None or str(row["kingdom"] or "").casefold() == kingdom_filter)]
        eligible.sort(key=lambda row: (-row["locationMatchScore"], row["scientificName"]))
        return {
            "insideMalaysianEez": True, "scoreType": "relative_occurrence",
            "calibratedProbability": False, "crossSpeciesRankingValidated": False,
            "rankingMethod": "heuristic_within_species_percentile",
            "scoreInterpretation": "Raw historical coordinate-only model score, not a real-world occurrence probability or confirmed sighting. Raw scores remain available for inspection and are not used for default cross-species sorting.",
            "locationMatchInterpretation": "Position of this location's score within this species' frozen marine-grid reference: (count(reference < score) + 0.5 * count(reference == score)) / reference cells. It is a within-species location match, not probability calibration or independently validated cross-species accuracy. A low raw score can still have a high location match.",
            "predictions": predictions, "topPredictions": eligible[:top_k],
            "recommendationContext": {
                "requestedTopK": top_k, "kingdomFilter": kingdom_filter or "all",
                "eligibleSpecies": len(eligible), "returnedSpecies": min(top_k, len(eligible)),
                "zeroScoresExcluded": True, "defaultRecommendationsOnly": True,
                "locationMatchReferenceCells": self.reference_cell_count,
            },
            "registrySpeciesCount": len(predictions), "modelCount": len(predictions), "modelVersion": self.model_version,
            "inferenceSource": "direct_model" if precomputed_scores is None else "precomputed_final_model_grid_scores",
            "coordinateContext": coordinate_context,
        }

    def predict(self, latitude: float, longitude: float, top_k: int = 5, kingdom: str | None = "Animalia") -> dict[str, Any]:
        """Strict point inference; filters affect topPredictions, not predictions.

        Raw scores retain their original 0..1 values. Suggested cards use the
        within-species frozen-reference locationMatchScore, also on 0..1.
        top_k=0 returns no cards while keeping every model's prediction.
        """
        latitude, longitude = _coordinate(latitude, longitude)
        context = {
            "requestedLatitude": latitude, "requestedLongitude": longitude,
            "usedLatitude": latitude, "usedLongitude": longitude,
            "method": "exact_coordinate", "moved": False, "distanceKm": 0.0,
            "gridCellId": None, "requestedInsideMalaysianEez": _point_in_geometry(longitude, latitude, self.geometry),
        }
        return self._predict_at(latitude, longitude, top_k, kingdom, context)

    def _load_grid(self) -> list[dict[str, Any]]:
        if self._marine_grid is None:
            with (self.root / "reference/marine_grid.csv").open(encoding="utf-8-sig", newline="") as handle:
                rows = []
                for row in csv.DictReader(handle):
                    latitude, longitude = _coordinate(float(row["latitude"]), float(row["longitude"]))
                    rows.append({"cell_id": row["cell_id"], "latitude": latitude, "longitude": longitude, "row_index": len(rows)})
            if not rows:
                raise RuntimeError("The marine-grid reference has no cells.")
            self._marine_grid = rows
        return self._marine_grid

    def predict_nearby_marine(self, latitude: float, longitude: float, max_distance_km: float = 15, top_k: int = 5, kingdom: str | None = "Animalia") -> dict[str, Any]:
        """Explicit nearest-grid introduction for a known beach's nearby waters.

        This method always chooses a saved marine-grid centre, even if the
        requested coordinate is already inside the EEZ. It must not be used to
        claim a sighting at the beach or to silently change a user's position.
        Raw scores come from the frozen final-model row at that exact centre,
        avoiding redundant model inference; strict prediction remains direct.
        """
        latitude, longitude = _coordinate(latitude, longitude)
        if isinstance(max_distance_km, bool) or not isinstance(max_distance_km, Real) or not math.isfinite(float(max_distance_km)) or max_distance_km <= 0:
            raise ModelInputError("max_distance_km must be a positive finite number.")
        self._options(top_k, kingdom)
        closest = min(self._load_grid(), key=lambda row: (_distance_km(latitude, longitude, row["latitude"], row["longitude"]), str(row["cell_id"])))
        distance = _distance_km(latitude, longitude, closest["latitude"], closest["longitude"])
        if distance > max_distance_km:
            raise ModelAreaError(f"The nearest marine-grid centre is {distance:.3f} km away, beyond the explicit {float(max_distance_km):g} km limit.")
        context = {
            "requestedLatitude": latitude, "requestedLongitude": longitude,
            "usedLatitude": closest["latitude"], "usedLongitude": closest["longitude"],
            "method": "nearest_marine_grid", "moved": distance > 1e-9,
            "distanceKm": distance, "maxDistanceKm": float(max_distance_km),
            "gridCellId": closest["cell_id"],
            "requestedInsideMalaysianEez": _point_in_geometry(longitude, latitude, self.geometry),
            "interpretation": "Nearby historical marine-grid introduction for a known beach; the used coordinate is not a beach sighting location.",
        }
        precomputed = {item["entry"]["scientific_name"]: float(self._grid_scores[closest["row_index"], self._reference_columns[item["entry"]["scientific_name"]]]) for item in self.models}
        return self._predict_at(closest["latitude"], closest["longitude"], top_k, kingdom, context, precomputed_scores=precomputed)
