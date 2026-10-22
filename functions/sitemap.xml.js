const SITE_URL = 'https://gotvachbg.pages.dev';

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function onRequestGet({ env }) {
  const urls = [{ loc: SITE_URL + '/', lastmod: null }];

  try {
    const { results = [] } = await env.DB.prepare(
      'SELECT id, date FROM recipes ORDER BY date DESC, rowid DESC'
    ).all();

    for (const recipe of results) {
      if (!recipe?.id) continue;
      const loc = SITE_URL + '/recipe/' + encodeURIComponent(String(recipe.id));
      const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(String(recipe.date || ''))
        ? String(recipe.date)
        : null;
      urls.push({ loc, lastmod });
    }
  } catch (_) {
    // Keep the homepage in the sitemap if the database is temporarily unavailable.
  }

  const entries = urls.map(({ loc, lastmod }) =>
    '<url><loc>' + xmlEscape(loc) + '</loc>' +
    (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '') +
    '</url>'
  ).join('');

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries +
    '</urlset>',
    { headers: { 'content-type': 'application/xml; charset=UTF-8', 'cache-control': 'public, max-age=300' } }
  );
}
