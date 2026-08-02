#!/usr/bin/env node
// Mutation self-test for tools/html-gate.mjs.
//
// A gate nobody has ever SEEN go red is a decoration. This copies the real shipped documents into
// a temp dir, breaks exactly one thing per case, runs the gate, and asserts (a) it exits 1 and
// (b) the message names the check we expect. It also runs an untouched control that must exit 0,
// so a gate that fails everything cannot pass this suite.
//
// Every case below is a defect class this project has actually shipped or was one edit away from.
// Run: node tools/html-gate.selftest.mjs   ->   exit 0 = all mutations caught.
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = process.argv[2] || process.cwd();
const GATE = join(REPO, 'tools', 'html-gate.mjs');
const HOME = 'public/index.html';

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'pf-html-gate-'));
  mkdirSync(join(dir, 'public'), { recursive: true });
  cpSync(join(REPO, 'public'), join(dir, 'public'), {
    recursive: true,
    filter: (src) => !/[\\/](images|videos)([\\/]|$)/.test(src), // markup only; keeps the copy fast
  });
  return dir;
}

function runGate(dir) {
  try {
    const out = execFileSync(process.execPath, [GATE, dir], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// Replace the FIRST occurrence of `find` with `repl` in file `rel`. Throws if absent, so a case
// can never silently test nothing (this is exactly how the myfarm drill shipped a green no-op).
function mutate(dir, rel, find, repl) {
  const p = join(dir, rel);
  const src = readFileSync(p, 'utf8');
  const i = src.indexOf(find);
  if (i === -1) throw new Error(`anchor not found in ${rel}: ${JSON.stringify(find.slice(0, 70))}`);
  writeFileSync(p, src.slice(0, i) + repl + src.slice(i + find.length), 'utf8');
}

const CASES = [
  {
    name: 'deadAnchor — a nav link to an id the homepage does not have',
    expect: 'deadAnchor',
    why: '2026-08-01: the 404 nav linked /#about and /#contact. No error, no 404 - visitors were just silently dumped at the top of the homepage.',
    break: (d) => mutate(d, HOME, 'href="#catch"', 'href="/#about"'),
  },
  {
    name: 'hiddenContent — the reveal gate can never open (CSS source order)',
    expect: 'hiddenContent',
    why: '2026-08-01 SHIPPED TO PROD: .reveal.in written before .js-on .reveal, equal specificity, so every block below the hero stayed at opacity 0. Valid CSS, valid JS, blank page.',
    break: (d) => mutate(d, HOME, '.js-on .reveal.in{opacity:1;transform:none}', ''),
  },
  {
    name: 'jsonLd — a JSON-LD block that does not parse',
    expect: 'jsonLd',
    why: 'Google drops the entire block silently; the page looks identical.',
    break: (d) => mutate(d, HOME, '{"@context":"https://schema.org","@type":"FAQPage"',
                            '{"@context":"https://schema.org",,"@type":"FAQPage"'),
  },
  {
    name: 'faqDrift — visible FAQ edited, schema left behind',
    expect: 'faqDrift',
    why: 'Audit M3. Editing the copy without the schema is manufactured content.',
    break: (d) => mutate(d, HOME, '<div class="faq"><h3>How much are they?',
                            '<div class="faq"><h3>What do they cost these days?'),
  },
  {
    name: 'faqDrift — a question added to schema only',
    expect: 'faqDrift',
    why: 'The mirror image: schema promising a Q&A the reader never sees.',
    break: (d) => mutate(d, HOME, '"mainEntity":[{"@type":"Question","name":"Can I buy',
                            '"mainEntity":[{"@type":"Question","name":"Do you take bulk orders?","acceptedAnswer":{"@type":"Answer","text":"Yes."}},{"@type":"Question","name":"Can I buy'),
  },
  {
    name: 'fakeRating — a rating baked into LocalBusiness schema',
    expect: 'fakeRating',
    why: 'Audit H2. Invented review schema can get the Business Profile penalised.',
    break: (d) => mutate(d, HOME, '"paymentAccepted"',
                            '"aggregateRating":{"@type":"AggregateRating","ratingValue":"5.0","reviewCount":"37"},"paymentAccepted"'),
  },
  {
    name: 'fakeRating — the star row shipped visible',
    expect: 'fakeRating',
    why: 'Five gold stars rendering on a profile with zero reviews.',
    break: (d) => mutate(d, HOME, '<div class="revlive-rating" id="reviews-rating" hidden>',
                            '<div class="revlive-rating" id="reviews-rating">'),
  },
  {
    name: 'jsSyntax — an inline <script> with a syntax error',
    expect: 'jsSyntax',
    why: 'The manual gate every session used to run by hand.',
    break: (d) => mutate(d, HOME, '  function apply() {', '  function apply( {'),
  },
  {
    name: 'cssBrace — an unbalanced <style> block',
    expect: 'cssBrace',
    why: 'One dropped brace silently kills every rule after it.',
    break: (d) => mutate(d, HOME, '*{box-sizing:border-box', '*{box-sizing:border-box;{'),
  },
  {
    name: 'truncation — a host write cut the file short',
    expect: 'truncation',
    why: 'Guardrails S3 / stale-mount F4.',
    break: (d) => {
      const p = join(d, HOME);
      const s = readFileSync(p, 'utf8');
      writeFileSync(p, s.slice(0, Math.floor(s.length * 0.9)), 'utf8');
    },
  },
  {
    name: 'mojibake — UTF-8 re-encoded by a Set-Content write',
    expect: 'mojibake',
    why: 'LESSONS [encoding], 2026-07-24 — it reached myfarm prod.',
    break: (d) => mutate(d, HOME, 'Wildwood, NJ', 'Wildwoodâ€” NJ'),
  },
  {
    name: 'unclosed — a <script> opened and never closed',
    expect: 'unclosed',
    why: 'Everything after it becomes script body and vanishes from the page.',
    break: (d) => {
      const p = join(d, HOME);
      const s = readFileSync(p, 'utf8');
      const i = s.lastIndexOf('</script>');
      writeFileSync(p, s.slice(0, i) + s.slice(i + '</script>'.length), 'utf8');
    },
  },
];

let pass = 0;
let fail = 0;

// Control first: an untouched copy must be clean, otherwise every "caught" below is meaningless.
{
  const d = sandbox();
  const r = runGate(d);
  if (r.code === 0) { console.log('  ok  control (untouched copy) - gate exits 0'); pass++; }
  else { console.log('  X   control (untouched copy) - gate went red on clean files:\n' + r.out); fail++; }
  rmSync(d, { recursive: true, force: true });
}

for (const c of CASES) {
  const d = sandbox();
  let r;
  try {
    c.break(d);
    r = runGate(d);
  } catch (e) {
    console.log(`  X   ${c.name}\n      mutation could not be applied: ${e.message}`);
    fail++;
    rmSync(d, { recursive: true, force: true });
    continue;
  }
  const caught = r.code === 1 && r.out.includes(c.expect);
  if (caught) { console.log(`  ok  ${c.name}`); pass++; }
  else {
    console.log(`  X   ${c.name}\n      expected exit 1 containing "${c.expect}", got exit ${r.code}:\n${r.out}`);
    fail++;
  }
  rmSync(d, { recursive: true, force: true });
}

console.log(`\nHTML GATE SELF-TEST: ${pass} passed, ${fail} failed (${CASES.length} mutations + 1 control)`);
process.exit(fail ? 1 : 0);
