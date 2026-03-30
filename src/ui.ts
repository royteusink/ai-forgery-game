import * as THREE from 'three'
import type { Element } from './types'
import { ElementStore } from './elements'
import { combineElements, fetchCacheElements } from './api'
import { createElementMaterial } from './shaders'
import { locale } from './locales'

export class GameUI {
  private store: ElementStore
  private selected: Element[] = []
  private container: HTMLDivElement
  private resultOverlay: HTMLDivElement
  private onCombineStart?: (elementIds: string[]) => void
  private onCombineEnd?: (result?: Element) => void
  private miniRenderer: THREE.WebGLRenderer | null = null
  private miniAnimId: number | null = null
  private gridExpanded = false

  constructor(store: ElementStore) {
    this.store = store

    this.container = document.createElement('div')
    this.container.id = 'inventory'
    document.body.appendChild(this.container)

    this.resultOverlay = document.createElement('div')
    this.resultOverlay.id = 'result-overlay'
    this.resultOverlay.style.display = 'none'
    document.body.appendChild(this.resultOverlay)

    this.injectStyles()
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
        <button class="load-cache-btn">${locale.ui.loadAll}</button>
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
        <button class="combine-btn" ${this.selected.length < 2 ? 'disabled' : ''}>${locale.ui.combine}</button>
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
      const elements = await fetchCacheElements()
      elements.sort((a, b) => a.name.localeCompare(b.name, locale.lang))
      for (const el of elements) {
        this.store.add(el)
      }
    } catch (err) {
      this.showError(String(err))
    }
    btn.disabled = false
    btn.textContent = locale.ui.loadAll
  }

  private async doCombine(): Promise<void> {
    if (this.selected.length < 2) return

    const elements = [...this.selected]
    const btn = this.container.querySelector('.combine-btn') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = locale.ui.working

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
      this.render()
    } catch (err) {
      this.onCombineEnd?.()
      console.log('Combination failed:', err)
      btn.disabled = false
      btn.textContent = locale.ui.combine
    }
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

  private showResult(ingredients: Element[], result: Element): void {
    const formula = ingredients
      .map((el) => `<span style="color:${el.color}">${el.name}</span>`)
      .join('<span class="result-op">+</span>')

    this.resultOverlay.style.display = 'flex'
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
    this.startMiniScene(cubeContainer, result)

    const closeModal = () => {
      this.stopMiniScene()
      this.resultOverlay.style.display = 'none'
    }
    this.resultOverlay.querySelector('.result-close')?.addEventListener('click', closeModal)
    this.resultOverlay.addEventListener('click', (e) => {
      if (e.target === this.resultOverlay) closeModal()
    })
  }

  showElementInfo(element: Element): void {
    this.stopMiniScene()
    this.resultOverlay.style.display = 'flex'
    this.resultOverlay.innerHTML = `
      <div class="info-card">
        <div class="info-header">
          <div class="info-cube-container"></div>
          <div class="info-title">${element.name}</div>
        </div>
        <div class="info-image-container" style="display:none"><img class="info-image" alt="${element.name}" /></div>
        ${element.description ? `<p class="info-description">${element.description}</p>` : `<p class="info-description" style="color:#64748b">${locale.ui.noDescription}</p>`}
        ${element.wikipediaUrl ? `<a class="info-wiki-link" href="${element.wikipediaUrl}" target="_blank" rel="noopener noreferrer">${locale.ui.viewOnWikipedia}</a>` : ''}
        <button class="result-close">${locale.ui.close}</button>
      </div>
    `

    const cubeContainer = this.resultOverlay.querySelector('.info-cube-container') as HTMLElement
    this.startMiniScene(cubeContainer, element)

    // Fetch image via Wikipedia REST API
    if (element.wikipediaUrl) {
      this.fetchWikiImage(element.wikipediaUrl).then((imageUrl) => {
        if (imageUrl) {
          const container = this.resultOverlay.querySelector('.info-image-container') as HTMLElement
          const img = container.querySelector('.info-image') as HTMLImageElement
          img.src = imageUrl
          img.onload = () => { container.style.display = '' }
        }
      })
    }

    const closeModal = () => {
      this.stopMiniScene()
      this.resultOverlay.style.display = 'none'
    }
    this.resultOverlay.querySelector('.result-close')?.addEventListener('click', closeModal)
    this.resultOverlay.addEventListener('click', (e) => {
      if (e.target === this.resultOverlay) closeModal()
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
    this.resultOverlay.style.display = 'flex'
    this.resultOverlay.innerHTML = `
      <div class="result-card error">
        <div class="result-name">${locale.ui.error}</div>
        <p>${msg}</p>
        <button class="result-close">${locale.ui.ok}</button>
      </div>
    `
    this.resultOverlay.querySelector('.result-close')?.addEventListener('click', () => {
      this.resultOverlay.style.display = 'none'
    })
  }

  private injectStyles(): void {
    const style = document.createElement('style')
    style.textContent = `
      #inventory {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(10, 10, 20, 0.2);
        backdrop-filter: blur(12px);
        border-top: 1px solid rgba(255,255,255,0.1);
        padding: 16px 24px;
        font-family: sans-serif;
        color: #e2e8f0;
        z-index: 100;
      }
      .inventory-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .load-cache-btn {
        padding: 4px 12px;
        background: rgba(255,255,255,0.08);
        color: #94a3b8;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .load-cache-btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); color: #e2e8f0; }
      .load-cache-btn:disabled { opacity: 0.4; cursor: default; }
      .inventory-toggle {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
        cursor: pointer;
        user-select: none;
      }
      .inventory-toggle:hover { color: #e2e8f0; }
      .inventory-count { color: #64748b; }
      .inventory-grid {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
        max-height: 60vh;
        overflow-y: auto;
        transition: max-height 0.25s ease, opacity 0.25s ease;
      }
      .inventory-grid.collapsed {
        max-height: 0;
        overflow: hidden;
        margin-bottom: 0;
        opacity: 0;
      }
      .inventory-grid.expanded {
        opacity: 1;
      }
      .element-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .element-card:hover { background: rgba(255,255,255,0.1); }
      .element-card.selected {
        border-color: #3b82f6;
        background: rgba(59,130,246,0.15);
      }
      .element-cube {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .element-cube.small { width: 22px; height: 22px; }
      .element-cube.large { width: 64px; height: 64px; border-radius: 8px; }
      .element-name { font-size: 11px; color: #cbd5e1; }
      .combine-area {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .combine-slot {
        min-width: 80px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,0.03);
        border: 1px dashed rgba(255,255,255,0.15);
        border-radius: 8px;
        padding: 0 12px;
        cursor: pointer;
      }
      .combine-slot .empty { color: #475569; font-size: 20px; }
      .slot-content {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      .combine-plus { color: #64748b; font-size: 18px; font-weight: bold; }
      .combine-btn {
        margin-left: 12px;
        padding: 10px 24px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
      }
      .combine-btn:hover:not(:disabled) { background: #2563eb; }
      .combine-btn:disabled { opacity: 0.3; cursor: default; }
      @keyframes overlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes cardFadeIn {
        from { opacity: 0; transform: scale(0.9) translateY(16px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      #result-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 200;
        animation: overlayFadeIn 0.3s ease-out;
      }
      .result-card {
        background: rgba(30, 41, 59,0.5);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        min-width: 280px;
        animation: cardFadeIn 0.35s ease-out;
      }
      .result-card.error { border-color: #ef4444; }
      .result-formula {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 20px;
      }
      .result-op { color: #64748b; }
      .result-new {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
      }
      .result-name {
        font-size: 24px;
        font-weight: 700;
        color: #f1f5f9;
      }
      .result-close {
        padding: 8px 32px;
        background: rgba(255,255,255,0.1);
        color: #e2e8f0;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
      }
      .result-cube-container {
        width: 128px;
        height: 128px;
      }
      .result-cube-container canvas {
        border-radius: 8px;
      }
      .result-close:hover { background: rgba(255,255,255,0.15); }
      .info-card {
        background: rgba(30, 41, 59,0.5);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        min-width: 320px;
        max-width: 420px;
        animation: cardFadeIn 0.35s ease-out;
      }
      .info-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      .info-title {
        font-size: 28px;
        font-weight: 700;
        color: #f1f5f9;
      }
      .info-image-container {
        margin-bottom: 16px;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
        aspect-ratio: 16 / 9;
        background: rgba(255,255,255,0.03);
      }
      .info-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .info-description {
        font-size: 14px;
        line-height: 1.6;
        color: #cbd5e1;
        margin: 0 0 16px 0;
        text-align: left;
      }
      .info-wiki-link {
        display: inline-block;
        margin-bottom: 20px;
        padding: 8px 20px;
        background: rgba(59,130,246,0.15);
        color: #60a5fa;
        border: 1px solid rgba(59,130,246,0.3);
        border-radius: 8px;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.15s;
      }
      .info-wiki-link:hover {
        background: rgba(59,130,246,0.25);
        color: #93bbfc;
      }
      .info-cube-container {
        width: 128px;
        height: 128px;
      }
      .info-cube-container canvas {
        border-radius: 8px;
      }
    `
    document.head.appendChild(style)
  }
}
