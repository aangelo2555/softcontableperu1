/**
 * REGISTRO DE INVENTARIO PERMANENTE VALORIZADO / FÍSICO (FORMATO 12.1)
 * Servicio de Negocio para PLE SUNAT (Kárdex en unidades físicas)
 */

function createKardex121Service(db) {
  
  const fechaToDD_MM_AAAA = (fecha) => {
    if (!fecha) return '';
    if (fecha.includes('/')) return fecha;
    const parts = fecha.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return fecha;
  };

  const obtenerMovimientos = (workspaceId, userId) => {
    return db.prepare(`
      SELECT m.*, p.code as product_code, p.name as product_name, p.unit_measure, p.type_existence
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.id
      WHERE m.workspace_id = ? AND m.user_id = ?
      ORDER BY m.fecha ASC, m.id ASC
    `).all(workspaceId, userId);
  };

  const generarTXT121 = (workspaceId, userId, periodo) => {
    const rows = obtenerMovimientos(workspaceId, userId);
    
    // Filtrar movimientos por periodo YYYY-MM
    const yyyymm = periodo.substring(0, 4) + '-' + periodo.substring(4, 6);
    const filteredRows = rows.filter(r => r.fecha && r.fecha.startsWith(yyyymm));

    if (filteredRows.length === 0) {
      return '';
    }

    const lines = filteredRows.map((m, index) => {
      const fechaMov = fechaToDD_MM_AAAA(m.fecha);
      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = m.reference_id || `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;
      
      const tipoExistencia = m.type_existence || '01'; // 01 Mercadería
      const unidadMedida = m.unit_measure || 'NIU'; // NIU = Unidades
      
      const cantIn = Number(m.cantidad_in) || 0;
      const cantOut = Number(m.cantidad_out) || 0;
      const cantSaldo = Number(m.cantidad_saldo) || 0;

      // Código SUNAT para Catálogo (Generalmente '9' o '1' - 9 para otros)
      const catalogo = '9'; 

      return [
        periodo, // 1. Periodo (YYYYMM00)
        cuo, // 2. CUO
        correlativo, // 3. Correlativo
        '0000', // 4. Código del establecimiento (0000 = Principal)
        catalogo, // 5. Código catálogo (9 = Otros)
        tipoExistencia, // 6. Tipo de existencia (Tabla 5)
        m.product_code || 'PROD', // 7. Código del producto
        '9', // 8. Código catálogo SUNAT (9 = Otros)
        (m.product_name || '').trim().toUpperCase(), // 9. Descripción del producto
        unidadMedida, // 10. Unidad de medida (Tabla 6)
        fechaMov, // 11. Fecha
        m.tipo_doc || '09', // 12. Tipo doc (Tabla 10 - 09 Guía)
        m.serie || '0001', // 13. Serie doc
        m.numero || '00000001', // 14. Nro doc
        m.tipo_operacion || '16', // 15. Tipo operación (Tabla 12 - 16 saldo inicial)
        cantIn.toFixed(2), // 16. Cantidad Entrada
        cantOut.toFixed(2), // 17. Cantidad Salida
        cantSaldo.toFixed(2), // 18. Saldo Cantidad
        '1' // 19. Estado de la operación (1 = Activo)
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    // Estructura SUNAT PLE 12.1: LE[RUC][AÑO][MES]00120100001[CONT][MONEDA]1.txt
    return `LE${ruc}${periodoCorto}00120100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerMovimientos,
    generarTXT121,
    nombreArchivoTXT
  };
}

module.exports = createKardex121Service;
