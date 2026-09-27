import { jsonResponse, checkAuth, unauthorized } from '../_utils.js';

function extractText(aiResponse) {
  if (typeof aiResponse?.response === 'string') return aiResponse.response;
  if (typeof aiResponse?.choices?.[0]?.message?.content === 'string') return aiResponse.choices[0].message.content;
  return '';
}

async function findCommonsImage(title) {
  try {
    const data = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ action:'query', generator:'search', gsrsearch:title+' food', gsrnamespace:'6', gsrlimit:'1', prop:'imageinfo', iiprop:'url', iiurlwidth:'1200', format:'json', origin:'*' }), { headers:{'user-agent':'GotvachBG/1.0 (recipe enrichment)'} }).then(r=>r.json());
    const page = Object.values(data?.query?.pages || {})[0];
    if (page?.title?.startsWith('File:')) return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(page.title.slice(5)) + '?width=1200';
  } catch (_) {}
  return null;
}

async function enrichOne(env, row) {
  const ingredients = JSON.parse(row.ingredients || '[]');
  const prompt = 'Разшири тази българска рецепта за сайт за домашно готвене. Запази абсолютно всички съществуващи количества, съставки и факти. Не измисляй нови съставки или количества. Пиши естествен, подробен български текст.\n\n' +
    'Заглавие: ' + row.title + '\nСъставки: ' + JSON.stringify(ingredients) + '\nСъществуващ начин на приготвяне: ' + row.instructions + '\n\n' +
    'Върни САМО JSON: {"excerpt":"кратко апетитно описание","instructions":"дълъг структуриран текст с въведение, подробни стъпки, полезни съвети и сервиране"}. ' +
    'instructions трябва да е поне 900 знака. Не твърди, че авторът лично е готвил. Не измисляй хранителни стойности. Запази оригиналните действия и количества. Използвай празен ред между абзаците.';
  const ai = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages:[{role:'system',content:'Ти си български кулинарен редактор. Пиши естествено и конкретно. Връщай само валиден JSON.'},{role:'user',content:prompt}], max_tokens:3500 });
  let raw = extractText(ai).trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
  const a=raw.indexOf('{'), b=raw.lastIndexOf('}');
  if (a<0 || b<a) throw new Error('AI не върна JSON');
  const data=JSON.parse(raw.slice(a,b+1));
  if (!data.instructions || String(data.instructions).length<900) throw new Error('Текстът е твърде кратък');
  const image=row.image || await findCommonsImage(row.title);
  await env.DB.prepare('UPDATE recipes SET excerpt=?, instructions=?, image=? WHERE id=?').bind(String(data.excerpt || row.excerpt).slice(0,500),String(data.instructions),image,row.id).run();
}

export async function onRequestPost({ request, env }) {
  if (!(await checkAuth(request, env))) return unauthorized();
  const { results } = await env.DB.prepare("SELECT id,title,excerpt,ingredients,instructions,image FROM recipes WHERE source_id LIKE 'wikibooks:%' AND id NOT LIKE 'editorial-%' AND (instructions IS NULL OR length(instructions) < 900 OR image IS NULL) ORDER BY rowid ASC LIMIT 5").all();
  let updated=0, failed=0; const errors=[];
  for (const row of results || []) { try { await enrichOne(env,row); updated++; } catch(err) { failed++; errors.push(row.title+': '+String(err?.message || err)); } }
  return jsonResponse({checked:results?.length||0,updated,failed,errors});
}
