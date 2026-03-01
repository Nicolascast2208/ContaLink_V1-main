import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Image, StyleSheet, ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

import { auth, db } from '../../utils/firebaseconfig';
// Importamos nuestros estilos globales para unificar la interfaz
import { styles as globalStyles } from '../../styles/Styles';

WebBrowser.maybeCompleteAuthSession();

// --- FUNCIONES DE APOYO ---
const validarEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const formatearRut = (rut: string) => {
  const valorLimpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (valorLimpio.length <= 1) return valorLimpio;
  const cuerpo = valorLimpio.slice(0, -1);
  const dv = valorLimpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFormateado}-${dv}`;
};

const validarRutChileno = (rut: string) => {
  const valor = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (valor.length < 7) return false;
  const cuerpo = valor.slice(0, -1);
  const dv = valor.slice(-1);
  let suma = 0, multiplo = 2;
  for (let i = 1; i <= cuerpo.length; i++) {
    suma += multiplo * parseInt(valor.charAt(cuerpo.length - i));
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
  return dvCalculado === dv;
};

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(false);

  // ROLES DE USUARIO
  const [tipoUsuario, setTipoUsuario] = useState<'usuario' | 'contador'>('usuario');
  const [subTipoUsuario, setSubTipoUsuario] = useState<'natural' | 'empresa'>('natural');

  // CAMPOS DE FORMULARIO
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [rut, setRut] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '807808449081-0hei11dh9m3bdb7shgt2cg5ll1ba6ed8.apps.googleusercontent.com',
    redirectUri: makeRedirectUri({ scheme: 'contalink' })
  });

  const handleAuth = async () => {
    setLoadingAuth(true);
    try {
      if (isLogin) {
        if (!email.trim() || !password) throw new Error("Ingresa correo y contraseña.");
        // @ts-ignore
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        if (!validarEmail(email.trim())) throw new Error("Email inválido.");
        if (!validarRutChileno(rut)) throw new Error("RUT inválido.");

        if (tipoUsuario === 'contador' || (tipoUsuario === 'usuario' && subTipoUsuario === 'natural')) {
          if (!nombre.trim() || !apellido.trim() || !rut.trim()) throw new Error("Completa nombre, apellido y RUT.");
        } else if (tipoUsuario === 'usuario' && subTipoUsuario === 'empresa') {
          if (!razonSocial.trim() || !rut.trim()) throw new Error("Completa la Razón Social y RUT de la empresa.");
        }

        // @ts-ignore
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;
        const rutLimpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();

        let perfilData: any = {
          uid: user.uid,
          email: email.trim().toLowerCase(),
          rut: rutLimpio,
          fechaRegistro: serverTimestamp(),
        };

        if (tipoUsuario === 'contador') {
          await updateProfile(user, { displayName: `${nombre.trim()} ${apellido.trim()}` });
          perfilData.rol = 'contador';
          perfilData.nombre = nombre.trim();
          perfilData.apellido = apellido.trim();
          perfilData.clientesVinculados = [];
        } else if (tipoUsuario === 'usuario' && subTipoUsuario === 'natural') {
          await updateProfile(user, { displayName: `${nombre.trim()} ${apellido.trim()}` });
          perfilData.rol = 'persona_natural';
          perfilData.nombre = nombre.trim();
          perfilData.apellido = apellido.trim();
          perfilData.codigoContador = null;
        } else if (tipoUsuario === 'usuario' && subTipoUsuario === 'empresa') {
          await updateProfile(user, { displayName: razonSocial.trim() });
          perfilData.rol = 'admin_empresa';
          perfilData.razonSocial = razonSocial.trim();
          perfilData.colaboradoresActivos = 0;
          perfilData.codigoContador = null;
        }

        await setDoc(doc(db, "usuarios", user.uid), perfilData);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoadingAuth(false);
    }
  };

  return (
    // Usamos el contenedor global para el fondo general, forzándolo a blanco para esta pantalla
    <View style={[globalStyles.container, { backgroundColor: '#FFFFFF' }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={localStyles.scrollContent} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/images/contalink_logo.png')} style={localStyles.logo} resizeMode="contain" />

          <View style={localStyles.formContainer}>
            {!isLogin && (
              <>
                <View style={localStyles.roleSelector}>
                  <TouchableOpacity
                    style={[localStyles.roleBtn, tipoUsuario === 'usuario' && localStyles.roleBtnActive]}
                    onPress={() => setTipoUsuario('usuario')}
                  >
                    <Text style={[localStyles.roleText, tipoUsuario === 'usuario' && localStyles.roleTextActive]}>Soy Usuario</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[localStyles.roleBtn, tipoUsuario === 'contador' && localStyles.roleBtnActive]}
                    onPress={() => setTipoUsuario('contador')}
                  >
                    <Text style={[localStyles.roleText, tipoUsuario === 'contador' && localStyles.roleTextActive]}>Soy Contador</Text>
                  </TouchableOpacity>
                </View>

                {tipoUsuario === 'usuario' && (
                  <View style={localStyles.subRoleSelector}>
                    <TouchableOpacity
                      style={[localStyles.subRoleBtn, subTipoUsuario === 'natural' && localStyles.subRoleBtnActive]}
                      onPress={() => setSubTipoUsuario('natural')}
                    >
                      <Text style={[localStyles.subRoleText, subTipoUsuario === 'natural' && localStyles.subRoleTextActive]}>Persona Natural</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[localStyles.subRoleBtn, subTipoUsuario === 'empresa' && localStyles.subRoleBtnActive]}
                      onPress={() => setSubTipoUsuario('empresa')}
                    >
                      <Text style={[localStyles.subRoleText, subTipoUsuario === 'empresa' && localStyles.subRoleTextActive]}>Empresa</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(tipoUsuario === 'contador' || (tipoUsuario === 'usuario' && subTipoUsuario === 'natural')) ? (
                  <>
                    {/* Usamos los inputs definidos en el Styles.ts global */}
                    <TextInput
                      placeholder="Nombre" placeholderTextColor="#999"
                      value={nombre} onChangeText={setNombre} style={globalStyles.input}
                    />
                    <TextInput
                      placeholder="Apellido" placeholderTextColor="#999"
                      value={apellido} onChangeText={setApellido} style={globalStyles.input}
                    />
                  </>
                ) : (
                  <TextInput
                    placeholder="Nombre de la Empresa o Razón Social" placeholderTextColor="#999"
                    value={razonSocial} onChangeText={setRazonSocial} style={globalStyles.input}
                  />
                )}

                <TextInput
                  placeholder={tipoUsuario === 'usuario' && subTipoUsuario === 'empresa' ? "RUT Empresa" : "RUT"}
                  placeholderTextColor="#999"
                  value={rut}
                  onChangeText={(t) => setRut(formatearRut(t))}
                  style={globalStyles.input}
                  maxLength={12}
                />
              </>
            )}

            <TextInput
              placeholder="Correo Electrónico"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              style={globalStyles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={localStyles.passwordContainer}>
              <TextInput
                placeholder="Contraseña"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                style={localStyles.passwordInput}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity style={localStyles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Usamos el botón azul global de Styles.ts */}
            <TouchableOpacity style={[globalStyles.btnPrimary, { marginTop: 10 }]} onPress={handleAuth} disabled={loadingAuth}>
              {loadingAuth ? <ActivityIndicator color="#fff" /> : <Text style={globalStyles.btnText}>{isLogin ? "Entrar" : "Registrarse"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              {/* Usamos el link global de Styles.ts */}
              <Text style={globalStyles.link}>{isLogin ? "¿Nuevo aquí? Crea cuenta" : "Volver al Login"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  logo: { width: 180, height: 180, marginBottom: 20 },
  formContainer: { width: '100%', maxWidth: 400 },

  roleSelector: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 4, marginBottom: 15 },
  roleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  roleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  roleText: { fontSize: 14, fontWeight: '600', color: '#999' },
  roleTextActive: { color: '#007AFF' },

  subRoleSelector: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 10 },
  subRoleBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#EAEAEA', backgroundColor: '#FAFAFA' },
  subRoleBtnActive: { backgroundColor: '#E8F1FF', borderColor: '#007AFF' },
  subRoleText: { fontSize: 13, fontWeight: '500', color: '#888' },
  subRoleTextActive: { color: '#007AFF', fontWeight: 'bold' },

  // El estilo para el campo de la contraseña necesita mantener su propia configuración para el ícono del ojo
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f2f5', borderRadius: 10, marginBottom: 15 },
  passwordInput: { flex: 1, padding: 15, fontSize: 16, color: '#333333' },
  eyeIcon: { paddingHorizontal: 16, paddingVertical: 14 }
});