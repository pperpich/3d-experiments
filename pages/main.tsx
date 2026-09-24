// Public GitHub Pages entry: renders only the Amazing Grace experiment — no gallery,
// no registry — so nothing else from the lab is bundled or published.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AmazingGrace from '../src/experiments/005-amazing-grace'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmazingGrace />
  </StrictMode>,
)
