from __future__ import annotations

from api_tests_core import api, signup, upload


def test_legacy_small_only_count_input_is_rejected_without_persisting(api):
    _application, client = api
    _session, headers = signup(client)
    photo = upload(client, headers)

    response = client.post(
        "/reports",
        headers=headers,
        json={
            "beachId": "morib",
            "photoKey": photo["photoKey"],
            "locationSource": "manual",
            "itemCounts": {"Plastic": 3},
        },
    )

    assert response.status_code == 422
    assert response.get_json()["code"] == "SMALL_ONLY_REPORT"
    assert client.get("/reports/mine", headers=headers).get_json() == []
