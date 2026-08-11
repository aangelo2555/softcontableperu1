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

  const obtenerMovimientos = async (workspaceId, userId) => {
    return await db.prepare(`
      SELECT m.*, p.code as product_code, p.name as product_name, p.unit_measure, p.type_existence
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.id
      WHERE m.workspace_id = ? AND m.user_id = ?
      ORDER BY m.fecha ASC, m.id ASC
    `).all(workspaceId, userId);
  };

  const generarTXT121 = async (workspaceId, userId, periodo) => {
    const rows = await obtenerMovimientos(workspaceId, userId);
    
    const yyyymm = periodo.substring(0, 4) + '-' + periodo.substring(4, 6);
    const filteredRows = rows.filter(r => r.fecha && r.fecha.startsWith(yyyymm));

    if (filteredRows.length === 0) {
      return '';
    }

    const lines = filteredRows.map((m, index) => {
      const fechaMov = fechaToDD_MM_AAAA(m.fecha);
      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = m.reference_id || `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;
      
      const tipoExistencia = m.type_existence || '01';
      const unidadMedida = m.unit_measure || 'NIU';
      
      const cantIn = Number(m.cantidad_in) || 0;
      const cantOut = Number(m.cantidad_out) || 0;
      const cantSaldo = Number(m.cantidad_saldo) || 0;

      const catalogo = '9'; 

      return [
        periodo,
        cuo,
        correlativo,
        '0000',
        catalogo,
        tipoExistencia,
        m.product_code || 'PROD',
        '9',
        (m.product_name || '').trim().toUpperCase(),
        unidadMedida,
        fechaMov,
        m.tipo_doc || '09',
        m.serie || '0001',
        m.numero || '00000001',
        m.tipo_operacion || '16',
        cantIn.toFixed(2),
        cantOut.toFixed(2),
        cantSaldo.toFixed(2),
        '1'
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    return `LE${ruc}${periodoCorto}00120100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerMovimientos,
    generarTXT121,
    nombreArchivoTXT
  };
}

module.exports = createKardex121Service;
