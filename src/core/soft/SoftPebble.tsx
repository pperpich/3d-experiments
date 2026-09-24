import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createChannel, hum, sympathetic, type Hum } from '../softAudio'
import { advance, createState, nudge, press, release, type OrganicEvent, type OrganicState } from './organicModel'
import { createSoftMaterial } from './softMaterial'

const BREATH_PERIOD = 10 // seconds — ~6 breaths/min, the "resonance breathing" rate
const REFERENCE_WIDTH = 0.85 // half-width the soft material's constants were tuned at

/** Superellipsoid: a pebble / cushion. Icosphere base so the top has no pole pinch. */
export function pebbleGeometry(half: THREE.Vector3, detail: number) {
  const ico = new THREE.IcosahedronGeometry(1, detail)
  ico.deleteAttribute('normal')
  ico.deleteAttribute('uv')
  const g = mergeVertices(ico)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  const n = 3.2
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const k = Math.pow(Math.abs(v.x) ** n + Math.abs(v.y) ** n + Math.abs(v.z) ** n, -1 / n)
    v.multiplyScalar(k).multiply(half)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export type PebbleHandle = {
  /** Press at a local point on the top surface (defaults to the centre). */
  press: (x?: number, z?: number) => void
  release: () => void
  /** A neighbour's wave arrives from world-space direction (dx, dz). */
  nudge: (strength: number, dx: number, dz: number) => void
  state: OrganicState
  level: () => number
}

type Props = {
  half: [number, number, number]
  detail?: number
  position?: [number, number, number]
  /** Fixed note. Omitted → notes follow the melodic random walk. */
  freq?: number
  /** Route this pebble's audio through an analyser so its surface vibrates with its sound. */
  resonant?: boolean
  /** Stereo position of this pebble's voice (-1..1). */
  pan?: number
  breathPhase?: number
  onPress?: () => void
  onRelease?: (depth: number, on: boolean) => void
  ref?: Ref<PebbleHandle>
}

// Orbit controls stay off while any pebble is held (multi-touch chords).
let held = 0

export function SoftPebble({ half, detail = 64, position = [0, 0, 0], freq, resonant = false, pan = 0, breathPhase = 0, onPress, onRelease, ref }: Props) {
  const [hx, hy, hz] = half
  const halfV = useMemo(() => new THREE.Vector3(hx, hy, hz), [hx, hy, hz])
  const geometry = useMemo(() => pebbleGeometry(halfV, detail), [halfV, detail])
  const { material, uniforms } = useMemo(createSoftMaterial, [])
  const channel = useMemo(() => (resonant ? createChannel(pan) : undefined), [resonant, pan])
  const mesh = useRef<THREE.Mesh>(null!)
  const body = useRef<THREE.Group>(null!)
  const state = useRef(createState())
  const voice = useRef<Hum | null>(null)
  const pointer = useRef(new THREE.Vector3(0, halfV.y, 0))
  const hovering = useRef(false)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    uniforms.uScale.value = halfV.x / REFERENCE_WIDTH
    // Higher notes vibrate faster and finer. Temporal rate is the note divided down
    // five octaves (f/32) so it stays within what the eye can follow (~4–10 Hz).
    const f = freq ?? 220
    uniforms.uVibOmega.value = (2 * Math.PI * f) / 32
    uniforms.uVibK.value = (20 + f / 10) / Math.sqrt(uniforms.uScale.value)
  }, [uniforms, halfV, freq])

  const handle = (events: OrganicEvent[]) => {
    for (const e of events) {
      if (e.type === 'press') {
        voice.current?.release(e.on, 0)
        voice.current = hum({ freq, channel })
        onPress?.()
      } else {
        voice.current?.release(e.on, e.depth)
        voice.current = null
        onRelease?.(e.depth, e.on)
      }
    }
  }

  const begin = (local: THREE.Vector3) => {
    pointer.current.copy(local)
    uniforms.uContact.value.copy(local)
    uniforms.uVibCenter.value.copy(local)
    const events: OrganicEvent[] = []
    press(state.current, local.x, local.z, events)
    handle(events)
  }
  const end = () => {
    const events: OrganicEvent[] = []
    release(state.current, pointer.current.x, pointer.current.z, events)
    handle(events)
  }

  useImperativeHandle(ref, () => ({
    press: (x = 0, z = 0) => begin(new THREE.Vector3(x, halfV.y, z)),
    release: end,
    nudge: (strength, dx, dz) => {
      // The wave touches the rim on the side facing its source.
      const len = Math.hypot(dx, dz) || 1
      const x = (-dx / len) * halfV.x * 0.75
      const z = (-dz / len) * halfV.z * 0.75
      nudge(state.current, strength, x, z)
      if (!state.current.pressed) uniforms.uVibCenter.value.set(x, halfV.y, z)
      if (freq) sympathetic(freq, 0.12 * strength, channel)
    },
    state: state.current,
    level: () => channel?.level() ?? 0,
  }))

  const toLocal = (p: THREE.Vector3) => mesh.current.worldToLocal(p.clone())

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    held++
    if (controls) controls.enabled = false
    begin(toLocal(e.point))
    const id = e.pointerId
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', up)
      end()
      held = Math.max(0, held - 1)
      if (controls && held === 0) controls.enabled = true
    }
    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)
  }

  useFrame(({ clock }, dt) => {
    const st = state.current
    const events: OrganicEvent[] = []
    advance(st, dt, pointer.current.x, pointer.current.z, events)
    handle(events)

    // The dent trails a dragging finger slightly, like a viscous surface.
    uniforms.uContact.value.lerp(pointer.current, 1 - Math.exp(-12 * dt))
    uniforms.uDepth.value = st.depth
    uniforms.uHover.value.lerp(pointer.current, 1 - Math.exp(-10 * dt))
    uniforms.uHoverAmt.value = THREE.MathUtils.damp(uniforms.uHoverAmt.value, hovering.current && !reducedMotion ? 1 : 0, 4, dt)
    uniforms.uStateMix.value = st.stateMix
    uniforms.uRipples.value.forEach((r, i) => {
      const src = st.ripples[i]
      if (src) r.set(src.x, src.z, src.age, src.amp)
      else r.w = 0
    })
    uniforms.uTime.value = clock.elapsedTime
    // Perceived loudness grows roughly with RMS^0.6 (Stevens), so a quiet sympathetic hum
    // still reads as a visible shimmer. Light smoothing only: track the sound, don't lag it.
    const level = Math.min(1, Math.pow((channel?.level() ?? 0) * 5, 0.6))
    uniforms.uVibAmp.value = THREE.MathUtils.damp(uniforms.uVibAmp.value, reducedMotion ? 0 : level, 30, dt)

    const breath = reducedMotion ? 0 : Math.sin((clock.elapsedTime / BREATH_PERIOD) * Math.PI * 2 + breathPhase)
    uniforms.uBreath.value = breath
    // Whole body: a slow breath, plus a gentle overall give when pressed.
    const b = breath * 0.015 * (1 - 0.7 * Math.max(0, st.depth))
    const squash = Math.max(0, st.depth)
    body.current.scale.set(1 - b * 0.3 + squash * 0.015, 1 + b - squash * 0.05, 1 - b * 0.3 + squash * 0.015)
  })

  return (
    <group ref={body} position={position}>
      <mesh
        ref={mesh}
        geometry={geometry}
        material={material}
        position={[0, halfV.y, 0]}
        castShadow
        receiveShadow
        onPointerDown={onDown}
        onPointerMove={(e) => pointer.current.copy(toLocal(e.point))}
        onPointerOver={() => {
          hovering.current = true
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hovering.current = false
          document.body.style.cursor = ''
        }}
      />
    </group>
  )
}
