/**
 * Tests for the face-gated progress on /measure.
 *
 *  1. The embedded guide outline still matches the real face-guideline.svg path.
 *  2. The video -> container mapping honours object-cover (scale + crop) and the
 *     mirrored (-scale-x-100) video element.
 *  3. The gate accepts a framed face and rejects faces that are out of frame
 *     or too far away.
 *  4. The MediaPipe FaceLandmarker runtime can actually be loaded and used.
 *
 * Run with: node scripts/test-face-gate.mjs
 */
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  GUIDE_OUTLINE,
  GUIDE_VIEWBOX,
  FACE_MODEL_URL,
  FACE_WASM_FILESET_URL,
  getGuidePolygon,
  isFaceInsideGuide,
  isPointInPolygon,
  mapLandmarksToContainer,
} from '../src/config/faceModel.js'

let failed = 0
const ok = (name, condition, extra = '') => {
  if (condition) {
    console.log(`  PASS  ${name}${extra ? ` (${extra})` : ''}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${extra ? ` (${extra})` : ''}`)
  }
}

/* ------------------------------------------------------------------ *
 * 1. embedded outline vs. the real SVG path
 * ------------------------------------------------------------------ */
console.log('\n[1] guide outline vs face-guideline.svg')
const svg = readFileSync('src/assets/images/face-guideline.svg', 'utf8')
const d = svg.match(/ d="([^"]+)"/)[1]

function samplePath(path) {
  const tokens = path.match(/[MCVLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)
  const pts = []
  let cur = null
  let i = 0
  const num = () => parseFloat(tokens[i++])
  const cubic = (p0, p1, p2, p3, t) => {
    const m = 1 - t
    return {
      x: m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x,
      y: m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y,
    }
  }
  const STEPS = 12
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (cmd === 'M') { cur = { x: num(), y: num() }; pts.push(cur) }
    else if (cmd === 'V') { cur = { x: cur.x, y: num() }; pts.push(cur) }
    else if (cmd === 'L') {
      const to = { x: num(), y: num() }
      for (let s = 1; s <= STEPS; s++) { const t = s / STEPS; pts.push({ x: cur.x + (to.x - cur.x) * t, y: cur.y + (to.y - cur.y) * t }) }
      cur = to
    } else if (cmd === 'C') {
      const p1 = { x: num(), y: num() }, p2 = { x: num(), y: num() }, p3 = { x: num(), y: num() }
      for (let s = 1; s <= STEPS; s++) pts.push(cubic(cur, p1, p2, p3, s / STEPS))
      cur = p3
    }
  }
  return pts
}

function segmentDistance(p, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, wx = p.x - a.x, wy = p.y - a.y
  const len2 = vx * vx + vy * vy
  const t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

const realPath = samplePath(d)
let maxDeviation = 0
for (const p of realPath) {
  let best = Infinity
  for (let k = 0; k < GUIDE_OUTLINE.length; k++) {
    const a = { x: GUIDE_OUTLINE[k][0], y: GUIDE_OUTLINE[k][1] }
    const b = { x: GUIDE_OUTLINE[(k + 1) % GUIDE_OUTLINE.length][0], y: GUIDE_OUTLINE[(k + 1) % GUIDE_OUTLINE.length][1] }
    best = Math.min(best, segmentDistance(p, a, b))
  }
  maxDeviation = Math.max(maxDeviation, best)
}
ok('outline follows the shipped SVG path', maxDeviation < 1, `max deviation ${maxDeviation.toFixed(3)}px`)
ok('outline covers the guide center', isPointInPolygon(102.5, 141.5, GUIDE_OUTLINE))
ok('outline excludes a point above the dome', !isPointInPolygon(102.5, -20, GUIDE_OUTLINE))
ok('outline excludes a point below the chin', !isPointInPolygon(102.5, 300, GUIDE_OUTLINE))

/* ------------------------------------------------------------------ *
 * 2. video -> container mapping (object-cover + mirrored video)
 * ------------------------------------------------------------------ */
console.log('\n[2] video -> container mapping')
const videoWidth = 640, videoHeight = 480
const containerWidth = 360, containerHeight = 532
const metrics = { videoWidth, videoHeight, containerWidth, containerHeight }

const mapped = mapLandmarksToContainer([{ x: 0.5, y: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 1 }], metrics)
ok('center of the frame stays centered', Math.abs(mapped[0].x - containerWidth / 2) < 0.01 && Math.abs(mapped[0].y - containerHeight / 2) < 0.01,
  `(${mapped[0].x.toFixed(1)}, ${mapped[0].y.toFixed(1)})`)

// object-cover: 640x480 into 360x532 -> scale 1.1083, width cropped on both sides
const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight)
const displayWidth = videoWidth * scale
ok('cropped horizontally (source is wider than the box)', displayWidth > containerWidth, `display width ${displayWidth.toFixed(1)}px`)
ok('mirrored: source left edge ends up on the right', mapped[1].x > containerWidth, `x=${mapped[1].x.toFixed(1)}`)
ok('mirrored: source right edge ends up on the left', mapped[2].x < 0, `x=${mapped[2].x.toFixed(1)}`)
ok('no vertical crop: source fills the box height', mapped[1].y === 0 && mapped[2].y === containerHeight,
  `y=${mapped[1].y}..${mapped[2].y}`)

// a container that is wider than the video -> the video is cropped vertically
const wideMetrics = { videoWidth: 640, videoHeight: 480, containerWidth: 640, containerHeight: 300 }
const wideMapped = mapLandmarksToContainer([{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }], wideMetrics)
ok('vertical crop when the box is wider than the video', wideMapped[0].y < 0 && wideMapped[1].y > 300,
  `y=${wideMapped[0].y.toFixed(1)}..${wideMapped[1].y.toFixed(1)}`)

/* ------------------------------------------------------------------ *
 * 3. the gate itself
 * ------------------------------------------------------------------ */
console.log('\n[3] face gate')
const guideBox = {
  left: (containerWidth - GUIDE_VIEWBOX.width) / 2,
  top: (containerHeight - GUIDE_VIEWBOX.height) / 2,
  width: GUIDE_VIEWBOX.width,
  height: GUIDE_VIEWBOX.height,
}
const polygon = getGuidePolygon(
  { clientWidth: containerWidth, clientHeight: containerHeight, getBoundingClientRect: () => ({ left: 0, top: 0 }) },
  null,
)

// container px -> normalized source coords (inverse of the mapping above)
function toSource(px, py) {
  const s = Math.max(containerWidth / videoWidth, containerHeight / videoHeight)
  const dw = videoWidth * s, dh = videoHeight * s
  const ox = (containerWidth - dw) / 2, oy = (containerHeight - dh) / 2
  return { x: (containerWidth - px - ox) / dw, y: (py - oy) / dh }
}

// builds a 478 point landmark set shaped like a face, positioned in container px
function makeFace({ forehead, chin, leftCheek, rightCheek }) {
  const landmarks = new Array(478)
  const put = (index, px, py) => { landmarks[index] = toSource(px, py) }
  const cx = (leftCheek[0] + rightCheek[0]) / 2
  const cy = (forehead[1] + chin[1]) / 2
  const w = Math.abs(rightCheek[0] - leftCheek[0])
  const h = Math.abs(chin[1] - forehead[1])
  put(10, forehead[0], forehead[1])          // forehead
  put(152, chin[0], chin[1])                 // chin
  put(234, leftCheek[0], leftCheek[1])      // left cheek
  put(454, rightCheek[0], rightCheek[1])    // right cheek
  put(162, cx, cy - h * 0.12)               // nose bridge
  put(1, cx, cy)                            // nose tip
  for (let i = 0; i < landmarks.length; i++) {
    if (landmarks[i]) continue
    const angle = (i / landmarks.length) * Math.PI * 2
    landmarks[i] = toSource(cx + (Math.cos(angle) * w) / 2, cy + (Math.sin(angle) * h) / 2)
  }
  return landmarks
}

// reference face: aligned with the guide
const guide = (x, y) => [guideBox.left + x, guideBox.top + y]
const framed = makeFace({
  forehead: guide(102, 70),
  chin: guide(102, 235),
  leftCheek: guide(45, 150),
  rightCheek: guide(160, 150),
})
ok('framed face passes the gate', isFaceInsideGuide(framed, metrics, polygon))

const slightlyOff = makeFace({
  forehead: guide(102, 78),
  chin: guide(102, 240),
  leftCheek: guide(52, 155),
  rightCheek: guide(155, 155),
})
ok('small drift still passes (tolerance)', isFaceInsideGuide(slightlyOff, metrics, polygon))

const tooHigh = makeFace({
  forehead: guide(102, -20),
  chin: guide(102, 150),
  leftCheek: guide(45, 70),
  rightCheek: guide(160, 70),
})
ok('face above the frame is rejected', !isFaceInsideGuide(tooHigh, metrics, polygon))

const tooLeft = makeFace({
  forehead: guide(-10, 70),
  chin: guide(-10, 235),
  leftCheek: guide(-70, 150),
  rightCheek: guide(45, 150),
})
ok('face beside the frame is rejected', !isFaceInsideGuide(tooLeft, metrics, polygon))

const tiny = makeFace({
  forehead: guide(102, 120),
  chin: guide(102, 165),
  leftCheek: guide(80, 140),
  rightCheek: guide(125, 140),
})
ok('face too far away is rejected', !isFaceInsideGuide(tiny, metrics, polygon))

ok('no landmarks means no face', !isFaceInsideGuide([], metrics, polygon))
ok('missing video metrics means no face', !isFaceInsideGuide(framed, { ...metrics, videoWidth: 0 }, polygon))

/* ------------------------------------------------------------------ *
 * 4. MediaPipe runtime
 * ------------------------------------------------------------------ */
console.log('\n[4] MediaPipe FaceLandmarker runtime')
// MediaPipe probes the browser environment even for the CPU delegate
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node', hardwareConcurrency: 4 }
}
const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

const wasmDir = 'node_modules/@mediapipe/tasks-vision/wasm'
if (!existsSync(wasmDir)) {
  ok('local wasm fileset found', false, wasmDir)
} else {
  ok('local wasm fileset found', true, wasmDir)
  let tempDir = null
  try {
    const fileset = await FilesetResolver.forVisionTasks(wasmDir)
    const response = await fetch(FACE_MODEL_URL)
    if (!response.ok) throw new Error(`model download failed: ${response.status}`)
    const buffer = new Uint8Array(await response.arrayBuffer())
    tempDir = mkdtempSync(join(tmpdir(), 'face-model-'))
    const modelPath = join(tempDir, 'face_landmarker.task')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(modelPath, buffer)

    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    })
    ok('FaceLandmarker created from the shipped model', true, `${(buffer.length / 1024 / 1024).toFixed(1)} MB`)

    const frame = { data: new Uint8ClampedArray(320 * 240 * 4).fill(120), width: 320, height: 240 }
    const result = landmarker.detectForVideo(frame, performance.now())
    ok('detectForVideo runs and reports no face in a blank frame', result?.faceLandmarks?.length === 0,
      `faces=${result?.faceLandmarks?.length}`)
    landmarker.close()
  } catch (err) {
    ok('MediaPipe runtime smoke test', false, err.message)
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  }
}

console.log(`\nwasm fileset url in use: ${FACE_WASM_FILESET_URL}`)
console.log(failed === 0 ? '\nALL TESTS PASSED' : `\n${failed} TEST(S) FAILED`)
process.exit(failed === 0 ? 0 : 1)
