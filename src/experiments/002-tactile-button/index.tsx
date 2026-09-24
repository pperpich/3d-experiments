import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { Stage } from '../../core/Stage'
import { haptic, playImpact, type Impact } from '../../core/audio'
import {
  SPECS, advance, createState, press, release,
  type SwitchEvent, type SwitchSpec, type SwitchState,
} from './switchModel'

type Kind = keyof typeof SPECS

const PLATE_TOP = 0.16
const loudness = (speed: number) => Math.min(1, speed / 30)

// What each event sounds like per material. Impact loudness follows simulated speed.
const SOUNDS: Record<Kind, Partial<Record<SwitchEvent['type'], (speed: number) => Impact>>> = {
  tactile: {
    actuate: () => ({ gain: 0.35, noise: { freq: 4200, q: 5, decay: 0.004 }, tone: { freq: 2400, decay: 0.006 } }),
    bottom: (s) => ({ gain: loudness(s) * 0.6, noise: { freq: 1300, q: 1.4, decay: 0.012 } }),
    top: (s) => ({ gain: loudness(s) * 0.45, noise: { freq: 2600, q: 2, decay: 0.008 } }),
  },
  silicone: {
    bottom: (s) => ({ gain: loudness(s) * 0.5, noise: { freq: 380, q: 0.8, decay: 0.02 }, tone: { freq: 130, decay: 0.03 } }),
    top: (s) => ({ gain: loudness(s) * 0.15, noise: { freq: 700, q: 1, decay: 0.01 } }),
  },
  metal: {
    actuate: () => ({ gain: 0.3, noise: { freq: 7000, q: 3, decay: 0.002 }, tone: { freq: 2900, decay: 0.09, partials: [1, 2.76, 5.4] } }),
    bottom: (s) => ({ gain: loudness(s) * 0.25, noise: { freq: 5000, q: 4, decay: 0.003 } }),
    top: (s) => ({ gain: loudness(s) * 0.3, tone: { freq: 3300, decay: 0.05, partials: [1, 2.76] } }),
  },
}

// Programmatic access for scripts: window.__buttons.press(0) / .release(0)
type Handle = { spec: SwitchSpec; state: SwitchState }
const handles: Handle[] = []
declare global {
  interface Window {
    __buttons?: { press: (i: number) => void; release: (i: number) => void; depth: (i: number) => number }
  }
}

function Button({ kind, index, x }: { kind: Kind; index: number; x: number }) {
  const spec = SPECS[kind] as SwitchSpec
  const state = useRef(createState())
  const moving = useRef<THREE.Group>(null!)
  const led = useRef<THREE.MeshStandardMaterial>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const on = useRef(false)
  const glow = useRef(0)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null

  useEffect(() => {
    handles[index] = { spec, state: state.current }
  }, [index, spec])

  useFrame((_, dt) => {
    const events: SwitchEvent[] = []
    advance(spec, state.current, dt, events)
    for (const e of events) {
      const sound = SOUNDS[kind][e.type]
      if (sound) playImpact(sound(e.speed))
      if (e.type === 'actuate') {
        on.current = !on.current
        haptic(8)
      }
    }
    POSE[kind](Math.max(-0.05, state.current.d), moving.current)

    glow.current = THREE.MathUtils.damp(glow.current, on.current ? 1 : 0, 40, dt)
    led.current.emissiveIntensity = glow.current * 6
    light.current.intensity = glow.current * 0.35
  })

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    press(state.current)
    addEventListener(
      'pointerup',
      () => {
        release(spec, state.current)
        if (controls) controls.enabled = true
      },
      { once: true },
    )
  }

  return (
    <group position={[x, PLATE_TOP, -0.1]}>
      <group
        ref={moving}
        onPointerDown={onDown}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        {BODIES[kind]}
      </group>
      {kind === 'tactile' && (
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.56, 0.12, 0.56]} />
          <meshStandardMaterial color="#151517" roughness={0.6} />
        </mesh>
      )}
      {kind === 'metal' && (
        <mesh position={[0, 0.03, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.43, 0.45, 0.06, 64]} />
          <meshPhysicalMaterial color="#3a3b40" metalness={1} roughness={0.35} />
        </mesh>
      )}
      <mesh position={[0, 0.006, 0.62]}>
        <cylinderGeometry args={[0.03, 0.03, 0.012, 24]} />
        <meshStandardMaterial ref={led} color="#2b221c" emissive="#ff8a3d" emissiveIntensity={0} />
      </mesh>
      <pointLight ref={light} position={[0, 0.08, 0.62]} color="#ff8a3d" intensity={0} distance={0.9} decay={2} />
    </group>
  )
}

function metalProfile(r: number, h: number, bevel: number) {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, h - bevel)]
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push(new THREE.Vector2(r - bevel + Math.cos(a) * bevel, h - bevel + Math.sin(a) * bevel))
  }
  pts.push(new THREE.Vector2(0, h))
  return pts
}

const BODIES: Record<Kind, ReactNode> = {
  // Cap bottom rests 0.19 above the plate; bottoming out leaves a 0.03 gap. Housing hides inside the cap.
  tactile: (
    <RoundedBox args={[0.74, 0.3, 0.74]} radius={0.07} smoothness={5} position={[0, 0.19 + 0.15, 0]} castShadow receiveShadow>
      <meshPhysicalMaterial color="#efebe3" roughness={0.62} clearcoat={0.05} />
    </RoundedBox>
  ),
  silicone: (
    <RoundedBox args={[0.74, 0.36, 0.74]} radius={0.16} smoothness={6} position={[0, 0.18, 0]} castShadow receiveShadow>
      <meshPhysicalMaterial color="#e0673f" roughness={0.75} sheen={1} sheenColor="#ffb08a" sheenRoughness={0.5} />
    </RoundedBox>
  ),
  // Lathed profile with a rounded chamfer: the curved edge is what catches a highlight and reads as metal.
  metal: (
    <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
      <latheGeometry args={[metalProfile(0.34, 0.1, 0.03), 128]} />
      <meshPhysicalMaterial color="#d8dade" metalness={1} roughness={0.16} />
    </mesh>
  ),
}

// How depth maps to geometry per material.
const POSE: Record<Kind, (d: number, g: THREE.Group) => void> = {
  tactile: (d, g) => {
    g.position.y = -d * SPECS.tactile.travel
  },
  // Silicone compresses instead of translating: height shrinks, sides bulge (roughly volume-preserving).
  silicone: (d, g) => {
    const c = Math.max(0, d)
    g.scale.set(1 + 0.09 * c, 1 - 0.55 * c, 1 + 0.09 * c)
  },
  metal: (d, g) => {
    g.position.y = -d * SPECS.metal.travel
  },
}

const KINDS: Kind[] = ['tactile', 'silicone', 'metal']
const KEYS = ['1', '2', '3']

function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key)
      if (i >= 0 && !e.repeat && handles[i]) press(handles[i].state)
    }
    const up = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key)
      if (i >= 0 && handles[i]) release(handles[i].spec, handles[i].state)
    }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    window.__buttons = {
      press: (i) => press(handles[i].state),
      release: (i) => release(handles[i].spec, handles[i].state),
      depth: (i) => handles[i].state.d,
    }
    return () => {
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
      delete window.__buttons
    }
  }, [])
}

function Studio() {
  return (
    <Environment resolution={256}>
      <color attach="background" args={['#d8d6d2']} />
      <Lightformer form="rect" intensity={3} position={[0, 5, -2]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer form="rect" intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer form="circle" intensity={4} position={[0, 4, 4]} scale={1.5} />
    </Environment>
  )
}

function Scene() {
  useKeyboard()
  return (
    <>
      <color attach="background" args={['#d6d3cd']} />
      <Studio />
      <directionalLight
        position={[2.5, 5, 3]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      <RoundedBox args={[3.6, PLATE_TOP, 1.5]} radius={0.05} smoothness={4} position={[0, PLATE_TOP / 2, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#26272b" metalness={0.7} roughness={0.42} />
      </RoundedBox>

      {KINDS.map((kind, i) => (
        <Button key={kind} kind={kind} index={i} x={(i - 1) * 1.15} />
      ))}

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={8} blur={2.4} far={1.2} resolution={512} />
      <OrbitControls
        makeDefault
        target={[0, 0.15, 0]}
        enablePan={false}
        minDistance={2.5}
        maxDistance={7}
        minPolarAngle={0.2}
        maxPolarAngle={1.35}
      />
    </>
  )
}

export default function TactileButtons() {
  return (
    <>
      <Stage renderer="webgl" camera={{ position: [0, 3.3, 4.6], fov: 30 }}>
        <Scene />
      </Stage>
      <div data-chrome style={hint}>
        click and hold · or keys 1 2 3 · sound on
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
  letterSpacing: 0.4,
  color: '#55524c',
  pointerEvents: 'none',
}
