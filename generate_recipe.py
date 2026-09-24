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
    
    # Използваме единствения актуален модел
    model_name = 'gemini-3.6-flash'
    
    # Добавяме кратък ретрай при пиково натоварване (503)
    response = None
    for attempt in range(1, 4):
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
            print(f"⚠️ Опит {attempt} се забави. Грешка: {e}")
            time.sleep(5)
            
    if not response or not response.text:
        raise RuntimeError("Неуспешно свързване с Gemini.")
    
    final_html = response.text.replace("```html", "").replace("```", "").strip()

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(final_html)
        
    print("🎉 Рецептата е запазена успешно!")

if __name__ == "__main__":
    generate_recipe()
