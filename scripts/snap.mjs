#!/usr/bin/env node
// Captures ONE image for visual review. This is the expensive path — see CLAUDE.md "Visual review policy".
//
//   npm run snap -- <id>                    single view, 800x500 JPEG (~533 tokens)
//   npm run snap -- <id> --size 512x320     cheaper (~219 tokens)
//   npm run snap -- <id> --views            all meta.views tiled into one contact sheet
//
// Prints the output path and estimated token cost. Nothing is read automatically.
import fs from 'node:fs'
import path from 'node:path'
import { imageTokens, openExperiment, parseArgs, parseSize, startSession } from './lib.mjs'

const MAX_PIXELS = 1_150_000 // ~1533 tokens, hard ceiling per image

const args = parseArgs(process.argv.slice(2))
const [id] = args._
if (!id) {
  console.error('usage: npm run snap -- <experiment-id> [--size WxH] [--views] [--wait ms]')
  process.exit(1)
}
const size = parseSize(args.size, '800x500')
const session = await startSession()

try {
  const outDir = path.resolve('.snaps', id)
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const out = path.join(outDir, `${stamp}${args.views ? '-views' : ''}.jpg`)

  const r = await openExperiment(session, id, { ...size, wait: args.wait ?? 1500 })
  if (!r.ready) throw new Error(`probe never became ready. Errors: ${r.errors.join(' | ') || 'none'}`)

  let width = size.width
  let height = size.height

  if (!args.views || !r.meta?.views?.length) {
    await r.page.screenshot({ path: out, type: 'jpeg', quality: 80 })
  } else {
    // Tile each view side by side, scaled so the whole sheet stays under MAX_PIXELS.
    const views = r.meta.views
    const tiles = []
    for (const v of views) {
      await r.page.evaluate(([pos, target]) => window.__probe.setCamera(pos, target), [v.pos, v.target ?? [0, 0, 0]])
      await r.page.waitForTimeout(250)
      tiles.push((await r.page.screenshot({ type: 'png' })).toString('base64'))
    }
    const cols = Math.min(views.length, 3)
    const rows = Math.ceil(views.length / cols)
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (cols * rows * size.width * size.height)))
    const tw = Math.floor(size.width * scale)
    const th = Math.floor(size.height * scale)
    width = tw * cols
    height = th * rows
    const sheet = await session.browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    await sheet.setContent(
      `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${tw}px);background:#000">` +
        tiles.map((b) => `<img src="data:image/png;base64,${b}" style="width:${tw}px;height:${th}px;display:block">`).join('') +
        '</body>',
    )
    await sheet.screenshot({ path: out, type: 'jpeg', quality: 80 })
  }
  await r.page.close()

  if (width * height > MAX_PIXELS) console.warn(`warning: ${width}x${height} exceeds the ${MAX_PIXELS}px budget`)
  console.log(`snap       ${path.relative(process.cwd(), out)}`)
  console.log(`size       ${width}x${height} · ~${imageTokens(width, height)} tokens to view`)
  if (r.errors.length) console.log(`errors     ${r.errors.length} (run probe for details)`)
} finally {
  await session.close()
}
