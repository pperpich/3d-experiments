import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { SoftPebble, type PebbleHandle } from './SoftPebble'
import { WarmRoom } from './WarmRoom'
import { layout, propagate, PENTATONIC_D, type Arrival } from './cluster'
import { MAX_RINGS, createFloorMaterial } from './floorMaterial'

export const CLUSTER_BG = '#221d1a'
const RING_LIFE = 4

export type ClusterHandle = {
  count: number
  /** Index of the pebble tuned to `freq` (−1 if none). */
  indexOf: (freq: number) => number
  press: (i: number) => void
  release: (i: number) => void
}

declare global {
  interface Window {
    __cluster?: ClusterHandle & {
      depth: (i: number) => number
      level: (i: number) => number
      on: (i: number) => boolean
      /** World position of a pebble's top centre (for scripted touches). */
      top: (i: number) => [number, number, number]
    }
  }
}

function Cluster({ notes, ref }: { notes: number[]; ref?: Ref<ClusterHandle> }) {
  const members = useMemo(() => layout(notes), [notes])
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

  const handle: ClusterHandle = {
    count: members.length,
    indexOf: (freq) => members.findIndex((m) => Math.abs(m.freq - freq) < 0.5),
    press: (i) => pebbles.current[i]?.press(),
    release: (i) => pebbles.current[i]?.release(),
  }
  useImperativeHandle(ref, () => handle)

  useEffect(() => {
    window.__cluster = {
      ...handle,
      depth: (i) => pebbles.current[i]?.state.depth ?? 0,
      level: (i) => pebbles.current[i]?.level() ?? 0,
      on: (i) => pebbles.current[i]?.state.on ?? false,
      top: (i) => [members[i].x, members[i].r * 0.72, members[i].z],
    }
    return () => {
      delete window.__cluster
    }
  })

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

/**
 * Keeps the whole cluster in frame on any aspect ratio (portrait phones especially):
 * on resize, slides the camera along its current view direction until the cluster's
 * width fits the horizontal field of view. It never moves closer than `minDistance`, so
 * landscape screens keep the authored framing. Fog follows, so it only ever hides the
 * horizon and never the cluster.
 */
function FitCluster({ halfWidth, target, minDistance }: { halfWidth: number; target: THREE.Vector3; minDistance: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)
  const fog = useThree((s) => s.scene.fog) as THREE.Fog | null
  useEffect(() => {
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect
    const distance = Math.max(minDistance, halfWidth / tanH)
    const dir = camera.position.clone().sub(target).normalize()
    camera.position.copy(target).addScaledVector(dir, distance)
    camera.updateProjectionMatrix()
    if (fog) {
      fog.near = distance + 1
      fog.far = distance + 9
    }
  }, [camera, aspect, halfWidth, target, minDistance, fog])
  return null
}

const TARGET = new THREE.Vector3(0, 0.1, 0)

/** Everything inside the <Stage> for a soft cluster: room, fog, pebbles, floor, controls. */
export function SoftClusterScene({ notes = PENTATONIC_D, ref }: { notes?: number[]; ref?: Ref<ClusterHandle> }) {
  return (
    <>
      <color attach="background" args={[CLUSTER_BG]} />
      <fog attach="fog" args={[CLUSTER_BG, 6.1, 14.1]} />
      <WarmRoom shadowExtent={2.5} />
      <Cluster notes={notes} ref={ref} />
      {/* Cluster extent is ~1.7 in radius; the margin keeps rings and shadows in frame too. */}
      <FitCluster halfWidth={1.9} target={TARGET} minDistance={5.1} />
      <ContactShadows frames={1} position={[0, 0.002, 0]} opacity={0.75} color="#0d0a08" scale={7} blur={2.4} far={0.8} resolution={512} />
      <OrbitControls makeDefault target={TARGET} enablePan={false} minDistance={2.5} maxDistance={16} minPolarAngle={0.2} maxPolarAngle={1.3} />
    </>
  )
}
