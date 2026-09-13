import { checkAuth, unauthorized, jsonResponse } from '../../_utils.js';

export async function onRequestGet({ env, params }) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, text, date FROM comments WHERE recipe_id = ? ORDER BY id ASC'
  )
    .bind(params.recipeId)
    .all();
  return jsonResponse(results);
}

export async function onRequestPost({ request, env, params }) {
  const body = await request.json();
  const name = (body.name || '').trim();
  const text = (body.text || '').trim();
  const honeypot = (body.website || '').trim();

  if (honeypot) {
    return jsonResponse({ ok: true, date: new Date().toISOString().slice(0, 10) });
  }
  if (!name || !text) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  const urlCount = (text.match(/https?:\/\//gi) || []).length;
  if (urlCount >= 2) {
    return jsonResponse({ error: 'Too many links' }, 400);
  }

  const date = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO comments (recipe_id, name, text, date) VALUES (?, ?, ?, ?)'
  )
    .bind(params.recipeId, name.slice(0, 80), text.slice(0, 2000), date)
    .run();
  return jsonResponse({ ok: true, date });
}

export async function onRequestDelete({ request, env, params }) {
  if (!checkAuth(request, env)) return unauthorized();
  const url = new URL(request.url);
  const commentId = url.searchParams.get('id');
  if (!commentId) return jsonResponse({ error: 'Missing id' }, 400);
  await env.DB.prepare('DELETE FROM comments WHERE id = ? AND recipe_id = ?')
    .bind(commentId, params.recipeId)
    .run();
  return jsonResponse({ ok: true });
}
