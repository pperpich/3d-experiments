import type { RendererKind } from './Stage'

export type ExperimentMeta = {
  title: string
  summary: string
  renderer: RendererKind
  /** Camera positions scripts/snap.mjs uses for multi-view contact sheets. */
  views?: { pos: [number, number, number]; target?: [number, number, number] }[]
}
