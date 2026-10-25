"""Manual endpoint check for the rPPG bridge (run from the repo root).

Usage:
    conda run -n rppg_env python backend/_manual_check.py
"""
import base64
import json
import sys
import urllib.error
import urllib.request

import cv2
import numpy as np

BASE = "http://127.0.0.1:8000"

FOREHEAD = [109, 67, 108, 151, 337, 297, 338]
CHEEK_L = [50, 101, 118, 117, 116, 123, 147, 187, 207, 206, 205, 36, 142, 126, 100, 203]
CHEEK_R = [280, 330, 347, 346, 345, 352, 376, 411, 427, 426, 425, 266, 371, 355, 329, 423]


def make_landmarks(n=468):
    rng = np.random.default_rng(7)
    pts = np.zeros((n, 3), dtype=np.float64)
    pts[:, 0] = rng.uniform(0.30, 0.70, n)
    pts[:, 1] = rng.uniform(0.20, 0.85, n)
    pts[:, 2] = rng.uniform(-0.1, 0.1, n)

    def put(i, x, y):
        pts[i, 0], pts[i, 1] = x, y

    put(1, 0.50, 0.45)      # nose tip
    put(234, 0.30, 0.40)    # left cheek edge
    put(454, 0.70, 0.40)    # right cheek edge
    put(10, 0.50, 0.20)     # forehead top
    put(152, 0.50, 0.85)    # chin
    put(13, 0.50, 0.58)     # upper lip
    put(14, 0.50, 0.62)     # lower lip
    for i in (159, 145):
        put(i, 0.40, 0.42)
    for i in (386, 374):
        put(i, 0.60, 0.42)
    for k, i in enumerate(FOREHEAD):
        put(i, 0.38 + 0.04 * k, 0.26 + 0.01 * (k % 3))
    for k, i in enumerate(CHEEK_L):
        put(i, 0.30 + 0.02 * (k % 4), 0.42 + 0.04 * (k // 4))
    for k, i in enumerate(CHEEK_R):
        put(i, 0.70 - 0.02 * (k % 4), 0.42 + 0.04 * (k // 4))
    return [{"x": float(p[0]), "y": float(p[1]), "z": float(p[2])} for p in pts]


def make_frame(w=640, h=480, phase=0.0):
    frame = np.full((h, w, 3), 70, dtype=np.uint8)
    cv2.ellipse(frame, (w // 2, int(h * 0.5)), (int(w * 0.17), int(h * 0.30)),
                0, 0, 360, (150, 165, 185), -1)
    # crude pulsation so the ROI mean actually changes between frames
    tint = int(12 * np.sin(phase))
    cv2.ellipse(frame, (w // 2, int(h * 0.42)), (int(w * 0.10), int(h * 0.12)),
                0, 0, 360, (150 + tint, 165 + tint, 185 + tint), -1)
    return frame


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(BASE + path, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def preflight(origin):
    req = urllib.request.Request(BASE + "/api/rppg/frame", method="OPTIONS")
    req.add_header("Origin", origin)
    req.add_header("Access-Control-Request-Method", "POST")
    req.add_header("Access-Control-Request-Headers", "content-type")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.headers.get("access-control-allow-origin")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get("access-control-allow-origin")


def b64_jpeg(frame):
    ok, buf = cv2.imencode(".jpg", frame)
    assert ok
    return base64.b64encode(buf.tobytes()).decode()


def main():
    landmarks = make_landmarks()

    status, body = call("GET", "/health")
    print("[GET /health]", status, body)
    assert status == 200 and body["status"] == "ok"

    status, body = call("GET", "/api/rppg/diagnostics")
    print("[GET /api/rppg/diagnostics]", status, str(body)[:300])
    assert status == 200

    # single frame
    status, body = call("POST", "/api/rppg/frame",
                        {"frame": b64_jpeg(make_frame(phase=0.0)),
                         "landmarks": landmarks, "frame_format": "jpeg"})
    print("[POST /api/rppg/frame]", status, json.dumps(body, indent=2)[:1200])
    assert status == 200, body
    for key in ("bpm", "sqi", "confidence", "motion_rejected", "n_valid_rois", "calibration"):
        assert key in body, key

    # no face detected -> landmarks null
    status, body = call("POST", "/api/rppg/frame",
                        {"frame": b64_jpeg(make_frame(phase=0.1)), "landmarks": None})
    print("[POST frame, landmarks=null]", status, body.get("bpm"), body.get("n_valid_rois"))
    assert status == 200 and body["landmarks_used"] == 0

    # raw BGR upload path
    raw = make_frame(phase=0.2)
    status, body = call("POST", "/api/rppg/frame",
                        {"frame": base64.b64encode(raw.tobytes()).decode(),
                         "landmarks": landmarks, "frame_format": "bgr",
                         "width": 640, "height": 480})
    print("[POST frame, format=bgr]", status, body.get("bpm"), body.get("frame_size"))
    assert status == 200

    # a burst of frames so the engine leaves its calibration / MIN_FRAMES phase
    for i in range(140):
        status, body = call("POST", "/api/rppg/frame",
                            {"frame": b64_jpeg(make_frame(phase=i * 0.12)),
                             "landmarks": landmarks, "frame_format": "jpeg"})
        if status != 200:
            print("burst failed at", i, body)
            sys.exit(1)
    print("[burst of 140 frames] last:", {k: body[k] for k in
          ("bpm", "sqi", "confidence", "motion_rejected", "n_valid_rois", "processing_ms")})
    print("     calibration:", body["calibration"], "flags:", body["flags"])

    # validation errors
    status, body = call("POST", "/api/rppg/frame", {"frame": "not-base64!!"})
    print("[invalid base64]", status, body[:120])
    assert status == 422

    status, body = call("POST", "/api/rppg/frame", {"frame": base64.b64encode(b"nope").decode()})
    print("[undecodable image]", status, body[:120])
    assert status == 422

    status, body = call("POST", "/api/rppg/frame",
                        {"frame": b64_jpeg(make_frame()), "landmarks": [{"x": 5.0, "y": 0.5}]})
    print("[non-normalised landmark]", status, body[:160])
    assert status == 422

    status, body = call("POST", "/api/rppg/frame", {"frame": ""})
    print("[empty frame]", status, body[:120])
    assert status == 422

    status, body = call("POST", "/api/rppg/frame", {"landmarks": []})
    print("[missing frame]", status, body[:200])
    assert status == 422

    # CORS preflight: dev origin allowed, foreign origin rejected
    status, allow = preflight("http://localhost:5173")
    print("[CORS preflight localhost:5173]", status, allow)
    assert status == 200 and allow == "http://localhost:5173"

    status, allow = preflight("http://evil.example.com")
    print("[CORS preflight evil.example.com]", status, allow)
    assert allow is None

    # reset
    status, body = call("POST", "/api/rppg/session/reset")
    print("[POST /api/rppg/session/reset]", status, body)
    assert status == 200 and body["frames_processed"] == 0

    status, body = call("GET", "/health")
    print("[GET /health after reset]", status, body)
    assert body["frames_processed"] == 0

    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
