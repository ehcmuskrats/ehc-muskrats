// Build-time access to the synced data in /data. Everything here runs only during `astro build`.
import type {
  Derived,
  Game,
  GameSummary,
  HighlightMatch,
  HighlightsData,
  PlayerProfile,
  SeasonData,
  SeasonId,
  TeamRef,
} from '../types/models.ts';
import { TEAM, isOurTeam, displayTeamName } from '../config/team.ts';
import { SITE } from '../config/site.ts';

const seasonFiles = import.meta.glob<SeasonData>('/data/seasons/*.json', { eager: true, import: 'default' });
const gameFiles = import.meta.glob<Game>('/data/games/*.json', { eager: true, import: 'default' });
const derivedFile = import.meta.glob<Derived>('/data/derived.json', { eager: true, import: 'default' });
const highlightsFile = import.meta.glob<HighlightsData>('/data/highlights.json', { eager: true, import: 'default' });
const statusFile = import.meta.glob<{ lastRun: string; ok: boolean }>('/data/sync-status.json', { eager: true, import: 'default' });
const aliasesFile = import.meta.glob<{ names?: Record<string, { first?: string; last?: string }> }>('/data/player-aliases.json', {
  eager: true,
  import: 'default',
});
const extrasFile = import.meta.glob<{ players: Record<string, { photo?: string; bio?: { de?: string; en?: string } }> }>(
  '/data/player-extras.json',
  { eager: true, import: 'default' },
);

// Display fixes applied to every loaded file: player name overrides (data/player-aliases.json "names")
// and our official logo. Name overrides apply to every player reference,
// so a renamed player reads the same on profiles, game reports, stats tables and leader lists.
const nameFixes = Object.values(aliasesFile)[0]?.names ?? {};
function applyDisplayFixes<T>(root: T): T {
  const seen = new Set<object>();
  const walk = (o: any) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (Array.isArray(o)) return o.forEach(walk);
    // Our own team always shows the official club logo (WEHV serves an older one).
    if (typeof o.id === 'number' && 'logo' in o && typeof o.name === 'string' && isOurTeam(o)) o.logo = 'logo.svg';
    if (typeof o.id === 'number' && typeof o.last === 'string' && 'first' in o) {
      const fix = nameFixes[String(o.id)];
      if (fix) {
        if (fix.first) o.first = fix.first;
        if (fix.last) o.last = fix.last;
      }
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(root);
  return root;
}
Object.values(seasonFiles).forEach(applyDisplayFixes);
Object.values(gameFiles).forEach(applyDisplayFixes);
Object.values(derivedFile).forEach(applyDisplayFixes);

export const seasons: SeasonData[] = Object.values(seasonFiles).sort((a, b) => b.info.id.localeCompare(a.info.id));
export const games = new Map<string, Game>(Object.values(gameFiles).map((g) => [g.id, g]));
export const derived: Derived = Object.values(derivedFile)[0] ?? {
  generatedAt: '',
  players: [],
  records: { biggestWin: null, mostGoals: null, bestSeason: null, allTime: { gp: 0, w: 0, l: 0, otw: 0, otl: 0, ties: 0, gf: 0, ga: 0 } },
  columnAvailability: {},
};
export const highlights: HighlightsData = Object.values(highlightsFile)[0] ?? { fetchedAt: null, channelId: TEAM.youtube.channelId, items: [] };
export const syncStatus = Object.values(statusFile)[0] ?? null;
export const playerExtras = Object.values(extrasFile)[0]?.players ?? {};

/** Seasons in which we played, newest first. */
export const ourSeasons = seasons.filter((s) => s.info.muskratsPlays);

export const currentSeasonId: SeasonId =
  SITE.currentSeasonOverride ?? ourSeasons[0]?.info.id ?? seasons[0]?.info.id ?? '';

export function season(id: SeasonId): SeasonData | undefined {
  return seasons.find((s) => s.info.id === id);
}

export function isOurGame(g: GameSummary): boolean {
  return isOurTeam(g.home) || isOurTeam(g.away);
}

export function ourGames(seasonId?: SeasonId): GameSummary[] {
  const list = (seasonId ? seasons.filter((s) => s.info.id === seasonId) : seasons).flatMap((s) => s.games);
  return list.filter(isOurGame);
}

export function side(g: GameSummary): 'home' | 'away' {
  return isOurTeam(g.home) ? 'home' : 'away';
}

export function opponent(g: GameSummary): TeamRef {
  return side(g) === 'home' ? g.away : g.home;
}

export function teamName(t: TeamRef): string {
  return displayTeamName(t);
}

export function ourScore(g: GameSummary): { us: number | null; them: number | null } {
  return side(g) === 'home' ? { us: g.homeScore, them: g.awayScore } : { us: g.awayScore, them: g.homeScore };
}

export function resultOf(g: GameSummary): 'W' | 'L' | 'T' | null {
  const { us, them } = ourScore(g);
  if (g.status !== 'final' || us == null || them == null) return null;
  return us > them ? 'W' : us < them ? 'L' : 'T';
}

/** W / L / OTW / OTL / T from our perspective. */
export function resultCode(g: GameSummary): 'W' | 'L' | 'OTW' | 'OTL' | 'T' | null {
  const r = resultOf(g);
  if (!r || r === 'T') return r;
  const extra = g.overtime || g.shootout;
  return extra ? (r === 'W' ? 'OTW' : 'OTL') : r;
}

/** CSS class suffix for a result code. */
export function resultClass(code: string | null): 'W' | 'L' | 'T' {
  return code === 'W' || code === 'OTW' ? 'W' : code === 'L' || code === 'OTL' ? 'L' : 'T';
}

export function sortByDate(list: GameSummary[], dir: 1 | -1 = 1): GameSummary[] {
  return [...list].sort((a, b) => dir * ((a.timestamp ?? Infinity) - (b.timestamp ?? Infinity)));
}

/** Highlights linked to a game (matched or pinned). */
export function highlightFor(gameId: string): HighlightMatch | undefined {
  return highlights.items.find((h) => h.gameId === gameId && (h.status === 'matched' || h.status === 'override'));
}

export const gamesWithHighlights = new Set(
  highlights.items.filter((h) => h.gameId && (h.status === 'matched' || h.status === 'override')).map((h) => h.gameId!),
);

export function player(id: number): PlayerProfile | undefined {
  return derived.players.find((p) => p.id === id);
}

export function playerSlug(id: number): string | null {
  return player(id)?.slug ?? null;
}

export function columns(seasonId: SeasonId) {
  return derived.columnAvailability[seasonId] ?? { sog: false, plusMinus: false, saves: false };
}

export function logoUrl(t: TeamRef): string | null {
  return t.logo;
}
