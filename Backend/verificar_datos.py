import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore as google_firestore

# --- CONFIGURACIÓN ---
cred_firebase = credentials.Certificate("credenciales_firebase.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred_firebase)

db = google_firestore.Client(
    project="contalink-14cd6", 
    credentials=cred_firebase.get_credential(), 
    database="bd-contalink"
)

print("🔍 VERIFICANDO DATOS EXTRAÍDOS EN FIRESTORE\n")
print("=" * 80)

# Obtener TODOS los gastos (sin filtrar por estado)
gastos = db.collection('gastos').limit(15).stream()

contador = 0
for gasto in gastos:
    datos = gasto.to_dict()
    contador += 1
    
    print(f"\n📄 GASTO #{contador}")
    print(f"   {'Comercio:':<15} {datos.get('comercio', 'N/A')}")
    print(f"   {'Monto:':<15} ${datos.get('monto', 0):,}")
    print(f"   {'RUT:':<15} {datos.get('rut', 'S/R')}")
    print(f"   {'Giro:':<15} {datos.get('giro', 'S/G')}")
    print(f"   {'Fecha:':<15} {datos.get('fechaDetectada', 'S/F')}")
    print(f"   {'Hora:':<15} {datos.get('hora', 'S/H')}")
    print(f"   {'Estado:':<15} {datos.get('estado', 'N/A')}")
    print("   " + "-" * 60)

if contador == 0:
    print("❌ No se encontraron gastos procesados")
else:
    print(f"\n✅ Total de gastos mostrados: {contador}")

print("\n" + "=" * 80)
