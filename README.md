# Maiben Herring Co.

Static site on the shared luxury base. Serve with `npx serve maiben`.

## 3D hero
`js/hero-3d.js` (Three.js): the four tub photos sit on a ring of curved cards with floating spice flecks.
- **Drag** to spin (with flick and snap), **hover** to tilt, **arrow keys** when focused, flavour buttons to jump.
- **Scroll** steps through Mustard, Chilli, Schmaltz, 7 Spiced using 0.085 damping; text is never faded.
- No WebGL or reduced motion: static photo, buttons and scroll still switch the flavour.

## Content
Flavours, prices, phone and Instagram come from the original Maiben site. Orders are not sent anywhere: the order form shows a summary to confirm by phone/text. Add a real order endpoint or email before relying on it.

## Orders, payment and enquiries
- **Orders are saved only after payment.** The order form calls the `create-checkout` Edge Function, which builds a Stripe Checkout session (price from a server-side table, plus $5 for Melbourne delivery) and returns its URL. The customer pays on Stripe (the only link that leaves the site). When Stripe confirms payment it calls `stripe-webhook`, which verifies the signature and then inserts the row into `orders`. Unpaid or abandoned checkouts are never stored. The browser has no write access to `orders`.
- **Bulk enquiries** are not payments and are saved immediately to `enquiries`.
- **Read them:** Supabase dashboard (project `maiben`) > Table Editor > `orders` / `enquiries` (Export CSV in the toolbar). `orders.status` is `paid`, or `check amount` if Stripe's total differed from the expected price.
- **Setup needed once (secrets live in Supabase, never in this repo):**
  1. Supabase > Edge Functions > Secrets: add `STRIPE_SECRET_KEY`.
  2. Stripe > Developers > Webhooks > add endpoint `https://fnhtcfwjdajsrcmpizki.supabase.co/functions/v1/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
  3. Copy that endpoint's signing secret into Supabase secret `STRIPE_WEBHOOK_SECRET`.
  Use Stripe test keys first (test card 4242 4242 4242 4242).
- Tests: `node --experimental-strip-types supabase/tests/payments.test.mjs`
