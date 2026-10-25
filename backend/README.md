# Sanubari rPPG Bridge (FastAPI)

HTTP bridge between the React/Vite frontend and the rPPG engine
(`migration_package/rppg_core.py` -> `MultiROIFusionEngineV2`).

The **browser remains the source of the camera frames**. This service never
opens a camera: the frontend captures the frame, runs MediaPipe
`FaceLandmarker` locally, and posts the encoded frame **plus** the face
landmarks to this API.

---

## 1. Environment

Use the conda environment that can import the engine (`rppg_env`).
Verified on this machine:

```powershell
conda run -n rppg_env python -c "from rppg_core import MultiROIFusionEngineV2; print('import ok')"
```

Install the API dependencies (into the same env):

```powershell
conda activate rppg_env
pip install -r backend\requirements.txt
```

The engine dependencies (`numpy`, `scipy`, `opencv-python`, `scikit-learn`) stay
in `migration_package/requirements.txt` and are mirrored in
`backend/requirements.txt` so a single install is enough.

---

## 2. Run the backend

From the repo root (`sanubari-app`):

```powershell
conda activate rppg_env
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Without activating the env:

```powershell
conda run -n rppg_env python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Interactive API docs: <http://127.0.0.1:8000/docs>

Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `RPPG_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174` | Comma separated list of allowed browser origins (dev frontend only) |
| `RPPG_HOST` / `RPPG_PORT` | `127.0.0.1` / `8000` | Used by `python backend/main.py` |

```powershell
# allow the frontend to run on another host / port (dev only!)
$env:RPPG_CORS_ORIGINS = "http://localhost:5173,http://192.168.1.20:5173"
```

---

## 3. Test every endpoint

### 3.1 Health

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get | ConvertTo-Json
```

### 3.2 Engine diagnostics

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/rppg/diagnostics" -Method Get | ConvertTo-Json -Depth 5
```

### 3.3 Process one frame

```powershell
$body = @{
    frame        = "<base64 jpeg/png of the camera frame>"
    frame_format = "jpeg"
    landmarks    = @(
        @{ x = 0.50; y = 0.45; z = 0.0 }
        @{ x = 0.30; y = 0.40; z = 0.0 }
    )   # or $null when no face is detected
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/rppg/frame" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
```

Building the base64 payload from a real camera grab (browser side):

```js
const dataUrl = canvas.toDataURL("image/jpeg", 0.9);   // browser only
const frame = dataUrl.split(",")[1];                    // strip the data-URL prefix
```

### 3.4 Reset the session

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/rppg/session/reset" -Method Post | ConvertTo-Json
```

### 3.5 Automated check of all endpoints

`backend/check_endpoints.py` builds a synthetic face + 468 landmarks, exercises
every endpoint (including the validation-error paths and the CORS preflight)
and prints the results:

```powershell
conda run -n rppg_env python backend\check_endpoints.py
```

---

## 4. Request / response contract

### `POST /api/rppg/frame`

```jsonc
{
  "frame": "<base64 JPEG/PNG, with or without the data: prefix>",
  "frame_format": "jpeg",          // "jpeg" | "png" | "bgr" (raw bytes)
  "landmarks": [                   // MediaPipe-style, NORMALISED 0..1; null = no face
    { "x": 0.512, "y": 0.431, "z": -0.02 }
  ],
  "width": 640,                    // only needed for frame_format = "bgr"
  "height": 480                    // only needed for frame_format = "bgr"
}
```

`face_landmarks` is accepted as an alias for `landmarks`.
`landmarks: null` is valid -> the engine reports "no face detected"
(`bpm = 0`, `n_valid_rois = 0`).

Response (HTTP 200):

```jsonc
{
  "ok": true,
  "frame_index": 142,
  "bpm": 81.88,
  "sqi": 59.55,
  "confidence": 47.57,             // session confidence, 0-100
  "confidence_label": "FAIR",      // GOOD >= 75, FAIR >= 45, else POOR
  "session_confidence": 47.57,
  "roi_agreement": 0.92,           // 0..1
  "n_valid_rois": 3,
  "motion": { "score": 0.02, "rejected": false },
  "motion_rejected": false,
  "calibration": { "in_calibration": true, "done": false, "baseline_sqi": 0.0 },
  "rois": {
    "forehead":    { "valid": true, "sqi": 0.0, "bpm": 0.0, "weight": 1.0,
                     "agreement_factor": 1.0, "skin_coverage": 1.26, "snr_db": 0.0,
                     "regularity": 0.0, "brightness": 160.69,
                     "motion_stability": 1.0, "harmonic_suspect": false }
  },
  "flags": { "output_frozen": false, "bpm_locked": false,
             "subharm_corrected": false, "brightness_normalized": false },
  "physio_state": "RESTING",
  "resp_rate_bpm": 0.0,
  "skin_tone_factor": 1.0,
  "frame_brightness": 128.0,
  "exposure_drift": 0.0,
  "processing_ms": 38.11,
  "landmarks_used": 468,
  "frame_size": { "width": 640, "height": 480 }
}
```

Error responses:

| Code | Cause |
|---|---|
| 422 | frame missing / not base64 / not decodable, landmarks not normalised, empty frame, `bgr` without `width`+`height` |
| 413 | frame payload > ~12 MB base64 |
| 500 | engine raised while processing the frame (the session stays alive) |

### Other endpoints

| Method | Path | Response |
|---|---|---|
| `GET` | `/health` | `{ status, engine, engine_ready, frames_processed, uptime_s, cors_origins }` |
| `GET` | `/api/rppg/diagnostics` | engine internals (skin type, calibration, per-ROI SQI/weight, pose, jaw state) |
| `POST` | `/api/rppg/session/reset` | `{ ok, message, frames_processed, uptime_s }` - clears ROI buffers, calibration and motion history |

---

## 5. Notes

* One single `MultiROIFusionEngineV2` instance is shared by the whole process and
  guarded by a lock (the engine keeps per-session buffers and is not reentrant).
* `POST /api/rppg/session/reset` is the way to start a new measurement session.
* CORS is restricted to the Vite dev origins; there is no `allow_origins=["*"]`.
* The engine and all React files are untouched by this bridge.
