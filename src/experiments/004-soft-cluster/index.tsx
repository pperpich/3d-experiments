import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Stage } from '../../core/Stage'
import { SoftPebble, type PebbleHandle } from '../../core/soft/SoftPebble'
import { WarmRoom } from '../../core/soft/WarmRoom'
import { layout, propagate, type Arrival } from './cluster'
import { MAX_RINGS, createFloorMaterial } from './floorMaterial'

const members = layout()
const RING_LIFE = 4
const BG = '#221d1a'

declare global {
  interface Window {
    __cluster?: {
      count: number
      press: (i: number) => void
      release: (i: number) => void
      depth: (i: number) => number
      level: (i: number) => number
    }
  }
}

function Cluster() {
  const pebbles = useRef<(PebbleHandle | null)[]>([])
  const pending = useRef<Arrival[]>([])
  const rings = useRef<{ x: number; z: number; age: number; amp: number }[]>([])
  const now = useRef(0)
  const floor = useMemo(createFloorMaterial, [])

  // A touch sends a wave across the shared surface. Neighbours respond when it arrives;
  // they don't re-emit, so the cluster answers but never feeds back on itself.
  const emit = (i: number, energy: number) => {
    const m = members[i]
    pending.current.push(...propagate(members, i, energy, now.current))
    rings.current.push({ x: m.x, z: m.z, age: 0, amp: energy })
    if (rings.current.length > MAX_RINGS) rings.current.shift()
  }

  useEffect(() => {
    window.__cluster = {
      count: members.length,
      press: (i) => pebbles.current[i]?.press(),
      release: (i) => pebbles.current[i]?.release(),
      depth: (i) => pebbles.current[i]?.state.depth ?? 0,
      level: (i) => pebbles.current[i]?.level() ?? 0,
    }
    return () => {
      delete window.__cluster
    }
  }, [])

  useFrame((_, dt) => {
    // One clamped clock for both rings and arrivals, so a frame hitch can't desync them.
    const step = Math.min(dt, 0.1)
    now.current += step
    const due = pending.current.filter((a) => a.at <= now.current)
    if (due.length) {
      pending.current = pending.current.filter((a) => a.at > now.current)
      for (const a of due) pebbles.current[a.target]?.nudge(a.strength, a.dx, a.dz)
    }

    for (const r of rings.current) r.age += step
    rings.current = rings.current.filter((r) => r.age < RING_LIFE)
    floor.uniforms.uRings.value.forEach((u, i) => {
      const r = rings.current[i]
      if (r) u.set(r.x, r.z, r.age, r.amp)
      else u.w = 0
    })
  })

  return (
    <>
      {members.map((m, i) => (
        <SoftPebble
          key={i}
          ref={(h) => {
            pebbles.current[i] = h
          }}
          half={[m.r, m.r * 0.36, m.r]}
          detail={36}
          position={[m.x, 0, m.z]}
          freq={m.freq}
          resonant
          pan={Math.max(-0.8, Math.min(0.8, m.x / 1.6))}
          // The breath travels outward from the centre as a slow wave.
          breathPhase={-Math.hypot(m.x, m.z) * 1.2}
          onPress={() => emit(i, 0.5)}
          onRelease={(depth) => emit(i, 0.5 + depth * 0.7)}
        />
      ))}
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={floor.material}>
        <planeGeometry args={[40, 40]} />
      </mesh>
    </>
  )
}

export default function SoftCluster() {
  return (
    <>
      <Stage renderer="webgl" camera={{ position: [0, 3.4, 3.9], fov: 34 }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 6, 14]} />
        <WarmRoom shadowExtent={2.5} />
        <Cluster />
        <ContactShadows frames={1} position={[0, 0.002, 0]} opacity={0.75} color="#0d0a08" scale={7} blur={2.4} far={0.8} resolution={512} />
        <OrbitControls makeDefault target={[0, 0.1, 0]} enablePan={false} minDistance={2.5} maxDistance={8} minPolarAngle={0.2} maxPolarAngle={1.3} />
      </Stage>
      <div data-chrome style={hint}>
        press · hold · let go · several fingers make chords
      </div>
    </>
  )
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
