import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/index.ts';
import { autoRecaps, type Recap } from './recaps.ts';

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


/** One item in the News list: a hand-written post or an automatic recap. */
export type NewsItem =
  | { kind: 'post'; slug: string; date: Date; title: string; summary?: string; gameId?: string; post: NewsEntry }
  | { kind: 'auto'; slug: string; date: Date; title: string; summary: string; gameId: string; recap: Recap };

/** Hand-written posts plus automatic recaps; a hand-written recap of a game replaces the automatic one. */
export async function newsItems(lang: Lang): Promise<NewsItem[]> {
  const posts = await newsFor(lang);
  const covered = new Set(posts.map((p) => p.data.gameId).filter(Boolean));
  const items: NewsItem[] = [
    ...posts.map((p) => ({ kind: 'post' as const, slug: newsSlug(p), date: p.data.date, title: p.data.title, summary: p.data.summary, gameId: p.data.gameId, post: p })),
    ...autoRecaps(lang)
      .filter((r) => !covered.has(r.gameId))
      .map((r) => ({ kind: 'auto' as const, slug: r.slug, date: r.date, title: r.title, summary: r.summary, gameId: r.gameId, recap: r })),
  ];
  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Recap (hand-written or automatic) for a game page link. */
export async function recapLink(lang: Lang, gameId: string): Promise<string | undefined> {
  return (await newsItems(lang)).find((i) => i.gameId === gameId)?.slug;
}
