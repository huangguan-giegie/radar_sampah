"""Exercise the running API with one temporary participant, then remove its data."""
import io
import json
import os
import time
import urllib.request
import uuid
from urllib.parse import urlsplit

import psycopg
from psycopg import sql
from PIL import Image

BASE = "http://127.0.0.1:5000/api"
token = None
user_id = None
report_id = None


def request(path, method="GET", payload=None, raw=None, content_type=None, expected=200):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    if payload is not None:
        raw = json.dumps(payload).encode()
        content_type = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    started = time.monotonic()
    req = urllib.request.Request(BASE + path, data=raw, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=90) as response:
        body = response.read()
        # Signed preview URLs and authentication values must never enter logs.
        print(f"{method} {path.split('?')[0]} HTTP={response.status} seconds={time.monotonic()-started:.3f}", flush=True)
        assert response.status == expected
        return json.loads(body) if "json" in response.headers.get("Content-Type", "") else body


database_url = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://", 1)
schema = os.environ.get("DATABASE_SCHEMA", "").strip() or "public"
# Establish cleanup access before creating any test records.
with psycopg.connect(database_url, autocommit=True) as connection:
    connection.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
    connection.execute("SELECT 1")
    try:
        assert request("/health")["database"] == "connected"
        account = request("/auth/anonymous", "POST", expected=201)
        user_id = account["user"]["id"]
        token = account["token"]
        assert request("/auth/me")["id"] == user_id
        restored = request("/auth/restore", "POST", {
            "participantId": account["user"]["participantId"], "token": account["recoveryToken"],
        })
        assert restored["user"]["id"] == user_id

        image = io.BytesIO()
        Image.new("RGB", (64, 64), "white").save(image, format="JPEG")
        boundary = "radar-smoke-" + uuid.uuid4().hex
        upload = (f'--{boundary}\r\nContent-Disposition: form-data; name="photo"; filename="smoke.jpg"\r\n'
                  'Content-Type: image/jpeg\r\n\r\n').encode() + image.getvalue() + f"\r\n--{boundary}--\r\n".encode()
        photo = request("/uploads/photos", "POST", raw=upload,
                        content_type="multipart/form-data; boundary=" + boundary, expected=201)
        assert photo["metadataStripped"] is True
        preview = urlsplit(photo["previewUrl"])
        assert preview.path.startswith("/api/")
        assert request(preview.path.removeprefix("/api") + "?" + preview.query).startswith(b"\xff\xd8")
        for _ in range(2):
            recognised = request("/recognitions", "POST", {"photoKey": photo["photoKey"]})
            assert recognised["modelState"] in {"ready", "empty"}, "ONNX inference is unavailable"
            print("ONNX inference state:", recognised["modelState"], "model:", recognised["modelVersion"])

        report = request("/reports", "POST", {
            "beachId": "morib", "quantities": {"Plastic": "Medium"},
            "photoKey": photo["photoKey"], "locationSource": "manual",
        }, expected=201)
        report_id = report["id"]
        assert report["status"] == "Counted"
        assert any(row["id"] == report_id for row in request("/reports/mine"))
        cleanup = request("/cleanups", "POST", {
            "targetReportId": report_id, "afterBands": {"Plastic": "Small"},
            "handling": "Collected for disposal", "idempotencyKey": "smoke-" + uuid.uuid4().hex,
        }, expected=201)
        assert cleanup["resolved"] is True
        assert request("/cleanups/" + cleanup["id"])["id"] == cleanup["id"]

        events = request("/cleanup-events")
        event = next((row for row in events if row["status"] == "Open"), None)
        assert event is not None, "No open event is available for join/leave acceptance"
        path = "/cleanup-events/" + event["id"] + "/join"
        assert request(path, "POST")["joined"] is True
        assert request(path, "DELETE")["joined"] is False

        catalog = request("/api/species-distribution/species")
        assert catalog["modelCount"] == len(catalog["species"]) == 40
        for _ in range(2):
            prediction = request("/api/species-distribution/predict", "POST", {
                "latitude": 2.74614, "longitude": 101.44024, "mode": "nearby_marine", "topK": 5,
            })
            assert prediction["modelCount"] == len(prediction["predictions"]) == 40
        for path in ("/beaches", "/beaches/morib", "/insights", "/species-cards", "/wildlife-guidance"):
            request(path)
        request("/auth/logout", "POST", expected=204)
    finally:
        if user_id:
            assert user_id.startswith("u_") and len(user_id) == 26
            with connection.transaction():
                # Only records belonging to the participant created above are removed.
                connection.execute("DELETE FROM community_event_members WHERE participant_id = %s", (user_id,))
                connection.execute("DELETE FROM cleanup_actions WHERE participant_id = %s", (user_id,))
                if report_id:
                    connection.execute("DELETE FROM reports WHERE id = %s AND reporter_id = %s", (report_id, user_id))
                connection.execute("DELETE FROM report_photos WHERE owner_id = %s", (user_id,))
                connection.execute("DELETE FROM users WHERE id = %s", (user_id,))
            assert connection.execute("SELECT COUNT(*) FROM users WHERE id = %s", (user_id,)).fetchone()[0] == 0
            print("Temporary acceptance records removed.", flush=True)

print("Production API acceptance passed. The neutral image checks execution, not detection accuracy.", flush=True)
