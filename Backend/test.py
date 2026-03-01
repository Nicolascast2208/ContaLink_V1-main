from firebase_admin import credentials, storage
import firebase_admin
from PIL import Image
import io

BUCKET_NAME = "contalink-14cd6.firebasestorage.app"
cred = credentials.Certificate("credenciales_firebase.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {'storageBucket': BUCKET_NAME})

bucket = storage.bucket()

print("🔍 DIAGNÓSTICO COMPLETO DE FIREBASE STORAGE\n")
print("=" * 60)

# Listar TODOS los archivos en el bucket
print("\n📂 Listando todos los archivos en usuarios/...")
blobs = list(bucket.list_blobs(prefix="usuarios/"))

if not blobs:
    print("❌ No hay archivos en el bucket")
    exit()

# Organizar por carpetas
errores = []
boletas = []
procesados = []
otros = []

for blob in blobs:
    if not blob.name.endswith('/'):  # Ignorar "carpetas"
        if '/errores/' in blob.name:
            errores.append(blob)
        elif '/boletas/' in blob.name:
            boletas.append(blob)
        elif '/procesados/' in blob.name:
            procesados.append(blob)
        else:
            otros.append(blob)

print(f"\n📊 RESUMEN:")
print(f"   🔴 Errores: {len(errores)}")
print(f"   📄 Boletas pendientes: {len(boletas)}")
print(f"   ✅ Procesados: {len(procesados)}")
print(f"   📁 Otros: {len(otros)}")

# Mostrar archivos en errores
if errores:
    print(f"\n{'='*60}")
    print("🔴 ARCHIVOS EN ERRORES:")
    print(f"{'='*60}")
    for blob in errores:
        print(f"\n📍 {blob.name}")
        print(f"   Tamaño: {blob.size} bytes")
        print(f"   Tipo: {blob.content_type}")
        
        # Descargar y analizar
        try:
            imagen_bytes = blob.download_as_bytes()
            print(f"   Descargado: {len(imagen_bytes)} bytes")
            
            # Intentar abrir con PIL
            try:
                img = Image.open(io.BytesIO(imagen_bytes))
                print(f"   ✅ Es una imagen válida: {img.format} {img.size}")
            except Exception as e:
                print(f"   ❌ Error PIL: {e}")
                
                # Analizar los primeros bytes
                if len(imagen_bytes) > 0:
                    primeros = imagen_bytes[:20].hex()
                    print(f"   🔬 Primeros bytes (hex): {primeros}")
                    
                    # Detectar tipo de archivo por magic bytes
                    if imagen_bytes[:2] == b'\xff\xd8':
                        print(f"   📌 Magic bytes indican: JPEG válido")
                    elif imagen_bytes[:8] == b'\x89PNG\r\n\x1a\n':
                        print(f"   📌 Magic bytes indican: PNG válido")
                    elif imagen_bytes[:2] == b'BM':
                        print(f"   📌 Magic bytes indican: BMP válido")
                    else:
                        print(f"   ⚠️ Magic bytes no reconocidos - NO es imagen estándar")
                
                # Guardar para inspección manual
                nombre_local = blob.name.split('/')[-1]
                with open(f"error_{nombre_local}", "wb") as f:
                    f.write(imagen_bytes)
                print(f"   💾 Guardado como: error_{nombre_local}")
        except Exception as e:
            print(f"   ❌ Error descargando: {e}")

# Mostrar archivos pendientes
if boletas:
    print(f"\n{'='*60}")
    print("📄 BOLETAS PENDIENTES:")
    print(f"{'='*60}")
    for blob in boletas:
        print(f"\n📍 {blob.name}")
        print(f"   Tamaño: {blob.size} bytes")
        print(f"   Tipo: {blob.content_type}")

print(f"\n{'='*60}")
print("✅ Diagnóstico completo")