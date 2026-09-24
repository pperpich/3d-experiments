import { useEffect, useRef } from 'react'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Stage } from '../../core/Stage'
import { SoftPebble, type PebbleHandle } from '../../core/soft/SoftPebble'
import { WarmRoom } from '../../core/soft/WarmRoom'

declare global {
  interface Window {
    __soft?: { press: (x?: number, z?: number) => void; release: () => void; depth: () => number; on: () => boolean }
  }
}

function Pebble() {
  const ref = useRef<PebbleHandle>(null)
  useEffect(() => {
    window.__soft = {
      press: (x, z) => ref.current?.press(x, z),
      release: () => ref.current?.release(),
      depth: () => ref.current?.state.depth ?? 0,
      on: () => ref.current?.state.on ?? false,
    }
    return () => {
      delete window.__soft
    }
  }, [])
  return <SoftPebble ref={ref} half={[0.85, 0.3, 0.85]} detail={64} />
}

export default function SoftTouch() {
  return (
    <>
      <Stage renderer="webgl" camera={{ position: [0, 2.2, 3.0], fov: 32 }}>
        <color attach="background" args={['#221d1a']} />
        <WarmRoom />
        <Pebble />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.3} />
        </mesh>
        {/* Rendered once: it sees the undeformed base shape anyway, so per-frame updates are wasted work. */}
        <ContactShadows frames={1} position={[0, 0.001, 0]} opacity={0.8} color="#0d0a08" scale={6} blur={2.6} far={1} resolution={512} />
        <OrbitControls makeDefault target={[0, 0.2, 0]} enablePan={false} minDistance={2} maxDistance={6} minPolarAngle={0.2} maxPolarAngle={1.35} />
      </Stage>
      <div data-chrome style={hint}>
        press · hold · drag · let go
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
