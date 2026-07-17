import type { APIRoute } from 'astro';

export const prerender = false;

const DEFAULT = {
  items: [
    { key: 'little', name: 'Littlenecks', on: true, price: 'year-round' },
    { key: 'top', name: 'Topnecks', on: true, price: 'year-round' },
    { key: 'crab', name: 'Live blue crabs', on: true, price: 'in season' },
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
      if (raw) data = JSON.parse(raw);
    }
  } catch {
    data = DEFAULT;
  }
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const secret = secretOf(locals);
  if (!secret) return json({ error: 'not_configured' }, 503);
  const given = request.headers.get('x-pf-key') || '';
  if (given !== secret) return json({ error: 'unauthorized' }, 401);
  const kv = kvOf(locals);
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
