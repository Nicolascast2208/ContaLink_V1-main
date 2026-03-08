import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, ScrollView, Dimensions, TextInput, Linking, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import PdfViewer from '../../components/PdfViewer';

import { auth, db, storage } from '../../utils/firebaseconfig';
import { useGastos } from '../../hooks/useGastos';
// Filtros Globales
import FilterSortModal from '../../components/FilterSortModal';
import { FiltrosGlobales, filtrosIniciales, aplicarFiltrosYOrden } from '../../utils/filterSortGastos';

const { width, height } = Dimensions.get('window');

const formatPesos = (valor: string | number) => {
  if (!valor) return '';
  const numeroLimpio = valor.toString().replace(/[^0-9]/g, '');
  if (numeroLimpio === '') return '';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(parseInt(numeroLimpio));
};

export default function EmpresaGastosScreen() {
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'Pendiente' | 'Aprobado'>('Pendiente');

  // Estados para el visor de detalles y documentos
  const [selectedGasto, setSelectedGasto] = useState<any>(null);
  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);

  // Campos de edición temporal
  const [tempComercio, setTempComercio] = useState('');
  const [tempMonto, setTempMonto] = useState('');
  const [tempIva, setTempIva] = useState('');
  const [tempRut, setTempRut] = useState('');
  const [tempGiro, setTempGiro] = useState('');
  const [tempFecha, setTempFecha] = useState('');
  const [tempGlosa, setTempGlosa] = useState('');
  const [tempTipoDoc, setTempTipoDoc] = useState('Boleta');
  const [tempNumeroDoc, setTempNumeroDoc] = useState('');
  const [tempCategoria, setTempCategoria] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // NUEVO ESTADO PARA EL MENÚ FLOTANTE
  const [showMenu, setShowMenu] = useState(false);

  // Estados de subida
  const { agregarGasto, eliminarGasto } = useGastos(auth.currentUser);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string, isPdf: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string | null>(null);
  const [selectedDocumentError, setSelectedDocumentError] = useState<string | null>(null);
  const [selectedIsPdf, setSelectedIsPdf] = useState<boolean>(false);
  const [isFullScreenViewerVisible, setIsFullScreenViewerVisible] = useState(false);
  const [isEditingRecord, setIsEditingRecord] = useState(false);

  // Estados para el rechazo
  const [modalRechazoVisible, setModalRechazoVisible] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  // --- VISTA LISTA / MOSAICO ---
  const [viewMode, setViewMode] = useState<'lista' | 'mosaico'>('lista');

  // --- FILTROS Y ORDEN ---
  const [filtros, setFiltros] = useState<FiltrosGlobales>(filtrosIniciales);
  const [showFiltros, setShowFiltros] = useState(false);

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

  const fetchDocumentUrl = () => {
    if (selectedGasto?.ruta) {
      setSelectedDocumentError(null);
      getDownloadURL(ref(storage, selectedGasto.ruta))
        .then(url => {
          setSelectedDocumentUrl(url);
          setSelectedIsPdf(selectedGasto.ruta.toLowerCase().endsWith('.pdf'));
        })
        .catch((error) => {
          console.error("Error cargando imagen:", error);
          setSelectedDocumentUrl(null);
          setSelectedDocumentError("No se pudo cargar el documento de este gasto.");
        });
    } else {
      setSelectedDocumentUrl(null);
      setSelectedDocumentError(null);
    }
  };

  useEffect(() => {
    fetchDocumentUrl();
  }, [selectedGasto]);

  const cambiarEstado = async (id: string, nuevoEstado: 'Aprobado' | 'Rechazado') => {
    if (!tempGlosa || tempGlosa.trim() === '') {
      Alert.alert("Campo Obligatorio", "Por favor ingresa una glosa/motivo antes de guardar o aprobar.");
      return;
    }
    setSavingEdit(true);
    try {
      const montoLimpio = parseInt(tempMonto.replace(/[^0-9]/g, '')) || 0;
      const ivaLimpio = parseInt(tempIva.replace(/[^0-9]/g, '')) || 0;

      const dataToUpdate: any = {
        estadoAprobacion: nuevoEstado,
        comercio: tempComercio,
        monto: montoLimpio,
        iva: ivaLimpio,
        rut: tempRut,
        giro: tempGiro,
        fechaDetectada: tempFecha,
        glosa: tempGlosa,
        tipoDocumento: tempTipoDoc,
        numeroDocumento: tempNumeroDoc,
        categoriaComercio: tempCategoria,
      };

      if (nuevoEstado === 'Rechazado' && motivoRechazo.trim() !== '') {
        dataToUpdate.motivoRechazo = motivoRechazo;
      }

      await updateDoc(doc(db, 'gastos', id), dataToUpdate);

      // Si el modal de rechazo estaba abierto, lo cerramos
      if (modalRechazoVisible) {
        setModalRechazoVisible(false);
        setMotivoRechazo('');
      }

      // Si el modal estaba abierto, lo cerramos
      if (modalDetalleVisible) {
        setModalDetalleVisible(false);
        setSelectedGasto(null);
        setIsEditingRecord(false);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el estado del documento.");
    } finally {
      setSavingEdit(false);
    }
  };

  const abrirDetalles = (gasto: any) => {
    // Evitamos abrir detalles si la IA aún está analizando
    if (gasto.estado === 'Pendiente') {
      Alert.alert("Analizando", "Espera a que la Inteligencia Artificial termine de leer este documento antes de revisarlo.");
      return;
    }
    setIsEditingRecord(false); // Resetear estado de edición
    setIsFullScreenViewerVisible(false); // Resetear visor 
    setSelectedGasto(gasto);
    setTempComercio(gasto.comercio || '');
    setTempMonto(gasto.monto ? formatPesos(gasto.monto) : '');
    setTempIva(gasto.iva ? formatPesos(gasto.iva) : '');
    setTempRut(gasto.rut || '');
    setTempGiro(gasto.giro || '');
    setTempFecha(gasto.fechaDetectada || '');
    setTempGlosa(gasto.glosa || '');
    setTempTipoDoc(gasto.tipoDocumento || 'Boleta');
    setTempNumeroDoc(gasto.numeroDocumento || '');
    setTempCategoria(gasto.categoriaComercio || 'Otro');

    setModalDetalleVisible(true);
  };

  const handleRechazarPress = () => {
    setMotivoRechazo('');
    setModalRechazoVisible(true);
  };

  const handeConfirmarRechazo = () => {
    if (!motivoRechazo.trim()) {
      Alert.alert("Atención", "Debes ingresar un motivo para rechazar el gasto.");
      return;
    }
    cambiarEstado(selectedGasto.id, 'Rechazado');
  };

  const handleEliminar = (id: string, ruta: string) => {
    Alert.alert(
      "Eliminar Gasto",
      "¿Estás seguro de que deseas eliminar este gasto de forma permanente?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive", onPress: async () => {
            setSavingEdit(true);
            try {
              await eliminarGasto(id, ruta);
              setModalDetalleVisible(false);
              setSelectedGasto(null);
            } catch (e: any) {
              Alert.alert("Error", "No se pudo eliminar el gasto.");
            } finally {
              setSavingEdit(false);
            }
          }
        }
      ]
    );
  };

  const handleSelectImage = async (fromCamera: boolean) => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: false };
      if (fromCamera) {
        await ImagePicker.requestCameraPermissionsAsync();
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imagenConvertida = await ImageManipulator.manipulateAsync(
          result.assets[0].uri, [{ resize: { width: 2000 } }], { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG }
        );
        setSelectedFile({ uri: imagenConvertida.uri, isPdf: false });
        setShowConfirm(true);
      }
    } catch (error) { Alert.alert("Error", "No se pudo procesar la imagen"); }
  };

  const handleSelectDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile({ uri: result.assets[0].uri, isPdf: true });
        setShowConfirm(true);
      }
    } catch (error) { Alert.alert("Error", "No se pudo seleccionar el documento"); }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await agregarGasto(selectedFile.uri, selectedFile.isPdf);
      Alert.alert("¡Éxito!", "Enviado para análisis... ⏳");
      setShowConfirm(false);
      setSelectedFile(null);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setUploading(false);
    }
  };

  const mostrarOpciones = () => {
    setShowMenu(true);
  };

  const gastosFiltrados = gastos.filter(g => g.estadoAprobacion === filtro || (filtro === 'Aprobado' && g.estadoAprobacion === 'Rechazado'));

  const renderItem = ({ item }: { item: any }) => {
    if (viewMode === 'mosaico') {
      return (
        <TouchableOpacity style={styles.gridCard} onPress={() => abrirDetalles(item)} activeOpacity={0.8}>
          <View style={styles.gridHeader}>
            <View style={styles.avatarMini}><Ionicons name="person" size={12} color="#007AFF" /></View>
            <Text style={styles.workerNameGrid} numberOfLines={1}>{item.nombreTrabajador}</Text>
          </View>

          <View style={styles.gridImageContainer}>
            {item.miniaturaBase64 ? (
              <Image source={{ uri: item.miniaturaBase64 }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="document-text" size={30} color="#ccc" />
              </View>
            )}
          </View>

          <View style={{ padding: 10, flex: 1, justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.comercioGrid} numberOfLines={2}>{item.comercio || 'Sin Comercio'}</Text>
              <Text style={styles.detalles} numberOfLines={1}>{item.tipoDocumento} • {item.fechaDetectada}</Text>
              <Text style={styles.montoGrid}>${(item.monto || 0).toLocaleString('es-CL')}</Text>
            </View>

            <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={[styles.statusBadge,
              item.estadoAprobacion === 'Pendiente' ? styles.badgePendiente :
                item.estadoAprobacion === 'Aprobado' ? styles.badgeAprobado : styles.badgeRechazado
              ]}>
                {item.estadoAprobacion}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Validación de Gastos</Text>
      </View>

      <View style={styles.tabsContainer} pointerEvents="auto">
        <TouchableOpacity style={[styles.tab, filtro === 'Pendiente' && styles.tabActive]} onPress={() => setFiltro('Pendiente')}>
          <Text style={[styles.tabText, filtro === 'Pendiente' && styles.tabTextActive]}>Por Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, filtro === 'Aprobado' && styles.tabActive]} onPress={() => setFiltro('Aprobado')}>
          <Text style={[styles.tabText, filtro === 'Aprobado' && styles.tabTextActive]}>Historial</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 5 }}>
        <TouchableOpacity
          style={styles.btnViewMode}
          onPress={() => setViewMode(prev => prev === 'lista' ? 'mosaico' : 'lista')}
        >
          <Ionicons name={viewMode === 'lista' ? 'grid-outline' : 'list-outline'} size={18} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnFilter}
          onPress={() => setShowFiltros(true)}
        >
          <Ionicons name="funnel-outline" size={18} color="#007AFF" />
          <Text style={styles.btnFilterText}>Filtros</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          key={viewMode}
          numColumns={viewMode === 'mosaico' ? 2 : 1}
          style={{ flex: 1 }}
          data={aplicarFiltrosYOrden(gastosFiltrados, filtros)}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: viewMode === 'mosaico' ? 15 : 0 }}
          columnWrapperStyle={viewMode === 'mosaico' ? { justifyContent: 'space-between' } : undefined}
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

      {/* BOTÓN FLOTANTE */}
      <TouchableOpacity style={styles.fab} onPress={mostrarOpciones} activeOpacity={0.7}>
        <Ionicons name="add" size={35} color="white" />
      </TouchableOpacity>

      {/* --- MENÚ FLOTANTE CUSTOMIZADO (NUEVO) --- */}
      <Modal visible={showMenu} transparent={true} animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.floatingMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setTimeout(() => handleSelectImage(true), 300); }}>
              <Ionicons name="camera-outline" size={26} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Cámara</Text>
            </TouchableOpacity>

            <View style={styles.menuSeparator} />

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setTimeout(() => handleSelectImage(false), 300); }}>
              <Ionicons name="images-outline" size={26} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Galería</Text>
            </TouchableOpacity>

            <View style={styles.menuSeparator} />

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setTimeout(() => handleSelectDocument(), 300); }}>
              <Ionicons name="document-text-outline" size={26} color="#fff" style={styles.menuIcon} />
              <Text style={styles.menuText}>Documento PDF</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- MODAL UPLOAD --- */}
      <Modal visible={showConfirm} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: 'white' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Nuevo Documento</Text>
            <TouchableOpacity onPress={() => { setShowConfirm(false); setSelectedFile(null); }}>
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={{ flex: 1, padding: 20 }}>
            {/* Preview Card */}
            <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 }}>
              {selectedFile?.isPdf ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f4f4' }}>
                  <Ionicons name="document-text" size={60} color="#007AFF" />
                  <Text style={{ marginTop: 10, color: '#666', fontWeight: '500' }}>Documento PDF</Text>
                </View>
              ) : (
                selectedFile && <Image source={{ uri: selectedFile.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              )}
            </View>
          </View>

          {/* Footer Buttons */}
          <View style={{ padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee' }}>
            <TouchableOpacity
              disabled={uploading}
              style={{ backgroundColor: '#007AFF', paddingVertical: 18, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
              onPress={handleUpload}
            >
              {uploading ? <ActivityIndicator color="white" /> : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Subir Documento</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </Modal>

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

            {selectedGasto && (() => {
              const isReadOnly = selectedGasto.estadoAprobacion === 'Pendiente' ? false : !isEditingRecord;
              return (
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

                  {/* Visor de documento integrado */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { if (selectedDocumentUrl) setIsFullScreenViewerVisible(true); }}
                    style={{ width: '100%', height: 350, backgroundColor: '#f0f0f0', borderRadius: 12, marginBottom: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
                  >
                    {selectedDocumentError ? (
                      <View style={{ alignItems: 'center', padding: 20 }}>
                        <Ionicons name="alert-circle-outline" size={40} color="#ff4444" />
                        <Text style={{ marginTop: 10, color: '#666', textAlign: 'center', marginBottom: 15 }}>{selectedDocumentError}</Text>
                        <TouchableOpacity onPress={fetchDocumentUrl} style={{ backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 5 }} />
                          <Text style={{ color: 'white', fontWeight: 'bold' }}>Reintentar</Text>
                        </TouchableOpacity>
                      </View>
                    ) : selectedIsPdf ? (
                      <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <Ionicons name="document-text" size={50} color="#007AFF" />
                        <Text style={{ marginTop: 10, textAlign: 'center', color: '#333' }}>Este es un documento PDF</Text>
                        <TouchableOpacity onPress={() => Linking.openURL(selectedDocumentUrl)} style={{ marginTop: 15, backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="open-outline" size={20} color="white" style={{ marginRight: 5 }} />
                          <Text style={{ color: 'white', fontWeight: 'bold' }}>Ver PDF en Navegador</Text>
                        </TouchableOpacity>
                      </View>
                    ) : !selectedDocumentUrl ? (
                      <ActivityIndicator size="large" color="#007AFF" />
                    ) : (
                      <Image source={{ uri: selectedDocumentUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    )}
                  </TouchableOpacity>

                  {/* Datos Extraídos */}
                  <View style={styles.dataGrid}>
                    <Text style={styles.label}>Tipo de Documento:</Text>
                    <View style={{ flexDirection: 'row', marginBottom: 15 }}>
                      <TouchableOpacity
                        style={[styles.typeButton, tempTipoDoc === 'Boleta' && styles.typeButtonActive, isReadOnly && { opacity: 0.6 }]}
                        disabled={isReadOnly}
                        onPress={() => setTempTipoDoc('Boleta')}>
                        <Text style={tempTipoDoc === 'Boleta' ? styles.typeTextActive : styles.typeText}>Boleta</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.typeButton, tempTipoDoc === 'Factura' && styles.typeButtonActive, isReadOnly && { opacity: 0.6 }]}
                        disabled={isReadOnly}
                        onPress={() => setTempTipoDoc('Factura')}>
                        <Text style={tempTipoDoc === 'Factura' ? styles.typeTextActive : styles.typeText}>Factura</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Comercio:</Text>
                    <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempComercio} onChangeText={setTempComercio} placeholder="Nombre del comercio" />

                    <Text style={styles.label}>Categoría (IA):</Text>
                    <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempCategoria} onChangeText={setTempCategoria} placeholder="Ej: Automotriz" />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Monto Total:</Text>
                        <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled, { color: '#007AFF', fontWeight: 'bold' }]} editable={!isReadOnly} value={tempMonto} onChangeText={(t) => setTempMonto(formatPesos(t))} keyboardType="numeric" placeholder="$0" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Monto IVA:</Text>
                        <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempIva} onChangeText={(t) => setTempIva(formatPesos(t))} keyboardType="numeric" placeholder="$0" />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Folio / N°:</Text>
                        <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempNumeroDoc} onChangeText={setTempNumeroDoc} keyboardType="numeric" placeholder="Ej: 195" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>RUT Comercio:</Text>
                        <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempRut} onChangeText={setTempRut} placeholder="12.345.678-9" />
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Giro:</Text>
                        <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempGiro} onChangeText={setTempGiro} placeholder="Ej: Combustible" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Fecha:</Text>
                        <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempFecha} onChangeText={setTempFecha} placeholder="DD/MM/AAAA" />
                      </View>
                    </View>

                    <Text style={styles.label}>Glosa / Motivo:</Text>
                    <TextInput style={[styles.inputEdit, isReadOnly && styles.inputDisabled]} editable={!isReadOnly} value={tempGlosa} onChangeText={setTempGlosa} placeholder="Ej: Cena con clientes" />
                  </View>

                  <View style={styles.actions}>
                    {selectedGasto.estadoAprobacion === 'Pendiente' ? (
                      <>
                        <TouchableOpacity style={[styles.btnAction, styles.btnRechazar]} onPress={handleRechazarPress} disabled={savingEdit}>
                          <Ionicons name="close-circle-outline" size={20} color="#ff4444" />
                          <Text style={[styles.textRechazar, { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit>Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnAction, styles.btnAprobar]} onPress={() => cambiarEstado(selectedGasto.id, 'Aprobado')} disabled={savingEdit}>
                          {savingEdit ? <ActivityIndicator color="#fff" /> : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                              <Text style={[styles.textAprobar, { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit>Guardar y Aprobar</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                        <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#ff4444', flex: 1, marginRight: 5, borderRadius: 12, paddingVertical: 14 }]} onPress={() => handleEliminar(selectedGasto.id, selectedGasto.ruta)} disabled={savingEdit}>
                          <Ionicons name="trash-outline" size={20} color="#fff" />
                          <Text style={[styles.textAprobar, { fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit>Eliminar</Text>
                        </TouchableOpacity>

                        {!isEditingRecord ? (
                          <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#007AFF', flex: 1, marginLeft: 5, borderRadius: 12, paddingVertical: 14 }]} onPress={() => setIsEditingRecord(true)} disabled={savingEdit}>
                            <Ionicons name="pencil-outline" size={20} color="#fff" />
                            <Text style={[styles.textAprobar, { fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit>Editar</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity style={[styles.btnAction, styles.btnAprobar, { backgroundColor: '#34C759', flex: 1.5, marginLeft: 5, borderRadius: 12, paddingVertical: 14 }]} onPress={() => cambiarEstado(selectedGasto.id, selectedGasto.estadoAprobacion)} disabled={savingEdit}>
                            {savingEdit ? <ActivityIndicator color="#fff" /> : (
                              <>
                                <Ionicons name="save-outline" size={20} color="#fff" />
                                <Text style={[styles.textAprobar, { fontSize: 14 }]} numberOfLines={1} adjustsFontSizeToFit>Guardar Cambios</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>

                </ScrollView>
              );
            })()}

            {/* VISOR PANTALLA COMPLETA SOBRE EL MODAL */}
            {isFullScreenViewerVisible && selectedDocumentUrl && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', zIndex: 999 }]}>
                <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 1000 }} onPress={() => setIsFullScreenViewerVisible(false)}>
                  <Ionicons name="close" size={35} color="white" />
                </TouchableOpacity>
                {selectedIsPdf ? (
                  <View style={{ flex: 1, width: width, height: height, marginTop: 100, justifyContent: 'center', alignItems: 'center' }}>
                    <PdfViewer uri={selectedDocumentUrl} style={{ flex: 1, width: width }} />
                  </View>
                ) : (
                  <Image source={{ uri: selectedDocumentUrl }} style={{ flex: 1, width: '100%', height: '100%' }} resizeMode="contain" />
                )}
              </View>
            )}

            {/* OVERLAY DE MOTIVO DE RECHAZO (INLINE) */}
            {modalRechazoVisible && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, justifyContent: 'center', alignItems: 'center', borderRadius: 24 }]}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}>
                  <View style={{ width: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4444', marginBottom: 15, textAlign: 'center' }}>Motivo de Rechazo</Text>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center' }}>Indica por qué estás rechazando este documento para que el colaborador pueda saberlo.</Text>

                    <TextInput
                      style={{ backgroundColor: '#F8F9FA', borderRadius: 12, padding: 15, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: '#EAEAEA', textAlignVertical: 'top' }}
                      placeholder="Ej: Foto borrosa, el giro no corresponde..."
                      value={motivoRechazo}
                      onChangeText={setMotivoRechazo}
                      multiline
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                      <TouchableOpacity
                        style={{ flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginRight: 10, backgroundColor: '#f0f0f0' }}
                        onPress={() => setModalRechazoVisible(false)}
                        disabled={savingEdit}
                      >
                        <Text style={{ color: '#666', fontWeight: 'bold' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', backgroundColor: '#ff4444' }}
                        onPress={handeConfirmarRechazo}
                        disabled={savingEdit}
                      >
                        {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Rechazar</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* --- MODAL DE FILTROS --- */}
      <FilterSortModal
        visible={showFiltros}
        onClose={() => setShowFiltros(false)}
        filtrosActuales={filtros}
        onApply={(nuevosFiltros) => setFiltros(nuevosFiltros)}
        estadosDisponibles={['Todos', 'Aprobado', 'Rechazado', 'Pendiente']}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#101A26' },

  tabsContainer: { flexDirection: 'row', paddingHorizontal: 15, paddingTop: 5, paddingBottom: 5, backgroundColor: '#fff', marginBottom: 5 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#999' },
  tabTextActive: { color: '#007AFF' },

  btnFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  btnFilterText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13
  },
  btnViewMode: {
    backgroundColor: '#E8F1FF',
    padding: 0,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32
  },

  card: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 15, borderRadius: 15, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
  avatarMini: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E8F1FF', justifyContent: 'center', alignItems: 'center', marginRight: 8 },

  // Estilos Mosaico
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    width: '48%', // 2 columnas con espacio
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
  },
  gridHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  workerNameGrid: { fontSize: 13, fontWeight: 'bold', color: '#333', flex: 1 },
  gridImageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center'
  },
  comercioGrid: { fontSize: 14, fontWeight: 'bold', color: '#444', marginBottom: 2 },
  montoGrid: { fontSize: 16, fontWeight: 'bold', color: '#007AFF', marginTop: 4 },

  workerName: { fontSize: 15, fontWeight: 'bold', color: '#333' },

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

  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#007AFF', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 10, zIndex: 1000 },

  // Estilos del Nuevo Menú Flotante
  floatingMenu: { position: 'absolute', bottom: 110, right: 20, backgroundColor: 'rgba(35, 35, 40, 0.88)', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 15, width: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10 },
  menuIcon: { marginRight: 15 },
  menuText: { color: '#fff', fontSize: 17, fontWeight: '500' },
  menuSeparator: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%', marginVertical: 2 },

  cameraContainer: { flex: 1, backgroundColor: 'black' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', padding: 30, backgroundColor: 'black' },
  btnCancel: { backgroundColor: '#ff4444', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10 },
  btnConfirm: { backgroundColor: '#00C851', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  loadingOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },

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
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  inputEdit: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#EAEAEA', fontSize: 15, color: '#333' },
  inputDisabled: { backgroundColor: '#F0F0F0', color: '#888' },
  typeButton: { flex: 1, paddingVertical: 10, marginHorizontal: 5, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  typeButtonActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeText: { color: '#666', fontWeight: '500' },
  typeTextActive: { color: 'white', fontWeight: 'bold' },

  actions: { flexDirection: 'row', marginTop: 25, gap: 10 },
  btnAction: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 12, paddingHorizontal: 5 },
  btnRechazar: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2' },
  textRechazar: { color: '#ff4444', fontWeight: 'bold', marginLeft: 6 },
  btnAprobar: { backgroundColor: '#00C851' },
  textAprobar: { color: '#fff', fontWeight: 'bold', marginLeft: 6 },

  alertBox: { marginTop: 25, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10 },

  // --- VIEWER NATIVO ---
  viewerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  btnCloseViewer: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
});