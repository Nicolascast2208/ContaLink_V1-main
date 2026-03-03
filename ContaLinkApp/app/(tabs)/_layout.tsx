import { Tabs, useRouter, usePathname } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';

import { auth, db } from '../../utils/firebaseconfig';
import { configureRevenueCat } from '../../utils/revenuecat';
import LoginScreen from '../screens/LoginScreen'; // Ajusta la ruta si es necesario

// Inicializamos RevenueCat al arrancar la app
configureRevenueCat();

export default function TabLayout() {
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const docRef = doc(db, "usuarios", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setRol(docSnap.data().rol); // Puede ser: 'persona_natural', 'admin_empresa', 'contador'
          }
        } catch (e) {
          console.error("Error al obtener rol:", e);
        }
      } else {
        setUser(null);
        setRol(null);
      }
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // 👇 EL ENRUTADOR INTELIGENTE 👇
  useEffect(() => {
    // Si ya cargó la info y el usuario está en la raíz "/"
    if (!initializing && user && rol !== null && pathname === '/') {
      if (rol === 'contador') {
        setTimeout(() => router.replace('/clientes'), 0);
      } else if (rol === 'admin_empresa') {
        // Redirigimos a la vista principal de la empresa
        setTimeout(() => router.replace('/empresa_gastos'), 0);
      }
      // Si es 'persona_natural', 'trabajador' o 'usuario', se queda en '/' (Mis Gastos normales)
    }
  }, [initializing, user, rol, pathname]);

  if (initializing || (user && rol === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#EAEAEA',
            height: Platform.OS === 'ios' ? 85 : 65, // Ajuste para el notch de iOS
            paddingBottom: Platform.OS === 'ios' ? 25 : 10,
            paddingTop: 5,
          },
        }}>

        {/* ==========================================
            VISTAS DE PERSONA NATURAL
            ========================================== */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Mis Gastos',
            // Solo visible si NO es contador y NO es empresa
            href: (rol === 'contador' || rol === 'admin_empresa') ? null : '/',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="calendario"
          options={{
            title: 'Historial',
            href: (rol === 'contador' || rol === 'admin_empresa') ? null : '/calendario',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
            ),
          }}
        />

        {/* ==========================================
            VISTAS DE CONTADOR
            ========================================== */}
        <Tabs.Screen
          name="clientes"
          options={{
            title: 'Clientes',
            href: rol === 'contador' ? '/clientes' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
            ),
          }}
        />

        {/* ==========================================
            VISTAS DE EMPRESA
            ========================================== */}
        <Tabs.Screen
          name="empresa_gastos"
          options={{
            title: 'Gastos Empresa',
            href: rol === 'admin_empresa' ? '/empresa_gastos' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "business" : "business-outline"} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="empresa_colaboradores"
          options={{
            title: 'Colaboradores',
            href: rol === 'admin_empresa' ? '/empresa_colaboradores' : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "people-circle" : "people-circle-outline"} size={26} color={color} />
            ),
          }}
        />

        {/* ==========================================
            VISTA COMPARTIDA POR TODOS
            ========================================== */}
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            href: '/perfil', // Visible para todos siempre
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}