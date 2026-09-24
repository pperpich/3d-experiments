// Soft tonal voice for organic interactions — no assets.
// Design rules: attacks >= 10ms (no transients), energy below ~1.5kHz, notes from a
// pentatonic scale (any two are consonant), light detune for warmth, a synthesized
// room reverb for a sense of space.

let ctx: AudioContext | null = null
let dry: GainNode
let wet: GainNode

// D major pentatonic, D3–D4.
const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66]
let degree = 3

function roomImpulse(ac: AudioContext, seconds: number) {
  const len = Math.floor(ac.sampleRate * seconds)
  const ir = ac.createBuffer(2, len, ac.sampleRate)
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      // One-pole lowpass on the noise: a warm, dark room rather than a bright hall.
      lp += 0.25 * (Math.random() * 2 - 1 - lp)
      ch[i] = lp * Math.pow(1 - i / len, 3)
    }
  }
  return ir
}

function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    dry = ctx.createGain()
    dry.gain.value = 0.8
    dry.connect(master)
    const reverb = ctx.createConvolver()
    reverb.buffer = roomImpulse(ctx, 2.4)
    wet = ctx.createGain()
    wet.gain.value = 0.45
    wet.connect(reverb).connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function out(ac: AudioContext) {
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  lp.Q.value = 0.3
  lp.connect(dry)
  lp.connect(wet)
  return lp
}

/**
 * A voice's own path to the mix, with an analyser: `level()` is the RMS of what this
 * channel is actually sounding right now — used to make surfaces vibrate as they sound.
 */
export type Channel = { node: () => AudioNode; level: () => number }

/**
 * `pan` (-1..1) places the voice where its source appears on screen — the ventriloquist
 * effect: sound and image bind into one event far more strongly when they co-locate.
 */
export function createChannel(pan = 0): Channel {
  let input: GainNode | null = null
  let analyser: AnalyserNode | null = null
  const buf = new Float32Array(512)
  return {
    node() {
      if (!input) {
        const ac = audio()
        input = ac.createGain()
        analyser = ac.createAnalyser()
        analyser.fftSize = buf.length
        const panner = ac.createStereoPanner()
        panner.pan.value = pan
        input.connect(panner).connect(out(ac))
        input.connect(analyser)
      }
      return input
    },
    level() {
      if (!analyser) return 0
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      return Math.sqrt(sum / buf.length)
    },
  }
}

/** Random walk of ±1 scale step: successive presses form a gentle, coherent melody. */
function nextNote() {
  degree = Math.max(0, Math.min(SCALE.length - 1, degree + (Math.random() < 0.5 ? -1 : 1)))
  return SCALE[degree]
}

export type Hum = { release: (on: boolean, depth: number) => void }

/**
 * Starts a soft hum that swells while held. Call `release` to let it go.
 * Without `freq`, notes follow the melodic random walk.
 */
export function hum(opts: { freq?: number; channel?: Channel } = {}): Hum {
  const ac = audio()
  const t = ac.currentTime
  const f = opts.freq ?? nextNote()
  const bus = opts.channel ? opts.channel.node() : out(ac)
  const env = ac.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(0.22, t + 0.06)
  env.gain.setTargetAtTime(0.14, t + 0.06, 0.8)
  env.connect(bus)

  // Fundamental + a slightly detuned copy (slow beating = warmth) + a quiet octave.
  const oscs = [
    { ratio: 1, detune: 0, gain: 1 },
    { ratio: 1, detune: 4, gain: 0.6 },
    { ratio: 2, detune: -3, gain: 0.12 },
  ].map(({ ratio, detune, gain }) => {
    const o = ac.createOscillator()
    // A small downward glide into the note reads as a sigh rather than a beep.
    o.frequency.setValueAtTime(f * ratio * 1.03, t)
    o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.16)
    o.detune.value = detune
    const g = ac.createGain()
    g.gain.value = gain
    o.connect(g).connect(env)
    o.start(t)
    return o
  })

  breath(ac, bus, 0.05)

  return {
    release(on, depth) {
      const now = ac.currentTime
      env.gain.cancelScheduledValues(now)
      env.gain.setValueAtTime(env.gain.value, now)
      env.gain.setTargetAtTime(0, now, 0.25)
      for (const o of oscs) o.stop(now + 2)
      // Resolution: up a fifth when turning on, down a fourth when turning off.
      bloom(ac, bus, on ? f * 1.5 : f * 0.75, 0.12 + depth * 0.1)
    },
  }
}

/** A quiet answering tone, like a string resonating in sympathy with a neighbour. */
export function sympathetic(freq: number, gain: number, channel?: Channel) {
  if (gain < 0.002) return
  const ac = audio()
  const t = ac.currentTime
  const bus = channel ? channel.node() : out(ac)
  const env = ac.createGain()
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(gain, t + 0.08)
  env.gain.setTargetAtTime(0, t + 0.08, 0.5)
  env.connect(bus)
  for (const detune of [0, 5]) {
    const o = ac.createOscillator()
    o.frequency.value = freq
    o.detune.value = detune
    o.connect(env)
    o.start(t)
    o.stop(t + 3.5)
  }
}

function bloom(ac: AudioContext, bus: AudioNode, f: number, gain: number) {
  const t = ac.currentTime
  for (const [ratio, g, decay] of [[1, 1, 0.9], [3, 0.08, 0.35]] as const) {
    const o = ac.createOscillator()
    o.frequency.value = f * ratio
    const e = ac.createGain()
    e.gain.setValueAtTime(0, t)
    e.gain.linearRampToValueAtTime(gain * g, t + 0.012)
    e.gain.setTargetAtTime(0, t + 0.012, decay)
    o.connect(e).connect(bus)
    o.start(t)
    o.stop(t + decay * 6)
  }
}

/** A faint low "whoosh" of air/water — gives the touch a soft physical body. */
function breath(ac: AudioContext, bus: AudioNode, gain: number) {
  const t = ac.currentTime
  const len = Math.floor(ac.sampleRate * 0.5)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 500
  const e = ac.createGain()
  e.gain.setValueAtTime(0, t)
  e.gain.linearRampToValueAtTime(gain, t + 0.05)
  e.gain.setTargetAtTime(0, t + 0.05, 0.09)
  src.connect(lp).connect(e).connect(bus)
  src.start(t)
}
