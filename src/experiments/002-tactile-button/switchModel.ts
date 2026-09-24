// Force-driven switch model. Pure TS with no imports, so it also runs under plain `node`.
//
// The finger applies a force that ramps up over a few ms; the switch pushes back with
// its force curve. A curve with a bump (peak then drop) makes the snap-through emerge
// from the dynamics instead of being keyframed — that is where the "tactile" feel lives.
//
// Units: depth `d` is normalized travel (0 = rest, 1 = bottom-out); forces are unitless.

export type SwitchSpec = {
  /** World units for full travel (visual only). */
  travel: number
  /** Force → acceleration. Higher = lighter moving mass, faster travel. */
  gain: number
  /** Viscous damping (lube / air). */
  damping: number
  preload: number
  stiffness: number
  curve: 'linear' | 'quadratic'
  bump?: { at: number; width: number; height: number }
  actuateAt: number
  fingerForce: number
  /** Seconds for the finger to reach full force. */
  fingerRamp: number
  /** End-stop penalty springs: k = hardness, c = energy loss on impact. */
  bottom: { k: number; c: number }
  top: { k: number; c: number }
}

export type SwitchState = {
  d: number
  v: number
  finger: number
  pressed: boolean
  releaseQueued: boolean
  actuated: boolean
}

export type SwitchEvent = { type: 'actuate' | 'reset' | 'bottom' | 'top'; speed: number }

export const createState = (): SwitchState => ({
  d: 0,
  v: 0,
  finger: 0,
  pressed: false,
  releaseQueued: false,
  actuated: false,
})

export function springForce(s: SwitchSpec, d: number) {
  let f = s.preload + s.stiffness * (s.curve === 'quadratic' ? d * Math.abs(d) : d)
  if (s.bump) f += s.bump.height * Math.exp(-(((d - s.bump.at) / s.bump.width) ** 2))
  return f
}

export function press(st: SwitchState) {
  st.pressed = true
  st.releaseQueued = false
}

/** A quick mouse click still completes a full keystroke: release waits for full finger force. */
export function release(s: SwitchSpec, st: SwitchState) {
  if (st.finger < s.fingerForce * 0.98) st.releaseQueued = true
  else st.pressed = false
}

/** Below this speed a stop contact is resting pressure, not an audible impact. */
const MIN_IMPACT = 1

export function step(s: SwitchSpec, st: SwitchState, dt: number, events: SwitchEvent[]) {
  const target = st.pressed ? s.fingerForce : 0
  const rate = s.fingerForce / s.fingerRamp
  // Fingers lift off faster than they press.
  st.finger += Math.max(-rate * dt * 2, Math.min(rate * dt, target - st.finger))
  if (st.releaseQueued && st.finger >= s.fingerForce * 0.98) {
    st.pressed = false
    st.releaseQueued = false
  }

  let f = st.finger - springForce(s, st.d)
  if (st.d > 1) f -= s.bottom.k * (st.d - 1) + s.bottom.c * st.v
  if (st.d < 0) f -= s.top.k * st.d + s.top.c * st.v

  const prev = st.d
  st.v += (s.gain * f - s.damping * st.v) * dt
  st.d += st.v * dt

  if (prev <= 1 && st.d > 1 && st.v > MIN_IMPACT) events.push({ type: 'bottom', speed: st.v })
  if (prev >= 0 && st.d < 0 && st.v < -MIN_IMPACT) events.push({ type: 'top', speed: -st.v })
  if (!st.actuated && st.d >= s.actuateAt) {
    st.actuated = true
    events.push({ type: 'actuate', speed: st.v })
  } else if (st.actuated && st.d < s.actuateAt - 0.15) {
    st.actuated = false
    events.push({ type: 'reset', speed: -st.v })
  }
}

/** Fixed substeps keep the stiff end-stop springs stable at any frame rate. */
export function advance(s: SwitchSpec, st: SwitchState, frameDt: number, events: SwitchEvent[]) {
  const SUB = 1 / 960
  let t = Math.min(frameDt, 1 / 20)
  while (t > 1e-6) {
    const h = Math.min(SUB, t)
    step(s, st, h, events)
    t -= h
  }
}

export const SPECS = {
  // Brown-style mechanical key: pronounced bump, crisp click, hard plastic bottom-out.
  tactile: {
    travel: 0.16, gain: 900, damping: 10,
    preload: 0.35, stiffness: 0.5, curve: 'linear',
    bump: { at: 0.3, width: 0.09, height: 0.55 },
    actuateAt: 0.4, fingerForce: 1.3, fingerRamp: 0.05,
    bottom: { k: 60, c: 0.35 }, top: { k: 60, c: 0.3 },
  },
  // Silicone membrane: progressive, no bump, lossy — it compresses rather than travels.
  silicone: {
    travel: 0.2, gain: 350, damping: 14,
    preload: 0.15, stiffness: 1.1, curve: 'quadratic',
    actuateAt: 0.7, fingerForce: 1.3, fingerRamp: 0.12,
    bottom: { k: 8, c: 0.35 }, top: { k: 20, c: 0.4 },
  },
  // Metal snap dome: very short travel, strong buckle, hard metal stops.
  metal: {
    travel: 0.05, gain: 1600, damping: 8,
    preload: 0.5, stiffness: 0.3, curve: 'linear',
    bump: { at: 0.35, width: 0.12, height: 0.9 },
    actuateAt: 0.45, fingerForce: 1.6, fingerRamp: 0.04,
    bottom: { k: 120, c: 0.3 }, top: { k: 120, c: 0.3 },
  },
} satisfies Record<string, SwitchSpec>
