/**
 * Client for the local rPPG bridge (backend/main.py).
 *
 * The browser stays the source of the camera frames: it grabs the current
 * video frame, encodes it as JPEG (base64) and ships it together with the
 * landmarks MediaPipe FaceLandmarker already computed - exactly the two
 * inputs `POST /api/rppg/frame` expects.
 *
 * Configure the bridge location with a Vite env var, e.g. in `.env`:
 *   VITE_RPPG_API_URL=http://127.0.0.1:8000
 */

const DEFAULT_RPPG_API_URL = 'http://127.0.0.1:8000'

/** Base URL of the bridge. Vite only exposes variables prefixed with VITE_. */
export const RPPG_API_URL = (
  import.meta.env.VITE_RPPG_API_URL || DEFAULT_RPPG_API_URL
).replace(/\/+$/, '')

/**
 * Minimum delay between two frames sent to the bridge (50 ms -> ~20 fps).
 *
 * The engine needs at least `MIN_FRAMES` (120) samples per ROI before it
 * reports a BPM, so the upload rate has to stay close to the engine's own
 * 30 fps target - but it must not be faster than the camera or the main
 * thread can deliver it. Requests are additionally never stacked: only one
 * request is in flight at a time.
 */
export const RPPG_FRAME_INTERVAL_MS = 50

/** How long a single request may take before it is considered failed. */
const REQUEST_TIMEOUT_MS = 10000

/**
 * Start a new measurement session on the bridge: clears the ROI buffers, the
 * calibration state and the motion history of the engine.
 *
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function resetRppgSession() {
  try {
    const response = await fetch(`${RPPG_API_URL}/api/rppg/session/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      return { ok: false, error: `reset failed (HTTP ${response.status})` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error?.message || 'reset failed' }
  }
}

/**
 * Send one camera frame + its face landmarks to the bridge.
 *
 * @param {string} frameBase64 base64 JPEG of the camera frame (no data-URL prefix)
 * @param {Array<{x: number, y: number, z: number}>|null} landmarks normalised landmarks, null when no face was found
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
export async function sendRppgFrame(frameBase64, landmarks) {
  try {
    const response = await fetch(`${RPPG_API_URL}/api/rppg/frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame: frameBase64,
        frame_format: 'jpeg',
        landmarks,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return { ok: false, error: `HTTP ${response.status} ${detail}`.trim() }
    }

    const data = await response.json()
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: error?.message || 'request failed' }
  }
}

/**
 * Convert MediaPipe landmarks into the plain `{x, y, z}` list the bridge
 * expects. MediaPipe normalises x/y to the frame size (0..1), which is
 * exactly what the Python engine multiplies by the frame width/height.
 */
export function toWireLandmarks(landmarks) {
  if (!landmarks?.length) return null
  return landmarks.map(({ x, y, z }) => ({
    x: Number(x),
    y: Number(y),
    z: Number(z ?? 0),
  }))
}
