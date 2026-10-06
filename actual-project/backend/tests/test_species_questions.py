"""Only custom questions reach the gateway, with bounded, species-specific context."""
import io
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api_tests_core import api
import species_questions as questions


@pytest.fixture
def gateway(monkeypatch):
    monkeypatch.setenv("TEAMOROUTER_API_KEY", "test-gateway-key")
    calls = []

    def respond(request, timeout):
        calls.append((request, timeout))
        return io.BytesIO(json.dumps({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "A sourced answer."}]}}]}).encode())

    monkeypatch.setattr(questions, "urlopen", respond)
    return calls


def test_custom_question_uses_fixed_model_and_selected_species_without_auth(api, gateway):
    application, client = api
    response = client.post("/species/seagrass/questions", json={"question": " Where does seagrass grow? ", "model": "untrusted-model"})
    assert response.status_code == 200
    assert response.json["answer"] == "A sourced answer."
    assert response.json["sources"]
    upstream, timeout = gateway[0]
    body = json.loads(upstream.data)
    assert upstream.full_url == questions.GATEWAY_URL.format(model="gemini-3.5-flash-lite")
    assert upstream.get_header("Authorization") == "Bearer test-gateway-key"
    assert "model" not in body
    assert body["contents"][0]["parts"][1]["text"] == "Question:\nWhere does seagrass grow?"
    assert json.loads(body["contents"][0]["parts"][0]["text"].split("\n", 1)[1])["name"] == "Seagrass"
    assert "Do not claim to have browsed" in body["systemInstruction"]["parts"][0]["text"]
    assert timeout == 20 and body["generationConfig"]["maxOutputTokens"] == 1500
    assert len(gateway) == 1
    assert "test-gateway-key" not in response.get_data(as_text=True)


@pytest.mark.parametrize("payload", [None, [], {}, {"question": " "}, {"question": 3}, {"question": "x" * 501}])
def test_invalid_questions_never_call_gateway(api, gateway, payload):
    _, client = api
    assert client.post("/species/dugong/questions", json=payload).status_code == 400
    assert not gateway


def test_unknown_species_and_missing_config_never_call_gateway(api, gateway, monkeypatch):
    _, client = api
    assert client.post("/species/unknown/questions", json={"question": "Hi?"}).status_code == 404
    monkeypatch.delenv("TEAMOROUTER_API_KEY")
    response = client.post("/species/dugong/questions", json={"question": "Hi?"})
    assert response.status_code == 503
    assert not gateway


@pytest.mark.parametrize("error,status", [(HTTPError(questions.GATEWAY_URL, 401, "Secret provider details", {}, None), 502), (TimeoutError(), 504)])
def test_gateway_failure_is_safe_and_releases_request_slot(api, gateway, monkeypatch, error, status):
    _, client = api
    def fail(*args, **kwargs):
        raise error
    monkeypatch.setattr(questions, "urlopen", fail)
    for _ in range(3):
        response = client.post("/species/dugong/questions", json={"question": "Hi?"})
        assert response.status_code == status
        assert "Secret provider details" not in response.get_data(as_text=True)


def test_incomplete_answers_are_not_presented_as_success(api, gateway, monkeypatch):
    _, client = api
    monkeypatch.setattr(questions, "urlopen", lambda *args, **kwargs: io.BytesIO(b'{"candidates":[{"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"Partial"}]}}]}'))
    assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 502


def test_hourly_limit_stops_gateway_calls(api, gateway):
    _, client = api
    for _ in range(60):
        assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 200
    assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 429
    assert len(gateway) == 60


@pytest.mark.parametrize("error", [HTTPError(questions.GATEWAY_URL, 400, "Resource unavailable", {}, None), HTTPError(questions.GATEWAY_URL, 503, "Unavailable", {}, None), TimeoutError(), URLError("Network unavailable")])
def test_primary_failure_uses_requested_fallback_once(api, gateway, monkeypatch, error):
    _, client = api
    original = questions.urlopen
    calls = []

    def primary_fails(request, timeout):
        calls.append(request)
        if len(calls) == 1:
            raise error
        return original(request, timeout)

    monkeypatch.setattr(questions, "urlopen", primary_fails)
    response = client.post("/species/dugong/questions", json={"question": "What does a dugong eat?"})
    assert response.status_code == 200
    assert [call.full_url for call in calls] == [questions.GATEWAY_URL.format(model=model) for model in ("gemini-3.5-flash-lite", "gemini-3.8-flash")]
    assert calls[0].data == calls[1].data
    assert response.json["answer"] == "A sourced answer."


def test_authentication_failure_does_not_retry_another_model(api, gateway, monkeypatch):
    _, client = api
    calls = []
    def fail(request, timeout):
        calls.append(request)
        raise HTTPError(request.full_url, 401, "Unauthorized", {}, None)
    monkeypatch.setattr(questions, "urlopen", fail)
    assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 502
    assert len(calls) == 1


def test_blocked_question_does_not_retry_another_model(api, gateway, monkeypatch):
    _, client = api
    calls = []
    def blocked(request, timeout):
        calls.append(request)
        return io.BytesIO(b'{"promptFeedback":{"blockReason":"SAFETY"}}')
    monkeypatch.setattr(questions, "urlopen", blocked)
    assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 400
    assert len(calls) == 1


def test_answer_excludes_thinking_parts(api, gateway, monkeypatch):
    _, client = api
    monkeypatch.setattr(questions, "urlopen", lambda *args, **kwargs: io.BytesIO(b'{"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"Internal reasoning","thought":true},{"text":"Public answer"}]}}]}'))
    response = client.post("/species/dugong/questions", json={"question": "Hi?"})
    assert response.json["answer"] == "Public answer"
