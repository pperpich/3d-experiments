// Organic touch model. Pure TS with no imports, so it also runs under plain `node`.
//
// Mechanical switches are defined by hard stops and force discontinuities. This model
// is defined by their absence: depth follows a cascade of two springs, so position,
// velocity AND acceleration stay continuous (low jerk, like human reaching motion).
// Holding keeps sinking asymptotically; release recovers slower, with one soft overshoot.

export type Ripple = { x: number; z: number; age: number; amp: number }

export type OrganicState = {
  pressed: boolean
  releaseQueued: boolean
  hold: number
  /** Intermediate spring stage: it smooths the target before depth follows it. */
  s1: number
  v1: number
  depth: number
  v: number
  on: boolean
  /** 0..1 crossfade of the on-state inner warmth. */
  stateMix: number
  ripples: Ripple[]
}

export type OrganicEvent = { type: 'press' | 'release'; on: boolean; depth: number }

export const PARAMS = {
  press: { omega1: 14, omega2: 18, zeta2: 1 },
  release: { omega1: 9, omega2: 7, zeta2: 0.62 },
  /** Depth reached quickly, then the rest is approached with time constant sinkTau while held. */
  sinkBase: 0.4,
  sinkTau: 0.9,
  /** A click shorter than this still gets a full, satisfying press. */
  minHold: 0.18,
  stateRate: 2.2,
  rippleLife: 2.6,
  maxRipples: 4,
}

export const createState = (): OrganicState => ({
  pressed: false,
  releaseQueued: false,
  hold: 0,
  s1: 0,
  v1: 0,
  depth: 0,
  v: 0,
  on: false,
  stateMix: 0,
  ripples: [],
})

function addRipple(st: OrganicState, x: number, z: number, amp: number) {
  st.ripples.push({ x, z, age: 0, amp })
  if (st.ripples.length > PARAMS.maxRipples) st.ripples.shift()
}

export function press(st: OrganicState, x: number, z: number, events: OrganicEvent[]) {
  st.pressed = true
  st.releaseQueued = false
  st.hold = 0
  addRipple(st, x, z, 0.35)
  events.push({ type: 'press', on: st.on, depth: st.depth })
}

export function release(st: OrganicState, x: number, z: number, events: OrganicEvent[]) {
  if (!st.pressed) return
  if (st.hold < PARAMS.minHold) {
    st.releaseQueued = true
    return
  }
  st.pressed = false
  st.releaseQueued = false
  st.on = !st.on
  addRipple(st, x, z, 0.4 + st.depth * 0.6)
  events.push({ type: 'release', on: st.on, depth: st.depth })
}

/**
 * A soft push from outside (a neighbour's wave arriving). Kicks the smoothing stage,
 * so the surface bobs gently without jerk and without counting as a press.
 */
export function nudge(st: OrganicState, strength: number, x: number, z: number) {
  st.v1 += strength * 6
  addRipple(st, x, z, 0.25 * strength)
}

export function sinkTarget(hold: number) {
  return PARAMS.sinkBase + (1 - PARAMS.sinkBase) * (1 - Math.exp(-hold / PARAMS.sinkTau))
}

export function step(st: OrganicState, dt: number) {
  if (st.pressed) st.hold += dt
  const target = st.pressed ? sinkTarget(st.hold) : 0
  const p = st.pressed ? PARAMS.press : PARAMS.release

  // Stage 1 is critically damped, so it never overshoots; stage 2 adds the release "exhale".
  st.v1 += (p.omega1 ** 2 * (target - st.s1) - 2 * p.omega1 * st.v1) * dt
  st.s1 += st.v1 * dt
  st.v += (p.omega2 ** 2 * (st.s1 - st.depth) - 2 * p.zeta2 * p.omega2 * st.v) * dt
  st.depth += st.v * dt

  st.stateMix += ((st.on ? 1 : 0) - st.stateMix) * (1 - Math.exp(-PARAMS.stateRate * dt))
  for (const r of st.ripples) r.age += dt
  st.ripples = st.ripples.filter((r) => r.age < PARAMS.rippleLife)
}

/** Fixed substeps; also fires a queued release once the minimum hold has elapsed. */
export function advance(st: OrganicState, frameDt: number, x: number, z: number, events: OrganicEvent[]) {
  const SUB = 1 / 240
  let t = Math.min(frameDt, 1 / 20)
  while (t > 1e-6) {
    const h = Math.min(SUB, t)
    step(st, h)
    t -= h
  }
  if (st.releaseQueued && st.hold >= PARAMS.minHold) {
    st.releaseQueued = false
    release(st, x, z, events)
  }
}
