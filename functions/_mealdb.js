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
    'Ти си кулинарен преводач. Превеждаш заглавия на ястия от английски на български. Ако ястието има традиционно име без директен превод (напр. име на място, диалектен термин), транслитерирай цялото название фонетично на кирилица — НЕ смесвай латиница и кирилица в един и същ отговор. Отговорът трябва да е изцяло на кирилица, без обяснения.',
    `Преведи или транслитерирай изцяло на кирилица заглавието на това ястие. Върни само крайния резултат, нищо друго:\n\n${title}`,
    60
  );
  return result || title;
}

async function translateIngredientPairs(env, pairs) {
  const listText = pairs.map((p, i) => `${i + 1}. ${p.measure || '-'} | ${p.name}`).join('\n');
  const result = await askLLM(
    env,
    'Ти си опитен готвач и преводач, специализиран в кулинарна терминология между английски и български. За всеки ред получаваш "количество | съставка" на английски. Преведи ПЪЛНОСТЮ и двете части на български — числата остават както са, но всички думи (включително описания като "finely sliced", "chopped", "clove") се превеждат точно, без нито една останала английска дума. Използвай правилни български кулинарни термини (напр. "cornstarch" = "царевично нишесте", "soy sauce" = "соев сос", "garlic clove" = "скilka чесън", "scallions" = "пролетен лук").',
    `Преведи следните редове по формàта "количество | съставка", запазвайки същия формат и брой редове. Върни само преведените редове, без номерация, без обяснения:\n\n${listText}`,
    600
  );

  const lines = result.split('\n').map(l => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
  if (lines.length === pairs.length) {
    return lines.map((line, idx) => {
      const [measure, name] = line.split('|').map(s => (s || '').trim());
      return { measure: measure || pairs[idx].measure, name: name || pairs[idx].name };
    });
  }

  const fallback = [];
  for (const p of pairs) {
    const single = await askLLM(
      env,
      'Ти си кулинарен преводач. Преведи "количество | съставка" изцяло на български, запазвайки числата, но превеждайки всички думи. Върни само превода в същия формат.',
      `${p.measure || '-'} | ${p.name}`,
      30
    );
    const [measure, name] = single.split('|').map(s => (s || '').trim());
    fallback.push({ measure: measure || p.measure, name: name || p.name });
  }
  return fallback;
}

async function translateInstructions(env, instructionsEn) {
  const result = await askLLM(
    env,
    'Ти си професионален кулинарен преводач. Превеждаш рецепти от английски на естествен, гладък български, запазвайки структурата на стъпките. Не оставяй нито една английска дума в отговора.',
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
    const ingredientsBg = await translateIngredientPairs(env, ingredientsEn);

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
