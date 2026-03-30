import { defineConfig, loadEnv } from 'vite'
import { combineApiPlugin } from './server/plugin'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const lang = env.VITE_LANG || 'en_US'
  const shaderMaxLines = Math.max(20, parseInt(env.VITE_SHADER_MAX_LINES || '30', 10))

  return {
    plugins: [combineApiPlugin(lang, shaderMaxLines)],
  }
})
