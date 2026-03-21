import type { Element } from './types'

export async function combineElements(a: Element, b: Element): Promise<Element> {
  const response = await fetch('/api/combine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elementA: a.name, elementB: b.name }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Combinatie mislukt: ${error}`)
  }

  return response.json() as Promise<Element>
}
