// Cluster layout and coupling. Pure TS with no imports, so it also runs under plain `node`.

export type Member = { x: number; z: number; r: number; freq: number }

/** D major pentatonic, D3–E4: the default tuning. */
export const PENTATONIC_D = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63]
// Sizes by rank, largest first. Bigger bodies sound lower, as in physical instruments.
const RADII = [0.56, 0.5, 0.46, 0.42, 0.39, 0.35, 0.32]
const GAP = 0.14

/**
 * `notes` in ascending order (up to 7): the lowest becomes the largest body, at the centre.
 * Others go on a golden-angle spiral, then are relaxed until nothing overlaps.
 */
export function layout(notes: number[] = PENTATONIC_D): Member[] {
  if (notes.length > RADII.length) throw new Error(`layout supports up to ${RADII.length} notes`)
  const m = notes.map((freq, i) => {
    const a = i * 2.39996
    const d = i === 0 ? 0 : 0.9 * Math.sqrt(i)
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: RADII[i], freq }
  })
  for (let iter = 0; iter < 300; iter++) {
    for (let i = 0; i < m.length; i++) {
      for (let j = i + 1; j < m.length; j++) {
        const dx = m[j].x - m[i].x
        const dz = m[j].z - m[i].z
        const d = Math.hypot(dx, dz) || 1e-6
        const min = m[i].r + m[j].r + GAP
        if (d < min) {
          const push = (min - d) / 2
          m[i].x -= (dx / d) * push
          m[i].z -= (dz / d) * push
          m[j].x += (dx / d) * push
          m[j].z += (dz / d) * push
        }
      }
      // A gentle pull toward the centre keeps the cluster compact.
      if (i > 0) {
        m[i].x *= 0.995
        m[i].z *= 0.995
      }
    }
  }
  const cx = m.reduce((a, p) => a + p.x, 0) / m.length
  const cz = m.reduce((a, p) => a + p.z, 0) / m.length
  for (const p of m) {
    p.x -= cx
    p.z -= cz
  }
  return m
}

/** How strongly two pentatonic notes resonate together. Simple ratios ring most. */
export function consonance(fa: number, fb: number) {
  let ratio = Math.max(fa, fb) / Math.min(fa, fb)
  while (ratio >= 2 - 1e-3) ratio /= 2
  const semis = Math.round(12 * Math.log2(ratio))
  return ({ 0: 1, 7: 0.85, 5: 0.75, 4: 0.6, 9: 0.6, 2: 0.3 } as Record<number, number>)[semis] ?? 0.2
}

/** Visible wave speed across the shared surface — slow enough for the eye to follow the cause. */
export const WAVE_SPEED = 1.6

export type Arrival = { at: number; target: number; strength: number; dx: number; dz: number }

/**
 * When member `src` releases energy, schedule when and how strongly the wave reaches each
 * neighbour. Arrival = when the floor ring (emitted at the source centre) reaches the
 * neighbour's near edge, so the sound, the dip and the visible wave coincide.
 */
export function propagate(members: Member[], src: number, energy: number, now: number): Arrival[] {
  const s = members[src]
  return members.flatMap((m, i) => {
    if (i === src) return []
    const dx = m.x - s.x
    const dz = m.z - s.z
    const centre = Math.hypot(dx, dz)
    const edge = Math.max(0, centre - s.r)
    const strength = energy * Math.exp(-edge / 1.1) * consonance(s.freq, m.freq)
    if (strength < 0.03) return []
    return [{ at: now + Math.max(0, centre - m.r) / WAVE_SPEED, target: i, strength, dx, dz }]
  })
}
