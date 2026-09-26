const API = 'https://bg.wikibooks.org/w/api.php';
const INDEX_TITLE = 'Готварска книга: Рецепти';
const SOURCE_PREFIX = 'wikibooks:';
const SOURCE_LICENSE = 'CC BY-SA';
const SOURCE_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
const SOURCE_BASE = 'https://bg.wikibooks.org/wiki/';

function cleanWikiText(value) {
  return String(value || '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionBetween(wikitext, startNames, endNames) {
  const starts = startNames.join('|');
  const ends = endNames.join('|');
  const re = new RegExp('^=+\\s*(?:' + starts + ')\\s*=+\\s*\\n([\\s\\S]*?)(?=^=+\\s*(?:' + ends + ')\\s*=+|$)', 'im');
  const m = wikitext.match(re);
  return m ? m[1] : '';
}

function parseIngredients(section) {
  const ingredients = [];
  for (const raw of section.split(/\r?\n/)) {
    if (!/^\s*\*+\s+/.test(raw)) continue;
    let value = cleanWikiText(raw.replace(/^\s*\*+\s+/, ''));
    if (!value) continue;
    if (/^за\s+.+:\s*$/i.test(value)) continue;
    if (/^необходими продукти:?$/i.test(value)) continue;
    value = value.replace(/[;]+$/, '').trim();
    let measure = '';
    let name = value;

    const dash = value.match(/^(.+?)\s+[–—-]\s+(.+)$/);
    if (dash) {
      measure = dash[1].trim();
      name = dash[2].trim();
    } else {
      const leading = value.match(/^((?:около\s+)?(?:\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|половин|половина|няколко|една|един|едно)(?:\s+[^,;]+?){0,3})\s+(.+)$/i);
      if (leading) {
        measure = leading[1].trim();
        name = leading[2].trim();
      }
    }
    if (name && name.length > 1) ingredients.push({ name, measure });
  }
  return ingredients;
}

function parseTime(wikitext) {
  const m = wikitext.match(/^\s*време\s*:\s*\|?\s*([^\n|]+)?/im);
  const value = m && m[1] ? cleanWikiText(m[1]) : '';
  return value && !/^X+|^$/i.test(value) ? value : '';
}

function parseRecipe(title, wikitext) {
  const ingredientsSection = sectionBetween(
    wikitext,
    ['Продукти', 'Необходими продукти'],
    ['Приготвяне', 'Начин на приготвяне', 'Източници', 'Други', 'Бележка', 'Забележка']
  );
  const prepSection = sectionBetween(
    wikitext,
    ['Приготвяне', 'Начин на приготвяне'],
    ['Източници', 'Други', 'Бележка', 'Забележка']
  );
  const ingredients = parseIngredients(ingredientsSection);
  const instructions = cleanWikiText(prepSection)
    .replace(/\^\{[^}]*\}/g, '')
    .replace(/\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (ingredients.length < 2 || instructions.length < 80) return null;

  return {
    title: title.replace(/^Готварска книга:\s*/i, '').trim(),
    ingredients,
    instructions,
    time: parseTime(wikitext),
  };
}

async function apiQuery(params) {
  const url = API + '?' + new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' });
  const res = await fetch(url, { headers: { 'user-agent': 'GotvachBG/1.0' } });
  if (!res.ok) throw new Error('Wikibooks API: ' + res.status);
  return res.json();
}

async function fetchWikitext(title) {
  const data = await apiQuery({ action: 'parse', page: title, prop: 'wikitext' });
  if (!data || !data.parse) return '';
  if (typeof data.parse.wikitext === 'string') return data.parse.wikitext;
  if (data.parse.wikitext && typeof data.parse.wikitext['*'] === 'string') return data.parse.wikitext['*'];
  return '';
}

async function listRecipeTitles() {
  const wikitext = await fetchWikitext(INDEX_TITLE);
  const titles = [];
  const seen = new Set();
  const re = /\[\[(Готварска книга:[^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let m;
  while ((m = re.exec(wikitext))) {
    const title = m[1].trim();
    if (
      title !== INDEX_TITLE &&
      title !== 'Готварска книга:Рецепти по държава и град' &&
      !seen.has(title)
    ) {
      seen.add(title);
      titles.push(title);
    }
  }
  return titles;
}

function slugId(title) {
  return SOURCE_PREFIX + title;
}

function dietTagsForIngredients(ingredients) {
  const text = ingredients.map(i => i.name.toLowerCase()).join(' ');
  const tags = [];
  if (!/(месо|пиле|телеш|говеж|свин|агнеш|риба|скарид|шунка|сланина|кайма|колбас)/i.test(text)) tags.push('вегетарианско');
  if (!/(захар|мед|сироп|шоколад|конфитюр|сладко)/i.test(text)) tags.push('без захар');
  return tags;
}

export async function runWikibooksImport(env, limit = 10) {
  const titles = await listRecipeTitles();
  let checked = 0, added = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const title of titles) {
    if (added >= limit) break;
    checked++;
    try {
      const sourceId = slugId(title);
      const existing = await env.DB.prepare('SELECT id FROM recipes WHERE source_id = ?').bind(sourceId).first();
      if (existing) {
        skipped++;
        continue;
      }

      const wikitext = await fetchWikitext(title);
      const recipe = parseRecipe(title, wikitext);
      if (!recipe) {
        skipped++;
        continue;
      }

      const id = 'wb' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
      const date = new Date().toISOString().slice(0, 10);
      const excerpt = recipe.instructions.slice(0, 180);
      const sourceUrl = SOURCE_BASE + encodeURIComponent(title.replace(/ /g, '_'));

      await env.DB.prepare(
        `INSERT INTO recipes
          (id, source_id, title, title_en, excerpt, ingredients, instructions, category, area, diet_tags, image, youtube, author, date, featured, time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        sourceId,
        recipe.title,
        null,
        excerpt,
        JSON.stringify(recipe.ingredients),
        recipe.instructions,
        'Българска кухня',
        'Българска',
        dietTagsForIngredients(recipe.ingredients).join(','),
        null,
        null,
        'Уикикниги – Готварска книга',
        date,
        0,
        recipe.time || null
      ).run();

      added++;
    } catch (err) {
      failed++;
      errors.push(title + ': ' + String(err && err.message ? err.message : err));
    }
  }

  return {
    source: INDEX_TITLE,
    license: SOURCE_LICENSE,
    licenseUrl: SOURCE_LICENSE_URL,
    checked,
    added,
    skipped,
    failed,
    remaining: Math.max(0, titles.length - checked),
    errors
  };
}
