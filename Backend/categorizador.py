import google.generativeai as genai
import json

# Configurar la API Key de Gemini
GEMINI_API_KEY = "AIzaSyCgB2v2jqq57sba4DwqS6tvjKVsw6yRffg"
genai.configure(api_key=GEMINI_API_KEY)

# Instanciar el modelo (Flash es rápido y gratis)
model = genai.GenerativeModel('gemini-2.5-flash')

CATEGORIAS_PERMITIDAS = [
    "Alimentación y Supermercado",
    "Combustible y Transporte",
    "Farmacia",
    "Salud",
    "Restaurante y Entretención",
    "Insumos y Oficina",
    "Herramientas y Materiales",
    "Servicios Básicos",
    "Otro"
]

def clasificar_gasto(comercio, texto_boleta):
    """
    Toma el nombre del comercio y el texto completo extraído por OCR,
    y utiliza Gemini 1.5 Flash para clasificarlo en una categoría estándar.
    """
    prompt = f"""
    Eres un experto clasificador de gastos contables.
    A continuación te entregaré el nombre de un local comercial y el texto que se pudo extraer de su boleta.
    Tu único trabajo es elegir UNA de las siguientes categorías exactas que mejor describa la compra:
    {json.dumps(CATEGORIAS_PERMITIDAS, ensure_ascii=False)}

    Local o Comercio: "{comercio}"
    Texto extraído de la boleta:
    ---
    {texto_boleta[:1000]} 
    ---

    Reglas:
    1. Si el comercio vende medicamentos o medicinas, elige "Farmacia". Si es una consulta médica, clínica u hospital, elige "Salud".
    2. Si el local es bencinera (Copec, Shell, Petrobras, Aramco), elige "Combustible y Transporte".
    3. Si es un resturant o comida rápida, elige "Restaurante y Entretención".
    4. Si es comida para llevar a casa, despensas o supermercados, elige "Alimentación y Supermercado".
    5. Solo responde con el nombre EXACTO de la categoría. Nada de explicaciones, hola, ni puntos finales.
    """

    try:
        response = model.generate_content(prompt)
        respuesta_limpia = response.text.strip().replace("\n", "").replace(".", "")
        
        # Validar que la respuesta sea una de las permitidas, si no, caer en "Otro"
        for cat in CATEGORIAS_PERMITIDAS:
            if cat.lower() in respuesta_limpia.lower():
                return cat
                
        return "Otro" # Fallback si Gemini responde algo muy loco
        
    except Exception as e:
        print(f"⚠️ Error al clasificar con Gemini: {e}")
        return "Otro"
