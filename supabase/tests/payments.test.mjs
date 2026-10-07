// Run: node --experimental-strip-types supabase/tests/payments.test.mjs
import crypto from 'node:crypto';
import { handler as checkout } from '../functions/create-checkout/index.ts';
import { handler as hook } from '../functions/stripe-webhook/index.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL:', m)); };

/* ---- create-checkout ---- */
const body = (o) => JSON.stringify({ flavour: 'Chilli', size_g: 500, quantity: 2, fulfilment: 'delivery', name: 'Dana', phone: '0412345678', address: '12 Example St', ...o });
const req = (o, h = {}) => new Request('https://fn/x', { method: 'POST', headers: { origin: 'https://maiben.example', ...h }, body: body(o) });
let sent;
const stripeOk = async (url, init) => { sent = { url, auth: init.headers.Authorization, form: new URLSearchParams(init.body) }; return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/abc' }), { status: 200 }); };
const env = { STRIPE_SECRET_KEY: 'sk_test_123' };

let r = await checkout(req({}), env, stripeOk);
ok(r.status === 200 && (await r.json()).url.startsWith('https://checkout.stripe.com'), 'returns stripe url');
ok(sent.form.get('line_items[0][price_data][unit_amount]') === '2800', 'unit price from server table ($28)');
ok(sent.form.get('line_items[0][quantity]') === '2', 'quantity passed');
ok(sent.form.get('line_items[1][price_data][unit_amount]') === '500', 'delivery $5 line added');
ok(sent.form.get('success_url') === 'https://maiben.example/?paid=1', 'success url');
ok(sent.form.get('metadata[name]') === 'Dana', 'metadata carries order');
r = await checkout(req({ fulfilment: 'pickup' }), env, stripeOk);
ok(!sent.form.has('line_items[1][quantity]'), 'no delivery line for pickup');
ok((await checkout(req({ price: 1, unit_amount: 1 }), env, stripeOk)).status === 200 && sent.form.get('line_items[0][price_data][unit_amount]') === '2800', 'client price ignored');
ok((await checkout(req({ flavour: 'Pickles' }), env, stripeOk)).status === 400, 'bad flavour rejected');
ok((await checkout(req({ size_g: 999 }), env, stripeOk)).status === 400, 'bad size rejected');
ok((await checkout(req({ quantity: 0 }), env, stripeOk)).status === 400, 'qty 0 rejected');
ok((await checkout(req({ quantity: 100 }), env, stripeOk)).status === 400, 'qty 100 rejected');
ok((await checkout(req({ address: '' }), env, stripeOk)).status === 400, 'delivery needs address');
ok((await checkout(req({ phone: '12' }), env, stripeOk)).status === 400, 'phone required');
ok((await checkout(req({ website: 'bot' }), env, stripeOk)).status === 400, 'honeypot');
ok((await checkout(req({}), {}, stripeOk)).status === 503, 'not configured -> 503');
ok((await checkout(req({}), env, async () => new Response('{}', { status: 500 }))).status === 502, 'stripe failure -> 502');

/* ---- stripe-webhook ---- */
const SECRET = 'whsec_test';
const sign = (raw, t = Math.floor(Date.now() / 1000), secret = SECRET) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
const session = (o = {}) => ({ id: 'cs_test_1', payment_status: 'paid', amount_total: 5600 + 500, customer_details: { email: 'd@x.com' },
  metadata: { flavour: 'Chilli', size_g: '500', quantity: '2', fulfilment: 'delivery', name: 'Dana', phone: '0412345678', address: '12 Example St' }, ...o });
const ev = (s, type = 'checkout.session.completed') => JSON.stringify({ type, data: { object: s } });
const wenv = { STRIPE_WEBHOOK_SECRET: SECRET, SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
let db; const dbOk = async (url, init) => { db = { url, init, row: JSON.parse(init.body) }; return new Response('', { status: 201 }); };
const post = (raw, sig) => new Request('https://fn/w', { method: 'POST', headers: { 'stripe-signature': sig }, body: raw });

let raw = ev(session({ amount_total: 6100 - 500 + 500 }));
// 2 x $28 + $5 delivery = $61
raw = ev(session({ amount_total: 6100 }));
r = await hook(post(raw, sign(raw)), wenv, dbOk);
ok(r.status === 200 && db.row.stripe_session_id === 'cs_test_1', 'paid event saves order');
ok(db.row.status === 'paid' && db.row.amount_paid_aud === 61, 'status paid, amount recorded');
ok(db.row.address === '12 Example St' && db.row.fulfilment === 'delivery', 'fields mapped');
ok(db.init.headers.Authorization === 'Bearer svc' && db.url.includes('on_conflict=stripe_session_id'), 'service role + idempotent');
db = null; r = await hook(post(raw, sign(raw, undefined, 'wrong')), wenv, dbOk);
ok(r.status === 400 && db === null, 'bad signature rejected, nothing saved');
db = null; r = await hook(post(raw, sign(raw, Math.floor(Date.now() / 1000) - 4000)), wenv, dbOk);
ok(r.status === 400 && db === null, 'stale signature rejected');
db = null; raw = ev(session({ payment_status: 'unpaid' }));
r = await hook(post(raw, sign(raw)), wenv, dbOk);
ok(r.status === 200 && db === null, 'unpaid session saves nothing');
db = null; raw = ev(session(), 'checkout.session.expired');
r = await hook(post(raw, sign(raw)), wenv, dbOk);
ok(db === null, 'expired/cancelled saves nothing');
raw = ev(session({ amount_total: 100 }));
await hook(post(raw, sign(raw)), wenv, dbOk);
ok(db.row.status === 'check amount', 'amount mismatch flagged');
r = await hook(post(raw, sign(raw)), wenv, async () => new Response('', { status: 500 }));
ok(r.status === 500, 'db failure -> 500 so Stripe retries');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
