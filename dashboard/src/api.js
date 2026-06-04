const BASE = '/api';

export async function fetchKpis() {
  const res = await fetch(`${BASE}/kpis`);
  if (!res.ok) throw new Error('KPI fetch failed');
  return res.json();
}

export async function fetchTop10(params = {}) {
  const qs = new URLSearchParams();
  if (params.genre) qs.set('genre', params.genre);
  if (params.year_min) qs.set('year_min', params.year_min);
  if (params.year_max) qs.set('year_max', params.year_max);
  if (params.sort) qs.set('sort', params.sort);
  const res = await fetch(`${BASE}/top10?${qs}`);
  if (!res.ok) throw new Error('Top10 fetch failed');
  return res.json();
}

export async function fetchYearly() {
  const res = await fetch(`${BASE}/yearly`);
  if (!res.ok) throw new Error('Yearly fetch failed');
  return res.json();
}

export async function fetchGenres() {
  const res = await fetch(`${BASE}/genres`);
  if (!res.ok) throw new Error('Genres fetch failed');
  return res.json();
}
