export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

export async function createAdminToken(secret) {
  const payload = b64url(new TextEncoder().encode(String(Date.now())));
  return payload + '.' + await sign(payload, secret);
}

export async function checkAuth(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)gotvach_admin=([^;]+)/);
  if (!match || !env.ADMIN_PASSWORD) return false;
  const token = match[1];
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = await sign(payload, env.ADMIN_PASSWORD);
  if (signature.length !== expected.length) return false;
  const ok = await crypto.subtle.verify(
    'HMAC',
    await crypto.subtle.importKey('raw', new TextEncoder().encode(env.ADMIN_PASSWORD), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']),
    fromB64url(signature),
    new TextEncoder().encode(payload)
  );
  if (!ok) return false;
  const issued = Number(new TextDecoder().decode(fromB64url(payload)));
  return Number.isFinite(issued) && Date.now() - issued < 8 * 60 * 60 * 1000;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  });
}

export function rowToRecipe(r) {
  return {
    id: r.id,
    title: r.title,
    excerpt: r.excerpt,
    ingredients: JSON.parse(r.ingredients || '[]'),
    instructions: r.instructions,
    category: r.category,
    area: r.area,
    dietTags: (r.diet_tags || '').split(',').filter(Boolean),
    image: r.image || null,
    youtube: r.youtube || null,
    author: r.author,
    date: r.date,
    featured: !!r.featured,
    url: r.url || ('/recipe/' + r.id),
    img: r.image || null,
    time: r.time || null,
  };
}
