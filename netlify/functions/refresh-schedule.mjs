// Scheduled every 6 hours: starts the background list refresh, and the site rebuild (fresh SEO pages) once a day.
export default async () => {
  const base = (process.env.URL || '').replace(/\/$/, '');
  if (base && process.env.ADMIN_TOKEN) {
    const r = await fetch(base + '/.netlify/functions/refresh-lists-background', { method: 'POST', headers: { 'x-admin-token': process.env.ADMIN_TOKEN } });
    console.log('refresh triggered', r.status);
  }
  if (process.env.BUILD_HOOK_URL && new Date().getUTCHours() < 6) await fetch(process.env.BUILD_HOOK_URL, { method: 'POST', body: '{}' });
  return new Response('ok');
};
export const config = { schedule: '17 */6 * * *' };
