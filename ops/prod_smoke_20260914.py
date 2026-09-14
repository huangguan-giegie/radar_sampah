import base64
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests

BASE = os.environ.get("API_BASE", "https://team04-marine-observation-api.onrender.com").rstrip("/")
EVENT_ID = os.environ.get("SMOKE_EVENT_ID", "smoke-prod-20260914-a7f3")
LAT = 2.746
LNG = 101.440
MARKER = "PROD_SMOKE_20260914_A7F3"

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII="
)

summary = {"marker": MARKER, "eventId": EVENT_ID, "steps": []}

def record(name, response):
    item = {"step": name, "status": response.status_code}
    try:
        body = response.json()
    except Exception:
        body = response.text[:500]
    item["body"] = body
    summary["steps"].append(item)
    print("SMOKE_STEP", json.dumps(item, default=str), flush=True)
    return body


def req(method, path, token=None, expected=(200,), **kwargs):
    headers = dict(kwargs.pop("headers", {}) or {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.request(method, BASE + path, headers=headers, timeout=40, **kwargs)
    body = record(f"{method} {path}", r)
    if r.status_code not in expected:
        raise RuntimeError(f"Unexpected {r.status_code} for {method} {path}: {body}")
    return r, body


def anonymous(label):
    _, body = req("POST", "/auth/anonymous", expected=(201,))
    user = body["user"]
    result = {
        "participantId": user["participantId"],
        "userId": user["id"],
        "session": body["token"],
        "recovery": body["recoveryToken"],
    }
    summary[label] = {"participantId": result["participantId"], "userId": result["userId"]}
    return result


def upload(token, filename):
    _, body = req(
        "POST",
        "/uploads/photos",
        token=token,
        expected=(201,),
        files={"photo": (filename, PNG, "image/png")},
    )
    return body["photoKey"]


def report(token, photo_key, quantities, item_counts, lat, lng, event_id=None):
    payload = {
        "beachId": "morib",
        "quantities": quantities,
        "photoKey": photo_key,
        "locationSource": "gps",
        "coords": {"lat": lat, "lng": lng},
        "itemCounts": item_counts,
    }
    if event_id:
        payload["eventId"] = event_id
    _, body = req("POST", "/reports", token=token, expected=(201,), json=payload)
    return body

try:
    req("GET", "/health", expected=(200,))

    u1 = anonymous("user1")
    _, restored = req(
        "POST",
        "/auth/restore",
        expected=(200,),
        json={"participantId": u1["participantId"], "token": u1["recovery"]},
    )
    u1["session"] = restored["token"]
    summary["recoveryRestore"] = True

    u2 = anonymous("user2")

    _, event = req("GET", f"/events/{EVENT_ID}", expected=(200,))
    summary["eventWindow"] = {
        "date": event.get("date"),
        "startsAt": event.get("startsAt"),
        "endsAt": event.get("endsAt"),
    }

    req("POST", f"/events/{EVENT_ID}/join", token=u1["session"], expected=(200,))
    _, checkin = req(
        "POST",
        f"/events/{EVENT_ID}/check-in",
        token=u1["session"],
        expected=(200,),
        json={"lat": LAT, "lng": LNG},
    )
    if not checkin.get("checkedIn"):
        raise RuntimeError(f"Check-in did not succeed: {checkin}")
    summary["checkIn"] = True

    photo1 = upload(u1["session"], "smoke-1.png")
    first = report(
        u1["session"],
        photo1,
        {"Plastic": "Small"},
        {"Plastic": 3},
        LAT,
        LNG,
        EVENT_ID,
    )
    summary["report1"] = {"id": first["id"], "status": first["status"], "photoKey": photo1}
    if first["status"] != "Counted":
        raise RuntimeError(f"First report should be Counted, got {first['status']}")

    photo2 = upload(u2["session"], "smoke-2.png")
    second = report(
        u2["session"],
        photo2,
        {"Metal": "Medium"},
        {"Metal": 7},
        LAT + 0.00005,
        LNG,
    )
    summary["report2"] = {"id": second["id"], "status": second["status"], "photoKey": photo2}
    if second["status"] != "Duplicate":
        raise RuntimeError(f"Second report should be Duplicate by ~10m cross-user rule, got {second['status']}")

    cleanup_payload = {
        "targetReportId": first["id"],
        "eventId": EVENT_ID,
        "removed": {"Plastic": 1},
        "handling": "Collected for disposal",
        "note": MARKER,
        "idempotencyKey": "prod-smoke-20260914-a7f3",
    }
    _, cleanup = req(
        "POST",
        "/cleanup-actions",
        token=u1["session"],
        expected=(201,),
        json=cleanup_payload,
    )
    summary["cleanup"] = {"id": cleanup.get("id"), "score": cleanup.get("score")}

    _, targets = req("GET", f"/cleanup-targets?reportId={first['id']}", expected=(200,))
    if len(targets) != 1 or targets[0].get("remaining", {}).get("Plastic") != 2:
        raise RuntimeError(f"Cleanup remaining count mismatch: {targets}")
    summary["cleanupRemainingPlastic"] = 2

    _, event_after = req("GET", f"/events/{EVENT_ID}", token=u1["session"], expected=(200,))
    attendance = event_after.get("attendanceBy", [])
    if u1["participantId"] not in attendance:
        raise RuntimeError(f"Attendance not recorded after checked-in same-event evidence: {attendance}")
    summary["attendanceRecorded"] = True

    summary["ok"] = True
except Exception as exc:
    summary["ok"] = False
    summary["error"] = repr(exc)
    print("SMOKE_ERROR", repr(exc), flush=True)
finally:
    print("SMOKE_SUMMARY", json.dumps(summary, default=str), flush=True)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        payload = json.dumps({"smoke": summary.get("ok", False), "marker": MARKER}).encode()
        self.send_response(200 if summary.get("ok") else 500)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def log_message(self, fmt, *args):
        return

port = int(os.environ.get("PORT", "10000"))
HTTPServer(("0.0.0.0", port), Handler).serve_forever()
