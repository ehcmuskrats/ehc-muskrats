import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (e) {
    throw new Error(`Could not parse ${file}: ${(e as Error).message}`);
  }
}

/** Write JSON atomically (temp file + rename) so a crash never leaves half a file. Returns true if changed. */
export function writeJson(file: string, data: unknown): boolean {
  mkdirSync(dirname(file), { recursive: true });
  const text = JSON.stringify(data, null, 1) + '\n';
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return false;
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
  return true;
}

export function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}
