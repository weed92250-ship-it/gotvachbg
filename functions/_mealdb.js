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

const SUSPICIOUS_MEASURE_WORDS = new Set([
  'зрънце', 'зрънца', 'хапка', 'хапки', 'капка', 'капки', 'частица', 'частици', 'кичур', 'кичури',
]);

function isSuspiciousMeasure(measure) {
  if (typeof measure !== 'string') return true;
  const trimmed = measure.trim().toLowerCase();
  if (trimmed.length === 0) return false;
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && SUSPICIOUS_MEASURE_WORDS.has(words[0])) return true;
  return false;
}

function countByKey(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function hasExcessDuplicateNames(originalIngredients, translatedIngredients) {
  const originalCounts = countByKey(originalIngredients, i => i.name.trim().toLowerCase());
  const translatedCounts = countByKey(translatedIngredients, i => (i.name || '').trim().toLowerCase());

  const maxOriginalDuplicate = Math.max(0, ...Array.from(originalCounts.values()));
  const maxTranslatedDuplicate = Math.max(0, ...Array.from(translatedCounts.values()));

  return maxTranslatedDuplicate > Math.max(1, maxOriginalDuplicate);
}

// Известни грешни/безсмислени преводи на готварски глаголи, които вече сме засичали
// в реални рецепти (напр. "търбуха" вместо "къкри" за "simmer"). Списъкът расте с времето.
const BAD_INSTRUCTION_WORDS = [
  'търбух', 'търбуха', 'търбухат', // грешен превод на "simmer"
];

function hasBadInstructionWords(s) {
  if (typeof s !== 'string') return false;
  const lower = s.toLowerCase();
  return BAD_INSTRUCTION_WORDS.some(w => lower.includes(w));
}

function validateTranslation(data, ingredientsEn) {
  const expectedCount = ingredientsEn.length;
  if (!data || typeof data.title !== 'string' || typeof data.instructions !== 'string') return false;
  if (!Array.isArray(data.ingredients) || data.ingredients.length !== expectedCount) return false;
  if (!isCleanField(data.title)) return false;
  if (hasMixedScriptGlitch(data.instructions)) return false;
  if (hasBadInstructionWords(data.instructions)) return false;

  for (const ing of data.ingredients) {
    if (!isCleanField(ing.name) || typeof ing.measure !== 'string' || ing.measure.includes('|') || hasMixedScriptGlitch(ing.measure)) return false;
    if (isSuspiciousMeasure(ing.measure)) return false;
  }

  if (hasExcessDuplicateNames(ingredientsEn, data.ingredients)) return false;

  return true;
}

const MEASURE_GLOSSARY = `Речник на мерни единици (превеждай със СЪЩИТЕ стандартни думи, никога не измисляй нови):
- teaspoon/tsp -> чаена лъжичка
- tablespoon/tbsp -> супена лъжица
- cup -> чаша
- clove (garlic) -> скилидка
- slice -> резен
- pinch -> щипка
- can/tin -> консервена кутия
- ounce/oz -> унция
- pound/lb -> паунд
- gram/g -> грам
- pack/packet -> пакет
- bunch -> връзка
- handful -> шепа
- to taste -> на вкус
- breadcrumbs -> галета / панировъчни трохи
- large/small/medium (за яйца, глави лук и т.н.) -> голям(а)/малък(ка)/среден(на)
НИКОГА не превеждай мерна единица с думи като "зрънце", "хапка", "капка", "частица" — те не са реални мерни единици в българската кухня.`;

const INGREDIENT_GLOSSARY = `Речник на съставки, които лесно се превеждат грешно (използвай ТОЧНО тези преводи):
- plantain -> зелен банан (плантайн) — НИКОГА само "банан", тъй като обикновен сладък банан не става за готвене по този начин
- callaloo -> калалу (листни зеленчуци) — ако няма точен превод, остави "калалу" транслитерирано, не измисляй заместител
- scotch bonnet pepper -> чушка "scotch bonnet" (много лют вид чушка) — не превеждай като обикновена чушка или чили, уточни че е специфично лют вид
- collard greens -> колар зеле (листно зеле)
- okra -> бамя
- yam -> игнам (сладък картоф не е точен превод)
- chickpeas -> нахут
- coriander/cilantro -> кориандър (пресен)
- self-raising flour -> брашно с бакпулвер (не обикновено брашно)
- caster sugar -> пудра захар за печене (по-фина от обикновена захар)
Ако срещнеш съставка, която не е в този речник и нямаш сигурен български еквивалент, транслитерирай името вместо да измисляш грешен превод.`;

const VERB_GLOSSARY = `Речник на готварски глаголи/действия (превеждай със СЪЩИТЕ стандартни думи):
- simmer -> оставете да къкри / на слаб огън (НИКОГА "търбуха" — това не е глагол в българския)
- sauté/fry gently -> запържете леко
- whisk -> разбийте (с тел)
- fold in -> внимателно вмесете
- marinate -> мариновайте
- blanch -> бланширайте
- reduce (sauce) -> сгъстете/намалете (соса)
- season -> подправете
- drain -> отцедете
- preheat -> загрейте предварително
- bring to a boil -> доведете до кипене
- garnish -> украсете/гарнирайте
Използвай само реално съществуващи български глаголи — никога не измисляй нова дума, която звучи подобно на оригинала.`;

async function translateRecipeWithAI(env, meal, ingredientsEn, attemptFeedback) {
  const ingredientsListText = ingredientsEn
    .map((i, idx) => `${idx + 1}. ${i.measure || '-'} | ${i.name}`)
    .join('\n');

  const systemPrompt = `Ти си точен кулинарен преводач. Превеждаш рецепти от английски на български. Връщаш САМО валиден JSON, без markdown, без обяснения, без допълнителни изречения извън заявените полета. Никога не удвояваш думи, не смесваш латински и кирилски букви в една дума, и не добавяш собствени коментари или поздрави. Използвай точна българска кулинарна терминология.

${MEASURE_GLOSSARY}

${INGREDIENT_GLOSSARY}

${VERB_GLOSSARY}

Правила за съставките:
- Превеждай всяка съставка отделно и точно според оригиналното ѝ значение — никога не давай на две различни съставки един и същ превод, освен ако наистина означават едно и също нещо.
- Запази реда и броя на съставките идентични с оригинала.
- Полето "measure" трябва да съдържа число (или "на вкус"/празен низ) плюс мерна единица от речника по-горе — никога само измислена дума.

Правила за стъпките (instructions):
- Ако рецептата съдържа няколко логически различни части (напр. приготвяне на основното ястие И отделно приготвяне на гарнитура/добавка), раздели ги на ясни абзаци с празен ред между тях, за да не изглеждат като един объркан текст.
- Запази всички детайли от оригинала — не съкращавай и не пропускай стъпки, само структурирай по-четимо.`;

  const feedbackBlock = attemptFeedback
    ? `\n\nВАЖНО: Предишният ти опит беше отхвърлен, защото съдържаше грешка от този вид: ${attemptFeedback}. Моля, поправи това и бъди по-прецизен, особено с мерните единици и уникалността на всяка съставка.`
    : '';

  const userPrompt = `Преведи тази рецепта на български:

Заглавие: ${meal.strMeal}

Съставки (номер. количество | име):
${ingredientsListText}

Стъпки:
${meal.strInstructions}

Върни точно този JSON формат, нищо друго:
{"title": "...", "ingredients": [{"measure": "...", "name": "..."}], "instructions": "..."}
Полето "ingredients" трябва да съдържа точно ${ingredientsEn.length} елемента, в същия ред.${feedbackBlock}`;

  let aiResponse;
  try {
    aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 6000,
    });
  } catch (e) {
    return null;
  }

  let rawText = extractResponseText(aiResponse).trim();
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
    if (validateTranslation(data, ingredientsEn)) {
      return data;
    }
  } catch (e) {
    // невалиден JSON, ще опитаме пак или ще паднем към fallback
  }

  return null;
}

async function translateRecipeWithRetry(env, meal, ingredientsEn) {
  let data = await translateRecipeWithAI(env, meal, ingredientsEn);
  if (data) return data;

  data = await translateRecipeWithAI(
    env,
    meal,
    ingredientsEn,
    'измислени мерни думи (напр. "зрънце"/"хапка"/"капка") или еднакъв превод за различни съставки, или грешен превод на екзотична съставка (напр. "plantain" преведено просто като "банан"), или измислен несъществуващ глагол в стъпките (напр. "търбуха" вместо "къкри")'
  );
  if (data) return data;

  return { title: meal.strMeal, ingredients: ingredientsEn, instructions: meal.strInstructions };
}

// Намира вече публикувани рецепти, при които преводът е паднал (заглавието е
// идентично с оригиналното английско заглавие, т.е. запазен е fallback-ът),
// и опитва да ги преведе наново с подобрената логика — без да губи
// снимка/youtube линк/дата на публикуване.
export async function retranslateFailedRecipes(env, limit = 20) {
  const { results } = await env.DB.prepare(
    'SELECT id, title, title_en, ingredients, instructions FROM recipes WHERE title = title_en LIMIT ?'
  )
    .bind(limit)
    .all();

  let fixed = 0;
  let stillFailing = 0;
  const errors = [];

  for (const row of results || []) {
    try {
      let ingredientsEn;
      try {
        ingredientsEn = JSON.parse(row.ingredients || '[]');
      } catch (e) {
        ingredientsEn = [];
      }
      if (!Array.isArray(ingredientsEn) || ingredientsEn.length === 0) {
        errors.push(`${row.id}: липсват съставки за повторен превод`);
        continue;
      }

      const pseudoMeal = { strMeal: row.title_en, strInstructions: row.instructions };
      const translated = await translateRecipeWithRetry(env, pseudoMeal, ingredientsEn);

      // Ако translated.title все още съвпада с оригинала, значи и двата опита са паднали пак.
      if (translated.title === row.title_en) {
        stillFailing++;
        continue;
      }

      const excerpt = translated.instructions.split(/\n+/)[0].slice(0, 160);
      await env.DB.prepare(
        'UPDATE recipes SET title = ?, excerpt = ?, ingredients = ?, instructions = ? WHERE id = ?'
      )
        .bind(
          translated.title, excerpt, JSON.stringify(translated.ingredients),
          translated.instructions, row.id
        )
        .run();

      fixed++;
    } catch (err) {
      errors.push(`${row.id}: ${String(err && err.message ? err.message : err)}`);
    }
  }

  return { checked: (results || []).length, fixed, stillFailing, errors };
}

async function fetchRandomMeal() {
  const res = await fetch(`${MEALDB_BASE}/random.php`);
  if (!res.ok) throw new Error('TheMealDB заявката се провали: ' + res.status);
  const data = await res.json();
  return data.meals && data.meals[0];
}

export async function runDailyImport(env) {
  const targetCount = 3 + Math.floor(Math.random() * 3);
  let added = 0;
  let attempts = 0;
  const maxAttempts = targetCount * 6;
  const errors = [];

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
      const translated = await translateRecipeWithRetry(env, meal, ingredientsEn);

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

  return { added, attempts, errors };
}
