import type { Element } from '../types'
import type { Locale } from './index'

const starterElements: Element[] = [
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
    description: 'Grind is een mengsel van afgeronde stenen, gevormd door verwering en erosie. Het wordt veel gebruikt in de bouw en als verhardingsmateriaal.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Grind_(gesteente)',
  },
  {
    id: 'sand',
    name: 'Zand',
    color: '#d4b483',
    description: 'Zand is een korrelig materiaal dat bestaat uit fijne gesteentedeeltjes, voornamelijk kwarts. Het komt voor op stranden, in woestijnen en op de zeebodem.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Zand',
  },
  {
    id: 'gold',
    name: 'Goud',
    color: '#d9a926',
    description: 'Goud is een zacht, glanzend edelmetaal met atoomnummer 79. Het wordt al duizenden jaren gebruikt als sieraad en betaalmiddel vanwege zijn zeldzaamheid en schoonheid.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Goud',
  },
  {
    id: 'wood',
    name: 'Hout',
    color: '#8B5E3C',
    description: 'Hout is een natuurlijk materiaal dat wordt geoogst van bomen. Het wordt al eeuwenlang gebruikt voor constructie, meubels en brandstof.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Hout',
  },
  {
    id: 'crystal',
    name: 'Kristal',
    color: '#a78bfa',
    description: 'Een kristal is een vaste stof waarvan de atomen in een geordend, herhalend patroon zijn gerangschikt. Kristallen komen voor in mineralen, edelstenen en ijs.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Kristal',
  },
  {
    id: 'quartz',
    name: 'Kwarts',
    color: '#e8dcc8',
    description: 'Kwarts is een van de meest voorkomende mineralen op aarde. Het bestaat uit silicium en zuurstof (SiO₂) en komt in vele variëteiten voor zoals bergkristal, amethist en rozenkwarts.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Kwarts',
  },
  {
    id: 'ore',
    name: 'Erts',
    color: '#8b4513',
    description: 'Erts is een natuurlijk gesteente dat metalen of waardevolle mineralen bevat. Door smelten en raffineren worden metalen zoals ijzer, koper en goud eruit gewonnen.',
    wikipediaUrl: 'https://nl.wikipedia.org/wiki/Erts',
  },
]

export const nl_NL: Locale = {
  lang: 'nl',
  starterElements,
  ui: {
    elements: 'Elementen',
    loadAll: 'Alles laden',
    loading: 'Laden...',
    combine: 'Combineer',
    working: 'Bezig...',
    ok: 'OK',
    close: 'Sluiten',
    error: 'Fout',
    noDescription: 'Geen beschrijving beschikbaar.',
    viewOnWikipedia: 'Bekijk op Wikipedia &rarr;',
  },
}
