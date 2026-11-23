// All-time (career) totals per phase, shared by the all-time leaderboards and the full player table.
// Phase: 'all' = regular season + placement rounds + playoffs, 'regular' = everything but playoffs, 'playoffs'.
// GP counts every game a player dressed for, as a skater or in net (otherwise goalies never appear).
import type { PlayerProfile } from '../types/models.ts';
import { derived } from './data.ts';

export type Phase = 'all' | 'regular' | 'playoffs';
export type StatKey = 'gp' | 'g' | 'a' | 'p' | 'pim';
export const PHASES: Phase[] = ['all', 'regular', 'playoffs'];
export const STATS: StatKey[] = ['p', 'g', 'a', 'pim', 'gp'];
/** Points per game only counts from this many games (a season is about 12). */
export const PPG_MIN_GP = 3;

export interface Totals {
  gp: number;
  g: number;
  a: number;
  p: number;
  pim: number;
  seasons: number;
}

export function totals(p: PlayerProfile, phase: Phase): Totals {
  const src = phase === 'all' ? { seasons: p.seasons, career: p.career } : phase === 'regular' ? p.regular : p.playoffs;
  const c = src.career;
  return {
    gp: c.gp + c.goalieGp,
    g: c.g,
    a: c.a,
    p: c.p,
    pim: c.pim,
    seasons: src.seasons.filter((s) => s.gp > 0 || s.goalieGp > 0).length,
  };
}

/** Competition ranking: equal values share a rank, the next rank skips (1, 2, 2, 4). */
export function tieRanks<T>(sorted: T[], value: (x: T) => number): number[] {
  const out: number[] = [];
  sorted.forEach((x, i) => {
    out.push(i > 0 && value(x) === value(sorted[i - 1]) ? out[i - 1] : i + 1);
  });
  return out;
}

/** Top n of a stat in a phase, with tie ranks. Players tied on the cut-off are all included. */
export function leaders(key: StatKey, phase: Phase, n = 10) {
  const rows = derived.players
    .map((p) => ({ p, t: totals(p, phase) }))
    .filter((r) => r.t[key] > 0)
    .sort((a, b) => b.t[key] - a.t[key] || b.t.p - a.t.p || a.p.last.localeCompare(b.p.last));
  const ranks = tieRanks(rows, (r) => r.t[key]);
  return rows.map((r, i) => ({ ...r, rank: ranks[i] })).filter((r) => r.rank <= n);
}
