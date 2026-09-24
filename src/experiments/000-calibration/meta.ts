import type { ExperimentMeta } from '../../core/types'

export default {
  title: 'Calibration',
  summary: 'Physics-dropped UI cards, PBR materials, procedural studio light, contact shadows. Click a card to flick it.',
  renderer: 'webgl',
  views: [
    { pos: [0, 2.5, 6] },
    { pos: [5, 1.2, 2] },
    { pos: [0, 7, 0.01] },
  ],
} satisfies ExperimentMeta
