# Review notes

Collected while reviewing the site. Fixed together when the user says "go".

## Status (2026-11-20)
- DONE: all 11 notes, including all parts of 3 (schedule phase switch + section headers + playoff series with score,
  stats Gesamt / Grunddurchgang / Playoffs switch, playoff table on player profiles, all-time playoff points leaderboard).

1. **Footer text** (`footer .foot-brand p`, all pages)
   - Now: "Fan-Website des EHC Muskrats. Spieldaten mit freundlicher Genehmigung des WEHV."
   - Wanted: "Website des EHC Muskrats", with a copyright symbol.
   - Plan: "© {current year} Website des EHC Muskrats. Spieldaten mit freundlicher Genehmigung des WEHV." / EN: "© {year} Website of EHC Muskrats. Game data courtesy of WEHV."

2. **Footer YouTube link** (`footer .foot-links a`, all pages)
   - Now: "YouTube · hockeyyy"
   - Wanted: just "YouTube" (link target stays the hockeyyy channel).

3. **Playoffs filter** (schedule page, "in general")
   - Wanted: a Playoffs filter/toggle instead of one long list of all games.
   - Plan: a "phase" segmented control on the schedule built from the season's actual phases, e.g.
     Alle | Grunddurchgang | TOP 4 | Playoffs (only the phases that exist that season; hidden when a season has just one).
     With "Alle", the list gets phase section headers (Grunddurchgang / TOP 4 / Playoffs) so it's not one flat list.
     Playoff games grouped by round (Viertelfinale, Halbfinale, Finale) with the series score.
     Remembers the choice per visit; also deep-linkable (…/schedule/2024-25/#playoffs).
   - Also: offer the same phase switch on the stats page (season totals vs playoffs only).
   - CONFIRMED by user (note on stats page season picker): wants to look at playoffs separately from the regular season in stats.
     Plan for stats: switch "Gesamt | Grunddurchgang | Playoffs" next to the season picker (Grunddurchgang = all non-playoff
     rounds incl. TOP 4 / LOW 5). Applies to scorers, goalies, penalties and the summary lockups. Needs per-phase totals in
     derive.ts (currently per season only). Also show playoff totals as their own rows on player profiles and an all-time
     playoff leaderboard if cheap.

4. **Home: "Endstand" card — add goal summary, desktop only** (`main .duo a.panel.last`)
   - Now: on desktop the card stretches to the height of the video panel next to it and is mostly empty.
   - Wanted: show who scored — goals with assists. No penalties. Desktop only (no room on mobile).
   - Plan: below the score, a compact goal list for both teams in order: time · scorer · assists · running score,
     Muskrats goals highlighted in orange, situation tag only when not even strength (PP / SH / EN), GWG marked.
     Period dividers (1. / 2. / 3. Drittel). Fills the empty space; hidden below 900px so phones keep the compact card.
     If the list is longer than the card, it fades out with a "Spielbericht →" link.

5. **Home: "Top-Scorer dieser Saison" heading + GP** (`#h-top` and the leaderboard below it)
   - Wanted: "Top Player" instead of "Top Scorer"; add GP next to G and A.
   - Plan: DE "Top-Spieler dieser Saison", EN "Top players this season"; each row shows "3 GP · 12 G · 0 A" with PTS big on the right.

6. **Language button "EN"/"DE" not centred** (`header.topbar a.lang`, all pages)
   - Now: the text sits high in the pill.
   - Likely cause: the condensed display font's capitals sit above the line box's centre (line-height 1 + font ascent metrics),
     possibly plus the hidden "– English" label in the grid. Fix: optically centre the caps (flex centring + tuned line-height /
     text-box trim) and check at phone and desktop width. Check the same on other pill-shaped labels (tags, segmented controls).

7. **Remove attendance ("Zuschauer")** (game page, `section#info dl.facts`)
   - Reason: WEHV's numbers aren't close to accurate.
   - Plan: remove it from every game page in both languages (and the unused "game.attendance" text). The sync can keep the raw
     number in the data files, it just never gets shown.

8. **Numbers and positions: show the current one, not the whole history** (player hero tag `#24 / #5 / #9 / #31 / #77 · RF / C / LD`, and everywhere similar)
   - Wanted: show the player's *current* number and position, taken from their most recent game. Beer league: people switch
     positions, and old numbers don't matter. In year-by-year views, show that season's value only.
   - Keep all history in the data (backend) — display change only.
   - Plan: derive.ts adds `currentNumber` / `currentPosition` (from the latest game report, falling back to the league list),
     and per season `number` / `position` from the last game of that season.
     - Player hero: "#24 · C" (current) and the subtitle shows only the current position.
     - Roster / stats / lineups for a season: that season's last number and position only (no "63/98", no "F/RF/C").
     - Season-by-season table on the profile keeps one number per season (that's the year-by-year view).
     - All numbers/positions ever used stay in data/derived.json (`numbers`, `positions`) for later use.

9. **Videos are by Rob Kona — show "Kona", not the YouTube handle** (highlights page intro, and site-wide)
   - Now: "Spielvideos von unserem Teamkollegen auf dem YouTube-Kanal hockeyyy. @hoooockeyyy", and credits "Video: hockeyyy".
   - Wanted: his last name instead of the channel tagline.
   - Plan: config `TEAM.youtube.creditName = 'Kona'` (+ his player id 127960) so it's changeable in one place.
     - Highlights intro: "Spielvideos von unserem Teamkollegen Kona" (name links to his player profile) + a plain "YouTube" link to the channel.
     - All video credits: "Video: Kona" (game pages, home, schedule, highlights, VideoEmbed captions).
     - Channel URL/ID and the sync stay unchanged (still reads the hoooockeyyy channel).

10. **Join page: costs shouldn't be a big highlighted box** (`main .fee.panel`)
    - Wanted: no big orange "€ 700" panel; costs are just another row in the list below (after Niveau / Heimhalle / Training).
    - Plan: remove the fee panel; add "Kosten — EUR 700 für die Saison 2026/27." as the last row of the facts list, same style
      as the others. Fee and season still come from src/config/site.ts.

11. **"TERMIN OFFEN" date box: centre the text** (schedule, "Termin noch offen" list, `ol.games .when .tbd`)
    - Now: the two lines "TERMIN / OFFEN" are left-aligned inside the date box.
    - Plan: `text-align: center` on `.tbd` (the box is already centred; the wrapped text isn't). Check DE "Termin offen" and EN "TBD".
