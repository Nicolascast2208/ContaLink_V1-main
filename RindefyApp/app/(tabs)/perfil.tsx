import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Share, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion, deleteField } from 'firebase/firestore';
import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { auth, db } from '../../utils/firebaseconfig';
// Importamos el estilo global para el contenedor
import { styles as globalStyles } from '../../styles/Styles';

export default function PerfilScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Estados editables
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);

  // Solicitud de Contador
  const [solicitudContador, setSolicitudContador] = useState<any>(null);

  // Estado de Suscripción PRO
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    setLoading(true);
    const docRef = doc(db, 'usuarios', auth.currentUser.uid);

    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData(data);

        if (data.nombre && !isEditing) setNombre(data.nombre);
        if (data.apellido && !isEditing) setApellido(data.apellido);
        if (data.razonSocial && !isEditing) setRazonSocial(data.razonSocial);
        if (data.codigoContador) setCodigoGenerado(data.codigoContador);

        // Cargar solicitud pendiente si la hay
        if (data.solicitudContador && data.solicitudContador.estado === 'pendiente') {
          setSolicitudContador(data.solicitudContador);
        } else {
          setSolicitudContador(null);
        }
      }

      // Revisar Entitlements de RevenueCat solo la primera vez que carga
      if (loading) {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          if (typeof customerInfo.entitlements.active['MaxiTech Solutions SpA Pro'] !== "undefined") {
            setIsPro(true);
          }
        } catch (rcError) {
          console.log("No se pudo obtener información de RevenueCat:", rcError);
        }
        setLoading(false);
      }
    }, (error) => {
      console.error("Error al suscribirse al perfil:", error);
      Alert.alert("Error", "No se pudo cargar la información del perfil.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGuardarCambios = async () => {
    if (!auth.currentUser || !userData) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'usuarios', auth.currentUser.uid);

      if (userData.rol === 'admin_empresa') {
        if (!razonSocial.trim()) throw new Error("La Razón Social no puede estar vacía.");
        await updateDoc(docRef, { razonSocial: razonSocial.trim() });
      } else {
        if (!nombre.trim() || !apellido.trim()) throw new Error("Nombre y Apellido son obligatorios.");
        await updateDoc(docRef, { nombre: nombre.trim(), apellido: apellido.trim() });
      }

      Alert.alert("¡Éxito!", "Perfil actualizado correctamente.");
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  const generarCodigo = async () => {
    if (!auth.currentUser) return;
    setGenerandoCodigo(true);
    try {
      // Generar código alfanumérico complejo de 8 caracteres (mayúsculas, minúsculas y números)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let newCode = '';
      for (let i = 0; i < 8; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const docRef = doc(db, 'usuarios', auth.currentUser.uid);
      await updateDoc(docRef, { codigoContador: newCode });

      setCodigoGenerado(newCode);
    } catch (error) {
      console.error("Error al generar código:", error);
      Alert.alert("Error", "No se pudo generar el código.");
    } finally {
      setGenerandoCodigo(false);
    }
  };

  const handleShareCode = async () => {
    if (!codigoGenerado) return;
    try {
      await Share.share({
        message: `¡Hola! Mi código de acceso para la app Rindefy es: ${codigoGenerado} `,
      });
    } catch (error: any) {
      Alert.alert("Error", "No se pudo compartir el código.");
    }
  };

  const handleManageSubscription = async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
      console.log("Error al abrir Customer Center:", error);
      Alert.alert("Error", "No se pudo abrir el centro de suscripciones.");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir", style: "destructive", onPress: async () => {
          await signOut(auth);
        }
      }
    ]);
  };

  const handleAprobarSolicitud = async () => {
    if (!auth.currentUser || !solicitudContador) return;

    setLoading(true);
    try {
      const clienteRef = doc(db, 'usuarios', auth.currentUser.uid);
      const contadorRef = doc(db, 'usuarios', solicitudContador.uid);

      // 1. Añadimos el cliente a la cartera del contador
      await updateDoc(contadorRef, {
        clientesVinculados: arrayUnion({
          uid: auth.currentUser.uid,
          nombre: nombre.trim() || userData.nombre || 'Sin nombre',
          apellido: apellido.trim() || userData.apellido || '',
          razonSocial: razonSocial.trim() || userData.razonSocial || null,
          rut: userData.rut || 'S/R',
          email: userData.email || ''
        })
      });

      // 2. Registramos al contador en el cliente y borramos la solicitud
      await updateDoc(clienteRef, {
        contadorVinculado: {
          uid: solicitudContador.uid,
          nombre: solicitudContador.nombre
        },
        solicitudContador: deleteField()
      });

      setSolicitudContador(null);
      Alert.alert("¡Vinculación Exitosa!", `Ahora ${solicitudContador.nombre} gestionará tus documentos.`);
    } catch (error) {
      console.error("Error al aprobar solicitud:", error);
      Alert.alert("Error", "No se pudo aprobar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const handleRechazarSolicitud = async () => {
    if (!auth.currentUser) return;
    Alert.alert("Rechazar Solicitud", "¿Seguro que quieres rechazar a este contador?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rechazar", style: "destructive", onPress: async () => {
          try {
            const clienteRef = doc(db, 'usuarios', auth.currentUser.uid);
            await updateDoc(clienteRef, { solicitudContador: deleteField() });
            setSolicitudContador(null);
          } catch (error) {
            console.error(error);
          }
        }
      }
    ]);
  };

  const handleDesvincularContador = async () => {
    if (!auth.currentUser || !userData?.contadorVinculado) return;

    Alert.alert(
      "Desvincular Contador",
      `¿Estás seguro de que quieres desvincular a ${userData.contadorVinculado.nombre}? Dejará de tener acceso a tus documentos y reportes de gastos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, desvincular",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const clienteRef = doc(db, 'usuarios', auth.currentUser.uid);
              const contadorRef = doc(db, 'usuarios', userData.contadorVinculado.uid);

              // 1. Obtenemos los datos actuales del contador para filtrar a este cliente
              const contadorSnap = await getDoc(contadorRef);
              if (contadorSnap.exists()) {
                const clientesActuales = contadorSnap.data().clientesVinculados || [];
                // Filtramos sacando al cliente actual
                const nuevosClientes = clientesActuales.filter((c: any) => c.uid !== auth.currentUser.uid);

                // Actualizamos el array del contador
                await updateDoc(contadorRef, { clientesVinculados: nuevosClientes });
              }

              // 2. Eliminamos el vínculo del lado del cliente
              await updateDoc(clienteRef, {
                contadorVinculado: deleteField(),
                codigoContador: deleteField() // Opcional: limpiar el código para que genere uno nuevo luego
              });

              setCodigoGenerado(null);
              Alert.alert("Listo", "Has desvinculado a tu contador exitosamente.");

            } catch (error: any) {
              console.error("Error al desvincular:", error);
              Alert.alert("Error", "Ocurrió un problema al intentar desvincular al contador.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={localStyles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const getRoleLabel = () => {
    if (userData?.rol === 'admin_empresa') return 'CUENTA EMPRESA';
    if (userData?.rol === 'contador') return 'CUENTA CONTADOR';
    if (userData?.rol === 'trabajador') return 'CUENTA COLABORADOR';
    return 'CUENTA USUARIO';
  };

  return (
    <SafeAreaView style={globalStyles.container}>
      <ScrollView contentContainerStyle={localStyles.scrollContainer}>

        {/* --- CABECERA DEL PERFIL --- */}
        <View style={localStyles.headerProfile}>
          <View style={[localStyles.avatarCircle, userData?.rol === 'admin_empresa' && { backgroundColor: '#FFF0E6' }]}>
            <Ionicons
              name={userData?.rol === 'admin_empresa' ? "business" : "person"}
              size={40}
              color={userData?.rol === 'admin_empresa' ? "#FF9500" : "#007AFF"}
            />
          </View>
          <Text style={localStyles.emailText}>
            {userData?.email} {isPro && <Text style={{ color: '#00C851', fontWeight: 'bold' }}>(PRO)</Text>}
          </Text>
          <View style={[localStyles.badge, userData?.rol === 'admin_empresa' && { backgroundColor: '#FFF0E6' }]}>
            <Text style={[localStyles.badgeText, userData?.rol === 'admin_empresa' && { color: '#FF9500' }]}>{getRoleLabel()}</Text>
          </View>
        </View>

        {/* --- FORMULARIO DINÁMICO --- */}
        <View style={localStyles.formContainer}>

          {userData?.rol === 'admin_empresa' ? (
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.label}>Razón Social / Nombre de la Empresa</Text>
              <TextInput style={[localStyles.input, !isEditing && localStyles.inputDisabled]} value={razonSocial} onChangeText={setRazonSocial} placeholder="Ej: Mi Empresa SpA" editable={isEditing} />
            </View>
          ) : (
            <>
              <View style={localStyles.inputGroup}>
                <Text style={localStyles.label}>Nombre</Text>
                <TextInput style={[localStyles.input, !isEditing && localStyles.inputDisabled]} value={nombre} onChangeText={setNombre} placeholder="Tu nombre" editable={isEditing} />
              </View>
              <View style={localStyles.inputGroup}>
                <Text style={localStyles.label}>Apellido</Text>
                <TextInput style={[localStyles.input, !isEditing && localStyles.inputDisabled]} value={apellido} onChangeText={setApellido} placeholder="Tu apellido" editable={isEditing} />
              </View>
            </>
          )}

          <View style={localStyles.inputGroup}>
            <Text style={localStyles.label}>RUT (No se puede editar)</Text>
            <TextInput style={[localStyles.input, localStyles.inputDisabled]} value={userData?.rut} editable={false} />
          </View>

          <View style={localStyles.inputGroup}>
            <Text style={localStyles.label}>Correo Electrónico (No se puede editar)</Text>
            <TextInput style={[localStyles.input, localStyles.inputDisabled]} value={userData?.email} editable={false} />
          </View>

          {/* --- SECCIÓN CÓDIGO CONTADOR --- */}
          {userData?.rol !== 'contador' && userData?.rol !== 'trabajador' && !userData?.contadorVinculado && (
            <View style={localStyles.codeCard}>
              {solicitudContador ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 }}>
                    <Ionicons name="shield-checkmark" size={28} color="#00C851" />
                    <Text style={[localStyles.codeTitle, { flex: 1 }]}>Solicitud de Vinculación</Text>
                  </View>
                  <Text style={[localStyles.codeSubtitle, { color: '#333' }]}>
                    El contador <Text style={{ fontWeight: 'bold' }}>{solicitudContador.nombre}</Text> quiere agregarte a su cartera para gestionar tus documentos y reportes.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <TouchableOpacity style={[localStyles.btnActionSol, localStyles.btnReject]} onPress={handleRechazarSolicitud}>
                      <Text style={localStyles.btnRejectText}>Rechazar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[localStyles.btnActionSol, localStyles.btnApprove]} onPress={handleAprobarSolicitud}>
                      <Text style={localStyles.btnApproveText}>Aprobar Acceso</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={localStyles.codeTitle}>Vincular con tu Contador</Text>
                  <Text style={localStyles.codeSubtitle}>Dale este código a tu contador para que te agregue a su cartera y gestione tus documentos.</Text>

                  {codigoGenerado ? (
                    <View>
                      <View style={localStyles.codeDisplayBox}>
                        <Text style={localStyles.codeText}>{codigoGenerado}</Text>
                      </View>

                      <View style={localStyles.shareActionRow}>
                        <TouchableOpacity
                          style={localStyles.btnRefresh}
                          onPress={generarCodigo}
                          disabled={generandoCodigo}
                        >
                          {generandoCodigo ? <ActivityIndicator color="#666" /> : <Ionicons name="refresh" size={24} color="#666" />}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={localStyles.btnShare}
                          onPress={handleShareCode}
                        >
                          <Ionicons name="share-social" size={20} color="#FFF" style={{ marginRight: 8 }} />
                          <Text style={localStyles.btnTextPrimary}>Compartir Código</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[localStyles.btnPrimary, { marginTop: 0, backgroundColor: '#E8F1FF' }]}
                      onPress={generarCodigo}
                      disabled={generandoCodigo}
                    >
                      {generandoCodigo ? <ActivityIndicator color="#007AFF" /> : (
                        <Text style={[localStyles.btnTextPrimary, { color: '#007AFF' }]}>Generar Código de Acceso</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {userData?.contadorVinculado && (
            <View style={[localStyles.codeCard, { borderColor: '#00C851', backgroundColor: '#F0FFF4' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 10 }}>
                <Ionicons name="checkmark-circle" size={24} color="#00C851" />
                <Text style={[localStyles.codeTitle, { color: '#00C851', marginBottom: 0 }]}>Cuenta Vinculada</Text>
              </View>
              <Text style={localStyles.codeSubtitle}>Tu perfil está siendo administrado por tu contador: <Text style={{ fontWeight: 'bold' }}>{userData.contadorVinculado.nombre}</Text></Text>

              <TouchableOpacity
                style={[localStyles.btnOutline, { borderColor: '#ff4444', backgroundColor: '#FFF5F5', padding: 12, marginTop: 10 }]}
                onPress={handleDesvincularContador}
              >
                <Ionicons name="link-outline" size={18} color="#ff4444" style={{ marginRight: 6 }} />
                <Text style={[localStyles.btnTextOutline, { fontSize: 14 }]}>Desvincular Contador</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isEditing ? (
            <TouchableOpacity style={localStyles.btnPrimary} onPress={() => setIsEditing(true)}>
              <Text style={localStyles.btnTextPrimary}>Editar Perfil</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={localStyles.btnPrimary} onPress={handleGuardarCambios} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.btnTextPrimary}>Guardar Cambios</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[localStyles.btnOutline, { borderColor: '#007AFF', marginBottom: 15 }]} onPress={handleManageSubscription}>
            <Ionicons name="card-outline" size={20} color="#007AFF" style={{ marginRight: 8 }} />
            <Text style={[localStyles.btnTextOutline, { color: '#007AFF' }]}>Gestionar Suscripción</Text>
          </TouchableOpacity>

          <TouchableOpacity style={localStyles.btnOutline} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff4444" style={{ marginRight: 8 }} />
            <Text style={localStyles.btnTextOutline}>Cerrar Sesión</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos específicos de esta pantalla
const localStyles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  scrollContainer: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 20 : 10, alignItems: 'center' },

  headerProfile: { alignItems: 'center', marginBottom: 40 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E8F1FF', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  emailText: { fontSize: 16, color: '#333', marginBottom: 10, fontWeight: '500' },
  badge: { backgroundColor: '#E8F1FF', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#007AFF', fontSize: 12, fontWeight: '700' },

  formContainer: { width: '100%', maxWidth: 400 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#EAEAEA' },
  inputDisabled: { color: '#999', backgroundColor: '#EFEFEF' },

  btnPrimary: { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, marginBottom: 15 },
  btnTextPrimary: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  btnOutline: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ff4444' },
  btnTextOutline: { color: '#ff4444', fontSize: 16, fontWeight: '600' },

  // Estilos Código
  codeCard: { backgroundColor: '#F8F9FA', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#EAEAEA' },
  codeTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  codeSubtitle: { fontSize: 13, color: '#666', marginBottom: 15, lineHeight: 18 },
  codeDisplayBox: { backgroundColor: '#E8F1FF', borderRadius: 12, padding: 15, marginBottom: 15 },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 8, color: '#007AFF', textAlign: 'center' },

  shareActionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnRefresh: { backgroundColor: '#EAEAEA', width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnShare: { flex: 1, flexDirection: 'row', backgroundColor: '#007AFF', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  // Solicitud Buttons
  btnActionSol: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnReject: { backgroundColor: '#FFF', borderColor: '#ff4444' },
  btnRejectText: { color: '#ff4444', fontWeight: 'bold', fontSize: 15 },
  btnApprove: { backgroundColor: '#00C851', borderColor: '#00C851' },
  btnApproveText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 }
});