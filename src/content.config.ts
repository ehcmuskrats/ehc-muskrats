import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// News and game recaps: one Markdown file per post per language.
//   src/content/news/de/2026-11-16-sieg-gegen-transistor.md
//   src/content/news/en/2026-11-16-win-against-transistor.md
// Set `gameId` to the league game UUID to link a recap with its game page.
// Use the same `translationKey` in both language versions to link them.
const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    lang: z.enum(['de', 'en']),
    summary: z.string().optional(),
    gameId: z.string().uuid().optional(),
    translationKey: z.string().optional(),
    author: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { news };
