// POST /api/screen — screens a name against the official lists. Counts one check against the caller's quota.
import { json, sameOrigin, readJson, validName, whoAndLimit, consume, makeTicket, misconfigured } from './lib/common.mjs';
import { ensureIndex } from './lib/lists.mjs';
import { searchLists, norm, infoTokens } from './lib/match.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  if (misconfigured()) return json(503, { error: 'not configured' });
  let b;
  try { b = await readJson(req); } catch (e) { return json(e.status || 400, { error: e.message }); }
  const q = String(b.q || '').trim();
  if (!validName(q)) return json(400, { error: 'Enter a name of 2–120 letters.' });
  const aliases = (Array.isArray(b.aliases) ? b.aliases : []).filter(validName).slice(0, 8).map((s) => s.trim());
  const year = Number.isInteger(b.year) && b.year > 1900 && b.year < 2100 ? b.year : null;
  const country = typeof b.country === 'string' && /^[A-Za-z]{2}$/.test(b.country) ? b.country.toLowerCase() : null;
  const type = ['any', 'person', 'org'].includes(b.type) ? b.type : 'any';

  let who;
  try { who = await whoAndLimit(req, context); } catch { return json(503, { error: 'account service unavailable' }); }
  let remaining;
  try { remaining = await consume(who.subject, who.period, who.limit); } catch { return json(503, { error: 'quota service unavailable' }); }
  const quota = { plan: who.plan, limit: who.limit, remaining: Math.max(0, remaining), period: who.period };
  if (remaining < 0) return json(402, { error: 'quota', anonymous: !who.user, quota });

  if (!(await ensureIndex())) return json(503, { error: 'Screening lists are refreshing. Try again in a few minutes.', quota });
  const opts = { year, country, type };
  let hits = searchLists(q, opts);
  for (const al of aliases) if (infoTokens(norm(al)) >= 2) hits = hits.concat(searchLists(al, opts).filter((h) => h.score >= 0.9));
  const seen = new Set();
  hits = hits.sort((a, b) => b.score - a.score).filter((h) => { const k = h.row.id + h.row.listId; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
  // Never log the screened name (personal data); only counts.
  console.log(JSON.stringify({ evt: 'screen', plan: who.plan, hits: hits.length }));
  return json(200, { hits, quota, ticket: makeTicket(who.subject) });
};

export const config = { path: '/api/screen', method: ['POST'], rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
