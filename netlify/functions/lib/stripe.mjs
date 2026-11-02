// Minimal Stripe REST client (no SDK) + webhook signature verification.
import crypto from 'node:crypto';
const KEY = process.env.STRIPE_SECRET_KEY || '';
export const stripeReady = () => KEY.startsWith('sk_');
function form(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
export async function stripe(path, params) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST', body: form(params).join('&'),
    headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('stripe ' + r.status + ' ' + (j.error && j.error.type));
  return j;
}
// Verifies the Stripe-Signature header (HMAC-SHA256 over "timestamp.payload"), with a 5-minute replay window.
export function verifyStripe(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).filter((p) => p.length === 2 && (p[0] === 't' || p[0] === 'v1')));
  const t = +parts.t;
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
