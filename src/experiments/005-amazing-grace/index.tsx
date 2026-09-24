import { useEffect, useRef, useState } from 'react'
import { Stage } from '../../core/Stage'
import { SoftClusterScene, type ClusterHandle } from '../../core/soft/SoftCluster'
import { audioTime } from '../../core/softAudio'
import { TUNING, cues } from './song'

const BPM = 72
const LEAD_IN = 0.4 // seconds between pressing Play and the first note
const TAIL = 3 // let the last note and its answers ring out

declare global {
  interface Window {
    __grace?: {
      play: () => void
      stop: () => void
      /** How late each fired cue was vs. its scheduled time (seconds). */
      lateness: () => number[]
    }
  }
}

/**
 * Plays cues against the audio clock, polled every animation frame. A cue fires on the
 * first frame at or after its time (≤ one frame late, ~16ms), which the soft ~60ms attacks
 * mask. Press and release go through the same path as a finger, so visuals and sound
 * stay one event.
 */
function usePlayer(cluster: React.RefObject<ClusterHandle | null>) {
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  const held = useRef(new Set<number>())
  const late = useRef<number[]>([])

  const stop = () => {
    cancelAnimationFrame(raf.current)
    for (const i of held.current) cluster.current?.release(i)
    held.current.clear()
    setPlaying(false)
  }

  const play = () => {
    const c = cluster.current
    if (!c) return
    stop()
    const list = cues(BPM)
    const start = audioTime() + LEAD_IN
    const end = list[list.length - 1].t + TAIL
    let next = 0
    late.current = []
    setPlaying(true)
    const tick = () => {
      const t = audioTime() - start
      while (next < list.length && list[next].t <= t) {
        const cue = list[next++]
        const i = c.indexOf(cue.freq)
        late.current.push(t - cue.t)
        if (cue.type === 'press') {
          c.press(i)
          held.current.add(i)
        } else {
          c.release(i)
          held.current.delete(i)
        }
      }
      if (t < end) raf.current = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf.current = requestAnimationFrame(tick)
  }

  // Re-registered each render so the hook sees fresh closures. Teardown lives in its own
  // unmount-only effect: cleanup here would run on every render and cancel playback.
  useEffect(() => {
    window.__grace = { play, stop, lateness: () => late.current }
  })
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      delete window.__grace
    },
    [],
  )

  return { playing, play, stop }
}

export default function AmazingGrace() {
  const cluster = useRef<ClusterHandle>(null)
  const { playing, play, stop } = usePlayer(cluster)

  return (
    <>
      <Stage renderer="webgl" camera={{ position: [0, 3.4, 3.9], fov: 34 }}>
        <SoftClusterScene notes={TUNING} ref={cluster} />
      </Stage>
      <button style={button} onClick={playing ? stop : play}>
        {playing ? '■  Stop' : '▶  Play Amazing Grace'}
      </button>
      <div data-chrome style={hint}>
        play along · press any pebble while it plays
      </div>
    </>
  )
}

const button: React.CSSProperties = {
  position: 'absolute',
  top: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '10px 20px',
  borderRadius: 999,
  border: '1px solid #4a3f37',
  background: 'rgba(58, 50, 44, 0.7)',
  color: '#f1e4d6',
  fontSize: 14,
  letterSpacing: 0.6,
  fontFamily: 'inherit',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
}

const hint: React.CSSProperties = {
  position: 'absolute',
  bottom: 20,
  width: '100%',
  textAlign: 'center',
  fontSize: 12,
  letterSpacing: 1.2,
  color: '#8a8078',
  pointerEvents: 'none',
}
