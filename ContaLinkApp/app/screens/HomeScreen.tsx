import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal, Image, ActivityIndicator, Alert,
  RefreshControl, TextInput, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, Dimensions, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDownloadURL, ref } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Pdf from 'react-native-pdf';

import { auth, storage } from '../../utils/firebaseconfig';
import { useGastos } from '../../hooks/useGastos';

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

interface Boleta {
  id: string; uid: string; archivo: string; ruta: string; fechaSubida: any;
  estado: string; monto: number; comercio: string; rut?: string; giro?: string;
  fechaDetectada?: string; glosa?: string; tipoDocumento?: 'Boleta' | 'Factura'; numeroDocumento?: string;
  motivoRechazo?: string;
  miniaturaBase64?: string; iva?: number;
  estadoAprobacion?: string; empresaId?: string;
}

export default function HomeScreen({ user }: { user: any }) {
  const { boletas, loading, empresaNombre, agregarGasto, eliminarGasto, editarGasto } = useGastos(user);

  const [refreshing, setRefreshing] = useState(false);
  const [totalMes, setTotalMes] = useState(0);

  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ uri: string, isPdf: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [loadingImage, setLoadingImage] = useState(false);

  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string | null>(null);
  const [selectedIsPdf, setSelectedIsPdf] = useState<boolean>(false);
  const [isFullScreenViewerVisible, setIsFullScreenViewerVisible] = useState(false);

  const [editingBoleta, setEditingBoleta] = useState<Boleta | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [tempComercio, setTempComercio] = useState('');
  const [tempMonto, setTempMonto] = useState('');
  const [tempIva, setTempIva] = useState('');
  const [tempRut, setTempRut] = useState('');
  const [tempGiro, setTempGiro] = useState('');
  const [tempFecha, setTempFecha] = useState('');
  const [tempGlosa, setTempGlosa] = useState('');
  const [tempTipoDoc, setTempTipoDoc] = useState('Boleta');
  const [tempNumeroDoc, setTempNumeroDoc] = useState('');

  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const suma = boletas.reduce((acc, item) => {
      // Sumar al total SOLAMENTE si el gasto está APROBADO
      if (item.estado === 'Duplicado' || item.estadoAprobacion !== 'Aprobado') return acc;

      if (!item.fechaSubida) return acc;
      const fecha = item.fechaSubida.toDate ? item.fechaSubida.toDate() : new Date(item.fechaSubida);
      if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
        return acc + (item.monto || 0);
      }
      return acc;
    }, 0);
    setTotalMes(suma);
  }, [boletas]);

  useEffect(() => {
    if (editingBoleta?.ruta) {
      getDownloadURL(ref(storage, editingBoleta.ruta))
        .then(url => {
          setSelectedDocumentUrl(url);
          setSelectedIsPdf(editingBoleta.ruta.toLowerCase().endsWith('.pdf'));
        })
        .catch(() => setSelectedDocumentUrl(null));
    } else {
      setSelectedDocumentUrl(null);
    }
  }, [editingBoleta]);

  const onRefresh = useCallback(() => {
    setRefreshing(true); setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
      setShowConfirm(false); setSelectedFile(null);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setUploading(false); }
  };

  const handleGuardarEdicion = async () => {
    if (!editingBoleta) return;
    if (!tempGlosa || tempGlosa.trim() === '') {
      Alert.alert("Campo Obligatorio", "Por favor ingresa una glosa/motivo para este documento.");
      return;
    }
    setSavingEdit(true);
    try {
      const montoLimpio = parseInt(tempMonto.replace(/[^0-9]/g, '')) || 0;
      const ivaLimpio = parseInt(tempIva.replace(/[^0-9]/g, '')) || 0;
      await editarGasto(editingBoleta.id, tempComercio, montoLimpio, tempRut, tempGiro, tempFecha, tempGlosa, tempTipoDoc, tempNumeroDoc, ivaLimpio);
      setEditingBoleta(null);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSavingEdit(false); }
  };

  const handleEliminarBoleta = async (id: string, ruta: string) => {
    Alert.alert("Eliminar", "¿Seguro que deseas eliminar este gasto?", [
      { text: "Cancelar" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          setDeletingId(id);
          try {
            await eliminarGasto(id, ruta);
            setEditingBoleta(null); // Assuming setEditingBoleta(null) closes the modal
            Alert.alert("Éxito", "Gasto eliminado correctamente.");
          } catch (e: any) { Alert.alert("Error", e.message); }
          finally { setDeletingId(null); }
        }
      }
    ]);
  };

  const iniciarEdicion = (boleta: Boleta) => {
    setIsFullScreenViewerVisible(false);
    setIsEditingMode(false);
    setEditingBoleta(boleta);
    setTempComercio(boleta.comercio || '');
    setTempMonto(formatPesos(boleta.monto));
    setTempIva(formatPesos(boleta.iva || 0));
    setTempRut(boleta.rut || '');
    setTempGiro(boleta.giro || '');
    setTempFecha(boleta.fechaDetectada || '');
    setTempGlosa(boleta.glosa || '');
    setTempTipoDoc(boleta.tipoDocumento || 'Boleta');
    setTempNumeroDoc(boleta.numeroDocumento || '');
  };

  const mostrarOpciones = () => {
    Alert.alert("Agregar Documento", "Selecciona una opción", [
      { text: "Cancelar", style: "cancel" }, { text: "Cámara", onPress: () => handleSelectImage(true) },
      { text: "Galería", onPress: () => handleSelectImage(false) }, { text: "Archivo PDF", onPress: handleSelectDocument }
    ]);
  };

  const renderEstadoBadge = (item: Boleta) => {
    if (item.estado === 'Duplicado') {
      return <Text style={[styles.itemSub, { color: '#ff4444', fontWeight: 'bold' }]}>⚠️ DUPLICADO • ${item.monto.toLocaleString('es-CL')}</Text>;
    }
    if (item.empresaId) {
      if (item.estadoAprobacion === 'Rechazado') return <Text style={[styles.itemSub, { color: '#ff4444', fontWeight: 'bold' }]}>❌ Rechazado • ${item.monto.toLocaleString('es-CL')}</Text>;
      if (item.estadoAprobacion === 'Pendiente') return <Text style={[styles.itemSub, { color: '#FF8800', fontWeight: 'bold' }]}>⏳ Pend. Aprobación • ${item.monto.toLocaleString('es-CL')}</Text>;
      if (item.estadoAprobacion === 'Aprobado') return <Text style={[styles.itemSub, { color: '#00C851', fontWeight: 'bold' }]}>✅ Aprobado • ${item.monto.toLocaleString('es-CL')}</Text>;
    }
    let colorFinal = '#888';
    if (item.estado === 'Procesado') colorFinal = '#00C851';
    if (item.estado === 'Revisar Manualmente') colorFinal = '#FFBB33';
    return <Text style={[styles.itemSub, { color: colorFinal }]}>{item.estado} • ${item.monto.toLocaleString('es-CL')}</Text>;
  };

  const nombreMes = new Date().toLocaleString('es-ES', { month: 'long' });
  const nombreMesCap = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

  const isApproved = editingBoleta?.estadoAprobacion === 'Aprobado';
  const isReadOnly = isApproved || !isEditingMode;

  return (
    <View style={styles.container}>
      {/* ESPACIO SUPERIOR CORREGIDO */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={styles.headerTitle}>Mis Gastos</Text>
          {empresaNombre && (
            <View style={{ backgroundColor: '#E8F1FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 5 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#007AFF' }}>
                <Ionicons name="business" size={12} color="#007AFF" /> {empresaNombre}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryLabel}>Gastos de {nombreMesCap}</Text>
        <Text style={styles.summaryTotal}>${totalMes.toLocaleString('es-CL')}</Text>
      </View>

      <FlatList
        data={boletas}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 110 }} // Margen inferior para no chocar con el botón flotante
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? <ActivityIndicator size="large" color="#007AFF" /> : (
              <><Ionicons name="receipt-outline" size={50} color="#999" /><Text style={{ color: '#999', marginTop: 10 }}>No tienes documentos aún.</Text></>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.itemCard} onPress={() => iniciarEdicion(item)} activeOpacity={0.8}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>

              <View style={[
                styles.itemIcon,
                { padding: 0, overflow: 'hidden', borderRadius: 12, width: 70, height: 90, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#eee', marginRight: 15 }
              ]}>
                {item.miniaturaBase64 ? (
                  <Image source={{ uri: item.miniaturaBase64 }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                    <Ionicons name={item.ruta.includes('.pdf') ? "document-text" : "image"} size={35} color="#ddd" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, paddingRight: 5 }}>
                <Text style={[styles.itemTitle, (item.estado === 'Duplicado' || item.estadoAprobacion === 'Rechazado') && { color: '#ff4444', textDecorationLine: 'line-through' }]} numberOfLines={1}>
                  {item.comercio}
                </Text>
                <Text style={{ fontSize: 12, color: '#444', fontWeight: '500', marginBottom: 2 }}>
                  {item.tipoDocumento || 'Boleta'} {item.numeroDocumento ? `N° ${item.numeroDocumento}` : ''}
                </Text>
                {(item.rut || item.giro) && (
                  <Text style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                    {item.rut ? `RUT: ${item.rut}` : ''} {item.rut && item.giro ? ' • ' : ''} {item.giro ? `${item.giro.substring(0, 25)}${item.giro.length > 25 ? '...' : ''}` : ''}
                  </Text>
                )}
                {renderEstadoBadge(item)}
              </View>

              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </View>
          </TouchableOpacity>
        )}
      />

      {/* BOTÓN FLOTANTE CORREGIDO CON SÚPER PRIORIDAD DE TOQUE */}
      <TouchableOpacity style={styles.fab} onPress={mostrarOpciones} activeOpacity={0.7}>
        <Ionicons name="add" size={35} color="white" />
      </TouchableOpacity>

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
          MODAL DE DETALLES Y EDICIÓN
          ========================================================== */}
      <Modal visible={!!editingBoleta} transparent={true} animationType="slide" onRequestClose={() => setEditingBoleta(null)}>
        {editingBoleta && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackground}>
            <View style={styles.modalContent}>

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isReadOnly ? 'Detalles del Gasto' : 'Editar Documento'}</Text>
                <TouchableOpacity onPress={() => setEditingBoleta(null)}>
                  <Ionicons name="close-circle" size={30} color="#ccc" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

                {/* Visor de documento integrado */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => { if (selectedDocumentUrl) setIsFullScreenViewerVisible(true); }}
                  style={{ width: '100%', height: 350, backgroundColor: '#f0f0f0', borderRadius: 12, marginBottom: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
                >
                  {!selectedDocumentUrl ? (
                    <ActivityIndicator size="large" color="#007AFF" />
                  ) : selectedIsPdf ? (
                    <View pointerEvents="none" style={{ flex: 1, width: '100%' }}>
                      <Pdf source={{ uri: selectedDocumentUrl }} style={{ flex: 1, width: '100%' }} fitPolicy={0} trustAllCerts={false} />
                    </View>
                  ) : (
                    <Image source={{ uri: selectedDocumentUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  )}
                </TouchableOpacity>

                {isApproved && (
                  <View style={styles.alertBox}>
                    <Text style={{ textAlign: 'center', color: '#00C851', fontWeight: 'bold', fontSize: 15 }}>
                      ✅ Documento Aprobado
                    </Text>
                    <Text style={{ textAlign: 'center', color: '#666', marginTop: 5, fontSize: 13 }}>
                      Este gasto ya fue revisado y validado. No se puede modificar ni eliminar.
                    </Text>
                  </View>
                )}

                {editingBoleta?.estadoAprobacion === 'Rechazado' && editingBoleta?.motivoRechazo && (
                  <View style={[styles.alertBox, { backgroundColor: '#ffebe6', borderWidth: 1, borderColor: '#ff4444' }]}>
                    <Text style={{ textAlign: 'center', color: '#ff4444', fontWeight: 'bold', fontSize: 15 }}>
                      ❌ Documento Rechazado
                    </Text>
                    <Text style={{ textAlign: 'center', color: '#d32f2f', marginTop: 5, fontSize: 13, fontWeight: '500' }}>
                      Motivo: {editingBoleta.motivoRechazo}
                    </Text>
                  </View>
                )}

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

                {!isApproved && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.btnAction, styles.btnEliminar]} onPress={() => handleEliminarBoleta(editingBoleta.id, editingBoleta.ruta)}>
                      {deletingId === editingBoleta.id ? <ActivityIndicator color="#ff4444" /> : (
                        <>
                          <Ionicons name="trash-outline" size={22} color="#ff4444" />
                          <Text style={styles.textEliminar}>Eliminar</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {!isEditingMode ? (
                      <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#f0f0f0', borderColor: '#ccc', borderWidth: 1 }]} onPress={() => setIsEditingMode(true)}>
                        <Ionicons name="pencil-outline" size={22} color="#333" />
                        <Text style={{ color: '#333', fontSize: 16, fontWeight: 'bold', marginLeft: 8 }}>Editar</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.btnAction, styles.btnGuardar]} onPress={handleGuardarEdicion} disabled={savingEdit}>
                        {savingEdit ? <ActivityIndicator color="#fff" /> : (
                          <>
                            <Ionicons name="save-outline" size={22} color="#fff" />
                            <Text style={styles.textGuardar}>Guardar</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>

              {/* VISOR PANTALLA COMPLETA SOBRE EL MODAL */}
              {isFullScreenViewerVisible && selectedDocumentUrl && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'black', zIndex: 999 }]}>
                  <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 1000 }} onPress={() => setIsFullScreenViewerVisible(false)}>
                    <Ionicons name="close" size={35} color="white" />
                  </TouchableOpacity>
                  {selectedIsPdf ? (
                    <View style={{ flex: 1, width: width, height: height, marginTop: 100 }}>
                      <Pdf source={{ uri: selectedDocumentUrl }} style={{ flex: 1, width: width }} fitPolicy={0} trustAllCerts={false} />
                    </View>
                  ) : (
                    <Image source={{ uri: selectedDocumentUrl }} style={{ flex: 1, width: '100%', height: '100%' }} resizeMode="stretch" />
                  )}
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  // Ajuste de margen superior según el dispositivo (iOS vs Android)
  // --- ESPACIO SUPERIOR REDUCIDO ---
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 15 : 20, paddingBottom: 10, backgroundColor: '#fff' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },

  summaryContainer: { backgroundColor: '#007AFF', margin: 20, padding: 25, borderRadius: 15, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  summaryTotal: { color: 'white', fontSize: 38, fontWeight: 'bold', marginTop: 5 },

  emptyState: { alignItems: 'center', marginTop: 80 },

  itemCard: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 15, borderRadius: 15, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3 },
  itemIcon: { justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  itemSub: { fontSize: 14, color: '#888', marginTop: 4 },

  // Botón Flotante con Z-Index muy alto para que no sea bloqueado
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#007AFF', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 10, zIndex: 1000 },

  modalBackground: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', height: '85%', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },

  btnVerDoc: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8F1FF', padding: 15, borderRadius: 12, marginBottom: 20 },
  textVerDoc: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },

  dataGrid: { backgroundColor: '#F8F9FA', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#EAEAEA' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  inputEdit: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#EAEAEA', fontSize: 15, color: '#333' },
  inputDisabled: { backgroundColor: '#F0F0F0', color: '#888' },

  typeButton: { flex: 1, paddingVertical: 10, marginHorizontal: 5, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center', backgroundColor: '#fff' },
  typeButtonActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeText: { color: '#666', fontWeight: '500' },
  typeTextActive: { color: 'white', fontWeight: 'bold' },

  actions: { flexDirection: 'row', marginTop: 25, gap: 15 },
  btnAction: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15, borderRadius: 12 },
  btnEliminar: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2' },
  textEliminar: { color: '#ff4444', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  btnGuardar: { backgroundColor: '#007AFF' },
  textGuardar: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },

  alertBox: { marginBottom: 20, padding: 15, backgroundColor: '#E8F5E9', borderRadius: 10, borderWidth: 1, borderColor: '#C8E6C9' },

  cameraContainer: { flex: 1, backgroundColor: 'black' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', padding: 30, backgroundColor: 'black' },
  btnCancel: { backgroundColor: '#ff4444', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10 },
  btnConfirm: { backgroundColor: '#00C851', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  loadingOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },

  viewerContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  btnCloseViewer: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
});