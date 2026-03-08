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

def extraer_datos_con_ia(texto_ocr):
    """
    Utiliza Gemini 1.5 Flash para analizar el texto raw del OCR y extraer todos
    los campos contables relevantes de manera estructurada (JSON).
    """
    prompt = f"""
    Eres un auditor contable súper inteligente. Tu tarea es extraer de forma
    extremadamente precisa los siguientes datos del texto raw de esta boleta o factura.

    Debes devolver EXCLUSIVAMENTE un objeto JSON válido (sin marcas de markdown), con estas claves exactas:
    - "total": (entero numérico, el valor total final pagado, sin puntos ni signos. Si no hay, 0)
    - "iva": (entero numérico, el valor del IVA o impuesto. Si no dice o es exento, 0)
    - "fecha": (cadena, la fecha de la compra en formato DD/MM/YYYY. Si no existe, pon "S/F")
    - "rut": (cadena, RUT del local EMISOR de la boleta, no del cliente. Formato XX.XXX.XXX-X o XXXXXXXX-X. Si no existe, pon "S/R")
    - "comercio": (cadena, el nombre real de la tienda o local. NO pongas la dirección ni el giro. Si es irreconocible, pon "Comercio Desconocido")
    - "giro": (cadena, a qué se dedica la empresa, ej: Venta de abarrotes. Si no sale, pon "S/G")
    - "tipo_documento": (cadena, debe ser exactamente "Boleta" o "Factura" dependiendo de qué estemos leyendo)
    - "numero_documento": (cadena, el número de folio de la boleta o factura. Ej: 5412. Si no tiene folio claro, pon "")

    Texto extraído por OCR:
    ---
    {texto_ocr[:1500]}
    ---
    """

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        # El response_mime_type fuerza a Gemini a dar JSON válido, pero por si acaso limpiamos los backticks.
        texto_res = response.text.strip()
        if texto_res.startswith('```json'):
            texto_res = texto_res.replace('```json', '', 1)
        if texto_res.endswith('```'):
            texto_res = texto_res[:-3]
            
        return json.loads(texto_res.strip())

    except Exception as e:
        print(f"⚠️ Error fatal en extracción estructurada Gemini: {e}")
        return None # Señal explícita para que cerebro.py use las Regex clásicas

