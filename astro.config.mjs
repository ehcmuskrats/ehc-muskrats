// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// On GitHub Pages the site lives at https://<user>.github.io/<repo>/ unless you use a custom
// domain. The deploy workflow sets SITE_URL and BASE_PATH automatically (also for a custom domain).
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
  integrations: [
    // sitemap-index.xml + sitemap-0.xml for search engines, with de/en alternates per page.
    sitemap({
      i18n: { defaultLocale: 'de', locales: { de: 'de-AT', en: 'en' } },
      // Leave out the language-redirect root page and the 404 page.
      filter: (page) => !/\/404\/?$/.test(page) && new URL(page).pathname.replace(base, '/') !== '/',
    }),
  ],
  build: { format: 'directory' },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
