// Season-by-season history and achievements, computed from the league data (nothing typed in).
// Used by the About / Geschichte page and the season summaries.
import type { PlayoffInfo, SeasonId, StandingRow } from '../types/models.ts';
import { ourSeasons, ourGames, resultCode } from './data.ts';
import { isOurTeam } from '../config/team.ts';

export type PlayoffOutcome = 'champion' | 'final' | 'semifinal' | 'quarterfinal' | 'cancelled' | null;

export interface SeasonHistory {
  season: SeasonId;
  label: string;
  /** Regular-season (Grunddurchgang) finish. */
  regular: { rank: number; teams: number; row: StandingRow } | null;
  /** Placement round after the regular season (TOP 4 / LOW 5 ...), if any. */
  placement: { name: string; rank: number; teams: number } | null;
  /** How far we got: champion, lost in the final, semifinal, quarterfinal; cancelled when a series had no winner. */
  playoffs: PlayoffOutcome;
  /** Series we played, in order: round + won/lost/cancelled + opponent. */
  series: { round: PlayoffInfo['round']; result: 'W' | 'L' | 'C'; opponent: string; score: string }[];
  record: { gp: number; w: number; l: number; t: number; gf: number; ga: number };
  inProgress: boolean;
}

const ROUND_ORDER: PlayoffInfo['round'][] = ['quarterfinal', 'semifinal', 'final'];

export function seasonHistory(): SeasonHistory[] {
  return ourSeasons.map((s) => {
    const regularSt = s.standings.find((st) => s.info.divisions.find((d) => d.id === st.divisionId)?.kind === 'regular');
    const row = regularSt?.rows.find((r) => isOurTeam(r.team));
    const placementSt = s.standings.find((st) => s.info.divisions.find((d) => d.id === st.divisionId)?.kind === 'placement' && st.rows.some((r) => isOurTeam(r.team)));
    const pRow = placementSt?.rows.find((r) => isOurTeam(r.team));

    const series: SeasonHistory['series'] = [];
    for (const ph of s.playoffs?.phases ?? []) {
      const e = ph.encounters.find((x) => x.teams.some((t) => isOurTeam(t.team)));
      if (!e) continue;
      const us = e.teams.find((t) => isOurTeam(t.team))!;
      const them = e.teams.find((t) => !isOurTeam(t.team));
      // WEHV sometimes leaves the winner flag empty (2022/23 final: one game played, "best of 3").
      // In a finished season, a series with games played goes to the team with more wins;
      // only a series with no games at all (2019/20, season cancelled) counts as cancelled.
      const flagged = e.teams.some((t) => t.winner);
      const played = e.teams.reduce((n, t) => n + t.wins, 0) > 0;
      const won = flagged ? us.winner : us.wins > (them?.wins ?? 0);
      const result: 'W' | 'L' | 'C' = flagged || (played && s.info.frozen) ? (won ? 'W' : 'L') : 'C';
      series.push({
        round: ph.round,
        result,
        opponent: them?.team.short || them?.team.name || '',
        score: `${us.wins}:${them?.wins ?? 0}`,
      });
    }
    series.sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round));
    const last = series.at(-1);
    let playoffs: PlayoffOutcome = null;
    if (last) {
      if (last.result === 'C') playoffs = 'cancelled';
      else if (last.round === 'final') playoffs = last.result === 'W' ? 'champion' : 'final';
      else if (last.round === 'semifinal' || last.round === 'quarterfinal') playoffs = last.round;
    }
    // A series we won that isn't followed by another one in a finished season means the next round is missing
    // from the data; keep the round we know about.

    const record = { gp: 0, w: 0, l: 0, t: 0, gf: 0, ga: 0 };
    for (const g of ourGames(s.info.id)) {
      const r = resultCode(g);
      if (!r) continue;
      const home = isOurTeam(g.home);
      record.gp++;
      record.gf += (home ? g.homeScore : g.awayScore) ?? 0;
      record.ga += (home ? g.awayScore : g.homeScore) ?? 0;
      if (r === 'W' || r === 'OTW') record.w++;
      else if (r === 'L' || r === 'OTL') record.l++;
      else record.t++;
    }

    return {
      season: s.info.id,
      label: s.info.label,
      regular: row && regularSt ? { rank: row.rank, teams: regularSt.rows.length, row } : null,
      placement: pRow && placementSt ? { name: placementSt.divisionName, rank: pRow.rank, teams: placementSt.rows.length } : null,
      playoffs,
      series,
      record,
      inProgress: !s.info.frozen,
    };
  });
}

export interface Achievements {
  titles: SeasonHistory[];
  finals: SeasonHistory[];
  regularWins: SeasonHistory[];
  regularSecond: SeasonHistory[];
  playoffSeasons: number;
  seasons: number;
  firstSeason: string;
}

export function achievements(h = seasonHistory()): Achievements {
  const done = h.filter((x) => !x.inProgress);
  return {
    titles: h.filter((x) => x.playoffs === 'champion'),
    finals: h.filter((x) => x.playoffs === 'final'),
    regularWins: done.filter((x) => x.regular?.rank === 1),
    regularSecond: done.filter((x) => x.regular?.rank === 2),
    playoffSeasons: h.filter((x) => x.series.length > 0).length,
    seasons: h.length,
    firstSeason: h.at(-1)?.label ?? '',
  };
}
