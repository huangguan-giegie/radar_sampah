"""Predict relative occurrence scores at one latitude/longitude."""

from __future__ import annotations

import argparse
import json
import sys

import joblib
import pandas as pd

from tidetrace_sdm import (
    ROOT,
    geometry_from_feature_collection,
    load_json,
    point_in_geometry,
)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--latitude", type=float, required=True)
    parser.add_argument("--longitude", type=float, required=True)
    parser.add_argument(
        "--species",
        help="Optional species slug. Omit to score all four species.",
    )
    args = parser.parse_args()

    if not -90 <= args.latitude <= 90 or not -180 <= args.longitude <= 180:
        parser.error("Latitude must be -90..90 and longitude must be -180..180")

    eez_collection = load_json(
        ROOT / "data" / "reference" / "malaysia_eez_marineregions_v12.geojson"
    )
    geometry = geometry_from_feature_collection(eez_collection)
    inside_eez = point_in_geometry(args.longitude, args.latitude, geometry)

    manifest = load_json(ROOT / "models" / "model_manifest.json")
    entries = manifest["species"]
    if args.species:
        entries = [entry for entry in entries if entry["slug"] == args.species]
        if not entries:
            available = ", ".join(entry["slug"] for entry in manifest["species"])
            parser.error(f"Unknown species slug. Available: {available}")

    features = pd.DataFrame(
        [{"latitude": args.latitude, "longitude": args.longitude}]
    )
    predictions = []
    for entry in entries:
        bundle = joblib.load(ROOT / entry["selected_model_path"])
        score = float(bundle["model"].predict_proba(features)[:, 1][0])
        predictions.append(
            {
                "species_slug": entry["slug"],
                "scientific_name": entry["scientific_name"],
                "common_name_en": entry["common_name_en"],
                "common_name_zh": entry["common_name_zh"],
                "relative_occurrence_score": round(score, 6),
                "selected_model": entry["selected_model"],
            }
        )

    output = {
        "latitude": args.latitude,
        "longitude": args.longitude,
        "inside_malaysian_eez": inside_eez,
        "predictions": predictions,
        "interpretation": (
            "Scores are relative occurrence/suitability under the OBIS presence + generated "
            "background design, not calibrated real-world presence probabilities."
        ),
    }
    if not inside_eez:
        output["warning"] = "The coordinate is outside the model's Malaysian EEZ study area."
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
