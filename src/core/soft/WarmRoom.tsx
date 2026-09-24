import { Environment, Lightformer } from '@react-three/drei'

/** Dim, warm studio shared by the soft experiments: soft reflections, nothing bright or clinical. */
export function WarmRoom({ shadowExtent = 2 }: { shadowExtent?: number }) {
  return (
    <>
      <Environment resolution={256}>
        <color attach="background" args={['#3a322c']} />
        {/* A long soft strip overhead: its reflection is what visibly bends across a dent. */}
        <Lightformer form="rect" intensity={1.4} color="#ffe6cf" position={[-1, 4, 0.5]} rotation-x={Math.PI / 2} scale={[1.2, 5, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#ffd2b0" position={[4, 1, -2]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
        <Lightformer form="circle" intensity={0.8} color="#fff1e4" position={[0, 3, 4]} scale={1.2} />
      </Environment>
      {/* Low raking key: relief on the surface casts real shading. */}
      <directionalLight
        position={[-3.2, 2.2, -0.6]}
        intensity={1.9}
        color="#fff0e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
      />
    </>
  )
}
