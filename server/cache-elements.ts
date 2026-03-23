import type { IncomingMessage, ServerResponse } from 'http'
import type { Cache } from './cache'

export function handleCacheElements(cache: Cache) {
  return (_req: IncomingMessage, res: ServerResponse) => {
    const seen = new Set<string>()
    const elements: Array<{ id: string; name: string; color: string; description: string; wikipediaUrl: string; shader?: string }> = []
    for (const value of Object.values(cache)) {
      if (!seen.has(value.id)) {
        seen.add(value.id)
        elements.push({
          id: value.id,
          name: value.name,
          color: value.color,
          description: value.description,
          wikipediaUrl: value.wikipediaUrl,
          ...(value.shader ? { shader: value.shader } : {}),
        })
      }
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(elements))
  }
}
