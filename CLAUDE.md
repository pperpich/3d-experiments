# 3D Experiments

Experiment lab for physical, spatial UI: 3D, physics, and interfaces that feel real to human perception. Baseline for future work (including WebXR / VR headsets).

## Stack
- Vite + React 19 + TypeScript
- Three.js via React Three Fiber (`@react-three/fiber`) + `@react-three/drei`
- Physics: Rapier (`@react-three/rapier`); hand-written springs for UI motion
- Two renderers, chosen per experiment in `meta.ts`:
  - `webgl` — full drei ecosystem (ContactShadows, MeshTransmissionMaterial, Environment...).
  - `webgpu` — `three/webgpu` + TSL node materials (`three/tsl`). Most drei shader helpers (anything using ShaderMaterial / onBeforeCompile) do NOT work here. Import material classes from `three/webgpu`.
- Tone mapping is AgX (set in `Stage`).

## Layout
- `src/core/Stage.tsx` — Canvas wrapper: renderer choice, defaults, mounts `Probe`.
- `src/core/Probe.tsx` — exposes `window.__probe` (fps, draw calls, tris, `setCamera`) for scripts.
- `src/core/soft/` — the organic "soft" toolkit shared by 003+: `organicModel` (low-jerk press/sink/exhale, nudge), `softMaterial` (shader displacement + inner glow + sound-driven vibration), `SoftPebble` (component), `WarmRoom` (lighting).
- `src/core/audio.ts` (mechanical impacts) · `src/core/softAudio.ts` (pentatonic tonal voices, reverb, analysed + panned channels).
- `src/experiments/<NNN-name>/meta.ts` + `index.tsx` — auto-registered via `import.meta.glob`. `meta.views` = camera positions for contact sheets.
- `scripts/probe.mjs`, `scripts/snap.mjs` — headless Chromium (GPU on, Metal ANGLE, WebGPU enabled).

## Commands
- `npm run dev` — gallery at http://localhost:5173, experiment at `#<id>`
- `npm run typecheck`
- `npm run probe -- <id> | --all` — text-only health check (free-ish)
- `npm run snap -- <id> [--size WxH] [--views]` — writes a JPEG to `.snaps/` and prints its token cost

## Conventions
- Design north star: optimize for human perception and emotion, not technical parity. Deliberate perceptual cheats (slowed waves, perceptual loudness curves, audio-visual co-location) are encouraged.
- Pure-logic modules (`*Model.ts`, `cluster.ts`) have no imports so they run under plain `node` for numeric tests before any rendering.
- Keep scenes deterministic (seeded RNG, fixed initial state) so the probe's visual Δ is meaningful.
- New experiment = copy an existing folder, bump the number.
- Headless frame timings are indicative only; real performance must be confirmed on device.

## Visual review policy (token budget)

Looking at an image costs ~(width × height) / 750 tokens: 512×320 ≈ 220, 800×500 ≈ 530, a 3-view sheet ≈ 650, hard cap ≈ 1,500. The real cost is repeated loops, so **text checks are the default and images are the exception.**

**Always, after any scene change (no image):** `npm run typecheck` → `npm run probe -- <id>`. The probe's flags (ERRORS, LIKELY_BLANK, VERY_DARK, BLOWN_OUT, FLAT, SLOW), pixel stats and `Δ visual` catch most breakage and show whether a change landed.

**Take a snap only when one of these is true:**
1. **Milestone** — first render of a new experiment, or a finished visual pass (one image, `--views` sheet preferred).
2. **Ambiguous probe** — probe is healthy but the numbers can't tell whether the intent worked (e.g. composition, material look, a Δ that is unexpectedly large or ~0% after a visual change).
3. **Unexplained flag** — probe flags a problem that the code and errors don't explain.
4. **The user asks.**

**Never snap** to confirm a fix whose effect the probe numbers already show (e.g. dominant-color share, clipping, Δ moved as expected), for code-only changes (refactors, types, logic), or just to "see how it looks" mid-iteration.

**Budget:** default 512×320 single view; `--views` for spatial judgements; 800×500 only for fine material detail. At most **1 snap per iteration and 3 per task** — beyond that, ask the user first. Before reading a snap, say why it's warranted (which criterion) and its token cost.
