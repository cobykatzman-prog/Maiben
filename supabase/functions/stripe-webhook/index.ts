// Receives Stripe's `checkout.session.completed` event, verifies its signature, and ONLY THEN saves the order.
const PRICES: Record<number, number> = { 250: 15, 500: 28, 750: 40, 1000: 50 };
const DELIVERY_FEE = 5;
const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
  return [...sig].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const safeEq = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export async function verifyStripe(raw: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t, v1 = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || !v1.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > 300) return false;           // 5 minute tolerance
  const expected = await hmacHex(secret, `${t}.${raw}`);
  return v1.some((s) => safeEq(s, expected));
}

export async function handler(req: Request, env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const secret = env.STRIPE_WEBHOOK_SECRET, url = env.SUPABASE_URL, service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !service) return new Response('not configured', { status: 503 });
  const raw = await req.text();
  if (!(await verifyStripe(raw, req.headers.get('stripe-signature'), secret, now))) return new Response('bad signature', { status: 400 });

  const event = JSON.parse(raw);
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return new Response('ignored', { status: 200 });
  const s = event.data.object;
  if (s.payment_status !== 'paid') return new Response('not paid yet', { status: 200 });

  const m = s.metadata || {};
  const size = Number(m.size_g), qty = Number(m.quantity), delivery = m.fulfilment === 'delivery';
  const expected = (PRICES[size] ?? 0) * qty + (delivery ? DELIVERY_FEE : 0);
  const paid = (s.amount_total ?? 0) / 100;
  const row = {
    flavour: m.flavour, size_g: size, quantity: qty, fulfilment: delivery ? 'delivery' : 'pickup',
    name: m.name, phone: m.phone, email: m.email || s.customer_details?.email || null,
    address: delivery ? m.address : null, notes: m.notes || null,
    stripe_session_id: s.id, amount_paid_aud: paid,
    status: paid === expected ? 'paid' : 'check amount',
  };
  const r = await fetchImpl(`${url}/rest/v1/orders?on_conflict=stripe_session_id`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!r.ok) return new Response('db error', { status: 500 });            // Stripe retries automatically
  return new Response('ok', { status: 200 });
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handler(req, D.env.toObject()));
