// robots.txt: everything may be crawled; points search engines to the sitemap.
// Note: search engines only read robots.txt at the root of a domain, so this takes effect
// once the site runs on its own domain (e.g. ehc-muskrats.at). The sitemap works either way.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const sitemap = new URL(`${base}sitemap-index.xml`, site).toString();
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
