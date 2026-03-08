import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { useEmpresaMetrics } from '../../hooks/useEmpresaMetrics';
import { generarReporteExcel } from '../../utils/procesamiento_excel';

export default function EmpresaGraficosWebScreen() {
    const metrics = useEmpresaMetrics();
    const [widgetOrder, setWidgetOrder] = useState([
        'kpis', 'monthly', 'status', 'colabs', 'categories', 'table'
    ]);

    const formatCLP = (valor: number) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(valor);
    };

    if (metrics.loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0088ff" />
            </View>
        );
    }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        e.dataTransfer.setData('widgetId', id);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('widgetId');
        if (sourceId === targetId || !sourceId) return;

        const newOrder = [...widgetOrder];
        const sourceIndex = newOrder.indexOf(sourceId);
        const targetIndex = newOrder.indexOf(targetId);

        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, sourceId);

        setWidgetOrder(newOrder);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    // --- WIDGET COMPONENTS ---

    const KPISWidget = () => (
        <View style={{ flex: 1, justifyContent: 'center', gap: 15 }}>
            <View style={[styles.kpiCard, { backgroundColor: '#E8F1FF' }]}>
                <Text style={styles.kpiTitle}>Gasto Aprobado</Text>
                <Text style={[styles.kpiValue, { color: '#0088ff' }]}>{formatCLP(metrics.montoAprobado)}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: '#F3E5F5' }]}>
                <Text style={styles.kpiTitle}>Total Boletas Registradas</Text>
                <Text style={[styles.kpiValue, { color: '#8E24AA' }]}>{metrics.totalBoletas}</Text>
            </View>
        </View>
    );

    const MonthlyWidget = () => {
        const barData = metrics.monthlyStats.map(stat => ({
            value: stat.value,
            label: stat.label,
            frontColor: '#0088ff',
            topLabelComponent: () => <Text style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>{formatCLP(stat.value)}</Text>
        }));

        const maxVal = barData.length > 0 ? Math.max(...barData.map(d => d.value)) : 0;

        return (
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                <Text style={styles.chartTitle}>Histórico de Aprobaciones</Text>
                <Text style={styles.chartSubtitle}>Monto mensual por periodo</Text>
                <View style={{ marginTop: 20, flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 30 }}>
                    {barData.length > 0 ? (
                        <BarChart
                            data={barData}
                            barWidth={35}
                            spacing={35}
                            hideRules
                            xAxisThickness={0}
                            yAxisThickness={0}
                            yAxisTextStyle={{ opacity: 0 }}
                            yAxisLabelWidth={0} // Prevents left padding shifting
                            noOfSections={4}
                            height={160}
                            maxValue={maxVal > 0 ? maxVal * 1.5 : 100} // Increase headroom consistently
                            frontColor="#0088ff"
                            initialSpacing={15}
                        />
                    ) : (
                        <Text style={{ color: '#999' }}>Aún no hay historial registrado.</Text>
                    )}
                </View>
            </View>
        );
    };

    const StatusWidget = () => (
        <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>Estado de Documentos</Text>
            <Text style={styles.chartSubtitle}>Total: {metrics.totalBoletas} boletas ingresadas</Text>

            {metrics.totalBoletas > 0 ? (
                <View style={{ marginTop: 25 }}>
                    <View style={{ height: 24, width: '100%', flexDirection: 'row', borderRadius: 12, overflow: 'hidden', marginBottom: 25 }}>
                        {metrics.countAprobado > 0 && <View style={{ flex: metrics.countAprobado, backgroundColor: '#34C759' }} />}
                        {metrics.countPendiente > 0 && <View style={{ flex: metrics.countPendiente, backgroundColor: '#FF9500' }} />}
                        {metrics.countRechazado > 0 && <View style={{ flex: metrics.countRechazado, backgroundColor: '#FF3B30' }} />}
                    </View>

                    <View style={styles.legendContainer}>
                        <View style={styles.legendRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.legendColor, { backgroundColor: '#34C759' }]} />
                                <Text style={styles.legendText}>Aprobadas</Text>
                            </View>
                            <Text style={styles.legendCount}>{metrics.countAprobado}</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.legendColor, { backgroundColor: '#FF9500' }]} />
                                <Text style={styles.legendText}>Pendientes</Text>
                            </View>
                            <Text style={styles.legendCount}>{metrics.countPendiente}</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.legendColor, { backgroundColor: '#FF3B30' }]} />
                                <Text style={styles.legendText}>Rechazadas</Text>
                            </View>
                            <Text style={styles.legendCount}>{metrics.countRechazado}</Text>
                        </View>
                    </View>
                </View>
            ) : (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>Aún no hay documentos</Text>
            )}
        </View>
    );

    const CategoriesWidget = () => (
        <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>Distribución de Gastos</Text>
            <Text style={styles.chartSubtitle}>Agrupados por Categoría Inteligente (IA)</Text>

            <View style={{ marginTop: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
                {metrics.categoriasStats.length > 0 ? (
                    <>
                        <View style={{ marginRight: 20 }}>
                            <PieChart
                                donut
                                data={metrics.categoriasStats.map((cat, idx) => {
                                    const colores = ['#0088ff', '#FF2D55', '#FF9500', '#34C759', '#AF52DE', '#FFCC00'];
                                    return {
                                        value: cat[1].monto,
                                        color: colores[idx % colores.length],
                                    };
                                })}
                                radius={70}
                                innerRadius={45}
                                innerCircleColor={'#fff'}
                            />
                        </View>
                        <View style={{ flex: 1, minWidth: 150 }}>
                            {metrics.categoriasStats.map((cat, idx) => {
                                const colores = ['#0088ff', '#FF2D55', '#FF9500', '#34C759', '#AF52DE', '#FFCC00'];
                                return (
                                    <View key={idx} style={[styles.legendRow, { paddingVertical: 5, borderBottomWidth: 0 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={[styles.legendColor, { backgroundColor: colores[idx % colores.length] }]} />
                                            <Text style={[styles.legendText, { fontSize: 13, fontWeight: 'bold' }]}>{cat[0]}</Text>
                                        </View>
                                        <Text style={[styles.legendCount, { fontSize: 13, color: colores[idx % colores.length] }]}>{formatCLP(cat[1].monto)}</Text>
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
    );

    const ColabsWidget = () => (
        <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>Top Colaboradores (Volumen)</Text>
            <Text style={styles.chartSubtitle}>Por cantidad de boletas ingresadas</Text>
            <View style={{ marginTop: 20 }}>
                {metrics.colaboradorStats.length > 0 ? (
                    metrics.colaboradorStats.map((colab, idx) => {
                        const MathMax = Math.max(...metrics.colaboradorStats.map(c => c[1].cantidad));
                        const widthPercent = (colab[1].cantidad / MathMax) * 100;
                        return (
                            <View key={idx} style={{ marginBottom: 15 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <Text style={{ fontSize: 13, color: '#333', fontWeight: '500' }}>{colab[0]}</Text>
                                    <Text style={{ fontSize: 13, color: '#0088ff', fontWeight: 'bold' }}>{colab[1].cantidad} docs</Text>
                                </View>
                                <View style={{ height: 10, backgroundColor: '#E8F1FF', borderRadius: 5, width: '100%', overflow: 'hidden' }}>
                                    <View style={{ height: '100%', width: `${widthPercent}%`, backgroundColor: '#0088ff', borderRadius: 5 }} />
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>Aún no hay datos</Text>
                )}
            </View>
        </View>
    );

    const TableWidget = () => (
        <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>Desglose Aprobado por Colaborador</Text>
            <Text style={styles.chartSubtitle}>Monto procesado exitosamente</Text>
            <View style={{ marginTop: 15 }}>
                {metrics.colaboradorStats.length > 0 ? (
                    metrics.colaboradorStats.map((colab, idx) => (
                        <View key={idx} style={[styles.legendRow, { paddingVertical: 10 }]}>
                            <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{colab[0]}</Text>
                            <Text style={{ fontSize: 14, color: '#0088ff', fontWeight: 'bold' }}>{formatCLP(colab[1].monto)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>Aún no hay datos</Text>
                )}
            </View>
        </View>
    );

    const renderWidget = (id: string) => {
        switch (id) {
            case 'kpis': return <KPISWidget />;
            case 'monthly': return <MonthlyWidget />;
            case 'status': return <StatusWidget />;
            case 'categories': return <CategoriesWidget />;
            case 'colabs': return <ColabsWidget />;
            case 'table': return <TableWidget />;
            default: return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Panel de Métricas Avanzado</Text>
                    <Text style={styles.headerSubtitle}>Arrastra los módulos para organizar tu vista</Text>
                </View>
                <TouchableOpacity
                    onPress={() => generarReporteExcel(metrics.rawGastosAprobados, metrics.user?.displayName || metrics.user?.email?.split('@')[0] || "Administrador", true)}
                    style={styles.exportBtn}
                >
                    <Ionicons name="share-outline" size={18} color="#0088ff" />
                    <Text style={styles.exportText}>Exportar a Excel</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* HTML DIV Injection for Drag and Drop capability exclusively on .web.tsx */}
                <div style={webStyles.gridContainer as any}>
                    {widgetOrder.map(id => (
                        <div
                            key={id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, id)}
                            onDrop={(e) => handleDrop(e, id)}
                            onDragOver={handleDragOver}
                            style={webStyles.widgetWrapper as any}
                        >
                            <div style={webStyles.dragHandle as any}>
                                <Ionicons name="apps" size={18} color="#d1d5db" />
                            </div>
                            {renderWidget(id)}
                        </div>
                    ))}
                </div>
            </ScrollView>
        </View>
    );
}

const webStyles = {
    gridContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: '24px',
        width: '100%',
    },
    widgetWrapper: {
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
        border: '1px solid #f0f0f0',
        cursor: 'grab',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '220px',
    },
    dragHandle: {
        position: 'absolute',
        top: '15px',
        right: '15px',
        cursor: 'grab',
        opacity: 0.8,
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f9' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingTop: 30,
        backgroundColor: 'transparent'
    },
    headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#1C1C1E' },
    headerSubtitle: { fontSize: 14, color: '#888', marginTop: 4 },
    exportBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F1FF',
        paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10
    },
    exportText: { color: '#0088ff', fontWeight: '700', marginLeft: 8, fontSize: 14 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },

    kpiCard: {
        padding: 20, borderRadius: 12,
    },
    kpiTitle: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 8 },
    kpiValue: { fontSize: 32, fontWeight: '900' },

    chartTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    chartSubtitle: { fontSize: 13, color: '#6B7280' },

    legendContainer: { marginTop: 10 },
    legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    legendText: { fontSize: 14, color: '#4B5563' },
    legendCount: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
});
