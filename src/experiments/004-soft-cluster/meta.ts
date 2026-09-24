import type { ExperimentMeta } from '../../core/types'

export default {
  title: 'Soft cluster',
  summary: 'Seven soft pebbles that sense each other: a visible wave carries each touch across the surface, and neighbours answer in sympathy. Surfaces vibrate with their own measured sound.',
  renderer: 'webgl',
  views: [
    { pos: [0, 3.4, 3.9], target: [0, 0.1, 0] },
    { pos: [3.6, 1.3, 2.2], target: [0, 0.15, 0] },
  ],
} satisfies ExperimentMeta
