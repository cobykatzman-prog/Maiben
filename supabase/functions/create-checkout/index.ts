// Creates a Stripe Checkout Session for a Maiben order. Nothing is saved to the database here:
// the order is only written by `stripe-webhook` once Stripe confirms the payment.
const PRICES: Record<number, number> = { 250: 15, 500: 28, 750: 40, 1000: 50 };
const DELIVERY_FEE = 5;
const FLAVOURS = ['Mustard', 'Chilli', 'Schmaltz', '7 Spiced'];

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });

export async function handler(req: Request, env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, origin);
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: 'payments_not_configured' }, 503, origin);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'bad_json' }, 400, origin); }
  if (b.website) return json({ error: 'rejected' }, 400, origin);   // honeypot

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const flavour = str(b.flavour, 20), size = Number(b.size_g), qty = Number(b.quantity);
  const fulfilment = b.fulfilment === 'delivery' ? 'delivery' : 'pickup';
  const name = str(b.name, 120), phone = str(b.phone, 30), email = str(b.email, 200);
  const address = str(b.address, 250), notes = str(b.notes, 450);
  if (!FLAVOURS.includes(flavour)) return json({ error: 'flavour' }, 400, origin);
  if (!(size in PRICES)) return json({ error: 'size' }, 400, origin);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) return json({ error: 'quantity' }, 400, origin);
  if (!name) return json({ error: 'name' }, 400, origin);
  if (phone.replace(/\D/g, '').length < 6) return json({ error: 'phone' }, 400, origin);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'email' }, 400, origin);
  if (fulfilment === 'delivery' && address.length < 5) return json({ error: 'address' }, 400, origin);

  const siteOrigin = origin && /^https?:\/\//.test(origin) ? origin : (env.SITE_URL || '');
  if (!siteOrigin) return json({ error: 'no_origin' }, 400, origin);
  const sizeLabel = size >= 1000 ? '1kg' : `${size}g`;

  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('success_url', `${siteOrigin}/?paid=1`);
  f.set('cancel_url', `${siteOrigin}/?cancelled=1`);
  f.set('line_items[0][quantity]', String(qty));
  f.set('line_items[0][price_data][currency]', 'aud');
  f.set('line_items[0][price_data][unit_amount]', String(PRICES[size] * 100));
  f.set('line_items[0][price_data][product_data][name]', `${flavour} herring, ${sizeLabel} tub`);
  if (fulfilment === 'delivery') {
    f.set('line_items[1][quantity]', '1');
    f.set('line_items[1][price_data][currency]', 'aud');
    f.set('line_items[1][price_data][unit_amount]', String(DELIVERY_FEE * 100));
    f.set('line_items[1][price_data][product_data][name]', 'Melbourne delivery');
  }
  if (email) f.set('customer_email', email);
  const meta: Record<string, string> = { flavour, size_g: String(size), quantity: String(qty), fulfilment, name, phone, email, address, notes };
  for (const [k, v] of Object.entries(meta)) if (v) f.set(`metadata[${k}]`, v);

  const r = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: f.toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) return json({ error: 'stripe', detail: data?.error?.message || null }, 502, origin);
  return json({ url: data.url }, 200, origin);
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handler(req, D.env.toObject()));
