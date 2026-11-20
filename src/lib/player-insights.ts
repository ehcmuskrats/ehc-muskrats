// Build-time insights for the player dashboard: tiles, chart data, split cards and fun facts.
// Only uses data WEHV provides (goals, assists, PIM, GWG, PP/SH, periods, opponents, results).
import type { GameSummary, PlayerGameLine, PlayerProfile, TeamRef } from '../types/models.ts';
import type { Lang } from '../i18n/index.ts';
import { formatDate, formatNumber } from '../i18n/index.ts';
import { games, ourGames, sortByDate, opponent, teamName, currentSeasonId } from './data.ts';

export type Metric = 'p' | 'g' | 'a' | 'pim' | 'ga';

export interface ChartBar {
  label: string; // opponent code or season "25/26"
  sub: string; // date or GP
  href: string | null; // game page (relative, without lang) or null
  values: Partial<Record<Metric, number>>;
  result?: string | null;
}

export interface SplitCard {
  key: string;
  title: string;
  main: string; // big value, e.g. "1.94"
  unit: string; // e.g. "PTS/GP"
  detail: string; // e.g. "33 PTS in 17 GP"
  tone: 'good' | 'bad' | 'neutral' | 'accent';
}

export interface Fact {
  /** Higher = more interesting; the no-JS fallback shows the top ones. */
  weight: number;
  icon: 'target' | 'clock' | 'fire' | 'trophy' | 'link' | 'bolt' | 'shield' | 'star';
  title: string;
  text: string;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const pts = (g: PlayerGameLine) => g.g + g.a;
const shortSeason = (s: string) => s.slice(2).replace('-', '/');

export function nextOpponentGame(): GameSummary | undefined {
  const now = Date.now();
  return sortByDate(ourGames()).find((g) => g.status === 'scheduled' && g.timestamp != null && g.timestamp > now);
}

export function playerInsights(p: PlayerProfile, lang: Lang) {
  const de = lang === 'de';
  const L = (d: string, e: string) => (de ? d : e);
  const fmt = (n: number | null, d = 2) => formatNumber(lang, n, d);

  // Games with a report, oldest → newest. Goalie games use the goalie line.
  const log = [...p.games].filter((g) => g.date).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const skaterLog = log.filter((g) => !g.goalie);
  const goalieLog = log.filter((g) => g.goalie && g.goalie.toi > 0);
  const isGoalie = p.isGoalie;

  // ---------- chart: last 10 games ----------
  const recentSrc = (isGoalie ? goalieLog : skaterLog).slice(-10);
  const recent: ChartBar[] = recentSrc.map((g) => ({
    label: g.opponent.short || teamName(g.opponent).slice(0, 3),
    sub: g.date ? `${g.date.slice(8, 10)}.${g.date.slice(5, 7)}.` : '',
    href: `games/${g.gameId}/`,
    values: isGoalie ? { ga: g.goalie!.ga } : { p: pts(g), g: g.g, a: g.a, pim: g.pim },
    result: g.result,
  }));

  // ---------- chart: per season (career view) ----------
  const seasonBars: ChartBar[] = [...p.seasons]
    .sort((a, b) => a.season.localeCompare(b.season))
    .filter((s) => (isGoalie ? s.goalieGp > 0 : s.gp > 0))
    .map((s) => ({
      label: shortSeason(s.season),
      sub: `${isGoalie ? s.goalieGp : s.gp} GP`,
      href: `stats/${s.season}/`,
      values: isGoalie ? { ga: s.ga } : { p: s.p, g: s.g, a: s.a, pim: s.pim },
    }));

  // ---------- tiles ----------
  const cur = p.seasons.find((s) => s.season === currentSeasonId) ?? p.seasons[0];
  const last5 = skaterLog.slice(-5);
  const last10 = skaterLog.slice(-10);
  const sum = (list: PlayerGameLine[], f: (g: PlayerGameLine) => number) => list.reduce((n, g) => n + f(g), 0);
  // current point streak (consecutive most recent games with ≥1 point)
  let streak = 0;
  for (let i = skaterLog.length - 1; i >= 0 && pts(skaterLog[i]) > 0; i--) streak++;
  const tiles = isGoalie
    ? [
        { k: 'GP', v: String(cur?.goalieGp ?? 0), sub: cur ? shortSeason(cur.season) : '', accent: false },
        { k: 'GAA', v: fmt(cur?.gaa ?? null), sub: cur ? shortSeason(cur.season) : '', accent: true },
        { k: 'L5 GA', v: String(goalieLog.slice(-5).reduce((n, g) => n + g.goalie!.ga, 0)), sub: L('letzte 5', 'last 5'), accent: false },
        { k: L('KARRIERE', 'CAREER'), v: String(p.career.goalieGp), sub: 'GP', accent: false },
      ]
    : [
        { k: 'PTS', v: String(cur?.p ?? 0), sub: cur ? shortSeason(cur.season) : '', accent: true },
        { k: 'PTS/GP', v: cur && cur.gp ? fmt(cur.p / cur.gp) : '–', sub: cur ? shortSeason(cur.season) : '', accent: false },
        { k: 'L5 PTS', v: String(sum(last5, pts)), sub: L('letzte 5', 'last 5'), accent: false },
        { k: L('SERIE', 'STREAK'), v: String(streak), sub: L('Spiele mit Punkt', 'games with a point'), accent: streak >= 3 },
        { k: L('KARRIERE', 'CAREER'), v: String(p.career.p), sub: 'PTS', accent: false },
      ];

  // ---------- split cards ----------
  const splits: SplitCard[] = [];
  if (!isGoalie) {
    const seasonsDesc = [...p.seasons].filter((s) => s.gp > 0).sort((a, b) => b.season.localeCompare(a.season));
    const [thisS, lastS] = seasonsDesc;
    if (thisS) {
      const a = thisS.p / thisS.gp;
      const b = lastS ? lastS.p / lastS.gp : null;
      splits.push({
        key: 'this',
        title: `${L('Diese Saison', 'This season')} ${shortSeason(thisS.season)}`,
        main: fmt(a),
        unit: 'PTS/GP',
        detail: `${thisS.p} PTS · ${thisS.gp} GP`,
        tone: b == null ? 'neutral' : a >= b ? 'good' : 'bad',
      });
    }
    if (lastS) {
      splits.push({
        key: 'last',
        title: `${L('Saison davor', 'Previous season')} ${shortSeason(lastS.season)}`,
        main: fmt(lastS.p / lastS.gp),
        unit: 'PTS/GP',
        detail: `${lastS.p} PTS · ${lastS.gp} GP`,
        tone: 'neutral',
      });
    }
    const overall = p.career.gp ? p.career.p / p.career.gp : 0;
    for (const [key, list, title] of [
      ['l5', last5, L('Letzte 5', 'Last 5')],
      ['l10', last10, L('Letzte 10', 'Last 10')],
    ] as const) {
      if (!list.length) continue;
      const v = sum(list, pts) / list.length;
      splits.push({
        key,
        title,
        main: `${sum(list, pts)}`,
        unit: 'PTS',
        detail: `${fmt(v)} PTS/GP · ${sum(list, (g) => g.g)} G · ${sum(list, (g) => g.a)} A`,
        tone: v > overall * 1.1 ? 'good' : v < overall * 0.9 ? 'bad' : 'neutral',
      });
    }
  }
  const next = nextOpponentGame();
  if (next) {
    const opp = opponent(next);
    const vs = (isGoalie ? goalieLog : skaterLog).filter((g) => g.opponent.id === opp.id);
    const detail = vs.length
      ? isGoalie
        ? `${vs.length} GP · ${vs.reduce((n, g) => n + g.goalie!.ga, 0)} GA`
        : `${vs.length} GP · ${sum(vs, (g) => g.g)} G · ${sum(vs, (g) => g.a)} A`
      : L('Noch kein Spiel gegen sie', 'No games against them yet');
    splits.push({
      key: 'next',
      title: `vs ${opp.short || teamName(opp)} · ${formatDate(lang, next.date)}`,
      main: vs.length ? (isGoalie ? fmt(vs.reduce((n, g) => n + g.goalie!.ga, 0) / vs.length) : String(sum(vs, pts))) : '–',
      unit: isGoalie ? 'GA/GP' : 'PTS',
      detail,
      tone: 'accent',
    });
  }

  // ---------- fun facts ----------
  const facts: Fact[] = [];
  const goals = p.goals;
  const byOpp = new Map<number, { team: TeamRef; g: number; pts: number; gp: number }>();
  for (const g of skaterLog) {
    const e = byOpp.get(g.opponent.id) ?? { team: g.opponent, g: 0, pts: 0, gp: 0 };
    e.g += g.g;
    e.pts += pts(g);
    e.gp++;
    byOpp.set(g.opponent.id, e);
  }
  const oppList = [...byOpp.values()];
  const favGoals = [...oppList].sort((a, b) => b.g - a.g || a.gp - b.gp)[0];
  if (favGoals && favGoals.g >= 2) {
    facts.push({
      weight: 9,
      icon: 'target',
      title: L('Lieblingsgegner', 'Favourite opponent'),
      text: L(
        `${favGoals.g} Tore gegen ${teamName(favGoals.team)} – in ${favGoals.gp} Spielen. Mehr als gegen jedes andere Team.`,
        `${favGoals.g} goals against ${teamName(favGoals.team)} in ${favGoals.gp} games – more than against anyone else.`,
      ),
    });
  }
  const bestPpg = oppList.filter((o) => o.gp >= 3).sort((a, b) => b.pts / b.gp - a.pts / a.gp)[0];
  if (bestPpg && bestPpg.team.id !== favGoals?.team.id && bestPpg.pts / bestPpg.gp >= 1) {
    facts.push({
      weight: 6,
      icon: 'star',
      title: L('Punktegarant', 'Point machine'),
      text: L(
        `${fmt(bestPpg.pts / bestPpg.gp)} Punkte pro Spiel gegen ${teamName(bestPpg.team)} (${bestPpg.gp} Spiele).`,
        `${fmt(bestPpg.pts / bestPpg.gp)} points per game against ${teamName(bestPpg.team)} (${bestPpg.gp} games).`,
      ),
    });
  }
  // Favourite period
  const perCount = new Map<string, number>();
  for (const g of goals) perCount.set(g.period, (perCount.get(g.period) ?? 0) + 1);
  const favPer = [...perCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (favPer && goals.length >= 4) {
    const pct = Math.round((favPer[1] / goals.length) * 100);
    const perName = /^\d$/.test(favPer[0]) ? L(`${favPer[0]}. Drittel`, `period ${favPer[0]}`) : favPer[0];
    facts.push({
      weight: pct >= 45 ? 7 : 4,
      icon: 'clock',
      title: L('Sein Drittel', 'His period'),
      text: L(`${pct} % seiner Tore fallen im ${perName} (${favPer[1]} von ${goals.length}).`, `${pct}% of his goals come in ${perName} (${favPer[1]} of ${goals.length}).`),
    });
  }
  // Best game
  const best = [...skaterLog].sort((a, b) => pts(b) - pts(a) || b.g - a.g)[0];
  if (best && pts(best) >= 3) {
    facts.push({
      weight: 8,
      icon: 'fire',
      title: L('Bestes Spiel', 'Best game'),
      text: L(
        `${pts(best)} Punkte (${best.g} T, ${best.a} A) gegen ${teamName(best.opponent)} am ${formatDate(lang, best.date)}.`,
        `${pts(best)} points (${best.g} G, ${best.a} A) against ${teamName(best.opponent)} on ${formatDate(lang, best.date)}.`,
      ),
    });
  }
  // Hat tricks
  const hats = skaterLog.filter((g) => g.g >= 3).length;
  if (hats > 0) {
    facts.push({
      weight: 9,
      icon: 'trophy',
      title: 'Hattrick',
      text: L(`${hats} ${hats === 1 ? 'Hattrick' : 'Hattricks'} in seiner Muskrats-Karriere.`, `${hats} hat trick${hats === 1 ? '' : 's'} in his Muskrats career.`),
    });
  }
  // Game winners
  const gwg = goals.filter((g) => g.gwg).length;
  if (gwg >= 1) {
    facts.push({
      weight: gwg >= 3 ? 8 : 5,
      icon: 'trophy',
      title: L('Matchwinner', 'Clutch'),
      text: L(`${gwg}× das Siegtor geschossen.`, `Scored the game-winner ${gwg} time${gwg === 1 ? '' : 's'}.`),
    });
  }
  // Special teams
  const ppg = goals.filter((g) => /^PP/.test(g.situation)).length;
  const shg = goals.filter((g) => /^SH/.test(g.situation)).length;
  if (shg >= 1) {
    facts.push({
      weight: 7,
      icon: 'shield',
      title: L('Unterzahl-Gefahr', 'Short-handed threat'),
      text: L(`${shg} ${shg === 1 ? 'Tor' : 'Tore'} in Unterzahl.`, `${shg} short-handed goal${shg === 1 ? '' : 's'}.`),
    });
  }
  if (ppg >= 2) {
    facts.push({
      weight: 5,
      icon: 'bolt',
      title: 'Powerplay',
      text: L(`${ppg} Powerplay-Tore – ${Math.round((ppg / goals.length) * 100)} % seiner Tore.`, `${ppg} power-play goals – ${Math.round((ppg / goals.length) * 100)}% of his goals.`),
    });
  }
  // Longest point streak
  let longest = 0;
  let run = 0;
  for (const g of skaterLog) {
    run = pts(g) > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  if (longest >= 3) {
    facts.push({
      weight: longest >= 5 ? 8 : 5,
      icon: 'fire',
      title: L('Punkteserie', 'Point streak'),
      text: L(`Längste Serie: ${longest} Spiele in Folge mit mindestens einem Punkt.`, `Longest streak: ${longest} straight games with at least one point.`),
    });
  }
  // Goal frequency
  if (goals.length >= 3 && p.career.gp > 0) {
    const every = p.career.gp / p.career.g;
    facts.push({
      weight: every <= 1.5 ? 6 : 3,
      icon: 'target',
      title: L('Torquote', 'Scoring rate'),
      text: every <= 1
        ? L(`Mehr als ein Tor pro Spiel: ${fmt(p.career.g / p.career.gp)} im Schnitt.`, `More than a goal a game: ${fmt(p.career.g / p.career.gp)} on average.`)
        : L(`Trifft im Schnitt alle ${fmt(every, 1)} Spiele.`, `Scores every ${fmt(every, 1)} games on average.`),
    });
  }
  // Assist partners (from full game reports)
  const setUpBy = new Map<number, { name: string; n: number }>();
  for (const g of goals) for (const a of g.assists) {
    const e = setUpBy.get(a.id) ?? { name: `${a.first} ${a.last}`, n: 0 };
    e.n++;
    setUpBy.set(a.id, e);
  }
  const fed = new Map<number, { name: string; n: number }>();
  for (const game of games.values()) {
    for (const gl of game.goals) {
      if (!gl.scorer || !gl.assists.some((a) => a.id === p.id)) continue;
      const e = fed.get(gl.scorer.id) ?? { name: `${gl.scorer.first} ${gl.scorer.last}`, n: 0 };
      e.n++;
      fed.set(gl.scorer.id, e);
    }
  }
  const topSetUp = [...setUpBy.values()].sort((a, b) => b.n - a.n)[0];
  if (topSetUp && topSetUp.n >= 2) {
    facts.push({
      weight: 6,
      icon: 'link',
      title: L('Bester Vorlagengeber', 'Best set-up man'),
      text: L(`${topSetUp.name} hat ihm ${topSetUp.n} Tore aufgelegt.`, `${topSetUp.name} has set up ${topSetUp.n} of his goals.`),
    });
  }
  const topFed = [...fed.values()].sort((a, b) => b.n - a.n)[0];
  if (topFed && topFed.n >= 2) {
    facts.push({
      weight: 6,
      icon: 'link',
      title: L('Lieblingsabnehmer', 'Favourite target'),
      text: L(`Hat ${topFed.name} ${topFed.n} Tore aufgelegt.`, `Has set up ${topFed.name} for ${topFed.n} goals.`),
    });
  }
  // Team record with him in the lineup
  const decided = log.filter((g) => g.result);
  if (decided.length >= 5) {
    const w = decided.filter((g) => g.result === 'W' || g.result === 'OTW').length;
    facts.push({
      weight: 4,
      icon: 'shield',
      title: L('Mit ihm am Eis', 'With him in the lineup'),
      text: L(
        `Die Muskrats gewinnen ${Math.round((w / decided.length) * 100)} % der Spiele, in denen er dabei ist (${w} von ${decided.length}).`,
        `The Muskrats win ${Math.round((w / decided.length) * 100)}% of games he plays (${w} of ${decided.length}).`,
      ),
    });
  }
  // Most PIM in one game
  const pimGame = [...skaterLog].sort((a, b) => b.pim - a.pim)[0];
  if (pimGame && pimGame.pim >= 9) {
    facts.push({
      weight: 4,
      icon: 'bolt',
      title: L('Strafbank-Rekord', 'Sin-bin record'),
      text: L(`${pimGame.pim} Strafminuten in einem Spiel gegen ${teamName(pimGame.opponent)}.`, `${pimGame.pim} penalty minutes in one game against ${teamName(pimGame.opponent)}.`),
    });
  }
  // Goalie facts
  if (isGoalie && goalieLog.length) {
    const bestG = [...goalieLog].sort((a, b) => a.goalie!.ga - b.goalie!.ga)[0];
    facts.push({
      weight: 7,
      icon: 'shield',
      title: L('Bestes Spiel', 'Best game'),
      text: L(
        `Nur ${bestG.goalie!.ga} Gegentor${bestG.goalie!.ga === 1 ? '' : 'e'} gegen ${teamName(bestG.opponent)} am ${formatDate(lang, bestG.date)}.`,
        `Only ${bestG.goalie!.ga} goal${bestG.goalie!.ga === 1 ? '' : 's'} against vs ${teamName(bestG.opponent)} on ${formatDate(lang, bestG.date)}.`,
      ),
    });
    const wins = goalieLog.filter((g) => g.result === 'W' || g.result === 'OTW').length;
    facts.push({
      weight: 6,
      icon: 'trophy',
      title: L('Siege im Tor', 'Wins in net'),
      text: L(`${wins} Siege in ${goalieLog.length} Spielen im Tor.`, `${wins} wins in ${goalieLog.length} games in net.`),
    });
  }

  facts.sort((a, b) => b.weight - a.weight);
  return { tiles, recent, seasonBars, splits, facts, isGoalie };
}

export { round };
