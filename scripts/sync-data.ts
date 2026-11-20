// Nightly data sync.
//
//   npm run sync               normal nightly run: current season + any season never synced, highlights, derive
//   npm run sync -- --full     re-list all seasons and re-scrape every season that isn't frozen
//   npm run sync -- --season 2024-25   (re-)scrape one season even if frozen
//   npm run sync:highlights    only YouTube highlights + derive
//   npm run derive             only recompute derived data + validation from data/
//
// Raw captures go to data/raw/ (gitignored). Normalized JSON goes to data/ (committed).
// On any scraper failure the last good data is kept, a clear message is printed and the
// process exits with code 1 (the workflow then still deploys and opens an issue).
import { existsSync } from 'node:fs';
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env file — fine in CI, where secrets come from the environment */
}
import type { DivisionRef, Game, GameSummary, SeasonData, SeasonId, SeasonInfo, TeamRef } from '../src/types/models.ts';
import { TEAM, isOurTeam } from '../src/config/team.ts';
import { SyncError, type DataSource, type DivisionDataKind, type DivisionTarget } from './lib/datasource.ts';
import { WehvBrowserSource } from './lib/wehv-browser-source.ts';
import {
  TeamRegistry,
  divisionKind,
  normalizeGameReport,
  normalizeGoalies,
  normalizeKnockout,
  normalizePenaltyLeaders,
  normalizeSchedule,
  normalizeSkaters,
  normalizeStandings,
  normalizeTeamStats,
  pickerLabelFromId,
  seasonIdFromLabel,
  seasonLabelFromId,
} from './lib/normalize.ts';
import { readJson, writeJson, listJson } from './lib/io.ts';
import { deriveAll } from './lib/derive.ts';
import { validateAll } from './lib/validate.ts';
import { syncHighlights } from './lib/highlights.ts';

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const argValue = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const DIVISIONS_FILE = 'src/config/divisions.json';
const TEAMS_FILE = 'data/teams.json';
const STATUS_FILE = 'data/sync-status.json';
const seasonFile = (id: SeasonId) => `data/seasons/${id}.json`;
const gameFile = (id: string) => `data/games/${id}.json`;

type DivisionsConfig = { _comment?: string; seasons: Record<SeasonId, DivisionRef[]> };

const errors: string[] = [];
const warnings: string[] = [];
const log = (m: string) => console.log(m);

function loadSeason(id: SeasonId): SeasonData | null {
  return readJson<SeasonData | null>(seasonFile(id), null);
}

function sortSeasonIds(ids: SeasonId[]): SeasonId[] {
  return [...ids].sort((a, b) => b.localeCompare(a)); // newest first
}

async function scrapeLeague(source: WehvBrowserSource, teams: TeamRegistry) {
  const divCfg = readJson<DivisionsConfig>(DIVISIONS_FILE, { seasons: {} });

  // 1) Which seasons/divisions exist?
  let currentSeason: SeasonId;
  if (flag('--full') || Object.keys(divCfg.seasons).length === 0) {
    log('Listing all seasons and divisions from the league site...');
    const all = await source.listSeasons();
    for (const s of all) {
      divCfg.seasons[seasonIdFromLabel(s.seasonLabel)] = s.divisions.map((d) => ({ ...d, kind: divisionKind(d.name) }));
    }
    currentSeason = seasonIdFromLabel(all[0].seasonLabel);
  } else {
    const cur = await source.listCurrentSeason();
    currentSeason = seasonIdFromLabel(cur.seasonLabel);
    divCfg.seasons[currentSeason] = cur.divisions.map((d) => ({ ...d, kind: divisionKind(d.name) }));
  }
  divCfg._comment =
    'Season -> division mapping as shown in the wehv.at division picker. Refreshed by the sync (current season only, or all with --full); past seasons are frozen. kind: regular | placement | playoffs.';
  writeJson(DIVISIONS_FILE, divCfg);
  log(`Current league season: ${currentSeason}`);

  // 2) Which seasons need scraping?
  const only = argValue('--season');
  const toSync = sortSeasonIds(Object.keys(divCfg.seasons)).filter((id) => {
    if (only) return id === only;
    if (flag('--current')) return id === currentSeason;
    const existing = loadSeason(id);
    return id === currentSeason || !existing || !existing.info.frozen;
  });
  if (!toSync.length) {
    log('Nothing to scrape (all seasons frozen).');
    return currentSeason;
  }
  log(`Seasons to scrape: ${toSync.join(', ')}`);

  // 3) Load each data kind with one page visit, iterating the picker over all targets.
  const targetsFor = (pred: (d: DivisionRef) => boolean): DivisionTarget[] =>
    toSync.flatMap((sid) =>
      divCfg.seasons[sid].filter(pred).map((d) => ({ seasonLabel: pickerLabelFromId(sid), divisionId: d.id })),
    );
  const all = targetsFor(() => true);
  const nonPlayoff = targetsFor((d) => d.kind !== 'playoffs');
  const playoff = targetsFor((d) => d.kind === 'playoffs');

  const fetched: Partial<Record<DivisionDataKind, Map<number, any>>> = {};
  const plan: [DivisionDataKind, DivisionTarget[]][] = [
    ['schedule', all],
    ['standings', nonPlayoff],
    ['knockout', playoff],
    ['skaters', all],
    ['goalies', all],
    ['penalties', all],
    ['teams', all],
  ];
  if (flag('--quick')) plan.splice(3); // schedule, standings, knockout only
  for (const [kind, targets] of plan) {
    log(`Fetching ${kind}...`);
    fetched[kind] = await source.fetchDivisionData(kind, targets);
  }

  // 4) Normalize per season and write.
  for (const sid of toSync) {
    const divisions = divCfg.seasons[sid];
    const prev = loadSeason(sid);
    const games = new Map<string, GameSummary>();
    const standings = [];
    const stats = [];
    let playoffs = null;
    for (const d of divisions) {
      const sched = fetched.schedule?.get(d.id);
      if (sched) for (const g of normalizeSchedule(sched, sid, d, teams)) games.set(g.id, g);
      if (d.kind === 'playoffs') {
        const ko = fetched.knockout?.get(d.id);
        if (ko) {
          const { bracket, games: koGames } = normalizeKnockout(ko, sid, d.id, teams);
          if (bracket.phases.length) playoffs = bracket;
          for (const g of koGames) {
            const existing = games.get(g.id);
            games.set(g.id, existing ? { ...existing, playoff: g.playoff, divisionId: d.id, divisionName: d.name } : g);
          }
        }
      } else {
        const st = fetched.standings?.get(d.id);
        if (st && (st.rows ?? []).length) standings.push(normalizeStandings(st, sid, d, teams));
      }
      if (fetched.skaters) {
        stats.push({
          season: sid,
          divisionId: d.id,
          skaters: normalizeSkaters(fetched.skaters.get(d.id)),
          goalies: normalizeGoalies(fetched.goalies?.get(d.id)),
          penalties: normalizePenaltyLeaders(fetched.penalties?.get(d.id)),
          teams: normalizeTeamStats(fetched.teams?.get(d.id), teams),
        });
      }
    }
    if (!games.size) {
      errors.push(`Season ${sid}: no games captured — keeping previous data for this season.`);
      continue;
    }
    // Keep hasReport flags from existing game files.
    for (const g of games.values()) g.hasReport = existsSync(gameFile(g.id));
    const gameList = [...games.values()].sort(
      (a, b) => (a.timestamp ?? Number.MAX_SAFE_INTEGER) - (b.timestamp ?? Number.MAX_SAFE_INTEGER),
    );
    const ours = gameList.filter((g) => isOurTeam(g.home) || isOurTeam(g.away));
    const allFinal = gameList.length > 0 && gameList.every((g) => g.status === 'final');
    const info: SeasonInfo = {
      id: sid,
      label: seasonLabelFromId(sid),
      divisions,
      muskratsPlays: ours.length > 0,
      // A past season is frozen once everything is final, or once its last dated game is 30+ days old
      // (some old seasons have games that were cancelled and never got a final status).
      frozen:
        sid !== currentSeason &&
        (allFinal ||
          gameList.every((g) => g.status === 'final' || g.status === 'tbd') ||
          Math.max(...gameList.map((g) => g.timestamp ?? 0)) < Date.now() - 30 * 86400_000),
      lastSynced: new Date().toISOString(),
    };
    const data: SeasonData = {
      info,
      games: gameList,
      standings,
      playoffs,
      stats: stats.length ? stats : prev?.stats ?? [],
    };
    writeJson(seasonFile(sid), data);
    log(`  ${sid}: ${gameList.length} games (${ours.length} ours), ${standings.length} standings table(s)${info.frozen ? ', frozen' : ''}`);
  }
  return currentSeason;
}

async function scrapeGameReports(source: DataSource, teams: TeamRegistry) {
  // Only our games; only final (or live) games; skip reports we already stored as final.
  const max = Number(argValue('--max-reports') ?? 1000);
  let done = 0;
  let consecutiveFailures = 0;
  for (const f of listJson('data/seasons')) {
    const season = readJson<SeasonData>(`data/seasons/${f}`, null as any);
    let changed = false;
    for (const g of season.games) {
      if (!(isOurTeam(g.home) || isOurTeam(g.away))) continue;
      if (g.status !== 'final' && g.status !== 'live') continue;
      const existing = readJson<Game | null>(gameFile(g.id), null);
      // Games from the last 3 days are re-checked even when final: WEHV sometimes corrects
      // scorers or penalties the day after a game.
      const recent = g.timestamp != null && g.timestamp > Date.now() - 3 * 86400_000;
      if (existing && existing.status === 'final' && !recent) {
        if (!g.hasReport) {
          g.hasReport = true;
          changed = true;
        }
        continue;
      }
      if (done >= max || consecutiveFailures >= 3) continue;
      log(`  game report ${g.season} ${g.date} ${g.home.short}-${g.away.short} (${g.id})`);
      try {
        const raw = await source.fetchGameReport(g.id);
        const game = normalizeGameReport(raw, g, teams);
        writeJson(gameFile(g.id), game);
        g.hasReport = true;
        changed = true;
        done++;
        consecutiveFailures = 0;
      } catch (e) {
        if (!(e instanceof SyncError)) throw e;
        errors.push(e.message);
        consecutiveFailures++;
        if (consecutiveFailures === 3) {
          errors.push('Stopped loading game reports after 3 failures in a row (wehv.at unreachable?). The rest will be retried next run.');
        }
      }
    }
    if (changed) writeJson(`data/seasons/${f}`, season);
  }
  log(`Fetched ${done} game report(s).`);
}

async function main() {
  const started = Date.now();
  const teams = new TeamRegistry();
  teams.load(readJson<TeamRef[]>(TEAMS_FILE, []));

  const deriveOnly = flag('--derive-only');
  const highlightsOnly = flag('--highlights-only');

  if (!deriveOnly && !highlightsOnly) {
    const source = new WehvBrowserSource({ log });
    try {
      await source.open();
      await scrapeLeague(source, teams);
      if (!flag('--no-reports')) await scrapeGameReports(source, teams);
    } catch (e) {
      const msg = e instanceof SyncError ? e.message : `Unexpected error: ${(e as Error).stack ?? e}`;
      errors.push(`League sync failed: ${msg}`);
      console.error('\n*** LEAGUE SYNC FAILED — last good data in data/ was kept. ***\n' + msg + '\n');
    } finally {
      await source.close();
    }
    // Refresh logo paths now that logos may have been downloaded.
    const refreshed = new TeamRegistry();
    for (const t of teams.all()) refreshed.ref(t.id, t.short, t.name);
    writeJson(TEAMS_FILE, refreshed.all());
  }

  if (!deriveOnly && !flag('--no-highlights')) {
    try {
      const report = await syncHighlights(log);
      warnings.push(...report.warnings);
    } catch (e) {
      errors.push(`Highlights sync failed: ${(e as Error).message}`);
      console.error('\n*** HIGHLIGHTS SYNC FAILED — previous data/highlights.json kept. ***\n' + (e as Error).message);
    }
  }

  // Derive + validate always run on whatever good data we have.
  const derived = deriveAll(log);
  writeJson('data/derived.json', derived);
  const mismatches = validateAll(log);
  warnings.push(...mismatches);

  if (!deriveOnly) writeJson(STATUS_FILE, {
    lastRun: new Date().toISOString(),
    ok: errors.length === 0,
    errors,
    warningCount: warnings.length,
    durationSec: Math.round((Date.now() - started) / 1000),
  });

  if (warnings.length) {
    log(`\n${warnings.length} warning(s)/mismatch(es) — see above.`);
  }
  if (errors.length) {
    console.error(`\nSync finished with ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  log(`\nSync OK in ${Math.round((Date.now() - started) / 1000)}s. Team: ${TEAM.displayName}`);
}

await main();
