# Data permission (WEHV)

The league data on this site (schedules, results, standings, game reports, statistics) comes from the public pages of the Wiener Eishockeyverband (WEHV) at <https://www.wehv.at/>. WEHV agreed that we can use it.

## Permission message

> _Paste WEHV's permission message here: who sent it, the date, and the full text._

## How we use the data

- A headless browser loads the public wehv.at pages once a night, the same way a visitor would. It reads the data the page's own widgets receive.
- We never copy, store or log WEHV's hockeydata API key, and we never call `api.hockeydata.net` ourselves.
- Pages load one at a time with a few seconds between them. Past seasons are scraped once and then frozen, and finished games are not loaded again.
- Team logos that the pages load are saved once to `public/logos/`, so our site doesn't hotlink them.
- Every page with league data shows "Daten: WEHV" with a link to wehv.at.
- We don't publish birthdates or nationalities, even though the game reports include them.
