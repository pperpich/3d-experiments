import { Suspense, type ReactNode } from 'react'
import { Canvas, extend, type CanvasProps } from '@react-three/fiber'
import * as THREE from 'three'
import { Probe } from './Probe'

export type RendererKind = 'webgl' | 'webgpu'

type StageProps = {
  children: ReactNode
  /**
   * 'webgl'  — full drei ecosystem (ContactShadows, MeshTransmissionMaterial, ...).
   * 'webgpu' — three/webgpu + TSL node materials. Most drei shader helpers do NOT work here.
   */
  renderer?: RendererKind
  camera?: CanvasProps['camera']
  shadows?: CanvasProps['shadows']
}

async function createWebGPURenderer(props: any) {
  const WEBGPU = await import('three/webgpu')
  // R3F needs the node-based classes registered to render them as JSX elements.
  extend(WEBGPU as any)
  const renderer = new WEBGPU.WebGPURenderer({ ...props, antialias: true })
  renderer.toneMapping = THREE.AgXToneMapping
  await renderer.init()
  return renderer
}

export function Stage({ children, renderer = 'webgl', camera, shadows = 'soft' }: StageProps) {
  return (
    <Canvas
      shadows={shadows}
      dpr={[1, 2]}
      camera={camera ?? { position: [0, 2.5, 6], fov: 40 }}
      gl={
        renderer === 'webgpu'
          ? (createWebGPURenderer as any)
          : { antialias: true, powerPreference: 'high-performance' }
      }
      onCreated={({ gl }) => {
        // AgX handles bright highlights more naturally than ACES (less hue shift).
        gl.toneMapping = THREE.AgXToneMapping
      }}
    >
      <Suspense fallback={null}>{children}</Suspense>
      <Probe />
    </Canvas>
  )
}
