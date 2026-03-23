import { readFileSync, writeFileSync, existsSync } from 'fs'

const CACHE_FILE = './combine-cache.json'

export type CachedElement = {
  id: string
  name: string
  color: string
  description: string
  wikipediaUrl: string
  shader?: string
}

export type Cache = Record<string, CachedElement>

export function loadCache(): Cache {
  if (existsSync(CACHE_FILE)) {
    try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) } catch { return {} }
  }
  return {}
}

export function saveCache(cache: Cache): void {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
}

export function cacheKey(elements: string[]): string {
  return [...elements].sort().join('+')
}
