import { checkAuth, unauthorized, jsonResponse, rowToRecipe } from '../../_utils.js';

function normalizeSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('bg-BG')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/й/g, 'и')
    .trim();
}

function matchesSearch(row, query) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  let ingredients = [];
  try { ingredients = JSON.parse(row.ingredients || '[]'); } catch (_) {}
  const haystack = normalizeSearch([
    row.title,
    row.title_en,
    row.excerpt,
    row.instructions,
    row.category,
    row.area,
    row.diet_tags,
    row.author,
    row.date,
    ...ingredients.flatMap(i => [i.name, i.measure])
  ].join(' '));
  return terms.every(term => haystack.includes(term));
}

export async function onRequestGet({ env, request }) {
  const query = new URL(request.url).searchParams.get('q') || '';
  const { results } = await env.DB.prepare(
    'SELECT * FROM recipes ORDER BY featured DESC, date DESC, rowid DESC'
  ).all();
  const filtered = query.trim() ? results.filter(row => matchesSearch(row, query)) : results;
  return jsonResponse(filtered.map(rowToRecipe), 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  const body = await request.json();
  if (!body.title || !body.excerpt || !body.instructions || !body.category || !body.area) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  const id = 'r' + Date.now();
  const date = new Date().toISOString().slice(0, 10);
  const ingredients = JSON.stringify(body.ingredients || []);
  const dietTags = (body.dietTags || []).join(',');
  if (body.featured) await env.DB.prepare('UPDATE recipes SET featured = 0').run();
  await env.DB.prepare(
    `INSERT INTO recipes (id, title, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured, time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.excerpt, ingredients, body.instructions,
    body.category, body.area, dietTags, body.image || null,
    body.youtube || null, body.author || 'Готвач БГ', date, body.featured ? 1 : 0, body.time || null
  ).run();
  return jsonResponse({ id, date });
}

export async function onRequestPut({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  const body = await request.json();
  if (!body.id || !body.title || !body.excerpt || !body.instructions || !body.category || !body.area) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  if (body.featured) await env.DB.prepare('UPDATE recipes SET featured = 0').run();
  await env.DB.prepare(
    'UPDATE recipes SET title=?, excerpt=?, ingredients=?, instructions=?, category=?, area=?, image=?, youtube=?, author=?, featured=?, time=? WHERE id=?'
  ).bind(
    body.title, body.excerpt, JSON.stringify(body.ingredients || []), body.instructions,
    body.category, body.area, body.image || null, body.youtube || null,
    body.author || 'Готвач БГ', body.featured ? 1 : 0, body.time || null, body.id
  ).run();
  return jsonResponse({ ok: true, id: body.id });
}

export async function onRequestDelete({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  const body = await request.json();
  if (!body.id) return jsonResponse({ error: 'Missing id' }, 400);
  await env.DB.prepare('DELETE FROM comments WHERE recipe_id=?').bind(body.id).run();
  await env.DB.prepare('DELETE FROM recipes WHERE id=?').bind(body.id).run();
  return jsonResponse({ ok: true, id: body.id });
}
