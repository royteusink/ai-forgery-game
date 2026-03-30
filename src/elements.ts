import type { Element } from './types'
import { locale } from './locales'

export class ElementStore {
  private elements: Element[] = [...locale.starterElements]
  private listeners: Array<() => void> = []

  getAll(): Element[] {
    return [...this.elements].sort((a, b) => a.name.localeCompare(b.name, locale.lang))
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
