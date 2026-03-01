import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { auth, db } from '../../utils/firebaseconfig';
// Importamos el estilo global para el contenedor
import { styles as globalStyles } from '../../styles/Styles';

export default function PerfilScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Estados editables
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [razonSocial, setRazonSocial] = useState('');

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
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
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
    return 'CUENTA USUARIO';
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={globalStyles.container}>
      <ScrollView contentContainerStyle={localStyles.scrollContainer}>

        {/* --- CABECERA DEL PERFIL --- */}
        <View style={localStyles.headerProfile}>
          <View style={localStyles.avatarCircle}>
            <Ionicons
              name={userData?.rol === 'admin_empresa' ? "business" : "person"}
              size={40}
              color="#007AFF"
            />
          </View>
          <Text style={localStyles.emailText}>{userData?.email}</Text>
          <View style={localStyles.badge}>
            <Text style={localStyles.badgeText}>{getRoleLabel()}</Text>
          </View>
        </View>

        {/* --- FORMULARIO DINÁMICO --- */}
        <View style={localStyles.formContainer}>

          {userData?.rol === 'admin_empresa' ? (
            <View style={localStyles.inputGroup}>
              <Text style={localStyles.label}>Razón Social / Nombre de la Empresa</Text>
              <TextInput style={localStyles.input} value={razonSocial} onChangeText={setRazonSocial} placeholder="Ej: Mi Empresa SpA" />
            </View>
          ) : (
            <>
              <View style={localStyles.inputGroup}>
                <Text style={localStyles.label}>Nombre</Text>
                <TextInput style={localStyles.input} value={nombre} onChangeText={setNombre} placeholder="Tu nombre" />
              </View>
              <View style={localStyles.inputGroup}>
                <Text style={localStyles.label}>Apellido</Text>
                <TextInput style={localStyles.input} value={apellido} onChangeText={setApellido} placeholder="Tu apellido" />
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

          <TouchableOpacity style={localStyles.btnPrimary} onPress={handleGuardarCambios} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.btnTextPrimary}>Guardar Cambios</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={localStyles.btnOutline} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff4444" style={{ marginRight: 8 }} />
            <Text style={localStyles.btnTextOutline}>Cerrar Sesión</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Estilos específicos de esta pantalla
const localStyles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  scrollContainer: { flexGrow: 1, padding: 24, paddingTop: Platform.OS === 'ios' ? 70 : 50, alignItems: 'center' },

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
  btnTextOutline: { color: '#ff4444', fontSize: 16, fontWeight: '600' }
});