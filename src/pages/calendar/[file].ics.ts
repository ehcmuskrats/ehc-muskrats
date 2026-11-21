// /calendar/muskrats.ics (subscription feed, all games of the current season)
// and /calendar/<gameId>.ics (one game, for "add to calendar").
import type { APIRoute } from 'astro';
import { calendarGames, ics, gameTitle } from '../../lib/calendar.ts';

export function getStaticPaths() {
  const games = calendarGames();
  return [{ params: { file: 'muskrats' } }, ...games.map((g) => ({ params: { file: g.id } }))];
}

export const GET: APIRoute = ({ params, site }) => {
  const games = calendarGames();
  const body =
    params.file === 'muskrats'
      ? ics(games, site, 'EHC Muskrats')
      : ics(
          games.filter((g) => g.id === params.file),
          site,
          gameTitle(games.find((g) => g.id === params.file)!),
        );
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
