import os
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials
from categorizador import clasificar_gasto

# Inicializar Firebase
cred = credentials.Certificate("credenciales_firebase.json")
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.Client(project="contalink-14cd6", credentials=cred.get_credential(), database="bd-contalink")

def backfill():
    gastos_ref = db.collection('gastos')
    gastos = list(gastos_ref.stream())
    
    actualizados = 0
    for doc in gastos:
        data = doc.to_dict()
        comercio = data.get('comercio', '')
        
        # Reclasificar "Farmacia y Salud", "Procesando..." u "Otro"
        cat_actual = data.get('categoriaComercio', '')
        if cat_actual and cat_actual not in ['Procesando...', 'Otro', 'Farmacia y Salud']:
            continue
            
        print(f"🔄 Categorizando {comercio}...")
        
        # Como no tenemos el texto completo, usamos el nombre del comercio y giro (si existe)
        giro = data.get('giro', '')
        texto_boleta = f"Giro: {giro}"
        
        categoria = clasificar_gasto(comercio, texto_boleta)
        
        doc.reference.update({'categoriaComercio': categoria})
        print(f"✅ {comercio} -> {categoria}")
        actualizados += 1
        
    print(f"✅ Proceso terminado. {actualizados} boletas actualizadas.")

if __name__ == "__main__":
    backfill()
