// POST /api/checkout {plan:"pro"|"team"} — starts a Stripe Checkout subscription for the signed-in user.
import { json, sameOrigin, readJson, getUser, getProfile, SITE_URL, misconfigured } from './lib/common.mjs';
import { stripe, stripeReady } from './lib/stripe.mjs';

const PRICES = { pro: process.env.STRIPE_PRICE_PRO, team: process.env.STRIPE_PRICE_TEAM };
export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  if (misconfigured() || !stripeReady()) return json(503, { error: 'Payments are not set up yet.' });
  const user = await getUser(req);
  if (!user) return json(401, { error: 'Please sign in first.' });
  let b; try { b = await readJson(req, 512); } catch (e) { return json(400, { error: e.message }); }
  const plan = b.plan === 'team' ? 'team' : 'pro';
  if (!PRICES[plan]) return json(503, { error: 'This plan is not available yet.' });
  const prof = await getProfile(user.id);
  const base = SITE_URL || new URL(req.url).origin;
  const s = await stripe('checkout/sessions', {
    mode: 'subscription',
    line_items: { 0: { price: PRICES[plan], quantity: 1 } },
    client_reference_id: user.id,
    ...(prof.stripe_customer_id ? { customer: prof.stripe_customer_id } : { customer_email: user.email }),
    metadata: { uid: user.id, plan },
    subscription_data: { metadata: { uid: user.id, plan } },
    allow_promotion_codes: 'true',
    billing_address_collection: 'required',
    tax_id_collection: { enabled: 'true' },
    success_url: base + '/account/?checkout=success',
    cancel_url: base + '/pricing/?checkout=cancelled',
  });
  return json(200, { url: s.url });
};
export const config = { path: '/api/checkout', method: ['POST'] };
