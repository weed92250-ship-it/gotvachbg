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

async function askLLM(env, systemPrompt, userPrompt, maxTokens = 800) {
  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    });
    return (response.response || '').trim();
  } catch (e) {
    return '';
  }
}

async function translateTitle(env, title) {
  const result = await askLLM(
    env,
    'Ти си кулинарен преводач. Превеждаш само заглавия на ястия от английски на естествен български, кратко и точно, без обяснения.',
    `Преведи заглавието на това ястие на български, върни само превода, нищо друго:\n\n${title}`,
    60
  );
  return result || title;
}

async function translateIngredients(env, ingredientNames) {
  const listText = ingredientNames.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const result = await askLLM(
    env,
    'Ти си опитен готвач и преводач, специализиран в кулинарна терминология между английски и български. Превеждаш списъци със съставки точно и с правилните български кулинарни термини (напр. "cornstarch" = "царевично нишесте", "soy sauce" = "соев сос", "sesame oil" = "сусамово масло", "scallions" = "пролетен лук", "five-spice powder" = "подправка петте аромата").',
    `Преведи следния списък от съставки на български. Върни точно толкова редове, колкото са в оригинала, по един превод на ред, само превода без номерация и без допълнителен текст:\n\n${listText}`,
    500
  );

  const lines = result.split('\n').map(l => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
  if (lines.length === ingredientNames.length) {
    return lines;
  }
  const fallback = [];
  for (const name of ingredientNames) {
    const single = await askLLM(
      env,
      'Ти си кулинарен преводач. Превеждаш имена на хранителни съставки от английски на български, кратко и точно.',
      `Преведи на български само тази съставка, без обяснения: ${name}`,
      20
    );
    fallback.push(single || name);
  }
  return fallback;
}

async function translateInstructions(env, instructionsEn) {
  const result = await askLLM(
    env,
    'Ти си професионален кулинарен преводач. Превеждаш рецепти от английски на естествен, гладък български, запазвайки структурата на стъпките.',
    `Преведи следната рецепта на български, запазвайки абзаците (нов ред между отделните стъпки). Върни само превода, без обяснения:\n\n${instructionsEn}`,
    1200
  );
  return result || instructionsEn;
}

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

async function fetchRandomMeal() {
  const res = await fetch(`${MEALDB_BASE}/random.php`);
  const data = await res.json();
  return data.meals && data.meals[0];
}

export async function runDailyImport(env) {
  const targetCount = 3 + Math.floor(Math.random() * 3);
  let added = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 5;

  while (added < targetCount && attempts < maxAttempts) {
    attempts++;
    const meal = await fetchRandomMeal();
    if (!meal) continue;

    const existing = await env.DB.prepare('SELECT id FROM recipes WHERE source_id = ?')
      .bind(meal.idMeal)
      .first();
    if (existing) continue;

    const ingredientsEn = extractIngredients(meal);
    const dietTags = computeDietTags(ingredientsEn);

    const titleBg = await translateTitle(env, meal.strMeal);
    const instructionsBg = await translateInstructions(env, meal.strInstructions || '');
    const namesBg = await translateIngredients(env, ingredientsEn.map(i => i.name));
    const ingredientsBg = ingredientsEn.map((ing, idx) => ({
      name: namesBg[idx] || ing.name,
      measure: ing.measure,
    }));

    const excerpt = instructionsBg.split(/\n+/)[0].slice(0, 160);
    const category = CATEGORY_MAP[meal.strCategory] || meal.strCategory || 'Разни';
    const area = AREA_MAP[meal.strArea] || meal.strArea || 'Международна';

    const id = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    const date = new Date().toISOString().slice(0, 10);

    await env.DB.prepare(
      `INSERT INTO recipes (id, source_id, title, title_en, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id, meal.idMeal, titleBg, meal.strMeal, excerpt,
        JSON.stringify(ingredientsBg), instructionsBg, category, area,
        dietTags.join(','), meal.strMealThumb || null, meal.strYoutube || null,
        'Готвач БГ', date, 0
      )
      .run();

    added++;
  }

  return { added, attempts };
}
