// League teams across seasons. WEHV re-issues team ids between seasons, but long names stay stable,
// so a team's identity on this site is the slug of its name. Used by match previews and opponent pages.
import type { GameSummary, SeasonId, StandingRow, TeamRef, TeamSeasonStats } from '../types/models.ts';
import { seasons, isOurGame, resultCode, teamName } from './data.ts';
import { isOurTeam } from '../config/team.ts';

export function slug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const teamKey = (t: TeamRef): string => (isOurTeam(t) ? 'ehc-muskrats' : slug(t.name));

export interface TeamInfo {
  key: string;
  name: string;
  /** Latest short code and logo we have. */
  short: string;
  team: TeamRef;
  seasons: SeasonId[];
}

/** Every opponent we have played, newest data first. */
export function opponents(): TeamInfo[] {
  const m = new Map<string, TeamInfo>();
  for (const s of seasons) {
    for (const g of s.games) {
      if (!isOurGame(g)) continue;
      const opp = isOurTeam(g.home) ? g.away : g.home;
      const k = teamKey(opp);
      const cur = m.get(k);
      if (!cur) m.set(k, { key: k, name: teamName(opp), short: opp.short, team: opp, seasons: [s.info.id] });
      else if (!cur.seasons.includes(s.info.id)) cur.seasons.push(s.info.id);
    }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function opponent(key: string): TeamInfo | undefined {
  return opponents().find((x) => x.key === key);
}

const final = (g: GameSummary) => g.status === 'final' && g.homeScore != null && g.awayScore != null;
const sortTs = (a: GameSummary, b: GameSummary) => (a.timestamp ?? 0) - (b.timestamp ?? 0);

/** A game result from one team's perspective. */
export interface TeamResult {
  game: GameSummary;
  opponent: TeamRef;
  gf: number;
  ga: number;
  result: 'W' | 'L' | 'OTW' | 'OTL' | 'T';
  home: boolean;
}

function resultFor(g: GameSummary, key: string): TeamResult | null {
  if (!final(g)) return null;
  const home = teamKey(g.home) === key;
  if (!home && teamKey(g.away) !== key) return null;
  const gf = (home ? g.homeScore : g.awayScore)!;
  const ga = (home ? g.awayScore : g.homeScore)!;
  const extra = g.overtime || g.shootout;
  const result = gf > ga ? (extra ? 'OTW' : 'W') : gf < ga ? (extra ? 'OTL' : 'L') : 'T';
  return { game: g, opponent: home ? g.away : g.home, gf, ga, result, home };
}

/** Last n finished games of a team in a season (any round), before a timestamp; newest first. */
export function form(key: string, season: SeasonId, n = 5, before = Infinity): TeamResult[] {
  const s = seasons.find((x) => x.info.id === season);
  if (!s) return [];
  return s.games
    .filter((g) => (g.timestamp ?? 0) < before)
    .sort(sortTs)
    .map((g) => resultFor(g, key))
    .filter((x): x is TeamResult => x != null)
    .slice(-n)
    .reverse();
}

/** All finished games between us and a team, newest first (results from OUR perspective). */
export function headToHead(key: string): TeamResult[] {
  return seasons
    .flatMap((s) => s.games)
    .filter((g) => isOurGame(g) && (teamKey(g.home) === key || teamKey(g.away) === key))
    .sort(sortTs)
    .map((g) => resultFor(g, 'ehc-muskrats'))
    .filter((x): x is TeamResult => x != null)
    .reverse();
}

export function tally(list: TeamResult[]) {
  const t = { gp: list.length, w: 0, l: 0, t: 0, gf: 0, ga: 0 };
  for (const r of list) {
    t.gf += r.gf;
    t.ga += r.ga;
    if (r.result === 'W' || r.result === 'OTW') t.w++;
    else if (r.result === 'L' || r.result === 'OTL') t.l++;
    else t.t++;
  }
  return t;
}

/** Standing of a team in a season: the division of a given game, else the regular season. */
export function standing(key: string, season: SeasonId, divisionId?: number): { row: StandingRow; teams: number; division: string } | null {
  const s = seasons.find((x) => x.info.id === season);
  if (!s) return null;
  const pick =
    (divisionId != null && s.standings.find((st) => st.divisionId === divisionId && st.rows.some((r) => teamKey(r.team) === key))) ||
    s.standings.find((st) => s.info.divisions.find((d) => d.id === st.divisionId)?.kind === 'regular' && st.rows.some((r) => teamKey(r.team) === key));
  if (!pick) return null;
  const row = pick.rows.find((r) => teamKey(r.team) === key)!;
  return { row, teams: pick.rows.length, division: pick.divisionName };
}

/** Power play / penalty kill etc. for a team in a season's regular round (league team stats). */
export function teamStats(key: string, season: SeasonId): TeamSeasonStats | null {
  const s = seasons.find((x) => x.info.id === season);
  if (!s) return null;
  for (const st of s.stats) {
    const kind = s.info.divisions.find((d) => d.id === st.divisionId)?.kind;
    if (kind !== 'regular') continue;
    const row = st.teams.find((t) => teamKey(t.team) === key);
    if (row) return row;
  }
  return null;
}

/** Seasons (newest first) in which a team appears in the league at all. */
export function seasonsOf(key: string): SeasonId[] {
  return seasons.filter((s) => s.games.some((g) => teamKey(g.home) === key || teamKey(g.away) === key)).map((s) => s.info.id);
}

export { resultCode };
