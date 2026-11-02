// Build script for AFC Entity Radar (Netlify, Node 20+, no dependencies).
// Copies src/ → dist/, writes the public browser config from environment variables,
// and pre-renders SEO pages (country risk table, sanctions lists) so search engines index real content.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const env = process.env;
const SITE_URL = (env.SITE_URL || env.URL || 'https://afc-entity-radar.netlify.app').replace(/\/$/, '');
const V = {
  SITE_URL, CONTACT_EMAIL: env.CONTACT_EMAIL || 'contact@example.com', CONTROLLER: env.CONTROLLER_NAME || 'AFC Entity Radar',
  PRO_PRICE: env.PRO_PRICE || '€49', TEAM_PRICE: env.TEAM_PRICE || '€199',
  FREE_MONTHLY_LIMIT: env.FREE_MONTHLY_LIMIT || '30', PRO_MONTHLY_LIMIT: env.PRO_MONTHLY_LIMIT || '2000', TEAM_MONTHLY_LIMIT: env.TEAM_MONTHLY_LIMIT || '10000',
  GOOGLE_VERIFICATION: env.GOOGLE_VERIFICATION || '', BUILD_DATE: new Date().toISOString().slice(0, 10),
};
V.PRO_PRICE_NUM = (V.PRO_PRICE.match(/[\d.]+/) || ['49'])[0];
V.TEAM_PRICE_NUM = (V.TEAM_PRICE.match(/[\d.]+/) || ['199'])[0];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Country risk (keep in sync with assets/afc.js)
const FATF_BLACK = ['IR', 'MM', 'KP'];
const FATF_GREY = ['AO', 'BO', 'BA', 'VG', 'BG', 'CM', 'CI', 'CD', 'HT', 'IQ', 'KE', 'KW', 'LA', 'LB', 'MC', 'NP', 'PG', 'SS', 'SY', 'VE', 'VN', 'YE'];
const EU_HR = ['AF', 'DZ', 'AO', 'BO', 'VG', 'CM', 'CI', 'CD', 'HT', 'KE', 'LA', 'LB', 'MC', 'MM', 'NA', 'NP', 'SS', 'SY', 'TT', 'VU', 'VE', 'VN', 'YE', 'KP', 'IR', 'RU'];
const BASEL = { MM: 8.18, HT: 8.12, CD: 7.63, TD: 7.56, GQ: 7.55, VE: 7.55, LA: 7.5, GA: 7.46, CF: 7.44, GW: 7.3, CG: 7.27, CN: 7.26, DJ: 6.93, NE: 6.84, DZ: 6.82, MG: 6.77, TM: 6.73, KH: 6.72, VN: 6.69, KM: 6.67, NZ: 3.76, NO: 3.73, SI: 3.49, AD: 3.48, SE: 3.48, EE: 3.25, DK: 3.18, SM: 3.08, IS: 3.04, FI: 3.03 };
const LISTS = [['un_sc_sanctions', 'UN Security Council sanctions'], ['us_ofac_sdn', 'US OFAC SDN list'], ['us_ofac_cons', 'US OFAC consolidated (non-SDN)'], ['eu_fsf', 'EU financial sanctions'], ['gb_fcdo_sanctions', 'UK sanctions list'], ['gb_proscribed_orgs', 'UK proscribed terrorist organisations'], ['gb_nca_most_wanted', 'UK NCA most wanted'], ['ch_seco_sanctions', 'Switzerland SECO sanctions'], ['ca_dfatd_sema_sanctions', 'Canada autonomous sanctions'], ['au_dfat_sanctions', 'Australia DFAT sanctions'], ['pk_proscribed_persons', 'Pakistan NACTA proscribed persons'], ['ae_local_terrorists', 'UAE local terrorist list'], ['in_mha_banned', 'India MHA banned organisations'], ['interpol_red_notices', 'Interpol red notices'], ['us_fbi_most_wanted', 'FBI most wanted'], ['worldbank_debarred', 'World Bank debarred firms & individuals'], ['pk_na_members', 'Pakistan National Assembly members (PEP)'], ['pk_senate_members', 'Pakistan Senate members (PEP)']];

async function copyDir(a, b) { await fs.mkdir(b, { recursive: true }); for (const e of await fs.readdir(a, { withFileTypes: true })) { const s = path.join(a, e.name), d = path.join(b, e.name); if (e.isDirectory()) await copyDir(s, d); else await fs.copyFile(s, d); } }
async function walk(dir, list = []) { for (const e of await fs.readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) await walk(p, list); else list.push(p); } return list; }

await fs.rm('dist', { recursive: true, force: true });
await copyDir('src', 'dist');

// Public browser configuration — only publishable keys, never secrets.
const cfg = { SUPABASE_URL: env.SUPABASE_URL || '', SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '', TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY || '', FREE_MONTHLY_LIMIT: +V.FREE_MONTHLY_LIMIT, ANON_DAILY_LIMIT: +(env.ANON_DAILY_LIMIT || 5) };
if (/service_role/.test(Buffer.from((cfg.SUPABASE_ANON_KEY.split('.')[1] || ''), 'base64').toString())) throw new Error('SUPABASE_ANON_KEY is a service-role key — refusing to publish it.');
await fs.writeFile('dist/assets/config.js', 'window.AFC_CONFIG=' + JSON.stringify(cfg) + ';\n');

// Country risk table
const iso = JSON.parse(await fs.readFile('src/assets/data/iso.json', 'utf8'));
const DN = new Intl.DisplayNames(['en'], { type: 'region' });
const rows = iso.map(([a2]) => { let n; try { n = DN.of(a2); } catch { n = a2; } const fatf = FATF_BLACK.includes(a2) ? 'Call for action (black list)' : FATF_GREY.includes(a2) ? 'Increased monitoring (grey list)' : ''; const eu = EU_HR.includes(a2); const basel = BASEL[a2] || ''; const tier = fatf || eu ? 'High' : basel && basel >= 6.5 ? 'Medium' : 'Low'; return { a2, n, fatf, eu, basel, tier }; })
  .filter((r) => r.n && r.n !== r.a2).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.tier] - { High: 0, Medium: 1, Low: 2 }[b.tier]) || (b.basel || 0) - (a.basel || 0) || a.n.localeCompare(b.n));
const riskHtml = `<p class="note">Updated ${V.BUILD_DATE}. ${rows.filter((r) => r.tier === 'High').length} high-risk and ${rows.filter((r) => r.tier === 'Medium').length} medium-risk jurisdictions.</p><div class="tbox" style="max-height:none"><table><thead><tr><th>Country</th><th>Risk</th><th>FATF status</th><th>EU high-risk</th><th>Basel AML Index 2025</th></tr></thead><tbody>` +
  rows.map((r) => `<tr><td>${esc(r.n)}</td><td>${r.tier}</td><td>${esc(r.fatf || '—')}</td><td>${r.eu ? 'Yes' : '—'}</td><td>${r.basel || '—'}</td></tr>`).join('') + '</tbody></table></div>';

// Sanctions lists table (sizes from OpenSanctions at build time; descriptions as fallback)
let idx = null;
try { const r = await fetch('https://data.opensanctions.org/datasets/latest/index.json', { signal: AbortSignal.timeout(20000) }); if (r.ok) idx = await r.json(); } catch (e) { console.warn('OpenSanctions index unavailable', e.message); }
const byName = {}; (idx?.datasets || []).forEach((d) => (byName[d.name] = d));
const listHtml = '<div class="tbox" style="max-height:none"><table><thead><tr><th>List</th><th>Entries</th><th>Last change</th><th>Publisher</th></tr></thead><tbody>' +
  LISTS.map(([id, label]) => { const d = byName[id] || {}; return `<tr><td><a href="https://www.opensanctions.org/datasets/${id}/" rel="noopener">${esc(label)}</a></td><td>${d.target_count ? d.target_count.toLocaleString('en') : '—'}</td><td>${esc((d.last_change || '').slice(0, 10) || '—')}</td><td>${esc((d.publisher && d.publisher.name) || '—')}</td></tr>`; }).join('') + '</tbody></table></div>';

const files = await walk('dist');
const pages = [];
for (const f of files) {
  if (!/\.(html|txt|xml|webmanifest)$/.test(f)) continue;
  let t = await fs.readFile(f, 'utf8');
  t = t.split('<!--SSR:COUNTRY_RISK-->').join(riskHtml).split('<!--SSR:LISTS-->').join(listHtml);
  for (const [k, v] of Object.entries(V)) t = t.split('{{' + k + '}}').join(k === 'SITE_URL' ? v : esc(v));
  if (!V.GOOGLE_VERIFICATION) t = t.replace(/<meta name="google-site-verification" content="">\n?/g, '');
  await fs.writeFile(f, t);
  if (f.endsWith('index.html') && !/noindex/.test(t)) { const rel = '/' + path.relative('dist', path.dirname(f)).split(path.sep).join('/'); pages.push(rel === '/' ? '/' : rel + '/'); }
}
const pr = { '/': '1.0', '/country-risk/': '0.9', '/sanctions-lists/': '0.8', '/pricing/': '0.8' };
await fs.writeFile('dist/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.sort().map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${V.BUILD_DATE}</lastmod><changefreq>${p === '/' || p === '/sanctions-lists/' ? 'daily' : 'weekly'}</changefreq><priority>${pr[p] || '0.6'}</priority></url>`).join('\n') + '\n</urlset>\n');
console.log('built', pages.length, 'indexable pages for', SITE_URL);
