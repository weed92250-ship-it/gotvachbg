import os
import time
import random
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ГРЕШКА: Липсва GEMINI_API_KEY в Secrets!")

client = genai.Client(api_key=api_key)

# Резервни рецепти, ако сървърите на Google Gemini са напълно недостъпни (503/429)
FALLBACK_RECIPES = [
    """
    <h2>Класически хрупкави триъгълни банички със сирене и масло</h2>
    <p><strong>Време за приготвяне:</strong> 45 минути | <strong>Порции:</strong> 4 порции</p>
    <h3>Необходими продукти:</h3>
    <ul>
        <li>1 пакет фини кори за баница (400 г)</li>
        <li>300 г българско бяло сирене</li>
        <li>3 eggs (разбити)</li>
        <li>100 г краве масло (разтопено)</li>
        <li>4 с.л. кисело мляко с 1/2 ч.л. сода за хляб</li>
    </ul>
    <h3>Начин на приготвяне:</h3>
    <ol>
        <li>В купа разбъркайте сиренето, яйцата и киселото мляко със содата.</li>
        <li>Нарежете корите по дължина на ленти с ширина около 8-10 см.</li>
        <li>Намажете всяка лента с малко разтопено масло, сложете 1 с.л. от плънката в единия край и сгъвайте на триъгълник.</li>
        <li>Подредете баничките в тава, покрита с хартия за печене, и ги намажете с останалото масло.</li>
        <li>Печете в предварително загрята фурна на 190°C за около 20-25 минути до апетитен златист цвят.</li>
    </ol>
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px;">
        <strong>💡 Съвет от готвача:</strong> Веднага след изваждане от фурната попръскайте баничките леко с няколко капки студена вода и ги покрийте с кърпа за 5 минути, за да омекнат отвътре.
    </div>
    """,
    """
    <h2>Ароматно пилешко фрикасе с маслено-лимонов сос</h2>
    <p><strong>Време за приготвяне:</strong> 50 минути | <strong>Порции:</strong> 4 порции</p>
    <h3>Необходими продукти:</h3>
    <ul>
        <li>600 г пилешко филе (нарязано на хапки)</li>
        <li>50 г краве масло + 2 с.л. зехтин</li>
        <li>2 с.л. брашно</li>
        <li>1 жълтък</li>
        <li>3 с.л. кисело мляко</li>
        <li>Сок от 1/2 лимон</li>
        <li>Сол, черен пипер и пресен магданоз</li>
    </ul>
    <h3>Начин на приготвяне:</h3>
    <ol>
        <li>Сварете пилешкото месо в подсолена вода за 20 минути и запазете бульона.</li>
        <li>В дълбок тиган разтопете маслото със зехтина и запържете брашното за 1 минута до златисто.</li>
        <li>Постепенно добавяйте от топля пилешки бульон при непрекъснато бъркане с телена бъркалка, докато се получи гладък сос.</li>
        <li>Добавете свареното пилешко месо и оставете да къкри 10 минути на слаб огън.</li>
        <li>Застройте ястието: в купа разбийте жълтъка с киселото мляко и лимоновия сок. Добавете малко от топла сос към сместа, след което я върнете в тигана при постоянно бъркане.</li>
    </ol>
    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px;">
        <strong>💡 Съвет от готвача:</strong> Не оставяйте фрикасето да завира силно след добавяне на застройката с жълтъка, за да не се пресече сосът.
    </div>
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
                    print(f"✅ Успешно генериране с AI модел: {model_name}!")
                    break
            except Exception as e:
                wait_time = attempt * 10
                print(f"⚠️ Опит {attempt} за {model_name} върна грешка: {e}. Пауза {wait_time} сек...")
                time.sleep(wait_time)
        
        if recipe_body:
            break
            
    # Задействане на резервния вариант, ако Google AI сървърите са долу (503)
    if not recipe_body:
        print("⚠️ Сървърите на Gemini са претоварени (503). Задейства се резервна кулинарна рецепта!")
        recipe_body = random.choice(FALLBACK_RECIPES)

    full_html = f"""<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GotvachBG — AI Рецепта на деня</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fdfbf7; color: #2b2d42; line-height: 1.7; margin: 0; padding: 0; }}
        header {{ background-color: #d90429; color: white; text-align: center; padding: 2.5rem 1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }}
        header h1 {{ margin: 0; font-size: 2.8rem; font-weight: 700; }}
        header p {{ margin-top: 0.5rem; opacity: 0.9; font-size: 1.1rem; }}
        main {{ max-width: 800px; margin: 2rem auto 3rem auto; background: white; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }}
        h2 {{ color: #d90429; border-bottom: 2px solid #ef233c; padding-bottom: 0.5rem; font-size: 1.8rem; margin-top: 0; }}
        ul, ol {{ padding-left: 1.5rem; }}
        li {{ margin-bottom: 0.6rem; }}
        footer {{ text-align: center; padding: 2rem; color: #8d99ae; font-size: 0.9rem; border-top: 1px solid #edf2f4; }}
    </style>
</head>
<body>
    <header>
        <h1>🍳 GotvachBG</h1>
        <p>Ежедневна кулинарна инспирация от AI</p>
    </header>
    <main>
        {recipe_body}
    </main>
    <footer>
        <p>© GotvachBG — Автоматично генерирано с Gemini AI</p>
    </footer>
</body>
</html>"""

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(full_html)

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(full_html)
        
    print("🎉 Страницата index.html е обновена успешно!")

if __name__ == "__main__":
    generate_recipe()
