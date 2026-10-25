"""
FastAPI bridge exposing the Sanubari rPPG engine (``MultiROIFusionEngineV2``).

Scope
-----
The browser stays the source of truth for the camera.  It captures the frame,
runs MediaPipe ``FaceLandmarker`` locally and posts BOTH the encoded frame and
the face landmarks to this service.  This service never opens a camera.

The engine contract (verified against ``migration_package/rppg_core.py``) is:

    engine.update(frame, face_landmarks, h, w) -> FrameResult

  * ``frame``          : ``numpy.ndarray`` BGR ``uint8`` with shape ``(h, w, 3)``
  * ``face_landmarks`` : an object exposing ``.landmark`` -> indexable sequence of
                         points with *normalised* ``.x`` / ``.y`` attributes
                         (the legacy MediaPipe ``FaceLandmarks`` shape).
                         ``None`` means "no face detected".
  * ``h`` / ``w``      : frame height / width in pixels

Only ``.x`` and ``.y`` are read from a landmark (``.z`` is ignored by the
engine), so a plain ``[{"x": .., "y": ..}, ..]`` list is enough on the wire.
"""

from __future__ import annotations

import base64
import binascii
import os
import re
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

# --------------------------------------------------------------------------- #
# Engine import
# --------------------------------------------------------------------------- #
# The engine modules use flat sibling imports (``from rppg_config import cfg``),
# therefore the *directory* holding them has to be on sys.path - not the repo
# root.  Nothing inside ``migration_package/`` is modified by this bridge.
REPO_ROOT = Path(__file__).resolve().parent.parent
ENGINE_DIR = REPO_ROOT / "migration_package"

if not (ENGINE_DIR / "rppg_core.py").is_file():
    raise RuntimeError(f"rPPG engine not found at {ENGINE_DIR / 'rppg_core.py'}")
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

try:
    from rppg_core import MultiROIFusionEngineV2  # noqa: E402
except Exception as exc:  # pragma: no cover - startup failure path
    raise RuntimeError(
        f"Failed to import the rPPG engine from {ENGINE_DIR}: {exc}. "
        "Run this service with the conda env that can import rppg_core "
        "(e.g. `conda run -n rppg_env python -m uvicorn backend.main:app`)."
    ) from exc


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
# Only development origins of the Vite frontend are allowed by default.
# Override with a comma separated list, e.g.
#   $env:RPPG_CORS_ORIGINS="http://localhost:5173,http://192.168.1.20:5173"
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]


def _cors_origins() -> List[str]:
    raw = os.getenv("RPPG_CORS_ORIGINS", "").strip()
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


# Hard limits - defensive, the payload is a base64 encoded camera frame.
MAX_BASE64_CHARS = 12 * 1024 * 1024
MAX_FRAME_PIXELS = 4096 * 4096
MAX_LANDMARKS = 5000
EXPECTED_LANDMARK_COUNT = 468  # MediaPipe FaceMesh / FaceLandmarker dense mesh

_DATA_URL_RE = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")


# --------------------------------------------------------------------------- #
# Wire models
# --------------------------------------------------------------------------- #
class LandmarkIn(BaseModel):
    """One normalised landmark point (MediaPipe convention: 0.0 .. 1.0)."""

    model_config = ConfigDict(extra="ignore")

    x: float
    y: float
    z: Optional[float] = 0.0


class FrameRequest(BaseModel):
    """Payload of ``POST /api/rppg/frame``."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    frame: str = Field(
        ...,
        description="Base64 encoded camera frame (JPEG/PNG data-URL or raw base64).",
    )
    landmarks: Optional[List[LandmarkIn]] = Field(
        default=None,
        validation_alias=AliasChoices("landmarks", "face_landmarks"),
        description="Face landmarks in normalised MediaPipe coordinates, or null when no face is detected.",
    )
    frame_format: str = Field(
        default="jpeg",
        description="Hint only for encodings OpenCV cannot sniff: 'jpeg', 'png' or 'bgr' (raw bytes, needs width+height).",
    )
    width: Optional[int] = Field(default=None, description="Required only for frame_format='bgr'.")
    height: Optional[int] = Field(default=None, description="Required only for frame_format='bgr'.")

    @property
    def format_hint(self) -> str:
        return (self.frame_format or "jpeg").strip().lower()


class ResetResponse(BaseModel):
    ok: bool
    message: str
    frames_processed: int
    uptime_s: float


# --------------------------------------------------------------------------- #
# Landmark adapter - duck types MediaPipe's FaceLandmarks for the engine
# --------------------------------------------------------------------------- #
class _EngineLandmark:
    """Minimal stand-in for a MediaPipe landmark (the engine reads .x / .y)."""

    __slots__ = ("x", "y", "z")

    def __init__(self, x: float, y: float, z: float = 0.0) -> None:
        self.x = x
        self.y = y
        self.z = z


class _EngineFaceLandmarks:
    """Minimal stand-in for MediaPipe's ``FaceLandmarks`` container.

    The engine accesses ``face_landmarks.landmark`` and then indexes it, so a
    plain list wrapper is enough.  A *new* object is built for every request on
    purpose: the engine compares landmark objects by identity to detect a stale
    / cached detection, and every HTTP frame is a fresh browser detection.
    """

    __slots__ = ("landmark",)

    def __init__(self, points: List[_EngineLandmark]) -> None:
        self.landmark = points


def _build_landmarks(points: Optional[List[LandmarkIn]]) -> Optional[_EngineFaceLandmarks]:
    """Validate + convert wire landmarks into the object the engine expects."""
    if points is None:
        return None
    if len(points) == 0:
        raise HTTPException(status_code=422, detail="landmarks must be null or a non-empty array")
    if len(points) > MAX_LANDMARKS:
        raise HTTPException(status_code=422, detail=f"too many landmarks (max {MAX_LANDMARKS})")

    converted: List[_EngineLandmark] = []
    for idx, p in enumerate(points):
        x = float(p.x)
        y = float(p.y)
        z = float(p.z or 0.0)
        if not (np.isfinite(x) and np.isfinite(y) and np.isfinite(z)):
            raise HTTPException(status_code=422, detail=f"landmark {idx} has non-finite coordinates")
        # Normalised coordinates outside a sane window are a client bug, but a
        # small overshoot is normal detector jitter -> clamp instead of failing.
        if x < -0.5 or x > 1.5 or y < -0.5 or y > 1.5:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"landmark {idx} is not normalised (x={x}, y={y}); "
                    "expected MediaPipe-style values in the 0.0..1.0 range"
                ),
            )
        converted.append(_EngineLandmark(min(max(x, 0.0), 1.0), min(max(y, 0.0), 1.0), z))

    return _EngineFaceLandmarks(converted)


def _decode_frame(payload: FrameRequest) -> np.ndarray:
    """Decode the request payload into a contiguous BGR ``uint8`` array."""
    raw_b64 = payload.frame or ""
    raw_b64 = _DATA_URL_RE.sub("", raw_b64.strip())
    raw_b64 = _WHITESPACE_RE.sub("", raw_b64)

    if not raw_b64:
        raise HTTPException(status_code=422, detail="frame is empty")
    if len(raw_b64) > MAX_BASE64_CHARS:
        raise HTTPException(status_code=413, detail="frame payload too large")

    try:
        blob = base64.b64decode(raw_b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"frame is not valid base64: {exc}") from exc

    if not blob:
        raise HTTPException(status_code=422, detail="frame payload is empty")

    if payload.format_hint in ("bgr", "raw_bgr"):
        if not payload.width or not payload.height:
            raise HTTPException(
                status_code=422,
                detail="width and height are required when frame_format='bgr'",
            )
        if payload.width <= 0 or payload.height <= 0:
            raise HTTPException(status_code=422, detail="width/height must be positive")
        expected = payload.width * payload.height * 3
        if len(blob) != expected:
            raise HTTPException(
                status_code=422,
                detail=f"raw BGR frame size mismatch: expected {expected} bytes, got {len(blob)}",
            )
        frame = np.frombuffer(blob, dtype=np.uint8).reshape(payload.height, payload.width, 3)
        return np.ascontiguousarray(frame)

    # IMREAD_COLOR always yields a 3 channel BGR uint8 image, whatever the
    # source encoding was (JPEG, PNG with alpha, grayscale, ...).
    buf = np.frombuffer(blob, dtype=np.uint8)
    frame = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=422, detail="frame could not be decoded as an image")

    if frame.dtype != np.uint8:  # defensive, IMREAD_COLOR already yields uint8
        frame = np.clip(frame, 0, 255).astype(np.uint8)
    if frame.ndim != 3 or frame.shape[2] != 3:
        raise HTTPException(status_code=422, detail="decoded frame is not a 3 channel image")

    h, w = frame.shape[:2]
    if h <= 0 or w <= 0 or h * w > MAX_FRAME_PIXELS:
        raise HTTPException(status_code=422, detail="decoded frame has invalid dimensions")
    return np.ascontiguousarray(frame)


# --------------------------------------------------------------------------- #
# Engine session
# --------------------------------------------------------------------------- #
class EngineSession:
    """Owns the single ``MultiROIFusionEngineV2`` instance and its lifecycle.

    The engine is *not* reentrant (it keeps per-ROI buffers, a motion detector
    history, a resampler, ...), so every call is serialised through a lock.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engine = MultiROIFusionEngineV2(enable_logging=False)
        self._frames_processed = 0
        self._started_at = time.time()

    # -- introspection ----------------------------------------------------- #
    @property
    def frames_processed(self) -> int:
        return self._frames_processed

    @property
    def uptime_s(self) -> float:
        return time.time() - self._started_at

    def diagnostics(self) -> Dict[str, Any]:
        with self._lock:
            raw = self._engine.get_diagnostics()
        return _jsonable(raw)

    # -- lifecycle --------------------------------------------------------- #
    def update(self, frame: np.ndarray, landmarks, h: int, w: int) -> Tuple[Any, float]:
        """Run one frame through the engine. Returns ``(FrameResult, ms)``."""
        with self._lock:
            t0 = time.perf_counter()
            result = self._engine.update(frame, landmarks, h, w)
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            self._frames_processed += 1
            return result, elapsed_ms

    def reset(self) -> None:
        """Clear all per-session state (buffers, calibration, motion history)."""
        with self._lock:
            self._engine.reset()
            self._frames_processed = 0
            self._started_at = time.time()


_session: Optional[EngineSession] = None
_session_lock = threading.Lock()


def get_session() -> EngineSession:
    """Return the process-wide engine session, creating it on first use."""
    global _session
    if _session is None:
        with _session_lock:
            if _session is None:
                _session = EngineSession()
    return _session


# --------------------------------------------------------------------------- #
# Result serialisation
# --------------------------------------------------------------------------- #
def _f(value: Any, default: float = 0.0) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    return out if np.isfinite(out) else default


def _i(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _jsonable(value: Any) -> Any:
    """Best-effort conversion of numpy / engine objects into JSON friendly data."""
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, np.ndarray):
        return [_jsonable(v) for v in value.tolist()]
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    if isinstance(value, (bool, int, float, str)) or value is None:
        return value
    return str(value)


def _roi_payload(roi_signals: Dict[str, Any]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {}
    for name, roi in (roi_signals or {}).items():
        payload[str(name)] = {
            "valid": bool(getattr(roi, "valid", False)),
            "sqi": round(_f(getattr(roi, "sqi", 0.0)), 2),
            "bpm": round(_f(getattr(roi, "bpm", 0.0)), 2),
            "weight": round(_f(getattr(roi, "dynamic_weight", 0.0)), 4),
            "agreement_factor": round(_f(getattr(roi, "agreement_factor", 1.0)), 4),
            "skin_coverage": round(_f(getattr(roi, "skin_coverage", 0.0)), 4),
            "snr_db": round(_f(getattr(roi, "roi_snr", 0.0)), 2),
            "regularity": round(_f(getattr(roi, "roi_regularity", 0.0)), 2),
            "brightness": round(_f(getattr(roi, "roi_brightness", 128.0)), 2),
            "motion_stability": round(_f(getattr(roi, "roi_motion_stability", 1.0)), 4),
            "harmonic_suspect": bool(getattr(roi, "is_harmonic_suspect", False)),
        }
    return payload


def _confidence_label(confidence: float) -> str:
    """Mirror of ``SessionConfidenceScorer.confidence_label`` (0-100 scale)."""
    if confidence >= 75:
        return "GOOD"
    if confidence >= 45:
        return "FAIR"
    return "POOR"


def _serialize_result(result: Any, elapsed_ms: float, frame_index: int, diagnostics: Dict[str, Any]) -> Dict[str, Any]:
    """Turn a ``FrameResult`` into the JSON body returned to the frontend."""
    calib = diagnostics.get("calibration_done")
    baseline_sqi = diagnostics.get("baseline_sqi")
    # NOTE: the engine's session confidence is on a 0-100 scale (see
    # SessionConfidenceScorer.get_confidence), while roi_agreement is 0-1.
    confidence = _f(getattr(result, "session_confidence", 0.0))

    return {
        "ok": True,
        "frame_index": frame_index,
        "bpm": round(_f(getattr(result, "fused_bpm", 0.0)), 2),
        "sqi": round(_f(getattr(result, "fused_sqi", 0.0)), 2),
        "confidence": round(confidence, 2),
        "confidence_label": _confidence_label(confidence),
        "session_confidence": round(confidence, 2),
        "roi_agreement": round(_f(getattr(result, "roi_agreement", 1.0)), 4),
        "n_valid_rois": _i(getattr(result, "n_valid_rois", 0)),
        "motion": {
            "score": round(_f(getattr(result, "motion_score", 0.0)), 4),
            "rejected": bool(getattr(result, "motion_rejected", False)),
        },
        "motion_rejected": bool(getattr(result, "motion_rejected", False)),
        "calibration": {
            "in_calibration": bool(getattr(result, "in_calibration", False)),
            "done": bool(calib) if calib is not None else None,
            "baseline_sqi": _f(baseline_sqi) if baseline_sqi is not None else None,
        },
        "rois": _roi_payload(getattr(result, "roi_signals", {}) or {}),
        "flags": {
            "output_frozen": bool(getattr(result, "output_frozen", False)),
            "bpm_locked": bool(getattr(result, "bpm_locked", False)),
            "subharm_corrected": bool(getattr(result, "subharm_corrected", False)),
            "brightness_normalized": bool(getattr(result, "brightness_normalized", False)),
        },
        "physio_state": str(getattr(result, "physio_state", "RESTING")),
        "resp_rate_bpm": round(_f(getattr(result, "resp_rate_bpm", 0.0)), 2),
        "skin_tone_factor": round(_f(getattr(result, "skin_tone_factor", 1.0)), 4),
        "frame_brightness": round(_f(getattr(result, "frame_brightness", 128.0)), 2),
        "exposure_drift": round(_f(getattr(result, "exposure_drift", 0.0)), 3),
        "processing_ms": round(elapsed_ms, 2),
    }


# --------------------------------------------------------------------------- #
# App
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create the single engine instance up front so /health is meaningful and
    # the first camera frame does not pay the construction cost.
    get_session()
    yield


app = FastAPI(
    title="Sanubari rPPG Bridge",
    description="HTTP bridge to the Sanubari rPPG engine (MultiROIFusionEngineV2).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Frame-Index"],
)


@app.get("/health")
def health() -> Dict[str, Any]:
    """Backend / engine status."""
    session = get_session()
    return {
        "status": "ok",
        "engine": "MultiROIFusionEngineV2",
        "engine_ready": True,
        "frames_processed": session.frames_processed,
        "uptime_s": round(session.uptime_s, 3),
        "cors_origins": _cors_origins(),
    }


@app.get("/api/rppg/diagnostics")
def diagnostics() -> Dict[str, Any]:
    """Current engine diagnostics (skin type, calibration, per-ROI SQI, ...)."""
    session = get_session()
    return {
        "ok": True,
        "frames_processed": session.frames_processed,
        "uptime_s": round(session.uptime_s, 3),
        "diagnostics": session.diagnostics(),
    }


@app.post("/api/rppg/frame")
def process_frame(payload: FrameRequest) -> Dict[str, Any]:
    """Process a single camera frame + face landmarks and return the vitals."""
    session = get_session()

    frame = _decode_frame(payload)
    h, w = int(frame.shape[0]), int(frame.shape[1])

    landmarks = _build_landmarks(payload.landmarks)
    if landmarks is not None and len(landmarks.landmark) < EXPECTED_LANDMARK_COUNT:
        # Not fatal: the engine degrades gracefully, but the client should know.
        pass

    try:
        result, elapsed_ms = session.update(frame, landmarks, h, w)
    except Exception as exc:  # engine-level failure -> 500, session stays alive
        raise HTTPException(status_code=500, detail=f"rPPG engine error: {exc}") from exc

    diag = session.diagnostics()
    body = _serialize_result(result, elapsed_ms, session.frames_processed, diag)
    body["landmarks_used"] = 0 if landmarks is None else len(landmarks.landmark)
    body["frame_size"] = {"width": w, "height": h}
    return body


@app.post("/api/rppg/session/reset")
def reset_session() -> ResetResponse:
    """Reset the engine session: clears ROI buffers, calibration and motion history."""
    session = get_session()
    session.reset()
    return ResetResponse(
        ok=True,
        message="session reset",
        frames_processed=session.frames_processed,
        uptime_s=round(session.uptime_s, 3),
    )


# Alias kept for convenience / symmetry with the frame endpoint.
@app.post("/api/rppg/reset")
def reset_session_alias() -> ResetResponse:
    return reset_session()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=os.getenv("RPPG_HOST", "127.0.0.1"),
        port=int(os.getenv("RPPG_PORT", "8000")),
        reload=False,
    )
