// Adapter interface between the sync pipeline and wherever the league data comes from.
// Today: WehvBrowserSource (headless browser on the public wehv.at pages).
// Later, if we get our own hockeydata key: a direct API source returning the same raw payloads.

export type DivisionDataKind =
  | 'schedule' // Schedule
  | 'standings' // Standings
  | 'knockout' // KnockoutStage (playoff bracket)
  | 'skaters' // LeaderFieldPlayers
  | 'goalies' // LeaderGoalkeepers
  | 'penalties' // LeaderBadBoys
  | 'teams'; // TeamPowerplay (also contains PK + penalty totals)

export interface DivisionTarget {
  seasonLabel: string; // "Saison 2025/26" as shown in the picker
  divisionId: number;
}

export interface SeasonDivisions {
  seasonLabel: string;
  divisions: { id: number; name: string }[];
}

export interface DataSource {
  open(): Promise<void>;
  close(): Promise<void>;
  /** Every season in the league's season picker with its divisions. */
  listSeasons(): Promise<SeasonDivisions[]>;
  /**
   * Load one kind of division data for several targets. Returns the raw hockeydata `data`
   * payload per divisionId. Missing entries mean "not available" (e.g. no standings for playoffs).
   * Throws SyncError if the source is broken (layout/widget change).
   */
  fetchDivisionData(kind: DivisionDataKind, targets: DivisionTarget[]): Promise<Map<number, any>>;
  /** Raw hockeydata game report payload (`data` of GetGameReport). */
  fetchGameReport(gameId: string): Promise<any>;
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}
