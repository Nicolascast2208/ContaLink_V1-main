from firebase_admin import credentials, storage
import firebase_admin

BUCKET_NAME = "contalink-14cd6.firebasestorage.app"
cred = credentials.Certificate("credenciales_firebase.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {'storageBucket': BUCKET_NAME})

bucket = storage.bucket()

print("🔄 MOVIENDO BOLETAS PROCESADAS A PENDIENTES PARA REPROCESAR\n")
print("=" * 60)

# Obtener todos los archivos procesados
procesados = list(bucket.list_blobs(prefix="usuarios/"))
archivos_procesados = [b for b in procesados if '/procesados/' in b.name and not b.name.endswith('/')]

if not archivos_procesados:
    print("✅ No hay archivos procesados para mover")
    exit()

print(f"Encontrados {len(archivos_procesados)} archivo(s) procesados\n")

for blob in archivos_procesados:
    print(f"📄 Procesando: {blob.name}")
    
    try:
        # Extraer info de la ruta
        partes = blob.name.split('/')
        uid = partes[1]
        filename = partes[3]
        
        # Nueva ruta en boletas
        nueva_ruta = f"usuarios/{uid}/boletas/{filename}"
        
        # Mover de procesados a boletas
        bucket.rename_blob(blob, nueva_ruta)
        print(f"   ✅ Movido a: boletas/{filename}")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
print("\n" + "=" * 60)
print("✅ Proceso completado - Las boletas están listas para reprocesar")
print("\n💡 Ejecuta: python3 cerebro.py")
