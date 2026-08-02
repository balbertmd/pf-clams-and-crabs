// Regenerate the site logo as TRUE-COLOUR PNG from the 5016px master.
// Root cause of the two GBP logo rejections + the live defect found 2026-08-02:
// site/public/images/logo.png served as PNG colorType 3 (PALETTE). The C3 fix
// exempted images/brand/ and images/gbp/ from compress-heavy-images.mjs, but
// images/logo.png sits at images/ root so it was never covered, and stopping
// future crushing does not repair an already-crushed committed file.
// Run from site/:  node scripts/fix-logo.mjs
import sharp from 'sharp';
import { readFileSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const SITE = path.resolve(path.join(import.meta.dirname, '..'));
const ROOT = path.resolve(path.join(SITE, '..'));
const MASTER = path.join(ROOT, '_brand', 'pf-logo-master-5016.png');
const OUT_SITE = path.join(SITE, 'public', 'images', 'logo.png');
const OUT_GBP = path.join(SITE, 'public', 'images', 'brand', 'pf-logo-gbp-1080.png');
const GUARD_KB = 800; // compress-heavy-images.mjs LIMIT_KB — stay under it on purpose.

const CT = { 0: 'GRAY', 2: 'RGB', 3: 'PALETTE', 4: 'GRAY+A', 6: 'RGBA' };

function pngInfo(p) {
  if (!existsSync(p)) return { file: path.relative(ROOT, p), missing: true };
  const b = readFileSync(p);
  if (!(b[0] === 0x89 && b[1] === 0x50)) return { file: path.relative(ROOT, p), note: 'not a PNG' };
  return {
    file: path.relative(ROOT, p).replace(/\\/g, '/'),
    kb: Math.round(b.length / 1024),
    w: b.readUInt32BE(16),
    h: b.readUInt32BE(20),
    colorType: b[25],
    kind: CT[b[25]] || '?',
  };
}

async function emit(out, size) {
  await sharp(MASTER)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ palette: false, compressionLevel: 9, effort: 10 })
    .toFile(out);
  return pngInfo(out);
}

console.log('\n=== BEFORE ===');
for (const p of [MASTER, OUT_SITE, path.join(SITE, 'public', 'images', 'logo-mark.png')]) {
  console.log(JSON.stringify(pngInfo(p)));
}

if (!existsSync(MASTER)) { console.error('\nABORT: master not found -> ' + MASTER); process.exit(1); }

const BAK = OUT_SITE + '.palette.bak';
if (existsSync(OUT_SITE) && !existsSync(BAK)) {
  copyFileSync(OUT_SITE, BAK);
  console.log('\nbacked up crushed original -> site/public/images/logo.png.palette.bak');
}

// MEASURED 2026-08-02: the header renders logo.png at 56x56 CSS px. Consumers are the header
// (56, so 168 at 3x DPR), apple-touch-icon (180 recommended), the favicon, and the schema logo
// (Google minimum 112). 256 covers every one of them with room to spare.
// The first pass shipped 512/606KB, which was ~4x more bytes than any consumer can use, in the
// critical path, on a site where the hero video was cut 9.6MB -> 1.5MB. Don't repeat that.
// pf-logo-gbp-1080.png carries the high-resolution need.
let siteInfo = null;
for (const size of [256, 224, 192]) {
  siteInfo = await emit(OUT_SITE, size);
  console.log(`  tried ${size}px -> ${siteInfo.kb}KB (${siteInfo.kind})`);
  if (siteInfo.kb < GUARD_KB) break;
}

// GBP-grade copy lives in brand/, which the guard already exempts.
const gbpInfo = await emit(OUT_GBP, 1080);

console.log('\n=== AFTER ===');
console.log(JSON.stringify(siteInfo));
console.log(JSON.stringify(gbpInfo));

const problems = [];
if (siteInfo.colorType === 3 || gbpInfo.colorType === 3) problems.push('a file is still PALETTE');
if (siteInfo.kb >= GUARD_KB) problems.push(`logo.png is ${siteInfo.kb}KB, still over the ${GUARD_KB}KB build guard`);
if (problems.length) { console.error('\nFAIL: ' + problems.join('; ')); process.exit(1); }
console.log(`\nOK: logo.png is ${siteInfo.w}px ${siteInfo.kind} at ${siteInfo.kb}KB — true colour and under the ${GUARD_KB}KB guard.`);
