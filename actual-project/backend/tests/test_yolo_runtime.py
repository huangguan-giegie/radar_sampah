from __future__ import annotations

import sys
from types import SimpleNamespace

from recognition import LitterRecognizer


def test_model_load_runs_memory_bounded_cpu_warmup(tmp_path, monkeypatch):
    model_path = tmp_path / "model.pt"
    model_path.write_bytes(b"test model bytes that are not a git lfs pointer")

    class FakeYolo:
        def __init__(self, path: str):
            assert path == str(model_path)
            self.calls: list[dict[str, object]] = []
            self.names = {}

        def predict(self, **kwargs):
            self.calls.append(kwargs)
            return []

    monkeypatch.setitem(sys.modules, "ultralytics", SimpleNamespace(YOLO=FakeYolo))
    monkeypatch.setenv("LITTER_MODEL_PATH", str(model_path))
    monkeypatch.setenv("LITTER_INFERENCE_SIZE", "320")

    recognizer = LitterRecognizer.load()

    assert recognizer.model is not None
    assert len(recognizer.model.calls) == 1
    call = recognizer.model.calls[0]
    assert call["device"] == "cpu"
    assert call["imgsz"] == 320
    assert call["verbose"] is False
