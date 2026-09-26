import { jsonResponse, createAdminToken } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  try {
    const { password } = await request.json();

    if (!env.ADMIN_PASSWORD) {
      return jsonResponse({ error: 'ADMIN_PASSWORD не е настроена в Cloudflare Production.' }, 500);
    }

    if (password && password === env.ADMIN_PASSWORD) {
      const token = await createAdminToken(env.ADMIN_PASSWORD);
      return jsonResponse({ ok: true }, 200, {
        'Set-Cookie': 'gotvach_admin=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800',
      });
    }

    return jsonResponse({ error: 'Грешна парола' }, 401);
  } catch (e) {
    return jsonResponse({ error: 'Грешка при обработка на входа.' }, 400);
  }
}
