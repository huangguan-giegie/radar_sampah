from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
from types import SimpleNamespace

import numpy as np
from PIL import Image

from recognition import DEFAULT_MODEL_PATH, LitterRecognizer


def jpeg_bytes(size: tuple[int, int] = (320, 320)) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, "white").save(output, format="JPEG")
    return output.getvalue()


def fake_onnxruntime(model_path: Path):
    sessions = []

    class FakeSessionOptions:
        def __init__(self):
            self.intra_op_num_threads = None
            self.inter_op_num_threads = None
            self.graph_optimization_level = None

    class FakeSession:
        def __init__(self, path: str, sess_options=None, providers=None):
            assert path == str(model_path)
            self.sess_options = sess_options
            self.providers = providers
            self.calls: list[dict[str, np.ndarray]] = []
            sessions.append(self)

        def get_inputs(self):
            return [SimpleNamespace(name="images", shape=[1, 3, 320, 320])]

        def run(self, _outputs, feed):
            self.calls.append(feed)
            if len(self.calls) == 1:
                return [np.zeros((1, 300, 6), dtype=np.float32)]
            detections = np.zeros((1, 300, 6), dtype=np.float32)
            detections[0, 0] = [10, 20, 100, 120, 0.90, 0]
            detections[0, 1] = [30, 40, 150, 160, 0.80, 5]
            return [detections]

    runtime = SimpleNamespace(
        SessionOptions=FakeSessionOptions,
        GraphOptimizationLevel=SimpleNamespace(ORT_ENABLE_ALL="all"),
        InferenceSession=FakeSession,
    )
    return runtime, sessions


def test_default_production_model_is_onnx():
    assert DEFAULT_MODEL_PATH.suffix == ".onnx"


def test_model_load_uses_onnx_cpu_session_and_warmup(tmp_path, monkeypatch):
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"onnx-model-bytes-" * 16)
    runtime, sessions = fake_onnxruntime(model_path)

    monkeypatch.setitem(sys.modules, "onnxruntime", runtime)
    monkeypatch.setenv("LITTER_ONNX_MODEL_PATH", str(model_path))
    monkeypatch.setenv("LITTER_INFERENCE_SIZE", "320")

    recognizer = LitterRecognizer.load()

    assert recognizer.model is not None
    assert len(sessions) == 1
    session = sessions[0]
    assert session.providers == ["CPUExecutionProvider"]
    assert session.sess_options.intra_op_num_threads == 1
    assert session.sess_options.inter_op_num_threads == 1
    assert len(session.calls) == 1
    warmup = session.calls[0]["images"]
    assert warmup.shape == (1, 3, 320, 320)
    assert warmup.dtype == np.float32


def test_onnx_recognition_preserves_six_class_mapping(tmp_path, monkeypatch):
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"onnx-model-bytes-" * 16)
    runtime, sessions = fake_onnxruntime(model_path)

    monkeypatch.setitem(sys.modules, "onnxruntime", runtime)
    monkeypatch.setenv("LITTER_ONNX_MODEL_PATH", str(model_path))
    monkeypatch.setenv("LITTER_INFERENCE_SIZE", "320")

    recognizer = LitterRecognizer.load()
    result = recognizer.recognise(jpeg_bytes())

    assert result["state"] == "ready"
    assert result["counts"]["Plastic"] == 1
    assert result["counts"]["Fishing gear"] == 1
    assert sum(result["counts"].values()) == 2
    assert result["detections"][0]["modelClass"] == "plastic"
    assert result["detections"][0]["box"] == [10.0, 20.0, 100.0, 120.0]
    assert len(sessions[0].calls) == 2


def test_runtime_requirements_exclude_torch_and_use_onnxruntime():
    requirements = (Path(__file__).resolve().parents[1] / "requirements.txt").read_text(encoding="utf-8")
    assert "onnxruntime==" in requirements
    assert "torch==" not in requirements
    assert "torchvision==" not in requirements
    assert "ultralytics" not in requirements
