import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/index.ts';

export type NewsEntry = CollectionEntry<'news'>;

/** URL slug of a post: the file name without folder and extension. */
export function newsSlug(e: NewsEntry): string {
  return e.id.split('/').pop()!.replace(/\.md$/, '');
}

export async function newsFor(lang: Lang): Promise<NewsEntry[]> {
  const all = await getCollection('news', (e) => e.data.lang === lang && !e.data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function recapForGame(lang: Lang, gameId: string): Promise<NewsEntry | undefined> {
  return (await newsFor(lang)).find((e) => e.data.gameId === gameId);
}
