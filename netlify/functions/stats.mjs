// GET /api/stats — public summary: list sizes, newest listed entities (top 50) and listed entities per country.
import { getStore } from '@netlify/blobs';
import { json } from './lib/common.mjs';

export default async () => {
  const s = await getStore('afc-lists').get('stats', { type: 'json' });
  if (!s) return json(503, { error: 'lists refreshing' });
  return json(200, s, { 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' });
};
export const config = { path: '/api/stats', method: ['GET'] };
