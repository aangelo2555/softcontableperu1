/**
 * LIBRO DE ACTIVOS FIJOS (FORMATO 7.1) — Servicio de Negocio para PLE SUNAT
 */

function createPle71Service(db) {
  
  const fechaToDD_MM_AAAA = (fecha) => {
    if (!fecha) return '';
    if (fecha.includes('/')) return fecha;
    const parts = fecha.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return fecha;
  };

  const obtenerActivosFijos = async (workspaceId, userId) => {
    const rows = await db.prepare(`
      SELECT * FROM fixed_assets 
      WHERE workspace_id = ? AND user_id = ?
      ORDER BY codigo
    `).all(workspaceId, userId);

    return rows;
  };

  const generarTXT71 = async (workspaceId, userId, periodo) => {
    const rows = await obtenerActivosFijos(workspaceId, userId);
    
    if (rows.length === 0) {
      return '';
    }

    const lines = rows.map((a, index) => {
      const fechaAdq = fechaToDD_MM_AAAA(a.fecha_adquisicion);
      const fechaUso = fechaToDD_MM_AAAA(a.fecha_uso) || fechaAdq;
      
      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;

      let tipoActivo = '99';
      const cta = a.cuenta_activo || '';
      if (cta.startsWith('331')) tipoActivo = '01';
      else if (cta.startsWith('332')) tipoActivo = '02';
      else if (cta.startsWith('333')) tipoActivo = '03';
      else if (cta.startsWith('334')) tipoActivo = '04';
      else if (cta.startsWith('335')) tipoActivo = '05';
      else if (cta.startsWith('336')) tipoActivo = '06';

      const saldoInicial = Number(a.saldo_inicial) || 0;
      const adquisiciones = Number(a.adquisiciones) || 0;
      const mejoras = Number(a.mejoras) || 0;
      const retirosBajas = Number(a.retiros_bajas) || 0;
      const otrosAjustes = Number(a.otros_ajustes) || 0;
      const ajusteInflacion = Number(a.ajuste_inflacion) || 0;
      const costoAdq = Number(a.costo_adquisicion) || Number(a.costo) || 0;
      const valorHistorico = costoAdq + saldoInicial + adquisiciones + mejoras - retirosBajas + otrosAjustes;
      const valorAjustado = valorHistorico + ajusteInflacion;

      const tasaTrib = Number(a.tasa_depreciacion_tributaria) || Number(a.tasa_depreciacion) || 0;
      const deprecAcumAnt = Number(a.deprec_acum_anterior_tributaria) || Number(a.deprec_acum_anterior) || 0;
      const deprecEjec = Number(a.deprec_ejercicio_tributaria) || Number(a.deprec_ejercicio) || 0;
      const deprecBajas = Number(a.deprec_bajas) || 0;
      const deprecOtros = Number(a.deprec_otros) || 0;

      let metodoDepreciacion = '1';
      if (a.metodo === 'LINEA_RECTA') metodoDepreciacion = '1';
      else if (a.metodo === 'UNIDADES_PRODUCCION') metodoDepreciacion = '2';

      return [
        periodo,
        cuo,
        correlativo,
        a.codigo,
        '99',
        tipoActivo,
        (a.descripcion || '').trim().toUpperCase(),
        (a.marca || 'GENERICO').trim().toUpperCase(),
        (a.modelo || 'GENERICO').trim().toUpperCase(),
        (a.serie_placa || 'S/N').trim().toUpperCase(),
        saldoInicial.toFixed(2),
        adquisiciones.toFixed(2),
        mejoras.toFixed(2),
        retirosBajas.toFixed(2),
        otrosAjustes.toFixed(2),
        valorHistorico.toFixed(2),
        ajusteInflacion.toFixed(2),
        valorAjustado.toFixed(2),
        fechaAdq,
        fechaUso,
        metodoDepreciacion,
        tasaTrib.toFixed(2),
        deprecAcumAnt.toFixed(2),
        deprecEjec.toFixed(2),
        deprecBajas.toFixed(2),
        deprecOtros.toFixed(2)
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    return `LE${ruc}${periodoCorto}00070100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerActivosFijos,
    generarTXT71,
    nombreArchivoTXT
  };
}

module.exports = createPle71Service;
