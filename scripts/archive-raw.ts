// Rebuild data/archive/ (committed, scrubbed backup) from the local data/raw/ cache.
// The nightly sync archives new responses itself; this is for back-filling. Usage: npx tsx scripts/archive-raw.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { archive } from './lib/archive.ts';

const root = 'data/raw';
let n = 0;
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (f !== 'explore') walk(p); // exploration dumps aren't league data
      continue;
    }
    if (!f.endsWith('.json')) continue;
    archive(relative(root, p).split(/[\/]/), JSON.parse(readFileSync(p, 'utf8')));
    n++;
  }
};
walk(root);
console.log(`Archived ${n} responses to data/archive/.`);
