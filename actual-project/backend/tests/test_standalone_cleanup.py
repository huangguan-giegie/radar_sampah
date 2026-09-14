from __future__ import annotations

import os

os.environ.setdefault("AUTH_JWT_SECRET", "test-only-secret-not-for-production")

from app import create_app


def test_cleanup_can_start_without_a_report_target(tmp_path):
    application = create_app(
        database_url=f"sqlite:///{tmp_path / 'standalone-cleanup.db'}",
        testing=True,
        photo_storage_dir=tmp_path / "private-photos",
    )
    client = application.test_client()
    session = client.post("/auth/anonymous").get_json()
    headers = {"Authorization": "Bearer " + session["token"]}

    response = client.post(
        "/cleanup-actions",
        headers=headers,
        json={
            "beachId": "kelanang",
            "removed": {"Plastic": 3, "Glass": 1},
            "handling": "Collected for disposal",
            "note": "Standalone cleanup with no prior litter report.",
            "idempotencyKey": "standalone-cleanup-test",
        },
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["targetReportId"] is None
    assert payload["beachId"] == "kelanang"
    assert payload["score"] == 4
    assert {row["category"]: row["removed"] for row in payload["rows"]} == {"Plastic": 3, "Glass": 1}
