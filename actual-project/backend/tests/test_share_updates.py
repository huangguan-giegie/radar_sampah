from api_tests_core import api, signup, upload, report_payload
from test_v3_contract import event, cleanup


def test_shared_event_does_not_expose_participants(api):
    application, client = api
    event_id = event(application, "private-members")
    _, headers = signup(client)
    assert client.post(f"/events/{event_id}/join", headers=headers).status_code == 200
    link = client.get(f"/share-links?eventId={event_id}").get_json()
    shared = client.get(f"/share-links/{link['token']}").get_json()
    assert shared["report"] is None
    assert shared["event"]["participantCount"] == 1
    for field in ("joinedBy", "checkIns", "attendanceBy", "evidenceBy", "reportEvidenceBy", "cleanupIds"):
        assert field not in shared["event"]


def test_shared_report_stays_fixed_and_shows_resolved_state(api):
    _, client = api
    _, headers = signup(client)
    photo = upload(client, headers)
    first = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"])).get_json()
    link = client.get(f"/share-links?reportId={first['id']}", headers=headers).get_json()
    second = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"])).get_json()
    url = f"/share-links/{link['token']}"
    before = client.get(url + f"?reportId={second['id']}").get_json()
    assert before["report"]["id"] == first["id"]
    assert before["report"]["currentState"] == "active"
    assert cleanup(client, headers, first["id"], "Small", "share-resolve").status_code == 201
    after = client.get(url).get_json()
    assert after["report"]["id"] == first["id"]
    assert after["report"]["currentState"] == "resolved"
    assert after["report"]["photoAvailable"] is True
    assert not {"photoKey", "lat", "lng", "proximity_ref", "reporterId"} & after["report"].keys()
