import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** O HMR do dev precisa de ws://localhost; o build de produção sai com a CSP sem ele. */
const productionCsp = (): Plugin => ({
  name: 'vagalume-production-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace(' ws://localhost:*', '')
})

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), productionCsp()]
  }
})
