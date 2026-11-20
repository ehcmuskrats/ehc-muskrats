# EHC Muskrats website

Bilingual (German by default, with English) static website for **EHC Muskrats**, an amateur ice hockey team in the Wiener Landesliga 4 (WEHV, Vienna). It's built with [Astro](https://astro.build), updates itself every night from wehv.at and YouTube, and is hosted for free on GitHub Pages.

- League data: "Daten: WEHV". See [docs/data-permission.md](docs/data-permission.md).
- Videos: YouTube channel [hockeyyy](https://www.youtube.com/@hoooockeyyy).

## Folder structure

```
.github/workflows/sync-and-deploy.yml   nightly sync (04:17 Vienna time) + build + deploy
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

- **Logo:** `public/logo.png` is only 200×200, so the site never shows it bigger than about 140 px. A high-resolution PNG or an SVG version would make it look sharper.
- **Games are 3 × 25 minutes** and minors are 3 minutes in this league. The site reads period length and penalty length from each game report and never assumes NHL values.
- **Not recorded by the league:** shots on goal, saves, save % and +/-. Columns that are empty for a whole season are hidden automatically and come back if the league ever records them.
- **GA/GP** is goals against per game played. A 60-minute GAA would be misleading with 75-minute games.
- **Privacy:** YouTube videos load only after a click (from youtube-nocookie.com), thumbnails are hosted on this site, there are no cookies, no analytics and no external fonts, so no cookie banner is needed.
- **Data source adapter:** `scripts/lib/datasource.ts` defines a `DataSource` interface. If the team ever gets its own hockeydata API key, write a second implementation that returns the same raw payloads, and nothing else needs to change.
