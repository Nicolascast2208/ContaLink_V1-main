import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

interface SidebarProps {
    rol: string | null;
}

export default function ResponsiveSidebar({ rol }: SidebarProps) {
    const router = useRouter();
    const pathname = usePathname();

    // Accordion states
    const [openSections, setOpenSections] = useState({
        rendidor: true,
        aprobador: true,
        administrador: true
    });

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const isVisible = (requiredRoles: string[]) => {
        if (!rol) return false;
        return requiredRoles.includes(rol);
    };

    // Define structure
    const rendidorItems = [
        { name: 'Gastos', icon: 'receipt-outline', path: '/', roles: ['persona_natural', 'trabajador', 'usuario', 'contador', 'admin_empresa'] },
        { name: 'Informes', icon: 'document-text-outline', path: '/informes', roles: ['persona_natural', 'trabajador', 'usuario', 'contador', 'admin_empresa'] },
        { name: 'Fondos', icon: 'cash-outline', path: '/fondos_dummy', roles: ['persona_natural', 'trabajador', 'usuario', 'contador', 'admin_empresa'], disabled: true },
        { name: 'Perfil', icon: 'person-outline', path: '/perfil', roles: ['persona_natural', 'trabajador', 'usuario', 'contador', 'admin_empresa'] },
    ];

    const aprobadorItems = [
        { name: 'Informe de Gastos', icon: 'checkmark-circle-outline', path: '/empresa_gastos', roles: ['contador', 'admin_empresa'] },
    ];

    const adminItems = [
        { name: 'Panel de Control', icon: 'pie-chart-outline', path: '/empresa_graficos', roles: ['contador', 'admin_empresa'] },
        { name: 'Colaboradores', icon: 'people-outline', path: '/empresa_colaboradores', roles: ['admin_empresa'] },
        { name: 'Clientes', icon: 'people-outline', path: '/clientes', roles: ['contador'] },
        { name: 'Usuarios', icon: 'person-add-outline', path: '/usuarios_dummy', roles: ['contador', 'admin_empresa'], disabled: true },
        { name: 'Políticas', icon: 'shield-checkmark-outline', path: '/politicas_dummy', roles: ['contador', 'admin_empresa'], disabled: true },
    ];

    // Check if section should render at all
    const showRendidor = rendidorItems.some(i => isVisible(i.roles));
    const showAprobador = aprobadorItems.some(i => isVisible(i.roles));
    const showAdmin = adminItems.some(i => isVisible(i.roles));

    // Reusable Item Renderer
    const renderItems = (items: typeof rendidorItems) => {
        return items.filter(i => isVisible(i.roles)).map(item => {
            const isActive = pathname === item.path || (pathname === '/index' && item.path === '/');
            return (
                <TouchableOpacity
                    key={item.path}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                    onPress={() => !item.disabled && router.navigate(item.path as any)}
                    activeOpacity={item.disabled ? 1 : 0.6}
                >
                    <Ionicons
                        name={isActive && !item.disabled ? item.icon.replace('-outline', '') as any : item.icon}
                        size={20}
                        color={isActive ? '#0088ff' : (item.disabled ? '#ccc' : '#555')}
                    />
                    <Text style={[styles.menuText, isActive && styles.menuTextActive, item.disabled && { color: '#ccc' }]}>
                        {item.name}
                    </Text>
                    {item.disabled && <Text style={{ fontSize: 10, color: '#ccc', marginLeft: 'auto' }}>Próximamente</Text>}
                </TouchableOpacity>
            );
        });
    };

    return (
        <View style={styles.sidebarContainer}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 1. SECCIÓN RENDIDOR */}
                {showRendidor && (
                    <View style={styles.sectionContainer}>
                        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('rendidor')}>
                            <Text style={styles.sectionTitle}>Rendidor</Text>
                            <Ionicons name={openSections.rendidor ? "chevron-down" : "chevron-forward"} size={16} color="#666" />
                        </TouchableOpacity>
                        {openSections.rendidor && (
                            <View style={styles.sectionBody}>
                                {renderItems(rendidorItems)}
                            </View>
                        )}
                    </View>
                )}

                {/* 2. SECCIÓN APROBADOR */}
                {showAprobador && (
                    <View style={styles.sectionContainer}>
                        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('aprobador')}>
                            <Text style={styles.sectionTitle}>Aprobador</Text>
                            <Ionicons name={openSections.aprobador ? "chevron-down" : "chevron-forward"} size={16} color="#666" />
                        </TouchableOpacity>
                        {openSections.aprobador && (
                            <View style={styles.sectionBody}>
                                {renderItems(aprobadorItems)}
                            </View>
                        )}
                    </View>
                )}

                {/* 3. SECCIÓN ADMINISTRADOR */}
                {showAdmin && (
                    <View style={styles.sectionContainer}>
                        <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('administrador')}>
                            <Text style={styles.sectionTitle}>Administrador</Text>
                            <Ionicons name={openSections.administrador ? "chevron-down" : "chevron-forward"} size={16} color="#666" />
                        </TouchableOpacity>
                        {openSections.administrador && (
                            <View style={styles.sectionBody}>
                                {renderItems(adminItems)}
                            </View>
                        )}
                    </View>
                )}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebarContainer: {
        width: 250,
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#EAEAEA',
        height: '100%',
        paddingTop: Platform.OS === 'web' ? 20 : 50,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    sectionContainer: {
        marginBottom: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#444',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionBody: {
        marginTop: 5,
        paddingRight: 15, // Deja espacio derecho, pero el izquierdo debe pegar al borde
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingLeft: 20, // Sangría interna
        paddingRight: 10,
        borderLeftWidth: 4,
        borderLeftColor: 'transparent',
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
    },
    menuItemActive: {
        backgroundColor: '#f3f4f6', // Rindegastos slight gray
        borderLeftColor: '#0088ff', // Rindegastos thick blue line
    },
    menuText: {
        fontSize: 14,
        marginLeft: 15,
        color: '#555',
        fontWeight: '500',
    },
    menuTextActive: {
        color: '#0088ff',
        fontWeight: 'bold',
    }
});
