import { jsonResponse } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const { password } = await request.json();
    if (password && password === env.ADMIN_PASSWORD) {
      return jsonResponse({ ok: true, key: password });
    }
    return jsonResponse({ error: 'Грешна парола' }, 401);
  } catch (e) {
    return jsonResponse({ error: 'Bad request' }, 400);
  }
}
