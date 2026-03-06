import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router'; // Quitamos Stack, dejamos useRouter
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// @ts-ignore
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

import { db } from '../../utils/firebaseconfig';

export default function DetalleClienteScreen() {
  const { id, nombre, apellido, rut } = useLocalSearchParams();
  const router = useRouter(); 
  
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalMes, setTotalMes] = useState(0);

  useEffect(() => {
    if (!id) return;
    
    const q = query(collection(db, "gastos"), where("uid", "==", id), orderBy("fechaSubida", "desc"));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGastos(docs);
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const suma = docs.reduce((acc, item: any) => {
        if (!item.fechaSubida) return acc;
        const fecha = item.fechaSubida.toDate ? item.fechaSubida.toDate() : new Date(item.fechaSubida);
        if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
          return acc + (Number(item.monto) || 0);
        }
        return acc;
      }, 0);
      
      setTotalMes(suma);
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const exportarExcelCliente = async () => {
    if (gastos.length === 0) return Alert.alert("Vacío", "Este cliente no tiene gastos para exportar.");

    try {
      const datosExcel = [
        ["Fecha Subida", "Comercio", "RUT", "Giro/Rubro", "Fecha Boleta", "Hora Boleta", "Monto", "Estado"]
      ];

      gastos.forEach(item => {
        let fechaSub = "Sin fecha";
        if (item.fechaSubida) {
          try { fechaSub = format(item.fechaSubida.toDate(), 'dd/MM/yyyy HH:mm'); } catch {}
        }
        
        datosExcel.push([
          fechaSub,
          item.comercio || "Sin nombre",
          item.rut || "S/R",
          item.giro || "S/G",
          item.fechaDetectada || "S/F",
          item.hora || "S/H",
          Number(item.monto) || 0,
          item.estado || "Procesado"
        ]);
      });

      const hoja = XLSX.utils.aoa_to_sheet(datosExcel);
      hoja['!cols'] = [ { wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 } ];

      for (let i = 1; i < datosExcel.length; i++) {
        const celdaMonto = XLSX.utils.encode_cell({ c: 6, r: i }); 
        if (hoja[celdaMonto]) hoja[celdaMonto].z = '"$"#,##0';
      }

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Gastos Cliente");
      const excelBase64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });
      
      const mesActual = format(new Date(), 'MMMM', { locale: es });
      const nombreLimpio = String(nombre).replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑàèìòùÀÈÌÒÙ]/g, "").trim();
      const nombreArchivo = `Reporte_${mesActual}_${nombreLimpio}.xlsx`;
      
      const fileUri = FileSystem.documentDirectory + nombreArchivo;

      await FileSystem.writeAsStringAsync(fileUri, excelBase64, { encoding: FileSystem.EncodingType.Base64 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar Reporte Cliente'
        });
      }
    } catch (error: any) {
      Alert.alert("Error", "Fallo al exportar: " + error.message);
    }
  };

  const nombreMes = new Date().toLocaleString('es-ES', { month: 'long' });

  return (
    <View style={styles.container}>
      
      {/* ========================================== */}
      {/* HEADER PERSONALIZADO (A PRUEBA DE FALLOS)  */}
      {/* ========================================== */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        {/* Espacio en blanco para centrar si quisieras un título medio */}
      </View>

      <View style={styles.headerInfo}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {String(nombre).charAt(0)}
            {String(apellido) !== 'undefined' && apellido ? String(apellido).charAt(0) : ''}
          </Text>
        </View>
        <View>
          <Text style={styles.clientName}>{nombre} {String(apellido) !== 'undefined' ? apellido : ''}</Text>
          <Text style={styles.clientRut}>RUT: {rut}</Text>
        </View>
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Total Gastos ({nombreMes})</Text>
        <Text style={styles.summaryTotal}>${totalMes.toLocaleString('es-CL')}</Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 15 }}>
        <TouchableOpacity style={styles.btnExcel} onPress={exportarExcelCliente}>
          <Ionicons name="download-outline" size={24} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.btnExcelText}>Descargar Reporte Excel</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={gastos}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, paddingTop: 5 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? <ActivityIndicator size="large" color="#007AFF" /> : (
              <Text style={{color: '#666', marginTop: 20, textAlign: 'center'}}>Este cliente aún no ha subido boletas.</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemIcon}>
              <Ionicons name="receipt-outline" size={24} color="#007AFF" />
            </View>
            <View style={{flex: 1, paddingHorizontal: 10}}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.comercio}</Text>
              <Text style={{fontSize:11, color:'#666', marginBottom:2}}>
                 {item.fechaDetectada || 'Sin fecha'} • {item.estado}
              </Text>
              <Text style={styles.itemSub}>${(Number(item.monto) || 0).toLocaleString('es-CL')}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  
  // Estilos del nuevo Header
  customHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40, // Espacio para la barra de estado (batería, hora)
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '500',
    marginLeft: -4,
  },

  headerInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 20, borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: '#007AFF' },
  clientName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  clientRut: { fontSize: 14, color: '#666', marginTop: 4 },
  
  summaryBox: { backgroundColor: '#007AFF', margin: 20, padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  summaryLabel: { color: '#E5F1FF', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', marginBottom: 5 },
  summaryTotal: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },

  btnExcel: { 
    backgroundColor: '#34C759', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 14, 
    borderRadius: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  btnExcelText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  itemCard: { flexDirection: 'row', backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5F1FF', justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  itemSub: { fontSize: 14, fontWeight: '600', color: '#007AFF', marginTop: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center' }
});