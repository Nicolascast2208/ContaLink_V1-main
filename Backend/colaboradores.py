from firebase_admin import auth
from datetime import datetime

def registrar_colaborador(db, datos):
    try:
        # 1. Crear la cuenta en Firebase Auth (Esto no cierra la sesión actual en la app)
        user = auth.create_user(
            email=datos['correo'],
            password=datos['password'],
            display_name=f"{datos['nombre']} {datos['apellido']}"
        )
        
        # 2. Preparar los datos del trabajador para la base de datos
        perfil_trabajador = {
            'uid': user.uid,
            'email': datos['correo'],
            'nombre': datos['nombre'],
            'apellido': datos['apellido'],
            'rut': datos['rut'],
            'funcion': datos['funcion'],
            'correoContacto': datos.get('correo_contacto', ''),
            'telefonoContacto': datos.get('telefono_contacto', ''),
            'rol': 'trabajador', # Rol clave para el nuevo flujo
            'empresaId': datos['empresa_uid'], # Vinculamos al trabajador con su jefe
            'fechaRegistro': datetime.now(),
            'estado': 'activo'
        }
        
        # 3. Guardar en la colección 'usuarios'
        db.collection('usuarios').document(user.uid).set(perfil_trabajador)
        
        # 4. Actualizar el contador de la empresa
        empresa_ref = db.collection('usuarios').document(datos['empresa_uid'])
        empresa_doc = empresa_ref.get()
        if empresa_doc.exists:
            actuales = empresa_doc.to_dict().get('colaboradoresActivos', 0)
            empresa_ref.update({'colaboradoresActivos': actuales + 1})
            
        print(f"✅ Colaborador creado: {datos['nombre']} ({datos['correo']})")
        return {"status": "ok", "uid": user.uid, "mensaje": "Colaborador creado exitosamente"}

    except Exception as e:
        print(f"❌ Error al crear colaborador: {e}")
        return {"status": "error", "mensaje": str(e)}