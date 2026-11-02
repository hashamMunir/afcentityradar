// Loads the pre-built screening index from Netlify Blobs and keeps it warm in memory.
import { getStore } from '@netlify/blobs';
import { buildIndex, indexSize } from './match.mjs';

let loadedAt = 0, loading = null, stats = null;
export async function ensureIndex() {
  if (indexSize() && Date.now() - loadedAt < 30 * 60000) return true;
  if (!loading) loading = (async () => {
    const store = getStore('afc-lists');
    const rows = await store.get('index', { type: 'json' });
    if (rows && rows.length) { buildIndex(rows); loadedAt = Date.now(); stats = await store.get('stats', { type: 'json' }); }
  })().finally(() => { loading = null; });
  await loading;
  return indexSize() > 0;
}
export const getStats = () => stats;
