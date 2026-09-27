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

  const sentences = source
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const groups = [];
  let current = [];
  const stepPattern = /изми|почист|нареж|отряз|разпред|подреж|слож|добав|долив|затвар|вар|обръщ|охлад|престоя|печ|запърж|свар|разбър|омес|остав/iu;

  for (const sentence of sentences) {
    current.push(sentence);
    if (stepPattern.test(sentence) || current.length >= 2) {
      groups.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) groups.push(current.join(' '));

  const labels = ['Подготовка', 'Подреждане и смесване', 'Термична обработка', 'Завършване'];
  const meaningful = groups.filter(Boolean);
  if (!meaningful.length) return source;

  return meaningful.map((text, i) => {
    const label = labels[Math.min(i, labels.length - 1)];
    return label + ': ' + text;
  }).join('\n\n');
}

async function findCommonsImage(title) {
  try {
    const data = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action:'query', generator:'search', gsrsearch:title+' food', gsrnamespace:'6', gsrlimit:'1',
      prop:'imageinfo', iiprop:'url', iiurlwidth:'1200', format:'json', origin:'*'
    }), { headers:{'user-agent':'GotvachBG/1.0 (recipe enrichment)'} }).then(r=>r.json());
    const page = Object.values(data?.query?.pages || {})[0];
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
  const image = await findCommonsImage(row.title) || row.image || null;

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
