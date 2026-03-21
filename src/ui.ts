import type { Element } from './types'
import { ElementStore } from './elements'
import { combineElements } from './api'

export class GameUI {
  private store: ElementStore
  private selected: Element[] = []
  private container: HTMLDivElement
  private resultOverlay: HTMLDivElement
  private onCombine: (result: Element) => void

  constructor(store: ElementStore, onCombine: (result: Element) => void) {
    this.store = store
    this.onCombine = onCombine

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

  private render(): void {
    const elements = this.store.getAll()
    this.container.innerHTML = `
      <div class="inventory-label">Elementen <span class="inventory-count">(${elements.length})</span></div>
      <div class="inventory-grid">
        ${elements.map((el) => this.renderElement(el)).join('')}
      </div>
      <div class="combine-area">
        <div class="combine-slot">${this.selected[0] ? this.renderSlot(this.selected[0]) : '<span class="empty">?</span>'}</div>
        <span class="combine-plus">+</span>
        <div class="combine-slot">${this.selected[1] ? this.renderSlot(this.selected[1]) : '<span class="empty">?</span>'}</div>
        <button class="combine-btn" ${this.selected.length < 2 ? 'disabled' : ''}>Combineer</button>
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

  private selectElement(id: string): void {
    const el = this.store.findById(id)
    if (!el) return

    const idx = this.selected.findIndex((s) => s.id === id)
    if (idx >= 0) {
      this.selected.splice(idx, 1)
    } else if (this.selected.length < 2) {
      this.selected.push(el)
    }
    this.render()
  }

  private async doCombine(): Promise<void> {
    if (this.selected.length < 2) return

    const a = this.selected[0]!
    const b = this.selected[1]!
    const btn = this.container.querySelector('.combine-btn') as HTMLButtonElement
    btn.disabled = true
    btn.textContent = 'Bezig...'

    try {
      const result = await combineElements(a, b)
      this.store.add(result)
      this.onCombine(result)
      this.showResult(a, b, result)
      this.selected = []
      this.render()
    } catch (err) {
      this.showError(String(err))
      btn.disabled = false
      btn.textContent = 'Combineer'
    }
  }

  private showResult(a: Element, b: Element, result: Element): void {
    this.resultOverlay.style.display = 'flex'
    this.resultOverlay.innerHTML = `
      <div class="result-card">
        <div class="result-formula">
          <span style="color:${a.color}">${a.name}</span>
          <span class="result-op">+</span>
          <span style="color:${b.color}">${b.name}</span>
          <span class="result-op">=</span>
        </div>
        <div class="result-new">
          <div class="element-cube large" style="background: ${result.color}"></div>
          <div class="result-name">${result.name}</div>
        </div>
        <button class="result-close">OK</button>
      </div>
    `
    this.resultOverlay.querySelector('.result-close')?.addEventListener('click', () => {
      this.resultOverlay.style.display = 'none'
    })
    this.resultOverlay.addEventListener('click', (e) => {
      if (e.target === this.resultOverlay) this.resultOverlay.style.display = 'none'
    })
  }

  private showError(msg: string): void {
    this.resultOverlay.style.display = 'flex'
    this.resultOverlay.innerHTML = `
      <div class="result-card error">
        <div class="result-name">Fout</div>
        <p>${msg}</p>
        <button class="result-close">OK</button>
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
        background: rgba(10, 10, 20, 0.92);
        backdrop-filter: blur(12px);
        border-top: 1px solid rgba(255,255,255,0.1);
        padding: 16px 24px;
        font-family: system-ui, sans-serif;
        color: #e2e8f0;
        z-index: 100;
      }
      .inventory-label {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #94a3b8;
        margin-bottom: 10px;
      }
      .inventory-count { color: #64748b; }
      .inventory-grid {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
        max-height: 120px;
        overflow-y: auto;
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
      #result-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 200;
      }
      .result-card {
        background: #1e293b;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 32px;
        text-align: center;
        min-width: 280px;
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
      .result-close:hover { background: rgba(255,255,255,0.15); }
    `
    document.head.appendChild(style)
  }
}
