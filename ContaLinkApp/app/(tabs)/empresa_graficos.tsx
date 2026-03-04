import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { PieChart } from 'react-native-gifted-charts';

import { auth, db } from '../../utils/firebaseconfig';

const { width } = Dimensions.get('window');

interface Gasto {
    id: string;
    monto: number;
    estadoAprobacion: string; // 'Aprobado', 'Rechazado', 'Pendiente'
    empresaId: string;
    nombreTrabajador?: string;
    categoriaComercio?: string;
}

export default function EmpresaGraficosScreen() {
    const [user, setUser] = useState<any>(null);
    const [empresaId, setEmpresaId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Stats
    const [totalBoletas, setTotalBoletas] = useState(0);
    const [montoAprobado, setMontoAprobado] = useState(0);

    // Stats Desglosados
    const [countAprobado, setCountAprobado] = useState(0);
    const [countPendiente, setCountPendiente] = useState(0);
    const [countRechazado, setCountRechazado] = useState(0);

    // Colaboradores Data
    const [colaboradorStats, setColaboradorStats] = useState<any[]>([]);

    // Categorias Data
    const [categoriasStats, setCategoriasStats] = useState<[string, { cantidad: number, monto: number }][]>([]);

    useEffect(() => {
        let unsubscribeGastos: () => void;

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setEmpresaId(currentUser.uid);

                // Configurar listener en tiempo real
                const q = query(collection(db, "gastos"), where("empresaId", "==", currentUser.uid));

                unsubscribeGastos = onSnapshot(q, (snapshot) => {
                    let total = 0;
                    let sumAprobado = 0;
                    let cAprobado = 0;
                    let cRechazado = 0;
                    let cPendiente = 0;
                    const colabsResumen: Record<string, { cantidad: number; monto: number }> = {};
                    const categoriasResumen: Record<string, { cantidad: number, monto: number }> = {};

                    snapshot.forEach(doc => {
                        const data = doc.data() as Gasto;
                        // Ignore strictly those marked as deleted. 
                        // Documents marked as 'Duplicado' by AI are still visible to the Admin until they delete it.
                        if (data.estadoAprobacion === 'Eliminado') return;

                        total++;
                        const monto = Number(data.monto) || 0;
                        const nombreColab = data.nombreTrabajador || 'Desconocido';
                        const estado = data.estadoAprobacion || 'Pendiente';

                        if (estado === 'Aprobado') {
                            cAprobado++;
                            sumAprobado += monto;
                        } else if (estado === 'Rechazado') {
                            cRechazado++;
                        } else {
                            cPendiente++;
                        }

                        // Mapeo para colaboradores
                        if (!colabsResumen[nombreColab]) {
                            colabsResumen[nombreColab] = { cantidad: 0, monto: 0 };
                        }
                        colabsResumen[nombreColab].cantidad += 1;
                        if (estado === 'Aprobado') {
                            colabsResumen[nombreColab].monto += monto;

                            // Mapeo de Categorias (Solo dinero aprobado)
                            const categoria = data.categoriaComercio || 'Otro';
                            if (!categoriasResumen[categoria]) categoriasResumen[categoria] = { cantidad: 0, monto: 0 };
                            categoriasResumen[categoria].monto += monto;
                            categoriasResumen[categoria].cantidad += 1;
                        }
                    });

                    setTotalBoletas(total);
                    setMontoAprobado(sumAprobado);
                    setCountAprobado(cAprobado);
                    setCountPendiente(cPendiente);
                    setCountRechazado(cRechazado);

                    // Format data for BarChart (Top 5)
                    const sortedColabs = Object.entries(colabsResumen)
                        .sort((a, b) => b[1].cantidad - a[1].cantidad)
                        .slice(0, 5);

                    const sortedCategorias = Object.entries(categoriasResumen)
                        .sort((a, b) => b[1].monto - a[1].monto);

                    setColaboradorStats(sortedColabs);
                    setCategoriasStats(sortedCategorias);
                    setLoading(false);
                }, (error) => {
                    console.error("Error cargando estadísticas: ", error);
                    setLoading(false);
                });

            } else {
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeGastos) {
                unsubscribeGastos();
            }
        };
    }, []);


    const formatCLP = (valor: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(valor);
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Panel de Métricas</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* KPIs Principales */}
                <View style={styles.kpiContainer}>
                    <View style={[styles.kpiCard, { backgroundColor: '#E3F2FD' }]}>
                        <Text style={styles.kpiTitle}>Gasto Aprobado</Text>
                        <Text style={[styles.kpiValue, { color: '#007AFF' }]} numberOfLines={1} adjustsFontSizeToFit>{formatCLP(montoAprobado)}</Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: '#F3E5F5' }]}>
                        <Text style={styles.kpiTitle}>Total Boletas</Text>
                        <Text style={[styles.kpiValue, { color: '#8E24AA' }]} numberOfLines={1} adjustsFontSizeToFit>{totalBoletas}</Text>
                    </View>
                </View>

                {/* Gráfico Nativo (Barra Horizontal) de Estados */}
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Estado de Documentos</Text>
                    <Text style={styles.chartSubtitle}>Total: {totalBoletas} boletas ingresadas</Text>

                    {totalBoletas > 0 ? (
                        <View style={{ marginTop: 20 }}>
                            {/* Barra Stack horizontal */}
                            <View style={{ height: 20, width: '100%', flexDirection: 'row', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                                {countAprobado > 0 && <View style={{ flex: countAprobado, backgroundColor: '#34C759' }} />}
                                {countPendiente > 0 && <View style={{ flex: countPendiente, backgroundColor: '#FF9500' }} />}
                                {countRechazado > 0 && <View style={{ flex: countRechazado, backgroundColor: '#FF3B30' }} />}
                            </View>

                            {/* Leyenda Desglosada */}
                            <View style={styles.legendContainer}>
                                <View style={styles.legendRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.legendColor, { backgroundColor: '#34C759' }]} />
                                        <Text style={styles.legendText}>Aprobadas</Text>
                                    </View>
                                    <Text style={styles.legendCount}>{countAprobado}</Text>
                                </View>

                                <View style={styles.legendRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.legendColor, { backgroundColor: '#FF9500' }]} />
                                        <Text style={styles.legendText}>Pendientes</Text>
                                    </View>
                                    <Text style={styles.legendCount}>{countPendiente}</Text>
                                </View>

                                <View style={styles.legendRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[styles.legendColor, { backgroundColor: '#FF3B30' }]} />
                                        <Text style={styles.legendText}>Rechazadas</Text>
                                    </View>
                                    <Text style={styles.legendCount}>{countRechazado}</Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>Aún no hay documentos</Text>
                    )}
                </View>

                {/* Gráfico Nativo de Barras - Top Colaboradores (Volumen) */}
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Top Colaboradores (Volumen)</Text>
                    <Text style={styles.chartSubtitle}>Por cantidad de boletas ingresadas</Text>

                    <View style={{ marginTop: 20 }}>
                        {colaboradorStats.length > 0 ? (
                            colaboradorStats.map((colab, idx) => {
                                const maxVol = Math.max(...colaboradorStats.map(c => c[1].cantidad));
                                const widthPercent = (colab[1].cantidad / maxVol) * 100;

                                return (
                                    <View key={idx} style={{ marginBottom: 15 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                            <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{colab[0]}</Text>
                                            <Text style={{ fontSize: 14, color: '#007AFF', fontWeight: 'bold' }}>{colab[1].cantidad} docs</Text>
                                        </View>
                                        <View style={{ height: 12, backgroundColor: '#E3F2FD', borderRadius: 6, width: '100%', overflow: 'hidden' }}>
                                            <View style={{ height: '100%', width: `${widthPercent}%`, backgroundColor: '#007AFF', borderRadius: 6 }} />
                                        </View>
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>Aún no hay datos</Text>
                        )}
                    </View>
                </View>

                {/* Gráfico de Categorías Inteligente */}
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Distribución de Gastos</Text>
                    <Text style={styles.chartSubtitle}>Agrupados por Categoría Inteligente (IA)</Text>

                    <View style={{ marginTop: 20, alignItems: 'center' }}>
                        {categoriasStats.length > 0 ? (
                            <>
                                <PieChart
                                    donut
                                    data={categoriasStats.map((cat, idx) => {
                                        const colores = ['#007AFF', '#FF2D55', '#FF9500', '#34C759', '#5AC8FA', '#5856D6', '#AF52DE', '#FFCC00'];
                                        return {
                                            value: cat[1].monto,
                                            color: colores[idx % colores.length],
                                            focused: idx === 0
                                        };
                                    })}
                                    radius={100}
                                    innerRadius={70}
                                    innerCircleColor={'#fff'}
                                    centerLabelComponent={() => {
                                        const highestCat = categoriasStats[0];
                                        const totalMonto = categoriasStats.reduce((acc, c) => acc + c[1].monto, 0);
                                        const percentage = totalMonto > 0 ? (highestCat[1].monto / totalMonto * 100).toFixed(0) : '0';

                                        return (
                                            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 18, color: '#333', fontWeight: 'bold' }}>{percentage}%</Text>
                                                <Text style={{ fontSize: 12, color: '#666' }}>{highestCat[0]}</Text>
                                            </View>
                                        );
                                    }}
                                />

                                {/* Leyenda del Pie Chart */}
                                <View style={{ width: '100%', marginTop: 20 }}>
                                    {categoriasStats.map((cat, idx) => {
                                        const colores = ['#007AFF', '#FF2D55', '#FF9500', '#34C759', '#5AC8FA', '#5856D6', '#AF52DE', '#FFCC00'];
                                        const barColor = colores[idx % colores.length];
                                        const cantidadBoletas = cat[1].cantidad;
                                        const textoBoletas = cantidadBoletas === 1 ? '1 boleta' : `${cantidadBoletas} boletas`;

                                        return (
                                            <View key={idx} style={[styles.legendRow, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={[styles.legendColor, { backgroundColor: barColor }]} />
                                                    <View>
                                                        <Text style={[styles.legendText, { fontWeight: 'bold', fontSize: 14 }]}>{cat[0]}</Text>
                                                        <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{textoBoletas}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[styles.legendCount, { color: barColor, fontWeight: 'bold' }]}>{formatCLP(cat[1].monto)}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </>
                        ) : (
                            <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>Aún no hay categorías registradas</Text>
                        )}
                    </View>
                </View>

                {/* Lista Resumen por Colaborador */}
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Desglose Aprobado por Colaborador</Text>
                    {colaboradorStats.length > 0 ? (
                        colaboradorStats.map((colab, idx) => (
                            <View key={idx} style={styles.colabRow}>
                                <Text style={styles.colabName}>{colab[0]}</Text>
                                <Text style={styles.colabAmount}>{formatCLP(colab[1].monto)}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>Aún no hay datos</Text>
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f9' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        padding: 20,
        paddingTop: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
    scrollContent: { padding: 15, paddingBottom: 50 },

    kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    kpiCard: {
        flex: 1, padding: 15, borderRadius: 15, marginHorizontal: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3
    },
    kpiTitle: { fontSize: 13, color: '#666', fontWeight: '600', marginBottom: 8 },
    kpiValue: { fontSize: 24, fontWeight: '800' },

    chartCard: {
        backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15, marginHorizontal: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3
    },
    chartTitle: { fontSize: 18, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 5 },
    chartSubtitle: { fontSize: 13, color: '#888' },

    legendContainer: { marginTop: 10 },
    legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    legendText: { fontSize: 15, color: '#555' },
    legendCount: { fontSize: 16, fontWeight: 'bold', color: '#333' },

    colabRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    colabName: { fontSize: 15, color: '#333', fontWeight: '500' },
    colabAmount: { fontSize: 15, color: '#007AFF', fontWeight: 'bold' }
});
