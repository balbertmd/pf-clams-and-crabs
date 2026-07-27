#!/usr/bin/env node
// compress-heavy-images.mjs — image-size guard (2026-07-02 audit: CMS uploads shipped at 9-10MB).
// Build mode (default): compress oversized rasters IN PLACE (the build checkout), ALWAYS exit 0 —
//   a marketing site's deploys must never be blocked by this guard (fail-open).
// --check mode (CI): list oversized files and exit 1 (fail-loud) so the repo original gets
//   compressed + recommitted, even though the served build already got the compressed copy.
// Uses sharp, which Astro already ships — zero new dependencies. .rotate() applies EXIF orientation.
import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const CHECK = process.argv.includes('--check');
const ROOT = 'public';
const LIMIT_KB = 800;
const MAX_W = 1920;
const EXTS = new Set(['.jpg', '.jpeg', '.png']);
// Brand marks are EXEMPT. Fable audit 2026-07-27 (C3): this guard was rewriting every brand/GBP
// PNG as palette (mode P). That is the documented cause of the repeated Google Business Profile
// logo rejections — the "flat RGB" file built to rule out colour mode was served as PALETTE,
// so the hypothesis was never actually tested. See public/images/brand/BRAND-LOGO.md.
// 2026-07-27 (residual): the two directory exemptions missed the single most-referenced mark —
// public/images/logo.png — which is the favicon, the apple-touch-icon, the header brand image AND
// the `logo` field Google reads from the LocalBusiness JSON-LD. It was still shipping as a
// 256-colour PALETTE PNG with visible dithering in the wave gradient. Exempt files as well as dirs.
const EXEMPT = ['public/images/brand/', 'public/images/gbp/', 'public/images/logo.png', 'public/images/logo-mark.png'];
const isExempt = (f) => {
  const p = f.split('\\').join('/');
  return EXEMPT.some((d) => (d.endsWith('/') ? p.startsWith(d) : p === d));
};

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

try {
  const found = [];
  for await (const f of walk(ROOT)) {
    if (!EXTS.has(extname(f).toLowerCase())) continue;
    if (isExempt(f)) continue;
    const s = await stat(f);
    if (s.size > LIMIT_KB * 1024) found.push({ f, kb: Math.round(s.size / 1024) });
  }
  if (!found.length) {
    console.log(`image-guard: OK — no raster over ${LIMIT_KB}KB in ${ROOT}/`);
    process.exit(0);
  }
  console.log(`image-guard: ${found.length} file(s) over ${LIMIT_KB}KB:`);
  for (const x of found) console.log(`  - ${x.f} (${x.kb}KB)`);
  if (CHECK) {
    console.log('image-guard: CHECK mode — failing so the oversized repo originals get compressed and recommitted.');
    process.exit(1);
  }
  const sharp = (await import('sharp')).default;
  for (const x of found) {
    try {
      const img = sharp(x.f, { failOn: 'none' }).rotate();
      const meta = await img.metadata();
      const pipe = (meta.width || 0) > MAX_W ? img.resize({ width: MAX_W }) : img;
      const buf = extname(x.f).toLowerCase() === '.png'
        ? await pipe.png({ compressionLevel: 9 }).toBuffer()
        : await pipe.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      if (buf.length < x.kb * 1024) {
        await writeFile(x.f, buf);
        console.log(`  compressed ${x.f} -> ${Math.round(buf.length / 1024)}KB`);
      } else {
        console.log(`  left ${x.f} (recompression not smaller)`);
      }
    } catch (e) {
      console.log(`  skip ${x.f} (${e && e.message}) — non-fatal`);
    }
  }
  process.exit(0);
} catch (e) {
  console.log('image-guard: non-fatal error, build continues: ' + (e && e.message));
  process.exit(0);
}
