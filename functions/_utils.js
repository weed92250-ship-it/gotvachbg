export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function checkAuth(request, env) {
  const key = request.headers.get('x-admin-key');
  return !!key && key === env.ADMIN_PASSWORD;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
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
