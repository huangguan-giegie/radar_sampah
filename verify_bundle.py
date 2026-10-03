"""Check frozen artifact hashes and direct/precomputed inference consistency."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np

from inference import SpeciesDistributionModel

ROOT = Path(__file__).resolve().parent


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    manifest = read(ROOT / "models/model_manifest.json")
    validation = read(ROOT / "validation_summary.json")
    entries = {entry["scientific_name"]: entry for entry in manifest["species"]}
    require(len(entries) == len(manifest["species"]) == 40, "Expected 40 unique species.")
    metrics = {entry["scientificName"]: entry for entry in validation["species"]}
    require(set(metrics) == set(entries), "Validation species differ from the model manifest.")
    expected_files = set()
    for name, entry in entries.items():
        model_file = ROOT / entry["selected_model_path"]
        expected_files.add(model_file.resolve())
        require(hashlib.sha256(model_file.read_bytes()).hexdigest() == metrics[name]["modelSha256"], f"Model bytes changed: {name}")
    require({p.resolve() for p in (ROOT / "models").glob("*.joblib")} == expected_files, "Unexpected/missing model artifacts.")

    provenance = read(ROOT / "training/data/provenance.json")
    for filename, details in provenance["processed_files"].items():
        path = ROOT / "training" / filename if filename == "config.json" else ROOT / "training/data" / filename
        require(hashlib.sha256(path.read_bytes()).hexdigest() == details["sha256"], f"Training input bytes changed: {filename}")
    for filename, details in provenance["reference_files"].items():
        require(hashlib.sha256((ROOT / "reference" / filename).read_bytes()).hexdigest() == details["sha256"], f"Reference bytes changed: {filename}")

    registry = SpeciesDistributionModel(ROOT)
    nearby = registry.predict_nearby_marine(2.789, 101.415, top_k=5)
    context = nearby["coordinateContext"]
    direct = registry.predict(context["usedLatitude"], context["usedLongitude"], top_k=5)
    require(len(nearby["predictions"]) == len(direct["predictions"]) == 40, "Incomplete inference registry.")
    require([row["scientificName"] for row in nearby["topPredictions"]] == [row["scientificName"] for row in direct["topPredictions"]], "Direct/grid recommendations differ.")
    direct_by_name = {row["scientificName"]: row for row in direct["predictions"]}
    with np.load(ROOT / "marine_grid_scores.npz", allow_pickle=False) as reference:
        names = list(reference["scientific_names"])
        row_index = list(reference["cell_ids"]).index(context["gridCellId"])
        require(reference["scores"].shape == (4227, 40), "Expected a 4,227 by 40 score matrix.")
        for prediction in nearby["predictions"]:
            name = prediction["scientificName"]
            scores = reference["scores"][:, names.index(name)]
            raw = prediction["relativeOccurrenceScore"]
            require(raw == scores[row_index], f"Frozen score mismatch: {name}")
            require(abs(raw - direct_by_name[name]["relativeOccurrenceScore"]) <= 1e-12, f"Direct model score mismatch: {name}")
            expected_match = (np.count_nonzero(scores < raw) + 0.5 * np.count_nonzero(scores == raw)) / 4227
            require(prediction["locationMatchScore"] == expected_match, f"Location percentile mismatch: {name}")
    print(json.dumps({"passed": True, "models": 40, "frozenInputHashesVerified": 5,
                      "modelVersion": registry.model_version, "referenceCells": 4227,
                      "directAndSavedGridScoresMatch": True}, indent=2))


if __name__ == "__main__":
    main()
