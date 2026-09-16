from __future__ import annotations

import io
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from api_tests_core import api, signup, upload, report_payload
from app_core import (
    delete_photo_if_unreferenced,
    photo_file_path,
    report_photos_table,
    sweep_orphan_photos,
    write_photo_metadata,
)


def test_referenced_photo_survives_orphan_sweep(api):
    application, client = api
    _, headers = signup(client)
    uploaded = upload(client, headers)
    response = client.post('/reports', headers=headers, json=report_payload(
        uploaded['photoKey'], quantities={'Plastic': 'Medium'},
    ))
    assert response.status_code == 201
    engine = application.extensions['marine_engine']
    directory = application.extensions['photo_storage_dir']
    with engine.begin() as connection:
        connection.execute(report_photos_table.update().values(
            created_at=datetime.now(timezone.utc) - timedelta(hours=25),
        ))
    sweep_orphan_photos(engine, directory)
    delete_photo_if_unreferenced(engine, directory, uploaded['photoKey'])
    assert client.get(uploaded['previewUrl']).status_code == 200


def test_cleanup_recognition_does_not_store_database_photo(api):
    application, client = api
    _, headers = signup(client)
    uploaded = upload(client, headers)
    raw = client.get(uploaded['previewUrl']).data
    engine = application.extensions['marine_engine']
    with engine.connect() as connection:
        before = connection.execute(select(report_photos_table.c.photo_key)).scalars().all()
    response = client.post('/recognitions/cleanup-photo', headers=headers, data={
        'photo': (io.BytesIO(raw), 'cleanup.jpg'),
    }, content_type='multipart/form-data')
    assert response.status_code == 200
    assert 'photoKey' not in response.get_json()
    with engine.connect() as connection:
        assert connection.execute(select(report_photos_table.c.photo_key)).scalars().all() == before
    assert list(application.extensions['photo_storage_dir'].iterdir()) == []


def test_legacy_file_photo_can_still_be_previewed(api):
    application, client = api
    session, headers = signup(client)
    uploaded = upload(client, headers)
    raw = client.get(uploaded['previewUrl']).data
    directory = application.extensions['photo_storage_dir']
    key = uploaded['photoKey']
    photo_file_path(directory, key).write_bytes(raw)
    write_photo_metadata(directory, key, {
        'ownerId': session['user']['id'], 'mime': 'image/jpeg',
        'metadataStripped': True, 'createdAt': datetime.now(timezone.utc).isoformat(),
    })
    with application.extensions['marine_engine'].begin() as connection:
        connection.execute(report_photos_table.delete().where(report_photos_table.c.photo_key == key))
    renewed = client.get(f'/uploads/photos/{key}/preview-url', headers=headers)
    assert renewed.status_code == 200
    assert client.get(renewed.get_json()['previewUrl']).data == raw
    _, other = signup(client)
    assert client.get(f'/uploads/photos/{key}/preview-url', headers=other).status_code == 404
