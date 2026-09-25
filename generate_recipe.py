import os
import time
from google import genai

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ГРЕШКА: Липсва GEMINI_API_KEY в Secrets!")

client = genai.Client(api_key=api_key)

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
    
    # Актуални и поддържани модели от Google AI API
    models_to_try = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.0-flash']
    recipe_body = None
    
    for model_name in models_to_try:
        print(f"Опит с модел {model_name}...")
        # Повторни опити (3 пъти) за всеки модел при моментна пренатовареност (503)
        for attempt in range(1, 4):
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
                print(f"⚠️ Опит {attempt} за {model_name} върна грешка: {e}")
                time.sleep(7)
        
        if recipe_body:
            break
            
    if not recipe_body:
        raise RuntimeError("Неуспешно генериране с нито един от наличните модели.")

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
        
    print("🎉 Страницата е обновена успешно!")

if __name__ == "__main__":
    generate_recipe()
