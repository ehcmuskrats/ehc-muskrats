// Checks that every internal link and asset in dist/ points to a file that exists.
// Usage: npm run build && npx tsx scripts/check-links.ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) files.push(p);
  }
};
walk('dist');

const broken = new Map<string, string[]>();
let checked = 0;
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"#?]+)/g)) {
    const u = m[1];
    if (!u.startsWith(base) || u.startsWith('//')) continue;
    checked++;
    const rel = decodeURIComponent(u.slice(base.length));
    const target = join('dist', rel);
    const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    if (!ok) {
      if (!broken.has(u)) broken.set(u, []);
      broken.get(u)!.push(f);
    }
  }
}
console.log(`${files.length} pages, ${checked} internal links checked, ${broken.size} broken targets`);
for (const [u, from] of broken) console.log(`  ${u}  (from ${from.length} page(s), e.g. ${from[0]})`);
if (broken.size) process.exit(1);
