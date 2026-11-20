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
  TeamRecordCard,
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
  number: null,
  position: null,
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
  dressed: 0,
});

const addUnique = <T>(arr: T[], v: T | null | undefined) => {
  if (v !== null && v !== undefined && v !== '' && !arr.includes(v)) arr.push(v);
};

export function deriveAll(log: (m: string) => void = console.log): Derived {
  const seasons = loadSeasons();
  const games = loadGames();
  const aliases = loadPlayerAliases();

  // Same person, several league ids: WEHV re-issued ids (2016/17, 2017/18, 2021/22), splitting careers.
  // Our players with the same full name are merged onto the id used most recently, so current
  // profile URLs stay stable. Manual "merge" entries win; "keepSeparate" opts ids out.
  const normName = (p: PlayerRef) =>
    `${p.first} ${p.last}`.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const lastSeenById = new Map<number, { name: string; season: SeasonId }>();
  const seen = (p: PlayerRef | null | undefined, season: SeasonId) => {
    if (!p || !p.first || !p.last) return;
    const prev = lastSeenById.get(p.id);
    if (!prev || season > prev.season) lastSeenById.set(p.id, { name: normName(p), season });
  };
  for (const s of seasons) {
    for (const st of s.stats) {
      for (const r of [...st.skaters, ...st.goalies]) if (r.teamId === TEAM.leagueTeamId) seen(r.player, s.info.id);
    }
  }
  for (const g of games.values()) {
    const side = ourSide(g);
    if (!side) continue;
    for (const x of [...g.skaters[side], ...g.goalies[side]]) seen(x.player, g.season);
    for (const gl of g.goals.filter((x) => x.team === side)) {
      seen(gl.scorer, g.season);
      for (const a of gl.assists) seen(a, g.season);
    }
  }
  const byName = new Map<string, { id: number; season: SeasonId }[]>();
  for (const [id, v] of lastSeenById) {
    if (aliases.keepSeparate.includes(id)) continue;
    if (!byName.has(v.name)) byName.set(v.name, []);
    byName.get(v.name)!.push({ id, season: v.season });
  }
  const autoMerge = new Map<number, number>();
  let mergedPeople = 0;
  for (const list of byName.values()) {
    if (list.length < 2) continue;
    mergedPeople++;
    const keep = [...list].sort((a, b) => b.season.localeCompare(a.season) || b.id - a.id)[0].id;
    for (const x of list) if (x.id !== keep) autoMerge.set(x.id, keep);
  }
  const canon = (id: number) => aliases.merge[String(id)] ?? autoMerge.get(id) ?? id;

  interface Acc {
    id: number;
    first: string;
    last: string;
    lastSeen: string;
    numbers: number[];
    positions: Position[];
    seasons: Map<SeasonId, PlayerSeasonLine>;
    /** Same totals split by phase: key `${season}|regular` or `${season}|playoffs`. */
    phases: Map<string, PlayerSeasonLine>;
    games: PlayerGameLine[];
    goals: PlayerGoal[];
    goalieGames: number;
  }
  const players = new Map<number, Acc>();
  const touch = (p: PlayerRef, season: SeasonId): Acc => {
    const id = canon(p.id);
    let a = players.get(id);
    if (!a) {
      a = { id, first: p.first, last: p.last, lastSeen: season, numbers: [], positions: [], seasons: new Map(), phases: new Map(), games: [], goals: [], goalieGames: 0 };
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
  /** The season-total line and the phase line for (season, phase); every stat is added to both. */
  const linesFor = (a: Acc, season: SeasonId, playoffs: boolean): PlayerSeasonLine[] => {
    const key = `${season}|${playoffs ? 'playoffs' : 'regular'}`;
    if (!a.phases.has(key)) a.phases.set(key, emptyLine(season));
    return [a.seasons.get(season)!, a.phases.get(key)!];
  };
  const isPlayoffDivision = new Map<string, boolean>();
  for (const s of seasons) for (const d of s.info.divisions) isPlayoffDivision.set(`${s.info.id}:${d.id}`, d.kind === 'playoffs');
  const gameIsPlayoff = (g: GameSummary) => !!g.playoff || isPlayoffDivision.get(`${g.season}:${g.divisionId}`) === true;

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
      const po = isPlayoffDivision.get(`${s.info.id}:${st.divisionId}`) === true;
      for (const r of st.skaters.filter((x) => x.teamId === TEAM.leagueTeamId)) {
        const a = touch(r.player, s.info.id);
        for (const l of linesFor(a, s.info.id, po)) {
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
      }
      for (const r of st.goalies.filter((x) => x.teamId === TEAM.leagueTeamId)) {
        const a = touch(r.player, s.info.id);
        for (const l of linesFor(a, s.info.id, po)) {
          l.goalieGp += r.gp;
          l.ga += r.ga;
          l.toi += r.toi;
          l.shotsAgainst += r.shotsAgainst;
          l.saves += Math.max(0, r.shotsAgainst - r.ga);
          addUnique(l.positions, 'G');
        }
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
    const po = gameIsPlayoff(g);

    for (const sk of g.skaters[side]) {
      const a = touch(sk.player, g.season);
      addUnique(a.positions, sk.position);
      for (const l of linesFor(a, g.season, po)) {
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
      }
      a.games.push({
        gameId: g.id,
        season: g.season,
        date: g.date,
        opponent: opp,
        home: side === 'home',
        number: sk.player.number && sk.player.number > 0 ? sk.player.number : null,
        playoff: po,
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
      const gLines = linesFor(a, g.season, po);
      for (const l of gLines) addUnique(l.positions, 'G');
      if (gl.toi <= 0) {
        // On the sheet as backup but didn't play: still part of that season's team.
        for (const l of gLines) l.dressed += 1;
        continue;
      }
      a.goalieGames++;
      if (useBox) {
        for (const l of gLines) {
          l.goalieGp += 1;
          l.ga += gl.goalsAgainst;
          l.toi += gl.toi;
          l.shotsAgainst += gl.shotsAgainst;
          l.saves += gl.saves;
        }
      }
      const existing = a.games.find((x) => x.gameId === g.id);
      const goalie = { ga: gl.goalsAgainst, toi: gl.toi };
      if (existing) existing.goalie = goalie;
      else
        a.games.push({
          gameId: g.id,
          season: g.season,
          date: g.date,
          opponent: opp,
          home: side === 'home',
          number: gl.player.number && gl.player.number > 0 ? gl.player.number : null,
          playoff: po,
          result,
          score,
          position: 'G',
          g: 0,
          a: 0,
          pim: 0,
          goalie,
        });
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
        playoff: po,
      });
      if (useBox) {
        for (const l of linesFor(a, g.season, po)) {
          if (goal.gwg) l.gwg++;
          if (/^PP/.test(goal.situation)) l.ppg++;
          if (/^SH/.test(goal.situation)) l.shg++;
        }
      }
    }
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
    for (const l of [...a.seasons.values(), ...a.phases.values()]) l.positions = refine(l.positions);
    const fix = aliases.names[String(a.id)];
    const first = fix?.first ?? a.first;
    const last = fix?.last ?? a.last;
    // Most recent game first: it decides the number/position the site shows (history stays in numbers/positions).
    const gamesDesc = [...a.games].sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
    const finalize = (list: PlayerSeasonLine[], gameFilter: (x: PlayerGameLine) => boolean) => {
      const lines = list.filter((l) => l.gp > 0 || l.goalieGp > 0 || l.dressed > 0).sort((x, y) => y.season.localeCompare(x.season));
      for (const l of lines) {
        // GAA normalised to a 60-minute game would be wrong here (75-minute games), so GAA = GA per game played.
        l.gaa = l.goalieGp > 0 ? Math.round((l.ga / l.goalieGp) * 100) / 100 : null;
        const lastGame = gamesDesc.find((x) => x.season === l.season && gameFilter(x));
        l.number = lastGame?.number ?? l.numbers[0] ?? null;
        l.position = lastGame?.position ?? (l.goalieGp > l.gp ? 'G' : l.positions[0]) ?? null;
      }
      const c = lines.reduce(
        (acc, l) => {
          for (const k of ['gp', 'g', 'a', 'p', 'pim', 'ppg', 'shg', 'gwg', 'plusMinus', 'sog', 'goalieGp', 'ga', 'toi', 'shotsAgainst', 'saves'] as const)
            (acc as any)[k] += l[k];
          return acc;
        },
        { ...emptyLine(''), gaa: null as number | null },
      );
      c.gaa = c.goalieGp > 0 ? Math.round((c.ga / c.goalieGp) * 100) / 100 : null;
      const { season: _s, numbers: _n, positions: _p, number: _no, position: _po, ...rest } = c;
      return { lines, career: rest };
    };
    const all = finalize([...a.seasons.values()], () => true);
    const reg = finalize(
      [...a.phases.entries()].filter(([k]) => k.endsWith('|regular')).map(([, v]) => v),
      (x) => !x.playoff,
    );
    const po = finalize(
      [...a.phases.entries()].filter(([k]) => k.endsWith('|playoffs')).map(([, v]) => v),
      (x) => x.playoff,
    );
    const seasonLines = all.lines;
    const careerRest = all.career;
    const currentNumber = gamesDesc.find((x) => x.number != null)?.number ?? seasonLines[0]?.number ?? null;
    const currentPosition = gamesDesc[0]?.position ?? seasonLines[0]?.position ?? null;
    const isGoalie = a.positions.includes('G') && seasonLines.reduce((n, l) => n + l.goalieGp, 0) >= seasonLines.reduce((n, l) => n + l.gp, 0);
    return {
      id: a.id,
      slug: `${a.id}-${slugify(`${first} ${last}`)}`,
      first,
      last,
      numbers: a.numbers,
      positions: a.positions,
      currentNumber,
      currentPosition,
      seasons: seasonLines,
      career: careerRest,
      regular: { seasons: reg.lines, career: reg.career },
      playoffs: { seasons: po.lines, career: po.career },
      games: a.games.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? '')),
      goals: a.goals.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? '')),
      isGoalie,
    };
  });
  profiles.sort((x, y) => x.last.localeCompare(y.last) || x.first.localeCompare(y.first));

  const derived: Derived = {
    generatedAt: new Date().toISOString(),
    players: profiles,
    records: teamRecords(seasons, games, canon, profiles),
    columnAvailability: columnAvailability(seasons, games),
  };
  log(`Derived: ${profiles.length} players (${mergedPeople} merged across league ids), ${ourGames.length} game reports.`);
  return derived;
}

function teamRecords(
  seasons: SeasonData[],
  games: Map<string, Game>,
  canon: (id: number) => number,
  profiles: PlayerProfile[],
): TeamRecords {
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
      if (!isForfeit(g)) {
        if (!biggestWin || rec.margin > biggestWin.margin) biggestWin = rec;
        if (!mostGoals || rec.goalsFor > mostGoals.goalsFor) mostGoals = rec;
      }
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
  const cards = recordCards(seasons, games, canon, profiles, { biggestWin, mostGoals, bestSeason });
  return { cards, biggestWin, mostGoals, bestSeason, allTime };
}

/** Forfeit (Strafverifizierung): a final score but every period 0:0 and no goals on the sheet. */
function isForfeit(g: GameSummary): boolean {
  const sum = g.periods.flat().reduce((a, b) => a + b, 0);
  return g.periods.length > 0 && sum === 0 && (g.homeScore ?? 0) + (g.awayScore ?? 0) > 0;
}

/** Pool of rotating record cards (the stats page shows a random 3). Only from real league data. */
function recordCards(
  seasons: SeasonData[],
  games: Map<string, Game>,
  canon: (id: number) => number,
  profiles: PlayerProfile[],
  base: Pick<TeamRecords, 'biggestWin' | 'mostGoals' | 'bestSeason'>,
): TeamRecordCard[] {
  const cards: TeamRecordCard[] = [];
  const { biggestWin, mostGoals, bestSeason } = base;
  const gameCard = (kind: TeamRecordCard['kind'], value: string, r: TeamRecordGame): TeamRecordCard => ({
    kind,
    value,
    gameId: r.gameId,
    season: r.season,
    date: r.date,
    opponent: r.opponent,
    score: r.score,
  });
  if (biggestWin) cards.push(gameCard('biggestWin', biggestWin.score, biggestWin));
  if (mostGoals) cards.push(gameCard('mostGoals', String(mostGoals.goalsFor), mostGoals));
  if (bestSeason)
    cards.push({
      kind: 'bestSeason',
      value: bestSeason.season.replace('-', '/'),
      season: bestSeason.season,
      n: bestSeason.rank,
      text: `${bestSeason.pts}|${bestSeason.gp}|${bestSeason.divisionName}`,
    });

  // All our finished games in date order. Streaks count forfeits (they count in the standings);
  // score records skip them (a 5:0 forfeit is not a real shutout).
  const allFinals = seasons
    .flatMap((x) => x.games)
    .filter((g) => resultFor(g) != null)
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0) || (a.date ?? '').localeCompare(b.date ?? ''));
  const finals = allFinals.filter((g) => !isForfeit(g));
  const score = (g: GameSummary) => {
    const home = ourSide(g) === 'home';
    const us = (home ? g.homeScore : g.awayScore) ?? 0;
    const them = (home ? g.awayScore : g.homeScore) ?? 0;
    return { us, them, opp: home ? g.away : g.home, label: `${us}:${them}` };
  };
  const at = (g: GameSummary) => {
    const x = score(g);
    return { gameId: g.id, season: g.season, date: g.date, opponent: x.opp, score: x.label };
  };

  // Streaks across seasons.
  const streak = (ok: (r: string) => boolean) => {
    let best = { n: 0, from: null as string | null, to: null as string | null };
    let cur = 0;
    let start: string | null = null;
    for (const g of allFinals) {
      if (ok(resultFor(g)!)) {
        if (cur === 0) start = g.date;
        cur++;
        if (cur > best.n) best = { n: cur, from: start, to: g.date };
      } else cur = 0;
    }
    return best;
  };
  const wins = streak((r) => r === 'W' || r === 'OTW');
  if (wins.n >= 2) cards.push({ kind: 'winStreak', value: String(wins.n), from: wins.from, to: wins.to });
  const unbeaten = streak((r) => r === 'W' || r === 'OTW' || r === 'T');
  if (unbeaten.n > wins.n) cards.push({ kind: 'unbeatenStreak', value: String(unbeaten.n), from: unbeaten.from, to: unbeaten.to });

  // Highest-scoring game (both teams).
  let high: GameSummary | null = null;
  for (const g of finals) if (!high || g.homeScore! + g.awayScore! > high.homeScore! + high.awayScore!) high = g;
  if (high && high.id !== mostGoals?.gameId) {
    const x = score(high);
    cards.push({ kind: 'highestScoring', value: String(x.us + x.them), ...at(high) });
  }

  // Shutouts: games we didn't concede in.
  const shutouts = finals.filter((g) => score(g).them === 0);
  if (shutouts.length) cards.push({ kind: 'shutouts', value: String(shutouts.length), ...at(shutouts[shutouts.length - 1]) });

  // Biggest playoff win.
  let pw: GameSummary | null = null;
  const margin = (g: GameSummary) => score(g).us - score(g).them;
  for (const g of finals) if (g.playoff && margin(g) > 0 && (!pw || margin(g) > margin(pw))) pw = g;
  if (pw) cards.push({ kind: 'playoffWin', value: score(pw).label, ...at(pw) });

  // Playoff series won, all-time.
  let seriesWon = 0;
  for (const x of seasons)
    for (const ph of x.playoffs?.phases ?? [])
      for (const e of ph.encounters) if (e.teams.some((t) => t.winner && isOurTeam(t.team))) seriesWon++;
  if (seriesWon > 0) cards.push({ kind: 'playoffSeries', value: String(seriesWon) });

  // Most goals in one regulation period.
  let per: { g: GameSummary; n: number; period: number } | null = null;
  for (const g of finals) {
    const home = ourSide(g) === 'home';
    g.periods.slice(0, 3).forEach((p, i) => {
      const n = home ? p[0] : p[1];
      if (!per || n > per.n) per = { g, n, period: i + 1 };
    });
  }
  if (per) {
    const pr = per as { g: GameSummary; n: number; period: number };
    cards.push({ kind: 'periodGoals', value: String(pr.n), n: pr.period, ...at(pr.g) });
  }

  // From game reports: comeback, fastest goal, single-game player highs.
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const who = (ref: PlayerRef) => {
    const p = byId.get(canon(ref.id));
    return { id: p?.id ?? ref.id, first: p?.first ?? ref.first, last: p?.last ?? ref.last, number: ref.number, slug: p?.slug };
  };
  const reports = [...games.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  let comeback: { g: Game; n: number } | null = null;
  let fastest: { g: Game; time: number; player: PlayerRef | null } | null = null;
  let pGoals: { g: Game; n: number; player: PlayerRef } | null = null;
  let pPoints: { g: Game; n: number; player: PlayerRef; goals: number } | null = null;
  for (const g of reports) {
    const side = ourSide(g);
    const r = resultFor(g);
    if (!side || !r) continue;
    const goals = g.goals.filter((x) => x.period !== 'SO').sort((a, b) => a.time - b.time);
    if (r === 'W' || r === 'OTW') {
      let diff = 0;
      let worst = 0;
      for (const x of goals) {
        diff += x.team === side ? 1 : -1;
        worst = Math.min(worst, diff);
      }
      if (worst < 0 && (!comeback || -worst > comeback.n)) comeback = { g, n: -worst };
    }
    const ours = goals.filter((x) => x.team === side);
    if (ours[0] && (!fastest || ours[0].time < fastest.time)) fastest = { g, time: ours[0].time, player: ours[0].scorer };
    const tally = new Map<number, { ref: PlayerRef; g: number; a: number }>();
    const bump = (ref: PlayerRef | null, k: 'g' | 'a') => {
      if (!ref) return;
      const id = canon(ref.id);
      const e = tally.get(id) ?? { ref, g: 0, a: 0 };
      e[k]++;
      tally.set(id, e);
    };
    for (const x of ours) {
      bump(x.scorer, 'g');
      x.assists.forEach((a) => bump(a, 'a'));
    }
    for (const e of tally.values()) {
      if (!pGoals || e.g > pGoals.n) pGoals = { g, n: e.g, player: e.ref };
      if (!pPoints || e.g + e.a > pPoints.n) pPoints = { g, n: e.g + e.a, player: e.ref, goals: e.g };
    }
  }
  if (comeback) cards.push({ kind: 'comeback', value: String(comeback.n), ...at(comeback.g) });
  if (fastest) {
    const m = Math.floor(fastest.time / 60);
    const s = String(fastest.time % 60).padStart(2, '0');
    cards.push({ kind: 'fastestGoal', value: `${m}:${s}`, ...at(fastest.g), player: fastest.player ? who(fastest.player) : undefined });
  }
  if (pGoals && pGoals.n >= 2) cards.push({ kind: 'playerGoalsGame', value: String(pGoals.n), ...at(pGoals.g), player: who(pGoals.player) });
  if (pPoints && pPoints.n >= 3 && pPoints.n > (pGoals?.n ?? 0))
    cards.push({ kind: 'playerPointsGame', value: String(pPoints.n), n: pPoints.goals, ...at(pPoints.g), player: who(pPoints.player) });
  return cards;
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
