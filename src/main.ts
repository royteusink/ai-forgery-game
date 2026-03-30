import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { ElementStore } from './elements'
import { GameUI } from './ui'
import { createElementMaterial } from './shaders'
import type { Element } from './types'

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Label renderer
const labelRenderer = new CSS2DRenderer()
labelRenderer.setSize(window.innerWidth, window.innerHeight)
labelRenderer.domElement.classList.add('label-renderer')
document.body.appendChild(labelRenderer.domElement)

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 8)

// Zoom (scroll wheel, toward pointer)
const zoomMin = 3
const zoomMax = 20
const defaultZoom = 8
let zoomTarget = camera.position.z
let panTargetX = camera.position.x
let panTargetY = camera.position.y
let zoomLocked = false

window.addEventListener('wheel', (e) => {
  e.preventDefault()
  if (zoomLocked) return
  const prevZoom = zoomTarget
  zoomTarget = THREE.MathUtils.clamp(zoomTarget + e.deltaY * 0.01, zoomMin, zoomMax)
  const zoomDelta = zoomTarget - prevZoom

  // Mouse position in NDC (-1 to 1)
  const ndcX = (e.clientX / window.innerWidth) * 2 - 1
  const ndcY = -(e.clientY / window.innerHeight) * 2 + 1

  // Shift camera X/Y toward pointer proportionally to zoom change
  const fovRad = THREE.MathUtils.degToRad(camera.fov)
  const visibleHeight = 2 * Math.tan(fovRad / 2) * prevZoom
  const visibleWidth = visibleHeight * camera.aspect

  panTargetX -= ndcX * (zoomDelta / prevZoom) * visibleWidth * 0.5
  panTargetY -= ndcY * (zoomDelta / prevZoom) * visibleHeight * 0.5
}, { passive: false })

// Scene
const scene = new THREE.Scene()

// Radial gradient background (deep space colors)
const bgScene = new THREE.Scene()
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const bgMaterial = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: { uBrightness: { value: 1.5 } },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uBrightness;
    varying vec2 vUv;
    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = length(vUv - center) * 1.4;
      vec3 core    = vec3(0.06, 0.04, 0.12);  // dark indigo
      vec3 mid     = vec3(0.03, 0.02, 0.08);  // deep purple
      vec3 outer   = vec3(0.01, 0.01, 0.03);  // almost black blue
      vec3 color = mix(core, mid, smoothstep(0.0, 0.5, dist));
      color = mix(color, outer, smoothstep(0.4, 1.0, dist));
      gl_FragColor = vec4(color * uBrightness, 1.0);
    }
  `,
})
const bgPlane = new THREE.PlaneGeometry(2, 2)
bgScene.add(new THREE.Mesh(bgPlane, bgMaterial))

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 5, 5)
scene.add(dirLight)

// Element cubes in scene
const cubeGroup = new THREE.Group()
scene.add(cubeGroup)

const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6)

// Outline shader for selected cubes — scales from center instead of along normals
const outlineMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    uniform float uScale;
    void main() {
      vec3 pos = position * uScale;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uOutlineColor;
    uniform float uOpacity;
    void main() {
      gl_FragColor = vec4(uOutlineColor, uOpacity);
    }
  `,
  uniforms: {
    uScale: { value: 1.1 },
    uOutlineColor: { value: new THREE.Color(0x00ffff) },
    uOpacity: { value: 0.9 },
  },
  side: THREE.BackSide,
  transparent: true,
  depthWrite: false,
})

function createCubeMesh(element: Element): THREE.Group {
  const material = createElementMaterial(element.id, element.color)
  const mesh = new THREE.Mesh(geometry, material)

  // Outline mesh (invisible until selected)
  const outline = new THREE.Mesh(geometry, outlineMaterial.clone())
  outline.visible = false
  outline.userData['isOutline'] = true

  const labelDiv = document.createElement('div')
  labelDiv.textContent = element.name
  labelDiv.className = 'cube-label'
  const label = new CSS2DObject(labelDiv)
  label.position.set(0, 0, 0)

  const group = new THREE.Group()
  group.add(mesh)
  group.add(outline)
  group.add(label)
  group.userData['elementId'] = element.id
  return group
}

const spiralSpacing = 1.25 // fixed arc distance between cubes
const spiralTightness = 0.22 // how quickly the spiral expands (lower = tighter)

// Fade-in state for cubes after combine (shared module so UI can trigger fade-ins too)
import { fadeInIds, fadeInStartTimes, FADE_IN_DURATION, spinTargets } from './fade'

let suppressLayout = false

function layoutCubes(): void {
  if (suppressLayout) return
  const elements = store.getAll()
  // Remove CSS2D labels from DOM before clearing cubes
  cubeGroup.traverse((child) => {
    if (child instanceof CSS2DObject) {
      child.removeFromParent()
      child.element.remove()
    }
  })
  cubeGroup.clear()

  const now = performance.now() / 1000

  // Walk the Archimedean spiral r = a*θ, stepping by fixed arc length
  let angle = 2
  elements.forEach((el) => {
    const group = createCubeMesh(el)
    const radius = spiralTightness * angle
    group.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0,
    )
    cubeGroup.add(group)

    // Start zoom-out animation for elements that were just combined
    if (fadeInIds.has(el.id)) {
      fadeInStartTimes.set(el.id, now)
      group.scale.set(2.5, 2.5, 2.5)
      // Start with alpha 0 so the cube fades in quickly
      const fadeMesh = group.children.find((c) => c instanceof THREE.Mesh && !c.userData['isOutline']) as THREE.Mesh | undefined
      if (fadeMesh) {
        const mat = fadeMesh.material as THREE.ShaderMaterial
        if (mat.uniforms?.['uAlpha']) mat.uniforms['uAlpha'].value = 0
      }
      const fadeLabel = group.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (fadeLabel) fadeLabel.element.style.opacity = '0'
    } else if (fadeInStartTimes.has(el.id)) {
      // Preserve ongoing zoom-out after layout rebuild
      const fadeStart = fadeInStartTimes.get(el.id)!
      const t = Math.min(1, (now - fadeStart) / FADE_IN_DURATION)
      if (t < 1) {
        const p = 0.4
        const eased = t === 0 ? 0 : Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
        const scale = 1 + (1 - eased) * 1.5
        const alpha = Math.min(1, t * 4)
        group.scale.set(scale, scale, scale)
        const fadeMesh = group.children.find((c) => c instanceof THREE.Mesh && !c.userData['isOutline']) as THREE.Mesh | undefined
        if (fadeMesh) {
          const mat = fadeMesh.material as THREE.ShaderMaterial
          if (mat.uniforms?.['uAlpha']) mat.uniforms['uAlpha'].value = alpha
        }
        const fadeLabel = group.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
        if (fadeLabel) fadeLabel.element.style.opacity = String(alpha)
      } else {
        fadeInStartTimes.delete(el.id)
      }
    }

    // Next angle: arc length ≈ radius * dθ, so dθ = spacing / radius
    const nextRadius = Math.max(radius, 0.5) // avoid huge jumps at center
    angle += spiralSpacing / nextRadius
  })

  fadeInIds.clear()
}

// Store & UI
const store = new ElementStore()

const ui = new GameUI(store)
layoutCubes()
store.onChange(() => layoutCubes())

// Combine animation state
interface CombineAnim {
  cubes: THREE.Group[]
  originalPositions: THREE.Vector3[]
  startTime: number
  orbitAngle: number
  speed: number
  done: boolean
}

let combineAnim: CombineAnim | null = null
let nonCombineOpacity = 1 // 0 = fully faded out, 1 = visible

// Continuous radial particle emitter (200 white particles, 2s delay, per-particle lifespan)
const PARTICLE_COUNT = 200
const particleGeometry = new THREE.BufferGeometry()
const positions = new Float32Array(PARTICLE_COUNT * 3)
const sizes = new Float32Array(PARTICLE_COUNT)
const alphas = new Float32Array(PARTICLE_COUNT)

// Per-particle state
const particleDirections = new Float32Array(PARTICLE_COUNT * 3)
const particleSpeeds = new Float32Array(PARTICLE_COUNT)
const particleLifespans = new Float32Array(PARTICLE_COUNT) // max age in seconds
const particleAges = new Float32Array(PARTICLE_COUNT) // current age
const particleBaseSizes = new Float32Array(PARTICLE_COUNT)

function randomizeParticle(i: number, stagger: boolean): void {
  // Random direction on a sphere
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  particleDirections[i * 3] = Math.sin(phi) * Math.cos(theta)
  particleDirections[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
  particleDirections[i * 3 + 2] = Math.cos(phi)

  particleSpeeds[i] = 1.5 + Math.random() * 3.5
  particleLifespans[i] = 0.8 + Math.random() * 1.5 // lives 0.8–2.3 seconds
  particleAges[i] = stagger ? -Math.random() * 1.0 : 0 // stagger at init
  particleBaseSizes[i] = 0.02 + Math.random() * 0.08

  positions[i * 3] = 0
  positions[i * 3 + 1] = 0
  positions[i * 3 + 2] = 0
}

for (let i = 0; i < PARTICLE_COUNT; i++) {
  randomizeParticle(i, true)
  alphas[i] = 0
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

const particleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uPixelRatio: { value: renderer.getPixelRatio() },
  },
  vertexShader: `
    attribute float size;
    attribute float alpha;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
      vAlpha = alpha;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float soft = 1.0 - smoothstep(0.1, 0.5, dist);
      gl_FragColor = vec4(1.0, 1.0, 1.0, soft * vAlpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

const particleSystem = new THREE.Points(particleGeometry, particleMaterial)
particleSystem.visible = false
scene.add(particleSystem)

let particleEmitTime = 0 // when the emitter activates (absolute time)

// Flash quad (rendered in canvas)
const flashScene = new THREE.Scene()
const flashCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const flashMaterial = new THREE.ShaderMaterial({
  uniforms: { uOpacity: { value: 0 } },
  vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform float uOpacity;
    void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity); }
  `,
  transparent: true,
  depthWrite: false,
})
flashScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flashMaterial))
let flashStartTime = 0
const FLASH_DURATION = 0.5


function startCombineAnimation(elementIds: string[]): void {
  const cubes: THREE.Group[] = []
  const originalPositions: THREE.Vector3[] = []

  cubeGroup.children.forEach((child) => {
    const g = child as THREE.Group
    if (elementIds.includes(g.userData['elementId'] as string)) {
      cubes.push(g)
      originalPositions.push(g.position.clone())
    }
  })

  if (cubes.length < 2) return

  combineAnim = {
    cubes,
    originalPositions,
    startTime: performance.now() / 1000,
    orbitAngle: 0,
    speed: 1,
    done: false,
  }

  // Move camera to center and lock zoom
  zoomLocked = true
  zoomTarget = defaultZoom
  panTargetX = 0
  panTargetY = 0

  // Particles start 2 seconds after combine start
  particleEmitTime = combineAnim.startTime + 1
}

function endCombineAnimation(newResult?: Element): void {
  if (combineAnim) {
    combineAnim.done = true
  }

  // White flash in canvas
  flashStartTime = performance.now() / 1000

  // Reset positions after flash, with fade-in for used elements + new result
  setTimeout(() => {
    combineAnim = null
    nonCombineOpacity = 0
    particleEmitTime = 0
    particleSystem.visible = false
    zoomLocked = false

    // Add new result if it doesn't exist yet
    if (newResult && !store.findById(newResult.id)) {
      suppressLayout = true
      store.add(newResult)
      suppressLayout = false
    }

    // All elements zoom in and fade in after a combine
    fadeInIds.clear()
    store.getAll().forEach((el) => fadeInIds.add(el.id))

    layoutCubes()
  }, 500)
}

ui.setCombineCallbacks(startCombineAnimation, endCombineAnimation)

// Hover detection on 3D cubes
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hoveredGroup: THREE.Group | null = null
const hoverScales = new Map<THREE.Group, number>() // 0 = normal, 1 = fully hovered
const meshSpinSpeeds = new Map<THREE.Mesh, { sx: number; sy: number }>()
const hoverSpeed = 5 // speed of the transition

renderer.domElement.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshes: THREE.Mesh[] = []
  cubeGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })

  const intersects = raycaster.intersectObjects(meshes)
  let newHovered: THREE.Group | null = null

  if (intersects.length > 0 && intersects[0]) {
    let obj: THREE.Object3D | null = intersects[0].object
    while (obj && !obj.userData['elementId']) {
      obj = obj.parent
    }
    if (obj) newHovered = obj as THREE.Group
  }

  if (newHovered !== hoveredGroup) {
    renderer.domElement.style.cursor = newHovered ? 'pointer' : 'default'
    hoveredGroup = newHovered
  }
})

renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshes: THREE.Mesh[] = []
  cubeGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child)
  })

  const intersects = raycaster.intersectObjects(meshes)
  if (intersects.length > 0 && intersects[0]) {
    // Find the parent group to get the elementId
    let obj: THREE.Object3D | null = intersects[0].object
    while (obj && !obj.userData['elementId']) {
      obj = obj.parent
    }
    if (obj) {
      const elementId = obj.userData['elementId'] as string
      const element = store.findById(elementId)
      if (element) {
        if (event.metaKey) {
          ui.selectElement(elementId)
        } else {
          ui.showElementInfo(element)
        }
      }
    }
  }
})

// Animation
const startTime = performance.now()

function animate(): void {
  requestAnimationFrame(animate)
  const elapsed = (performance.now() - startTime) / 1000

  // Smooth zoom interpolation (toward pointer)
  camera.position.z += (zoomTarget - camera.position.z) * 0.1
  camera.position.x += (panTargetX - camera.position.x) * 0.1
  camera.position.y += (panTargetY - camera.position.y) * 0.1

  // Rotate the whole circle slowly (not during combine animation)
  if (!combineAnim) {
    cubeGroup.rotation.z += 0.0005
  }

  const delta = 1 / 60 // ~60fps

  // Continuous particle emitter (activates 2s after combine start)
  if (combineAnim && particleEmitTime > 0 && elapsed > particleEmitTime) {
    particleSystem.visible = true
    const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute
    const sizeAttr = particleGeometry.getAttribute('size') as THREE.BufferAttribute
    const alphaAttr = particleGeometry.getAttribute('alpha') as THREE.BufferAttribute

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleAges[i] = particleAges[i]! + delta

      // Respawn when lifespan has expired
      if (particleAges[i]! >= particleLifespans[i]!) {
        randomizeParticle(i, false)
      }

      const age = particleAges[i]!
      if (age < 0) {
        // Still in stagger delay
        posAttr.setXYZ(i, 0, 0, 0)
        alphaAttr.setX(i, 0)
        sizeAttr.setX(i, 0)
        continue
      }

      const life = age / particleLifespans[i]! // 0..1 normalized
      const speed = particleSpeeds[i]!
      const dist = speed * age

      const dx = particleDirections[i * 3]!
      const dy = particleDirections[i * 3 + 1]!
      const dz = particleDirections[i * 3 + 2]!
      posAttr.setXYZ(i, dx * dist, dy * dist, dz * dist)

      // Fade in fast, fade out gradually
      const fadeIn = Math.min(1, age / 0.15)
      const fadeOut = 1 - life * life // quadratic fade out
      alphaAttr.setX(i, fadeIn * fadeOut * 0.9)

      // Size shrinks toward the end of the lifespan
      sizeAttr.setX(i, particleBaseSizes[i]! * (1 - life * 0.6))
    }

    posAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
  } else {
    particleSystem.visible = false
  }

  // Fade non-combine cubes in/out
  const fadeTarget = combineAnim ? 0 : 1
  nonCombineOpacity += (fadeTarget - nonCombineOpacity) * Math.min(1, 6 * delta)
  if (Math.abs(nonCombineOpacity - fadeTarget) < 0.001) nonCombineOpacity = fadeTarget

  // Hide combine cubes once animation is done (waiting for layoutCubes rebuild)
  if (combineAnim && combineAnim.done) {
    combineAnim.cubes.forEach((cube) => {
      cube.visible = false
    })
  }

  // Combine animatie updaten
  if (combineAnim && !combineAnim.done) {
    const t = elapsed - combineAnim.startTime
    // Speed increases progressively
    combineAnim.speed = Math.min(1 + t * t * 0.8, 6)
    combineAnim.orbitAngle += combineAnim.speed * delta * 3

    // Orbit radius shrinks over time (from 1.2 to 0.3)
    const orbitRadius = Math.max(0.3, 1.2 - t * 0.15)

    combineAnim.cubes.forEach((cube, i) => {
      const baseAngle = (i / combineAnim!.cubes.length) * Math.PI * 2
      const angle = baseAngle + combineAnim!.orbitAngle

      // Lerp toward center + orbit
      const centerX = Math.cos(angle) * orbitRadius
      const centerY = Math.sin(angle) * orbitRadius
      const origPos = combineAnim!.originalPositions[i]!

      // Smooth transition to orbit (first 1.5 seconds)
      const blend = Math.min(1, t / 1.5)
      const eased = blend * blend * (3 - 2 * blend) // smoothstep

      cube.position.x = origPos.x + (centerX - origPos.x) * eased
      cube.position.y = origPos.y + (centerY - origPos.y) * eased
      cube.position.z = origPos.z * (1 - eased) + eased * 3

      // Spin is handled by the smooth spin speed lerp below

      // Hide label during animation
      const label = cube.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (label) label.visible = false

      // Pingpong scale: pulses between 0.3 and 0.5
      const pulse = Math.sin(combineAnim!.orbitAngle * 2 + i * Math.PI * 0.667) * 0.5 + 0.5
      const s = 0.3 + pulse * 0.2
      cube.scale.set(s, s, s)
    })
  }

  // Only rotate the mesh, not the label + update shader time
  const selectedIds = ui.getSelectedIds()
  cubeGroup.children.forEach((group) => {
    const g = group as THREE.Group
    const mesh = g.children.find((c) => c instanceof THREE.Mesh && !c.userData['isOutline']) as THREE.Mesh | undefined
    const outline = g.children.find((c) => c instanceof THREE.Mesh && c.userData['isOutline']) as THREE.Mesh | undefined

    // Skip rotation/hover for cubes in combine animation
    const elementId = g.userData['elementId'] as string
    const isCombining = combineAnim?.cubes.includes(g)

    if (mesh) {
      const mat = mesh.material as THREE.ShaderMaterial
      if (mat.uniforms?.['uTime']) {
        mat.uniforms['uTime'].value = elapsed
      }
      // Smooth spin speed transition (fast → slow, always incremental)
      const spinState = meshSpinSpeeds.get(mesh) ?? { sx: 0.005, sy: 0.001 }
      const targetSX = combineAnim && isCombining ? 0.02 * combineAnim.speed : 0.005
      const targetSY = combineAnim && isCombining ? 0.015 * combineAnim.speed : 0.001
      spinState.sx += (targetSX - spinState.sx) * 0.03
      spinState.sy += (targetSY - spinState.sy) * 0.03
      meshSpinSpeeds.set(mesh, spinState)
      // Decaying extra spin during fade-in (additive, no direction changes)
      let extraSX = 0
      let extraSY = 0
      const spin = spinTargets.get(elementId)
      const fadeStartSpin = fadeInStartTimes.get(elementId)
      if (spin && fadeStartSpin !== undefined) {
        const absNow = performance.now() / 1000
        const t = Math.min(1, (absNow - fadeStartSpin) / FADE_IN_DURATION)
        const decay = (1 - t) * (1 - t) * (1 - t) // cubic decay → 0 at t=1
        extraSX = spin.sx * decay
        extraSY = spin.sy * decay
      }
      mesh.rotation.x += spinState.sx + extraSX
      mesh.rotation.y += spinState.sy + extraSY
    }

    // Outline sync met mesh rotatie en selectie
    if (outline && mesh) {
      const isSelected = !isCombining && selectedIds.includes(g.userData['elementId'] as string)
      outline.visible = isSelected
      outline.rotation.copy(mesh.rotation)
      if (isSelected) {
        const outMat = outline.material as THREE.ShaderMaterial
        outMat.uniforms['uOpacity']!.value = 0.5 + Math.sin(elapsed * 3) * 0.2
      }
    }

    // Zoom-out animation (scale large→1 with elastic ease) — lookup by elementId so it survives layout rebuilds
    const fadeStart = fadeInStartTimes.get(elementId)
    if (fadeStart !== undefined) {
      const absNow = performance.now() / 1000
      const t = Math.max(0, Math.min(1, (absNow - fadeStart) / FADE_IN_DURATION))
      // Elastic ease-out: overshoots slightly then settles
      const p = 0.4
      const eased = t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1
      // Scale from 2.5 down to 1
      const scale = 1 + (1 - eased) * 1.5
      // Opacity fades in quickly
      const alpha = Math.min(1, t * 4)
      g.scale.set(scale, scale, scale)
      if (mesh) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms['uAlpha']!.value = alpha
      }
      const lbl = g.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (lbl) (lbl.element as HTMLElement).style.opacity = String(alpha)
      if (t >= 1) {
        fadeInStartTimes.delete(elementId)
        spinTargets.delete(elementId)
        g.scale.set(1, 1, 1)
        if (mesh) {
          const mat = mesh.material as THREE.ShaderMaterial
          mat.uniforms['uAlpha']!.value = 1
        }
      }
    } else if (!isCombining) {
      // Smooth hover scaling (not during combine or fade-in)
      const current = hoverScales.get(g) ?? 0
      const target = g === hoveredGroup ? 1 : 0
      const newVal = current + (target - current) * Math.min(1, hoverSpeed * delta)
      hoverScales.set(g, newVal)
      const scale = 1 + newVal * 0.3 // max 30% groter
      g.scale.set(scale, scale, scale)

      // Fade out non-combining cubes during combine animation
      if (mesh) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms['uAlpha']!.value = nonCombineOpacity
      }
      const lbl = g.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (lbl) (lbl.element as HTMLElement).style.opacity = String(nonCombineOpacity)
    }
  })

  // Update flash fade-out
  if (flashStartTime > 0) {
    const flashElapsed = elapsed - flashStartTime
    if (flashElapsed < FLASH_DURATION) {
      flashMaterial.uniforms['uOpacity']!.value = 1 - (flashElapsed / FLASH_DURATION)
    } else {
      flashMaterial.uniforms['uOpacity']!.value = 0
      flashStartTime = 0
    }
  }

  renderer.autoClear = false
  renderer.clear()
  renderer.render(bgScene, bgCamera)
  renderer.render(scene, camera)
  if (flashMaterial.uniforms['uOpacity']!.value > 0) {
    renderer.render(flashScene, flashCamera)
  }
  labelRenderer.render(scene, camera)
}
animate()

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
})
