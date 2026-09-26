import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';
import { runWikibooksImport } from '../_wikibooks.js';

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  try {
    const result = typeof runWikibooksImport === 'function' ? await runWikibooksImport(env) : { error: 'Import function missing' };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Import failed', details: String(err && err.message ? err.message : err) }, 500);
  }
}
