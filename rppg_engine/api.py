import base64
import os
import threading

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rppg_core import MultiROIFusionEngineV2

app = FastAPI(title="Sanubari rPPG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class FrameRequest(BaseModel):
    session_id: str
    image: str

sessions = {}
sessions_lock = threading.Lock()

class RPPGSession:
    def __init__(self):
        self.engine = MultiROIFusionEngineV2()
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.lock = threading.Lock()

    def close(self):
        self.face_mesh.close()

def get_session(session_id):
    with sessions_lock:
        if session_id not in sessions:
            if len(sessions) >= 20:
                raise HTTPException(429, "Too many active sessions")
            sessions[session_id] = RPPGSession()
        return sessions[session_id]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/frame")
def process_frame(req: FrameRequest):
    session = get_session(req.session_id)

    try:
        encoded = req.image.split(",", 1)[-1]
        raw = base64.b64decode(encoded, validate=True)
        frame = cv2.imdecode(
            np.frombuffer(raw, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )
        if frame is None:
            raise ValueError("Invalid image")

        height, width = frame.shape[:2]

        with session.lock:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            detection = session.face_mesh.process(rgb)
            landmarks = (
                detection.multi_face_landmarks[0]
                if detection.multi_face_landmarks
                else None
            )
            result = session.engine.update(
                frame, landmarks, height, width
            )

        bpm = float(result.fused_bpm or 0)
        sqi = float(result.fused_sqi or 0)

        return {
            "bpm": bpm if np.isfinite(bpm) else 0,
            "sqi": sqi if np.isfinite(sqi) else 0,
            "bpm_locked": bool(result.bpm_locked),
            "session_confidence": float(result.session_confidence or 0),
            "face_detected": landmarks is not None,
            "motion_rejected": bool(result.motion_rejected),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    with sessions_lock:
        session = sessions.pop(session_id, None)
    if session:
        session.close()
    return {"deleted": session is not None}