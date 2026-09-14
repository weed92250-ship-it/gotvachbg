const MEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

const CATEGORY_MAP = {
  'Beef': 'Телешко', 'Breakfast': 'Закуска', 'Chicken': 'Пилешко',
  'Dessert': 'Десерт', 'Goat': 'Козе месо', 'Lamb': 'Агнешко',
  'Miscellaneous': 'Разни', 'Pasta': 'Паста', 'Pork': 'Свинско',
  'Seafood': 'Морски дарове', 'Side': 'Гарнитура', 'Starter': 'Предястие',
  'Vegan': 'Веган', 'Vegetarian': 'Вегетарианско',
};

const AREA_MAP = {
  'American': 'Американска', 'British': 'Британска', 'Canadian': 'Канадска',
  'Chinese': 'Китайска', 'Croatian': 'Хърватска', 'Dutch': 'Холандска',
  'Netherlands': 'Холандска',
  'Egyptian': 'Египетска', 'French': 'Френска', 'Greek': 'Гръцка',
  'Indian': 'Индийска', 'Irish': 'Ирландска', 'Italian': 'Италианска',
  'Jamaican': 'Ямайска', 'Japanese': 'Японска', 'Kenyan': 'Кенийска',
  'Malaysian': 'Малайзийска', 'Mexican': 'Мексиканска', 'Moroccan': 'Мароканска',
  'Polish': 'Полска', 'Portuguese': 'Португалска', 'Russian': 'Руска',
  'Spanish': 'Испанска', 'Thai': 'Тайландска', 'Tunisian': 'Тунизийска',
  'Turkish': 'Турска', 'Ukrainian': 'Украинска', 'Uruguayan': 'Уругвайска',
  'Vietnamese': 'Виетнамска',
};

const MEAT_KEYWORDS = ['chicken','beef','pork','lamb','bacon','sausage','turkey','duck','fish','shrimp','prawn','salmon','tuna','anchov','crab','lobster','ham','veal','venison','mince'];
const SUGAR_KEYWORDS = ['sugar','honey','syrup','chocolate','caramel','condensed milk'];
const HIGH_CARB_KEYWORDS = ['flour','bread','pasta','rice','potato','sugar','oats','oatmeal','corn','tortilla','noodle'];

function extractIngredients(meal) {
  const list = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      list.push({ name: name.trim(), measure: (measure || '').trim() });
    }
  }
  return list;
}

function computeDietTags(ingredients) {
  const names = ingredients.map(i => i.name.toLowerCase()).join(' ');
  const tags = [];
  const hasMeat = MEAT_KEYWORDS.some(k => names.includes(k));
  const hasSugar = SUGAR_KEYWORDS.some(k => names.includes(k));
  const hasHighCarb = HIGH_CARB_KEYWORDS.some(k => names.includes(k));
  if (!hasMeat) tags.push('вегетарианско');
  if (!hasSugar) tags.push('без захар');
  if (!hasHighCarb) tags.push('кето');
  return tags;
}

async function translateRecipeWithWorkersAI(env, meal, ingredientsEn, debugBucket) {
  const ingredientsListText = ingredientsEn
    .map((i, idx) => `${idx + 1}. ${i.measure || '-'} | ${i.name}`)
    .join('\n');

  const prompt = `Ти си професионален кулинарен преводач. Превеждай рецепти от английски на чист български език (заглавие, мерни единици като tsp->ч.л., tbsp->с.л., cup->чаша, g->г, съставки и инструкции).

Заглавие: ${meal.strMeal}

Съставки (номер. количество | име):
${ingredientsListText}

Стъпки за приготвяне:
${meal.strInstructions}

ВЪРНИ САМО ВАЛИДЕН JSON БЕЗ НИКАКЪВ ДРУГ ТЕКСТ ИЛИ MARKDOWN BLOCK.
Формат:
{
  "title": "Преведено заглавие на български",
  "ingredients": [
    {"measure": "преведено количество", "name": "преведено име на съставка"}
  ],
  "instructions": "Преведени стъпки за приготвяне..."
}
Полето "ingredients" трябва да съдържа точно ${ingredientsEn.length} елемента, в същия ред.`;

  try {
    if (!env.AI) throw new Error('Cloudflare Workers AI (env.AI) is not bound');

    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });

    let rawText = aiResponse.response ? aiResponse.response.trim() : '';
    
    // Изчистване на евентуални markdown блокове
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(rawText);
    if (!parsed.title || !Array.isArray(parsed.ingredients) || !parsed.instructions) {
      throw new Error('Invalid JSON structure from Workers AI');
    }

    return parsed;
  } catch (e) {
    debugBucket.push({ stage: 'workers_ai_translation_error', error: String(e.message || e) });
    return { title: meal.strMeal, ingredients: ingredientsEn, instructions: meal.strInstructions };
  }
}

async function fetchRandomMeal() {
  const res = await fetch(`${MEALDB_BASE}/random.php`);
  if (!res.ok) throw new Error('TheMealDB заявката се провали: ' + res.status);
  const data = await res.json();
  return data.meals && data.meals[0];
}

export async function runDailyImport(env) {
  const targetCount = 2;
  let added = 0;
  let attempts = 0;
  const maxAttempts = 3;
  const errors = [];
  const debugBucket = [];

  while (added < targetCount && attempts < maxAttempts) {
    attempts++;
    try {
      const meal = await fetchRandomMeal();
      if (!meal) continue;

      const existing = await env.DB.prepare('SELECT id FROM recipes WHERE source_id = ?')
        .bind(meal.idMeal)
        .first();
      if (existing) continue;

      const ingredientsEn = extractIngredients(meal);
      const dietTags = computeDietTags(ingredientsEn);
      
      const translated = await translateRecipeWithWorkersAI(env, meal, ingredientsEn, debugBucket);

      const excerpt = translated.instructions.split(/\n+/)[0].slice(0, 160);
      const category = CATEGORY_MAP[meal.strCategory] || meal.strCategory || 'Разни';
      const area = AREA_MAP[meal.strArea] || meal.strArea || 'Международна';

      const id = 'r' + Date.now() + Math.floor(Math.random() * 1000);
      const date = new Date().toISOString().slice(0, 10);

      await env.DB.prepare(
        `INSERT INTO recipes (id, source_id, title, title_en, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id, meal.idMeal, translated.title, meal.strMeal, excerpt,
          JSON.stringify(translated.ingredients), translated.instructions, category, area,
          dietTags.join(','), meal.strMealThumb || null, meal.strYoutube || null,
          'Готвач БГ', date, 0
        )
        .run();

      added++;
    } catch (err) {
      errors.push(String(err && err.message ? err.message : err));
    }
  }

  return { added, attempts, errors, debugBucket };
}
