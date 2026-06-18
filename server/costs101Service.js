/**
 * REGISTRO DE COSTOS — ELEMENTOS DEL COSTO MENSUAL (FORMATO 10.1)
 * Servicio de Negocio para PLE SUNAT
 */

function createCosts101Service(db) {
  
  const obtenerCostos = (workspaceId, userId) => {
    return db.prepare(`
      SELECT * FROM costs
      WHERE workspace_id = ? AND user_id = ?
      ORDER BY codigo ASC
    `).all(workspaceId, userId);
  };

  const generarTXT101 = (workspaceId, userId, periodo) => {
    const rows = obtenerCostos(workspaceId, userId);

    if (rows.length === 0) {
      return '';
    }

    const lines = rows.map((c, index) => {
      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;
      
      const codigoCosto = c.codigo || '01'; // Tabla 23 (01 Materiales, 02 Mano de Obra)
      const montoTotal = Number(c.monto) || 0;
      
      // Mapear porcentajes o montos a las columnas oficiales
      let matDirecto = 0;
      let moDirecta = 0;
      let costoIndirecto = 0;

      if (codigoCosto === '01') {
        matDirecto = montoTotal;
      } else if (codigoCosto === '02') {
        moDirecta = montoTotal;
      } else {
        costoIndirecto = montoTotal;
      }

      return [
        periodo, // 1. Periodo (YYYYMM00)
        cuo, // 2. CUO
        correlativo, // 3. Correlativo
        codigoCosto, // 4. Elemento del Costo (Tabla 23)
        c.cuenta_debe || '9011', // 5. Cuenta del costo
        (c.descripcion || '').trim().toUpperCase(), // 6. Descripción
        matDirecto.toFixed(2), // 7. Material Directo
        moDirecta.toFixed(2), // 8. Mano de Obra Directa
        costoIndirecto.toFixed(2), // 9. Costo Indirecto
        montoTotal.toFixed(2), // 10. Costo Total
        '1' // 11. Estado de la operación (1 = Activo)
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    // Estructura SUNAT PLE 10.1: LE[RUC][AÑO][MES]00100100001[CONT][MONEDA]1.txt
    return `LE${ruc}${periodoCorto}00100100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerCostos,
    generarTXT101,
    nombreArchivoTXT
  };
}

module.exports = createCosts101Service;
