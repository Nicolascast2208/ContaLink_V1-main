import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '../utils/firebaseconfig';

// URL de tu servidor Python (Cloud Run)
const API_URL = "https://cerebro-api-807808449081.us-central1.run.app/procesar_boleta";

export const useGastos = (user: any) => {
  const [boletas, setBoletas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);

  // Escucha boletas en tiempo real
  useEffect(() => {
    if (!user) { setBoletas([]); return; }
    const q = query(collection(db, "gastos"), where("uid", "==", user.uid), orderBy("fechaSubida", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBoletas(docs);
      setLoading(false);
    });

    // Cargar nombre de la empresa
    const fetchEmpresa = async () => {
      try {
        const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (perfilSnap.exists()) {
          const data = perfilSnap.data();
          const { empresaId, rol } = data;

          // Si el trabajador ya tiene el nombre guardado en su perfil, usamos ese.
          if (data.empresaNombre) {
            setEmpresaNombre(data.empresaNombre);
            return;
          }

          const idEmpresaBuscar = rol === 'admin_empresa' ? user.uid : empresaId;

          if (idEmpresaBuscar) {
            // Intento 1: Buscar la Razón Social en el perfil del Administrador (tabla usuarios)
            try {
              const adminSnap = await getDoc(doc(db, "usuarios", idEmpresaBuscar));
              if (adminSnap.exists() && adminSnap.data().razonSocial) {
                setEmpresaNombre(adminSnap.data().razonSocial);
                return; // Éxito
              }
            } catch (errAdmin) {
              console.log("No se pudo leer el perfil del admin");
            }

            // Intento 2: Buscar en la colección empresas (por si existe)
            try {
              const empresaSnap = await getDoc(doc(db, "empresas", idEmpresaBuscar));
              if (empresaSnap.exists() && empresaSnap.data().nombre) {
                setEmpresaNombre(empresaSnap.data().nombre);
                return; // Éxito
              }
            } catch (err) {
              console.log("No se pudo leer la colección de empresas por permisos.");
            }

            // Si todo falla, mostrar nombre genérico
            setEmpresaNombre("Mi Organización");
          }
        }
      } catch (error) {
        console.log("Error al cargar el perfil del usuario:", error);
      }
    };
    fetchEmpresa();

    return () => unsubscribe();
  }, [user]);

  // Esta función crea el archivo directo en la memoria del celular.
  const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log("XHR Error:", e);
        reject(new TypeError("Fallo la conversión nativa a Blob"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  // Función Agregar Gasto (SOPORTA PDF Y FLUJO DE EMPRESA)
  const agregarGasto = async (fileUri: string, isPdf: boolean = false) => {
    try {
      console.log("Procesando URI (Modo Nativo):", fileUri);
      const blob = await uriToBlob(fileUri);
      if (blob.size === 0) throw new Error("Error: El archivo está vacío.");

      const extension = isPdf ? 'pdf' : 'jpg';
      const filename = `documento_${Date.now()}.${extension}`;
      const rutaStorage = `usuarios/${user.uid}/boletas/${filename}`;
      const storageRef = ref(storage, rutaStorage);

      await uploadBytes(storageRef, blob);
      // @ts-ignore
      blob.close && blob.close();

      // --- NUEVO: OBTENER PERFIL PARA SABER SI ES TRABAJADOR ---
      const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));
      const perfilData = perfilSnap.exists() ? perfilSnap.data() : null;

      const esTrabajador = perfilData?.rol === 'trabajador';
      const esAdminEmpresa = perfilData?.rol === 'admin_empresa';
      const assignedEmpresaId = esAdminEmpresa ? user.uid : (perfilData?.empresaId || null);

      // Guardar datos en Firestore 
      await addDoc(collection(db, "gastos"), {
        uid: user.uid,
        archivo: filename,
        ruta: rutaStorage,
        fechaSubida: serverTimestamp(),
        estado: "Pendiente", // Estado de la IA
        categoriaComercio: "Procesando...",
        monto: 0,
        iva: 0,
        comercio: "Procesando...",
        rut: "",
        giro: "",
        glosa: "",
        fechaDetectada: "",
        tipoDocumento: "Boleta",
        numeroDocumento: "",
        // --- CAMPOS DE APROBACIÓN EMPRESARIAL ---
        empresaId: assignedEmpresaId,
        estadoAprobacion: 'Pendiente', // Todos entran a ciclo de revisión, incluyendo al Admin
        nombreTrabajador: esTrabajador
          ? `${perfilData.nombre} ${perfilData.apellido}`
          : (perfilData.nombre ? `${perfilData.nombre} ${perfilData.apellido || ''}`.trim() : 'Propietario (Admin)')
      });

      // Llamar al cerebro en Python
      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruta_archivo: rutaStorage })
        });
      } catch (apiError) {
        console.error("Error llamando a la IA:", apiError);
      }
      return true;
    } catch (e: any) {
      console.error(e);
      throw new Error("No se pudo agregar el gasto: " + e.message);
    }
  };

  const eliminarGasto = async (id: string, ruta: string) => {
    try {
      if (ruta) {
        const fileRef = ref(storage, ruta);
        await deleteObject(fileRef).catch(e => console.log("Archivo ya eliminado o sin acceso", e));
      }
      await deleteDoc(doc(db, "gastos", id));
      return true;
    } catch (e: any) {
      console.error(e);
      throw new Error("No se pudo eliminar el gasto: " + e.message);
    }
  };

  // --- FUNCIÓN EDITAR ACTUALIZADA PARA RECIBIR EL IVA ---
  const editarGasto = async (
    id: string,
    nuevoComercio: string,
    nuevoMonto: number,
    nuevoRut: string,
    nuevoGiro: string,
    nuevaFecha: string,
    nuevaGlosa: string,
    nuevoTipoDoc: string,
    nuevoNumeroDoc: string,
    nuevoIva: number // <-- NUEVO: Recibimos el parámetro del IVA
  ) => {
    try {
      const docRef = doc(db, "gastos", id);
      await updateDoc(docRef, {
        comercio: nuevoComercio,
        monto: nuevoMonto,
        iva: nuevoIva, // <-- NUEVO: Guardamos el IVA editado en Firebase
        rut: nuevoRut,
        giro: nuevoGiro,
        fechaDetectada: nuevaFecha,
        glosa: nuevaGlosa,
        tipoDocumento: nuevoTipoDoc,
        numeroDocumento: nuevoNumeroDoc
      });
    } catch (error) { throw error; }
  };

  return { boletas, loading, empresaNombre, agregarGasto, eliminarGasto, editarGasto };
};