import { checkAuth, unauthorized, jsonResponse, rowToRecipe } from '../../_utils.js';

export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(params.id).first();
  if (!row) return jsonResponse({ error: 'Not found' }, 404);
  return jsonResponse(rowToRecipe(row));
}

export async function onRequestPut({ request, env, params }) {
  if (!checkAuth(request, env)) return unauthorized();
  const body = await request.json();
  if (body.featured) {
    await env.DB.prepare('UPDATE recipes SET featured = 0').run();
  }
  const ingredients = JSON.stringify(body.ingredients || []);
  const dietTags = (body.dietTags || []).join(',');
  await env.DB.prepare(
    `UPDATE recipes SET title=?, excerpt=?, ingredients=?, instructions=?, category=?, area=?, diet_tags=?, image=?, youtube=?, featured=? WHERE id=?`
  )
    .bind(
      body.title, body.excerpt, ingredients, body.instructions,
      body.category, body.area, dietTags, body.image || null,
      body.youtube || null, body.featured ? 1 : 0, params.id
    )
    .run();
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  if (!checkAuth(request, env)) return unauthorized();
  await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM comments WHERE recipe_id = ?').bind(params.id).run();
  return jsonResponse({ ok: true });
}
