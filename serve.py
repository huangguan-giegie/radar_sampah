"""Optional stateless HTTP entry point for the packaged species models."""
from __future__ import annotations

from functools import lru_cache
import os
from pathlib import Path

from flask import Flask, jsonify, request

from inference import ModelAreaError, ModelInputError, SpeciesDistributionModel

ROOT = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def _load_model(root: str) -> SpeciesDistributionModel:
    return SpeciesDistributionModel(root=root)


def create_app(model_root: Path | str | None = None) -> Flask:
    """Load one registry per process; requests never persist coordinates."""
    model = _load_model(str(Path(model_root or ROOT).resolve()))
    app = Flask(__name__)
    app.extensions["species_model"] = model

    def error(status: int, code: str, message: str):
        return jsonify({"code": code, "message": message}), status

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "modelVersion": model.model_version, "modelCount": len(model.models)})

    @app.get("/species")
    def species():
        return jsonify(model.catalog())

    @app.post("/predict")
    def predict():
        payload = request.get_json(silent=True)
        required, optional = {"latitude", "longitude"}, {"mode", "topK"}
        if not isinstance(payload, dict) or not required <= set(payload):
            return error(400, "VALIDATION_FAILED", "latitude and longitude are required.")
        if set(payload) - required - optional:
            return error(400, "VALIDATION_FAILED", "Only latitude, longitude, mode and topK are supported.")
        if any(isinstance(payload[key], bool) or not isinstance(payload[key], (int, float)) for key in required):
            return error(400, "VALIDATION_FAILED", "latitude and longitude must be numbers.")
        mode, top_k = payload.get("mode", "exact"), payload.get("topK", 5)
        if mode not in ("exact", "nearby_marine"):
            return error(400, "VALIDATION_FAILED", "mode must be exact or nearby_marine.")
        if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 0:
            return error(400, "VALIDATION_FAILED", "topK must be a non-negative integer.")
        try:
            if mode == "nearby_marine":
                result = model.predict_nearby_marine(payload["latitude"], payload["longitude"], max_distance_km=15, top_k=top_k)
            else:
                result = model.predict(payload["latitude"], payload["longitude"], top_k=top_k)
        except ModelInputError as exc:
            return error(400, "VALIDATION_FAILED", str(exc))
        except ModelAreaError as exc:
            return error(422, "OUTSIDE_MODEL_AREA", str(exc))
        return jsonify(result)

    return app


if __name__ == "__main__":
    create_app().run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
