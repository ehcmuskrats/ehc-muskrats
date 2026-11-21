// Calendar export (#13): iCalendar files for single games and a subscription feed, plus Google Calendar links.
// Built at build time from the synced schedule, so the feed updates itself with every nightly deploy.
import type { GameSummary } from '../types/models.ts';
import { teamName, ourGames, currentSeasonId } from './data.ts';
import { url } from '../i18n/index.ts';

/** Games last ~75 min plus warm-up and resurfacing; block 1 h 45 min. */
const DURATION_MS = 105 * 60_000;

export function calendarGames(): GameSummary[] {
  return ourGames(currentSeasonId).filter((g) => g.timestamp != null);
}

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function gameTitle(g: GameSummary): string {
  return `${teamName(g.home)} – ${teamName(g.away)}`;
}

function venue(g: GameSummary): string {
  return (g.venue ?? '').replace(/^Wien - /, '');
}

function details(g: GameSummary, site: URL | undefined): string {
  const parts = [`Wiener Landesliga 4 · ${g.divisionName}`];
  if (g.name) parts.push(g.name);
  if (site) parts.push(new URL(url('de/schedule/'), site).toString());
  return parts.join('\n');
}

/** RFC 5545 text escaping and 75-octet line folding. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    let end = Math.min(i + (i === 0 ? 75 : 74), bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a UTF-8 character
    out.push((i === 0 ? '' : ' ') + bytes.subarray(i, end).toString('utf8'));
    i = end;
  }
  return out.join('\r\n');
}

function vevent(g: GameSummary, site: URL | undefined, now: string): string[] {
  const start = g.timestamp!;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${g.id}@ehc-muskrats`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + DURATION_MS)}`,
    `SUMMARY:${esc(gameTitle(g))}`,
    `LOCATION:${esc(venue(g))}`,
    `DESCRIPTION:${esc(details(g, site))}`,
    g.status === 'final' ? 'STATUS:CONFIRMED' : 'STATUS:TENTATIVE',
    'END:VEVENT',
  ];
  return lines;
}

export function ics(games: GameSummary[], site: URL | undefined, name: string): string {
  const now = stamp(Date.now());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EHC Muskrats//Spielplan//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Europe/Vienna',
    // Ask subscribed calendars to refresh twice a day.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...games.flatMap((g) => vevent(g, site, now)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(g: GameSummary, site: URL | undefined): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: gameTitle(g),
    dates: `${stamp(g.timestamp!)}/${stamp(g.timestamp! + DURATION_MS)}`,
    location: venue(g),
    details: details(g, site),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** Site-relative path of a game's .ics file and of the season feed. */
export const gameIcsPath = (id: string) => `calendar/${id}.ics`;
export const feedPath = 'calendar/muskrats.ics';
