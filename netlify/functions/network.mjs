// POST /api/network — checks the names in a relationship network against the lists.
// Requires the ticket returned by /api/screen (valid 15 minutes), so it cannot be used to screen for free.
import { json, sameOrigin, readJson, validName, checkTicket } from './lib/common.mjs';
import { ensureIndex } from './lib/lists.mjs';
import { searchLists } from './lib/match.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  let b;
  try { b = await readJson(req, 8192); } catch (e) { return json(e.status || 400, { error: e.message }); }
  if (!checkTicket(b.ticket)) return json(401, { error: 'ticket' });
  const names = (Array.isArray(b.names) ? b.names : []).filter(validName).slice(0, 60);
  if (!(await ensureIndex())) return json(503, { error: 'lists refreshing' });
  const out = {};
  for (const n of names) {
    const h = searchLists(n, {}).filter((x) => x.score >= 0.93 && x.row.cat !== 'pep').slice(0, 3).map((x) => ({ list: x.row.list, name: x.row.name, score: x.score }));
    if (h.length) out[n] = h;
  }
  return json(200, { hits: out });
};

export const config = { path: '/api/network', method: ['POST'], rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
