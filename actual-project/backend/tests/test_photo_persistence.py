from __future__ import annotations

from pathlib import Path
import sys
from types import SimpleNamespace
from urllib.parse import urlsplit

import pytest

_backend_dir = Path(__file__).resolve().parents[1]
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from api_tests_core import api, report_payload, signup, upload
from app import create_app, report_photos_table


@pytest.fixture
def restarted_report(api, tmp_path):
    application, client = api
    _session, headers = signup(client)
    photo = upload(client, headers, with_metadata=True)
    assert list(Path(application.extensions["photo_storage_dir"]).iterdir()) == []
    created = client.post("/reports", headers=headers, json=report_payload(photo["photoKey"]))
    assert created.status_code == 201
    report_id = created.get_json()["id"]
    original = client.get(photo["previewUrl"])
    assert original.status_code == 200
    expected = original.data
    original.close()
    share = client.get(f"/share-links?reportId={report_id}", headers=headers)
    assert share.status_code == 200
    share_token = share.get_json()["token"]

    engine = application.extensions["marine_engine"]
    database_url = str(engine.url)
    engine.dispose()
    directory = tmp_path / "empty-after-restart"
    directory.mkdir()
    assert directory != Path(application.extensions["photo_storage_dir"])
    restarted = create_app(database_url=database_url, testing=True, photo_storage_dir=directory)
    assert list(directory.iterdir()) == []
    yield SimpleNamespace(
        client=restarted.test_client(),
        engine=restarted.extensions["marine_engine"],
        headers=headers,
        photo=photo,
        report_id=report_id,
        expected=expected,
        share_token=share_token,
    )
    restarted.extensions["marine_engine"].dispose()
    for timer in application.extensions["photo_cleanup_timers"]:
        timer.cancel()


@pytest.mark.parametrize("surface", ["preview", "renew", "gallery", "share"])
def test_report_photo_survives_restart_with_empty_directory(restarted_report, surface):
    state = restarted_report
    client = state.client
    if surface == "preview":
        url = state.photo["previewUrl"]
        reports = client.get("/reports/mine", headers=state.headers)
        assert reports.status_code == 200
        report = next(row for row in reports.get_json() if row["id"] == state.report_id)
        assert client.get(report["photoUrl"]).data == state.expected
    elif surface == "renew":
        renewed = client.get(
            f"/uploads/photos/{state.photo['photoKey']}/preview-url", headers=state.headers
        )
        assert renewed.status_code == 200
        url = renewed.get_json()["previewUrl"]
    elif surface == "gallery":
        listing = client.get("/beaches/morib/litter-gallery")
        assert listing.status_code == 200
        assert [entry["reportId"] for entry in listing.get_json()] == [state.report_id]
        url = listing.get_json()[0]["photoUrl"]
    else:
        shared = client.get(f"/share-links/{state.share_token}")
        assert shared.status_code == 200
        assert shared.get_json()["report"]["photoAvailable"] is True
        url = f"/share-links/{state.share_token}/photo"

    response = client.get(url)
    assert response.status_code == 200
    assert response.mimetype == "image/jpeg"
    assert response.data == state.expected
    if surface in {"gallery", "share"}:
        assert response.headers["Cache-Control"] == "private, no-store"


def test_persisted_photo_keeps_owner_and_token_restrictions(restarted_report):
    state = restarted_report
    client = state.client
    gallery = client.get("/beaches/morib/litter-gallery").get_json()
    assert [entry["reportId"] for entry in gallery] == [state.report_id]
    gallery_url = gallery[0]["photoUrl"]
    other, other_headers = signup(client)
    renew_url = f"/uploads/photos/{state.photo['photoKey']}/preview-url"
    assert client.get(renew_url).status_code == 401
    assert client.get(renew_url, headers=other_headers).status_code == 404
    share_url = f"/share-links?reportId={state.report_id}"
    assert client.get(share_url).status_code == 404
    assert client.get(share_url, headers=other_headers).status_code == 404
    assert client.get(urlsplit(state.photo["previewUrl"]).path).status_code == 401
    assert client.get(urlsplit(gallery_url).path).status_code == 401
    assert client.get(urlsplit(gallery_url).path + "?token=invalid").status_code == 401
    assert client.get("/share-links/invalid/photo").status_code == 404

    with state.engine.begin() as connection:
        connection.execute(
            report_photos_table.update()
            .where(report_photos_table.c.photo_key == state.photo["photoKey"])
            .values(owner_id=other["user"]["id"])
        )
    assert client.get(state.photo["previewUrl"]).status_code == 404
    assert client.get(renew_url, headers=state.headers).status_code == 404
    assert client.get("/beaches/morib/litter-gallery").get_json() == []
    assert client.get(gallery_url).status_code == 404
    shared = client.get(f"/share-links/{state.share_token}")
    assert shared.status_code == 200
    assert shared.get_json()["report"]["photoAvailable"] is False
    assert client.get(f"/share-links/{state.share_token}/photo").status_code == 404
