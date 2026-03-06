import { Alert } from 'react-native';
import * as XLSX from 'xlsx';
// @ts-ignore
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Recibe un listado de gastos crudos desde Firebase y genera un Excel para descargar.
 * @param rawGastos El array de gastos obtenidos (idealmente ya filtrados, ej: solo Aprobados).
 * @param nombreUsuario El nombre del usuario o empresa solicitante (para el nombre del archivo).
 */
export const generarReporteExcel = async (rawGastos: any[], nombreUsuario: string = "Usuario", isEmpresa: boolean = false) => {
    if (!rawGastos || rawGastos.length === 0) {
        return Alert.alert("Vacío", "No hay gastos para exportar.");
    }

    try {
        const headerRow = ["Fecha Subida", "Comercio", "RUT", "Giro/Rubro", "Fecha Boleta", "Glosa", "Monto", "Estado"];
        if (isEmpresa) {
            headerRow.push("Colaborador");
        }
        const datosExcel = [headerRow];

        rawGastos.forEach(item => {
            let fechaSub = "Sin fecha";
            if (item.fechaSubida) {
                try { fechaSub = format(item.fechaSubida.toDate(), 'dd/MM/yyyy HH:mm'); } catch { }
            }

            const row = [
                fechaSub,
                item.comercio || "Sin nombre",
                item.rut || "S/R",
                item.giro || "S/G",
                item.fechaDetectada || "S/F",
                item.glosa || "",
                Number(item.monto) || 0,
                item.estado || "Procesado"
            ];

            if (isEmpresa) {
                row.push(item.nombreTrabajador || "Desconocido");
            }

            datosExcel.push(row);
        });

        const hoja = XLSX.utils.aoa_to_sheet(datosExcel);

        const columnWidths = [
            { wch: 18 }, { wch: 35 }, { wch: 15 }, { wch: 80 },
            { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 15 }
        ];
        if (isEmpresa) {
            columnWidths.push({ wch: 25 });
        }
        hoja['!cols'] = columnWidths;

        // Formato contable para los montos (Columna G, índice 6)
        for (let i = 1; i < datosExcel.length; i++) {
            const celdaMonto = XLSX.utils.encode_cell({ c: 6, r: i });
            if (hoja[celdaMonto]) {
                hoja[celdaMonto].z = '"$"#,##0';
            }
        }

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Gastos Rindefy");
        const excelBase64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });

        const mesActual = format(new Date(), 'MMMM', { locale: es });

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
        console.error("Error al exportar Excel:", error);
        Alert.alert("Error", "Fallo al exportar Excel: " + error.message);
    }
};
