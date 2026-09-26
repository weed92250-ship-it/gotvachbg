import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';
// force production redeploy

export async function onRequestGet({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  return jsonResponse({ ok: true });
}
