import os
import google.generativeai as genai

# Вземане на ключа от GitHub Secrets
api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise ValueError("ГРЕШКА: Липсва GEMINI_API_KEY в Secrets!")

genai.configure(api_key=api_key)

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
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content(prompt)
    
    final_html = response.text.replace("```html", "").replace("```", "").strip()

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(final_html)
        
    print("🎉 Рецептата е запазена успешно!")

if __name__ == "__main__":
    generate_recipe()
