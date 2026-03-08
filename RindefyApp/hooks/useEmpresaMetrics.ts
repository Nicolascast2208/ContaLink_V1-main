import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebaseconfig';

export interface Gasto {
    id: string;
    monto: number;
    estadoAprobacion: string;
    empresaId: string;
    nombreTrabajador?: string;
    categoriaComercio?: string;
    fecha?: any; // Para historial mensual
}

export function useEmpresaMetrics() {
    const [user, setUser] = useState<any>(null);
    const [empresaId, setEmpresaId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [rawGastosAprobados, setRawGastosAprobados] = useState<any[]>([]);
    const [totalBoletas, setTotalBoletas] = useState(0);
    const [montoAprobado, setMontoAprobado] = useState(0);

    const [countAprobado, setCountAprobado] = useState(0);
    const [countPendiente, setCountPendiente] = useState(0);
    const [countRechazado, setCountRechazado] = useState(0);

    const [colaboradorStats, setColaboradorStats] = useState<[string, { cantidad: number; monto: number }][]>([]);
    const [categoriasStats, setCategoriasStats] = useState<[string, { cantidad: number, monto: number }][]>([]);
    const [monthlyStats, setMonthlyStats] = useState<{ label: string; value: number }[]>([]);

    useEffect(() => {
        let unsubscribeGastos: () => void;

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setEmpresaId(currentUser.uid);

                const q = query(collection(db, "gastos"), where("empresaId", "==", currentUser.uid));

                unsubscribeGastos = onSnapshot(q, (snapshot) => {
                    let total = 0;
                    let sumAprobado = 0;
                    let cAprobado = 0;
                    let cRechazado = 0;
                    let cPendiente = 0;
                    const colabsResumen: Record<string, { cantidad: number; monto: number }> = {};
                    const categoriasResumen: Record<string, { cantidad: number, monto: number }> = {};
                    const mesesResumen: Record<string, number> = {};
                    const listaAprobados: any[] = [];

                    snapshot.forEach(doc => {
                        const data = doc.data() as Gasto;
                        if (data.estadoAprobacion === 'Eliminado') return;

                        total++;
                        const monto = Number(data.monto) || 0;
                        const nombreColab = data.nombreTrabajador || 'Desconocido';
                        const estado = data.estadoAprobacion || 'Pendiente';

                        if (estado === 'Aprobado') {
                            cAprobado++;
                            sumAprobado += monto;
                            listaAprobados.push(data);

                            // Agrupación mensual
                            let monthKey = 'Sin Fecha';
                            if (data.fecha) {
                                let d;
                                if (data.fecha.toDate) {
                                    d = data.fecha.toDate();
                                } else {
                                    d = new Date(data.fecha);
                                }

                                if (!isNaN(d.getTime())) {
                                    const m = d.getMonth() + 1;
                                    const y = d.getFullYear();
                                    monthKey = `${m.toString().padStart(2, '0')}-${y}`;
                                }
                            }
                            if (!mesesResumen[monthKey]) mesesResumen[monthKey] = 0;
                            mesesResumen[monthKey] += monto;

                            // Agrupación por Categorías
                            const categoria = data.categoriaComercio || 'Otro';
                            if (!categoriasResumen[categoria]) categoriasResumen[categoria] = { cantidad: 0, monto: 0 };
                            categoriasResumen[categoria].monto += monto;
                            categoriasResumen[categoria].cantidad += 1;
                        } else if (estado === 'Rechazado') {
                            cRechazado++;
                        } else {
                            cPendiente++;
                        }

                        // Agrupación por colaboradores (Volumen de documentos en general y Monto Aprobado)
                        if (!colabsResumen[nombreColab]) {
                            colabsResumen[nombreColab] = { cantidad: 0, monto: 0 };
                        }
                        colabsResumen[nombreColab].cantidad += 1;
                        if (estado === 'Aprobado') {
                            colabsResumen[nombreColab].monto += monto;
                        }
                    });

                    setTotalBoletas(total);
                    setMontoAprobado(sumAprobado);
                    setCountAprobado(cAprobado);
                    setCountPendiente(cPendiente);
                    setCountRechazado(cRechazado);

                    // Sort Data
                    const sortedColabs = Object.entries(colabsResumen)
                        .sort((a, b) => b[1].cantidad - a[1].cantidad)
                        .slice(0, 5);

                    const sortedCategorias = Object.entries(categoriasResumen)
                        .sort((a, b) => b[1].monto - a[1].monto);

                    const sortedMonths = Object.entries(mesesResumen).map(([label, value]) => ({ label, value }));
                    sortedMonths.sort((a, b) => {
                        if (a.label === 'Sin Fecha') return 1;
                        if (b.label === 'Sin Fecha') return -1;
                        const [am, ay] = a.label.split('-');
                        const [bm, by] = b.label.split('-');
                        if (ay !== by) return Number(ay) - Number(by);
                        return Number(am) - Number(bm);
                    });

                    setMonthlyStats(sortedMonths);
                    setColaboradorStats(sortedColabs);
                    setCategoriasStats(sortedCategorias);
                    setRawGastosAprobados(listaAprobados);
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

    return {
        user,
        empresaId,
        loading,
        rawGastosAprobados,
        totalBoletas,
        montoAprobado,
        countAprobado,
        countPendiente,
        countRechazado,
        colaboradorStats,
        categoriasStats,
        monthlyStats
    };
}
