// "Amazing Grace" — tune NEW BRITAIN (traditional, public domain), 3/4, in D major.
// Pure TS with no imports, so it also runs under plain `node`.
//
// The melody needs exactly six notes, all in D major pentatonic: A3 B3 D4 E4 F♯4 A4.
// A low D3 drone underneath makes seven — one pebble each.

export const NOTE = {
  D3: 146.83,
  A3: 220.0,
  B3: 246.94,
  D4: 293.66,
  E4: 329.63,
  'F#4': 369.99,
  A4: 440.0,
} as const

type Name = keyof typeof NOTE

/** Ascending, one pebble per note. The drone (lowest) becomes the big centre pebble. */
export const TUNING = Object.values(NOTE)

// [note, beats]. Lyrics shown for orientation; the pickup "A-" is beat 0.
const MELODY: [Name, number][] = [
  ['A3', 1], //                                   A-
  ['D4', 2], ['F#4', 0.5], ['D4', 0.5], //        ma - zing
  ['F#4', 2], ['E4', 1], //                       grace, how
  ['D4', 2], ['B3', 1], //                        sweet the
  ['A3', 2], ['A3', 1], //                        sound, that
  ['D4', 2], ['F#4', 0.5], ['D4', 0.5], //        saved a
  ['F#4', 2], ['E4', 1], //                       wretch like
  ['A4', 5], //                                   me
  ['F#4', 1], //                                  I
  ['A4', 2], ['F#4', 0.5], ['A4', 0.5], //        once was
  ['F#4', 2], ['D4', 1], //                       lost, but
  ['A3', 2], ['B3', 1], //                        now am
  ['D4', 2], ['B3', 1], //                        found, was
  ['A3', 2], ['A3', 1], //                        blind, but
  ['D4', 2], ['F#4', 0.5], ['D4', 0.5], //        now I
  ['F#4', 2], ['E4', 1], //                       see ...
  ['D4', 3], //                                   (home)
]

// Drone on D3: re-pressed at the start of each four-bar phrase (bar n starts at beat 1 + 3(n−1)).
const DRONE: [number, number][] = [
  [1, 11.5],
  [13, 11.5],
  [25, 11.5],
  [37, 12],
]

export type Cue = { t: number; type: 'press' | 'release'; freq: number }

/**
 * Seconds-timed press/release cues. Notes are held for their length minus a small gap,
 * so repeated notes re-articulate and lines stay legato.
 */
export function cues(bpm = 72): Cue[] {
  const beat = 60 / bpm
  const gap = 0.07
  const out: Cue[] = []
  let at = 0
  for (const [name, beats] of MELODY) {
    const hold = Math.max(0.2, beats * beat - gap)
    out.push({ t: at * beat, type: 'press', freq: NOTE[name] })
    out.push({ t: at * beat + hold, type: 'release', freq: NOTE[name] })
    at += beats
  }
  for (const [start, beats] of DRONE) {
    out.push({ t: start * beat, type: 'press', freq: NOTE.D3 })
    out.push({ t: (start + beats) * beat - gap, type: 'release', freq: NOTE.D3 })
  }
  return out.sort((a, b) => a.t - b.t)
}

export const TOTAL_BEATS = MELODY.reduce((a, [, b]) => a + b, 0)
