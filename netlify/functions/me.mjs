// GET /api/me — the signed-in user's plan and remaining checks; anonymous callers get their daily allowance.
import { json, whoAndLimit, usage, misconfigured } from './lib/common.mjs';

export default async (req, context) => {
  if (misconfigured()) return json(503, { error: 'not configured' });
  try {
    const w = await whoAndLimit(req, context);
    const used = await usage(w.subject, w.period);
    return json(200, { signedIn: !!w.user, email: w.user ? w.user.email : null, plan: w.plan, limit: w.limit, remaining: Math.max(0, w.limit - used), period: w.period, ref: w.user ? w.user.id : null, useType: w.profile ? w.profile.use_type : null });
  } catch { return json(503, { error: 'unavailable' }); }
};
export const config = { path: '/api/me', method: ['GET'] };
