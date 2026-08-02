// Assert the brand marks are true-colour PNGs. Run against dist/ after a build,
// before deploying. Exits 1 if anything is colorType 3 (PALETTE).
// Usage from site/:  node scripts/check-logo-colortype.mjs dist
import { readFileSync, existsSync } from 'node:fs';

const base = process.argv[2] || 'dist';
const CT = { 0: 'GRAY', 2: 'RGB', 3: 'PALETTE', 4: 'GRAY+A', 6: 'RGBA' };
const targets = [
  base + '/images/logo.png',
  base + '/images/logo-mark.png',
  base + '/images/brand/pf-logo-gbp-1080.png',
];

let bad = 0;
for (const p of targets) {
  if (!existsSync(p)) { console.log('MISSING  ' + p); bad++; continue; }
  const b = readFileSync(p);
  const ct = b[25];
  const line = `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}  ${String(Math.round(b.length / 1024)).padStart(5)}KB  colorType=${ct} ${CT[ct] || '?'}  ${p}`;
  if (ct === 3) { console.log('FAIL     ' + line); bad++; }
  else console.log('ok       ' + line);
}
if (bad) { console.error(`\n${bad} problem(s) — DO NOT DEPLOY.`); process.exit(1); }
console.log('\nAll brand marks are true-colour. Safe to deploy.');
