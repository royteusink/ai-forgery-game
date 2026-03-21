import * as THREE from 'three'

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Camera — fixed position, looks at origin
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 3)

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a14)

// Soft ambient fill
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)

// Key light with specular
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 5, 5)
scene.add(dirLight)

// Cube
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshPhongMaterial({
  color: 0xaab8c2,
  shininess: 120,
  specular: 0x888888,
})
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.005
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}
animate()

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
