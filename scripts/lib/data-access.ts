// Shared loaders for scripts (derive, validate, highlights).
import type { Game, SeasonData } from '../../src/types/models.ts';
import { listJson, readJson } from './io.ts';

export function loadSeasons(): SeasonData[] {
  return listJson('data/seasons')
    .map((f) => readJson<SeasonData>(`data/seasons/${f}`, null as any))
    .filter(Boolean)
    .sort((a, b) => b.info.id.localeCompare(a.info.id));
}

export function loadGames(): Map<string, Game> {
  const out = new Map<string, Game>();
  for (const f of listJson('data/games')) {
    const g = readJson<Game>(`data/games/${f}`, null as any);
    if (g) out.set(g.id, g);
  }
  return out;
}

export interface PlayerAliases {
  /** Merge player ids: { "<duplicateId>": <canonicalId> } */
  merge: Record<string, number>;
  /** Fix names: { "<id>": { "first": "...", "last": "..." } } */
  names: Record<string, { first?: string; last?: string }>;
  /**
   * WEHV re-issued player ids several times, so the same person can have 2–3 ids. Players of our
   * team with the same full name are merged automatically; list ids here to keep them separate
   * (only needed if two different people ever share a name).
   */
  keepSeparate: number[];
}

export function loadPlayerAliases(): PlayerAliases {
  const a = readJson<Partial<PlayerAliases>>('data/player-aliases.json', {});
  return { merge: a.merge ?? {}, names: a.names ?? {}, keepSeparate: a.keepSeparate ?? [] };
}
