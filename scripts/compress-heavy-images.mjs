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
        ? await pipe.png({ compressionLevel: 9, palette: true }).toBuffer()
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
