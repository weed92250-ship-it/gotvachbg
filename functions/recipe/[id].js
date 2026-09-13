import { escapeHtml } from '../_utils.js';

const SITE_URL = 'https://gotvachbg.pages.dev';

export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(params.id).first();
  if (!row) {
    return new Response('Рецептата не е намерена', { status: 404 });
  }

  const title = escapeHtml(row.title);
  const desc = escapeHtml(row.excerpt);
  const image = row.image ? escapeHtml(row.image) : '';
  const url = `${SITE_URL}/recipe/${escapeHtml(row.id)}`;

  let ingredients = [];
  try {
    ingredients = JSON.parse(row.ingredients || '[]');
  } catch (e) {}

  const ingredientsHtml = ingredients
    .map(i => `<li>${escapeHtml(i.measure || '')} ${escapeHtml(i.name || '')}</li>`)
    .join('\n');

  const stepsHtml = (row.instructions || '')
    .split(/\n\n+/)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Готвач БГ</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
${image ? `<meta property="og:image" content="${image}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<style>
  body{font-family:'IBM Plex Sans',sans-serif;max-width:720px;margin:0 auto;padding:32px 20px 80px;background:#FAF3E8;color:#3B2F2A;line-height:1.6;}
  a{color:#B5502E;}
  h1{font-family:'Space Grotesk',sans-serif;font-size:28px;line-height:1.25;}
  h2{font-size:20px;margin-top:32px;}
  img{width:100%;border-radius:6px;margin:16px 0;display:block;}
  .meta{color:#8A7A6D;font-size:13px;margin-bottom:20px;}
  .back{display:inline-block;margin-bottom:24px;font-size:14px;color:#8A7A6D;}
  ul{padding-left:20px;}
  li{margin-bottom:6px;}
  p{font-size:16.5px;color:#4A3D35;}
  .cta{margin-top:30px;padding-top:20px;border-top:1px solid #E4D8C7;font-size:14px;}
</style>
</head>
<body>
  <a href="/" class="back">← Готвач БГ</a>
  <h1>${title}</h1>
  <div class="meta">${escapeHtml(row.author)} · ${escapeHtml(row.date)} · ${escapeHtml(row.area)}</div>
  ${image ? `<img src="${image}" alt="${title}" loading="lazy">` : ''}
  <p>${desc}</p>
  <h2>Съставки</h2>
  <ul>${ingredientsHtml}</ul>
  <h2>Начин на приготвяне</h2>
  ${stepsHtml}
  <div class="cta">
    <a href="/#/recipe/${escapeHtml(row.id)}">Отвори интерактивната версия с коментари →</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=UTF-8' },
  });
}
