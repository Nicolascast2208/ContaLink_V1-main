from firebase_admin import credentials, storage
import firebase_admin
from PIL import Image
import io
import pillow_heif

# Registrar soporte para HEIC/HEIF (formato de iPhone)
pillow_heif.register_heif_opener()

BUCKET_NAME = "contalink-14cd6.firebasestorage.app"
cred = credentials.Certificate("credenciales_firebase.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred, {'storageBucket': BUCKET_NAME})

bucket = storage.bucket()

print("🔧 INTENTANDO REPARAR IMÁGENES EN ERRORES\n")
print("=" * 60)

# Obtener todos los archivos en errores
errores = list(bucket.list_blobs(prefix="usuarios/"))
archivos_error = [b for b in errores if '/errores/' in b.name and not b.name.endswith('/')]

if not archivos_error:
    print("✅ No hay archivos en la carpeta de errores")
    exit()

print(f"Encontrados {len(archivos_error)} archivo(s) en errores\n")

for blob in archivos_error:
    print(f"📄 Procesando: {blob.name}")
    
    try:
        # Descargar
        imagen_bytes = blob.download_as_bytes()
        print(f"   Descargado: {len(imagen_bytes)} bytes")
        
        if len(imagen_bytes) == 0:
            print(f"   ❌ Archivo vacío - No se puede reparar")
            continue
        
        # Analizar magic bytes
        magic = imagen_bytes[:4].hex()
        print(f"   Magic bytes: {magic}")
        
        # Intentar varias estrategias de reparación
        reparado = False
        
        # Estrategia 1: Intentar abrir directamente con PIL (ahora con soporte HEIC)
        try:
            img = Image.open(io.BytesIO(imagen_bytes))
            img.verify()
            
            # Re-abrir para convertir (verify() cierra el archivo)
            img = Image.open(io.BytesIO(imagen_bytes))
            
            # Si es HEIC, informar la conversión
            if img.format in ('HEIF', 'HEIC'):
                print(f"   📱 Detectado formato HEIC (iPhone) - Convirtiendo a JPEG")
            
            # Convertir a RGB si es necesario
            if img.mode not in ('RGB', 'L'):
                print(f"   🔄 Convirtiendo de {img.mode} a RGB")
                img = img.convert('RGB')
            
            # Guardar en un buffer limpio como JPEG
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=95)
            imagen_reparada = buffer.getvalue()
            
            print(f"   ✅ Imagen reparada: {len(imagen_reparada)} bytes")
            reparado = True
            
        except Exception as e:
            print(f"   ❌ No se pudo reparar con PIL: {e}")
            
            # Estrategia 2: Verificar si tiene contenido JPEG pero está truncada
            if imagen_bytes[:2] == b'\xff\xd8':  # JPEG magic bytes
                print(f"   ℹ️ Tiene headers JPEG pero puede estar truncada")
                # Intentar agregar EOI marker si falta
                if not imagen_bytes.endswith(b'\xff\xd9'):
                    print(f"   🔧 Intentando agregar EOI marker...")
                    imagen_reparada = imagen_bytes + b'\xff\xd9'
                    
                    try:
                        img = Image.open(io.BytesIO(imagen_reparada))
                        img.verify()
                        print(f"   ✅ Reparación exitosa agregando EOI")
                        reparado = True
                    except:
                        print(f"   ❌ Reparación con EOI falló")
        
        # Si se reparó, mover de vuelta a boletas
        if reparado:
            # Extraer info de la ruta
            partes = blob.name.split('/')
            uid = partes[1]
            filename = partes[3]
            
            # Nueva ruta en boletas
            nueva_ruta = f"usuarios/{uid}/boletas/{filename}"
            nuevo_blob = bucket.blob(nueva_ruta)
            
            # Subir imagen reparada
            nuevo_blob.upload_from_string(
                imagen_reparada,
                content_type='image/jpeg'
            )
            
            # Eliminar de errores
            blob.delete()
            
            print(f"   ✅ Movida de vuelta a boletas para reprocesar")
        else:
            print(f"   ⚠️ No se pudo reparar - requiere revisión manual")
            
    except Exception as e:
        print(f"   ❌ Error general: {e}")
    
    print()

print("=" * 60)
print("✅ Proceso de reparación completado")
print("\n💡 Ejecuta cerebro.py para procesar las imágenes reparadas")
