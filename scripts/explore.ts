// One-off exploration helper: loads a wehv.at page in headless Chromium and saves the
// JSON the page's own widgets receive into data/raw/explore/. Never stores request URLs
// (they contain WEHV's API key) — only the endpoint name (path after /data/).
// Usage: npx tsx scripts/explore.ts <url> [seasonLabel] [divisionId]
//        npx tsx scripts/explore.ts --map-divisions <url>
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pickSeason, pickDivision, listSeasons, listDivisions } from './lib/picker.ts';
import { stripJsonp } from './lib/jsonp.ts';

const args = process.argv.slice(2);
const mapMode = args[0] === '--map-divisions';
const [url, seasonLabel, divisionId] = mapMode ? args.slice(1) : args;
if (!url) throw new Error('usage: explore.ts <url> [seasonLabel] [divisionId]');
const outDir = 'data/raw/explore';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
let n = 0;
page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('api.hockeydata.net/data/') || mapMode) return;
  const endpoint = new URL(u).pathname.replace(/^\/data\//, '').replace(/\//g, '_');
  try {
    const json = stripJsonp(await res.text());
    const file = `${outDir}/${String(++n).padStart(2, '0')}-${endpoint}.json`;
    writeFileSync(file, JSON.stringify(json, null, 2));
    console.log('captured', endpoint, '->', file);
  } catch (e) {
    console.log('failed to parse', endpoint, (e as Error).message);
  }
});
await page.goto(url, { waitUntil: 'networkidle' });
if (mapMode) {
  const result: Record<string, { id: string; name: string }[]> = {};
  for (const s of await listSeasons(page)) {
    await pickSeason(page, s);
    await page.waitForTimeout(2500);
    result[s] = await listDivisions(page);
    console.log(s, JSON.stringify(result[s]));
  }
  writeFileSync(`${outDir}/division-map.json`, JSON.stringify(result, null, 2));
} else if (seasonLabel) {
  await pickSeason(page, seasonLabel);
  await page.waitForTimeout(3000);
  console.log('divisions:', await listDivisions(page));
  if (divisionId) {
    await pickDivision(page, divisionId);
    await page.waitForTimeout(3000);
  }
}
await page.waitForTimeout(1500);
await browser.close();
