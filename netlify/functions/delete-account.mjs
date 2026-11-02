// POST /api/delete-account — GDPR erasure: deletes the user's account and profile (cancel any subscription first in the billing portal).
import { json, sameOrigin, getUser, sbAdmin, sb } from './lib/common.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  const user = await getUser(req);
  if (!user) return json(401, { error: 'Please sign in first.' });
  try {
    await sb('usage?subject=eq.' + encodeURIComponent('u:' + user.id), { method: 'DELETE' });
    await sbAdmin('users/' + user.id, { method: 'DELETE' }); // profile row is removed by ON DELETE CASCADE
  } catch { return json(500, { error: 'Could not delete the account. Contact support.' }); }
  return json(200, { deleted: true });
};
export const config = { path: '/api/delete-account', method: ['POST'] };
