// DataSource that loads the public wehv.at pages in headless Chromium, exactly as a visitor
// would, and reads the JSON the page's own hockeydata widgets receive.
//
// Rules (see docs/data-permission.md):
//  - We never call api.hockeydata.net ourselves and never store or log its request URLs
//    (they contain WEHV's API key). We only read responses the page itself received.
//  - One page at a time, with a polite delay between loads / picker changes.
//  - If the expected widget data does not arrive, we fall back to reading the rendered
//    tables from the DOM (schedule + standings), else fail loudly with a SyncError.
import { chromium, type Browser, type Page, type Response } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource, DivisionDataKind, DivisionTarget, SeasonDivisions } from './datasource.ts';
import { SyncError } from './datasource.ts';
import { stripJsonp, endpointName } from './jsonp.ts';
import { listDivisions, listSeasons, pickDivision, pickSeason } from './picker.ts';
import { parseScheduleDom, parseStandingsDom } from './dom-fallback.ts';

const LEAGUE_BASE = 'https://www.wehv.at/de/leagues/wiener-landesliga-4/';

const PAGES: Record<DivisionDataKind, { path: string; endpoint: string }> = {
  schedule: { path: 'spielplan-ergebnisse/', endpoint: 'Schedule' },
  standings: { path: 'tabelle/', endpoint: 'Standings' },
  knockout: { path: 'playoffs/', endpoint: 'KnockoutStage' },
  skaters: { path: 'statistik/spieler-statistik/top-scorer/', endpoint: 'LeaderFieldPlayers' },
  goalies: { path: 'statistik/spieler-statistik/top-goalies/', endpoint: 'LeaderGoalkeepers' },
  penalties: { path: 'statistik/spieler-statistik/bad-boys/', endpoint: 'LeaderBadBoys' },
  teams: { path: 'statistik/team-statistik/power-play/', endpoint: 'TeamPowerplay' },
};

export interface BrowserSourceOptions {
  /** Delay between page loads / picker changes, ms. */
  politeDelayMs?: number;
  /** How long to wait for a widget's data after a page load or picker change, ms. */
  dataTimeoutMs?: number;
  /** Where to keep raw captures (gitignored). */
  rawDir?: string;
  /** Where team logos seen on the pages are saved. */
  logoDir?: string;
  log?: (msg: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class WehvBrowserSource implements DataSource {
  private browser: Browser | null = null;
  private page: Page | null = null;
  /** Captured payloads on the current page, keyed by `${endpoint}:${divisionId|gameId}`. */
  private captured = new Map<string, any>();
  private readonly delay: number;
  private readonly timeout: number;
  private readonly rawDir: string;
  private readonly logoDir: string;
  private readonly log: (m: string) => void;

  constructor(opts: BrowserSourceOptions = {}) {
    this.logoDir = opts.logoDir ?? 'public/logos';
    this.delay = opts.politeDelayMs ?? 3000;
    this.timeout = opts.dataTimeoutMs ?? 25000;
    this.rawDir = opts.rawDir ?? 'data/raw';
    this.log = opts.log ?? ((m) => console.log(m));
  }

  async open() {
    this.browser = await chromium.launch();
    const context = await this.browser.newContext({
      locale: 'de-AT',
      timezoneId: 'Europe/Vienna',
      userAgent: undefined,
    });
    this.page = await context.newPage();
    this.page.on('response', (res) => void this.onResponse(res));
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }

  private async onResponse(res: Response) {
    const url = res.url();
    // Team logos the page itself loaded: keep a copy once, so the site never hotlinks.
    const logo = /api\.hockeydata\.net\/+img\/icehockey\/ebel\/team-logos\/(?:\d+\/)?(\d+)\.png/.exec(url);
    if (logo && res.ok()) {
      const file = join(this.logoDir, `${logo[1]}.png`);
      if (!existsSync(file)) {
        try {
          mkdirSync(this.logoDir, { recursive: true });
          writeFileSync(file, await res.body());
          this.log(`  + saved logo for team ${logo[1]}`);
        } catch {
          /* ignore, will retry next time */
        }
      }
      return;
    }
    if (!url.includes('api.hockeydata.net/data/')) return;
    const endpoint = endpointName(url);
    let divisionParam: string | null = null;
    try {
      divisionParam = new URL(url).searchParams.get('divisionId');
    } catch {
      /* ignore */
    }
    try {
      const body = stripJsonp(await res.text());
      const data = body?.data ?? body;
      let key: string;
      if (endpoint === 'GetGameReport') key = `${endpoint}:${data?.gameData?.id}`;
      else key = `${endpoint}:${data?.divisionId ?? divisionParam}`;
      this.captured.set(key, data);
    } catch (e) {
      // Do not print the URL (contains WEHV's key) — endpoint name only.
      this.log(`  ! could not parse ${endpoint} response: ${(e as Error).message}`);
    }
  }

  private get p(): Page {
    if (!this.page) throw new SyncError('Browser not open');
    return this.page;
  }

  private async goto(path: string) {
    const url = LEAGUE_BASE + path;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      this.captured.clear();
      try {
        await this.p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        return;
      } catch (e) {
        lastError = e;
        // A failed navigation can leave the tab mid-navigation; reset it before going on.
        await this.p.goto('about:blank').catch(() => {});
        if (attempt === 1) {
          this.log(`  ! load failed, retrying in 30s: ${path}`);
          await sleep(30000);
        }
      }
    }
    const msg = ((lastError as Error)?.message ?? String(lastError)).split('\n')[0];
    throw new SyncError(`Could not load ${url}: ${msg}`);
  }

  private async waitFor(key: string): Promise<any | undefined> {
    const until = Date.now() + this.timeout;
    while (Date.now() < until) {
      if (this.captured.has(key)) return this.captured.get(key);
      await sleep(250);
    }
    return undefined;
  }

  private saveRaw(parts: string[], data: unknown) {
    const file = join(this.rawDir, ...parts);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, JSON.stringify(data));
  }

  async listSeasons(): Promise<SeasonDivisions[]> {
    await this.goto(PAGES.schedule.path);
    let seasons: string[];
    try {
      seasons = await listSeasons(this.p);
    } catch {
      throw new SyncError(
        'Season picker not found on wehv.at schedule page. The widget layout probably changed — check scripts/lib/picker.ts.',
      );
    }
    const out: SeasonDivisions[] = [];
    for (const s of seasons) {
      await pickSeason(this.p, s);
      await sleep(this.delay);
      const divs = await listDivisions(this.p);
      out.push({ seasonLabel: s, divisions: divs.map((d) => ({ id: Number(d.id), name: d.name })) });
    }
    return out;
  }

  /** Lists only the season currently selected by default (cheap, one page load). */
  async listCurrentSeason(): Promise<SeasonDivisions> {
    await this.goto(PAGES.schedule.path);
    const seasons = await listSeasons(this.p);
    const current = await this.p.$eval('select.-hd-los-division-picker-select-season', (s) => (s as HTMLSelectElement).value);
    const divs = await listDivisions(this.p);
    if (!seasons.length) throw new SyncError('Season picker is empty on wehv.at.');
    return { seasonLabel: current, divisions: divs.map((d) => ({ id: Number(d.id), name: d.name })) };
  }

  async fetchDivisionData(kind: DivisionDataKind, targets: DivisionTarget[]): Promise<Map<number, any>> {
    const { path, endpoint } = PAGES[kind];
    const result = new Map<number, any>();
    if (!targets.length) return result;
    this.log(`  loading ${path} (${targets.length} division(s))`);
    await this.goto(path);
    let failures = 0;
    for (const t of targets) {
      const key = `${endpoint}:${t.divisionId}`;
      try {
        await pickSeason(this.p, t.seasonLabel);
        await sleep(500);
        const divs = await listDivisions(this.p);
        if (!divs.some((d) => Number(d.id) === t.divisionId)) {
          this.log(`  - ${kind}: division ${t.divisionId} not offered for ${t.seasonLabel} on this page, skipping`);
          continue;
        }
        await pickDivision(this.p, String(t.divisionId));
      } catch (e) {
        throw new SyncError(
          `Could not operate the season/division picker on ${path} (${t.seasonLabel}, ${t.divisionId}): ${(e as Error).message}`,
        );
      }
      let data = await this.waitFor(key);
      if (data === undefined) {
        data = await this.domFallback(kind, t);
        if (data !== undefined) this.log(`  ~ ${kind} ${t.divisionId}: used DOM fallback`);
      }
      if (data === undefined) {
        failures++;
        this.log(`  ! ${kind} ${t.seasonLabel} division ${t.divisionId}: no data received`);
      } else {
        result.set(t.divisionId, data);
        this.saveRaw([t.seasonLabel.replace(/\D+/g, '-').replace(/^-|-$/g, ''), String(t.divisionId), `${endpoint}.json`], data);
      }
      await sleep(this.delay);
    }
    if (failures && failures === targets.length && (kind === 'schedule' || kind === 'standings')) {
      throw new SyncError(
        `wehv.at ${path}: no ${endpoint} data for any of ${targets.length} division(s). The widgets or their data format probably changed.`,
      );
    }
    return result;
  }

  private async domFallback(kind: DivisionDataKind, t: DivisionTarget): Promise<any | undefined> {
    try {
      if (kind === 'schedule') return await parseScheduleDom(this.p, t.divisionId);
      if (kind === 'standings') return await parseStandingsDom(this.p, t.divisionId);
    } catch (e) {
      this.log(`  ! DOM fallback failed for ${kind}: ${(e as Error).message}`);
    }
    return undefined;
  }

  async fetchGameReport(gameId: string): Promise<any> {
    if (!/^[0-9a-f-]{36}$/i.test(gameId)) throw new SyncError(`Invalid game id ${gameId}`);
    await this.goto(`game/?id=${gameId}`);
    const data = await this.waitFor(`GetGameReport:${gameId}`);
    await sleep(this.delay);
    if (data === undefined) {
      throw new SyncError(
        `No game report data received for game ${gameId}. The game page widget may have changed.`,
      );
    }
    this.saveRaw(['games', `${gameId}.json`], data);
    return data;
  }
}
