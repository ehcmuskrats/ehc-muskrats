// WEHV names its rounds in German ("Grunddurchgang", "Viertelfinal-Spiele", "Halbfinale 2", "Finale Spiel 3").
// German pages show them as sent; English pages get English names. TOP 4 / LOW 5 / Playoffs stay as they are.
import type { Lang } from './index.ts';

const EN: [RegExp, string][] = [
  [/Grunddurchgang/gi, 'Regular Season'],
  [/Platzierungsrunde/gi, 'Placement round'],
  [/Viertel[\s-]?final(?:e|[\s-]?Spiele)?/gi, 'Quarterfinal'],
  [/Halb[\s-]?final(?:e|[\s-]?Spiele)?/gi, 'Semifinal'],
  [/\bFinal(?:e|[\s-]?Spiele|spiele)\b/gi, 'Final'],
  [/\bSpiel\b/gi, 'Game'],
];

/** Round / division name for display in the given language. */
export function roundName(name: string | null | undefined, lang: Lang): string {
  if (!name) return '';
  if (lang === 'de') return name;
  let s = name;
  for (const [re, to] of EN) s = s.replace(re, to);
  // "1. Quarterfinal" → "Quarterfinal 1"
  return s.replace(/^(\d+)\.\s*(Quarterfinal|Semifinal)$/, '$2 $1');
}
