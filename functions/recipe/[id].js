import { escapeHtml } from '../_utils.js';

const SITE_URL = 'https://gotvachbg.pages.dev';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=85';

function safeImage(value) {
  return value && value.startsWith('http') && !value.includes('pollinations.ai') && !value.includes('[https://') ? value : FALLBACK_IMAGE;
}

export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(params.id).first();
  if (!row) return new Response('Рецептата не е намерена', { status: 404 });

  const { results: comments } = await env.DB.prepare(
    'SELECT id, name, text, date FROM comments WHERE recipe_id = ? ORDER BY id DESC LIMIT 50'
  ).bind(params.id).all();

  const title = escapeHtml(row.title);
  const desc = escapeHtml(row.excerpt);
  const image = safeImage(row.image);
  const url = `${SITE_URL}/recipe/${encodeURIComponent(row.id)}`;
  let ingredients = [];
  try { ingredients = JSON.parse(row.ingredients || '[]'); } catch (e) {}

  const ingredientsHtml = ingredients.map(i =>
    `<li><strong>${escapeHtml(i.measure || '')}</strong> ${escapeHtml(i.name || '')}</li>`
  ).join('');
  const stepsHtml = (row.instructions || '').split(/\n\n+/)
    .filter(Boolean)
    .map((p, i) => `<li><strong>${i + 1}.</strong> ${escapeHtml(p)}</li>`).join('');

  const commentsHtml = comments.length
    ? comments.map(c => `<article class="comment"><strong>${escapeHtml(c.name)}</strong><time>${escapeHtml(c.date)}</time><p>${escapeHtml(c.text)}</p></article>`).join('')
    : '<p class="muted">Още няма коментари. Бъди първият.</p>';

  const recipeSchema = {
    '@context':'https://schema.org',
    '@type':'Recipe',
    name: row.title,
    description: row.excerpt,
    image:[image],
    author:{'@type':'Person',name:row.author || 'Готвач БГ'},
    datePublished:row.date,
    recipeCategory:row.category,
    recipeCuisine:row.area,
    recipeIngredient:ingredients.map(i => [i.measure,i.name].filter(Boolean).join(' ')),
    recipeInstructions: (row.instructions || '').split(/\n\n+/).filter(Boolean).map((text,i)=>({'@type':'HowToStep',position:i+1,text})),
    mainEntityOfPage:url
  };

  const html = `<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Готвач БГ</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<link rel="stylesheet" href="/assets/site.css">
<script type="application/ld+json">${JSON.stringify(recipeSchema).replace(/</g,'\\u003c')}</script>
<style>
.recipe-page{padding:36px 0 70px}.crumbs{font-size:14px;color:var(--muted);margin-bottom:20px}.recipe-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px}.recipe-main,.recipe-side{background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow)}.recipe-main{overflow:hidden}.recipe-cover{width:100%;height:440px;object-fit:cover;display:block}.recipe-body{padding:30px}.recipe-body h1{font-size:clamp(32px,5vw,48px);line-height:1.08;letter-spacing:-1.5px;margin:0 0 14px}.lead{font-size:18px;color:var(--muted)}.facts{display:flex;flex-wrap:wrap;gap:9px;margin:20px 0}.fact{background:var(--soft);padding:9px 12px;border-radius:10px;font-weight:750;font-size:14px}.recipe-body h2{margin-top:34px;font-size:25px}.ingredients,.steps{padding-left:22px}.ingredients li,.steps li{margin:12px 0}.recipe-side{padding:22px;height:max-content;position:sticky;top:18px}.recipe-side h2{margin-top:0}.comment{border-top:1px solid var(--line);padding:15px 0}.comment time{color:var(--muted);font-size:12px;margin-left:8px}.comment p{margin:6px 0}.comment-form{display:grid;gap:10px;margin-top:15px}.comment-form input,.comment-form textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:11px;font:inherit}.comment-form textarea{min-height:110px;resize:vertical}.muted{color:var(--muted)}.back{color:var(--brand);text-decoration:none;font-weight:800}.notice{padding:12px;background:#f7f1ea;border-radius:10px;font-size:13px;color:var(--muted)}@media(max-width:850px){.recipe-layout{grid-template-columns:1fr}.recipe-side{position:static}.recipe-cover{height:300px}.recipe-body{padding:22px}}
</style>
</head>
<body>
<header class="topbar"><div class="wrap nav"><a class="logo" href="/">Готвач БГ</a><nav class="navlinks"><a href="/#recipes">Рецепти</a><a href="/about.html">За нас</a><a href="/contacts.html">Контакти</a></nav></div></header>
<main class="recipe-page"><div class="wrap">
<div class="crumbs"><a class="back" href="/">← Към рецептите</a></div>
<div class="recipe-layout">
<article class="recipe-main">
<img class="recipe-cover" src="${escapeHtml(image)}" alt="${title}" loading="eager">
<div class="recipe-body">
<h1>${title}</h1>
<p class="lead">${desc}</p>
<div class="facts"><span class="fact">🍽 ${escapeHtml(row.category)}</span><span class="fact">🌍 ${escapeHtml(row.area)}</span><span class="fact">👨‍🍳 ${escapeHtml(row.author)}</span><span class="fact">📅 ${escapeHtml(row.date)}</span></div>
<h2>Необходими продукти</h2><ul class="ingredients">${ingredientsHtml}</ul>
<h2>Начин на приготвяне</h2><ol class="steps">${stepsHtml}</ol>
</div>
</article>
<aside class="recipe-side">
<h2>Коментари</h2>
<div id="comments">${commentsHtml}</div>
<form class="comment-form" method="post" action="/api/comments/${encodeURIComponent(row.id)}">
<input name="name" maxlength="80" required placeholder="Твоето име">
<textarea name="text" maxlength="2000" required placeholder="Как се получи рецептата?"></textarea>
<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="display:none">
<button class="btn btn-primary" type="submit">Публикувай коментар</button>
</form>
<p class="notice">Коментарите минават през автоматична проверка за спам.</p>
</aside>
</div>
</div></main>
<footer class="footer"><div class="wrap footer-row"><div>© 2026 Готвач БГ</div><div class="footer-links"><a href="/about.html">За нас</a><a href="/contacts.html">Контакти</a><a href="/privacy.html">Поверителност</a><a class="admin" href="/admin">Админ</a></div></div></footer>
</body></html>`;

  return new Response(html,{headers:{'content-type':'text/html; charset=UTF-8'}});
}

export async function onRequestPost({ request, env, params }) {
  const form = await request.formData();
  const name = String(form.get('name') || '').trim();
  const text = String(form.get('text') || '').trim();
  const honeypot = String(form.get('website') || '').trim();
  if (honeypot) return Response.redirect(new URL(request.url),303);
  if (!name || !text) return new Response('Липсват име или коментар.',{status:400});
  const urlCount = (text.match(/https?:\/\//gi)||[]).length;
  if (urlCount >= 2) return new Response('Коментарът съдържа твърде много линкове.',{status:400});
  await env.DB.prepare('INSERT INTO comments (recipe_id,name,text,date) VALUES (?,?,?,?)')
    .bind(params.id,name.slice(0,80),text.slice(0,2000),new Date().toISOString().slice(0,10)).run();
  return Response.redirect(new URL(request.url),303);
}
