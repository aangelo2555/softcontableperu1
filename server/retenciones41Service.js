/**
 * LIBRO DE RETENCIONES 4TA CATEGORÍA (FORMATO 4.1) — Servicio de Negocio
 * RS N° 234-2006/SUNAT
 */

function createRetenciones41Service(db) {
  
  const fechaToDD_MM_AAAA = (fecha) => {
    if (!fecha) return '';
    if (fecha.includes('/')) return fecha;
    const parts = fecha.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return fecha;
  };

  const obtenerRetenciones = (workspaceId, userId, periodo) => {
    const y = periodo.substring(0, 4);
    const m = periodo.substring(4, 6);
    const dateLike = `${y}-${m}-%`; 
    const slashLike = `%/${m}/${y}`; 
    
    // Seleccionar honorarios del período con retención mayor a cero (o todos si queremos listarlos)
    // El PLE 4.1 es para retenciones efectuadas.
    const rows = db.prepare(`
      SELECT * FROM honorarios 
      WHERE workspace_id = ? AND user_id = ? AND (fecha LIKE ? OR fecha LIKE ?)
      ORDER BY fecha, serie, numero
    `).all(workspaceId, userId, dateLike, slashLike);

    return rows;
  };

  const generarTXT41 = (workspaceId, userId, periodo) => {
    const rows = obtenerRetenciones(workspaceId, userId, periodo);
    
    if (rows.length === 0) {
      // Si no hay datos, PLE de SUNAT acepta el archivo vacío
      return '';
    }

    const lines = rows.map((h, index) => {
      const fechaFormateada = fechaToDD_MM_AAAA(h.fecha);
      let docTipo = h.doc_tipo || (h.doc_num.length === 11 ? '6' : '1');
      const serieStr = (h.serie || 'E001').trim();
      const numeroStr = (h.numero || '').trim();

      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;

      const bi = Number(h.bi) || 0;
      const retencion = Number(h.retencion) || 0;
      const total = Number(h.total) || 0;

      return [
        periodo, // 1. Periodo (YYYYMM00)
        cuo, // 2. CUO
        correlativo, // 3. Correlativo asiento
        docTipo, // 4. Tipo Doc Proveedor (SUNAT Tabla 2)
        h.doc_num, // 5. Num Doc Proveedor
        h.nombre.trim().toUpperCase(), // 6. Nombre/Razón Social del profesional
        '02', // 7. Tipo Comprobante (02 = Recibo de Honorarios)
        serieStr, // 8. Serie
        numeroStr, // 9. Numero
        bi.toFixed(2), // 10. Honorario Bruto
        retencion.toFixed(2), // 11. Retención IR 4ta (8%)
        total.toFixed(2), // 12. Neto pagado
        fechaFormateada, // 13. Fecha de Emisión (DD/MM/YYYY)
        fechaFormateada, // 14. Fecha de Pago
        '1' // 15. Estado de anotación (1)
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    return `LE${ruc}${periodoCorto}00040100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerRetenciones,
    generarTXT41,
    nombreArchivoTXT
  };
}

module.exports = createRetenciones41Service;
