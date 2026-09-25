import os
import time
import random
import urllib.parse
import re
import json
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ГРЕШКА: Липсва GEMINI_API_KEY в Secrets!")

client = genai.Client(api_key=api_key)

RECIPES_DIR = "recipes"
HISTORY_FILE = "recipes.json"

os.makedirs(RECIPES_DIR, exist_ok=True)

DEFAULT_RECIPES = [
    {
        "title": "Домашен качамак със сирене и масло",
        "time": "25 мин",
        "url": "#",
        "img": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop"
    },
    {
        "title": "Сочна запеканка с картофи и кашкавал",
        "time": "40 мин",
        "url": "#",
        "img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200&auto=format&fit=crop"
    },
    {
        "title": "Традиционна шопска салата",
        "time": "15 мин",
        "url": "#",
        "img": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&auto=format&fit=crop"
    }
]

FALLBACK_RECIPES = [
    {
        "title": "Класически хрупкави триъгълни банички със сирене и краве масло",
        "image_prompt": "Bulgarian cheese pastry banitsa golden crispy fresh baked food photography",
        "fallback_img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop",
        "time": "45 мин",
        "content": """
        <p class="recipe-meta">⏱️ <strong>Подготовка:</strong> 20 мин | ⏱️ <strong>Готвене:</strong> 25 мин | 🍽️ <strong>Порции:</strong> 4 | 📊 <strong>Сложност:</strong> Лесна</p>

        <p class="recipe-intro">Няма нищо по-уютно от уханието на прясно изпечени триъгълни банички с домашно сирене и масло. Тази рецепта съчетава хрупкава коричка с изключително сочна и пухкава плънка — идеалната закуска за цялото семейство!</p>

        <h3>🛒 Необходими продукти:</h3>
        <ul>
            <li><strong>1 пакет (400 г)</strong> фини кори за баница (найнапред извадени на стайна температура)</li>
            <li><strong>350 г</strong> българско бяло саламурено сирене (по-зряло за наситен вкус)</li>
            <li><strong>3 бр.</strong> големи яйца (размер L)</li>
            <li><strong>120 г</strong> качествено краве масло (разтопено)</li>
            <li><strong>4 с.л.</strong> пълномаслено кисело мляко (3.6% или повече)</li>
            <li><strong>1/2 ч.л.</strong> сода за хляб (за шупване на млякото)</li>
            <li><strong>1 с.л.</strong> газирана вода или олио (за допълнителна хрупкавост)</li>
        </ul>

        <h3>👩‍🍳 Подробен начин на приготвяне:</h3>
        <ol>
            <li><strong>Приготвяне на сочната плънка:</strong> В дълбока купа разбийте яйцата. Добавете киселото мляко, в което предварително сте разбъркали содата да шупне. Натрошете сиренето на средно големи парчета (не на каша, за да се усеща) и разбъркайте хомогенно.</li>
            <li><strong>Подготовка на корите:</strong> Разстелете пакета с кори върху чиста и суха повърхност. Нарежете ги по дължина на равни ленти с ширина около 8–10 см. За всяка баничка използвайте по 2 слепени ленти за по-добра плътност.</li>
            <li><strong>Оформяне на триъгълниците:</strong> Вземете една двойна лента кори, намажете я леко с разтопено краве масло с помощта на четка. В единия край поставете 1 пълна супена лъжица от сиренената смес. Прегънете ъгъла по диагонал върху плънката, образувайки триъгълник. Продължете да сгъвате зигзагообразно до края на лентата.</li>
            <li><strong>Подредба и намазване:</strong> Подредете оформените триъгълници в тава, покрита с хартия за печене. Намажете обилно всяка баничка отгоре с останалото разтопено масло (или разбита смес от жълтък и малко масло).</li>
            <li><strong>Печене:</strong> Печете в предварително загрята фурна на 190°C (на горен и долен нагревател) за 20–25 минути, докато баничките придобият апетитен златисто-кафяв цвят и станат изключително хрупкави.</li>
        </ol>

        <h3>💡 Тайните на шеф-готвача:</h3>
        <ul>
            <li><strong>Стайна температура:</strong> Никога не работете със студени кори директно от хладилника — те се чупят лесно. Извадете ги поне 20 минути предварително.</li>
            <li><strong>За запазване на хрупкавостта:</strong> След изваждане от фурната НЕ покривайте баничките с кърпа, за да не омекнат от парата. Оставете ги да „поемат въздух“ на решетка.</li>
        </ul>

        <h3>🍷 С какво да сервираме:</h3>
        <p>Поднесете ги горещи с чаша студена айрян, домашно кисело мляко или свеж доматен сок.</p>
        """
    }
]

CSS_STYLES = """
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: #f7f3ed;
        color: #4a3b32;
        margin: 0;
        padding: 20px;
        line-height: 1.6;
    }
    .container {
        max-width: 1100px;
        margin: 0 auto;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
    }
    .logo {
        font-size: 26px;
        font-weight: bold;
        color: #a9442a;
        text-decoration: none;
    }
    .search-box input {
        padding: 8px 16px;
        border-radius: 20px;
        border: 1px solid #e2d9cd;
        background-color: #fbf9f5;
        width: 220px;
        font-size: 14px;
        outline: none;
    }
    .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
    }
    .filter-btn {
        background-color: #efe8dc;
        border: none;
        padding: 6px 14px;
        border-radius: 16px;
        color: #6c5c53;
        font-size: 13px;
        cursor: pointer;
    }
    .filter-btn.active {
        background-color: #b85d38;
        color: white;
    }
    .main-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 25px;
        margin-top: 20px;
    }
    .recipe-card, .static-card {
        background: white;
        border-radius: 16px;
        padding: 35px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.04);
    }
    .recipe-image {
        width: 100%;
        height: 400px;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 25px;
    }
    .recipe-card h2, .static-card h1 {
        color: #b85d38;
        margin-top: 0;
        font-size: 28px;
    }
    .recipe-card h3 {
        color: #8c3b23;
        border-bottom: 2px solid #f7f3ed;
        padding-bottom: 8px;
        margin-top: 25px;
    }
    .recipe-meta {
        background-color: #fdfaf6;
        border-left: 4px solid #b85d38;
        padding: 12px 18px;
        border-radius: 0 8px 8px 0;
        font-size: 14px;
        margin-bottom: 20px;
    }
    .recipe-intro {
        font-size: 16px;
        font-style: italic;
        color: #6c5c53;
    }
    ul, ol { padding-left: 22px; }
    li { margin-bottom: 10px; }
    .sidebar {
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.04);
        height: fit-content;
    }
    .sidebar h3 {
        margin-top: 0;
        color: #b85d38;
        font-size: 18px;
        border-bottom: 2px solid #f7f3ed;
        padding-bottom: 10px;
        margin-bottom: 18px;
    }
    .similar-item {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        align-items: center;
    }
    .similar-item img {
        width: 70px;
        height: 70px;
        border-radius: 10px;
        object-fit: cover;
    }
    .similar-item-info h4 {
        margin: 0 0 4px 0;
        font-size: 14px;
    }
    .similar-item-info h4 a {
        color: #4a3b32;
        text-decoration: none;
    }
    .similar-item-info h4 a:hover {
        color: #b85d38;
    }
    .similar-item-info span {
        font-size: 12px;
        color: #9c8c83;
    }
    footer {
        text-align: center;
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #e2d9cd;
        color: #9c8c83;
        font-size: 13px;
    }
    .footer-links a {
        color: #6c5c53;
        text-decoration: none;
        margin: 0 10px;
        font-size: 14px;
    }
    .footer-links .admin-link {
        color: #b85d38;
        font-weight: 600;
    }
    @media (max-width: 820px) {
        .main-layout { grid-template-columns: 1fr; }
    }
"""

def slugify(text):
    bg_to_en = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'y',
        'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
        'ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sht','ъ':'a','ь':'y','ю':'yu','я':'ya'
    }
    slug = text.lower()
    res = []
    for char in slug:
        if char in bg_to_en:
            res.append(bg_to_en[char])
        elif char.isalnum():
            res.append(char)
        elif char in [' ', '-']:
            res.append('-')
    slug_str = re.sub(r'-+', '-', ''.join(res)).strip('-')
    return slug_str if slug_str else f"recipe-{int(time.time())}"

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dumps(history, f, ensure_ascii=False, indent=2)

def create_static_pages():
    pages = {
        "about.html": ("За нас", "<h1>За Готвач БГ</h1><p>Готвач БГ е вашият ежедневен източник на богато обяснени и изкушаващи кулинарни рецепти.</p>"),
        "contacts.html": ("Контакти", "<h1>Свържете се с нас</h1><p>Имате въпроси или кулинарни предложения? Пишете ни на: <strong>contact@gotvachbg.com</strong></p>"),
        "privacy.html": ("Поверителност", "<h1>Политика за поверителност</h1><p>Този уебсайт цени вашата поверителност и използва стандартни бисквитки за подобряване на потребителското изживяване.</p>")
    }
    for filename, (title, content) in pages.items():
        html = f"""<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — Готвач БГ</title>
    <style>{CSS_STYLES}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="/" class="logo">Готвач БГ</a>
        </div>
        <div class="static-card">{content}</div>
        <footer>
            <div class="footer-links">
                <a href="/about.html">За нас</a> |
                <a href="/contacts.html">Контакти</a> |
                <a href="/privacy.html">Поверителност</a> |
                <a href="/admin" class="admin-link">Админ</a>
            </div>
            <p>© GotvachBG. Всички права запазени.</p>
        </footer>
    </div>
</body>
</html>"""
        with open(filename, "w", encoding="utf-8") as f:
            f.write(html)

def build_full_page(title, main_image_url, fallback_backup_img, recipe_body, sidebar_items):
    sidebar_html = ""
    for item in sidebar_items:
        sidebar_html += f"""
        <div class="similar-item">
            <img src="{item['img']}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop';" alt="{item['title']}">
            <div class="similar-item-info">
                <h4><a href="{item['url']}">{item['title']}</a></h4>
                <span>⏱️ {item.get('time', '30 мин')}</span>
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} — Готвач БГ</title>
    <style>{CSS_STYLES}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="/" class="logo">Готвач БГ</a>
            <div class="search-box">
                <input type="text" placeholder="Търси рецепта...">
            </div>
        </div>

        <div class="filters">
            <button class="filter-btn active">Всички кухни</button>
            <button class="filter-btn">Агнешко</button>
            <button class="filter-btn">Гарнитура</button>
            <button class="filter-btn">Закуска</button>
        </div>
        <div class="filters">
            <button class="filter-btn active">Всички диети</button>
            <button class="filter-btn">кето</button>
            <button class="filter-btn">без захар</button>
            <button class="filter-btn">Вегетарианско</button>
        </div>

        <div class="main-layout">
            <div class="main-content">
                <div class="recipe-card">
                    <img src="{main_image_url}" onerror="this.onerror=null;this.src='{fallback_backup_img}';" alt="{title}" class="recipe-image">
                    {recipe_body}
                </div>
            </div>

            <aside class="sidebar">
                <h3>Подобни рецепти</h3>
                {sidebar_html}
            </aside>
        </div>

        <footer>
            <div class="footer-links">
                <a href="/about.html">За нас</a> |
                <a href="/contacts.html">Контакти</a> |
                <a href="/privacy.html">Поверителност</a> |
                <a href="/admin" class="admin-link">Админ</a>
            </div>
            <p>© GotvachBG. Всички права запазени.</p>
        </footer>
    </div>
</body>
</html>"""

def generate_recipe():
    print("🍳 Gemini генерира новата много богата рецепта...")
    
    prompt = """
    Ти си кулинарен блогър и главен готвач. Напиши ИЗКЛЮЧИТЕЛНО ПОДРОБНА, богата, интересна и изкушаваща рецепта за кулинарен сайт GotvachBG.

    Задължително включи следните секции в съответните HTML тагове:
    1. <h2>Заглавие на ястието</h2>
    2. <p class="recipe-meta">⏱️ <strong>Подготовка:</strong> ... мин | ⏱️ <strong>Готвене:</strong> ... мин | 🍽️ <strong>Порции:</strong> ... | 📊 <strong>Сложност:</strong> ...</p>
    3. <p class="recipe-intro">Красив и апетитен анонс/история за ястието, защо е толкова вкусно и кога е подходящо да се приготви (2-3 изречения).</p>
    4. <h3>🛒 Необходими продукти:</h3> (подробен списък с грамажи в ul / li, използвай bold за количествата)
    5. <h3>👩‍🍳 Подробен начин на приготвяне:</h3> (5 до 7 описателни, детайлни стъпки в ol / li, обясни фазите на подготовка, температури и какво да се следи)
    6. <h3>💡 Тайните на шеф-готвача:</h3> (2-3 малки трика за перфектен резултат в ul / li)
    7. <h3>🍷 С какво да сервираме:</h3> (предложения за подходящи напитки, гарнитури или разядки)

    Пиши изчерпателно и професионално! Върни САМО съдържанието в HTML тагове, без markdown (```html).
    """
    
    models_to_try = ['gemini-3.8-flash', 'gemini-3.6-flash']
    recipe_body = None
    
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                recipe_body = response.text.replace("```html", "").replace("```", "").strip()
                print(f"✅ Успешно генериране с {model_name}!")
                break
        except Exception as e:
            print(f"Грешка с {model_name}: {e}")
            time.sleep(5)

    fallback_backup_img = "[https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop](https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop)"
    
    if not recipe_body:
        fallback = random.choice(FALLBACK_RECIPES)
        recipe_body = f"<h2>{fallback['title']}</h2>" + fallback["content"]
        title_text = fallback["title"]
        image_prompt = fallback["image_prompt"]
        fallback_backup_img = fallback["fallback_img"]
    else:
        title_match = re.search(r'<h2>(.*?)</h2>', recipe_body)
        title_text = title_match.group(1) if title_match else "Вкусна рецепта"
        image_prompt = f"delicious {title_text} food photography gourmet cinematic lighting 4k"

    time_match = re.search(r'Готвене:\s*([^|<]+)', recipe_body, re.IGNORECASE)
    cooking_time = time_match.group(1).strip() if time_match else "45 мин"

    encoded_prompt = urllib.parse.quote(image_prompt)
    main_image_url = f"[https://image.pollinations.ai/prompt/](https://image.pollinations.ai/prompt/){encoded_prompt}?width=800&height=450&nologo=true"

    history = load_history()
    sidebar_candidates = [r for r in history if r.get('title') != title_text]
    
    if len(sidebar_candidates) >= 3:
        sidebar_items = random.sample(sidebar_candidates, 3)
    else:
        needed = 3 - len(sidebar_candidates)
        sidebar_items = sidebar_candidates + DEFAULT_RECIPES[:needed]

    full_html = build_full_page(title_text, main_image_url, fallback_backup_img, recipe_body, sidebar_items)

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

    recipe_slug = slugify(title_text)
    recipe_file_path = os.path.join(RECIPES_DIR, f"{recipe_slug}.html")
    recipe_url = f"/{RECIPES_DIR}/{recipe_slug}.html"

    with open(recipe_file_path, "w", encoding="utf-8") as f:
        f.write(full_html)

    new_entry = {
        "title": title_text,
        "time": cooking_time,
        "url": recipe_url,
        "img": main_image_url
    }
    history.insert(0, new_entry)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

    create_static_pages()
    print(f"🎉 Новата дълга рецепта '{title_text}' е качена успешно!")

if __name__ == "__main__":
    generate_recipe()
