import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Share, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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

  // Estado de Suscripción PRO
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'usuarios', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);

          if (data.nombre) setNombre(data.nombre);
          if (data.apellido) setApellido(data.apellido);
          if (data.razonSocial) setRazonSocial(data.razonSocial);
          if (data.codigoContador) setCodigoGenerado(data.codigoContador);
        }

        // Revisar Entitlements de RevenueCat
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          if (typeof customerInfo.entitlements.active['MaxiTech Solutions SpA Pro'] !== "undefined") {
            setIsPro(true);
          }
        } catch (rcError) {
          console.log("No se pudo obtener información de RevenueCat:", rcError);
        }
      } catch (error) {
        console.error("Error al cargar perfil:", error);
        Alert.alert("Error", "No se pudo cargar la información del perfil.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
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
        message: `¡Hola! Mi código de acceso para la app ContaLink es: ${codigoGenerado} `,
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
          {userData?.rol !== 'contador' && userData?.rol !== 'trabajador' && (
            <View style={localStyles.codeCard}>
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
  btnShare: { flex: 1, flexDirection: 'row', backgroundColor: '#007AFF', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }
});