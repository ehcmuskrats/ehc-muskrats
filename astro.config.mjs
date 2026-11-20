// @ts-check
import { defineConfig } from 'astro/config';

// On GitHub Pages the site lives at https://<user>.github.io/<repo>/ unless you use a custom
// domain. The deploy workflow sets SITE_URL and BASE_PATH automatically.
const site = process.env.SITE_URL || 'https://example.github.io';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  output: 'static',
  i18n: {
    locales: ['de', 'en'],
    defaultLocale: 'de',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  build: { format: 'directory' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
