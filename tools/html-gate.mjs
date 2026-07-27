#!/usr/bin/env node
// PF Clams and Crabs HTML gate — the syntax + structured-data gate every session ran BY HAND.
//
// TRANSFERRED, THEN EXTENDED. The five generic checks (jsSyntax / cssBrace / truncation /
// mojibake / unclosed) are the byte-faithful zurox → agentic-os artifact (`1448da4` 2026-07-25,
// `16ffa5b` 2026-07-26) — guardrails S5 cross-project transfer. A fix in one repo is a copy away.
//
// PF adds three checks because PF's failure classes are not agentic-os's. PF is a PUBLIC local
// -business site whose entire ranking case rests on structured data, and every one of these has
// actually bitten (Fable hard audit, 2026-07-27):
//   jsonLd     — a JSON-LD block that does not parse. Google drops the WHOLE block silently;
//                nothing on the page changes, so it is invisible without a validator.
//   faqDrift   — the FAQPage questions drifting from the FAQ a human actually reads. Editing the
//                visible copy and forgetting the schema (or vice versa) is a manufactured-content
//                violation, and the page looks perfect while it happens. (Audit M3.)
//   fakeRating — a rating or review count baked into the served HTML. The old reviews block
//                invented a 5.0 with zero reviews and wrote it into LocalBusiness schema. Ratings
//                may ONLY be injected at runtime from text actually parsed off the widget, and the
//                visible star row must ship `hidden`. (Audit H2 — the single most dangerous defect
//                in the audit: fake review schema can get a Business Profile penalised.)
//
// Two documents are in scope: public/index.html (the whole homepage — the canonical source, this
// site is static HTML in public/, NOT Astro-rendered) and public/dock-admin/index.html.
//
// Pure Node built-ins. No installs, no network. Exit 0 = clean, 1 = defect found.
// Proven still-red by tools/html-gate.selftest.mjs (CI runs the self-test first).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const SCAN = ['public'];

// Shipped documents only. Skip backups/scratch, build output and dependencies.
function targets() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (/^(node_modules|dist|\.git|\.astro)$/i.test(e.name)) continue;
        walk(p);
      } else if (
        e.name.toLowerCase().endsWith('.html') &&
        !/\.bak|~$|^_/i.test(basename(e.name))
      ) {
        out.push(relative(ROOT, p).split('\\').join('/'));
      }
    }
  };
  for (const d of SCAN) {
    const abs = join(ROOT, d);
    try { if (statSync(abs).isDirectory()) walk(abs); } catch { /* absent, fine */ }
  }
  return out.sort();
}

// Sequential extraction, NOT a global tag count.
// ZuroX's index.html contains the string literal `<script[\s\S]*?<\/script>` inside app code (a
// sanitiser regex). A naive count of "<script" vs "</script>" reads 8 vs 7 and false-positives.
// Scanning open -> next close -> resume AFTER the close swallows that literal as ordinary body
// text, which is exactly right.
function extractBlocks(src, tag) {
  const open = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const blocks = [];
  let m;
  while ((m = open.exec(src))) {
    const bodyStart = m.index + m[0].length;
    const close = src.toLowerCase().indexOf(`</${tag}>`, bodyStart);
    if (close === -1) {
      blocks.push({ attrs: m[0], body: null, line: lineOf(src, m.index), unclosed: true });
      break;
    }
    blocks.push({
      attrs: m[0],
      body: src.slice(bodyStart, close),
      line: lineOf(src, m.index),
      unclosed: false,
    });
    open.lastIndex = close + `</${tag}>`.length;
  }
  return blocks;
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// Blank out a region, preserving newlines so reported line numbers stay true.
function blank(arr, s, e) {
  for (let i = s; i < e; i++) if (arr[i] !== '\n') arr[i] = ' ';
}

// <style> lives in markup; JS code merely TALKS about it. Mask script bodies and HTML comments
// first, then only real markup is left to check. (A gate that cries wolf gets ignored or reverted.)
function maskCodeRegions(src) {
  const out = src.split('');
  let m;
  const comment = /<!--[\s\S]*?-->/g;
  while ((m = comment.exec(src))) blank(out, m.index, m.index + m[0].length);
  const open = /<script\b[^>]*>/gi;
  const lower = src.toLowerCase();
  while ((m = open.exec(src))) {
    const bodyStart = m.index + m[0].length;
    const close = lower.indexOf('</script>', bodyStart);
    if (close === -1) break;
    blank(out, bodyStart, close);
    open.lastIndex = close + '</script>'.length;
  }
  return out.join('');
}

// --- checks -----------------------------------------------------------------

// Strip comments and quoted strings so braces inside them can't skew the count.
function stripCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" };
const decode = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, name) => {
    const k = name.toLowerCase();
    if (ENT[k] !== undefined) return ENT[k];
    if (/^#x/.test(k)) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (/^#/.test(k)) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return full;
  });

// Normalise for comparison: decode entities, collapse whitespace, unify the dash and quote
// characters an editor's autocorrect swaps in, lowercase. Two strings that a READER would call
// the same question must compare equal — otherwise this check cries wolf and gets deleted.
const norm = (s) =>
  decode(String(s))
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function checkFile(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const defects = [];

  // truncation — a complete document ends with </html>
  if (!/<\/html>\s*$/i.test(src)) {
    defects.push(`truncation: does not end with </html> (last 40 chars: ${JSON.stringify(src.slice(-40))})`);
  }

  // mojibake — UTF-8 bytes re-encoded as latin1/cp1252, or a replacement char.
  // Written as \u escapes ON PURPOSE: this file must survive the very corruption it detects, and a
  // literal mojibake glyph here would trip the gate on itself.
  const MOJI = /\uFFFD|\u00E2\u20AC[\u2122\u009C\u009D\u201C\u201D]|\u00E2\u0080|\u00C3[\u0080-\u00BF]|\u00C2\u00A0|\u00EF\u00BB\u00BF/;
  const moji = src.match(MOJI);
  if (moji) {
    defects.push(`mojibake: found ${JSON.stringify(moji[0])} at line ${lineOf(src, moji.index)} - re-encoded UTF-8 (never Set-Content a UTF-8 file)`);
  }

  // inline <script> must parse; application/ld+json must parse AS JSON
  let parsed = 0;
  let lds = 0;
  const ldDocs = [];
  for (const b of extractBlocks(src, 'script')) {
    if (b.unclosed) { defects.push(`unclosed: <script> at line ${b.line} never closed`); continue; }
    if (/\bsrc\s*=/i.test(b.attrs)) continue;                       // external, no body

    if (/type\s*=\s*["']?application\/ld\+json/i.test(b.attrs)) {
      try {
        ldDocs.push({ data: JSON.parse(b.body), line: b.line, raw: b.body });
        lds++;
      } catch (e) {
        // Google discards the entire block on a parse error and reports nothing on the page.
        defects.push(`jsonLd: <script type="application/ld+json"> at line ${b.line} does not parse - ${e.message}`);
      }
      continue;
    }

    if (/type\s*=\s*["']?(?!text\/javascript|module|application\/javascript)[^"'\s>]+/i.test(b.attrs)) continue; // other json/template
    try {
      if (/type\s*=\s*["']?module/i.test(b.attrs)) new Function(`return async()=>{${b.body}\n}`);
      else new Function(b.body);
      parsed++;
    } catch (e) {
      defects.push(`jsSyntax: <script> at line ${b.line} - ${e.message}`);
    }
  }

  // fakeRating — no rating may be baked into served HTML.
  // (a) schema: aggregateRating / ratingValue / reviewCount must NOT appear in any served block.
  //     The reviews script injects them at runtime, only from a rating it actually parsed.
  for (const d of ldDocs) {
    const hit = d.raw.match(/"(aggregateRating|ratingValue|reviewCount)"/);
    if (hit) {
      defects.push(`fakeRating: JSON-LD at line ${d.line} ships a served "${hit[1]}" - ratings must be injected at runtime from a parsed value, never baked in (audit H2)`);
    }
  }
  // (b) markup: a star/rating summary row must ship `hidden` so an empty profile shows no stars.
  for (const m of src.matchAll(/<[^>]*\bid\s*=\s*["']reviews-rating["'][^>]*>/gi)) {
    if (!/\bhidden\b/i.test(m[0])) {
      defects.push(`fakeRating: #reviews-rating at line ${lineOf(src, m.index)} does not ship 'hidden' - stars would render with zero reviews (audit H2)`);
    }
  }

  // faqDrift — FAQPage schema must match the FAQ a human reads, question for question.
  const faqLd = ldDocs.find((d) => d.data && d.data['@type'] === 'FAQPage');
  const visible = [...src.matchAll(/<div class="faq"><h3>([\s\S]*?)<\/h3>/gi)].map((m) => norm(m[1]));
  if (faqLd) {
    const schema = (Array.isArray(faqLd.data.mainEntity) ? faqLd.data.mainEntity : [])
      .map((q) => norm(q && q.name));
    if (!visible.length) {
      defects.push(`faqDrift: FAQPage schema at line ${faqLd.line} declares ${schema.length} question(s) but the page renders none`);
    } else {
      const missing = schema.filter((q) => !visible.includes(q));
      const extra = visible.filter((q) => !schema.includes(q));
      if (schema.length !== visible.length || missing.length || extra.length) {
        defects.push(
          `faqDrift: FAQPage schema (${schema.length}) vs visible FAQ (${visible.length})` +
          (missing.length ? ` | in schema, not on page: ${JSON.stringify(missing)}` : '') +
          (extra.length ? ` | on page, not in schema: ${JSON.stringify(extra)}` : '')
        );
      }
    }
  } else if (visible.length) {
    defects.push(`faqDrift: ${visible.length} visible FAQ entries but no FAQPage JSON-LD - free rich-result eligibility left on the table`);
  }

  // <style> braces must balance (markup only — see maskCodeRegions)
  let styles = 0;
  for (const b of extractBlocks(maskCodeRegions(src), 'style')) {
    if (b.unclosed) { defects.push(`unclosed: <style> at line ${b.line} never closed`); continue; }
    const css = stripCss(b.body);
    const opens = (css.match(/\{/g) || []).length;
    const closes = (css.match(/\}/g) || []).length;
    if (opens !== closes) {
      defects.push(`cssBrace: <style> at line ${b.line} - ${opens} '{' vs ${closes} '}'`);
    }
    styles++;
  }

  return { file, defects, parsed, styles, lds, faq: visible.length, bytes: src.length };
}

// --- run --------------------------------------------------------------------

const files = targets();
if (!files.length) {
  console.log('HTML GATE FAILED - no documents found to check (wrong ROOT?)');
  process.exit(1);
}
const results = files.map(checkFile);
let failed = 0;
for (const r of results) {
  if (r.defects.length) {
    failed += r.defects.length;
    console.log(`  x ${r.file}`);
    for (const d of r.defects) console.log(`      ${d}`);
  } else {
    console.log(`  ok ${r.file} - ${r.parsed} inline script(s) parse, ${r.lds} JSON-LD block(s) valid, ${r.faq} FAQ entr(ies) in sync, ${r.styles} style block(s) balanced, ${r.bytes} bytes`);
  }
}
if (failed) { console.log(`\nHTML GATE FAILED - ${failed} defect(s)`); process.exit(1); }
console.log(`\nHTML GATE PASSED - ${results.length} document(s) clean`);
