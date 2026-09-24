import { createServer } from 'vite'
import { chromium } from 'playwright'

export function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) args[key] = true
      else (args[key] = next), i++
    } else args._.push(a)
  }
  return args
}

export function parseSize(s, fallback) {
  const [w, h] = String(s ?? fallback).split('x').map(Number)
  return { width: w, height: h }
}

/** Claude's image token cost is ~ (width * height) / 750. */
export const imageTokens = (w, h) => Math.ceil((w * h) / 750)

export async function startSession() {
  const server = await createServer({ logLevel: 'silent', server: { port: 0 } })
  await server.listen()
  const { port } = server.httpServer.address()
  const browser = await chromium.launch({
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-webgpu'],
  })
  return {
    base: `http://localhost:${port}/`,
    browser,
    async close() {
      await browser.close()
      await server.close()
    },
  }
}

/** Opens an experiment and waits until the Probe reports it has rendered enough frames. */
export async function openExperiment(session, id, { width, height, wait = 1500 }) {
  const page = await session.browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  const errors = []
  const warnings = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
    else if (m.type() === 'warning') warnings.push(m.text())
  })
  await page.goto(`${session.base}#${id}`)
  await page.addStyleTag({ content: '[data-chrome]{display:none !important}' })
  let ready = true
  try {
    await page.waitForFunction(() => window.__probe?.ready, null, { timeout: 20000 })
  } catch {
    ready = false
  }
  if (ready) await page.waitForTimeout(Number(wait))
  const probe = await page.evaluate(() => {
    const p = window.__probe
    return p ? { renderer: p.renderer, frames: p.frames, frameMs: p.frameMs, calls: p.calls, triangles: p.triangles } : null
  })
  const meta = await page.evaluate(() => window.__meta ?? null)
  return { page, ready, probe, meta, errors, warnings }
}

export async function listExperimentIds(session) {
  const page = await session.browser.newPage()
  await page.goto(session.base)
  const ids = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href').slice(1)).filter(Boolean))
  await page.close()
  return ids
}
