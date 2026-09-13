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

async function translateText(env, text, targetLang = 'bulgarian') {
  if (!text || !text.trim()) return text;
  try {
    const result = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: text.slice(0, 900),
      source_lang: 'english',
      target_lang: targetLang,
    });
    return result.translated_text || text;
  } catch (e) {
    return text;
  }
}

async function translateLong(env, text) {
  const parts = text.split(/\r?\n+/).filter(Boolean);
  const translated = [];
  for (const part of parts) {
    translated.push(await translateText(env, part));
  }
  return translated.join('\n\n');
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

    const titleBg = await translateText(env, meal.strMeal);
    const instructionsBg = await translateLong(env, meal.strInstructions || '');
    const ingredientsBg = [];
    for (const ing of ingredientsEn) {
      const nameBg = await translateText(env, ing.name);
      ingredientsBg.push({ name: nameBg, measure: ing.measure });
    }

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
