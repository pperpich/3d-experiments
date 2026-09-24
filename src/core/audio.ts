// Tiny synthesized impact sounds — no assets. Shared across experiments.
// An impact = optional filtered-noise burst (the "click/thock" body) + optional
// decaying tone with inharmonic partials (metal ring).

import { prepareContext } from './audioUnlock'

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    prepareContext(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
    const ch = noise.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1
  }
  return ctx
}

export type Impact = {
  gain: number
  noise?: { freq: number; q: number; decay: number }
  tone?: { freq: number; decay: number; partials?: number[] }
}

function envelope(ac: AudioContext, peak: number, decay: number) {
  const g = ac.createGain()
  const t = ac.currentTime
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.0015)
  // Exponential ramps can't reach 0; decay to near-silence over ~5 time constants.
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 5)
  g.connect(ac.destination)
  return g
}

export function playImpact({ gain, noise: n, tone }: Impact) {
  if (gain <= 0.001) return
  const ac = audio()
  const t = ac.currentTime

  if (n) {
    const src = ac.createBufferSource()
    src.buffer = noise
    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = n.freq * (0.96 + Math.random() * 0.08) // tiny variation: no two clicks identical
    filter.Q.value = n.q
    src.connect(filter).connect(envelope(ac, gain, n.decay))
    src.start(t)
    src.stop(t + n.decay * 5 + 0.01)
  }

  if (tone) {
    for (const [i, ratio] of (tone.partials ?? [1]).entries()) {
      const osc = ac.createOscillator()
      osc.frequency.value = tone.freq * ratio
      osc.connect(envelope(ac, (gain * 0.5) / (i + 1), tone.decay / (1 + i * 0.6)))
      osc.start(t)
      osc.stop(t + tone.decay * 5 + 0.01)
    }
  }
}

export function haptic(ms: number) {
  navigator.vibrate?.(ms)
}
