import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';
import { fetchWikitext, parseRecipe, findCommonsImage } from '../_wikibooks.js';

const badImage = value => {
  const image = String(value || '');
  return !image || image.includes('photo-1546069901-ba9599a7e63c') || image.includes('pollinations.ai') || image.includes('[https://');
};

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();

  let cursor = 0;
  try {
    const body = await request.json();
    cursor = Number(body?.afterRowId || 0) || 0;
  } catch (_) {}

  const { results } = await env.DB.prepare(
    "SELECT rowid AS row_id,id,source_id,title FROM recipes WHERE id NOT LIKE 'editorial-%' AND rowid > ? ORDER BY rowid ASC LIMIT 50"
  ).bind(cursor).all();

  let checked = 0, fixed = 0, failed = 0;
  const errors = [], titles = [];

  for (const row of results || []) {
    checked++;
    try {
      const current = await env.DB.prepare(
        'SELECT ingredients,instructions,excerpt,image FROM recipes WHERE id=?'
      ).bind(row.id).first();

      const sourceIsWikibooks = String(row.source_id || '').startsWith('wikibooks:');
      const imageNeedsFix = badImage(current?.image);

      if (!sourceIsWikibooks && !imageNeedsFix) continue;

      let changed = false;

      if (sourceIsWikibooks) {
        const sourceTitle = row.source_id.slice('wikibooks:'.length);
        const wiki = await fetchWikitext(sourceTitle);

        if (wiki) {
          const recipe = parseRecipe(sourceTitle, wiki);
          if (recipe && !recipe.error && Array.isArray(recipe.ingredients) &&
              recipe.ingredients.length >= 2 && recipe.instructions && recipe.instructions.length >= 80) {

            let currentIngredients = [];
            try { currentIngredients = JSON.parse(current?.ingredients || '[]'); } catch (_) {}

            const normalized = value => JSON.stringify(Array.isArray(value) ? value.map(x => ({
              name: String(x?.name || '').trim(),
              measure: String(x?.measure || '').trim()
            })) : []);

            const malformed = currentIngredients.some(x =>
              String(x?.name || '').length > 120 ||
              /(?:се измиват|се нарязват|се почиства|се разпределя|бурканите се)/i.test(String(x?.name || ''))
            );
            const ingredientsChanged = normalized(currentIngredients) !== normalized(recipe.ingredients);
            const instructionsChanged = String(current?.instructions || '').trim() !== String(recipe.instructions || '').trim();
            const badExcerpt = /(?:продуктите се|чушките се|корнишоните се|лукът се|се измиват|се нарязват)/i.test(String(current?.excerpt || ''));

            if (malformed || ingredientsChanged || instructionsChanged || badExcerpt) {
              const excerpt = 'Домашна рецепта за „' + recipe.title + '“. Подробни продукти и начин на приготвяне от източника в Уикикниги.';
              await env.DB.prepare(
                'UPDATE recipes SET ingredients=?, excerpt=?, instructions=?, time=? WHERE id=?'
              ).bind(JSON.stringify(recipe.ingredients), excerpt, recipe.instructions, recipe.time || null, row.id).run();
              changed = true;
            }
          }
        }
      }

      if (imageNeedsFix) {
        const commonsImage = await findCommonsImage(row.title);
        if (commonsImage) {
          await env.DB.prepare('UPDATE recipes SET image=? WHERE id=?').bind(commonsImage, row.id).run();
          changed = true;
        }
      }

      if (changed) {
        fixed++;
        titles.push(row.title);
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) {
      failed++;
      errors.push(row.title + ': ' + String(err?.message || err));
    }
  }

  const lastRowId = results && results.length ? Number(results[results.length - 1].row_id) : cursor;
  return jsonResponse({
    checked,
    fixed,
    failed,
    titles,
    errors,
    nextRowId: lastRowId,
    hasMore: !!(results && results.length === 50)
  });
}
