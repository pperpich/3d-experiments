// Mobile audio unlock, shared by every audio module.
//
// iOS has two separate gates on Web Audio:
//  1. Autoplay: a context only starts inside certain user gestures (historically
//     touchend/click, not always pointerdown). We retry on several gesture types.
//  2. The ring/silent switch mutes Web Audio by default. `navigator.audioSession.type =
//     'playback'` opts out (Safari 17+, secure contexts only). Elsewhere — e.g. a phone
//     on the plain-http LAN dev server — a looping silent <audio> element does the same.

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const

let keepAlive: HTMLAudioElement | null = null

/** 0.1s of silence as a 8kHz mono 8-bit WAV. */
function silentWav() {
  const samples = 800
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 8000, true)
  view.setUint32(28, 8000, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  bytes.fill(128, 44) // 8-bit PCM silence is 128
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

function bypassSilentSwitch() {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) {
    try {
      session.type = 'playback'
      return
    } catch {
      // fall through to the <audio> fallback
    }
  }
  // Only phones/tablets have a silent switch; on desktop the element could surface in
  // the OS media controls as "now playing".
  if (navigator.maxTouchPoints === 0) return
  if (!keepAlive) {
    keepAlive = new Audio(silentWav())
    keepAlive.loop = true
    keepAlive.setAttribute('playsinline', '')
  }
  if (keepAlive.paused) void keepAlive.play().catch(() => {})
}

export function prepareContext(ctx: AudioContext) {
  const unlock = () => {
    bypassSilentSwitch()
    if (ctx.state !== 'running') void ctx.resume()
    // Starting a one-sample buffer inside the gesture fully unlocks older iOS.
    const src = ctx.createBufferSource()
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    src.connect(ctx.destination)
    src.start()
    if (ctx.state === 'running') for (const g of GESTURES) removeEventListener(g, unlock, true)
  }
  for (const g of GESTURES) addEventListener(g, unlock, { capture: true, passive: true })
  unlock()
}
