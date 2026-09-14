import { runDailyImport } from '../_mealdb.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  const key = request.headers.get('x-admin-key');
  if (key !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const result = await runDailyImport(env);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e && e.message ? e.message : e),
      stack: String(e && e.stack ? e.stack : ''),
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
