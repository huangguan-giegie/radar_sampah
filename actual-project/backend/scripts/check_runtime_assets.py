"""Fail a deploy build if packaged model weights are incomplete."""
import json
from pathlib import Path


def check() -> None:
    backend = Path(__file__).resolve().parents[1]
    detector = backend.parent / "ml-model" / "models" / "sea_taco_yolo11m_best.onnx"
    models_dir = backend / "species_distribution" / "models"
    manifest_path = models_dir / "model_manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected_models = {
            Path(entry["selected_model_path"]).name
            for entry in manifest["species"]
        }
    except (OSError, KeyError, TypeError, ValueError) as exc:
        raise RuntimeError(f"Invalid species model manifest: {manifest_path}") from exc

    actual_models = {path.name for path in models_dir.glob("*.joblib")}
    if actual_models != expected_models:
        missing = sorted(expected_models - actual_models)
        unexpected = sorted(actual_models - expected_models)
        details = []
        if missing:
            details.append(f"missing={missing}")
        if unexpected:
            details.append(f"unexpected={unexpected}")
        raise RuntimeError("Species model bundle does not match its manifest (" + ", ".join(details) + ").")

    paths = [detector, *(models_dir / name for name in sorted(actual_models))]
    for path in paths:
        if not path.is_file() or path.stat().st_size < 1000:
            raise RuntimeError(f"Missing model asset: {path.name}. Run git lfs pull before building.")
        with path.open("rb") as source:
            if source.read(64).startswith(b"version https://git-lfs.github.com/spec/v1"):
                raise RuntimeError(f"Git LFS pointer instead of weights: {path.name}. Run git lfs pull before building.")
    print(f"Runtime assets ready: one ONNX detector and {len(actual_models)} species models.")


if __name__ == "__main__":
    check()
