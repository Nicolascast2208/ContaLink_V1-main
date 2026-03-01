import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, ScrollView, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import Pdf from 'react-native-pdf';

import { auth, db, storage } from '../../utils/firebaseconfig';

const { width, height } = Dimensions.get('window');

export default function EmpresaGastosScreen() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'Pendiente' | 'Aprobado'>('Pendiente');

  // Estados para el visor de detalles y documentos
  const [selectedGasto, setSelectedGasto] = useState<any>(null);
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);

  const [viewingItem, setViewingItem] = useState<{ url: string, isPdf: boolean } | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'gastos'),
      where('empresaId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a: any, b: any) => (b.fechaSubida?.toMillis() || 0) - (a.fechaSubida?.toMillis() || 0));
      setGastos(lista);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const cambiarEstado = async (id: string, nuevoEstado: 'Aprobado' | 'Rechazado') => {
    try {
      await updateDoc(doc(db, 'gastos', id), {
        estadoAprobacion: nuevoEstado
      });
      // Si el modal estaba abierto, lo cerramos
      if (modalDetalleVisible) {
        setModalDetalleVisible(false);
        setSelectedGasto(null);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el estado del documento.");
    }
  };

  const abrirDetalles = (gasto: any) => {
    // Evitamos abrir detalles si la IA aún está analizando
    if (gasto.estado === 'Pendiente') {
      Alert.alert("Analizando", "Espera a que la Inteligencia Artificial termine de leer este documento antes de revisarlo.");
      return;
    }
    setSelectedGasto(gasto);
    setModalDetalleVisible(true);
  };

  const handleVerDocumento = async (rutaStorage: string) => {
    setLoadingImage(true);
    try {
      const url = await getDownloadURL(ref(storage, rutaStorage));
      const isPdf = rutaStorage.toLowerCase().endsWith('.pdf');
      setViewingItem({ url, isPdf });
    } catch (e) {
      Alert.alert("Error", "El documento original no está disponible.");
    } finally {
      setLoadingImage(false);
    }
  };

  const gastosFiltrados = gastos.filter(g => g.estadoAprobacion === filtro || (filtro === 'Aprobado' && g.estadoAprobacion === 'Rechazado'));

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => abrirDetalles(item)} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.avatarMini}><Ionicons name="person" size={12} color="#007AFF" /></View>
          <Text style={styles.workerName}>{item.nombreTrabajador}</Text>
        </View>
        <Text style={[styles.statusBadge,
        item.estadoAprobacion === 'Pendiente' ? styles.badgePendiente :
          item.estadoAprobacion === 'Aprobado' ? styles.badgeAprobado : styles.badgeRechazado
        ]}>
          {item.estadoAprobacion}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.itemIcon}>
          {item.miniaturaBase64 ? (
            <Image source={{ uri: item.miniaturaBase64 }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="document-text" size={24} color="#ccc" /></View>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.comercio} numberOfLines={1}>{item.comercio}</Text>
          <Text style={styles.detalles}>{item.tipoDocumento} {item.numeroDocumento ? `N°${item.numeroDocumento}` : ''} • {item.fechaDetectada}</Text>
          <Text style={styles.monto}>${(item.monto || 0).toLocaleString('es-CL')}</Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </View>

      {item.estadoAprobacion === 'Pendiente' && item.estado === 'Pendiente' && (
        <View style={styles.leyendoContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.leyendoText}>La IA está analizando este documento...</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Validación de Gastos</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, filtro === 'Pendiente' && styles.tabActive]} onPress={() => setFiltro('Pendiente')}>
          <Text style={[styles.tabText, filtro === 'Pendiente' && styles.tabTextActive]}>Por Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filtro === 'Aprobado' && styles.tabActive]} onPress={() => setFiltro('Aprobado')}>
          <Text style={[styles.tabText, filtro === 'Aprobado' && styles.tabTextActive]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={gastosFiltrados}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>Todo al día</Text>
              <Text style={styles.emptySubText}>No hay gastos pendientes de revisión.</Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      {/* ==========================================================
          MODAL DE DETALLES Y APROBACIÓN
          ========================================================== */}
      <Modal visible={modalDetalleVisible} transparent={true} animationType="slide" onRequestClose={() => setModalDetalleVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles del Gasto</Text>
              <TouchableOpacity onPress={() => setModalDetalleVisible(false)}>
                <Ionicons name="close-circle" size={30} color="#ccc" />
              </TouchableOpacity>
            </View>

            {selectedGasto && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

                {/* Info del Trabajador */}
                <View style={styles.workerInfoBox}>
                  <View style={[styles.avatarMini, { width: 40, height: 40, borderRadius: 20 }]}>
                    <Ionicons name="person" size={20} color="#007AFF" />
                  </View>
                  <View style={{ marginLeft: 15 }}>
                    <Text style={{ fontSize: 13, color: '#888' }}>Subido por</Text>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{selectedGasto.nombreTrabajador}</Text>
                  </View>
                </View>

                {/* Botón Ver Documento Original */}
                <TouchableOpacity
                  style={styles.btnVerDoc}
                  onPress={() => handleVerDocumento(selectedGasto.ruta)}
                  disabled={loadingImage}
                >
                  {loadingImage ? <ActivityIndicator color="#007AFF" /> : (
                    <>
                      <Ionicons name="scan-outline" size={20} color="#007AFF" style={{ marginRight: 8 }} />
                      <Text style={styles.textVerDoc}>Ver Documento Original</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Datos Extraídos */}
                <View style={styles.dataGrid}>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Comercio:</Text>
                    <Text style={styles.dataValue}>{selectedGasto.comercio}</Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>RUT Comercio:</Text>
                    <Text style={styles.dataValue}>{selectedGasto.rut || 'N/A'}</Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Tipo de Doc:</Text>
                    <Text style={styles.dataValue}>{selectedGasto.tipoDocumento} N° {selectedGasto.numeroDocumento}</Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Fecha Emisión:</Text>
                    <Text style={styles.dataValue}>{selectedGasto.fechaDetectada || 'N/A'}</Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Glosa (Motivo):</Text>
                    <Text style={styles.dataValue}>{selectedGasto.glosa || 'Sin glosa'}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>IVA:</Text>
                    <Text style={styles.dataValue}>${(selectedGasto.iva || 0).toLocaleString('es-CL')}</Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={[styles.dataLabel, { fontSize: 16, color: '#333' }]}>Monto Total:</Text>
                    <Text style={[styles.dataValue, { fontSize: 20, color: '#007AFF' }]}>${(selectedGasto.monto || 0).toLocaleString('es-CL')}</Text>
                  </View>
                </View>

                {/* Botones de Decisión (Solo si está pendiente) */}
                {selectedGasto.estadoAprobacion === 'Pendiente' ? (
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.btnAction, styles.btnRechazar]} onPress={() => cambiarEstado(selectedGasto.id, 'Rechazado')}>
                      <Ionicons name="close-circle-outline" size={24} color="#ff4444" />
                      <Text style={[styles.textRechazar, { fontSize: 16 }]}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnAction, styles.btnAprobar]} onPress={() => cambiarEstado(selectedGasto.id, 'Aprobado')}>
                      <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
                      <Text style={[styles.textAprobar, { fontSize: 16 }]}>Aprobar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.alertBox}>
                    <Text style={{ textAlign: 'center', color: '#666', fontWeight: '500' }}>
                      Este documento ya fue {selectedGasto.estadoAprobacion.toLowerCase()}.
                    </Text>
                  </View>
                )}

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ==========================================================
          MODAL VIEWER NATIVO (PARA VER LA FOTO EN GRANDE)
          ========================================================== */}
      <Modal visible={!!viewingItem} transparent={true} animationType="fade" onRequestClose={() => setViewingItem(null)}>
        <View style={styles.viewerContainer}>
          <TouchableOpacity style={styles.btnCloseViewer} onPress={() => setViewingItem(null)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          {viewingItem && (
            viewingItem.isPdf ? (
              <View style={{ flex: 1, width: width, height: height, marginTop: 50 }}>
                <Pdf source={{ uri: viewingItem.url }} style={{ flex: 1, width: width }} fitPolicy={0} trustAllCerts={false} />
              </View>
            ) : (
              <Image source={{ uri: viewingItem.url }} style={{ flex: 1, width: '100%', height: '100%' }} resizeMode="contain" />
            )
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },

  tabsContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#007AFF' },

  card: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 15, borderRadius: 15, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  avatarMini: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E8F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  workerName: { fontSize: 14, fontWeight: '600', color: '#555' },

  statusBadge: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  badgePendiente: { backgroundColor: '#FFF3CD', color: '#FF8800' },
  badgeAprobado: { backgroundColor: '#E8F5E9', color: '#00C851' },
  badgeRechazado: { backgroundColor: '#FFEBEE', color: '#ff4444' },

  cardBody: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: { padding: 0, overflow: 'hidden', borderRadius: 8, width: 50, height: 70, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#eee' },
  comercio: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  detalles: { fontSize: 13, color: '#888', marginBottom: 6 },
  monto: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },

  leyendoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, padding: 10, backgroundColor: '#F0F8FF', borderRadius: 10 },
  leyendoText: { color: '#007AFF', marginLeft: 10, fontSize: 13, fontWeight: '500' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, color: '#666', fontWeight: 'bold', marginTop: 15 },
  emptySubText: { fontSize: 14, color: '#999', marginTop: 5 },

  // --- MODAL DETALLES ---
  modalBackground: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', height: '80%', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },

  workerInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, marginBottom: 20 },

  btnVerDoc: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F1FF', padding: 15, borderRadius: 12, marginBottom: 20 },
  textVerDoc: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },

  dataGrid: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#EAEAEA' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  dataLabel: { fontSize: 14, color: '#666', fontWeight: '500', flex: 1 },
  dataValue: { fontSize: 14, color: '#333', fontWeight: 'bold', flex: 1.5, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#EAEAEA', marginVertical: 10 },

  actions: { flexDirection: 'row', marginTop: 25, gap: 15 },
  btnAction: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, borderRadius: 12 },
  btnRechazar: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2' },
  textRechazar: { color: '#ff4444', fontWeight: 'bold', marginLeft: 8 },
  btnAprobar: { backgroundColor: '#00C851' },
  textAprobar: { color: '#fff', fontWeight: 'bold', marginLeft: 8 },

  alertBox: { marginTop: 25, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10 },

  // --- VIEWER NATIVO ---
  viewerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  btnCloseViewer: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
});