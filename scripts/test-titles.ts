// Quick self-test of the YouTube title parser: npx tsx scripts/test-titles.ts
import assert from 'node:assert/strict';
import { parseTitle } from './lib/highlights.ts';

const cases: [string, Partial<ReturnType<typeof parseTitle>>][] = [
  ['EHC Muskrats vs EHC Vienna Ducks (J4L 6.1.2025)', { opponent: 'EHC Vienna Ducks', date: '2025-01-06', season: '2024-25', round: null, isGame: true }],
  ['EHC Muskrats vs VIHC (J4L 15.2.2025)', { opponent: 'VIHC', date: '2025-02-15', season: '2024-25' }],
  ['EHC Muskrats vs EHV Vienna Eagles | QUARTERFINAL (J4L 08.03.2025)', { opponent: 'EHV Vienna Eagles', round: 'quarterfinal', gameNumber: null, date: '2025-03-08' }],
  ['EHC Muskrats vs Teifl 2 | FINAL 3 (J4L 06.04.2025)', { opponent: 'Teifl 2', round: 'final', gameNumber: 3, date: '2025-04-06' }],
  ['EHC Muskrats vs VIHC (J4L 25/26)', { opponent: 'VIHC', date: null, season: '2025-26' }],
  ['EHC Muskrats vs EHV Vienna Eagles | SEMIFINAL 1 (J4L 25/26)', { opponent: 'EHV Vienna Eagles', round: 'semifinal', gameNumber: 1, season: '2025-26' }],
  ['EHC Muskrats vs VIHC | FINAL2 (J4L 25/26)', { opponent: 'VIHC', round: 'final', gameNumber: 2, season: '2025-26' }],
  ['EHC Muskrats vs HC Transistor (J4L 26/27)', { opponent: 'HC Transistor', season: '2026-27' }],
  ['MUSKRATS 24/25 Champions Aftermovie', { isGame: false, season: '2024-25' }],
];

let ok = 0;
for (const [title, expected] of cases) {
  const got = parseTitle(title);
  for (const [k, v] of Object.entries(expected)) assert.deepEqual((got as any)[k], v, `${title}: ${k}`);
  ok++;
}
console.log(`${ok}/${cases.length} title cases OK`);
