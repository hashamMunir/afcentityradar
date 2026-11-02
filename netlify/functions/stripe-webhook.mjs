// POST /api/stripe-webhook — Stripe calls this after payments. Signature is verified before anything changes.
import { json, sb } from './lib/common.mjs';
import { verifyStripe } from './lib/stripe.mjs';

const PLANS = new Set(['pro', 'team', 'enterprise']);
const UUID = /^[0-9a-f-]{36}$/i;
async function setPlan(uid, patch) {
  if (!UUID.test(uid || '')) return;
  await sb('profiles?id=eq.' + uid, { method: 'PATCH', body: JSON.stringify(patch) });
}
export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const payload = await req.text();
  if (payload.length > 200000) return json(413, { error: 'too large' });
  if (!verifyStripe(payload, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET)) return json(400, { error: 'signature' });
  const ev = JSON.parse(payload), o = ev.data && ev.data.object || {};
  try {
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') {
      const plan = PLANS.has(o.metadata && o.metadata.plan) ? o.metadata.plan : 'pro';
      await setPlan(o.client_reference_id || (o.metadata && o.metadata.uid), { plan, stripe_customer_id: o.customer, stripe_subscription_id: o.subscription });
    } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
      const uid = o.metadata && o.metadata.uid;
      const active = ev.type === 'customer.subscription.updated' && ['active', 'trialing', 'past_due'].includes(o.status);
      const plan = active && PLANS.has(o.metadata.plan) ? o.metadata.plan : 'free';
      await setPlan(uid, { plan, stripe_subscription_id: active ? o.id : null });
    }
  } catch (e) { console.error('webhook update failed', e.message); return json(500, { error: 'retry' }); }
  return json(200, { received: true });
};
export const config = { path: '/api/stripe-webhook', method: ['POST'] };
