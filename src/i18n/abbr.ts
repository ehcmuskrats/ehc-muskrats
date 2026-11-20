// Stat abbreviations. Like the ICE Hockey League, the short form is English in both
// languages; the full name (tooltip / screen readers) is in the page's language.
import type { Lang } from './index.ts';

export const ABBR = {
  no: { short: '#', de: 'Rückennummer', en: 'Jersey number' },
  pos: { short: 'POS', de: 'Position', en: 'Position' },
  rank: { short: '#', de: 'Rang', en: 'Rank' },
  gp: { short: 'GP', de: 'Spiele', en: 'Games played' },
  w: { short: 'W', de: 'Siege', en: 'Wins' },
  l: { short: 'L', de: 'Niederlagen', en: 'Losses' },
  otw: { short: 'OTW', de: 'Siege nach Overtime/Shootout', en: 'Overtime/shootout wins' },
  otl: { short: 'OTL', de: 'Niederlagen nach Overtime/Shootout', en: 'Overtime/shootout losses' },
  t: { short: 'T', de: 'Unentschieden', en: 'Ties' },
  gf: { short: 'GF', de: 'Erzielte Tore', en: 'Goals for' },
  ga: { short: 'GA', de: 'Gegentore', en: 'Goals against' },
  gd: { short: 'GD', de: 'Tordifferenz', en: 'Goal difference' },
  pts: { short: 'PTS', de: 'Punkte', en: 'Points' },
  g: { short: 'G', de: 'Tore', en: 'Goals' },
  a: { short: 'A', de: 'Assists', en: 'Assists' },
  p: { short: 'PTS', de: 'Punkte (Tore + Assists)', en: 'Points (goals + assists)' },
  pim: { short: 'PIM', de: 'Strafminuten', en: 'Penalty minutes' },
  ppg: { short: 'PPG', de: 'Power Play Goals', en: 'Power-play goals' },
  shg: { short: 'SHG', de: 'Shorthanded Goals', en: 'Short-handed goals' },
  gwg: { short: 'GWG', de: 'Game Winning Goals', en: 'Game-winning goals' },
  pm: { short: '+/-', de: 'Plus/Minus', en: 'Plus/minus' },
  sog: { short: 'SOG', de: 'Schüsse aufs Tor', en: 'Shots on goal' },
  gaa: { short: 'GAA', de: 'Goals Against Average (Gegentore pro Spiel)', en: 'Goals against per game' },
  sa: { short: 'SA', de: 'Schüsse gegen', en: 'Shots against' },
  sv: { short: 'SV', de: 'Paraden', en: 'Saves' },
  svpct: { short: 'SV%', de: 'Save Percentage', en: 'Save percentage' },
  toi: { short: 'TOI', de: 'Time on Ice', en: 'Time on ice' },
  so: { short: 'SO', de: 'Shutouts', en: 'Shutouts' },
  minors: { short: 'MIN', de: 'Minor Penalties', en: 'Minor penalties' },
  majors: { short: 'MAJ', de: 'Major Penalties', en: 'Major penalties' },
  misc: { short: 'MISC', de: 'Misconducts', en: 'Misconducts' },
  pp: { short: 'PP', de: 'Power Play (Tore/Chancen)', en: 'Power play (goals/chances)' },
  pppct: { short: 'PP%', de: 'Power Play %', en: 'Power-play percentage' },
  pk: { short: 'PK', de: 'Penalty Kill (überstanden/Situationen)', en: 'Penalty kill (killed/situations)' },
  pkpct: { short: 'PK%', de: 'Penalty Kill %', en: 'Penalty-kill percentage' },
} as const;

export type AbbrKey = keyof typeof ABBR;

export function abbr(lang: Lang, k: AbbrKey) {
  const a = ABBR[k];
  return { short: a.short, full: a[lang] };
}

/** League position codes → English hockey codes for display (LF/RF come from German "Flügel"). Data keeps the league codes. */
const POS_DISPLAY: Record<string, string> = { LF: 'LW', RF: 'RW' };
export function posCode(code: string | null | undefined): string {
  if (!code) return '–';
  return POS_DISPLAY[code] ?? code;
}

/** Result codes W / L / OTW / OTL / T are English in both languages, like the league sites. */
export const RESULT_FULL: Record<string, { de: string; en: string }> = {
  W: { de: 'Sieg', en: 'Win' },
  L: { de: 'Niederlage', en: 'Loss' },
  OTW: { de: 'Sieg nach Overtime/Shootout', en: 'Overtime/shootout win' },
  OTL: { de: 'Niederlage nach Overtime/Shootout', en: 'Overtime/shootout loss' },
  T: { de: 'Unentschieden', en: 'Tie' },
};
