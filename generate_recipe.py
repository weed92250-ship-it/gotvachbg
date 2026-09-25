import os
import time
import random
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ГРЕШКА: Липсва GEMINI_API_KEY в Secrets!")

client = genai.Client(api_key=api_key)

FALLBACK_RECIPES = [
    """
    <h2>Класически хрупкави триъгълни банички със сирене</h2>
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
    """,
    """
    <h2>Ароматно пилешко фрикасе с маслено-лимонов сос</h2>
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
]

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
            
    if not recipe_body:
        print("⚠️ Използване на резервна рецепта...")
        recipe_body = random.choice(FALLBACK_RECIPES)

    # Старият оригинален дизайн с кремов фон, търсачка и категории
    full_html = f"""<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Готвач БГ — Рецепти всеки ден</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f7f3ed;
            color: #4a3b32;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 900px;
            margin: 0 auto;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }}
        .logo {{
            font-size: 24px;
            font-weight: bold;
            color: #a9442a;
            text-decoration: none;
        }}
        .search-box input {{
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid #e2d9cd;
            background-color: #fbf9f5;
            width: 180px;
            font-size: 14px;
        }}
        .admin-link {{
            color: #b56247;
            text-decoration: none;
            font-size: 14px;
        }}
        .filters {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
        }}
        .filter-btn {{
            background-color: #efe8dc;
            border: none;
            padding: 6px 14px;
            border-radius: 16px;
            color: #6c5c53;
            font-size: 13px;
            cursor: pointer;
        }}
        .filter-btn.active {{
            background-color: #b85d38;
            color: white;
        }}
        .recipe-card {{
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.04);
            margin-top: 20px;
        }}
        .recipe-card h2 {{
            color: #b85d38;
            margin-top: 0;
            font-size: 24px;
        }}
        ul, ol {{ padding-left: 20px; }}
        li {{ margin-bottom: 8px; }}
        footer {{
            text-align: center;
            margin-top: 40px;
            color: #9c8c83;
            font-size: 13px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="#" class="logo">Готвач БГ</a>
            <div class="search-box">
                <input type="text" placeholder="Търси рецепта...">
            </div>
            <a href="#" class="admin-link">Админ</a>
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

        <div class="recipe-card">
            {recipe_body}
        </div>

        <footer>
            <p>© GotvachBG — Автоматично генерирани AI рецепти</p>
        </footer>
    </div>
</body>
</html>"""

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(full_html)
        
    print("🎉 Страницата index.html е обновена със стария изглед!")

if __name__ == "__main__":
    generate_recipe()
