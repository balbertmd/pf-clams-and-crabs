// Find files under public/ that nothing references, so they stop deploying publicly.
// Audit only by default. Pass --move to relocate them to ../_assets-not-served/
// (moved, never deleted — everything stays in the repo and on disk).
// Usage from site/:  node scripts/audit-public-assets.mjs [--move]
import { readdirSync, statSync, readFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const MOVE = process.argv.includes('--move');
const PUB = 'public';
const DEST = join('..', '_assets-not-served');

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// Everything that could name an asset: page HTML, JSON, scripts, styles, tooling.
const HAYSTACK_EXT = new Set(['.html', '.json', '.js', '.mjs', '.ts', '.css', '.astro', '.ps1', '.md', '.xml', '.txt']);
const searchRoots = ['public', 'src', 'tools', 'scripts'].filter(existsSync);
let hay = '';
for (const root of searchRoots) {
  for (const f of walk(root)) {
    const dot = f.lastIndexOf('.');
    if (dot < 0 || !HAYSTACK_EXT.has(f.slice(dot).toLowerCase())) continue;
    try { hay += readFileSync(f, 'utf8') + '\n'; } catch {}
  }
}

// Never move these even if unreferenced — they are fetched by URL, not linked in markup.
const KEEP = [
  /^public[\\/](robots\.txt|sitemap\.xml|_headers|_routes\.json|favicon)/i,
  /^public[\\/][0-9a-f]{32}\.txt$/i,          // IndexNow key file
  /^public[\\/]dock-admin[\\/]/i,
  /pf-logo-gbp-1080\.png$/i,                  // staged for the next GBP upload, keep served
];

const rows = [];
for (const f of walk(PUB)) {
  const rel = relative(PUB, f).split('\\').join('/');
  const name = rel.split('/').pop();
  if (KEEP.some((re) => re.test(f))) continue;
  // referenced if the full path OR the bare filename appears anywhere
  const referenced = hay.includes(rel) || hay.includes(name);
  if (!referenced) rows.push({ f, rel, kb: Math.round(statSync(f).size / 1024) });
}

rows.sort((a, b) => b.kb - a.kb);
const total = rows.reduce((a, r) => a + r.kb, 0);

if (!rows.length) { console.log('No unreferenced files under public/. Nothing to do.'); process.exit(0); }
console.log(`${rows.length} unreferenced file(s) under public/, ${Math.round(total / 1024 * 10) / 10} MB total:\n`);
for (const r of rows) console.log(`  ${String(r.kb).padStart(6)}KB  ${r.rel}`);

if (!MOVE) { console.log('\n(audit only — re-run with --move to relocate them out of public/)'); process.exit(0); }

let moved = 0;
for (const r of rows) {
  const target = join(DEST, r.rel);
  mkdirSync(dirname(target), { recursive: true });
  renameSync(r.f, target);
  moved++;
}
console.log(`\nMoved ${moved} file(s) to _assets-not-served/ — still in the repo, no longer deployed.`);
