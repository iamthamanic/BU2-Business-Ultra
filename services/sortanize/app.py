"""Sortanize matching sidecar — minimal Python HTTP service for list matching."""

from __future__ import annotations

import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse


def normalize(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9äöüß\s\-]", "", s)
    return re.sub(r"\s+", " ", s)


def score(a: str, b: str) -> float:
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.85
    sa, sb = set(na.split()), set(nb.split())
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def match_lists(source: list[str], target: list[str], threshold: float = 0.6):
    results = []
    used = set()
    for s in source:
        best_i, best = -1, 0.0
        for i, t in enumerate(target):
            if i in used:
                continue
            sc = score(s, t)
            if sc > best:
                best, best_i = sc, i
        if best_i >= 0 and best >= threshold:
            used.add(best_i)
            results.append({"source": s, "target": target[best_i], "score": round(best, 3), "matched": True})
        else:
            results.append({"source": s, "target": None, "score": round(best, 3), "matched": False})
    return {
        "matches": results,
        "unmatched_targets": [t for i, t in enumerate(target) if i not in used],
    }


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._json(200, {"ok": True, "service": "sortanize"})
        return self._json(404, {"error": "not_found"})

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("content-length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": "invalid_json"})
        if path == "/match":
            source = data.get("source") or []
            target = data.get("target") or []
            threshold = float(data.get("threshold", 0.6))
            return self._json(200, match_lists(list(source), list(target), threshold))
        return self._json(404, {"error": "not_found"})

    def log_message(self, fmt: str, *args):
        print(f"[sortanize] {self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    port = 8760
    print(f"[sortanize] listening on 0.0.0.0:{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
