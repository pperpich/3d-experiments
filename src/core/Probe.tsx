import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Text-first telemetry. Exposes `window.__probe` so scripts/probe.mjs can
 * judge a scene's health (fps, draw calls, errors) without taking a screenshot.
 */
export type ProbeState = {
  ready: boolean
  frames: number
  renderer: string
  frameMs: { avg: number; p95: number; max: number }
  calls: number
  triangles: number
  setCamera: (pos: [number, number, number], target?: [number, number, number]) => void
}

declare global {
  interface Window {
    __probe?: ProbeState
  }
}

const WINDOW = 120
const READY_AFTER = 30

export function Probe() {
  const { gl, camera, controls, invalidate } = useThree()
  const samples = useRef<number[]>([])
  const frames = useRef(0)

  useEffect(() => {
    // Count per frame ourselves: WebGPU resets its counters at a different point in
    // the frame than WebGL, so we disable auto-reset and reset after each read.
    const info = (gl as unknown as { info: { autoReset: boolean } }).info
    info.autoReset = false
    const renderer = (gl as unknown as { isWebGPURenderer?: boolean }).isWebGPURenderer
      ? `webgpu${(gl as any).backend?.isWebGLBackend ? ' (webgl2 fallback)' : ''}`
      : 'webgl2'
    window.__probe = {
      ready: false,
      frames: 0,
      renderer,
      frameMs: { avg: 0, p95: 0, max: 0 },
      calls: 0,
      triangles: 0,
      setCamera: (pos, target = [0, 0, 0]) => {
        camera.position.set(...pos)
        const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null
        if (c?.target) {
          c.target.set(...target)
          c.update?.()
        } else {
          camera.lookAt(...target)
        }
        invalidate()
      },
    }
    return () => {
      delete window.__probe
    }
  }, [gl, camera, controls, invalidate])

  useFrame((_, dt) => {
    const p = window.__probe
    if (!p) return
    frames.current++
    const info = (gl as unknown as { info: { reset: () => void; render: { calls?: number; drawCalls?: number; triangles: number } } }).info
    const counts = { calls: info.render.drawCalls ?? info.render.calls ?? 0, triangles: info.render.triangles }
    info.reset()
    // Skip warm-up frames: shader compilation spikes would skew every stat.
    if (frames.current <= READY_AFTER) {
      if (frames.current === READY_AFTER) p.ready = true
      p.frames = frames.current
      return
    }
    const s = samples.current
    s.push(dt * 1000)
    if (s.length > WINDOW) s.shift()
    if (frames.current % 30 === 0) {
      const sorted = [...s].sort((a, b) => a - b)
      p.frameMs = {
        avg: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
        max: +sorted[sorted.length - 1].toFixed(2),
      }
      p.calls = counts.calls
      p.triangles = counts.triangles
    }
    p.frames = frames.current
  })

  return null
}
