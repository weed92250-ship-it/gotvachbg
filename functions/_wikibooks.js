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

function parseIngredients(section) {
  const ingredients = [];
  const text = String(section || '')
    .replace(/^-{3,}\s*/gm, '')
    .trim();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const values = /^\*+\s+/.test(line) ? [line.replace(/^\*+\s+/, '')] : [line];
    for (let value of values) {
      value = cleanWikiText(value).trim();
      if (!value || /^за\s+.+:\s*$/i.test(value) || /^необходими продукти:?$/i.test(value)) continue;
      for (const part of value.split(/[;,](?=\s|$)/)) {
        const item = part.trim();
        if (!item || item.length < 2) continue;
        let measure = '', name = item;
        const dash = item.match(/^(.+?)\s+[–—-]\s+(.+)$/);
        if (dash) { measure = dash[1].trim(); name = dash[2].trim(); }
        else {
          const leading = item.match(/^((?:около\s+)?(?:\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\s*\d+)?)?|½|1\/2|половин|половина|няколко|една|един|едно)(?:\s+[^,;]+?){0,3})\s+(.+)$/i);
          if (leading) { measure = leading[1].trim(); name = leading[2].trim(); }
        }
        if (name && name.length > 1) ingredients.push({ name, measure });
      }
    }
  }
  return ingredients;
}

function sectionBetween(wikitext, startNames, endNames) {
  const starts = startNames.map(x => x.replace(/[.*+?^{}()|[\\]\\]/g, '\\$&')).join('|');
  const ends = endNames.map(x => x.replace(/[.*+?^{}()|[\\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(
    '^\\s*(?:={1,6}\\s*)?(?:' + starts + ')(?:\\s*={1,6})?\\s*\\n([\\s\\S]*?)(?=^\\s*(?:={1,6}\\s*)?(?:' + ends + ')(?:\\s*={1,6})?\\s*$|$)',
    'im'
  );
  const m = wikitext.match(re);
  return m ? m[1] : '';
}

function extractPrepFallback(wikitext) {
  const m = wikitext.match(/(?:^|\\n)\\s*(?:={1,6}\\s*)?(?:Приготвяне|Начин на приготвяне)(?:\\s*={1,6})?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:={1,6}\\s*)?(?:Източници|Други|Бележка|Забележка)(?:\\s*={1,6})?\\s*$|$)/im);
  return m ? m[1] : '';
}

function parseTime(wikitext) {
  const m = wikitext.match(/^\s*време\s*:\s*\|?\s*([^\n|]+)?/im);
  const value = m && m[1] ? cleanWikiText(m[1]) : '';
  return value && !/^X+|^$/i.test(value) ? value : '';
}

function extractSectionLoose(wikitext, starts, ends) {
  const lines = String(wikitext || '').split(/\r?\n/);
  const isHeading = line => /^\s*=+\s*.*?\s*=+\s*$/.test(line);
  const headingName = line => line.replace(/^\s*=+\s*/, '').replace(/\s*=+\s*$/, '').trim();
  const plainName = line => line.replace(/^[\s:;#*\-]+/, '').trim();
  const normalizeName = value => String(value || '')
    .toLowerCase()
    .replace(/'+/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/[\s:;,.!?-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const matches = (line, names) => {
    const value = normalizeName(isHeading(line) ? headingName(line) : plainName(line));
    return names.some(x => {
      const target = normalizeName(x);
      return value === target || value.startsWith(target + ' ') || value.startsWith(target + '(');
    });
  };
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (matches(lines[i], starts)) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i++) {
    if (matches(lines[i], ends)) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function extractRecipeSection(wikitext, starts, ends) {
  const lines = String(wikitext || '').replace(/\r/g, '').split('\n');
  const normalize = value => cleanWikiText(value)
    .replace(/^#+\s*/, '')
    .replace(/^\s*[:;*\-]+\s*/, '')
    .trim()
    .toLowerCase();

  let start = -1;
  let inline = '';

  for (let i = 0; i < lines.length; i++) {
    const cleaned = cleanWikiText(lines[i]).replace(/^#+\s*/, '').trim();
    const lower = cleaned.toLowerCase();

    for (const name of starts) {
      const target = String(name).toLowerCase();
      if (lower === target || lower.startsWith(target + ':') || lower.startsWith(target + ' ')) {
        start = i + 1;
        if (lower.startsWith(target + ':')) inline = cleaned.slice(name.length + 1).trim();
        else if (lower.startsWith(target + ' ')) inline = cleaned.slice(name.length).trim();
        break;
      }
    }
    if (start >= 0) break;
  }

  if (start < 0) return '';

  const out = [];
  if (inline) out.push(inline);

  for (let i = start; i < lines.length; i++) {
    const cleaned = cleanWikiText(lines[i]).replace(/^#+\s*/, '').trim();
    const lower = cleaned.toLowerCase();
    const isEnd = ends.some(name => {
      const target = String(name).toLowerCase();
      return lower === target || lower.startsWith(target + ':') || lower.startsWith(target + ' ');
    });
    if (isEnd) break;
    out.push(lines[i]);
  }

  return out.join('\n').trim();
}

function extractIngredientsFallback(wikitext) {
  const source = String(wikitext || '').replace(/\r/g, '');
  const prepMatch = source.match(/(?:^|\n)[^\n]*(?:Приготвяне|Начин на приготвяне)[^\n]*/i);
  const prepIndex = prepMatch ? prepMatch.index : source.length;
  const beforePrep = source.slice(0, prepIndex);
  const productMatch = beforePrep.match(/Продукти\s*:?/i);
  if (productMatch) {
    const section = beforePrep.slice(productMatch.index + productMatch[0].length);
    return section
      .split(/(?:^|\n)[^\n]*?(?:порции|време|ен\.\s*ст\.)\s*:{1,2}[^\n]*(?:\n|$)/i)[0]
      .replace(/^\s*=+\s*\n?/g, '')
      .trim();
  }

  // Some short recipes have no "Продукти" marker at all.
  // In that case, use the text before "Приготвяне" as the ingredient area.
  return beforePrep
    .replace(/^\s*=+[^\n]*\n/gm, '')
    .replace(/(?:^|\n)\s*(?:порции|време|ен\.\s*ст\.)\s*:[^\n]*/gi, '')
    .trim();
}

function extractFlatPrep(wikitext) {
  const source = String(wikitext || '').replace(/\r/g, '');

  // Metadata may be bolded, templated, or prefixed with wiki list syntax.
  // Find the last metadata field and take everything after its whole line.
  const re = /(?:^|\n)[^\n]*?(?:'{2,3})?\s*(?:порции|време|ен\.\s*ст\.)\s*:{1,2}[^\n]*(?:\n|$)/gi;
  const matches = [...source.matchAll(re)];
  if (!matches.length) return '';

  const last = matches[matches.length - 1];
  return source.slice(last.index + last[0].length).trim();
}

function extractInlinePrep(wikitext) {
  const source = String(wikitext || '').replace(/\r/g, '');
  const m = source.match(/(?:^|\n)\s*(?:'''\s*)?(?:Начин на приготвяне|Приготвяне)\s*:?\s*(?:'''\s*)?([\s\S]*?)(?=\n\s*(?:Източници|Други|Бележка|Забележка)\b|$)/i);
  return m ? m[1].trim() : '';
}

function extractMetaFallbackPrep(wikitext) {
  const source = String(wikitext || '').replace(/\r/g, '');
  const lines = source.split('\n');
  let meta = -1;
  for (let i = 0; i < lines.length; i++) {
    const plain = cleanWikiText(lines[i])
      .replace(/^\s*[*#;:]+\s*/, '')
      .trim()
      .toLowerCase();
    if (/^(?:порции|време|ен\.\s*ст\.)\s*:{1,2}/i.test(plain)) meta = i;
  }
  return meta >= 0 ? lines.slice(meta + 1).join('\n').trim() : '';
}

function extractLegacyRecipe(wikitext) {
  const source = String(wikitext || '').replace(/\r/g, '');
  const lines = source.split('\n').map(x => x.trim()).filter(Boolean);

  // {{рецепта|продукти=...|...}} followed by prose.
  const tpl = source.match(/\{\{рецепта\|([\s\S]*?)\}\}/i);
  if (tpl) {
    const body = tpl[1];
    const pm = body.match(/(?:^|\|)продукти\s*=\s*([\s\S]*?)(?=\|(?:време|енерг|ен\.\s*ст\.|порции)\s*=|$)/i);
    const ingredients = pm ? pm[1].replace(/<nowiki\s*\/?\s*>/gi, '').trim() : '';
    const after = source.slice(tpl.index + tpl[0].length).trim();
    return { ingredients, prep: after };
  }

  // Older pages often list ingredients as plain lines and mark preparation with bullets.
  const prepIndex = lines.findIndex(line => /^(?:•|\*|#)\s*/.test(line));
  if (prepIndex > 0) {
    const before = lines.slice(0, prepIndex);
    const prep = lines.slice(prepIndex).join('\n');
    const ingredientLines = before.filter(line =>
      /\d|\bсол\b|\bорехи?\b|\bкопър\b|\bчесън\b|\bмляко\b|\bмаруля\b|\bолио\b|\bмасло\b/i.test(line)
    );
    if (ingredientLines.length >= 2) return { ingredients: ingredientLines.join('\n'), prep };
  }

  return { ingredients: '', prep: '' };
}

function extractIngredientsFromProse(text) {
  const s = cleanWikiText(text).replace(/[()]/g, ' ');
  const found = [];
  const add = (name, measure='') => {
    const key = name.toLowerCase().trim();
    if (key.length > 1 && !found.some(x => x.name.toLowerCase() === key)) found.push({ name: name.trim(), measure });
  };

  for (const m of s.matchAll(/(?:около\s+)?(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|½|1\/2)\s*(g|гр(?:\.|ама)?|kg|кг|ml|мл|l|л|с\.\s*л\.|с\.\s*л|ч\.\s*л\.|ч\.\s*л)\s+([А-Яа-яA-Za-z][^,.;]+?)(?=\s+(?:и|за|да|като|се|с|без)\s|[,.;]|$)/giu) {
    add(m[3], m[1] + ' ' + m[2]);
  }

  for (const word of ['шкембе','хайвер','лук','чесън','масло','олио','мляко','сметана','бренди','вода','сол','орехи','копър','маруля','хляб','лимон','червен пипер','чили','оцет']) {
    if (new RegExp('\\b' + word.replace(/\s+/g,'\\s+') + '\\b','i').test(s)) add(word);
  }
  return found;
}

function parseRecipe(title, wikitext) {
  const legacy = extractLegacyRecipe(wikitext);
  const ingredientsSection = legacy.ingredients || extractIngredientsFallback(wikitext)
    || extractSectionLoose(
      wikitext,
      ['Продукти', 'Необходими продукти'],
      ['Приготвяне', 'Начин на приготвяне', 'Източници', 'Други', 'Бележка', 'Забележка']
    )
    || extractRecipeSection(
      wikitext,
      ['Продукти', 'Необходими продукти'],
      ['Приготвяне', 'Начин на приготвяне', 'Източници', 'Други', 'Бележка', 'Забележка']
    );
  const prepSection = legacy.prep || extractSectionLoose(
    wikitext,
    ['Приготвяне', 'Начин на приготвяне'],
    ['Източници', 'Други', 'Бележка', 'Забележка']
  ) || sectionBetween(
    wikitext,
    ['Приготвяне', 'Начин на приготвяне'],
    ['Източници', 'Други', 'Бележка', 'Забележка']
  ) || extractPrepFallback(wikitext) || extractFlatPrep(wikitext);
  let ingredients = parseIngredients(ingredientsSection);
  if (ingredients.length < 2 && (legacy.prep || String(wikitext || '').trim())) {
    ingredients = extractIngredientsFromProse(legacy.prep || wikitext);
  }
  const instructions = cleanWikiText(prepSection)
    .replace(/\^\{[^}]*\}/g, '')
    .replace(/\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (ingredients.length < 2 || instructions.length < 80) {
    return {
      error: ingredients.length < 2 ? 'no_ingredients' : 'short_instructions',
      diagnostic: {
        wikitextChars: String(wikitext || '').length,
        ingredientsSectionChars: ingredientsSection.length,
        prepSectionChars: prepSection.length,
        ingredientCount: ingredients.length,
        instructionChars: instructions.length,
        rawLines: String(wikitext || '').replace(/\r/g, '').split('\n').slice(0, 40),
        markerLines: String(wikitext || '').replace(/\r/g, '').split('\n')
          .map((line, index) => ({ index: index + 1, line, cleaned: cleanWikiText(line) }))
          .filter(x => /продукт|порци|време|ен\.\s*ст\.|приготвяне|източници|бележка/i.test(x.line))
          .slice(0, 30)
      }
    };
  }

  return {
    title: title.replace(/^Готварска книга:\s*/i, '').trim(),
    ingredients,
    instructions,
    time: parseTime(wikitext),
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function apiQuery(params, attempts = 4) {
  const url = API + '?' + new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' });
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'GotvachBG/1.0 (recipe importer; respectful rate limiting)'
      }
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get('retry-after') || 0);
      const wait = retryAfter > 0 ? Math.min(retryAfter * 1000, 15000) : 2000 * (attempt + 1);
      await sleep(wait);
      continue;
    }
    throw new Error('Wikibooks API: ' + res.status);
  }
  throw new Error('Wikibooks API: 429 Too Many Requests след повторни опити');
}

async function fetchWikitext(title) {
  const data = await apiQuery({ action: 'parse', page: title, prop: 'wikitext' });
  if (!data || !data.parse) return '';
  if (typeof data.parse.wikitext === 'string') return data.parse.wikitext;
  if (data.parse.wikitext && typeof data.parse.wikitext['*'] === 'string') return data.parse.wikitext['*'];
  return '';
}

async function fetchWikitextBatch(titles) {
  const data = await apiQuery({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: titles.join('|')
  });
  const result = new Map();
  for (const page of (data && data.query && data.query.pages) || []) {
    const rev = page.revisions && page.revisions[0];
    const slot = rev && rev.slots && rev.slots.main;
    const text = slot && (typeof slot.content === 'string' ? slot.content : slot['*']);
    if (page.title && typeof text === 'string') result.set(page.title, text);
  }
  return result;
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
  const skipReasons = { already_exists: 0, no_wikitext: 0, no_ingredients: 0, short_instructions: 0 };
  const diagnostics = [];

  for (let offset = 0; offset < titles.length && added < limit; offset += 20) {
    const batchTitles = titles.slice(offset, offset + 20);
    let wikitexts;
    try {
      wikitexts = await fetchWikitextBatch(batchTitles);
    } catch (err) {
      failed += batchTitles.length;
      errors.push('Batch ' + offset + ': ' + String(err && err.message ? err.message : err));
      await sleep(3000);
      continue;
    }

    for (const title of batchTitles) {
      if (added >= limit) break;
      checked++;
      try {
        const sourceId = slugId(title);
        const existing = await env.DB.prepare('SELECT id FROM recipes WHERE source_id = ?').bind(sourceId).first();
        if (existing) {
          skipped++;
          skipReasons.already_exists++;
          continue;
        }

        const wikitext = wikitexts.get(title) || '';
        if (!wikitext) {
          skipped++;
          skipReasons.no_wikitext++;
          if (diagnostics.length < 5) diagnostics.push({ title, reason: 'no_wikitext', wikitextChars: 0 });
          continue;
        }
        const recipe = parseRecipe(title, wikitext);
        if (recipe && recipe.error) {
          skipped++;
          skipReasons[recipe.error] = (skipReasons[recipe.error] || 0) + 1;
          if (diagnostics.length < 5) diagnostics.push({ title, reason: recipe.error, ...recipe.diagnostic });
          continue;
        }

        const id = 'wb' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
        const date = new Date().toISOString().slice(0, 10);
        const excerpt = recipe.instructions.slice(0, 180);

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

    if (offset + 20 < titles.length && added < limit) await sleep(1500);
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
    errors,
    skipReasons,
    diagnostics
  };
}
