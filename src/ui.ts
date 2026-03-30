import * as THREE from 'three'
import type { Element } from './types'
import { ElementStore } from './elements'
import { combineElements, fetchCacheElements } from './api'
import { createElementMaterial } from './shaders'
import { addFadeIn } from './fade'
import { locale } from './locales'

export class GameUI {
  private store: ElementStore
  private selected: Element[] = []
  private container: HTMLDivElement
  private resultOverlay: HTMLDivElement
  private infoOverlay: HTMLDivElement
  private onCombineStart?: (elementIds: string[]) => void
  private onCombineEnd?: (result?: Element) => void
  private miniRenderer: THREE.WebGLRenderer | null = null
  private miniAnimId: number | null = null
  private infoMiniRenderer: THREE.WebGLRenderer | null = null
  private infoMiniAnimId: number | null = null
  private gridExpanded = false
  private combining = false

  constructor(store: ElementStore) {
    this.store = store

    this.container = document.createElement('div')
    this.container.id = 'inventory'
    document.body.appendChild(this.container)

    this.resultOverlay = document.createElement('div')
    this.resultOverlay.id = 'result-overlay'
    this.resultOverlay.hidden = true
    document.body.appendChild(this.resultOverlay)

    this.infoOverlay = document.createElement('div')
    this.infoOverlay.id = 'info-overlay'
    this.infoOverlay.hidden = true
    document.body.appendChild(this.infoOverlay)

    this.render()

    store.onChange(() => this.render())
  }

  setCombineCallbacks(onStart: (elementIds: string[]) => void, onEnd: (result?: Element) => void): void {
    this.onCombineStart = onStart
    this.onCombineEnd = onEnd
  }

  private render(): void {
    const elements = this.store.getAll()
    this.container.innerHTML = `
      <div class="inventory-header">
        <div class="inventory-toggle">${this.gridExpanded ? '▾' : '▸'} ${locale.ui.elements} <span class="inventory-count">(${elements.length})</span></div>
        <button class="load-cache-btn" ${this.combining ? 'disabled' : ''}>${locale.ui.loadAll}</button>
      </div>
      <div class="inventory-grid ${this.gridExpanded ? 'expanded' : 'collapsed'}">
        ${elements.map((el) => this.renderElement(el)).join('')}
      </div>
      <div class="combine-area">
        <div class="combine-slot">${this.selected[0] ? this.renderSlot(this.selected[0]) : '<span class="empty">?</span>'}</div>
        <span class="combine-plus">+</span>
        <div class="combine-slot">${this.selected[1] ? this.renderSlot(this.selected[1]) : '<span class="empty">?</span>'}</div>
        <span class="combine-plus">+</span>
        <div class="combine-slot">${this.selected[2] ? this.renderSlot(this.selected[2]) : '<span class="empty">?</span>'}</div>
        <button class="combine-btn" ${this.selected.length < 2 || this.combining ? 'disabled' : ''}>${this.combining ? locale.ui.working : locale.ui.combine}</button>
      </div>
    `

    this.container.querySelectorAll('.element-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.id!
        this.selectElement(id)
      })
    })

    this.container.querySelectorAll('.combine-slot').forEach((slot, i) => {
      slot.addEventListener('click', () => {
        if (this.selected[i]) {
          this.selected.splice(i, 1)
          this.render()
        }
      })
    })

    const btn = this.container.querySelector('.combine-btn')
    btn?.addEventListener('click', () => this.doCombine())

    const loadBtn = this.container.querySelector('.load-cache-btn')
    loadBtn?.addEventListener('click', () => this.loadCacheElements())

    const toggle = this.container.querySelector('.inventory-toggle')
    toggle?.addEventListener('click', () => {
      this.gridExpanded = !this.gridExpanded
      this.render()
    })
  }

  private renderElement(el: Element): string {
    const isSelected = this.selected.some((s) => s.id === el.id)
    return `<div class="element-card ${isSelected ? 'selected' : ''}" data-id="${el.id}">
      <div class="element-cube" style="background: ${el.color}"></div>
      <span class="element-name">${el.name}</span>
    </div>`
  }

  private renderSlot(el: Element): string {
    return `<div class="slot-content">
      <div class="element-cube small" style="background: ${el.color}"></div>
      <span>${el.name}</span>
    </div>`
  }

  getSelectedIds(): string[] {
    return this.selected.map((s) => s.id)
  }

  selectElement(id: string): void {
    const el = this.store.findById(id)
    if (!el) return

    const idx = this.selected.findIndex((s) => s.id === id)
    if (idx >= 0) {
      this.selected.splice(idx, 1)
    } else if (this.selected.length < 3) {
      this.selected.push(el)
    }
    this.render()
  }

  private async loadCacheElements(): Promise<void> {
    const btn = this.container.querySelector('.load-cache-btn') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = locale.ui.loading
    try {
      const cached = await fetchCacheElements()
      const current = this.store.getAll()
      const seen = new Set(current.map((e) => e.id))
      const all = [...current]
      for (const el of cached) {
        if (!seen.has(el.id)) {
          seen.add(el.id)
          all.push(el)
        }
      }
      all.sort((a, b) => a.name.localeCompare(b.name, locale.lang))
      this.store.clear()
      for (const el of all) {
        addFadeIn(el.id)
        this.store.add(el)
        await new Promise((r) => setTimeout(r, 20))
      }
    } catch (err) {
      this.showError(String(err))
    }
    btn.disabled = false
    btn.textContent = locale.ui.loadAll
  }

  private async doCombine(): Promise<void> {
    if (this.selected.length < 2 || this.combining) return

    this.combining = true
    const elements = [...this.selected]
    this.render()

    // Start the 3D animation
    this.onCombineStart?.(elements.map((e) => e.id))

    try {
      const result = await combineElements(...elements)

      // Trigger flash + wait until it's done (pass result so store.add is in the animation flow)
      await new Promise<void>((resolve) => {
        this.onCombineEnd?.(result)
        setTimeout(resolve, 1200)
      })

      this.showResult(elements, result)
      this.selected = []
    } catch (err) {
      this.onCombineEnd?.()
      console.log('Combination failed:', err)
    }
    this.combining = false
    this.render()
  }

  private stopMiniScene(): void {
    if (this.miniAnimId !== null) {
      cancelAnimationFrame(this.miniAnimId)
      this.miniAnimId = null
    }
    if (this.miniRenderer) {
      this.miniRenderer.dispose()
      this.miniRenderer = null
    }
  }

  private startMiniScene(container: HTMLElement, element: Element): void {
    this.stopMiniScene()

    const size = 128
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    this.miniRenderer = renderer

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    camera.position.set(0, 0, 3)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = createElementMaterial(element.id, element.color)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const startTime = performance.now()
    const animate = () => {
      this.miniAnimId = requestAnimationFrame(animate)
      const elapsed = (performance.now() - startTime) / 1000
      mesh.rotation.x += 0.008
      mesh.rotation.y += 0.012
      if (material.uniforms?.['uTime']) {
        material.uniforms['uTime'].value = elapsed
      }
      renderer.render(scene, camera)
    }
    animate()
  }

  private stopInfoMiniScene(): void {
    if (this.infoMiniAnimId !== null) {
      cancelAnimationFrame(this.infoMiniAnimId)
      this.infoMiniAnimId = null
    }
    if (this.infoMiniRenderer) {
      this.infoMiniRenderer.dispose()
      this.infoMiniRenderer = null
    }
  }

  private startInfoMiniScene(container: HTMLElement, element: Element): void {
    this.stopInfoMiniScene()

    const size = 128
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)
    this.infoMiniRenderer = renderer

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    camera.position.set(0, 0, 3)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = createElementMaterial(element.id, element.color)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const startTime = performance.now()
    const animate = () => {
      this.infoMiniAnimId = requestAnimationFrame(animate)
      const elapsed = (performance.now() - startTime) / 1000
      mesh.rotation.x += 0.008
      mesh.rotation.y += 0.012
      if (material.uniforms?.['uTime']) {
        material.uniforms['uTime'].value = elapsed
      }
      renderer.render(scene, camera)
    }
    animate()
  }

  private showResult(ingredients: Element[], result: Element): void {
    const formula = ingredients
      .map((el) => `<span style="color:${el.color}">${el.name}</span>`)
      .join('<span class="result-op">+</span>')

    this.resultOverlay.hidden = false
    this.resultOverlay.innerHTML = `
      <div class="result-card">
        <div class="result-formula">
          ${formula}
          <span class="result-op">=</span>
        </div>
        <div class="result-new">
          <div class="result-cube-container"></div>
          <div class="result-name">${result.name}</div>
        </div>
        <button class="result-close">${locale.ui.ok}</button>
      </div>
    `

    const cubeContainer = this.resultOverlay.querySelector('.result-cube-container') as HTMLElement
    cubeContainer.classList.add('clickable')
    this.startMiniScene(cubeContainer, result)

    const closeModal = () => {
      this.stopMiniScene()
      this.resultOverlay.hidden = true
    }

    cubeContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.metaKey) {
        this.selectElement(result.id)
      } else {
        this.showElementInfo(result)
      }
    })

    this.resultOverlay.querySelector('.result-close')?.addEventListener('click', closeModal)

    this.resultOverlay.addEventListener('click', (e) => {
      if (e.target === this.resultOverlay) closeModal()
    })
  }

  showElementInfo(element: Element): void {
    this.stopInfoMiniScene()
    this.infoOverlay.hidden = false
    this.infoOverlay.innerHTML = `
      <div class="info-card">
        <div class="info-header">
          <div class="info-cube-container"></div>
          <div class="info-title">${element.name}</div>
        </div>
        <div class="info-image-container" hidden><img class="info-image" alt="${element.name}" /></div>
        ${element.description ? `<p class="info-description">${element.description}</p>` : `<p class="info-description muted">${locale.ui.noDescription}</p>`}
        ${element.wikipediaUrl ? `<a class="info-wiki-link" href="${element.wikipediaUrl}" target="_blank" rel="noopener noreferrer">${locale.ui.viewOnWikipedia}</a>` : ''}
        <button class="result-close">${locale.ui.close}</button>
      </div>
    `

    const cubeContainer = this.infoOverlay.querySelector('.info-cube-container') as HTMLElement
    this.startInfoMiniScene(cubeContainer, element)

    // Fetch image via Wikipedia REST API
    if (element.wikipediaUrl) {
      this.fetchWikiImage(element.wikipediaUrl).then((imageUrl) => {
        if (imageUrl) {
          const container = this.infoOverlay.querySelector('.info-image-container') as HTMLElement
          const img = container.querySelector('.info-image') as HTMLImageElement
          img.src = imageUrl
          img.onload = () => { container.removeAttribute('hidden') }
        }
      })
    }

    const closeModal = () => {
      this.stopInfoMiniScene()
      this.infoOverlay.hidden = true
    }
    this.infoOverlay.querySelector('.result-close')?.addEventListener('click', closeModal)
    this.infoOverlay.addEventListener('click', (e) => {
      if (e.target === this.infoOverlay) closeModal()
    })
  }

  private async fetchWikiImage(wikipediaUrl: string): Promise<string | null> {
    try {
      // Extract lang and title from URL: https://nl.wikipedia.org/wiki/Water
      const url = new URL(wikipediaUrl)
      const lang = url.hostname.split('.')[0]
      const title = decodeURIComponent(url.pathname.replace('/wiki/', ''))
      const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      const res = await fetch(apiUrl)
      if (!res.ok) return null
      const data = await res.json()
      return data.thumbnail?.source ?? data.originalimage?.source ?? null
    } catch {
      return null
    }
  }

  private showError(msg: string): void {
    this.resultOverlay.hidden = false
    this.resultOverlay.innerHTML = `
      <div class="result-card error">
        <div class="result-name">${locale.ui.error}</div>
        <p>${msg}</p>
        <button class="result-close">${locale.ui.ok}</button>
      </div>
    `
    this.resultOverlay.querySelector('.result-close')?.addEventListener('click', () => {
      this.resultOverlay.hidden = true
    })
  }

}
