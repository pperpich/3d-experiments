# 3D Experiments

A lab for physical, spatial interfaces: 3D, physics and sound tuned for how interactions *feel* to people rather than for technical accuracy. It's meant as a baseline for future work, including WebXR headsets.

## Experiments

| | |
|---|---|
| `000-calibration` | Physics-dropped cards, PBR materials, procedural studio light, contact shadows |
| `001-webgpu-hello` | WebGPU + TSL node material smoke test |
| `002-tactile-button` | Mechanical key, silicone membrane and metal dome: force-simulated travel and synthesized impact sound |
| `003-soft-touch` | A low-jerk living surface that dents, glows from within, ripples, breathes and answers in pentatonic tones |
| `004-soft-cluster` | Seven soft pebbles that sense each other: a visible wave carries each touch, neighbours hum in sympathy, and surfaces vibrate with their own measured sound |

Turn sound on. Most of the experience is in the audio.

## Run

```sh
npm install
npm run dev   # http://localhost:5173 — pick an experiment from the gallery
```

## Stack

Vite · React 19 · TypeScript · Three.js via React Three Fiber and drei · Rapier physics · Web Audio (all sound is synthesized, no assets).

## Tooling

- `npm run probe -- <id> | --all`: headless, text-only health check (frame timing, draw calls, errors, pixel statistics, visual change since the last run)
- `npm run snap -- <id> [--views]`: headless screenshot or multi-angle contact sheet into `.snaps/`

Built together with Claude Code.
