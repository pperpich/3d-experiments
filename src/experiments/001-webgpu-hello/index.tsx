import { useMemo } from 'react'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three/webgpu'
import { color, mix, normalWorld, oscSine, positionLocal, time } from 'three/tsl'
import { Stage } from '../../core/Stage'

function NodeSphere() {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.1 })
    // Color from world normal, breathing over time — all evaluated on the GPU.
    m.colorNode = mix(color('#3d6be8'), color('#e8553d'), normalWorld.y.mul(0.5).add(0.5).mul(oscSine(time.mul(0.3))))
    m.positionNode = positionLocal.mul(oscSine(time.mul(0.8)).mul(0.04).add(1))
    return m
  }, [])

  return (
    <mesh material={material}>
      <icosahedronGeometry args={[1, 32]} />
    </mesh>
  )
}

export default function WebGPUHello() {
  return (
    <Stage renderer="webgpu" shadows={false} camera={{ position: [0, 0, 4], fov: 40 }}>
      <color attach="background" args={['#0e0f12']} />
      <hemisphereLight args={['#ffffff', '#202024', 1.5]} />
      <directionalLight position={[3, 3, 2]} intensity={2} />
      <NodeSphere />
      <OrbitControls makeDefault />
    </Stage>
  )
}
