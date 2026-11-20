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
  otw: { short: 'OTW', de: 'Siege nach Verlängerung/Penaltyschießen', en: 'Overtime/shootout wins' },
  otl: { short: 'OTL', de: 'Niederlagen nach Verlängerung/Penaltyschießen', en: 'Overtime/shootout losses' },
  t: { short: 'T', de: 'Unentschieden', en: 'Ties' },
  gf: { short: 'GF', de: 'Erzielte Tore', en: 'Goals for' },
  ga: { short: 'GA', de: 'Gegentore', en: 'Goals against' },
  gd: { short: 'GD', de: 'Tordifferenz', en: 'Goal difference' },
  pts: { short: 'PTS', de: 'Punkte', en: 'Points' },
  g: { short: 'G', de: 'Tore', en: 'Goals' },
  a: { short: 'A', de: 'Assists', en: 'Assists' },
  p: { short: 'PTS', de: 'Punkte (Tore + Assists)', en: 'Points (goals + assists)' },
  pim: { short: 'PIM', de: 'Strafminuten', en: 'Penalty minutes' },
  ppg: { short: 'PPG', de: 'Powerplay-Tore', en: 'Power-play goals' },
  shg: { short: 'SHG', de: 'Unterzahl-Tore', en: 'Short-handed goals' },
  gwg: { short: 'GWG', de: 'Siegtreffer', en: 'Game-winning goals' },
  pm: { short: '+/-', de: 'Plus/Minus', en: 'Plus/minus' },
  sog: { short: 'SOG', de: 'Schüsse aufs Tor', en: 'Shots on goal' },
  gaa: { short: 'GAA', de: 'Gegentore pro Spiel', en: 'Goals against per game' },
  sa: { short: 'SA', de: 'Schüsse gegen', en: 'Shots against' },
  sv: { short: 'SV', de: 'Paraden', en: 'Saves' },
  svpct: { short: 'SV%', de: 'Fangquote', en: 'Save percentage' },
  toi: { short: 'TOI', de: 'Eiszeit', en: 'Time on ice' },
  so: { short: 'SO', de: 'Shutouts', en: 'Shutouts' },
  minors: { short: 'MIN', de: 'Kleine Strafen', en: 'Minor penalties' },
  majors: { short: 'MAJ', de: 'Große Strafen', en: 'Major penalties' },
  misc: { short: 'MISC', de: 'Disziplinarstrafen', en: 'Misconducts' },
  pp: { short: 'PP', de: 'Powerplay (Tore/Chancen)', en: 'Power play (goals/chances)' },
  pppct: { short: 'PP%', de: 'Powerplay-Quote', en: 'Power-play percentage' },
  pk: { short: 'PK', de: 'Penalty Killing (überstanden/Unterzahlsituationen)', en: 'Penalty kill (killed/situations)' },
  pkpct: { short: 'PK%', de: 'Penalty-Killing-Quote', en: 'Penalty-kill percentage' },
} as const;

export type AbbrKey = keyof typeof ABBR;

export function abbr(lang: Lang, k: AbbrKey) {
  const a = ABBR[k];
  return { short: a.short, full: a[lang] };
}

/** Result codes W / L / OTW / OTL / T are English in both languages, like the league sites. */
export const RESULT_FULL: Record<string, { de: string; en: string }> = {
  W: { de: 'Sieg', en: 'Win' },
  L: { de: 'Niederlage', en: 'Loss' },
  OTW: { de: 'Sieg nach Verlängerung/Penaltyschießen', en: 'Overtime/shootout win' },
  OTL: { de: 'Niederlage nach Verlängerung/Penaltyschießen', en: 'Overtime/shootout loss' },
  T: { de: 'Unentschieden', en: 'Tie' },
};
