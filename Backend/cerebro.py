import os
import json
import re
import uuid
import io
import base64 
import fitz  
from datetime import datetime
from flask import Flask, request, jsonify

import firebase_admin
from firebase_admin import credentials, storage, auth as firebase_auth # <-- AÑADIDO auth para crear usuarios
from google.cloud import vision
from google.cloud import firestore as google_firestore 
from google.oauth2 import service_account

from sii_helper import consultar_rut_sii 
from PIL import Image 
from categorizador import clasificar_gasto, extraer_datos_con_ia

# --- INICIALIZACIÓN DE FLASK ---
app = Flask(__name__)

# --- CONFIGURACIÓN DE FIREBASE Y VISION (SEGURA) ---
BUCKET_NAME = "contalink-14cd6.firebasestorage.app" 
env_creds = os.environ.get('GOOGLE_CREDENTIALS_JSON')

def cargar_configuracion():
    if env_creds and len(env_creds.strip()) > 0:
        try:
            json_limpio = env_creds.strip().strip("'").strip('"').replace('\\n', '\n')
            info = json.loads(json_limpio)
            print("✅ Variable de entorno cargada correctamente.")
            return credentials.Certificate(info), service_account.Credentials.from_service_account_info(info)
        except Exception as e:
            print(f"⚠️ Error al decodificar JSON de la variable: {e}")

    try:
        cf = credentials.Certificate("credenciales_firebase.json")
        cv = service_account.Credentials.from_service_account_file("credenciales_google_vision.json")
        print("🏠 Usando archivos JSON locales como respaldo.")
        return cf, cv
    except Exception as e:
        print(f"❌ ERROR CRÍTICO: No se encontraron credenciales válidas: {e}")
        return None, None

cred_firebase, vision_creds = cargar_configuracion()

if not cred_firebase:
    raise ValueError("❌ Failed to load Firebase credentials. Exiting.")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred_firebase, {'storageBucket': BUCKET_NAME})

db = google_firestore.Client(
    project="contalink-14cd6", 
    credentials=cred_firebase.get_credential(), 
    database="bd-contalink"
)

# --- CREACIÓN DE MINIATURAS (VERSIÓN BASE64) ---
def generar_miniatura_base64(bytes_original, es_pdf):
    try:
        imagen = None
        if es_pdf:
            doc = fitz.open(stream=bytes_original, filetype="pdf")
            pagina = doc.load_page(0)
            pix = pagina.get_pixmap()
            imagen = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        else:
            imagen = Image.open(io.BytesIO(bytes_original))
            if imagen.mode in ("RGBA", "P"): 
                imagen = imagen.convert("RGB")

        if imagen:
            imagen.thumbnail((150, 150))
            thumb_io = io.BytesIO()
            imagen.save(thumb_io, format='JPEG', quality=60) 
            thumb_base64 = base64.b64encode(thumb_io.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{thumb_base64}"
            
    except Exception as e:
        print(f"⚠️ Error generando miniatura Base64: {e}")
    return None

# --- DETECCIÓN DE TEXTO ---
def detectar_texto_vision(content_bytes, mime_type="image/jpeg"):
    client = vision.ImageAnnotatorClient(credentials=vision_creds)
    if mime_type == "application/pdf":
        feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
        input_config = vision.InputConfig(content=content_bytes, mime_type=mime_type)
        request_pdf = vision.AnnotateFileRequest(features=[feature], input_config=input_config)
        response = client.batch_annotate_files(requests=[request_pdf])
        if response.responses[0].error.message: raise Exception(response.responses[0].error.message)
            
        texto_completo = ""
        for page_response in response.responses[0].responses:
            if page_response.full_text_annotation: texto_completo += page_response.full_text_annotation.text + "\n"
        return texto_completo
    else:
        image = vision.Image(content=content_bytes)
        features = [{"type_": vision.Feature.Type.TEXT_DETECTION}]
        response = client.annotate_image(request={"image": image, "features": features})
        if response.error.message: raise Exception(f'{response.error.message}')
        return response.text_annotations[0].description if response.text_annotations else ""

def extraer_datos(texto):
    datos = { "total": 0, "iva": 0, "fecha": "S/F", "glosa": "", "rut": "S/R", "giro": "S/G", "comercio": "Comercio Desconocido", "tipo_documento": "Boleta", "numero_documento": "" }
    texto_upper = texto.upper()
    
    if "FACTURA" in texto_upper: datos["tipo_documento"] = "Factura"

    match_numero = re.search(r'(?:N[°ºA-Z]*\s*|FOLIO\s*|NUMERO\s*|NRO\s*)[:.]?\s*([0-9]+)', texto_upper)
    if match_numero: datos["numero_documento"] = match_numero.group(1)

    match_fecha_texto = re.search(r'(\d{1,2})\s*DE\s*([A-Z]+)\s*DE[L]?\s*(\d{4})', texto_upper)
    if match_fecha_texto:
        meses = {"ENERO":"01", "FEBRERO":"02", "MARZO":"03", "ABRIL":"04", "MAYO":"05", "JUNIO":"06", "JULIO":"07", "AGOSTO":"08", "SEPTIEMBRE":"09", "OCTUBRE":"10", "NOVIEMBRE":"11", "DICIEMBRE":"12"}
        dia = match_fecha_texto.group(1).zfill(2)
        mes = meses.get(match_fecha_texto.group(2), "01")
        datos["fecha"] = f"{dia}/{mes}/{match_fecha_texto.group(3)}"
    else:
        match_fecha_num = re.search(r'(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})', texto_upper)
        if match_fecha_num: datos["fecha"] = match_fecha_num.group(0)

    rut_matches = re.findall(r'(?:R\.?U\.?T\.?|RUT)[\s.:]*([\d\.]+-[\dkK])', texto_upper)
    if rut_matches: datos["rut"] = rut_matches[0].replace(" ", "")

    patron_total = re.compile(r'(?:TOTAL A PAGAR|MONTO TOTAL|TOTAL|EXENTO|PAGAR|SUMA)[\s:]*[\$]?\s*([\d,.]+)', re.IGNORECASE)
    coincidencias = patron_total.findall(texto_upper)
    posibles_totales = [int(m.replace('.', '').replace(',', '')) for m in coincidencias if int(m.replace('.', '').replace(',', '')) > 100]
    if posibles_totales: datos["total"] = max(posibles_totales)

    match_iva = re.search(r'\bI\.?V\.?A\.?\b', texto_upper)
    if match_iva:
        inicio_busqueda = match_iva.end()
        recorte_texto = texto_upper[inicio_busqueda:inicio_busqueda+60]
        numeros_cercanos = re.findall(r'[\d\.,]+', recorte_texto)
        for n in numeros_cercanos:
            num_limpio = n.replace('.', '').replace(',', '')
            if num_limpio.isdigit():
                val = int(num_limpio)
                if val > 19:
                    datos["iva"] = val
                    break

    palabras_prohibidas = ["RUT", "FECHA", "BOLETA", "FACTURA", "SII", "DIRECCION", "SUCURSAL", "TELEFONO", "SANTIAGO", "CHILE", "EMAIL", "E-MAIL", "MAIL"]
    lineas = texto.split('\n')
    for linea in lineas[:8]:
        linea_limpia = linea.strip().upper()
        if len(linea_limpia) > 2 and not any(p in linea_limpia for p in palabras_prohibidas):
            if not re.match(r'^[\d\s\.\-/:,]+$', linea_limpia):
                datos["comercio"] = linea.strip()
                break

    match_giro = re.search(r'(?:GIRO|RUBRO)[\s.:]*([^\n]+)', texto_upper)
    if match_giro:
        g = match_giro.group(1).strip()
        if len(g) > 3: datos["giro"] = g
        
    return datos

# --- ACTUALIZACIÓN DE BASE DE DATOS CON DETECCIÓN DE DUPLICADOS ---
def actualizar_base_de_datos(ruta_antigua, ruta_nueva, datos, miniatura_base64=None):
    partes_ruta = ruta_antigua.split('/')
    uid_usuario = partes_ruta[1] if len(partes_ruta) > 1 else None

    docs = list(db.collection('gastos').where('ruta', '==', ruta_antigua).stream())
    if not docs: return
    
    doc_actual = docs[0]
    es_duplicado = False
    
    if uid_usuario:
        if datos['rut'] != "S/R" and datos['numero_documento'] != "":
            sospechosos = db.collection('gastos').where('uid', '==', uid_usuario)\
                .where('rut', '==', datos['rut'])\
                .where('tipoDocumento', '==', datos['tipo_documento'])\
                .where('numeroDocumento', '==', datos['numero_documento']).stream()
                
            for s in sospechosos:
                if s.id != doc_actual.id:
                    es_duplicado = True
                    break
        elif datos['rut'] != "S/R" and datos['total'] > 0 and datos['fecha'] != "S/F":
            sospechosos = db.collection('gastos').where('uid', '==', uid_usuario)\
                .where('rut', '==', datos['rut'])\
                .where('fechaDetectada', '==', datos['fecha'])\
                .where('monto', '==', datos['total']).stream()
                
            for s in sospechosos:
                if s.id != doc_actual.id:
                    es_duplicado = True
                    break

    if es_duplicado:
        nuevo_estado = 'Duplicado'
    elif datos['total'] > 0:
        nuevo_estado = 'Procesado'
    else:
        nuevo_estado = 'Revisar Manualmente'
        
    nombre_comercio = datos['comercio'] 
    if datos['total'] == 0: nombre_comercio = '⚠️ Documento poco legible'

    campos_a_actualizar = {
        'ruta': ruta_nueva, 'estado': nuevo_estado,
        'monto': datos['total'], 'iva': datos['iva'], 'fechaDetectada': datos['fecha'],
        'fechaProceso': datetime.now(), 'comercio': nombre_comercio,
        'rut': datos['rut'], 'glosa': datos['glosa'], 'giro': datos['giro'],
        'tipoDocumento': datos['tipo_documento'], 'numeroDocumento': datos['numero_documento'],
        'categoriaComercio': datos.get('categoriaComercio', 'Otro')
    }
    
    if miniatura_base64:
        campos_a_actualizar['miniaturaBase64'] = miniatura_base64

    doc_actual.reference.update(campos_a_actualizar)
    print(f" ✅ BD Actualizada: {datos['tipo_documento']} N°{datos['numero_documento']} - {nombre_comercio} | IVA Extraído: {datos['iva']}")

# --- LÓGICA DE COLABORADORES ---
def registrar_colaborador(db_client, datos):
    try:
        user = firebase_auth.create_user(
            email=datos['correo'],
            password=datos['password'],
            display_name=f"{datos['nombre']} {datos['apellido']}"
        )
        
        perfil_trabajador = {
            'uid': user.uid,
            'email': datos['correo'],
            'nombre': datos['nombre'],
            'apellido': datos['apellido'],
            'rut': datos['rut'],
            'funcion': datos['funcion'],
            'correoContacto': datos.get('correo_contacto', ''),
            'telefonoContacto': datos.get('telefono_contacto', ''),
            'rol': 'trabajador', 
            'empresaId': datos['empresa_uid'], 
            'fechaRegistro': datetime.now(),
            'estado': 'activo'
        }
        
        db_client.collection('usuarios').document(user.uid).set(perfil_trabajador)
        
        empresa_ref = db_client.collection('usuarios').document(datos['empresa_uid'])
        empresa_doc = empresa_ref.get()
        if empresa_doc.exists:
            actuales = empresa_doc.to_dict().get('colaboradoresActivos', 0)
            empresa_ref.update({'colaboradoresActivos': actuales + 1})
            
        print(f"✅ Colaborador creado: {datos['nombre']} ({datos['correo']})")
        return {"status": "ok", "uid": user.uid, "mensaje": "Colaborador creado exitosamente"}

    except Exception as e:
        print(f"❌ Error al crear colaborador: {e}")
        return {"status": "error", "mensaje": str(e)}

# --- ENDPOINTS ---
@app.route('/procesar_boleta', methods=['POST'])
def procesar_boleta_endpoint():
    req_data = request.get_json()
    ruta_archivo = req_data.get('ruta_archivo')

    if not ruta_archivo: return jsonify({"error": "No se proporcionó ruta_archivo"}), 400
    print(f"🚀 Iniciando procesamiento veloz para: {ruta_archivo}")
    
    try:
        bucket = storage.bucket()
        blob = bucket.blob(ruta_archivo)
        
        if not blob.exists(): return jsonify({"error": "El archivo no existe en Storage"}), 404

        partes = ruta_archivo.split('/')
        imagen_bytes = blob.download_as_bytes()
        es_pdf = ruta_archivo.lower().endswith('.pdf')
        mime_type = "application/pdf" if es_pdf else "image/jpeg"
        
        miniatura_base64 = generar_miniatura_base64(imagen_bytes, es_pdf)
        texto = detectar_texto_vision(imagen_bytes, mime_type)
        
        # --- 1. INTENTO DE EXTRACCIÓN CON IA (GEMINI 1.5 FLASH) ---
        datos = extraer_datos_con_ia(texto)
        
        # --- 2. FALLBACK A REGEX SI LA IA FALLA ---
        if not datos:
            print("⚠️ IA no pudo generar un JSON válido. Cayendo a extracción por Regex de respaldo.")
            datos = extraer_datos(texto)
            datos['categoriaComercio'] = clasificar_gasto(datos['comercio'], texto)
        else:
            print("✨ IA Google extrajo datos exitosamente.")
            # Asegurar que todas las claves requeridas existan en el diccionario devuelto por Gemini
            datos.setdefault("total", 0)
            datos.setdefault("iva", 0)
            datos.setdefault("fecha", "S/F")
            datos.setdefault("rut", "S/R")
            datos.setdefault("comercio", "Comercio Desconocido")
            datos.setdefault("giro", "S/G")
            datos.setdefault("tipo_documento", "Boleta")
            datos.setdefault("numero_documento", "")
            
            # Clasificamos la categoría con el nombre limpio detectado
            datos['categoriaComercio'] = clasificar_gasto(datos['comercio'], texto)

        if datos['rut'] != "S/R":
            info_sii = consultar_rut_sii(datos['rut'])
            if info_sii:
                datos['giro'] = info_sii['giro']
                if datos['comercio'] == "Comercio Desconocido" or len(datos['comercio']) < 3:
                    datos['comercio'] = info_sii['razon_social']
        
        datos['categoriaComercio'] = clasificar_gasto(datos['comercio'], texto)
        
        nueva_ruta = f"usuarios/{partes[1]}/procesados/{partes[3]}"
        new_blob = bucket.rename_blob(blob, nueva_ruta)
        new_blob.metadata = {"firebaseStorageDownloadTokens": str(uuid.uuid4())}
        new_blob.patch()
        
        actualizar_base_de_datos(ruta_archivo, nueva_ruta, datos, miniatura_base64)

        return jsonify({"status": "exito", "datos": datos}), 200

    except Exception as e:
        print(f"❌ Error procesando: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/crear_colaborador', methods=['POST'])
def crear_colaborador_endpoint():
    datos = request.get_json()
    if not datos or not datos.get('correo') or not datos.get('empresa_uid'):
        return jsonify({"error": "Faltan datos obligatorios"}), 400
        
    resultado = registrar_colaborador(db, datos)
    
    if resultado['status'] == 'ok':
        return jsonify(resultado), 200
    else:
        return jsonify({"error": resultado['mensaje']}), 500

@app.route('/consultar_rut', methods=['POST'])
def consultar_rut_endpoint():
    datos = request.get_json()
    rut = datos.get('rut') if datos else None
    
    if not rut:
        return jsonify({"error": "No se proporcionó el RUT"}), 400
        
    try:
        # Llamamos a la función existente que raspa el SII
        info_sii = consultar_rut_sii(rut)
        
        if info_sii:
            return jsonify({
                "status": "exito",
                "razon_social": info_sii.get('razon_social', ''),
                "giro": info_sii.get('giro', '')
            }), 200
        else:
            return jsonify({"error": "No se encontró información o el RUT no es de empresa"}), 404
            
    except Exception as e:
        print(f"❌ Error al consultar SII independientemente: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    puerto = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=puerto, debug=False)