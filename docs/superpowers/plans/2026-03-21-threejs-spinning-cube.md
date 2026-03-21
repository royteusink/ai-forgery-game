# Three.js Spinning Cube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Bun + Vite + TypeScript project that renders a Phong-shaded spinning cube in Three.js with a fixed camera.

**Architecture:** All Three.js logic lives in a single `src/main.ts` — renderer, camera, scene, lights, cube geometry, animation loop, and resize handler. Vite serves the app via `index.html` and bundles it for production. No test framework is needed for this visual app; correctness is verified by running the dev server and observing the result.

**Tech Stack:** Bun, Vite, TypeScript, Three.js

---

### Task 1: Initialise the project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`

- [ ] **Step 1: Initialise a Bun project**

```bash
bun init -y
```

Expected: `package.json` and `tsconfig.json` created in the project root.

- [ ] **Step 2: Install dependencies**

```bash
bun add three
bun add -d vite typescript @types/three
```

Expected: `node_modules/` populated, `package.json` updated with `three` as a dependency and `vite`, `typescript`, `@types/three` as devDependencies.

- [ ] **Step 3: Replace the generated `package.json` scripts block**

Open `package.json` and ensure the `scripts` section reads:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build"
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({})
```

- [ ] **Step 5: Verify `tsconfig.json` has at minimum**

`bun init` generates a tsconfig. Confirm it contains (or add if missing):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

- [ ] **Step 6: Commit**

```bash
# Bun may generate bun.lockb (binary) or bun.lock depending on version — add whichever exists
git add package.json tsconfig.json vite.config.ts bun.lock*
git commit -m "chore: initialise Bun + Vite + TypeScript project"
```

---

### Task 2: Create the HTML entry point

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Forging Game</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { overflow: hidden; background: #0a0a14; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add HTML entry point"
```

---

### Task 3: Implement the Three.js scene in `src/main.ts`

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Create `src/main.ts` with renderer setup**

```typescript
import * as THREE from 'three'

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)
```

- [ ] **Step 2: Add camera and scene**

Append to `src/main.ts`:

```typescript
// Camera — fixed position, looks at origin
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 3)

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a14)
```

- [ ] **Step 3: Add lighting**

Append to `src/main.ts`:

```typescript
// Soft ambient fill
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)

// Key light with specular
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 5, 5)
scene.add(dirLight)
```

- [ ] **Step 4: Add the Phong cube**

Append to `src/main.ts`:

```typescript
// Cube
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshPhongMaterial({
  color: 0xaab8c2,
  shininess: 120,
  specular: 0x888888,
})
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)
```

- [ ] **Step 5: Add the animation loop**

Append to `src/main.ts`:

```typescript
// Animation loop
function animate() {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.005
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}
animate()
```

- [ ] **Step 6: Add the resize handler**

Append to `src/main.ts`:

```typescript
// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
```

- [ ] **Step 7: Run the dev server and verify**

```bash
bun run dev
```

Expected: Vite prints a local URL (e.g. `http://localhost:5173`). Open it in a browser — you should see a silver/steel Phong-shaded cube rotating against a dark background.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts
git commit -m "feat: add Three.js spinning cube scene"
```

---

### Task 4: Verify production build

**Files:** none new

- [ ] **Step 1: Run the production build**

```bash
bun run build
```

Expected: Vite outputs a `dist/` folder with no TypeScript errors.

- [ ] **Step 2: Add `dist/` to `.gitignore`**

```bash
echo "dist/" >> .gitignore
git add .gitignore
git commit -m "chore: verify production build passes, ignore dist/"
```
