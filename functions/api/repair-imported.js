import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';
import { retranslateImportedRecipes } from '../_mealdb.js';

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  try {
    const result = await retranslateImportedRecipes(env, 100);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Repair failed', details: String(err && err.message ? err.message : err) }, 500);
  }
}