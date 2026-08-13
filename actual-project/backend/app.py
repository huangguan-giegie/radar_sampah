"""Team 04 marine observation starter API.

This is a small integration skeleton for the actual project. It uses only
synthetic demo observations and keeps the reporting fields intentionally
minimal until the team confirms the selected coastal area and data sources.
"""

import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

DEMO_OBSERVATIONS = [
    {
        "id": "demo-1",
        "category": "plastic packaging",
        "area": "Selected Malaysian coastal area",
        "latitude": 3.1390,
        "longitude": 101.6869,
        "source": "synthetic demo record",
    }
]


@app.get("/")
def root():
    return jsonify(
        {
            "project": "Team 04 Marine Observation MVP",
            "status": "starter skeleton",
            "data_boundary": "synthetic demo data only",
        }
    )


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/observations")
def observations():
    return jsonify({"observations": DEMO_OBSERVATIONS})


@app.post("/api/observations")
def create_observation():
    payload = request.get_json(silent=True) or {}
    required = ("category", "area", "latitude", "longitude")
    missing = [field for field in required if payload.get(field) in (None, "")]
    if missing:
        return jsonify({"error": "Missing required fields", "fields": missing}), 400

    try:
        latitude = float(payload["latitude"])
        longitude = float(payload["longitude"])
    except (TypeError, ValueError):
        return jsonify({"error": "Coordinates must be numeric"}), 400

    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return jsonify({"error": "Coordinates are out of range"}), 400

    observation = {
        "id": f"demo-{len(DEMO_OBSERVATIONS) + 1}",
        "category": str(payload["category"]).strip(),
        "area": str(payload["area"]).strip(),
        "latitude": latitude,
        "longitude": longitude,
        "source": "synthetic demo record",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    DEMO_OBSERVATIONS.append(observation)
    return jsonify(observation), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))

