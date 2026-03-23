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
labelRenderer.domElement.style.position = 'absolute'
labelRenderer.domElement.style.top = '0'
labelRenderer.domElement.style.pointerEvents = 'none'
document.body.appendChild(labelRenderer.domElement)

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 8)

// Scene
const scene = new THREE.Scene()

// Radial gradient achtergrond (deep space kleuren)
const bgScene = new THREE.Scene()
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const bgMaterial = new THREE.ShaderMaterial({
  depthWrite: false,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = length(vUv - center) * 1.4;
      vec3 core    = vec3(0.06, 0.04, 0.12);  // donker indigo
      vec3 mid     = vec3(0.03, 0.02, 0.08);  // diep paars
      vec3 outer   = vec3(0.01, 0.01, 0.03);  // bijna zwart blauw
      vec3 color = mix(core, mid, smoothstep(0.0, 0.5, dist));
      color = mix(color, outer, smoothstep(0.4, 1.0, dist));
      gl_FragColor = vec4(color, 1.0);
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

// Outline shader voor geselecteerde cubes — schaalt vanuit center i.p.v. langs normals
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

  // Outline mesh (onzichtbaar tot geselecteerd)
  const outline = new THREE.Mesh(geometry, outlineMaterial.clone())
  outline.visible = false
  outline.userData['isOutline'] = true

  const labelDiv = document.createElement('div')
  labelDiv.textContent = element.name
  labelDiv.style.cssText = 'color: #e2e8f0; font-family: sans-serif; font-size: 12px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.8); white-space: nowrap; transform: translate(-50%, 0);'
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

// Fade-in state voor cubes na combine
const fadeIns = new Map<THREE.Group, number>() // group -> startTime
const FADE_IN_DURATION = 0.6
let fadeInIds: Set<string> = new Set()

function layoutCubes(): void {
  const elements = store.getAll()
  // Verwijder CSS2D labels uit de DOM voordat we cubes clearen
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

    // Start fade-in voor elementen die net gecombineerd werden
    if (fadeInIds.has(el.id)) {
      fadeIns.set(group, now)
      group.scale.set(0, 0, 0)
    }

    // Next angle: arc length ≈ radius * dθ, so dθ = spacing / radius
    const nextRadius = Math.max(radius, 0.5) // avoid huge jumps at center
    angle += spiralSpacing / nextRadius
  })

  fadeInIds.clear()
}

// Store & UI
const store = new ElementStore()

function onNewElement(_result: Element): void {
  layoutCubes()
}

const ui = new GameUI(store, onNewElement)
layoutCubes()
store.onChange(() => layoutCubes())

// Combine animatie state
interface CombineAnim {
  cubes: THREE.Group[]
  originalPositions: THREE.Vector3[]
  startTime: number
  orbitAngle: number
  speed: number
  done: boolean
}

let combineAnim: CombineAnim | null = null
let nonCombineOpacity = 1 // 0 = volledig uitgevlakt, 1 = zichtbaar

// Continue radial particle emitter (200 witte particles, 2s delay, per-particle lifespan)
const PARTICLE_COUNT = 200
const particleGeometry = new THREE.BufferGeometry()
const positions = new Float32Array(PARTICLE_COUNT * 3)
const sizes = new Float32Array(PARTICLE_COUNT)
const alphas = new Float32Array(PARTICLE_COUNT)

// Per-particle state
const particleDirections = new Float32Array(PARTICLE_COUNT * 3)
const particleSpeeds = new Float32Array(PARTICLE_COUNT)
const particleLifespans = new Float32Array(PARTICLE_COUNT) // max leeftijd in seconden
const particleAges = new Float32Array(PARTICLE_COUNT) // huidige leeftijd
const particleBaseSizes = new Float32Array(PARTICLE_COUNT)

function randomizeParticle(i: number, stagger: boolean): void {
  // Random richting op een bol
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  particleDirections[i * 3] = Math.sin(phi) * Math.cos(theta)
  particleDirections[i * 3 + 1] = Math.sin(phi) * Math.sin(theta)
  particleDirections[i * 3 + 2] = Math.cos(phi)

  particleSpeeds[i] = 1.5 + Math.random() * 3.5
  particleLifespans[i] = 0.8 + Math.random() * 1.5 // leeft 0.8–2.3 seconden
  particleAges[i] = stagger ? -Math.random() * 1.0 : 0 // stagger bij init
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

let particleEmitTime = 0 // wanneer de emitter activeert (absolute tijd)

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

  // Particles starten 2 seconden na combine start
  particleEmitTime = combineAnim.startTime + 2
}

function endCombineAnimation(): void {
  if (combineAnim) {
    combineAnim.done = true
  }

  // Witte flash in canvas
  flashStartTime = performance.now() / 1000

  // Reset posities na flash, met fade-in voor gebruikte elementen
  const usedIds = combineAnim?.cubes.map((c) => c.userData['elementId'] as string) ?? []
  setTimeout(() => {
    combineAnim = null
    particleEmitTime = 0
    particleSystem.visible = false
    fadeInIds = new Set(usedIds)
    layoutCubes()
  }, 500)
}

ui.setCombineCallbacks(startCombineAnimation, endCombineAnimation)

// Hover detection op 3D cubes
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hoveredGroup: THREE.Group | null = null
const hoverScales = new Map<THREE.Group, number>() // 0 = normal, 1 = fully hovered
const hoverSpeed = 5 // snelheid van de transitie

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
    // Zoek de parent group om het elementId te vinden
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

  // Draai de hele cirkel langzaam rond (niet tijdens combine animatie)
  if (!combineAnim) {
    cubeGroup.rotation.z += 0.0005
  }

  const delta = 1 / 60 // ~60fps

  // Continue particle emitter (activeert 2s na combine start)
  if (combineAnim && particleEmitTime > 0 && elapsed > particleEmitTime) {
    particleSystem.visible = true
    const posAttr = particleGeometry.getAttribute('position') as THREE.BufferAttribute
    const sizeAttr = particleGeometry.getAttribute('size') as THREE.BufferAttribute
    const alphaAttr = particleGeometry.getAttribute('alpha') as THREE.BufferAttribute

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleAges[i] = particleAges[i]! + delta

      // Respawn als lifespan verlopen is
      if (particleAges[i]! >= particleLifespans[i]!) {
        randomizeParticle(i, false)
      }

      const age = particleAges[i]!
      if (age < 0) {
        // Nog in stagger delay
        posAttr.setXYZ(i, 0, 0, 0)
        alphaAttr.setX(i, 0)
        sizeAttr.setX(i, 0)
        continue
      }

      const life = age / particleLifespans[i]! // 0..1 genormaliseerd
      const speed = particleSpeeds[i]!
      const dist = speed * age

      const dx = particleDirections[i * 3]!
      const dy = particleDirections[i * 3 + 1]!
      const dz = particleDirections[i * 3 + 2]!
      posAttr.setXYZ(i, dx * dist, dy * dist, dz * dist)

      // Fade in snel, fade out geleidelijk
      const fadeIn = Math.min(1, age / 0.15)
      const fadeOut = 1 - life * life // quadratic fade out
      alphaAttr.setX(i, fadeIn * fadeOut * 0.9)

      // Grootte krimpt naar het einde van de lifespan
      sizeAttr.setX(i, particleBaseSizes[i]! * (1 - life * 0.6))
    }

    posAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
  } else {
    particleSystem.visible = false
  }

  // Fade non-combine cubes in/out
  const fadeTarget = combineAnim && !combineAnim.done ? 0 : 1
  nonCombineOpacity += (fadeTarget - nonCombineOpacity) * Math.min(1, 6 * delta)
  if (Math.abs(nonCombineOpacity - fadeTarget) < 0.001) nonCombineOpacity = fadeTarget

  // Combine animatie updaten
  if (combineAnim && !combineAnim.done) {
    const t = elapsed - combineAnim.startTime
    // Snelheid neemt steeds meer toe
    combineAnim.speed = Math.min(1 + t * t * 0.8, 6)
    combineAnim.orbitAngle += combineAnim.speed * delta * 3

    // Orbit radius krimpt over tijd (van 1.2 naar 0.3)
    const orbitRadius = Math.max(0.3, 1.2 - t * 0.15)

    combineAnim.cubes.forEach((cube, i) => {
      const baseAngle = (i / combineAnim!.cubes.length) * Math.PI * 2
      const angle = baseAngle + combineAnim!.orbitAngle

      // Lerp naar het midden + orbit
      const centerX = Math.cos(angle) * orbitRadius
      const centerY = Math.sin(angle) * orbitRadius
      const origPos = combineAnim!.originalPositions[i]!

      // Smooth overgang naar orbit (eerste 1.5 seconde)
      const blend = Math.min(1, t / 1.5)
      const eased = blend * blend * (3 - 2 * blend) // smoothstep

      cube.position.x = origPos.x + (centerX - origPos.x) * eased
      cube.position.y = origPos.y + (centerY - origPos.y) * eased
      cube.position.z = origPos.z * (1 - eased) + eased * 3

      // Laat de cubes ook sneller om eigen as draaien
      const mesh = cube.children.find((c) => c instanceof THREE.Mesh && !c.userData['isOutline']) as THREE.Mesh | undefined
      if (mesh) {
        mesh.rotation.x += 0.02 * combineAnim!.speed
        mesh.rotation.y += 0.015 * combineAnim!.speed
      }

      // Verberg label tijdens animatie
      const label = cube.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (label) label.visible = false

      // Pingpong scale: pulseert tussen 0.3 en 0.5
      const pulse = Math.sin(combineAnim!.orbitAngle * 2 + i * Math.PI * 0.667) * 0.5 + 0.5
      const s = 0.3 + pulse * 0.2
      cube.scale.set(s, s, s)
    })
  }

  // Alleen de mesh laten roteren, niet het label + shader time updaten
  const selectedIds = ui.getSelectedIds()
  cubeGroup.children.forEach((group) => {
    const g = group as THREE.Group
    const mesh = g.children.find((c) => c instanceof THREE.Mesh && !c.userData['isOutline']) as THREE.Mesh | undefined
    const outline = g.children.find((c) => c instanceof THREE.Mesh && c.userData['isOutline']) as THREE.Mesh | undefined

    // Skip rotatie/hover voor cubes in combine animatie
    const isCombining = combineAnim?.cubes.includes(g)

    if (mesh) {
      if (!isCombining) {
        mesh.rotation.x += 0.005
        mesh.rotation.y += 0.001
      }
      const mat = mesh.material as THREE.ShaderMaterial
      if (mat.uniforms?.['uTime']) {
        mat.uniforms['uTime'].value = elapsed
      }
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

    // Fade-in animatie (opacity + scale)
    const fadeStart = fadeIns.get(g)
    if (fadeStart !== undefined) {
      const t = Math.min(1, (elapsed - fadeStart) / FADE_IN_DURATION)
      const eased = t * t * (3 - 2 * t) // smoothstep
      g.scale.set(eased, eased, eased)
      if (mesh) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms['uAlpha']!.value = eased
      }
      const lbl = g.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (lbl) (lbl.element as HTMLElement).style.opacity = String(eased)
      if (t >= 1) {
        fadeIns.delete(g)
        if (mesh) {
          const mat = mesh.material as THREE.ShaderMaterial
          mat.uniforms['uAlpha']!.value = 1
        }
      }
    } else if (!isCombining) {
      // Smooth hover schaling (niet tijdens combine of fade-in)
      const current = hoverScales.get(g) ?? 0
      const target = g === hoveredGroup ? 1 : 0
      const newVal = current + (target - current) * Math.min(1, hoverSpeed * delta)
      hoverScales.set(g, newVal)
      const scale = 1 + newVal * 0.3 // max 30% groter
      g.scale.set(scale, scale, scale)

      // Fade niet-combinerende cubes uit tijdens combine animatie
      if (mesh) {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms['uAlpha']!.value = nonCombineOpacity
      }
      const lbl = g.children.find((c) => c instanceof CSS2DObject) as CSS2DObject | undefined
      if (lbl) (lbl.element as HTMLElement).style.opacity = String(nonCombineOpacity)
    }
  })

  // Flash fade-out updaten
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
