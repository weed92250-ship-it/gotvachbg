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
  if (aiResponse.response) return aiResponse.response;
  if (aiResponse.choices && aiResponse.choices[0] && aiResponse.choices[0].message) {
    return aiResponse.choices[0].message.content || '';
  }
  return '';
}

async function translateRecipeWithAI(env, meal, ingredientsEn) {
  const ingredientsListText = ingredientsEn
    .map((i, idx) => `${idx + 1}. ${i.measure || '-'} | ${i.name}`)
    .join('\n');

  const prompt = `Ти си кулинарен преводач и готвач. Преведи следната рецепта от английски на естествен български, използвайки правилни кулинарни термини.

Заглавие: ${meal.strMeal}

Съставки (формат "количество | име"):
${ingredientsListText}

Начин на приготвяне:
${meal.strInstructions}

ВЪРНИ САМО ВАЛИДЕН JSON БЕЗ НИКАКЪВ ДРУГ ТЕКСТ, СИМВОЛИ ИЛИ MARKDOWN CODEBLOCKS. Формат:
{
  "title": "преведеното заглавие на български, изцяло на кирилица",
  "ingredients": [{"measure": "преведено количество", "name": "преведена съставка"}, ...същия брой елементи, същия ред],
  "instructions": "преведените стъпки на български, с нов ред между отделните стъпки"
}`;

  let aiResponse;
  try {
    aiResponse = await env.AI.run('@cf/zai-org/glm-4.7-flash', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      reasoning_effort: 'low',
      chat_template_kwargs: { enable_thinking: false },
    });
  } catch (e) {
    return { title: meal.strMeal, ingredients: ingredientsEn, instructions: meal.strInstructions };
  }

  let rawText = extractResponseText(aiResponse).trim();

  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }

  try {
    const data = JSON.parse(rawText);
    if (data.title && data.instructions && Array.isArray(data.ingredients) && data.ingredients.length === ingredientsEn.length) {
      return data;
    }
  } catch (e) {
    // fallback по-долу
  }

  return { title: meal.strMeal, ingredients: ingredientsEn, instructions: meal.strInstructions };
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
    const translated = await translateRecipeWithAI(env, meal, ingredientsEn);

    const excerpt = translated.instructions.split(/\n+/)[0].slice(0, 160);
    const category = CATEGORY_MAP[meal.strCategory] || meal.strCategory || 'Разни';
    const area = AREA_MAP[meal.strArea] || meal.strArea || 'Международна';

    const id = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    const date = new Date().toISOString().slice(0, 10);

    await env.DB.prepare(
      `INSERT INTO recipes (id, source_id, title, title_en, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
