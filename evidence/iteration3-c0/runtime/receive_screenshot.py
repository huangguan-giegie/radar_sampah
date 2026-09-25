from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import re

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "screenshots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        name = self.path.removeprefix("/capture/")
        if not re.fullmatch(r"[a-z0-9-]+\.jpg", name):
            self.send_error(400)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 15_000_000:
            self.send_error(413)
            return
        payload = self.rfile.read(length)
        if not payload.startswith(b"\xff\xd8\xff"):
            self.send_error(415)
            return
        (OUTPUT_DIR / name).write_bytes(payload)
        self.send_response(201)
        self.end_headers()
        self.wfile.write(name.encode())

    def log_message(self, format, *args):
        return


HTTPServer(("127.0.0.1", 5174), Handler).serve_forever()
