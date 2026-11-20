// YouTube highlights: list the channel's uploads via the YouTube Data API v3,
// parse titles, match videos to our games, write data/highlights.json.
// Thumbnails are downloaded into public/thumbs/ so the site makes no request to Google
// until a visitor clicks play.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { GameSummary, HighlightMatch, HighlightsData, ParsedTitle, PlayoffInfo, SeasonId, TeamRef, Video } from '../../src/types/models.ts';
import { TEAM } from '../../src/config/team.ts';
import { readJson, writeJson } from './io.ts';
import { loadSeasons } from './data-access.ts';
import { ourSide } from './derive.ts';

const HIGHLIGHTS_FILE = 'data/highlights.json';
const OVERRIDES_FILE = 'data/highlights-overrides.json';
const ALIASES_FILE = 'src/config/team-aliases.json';
const THUMBS_DIR = 'public/thumbs';

interface Overrides {
  /** { "<videoId>": "<gameId>" } */
  pin: Record<string, string>;
  /** Video ids that are not game highlights. */
  notAGame: string[];
}

// ---------- YouTube API ----------

async function fetchUploads(apiKey: string): Promise<Video[]> {
  const videos: Video[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      playlistId: TEAM.youtube.uploadsPlaylistId,
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
    if (!res.ok) {
      let reason = '';
      try {
        reason = (await res.json())?.error?.message ?? '';
      } catch {
        /* ignore */
      }
      // Never print the URL: it contains the API key.
      throw new Error(`YouTube API returned HTTP ${res.status}${reason ? `: ${reason}` : ''}`);
    }
    const body: any = await res.json();
    for (const it of body.items ?? []) {
      const sn = it.snippet ?? {};
      const id = sn.resourceId?.videoId;
      if (!id || sn.title === 'Private video' || sn.title === 'Deleted video') continue;
      const thumb = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null;
      videos.push({ id, title: String(sn.title ?? ''), publishedAt: String(sn.publishedAt ?? ''), thumbnail: thumb });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return videos;
}

async function downloadThumb(v: Video, log: (m: string) => void) {
  const file = `${THUMBS_DIR}/${v.id}.jpg`;
  if (existsSync(file) || !v.thumbnail) return;
  try {
    const res = await fetch(v.thumbnail);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    mkdirSync(THUMBS_DIR, { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    log(`  ! thumbnail for ${v.id} failed: ${(e as Error).message}`);
  }
}

// ---------- Title parsing ----------

const ROUND_WORDS: Record<string, PlayoffInfo['round']> = {
  QUARTERFINAL: 'quarterfinal',
  QUARTERFINALS: 'quarterfinal',
  QF: 'quarterfinal',
  SEMIFINAL: 'semifinal',
  SEMIFINALS: 'semifinal',
  SF: 'semifinal',
  FINAL: 'final',
  FINALS: 'final',
};

export function parseTitle(title: string): ParsedTitle {
  const t = title.replace(/\s+/g, ' ').trim();
  const out: ParsedTitle = { opponent: null, round: null, gameNumber: null, date: null, season: null, isGame: false };

  // Season anywhere in the title ("24/25", "2024/25").
  const seasonM = /\b(?:20)?(\d{2})\s*\/\s*(\d{2})\b/.exec(t);
  if (seasonM && Number(seasonM[2]) === (Number(seasonM[1]) + 1) % 100) out.season = `20${seasonM[1]}-${seasonM[2]}`;

  const m = /^(?:EHC\s+)?Muskrats\s+vs\.?\s+(.+?)\s*(?:\|\s*([A-Za-z]+)\s*(\d+)?\s*)?\(\s*J4L\s+([^)]+?)\s*\)\s*$/i.exec(t);
  if (!m) return out;
  out.isGame = true;
  out.opponent = m[1].trim();
  if (m[2]) {
    out.round = ROUND_WORDS[m[2].toUpperCase()] ?? 'other';
    out.gameNumber = m[3] ? Number(m[3]) : null;
  }
  const tag = m[4];
  const dateM = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(tag);
  if (dateM) {
    out.date = `${dateM[3]}-${dateM[2].padStart(2, '0')}-${dateM[1].padStart(2, '0')}`;
    // Derive the season from the date (seasons run roughly Sep–Apr).
    const y = Number(dateM[3]);
    const mo = Number(dateM[2]);
    const start = mo >= 7 ? y : y - 1;
    out.season = `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  } else {
    const sm = /^(\d{2})\s*\/\s*(\d{2})$/.exec(tag);
    if (sm) out.season = `20${sm[1]}-${sm[2]}`;
  }
  return out;
}

// ---------- Opponent mapping ----------

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function bigrams(s: string): string[] {
  const x = norm(s).replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2));
  return out;
}
function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const counts = new Map<string, number>();
  for (const g of B) counts.set(g, (counts.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of A) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      inter++;
      counts.set(g, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

export function mapOpponent(name: string, teams: TeamRef[], aliases: Record<string, string>): TeamRef | null {
  const n = norm(name);
  const aliasKey = Object.keys(aliases).find((k) => norm(k) === n);
  const target = aliasKey ? norm(aliases[aliasKey]) : n;
  const exact = teams.find((t) => norm(t.name) === target || norm(t.short) === target);
  if (exact) return exact;
  // Token containment, e.g. "Teifl 2" vs "Teifl 2", "EHV Vienna Eagles" vs "EHV Vienna Eagles".
  const toks = target.split(' ');
  const contain = teams.filter((t) => {
    const tt = norm(t.name).split(' ');
    return toks.every((x) => tt.includes(x));
  });
  if (contain.length === 1) return contain[0];
  const scored = teams.map((t) => ({ t, s: dice(target, t.name) })).sort((a, b) => b.s - a.s);
  if (scored[0] && scored[0].s >= 0.6 && (!scored[1] || scored[0].s - scored[1].s >= 0.1)) return scored[0].t;
  return null;
}

// ---------- Matching ----------

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000;
}

export function matchVideos(
  videos: Video[],
  games: GameSummary[],
  overrides: Overrides,
  aliases: Record<string, string>,
): { items: HighlightMatch[]; unmappedOpponents: string[] } {
  const ours = games.filter((g) => ourSide(g) && g.status === 'final');
  const opponentOf = (g: GameSummary) => (ourSide(g) === 'home' ? g.away : g.home);
  const teamMap = new Map<number, TeamRef>();
  for (const g of ours) teamMap.set(opponentOf(g).id, opponentOf(g));
  const teams = [...teamMap.values()];
  const taken = new Set<string>();
  const unmapped = new Set<string>();
  const items: HighlightMatch[] = [];
  const sorted = [...videos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)); // oldest first

  // Overrides first, so their games are taken before heuristics run.
  for (const v of sorted) {
    const pinned = overrides.pin[v.id];
    if (pinned) taken.add(pinned);
  }

  for (const v of sorted) {
    const parsed = parseTitle(v.title);
    const base = { video: v, parsed, season: parsed.season };
    if (overrides.notAGame.includes(v.id)) {
      items.push({ ...base, gameId: null, status: 'not-a-game', note: 'override' });
      continue;
    }
    const pinned = overrides.pin[v.id];
    if (pinned) {
      const g = games.find((x) => x.id === pinned);
      items.push({ ...base, season: g?.season ?? parsed.season, gameId: pinned, status: 'override', note: g ? null : 'pinned game id not found in data' });
      continue;
    }
    if (!parsed.isGame) {
      items.push({ ...base, gameId: null, status: 'not-a-game', note: 'title is not a game pattern' });
      continue;
    }
    const opp = mapOpponent(parsed.opponent!, teams, aliases);
    if (!opp) {
      unmapped.add(parsed.opponent!);
      items.push({ ...base, gameId: null, status: 'unmatched', note: `opponent "${parsed.opponent}" not mapped — add it to src/config/team-aliases.json` });
      continue;
    }
    let cands = ours.filter((g) => opponentOf(g).id === opp.id && !taken.has(g.id));
    const roundFilter = (list: GameSummary[]) =>
      parsed.round
        ? list.filter(
            (g) =>
              g.playoff &&
              (g.playoff.round === parsed.round || parsed.round === 'other') &&
              (parsed.gameNumber == null || g.playoff.gameNumber === parsed.gameNumber),
          )
        : list;

    if (parsed.date) {
      cands = roundFilter(cands.filter((g) => g.date && dayDiff(g.date, parsed.date!) <= 1));
      if (cands.length === 1) {
        taken.add(cands[0].id);
        items.push({ ...base, season: cands[0].season, gameId: cands[0].id, status: 'matched', note: null });
      } else if (cands.length > 1) {
        items.push({ ...base, gameId: null, status: 'ambiguous', note: `${cands.length} games vs ${opp.name} within ±1 day of ${parsed.date}` });
      } else {
        items.push({ ...base, gameId: null, status: 'unmatched', note: `no final game vs ${opp.name} within ±1 day of ${parsed.date}` });
      }
      continue;
    }
    if (parsed.season) {
      cands = cands.filter((g) => g.season === parsed.season);
      cands = parsed.round ? roundFilter(cands) : cands.filter((g) => !g.playoff);
      const published = Date.parse(v.publishedAt);
      cands = cands.filter((g) => g.timestamp != null && g.timestamp <= published).sort((a, b) => b.timestamp! - a.timestamp!);
      if (cands.length) {
        const g = cands[0];
        taken.add(g.id);
        const note =
          cands.length > 1
            ? `season-only title: picked most recent of ${cands.length} unmatched games vs ${opp.name} before upload (${g.date})`
            : null;
        items.push({ ...base, season: g.season, gameId: g.id, status: 'matched', note });
      } else {
        items.push({ ...base, gameId: null, status: 'unmatched', note: `no unmatched final game vs ${opp.name} in ${parsed.season} before upload` });
      }
      continue;
    }
    items.push({ ...base, gameId: null, status: 'unmatched', note: 'title has neither date nor season' });
  }
  return { items, unmappedOpponents: [...unmapped] };
}

export function printReport(items: HighlightMatch[], unmapped: string[], log: (m: string) => void): string[] {
  const warnings: string[] = [];
  const by = (s: HighlightMatch['status']) => items.filter((i) => i.status === s);
  log('\n== Highlights match report ==');
  log(`  matched: ${by('matched').length}, overrides: ${by('override').length}, not a game: ${by('not-a-game').length}, ambiguous: ${by('ambiguous').length}, unmatched: ${by('unmatched').length}`);
  for (const i of by('matched').filter((x) => x.note)) log(`  ~ ${i.video.title} -> ${i.gameId} (${i.note})`);
  for (const s of ['ambiguous', 'unmatched'] as const) {
    for (const i of by(s)) {
      const line = `  ${s.toUpperCase()}: "${i.video.title}" [${i.video.id}] ${i.note ?? ''}`;
      log(line);
      warnings.push(line.trim());
    }
  }
  if (unmapped.length) {
    log(`  Unmapped opponents: ${unmapped.join(', ')}`);
  }
  return warnings;
}

export async function syncHighlights(log: (m: string) => void = console.log): Promise<{ warnings: string[] }> {
  const prev = readJson<HighlightsData>(HIGHLIGHTS_FILE, { fetchedAt: null, channelId: TEAM.youtube.channelId, items: [] });
  let videos = prev.items.map((i) => i.video);
  let fetchedAt = prev.fetchedAt;
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    log('YOUTUBE_API_KEY not set — skipping video fetch, re-matching cached videos only.');
  } else {
    log('Fetching YouTube uploads...');
    videos = await fetchUploads(key);
    fetchedAt = new Date().toISOString();
    log(`  ${videos.length} videos`);
    for (const v of videos) await downloadThumb(v, log);
  }
  const overridesRaw = readJson<Partial<Overrides>>(OVERRIDES_FILE, {});
  const overrides: Overrides = { pin: overridesRaw.pin ?? {}, notAGame: overridesRaw.notAGame ?? [] };
  const aliases = readJson<{ aliases: Record<string, string> }>(ALIASES_FILE, { aliases: {} }).aliases;
  const games = loadSeasons().flatMap((s) => s.games);
  const { items, unmappedOpponents } = matchVideos(videos, games, overrides, aliases);
  items.sort((a, b) => b.video.publishedAt.localeCompare(a.video.publishedAt));
  writeJson(HIGHLIGHTS_FILE, { fetchedAt, channelId: TEAM.youtube.channelId, items } satisfies HighlightsData);
  return { warnings: printReport(items, unmappedOpponents, log) };
}

export type { SeasonId };
