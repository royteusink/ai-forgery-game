import { defineConfig, loadEnv } from 'vite'
import { combineApiPlugin } from './server/plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const lang = env.VITE_LANG || 'en_US'

  return {
    plugins: [combineApiPlugin(lang)],
  }
})
