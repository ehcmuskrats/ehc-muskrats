# Going live on ehcmuskrats.at

The site is already public at `https://ehcmuskrats.github.io/ehc-muskrats/`. These steps move it to
`https://ehcmuskrats.at`. No code changes are needed: the deploy workflow reads the address from the
GitHub Pages settings, so the next deploy after step 5 builds every link, the sitemap and the calendar feed
for the new domain.

## 1. Buy the domain (about 12–16 € a year)

1. Check it's free: search `ehcmuskrats.at` at <https://www.nic.at/en> (the .at registry).
2. Buy it at a registrar. Good, simple options:
   - **INWX** (<https://www.inwx.com/en/at-domain>): cheap, clean DNS settings.
   - **easyname** (<https://www.easyname.com/at-domain>): Vienna-based, German support, offers email forwarding.
   - Compare the **renewal** price, not the first-year offer.
3. Buy **only the domain**. No hosting, website builder or mailbox package: GitHub hosts the site for free.
4. Owner (registrant): you, or the club if it is a registered association (Verein). The club's name makes a
   later handover easier. For private persons, nic.at does not show your address publicly.
5. Turn on **auto-renew**, and make sure the registrar has an email address you actually read.

## 2. Verify the domain with GitHub (protects it from takeover)

GitHub (profile picture → **Settings** → **Pages** → **Add a domain**) → enter `ehcmuskrats.at`.
GitHub shows a **TXT record**. Add it at your registrar (step 3), then click **Verify**.

## 3. DNS records at the registrar

Delete any "parking" or default A/AAAA records for the domain first, then add:

| Type  | Name / Host | Value |
|-------|-------------|-------|
| A     | `@` (empty) | `185.199.108.153` |
| A     | `@`         | `185.199.109.153` |
| A     | `@`         | `185.199.110.153` |
| A     | `@`         | `185.199.111.153` |
| AAAA  | `@`         | `2606:50c0:8000::153` |
| AAAA  | `@`         | `2606:50c0:8001::153` |
| AAAA  | `@`         | `2606:50c0:8002::153` |
| AAAA  | `@`         | `2606:50c0:8003::153` |
| CNAME | `www`       | `ehcmuskrats.github.io.` |
| TXT   | (from step 2) | (from step 2) |

DNS changes usually take minutes, sometimes a few hours.

## 4. Tell GitHub Pages about the domain

Repository **ehcmuskrats/ehc-muskrats** → **Settings** → **Pages** → **Custom domain**: `ehcmuskrats.at` → **Save**.
Wait for the green "DNS check successful", then tick **Enforce HTTPS** (the certificate can take up to an hour;
if the box is greyed out, wait and reload).

## 5. Redeploy

**Actions** → **Nightly sync & deploy** → **Run workflow**. After about a minute the site is at
`https://ehcmuskrats.at/de/`.

Check:

- `https://ehcmuskrats.at` → goes to the German home page
- `https://www.ehcmuskrats.at` → redirects to `https://ehcmuskrats.at`
- the old `https://ehcmuskrats.github.io/ehc-muskrats/de/` → redirects to the new domain
- the padlock (HTTPS) shows in the browser

## After going live

- **Google Search Console** (<https://search.google.com/search-console>): add a *Domain* property for
  `ehcmuskrats.at` (another TXT record), then **Sitemaps** → submit `https://ehcmuskrats.at/sitemap-index.xml`.
  Optionally import it into Bing Webmaster Tools with one click.
- **PageSpeed**: run <https://pagespeed.web.dev/> on `https://ehcmuskrats.at/de/` (mobile).
- **Links everywhere**: Facebook page, YouTube channel description, Instagram bio, Team App, the club's
  WhatsApp group, and ask WEHV whether they can link the team to the site.
- **Calendar subscribers**: the feed is now `https://ehcmuskrats.at/calendar/muskrats.ics`. Anyone who
  subscribed to the old github.io link should re-subscribe once.
- **Email (later, optional)**: most registrars can forward `info@ehcmuskrats.at` to a personal address for
  free or a few euros. If you set one up, put it in `src/config/site.ts` (`contactEmail`) and the site shows it.
- **YouTube API key**: in Google Cloud Console, restrict the key to "YouTube Data API v3" only.
- **Uptime alert (optional)**: a free monitor (e.g. UptimeRobot) emails you if the site is ever down. The
  nightly workflow already opens a GitHub issue if the WEHV sync fails.
