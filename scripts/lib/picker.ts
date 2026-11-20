// Drives the hockeydata "division picker" on wehv.at pages. The real <select> elements
// are hidden; the visible UI is a custom list (.-hd-util-select). We click it like a
// visitor would, and fall back to setting the hidden <select> + dispatching "change".
import type { Page } from 'playwright';

const SEASON_SELECT = 'select.-hd-los-division-picker-select-season';
const DIVISION_SELECT = 'select.-hd-los-division-picker-select-division';

export async function listSeasons(page: Page): Promise<string[]> {
  await page.waitForSelector(SEASON_SELECT, { state: 'attached', timeout: 30000 });
  return page.$$eval(`${SEASON_SELECT} option`, (os) => os.map((o) => (o as HTMLOptionElement).value));
}

export async function listDivisions(page: Page): Promise<{ id: string; name: string }[]> {
  await page.waitForSelector(DIVISION_SELECT, { state: 'attached', timeout: 30000 });
  return page.$$eval(`${DIVISION_SELECT} option`, (os) =>
    os.map((o) => ({ id: (o as HTMLOptionElement).value, name: (o.textContent ?? '').trim() })),
  );
}

async function currentValue(page: Page, selector: string): Promise<string> {
  return page.$eval(selector, (s) => (s as HTMLSelectElement).value);
}

async function pick(page: Page, selector: string, value: string, label?: string): Promise<void> {
  if ((await currentValue(page, selector)) === value) return;
  const container = page.locator('.-hd-util-select', { has: page.locator(selector) });
  const text = label ?? value;
  try {
    await container.locator('.-hd-util-select-display').click({ timeout: 5000 });
    await container.locator(`li[title="${text.replace(/"/g, '\\"')}"]`).click({ timeout: 5000 });
  } catch {
    // Fallback: set the hidden select directly.
    await page.$eval(
      selector,
      (s, v) => {
        const sel = s as HTMLSelectElement;
        sel.value = v as string;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      },
      value,
    );
  }
  await page.waitForFunction(
    ([sel, v]) => (document.querySelector(sel as string) as HTMLSelectElement | null)?.value === v,
    [selector, value],
    { timeout: 15000 },
  );
}

export async function pickSeason(page: Page, seasonLabel: string): Promise<void> {
  await pick(page, SEASON_SELECT, seasonLabel);
}

export async function pickDivision(page: Page, divisionId: string): Promise<void> {
  const label = await page.$eval(
    `${DIVISION_SELECT} option[value="${divisionId}"]`,
    (o) => (o.textContent ?? '').trim(),
  );
  await pick(page, DIVISION_SELECT, divisionId, label);
}
