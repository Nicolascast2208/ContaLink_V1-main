export type OrdenFiltro = 'fecha_desc' | 'fecha_asc' | 'precio_desc' | 'precio_asc' | null;
export type TipoFiltro = 'Todos' | 'Boleta' | 'Factura';
export type EstadoFiltro = 'Todos' | 'Aprobado' | 'Rechazado' | 'Pendiente' | 'Procesado' | 'Revisar Manualmente';

export interface FiltrosGlobales {
    orden: OrdenFiltro;
    tipo: TipoFiltro;
    estado: EstadoFiltro;
}

export const filtrosIniciales: FiltrosGlobales = {
    orden: 'fecha_desc',
    tipo: 'Todos',
    estado: 'Todos',
};

/**
 * Aplica los filtros y el orden seleccionado sobre un array de gastos.
 * 
 * @param gastos Array original de gastos (ej. Boleta[])
 * @param filtros Configuración de filtros seleccionada por el usuario
 * @returns Un nuevo array de gastos filtrado y ordenado
 */
export const aplicarFiltrosYOrden = (gastos: any[], filtros: FiltrosGlobales) => {
    let resultado = [...gastos];

    // 1. Filtrar por Tipo de Documento
    if (filtros.tipo !== 'Todos') {
        resultado = resultado.filter(g => g.tipoDocumento === filtros.tipo);
    }

    // 2. Filtrar por Estado (Maneja tanto estado directo como estadoAprobacion dependiendo de la vista)
    if (filtros.estado !== 'Todos') {
        resultado = resultado.filter(g => {
            // ParaHomeScreen o vistas mixtas, chequeamos cuál tiene valor
            const estadoActual = g.estadoAprobacion || g.estado;
            return estadoActual === filtros.estado;
        });
    }

    // 3. Ordenar
    if (filtros.orden) {
        resultado.sort((a, b) => {
            switch (filtros.orden) {
                case 'precio_desc':
                    return (Number(b.monto) || 0) - (Number(a.monto) || 0);
                case 'precio_asc':
                    return (Number(a.monto) || 0) - (Number(b.monto) || 0);
                case 'fecha_desc':
                    return new Date(b.fechaDetectada || 0).getTime() - new Date(a.fechaDetectada || 0).getTime();
                case 'fecha_asc':
                    return new Date(a.fechaDetectada || 0).getTime() - new Date(b.fechaDetectada || 0).getTime();
                default:
                    return 0;
            }
        });
    }

    return resultado;
};
