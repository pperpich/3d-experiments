import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ExperimentMeta } from '../core/types'

// Each experiment is a folder: src/experiments/<id>/{meta.ts,index.tsx}.
// meta is eager (for the gallery); the scene itself is code-split.
const metas = import.meta.glob<ExperimentMeta>('./*/meta.ts', { eager: true, import: 'default' })
const scenes = import.meta.glob<{ default: ComponentType }>('./*/index.tsx')

export type Experiment = ExperimentMeta & {
  id: string
  Scene: LazyExoticComponent<ComponentType>
}

export const experiments: Experiment[] = Object.entries(metas)
  .map(([path, meta]) => {
    const id = path.split('/')[1]
    return { ...meta, id, Scene: lazy(scenes[`./${id}/index.tsx`]) }
  })
  .sort((a, b) => a.id.localeCompare(b.id))
