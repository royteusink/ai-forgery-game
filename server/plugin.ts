import type { Plugin } from 'vite'
import { loadCache } from './cache'
import { handleCacheElements } from './cache-elements'
import { handleCombine } from './combine'

export function combineApiPlugin(lang: string = 'en_US', shaderMaxLines: number = 30): Plugin {
  const cache = loadCache()

  return {
    name: 'combine-api',
    configureServer(server) {
      server.middlewares.use('/api/cache-elements', handleCacheElements(cache))
      server.middlewares.use('/api/combine', handleCombine(cache, lang, shaderMaxLines))
    },
  }
}
