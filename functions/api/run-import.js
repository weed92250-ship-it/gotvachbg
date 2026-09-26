import { jsonResponse } from '../_utils.js';
import { runWikibooksImport } from '../_wikibooks.js';

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-admin-key');
  if (!key || key !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  try {
    const result = typeof runWikibooksImport === 'function' ? await runWikibooksImport(env) : { error: 'Import function missing' };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Import failed', details: String(err && err.message ? err.message : err) }, 500);
  }
}
