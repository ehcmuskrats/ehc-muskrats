# Ideas for later

Not built yet. Add to this list; move an item into a change request when it's time to build it.

## Opponent rosters on team pages

For each league team, show their roster per season on their team page (`/{lang}/teams/{team-slug}/`), built
from the lineups in the WEHV game reports, with each player's stats against us and in the league. Useful for
scouting before a game.

Notes for building it:

- Lineups exist only for games with a full report. We store reports for our own games, so "stats against us"
  is complete; league-wide stats would come from the league leader lists (WEHV publishes those for all teams).
- WEHV re-issues player ids between seasons, so match opponent players by name within a team, as we already do
  for our own players.
- Keep it to names, numbers, positions and stats, the same as our own players (no birthdates).

## Parked (from earlier rounds)

- Team shop (several suppliers, one checkout): see `docs/proposals-round6.md`.
- Player portal / Stack Team App: see `docs/proposals-round6.md`.
- Sponsors page, if the club gets sponsors.
- About us text (slot in `src/config/site.ts`), contact email and form.
