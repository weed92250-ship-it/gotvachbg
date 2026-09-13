import { checkAuth, unauthorized, jsonResponse } from '../utils.js';

export async function listComments(env, recipeId) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, text, date FROM comments WHERE recipe_id = ? ORDER BY id ASC'
  )
    .bind(recipeId)
    .all();
  return jsonResponse(results);
}

export async function addComment(request, env, recipeId) {
  const body = await request.json();
  const name = (body.name || '').trim();
  const text = (body.text || '').trim();
  const honeypot = (body.website || '').trim();

  if (honeypot) {
    // Тихо приемане на бота без реален запис
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
    .bind(recipeId, name.slice(0, 80), text.slice(0, 2000), date)
    .run();
  return jsonResponse({ ok: true, date });
}

export async function deleteComment(request, env, recipeId) {
  if (!checkAuth(request, env)) return unauthorized();
  const url = new URL(request.url);
  const commentId = url.searchParams.get('id');
  if (!commentId) return jsonResponse({ error: 'Missing id' }, 400);
  await env.DB.prepare('DELETE FROM comments WHERE id = ? AND recipe_id = ?')
    .bind(commentId, recipeId)
    .run();
  return jsonResponse({ ok: true });
}

export async function allComments(request, env) {
  if (!checkAuth(request, env)) return unauthorized();
  const { results } = await env.DB.prepare(
    `SELECT comments.id as id, comments.recipe_id as recipeId, comments.name as name,
            comments.text as text, comments.date as date, recipes.title as recipeTitle
     FROM comments
     LEFT JOIN recipes ON recipes.id = comments.recipe_id
     ORDER BY comments.id DESC`
  ).all();
  return jsonResponse(results);
}
