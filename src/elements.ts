import type { Element } from './types'

const STARTER_ELEMENTS: Element[] = [
  {
    id: 'water',
    name: 'Water',
    color: '#3b82f6',
    description: 'Water is a transparent, odorless liquid that is essential for all life on Earth. It consists of two hydrogen atoms and one oxygen atom (H₂O).',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Water',
  },
  {
    id: 'fire',
    name: 'Fire',
    color: '#ef4444',
    description: 'Fire is a rapid oxidation reaction that produces light and heat. It is one of the four classical elements and was crucial for human civilization.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Fire',
  },
  {
    id: 'gravel',
    name: 'Gravel',
    color: '#9ca3af',
    description: 'Gravel is a mixture of rounded stones, formed by weathering and erosion. It is widely used in construction and as paving material.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Gravel',
  },
  {
    id: 'sand',
    name: 'Sand',
    color: '#d4b483',
    description: 'Sand is a granular material consisting of fine rock particles, mainly quartz. It is found on beaches, in deserts, and on the seabed.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Sand',
  },
  {
    id: 'gold',
    name: 'Gold',
    color: '#d9a926',
    description: 'Gold is a soft, shiny precious metal with atomic number 79. It has been used for thousands of years as jewelry and currency due to its rarity and beauty.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Gold',
  },
  {
    id: 'wood',
    name: 'Wood',
    color: '#8B5E3C',
    description: 'Wood is a natural material harvested from trees. It has been used for centuries for construction, furniture, and fuel.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Wood',
  },
  {
    id: 'crystal',
    name: 'Crystal',
    color: '#a78bfa',
    description: 'A crystal is a solid whose atoms are arranged in an ordered, repeating pattern. Crystals are found in minerals, gemstones, and ice.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Crystal',
  },
  {
    id: 'quartz',
    name: 'Quartz',
    color: '#e8dcc8',
    description: 'Quartz is one of the most common minerals on Earth. It is composed of silicon and oxygen (SiO₂) and comes in many varieties such as rock crystal, amethyst, and rose quartz.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Quartz',
  },
  {
    id: 'ore',
    name: 'Ore',
    color: '#8b4513',
    description: 'Ore is a natural rock that contains metals or valuable minerals. Through smelting and refining, metals such as iron, copper, and gold are extracted from it.',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Ore',
  },
]

export class ElementStore {
  private elements: Element[] = [...STARTER_ELEMENTS]
  private listeners: Array<() => void> = []

  getAll(): Element[] {
    return [...this.elements].sort((a, b) => a.name.localeCompare(b.name, 'en'))
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
