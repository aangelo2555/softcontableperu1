/**
 * REGISTRO DE COSTOS — ELEMENTOS DEL COSTO MENSUAL (FORMATO 10.1)
 * Servicio de Negocio para PLE SUNAT
 */

function createCosts101Service(db) {
  
  const obtenerCostos = async (workspaceId, userId) => {
    return await db.prepare(`
      SELECT * FROM costs
      WHERE workspace_id = ? AND user_id = ?
      ORDER BY codigo ASC
    `).all(workspaceId, userId);
  };

  const generarTXT101 = async (workspaceId, userId, periodo) => {
    const rows = await obtenerCostos(workspaceId, userId);

    if (rows.length === 0) {
      return '';
    }

    const lines = rows.map((c, index) => {
      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;
      
      const codigoCosto = c.codigo || '01';
      const montoTotal = Number(c.monto) || 0;
      
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
        periodo,
        cuo,
        correlativo,
        codigoCosto,
        c.cuenta_debe || '9011',
        (c.descripcion || '').trim().toUpperCase(),
        matDirecto.toFixed(2),
        moDirecta.toFixed(2),
        costoIndirecto.toFixed(2),
        montoTotal.toFixed(2),
        '1'
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    return `LE${ruc}${periodoCorto}00100100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerCostos,
    generarTXT101,
    nombreArchivoTXT
  };
}

module.exports = createCosts101Service;
