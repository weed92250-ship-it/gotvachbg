import { checkAuth, unauthorized, jsonResponse, rowToRecipe } from '../utils.js';

export async function listRecipes(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM recipes ORDER BY date DESC, rowid DESC'
  ).all();
  return jsonResponse(results.map(rowToRecipe));
}

export async function getRecipe(env, id) {
  const row = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(id).first();
  if (!row) return jsonResponse({ error: 'Not found' }, 404);
  return jsonResponse(rowToRecipe(row));
}

export async function createRecipe(request, env) {
  if (!checkAuth(request, env)) return unauthorized();
  const body = await request.json();
  if (!body.title || !body.excerpt || !body.instructions || !body.category || !body.area) {
    return jsonResponse({ error: 'Missing fields' }, 400);
  }
  const id = 'r' + Date.now();
  const date = new Date().toISOString().slice(0, 10);
  const ingredients = JSON.stringify(body.ingredients || []);
  const dietTags = (body.dietTags || []).join(',');
  if (body.featured) {
    await env.DB.prepare('UPDATE recipes SET featured = 0').run();
  }
  await env.DB.prepare(
    `INSERT INTO recipes (id, title, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.title,
      body.excerpt,
      ingredients,
      body.instructions,
      body.category,
      body.area,
      dietTags,
      body.image || null,
      body.youtube || null,
      body.author || 'Готвач БГ',
      date,
      body.featured ? 1 : 0
    )
    .run();
  return jsonResponse({ id, date });
}

export async function updateRecipe(request, env, id) {
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
      body.title,
      body.excerpt,
      ingredients,
      body.instructions,
      body.category,
      body.area,
      dietTags,
      body.image || null,
      body.youtube || null,
      body.featured ? 1 : 0,
      id
    )
    .run();
  return jsonResponse({ ok: true });
}

export async function deleteRecipe(env, id) {
  await env.DB.prepare('DELETE FROM recipes WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM comments WHERE recipe_id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
