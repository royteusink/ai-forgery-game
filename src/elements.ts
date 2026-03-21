import type { Element } from './types'

const STARTER_ELEMENTS: Element[] = [
  {
    id: 'water',
    name: 'Water',
    color: '#3b82f6',
    description: 'Water is een transparante, geurloze vloeistof die essentieel is voor al het leven op aarde. Het bestaat uit twee waterstofatomen en één zuurstofatoom (H₂O).',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Water',
  },
  {
    id: 'fire',
    name: 'Vuur',
    color: '#ef4444',
    description: 'Vuur is een snelle oxidatiereactie die licht en warmte produceert. Het is een van de vier klassieke elementen en was cruciaal voor de menselijke beschaving.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Vuur',
  },
  {
    id: 'gravel',
    name: 'Grind',
    color: '#9ca3af',
    description: 'Grind is een mengsel van afgeronde steentjes, ontstaan door verwering en erosie. Het wordt veel gebruikt in de bouw en als verharding.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Grind',
  },
  {
    id: 'sand',
    name: 'Zand',
    color: '#d4b483',
    description: 'Zand is een korrelig materiaal bestaande uit fijne gesteentedeeltjes, vooral kwarts. Het komt voor op stranden, in woestijnen en op de zeebodem.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Zand',
  },
  {
    id: 'gold',
    name: 'Goud',
    color: '#d9a926',
    description: 'Goud is een zacht, glanzend edelmetaal met atoomnummer 79. Het wordt al duizenden jaren gebruikt als sieraad en betaalmiddel vanwege zijn zeldzaamheid en schoonheid.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Goud',
  },
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
