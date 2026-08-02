// Parse every application/ld+json block in a page and report @type + top-level keys.
// Exits 1 if any block fails to parse. Also asserts the FAQ questions are verbatim
// present in the visible text (the M3 policy-violation guard).
// Usage from site/:  node scripts/check-jsonld.mjs public/index.html
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'public/index.html';
const html = readFileSync(file, 'utf8');
const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

let bad = 0;
const parsed = [];
blocks.forEach((raw, i) => {
  try {
    const o = JSON.parse(raw);
    parsed.push(o);
    const t = Array.isArray(o['@type']) ? o['@type'].join('+') : o['@type'];
    console.log(`ok    block ${i}  ${t}  (${raw.length} chars)`);
    console.log(`      keys: ${Object.keys(o).filter((k) => k !== '@context').join(', ')}`);
  } catch (e) {
    console.log(`FAIL  block ${i}  JSON parse error: ${e.message}`);
    bad++;
  }
});

const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const faq = parsed.find((o) => o && o['@type'] === 'FAQPage');
if (faq) {
  for (const q of faq.mainEntity || []) {
    if (!text.includes(q.name)) { console.log(`FAIL  FAQ question not verbatim on page: "${q.name}"`); bad++; }
  }
  if (!bad) console.log(`ok    all ${(faq.mainEntity || []).length} FAQ questions verbatim-sync to visible text`);
}

const lb = parsed.find((o) => o && String(o['@type']).includes('LocalBusiness'));
if (lb) {
  console.log(`\ncredential: ${lb.hasCredential ? lb.hasCredential.name + ' #' + lb.hasCredential.identifier : 'ABSENT'}`);
  console.log(`openingHoursSpecification: ${lb.openingHoursSpecification ? 'present' : 'absent'}`);
}

if (bad) { console.error(`\n${bad} problem(s) — DO NOT DEPLOY.`); process.exit(1); }
console.log('\nAll JSON-LD blocks parse. Safe to build.');
