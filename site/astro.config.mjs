// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://leventaksakal.com',
  integrations: [sitemap()],
  // Two small stylesheets: inlined, they stop blocking the first paint on a slow connection.
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});
