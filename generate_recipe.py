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
    Ти си главен готвач. Създай нова, вкусна рецепта за кулинарен сайт GotvachBG.
    Включи:
    - Примамливо заглавие (h2)
    - Време за приготвяне и порции
    - Необходими продукти (ul / li)
    - Подробни стъпки (ol / li)
    - Полезен съвет от готвача
    
    Върни САМО чист HTML код, без markdown тагове като ```html.
    """
    
    model_name = 'gemini-3.6-flash'
    response = None
    
    # Правим 5 опита, като увеличаваме времето за изчакване (15s, 30s, 45s...)
    for attempt in range(1, 6):
        try:
            print(f"Опит {attempt} с модел {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                print("✅ Успешно генериране!")
                break
        except Exception as e:
            wait_time = attempt * 15
            print(f"⚠️ Сървърът е натоварен (503). Изчакване {wait_time} секунди... (Грешка: {e})")
            time.sleep(wait_time)
            
    if not response or not response.text:
        raise RuntimeError("Неуспешно свързване с Gemini след 5 опита.")
    
    final_html = response.text.replace("```html", "").replace("```", "").strip()

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(final_html)
        
    print("🎉 Рецептата е запазена успешно!")

if __name__ == "__main__":
    generate_recipe()
