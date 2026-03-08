import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../utils/firebaseconfig';
import WebDashboardLayout from '../../components/WebDashboardLayout';

interface Informe {
    id: string;
    nombre: string;
    estado: string;
    totalMonto: number;
    fechaCreacion: string | Date;
    cantidadBoletas?: number;
}

export default function InformesScreen() {
    const router = useRouter();
    const [informes, setInformes] = useState<Informe[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [creando, setCreando] = useState(false);
    const [userEmpresaId, setUserEmpresaId] = useState<string | null>(null);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Obtener la empresa del usuario
        const fetchUserRole = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
                if (userDoc.exists()) {
                    setUserEmpresaId(userDoc.data().empresaId || null);
                }
            } catch (e) {
                console.error("Error fetching user role:", e);
            }
        };
        fetchUserRole();

        const q = query(
            collection(db, 'informes'),
            where('uid', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Informe[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as Informe);
            });

            // Ordenar por fecha (más recientes primero)
            data.sort((a, b) => {
                const dateA = a.fechaCreacion instanceof Date ? a.fechaCreacion.getTime() : (a.fechaCreacion as any)?.toMillis?.() || 0;
                const dateB = b.fechaCreacion instanceof Date ? b.fechaCreacion.getTime() : (b.fechaCreacion as any)?.toMillis?.() || 0;
                return dateB - dateA;
            });

            setInformes(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCrearInforme = async () => {
        if (!nuevoNombre.trim()) {
            Alert.alert('Error', 'Por favor ingresa un nombre para el informe');
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        setCreando(true);
        try {
            const docRef = await addDoc(collection(db, 'informes'), {
                uid: user.uid,
                empresaId: userEmpresaId, // Puede ser null si rinde como persona natural
                nombre: nuevoNombre.trim(),
                fechaCreacion: serverTimestamp(),
                estado: 'Borrador',
                totalMonto: 0,
            });

            setShowCreateModal(false);
            setNuevoNombre('');
            // Redirigir a la vista de detalle del nuevo informe (se implementará a continuación)
            // router.push(`/informe/${docRef.id}`);
        } catch (error) {
            console.error("Error creando informe:", error);
            Alert.alert('Error', 'No se pudo crear el informe');
        } finally {
            setCreando(false);
        }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'Pendiente': return '#FF8800'; // Naranja
            case 'Enviado': return '#007AFF'; // Azul
            case 'Aprobado': return '#00C851'; // Verde
            case 'Rechazado': return '#ff4444'; // Rojo
            case 'Borrador': default: return '#666666'; // Gris
        }
    };

    const formatearFecha = (fecha: any) => {
        if (!fecha) return 'Sin fecha';
        if (fecha.toDate) {
            return fecha.toDate().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        }
        return 'Fecha inválida';
    };

    return (
        <WebDashboardLayout rol="trabajador">
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Mis Informes</Text>
                    <Text style={styles.headerSubtitle}>Agrupa tus boletas y envíalas a revisión</Text>
                </View>

                <FlatList
                    data={informes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            {loading ? (
                                <ActivityIndicator size="large" color="#007AFF" />
                            ) : (
                                <>
                                    <Ionicons name="folder-open-outline" size={60} color="#ccc" />
                                    <Text style={{ marginTop: 15, fontSize: 18, color: '#666', fontWeight: 'bold' }}>Sin Informes Activos</Text>
                                    <Text style={{ marginTop: 5, color: '#999', textAlign: 'center', marginHorizontal: 40 }}>
                                        Crea una carpeta para agrupar las boletas de tu próximo viaje o caja chica.
                                    </Text>
                                </>
                            )}
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            onPress={() => router.push(`/informe/${item.id}` as any)}
                        >
                            <View style={styles.cardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Ionicons name="folder" size={24} color="#007AFF" style={{ marginRight: 10 }} />
                                    <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text>
                                </View>
                                <View style={[styles.badge, { backgroundColor: getEstadoColor(item.estado) + '20' }]}>
                                    <Text style={[styles.badgeText, { color: getEstadoColor(item.estado) }]}>{item.estado}</Text>
                                </View>
                            </View>

                            <View style={styles.cardFooter}>
                                <Text style={styles.dateText}>Creado: {formatearFecha(item.fechaCreacion)}</Text>
                                <Text style={styles.totalText}>${(item.totalMonto || 0).toLocaleString('es-CL')}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />

                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setShowCreateModal(true)}
                >
                    <Ionicons name="add" size={30} color="white" />
                </TouchableOpacity>

                {/* Modal Crear Informe */}
                <Modal
                    visible={showCreateModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowCreateModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Nuevo Informe</Text>
                                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                    <Ionicons name="close" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Nombre del Informe</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Viaje a Antofagasta"
                                value={nuevoNombre}
                                onChangeText={setNuevoNombre}
                                autoFocus
                            />

                            <TouchableOpacity
                                style={[styles.btnCrear, (!nuevoNombre.trim() || creando) && styles.btnDisabled]}
                                onPress={handleCrearInforme}
                                disabled={!nuevoNombre.trim() || creando}
                            >
                                {creando ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.btnCrearText}>Crear Informe</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </View>
        </WebDashboardLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f9',
    },
    header: {
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderColor: '#eee',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#101A26',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        flex: 1,
        marginRight: 10,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: '#f0f0f0',
        paddingTop: 12,
    },
    dateText: {
        fontSize: 13,
        color: '#888',
    },
    totalText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: '#007AFF',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#555',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        marginBottom: 24,
    },
    btnCrear: {
        backgroundColor: '#007AFF',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    btnDisabled: {
        backgroundColor: '#A0C8FF',
    },
    btnCrearText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
