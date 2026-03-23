import { defineConfig } from 'vite'
import { combineApiPlugin } from './server/plugin'

export default defineConfig({
  plugins: [combineApiPlugin()],
})
