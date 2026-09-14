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

    const aiResponse = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });

    let rawText = aiResponse.response ? aiResponse.response.trim() : '';
    
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
