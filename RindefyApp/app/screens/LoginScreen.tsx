import { useState, useEffect } from 'react';
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
import RevenueCatUI from 'react-native-purchases-ui';
import * as Linking from 'expo-linking';

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

  // CONTROL DE PASOS PARA EMPRESA
  const [pasoRegistroEmpresa, setPasoRegistroEmpresa] = useState<1 | 2>(1);
  const [buscandoSii, setBuscandoSii] = useState(false);

  // CAMPOS DE FORMULARIO
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [rut, setRut] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [funcion, setFuncion] = useState('');

  // CAMPOS EXTRA PARA COLABORADOR INVITADO
  const [correoContacto, setCorreoContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  // INVITACIÓN COLLABORADOR
  const url = Linking.useURL();
  const [empresaIdInvitacion, setEmpresaIdInvitacion] = useState<string | null>(null);
  const [empresaNombreInvitacion, setEmpresaNombreInvitacion] = useState<string | null>(null);

  useEffect(() => {
    if (url) {
      const parsedUrl = Linking.parse(url);
      if (parsedUrl.path === 'invite' && parsedUrl.queryParams?.empresaId) {
        setEmpresaIdInvitacion(parsedUrl.queryParams.empresaId as string);
        setEmpresaNombreInvitacion((parsedUrl.queryParams.empresaNombre as string) || 'una empresa');
        setIsLogin(false); // Forzar pantalla de registro
      }
    }
  }, [url]);

  // Calcular la fuerza de la contraseña (0 a 3)
  const [passwordStrength, setPasswordStrength] = useState(0);

  const evaluatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 0) score += 1; // Weak by default if typed
    if (pass.length >= 6 && /[0-9]/.test(pass) && /[a-zA-Z]/.test(pass)) score += 1; // Medium
    if (pass.length >= 8 && /[A-Z]/.test(pass) && /[a-z]/.test(pass) && /[0-9]/.test(pass) && /[^a-zA-Z0-9]/.test(pass)) score += 1; // Strong

    setPasswordStrength(score);
    setPassword(pass);
  };

  const isFormValid = () => {
    if (isLogin) {
      return email.trim().length > 0 && password.length > 0;
    }

    if (!validarEmail(email.trim()) || !validarRutChileno(rut)) return false;


    const req1 = password.length >= 6;
    const req2 = /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password);
    const req3 = /[0-9]/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password);

    if (!req1 || !req2 || !req3) return false;

    if (empresaIdInvitacion) {
      if (!nombre.trim() || !apellido.trim() || !rut.trim() || !funcion.trim()) return false;
    } else if (tipoUsuario === 'contador' || (tipoUsuario === 'usuario' && subTipoUsuario === 'natural')) {
      if (!nombre.trim() || !apellido.trim() || !rut.trim()) return false;
    } else if (tipoUsuario === 'usuario' && subTipoUsuario === 'empresa') {
      if (!nombre.trim() || !apellido.trim() || !razonSocial.trim() || !rut.trim()) return false;
    }

    return true;
  };

  const handleBuscarSii = async () => {
    if (!validarRutChileno(rut)) {
      Alert.alert("RUT Inválido", "Por favor ingresa un RUT de empresa válido antes de buscar.");
      return;
    }

    setBuscandoSii(true);
    try {
      const response = await fetch('https://cerebro-api-807808449081.us-central1.run.app/consultar_rut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: rut.replace(/[^0-9kK]/g, '').toUpperCase() })
      });

      const data = await response.json();
      if (response.ok && data.status === 'exito') {
        setRazonSocial(data.razon_social);
        // Avanzamos al paso 2
        setPasoRegistroEmpresa(2);
      } else {
        Alert.alert(
          "No encontrado",
          "El RUT no se encontró en el SII o no pertenece a una empresa validada. Puedes ingresar la Razón Social manualmente.",
          [
            { text: "Ingresar Manualmente", onPress: () => setPasoRegistroEmpresa(2) }
          ]
        );
      }
    } catch (error) {
      console.error("Error consultando SII:", error);
      Alert.alert("Error de conexión", "No pudimos conectar con el servidor. Puedes continuar ingresando los datos manualmente.");
      setPasoRegistroEmpresa(2);
    } finally {
      setBuscandoSii(false);
    }
  };

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '807808449081-0hei11dh9m3bdb7shgt2cg5ll1ba6ed8.apps.googleusercontent.com',
    redirectUri: makeRedirectUri({ scheme: 'rindefy' })
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

        const req1 = password.length >= 6;
        const req2 = /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password);
        const req3 = /[0-9]/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password);

        if (!req1 || !req2 || !req3) {
          throw new Error("La contraseña debe cumplir con todos los requisitos de seguridad.");
        }


        if (empresaIdInvitacion) {
          if (!nombre.trim() || !apellido.trim() || !rut.trim() || !funcion.trim() || !correoContacto.trim() || !telefonoContacto.trim()) {
            throw new Error("Completa todos los campos obligatorios, incluyendo correo y teléfono de contacto.");
          }
        } else if (tipoUsuario === 'contador' || (tipoUsuario === 'usuario' && subTipoUsuario === 'natural')) {
          if (!nombre.trim() || !apellido.trim() || !rut.trim()) throw new Error("Completa nombre, apellido y RUT.");
        } else if (tipoUsuario === 'usuario' && subTipoUsuario === 'empresa') {
          if (!nombre.trim() || !apellido.trim() || !razonSocial.trim() || !rut.trim()) throw new Error("Completa Nombre del Administrador, Apellido, Razón Social y RUT.");
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

        if (empresaIdInvitacion) {
          await updateProfile(user, { displayName: `${nombre.trim()} ${apellido.trim()}` });
          perfilData.rol = 'trabajador';
          perfilData.nombre = nombre.trim();
          perfilData.apellido = apellido.trim();
          perfilData.funcion = funcion.trim();
          perfilData.correoContacto = correoContacto.trim();
          perfilData.telefonoContacto = telefonoContacto.trim();
          perfilData.empresaId = empresaIdInvitacion;
          perfilData.codigoContador = null;
        } else if (tipoUsuario === 'contador') {
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
          perfilData.nombre = nombre.trim();
          perfilData.apellido = apellido.trim();
          perfilData.razonSocial = razonSocial.trim();
          perfilData.colaboradoresActivos = 0;
          perfilData.codigoContador = null;
        }

        await setDoc(doc(db, "usuarios", user.uid), perfilData);

        // Presentar Paywall de RevenueCat tras registro exitoso
        try {
          await RevenueCatUI.presentPaywall();
        } catch (paywallError) {
          console.log("El usuario cerró el paywall o hubo un error:", paywallError);
        }
      }
    } catch (error: any) {
      let errorMessage = error.message;

      // Traducir los códigos de error comunes de Firebase
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = "Correo o contraseña incorrectos.";
            break;
          case 'auth/email-already-in-use':
            errorMessage = "Este correo electrónico ya está registrado.";
            break;
          case 'auth/invalid-email':
            errorMessage = "El formato del correo electrónico no es válido.";
            break;
          case 'auth/weak-password':
            errorMessage = "La contraseña proporcionada es muy débil.";
            break;
          case 'auth/too-many-requests':
            errorMessage = "Has intentado muchas veces. Por favor, intenta de nuevo más tarde.";
            break;
          case 'auth/network-request-failed':
            errorMessage = "Error de red. Por favor revisa tu conexión a internet.";
            break;
          default:
            errorMessage = "Ocurrió un error inesperado al iniciar sesión.";
        }
      }

      Alert.alert("Error", errorMessage);
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
          <View style={localStyles.logoContainer}>
            <Image source={require('../../assets/images/rindefy_logo.png')} style={localStyles.logo} resizeMode="cover" />
          </View>

          <View style={localStyles.formContainer}>
            {!isLogin && (
              <>
                {empresaIdInvitacion ? (
                  <View style={{ backgroundColor: '#E8F1FF', padding: 15, borderRadius: 12, marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, color: '#007AFF', fontWeight: 'bold', textAlign: 'center' }}>
                      Invitación de Colaborador
                    </Text>
                    <Text style={{ fontSize: 14, color: '#333', textAlign: 'center', marginTop: 5 }}>
                      Estás creando una cuenta para unirte a: <Text style={{ fontWeight: 'bold' }}>{empresaNombreInvitacion}</Text>
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={localStyles.roleSelector}>
                      <TouchableOpacity
                        style={[localStyles.roleBtn, tipoUsuario === 'usuario' && localStyles.roleBtnActive]}
                        onPress={() => {
                          setTipoUsuario('usuario');
                          setPasoRegistroEmpresa(1); // Reset paso si es empresa
                        }}
                      >
                        <Text style={[localStyles.roleText, tipoUsuario === 'usuario' && localStyles.roleTextActive]}>Soy Usuario</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[localStyles.roleBtn, tipoUsuario === 'contador' && localStyles.roleBtnActive]}
                        onPress={() => {
                          setTipoUsuario('contador');
                          setPasoRegistroEmpresa(1);
                        }}
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
                          onPress={() => {
                            setSubTipoUsuario('empresa');
                            setPasoRegistroEmpresa(1);
                          }}
                        >
                          <Text style={[localStyles.subRoleText, subTipoUsuario === 'empresa' && localStyles.subRoleTextActive]}>Empresa</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {empresaIdInvitacion ? (
                  <>
                    <TextInput autoFocus={!isLogin} placeholder="Nombre" placeholderTextColor="#999" value={nombre} onChangeText={setNombre} style={globalStyles.input} />
                    <TextInput placeholder="Apellido" placeholderTextColor="#999" value={apellido} onChangeText={setApellido} style={globalStyles.input} />
                    <TextInput placeholder="Cargo o Función" placeholderTextColor="#999" value={funcion} onChangeText={setFuncion} style={globalStyles.input} />
                    <TextInput
                      placeholder="RUT" placeholderTextColor="#999"
                      value={rut} onChangeText={(t) => setRut(formatearRut(t))}
                      style={globalStyles.input} maxLength={12}
                    />
                    <TextInput
                      placeholder="Correo de Contacto" placeholderTextColor="#999"
                      value={correoContacto} onChangeText={setCorreoContacto}
                      style={globalStyles.input} keyboardType="email-address" autoCapitalize="none"
                    />
                    <TextInput
                      placeholder="Teléfono de Contacto" placeholderTextColor="#999"
                      value={telefonoContacto} onChangeText={setTelefonoContacto}
                      style={globalStyles.input} keyboardType="phone-pad"
                    />
                  </>
                ) : (tipoUsuario === 'contador' || (tipoUsuario === 'usuario' && subTipoUsuario === 'natural')) ? (
                  <>
                    <TextInput
                      autoFocus={!isLogin}
                      placeholder="Nombre" placeholderTextColor="#999"
                      value={nombre} onChangeText={setNombre} style={globalStyles.input}
                    />
                    <TextInput
                      placeholder="Apellido" placeholderTextColor="#999"
                      value={apellido} onChangeText={setApellido} style={globalStyles.input}
                    />
                    <TextInput
                      placeholder="RUT" placeholderTextColor="#999"
                      value={rut} onChangeText={(t) => setRut(formatearRut(t))}
                      style={globalStyles.input} maxLength={12}
                    />
                  </>
                ) : (
                  // FLUJO DE EMPRESA
                  <>
                    {pasoRegistroEmpresa === 1 ? (
                      <>
                        <View style={localStyles.siiContainer}>
                          <Ionicons name="search" size={24} color="#007AFF" />
                          <Text style={localStyles.siiText}>Ingresa el RUT de tu empresa, obtendremos el nombre desde el SII automáticamente.</Text>
                        </View>
                        <TextInput
                          autoFocus={!isLogin}
                          placeholder="RUT Empresa" placeholderTextColor="#999"
                          value={rut} onChangeText={(t) => setRut(formatearRut(t))}
                          style={globalStyles.input} maxLength={12}
                        />
                        <TouchableOpacity
                          style={[
                            globalStyles.btnPrimary,
                            { backgroundColor: validarRutChileno(rut) ? '#007AFF' : '#ccc', marginBottom: 20 }
                          ]}
                          onPress={handleBuscarSii}
                          disabled={!validarRutChileno(rut) || buscandoSii}
                        >
                          {buscandoSii ? <ActivityIndicator color="#fff" /> : <Text style={globalStyles.btnText}>Buscar en SII</Text>}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <View style={localStyles.paso2Header}>
                          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                          <Text style={localStyles.paso2Text}>RUT Valido: {rut}</Text>
                          <TouchableOpacity onPress={() => setPasoRegistroEmpresa(1)}>
                            <Text style={localStyles.paso2Edit}>Editar</Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          autoFocus={true}
                          placeholder="Nombre de la Empresa o Razón Social" placeholderTextColor="#999"
                          value={razonSocial} onChangeText={setRazonSocial} style={globalStyles.input}
                        />
                        <Text style={{ fontSize: 13, color: '#666', marginBottom: 5, marginTop: 5, paddingHorizontal: 5 }}>
                          Información del Administrador:
                        </Text>
                        <TextInput
                          placeholder="Nombre del Administrador" placeholderTextColor="#999"
                          value={nombre} onChangeText={setNombre} style={globalStyles.input}
                        />
                        <TextInput
                          placeholder="Apellido del Administrador" placeholderTextColor="#999"
                          value={apellido} onChangeText={setApellido} style={globalStyles.input}
                        />
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* OCULTAR CAMPOS INFERIORES SI ESTAMOS EN PASO 1 DE EMPRESA */}
            {(!(!isLogin && !empresaIdInvitacion && tipoUsuario === 'usuario' && subTipoUsuario === 'empresa' && pasoRegistroEmpresa === 1)) && (
              <>
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
                    onChangeText={evaluatePasswordStrength}
                    style={localStyles.passwordInput}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={localStyles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#999" />
                  </TouchableOpacity>
                </View>

                {!isLogin && password.length > 0 && (
                  <View style={localStyles.strengthContainer}>
                    <View style={localStyles.strengthBarBg}>
                      <View style={[
                        localStyles.strengthBarFill,
                        { width: passwordStrength === 1 ? '33%' : passwordStrength === 2 ? '66%' : '100%' },
                        { backgroundColor: passwordStrength === 1 ? '#ff4444' : passwordStrength === 2 ? '#FFBB33' : '#00C851' }
                      ]} />
                    </View>
                    <Text style={[
                      localStyles.strengthLabel,
                      { color: passwordStrength === 1 ? '#ff4444' : passwordStrength === 2 ? '#FFBB33' : '#00C851' }
                    ]}>
                      {passwordStrength === 1 ? 'Débil' : passwordStrength === 2 ? 'Media' : 'Fuerte'}
                    </Text>
                  </View>
                )}

                {!isLogin && (
                  <View style={localStyles.passwordReqContainer}>
                    <Text style={password.length >= 6 ? localStyles.reqMet : localStyles.reqUnmet}>
                      {password.length >= 6 ? "✓" : "•"} Debe tener por lo menos 6 caracteres
                    </Text>
                    <Text style={/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? localStyles.reqMet : localStyles.reqUnmet}>
                      {/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? "✓" : "•"} Debe incluir un número y un carácter que no sea ni una letra ni un número
                    </Text>
                    <Text style={/[0-9]/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password) ? localStyles.reqMet : localStyles.reqUnmet}>
                      {/[0-9]/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password) ? "✓" : "•"} Debe incluir números y letras mayúsculas y minúsculas
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    globalStyles.btnPrimary,
                    { marginTop: 10 },
                    !isFormValid() && !isLogin && { backgroundColor: '#cccccc' }
                  ]}
                  onPress={handleAuth}
                  disabled={loadingAuth || (!isFormValid() && !isLogin)}
                >
                  {loadingAuth ? <ActivityIndicator color="#fff" /> : <Text style={globalStyles.btnText}>{isLogin ? "Entrar" : "Registrarse"}</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => {
              setIsLogin(!isLogin);
              setPasoRegistroEmpresa(1);
            }}>
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
  logoContainer: {
    width: 320,
    height: 180,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 380,   // "Muerte" de los bordes laterales
    height: 200,  // "Muerte" de los bordes superior/inferior
  },
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
  eyeIcon: { paddingHorizontal: 16, paddingVertical: 14 },

  // Requisitos de contraseña
  passwordReqContainer: { marginTop: -5, marginBottom: 15, paddingHorizontal: 5 },
  reqUnmet: { fontSize: 13, color: '#666', marginBottom: 4, paddingRight: 10 },
  reqMet: { fontSize: 13, color: '#00C851', marginBottom: 4, fontWeight: '500', paddingRight: 10 },

  // Barra de seguridad
  strengthContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  strengthBarBg: { flex: 1, height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, marginRight: 10, overflow: 'hidden' },
  strengthBarFill: { height: '100%', borderRadius: 3 },
  strengthLabel: { fontSize: 12, fontWeight: 'bold', width: 45, textAlign: 'right' },

  // SII Section
  siiContainer: { flexDirection: 'row', backgroundColor: '#E8F1FF', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15, gap: 10 },
  siiText: { flex: 1, color: '#007AFF', fontSize: 13, fontWeight: '500' },
  paso2Header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5, gap: 8 },
  paso2Text: { flex: 1, fontSize: 13, color: '#333', fontWeight: '500' },
  paso2Edit: { color: '#007AFF', fontSize: 13, fontWeight: 'bold' }
});