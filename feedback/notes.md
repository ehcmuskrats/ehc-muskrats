# Review notes

Collected while reviewing the site. Fixed together when the user says "go".

## Status (2026-11-20)
- DONE: all 11 notes, including all parts of 3 (schedule phase switch + section headers + playoff series with score,
  stats Gesamt / Grunddurchgang / Playoffs switch, playoff table on player profiles, all-time playoff points leaderboard).

## Round 2 (collecting — wait for "go")

12. **Home results ticker runs off the side on desktop** (`main section .ticker`)
    - Now: on desktop the strip of score bugs bleeds past the right edge (last card cut off: "08.03. MU… DU…").
    - Wanted: on desktop it should stop where the content ends — fixed, no overflow. On mobile, horizontal scrolling is fine.
    - Plan: from 900px up, show only as many score bugs as fit in the content width as an even grid (e.g. 6 across,
      no scrolling, no negative margins); below that keep the swipeable strip.

13. **Footer: drop the "Spieldaten …" sentence** (`footer .foot-brand p`, all pages)
    - Reason: the footer links already say "Daten: WEHV".
    - Plan: DE "© 2026 Website des EHC Muskrats." / EN "© 2026 Website of EHC Muskrats." (year stays automatic).
      The "Daten: WEHV" link stays where it is.

14. **Game page "Strafen": blue accent instead of orange** (`section#penalties ol.rows li.us`, every game page)
    - Wanted: the left accent bar on penalty rows uses the jersey blue (#1870E0, from the stripe) instead of orange, so
      penalties are visually distinct from goals (goals keep orange).
    - Plan: in the penalties timeline only, `li.us::before` → jersey blue with a soft blue glow; the period eyebrow stripes stay.
      Apply on all game pages (shared template). Check the blue bar is clearly visible on #171717 at phone width.

15. **Game page lineups: columns jump when switching MUS ⇄ opponent tab** (`section#lineups table`, every game page)
    - Now: each team's table sizes its columns to its own content (longest name, number widths), so #, Spieler, POS,
      G/A/PTS/PIM headers shift sideways when toggling tabs.
    - Wanted: column headers stay in exactly the same place for both teams.
    - Plan: `table-layout: fixed` with explicit column widths shared by both tables (# / Spieler flexible / POS / G / A / PTS /
      (+/-) / PIM / (SOG)); long names truncate with ellipsis instead of widening the column. Same treatment for the goalie rows.
      Test: several games with different opponents (short vs long names, 1- vs 2-digit numbers), toggle tabs at desktop
      and 375px mobile; also check the sticky name column still works when the table scrolls on mobile.

16. **"Torhüter" → "Goalie" everywhere (German)** (player hero subtitle, and site-wide)
    - Reason: nobody says Torhüter; in the games they say Goalie.
    - Plan: replace every German "Torhüter"/"Torhüterwechsel" in src/i18n/de.json and abbr.ts: pos.G "Goalie",
      roster/stats/game headings "Goalies", "Goaliewechsel" (game page), tab "Goalies". Grep src/ for any hard-coded
      "Torhüter" too. English already says Goalie(s).

17. **Rename "Kader" in the menu (and page title)** (`header nav a[href*=roster]`, tabbar/sheet, roster page h1)
    - User doesn't like "Kader"; suggests "Team".
    - Plan: at "go", check what German-language hockey club sites use for their roster page (Austrian ICEHL clubs,
      DEL clubs, local Vienna amateur teams) and pick the most natural word — likely "Team" (also matches the
      English-leaning hockey vocabulary the user prefers). Apply to nav, More-sheet, page heading, page title, "nav.roster"
      key in de.json, plus any "Kader" text elsewhere (e.g. "roster.none"). URL stays /roster/.

18. **Position codes: use English hockey codes** (player hero tag "#41 · LF", and everywhere codes are shown)
    - Now: league codes LF / RF (from German "Flügel").
    - Wanted: LW (left wing), RW (right wing), C, LD, RD, G.
    - Plan: display-only mapping LF→LW, RF→RW (F→F, D→D unchanged), applied in both languages like the other stat
      abbreviations (ICEHL style); data files keep the league's codes. Places: player hero tag, lineups POS column,
      stats POS column, any tooltips. Full-name tooltips stay localized (DE "Linker Flügel" → maybe "Left Wing"? keep DE
      full names unless user says otherwise).

19. **Desktop nav: active underline sits on the stripe ribbon** (`header nav.desk-nav a[aria-current]::after`)
    - Now: the orange underline is at the very bottom of the nav (bottom: 0), so it touches/merges with the
      blue-white-orange ribbon below the header and looks messy.
    - Wanted: move it up so it underlines the word itself, with a clear gap to the ribbon (user likes the ribbon).
    - Plan: position the underline just below the text (e.g. ~6px under the baseline, well above the ribbon), match the
      word's width, slightly rounded; keep the hover/active colours. Desktop nav only (phones use the bottom tab bar).

20. **Highlights intro wording** (`/highlights/` page-head `.sub`)
    - Now: "Spielvideos von unserem Teamkollegen Kona · YouTube" — awkward.
    - Wanted: something like "Our highlights are filmed by Rob", with "Rob" linking to his profile; keep "· YouTube".
    - Plan: DE "Unsere Highlights werden von Rob gefilmt · YouTube", EN "Our highlights are filmed by Rob · YouTube".
      "Rob" → /players/127960-robert-kona/. Add a `creditFirstName: 'Rob'` next to creditName in team.ts.
      (Video credits under each video stay "Video: Kona" unless the user wants "Rob" there too.)

## Round 1 (done)

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
