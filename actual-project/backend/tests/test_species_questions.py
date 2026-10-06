"""Only custom questions reach the gateway, with bounded, species-specific context."""
import io
import json
import sys
from pathlib import Path
from urllib.error import HTTPError

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
        return io.BytesIO(json.dumps({"choices": [{"finish_reason": "stop", "message": {"content": "A sourced answer."}}]}).encode())

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
    assert upstream.full_url == questions.GATEWAY_URL
    assert upstream.get_header("Authorization") == "Bearer test-gateway-key"
    assert body["model"] == "gpt-6-luna"
    assert body["messages"][-1]["content"] == "Where does seagrass grow?"
    assert json.loads(body["messages"][1]["content"].split("\n", 1)[1])["name"] == "Seagrass"
    assert "Do not claim to have browsed" in body["messages"][0]["content"]
    assert timeout == 35 and body["max_tokens"] == 1500
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
    monkeypatch.setattr(questions, "urlopen", lambda *args, **kwargs: io.BytesIO(b'{"choices":[{"finish_reason":"length","message":{"content":"Partial"}}]}'))
    assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 502


def test_hourly_limit_stops_gateway_calls(api, gateway):
    _, client = api
    for _ in range(60):
        assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 200
    assert client.post("/species/dugong/questions", json={"question": "Hi?"}).status_code == 429
    assert len(gateway) == 60
