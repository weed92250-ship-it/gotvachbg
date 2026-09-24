import os
from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def generate_recipe():
    print("🍳 Gemini генерира нова рецепта...")
    
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
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
    )
    
    final_html = response.text.replace("```html", "").replace("```", "").strip()

    with open("latest_recipe.html", "w", encoding="utf-8") as f:
        f.write(final_html)
        
    print("🎉 Рецептата е запазена!")

if __name__ == "__main__":
    generate_recipe()
