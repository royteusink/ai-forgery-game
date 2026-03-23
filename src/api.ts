import type { Element } from './types'
import { registerShader } from './shaders'

export async function fetchCacheElements(): Promise<Element[]> {
  const response = await fetch('/api/cache-elements')
  if (!response.ok) throw new Error('Cache ophalen mislukt')
  const data: Array<Element & { shader?: string }> = await response.json()
  for (const el of data) {
    if (el.shader) registerShader(el.id, el.shader)
  }
  return data.map(({ id, name, color, description, wikipediaUrl }) => ({ id, name, color, description, wikipediaUrl }))
}

export async function combineElements(...elements: Element[]): Promise<Element> {
  const response = await fetch('/api/combine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elements: elements.map((e) => e.name) }),
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
