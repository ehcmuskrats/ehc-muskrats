# Build prompt: EHC Muskrats team website

Paste everything below into Claude Code, started in an empty folder. Before you start, put the team logo in the folder as `public/logo.png` (200x200).

---

## Goal

Build a fast, bilingual (German default, English toggle) static website for **EHC Muskrats**, an amateur ice hockey team in the **Wiener Landesliga 4** (WEHV, Vienna). It shows every season's results, standings, rosters and stats, upcoming games, player profile pages with career stats, game recaps, and a "join us" page. It updates itself nightly from the public league website and is hosted free on GitHub Pages.

## Team name

The team brands itself **"EHC Muskrats"** (jerseys, Facebook). The league data spells it **"EHC Muscrats"**. Use "EHC Muskrats" for all display text. In the data layer, map the league name and the short code `MUS` to our team via config (`src/config/team.ts`), so matching never depends on spelling.

## Data access

WEHV has agreed that we can use the league data shown on wehv.at. We do **not** have our own API key.

The stats on wehv.at are rendered by JavaScript widgets from **hockeydata.net**, using WEHV's own API key. That key belongs to WEHV's account, so:

- **Do not** copy WEHV's API key out of the page, do not put it in the project, and do not call `api.hockeydata.net` directly from our scripts.
- **Do** load the public wehv.at pages in a headless browser (Playwright, Chromium), exactly as a visitor would. Let the page's own widgets load their data, then read it. Two options, in order of preference:
  1. Listen to the responses the page itself receives (`page.on('response')` for URLs containing `api.hockeydata.net/data/`) and parse that JSON. The responses are JSONP (`callback({...})`), so strip the wrapper. This is far more robust than parsing HTML. Never log or store the request URLs, since they contain WEHV's key.
  2. Fall back to parsing the rendered tables from the DOM if option 1 fails.
- Be polite: sync nightly, one page at a time with a few seconds between page loads, cache everything, and only re-load games that are not final yet. Past seasons are scraped once and then frozen.
- Every page with league data shows a small credit: "Daten: WEHV" linking to wehv.at.
- Write a short `docs/data-permission.md` placeholder where I will paste WEHV's permission message.
- Build the scraper behind an adapter interface (`DataSource`), so it can later be swapped for a direct API source if we ever get our own hockeydata key.

### Pages to scrape

League base: `https://www.wehv.at/de/leagues/wiener-landesliga-4/`

- `spielplan-ergebnisse/` (schedule and results; each played game links to a game page)
- `game/?id=<GAME_UUID>` (full game report). Example: `game/?id=ee28cd83-f812-4418-b0da-433232e84b9c`
- `tabelle/` (standings)
- `playoffs/`
- `statistik/spieler-statistik/` and its Top Scorer, Top Goalies, Bad Boys subpages
- `statistik/team-statistik/` and its Power Play, Penalty Killing, Fairplay subpages

Each page has a **season picker** (`<select>`, 2015/16 to 2026/27, no 2020/21) and a **division picker** (e.g. "Grunddurchgang", playoffs). To get history, select each season and division in the headless browser and wait for the widget to reload. Record the season to division mapping (division IDs show up in the widget's data responses) in `src/config/divisions.json`.

Known IDs: 2026/27 Grunddurchgang division = 22591. Muskrats team ID = 35325. Team logos load from `https://api.hockeydata.net//img/icehockey/ebel/team-logos/<TEAM_ID>.png`. Download opponent logos once into `public/logos/` instead of hotlinking.

Confirm which seasons the team actually appears in. It has always played in Landesliga 4, but may not exist in every season back to 2015/16.

### Sync pipeline

- `scripts/sync-data.ts`: runs the headless browser, writes raw captured data to `data/raw/` (gitignored) and normalized JSON to `data/` (committed, so the site always builds even if wehv.at is down or changes).
- If wehv.at's layout or widgets change and the scraper breaks, it must fail loudly with a clear message and keep the last good data.
- Normalize into typed models (see below), then compute derived data: season stats, career totals, team records.
- **Validate**: recompute the standings from game results and compare with the league's standings; recompute each player's season totals from boxscores and compare with the top scorer list. Print mismatches instead of failing silently.
- GitHub Actions: nightly sync at 04:17 Vienna time plus manual trigger (install Playwright's Chromium in the workflow). Commit changed data, then build and deploy. If sync fails, keep the last good data, still deploy, and open a GitHub issue so I notice.

## Game highlights (YouTube)

A teammate posts game highlights on YouTube: channel **hockeyyy** (`https://www.youtube.com/@hoooockeyyy`), channel ID `UCojaNKQ53iGc_0SJsc4aXgw`. Videos start in the 2024/25 season, and not every game has one. Link each video to its game page.

### Getting the video list

Use the **YouTube Data API v3** with a free API key from Google Cloud (I'll create it; walk me through it). Store it as the GitHub secret `YOUTUBE_API_KEY` and in the gitignored `.env`. List the channel's uploads playlist (`UUojaNKQ53iGc_0SJsc4aXgw`, i.e. the channel ID with `UC` replaced by `UU`) via `playlistItems.list`, paging through everything, and keep video ID, title, and `publishedAt`. Run this in the nightly sync. Do not scrape youtube.com pages.

### Title patterns (real examples)

Our team is always named first, regardless of home or away.

2024/25, dated:
- `EHC Muskrats vs EHC Vienna Ducks (J4L 6.1.2025)`
- `EHC Muskrats vs VIHC (J4L 15.2.2025)`
- `EHC Muskrats vs EHV Vienna Eagles | QUARTERFINAL (J4L 08.03.2025)`
- `EHC Muskrats vs Teifl 2 | FINAL 3 (J4L 06.04.2025)`

2025/26 onward, **season only, no date**:
- `EHC Muskrats vs VIHC (J4L 25/26)`
- `EHC Muskrats vs EHV Vienna Eagles | SEMIFINAL 1 (J4L 25/26)`
- `EHC Muskrats vs VIHC | FINAL2 (J4L 25/26)` (note: "FINAL2" without a space also occurs)
- `EHC Muskrats vs HC Transistor (J4L 26/27)`

Non-game videos also exist, e.g. `MUSKRATS 24/25 Champions Aftermovie`. Show those on the season's page and the highlights page, not on a game page.

### Matching rules

1. Parse the title: opponent, optional playoff round and game number (QUARTERFINAL, SEMIFINAL 1, FINAL 3, FINAL2...), and either a date (d.m.yyyy or dd.mm.yyyy) or a season (yy/yy). "J4L" means our league.
2. Map opponent names to league teams with an alias table in `src/config/team-aliases.json`. Seed it with: `VIHC` = Vienna International Hockey Club, `HC Transistor` = HC Transistor Josifgrad. Do a fuzzy match for the rest and print any opponent you can't map.
3. **Dated titles:** match on opponent + date (allow plus or minus 1 day).
4. **Season-only titles:** the same opponent is played several times a season, so the title alone is ambiguous. Match on season + opponent + playoff round/number if present, then pick the **most recent final game against that opponent played on or before the video's `publishedAt`** that doesn't already have a video. Process videos oldest first.
5. Anything ambiguous or unmatched goes into a report printed at the end of the sync, never guessed silently.
6. `data/highlights-overrides.json` lets me pin a video ID to a game ID, or mark a video as "not a game". Overrides always win.

### Display

- Game page: a "Highlights" section with the video, only when one exists.
- Embed with `youtube-nocookie.com` behind a **click-to-load** thumbnail (no YouTube request until the visitor clicks). We're in Austria, so this keeps the site GDPR-friendly without a cookie banner.
- Credit: "Video: hockeyyy" with a link to the channel.
- Schedule/results list: a small play icon on games that have highlights.
- A **Highlights** page: all videos grouped by season, newest first, each linked to its game page.
- Home page: the latest highlight.

## Data model

Based on a real game report (16.11.2026, MUS 8:4 TST):

**Game:** id (UUID), season, division, date, time, venue (e.g. "Wien - neuro.io arena Halle 2"), home/away team (short code, long name, logo), final score, score per period, status (scheduled / live / final / TBD date), attendance, referees, linesmen, head coaches.

**Goals:** period, game time, running score, team, scorer (name + number), up to two assists, situation (EQ, PP1, PP2, SH1, SH2, EN, PS), GWG flag.

**Penalties:** period, time, team, player, served by, minutes, offence code (TRIP, SLASH, HOOK, INTRF, etc.). Translate codes into readable labels in both languages.

**Team stats per game:** PIM, powerplay (goals / chances), penalty killing, time leading / tied / trailing, time on PP and short-handed.

**Player boxscore per game:** number, name, position (C, LF, RF, LD, RD), G, A, P, +/-, PIM, SOG.

**Goalies per game:** number, name, shots against, goals against, GAA, saves, save %, on/off changes with times.

**Standings:** rank, team, GP, W, L, OTW, OTL, GF, GA, GD, PTS.

### Data quirks you must handle

- **Games are 3 x 25 minutes** (goals at 71:53, goalie off at 75:00) and minor penalties are 3:00. Never assume 20-minute periods or 2:00 minors. Read period length from config, and check whether it changed in older seasons.
- **Shots on goal are not recorded** (all SOG are 0, goalie save % shows 0). Hide SOG, saves and save % whenever they are zero for every game in a season. Show GA and GAA only.
- **+/- is not recorded** either. Same rule: hide when empty.
- Many future games have a **TBD date/time**. List them separately as "date to be confirmed", not mixed into the dated schedule.
- Player names appear as "Lastname Firstname" in boxscores and "Lastname F." in goal logs. Use a stable player ID if the API provides one. Otherwise match on number + last name within a season, and provide `data/player-aliases.json` for manual merges across seasons and name fixes.

## Stack

- **Astro** (static output) with TypeScript and built-in i18n routing (`/de/...` default, `/en/...`).
- Minimal dependencies. Plain CSS with custom properties is fine.
- Markdown content collections for news and game recaps (one file per recap per language).
- Deploy to GitHub Pages via GitHub Actions.
- Mobile first: most people will check this on their phone at the rink.

## Pages

1. **Home:** next game (date, time, hall, opponent, countdown), last result, latest highlight video, standings snippet, latest recap, top 3 scorers this season.
2. **Schedule & results:** season picker, all Muskrats games, filters for upcoming / played and home / away. Played games link to their game page.
3. **Game page:** score by period, highlights video if one exists, goal log, penalty log, both lineups, goalies, team stats, officials, attendance, linked recap if one exists.
4. **Standings:** full league table per season, Muskrats row highlighted, playoff bracket if present.
5. **Roster:** current season grouped by position, with number and season stats. Season picker for past rosters.
6. **Stats:** sortable season tables (scorers, goalies, penalties) plus an **all-time** view: career points leaders, games played, goals, PIM, and team records (biggest win, most goals in a game, best season by points).
7. **Player profile:** one page per player with number(s), position(s), seasons played, season-by-season table with career totals, game log, and a list of their goals linking to games. Optional photo and short bio from `data/player-extras.json`.
8. **Highlights:** all YouTube highlights by season (see the highlights section above).
9. **News / recaps:** list and detail pages from Markdown. Recap frontmatter links to a game ID so the game page and recap link to each other.
10. **Join us (Mitspielen):**
   - Level: amateur team in the Wiener Landesliga 4.
   - Home rink: neuro.io arena, Vienna.
   - Practice: Monday evenings at the neuro.io arena. Times and halls change week to week, so tell people to ask for the current week's time.
   - Cost: EUR 700 for the 2026/27 season. Store season and fee in config so it's easy to update each year.
   - Contact: message us on Facebook: https://www.facebook.com/ehcmuskrats/ (big button). Also add a `contactEmail` field in config that is empty for now. When it's empty, hide every email reference; when it's set, show it next to the Facebook button.

All UI text goes through translation files (`src/i18n/de.json`, `en.json`). Dates in Austrian format in German (16.11.2026) and "16 Nov 2026" in English. Times in Vienna local time.

## Design

Colours come from the logo and jerseys:

| Role | Hex | Source |
|---|---|---|
| Primary (royal blue) | `#1870E0` | Logo jersey, home jersey |
| Accent (orange) | `#F77A1A` | Logo and jersey stripes |
| Ice blue (light backgrounds) | `#C9E1F8` | Logo circle |
| Muskrat brown (sparing highlight) | `#B0602D` | Logo mascot |
| Ink | `#111111` | Outlines |
| White | `#FFFFFF` | Away jersey |

- Home jersey: royal blue with orange and white stripes. Away jersey: white with blue and orange stripes. Echo the stripe pattern as a subtle design element (header band, section dividers).
- Check text contrast (WCAG AA). Orange on white is likely too weak for body text, so use it for accents and buttons with dark text or large type only.
- Dark mode: deep navy background, same accents.
- The logo is only 200x200. Don't display it bigger than about 160px. Leave a note in the README that a high-res or SVG version would help.
- No team or player photos for now. Design the layout so it looks complete without them (logo, colours, stripe pattern, typography). Player photos can be added later through `data/player-extras.json`.
- Tables must scroll horizontally on mobile without breaking the layout.
- No NHL branding or photos of famous players.

## How to work

1. Scaffold the project and show me the folder structure.
2. Define the TypeScript types for the data model.
3. Build the scraper first. Start with the current season: schedule, one game report, standings. Show me a sample of the normalized output. Then add the stats pages, then walk back through past seasons. Run validation and report any mismatches. Then add the YouTube highlights sync and show me the match report (matched, ambiguous, unmatched) before building pages.
4. Then build pages in this order: home, schedule, game page, standings, roster, stats, player profiles, recaps, join us, i18n polish.
5. After each stage, run the build and fix all errors before moving on.
6. Set up GitHub Actions (nightly sync + deploy) and walk me through turning on GitHub Pages and adding the `YOUTUBE_API_KEY` secret.
7. At the end: check performance and accessibility, check every page in both languages, and write a short README covering how to add a recap, how to edit player extras and aliases, how to fix a wrongly matched highlight video, how to update the season fee, how to set the contact email, and how to re-run a sync by hand.

Don't invent results or player details. If data is missing, show it as missing. Ask me if anything here contradicts itself.
