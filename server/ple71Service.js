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

  const obtenerActivosFijos = (workspaceId, userId) => {
    // Para activos fijos se listan todos los activos de la empresa actual
    const rows = db.prepare(`
      SELECT * FROM fixed_assets 
      WHERE workspace_id = ? AND user_id = ?
      ORDER BY codigo
    `).all(workspaceId, userId);

    return rows;
  };

  const generarTXT71 = (workspaceId, userId, periodo) => {
    const rows = obtenerActivosFijos(workspaceId, userId);
    
    if (rows.length === 0) {
      // Archivo vacío aceptado por SUNAT si no hay activos
      return '';
    }

    const lines = rows.map((a, index) => {
      const fechaAdq = fechaToDD_MM_AAAA(a.fecha_adquisicion);
      const fechaUso = fechaToDD_MM_AAAA(a.fecha_uso) || fechaAdq;
      
      const correlativo = `M${String(index + 1).padStart(4, '0')}`;
      const cuo = `${periodo.substring(0, 6)}-${String(index + 1).padStart(5, '0')}`;

      // Determinar Tipo de Activo según la Tabla 18
      // 331 -> '01' (Edificios), 333 -> '03' (Maquinaria), 334 -> '04' (Vehículos), 335 -> '05' (Muebles), 336 -> '06' (Cómputo)
      let tipoActivo = '99'; // Otros por defecto
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

      // Depreciación Tributaria (la que se informa a SUNAT)
      const tasaTrib = Number(a.tasa_depreciacion_tributaria) || Number(a.tasa_depreciacion) || 0;
      const deprecAcumAnt = Number(a.deprec_acum_anterior_tributaria) || Number(a.deprec_acum_anterior) || 0;
      const deprecEjec = Number(a.deprec_ejercicio_tributaria) || Number(a.deprec_ejercicio) || 0;
      const deprecBajas = Number(a.deprec_bajas) || 0;
      const deprecOtros = Number(a.deprec_otros) || 0;
      const deprecAcumTotal = deprecAcumAnt + deprecEjec - deprecBajas + deprecOtros;

      let metodoDepreciacion = '1'; // Línea Recta por defecto
      if (a.metodo === 'LINEA_RECTA') metodoDepreciacion = '1';
      else if (a.metodo === 'UNIDADES_PRODUCCION') metodoDepreciacion = '2';

      return [
        periodo, // 1. Periodo (YYYYMM00)
        cuo, // 2. CUO
        correlativo, // 3. Correlativo asiento
        a.codigo, // 4. Código del activo fijo
        '99', // 5. Código catálogo (99 = Otros)
        tipoActivo, // 6. Tipo de activo (Tabla 18)
        (a.descripcion || '').trim().toUpperCase(), // 7. Descripción
        (a.marca || 'GENERICO').trim().toUpperCase(), // 8. Marca
        (a.modelo || 'GENERICO').trim().toUpperCase(), // 9. Modelo
        (a.serie_placa || 'S/N').trim().toUpperCase(), // 10. Serie / Placa
        saldoInicial.toFixed(2), // 11. Saldo Inicial
        adquisiciones.toFixed(2), // 12. Adquisiciones del ejercicio
        mejoras.toFixed(2), // 13. Mejoras
        retirosBajas.toFixed(2), // 14. Retiros / Bajas
        otrosAjustes.toFixed(2), // 15. Otros ajustes
        valorHistorico.toFixed(2), // 16. Valor Histórico
        ajusteInflacion.toFixed(2), // 17. Ajuste por Inflación
        valorAjustado.toFixed(2), // 18. Valor Ajustado
        fechaAdq, // 19. Fecha Adquisición
        fechaUso, // 20. Fecha Uso
        metodoDepreciacion, // 21. Método de Depreciación (Tabla 20)
        tasaTrib.toFixed(2), // 22. Tasa de Depreciación %
        deprecAcumAnt.toFixed(2), // 23. Depreciación Acumulada Ejercicios Anteriores
        deprecEjec.toFixed(2), // 24. Depreciación Ejercicio
        deprecBajas.toFixed(2), // 25. Depreciación Bajas
        deprecOtros.toFixed(2), // 26. Depreciación Otros
        deprecAcumTotal.toFixed(2), // 27. Depreciación Acumulada Total
        '1' // 28. Estado de la operación (1 = Activo)
      ].join('|') + '|';
    });

    return lines.join('\r\n');
  };

  const nombreArchivoTXT = (ruc, periodo, tieneDatos) => {
    const periodoCorto = periodo.substring(0, 6);
    const indicadorContenido = tieneDatos ? '1' : '0';
    // Estructura SUNAT PLE 7.1: LE[RUC][AÑO][MES]00070100001[CONT][MONEDA]1.txt
    return `LE${ruc}${periodoCorto}00070100001${indicadorContenido}11.txt`;
  };

  return {
    obtenerActivosFijos,
    generarTXT71,
    nombreArchivoTXT
  };
}

module.exports = createPle71Service;
