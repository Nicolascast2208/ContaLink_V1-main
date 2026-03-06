import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
// Importamos los estilos globales con un alias para no confundirlos
import { styles as globalStyles } from '../../styles/Styles';
import { generarReporteExcel } from '../../utils/procesamiento_excel';

import { auth, db, storage } from '../../utils/firebaseconfig';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom.', 'Lun.', 'Mar.', 'Mié.', 'Jue.', 'Vie.', 'Sáb.'],
  today: "Hoy"
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarioScreen() {
  const [user, setUser] = useState<any>(null);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [resumenMensual, setResumenMensual] = useState<any[]>([]);
  const [rawGastos, setRawGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [gastosDia, setGastosDia] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    // @ts-ignore
    const unsub = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (!usr) setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "gastos"), where("uid", "==", user.uid), orderBy("fechaSubida", "desc"));

    const unsubDb = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filtrar para mostrar UNICAMENTE los aprobados en todo el historial
      const approvedDocs = docs.filter((item: any) => item.estadoAprobacion === 'Aprobado');

      setRawGastos(approvedDocs);
      procesarDatos(approvedDocs);
      setLoading(false);
    });
    return () => unsubDb();
  }, [user]);

  useEffect(() => {
    if (selectedDate) {
      const datosDelDia = markedDates[selectedDate]?.data || [];
      setGastosDia(datosDelDia);
    }
  }, [markedDates, selectedDate]);

  const procesarDatos = (data: any[]) => {
    const marcas: any = {};
    const meses: any = {};

    data.forEach((item) => {
      if (item.fechaSubida) {
        let fechaObj;
        try { fechaObj = item.fechaSubida.toDate(); } catch { fechaObj = new Date(); }

        const fechaStr = format(fechaObj, 'yyyy-MM-dd');
        const mesStr = format(fechaObj, 'MMMM yyyy', { locale: es });

        if (!marcas[fechaStr]) {
          marcas[fechaStr] = { marked: true, dotColor: '#007AFF', data: [] };
        }
        marcas[fechaStr].data.push(item);

        if (!meses[mesStr]) {
          meses[mesStr] = { nombre: mesStr, total: 0, orden: fechaObj.getTime() };
        }

        // Sumamos al total del mes SOLO si el gasto está aprobado
        if (item.estadoAprobacion === 'Aprobado') {
          meses[mesStr].total += (item.monto || 0);
        }
      }
    });

    setMarkedDates(marcas);
    const listaMeses = Object.values(meses).sort((a: any, b: any) => b.orden - a.orden);
    setResumenMensual(listaMeses);
  };

  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);
  };

  const eliminarBoleta = async (id: string, ruta: string) => {
    Alert.alert("Eliminar", "¿Seguro que quieres borrar este gasto?", [
      { text: "Cancelar" },
      {
        text: "Sí, borrar", style: "destructive", onPress: async () => {
          setDeletingId(id);
          try {
            await deleteDoc(doc(db, "gastos", id));
            if (ruta) {
              await deleteObject(ref(storage, ruta)).catch(() => { });
            }
          } catch (e: any) { Alert.alert("Error", e.message); }
          finally { setDeletingId(null); }
        }
      }
    ]);
  };

  // --- REPORTE EXCEL REAL (.XLSX) ---
  const generarReporte = async () => {
    let nombreUsuario = "Usuario";
    if (user?.displayName) {
      nombreUsuario = user.displayName;
    } else if (user?.email) {
      nombreUsuario = user.email.split('@')[0];
    }

    await generarReporteExcel(rawGastos, nombreUsuario);
  };

  if (loading) return <View style={globalStyles.container}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={globalStyles.container}>

      {/* ==========================================================
          HEADER GLOBAL APLICADO AQUÍ
          ========================================================== */}
      <View style={globalStyles.header}>
        <Text style={globalStyles.headerTitle}>Historial</Text>
        <TouchableOpacity onPress={generarReporte} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef6ff', padding: 8, borderRadius: 8 }}>
          <Ionicons name="share-outline" size={24} color="#007AFF" />
          <Text style={{ color: '#007AFF', fontWeight: '600', marginLeft: 5 }}>Exportar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={globalStyles.calendarCard}>
          <Calendar
            onDayPress={onDayPress}
            markedDates={{
              ...markedDates,
              [selectedDate]: { selected: true, selectedColor: '#007AFF', marked: markedDates[selectedDate]?.marked }
            }}
            theme={{ todayTextColor: '#007AFF', arrowColor: '#007AFF', textDayFontWeight: '600', textMonthFontWeight: 'bold' }}
          />
        </View>

        {selectedDate ? (
          <View style={globalStyles.sectionContainer}>
            <Text style={globalStyles.sectionTitle}>{format(parseISO(selectedDate), "dd 'de' MMMM", { locale: es })}</Text>
            {gastosDia.length > 0 ? (
              gastosDia.map((g, i) => (
                <View key={i} style={globalStyles.miniCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={globalStyles.miniTitle}>{g.comercio}</Text>
                    <Text style={{ fontSize: 12, color: '#666' }}>RUT: {g.rut || 'S/R'} • {g.giro || ''}</Text>
                    <Text style={globalStyles.miniMonto}>${(g.monto || 0).toLocaleString('es-CL')}</Text>
                  </View>
                  {deletingId === g.id ? <ActivityIndicator size="small" color="#ff4444" /> :
                    <TouchableOpacity onPress={() => eliminarBoleta(g.id, g.ruta)} style={{ padding: 5 }}>
                      <Ionicons name="trash-outline" size={20} color="#ccc" />
                    </TouchableOpacity>
                  }
                </View>
              ))
            ) : <Text style={{ fontStyle: 'italic', color: '#888' }}>Sin gastos este día.</Text>}
          </View>
        ) : null}

        <View style={globalStyles.sectionContainer}>
          <Text style={globalStyles.sectionTitle}>Resumen Anual</Text>
          {resumenMensual.length > 0 ? (
            resumenMensual.map((mes: any, index) => (
              <View key={index} style={globalStyles.monthRow}>
                <Text style={globalStyles.monthName}>{mes.nombre.toUpperCase()}</Text>
                <Text style={globalStyles.monthTotal}>${mes.total.toLocaleString('es-CL')}</Text>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Ionicons name="stats-chart-outline" size={40} color="#ccc" />
              <Text style={{ color: '#999', marginTop: 5 }}>No hay historial anual aún.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}