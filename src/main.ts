import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { ElementStore } from './elements'
import { GameUI } from './ui'
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
scene.background = new THREE.Color(0x0a0a14)

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 5, 5)
scene.add(dirLight)

// Element cubes in scene
const cubeGroup = new THREE.Group()
scene.add(cubeGroup)

const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)

function createCubeMesh(element: Element): THREE.Group {
  const material = new THREE.MeshPhongMaterial({
    color: new THREE.Color(element.color),
    shininess: 120,
    specular: 0x444444,
  })
  const mesh = new THREE.Mesh(geometry, material)

  const labelDiv = document.createElement('div')
  labelDiv.textContent = element.name
  labelDiv.style.cssText = 'color: #e2e8f0; font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; text-shadow: 0 1px 4px rgba(0,0,0,0.8); white-space: nowrap; transform: translate(-50%, 0);'
  const label = new CSS2DObject(labelDiv)
  label.position.set(0, 0, 0)

  const group = new THREE.Group()
  group.add(mesh)
  group.add(label)
  group.userData['elementId'] = element.id
  return group
}

const circleRadius = 2

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

  elements.forEach((el, i) => {
    const mesh = createCubeMesh(el)
    const angle = (i / elements.length) * Math.PI * 2
    mesh.position.set(
      Math.cos(angle) * circleRadius,
      Math.sin(angle) * circleRadius,
      0,
    )
    cubeGroup.add(mesh)
  })
}

// Store & UI
const store = new ElementStore()

function onNewElement(_result: Element): void {
  layoutCubes()
}

new GameUI(store, onNewElement)
layoutCubes()
store.onChange(() => layoutCubes())

// Animation
function animate(): void {
  requestAnimationFrame(animate)

  // Draai de hele cirkel langzaam rond
  cubeGroup.rotation.z += 0.004

  // Alleen de mesh laten roteren, niet het label
  cubeGroup.children.forEach((group) => {
    const mesh = group.children.find((c) => c instanceof THREE.Mesh)
    if (mesh) {
      mesh.rotation.x += 0.008
      mesh.rotation.y += 0.012
    }
  })

  renderer.render(scene, camera)
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
