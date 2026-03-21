import type { Element } from './types'
import { registerShader } from './shaders'

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

  const data: Element & { shader?: string } = await response.json()

  if (data.shader) {
    registerShader(data.id, data.shader)
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    description: data.description,
    wikipediaUrl: data.wikipediaUrl,
  }
}
