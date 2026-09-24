import { Suspense, useEffect, useState } from 'react'
import { experiments } from './experiments/registry'
import type { ExperimentMeta } from './core/types'

declare global {
  interface Window {
    __meta?: ExperimentMeta & { id: string }
  }
}

function useHash() {
  const [hash, setHash] = useState(() => location.hash.slice(1))
  useEffect(() => {
    const onChange = () => setHash(location.hash.slice(1))
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export function App() {
  const id = useHash()
  const current = experiments.find((e) => e.id === id)

  useEffect(() => {
    if (current) {
      const { Scene: _, ...meta } = current
      window.__meta = meta
    } else delete window.__meta
  }, [current])

  if (!current) return <Gallery />

  const { Scene } = current
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <a href="#" style={backLink} data-chrome>
        ← {current.title}
      </a>
    </div>
  )
}

function Gallery() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px' }}>
      <h1 style={{ fontWeight: 600, fontSize: 22, margin: '0 0 24px' }}>3D Experiments</h1>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {experiments.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`} style={card}>
              <span style={{ opacity: 0.5, fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                {e.id} · {e.renderer}
              </span>
              <strong style={{ fontWeight: 600 }}>{e.title}</strong>
              <span style={{ opacity: 0.7, fontSize: 14 }}>{e.summary}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

const card: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '14px 16px',
  borderRadius: 10,
  background: '#17181c',
  color: 'inherit',
  textDecoration: 'none',
  border: '1px solid #24262c',
}

const backLink: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  color: '#e8e8ea',
  opacity: 0.6,
  textDecoration: 'none',
  fontSize: 13,
}
