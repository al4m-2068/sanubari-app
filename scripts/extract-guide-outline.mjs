// Offline: sample the face-guideline.svg silhouette path into a polygon,
// then simplify it (stride) while reporting the max deviation so we know
// the simplified outline still matches the real path.
// No deps: parse M/V/C/L/Z by hand, sample cubic beziers.
import { readFileSync } from 'node:fs'

const svg = readFileSync('src/assets/images/face-guideline.svg', 'utf8')
const d = svg.match(/ d="([^"]+)"/)[1]
const tokens = d.match(/[MCVLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)

const pts = []
let cur = null
let i = 0
const num = () => parseFloat(tokens[i++])

function cubic(p0, p1, p2, p3, t) {
  const mt = 1 - t
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  }
}

const STEPS = 12
while (i < tokens.length) {
  const cmd = tokens[i++]
  switch (cmd) {
    case 'M':
      cur = { x: num(), y: num() }
      pts.push(cur)
      break
    case 'V':
      cur = { x: cur.x, y: num() }
      pts.push(cur)
      break
    case 'L': {
      const to = { x: num(), y: num() }
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS
        pts.push({ x: cur.x + (to.x - cur.x) * t, y: cur.y + (to.y - cur.y) * t })
      }
      cur = to
      break
    }
    case 'C': {
      const p1 = { x: num(), y: num() }
      const p2 = { x: num(), y: num() }
      const p3 = { x: num(), y: num() }
      for (let s = 1; s <= STEPS; s++) pts.push(cubic(cur, p1, p2, p3, s / STEPS))
      cur = p3
      break
    }
    case 'Z':
      break
    default:
      throw new Error('unhandled cmd ' + cmd)
  }
}

const dedup = []
for (const p of pts) {
  const last = dedup[dedup.length - 1]
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.01) dedup.push(p)
}

function segDist(p, a, b) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const wx = p.x - a.x
  const wy = p.y - a.y
  const len2 = vx * vx + vy * vy
  const t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

function simplify(poly, stride) {
  const kept = []
  for (let k = 0; k < poly.length; k += stride) kept.push(poly[k])
  return kept
}

function maxDeviation(original, kept) {
  let max = 0
  for (const p of original) {
    let best = Infinity
    for (let k = 0; k < kept.length; k++) {
      const a = kept[k]
      const b = kept[(k + 1) % kept.length]
      best = Math.min(best, segDist(p, a, b))
    }
    max = Math.max(max, best)
  }
  return max
}

const fmt = (n) => Math.round(n * 100) / 100
for (const stride of [2, 3, 4]) {
  const kept = simplify(dedup, stride)
  console.log(`stride ${stride}: ${kept.length} verts, max deviation ${maxDeviation(dedup, kept).toFixed(3)}px`)
}

const kept = simplify(dedup, 3)
console.log('\nEXPORT = [')
for (let k = 0; k < kept.length; k += 8) {
  console.log(
    '  ' +
      kept
        .slice(k, k + 8)
        .map((p) => `[${fmt(p.x)},${fmt(p.y)}]`)
        .join(',') +
      ','
  )
}
console.log(']')
