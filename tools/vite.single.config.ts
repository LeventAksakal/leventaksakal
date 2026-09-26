// Builds one lab page as a single JS bundle with inlined assets, for sharing as one HTML file.
// Usage: LAB=paste|strokes|site OUT=/some/dir npx vite build -c tools/vite.single.config.ts
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, '..')
export default defineConfig({
  root,
  build: {
    outDir: process.env.OUT ?? resolve(root, 'dist-single'),
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      input: process.env.LAB === 'site' ? resolve(root, 'index.html') : resolve(root, `lab/${process.env.LAB ?? 'paste'}/index.html`),
      output: { inlineDynamicImports: true },
    },
  },
})
