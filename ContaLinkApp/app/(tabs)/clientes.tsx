import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'expo-router'; // <-- 1. IMPORTAMOS EL ROUTER

import { auth, db } from '../../utils/firebaseconfig';

export default function ClientesScreen() {
  const [loading, setLoading] = useState(true);
  const [misClientes, setMisClientes] = useState<any[]>([]);

  // Estados para el Modal de Agregar Cliente
  const [modalVisible, setModalVisible] = useState(false);
  const [codigoInput, setCodigoInput] = useState('');
  const [buscando, setBuscando] = useState(false);

  const router = useRouter(); // <-- 2. INICIALIZAMOS EL ROUTER

  // Escuchar en tiempo real la lista de clientes vinculados a este contador
  useEffect(() => {
    if (!auth.currentUser) return;

    const docRef = doc(db, "usuarios", auth.currentUser.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const datos = docSnap.data();
        // Si el contador ya tiene un arreglo de clientes, lo mostramos
        setMisClientes(datos.clientesVinculados || []);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Función para buscar el código y vincular al cliente
  const vincularCliente = async () => {
    if (codigoInput.trim().length !== 8) {
      return Alert.alert("Error", "El código debe tener exactamente 8 caracteres.");
    }

    setBuscando(true);
    try {
      const codigoBuscar = codigoInput.trim(); // Sensible a mayúsculas/minúsculas

      // 1. Buscamos si existe algún usuario con ese código generado
      const q = query(collection(db, "usuarios"), where("codigoContador", "==", codigoBuscar));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setBuscando(false);
        return Alert.alert("No encontrado", "El código es incorrecto o el cliente generó uno nuevo.");
      }

      // 2. Extraemos los datos del cliente encontrado
      const clienteDoc = querySnapshot.docs[0];
      const clienteData = clienteDoc.data();

      // Evitar que el contador se agregue a sí mismo
      if (clienteDoc.id === auth.currentUser?.uid) {
        setBuscando(false);
        return Alert.alert("Error", "No puedes vincularte a ti mismo.");
      }

      // Evitar duplicados
      const yaExiste = misClientes.some(c => c.uid === clienteDoc.id);
      if (yaExiste) {
        setBuscando(false);
        return Alert.alert("Aviso", "Este cliente ya está en tu cartera.");
      }

      // 3. Guardamos el cliente en el perfil del contador
      const contadorRef = doc(db, "usuarios", auth.currentUser!.uid);
      await updateDoc(contadorRef, {
        clientesVinculados: arrayUnion({
          uid: clienteDoc.id,
          nombre: clienteData.nombre || 'Sin nombre',
          apellido: clienteData.apellido || '',
          rut: clienteData.rut || 'S/R',
          email: clienteData.email || ''
        })
      });

      Alert.alert("¡Éxito!", `Has vinculado a ${clienteData.nombre} a tu cartera de clientes.`);
      setModalVisible(false);
      setCodigoInput('');

    } catch (error: any) {
      Alert.alert("Error al vincular", error.message);
    } finally {
      setBuscando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Clientes</Text>
      </View>

      <FlatList
        data={misClientes}
        keyExtractor={(item, index) => item.uid + index}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-circle-outline" size={80} color="#E5E5E5" />
            <Text style={styles.emptyTitle}>Sin clientes aún</Text>
            <Text style={styles.emptyDesc}>Pídele a tus clientes que generen su código de acceso en su perfil y agrégalos aquí.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.clientCard}
            // <-- 3. NAVEGAMOS A LA PANTALLA DINÁMICA AL HACER CLIC
            onPress={() => router.push({
              pathname: `/cliente/[id]` as any,
              params: { id: item.uid, nombre: item.nombre, apellido: item.apellido, rut: item.rut }
            })}
          >
            <View style={styles.clientAvatar}>
              <Text style={styles.avatarText}>{item.nombre.charAt(0)}{item.apellido ? item.apellido.charAt(0) : ''}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{item.nombre} {item.apellido}</Text>
              <Text style={styles.clientRut}>RUT: {item.rut}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#CCC" />
          </TouchableOpacity>
        )}
      />

      {/* Botón Flotante para Agregar Cliente */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="person-add" size={28} color="white" />
      </TouchableOpacity>

      {/* ======================================================== */}
      {/* MODAL OPTIMIZADO PARA EL TECLADO (NUEVO CÓDIGO AQUÍ)     */}
      {/* ======================================================== */}
      <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Tocar el fondo oscuro cierra el teclado */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              {/* Esto evita que tocar dentro del cuadro blanco cierre el modal */}
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Vincular Cliente</Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalDesc}>Ingresa el código de 8 caracteres que tu cliente generó en su perfil (respeta mayúsculas y minúsculas).</Text>

                  <TextInput
                    style={styles.codigoInput}
                    placeholder="Ej: aB3x9QzY"
                    placeholderTextColor="#999"
                    value={codigoInput}
                    onChangeText={setCodigoInput}
                    autoCapitalize="none"
                    maxLength={8}
                    returnKeyType="done"                       // <-- Muestra el botón "Listo" en el teclado iOS
                    onSubmitEditing={() => Keyboard.dismiss()} // <-- Cierra el teclado al darle "Listo"
                  />

                  <TouchableOpacity style={styles.btnVincular} onPress={vincularCliente} disabled={buscando || codigoInput.length < 8}>
                    {buscando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnVincularText}>Vincular Cliente</Text>}
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { backgroundColor: '#FFFFFF', paddingTop: 60, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#101A26' },

  // Lista de Clientes
  clientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  clientAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  clientRut: { fontSize: 13, color: '#666' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 10 },
  emptyDesc: { fontSize: 15, color: '#666', textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },

  // Botón Flotante
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#007AFF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalDesc: { fontSize: 15, color: '#666', marginBottom: 20, lineHeight: 22 },
  codigoInput: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, fontSize: 24, fontWeight: 'bold', textAlign: 'center', letterSpacing: 5, color: '#333', marginBottom: 20, borderWidth: 1, borderColor: '#EAEAEA' },
  btnVincular: { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnVincularText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});