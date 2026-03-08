import { Tabs, useRouter, usePathname } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../utils/firebaseconfig';
import { configureRevenueCat } from '../../utils/revenuecat';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import WebDashboardLayout from '../../components/WebDashboardLayout';

// Inicializamos RevenueCat al arrancar la app
configureRevenueCat();

export default function TabLayout() {
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [viewedOnboarding, setViewedOnboarding] = useState<boolean | null>(null);

  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1000;

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem('@viewedOnboarding');
        setViewedOnboarding(value !== null);
      } catch (err) {
        setViewedOnboarding(false);
      }
    };
    checkOnboarding();
  }, []);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log(" Auth state changed. User:", currentUser ? currentUser.uid : "null");
      if (currentUser) {
        setUser(currentUser);
        try {
          const docRef = doc(db, "usuarios", currentUser.uid);
          const docSnap = await getDoc(docRef);

          console.log(" DocSnap exists?", docSnap.exists());
          if (docSnap.exists()) {
            console.log(" Usuario data:", docSnap.data());
            setRol(docSnap.data().rol || 'persona_natural'); // Fallback si no tiene rol
          } else {
            console.log(" Usuario no existe en Firestore, forzando rol por defecto");
            setRol('persona_natural'); // Asignar un rol por defecto para salir del loop
          }
        } catch (e) {
          console.error(" Error al obtener rol:", e);
          setRol('error'); // Evitar loop infinito
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

  if (initializing || (user && rol === null) || (!user && viewedOnboarding === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    if (!viewedOnboarding) {
      return (
        <OnboardingScreen
          onFinish={async () => {
            await AsyncStorage.setItem('@viewedOnboarding', 'true');
            setViewedOnboarding(true);
          }}
        />
      );
    }
    return <LoginScreen />;
  }

  return (
    <WebDashboardLayout rol={rol}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <StatusBar style="dark" />

        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: '#999',
            tabBarStyle: {
              display: isDesktop ? 'none' : 'flex',
              backgroundColor: '#ffffff',
              borderTopWidth: 1,
              borderTopColor: '#EAEAEA',
              height: Platform.OS === 'ios' ? 65 : 55, // Reducido
              paddingBottom: Platform.OS === 'ios' ? 10 : 5, // Reducido
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
            name="empresa_graficos"
            options={{
              title: 'Gráficos',
              href: rol === 'admin_empresa' ? '/empresa_graficos' : null,
              tabBarIcon: ({ color, focused }) => (
                <Ionicons name={focused ? "pie-chart" : "pie-chart-outline"} size={24} color={color} />
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
    </WebDashboardLayout>
  );
}