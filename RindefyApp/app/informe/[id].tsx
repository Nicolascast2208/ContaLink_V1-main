import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../utils/firebaseconfig';
import { Ionicons } from '@expo/vector-icons';
import WebDashboardLayout from '../../components/WebDashboardLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

interface Informe {
    id: string;
    nombre: string;
    estado: string;
    totalMonto: number;
    fechaCreacion: any;
    empresaId?: string;
}

interface Gasto {
    id: string;
    monto: number;
    comercio: string;
    fechaDetectada: string;
    tipoDocumento: string;
    miniaturaBase64?: string;
    estado: string;
    informeId?: string | null;
}

export default function InformeDetalleScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [informe, setInforme] = useState<Informe | null>(null);
    const [gastosAsociados, setGastosAsociados] = useState<Gasto[]>([]);
    const [gastosSueltos, setGastosSueltos] = useState<Gasto[]>([]);

    const [loading, setLoading] = useState(true);
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [procesando, setProcesando] = useState(false);

    // Referencia al bottom sheet
    const bottomSheetRef = React.useRef<BottomSheet>(null);

    useEffect(() => {
        if (!id || typeof id !== 'string') return;
        const user = auth.currentUser;
        if (!user) return;

        // Escuchar el Informe
        const unsubInforme = onSnapshot(doc(db, 'informes', id), (docSnap) => {
            if (docSnap.exists()) {
                setInforme({ id: docSnap.id, ...docSnap.data() } as Informe);
            } else {
                router.replace('/informes');
            }
        });

        // Escuchar Boletas ASOCIADAS a este informe
        const qAsociados = query(
            collection(db, 'gastos'),
            where('uid', '==', user.uid),
            where('informeId', '==', id)
        );
        const unsubAsociados = onSnapshot(qAsociados, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Gasto));
            setGastosAsociados(data);
        });

        // Escuchar Boletas SUELTAS (sin informeId)
        const qSueltos = query(
            collection(db, 'gastos'),
            where('uid', '==', user.uid),
            where('informeId', '==', null)
        );
        const unsubSueltos = onSnapshot(qSueltos, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Gasto));
            setGastosSueltos(data);
            setLoading(false);
        });

        return () => {
            unsubInforme();
            unsubAsociados();
            unsubSueltos();
        };
    }, [id]);

    const toggleSheet = () => {
        if (showAddSheet) {
            bottomSheetRef.current?.close();
        } else {
            setShowAddSheet(true);
            bottomSheetRef.current?.expand();
        }
    };

    const handleVincularGasto = async (gasto: Gasto) => {
        if (!informe || procesando) return;
        setProcesando(true);

        try {
            const batch = writeBatch(db);

            // 1. Actualizar Gasto
            const gastoRef = doc(db, 'gastos', gasto.id);
            batch.update(gastoRef, { informeId: informe.id });

            // 2. Sumar al Total del Informe
            const informeRef = doc(db, 'informes', informe.id);
            batch.update(informeRef, { totalMonto: informe.totalMonto + gasto.monto });

            await batch.commit();
        } catch (error) {
            console.error("Error vinculando gasto:", error);
            Alert.alert("Error", "No se pudo vincular el gasto al informe");
        } finally {
            setProcesando(false);
        }
    };

    const handleDesvincularGasto = async (gasto: Gasto) => {
        if (!informe || procesando) return;
        setProcesando(true);

        try {
            const batch = writeBatch(db);

            // 1. Quitar InformeId del Gasto
            const gastoRef = doc(db, 'gastos', gasto.id);
            batch.update(gastoRef, { informeId: null });

            // 2. Restar al Total del Informe (Asegurar que no baje de 0 por seguridad)
            const nuevoTotal = Math.max(0, informe.totalMonto - gasto.monto);
            const informeRef = doc(db, 'informes', informe.id);
            batch.update(informeRef, { totalMonto: nuevoTotal });

            await batch.commit();
        } catch (error) {
            console.error("Error desvinculando gasto:", error);
            Alert.alert("Error", "No se pudo quitar el gasto del informe");
        } finally {
            setProcesando(false);
        }
    };

    const handleEnviarAprobacion = async () => {
        if (!informe || gastosAsociados.length === 0) {
            Alert.alert("Informe Vacío", "No puedes enviar un informe sin comprobantes.");
            return;
        }
        if (!informe.empresaId) {
            Alert.alert("Sin Empresa", "No estás vinculado a ninguna empresa para enviar a aprobación.");
            return;
        }

        Alert.alert(
            "Enviar Informe",
            "Una vez enviado, no podrás agregar ni quitar boletas de este informe hasta que sea revisado. ¿Seguro?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sí, Enviar", style: "default", onPress: async () => {
                        try {
                            setProcesando(true);
                            await writeBatch(db)
                                .update(doc(db, 'informes', informe.id), { estado: 'Enviado' })
                                .commit();
                        } catch (e) {
                            Alert.alert("Error", "No se pudo enviar el informe");
                        } finally {
                            setProcesando(false);
                        }
                    }
                }
            ]
        )
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    const isBorrador = informe?.estado === 'Borrador';

    const renderGastoItem = (item: Gasto, isVincular: boolean) => (
        <View style={styles.itemCard} key={item.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.itemIcon}>
                    {item.miniaturaBase64 ? (
                        <Image source={{ uri: item.miniaturaBase64 }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <Ionicons name="receipt" size={24} color="#ddd" />
                    )}
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.comercio}</Text>
                    <Text style={styles.itemSub}>{item.tipoDocumento} • {item.fechaDetectada}</Text>
                    <Text style={styles.itemAmount}>${item.monto.toLocaleString('es-CL')}</Text>
                </View>
            </View>

            {isBorrador && (
                <TouchableOpacity
                    style={[styles.btnAccionGasto, { backgroundColor: isVincular ? '#E8F5E9' : '#FFF5F5' }]}
                    onPress={() => isVincular ? handleVincularGasto(item) : handleDesvincularGasto(item)}
                    disabled={procesando}
                >
                    <Ionicons name={isVincular ? "add-outline" : "remove-outline"} size={20} color={isVincular ? "#00C851" : "#ff4444"} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <WebDashboardLayout rol="trabajador">
            <View style={styles.container}>
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{informe?.nombre || 'Informe'}</Text>
                        <Text style={[styles.headerSubtitle, { color: informe?.estado === 'Enviado' ? '#007AFF' : '#666' }]}>
                            {informe?.estado} • {gastosAsociados.length} documentos
                        </Text>
                    </View>
                </View>

                {/* TOTAL BANNER */}
                <View style={styles.bannerTotal}>
                    <Text style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', fontWeight: 'bold' }}>Total del Informe</Text>
                    <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#101A26' }}>${(informe?.totalMonto || 0).toLocaleString('es-CL')}</Text>
                </View>

                {/* LISTA GASTOS ASOCIADOS */}
                <View style={{ flex: 1, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Comprobantes</Text>
                        {isBorrador && (
                            <TouchableOpacity onPress={toggleSheet} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="add-circle" size={20} color="#007AFF" />
                                <Text style={{ color: '#007AFF', fontWeight: '600', marginLeft: 4 }}>Añadir</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <FlatList
                        data={gastosAsociados}
                        keyExtractor={i => i.id}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 40 }}>
                                <Ionicons name="documents-outline" size={50} color="#ccc" />
                                <Text style={{ color: '#999', marginTop: 10 }}>Este informe está vacío.</Text>
                            </View>
                        }
                        renderItem={({ item }) => renderGastoItem(item, false)}
                    />
                </View>

                {/* BOTÓN ENVIAR */}
                {isBorrador && (
                    <View style={styles.footerAction}>
                        <TouchableOpacity
                            style={[styles.btnEnviar, gastosAsociados.length === 0 && { opacity: 0.5 }]}
                            onPress={handleEnviarAprobacion}
                            disabled={gastosAsociados.length === 0 || procesando}
                        >
                            <Text style={styles.btnEnviarText}>Enviar a Aprobación</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* MODAL DE BOLETAS SUELTAS */}
                {showAddSheet && isBorrador && (
                    <View style={StyleSheet.absoluteFill}>
                        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={toggleSheet} />
                        <View style={styles.sheetContainer}>
                            <View style={styles.sheetHeader}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Gastos Disponibles</Text>
                                <TouchableOpacity onPress={toggleSheet}><Ionicons name="close" size={24} color="#666" /></TouchableOpacity>
                            </View>

                            {gastosSueltos.length === 0 ? (
                                <Text style={{ textAlign: 'center', color: '#888', marginTop: 30 }}>No tienes comprobantes sueltos.</Text>
                            ) : (
                                <FlatList
                                    data={gastosSueltos}
                                    keyExtractor={i => i.id}
                                    contentContainerStyle={{ padding: 20 }}
                                    renderItem={({ item }) => renderGastoItem(item, true)}
                                />
                            )}
                        </View>
                    </View>
                )}

            </View>
        </WebDashboardLayout>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f9' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#101A26' },
    headerSubtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },

    bannerTotal: { margin: 20, padding: 20, backgroundColor: 'white', borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },

    itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    itemIcon: { width: 45, height: 45, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 12 },
    itemTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    itemSub: { fontSize: 12, color: '#888', marginTop: 2 },
    itemAmount: { fontSize: 14, fontWeight: 'bold', color: '#007AFF', marginTop: 2 },

    btnAccionGasto: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

    footerAction: { padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee' },
    btnEnviar: { backgroundColor: '#007AFF', padding: 16, borderRadius: 12, alignItems: 'center' },
    btnEnviarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', backgroundColor: '#f4f6f9', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 1, borderColor: '#eee' }
});
