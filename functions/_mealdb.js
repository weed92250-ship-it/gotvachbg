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

function extractResponseText(aiResponse) {
  if (typeof aiResponse.response === 'string') {
    return aiResponse.response;
  }
  if (
    aiResponse.choices &&
    aiResponse.choices[0] &&
    aiResponse.choices[0].message &&
    typeof aiResponse.choices[0].message.content === 'string'
  ) {
    return aiResponse.choices[0].message.content;
  }
  if (aiResponse.response && typeof aiResponse.response === 'object') {
    try {
      return JSON.stringify(aiResponse.response);
    } catch (e) {
      return '';
    }
  }
  return '';
}

function hasMixedScriptGlitch(s) {
  if (typeof s !== 'string') return true;
  return /[а-яА-Я][a-zA-Z]|[a-zA-Z][а-яА-Я]/.test(s);
}

function isCleanField(s) {
  if (typeof s !== 'string') return false;
  if (s.includes('|')) return false;
  if (s.trim().length === 0) return false;
  if (hasMixedScriptGlitch(s)) return false;
  const words = s.trim().split(/\s+/);
  if (words.length >= 2 && words[words.length - 1] === words[words.length - 2]) return false;
  return true;
}

function validateTranslation(data, expectedCount) {
  if (!data || typeof data.title !== 'string' || typeof data.instructions !== 'string') return { ok: false, reason: 'missing_fields' };
  if (!Array.isArray(data.ingredients) || data.ingredients.length !== expectedCount) return { ok: false, reason: `ingredients_length_${data.ingredients ? data.ingredients.length : 'none'}_expected_${expectedCount}` };
  if (!isCleanField(data.title)) return { ok: false, reason: 'title_not_clean: ' + data.title };
  if (hasMixedScriptGlitch(data.instructions)) return { ok: false, reason: 'instructions_glitch' };
  for (const ing of data.ingredients) {
    if (!isCleanField(ing.name) || typeof ing.measure !== 'string' || ing.measure.includes('|') || hasMixedScriptGlitch(ing.measure)) {
      return { ok: false, reason: 'ingredient_not_clean: ' + JSON.stringify(ing) };
    }
  }
  return { ok: true };
}

async function translateRecipeWithAI(env, meal, ingredientsEn, debugBucket) {
  const ingredientsListText = ingredientsEn
    .map((i, idx) => `${idx + 1}. ${i.measure || '-'} | ${i.name}`)
    .join('\n');

  const systemPrompt = 'Ти си професионален кулинарен преводач. ТВОЯТА ЗАДАЧА Е ДА ПРЕВЕДЕШ НА БЪЛГАРСКИ ЕЗИК заглавието, всички съставки (имената и мерните единици, напр. tsp->ч.л., tbsp->с.л., cup->чаша, g->г и т.н.) и инструкциите за приготвяне. Не връщай английски текст. Връщай САМО валиден JSON във формат: {"title": "...", "ingredients": [{"measure": "...", "name": "..."}], "instructions": "..."}. Без обяснения, без markdown блокове (без ```json), без коментари.';

  const userPrompt = `Преведи тази рецепта изцяло на български език:

Заглавие: ${meal.strMeal}

Съставки (номер. количество | име):
${ingredientsListText}

Стъпки:
${meal.strInstructions}

Върни точно този JSON формат, нищо друго:
{"title": "...", "ingredients": [{"measure": "...", "name": "..."}], "instructions": "..."}
Полето "ingredients" трябва да съдържа точно ${ingredientsEn.length} елемента, в същия ред.`;

  let aiResponse;
  try {
    aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 3000,
    });
  } catch (e) {
    debugBucket.push({ stage: 'ai_call_error', error: String(e && e.message ? e.message : e) });
    return { title: meal.strMeal, ingredients: ingredientsEn, instructions: meal.strInstructions };
  }

  let rawText = extractResponseText(aiResponse).trim();
  const rawTextOriginal = rawText;
  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    rawText = rawText.slice(firstBrace, lastBrace + 1);
  }

  try {
    const data = JSON.parse(rawText);
    const validation = validateTranslation(data, ingredientsEn.length);
    if (validation.ok) {
      return data;
    }
    debugBucket.push({ stage: 'validation_failed', reason: validation.reason, rawTextSnippet: rawTextOriginal.slice(0, 800) });
  } catch (e) {
    debugBucket.push({ stage: 'json_parse_error', error: String(e && e.message ? e.message : e), rawTextSnippet: rawTextOriginal.slice(0, 800) });
  }

  return { title: meal.strMeal, ingredients: ingredientsEn, instructions: meal.strInstructions };
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
      const translated = await translateRecipeWithAI(env, meal, ingredientsEn, debugBucket);

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
