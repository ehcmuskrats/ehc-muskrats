// Normalized data model. Written by scripts/sync-data.ts into data/*.json,
// read by the Astro pages. Raw league data lives (gitignored) in data/raw/.

/** Season id, filesystem-safe: "2026-27". Display label: "2026/27". */
export type SeasonId = string;

export type GameStatus = 'scheduled' | 'live' | 'final' | 'tbd';

/** EQ, PP1, PP2, SH1, SH2, EN, PS (and anything else the league sends, kept verbatim). */
export type GoalSituation = 'EQ' | 'PP1' | 'PP2' | 'SH1' | 'SH2' | 'EN' | 'PS' | string;

export type Position = 'C' | 'LF' | 'RF' | 'F' | 'LD' | 'RD' | 'D' | 'G' | string;

export interface DivisionRef {
  id: number;
  /** As shown in the league picker: "Grunddurchgang", "Playoffs", "TOP 4", ... */
  name: string;
  kind: 'regular' | 'placement' | 'playoffs';
}

export interface SeasonInfo {
  id: SeasonId;
  label: string; // "2026/27"
  divisions: DivisionRef[];
  /** Does EHC Muskrats appear in any division of this season? */
  muskratsPlays: boolean;
  /** Past seasons are scraped once and then frozen. */
  frozen: boolean;
  lastSynced: string | null; // ISO timestamp
}

export interface TeamRef {
  id: number;
  short: string; // "MUS"
  name: string; // league long name, "EHC Muscrats" is mapped to display name in config
  /** Site-relative logo path, e.g. "logos/35328.png", or null if not downloaded. */
  logo: string | null;
}

export interface PersonName {
  first: string;
  last: string;
}

export interface PlayerRef {
  /** hockeydata player id (stable across seasons). */
  id: number;
  first: string;
  last: string;
  number: number | null;
}

/** One row in a season schedule (all league games, not only ours). */
export interface GameSummary {
  id: string; // UUID
  season: SeasonId;
  divisionId: number;
  divisionName: string;
  /** "Spiel 9", "1. Viertelfinale", ... */
  name: string | null;
  /** Local Vienna date "2026-11-16" or null if TBD. */
  date: string | null;
  /** Local Vienna time "20:55" or null if TBD. */
  time: string | null;
  /** UTC timestamp in ms; null if date is TBD. */
  timestamp: number | null;
  venue: string | null;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  /** [home, away] per period, OT and SO as extra entries flagged below. */
  periods: [number, number][];
  overtime: boolean;
  shootout: boolean;
  status: GameStatus;
  /** Playoff round info derived from the knockout widget, if any. */
  playoff: PlayoffInfo | null;
  /** True when a full game report has been stored in data/games/<id>.json. */
  hasReport: boolean;
}

export interface PlayoffInfo {
  round: 'quarterfinal' | 'semifinal' | 'final' | 'third' | 'other';
  roundLabel: string; // league label, e.g. "Viertelfinal Spiele"
  encounter: string | null; // "1. Viertelfinale"
  gameNumber: number | null; // 1, 2, 3 within a series
}

export interface Goal {
  period: string; // "1", "2", "3", "OT", "SO"
  /** Seconds since game start. */
  time: number;
  timeLabel: string; // "71:53"
  score: string; // running score "8:4" (home:away)
  team: 'home' | 'away';
  scorer: PlayerRef | null;
  assists: PlayerRef[];
  situation: GoalSituation;
  emptyNet: boolean;
  penaltyShot: boolean;
  gwg: boolean;
}

export interface Penalty {
  period: string;
  time: number;
  timeLabel: string;
  team: 'home' | 'away';
  player: PlayerRef | null;
  servedBy: PlayerRef | null;
  /** Minutes (penaltyLength seconds / 60). Minors are 3:00 in this league. */
  minutes: number;
  /** Offence code as sent: TRIP, SLASH, HOOK, INTRF, ... */
  code: string;
}

export interface TeamGameStats {
  pim: number;
  ppGoals: number;
  ppChances: number;
  pkKilled: number;
  pkSituations: number;
  /** Seconds. */
  timeLeading: number;
  timeTied: number;
  timeTrailing: number;
  timeOnPP: number;
  timeShorthanded: number;
  sog: number;
}

export interface SkaterLine {
  player: PlayerRef;
  position: Position;
  g: number;
  a: number;
  p: number;
  plusMinus: number;
  pim: number;
  sog: number;
}

export interface GoalieLine {
  player: PlayerRef;
  shotsAgainst: number;
  goalsAgainst: number;
  gaa: number | null;
  saves: number;
  savePct: number | null;
  /** Seconds played. */
  toi: number;
  starter: boolean;
}

export interface GoalieChange {
  team: 'home' | 'away';
  player: PlayerRef;
  action: 'on' | 'off';
  time: number;
  timeLabel: string;
  period: string;
}

/** Full game report for an EHC Muskrats game. data/games/<id>.json */
export interface Game extends GameSummary {
  attendance: number | null;
  startTime: string | null; // actual start "20:58"
  endTime: string | null;
  periodLength: number; // seconds, e.g. 1500 (25 min)
  numberOfPeriods: number;
  referees: PersonName[];
  linesmen: PersonName[];
  headCoaches: { home: PersonName | null; away: PersonName | null };
  goals: Goal[];
  penalties: Penalty[];
  teamStats: { home: TeamGameStats; away: TeamGameStats };
  skaters: { home: SkaterLine[]; away: SkaterLine[] };
  goalies: { home: GoalieLine[]; away: GoalieLine[] };
  goalieChanges: GoalieChange[];
}

export interface StandingRow {
  rank: number;
  team: TeamRef;
  gp: number;
  w: number;
  l: number;
  otw: number;
  otl: number;
  ties: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface Standings {
  season: SeasonId;
  divisionId: number;
  divisionName: string;
  unofficial: boolean;
  rows: StandingRow[];
}

export interface PlayoffEncounter {
  id: number;
  label: string;
  bestOf: number;
  teams: { team: TeamRef; wins: number; winner: boolean }[];
  gameIds: string[];
}

export interface PlayoffPhase {
  divisionId: number;
  label: string;
  round: PlayoffInfo['round'];
  encounters: PlayoffEncounter[];
}

export interface PlayoffBracket {
  season: SeasonId;
  divisionId: number;
  phases: PlayoffPhase[];
}

/** League leader rows (only stored for all teams so we can show context; pages filter). */
export interface LeaderSkater {
  player: PlayerRef;
  teamId: number;
  position: Position;
  gp: number;
  g: number;
  a: number;
  p: number;
  pim: number;
  ppg: number;
  shg: number;
  gwg: number;
  plusMinus: number;
  sog: number;
}

export interface LeaderGoalie {
  player: PlayerRef;
  teamId: number;
  gp: number;
  ga: number;
  gaa: number | null;
  shotsAgainst: number;
  savePct: number | null;
  toi: number;
  shutouts: number;
  wins: number;
  losses: number;
}

export interface LeaderPenalty {
  player: PlayerRef;
  teamId: number;
  gp: number;
  pim: number;
  minors: number;
  majors: number;
  misconducts: number;
  gameMisconducts: number;
  matchPenalties: number;
}

export interface TeamSeasonStats {
  team: TeamRef;
  gp: number;
  ppChances: number;
  ppGoals: number;
  ppPct: number | null;
  pkSituations: number;
  ppGoalsAgainst: number;
  pkPct: number | null;
  shGoalsFor: number;
  shGoalsAgainst: number;
  pim: number;
  minors: number;
  majors: number;
}

export interface DivisionStats {
  season: SeasonId;
  divisionId: number;
  skaters: LeaderSkater[];
  goalies: LeaderGoalie[];
  penalties: LeaderPenalty[];
  teams: TeamSeasonStats[];
}

/** data/seasons/<season>.json */
export interface SeasonData {
  info: SeasonInfo;
  games: GameSummary[];
  standings: Standings[];
  playoffs: PlayoffBracket | null;
  stats: DivisionStats[];
}

// ---------- Derived (computed from the above by scripts/lib/derive.ts) ----------

export interface PlayerSeasonLine {
  season: SeasonId;
  /** All numbers/positions used that season (history, not shown). */
  numbers: number[];
  positions: Position[];
  /** Number and position in the player's last game of the season (what the site shows). */
  number: number | null;
  position: Position | null;
  gp: number;
  g: number;
  a: number;
  p: number;
  pim: number;
  ppg: number;
  shg: number;
  gwg: number;
  plusMinus: number;
  sog: number;
  // goalie
  goalieGp: number;
  ga: number;
  toi: number;
  gaa: number | null;
  shotsAgainst: number;
  saves: number;
  /** Games on the sheet as backup goalie without playing (e.g. a second goalie who dressed). */
  dressed: number;
}

export type CareerLine = Omit<PlayerSeasonLine, 'season' | 'numbers' | 'positions' | 'number' | 'position'>;

export interface PlayerGameLine {
  gameId: string;
  season: SeasonId;
  date: string | null;
  opponent: TeamRef;
  home: boolean;
  number: number | null;
  playoff: boolean;
  result: 'W' | 'L' | 'OTW' | 'OTL' | 'T' | null;
  score: string; // from our perspective "8:4"
  position: Position;
  g: number;
  a: number;
  pim: number;
  goalie: { ga: number; toi: number } | null;
}

export interface PlayerGoal {
  gameId: string;
  season: SeasonId;
  date: string | null;
  opponent: TeamRef;
  period: string;
  timeLabel: string;
  situation: GoalSituation;
  assists: PlayerRef[];
  gwg: boolean;
  playoff: boolean;
}

export interface PlayerProfile {
  id: number;
  slug: string;
  first: string;
  last: string;
  /** Every number/position ever used (history, kept for later; not shown). */
  numbers: number[];
  positions: Position[];
  /** From the most recent game: what the site shows. */
  currentNumber: number | null;
  currentPosition: Position | null;
  /** Season totals (all phases). */
  seasons: PlayerSeasonLine[];
  career: CareerLine;
  /** Same split by phase: regular = every non-playoff round (incl. TOP 4 / LOW 5), playoffs = playoff games only. */
  regular: { seasons: PlayerSeasonLine[]; career: CareerLine };
  playoffs: { seasons: PlayerSeasonLine[]; career: CareerLine };
  games: PlayerGameLine[];
  goals: PlayerGoal[];
  isGoalie: boolean;
}

export interface TeamRecordGame {
  gameId: string;
  season: SeasonId;
  date: string | null;
  opponent: TeamRef;
  score: string;
  margin: number;
  goalsFor: number;
}

/**
 * One rotating record card on the all-time page. Every number is computed from league data; nothing is typed in.
 * kind decides the label and how the detail line reads.
 */
export interface TeamRecordCard {
  kind:
    | 'biggestWin'
    | 'mostGoals'
    | 'bestSeason'
    | 'winStreak'
    | 'unbeatenStreak'
    | 'comeback'
    | 'periodGoals'
    | 'highestScoring'
    | 'shutouts'
    | 'playoffWin'
    | 'fastestGoal'
    | 'playerGoalsGame'
    | 'playerPointsGame'
    | 'playoffSeries';
  /** Big number/label on the card ("5", "8:1", "0:42", "2024/25"). */
  value: string;
  /** Link target: a game, or a standings season. */
  gameId?: string;
  season?: SeasonId;
  date?: string | null;
  /** Range for streaks. */
  from?: string | null;
  to?: string | null;
  opponent?: TeamRef;
  score?: string;
  player?: PlayerRef & { slug?: string };
  /** Extra numbers a card needs (deficit overcome, period number, count of games ...). */
  n?: number;
  text?: string;
}

export interface TeamRecords {
  /** Pool of record cards; the page shows a random 3 per visit. */
  cards?: TeamRecordCard[];
  biggestWin: TeamRecordGame | null;
  mostGoals: TeamRecordGame | null;
  bestSeason: { season: SeasonId; divisionName: string; pts: number; gp: number; rank: number } | null;
  allTime: { gp: number; w: number; l: number; otw: number; otl: number; ties: number; gf: number; ga: number };
}

/** data/derived.json */
export interface Derived {
  generatedAt: string;
  players: PlayerProfile[];
  records: TeamRecords;
  /** Per season, which stats columns have any non-zero data (SOG, +/-, saves). */
  columnAvailability: Record<SeasonId, { sog: boolean; plusMinus: boolean; saves: boolean }>;
}

// ---------- Highlights ----------

export interface Video {
  id: string; // YouTube video id
  title: string;
  publishedAt: string;
  thumbnail: string | null;
}

export interface ParsedTitle {
  opponent: string | null;
  round: PlayoffInfo['round'] | null;
  gameNumber: number | null;
  date: string | null; // "2025-01-06"
  season: SeasonId | null;
  isGame: boolean;
}

export interface HighlightMatch {
  video: Video;
  parsed: ParsedTitle;
  gameId: string | null;
  season: SeasonId | null;
  status: 'matched' | 'override' | 'not-a-game' | 'ambiguous' | 'unmatched';
  note: string | null;
}

/** data/highlights.json */
export interface HighlightsData {
  fetchedAt: string | null;
  channelId: string;
  items: HighlightMatch[];
}
