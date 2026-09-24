#!/usr/bin/env node
// Text-only scene health check. Never writes an image for Claude to read.
//
//   npm run probe -- <id> [--size 800x500] [--wait 1500]
//   npm run probe -- --all
//
// Reports renderer, frame timing, draw calls, console errors, pixel statistics,
// and how much the image changed since the last probe (a 16x16 luminance fingerprint).
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { listExperimentIds, openExperiment, parseArgs, parseSize, startSession } from './lib.mjs'

const CACHE = path.resolve('.snaps/probe-cache.json')
const GRID = 16

function pixelStats(buf) {
  const png = PNG.sync.read(buf)
  const { width, height, data } = png
  const n = width * height
  let sum = 0
  let sumSq = 0
  let clippedDark = 0
  let clippedBright = 0
  const buckets = new Map()
  const grid = new Float64Array(GRID * GRID)
  const gridCount = new Float64Array(GRID * GRID)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sum += l
      sumSq += l * l
      if (l < 4) clippedDark++
      if (l > 251) clippedBright++
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
      const cell = Math.floor((y / height) * GRID) * GRID + Math.floor((x / width) * GRID)
      grid[cell] += l
      gridCount[cell]++
    }
  }
  const mean = sum / n
  const dominant = Math.max(...buckets.values()) / n
  return {
    meanLuma: +mean.toFixed(1),
    contrast: +Math.sqrt(sumSq / n - mean * mean).toFixed(1),
    dominantColorShare: +dominant.toFixed(3),
    distinctColors: buckets.size,
    clippedDark: +(clippedDark / n).toFixed(3),
    clippedBright: +(clippedBright / n).toFixed(3),
    fingerprint: Array.from(grid, (v, i) => Math.round(v / gridCount[i])),
  }
}

function flags(r) {
  const f = []
  if (!r.ready) f.push('NOT_READY (probe never reported 30 frames)')
  if (r.errors.length) f.push(`ERRORS x${r.errors.length}`)
  if (!r.stats) return f
  if (r.stats.dominantColorShare > 0.97) f.push('LIKELY_BLANK (one color fills >97% of frame)')
  if (r.stats.meanLuma < 12) f.push('VERY_DARK')
  if (r.stats.clippedBright > 0.25) f.push('BLOWN_OUT (>25% clipped highlights)')
  if (r.stats.contrast < 6) f.push('FLAT (very low contrast)')
  if (r.probe && r.probe.frameMs.p95 > 33) f.push('SLOW (p95 frame > 33ms — headless GPU; confirm on device)')
  return f
}

const args = parseArgs(process.argv.slice(2))
const size = parseSize(args.size, '800x500')
const session = await startSession()
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}

try {
  const ids = args.all ? await listExperimentIds(session) : args._
  if (!ids.length) throw new Error('usage: npm run probe -- <experiment-id> | --all')

  for (const id of ids) {
    const r = await openExperiment(session, id, { ...size, wait: args.wait ?? 1500 })
    r.stats = r.ready ? pixelStats(await r.page.screenshot({ type: 'png' })) : null
    await r.page.close()

    let delta = 'n/a (first probe)'
    if (r.stats && cache[id]) {
      const prev = cache[id]
      const d = r.stats.fingerprint.reduce((a, v, i) => a + Math.abs(v - prev[i]), 0) / (GRID * GRID * 255)
      delta = `${(d * 100).toFixed(1)}%`
    }
    if (r.stats) cache[id] = r.stats.fingerprint

    const { fingerprint: _, ...stats } = r.stats ?? {}
    const f = flags(r)
    console.log(`\n## ${id}  ${f.length ? '⚠ ' + f.join(', ') : '✓ healthy'}`)
    console.log(`renderer   ${r.probe?.renderer ?? '-'}`)
    console.log(`frame ms   ${r.probe ? `avg ${r.probe.frameMs.avg} · p95 ${r.probe.frameMs.p95} · max ${r.probe.frameMs.max}` : '-'}`)
    console.log(`gpu        ${r.probe ? `${r.probe.calls} draw calls · ${r.probe.triangles.toLocaleString()} tris` : '-'}`)
    console.log(`pixels     ${r.stats ? JSON.stringify(stats) : '-'}`)
    console.log(`Δ visual   ${delta} vs last probe`)
    for (const e of r.errors.slice(0, 5)) console.log(`error      ${e.slice(0, 300)}`)
    if (r.warnings.length) console.log(`warnings   ${r.warnings.length} (first: ${r.warnings[0].slice(0, 160)})`)
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  fs.writeFileSync(CACHE, JSON.stringify(cache))
} finally {
  await session.close()
}
