import os
import time
import random
import urllib.parse
import re
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ГРЕШКА: Липсва GEMINI_API_KEY в Secrets!")

client = genai.Client(api_key=api_key)

# Резервни ястия за страничната лента
SIMILAR_RECIPES = [
    {
        "title": "Домашен качамак със сирене и масло",
        "time": "25 мин",
        "prompt": "Bulgarian kachamak polenta cheese butter food photography",
        "fallback_img": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop"
    },
    {
        "title": "Сочна запеканка с картофи и кашкавал",
        "time": "40 мин",
        "prompt": "Baked potato casserole cheese golden crust food photography",
        "fallback_img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=200&auto=format&fit=crop"
    },
    {
        "title": "Традиционна шопска салата",
        "time": "15 мин",
        "prompt": "Shopska salad fresh tomatoes cucumber feta cheese food photography",
        "fallback_img": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&auto=format&fit=crop"
    },
    {
        "title": "Хрупкави банички със спанак и извара",
        "time": "45 мин",
        "prompt": "Spinach cheese pastry rolls golden food photography",
        "fallback_img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=200&auto=format&fit=crop"
    }
]

FALLBACK_RECIPES = [
    {
        "title": "Класически хрупкави триъгълни банички със сирене",
        "image_prompt": "Bulgarian cheese pastry banitsa golden crispy fresh baked food photography",
        "fallback_img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop",
        "content": """
        <p><strong>Време:</strong> 45 мин | <strong>Порции:</strong> 4</p>
        <h3>Необходими продукти:</h3>
        <ul>
            <li>1 пакет фини кори за баница (400 г)</li>
            <li>300 г българско бяло сирене</li>
            <li>3 яйца</li>
            <li>100 г краве масло (разтопено)</li>
            <li>4 с.л. кисело мляко с 1/2 ч.л. сода</li>
        </ul>
        <h3>Начин на приготвяне:</h3>
        <ol>
            <li>Разбъркайте сиренето, яйцата и киселото мляко със содата.</li>
            <li>Нарежете корите на ленти (8-10 см), намажете с масло и поставете 1 с.л. плънка.</li>
            <li>Сгънете на триъгълници и печете на 190°C за 20-25 минути.</li>
        </ol>
        """
    },
    {
        "title": "Ароматно пилешко фрикасе с маслено-лимонов сос",
        "image_prompt": "Chicken fricassee creamy lemon sauce food photography gourmet",
        "fallback_img": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop",
        "content": """
        <p><strong>Време:</strong> 50 мин | <strong>Порции:</strong> 4</p>
        <h3>Необходими продукти:</h3>
        <ul>
            <li>600 г пилешко филе</li>
            <li>50 г краве масло + 2 с.л. зехтин</li>
            <li>2 с.л. брашно</li>
            <li>1 жълтък + 3 с.л. кисело мляко</li>
            <li>Сок от 1/2 лимон</li>
        </ul>
        <h3>Начин на приготвяне:</h3>
        <ol>
            <li>Сварете пилешкото месо в подсолена вода.</li>
            <li>Запържете брашното в маслото и постепенно добавяйте от бульона.</li>
            <li>Добавете пилешкото, застройте с жълтъка, млякото и лимона.</li>
        </ol>
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
        font-size: 24px;
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
        grid-template-columns: 1fr 310px;
        gap: 25px;
        margin-top: 20px;
    }
    .recipe-card, .static-card {
        background: white;
        border-radius: 16px;
        padding: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.04);
    }
    .recipe-image {
        width: 100%;
        height: 380px;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 20px;
    }
    .recipe-card h2, .static-card h1 {
        color: #b85d38;
        margin-top: 0;
    }
    ul, ol { padding-left: 20px; }
    li { margin-bottom: 8px; }
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

def create_static_pages():
    pages = {
        "about.html": ("За нас", "<h1>За Готвач БГ</h1><p>Готвач БГ е вашият ежедневен източник на кулинарно вдъхновение. Всяка рецепта е внимателно подбрана и структурирана, за да превърне готвенето в удоволствие.</p>"),
        "contacts.html": ("Контакти", "<h1>Свържете се с нас</h1><p>Имате въпроси или предложения? Пишете ни на: <strong>contact@gotvachbg.com</strong></p>"),
        "privacy.html": ("Поверителност", "<h1>Политика за поверителност</h1><p>Ние ценим вашата поверителност. Този уебсайт не събира лични данни и използва стандартни бисквитки за подобряване на потребителското изживяване.</p>")
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
        <div class="static-card">
            {content}
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
        with open(filename, "w", encoding="utf-8") as f:
            f.write(html)

def generate_recipe():
    print("🍳 Gemini генерира новата рецепта...")
    
    prompt = """
    Ти си главен готвач. Създай нова, изкушаваща и вкусна рецепта за кулинарен сайт GotvachBG.
    Включи:
    - Заглавие на ястието (h2)
    - Време за приготвяне и порции
    - Необходими продукти (ul / li)
    - Подробни стъпки за приготвяне (ol / li)
    - Полезен съвет от готвача
    
    Върни САМО съдържанието на рецептата в HTML тагове, без markdown (```html).
    """
    
    models_to_try = ['gemini-3.8-flash', 'gemini-3.6-flash']
    recipe_body = None
    
    for model_name in models_to_try:
        print(f"Опит с модел {model_name}...")
        for attempt in range(1, 3):
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
                time.sleep(10)
        if recipe_body:
            break
            
    fallback_backup_img = "[https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop](https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop)"
    
    if not recipe_body:
        print("⚠️ Използване на резервна рецепта...")
        fallback = random.choice(FALLBACK_RECIPES)
        recipe_body = f"<h2>{fallback['title']}</h2>" + fallback["content"]
        image_prompt = fallback["image_prompt"]
        fallback_backup_img = fallback["fallback_img"]
    else:
        title_match = re.search(r'<h2>(.*?)</h2>', recipe_body)
        title_text = title_match.group(1) if title_match else "delicious food dish"
        image_prompt = f"delicious {title_text} food photography gourmet cinematic lighting 4k"

    encoded_prompt = urllib.parse.quote(image_prompt)
    main_image_url = f"[https://image.pollinations.ai/prompt/](https://image.pollinations.ai/prompt/){encoded_prompt}?width=800&height=450&nologo=true"

    selected_similars = random.sample(SIMILAR_RECIPES, 3)
    sidebar_html = ""
    for item in selected_similars:
        item_img_prompt = urllib.parse.quote(item["prompt"])
        img_url = f"[https://image.pollinations.ai/prompt/](https://image.pollinations.ai/prompt/){item_img_prompt}?width=160&height=160&nologo=true"
        sidebar_html += f"""
        <div class="similar-item">
            <img src="{img_url}" onerror="this.onerror=null;this.src='{item['fallback_img']}';" alt="{item['title']}">
            <div class="similar-item-info">
                <h4><a href="#">{item['title']}</a></h4>
                <span>⏱️ {item['time']}</span>
            </div>
        </div>
        """

    full_html = f"""<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Готвач БГ — Рецепти всеки ден</title>
    <style>{CSS_STYLES}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="/" class="logo">Готвач БГ</a>
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Търси рецепта...">
            </div>
        </div>

        <div class="filters" id="kitchenFilters">
            <button class="filter-btn active">Всички кухни</button>
            <button class="filter-btn">Агнешко</button>
            <button class="filter-btn">Гарнитура</button>
            <button class="filter-btn">Закуска</button>
        </div>
        <div class="filters" id="dietFilters">
            <button class="filter-btn active">Всички диети</button>
            <button class="filter-btn">кето</button>
            <button class="filter-btn">без захар</button>
            <button class="filter-btn">Вегетарианско</button>
        </div>

        <div class="main-layout">
            <div class="main-content">
                <div class="recipe-card" id="recipeCard">
                    <img src="{main_image_url}" onerror="this.onerror=null;this.src='{fallback_backup_img}';" alt="Снимка на ястието" class="recipe-image">
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

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(full_html)

    # Генериране на помощните страници
    create_static_pages()
    print("🎉 Всички страници и снимки са обновени успешно!")

if __name__ == "__main__":
    generate_recipe()
