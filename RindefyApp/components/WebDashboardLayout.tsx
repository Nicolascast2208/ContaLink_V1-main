import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { auth } from '../utils/firebaseconfig';

import ResponsiveSidebar from './ResponsiveSidebar';

interface WebDashboardLayoutProps {
    rol: string | null;
    children: React.ReactNode;
}

export default function WebDashboardLayout({ rol, children }: WebDashboardLayoutProps) {
    const { width } = useWindowDimensions();

    // Si es pantalla pequeña o móvil, no interceptar el layout nativo
    if (width < 1000) {
        return <>{children}</>;
    }

    return (
        <View style={styles.container}>
            {/* Top Navbar */}
            <View style={styles.topNav}>
                <View style={styles.brandContainer}>
                    <View style={styles.logoBg}>
                        <Image
                            source={require('../assets/images/rindefy_logo_app.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.brandTitle}>Rindefy</Text>
                </View>

                <View style={styles.userSection}>
                    <View style={{ alignItems: 'flex-end', marginRight: 15 }}>
                        <Text style={styles.userName}>{auth.currentUser?.displayName || 'Usuario'}</Text>
                        <Text style={styles.userEmail}>{auth.currentUser?.email || ''}</Text>
                    </View>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={20} color="#0088ff" />
                    </View>
                </View>
            </View>

            <View style={styles.bodyContainer}>
                {/* Left Sidebar */}
                <View style={styles.sidebar}>
                    <ResponsiveSidebar rol={rol} />
                </View>

                {/* Main Content Area (Canvas) */}
                <View style={styles.mainContent}>
                    <View style={styles.contentWrapper}>
                        {children}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: '#f4f6f9', // Fondo gris de fondo
    },
    topNav: {
        height: 60,
        backgroundColor: '#0088ff', // Azul vibrante estilo Rindegastos
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoBg: {
        width: 32,
        height: 32,
        backgroundColor: 'white',
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    logo: {
        width: 24,
        height: 24,
    },
    brandTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userName: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    userEmail: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodyContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: 250,
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#EAEAEA',
        height: '100%',
        paddingTop: 15,
        elevation: 2,
        zIndex: 5,
    },
    mainContent: {
        flex: 1,
        backgroundColor: '#f4f6f9', // Fondo gris general
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20, // Margen alrededor del contenido para que no toque los bordes (Efecto Dashboard Moderno)
    },
    contentWrapper: {
        flex: 1,
        width: '100%',
        maxWidth: 1200, // Limite para que en pantallas ultra wide no sea infinito
        backgroundColor: '#ffffff', // Fondo de la App blanca nativa
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    }
});
