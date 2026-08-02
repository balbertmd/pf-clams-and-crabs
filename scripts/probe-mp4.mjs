// Read width/height/duration straight out of MP4 boxes. No ffmpeg needed.
// tkhd carries the presentation size as 16.16 fixed point; mvhd carries duration/timescale.
// Usage:  node scripts/probe-mp4.mjs <file> [file2 ...]
import { readFileSync } from 'node:fs';

function boxes(buf, start, end, want, hits) {
  let p = start;
  while (p + 8 <= end) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    let hdr = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(p + 8)); hdr = 16; }
    if (size < hdr || p + size > end) break;
    if (want.includes(type)) hits.push({ type, off: p + hdr, end: p + size });
    if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) boxes(buf, p + hdr, p + size, want, hits);
    p += size;
  }
  return hits;
}

for (const f of process.argv.slice(2)) {
  try {
    const b = readFileSync(f);
    const hits = boxes(b, 0, b.length, ['tkhd', 'mvhd'], []);
    const mvhd = hits.find((h) => h.type === 'mvhd');
    let sec = null;
    if (mvhd) {
      const v = b[mvhd.off];
      const o = mvhd.off + (v === 1 ? 20 : 12);
      const ts = b.readUInt32BE(v === 1 ? mvhd.off + 20 : mvhd.off + 12);
      const dur = v === 1 ? Number(b.readBigUInt64BE(mvhd.off + 24)) : b.readUInt32BE(mvhd.off + 16);
      if (ts) sec = Math.round((dur / ts) * 10) / 10;
    }
    const sizes = hits.filter((h) => h.type === 'tkhd').map((h) => {
      const v = b[h.off];
      // tkhd v0: width @76, height @80 (after 4 ver/flags + 20 times/id + 8 res + 4 layer/alt + 4 vol/res + 36 matrix)
      // tkhd v1: width @88, height @92
      const base = h.off + (v === 1 ? 88 : 76);
      return { w: b.readUInt32BE(base) / 65536, h: b.readUInt32BE(base + 4) / 65536 };
    }).filter((s) => s.w > 0 && s.h > 0);
    const s = sizes[0] || { w: 0, h: 0 };
    console.log(`${String(Math.round(b.length / 1048576 * 10) / 10).padStart(5)}MB  ${String(s.w)}x${String(s.h)}  ${String(sec) + 's'}  ${s.h > s.w ? 'VERTICAL' : 'horizontal'}  ${f}`);
  } catch (e) { console.log(`ERROR ${f}: ${e.message}`); }
}
