/**
 * Face detection model configuration for the camera screen (/measure).
 *
 * The detector runs entirely in the browser with MediaPipe FaceLandmarker -
 * the very same landmark source the Python rPPG engine expects - so the
 * backend (migration_package/) stays untouched. Frames never leave the device.
 *
 * This module also holds the geometry of the "is the face inside the frame?"
 * check, so it can be unit tested without a browser.
 */

/** MediaPipe FaceLandmarker model (float16, ~3.7 MB), fetched on demand. */
export const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

/** WASM runtime of @mediapipe/tasks-vision (kept in sync with package.json). */
export const FACE_WASM_FILESET_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

/** Slack (px, screen space) allowed around the guide outline before a face counts as "out of frame". */
export const FACE_GATE_TOLERANCE_PX = 10

/** A face smaller than this fraction of the guide height is treated as "too far away". */
export const MIN_FACE_HEIGHT_RATIO = 0.4

/** A face narrower than this fraction of the guide width is treated as "too far away". */
export const MIN_FACE_WIDTH_RATIO = 0.35

/** Intrinsic size of src/assets/images/face-guideline.svg (its viewBox). */
export const GUIDE_VIEWBOX = { width: 205, height: 283 }

/**
 * Landmarks that must sit inside the guide for the face to count as framed:
 * forehead (10), chin (152), both cheeks (234/454), nose bridge (162), nose tip (1).
 */
export const FACE_KEY_LANDMARKS = [10, 152, 234, 454, 162, 1]

/**
 * Silhouette of src/assets/images/face-guideline.svg, sampled from its own `d`
 * path (max deviation 0.71 px from the original path, SVG user units).
 * Keeping the real outline - instead of its bounding box - means the chin and
 * the dome of the guide are respected exactly like the drawing shows them.
 */
export const GUIDE_OUTLINE = [
  [0, 105.51], [0.68, 198.68], [4.12, 211.33], [10.29, 222.84], [18.96, 232.74], [29.78, 241.38],
  [40.91, 250.05], [52.03, 258.71], [63.16, 267.37], [77.96, 277.06], [96.22, 282.16], [115, 281.14],
  [132.73, 274], [145.55, 264.49], [156.68, 255.82], [167.8, 247.16], [178.93, 238.5], [189.19, 229.65],
  [197.05, 219.16], [202.34, 207.22], [204.83, 194.3], [204.94, 102.05], [204.12, 91.73], [202.32, 81.55],
  [199.56, 71.61], [195.86, 61.96], [191.26, 52.75], [185.82, 44.06], [179.57, 35.95], [172.56, 28.5],
  [164.89, 21.8], [156.63, 15.91], [147.84, 10.89], [138.6, 6.76], [129.02, 3.59], [119.2, 1.41],
  [109.21, 0.23], [99.14, 0.06], [89.11, 0.9], [79.23, 2.75], [69.56, 5.6], [60.19, 9.41],
  [51.24, 14.14], [42.8, 19.74], [34.93, 26.17], [27.68, 33.39], [21.18, 41.29], [15.46, 49.79],
  [10.58, 58.83], [6.57, 68.35], [3.49, 78.21], [1.37, 88.32], [0.22, 98.6],
]

/** Ray casting point-in-polygon test. */
export function isPointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Shortest distance from a point to the outline of a polygon. */
export function distanceToPolygon(x, y, polygon) {
  let min = Infinity
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const vx = xj - xi
    const vy = yj - yi
    const wx = x - xi
    const wy = y - yi
    const len2 = vx * vx + vy * vy
    const t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0
    min = Math.min(min, Math.hypot(x - (xi + t * vx), y - (yi + t * vy)))
  }
  return min
}

/** True when the point is inside the outline or within `tolerance` of it. */
export function isInsideOutline(x, y, polygon, tolerance = 0) {
  if (isPointInPolygon(x, y, polygon)) return true
  return tolerance > 0 && distanceToPolygon(x, y, polygon) <= tolerance
}

/**
 * Maps normalized MediaPipe landmarks onto the container, honouring the way
 * the <video> is displayed: `object-cover` (scale + crop) and the mirrored
 * `-scale-x-100` of the element.
 *
 * @returns {Array<{x: number, y: number}>|null} points in container pixels
 */
export function mapLandmarksToContainer(landmarks, { videoWidth, videoHeight, containerWidth, containerHeight, mirrored = true }) {
  if (!landmarks?.length || !videoWidth || !videoHeight || !containerWidth || !containerHeight) return null
  // object-cover: the video is scaled until it covers the box, then cropped
  const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight)
  const displayWidth = videoWidth * scale
  const displayHeight = videoHeight * scale
  const offsetX = (containerWidth - displayWidth) / 2
  const offsetY = (containerHeight - displayHeight) / 2
  return landmarks.map(({ x, y }) => ({
    x: mirrored ? containerWidth - (offsetX + x * displayWidth) : offsetX + x * displayWidth,
    y: offsetY + y * displayHeight,
  }))
}

/**
 * Where the guide is drawn inside the container.
 * While the guide is mounted its real box is used; when it is not mounted
 * (the "finished" stage) it is centered at its intrinsic size, which is
 * exactly how the flex layout places it.
 */
export function getGuideBox(container, guide) {
  const containerWidth = container?.clientWidth ?? 0
  const containerHeight = container?.clientHeight ?? 0
  if (guide && container) {
    const containerRect = container.getBoundingClientRect()
    const guideRect = guide.getBoundingClientRect()
    return {
      left: guideRect.left - containerRect.left,
      top: guideRect.top - containerRect.top,
      width: guideRect.width,
      height: guideRect.height,
    }
  }
  return {
    left: (containerWidth - GUIDE_VIEWBOX.width) / 2,
    top: (containerHeight - GUIDE_VIEWBOX.height) / 2,
    width: GUIDE_VIEWBOX.width,
    height: GUIDE_VIEWBOX.height,
  }
}

/** The guide outline expressed in container pixels. */
export function getGuidePolygon(container, guide) {
  const box = getGuideBox(container, guide)
  const scaleX = box.width / GUIDE_VIEWBOX.width
  const scaleY = box.height / GUIDE_VIEWBOX.height
  return GUIDE_OUTLINE.map(([x, y]) => [box.left + x * scaleX, box.top + y * scaleY])
}

/**
 * The gate: the face counts as "in frame" only when its key landmarks sit
 * inside the drawn guide and the face is big enough to be a real portrait.
 *
 * @param {Array<{x: number, y: number}>} landmarks normalized MediaPipe landmarks
 * @param {{videoWidth:number, videoHeight:number, containerWidth:number, containerHeight:number}} metrics
 * @param {Array<Array<number>>} polygon guide outline in container pixels
 */
export function isFaceInsideGuide(landmarks, metrics, polygon) {
  const points = mapLandmarksToContainer(landmarks, metrics)
  if (!points) return false

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const faceWidth = Math.max(...xs) - Math.min(...xs)
  const faceHeight = Math.max(...ys) - Math.min(...ys)

  const guideBox = polygonBounds(polygon)
  if (faceHeight < MIN_FACE_HEIGHT_RATIO * guideBox.height) return false
  if (faceWidth < MIN_FACE_WIDTH_RATIO * guideBox.width) return false

  return FACE_KEY_LANDMARKS.every((index) => {
    const point = points[index]
    if (!point) return true
    return isInsideOutline(point.x, point.y, polygon, FACE_GATE_TOLERANCE_PX)
  })
}

/** Bounding box of a polygon. */
export function polygonBounds(polygon) {
  const xs = polygon.map(([x]) => x)
  const ys = polygon.map(([, y]) => y)
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}
