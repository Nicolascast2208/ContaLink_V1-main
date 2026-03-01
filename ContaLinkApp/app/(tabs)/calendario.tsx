import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import * as XLSX from 'xlsx';

// @ts-ignore
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { auth, db, storage } from '../../utils/firebaseconfig';
// Importamos los estilos globales con un alias para no confundirlos
import { styles as globalStyles } from '../../styles/Styles';

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
      setRawGastos(docs);
      procesarDatos(docs);
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
        meses[mesStr].total += (item.monto || 0);
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
    if (rawGastos.length === 0) return Alert.alert("Vacío", "No hay gastos para exportar.");

    try {
      const datosExcel = [
        ["Fecha Subida", "Comercio", "RUT", "Giro/Rubro", "Fecha Boleta", "Glosa", "Monto", "Estado"]
      ];

      rawGastos.forEach(item => {
        let fechaSub = "Sin fecha";
        if (item.fechaSubida) {
          try { fechaSub = format(item.fechaSubida.toDate(), 'dd/MM/yyyy HH:mm'); } catch { }
        }

        datosExcel.push([
          fechaSub,
          item.comercio || "Sin nombre",
          item.rut || "S/R",
          item.giro || "S/G",
          item.fechaDetectada || "S/F",
          item.glosa || "",
          Number(item.monto) || 0,
          item.estado || "Procesado"
        ]);
      });

      const hoja = XLSX.utils.aoa_to_sheet(datosExcel);

      hoja['!cols'] = [
        { wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 80 },
        { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 15 }
      ];

      // Formato contable para los montos (Columna G, índice 6)
      for (let i = 1; i < datosExcel.length; i++) {
        const celdaMonto = XLSX.utils.encode_cell({ c: 6, r: i });
        if (hoja[celdaMonto]) {
          hoja[celdaMonto].z = '"$"#,##0';
        }
      }

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Gastos ContaLink");
      const excelBase64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });

      const mesActual = format(new Date(), 'MMMM', { locale: es });

      let nombreUsuario = "Usuario";
      if (user?.displayName) {
        nombreUsuario = user.displayName;
      } else if (user?.email) {
        nombreUsuario = user.email.split('@')[0];
      }

      const nombreLimpio = nombreUsuario.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑàèìòùÀÈÌÒÙ]/g, "").trim();
      const nombreArchivo = `Reporte ${mesActual} ${nombreLimpio}.xlsx`;

      // @ts-ignore
      const fileUri = FileSystem.documentDirectory + nombreArchivo;

      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar Reporte de Gastos'
        });
      } else {
        Alert.alert("Error", "Compartir no está disponible en este dispositivo.");
      }

    } catch (error: any) {
      Alert.alert("Error", "Fallo al exportar Excel: " + error.message);
    }
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