import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, FlatList, Modal, KeyboardAvoidingView, Platform, Share, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDoc, getDocs } from 'firebase/firestore';

import { auth, db } from '../../utils/firebaseconfig';

const API_URL = "https://cerebro-api-807808449081.us-central1.run.app/crear_colaborador";

const limpiarTexto = (texto: string) => {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
};

// --- FUNCIONES DE RUT ---
const formatearRutVisual = (rut: string) => {
  const valorLimpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (valorLimpio.length <= 1) return valorLimpio;
  const cuerpo = valorLimpio.slice(0, -1);
  const dv = valorLimpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFormateado}-${dv}`;
};

const limpiarRut = (rut: string) => rut.replace(/[^0-9kK]/g, '').toUpperCase();

export default function EmpresaColaboradoresScreen() {
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modales
  const [modalCreateVisible, setModalCreateVisible] = useState(false);
  const [modalEditVisible, setModalEditVisible] = useState(false);

  // Estados de Carga
  const [creando, setCreando] = useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Estado para la creación exitosa
  const [credencialesGeneradas, setCredencialesGeneradas] = useState<{ correo: string, pass: string } | null>(null);

  // Guardamos las credenciales almacenadas en el perfil del admin
  const [credencialesAdmin, setCredencialesAdmin] = useState<any>({});

  // Estados del Formulario (Compartido para Crear y Editar)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [rut, setRut] = useState('');
  const [funcion, setFuncion] = useState('');

  // Campos de Contacto
  const [correoContacto, setCorreoContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'usuarios'),
      where('empresaId', '==', auth.currentUser.uid),
      where('rol', '==', 'trabajador')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setColaboradores(lista);
      setLoading(false);
    });

    // Escuchador de credenciales en el perfil del Administrador
    let unsubAdmin: () => void;
    if (auth.currentUser) {
      unsubAdmin = onSnapshot(doc(db, 'usuarios', auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setCredencialesAdmin(docSnap.data().credencialesColaboradores || {});
        }
      });
    }

    return () => {
      unsubscribe();
      if (unsubAdmin) unsubAdmin();
    };
  }, []);

  // --- FUNCIÓN: CREAR ---
  const handleCrearColaborador = async () => {
    if (!nombre.trim() || !apellido.trim() || !rut.trim() || !funcion.trim() || !correoContacto.trim() || !telefonoContacto.trim()) {
      Alert.alert("Error", "Todos los campos son obligatorios, incluyendo correo y teléfono de contacto.");
      return;
    }

    setCreando(true);
    try {
      const cleanNombre = limpiarTexto(nombre);
      const cleanApellido = limpiarTexto(apellido);
      const randomNum = Math.floor(Math.random() * 100);

      // --- Lógica Inteligente de Dominios ---
      const dominiosGenericos = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.es', 'outlook.com', 'live.com', 'icloud.com'];
      const adminEmail = auth.currentUser?.email || '';
      const dominioAdmin = adminEmail.split('@')[1] || '';

      let dominioFinal = 'rindefy.app';

      if (dominiosGenericos.includes(dominioAdmin) || !dominioAdmin) {
        // Dominio genérico => crear subdominio basado en el nombre de la empresa
        const nombreEmpresa = auth.currentUser?.displayName ? limpiarTexto(auth.currentUser.displayName) : 'empresa';
        dominioFinal = `${nombreEmpresa}.rindefy.app`;
      } else {
        // Dominio corporativo privado => usar el mismo que el dueño
        dominioFinal = dominioAdmin;
      }

      const correoGenerado = `${cleanNombre}.${cleanApellido}${randomNum}@${dominioFinal}`;
      const passwordGenerada = `${cleanNombre.charAt(0).toUpperCase()}${cleanApellido}${Math.floor(1000 + Math.random() * 9000)}`;

      const payload = {
        empresa_uid: auth.currentUser?.uid,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        rut: limpiarRut(rut),
        funcion: funcion.trim(),
        correo_contacto: correoContacto.trim(),
        telefono_contacto: telefonoContacto.trim(),
        correo: correoGenerado,
        password: passwordGenerada
      };

      const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await respuesta.json();
      if (!respuesta.ok) throw new Error(data.error || "Error desconocido");

      // Guardamos la credencial generada directamente dentro del perfil DOC del administrador
      // Esto evita bloqueos de Reglas de Firebase al intentar editar el DOC de un "trabajador".
      try {
        const rutLimpio = limpiarRut(rut);
        await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), {
          [`credencialesColaboradores.${rutLimpio}`]: {
            correo: correoGenerado,
            password: passwordGenerada
          }
        });
      } catch (err) {
        console.error("Error guardando credenciales en perfil del admin:", err);
      }

      setCredencialesGeneradas({ correo: correoGenerado, pass: passwordGenerada });

    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setCreando(false);
    }
  };

  // --- FUNCIÓN: COMPARTIR CREDENCIALES NATIVAMENTE ---
  const handleCompartirCredenciales = async () => {
    if (!credencialesGeneradas) return;
    try {
      const mensaje = `¡Hola! Bienvenido a Rindefy. Aquí tienes tus credenciales de acceso:\n\n👤 Correo: ${credencialesGeneradas.correo}\n🔑 Contraseña: ${credencialesGeneradas.pass}\n\nPor favor, ingresa a la app con estos datos.`;

      await Share.share({
        message: mensaje,
      });
    } catch (error: any) {
      Alert.alert("Error", "No se pudo abrir el menú para compartir.");
    }
  };

  // --- FUNCIÓN: GENERAR LINK DE INVITACIÓN ---
  const handleGenerarLink = async () => {
    if (!auth.currentUser) return;
    try {
      // Obtenemos el nombre de la empresa para personalizar el mensaje
      const empresaRef = doc(db, 'usuarios', auth.currentUser.uid);
      const empresaSnap = await getDoc(empresaRef);
      let nombreEmpresa = "nuestra empresa";

      if (empresaSnap.exists() && empresaSnap.data().razonSocial) {
        nombreEmpresa = empresaSnap.data().razonSocial;
      }

      // Generar link profundo de Expo
      const redirectUrl = Linking.createURL('invite', {
        queryParams: { empresaId: auth.currentUser.uid, empresaNombre: nombreEmpresa }
      });

      const mensaje = `¡Hola! Te invito a unirte como colaborador a ${nombreEmpresa} en Rindefy.\n\nInstala la aplicación y luego haz clic en este enlace para crear tu cuenta:\n${redirectUrl}`;

      await Share.share({ message: mensaje });
    } catch (error) {
      console.error("Error al generar el link:", error);
      Alert.alert("Error", "No se pudo generar el enlace de invitación.");
    }
  };

  const handleMenuAgregar = () => {
    Alert.alert(
      "Agregar Colaborador",
      "¿Cómo deseas agregar a tu nuevo colaborador?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Agregar Manualmente", onPress: () => setModalCreateVisible(true) },
        { text: "Generar Link de Invitación", onPress: handleGenerarLink }
      ]
    );
  };

  // --- FUNCIÓN: INICIAR EDICIÓN ---
  const [editingCredenciales, setEditingCredenciales] = useState<{ correo: string, password: string } | null>(null);

  const abrirModalEdicion = (colaborador: any) => {
    setEditingId(colaborador.id);
    setNombre(colaborador.nombre);
    setApellido(colaborador.apellido);
    const colaboradorRut = formatearRutVisual(colaborador.rut || '');
    setRut(colaboradorRut);
    setFuncion(colaborador.funcion);
    setCorreoContacto(colaborador.correoContacto || '');
    setTelefonoContacto(colaborador.telefonoContacto || '');

    // Obtenemos si existen credenciales guardadas en el DOC del Admin para este RUT
    const credencialesGuardadas = credencialesAdmin[limpiarRut(colaborador.rut || '')];
    setEditingCredenciales(credencialesGuardadas || null);

    setModalEditVisible(true);
  };

  // --- FUNCIÓN: GUARDAR EDICIÓN ---
  const handleGuardarEdicion = async () => {
    if (!nombre.trim() || !apellido.trim() || !rut.trim() || !funcion.trim() || !correoContacto.trim() || !telefonoContacto.trim()) {
      Alert.alert("Error", "Todos los campos son obligatorios, incluyendo correo y teléfono de contacto.");
      return;
    }

    setGuardandoEdicion(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'usuarios', editingId), {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          rut: limpiarRut(rut),
          funcion: funcion.trim(),
          correoContacto: correoContacto.trim(),
          telefonoContacto: telefonoContacto.trim()
        });
        Alert.alert("Actualizado", "Los datos del colaborador se actualizaron correctamente.");
        cerrarModales();
      }
    } catch (error: any) {
      Alert.alert("Error", "No se pudo actualizar la información.");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // --- FUNCIÓN: ELIMINAR ---
  const handleEliminarColaborador = (id: string, nombreColab: string) => {
    Alert.alert(
      "Desvincular Colaborador",
      `¿Estás seguro que deseas eliminar a ${nombreColab}? Perderá el acceso a la plataforma de tu empresa de forma irreversible.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'usuarios', id));
              if (auth.currentUser) {
                const empresaRef = doc(db, 'usuarios', auth.currentUser.uid);
                const empresaSnap = await getDoc(empresaRef);
                if (empresaSnap.exists()) {
                  const actuales = empresaSnap.data().colaboradoresActivos || 1;
                  await updateDoc(empresaRef, { colaboradoresActivos: actuales - 1 });
                }
              }
            } catch (error) {
              Alert.alert("Error", "Hubo un problema al intentar eliminar al colaborador.");
            }
          }
        }
      ]
    );
  };

  const cerrarModales = () => {
    setModalCreateVisible(false);
    setModalEditVisible(false);
    setCredencialesGeneradas(null);
    setEditingId(null);
    setNombre(''); setApellido(''); setRut(''); setFuncion('');
    setCorreoContacto(''); setTelefonoContacto('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Colaboradores</Text>
      </View>

      {/* --- LISTA DE TRABAJADORES --- */}
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={colaboradores}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>Aún no tienes colaboradores.</Text>
              <Text style={styles.emptySubText}>Toca el botón + para agregar uno.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.nombre.charAt(0)}{item.apellido.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre} {item.apellido}</Text>
                <Text style={styles.cardSub} numberOfLines={1}>{item.funcion}</Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => abrirModalEdicion(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleEliminarColaborador(item.id, item.nombre)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* BOTÓN FLOTANTE (+) PARA CREAR */}
      <TouchableOpacity style={styles.fab} onPress={handleMenuAgregar}>
        <Ionicons name="add" size={35} color="white" />
      </TouchableOpacity>

      {/* ==========================================================
          MODAL 1: CREAR COLABORADOR Y MOSTRAR CREDENCIALES
          ========================================================== */}
      <Modal visible={modalCreateVisible} transparent={true} animationType="slide" onRequestClose={cerrarModales}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackground}>
          <View style={styles.modalContent}>

            {credencialesGeneradas ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#34C759" />
                <Text style={styles.successTitle}>¡Colaborador Creado!</Text>
                <Text style={styles.successSubtitle}>Entrega estos datos a tu trabajador para que inicie sesión en Rindefy:</Text>

                <View style={styles.credentialsBox}>
                  <Text style={styles.credLabel}>Correo Electrónico:</Text>
                  <Text style={styles.credValue} selectable={true}>{credencialesGeneradas.correo}</Text>

                  <Text style={[styles.credLabel, { marginTop: 15 }]}>Contraseña Temporal:</Text>
                  <Text style={styles.credValue} selectable={true}>{credencialesGeneradas.pass}</Text>
                </View>

                {/* --- NUEVOS BOTONES DE ACCIÓN (COMPARTIR Y CERRAR) --- */}
                <View style={styles.rowButtons}>
                  <TouchableOpacity style={styles.btnOutline} onPress={handleCompartirCredenciales}>
                    <Ionicons name="share-social-outline" size={22} color="#007AFF" style={{ marginRight: 8 }} />
                    <Text style={styles.btnTextOutline}>Compartir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={cerrarModales}>
                    <Text style={styles.btnTextPrimary}>Entendido</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Nuevo Colaborador</Text>
                  <TouchableOpacity onPress={cerrarModales}>
                    <Ionicons name="close" size={28} color="#666" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.helperText}>Solo ingresa sus datos básicos. Generaremos un correo y contraseña automáticamente.</Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Nombre</Text>
                    <TextInput style={styles.input} placeholder="Ej: Nicolás" value={nombre} onChangeText={setNombre} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Apellido</Text>
                    <TextInput style={styles.input} placeholder="Ej: Castillo" value={apellido} onChangeText={setApellido} />
                  </View>
                </View>

                <Text style={styles.label}>RUT</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12.345.678-9"
                  value={rut}
                  onChangeText={(t) => setRut(formatearRutVisual(t))}
                  maxLength={12}
                />

                <Text style={styles.label}>Cargo / Función</Text>
                <TextInput style={styles.input} placeholder="Ej: Vendedor de Terreno" value={funcion} onChangeText={setFuncion} />

                <Text style={styles.label}>Correo de Contacto</Text>
                <TextInput style={styles.input} placeholder="correo@ejemplo.com" value={correoContacto} onChangeText={setCorreoContacto} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.label}>Teléfono de Contacto</Text>
                <TextInput style={styles.input} placeholder="+56912345678" value={telefonoContacto} onChangeText={setTelefonoContacto} keyboardType="phone-pad" />

                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10 }]} onPress={handleCrearColaborador} disabled={creando}>
                  {creando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextPrimary}>Generar y Crear Acceso</Text>}
                </TouchableOpacity>
              </>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==========================================================
          MODAL 2: EDITAR COLABORADOR EXISTENTE
          ========================================================== */}
      <Modal visible={modalEditVisible} transparent={true} animationType="slide" onRequestClose={cerrarModales}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackground}>
          <View style={styles.modalContent}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Colaborador</Text>
              <TouchableOpacity onPress={cerrarModales}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Apellido</Text>
                <TextInput style={styles.input} value={apellido} onChangeText={setApellido} />
              </View>
            </View>

            <Text style={styles.label}>RUT</Text>
            <TextInput
              style={styles.input}
              value={rut}
              onChangeText={(t) => setRut(formatearRutVisual(t))}
              maxLength={12}
            />

            <Text style={styles.label}>Cargo / Función</Text>
            <TextInput style={styles.input} value={funcion} onChangeText={setFuncion} />

            <Text style={styles.label}>Correo de Contacto</Text>
            <TextInput style={styles.input} value={correoContacto} onChangeText={setCorreoContacto} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Teléfono de Contacto</Text>
            <TextInput style={styles.input} value={telefonoContacto} onChangeText={setTelefonoContacto} keyboardType="phone-pad" />

            {editingCredenciales && (
              <View style={[styles.credentialsBox, { marginTop: 15, marginBottom: 10, padding: 15 }]}>
                <Text style={styles.credLabel}>Credenciales Originales:</Text>

                <Text style={[styles.credLabel, { marginTop: 10, fontSize: 10, color: '#666' }]}>Correo:</Text>
                <Text style={[styles.credValue, { fontSize: 14 }]} selectable={true}>{editingCredenciales.correo}</Text>

                <Text style={[styles.credLabel, { marginTop: 10, fontSize: 10, color: '#666' }]}>Contraseña:</Text>
                <Text style={[styles.credValue, { fontSize: 14 }]} selectable={true}>{editingCredenciales.password}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 10 }]} onPress={handleGuardarEdicion} disabled={guardandoEdicion}>
              {guardandoEdicion ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextPrimary}>Guardar Cambios</Text>}
            </TouchableOpacity>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: { padding: 20, paddingTop: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#666', fontWeight: 'bold', marginTop: 15 },
  emptySubText: { fontSize: 14, color: '#999', marginTop: 5 },

  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginHorizontal: 20, marginTop: 15, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#007AFF', fontWeight: 'bold', fontSize: 18 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cardSub: { fontSize: 13, color: '#666', marginTop: 3 },

  actionButtons: { flexDirection: 'row', gap: 10 },
  actionBtn: { padding: 8, backgroundColor: '#f9f9f9', borderRadius: 8 },

  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#007AFF', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },

  modalBackground: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  helperText: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 5 },
  input: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#EAEAEA', fontSize: 16 },

  btnPrimary: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnTextPrimary: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Estilos Pantalla Éxito y Botón Compartir
  successContainer: { alignItems: 'center', paddingVertical: 20 },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 10 },
  successSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
  credentialsBox: { backgroundColor: '#F0F8FF', width: '100%', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#BCE0FD', marginBottom: 25 },
  credLabel: { fontSize: 12, fontWeight: 'bold', color: '#007AFF', textTransform: 'uppercase' },
  credValue: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 5 },

  rowButtons: { flexDirection: 'row', gap: 15, width: '100%' },
  btnOutline: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#007AFF' },
  btnTextOutline: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 }
});