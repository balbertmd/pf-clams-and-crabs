import type { APIRoute } from 'astro';

export const prerender = false;

const DEFAULT = {
  items: [
    { key: 'little', name: 'Littlenecks', on: true, price: 'year-round' },
    { key: 'top', name: 'Topnecks', on: true, price: 'year-round' },
    // Crabs default OFF. Fable audit 2026-07-27 (C1): with PF_STATE unbound this default was the
    // ONLY thing customers saw, so the board asserted live crabs in stock every day of the season
    // while Paul might have none — and the editor that would correct it was never wired. Clams are
    // year-round and safe to assert; crabs are seasonal and must be claimed, never assumed.
    { key: 'crab', name: 'Live blue crabs', on: false, price: 'call to check' },
  ],
  note: '',
  open: true,
  hours: '',
};

const kvOf = (locals: any) => locals?.runtime?.env?.PF_STATE;
const secretOf = (locals: any) => locals?.runtime?.env?.PF_ADMIN_PASSWORD;

const json = (o: any, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

function shape(b: any) {
  const items = Array.isArray(b?.items)
    ? b.items.slice(0, 12).map((it: any) => ({
        key: String(it?.key ?? '').slice(0, 24),
        name: String(it?.name ?? '').slice(0, 60),
        on: !!it?.on,
        price: String(it?.price ?? '').slice(0, 80),
      }))
    : DEFAULT.items;
  return {
    items,
    note: String(b?.note ?? '').slice(0, 160),
    open: !!b?.open,
    hours: String(b?.hours ?? '').slice(0, 80),
  };
}

export const GET: APIRoute = async ({ locals }) => {
  const kv = kvOf(locals);
  let data: any = DEFAULT;
  try {
    if (kv) {
      const raw = await kv.get('today');
      // shape() on READ too. Fable audit (M8): a malformed or emptied KV value used to be served
      // raw; the homepage ignores payloads with no items, so the board would silently pin the
      // static fallback forever while the editor reported "Saved."
      if (raw) {
        const parsed = shape(JSON.parse(raw));
        data = parsed.items.length ? parsed : DEFAULT;
      }
    }
  } catch {
    data = DEFAULT;
  }
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
};

// Constant-time compare — no early exit on first differing byte. Fable audit (H1).
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const FAIL_LIMIT = 10; // per IP per hour
const FAIL_TTL = 3600;

export const POST: APIRoute = async ({ request, locals }) => {
  const secret = secretOf(locals);
  const kv = kvOf(locals);

  // Fable audit (H1): the write path had no rate limit, a short-circuiting compare, and a
  // 503-vs-401 oracle telling an attacker whether the path was armed. Workers serve thousands of
  // guesses a second and a hit rewrites the first block customers read. Every wrong key now looks
  // identical from outside — 401, whether or not the secret is even configured.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rlKey = `fail:${ip}`;
  if (kv) {
    const fails = Number((await kv.get(rlKey)) || 0);
    if (fails >= FAIL_LIMIT) return json({ error: 'unauthorized' }, 429);
  }

  const given = request.headers.get('x-pf-key') || '';
  if (!secret || !safeEqual(given, secret)) {
    if (kv) {
      const fails = Number((await kv.get(rlKey)) || 0) + 1;
      await kv.put(rlKey, String(fails), { expirationTtl: FAIL_TTL });
    }
    return json({ error: 'unauthorized' }, 401);
  }
  if (!kv) return json({ error: 'no_store' }, 503);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const clean: any = shape(body);
  clean.updated = new Date().toISOString();
  await kv.put('today', JSON.stringify(clean));
  return json({ ok: true, updated: clean.updated }, 200);
};
