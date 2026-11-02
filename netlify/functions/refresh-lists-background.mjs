// Background function (up to 15 minutes): downloads the official lists from OpenSanctions,
// builds the compact screening index and public statistics, and stores them in Netlify Blobs.
// Triggered every 6 hours by refresh-schedule.mjs, or manually with the ADMIN_TOKEN header.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { LISTS, parseCSV, rowFromCsv } from './lib/match.mjs';

const BASE = 'https://data.opensanctions.org/datasets/latest/';
export default async (req) => {
  const tok = req.headers.get('x-admin-token') || '', want = process.env.ADMIN_TOKEN || '';
  if (!want || tok.length !== want.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(want))) return new Response('forbidden', { status: 403 });
  const rows = [], lists = [];
  for (const l of LISTS) {
    try {
      const r = await fetch(BASE + l[0] + '/targets.simple.csv', { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'AFC-Entity-Radar/1.0' } });
      if (!r.ok) throw new Error(String(r.status));
      const before = rows.length;
      parseCSV(await r.text(), (row) => rows.push(rowFromCsv(row, l)));
      lists.push({ id: l[0], label: l[1], cat: l[2], count: rows.length - before });
    } catch (e) { console.warn('list failed', l[0], e.message); }
  }
  if (rows.length < 1000) { console.error('too few rows, keeping previous index'); return new Response('kept previous'); }
  const pick = (r) => ({ id: r.id, name: r.name, schema: r.schema, list: r.list, countries: r.countries, sanctions: r.sanctions, program: r.program, first_seen: r.first_seen });
  const newest = (f) => { const seen = new Set(); return rows.filter((r) => r.cat !== 'pep' && f(r)).sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || '')).filter((r) => { const k = r.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 50).map(pick); };
  const countries = {};
  rows.forEach((r) => { if (r.cat === 'pep') return; r.countries.forEach((c) => { c = c.toUpperCase(); countries[c] = (countries[c] || 0) + 1; }); });
  const stats = {
    updated: new Date().toISOString(), total: rows.length, lists, countries,
    top: { org: newest((r) => !['Person', 'Vessel', 'Airplane'].includes(r.schema)), person: newest((r) => r.schema === 'Person'), all: newest(() => true) },
  };
  const store = getStore('afc-lists');
  await store.setJSON('index', rows);
  await store.setJSON('stats', stats);
  console.log('index rebuilt', rows.length, 'rows from', lists.length, 'lists');
  return new Response('ok');
};
