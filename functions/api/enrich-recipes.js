import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';

function cleanOriginalIngredients(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : []).map(item => ({
    name: String(item?.name || '').trim(),
    measure: String(item?.measure || '').trim()
  })).filter(item => item.name || item.measure);
}

function buildNaturalInstructions(original) {
  const source = String(original || '').trim();
  if (!source) return '';

  const cleaned = source
    .replace(/={2,6}\s*([^=\n]+?)\s*={2,6}/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/([.!?])(?=[А-ЯA-Z])/g, '$1 ')
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!sentences.length) return cleaned;

  return sentences.map((sentence, index) => (index + 1) + '. ' + sentence).join('\n\n');
}

async function findCommonsImage(title) {
  try {
    const data = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action:'query',
      generator:'search',
      gsrsearch:'"' + title + '"',
      gsrnamespace:'6',
      gsrlimit:'5',
      prop:'imageinfo',
      iiprop:'url',
      iiurlwidth:'1200',
      format:'json',
      origin:'*'
    }), { headers:{'user-agent':'GotvachBG/1.0 (recipe enrichment)'} }).then(r=>r.json());

    const pages = Object.values(data?.query?.pages || {});
    const normalizedTitle = String(title || '').toLowerCase();
    const page = pages.find(p => p?.title?.toLowerCase().includes(normalizedTitle)) || pages[0];

    if (page?.title?.startsWith('File:')) {
      return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(page.title.slice(5)) + '?width=1200';
    }
  } catch (_) {}

  return null;
}

async function enrichOne(env, row) {
  const ingredients = cleanOriginalIngredients(JSON.parse(row.ingredients || '[]'));
  if (!ingredients.length) throw new Error('Изходните съставки са празни');

  const instructions = buildNaturalInstructions(row.instructions);
  if (!instructions) throw new Error('Изходният начин на приготвяне е празен');

  const excerpt = String(row.excerpt || ('Домашна рецепта за ' + row.title + '.')).trim().slice(0,500);
  const defaultImage = String(row.image || '').includes('photo-1546069901-ba9599a7e63c');
  const image = await findCommonsImage(row.title) || (defaultImage ? null : row.image) || null;

  await env.DB.prepare('UPDATE recipes SET excerpt=?, ingredients=?, instructions=?, image=? WHERE id=?')
    .bind(excerpt, JSON.stringify(ingredients), instructions, image, row.id).run();
}

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();

  const { results } = await env.DB.prepare("SELECT id,title,excerpt,ingredients,instructions,image FROM recipes WHERE source_id LIKE 'wikibooks:%' AND id NOT LIKE 'editorial-%' AND (instructions IS NULL OR length(instructions) < 700 OR image IS NULL) ORDER BY rowid ASC LIMIT 5").all();

  let updated=0, failed=0;
  const errors=[];

  for (const row of results || []) {
    try {
      await enrichOne(env,row);
      updated++;
    } catch(err) {
      failed++;
      errors.push(row.title+': '+String(err?.message || err));
    }
  }

  return jsonResponse({
    checked:results?.length||0,
    updated,
    failed,
    errors,
    titles:(results||[]).map(r=>r.title)
  });
}
