import { roundName } from '../i18n/rounds.ts';
// Automatic game recaps (#10), written from the WEHV game report only: intro, period by period,
// key players, turning points, an optional quote (data/recap-quotes.json), highlights and a stats link.
// Generated for every played game of the current season. A hand-written news post with the same gameId wins.
import type { Game, Goal, PlayerRef } from '../types/models.ts';
import type { Lang } from '../i18n/index.ts';
import { formatDate } from '../i18n/index.ts';
import { games, ourGames, currentSeasonId, teamName, highlightFor } from './data.ts';
import { standing } from './teams.ts';
import { isOurTeam } from '../config/team.ts';
import { slug as slugify } from './teams.ts';

const quoteFiles = import.meta.glob<Record<string, { de?: string; en?: string; by?: string }>>('/data/recap-quotes.json', {
  eager: true,
  import: 'default',
});
const QUOTES = Object.values(quoteFiles)[0] ?? {};

export interface Recap {
  slug: string;
  lang: Lang;
  gameId: string;
  date: Date;
  title: string;
  summary: string;
  intro: string;
  periods: { label: string; text: string }[];
  keyPlayers: string[];
  turningPoints: string[];
  quote: { text: string; by: string } | null;
  videoId: string | null;
}

const nm = (p: PlayerRef | null) => (p ? `${p.first} ${p.last}` : '?');
const short = (p: PlayerRef | null) => (p ? p.last : '?');
const ord = (lang: Lang, n: number) => (lang === 'de' ? `${n}.` : ['1st', '2nd', '3rd'][n - 1] ?? `${n}th`);

function sitLabel(lang: Lang, g: Goal): string {
  if (g.emptyNet) return lang === 'de' ? 'ins leere Tor' : 'empty net';
  if (g.penaltyShot) return lang === 'de' ? 'Penalty' : 'penalty shot';
  if (/^PP/.test(g.situation)) return 'PP';
  if (/^SH/.test(g.situation)) return 'SH';
  return '';
}

/** "Naukkarinen (30:46; 67:05, PP)": one entry per scorer, in order of their first goal. */
function scorerList(lang: Lang, gs: Goal[]): string[] {
  const m = new Map<string, string[]>();
  for (const g of gs) {
    const k = short(g.scorer);
    const s = sitLabel(lang, g);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(g.timeLabel + (s ? `, ${s}` : ''));
  }
  return [...m].map(([k, t]) => `${k} (${t.join('; ')})`);
}

function list(lang: Lang, xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  const and = lang === 'de' ? ' und ' : ' and ';
  return xs.slice(0, -1).join(', ') + and + xs.at(-1);
}

export function buildRecap(game: Game, lang: Lang): Recap | null {
  if (game.status !== 'final' || game.homeScore == null || game.awayScore == null) return null;
  const de = lang === 'de';
  const usSide: 'home' | 'away' = isOurTeam(game.home) ? 'home' : 'away';
  const us = usSide === 'home' ? game.homeScore : game.awayScore;
  const them = usSide === 'home' ? game.awayScore : game.homeScore;
  const oppTeam = usSide === 'home' ? game.away : game.home;
  const opp = teamName(oppTeam);
  const extra = game.shootout ? (de ? ' im Penaltyschießen' : ' in a shootout') : game.overtime ? (de ? ' nach Verlängerung' : ' in overtime') : '';
  const won = us > them;
  const score = `${us}:${them}`;
  const scoreEn = `${us}–${them}`;

  const title = de
    ? won
      ? `EHC Muskrats schlagen ${opp} ${score}${extra}`
      : us === them
        ? `${score} zwischen den EHC Muskrats und ${opp}`
        : `EHC Muskrats verlieren gegen ${opp} ${score}${extra}`
    : won
      ? `EHC Muskrats beat ${opp} ${scoreEn}${extra}`
      : us === them
        ? `EHC Muskrats and ${opp} draw ${scoreEn}`
        : `EHC Muskrats lose ${scoreEn} to ${opp}${extra}`;

  // Intro: when, where, what, and the table afterwards.
  const venue = game.venue?.replace(/^Wien - /, '') ?? '';
  const round = roundName(game.playoff ? (game.playoff.encounter ?? 'Playoffs') : game.divisionName, lang);
  const st = standing('ehc-muskrats', game.season, game.divisionId);
  const table =
    st && !game.playoff
      ? de
        ? ` Aktuell stehen die Muskrats auf Platz ${st.row.rank} (${st.row.pts} Punkte aus ${st.row.gp} Spielen).`
        : ` The Muskrats are currently ${ord('en', st.row.rank)} in the table (${st.row.pts} points from ${st.row.gp} games).`
      : '';
  const intro = de
    ? `Am ${formatDate('de', game.date, { weekday: true })} ${won ? 'gewannen' : us === them ? 'trennten sich' : 'verloren'} die EHC Muskrats ${us === them ? 'und ' + opp : 'gegen ' + opp} in der ${venue} mit ${score}${extra} (${round}).${table}`
    : `On ${formatDate('en', game.date, { weekday: true })} EHC Muskrats ${won ? 'beat' : us === them ? 'drew with' : 'lost to'} ${opp} ${scoreEn}${extra} at ${venue} (${round}).${table}`;

  // Period by period.
  const periods: Recap['periods'] = [];
  const nPer = game.numberOfPeriods || 3;
  const all = game.periods.map((_, i) => i);
  for (const i of all) {
    const key = i < nPer ? String(i + 1) : i === nPer ? 'OT' : 'SO';
    if (key === 'SO') continue;
    const [h, a] = game.periods[i];
    const ours = usSide === 'home' ? h : a;
    const theirs = usSide === 'home' ? a : h;
    const gs = game.goals.filter((g) => g.period === key);
    const mine = scorerList(lang, gs.filter((g) => g.team === usSide));
    const other = scorerList(lang, gs.filter((g) => g.team !== usSide));
    const label = key === 'OT' ? (de ? 'Verlängerung' : 'Overtime') : de ? `${ord('de', i + 1)} Drittel` : `${ord('en', i + 1)} period`;
    let text: string;
    if (!gs.length) text = de ? `Keine Tore (${ours}:${theirs}).` : `No goals (${ours}–${theirs}).`;
    else {
      const parts: string[] = [];
      if (mine.length) parts.push(de ? `Für die Muskrats trafen ${list(lang, mine)}` : `Muskrats goals: ${list(lang, mine)}`);
      if (other.length) parts.push(de ? `für ${oppTeam.short || opp} ${list(lang, other)}` : `${oppTeam.short || opp}: ${list(lang, other)}`);
      text = de ? `${parts.join(', ')}. Drittelergebnis ${ours}:${theirs}.` : `${parts.join('; ')}. Period score ${ours}–${theirs}.`;
    }
    periods.push({ label, text });
  }
  if (game.shootout) periods.push({ label: de ? 'Penaltyschießen' : 'Shootout', text: won ? (de ? 'Die Muskrats behalten die Nerven.' : 'The Muskrats held their nerve.') : de ? 'Das Penaltyschießen geht an den Gegner.' : 'The shootout goes to the opponents.' });

  // Key players: top point-getters on our side (goals first), plus our goalie.
  const lines = (usSide === 'home' ? game.skaters.home : game.skaters.away).filter((l) => l.g + l.a > 0);
  lines.sort((a, b) => b.g + b.a - (a.g + a.a) || b.g - a.g);
  const keyPlayers = lines.slice(0, 3).map((l) =>
    de
      ? `${nm(l.player)}: ${l.g} ${l.g === 1 ? 'Tor' : 'Tore'}, ${l.a} ${l.a === 1 ? 'Assist' : 'Assists'}`
      : `${nm(l.player)}: ${l.g} ${l.g === 1 ? 'goal' : 'goals'}, ${l.a} ${l.a === 1 ? 'assist' : 'assists'}`,
  );
  const goalies = (usSide === 'home' ? game.goalies.home : game.goalies.away).filter((x) => x.toi > 0);
  for (const gk of goalies)
    keyPlayers.push(de ? `${nm(gk.player)} im Tor: ${gk.goalsAgainst} Gegentore` : `${nm(gk.player)} in goal: ${gk.goalsAgainst} goals against`);

  // Turning points: the game-winner, comebacks, scoring runs.
  const turningPoints: string[] = [];
  const ordered = [...game.goals].filter((g) => g.period !== 'SO').sort((a, b) => a.time - b.time);
  const gwg = ordered.find((g) => g.gwg);
  if (gwg && gwg.team === usSide)
    turningPoints.push(de ? `Das Siegtor erzielte ${nm(gwg.scorer)} zum ${gwg.score} (${gwg.timeLabel}).` : `${nm(gwg.scorer)} scored the winner at ${gwg.timeLabel} (${gwg.score}).`);
  let diff = 0;
  let worst = 0;
  let run = 0;
  let bestRun = { n: 0, side: usSide as string, from: '', to: '' };
  let runStart = '';
  let prevTeam = '';
  for (const g of ordered) {
    diff += g.team === usSide ? 1 : -1;
    worst = Math.min(worst, diff);
    if (g.team === prevTeam) run++;
    else {
      run = 1;
      runStart = g.timeLabel;
    }
    prevTeam = g.team;
    if (run > bestRun.n) bestRun = { n: run, side: g.team, from: runStart, to: g.timeLabel };
  }
  if (won && worst < 0)
    turningPoints.push(de ? `Die Muskrats drehten einen Rückstand von ${-worst} ${worst === -1 ? 'Tor' : 'Toren'}.` : `The Muskrats came back from ${-worst} ${worst === -1 ? 'goal' : 'goals'} down.`);
  if (bestRun.n >= 3)
    turningPoints.push(
      bestRun.side === usSide
        ? de
          ? `${bestRun.n} Muskrats-Tore in Folge zwischen ${bestRun.from} und ${bestRun.to}.`
          : `${bestRun.n} unanswered Muskrats goals between ${bestRun.from} and ${bestRun.to}.`
        : de
          ? `${opp} traf ${bestRun.n}-mal in Folge (${bestRun.from}–${bestRun.to}).`
          : `${opp} scored ${bestRun.n} in a row (${bestRun.from}–${bestRun.to}).`,
    );
  const pp = game.teamStats?.[usSide];
  if (pp && pp.ppChances > 0)
    turningPoints.push(de ? `Power Play: ${pp.ppGoals} ${pp.ppGoals === 1 ? 'Tor' : 'Tore'} aus ${pp.ppChances} ${pp.ppChances === 1 ? 'Überzahlsituation' : 'Überzahlsituationen'}.` : `Power play: ${pp.ppGoals} for ${pp.ppChances}.`);

  const q = QUOTES[game.id];
  const quote = q && q[lang] ? { text: q[lang]!, by: q.by ?? '' } : null;
  const top = lines[0];
  const summary = de
    ? `${score}${extra} gegen ${opp}.${top ? ` ${nm(top.player)} mit ${top.g + top.a} ${top.g + top.a === 1 ? 'Punkt' : 'Punkten'}.` : ''}`
    : `${scoreEn}${extra} against ${opp}.${top ? ` ${nm(top.player)} with ${top.g + top.a} ${top.g + top.a === 1 ? 'point' : 'points'}.` : ''}`;

  return {
    slug: `${game.date ?? 'spiel'}-${slugify(`muskrats ${oppTeam.short || opp}`)}-${us}-${them}`,
    lang,
    gameId: game.id,
    date: new Date(game.timestamp ?? Date.parse(game.date ?? '')),
    title,
    summary,
    intro,
    periods,
    keyPlayers,
    turningPoints,
    quote,
    videoId: highlightFor(game.id)?.video.id ?? null,
  };
}

/** Recaps for the current season's played games, newest first. */
export function autoRecaps(lang: Lang): Recap[] {
  return ourGames(currentSeasonId)
    .map((s) => games.get(s.id))
    .filter((g): g is Game => !!g)
    .map((g) => buildRecap(g, lang))
    .filter((r): r is Recap => !!r)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

