// Computes derived data (player profiles, career totals, team records) from data/.
// Season totals per division come from the league's leader lists when available (official),
// otherwise from summing our boxscores. validate.ts compares the two.
import type {
  Derived,
  Game,
  GameSummary,
  PlayerGameLine,
  PlayerGoal,
  PlayerProfile,
  PlayerRef,
  PlayerSeasonLine,
  Position,
  SeasonData,
  SeasonId,
  TeamRecordGame,
  TeamRecords,
} from '../../src/types/models.ts';
import { TEAM, isOurTeam } from '../../src/config/team.ts';
import { loadGames, loadPlayerAliases, loadSeasons } from './data-access.ts';

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ourSide(g: GameSummary): 'home' | 'away' | null {
  if (isOurTeam(g.home)) return 'home';
  if (isOurTeam(g.away)) return 'away';
  return null;
}

export function resultFor(g: GameSummary): PlayerGameLine['result'] {
  const side = ourSide(g);
  if (!side || g.status !== 'final' || g.homeScore == null || g.awayScore == null) return null;
  const us = side === 'home' ? g.homeScore : g.awayScore;
  const them = side === 'home' ? g.awayScore : g.homeScore;
  const extra = g.overtime || g.shootout;
  if (us > them) return extra ? 'OTW' : 'W';
  if (us < them) return extra ? 'OTL' : 'L';
  return 'T';
}

const emptyLine = (season: SeasonId): PlayerSeasonLine => ({
  season,
  numbers: [],
  positions: [],
  gp: 0,
  g: 0,
  a: 0,
  p: 0,
  pim: 0,
  ppg: 0,
  shg: 0,
  gwg: 0,
  plusMinus: 0,
  sog: 0,
  goalieGp: 0,
  ga: 0,
  toi: 0,
  gaa: null,
  shotsAgainst: 0,
  saves: 0,
});

const addUnique = <T>(arr: T[], v: T | null | undefined) => {
  if (v !== null && v !== undefined && v !== '' && !arr.includes(v)) arr.push(v);
};

export function deriveAll(log: (m: string) => void = console.log): Derived {
  const seasons = loadSeasons();
  const games = loadGames();
  const aliases = loadPlayerAliases();
  const canon = (id: number) => aliases.merge[String(id)] ?? id;

  interface Acc {
    id: number;
    first: string;
    last: string;
    lastSeen: string;
    numbers: number[];
    positions: Position[];
    seasons: Map<SeasonId, PlayerSeasonLine>;
    games: PlayerGameLine[];
    goals: PlayerGoal[];
    goalieGames: number;
  }
  const players = new Map<number, Acc>();
  const touch = (p: PlayerRef, season: SeasonId): Acc => {
    const id = canon(p.id);
    let a = players.get(id);
    if (!a) {
      a = { id, first: p.first, last: p.last, lastSeen: season, numbers: [], positions: [], seasons: new Map(), games: [], goals: [], goalieGames: 0 };
      players.set(id, a);
    }
    if (season >= a.lastSeen) {
      // Prefer the most recent spelling of the name.
      if (p.first) a.first = p.first;
      if (p.last) a.last = p.last;
      a.lastSeen = season;
    }
    // League leader lists send 0 when the number is unknown; game reports have the real one.
    const num = p.number && p.number > 0 ? p.number : null;
    addUnique(a.numbers, num);
    if (!a.seasons.has(season)) a.seasons.set(season, emptyLine(season));
    addUnique(a.seasons.get(season)!.numbers, num);
    return a;
  };

  // Per (season, division): take totals from our boxscores when we have a report for every
  // final game we played there (they match the game pages exactly; the league's playoff
  // leader lists were found to miss games). Otherwise use the league leader lists.
  const completeBox = new Set<string>();
  for (const s of seasons) {
    const byDiv = new Map<number, GameSummary[]>();
    for (const g of s.games.filter((x) => ourSide(x) && x.status === 'final')) {
      if (!byDiv.has(g.divisionId)) byDiv.set(g.divisionId, []);
      byDiv.get(g.divisionId)!.push(g);
    }
    for (const [div, list] of byDiv) if (list.every((g) => games.has(g.id))) completeBox.add(`${s.info.id}:${div}`);
  }
  const leaderDivisions = new Set<string>();
  for (const s of seasons) {
    for (const st of s.stats) {
      const key = `${s.info.id}:${st.divisionId}`;
      if (completeBox.has(key)) continue;
      if (st.skaters.some((r) => r.teamId === TEAM.leagueTeamId) || st.goalies.some((r) => r.teamId === TEAM.leagueTeamId)) {
        leaderDivisions.add(key);
      }
    }
  }

  // 1) League leader lists, for divisions where our boxscores are incomplete.
  for (const s of seasons) {
    for (const st of s.stats) {
      if (!leaderDivisions.has(`${s.info.id}:${st.divisionId}`)) continue;
      for (const r of st.skaters.filter((x) => x.teamId === TEAM.leagueTeamId)) {
        const a = touch(r.player, s.info.id);
        const l = a.seasons.get(s.info.id)!;
        l.gp += r.gp;
        l.g += r.g;
        l.a += r.a;
        l.p += r.p;
        l.pim += r.pim;
        l.ppg += r.ppg;
        l.shg += r.shg;
        l.gwg += r.gwg;
        l.plusMinus += r.plusMinus;
        l.sog += r.sog;
        addUnique(l.positions, r.position);
      }
      for (const r of st.goalies.filter((x) => x.teamId === TEAM.leagueTeamId)) {
        const a = touch(r.player, s.info.id);
        const l = a.seasons.get(s.info.id)!;
        l.goalieGp += r.gp;
        l.ga += r.ga;
        l.toi += r.toi;
        l.shotsAgainst += r.shotsAgainst;
        l.saves += Math.max(0, r.shotsAgainst - r.ga);
        addUnique(l.positions, 'G');
      }
    }
  }

  // 2) Boxscores: game logs, goals, and totals for divisions without leader data.
  const summaries = new Map<string, GameSummary>();
  for (const s of seasons) for (const g of s.games) summaries.set(g.id, g);
  const ourGames = [...games.values()]
    .filter((g) => ourSide(g))
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  for (const g of ourGames) {
    const side = ourSide(g)!;
    const opp = side === 'home' ? g.away : g.home;
    const us = side === 'home' ? g.homeScore : g.awayScore;
    const them = side === 'home' ? g.awayScore : g.homeScore;
    const score = us != null && them != null ? `${us}:${them}` : '–';
    const result = resultFor(g);
    const useBox = !leaderDivisions.has(`${g.season}:${g.divisionId}`);
    const periodLen = g.periodLength || 0;

    for (const sk of g.skaters[side]) {
      const a = touch(sk.player, g.season);
      addUnique(a.positions, sk.position);
      const l = a.seasons.get(g.season)!;
      addUnique(l.positions, sk.position);
      if (useBox) {
        l.gp += 1;
        l.g += sk.g;
        l.a += sk.a;
        l.p += sk.g + sk.a;
        l.pim += sk.pim;
        l.plusMinus += sk.plusMinus;
        l.sog += sk.sog;
      }
      a.games.push({
        gameId: g.id,
        season: g.season,
        date: g.date,
        opponent: opp,
        home: side === 'home',
        result,
        score,
        position: sk.position,
        g: sk.g,
        a: sk.a,
        pim: sk.pim,
        goalie: null,
      });
    }
    for (const gl of g.goalies[side]) {
      const a = touch(gl.player, g.season);
      addUnique(a.positions, 'G');
      const l = a.seasons.get(g.season)!;
      addUnique(l.positions, 'G');
      if (gl.toi <= 0) continue; // dressed but didn't play
      a.goalieGames++;
      if (useBox) {
        l.goalieGp += 1;
        l.ga += gl.goalsAgainst;
        l.toi += gl.toi;
        l.shotsAgainst += gl.shotsAgainst;
        l.saves += gl.saves;
      }
      const existing = a.games.find((x) => x.gameId === g.id);
      const goalie = { ga: gl.goalsAgainst, toi: gl.toi };
      if (existing) existing.goalie = goalie;
      else
        a.games.push({ gameId: g.id, season: g.season, date: g.date, opponent: opp, home: side === 'home', result, score, position: 'G', g: 0, a: 0, pim: 0, goalie });
    }
    for (const goal of g.goals.filter((x) => x.team === side && x.scorer)) {
      const a = touch(goal.scorer!, g.season);
      a.goals.push({
        gameId: g.id,
        season: g.season,
        date: g.date,
        opponent: opp,
        period: goal.period,
        timeLabel: goal.timeLabel,
        situation: goal.situation,
        assists: goal.assists,
        gwg: goal.gwg,
      });
      if (useBox) {
        const l = a.seasons.get(g.season)!;
        if (goal.gwg) l.gwg++;
        if (/^PP/.test(goal.situation)) l.ppg++;
        if (/^SH/.test(goal.situation)) l.shg++;
      }
    }
    void periodLen;
  }

  // 3) Finalize profiles.
  // Leader lists only know F/D/G; game reports know C/LF/RF/LD/RD. Drop the generic one when a specific one exists.
  const refine = (pos: Position[]): Position[] => {
    const hasFwd = pos.some((x) => /^(C|LF|RF)$/.test(x));
    const hasDef = pos.some((x) => /^(LD|RD)$/.test(x));
    return pos.filter((x) => !(x === 'F' && hasFwd) && !(x === 'D' && hasDef));
  };
  const profiles: PlayerProfile[] = [...players.values()].map((a) => {
    a.positions = refine(a.positions);
    for (const l of a.seasons.values()) l.positions = refine(l.positions);
    const fix = aliases.names[String(a.id)];
    const first = fix?.first ?? a.first;
    const last = fix?.last ?? a.last;
    const seasonLines = [...a.seasons.values()]
      .filter((l) => l.gp > 0 || l.goalieGp > 0 || l.positions.length)
      .sort((x, y) => y.season.localeCompare(x.season));
    for (const l of seasonLines) {
      // GAA normalised to a 60-minute game would be wrong here (75-minute games), so GAA = GA per game played.
      l.gaa = l.goalieGp > 0 ? Math.round((l.ga / l.goalieGp) * 100) / 100 : null;
    }
    const career = seasonLines.reduce(
      (c, l) => {
        for (const k of ['gp', 'g', 'a', 'p', 'pim', 'ppg', 'shg', 'gwg', 'plusMinus', 'sog', 'goalieGp', 'ga', 'toi', 'shotsAgainst', 'saves'] as const)
          (c as any)[k] += l[k];
        return c;
      },
      { ...emptyLine(''), gaa: null as number | null },
    );
    career.gaa = career.goalieGp > 0 ? Math.round((career.ga / career.goalieGp) * 100) / 100 : null;
    const { season: _s, numbers: _n, positions: _p, ...careerRest } = career;
    const isGoalie = a.positions.includes('G') && seasonLines.reduce((n, l) => n + l.goalieGp, 0) >= seasonLines.reduce((n, l) => n + l.gp, 0);
    return {
      id: a.id,
      slug: `${a.id}-${slugify(`${first} ${last}`)}`,
      first,
      last,
      numbers: a.numbers,
      positions: a.positions,
      seasons: seasonLines,
      career: careerRest,
      games: a.games.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? '')),
      goals: a.goals.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? '')),
      isGoalie,
    };
  });
  profiles.sort((x, y) => x.last.localeCompare(y.last) || x.first.localeCompare(y.first));

  const derived: Derived = {
    generatedAt: new Date().toISOString(),
    players: profiles,
    records: teamRecords(seasons),
    columnAvailability: columnAvailability(seasons, games),
  };
  log(`Derived: ${profiles.length} players, ${ourGames.length} game reports.`);
  return derived;
}

function teamRecords(seasons: SeasonData[]): TeamRecords {
  let biggestWin: TeamRecordGame | null = null;
  let mostGoals: TeamRecordGame | null = null;
  const allTime = { gp: 0, w: 0, l: 0, otw: 0, otl: 0, ties: 0, gf: 0, ga: 0 };
  for (const s of seasons) {
    for (const g of s.games) {
      const side = ourSide(g);
      if (!side || g.status !== 'final' || g.homeScore == null || g.awayScore == null) continue;
      const us = side === 'home' ? g.homeScore : g.awayScore;
      const them = side === 'home' ? g.awayScore : g.homeScore;
      const opp = side === 'home' ? g.away : g.home;
      const rec: TeamRecordGame = { gameId: g.id, season: g.season, date: g.date, opponent: opp, score: `${us}:${them}`, margin: us - them, goalsFor: us };
      if (!biggestWin || rec.margin > biggestWin.margin) biggestWin = rec;
      if (!mostGoals || rec.goalsFor > mostGoals.goalsFor) mostGoals = rec;
      allTime.gp++;
      allTime.gf += us;
      allTime.ga += them;
      const r = resultFor(g);
      if (r === 'W') allTime.w++;
      else if (r === 'L') allTime.l++;
      else if (r === 'OTW') allTime.otw++;
      else if (r === 'OTL') allTime.otl++;
      else if (r === 'T') allTime.ties++;
    }
  }
  if (biggestWin && biggestWin.margin <= 0) biggestWin = null;
  let bestSeason: TeamRecords['bestSeason'] = null;
  for (const s of seasons) {
    if (!s.info.frozen) continue; // a season in progress can't be the "best season" yet
    for (const st of s.standings) {
      const row = st.rows.find((r) => isOurTeam(r.team));
      if (!row || row.gp === 0) continue;
      const regular = s.info.divisions.find((d) => d.id === st.divisionId)?.kind === 'regular';
      if (!regular) continue;
      const better =
        !bestSeason ||
        row.pts / row.gp > bestSeason.pts / bestSeason.gp ||
        (row.pts / row.gp === bestSeason.pts / bestSeason.gp && row.pts > bestSeason.pts);
      if (better) bestSeason = { season: s.info.id, divisionName: st.divisionName, pts: row.pts, gp: row.gp, rank: row.rank };
    }
  }
  return { biggestWin, mostGoals, bestSeason, allTime };
}

function columnAvailability(seasons: SeasonData[], games: Map<string, Game>): Derived['columnAvailability'] {
  const out: Derived['columnAvailability'] = {};
  for (const s of seasons) {
    const sid = s.info.id;
    // Only our games and our players count: other teams' rows in the league lists must not
    // switch a column on for our pages.
    const sg = [...games.values()].filter((g) => g.season === sid && ourSide(g));
    const skaterLines = sg.flatMap((g) => [...g.skaters.home, ...g.skaters.away]);
    const goalieLines = sg.flatMap((g) => [...g.goalies.home, ...g.goalies.away]);
    const leaders = s.stats.flatMap((st) => st.skaters).filter((r) => r.teamId === TEAM.leagueTeamId);
    const leaderGoalies = s.stats.flatMap((st) => st.goalies).filter((r) => r.teamId === TEAM.leagueTeamId);
    out[sid] = {
      sog: skaterLines.some((l) => l.sog !== 0) || leaders.some((l) => l.sog !== 0),
      plusMinus: skaterLines.some((l) => l.plusMinus !== 0) || leaders.some((l) => l.plusMinus !== 0),
      saves:
        goalieLines.some((l) => l.saves !== 0 || (l.savePct ?? 0) !== 0) ||
        leaderGoalies.some((l) => (l.savePct ?? 0) !== 0),
    };
  }
  return out;
}
