// Offline backup of everything we received from WEHV (#5: "in case WEHV goes down").
// data/raw/ (gitignored, local only) keeps the exact responses; data/archive/ is the committed copy,
// gzipped, with personal fields we never publish (birthdates) removed. Request URLs are never part of
// these responses, so no key can end up here.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DROP = new Set(['playerBirthdate', 'birthdate', 'birthDate', 'dateOfBirth']);

export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (!DROP.has(k)) out[k] = scrub(v);
    return out;
  }
  return value;
}

/** Write data/archive/<parts>.gz (stable bytes for unchanged data, so git only sees real changes). */
export function archive(parts: string[], data: unknown, root = 'data/archive') {
  const file = join(root, ...parts) + '.gz';
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(scrub(data)), { level: 9 }));
}
