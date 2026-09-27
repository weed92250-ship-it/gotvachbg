import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';
import { fetchWikitext, parseRecipe, findCommonsImage } from '../_wikibooks.js';

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();

  const { results } = await env.DB.prepare(
    "SELECT id,source_id,title FROM recipes WHERE source_id LIKE 'wikibooks:%' AND id NOT LIKE 'editorial-%' ORDER BY rowid ASC LIMIT 50"
  ).all();

  let checked=0,fixed=0,failed=0;
  const errors=[],titles=[];

  for (const row of results || []) {
    checked++;
    try {
      const sourceTitle = row.source_id.slice('wikibooks:'.length);
      const wiki = await fetchWikitext(sourceTitle);
      if (!wiki) continue;
      const recipe = parseRecipe(sourceTitle, wiki);
      if (!recipe || recipe.error || !Array.isArray(recipe.ingredients) || recipe.ingredients.length < 2 || !recipe.instructions || recipe.instructions.length < 80) continue;

      const ingredientsJson = JSON.stringify(recipe.ingredients);
      const current = await env.DB.prepare('SELECT ingredients,instructions,excerpt,image FROM recipes WHERE id=?').bind(row.id).first();
      let malformed=false;
      try {
        const currentIngredients=JSON.parse(current?.ingredients || '[]');
        malformed=currentIngredients.some(x => String(x?.name||'').length > 120 || /(?:се измиват|се нарязват|се почиства|се разпределя|бурканите се)/i.test(String(x?.name||'')));
      } catch (_) { malformed=true; }

      const badExcerpt = /(?:продуктите се|чушките се|корнишоните се|лукът се|се измиват|се нарязват)/i.test(String(current?.excerpt || ''));
      const isDefaultImage = String(current?.image || '').includes('photo-1546069901-ba9599a7e63c');
      const needsRefresh = malformed || badExcerpt || !current?.image || isDefaultImage;
      if (!needsRefresh) continue;

      const commonsImage = await findCommonsImage(recipe.title);
      const fallbackImages = {
        'Люта туршия': 'https://images.unsplash.com/photo-1562346816-9d0bdd559ec1?auto=format&fit=crop&w=1200&q=85'
      };
      const image = commonsImage || fallbackImages[recipe.title] || current?.image || null;
      const excerpt = 'Домашна рецепта за „' + recipe.title + '“. Подробни продукти и начин на приготвяне от източника в Уикикниги.';
      await env.DB.prepare('UPDATE recipes SET ingredients=?, excerpt=?, instructions=?, time=?, image=? WHERE id=?')
        .bind(ingredientsJson, excerpt, recipe.instructions, recipe.time || null, image || null, row.id).run();
      fixed++;
      titles.push(row.title);
      await new Promise(r=>setTimeout(r,150));
    } catch (err) {
      failed++;
      errors.push(row.title+': '+String(err?.message||err));
    }
  }

  return jsonResponse({checked,fixed,failed,titles,errors});
}
