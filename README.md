# EHC Muskrats website

Bilingual (German by default, with English) static website for **EHC Muskrats**, an amateur ice hockey team in the Wiener Landesliga 4 (WEHV, Vienna). It's built with [Astro](https://astro.build), updates itself every night from wehv.at and YouTube, and is hosted for free on GitHub Pages.

- League data: "Daten: WEHV". See [docs/data-permission.md](docs/data-permission.md).
- Videos: YouTube channel [hockeyyy](https://www.youtube.com/@hoooockeyyy).

## Folder structure

```
.github/workflows/sync-and-deploy.yml   full sync at 00:17 Vienna time (games of the last 3 days are
                                        re-checked for WEHV corrections), YouTube-only checks at 12:17
                                        and 18:17, then build + deploy
data/                     synced data (committed, so the site always builds)
  seasons/<2026-27>.json  all league games, standings, playoff bracket, league stats per season
  games/<uuid>.json       full game reports for Muskrats games
  derived.json            player profiles, career totals, team records (computed)
  highlights.json         YouTube videos and which game each belongs to
  teams.json, sync-status.json
  highlights-overrides.json   ← you edit: fix video ↔ game matches
  player-aliases.json         ← you edit: merge players, fix names
  player-extras.json          ← you edit: photos and bios
  raw/                    raw captured league data (gitignored)
docs/data-permission.md   paste WEHV's permission message here
public/logo.png           team logo (200×200)
public/logos/             opponent logos (downloaded once by the sync)
public/thumbs/            YouTube thumbnails (downloaded by the sync, for click-to-load)
scripts/sync-data.ts      the sync: scrape → normalize → derive → validate
scripts/lib/              DataSource interface, wehv.at browser source, normalizer, matching ...
src/config/               team.ts, site.ts (fee, email), divisions.json, team-aliases.json, penalties.ts
src/content/news/de|en/   news posts and game recaps (Markdown)
src/i18n/de.json, en.json all UI text
src/pages/[lang]/         pages: home, schedule, games, standings, roster, stats, players, highlights, news, join
src/types/models.ts       the data model
```

## Running it locally

You need Node.js 20 or newer.

```powershell
npm install
npx playwright install chromium
npm run dev          # http://localhost:4321/de/
npm run build        # builds into dist/
```

## How do I…

> **Always pull first.** The site commits fresh data by itself several times a day, so before you change
> anything run `git pull`, and if a push is rejected, run `git pull --rebase` and push again.

### …add a recap or news post?

1. Copy `src/content/news/de/_vorlage-spielbericht.md` (German) or `src/content/news/en/_template-recap.md` (English) into the same folder under a new name, for example `2026-11-16-sieg-gegen-transistor.md`. The file name becomes the URL.
2. Fill in `title`, `date` and `summary`, and set `draft: false`.
3. For a game recap, set `gameId` to the game's ID: the last part of the game page URL (`/de/games/<gameId>/`). The game page then links to the recap, and the recap links back.
4. If you write both a German and an English version, give them the same `translationKey`. The language switch then jumps between them.
5. Commit and push. The site rebuilds automatically.

### …edit player extras (photo, bio)?

Edit `data/player-extras.json`. The key is the player ID, which is the number at the start of the profile URL (`/de/players/111830-benjamin-pfeifer/` → `111830`):

```json
{
  "players": {
    "111830": {
      "photo": "players/111830.jpg",
      "bio": { "de": "Kurzer Text …", "en": "Short text …" }
    }
  }
}
```

Put the photo in `public/players/`. Only publish photos and bios the player has agreed to.

### …merge players or fix a name (aliases)?

Player IDs come from the league and normally stay the same across seasons. If the league ever creates a second ID for the same person, or a name is misspelled, edit `data/player-aliases.json`:

```json
{
  "merge": { "123456": 111830 },
  "names": { "111830": { "first": "Benjamin", "last": "Pfeifer" } }
}
```

`merge` moves everything from ID 123456 onto profile 111830. Then run `npm run derive`, or just push: the build runs it too.

Team name aliases for YouTube titles (for example `VIHC`) live in `src/config/team-aliases.json`.

### …fix a wrongly matched highlight video?

At the end of each run, the sync prints a match report (matched, ambiguous, unmatched). To correct a match, edit `data/highlights-overrides.json`:

```json
{
  "pin": { "dQw4w9WgXcQ": "ee28cd83-f812-4418-b0da-433232e84b9c" },
  "notAGame": ["abcdEFGhijk"]
}
```

- `pin`: YouTube video ID (from `youtube.com/watch?v=<ID>`) → game ID. Overrides always win.
- `notAGame`: the video is shown on the highlights page and its season's schedule page, not on a game page.

Then run `npm run sync:highlights`, or wait for the nightly run.

How titles are matched: titles with a date (`EHC Muskrats vs VIHC (J4L 15.2.2025)`) match the game against that opponent within ±1 day. Titles with only a season (`(J4L 25/26)`) match the most recent finished game against that opponent, played before the upload, that has no video yet. A playoff round in the title (`| SEMIFINAL 1`) restricts the match to that round. Videos are processed oldest first.

### …update the season fee?

Edit `src/config/site.ts`:

```ts
membership: { season: '2027/28', feeEur: 750 },
```

### …set the contact email?

In `src/config/site.ts`, set `contactEmail: 'team@example.com'`. While it is empty, the site hides every email reference. Once it is set, the email appears next to the Facebook button on the "Mitspielen" page.

### …re-run a sync by hand?

**On GitHub:** go to Actions → "Nightly sync & deploy" → Run workflow. Tick "full" to re-list all seasons (needed when a new season appears with new divisions mid-season, although the current season is refreshed every night anyway).

**Locally:**

```powershell
npm run sync                         # same as the nightly run
npm run sync -- --season 2024-25     # re-scrape one season, even if it is frozen
npm run sync -- --full               # re-list all seasons from the league site
npm run sync:highlights              # only YouTube
npm run derive                       # only recompute players/records + validation
```

Put your YouTube key in `.env` first (copy `.env.example`). Commit the changed files in `data/` afterwards.

If wehv.at changes and the scraper breaks, the sync stops with a clear message and keeps the last good data. On GitHub, the site still deploys and an issue labelled `sync-failure` is opened.

### …make sure we still have everything if WEHV goes offline?

Nothing to do: it's automatic. Three copies exist:

- , , : everything the site shows (committed).
- : every response we ever got from WEHV, gzipped, birthdates removed (committed; the nightly sync adds new ones).
- : the untouched responses, only on the PC that ran the sync (gitignored).

To rebuild  from a local : Archived 291 responses to data/archive/..

### …fix a player's flag?

Flags come from the nationality WEHV publishes. To override one, add it to :
 ( hides the flag), then > ehc-muskrats-website@1.0.0 sync
> tsx scripts/sync-data.ts --derive-only
Current league season: 2026-27
Seasons to scrape: 2026-27
Fetching schedule...
  loading spielplan-ergebnisse/ (1 division(s))
Fetching standings...
  loading tabelle/ (1 division(s))
Fetching knockout...
Fetching skaters...
  loading statistik/spieler-statistik/top-scorer/ (1 division(s))
Fetching goalies...
  loading statistik/spieler-statistik/top-goalies/ (1 division(s))
Fetching penalties...
  loading statistik/spieler-statistik/bad-boys/ (1 division(s))
Fetching teams...
  loading statistik/team-statistik/power-play/ (1 division(s))
  2026-27: 36 games (8 ours), 1 standings table(s)
Fetched 0 game report(s).
Fetching YouTube uploads...
  37 videos

== Highlights match report ==
  matched: 34, overrides: 1, not a game: 2, ambiguous: 0, unmatched: 0
Derived: 61 players (36 merged across league ids), 125 game reports.

== Validation: standings recomputed from game results ==
  2026-27 Grunddurchgang: OK (9 final games)
  2025-26 Grunddurchgang: OK (45 final games)
  2025-26 TOP 5: OK (10 final games)
  2025-26 LOW 5: OK (10 final games)
  2024-25 Grunddurchgang: OK (36 final games)
  2024-25 TOP 4: OK (6 final games)
  2024-25 LOW 5: OK (10 final games)
  2023-24 Grunddurchgang: OK (28 final games)
  2023-24 TOP 4: OK (6 final games)
  2023-24 LOW 4: OK (6 final games)
  2022-23 Grunddurchgang: OK (45 final games)
  2021-22 Grunddurchgang: OK (6 final games)
  2019-20 Grunddurchgang: OK (36 final games)
  2018-19 Grunddurchgang: OK (56 final games)
  2017-18 Grunddurchgang: OK (42 final games)
  2016-17 Grunddurchgang: OK (42 final games)
  2015-16 Grunddurchgang: OK (45 final games)

== Validation: our player totals from boxscores vs league top-scorer list ==
  2026-27 div 22591: OK (16 players, 3 games)
  2025-26 div 19449: OK (20 players, 9 games)
  2025-26 div 20129: OK (23 players, 4 games)
  2025-26 div 20472: OK (20 players, 5 games)
  2024-25 div 16641: 1 mismatch(es) (23 players, 8 games)
  2024-25 div 17195: OK (20 players, 3 games)
  2024-25 div 17614: 18 mismatch(es) (21 players, 6 games)
  2023-24 div 13836: 1 mismatch(es) (20 players, 7 games)
  2023-24 div 14349: OK (17 players, 3 games)
  2023-24 div 14774: 14 mismatch(es) (17 players, 3 games)
  2022-23 div 11169: OK (23 players, 9 games)
  2022-23 div 12122: OK (16 players, 3 games)
  2021-22 div 9453: 1 mismatch(es) (16 players, 2 games)

Mismatches:
  - Player 2024-25 div 16641 #0 Wunderl Stefan (league vs boxscores): PIM 3 vs 0
  - Player 2024-25 div 17614 #0 Naukkarinen Pyry Verneri (league vs boxscores): G 11 vs 13, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Mayer Christoph (league vs boxscores): G 7 vs 8, PIM 12 vs 14, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Kona Robert (league vs boxscores): G 2 vs 3, A 4 vs 5, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Bonholzer Marco (league vs boxscores): A 2 vs 3, PIM 0 vs 2, GP 3 vs 4
  - Player 2024-25 div 17614 #0 Moser Daniel (league vs boxscores): A 2 vs 3, PIM 2 vs 4, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Suppanz Philipp (league vs boxscores): A 3 vs 4, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Preisinger Thomas (league vs boxscores): G 1 vs 2, A 2 vs 3, PIM 2 vs 6, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Zenker Sebastian (league vs boxscores): A 2 vs 3, PIM 6 vs 10, GP 4 vs 5
  - Player 2024-25 div 17614 #0 Frühwirth Edwin (league vs boxscores): G 1 vs 2, PIM 2 vs 4, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Schaschl Helmut (league vs boxscores): GP 5 vs 6
  - Player 2024-25 div 17614 #0 Oblin Stefan (league vs boxscores): GP 5 vs 6
  - Player 2024-25 div 17614 #0 Suppanz Markus (league vs boxscores): G 0 vs 1, PIM 0 vs 4, GP 5 vs 6
  - Player 2024-25 div 17614 #0 Moskalenko Andrei (league vs boxscores): GP 5 vs 6
  - Player 2024-25 div 17614 #0 Isep Andreas (league vs boxscores): GP 5 vs 6
  - Player 2024-25 div 17614 #0 Zemann Stefan (league vs boxscores): GP 4 vs 5
  - Player 2024-25 div 17614 #0 Pfeifer Benjamin (league vs boxscores): GP 5 vs 6
  - Player 2024-25 div 17614 #0 Wunderl Stefan (league vs boxscores): GP 3 vs 4
  - Player 2024-25 div 17614 #0 Kornfeind Michael Ferry (league vs boxscores): A 0 vs 2, PIM 2 vs 4, GP 4 vs 5
  - Player 2023-24 div 13836 #0 Pfeifer Benjamin (league vs boxscores): PIM 6 vs 3
  - Player 2023-24 div 14774 #0 Naukkarinen Pyry Verneri (league vs boxscores): G 2 vs 4, A 0 vs 2, GP 1 vs 2
  - Player 2023-24 div 14774 #0 Zenker Sebastian (league vs boxscores): GP 2 vs 3
  - Player 2023-24 div 14774 #0 Ambrosch Roland (league vs boxscores): PIM 12 vs 14, GP 2 vs 3
  - Player 2023-24 div 14774 #0 Bonholzer Marco (league vs boxscores): GP 2 vs 3
  - Player 2023-24 div 14774 #0 Kornfeind Michael Ferry (league vs boxscores): GP 2 vs 3
  - Player 2023-24 div 14774 #0 Reautschnig Armin (league vs boxscores): GP 1 vs 2
  - Player 2023-24 div 14774 #0 Kona Robert (league vs boxscores): G 0 vs 1, A 0 vs 1, PIM 0 vs 2, GP 1 vs 2
  - Player 2023-24 div 14774 #0 Suppanz Markus (league vs boxscores): G 0 vs 1, A 0 vs 1, PIM 4 vs 6, GP 2 vs 3
  - Player 2023-24 div 14774 #0 Pfeifer Benjamin (league vs boxscores): GP 2 vs 3
  - Player 2023-24 div 14774 #0 Moser Daniel (league vs boxscores): A 0 vs 1, PIM 0 vs 4, GP 2 vs 3
  - Player 2023-24 div 14774 #0 Zemann Stefan (league vs boxscores): GP 2 vs 3
  - Player 2023-24 div 14774 #0 Suppanz Philipp (league vs boxscores): PIM 4 vs 6, GP 2 vs 3
  - Player 2023-24 div 14774 #0 Frühwirth Edwin (league vs boxscores): GP 2 vs 3
  - Player 2023-24 div 14774 #0 Isep Andreas (league vs boxscores): PIM 2 vs 4, GP 2 vs 3
  - Player 2021-22 div 9453 #0 Ambrosch Roland (league vs boxscores): PIM 9 vs 11

35 warning(s)/mismatch(es) — see above.

Sync OK in 35s. Team: EHC Muskrats.

## One-time setup

### 1. Put the code on GitHub

Create a new repository on GitHub, for example `ehc-muskrats-website`, then:

```powershell
git init
git add .
git commit -m "EHC Muskrats website"
git branch -M main
git remote add origin https://github.com/<you>/ehc-muskrats-website.git
git push -u origin main
```

### 2. Turn on GitHub Pages

Repository → **Settings → Pages** → under "Build and deployment", set **Source** to **GitHub Actions**. That's all. The workflow takes care of the base path, so the site works at `https://<you>.github.io/ehc-muskrats-website/`.

For a custom domain (for example `muskrats.at`), enter it on the same page and add the DNS records GitHub shows you.

Also check **Settings → Actions → General → Workflow permissions**: it should be "Read and write permissions", so the nightly job can commit data and open issues.

### 3. Create the YouTube API key

1. Open <https://console.cloud.google.com/> and sign in with any Google account.
2. Create a new project at the top ("Select a project" → "New project"), for example "muskrats-site".
3. Go to **APIs & Services → Library**, search for **YouTube Data API v3** and click **Enable**.
4. Go to **APIs & Services → Credentials → Create credentials → API key**.
5. Click the new key → **Edit API key**. Under "API restrictions", choose **Restrict key** and select only **YouTube Data API v3**, then save. It's free: the nightly sync uses a handful of the 10,000 daily quota units.
6. Locally: copy `.env.example` to `.env` and paste the key after `YOUTUBE_API_KEY=`.
7. On GitHub: repository → **Settings → Secrets and variables → Actions → New repository secret**. Name: `YOUTUBE_API_KEY`, value: the key.

### 4. Run it once

Actions → "Nightly sync & deploy" → **Run workflow**. After a few minutes the site is live.

## Notes

- **Design:** dark only, broadcast/scoreboard style, mobile first (phones get a bottom tab bar). Colours and fonts are defined once at the top of `src/styles/global.css`. Fonts (Barlow Condensed, Inter) are bundled with the site, with no requests to Google.
- **Stat abbreviations** are English in both languages, as on the ICE Hockey League sites (GP, G, A, PTS, PIM, GAA…). They're defined in `src/i18n/abbr.ts`, along with the full German and English names that appear on hover. Game situations are written out (Gleichzahl / Even strength, Powerplay, Unterzahl …) in `src/i18n/de.json` and `en.json`.
- **Logo:** `public/logo.png` is only 200×200, so the site never shows it bigger than about 140 px. A high-resolution PNG or an SVG version would make it look sharper.
- **Games are 3 × 25 minutes** and minors are 3 minutes in this league. The site reads period length and penalty length from each game report and never assumes NHL values.
- **Not recorded by the league:** shots on goal, saves, save % and +/-. Columns that are empty for a whole season are hidden automatically and come back if the league ever records them.
- **GA/GP** is goals against per game played. A 60-minute GAA would be misleading with 75-minute games.
- **Privacy:** YouTube videos load only after a click (from youtube-nocookie.com), thumbnails are hosted on this site, there are no cookies, no analytics and no external fonts, so no cookie banner is needed.
- **Data source adapter:** `scripts/lib/datasource.ts` defines a `DataSource` interface. If the team ever gets its own hockeydata API key, write a second implementation that returns the same raw payloads, and nothing else needs to change.
