import { checkAuth, unauthorized, jsonResponse } from '../_utils.js';

export async function onRequestGet({ request, env }) {
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
