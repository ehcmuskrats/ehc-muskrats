// Raw hockeydata payloads -> typed models in src/types/models.ts.
// Personal data we don't need (birthdates) is dropped here. Nationality is kept: WEHV publishes it and the
// player profiles show it as a small flag.
import { existsSync } from 'node:fs';
import type {
  DivisionRef,
  Game,
  GameStatus,
  GameSummary,
  GoalieLine,
  LeaderGoalie,
  LeaderPenalty,
  LeaderSkater,
  PersonName,
  PlayerRef,
  PlayoffBracket,
  PlayoffInfo,
  SeasonId,
  SkaterLine,
  Standings,
  TeamGameStats,
  TeamRef,
  TeamSeasonStats,
} from '../../src/types/models.ts';

export function seasonIdFromLabel(label: string): SeasonId {
  const m = /(\d{4})\s*\/\s*(\d{2,4})/.exec(label);
  if (!m) throw new Error(`Unrecognised season label "${label}"`);
  return `${m[1]}-${m[2].slice(-2)}`;
}
export function seasonLabelFromId(id: SeasonId): string {
  return id.replace('-', '/');
}
export function pickerLabelFromId(id: SeasonId): string {
  return `Saison ${seasonLabelFromId(id)}`;
}

export function divisionKind(name: string): DivisionRef['kind'] {
  const n = name.toLowerCase();
  if (n.includes('playoff')) return 'playoffs';
  if (n.includes('grunddurchgang') || n.includes('regular')) return 'regular';
  return 'placement';
}

const str = (v: unknown): string => (v == null ? '' : String(v)).trim();
const int = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const intOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ---------- Teams ----------

export class TeamRegistry {
  private teams = new Map<number, TeamRef>();
  constructor(private logoDir = 'public/logos') {}

  ref(id: unknown, short: unknown, name: unknown): TeamRef {
    const tid = intOrNull(id);
    if (tid == null) return { id: 0, short: str(short), name: str(name), logo: null };
    const existing = this.teams.get(tid);
    const logo = existsSync(`${this.logoDir}/${tid}.png`) ? `logos/${tid}.png` : null;
    const next: TeamRef = {
      id: tid,
      short: str(short) || existing?.short || '',
      name: str(name) || existing?.name || '',
      logo,
    };
    this.teams.set(tid, next);
    return next;
  }
  all(): TeamRef[] {
    return [...this.teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  load(list: TeamRef[]) {
    for (const t of list) this.teams.set(t.id, t);
  }
}

// ---------- Schedule ----------

function statusOf(r: any): GameStatus {
  const labels: string[] = Array.isArray(r.labels) ? r.labels : [];
  if (labels.includes('FINISHED') || r.gameHasEnded === true || int(r.gameStatus) >= 4) return 'final';
  if (labels.some((l) => /LIVE/i.test(l)) || [1, 2, 3].includes(int(r.gameStatus))) return 'live';
  if (r.dateIsToBeDetermined) return 'tbd';
  return 'scheduled';
}

function periodPairs(r: any): [number, number][] {
  const out: [number, number][] = [];
  for (const k of ['periodResults1', 'periodResults2', 'periodResults3', 'periodResultsOT', 'periodResultsSO']) {
    const m = /^(\d+):(\d+)$/.exec(str(r[k]));
    if (m) out.push([Number(m[1]), Number(m[2])]);
  }
  return out;
}

export function normalizeSchedule(
  raw: any,
  season: SeasonId,
  division: DivisionRef,
  teams: TeamRegistry,
): GameSummary[] {
  const rows: any[] = raw?.rows ?? [];
  return rows.map((r): GameSummary => {
    const tbdDate = !!r.dateIsToBeDetermined || !r.scheduledGameStart;
    const tbdTime = tbdDate || !!r.timeIsToBeDetermined;
    const start = str(r.scheduledGameStart); // local Vienna "2026-11-02T20:35:00"
    const status = statusOf(r);
    const hasScore = status === 'final' || status === 'live';
    return {
      id: str(r.id),
      season,
      divisionId: division.id,
      divisionName: division.name,
      name: str(r.gameName) || null,
      date: tbdDate ? null : start.slice(0, 10),
      time: tbdTime ? null : start.slice(11, 16) || str(r.scheduledTime) || null,
      timestamp: tbdDate ? null : intOrNull(r.gameUtcTimestamp),
      venue: str(r.location?.longname) || null,
      home: teams.ref(r.homeTeamId, r.homeTeamShortName, r.homeTeamLongName),
      away: teams.ref(r.awayTeamId, r.awayTeamShortName, r.awayTeamLongName),
      homeScore: hasScore ? intOrNull(r.homeTeamScore) : null,
      awayScore: hasScore ? intOrNull(r.awayTeamScore) : null,
      periods: periodPairs(r),
      overtime: !!r.isOvertime,
      shootout: !!r.isShootOut,
      status,
      playoff: null,
      hasReport: false,
    };
  });
}

// ---------- Standings ----------

export function normalizeStandings(raw: any, season: SeasonId, division: DivisionRef, teams: TeamRegistry): Standings {
  const rows: any[] = raw?.rows ?? [];
  return {
    season,
    divisionId: division.id,
    divisionName: division.name,
    unofficial: !!raw?.isUnOfficial,
    rows: rows.map((r) => ({
      rank: int(r.tableRank),
      team: teams.ref(r.id, r.teamShortname, r.teamLongname),
      gp: int(r.gamesPlayed),
      w: int(r.gamesWon),
      l: int(r.gamesLost),
      otw: int(r.gamesWonInOt),
      otl: int(r.gamesLostInOt),
      ties: int(r.gamesTied),
      gf: int(r.goalsFor),
      ga: int(r.goalsAgainst),
      gd: int(r.goalsFor) - int(r.goalsAgainst),
      pts: int(r.points),
    })),
  };
}

// ---------- Playoffs ----------

export function roundFromLabel(label: string): PlayoffInfo['round'] {
  const l = label.toLowerCase();
  if (/viertel|quarter/.test(l)) return 'quarterfinal';
  if (/halb|semi/.test(l)) return 'semifinal';
  if (/platz\s*3|dritt|third|bronze|kleines/.test(l)) return 'third';
  if (/final/.test(l)) return 'final';
  return 'other';
}

export function normalizeKnockout(
  raw: any,
  season: SeasonId,
  divisionId: number,
  teams: TeamRegistry,
): { bracket: PlayoffBracket; games: GameSummary[] } {
  const games: GameSummary[] = [];
  const phases = (raw?.phases ?? []).map((ph: any) => {
    const label = str(ph.divisionName);
    const round = roundFromLabel(label);
    const division: DivisionRef = { id: int(ph.divisionId), name: label, kind: 'playoffs' };
    return {
      divisionId: int(ph.divisionId),
      label,
      round,
      encounters: (ph.encounters ?? []).map((enc: any) => {
        // Game number = position within the series by date. The league's game names ("VF4",
        // "HF2", "FIN 3") number the series, not the game, so they can't be used for this.
        const encGames = normalizeSchedule({ rows: enc.games ?? [] }, season, division, teams).sort(
          (a, b) => (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity),
        );
        encGames.forEach((g, i) => {
          g.playoff = {
            round,
            roundLabel: label,
            encounter: str(enc.longname) || null,
            gameNumber: i + 1,
          };
          // Playoff games belong to the playoffs division of the season for our purposes.
          g.divisionId = divisionId;
          g.divisionName = 'Playoffs';
        });
        games.push(...encGames);
        return {
          id: int(enc.id),
          label: str(enc.longname),
          bestOf: int(enc.bestOf) || 1,
          teams: (enc.teams ?? []).map((t: any) => ({
            team: teams.ref(t.id, t.shortname, t.longname),
            wins: int(t.gamesWon),
            winner: int(enc.winningTeamId) === int(t.id) && int(t.id) !== 0,
          })),
          gameIds: encGames.map((g) => g.id),
        };
      }),
    };
  });
  return { bracket: { season, divisionId, phases }, games };
}

// ---------- Leaders ----------

function playerRef(p: any): PlayerRef | null {
  if (!p) return null;
  const id = intOrNull(p.id);
  if (id == null) return null;
  return {
    id,
    first: str(p.playerFirstname),
    last: str(p.playerLastname),
    number: intOrNull(p.playerJerseyNr),
  };
}

export function normalizeSkaters(raw: any): LeaderSkater[] {
  return (raw?.rows ?? [])
    .map((r: any) => ({
      player: playerRef(r)!,
      teamId: int(r.teamId),
      position: str(r.position),
      gp: int(r.gamesPlayed),
      g: int(r.goals),
      a: int(r.assists),
      p: int(r.points),
      pim: int(r.penaltyMinutes),
      ppg: int(r.powerplayGoals),
      shg: int(r.shorthandedGoals),
      gwg: int(r.gameWinningGoals),
      plusMinus: int(r.plusMinus),
      sog: int(r.shotsOnGoal),
      nation: str(r.nation) || null,
    }))
    .filter((r: LeaderSkater) => r.player);
}

export function normalizeGoalies(raw: any): LeaderGoalie[] {
  return (raw?.rows ?? [])
    .map((r: any) => ({
      player: playerRef(r)!,
      teamId: int(r.teamId),
      gp: int(r.gamePlayedIn ?? r.gamesPlayed),
      ga: int(r.goalsAgainst),
      gaa: intOrNull(r.goalsAgainstAverage) === null ? null : Number(r.goalsAgainstAverage),
      shotsAgainst: int(r.shotsAgainst),
      savePct: r.savePercentage == null ? null : Number(r.savePercentage),
      toi: int(r.playingTime),
      shutouts: int(r.shutOuts),
      wins: int(r.gameWinsRegular) + int(r.gameWinsOvertime),
      losses: int(r.gameLostRegular) + int(r.gameLostOvertime),
      nation: str(r.nation) || null,
    }))
    .filter((r: LeaderGoalie) => r.player);
}

export function normalizePenaltyLeaders(raw: any): LeaderPenalty[] {
  return (raw?.rows ?? [])
    .map((r: any) => ({
      player: playerRef(r)!,
      teamId: int(r.teamId),
      gp: int(r.gamesPlayed),
      pim: int(r.penaltyMinutes),
      minors: int(r.minorPenalties),
      majors: int(r.majorPenalties),
      misconducts: int(r.misconducts),
      gameMisconducts: int(r.gameMisconducts),
      matchPenalties: int(r.matchPenalties),
    }))
    .filter((r: LeaderPenalty) => r.player);
}

export function normalizeTeamStats(raw: any, teams: TeamRegistry): TeamSeasonStats[] {
  return (raw?.rows ?? []).map((r: any) => ({
    team: teams.ref(r.id, r.teamShortname, r.teamLongname),
    gp: int(r.gamesPlayed),
    ppChances: int(r.powerplayAdvantages),
    ppGoals: int(r.powerplayGoalsFor),
    ppPct: r.powerplayPercentage == null ? null : Number(r.powerplayPercentage),
    pkSituations: int(r.powerplayDisadvantages),
    ppGoalsAgainst: int(r.powerplayGoalsAgainst),
    pkPct: r.penaltyKillingPercentage == null ? null : Number(r.penaltyKillingPercentage),
    shGoalsFor: int(r.shorthandedGoalsFor),
    shGoalsAgainst: int(r.shorthandedGoalsAgainst),
    pim: int(r.penaltyMinutes),
    minors: int(r.minorPenalties),
    majors: int(r.majorPenalties),
  }));
}

// ---------- Game report ----------

function person(p: any): PersonName | null {
  const first = str(p?.firstname);
  const last = str(p?.lastname);
  return first || last ? { first, last } : null;
}

function periodName(p: unknown, numberOfPeriods: number): string {
  const s = str(p);
  if (/^\d+$/.test(s) && Number(s) > numberOfPeriods) return Number(s) === numberOfPeriods + 1 ? 'OT' : 'SO';
  return s.toUpperCase() || '?';
}

function teamStats(t: any): TeamGameStats {
  const tv = t?.timeValues ?? {};
  return {
    pim: int(t?.penaltyMinutes),
    ppGoals: int(t?.powerplayGoals),
    ppChances: int(t?.powerplayOpportunities),
    pkKilled: int(t?.penaltykillSuccesses),
    pkSituations: int(t?.penaltykillSituations),
    timeLeading: int(tv.leading),
    timeTied: int(tv.tied),
    timeTrailing: int(tv.trailing),
    timeOnPP: int(tv.timeOnPowerplay),
    timeShorthanded: int(tv.timeWhileShorthanded),
    sog: int(t?.shotsOnGoal),
  };
}

function skaters(list: any[]): SkaterLine[] {
  return (list ?? [])
    .map((p) => ({
      player: playerRef(p)!,
      position: str(p.position),
      g: int(p.goals),
      a: int(p.assists),
      p: int(p.points),
      plusMinus: int(p.plusMinus),
      pim: int(p.penaltyMinutes),
      sog: int(p.shotsOnGoal),
    }))
    .filter((s) => s.player);
}

function goalies(list: any[]): GoalieLine[] {
  return (list ?? [])
    .map((p) => ({
      player: playerRef(p)!,
      shotsAgainst: int(p.shotsAgainst),
      goalsAgainst: int(p.goalsAgainst),
      gaa: p.goalsAgainstAverage == null || p.goalsAgainstAverage === '' ? null : Number(p.goalsAgainstAverage),
      saves: int(p.saves),
      savePct: p.savePercentage == null || p.savePercentage === '' ? null : Number(p.savePercentage),
      toi: int(p.playingTime),
      starter: !!p.isStartingPlayer,
    }))
    .filter((g) => g.player);
}

export function normalizeGameReport(raw: any, summary: GameSummary, teams: TeamRegistry): Game {
  const gd = raw?.gameData ?? {};
  const nPeriods = int(gd.numberOfPeriods) || 3;
  const periodLength = int(gd.lengthOfPeriod);
  const goalsOf = (list: any[], team: 'home' | 'away') =>
    (list ?? []).map((g) => ({
      period: periodName(g.gameTimePeriod, nPeriods),
      time: int(g.gameTime),
      timeLabel: str(g.gameTimeFormatted),
      score: str(g.newScore),
      team,
      scorer: playerRef(g.scoredBy),
      assists: [playerRef(g.assistBy), playerRef(g.assist2By)].filter((x): x is PlayerRef => !!x),
      situation: g.isPenaltyShot ? 'PS' : g.isEmptyNet && str(g.gameStrength) === 'EQ' ? 'EN' : str(g.gameStrength) || 'EQ',
      emptyNet: !!g.isEmptyNet,
      penaltyShot: !!g.isPenaltyShot,
      gwg: !!g.isGameWinningGoal,
    }));
  const pensOf = (list: any[], team: 'home' | 'away') =>
    (list ?? []).map((p) => ({
      period: periodName(p.gameTimePeriod, nPeriods),
      time: int(p.gameTime),
      timeLabel: str(p.gameTimeFormatted),
      team,
      player: playerRef(p.offender),
      servedBy: playerRef(p.servedBy),
      minutes: Math.round((int(p.penaltyLength) / 60) * 100) / 100,
      code: str(p.offence),
    }));
  const changesOf = (list: any[], team: 'home' | 'away') =>
    (list ?? [])
      .map((c) => ({
        team,
        player: playerRef(c.player)!,
        action: (str(c.action) === 'off' ? 'off' : 'on') as 'on' | 'off',
        time: int(c.gametime ?? c.gameTime),
        timeLabel: str(c.gameTimeFormatted),
        period: periodName(c.gameTimePeriod, nPeriods),
      }))
      .filter((c) => c.player);

  const refs = [person(gd.gameOfficials?.ref1), person(gd.gameOfficials?.ref2)].filter((x): x is PersonName => !!x);
  const lines = [person(gd.gameOfficials?.linesman1), person(gd.gameOfficials?.linesman2)].filter(
    (x): x is PersonName => !!x,
  );
  const periods: [number, number][] = (gd.periodStats ?? []).map((p: any) => [int(p.homeScore), int(p.awayScore)]);

  const goals = [...goalsOf(raw.homeGoals, 'home'), ...goalsOf(raw.awayGoals, 'away')].sort((a, b) => a.time - b.time);
  const penalties = [...pensOf(raw.homePenalties, 'home'), ...pensOf(raw.awayPenalties, 'away')].sort(
    (a, b) => a.time - b.time,
  );
  const goalieChanges = [...changesOf(raw.homeGoalKeeperChanges, 'home'), ...changesOf(raw.awayGoalKeeperChanges, 'away')].sort(
    (a, b) => a.time - b.time,
  );

  const status: GameStatus = int(gd.gameStatus) >= 4 ? 'final' : summary.status;
  return {
    ...summary,
    home: teams.ref(gd.homeTeamId ?? summary.home.id, gd.homeTeamShortname ?? summary.home.short, gd.homeTeamLongname ?? summary.home.name),
    away: teams.ref(gd.awayTeamId ?? summary.away.id, gd.awayTeamShortname ?? summary.away.short, gd.awayTeamLongname ?? summary.away.name),
    homeScore: intOrNull(gd.homeTeamScore) ?? summary.homeScore,
    awayScore: intOrNull(gd.awayTeamScore) ?? summary.awayScore,
    periods: periods.length ? periods : summary.periods,
    venue: str(gd.location?.longname) || summary.venue,
    overtime: !!int(gd.isOvertime) || summary.overtime,
    shootout: !!int(gd.isShootOut) || summary.shootout,
    status,
    hasReport: true,
    attendance: intOrNull(gd.attendance) || null,
    startTime: str(gd.startTime) || null,
    endTime: str(gd.endTime) || null,
    periodLength,
    numberOfPeriods: nPeriods,
    referees: refs,
    linesmen: lines,
    headCoaches: {
      home: person(gd.teamOfficials?.headcoachhome),
      away: person(gd.teamOfficials?.headcoachaway),
    },
    goals,
    penalties,
    teamStats: { home: teamStats(raw.homeTeamStats), away: teamStats(raw.awayTeamStats) },
    skaters: { home: skaters(raw.homeFieldPlayers), away: skaters(raw.awayFieldPlayers) },
    goalies: { home: goalies(raw.homeGoalKeepers), away: goalies(raw.awayGoalKeepers) },
    goalieChanges,
  };
}
