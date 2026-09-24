# 3D Experiments

A lab for 3D and physics in interfaces, and for how the brain interprets what we build in digital space. The target is perception, not technical parity: motion, light, material and sound are tuned for how interactions *feel*, and deliberate perceptual illusions are fair game. It's meant as a baseline for future work, including WebXR headsets.

**Try it live:** [pperpich.github.io/3d-experiments](https://pperpich.github.io/3d-experiments/). Only the Amazing Grace experiment is published there; run the repo locally for the rest.

## Experiments

| | |
|---|---|
| `000-calibration` | Physics-dropped cards, PBR materials, procedural studio light, contact shadows |
| `001-webgpu-hello` | WebGPU + TSL node material smoke test |
| `002-tactile-button` | Mechanical key, silicone membrane and metal dome: force-simulated travel and synthesized impact sound |
| `003-soft-touch` | A low-jerk living surface that dents, glows from within, ripples, breathes and answers in pentatonic tones |
| `004-soft-cluster` | Seven soft pebbles that sense each other: a visible wave carries each touch, neighbours hum in sympathy, and surfaces vibrate with their own measured sound |
| `005-amazing-grace` | The soft cluster retuned and played by invisible fingers, as a test that the physical model holds up as an instrument |

Turn sound on: several experiments use sound to reinforce what you see and touch.

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
- `npm run build:pages`: builds the public site (`pages/` → `dist-pages/`), which contains only `005-amazing-grace`. A push to `main` deploys it via GitHub Actions.

## License

[MIT](LICENSE). Take it, build on it.

Built together with Claude Code.
