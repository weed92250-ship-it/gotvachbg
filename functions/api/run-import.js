import { jsonResponse } from '../_utils.js';
import { runDailyImport } from '../_mealdb.js';

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-admin-key');
  if (!key || key !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const result = await runDailyImport(env);
  return jsonResponse(result);
}
