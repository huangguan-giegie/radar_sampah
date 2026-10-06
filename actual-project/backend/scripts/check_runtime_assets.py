"""Fail a deploy build if Git LFS weights were not checked out."""
from pathlib import Path


def check() -> None:
    backend = Path(__file__).resolve().parents[1]
    paths = [backend.parent / "ml-model" / "models" / "sea_taco_yolo11m_best.onnx"]
    paths.extend((backend / "species_distribution" / "models").glob("*.joblib"))
    if len(paths) != 5:
        raise RuntimeError("Exactly four species models are required alongside the ONNX detector.")
    for path in paths:
        if not path.is_file() or path.stat().st_size < 1000:
            raise RuntimeError(f"Missing model asset: {path.name}. Run git lfs pull before building.")
        with path.open("rb") as source:
            if source.read(64).startswith(b"version https://git-lfs.github.com/spec/v1"):
                raise RuntimeError(f"Git LFS pointer instead of weights: {path.name}. Run git lfs pull before building.")
    print("Runtime assets ready: one ONNX detector and four species models.")


if __name__ == "__main__":
    check()
