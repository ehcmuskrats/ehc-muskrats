import de from './de.json';
import en from './en.json';

export const LANGS = ['de', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'de';

const dict: Record<Lang, Record<string, string>> = { de, en };

export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = dict[lang][key] ?? dict.de[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function useT(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
}

export function langPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

/** Site-relative URL with the configured base path, e.g. url('de/schedule/') -> '/repo/de/schedule/'. */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const p = path.replace(/^\//, '');
  return base + p;
}

/** Link inside a language: href(lang, 'schedule/2025-26/') -> '/de/schedule/2025-26/'. */
export function href(lang: Lang, path = ''): string {
  return url(`${lang}/${path.replace(/^\//, '')}`);
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS: Record<Lang, string[]> = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** Formats a local Vienna date "2026-11-16": de "16.11.2026", en "16 Nov 2026". */
export function formatDate(lang: Lang, iso: string | null | undefined, opts: { weekday?: boolean } = {}): string {
  if (!iso) return t(lang, 'common.tbd');
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const wd = opts.weekday ? WEEKDAYS[lang][new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' : '';
  if (lang === 'de') return `${wd}${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
  return `${wd}${d} ${MONTHS_EN[m - 1]} ${y}`;
}

export function formatTime(lang: Lang, time: string | null | undefined): string {
  if (!time) return t(lang, 'common.tbd');
  return lang === 'de' ? `${time}` : time;
}

/** Seconds -> "mm:ss". */
export function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatNumber(lang: Lang, n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '–';
  return n.toLocaleString(lang === 'de' ? 'de-AT' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function otherLang(lang: Lang): Lang {
  return lang === 'de' ? 'en' : 'de';
}
