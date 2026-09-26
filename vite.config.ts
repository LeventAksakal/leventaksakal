import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    // Subset lettering fonts are a few KB each; inline them.
    assetsInlineLimit: 8192,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        strokes: resolve(import.meta.dirname, 'lab/strokes/index.html'),
        paste: resolve(import.meta.dirname, 'lab/paste/index.html'),
      },
    },
  },
})
