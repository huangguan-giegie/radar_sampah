"""Package the reviewable source, built UI and actual runtime models."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import zipfile


def package(destination: Path) -> None:
    backend = Path(__file__).resolve().parents[1]
    root = backend.parents[1]
    paths: list[Path] = []
    excluded_dirs = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache", "tmp", "dist"}
    for folder in (backend, backend.parent / "frontend"):
        for directory, directories, names in os.walk(folder):
            directories[:] = [d for d in directories if d not in excluded_dirs and not d.startswith("pytest-cache-files-")]
            for name in names:
                if (name.startswith(".env") and name != ".env.example") or name.endswith((".db", ".db-wal", ".db-shm", ".pyc", ".tsbuildinfo")):
                    continue
                if name.startswith((".git", ".coverage")) or name.endswith(".log"):
                    continue
                paths.append(Path(directory) / name)
    paths.extend(p for p in (backend.parent / "frontend" / "dist").rglob("*") if p.is_file())
    paths.extend(root / p for p in ("Dockerfile", ".dockerignore", "render.yaml", "README.md", ".gitattributes", ".gitignore"))
    paths.append(backend.parent / "ml-model" / "models" / "sea_taco_yolo11m_best.onnx")
    paths = sorted(set(paths))
    entries = []
    for path in paths:
        with path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        entries.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": digest})
    manifest = {
        "frontendBase": "ca566fa", "backendBranch": "codex/iteration3-backend-v1",
        "contents": "Source, built v2 UI, real ONNX detector and four species models. No secrets or user database.",
        "files": entries,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in paths:
            archive.write(path, path.relative_to(root).as_posix())
        archive.writestr("DELIVERY_MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert not any(name.endswith((".env", ".env.local", ".db", ".db-wal", ".db-shm")) for name in archive.namelist())
    print(f"Verified archive: {len(paths)} files, {destination.stat().st_size / 1024 / 1024:.1f} MiB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    package(parser.parse_args().output.resolve())
