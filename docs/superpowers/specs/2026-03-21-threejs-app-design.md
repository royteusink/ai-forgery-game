# Three.js App Design

**Date:** 2026-03-21
**Project:** ai-forging-game

## Overview

A simple Three.js application bootstrapped with Bun, TypeScript, and Vite. The app renders a single Phong-shaded spinning cube on a dark background with a fixed camera.

## Stack

- **Package manager / runtime:** Bun
- **Bundler / dev server:** Vite
- **Language:** TypeScript
- **3D library:** Three.js

## Project Structure

```
ai-forging-game/
├── index.html
├── src/
│   └── main.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Implementation — `src/main.ts`

All logic lives in a single file. No additional modules.

1. **Renderer** — `WebGLRenderer` sized to `window.innerWidth × window.innerHeight`, appended to `document.body`.
2. **Camera** — `PerspectiveCamera` (75° FOV) positioned at `(0, 0, 3)`, looking at the origin. Never moves.
3. **Scene** — dark background color (`#0a0a14`).
4. **Lighting**
   - `AmbientLight` at low intensity for soft fill.
   - `DirectionalLight` positioned above-right for specular highlights.
5. **Cube** — `BoxGeometry(1, 1, 1)` with `MeshPhongMaterial` using a silver/steel color and high shininess.
6. **Animation loop** — `requestAnimationFrame` increments `cube.rotation.x` and `cube.rotation.y` each frame.
7. **Resize handler** — `window.resize` updates renderer size and camera aspect ratio.

## Dev Scripts

| Command | Action |
|---|---|
| `bun run dev` | Start Vite dev server with HMR |
| `bun run build` | Production bundle output to `dist/` |

## Out of Scope

- Orbit controls / user camera interaction
- Multiple objects or scenes
- Audio, post-processing, or shadows
