"""Inspect the standalone package without modifying the deployed application."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from inference import ModelAreaError, ModelInputError, SpeciesDistributionModel


def main() -> None:
    parser = argparse.ArgumentParser(description="Historical raw model scores and heuristic suggestions ranked by within-species marine-grid location match; neither is an occurrence probability.")
    parser.add_argument("--latitude", required=True, type=float)
    parser.add_argument("--longitude", required=True, type=float)
    parser.add_argument("--top-k", type=int, default=5, help="Maximum cards sorted by locationMatchScore, not raw score; 0 keeps only the complete predictions array")
    parser.add_argument("--kingdom", default="Animalia", help="Animalia / animals (default), Plantae / plants, all, or another registry kingdom")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent, help="Standalone model-package directory")
    parser.add_argument("--nearby-marine", action="store_true", help="Explicitly select a nearby saved marine-grid centre for a known beach, using precomputed final-model scores; records moved coordinates")
    parser.add_argument("--max-distance-km", type=float, default=15, help="Maximum permitted grid-centre distance when --nearby-marine is used")
    args = parser.parse_args()
    try:
        registry = SpeciesDistributionModel(root=args.root)
        if args.nearby_marine:
            result = registry.predict_nearby_marine(args.latitude, args.longitude, max_distance_km=args.max_distance_km, top_k=args.top_k, kingdom=args.kingdom)
        else:
            result = registry.predict(args.latitude, args.longitude, top_k=args.top_k, kingdom=args.kingdom)
    except (ModelInputError, ModelAreaError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
