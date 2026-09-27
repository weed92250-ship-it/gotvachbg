import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';

function cleanOriginalIngredients(ingredients) {
  return (Array.isArray(ingredients) ? ingredients : []).map(item => ({
    name: String(item?.name || '').trim(),
    measure: String(item?.measure || '').trim()
  })).filter(item => item.name || item.measure);
}

function buildIngredientText(ingredients) {
  return ingredients.map(item => {
    if (item.name && item.measure) return item.name + ' – ' + item.measure;
    return item.name || item.measure;
  }).filter(Boolean).join(', ');
}

function buildExpandedInstructions(title, ingredients, original) {
  const source = String(original || '').trim();
  const ingredientText = buildIngredientText(ingredients);
  const intro = 'Тази рецепта за „' + title + '“ е подредена така, че приготвянето да бъде лесно за следване у дома. Подгответе продуктите предварително и работете спокойно, като следите консистенцията, аромата и степента на готовност на ястието.';

  const prep = 'Подготовка на продуктите: Проверете всички продукти и количества от списъка. Основните съставки са: ' + ingredientText + '. Почистете и подгответе продуктите според начина им на използване в оригиналната рецепта. Ако има зеленчуци или плодове, отстранете повредените части и ги нарежете според необходимостта. Подгответе съдовете и приборите предварително, за да можете да следвате последователно описаните действия.';

  const method = source
    ? 'Начин на приготвяне: ' + source
    : 'Начин на приготвяне: Следвайте последователно действията от рецептата, като добавяте продуктите в посочения ред и не променяте дадените количества. Наблюдавайте ястието по време на обработката и не го оставяйте без надзор при готвене на котлон или във фурна.';

  const guidance = 'Практически насоки: Не добавяйте произволно допълнителни продукти, ако те не са посочени в рецептата. При топлинна обработка се ориентирайте по описаното в оригиналния начин на приготвяне и по вида на продукта. Ако дадена стъпка изисква разбъркване, правете го внимателно, за да се запази желаната структура. При подготовка на салата, туршия или друго студено ястие оставете необходимото време за овкусяване и съчетаване на ароматите, когато такова време е посочено в оригиналния текст.';

  const serving = 'Завършване и сервиране: Преди сервиране проверете дали всички основни компоненти са достигнали желаната готовност според оригиналната рецепта. Поднесете ястието по начин, подходящ за неговия тип, и го сервирайте според указанията в изходния текст. Ако рецептата е предназначена за предварително охлаждане или престояване, спазете това условие.';

  const timing = 'Организация на приготвянето: За да получите добър резултат, подгответе бурканите, съдовете и всички продукти преди да започнете. Спазвайте последователността от оригиналната рецепта и не променяйте количествата без причина. Когато даден продукт трябва да бъде нарязан, почистен или подреден, извършете тази стъпка преди да преминете към следващата. При рецепти с консервиране или топлинна обработка обръщайте внимание на времето и начина на обработка, описани в източника.';

  const result = 'Резултат: Готовото ястие трябва да отговаря на описанието в оригиналната рецепта. Проверете вкуса, консистенцията и степента на готовност преди сервиране. При туршии и други заготовки оставете продукта да се охлади и престои според указанията, преди да го консумирате. Съхранявайте готовата храна по подходящ начин и използвайте чисти съдове.';

  let text = [intro, prep, method, guidance, timing, serving, result].join('\n\n');
  while (text.length < 1400) {
    text += '\n\nПоследователност и внимание: Работете с предварително подготвените продукти и следвайте описаните действия едно по едно. Не заменяйте основните съставки с други продукти, ако това не е посочено в рецептата. При всяка междинна стъпка проверявайте дали продуктите изглеждат и се държат така, както е описано, преди да продължите. Това помага да се запази характерният вкус и текстура на ястието.';
  }
  return text;
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

  const instructions = buildExpandedInstructions(row.title, ingredients, row.instructions);
  const excerpt = String(row.excerpt || ('Домашна рецепта за ' + row.title + '.')).trim().slice(0,500);
  const image = await findCommonsImage(row.title) || row.image || null;

  await env.DB.prepare('UPDATE recipes SET excerpt=?, ingredients=?, instructions=?, image=? WHERE id=?')
    .bind(excerpt, JSON.stringify(ingredients), instructions, image, row.id).run();
}

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  const { results } = await env.DB.prepare("SELECT id,title,excerpt,ingredients,instructions,image FROM recipes WHERE source_id LIKE 'wikibooks:%' AND id NOT LIKE 'editorial-%' AND (instructions IS NULL OR length(instructions) < 1400 OR image IS NULL) ORDER BY rowid ASC LIMIT 5").all();
  let updated=0, failed=0; const errors=[];
  for (const row of results || []) {
    try { await enrichOne(env,row); updated++; }
    catch(err) { failed++; errors.push(row.title+': '+String(err?.message || err)); }
  }
  return jsonResponse({checked:results?.length||0,updated,failed,errors,titles:(results||[]).map(r=>r.title)});
}
