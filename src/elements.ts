import type { Element } from './types'

const STARTER_ELEMENTS: Element[] = [
  { id: 'water', name: 'Water', color: '#3b82f6' },
  { id: 'fire', name: 'Vuur', color: '#ef4444' },
  { id: 'earth', name: 'Aarde', color: '#78350f' },
  { id: 'gold', name: 'Goud', color: '#d9a926' },
]

export class ElementStore {
  private elements: Element[] = [...STARTER_ELEMENTS]
  private listeners: Array<() => void> = []

  getAll(): Element[] {
    return [...this.elements]
  }

  findById(id: string): Element | undefined {
    return this.elements.find((e) => e.id === id)
  }

  add(element: Element): void {
    if (!this.elements.find((e) => e.id === element.id)) {
      this.elements.push(element)
      this.notify()
    }
  }

  onChange(listener: () => void): void {
    this.listeners.push(listener)
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn())
  }
}
