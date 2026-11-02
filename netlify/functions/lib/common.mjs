// Shared helpers for AFC Entity Radar functions: responses, origin checks, auth, Supabase, quotas, tickets.
import crypto from 'node:crypto';

const E = process.env;
export const SITE_URL = (E.SITE_URL || E.URL || '').replace(/\/$/, '');
const SB_URL = (E.SUPABASE_URL || '').replace(/\/$/, '');
const SB_ANON = E.SUPABASE_ANON_KEY || '';
const SB_SERVICE = E.SUPABASE_SERVICE_ROLE_KEY || '';
const SECRET = E.APP_SECRET || '';           // long random string, used for HMAC (IP hashing, tickets)

export const LIMITS = {
  anonymous: { limit: +(E.ANON_DAILY_LIMIT || 5), period: 'day' },
  free: { limit: +(E.FREE_MONTHLY_LIMIT || 30), period: 'month' },
  pro: { limit: +(E.PRO_MONTHLY_LIMIT || 2000), period: 'month' },
  team: { limit: +(E.TEAM_MONTHLY_LIMIT || 10000), period: 'month' },
  enterprise: { limit: 1000000, period: 'month' },
};

export function json(status, obj, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });
}
export function misconfigured() { return !SB_URL || !SB_ANON || !SB_SERVICE || SECRET.length < 32; }

// Only accept browser calls from our own site (blocks cross-site request forgery and hot-linking of the API).
export function sameOrigin(req) {
  const o = req.headers.get('origin');
  if (!o) return true; // non-browser or same-origin GET
  try { return new URL(o).host === new URL(req.url).host; } catch { return false; }
}

export async function readJson(req, max = 4096) {
  const t = await req.text();
  if (t.length > max) throw Object.assign(new Error('payload too large'), { status: 413 });
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }); }
}

const NAME_RE = /^[\p{L}\p{M}\p{N} .,'’`\-&()\/]{2,120}$/u;
export const validName = (s) => typeof s === 'string' && NAME_RE.test(s.trim());

const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
export const periodKey = (p) => (p === 'day' ? today() : today().slice(0, 7));
export const anonSubject = (ip) => 'a:' + hmac('ip|' + (ip || 'unknown') + '|' + today()).slice(0, 40); // rotates daily, not reversible

// ---- Supabase ----
const userCache = new Map();
export async function getUser(req) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer ([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)$/);
  if (!m) return null;
  const tok = m[1], c = userCache.get(tok);
  if (c && c.exp > Date.now()) return c.user;
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + tok }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) return null;
  const u = await r.json();
  const user = { id: u.id, email: u.email };
  userCache.set(tok, { user, exp: Date.now() + 60000 });
  if (userCache.size > 500) userCache.delete(userCache.keys().next().value);
  return user;
}
export async function sb(path, opts = {}) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    ...opts,
    headers: { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(8000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error('db ' + r.status);
  return t ? JSON.parse(t) : null;
}
export async function sbAdmin(path, opts = {}) {
  const r = await fetch(SB_URL + '/auth/v1/admin/' + path, { ...opts, headers: { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('auth admin ' + r.status);
  return r.status === 204 ? null : r.json().catch(() => null);
}
export async function getProfile(uid) {
  const rows = await sb('profiles?id=eq.' + encodeURIComponent(uid) + '&select=plan,bonus_checks,stripe_customer_id,use_type');
  return rows && rows[0] ? rows[0] : { plan: 'free', bonus_checks: 0 };
}
// Atomically consume one check. Returns remaining checks, or -1 when the limit is reached.
export async function consume(subject, period, limit) {
  const r = await sb('rpc/consume_check', { method: 'POST', body: JSON.stringify({ p_subject: subject, p_period: period, p_limit: limit }) });
  return typeof r === 'number' ? r : -1;
}
export async function usage(subject, period) {
  const r = await sb('usage?subject=eq.' + encodeURIComponent(subject) + '&period=eq.' + period + '&select=count');
  return r && r[0] ? r[0].count : 0;
}
export async function whoAndLimit(req, context) {
  const user = await getUser(req);
  if (!user) {
    const L = LIMITS.anonymous;
    return { user: null, plan: 'anonymous', subject: anonSubject(context.ip), limit: L.limit, period: periodKey(L.period) };
  }
  const prof = await getProfile(user.id);
  const plan = LIMITS[prof.plan] ? prof.plan : 'free';
  const L = LIMITS[plan];
  return { user, plan, profile: prof, subject: 'u:' + user.id, limit: L.limit + (plan === 'free' ? (prof.bonus_checks || 0) : 0), period: periodKey(L.period) };
}

// ---- short-lived ticket so the relationship-network check can follow a paid/counted screening without using a second credit ----
export function makeTicket(subject) {
  const p = Buffer.from(JSON.stringify({ s: subject, e: Date.now() + 15 * 60000 })).toString('base64url');
  return p + '.' + hmac('t|' + p).slice(0, 43);
}
export function checkTicket(t) {
  if (typeof t !== 'string' || t.length > 400) return null;
  const [p, sig] = t.split('.');
  if (!p || !sig) return null;
  const exp = hmac('t|' + p).slice(0, 43);
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.e > Date.now() ? o : null; } catch { return null; }
}
export { crypto };
