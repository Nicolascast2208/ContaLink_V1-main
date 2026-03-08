import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FiltrosGlobales, OrdenFiltro, TipoFiltro, EstadoFiltro } from '../utils/filterSortGastos';

const { height } = Dimensions.get('window');

interface FilterSortModalProps {
    visible: boolean;
    onClose: () => void;
    filtrosActuales: FiltrosGlobales;
    onApply: (nuevosFiltros: FiltrosGlobales) => void;
    // Opcional: para vistas donde no tienen sentido ciertos estados (ej. Cliente no ve "Procesado")
    estadosDisponibles?: EstadoFiltro[];
}

export default function FilterSortModal({ visible, onClose, filtrosActuales, onApply, estadosDisponibles = ['Todos', 'Aprobado', 'Pendiente', 'Rechazado'] }: FilterSortModalProps) {
    const [tempFiltros, setTempFiltros] = useState<FiltrosGlobales>({ ...filtrosActuales });

    useEffect(() => {
        if (visible) {
            setTempFiltros({ ...filtrosActuales });
        }
    }, [visible, filtrosActuales]);

    const handleApply = () => {
        onApply(tempFiltros);
        onClose();
    };

    const handleReset = () => {
        setTempFiltros({ orden: 'fecha_desc', tipo: 'Todos', estado: 'Todos' });
    };

    const OptionBadge = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
        <TouchableOpacity
            style={[styles.badge, active && styles.badgeActive]}
            onPress={onPress}
        >
            <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />

                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Filtros y Orden</Text>
                        <TouchableOpacity onPress={handleReset}>
                            <Text style={styles.btnResetText}>Limpiar</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {/* SECCIÓN 1: ORDENAR POR */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                <Ionicons name="swap-vertical" size={16} /> Ordenar por
                            </Text>

                            <Text style={styles.subLabel}>Fecha de Detección</Text>
                            <View style={styles.row}>
                                <OptionBadge label="Más recientes" active={tempFiltros.orden === 'fecha_desc'} onPress={() => setTempFiltros({ ...tempFiltros, orden: 'fecha_desc' })} />
                                <OptionBadge label="Más antiguas" active={tempFiltros.orden === 'fecha_asc'} onPress={() => setTempFiltros({ ...tempFiltros, orden: 'fecha_asc' })} />
                            </View>

                            <Text style={[styles.subLabel, { marginTop: 10 }]}>Monto del Gasto</Text>
                            <View style={styles.row}>
                                <OptionBadge label="Mayor a menor" active={tempFiltros.orden === 'precio_desc'} onPress={() => setTempFiltros({ ...tempFiltros, orden: 'precio_desc' })} />
                                <OptionBadge label="Menor a mayor" active={tempFiltros.orden === 'precio_asc'} onPress={() => setTempFiltros({ ...tempFiltros, orden: 'precio_asc' })} />
                            </View>
                        </View>

                        {/* SECCIÓN 2: FILTRAR POR TIPO */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                <Ionicons name="document-text-outline" size={16} /> Tipo de Documento
                            </Text>
                            <View style={styles.row}>
                                <OptionBadge label="Todos" active={tempFiltros.tipo === 'Todos'} onPress={() => setTempFiltros({ ...tempFiltros, tipo: 'Todos' })} />
                                <OptionBadge label="Boleta" active={tempFiltros.tipo === 'Boleta'} onPress={() => setTempFiltros({ ...tempFiltros, tipo: 'Boleta' })} />
                                <OptionBadge label="Factura" active={tempFiltros.tipo === 'Factura'} onPress={() => setTempFiltros({ ...tempFiltros, tipo: 'Factura' })} />
                            </View>
                        </View>

                        {/* SECCIÓN 3: FILTRAR POR ESTADO */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                <Ionicons name="checkmark-circle-outline" size={16} /> Estado
                            </Text>
                            <View style={styles.row}>
                                {estadosDisponibles.map(est => (
                                    <OptionBadge key={est} label={est} active={tempFiltros.estado === est} onPress={() => setTempFiltros({ ...tempFiltros, estado: est })} />
                                ))}
                            </View>
                        </View>

                    </ScrollView>

                    {/* BOTONES ACCIÓN */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
                            <Text style={styles.btnCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnApply} onPress={handleApply}>
                            <Text style={styles.btnApplyText}>Aplicar Filtros</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: height * 0.85,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    btnResetText: {
        color: '#007AFF',
        fontSize: 15,
        fontWeight: '600',
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 12,
    },
    subLabel: {
        fontSize: 13,
        color: '#666',
        marginBottom: 8,
        fontWeight: '500',
    },
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    badgeActive: {
        backgroundColor: '#E5F1FF',
        borderColor: '#007AFF',
    },
    badgeText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    badgeTextActive: {
        color: '#007AFF',
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
    },
    btnCancel: {
        flex: 1,
        padding: 16,
        borderRadius: 14,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
    },
    btnCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    btnApply: {
        flex: 2,
        padding: 16,
        borderRadius: 14,
        backgroundColor: '#007AFF',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    btnApplyText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    }
});
