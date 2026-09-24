import { useMemo } from 'react'
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { Stage } from '../../core/Stage'

// Seeded so every run (and every snapshot) starts from the same layout.
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

const CARD_COLORS = ['#f4f1ea', '#1d1f24', '#e8553d', '#3d6be8', '#d9c9a3']

function Cards() {
  const cards = useMemo(() => {
    const r = rng(7)
    return CARD_COLORS.map((color, i) => ({
      color,
      position: [(r() - 0.5) * 2, 1.5 + i * 0.6, (r() - 0.5) * 1.5] as [number, number, number],
      rotation: [r() * Math.PI, r() * Math.PI, r() * Math.PI] as [number, number, number],
    }))
  }, [])

  const flick = (body: RapierRigidBody | null) => {
    body?.applyImpulse({ x: 0, y: 0.6, z: 0 }, true)
    body?.applyTorqueImpulse({ x: 0.02, y: 0.03, z: 0 }, true)
  }

  return cards.map((c, i) => {
    let ref: RapierRigidBody | null = null
    return (
      <RigidBody
        key={i}
        ref={(b) => { ref = b }}
        position={c.position}
        rotation={c.rotation}
        colliders="cuboid"
        restitution={0.15}
        friction={0.8}
      >
        <RoundedBox
          args={[1.2, 0.04, 0.75]}
          radius={0.018}
          smoothness={4}
          castShadow
          onPointerDown={(e) => {
            e.stopPropagation()
            flick(ref)
          }}
        >
          <meshPhysicalMaterial color={c.color} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.2} />
        </RoundedBox>
      </RigidBody>
    )
  })
}

function Studio() {
  return (
    <Environment resolution={256}>
      {/* A bright studio void, so metals reflect a room rather than black space. */}
      <color attach="background" args={['#d8d6d2']} />
      <Lightformer form="rect" intensity={3} position={[0, 5, -2]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[-5, 2, 1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer form="rect" intensity={1} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer form="circle" intensity={4} position={[0, 4, 4]} scale={1.5} />
    </Environment>
  )
}

export default function Calibration() {
  return (
    <Stage renderer="webgl">
      <color attach="background" args={['#e9e7e3']} />
      <Studio />
      <directionalLight position={[3, 6, 2]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />

      <Physics gravity={[0, -9.81, 0]}>
        <Cards />
        <RigidBody type="fixed" colliders="ball" position={[-1.6, 0.35, -0.6]}>
          <mesh castShadow>
            <sphereGeometry args={[0.35, 64, 64]} />
            <meshPhysicalMaterial color="#c9ccd1" metalness={1} roughness={0.15} />
          </mesh>
        </RigidBody>
        <RigidBody type="fixed" colliders="ball" position={[1.7, 0.4, -0.4]}>
          <mesh castShadow>
            <sphereGeometry args={[0.4, 64, 64]} />
            <meshPhysicalMaterial transmission={1} thickness={0.8} roughness={0.05} ior={1.5} />
          </mesh>
        </RigidBody>
        <CuboidCollider args={[10, 0.5, 10]} position={[0, -0.5, 0]} />
      </Physics>

      {/* Shadow-only floor: the background shows through, so there is no horizon seam. */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={10} blur={2.2} far={2} resolution={512} />
      <OrbitControls makeDefault target={[0, 0.3, 0]} maxPolarAngle={Math.PI / 2.05} />
    </Stage>
  )
}
