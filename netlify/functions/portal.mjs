// POST /api/portal — opens the Stripe billing portal (invoices, card, cancel) for the signed-in user.
import { json, sameOrigin, getUser, getProfile, SITE_URL } from './lib/common.mjs';
import { stripe, stripeReady } from './lib/stripe.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  if (!stripeReady()) return json(503, { error: 'Payments are not set up yet.' });
  const user = await getUser(req);
  if (!user) return json(401, { error: 'Please sign in first.' });
  const prof = await getProfile(user.id);
  if (!prof.stripe_customer_id) return json(404, { error: 'No subscription yet.' });
  const s = await stripe('billing_portal/sessions', { customer: prof.stripe_customer_id, return_url: (SITE_URL || new URL(req.url).origin) + '/account/' });
  return json(200, { url: s.url });
};
export const config = { path: '/api/portal', method: ['POST'] };
