import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  // --- GENERALES ---
  // Se eliminó paddingTop: 50 para que el Header controle su propio espacio
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  authContainer: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f0f2f5' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  input: { backgroundColor: '#f0f2f5', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },

  // Botones
  btnPrimary: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnGoogle: { backgroundColor: '#DB4437', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  // Links
  link: { marginTop: 15, color: '#007AFF', textAlign: 'center', fontWeight: '600' },
  linkSmall: { color: '#666', textAlign: 'center', fontSize: 12 },

  // ==========================================
  // --- HEADER (CABECERA GLOBAL ESTANDARIZADA) ---
  // ==========================================
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 15 : 20, // Ajuste inteligente para el "Safe Area"
    paddingBottom: 10,
    backgroundColor: '#fff'
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  emptyState: { alignItems: 'center', marginTop: 100, opacity: 0.5 },

  // --- TARJETA DE RESUMEN MENSUAL (HOME) ---
  summaryContainer: {
    backgroundColor: '#007AFF',
    margin: 20,
    marginTop: 10, // Margen extra para que no quede pegado al header
    padding: 20,
    borderRadius: 15,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8
  },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textTransform: 'uppercase', fontWeight: '600' },
  summaryTotal: { color: 'white', fontSize: 32, fontWeight: 'bold', marginTop: 5 },

  // --- ITEMS LISTA (HOME) ---
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, marginHorizontal: 20, marginBottom: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef6ff', justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontWeight: 'bold', fontSize: 16, color: '#333', flex: 1 },
  itemSub: { color: '#888', fontSize: 14 },

  // --- BOTÓN FLOTANTE (FAB) ---
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },

  // --- CÁMARA Y MODALES ---
  cameraContainer: { flex: 1, backgroundColor: 'black' },
  preview: { flex: 1, resizeMode: 'contain' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingVertical: 50 },
  cameraHeader: { paddingLeft: 20, alignItems: 'flex-start' },
  btnClose: { padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraFooter: { alignItems: 'center', marginBottom: 20 },
  shutter: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'white', borderWidth: 5, borderColor: '#ccc' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', padding: 30, backgroundColor: 'black' },
  btnCancel: { padding: 15, backgroundColor: '#ff4444', borderRadius: 10, width: 120, alignItems: 'center' },
  btnConfirm: { padding: 15, backgroundColor: '#00C851', borderRadius: 10, width: 120, alignItems: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },

  // Visor de Imagen
  viewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  btnCloseViewer: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },

  // --- ESTILOS DEL CALENDARIO ---
  calendarCard: {
    marginTop: 15,
    marginHorizontal: 20,
    borderRadius: 15,
    backgroundColor: 'white',
    marginBottom: 20,
    padding: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4
  },

  sectionContainer: {
    marginHorizontal: 20,
    marginBottom: 20
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    marginTop: 10
  },

  // Mini tarjeta del detalle del día
  miniCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  miniTitle: { fontWeight: '600', color: '#555', fontSize: 14 },
  miniMonto: { fontWeight: 'bold', color: '#333', fontSize: 14 },

  // Filas del resumen anual
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  monthName: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  monthTotal: { color: '#007AFF', fontWeight: 'bold', fontSize: 18 }
});