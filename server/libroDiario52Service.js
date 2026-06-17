/**
 * LIBRO DIARIO FORMATO 5.2 — Servicio de Negocio
 * RS N° 234-2006/SUNAT · RS N° 286-2009/SUNAT
 * Aritmética entera (céntimos) · Transacciones atómicas SQLite
 */
const path = require('path');

function createLibroDiario52Service(db) {

  // ── Helpers ──
  const solesToCentimos = (soles) => Math.round((Number(soles) || 0) * 100);
  const centimosToSoles = (centimos) => (Number(centimos) || 0) / 100;
  const formatSoles = (centimos) => centimosToSoles(centimos).toFixed(2);

  const fechaToDD_MM_AAAA = (fecha) => {
    if (!fecha) return '';
    if (fecha.includes('/')) return fecha;
    const parts = fecha.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return fecha;
  };

  const fechaToPeriodo = (fecha) => {
    if (!fecha) return '';
    let y, m;
    if (fecha.includes('-')) { [y, m] = fecha.split('-'); }
    else if (fecha.includes('/')) { const p = fecha.split('/'); y = p[2]; m = p[1]; }
    else return '';
    return `${y}${m.padStart(2,'0')}00`;
  };

  // ── CUO Generation ──
  const generarCUO = (workspaceId, userId, periodo) => {
    const periodoCorto = periodo.substring(0, 6);
    const row = db.prepare(
      `SELECT ultimo_seq FROM diario_52_secuencia WHERE workspace_id=? AND user_id=? AND periodo=?`
    ).get(workspaceId, userId, periodo);

    let nextSeq;
    if (row) {
      nextSeq = row.ultimo_seq + 1;
      db.prepare(`UPDATE diario_52_secuencia SET ultimo_seq=? WHERE workspace_id=? AND user_id=? AND periodo=?`)
        .run(nextSeq, workspaceId, userId, periodo);
    } else {
      nextSeq = 1;
      db.prepare(`INSERT INTO diario_52_secuencia (workspace_id, user_id, periodo, ultimo_seq) VALUES (?,?,?,?)`)
        .run(workspaceId, userId, periodo, nextSeq);
    }
    return `${periodoCorto}-${String(nextSeq).padStart(5,'0')}`;
  };

  // ── Dato Estructurado (Campo 20) ──
  const construirDatoEstructurado = (codigoLibro, periodo, cuoRegistro, correlativo) => {
    return `${codigoLibro}&${periodo}&${cuoRegistro}&${correlativo}`;
  };

  // ── Obtener denominación de cuenta ──
  const getDenominacion = (codigoCuenta) => {
    const row = db.prepare(`SELECT description FROM plan_global WHERE cta=?`).get(codigoCuenta);
    return row ? row.description : codigoCuenta;
  };

  // ── Validar cuenta existe en plan ──
  const validarCuenta = (codigoCuenta) => {
    const row = db.prepare(`SELECT cta FROM plan_global WHERE cta=?`).get(codigoCuenta);
    return !!row;
  };

  // ── Verificar período abierto ──
  const isPeriodoAbierto = (workspaceId, userId, periodo) => {
    const periodoYM = periodo.substring(0, 4) + '-' + periodo.substring(4, 6);
    const row = db.prepare(
      `SELECT estado FROM accounting_periods WHERE workspace_id=? AND user_id=? AND periodo=? AND tipo='MENSUAL'`
    ).get(workspaceId, userId, periodoYM);
    if (!row) return true;
    return row.estado === 'ABIERTO';
  };

  // ── Registrar Asiento (Transacción Atómica) ──
  const registrarAsiento = (workspaceId, userId, lineas) => {
    if (!lineas || lineas.length === 0) throw new Error('No hay líneas para registrar');

    const periodo = lineas[0].periodo;
    if (!isPeriodoAbierto(workspaceId, userId, periodo)) {
      throw new Error(`El período ${periodo} está cerrado o bloqueado`);
    }

    // Validar partida doble
    let totalDebe = 0, totalHaber = 0;
    for (const l of lineas) {
      if (l.monto_debe > 0 && l.monto_haber > 0) {
        throw new Error(`Línea ${l.correlativo_asiento}: no puede tener DEBE y HABER simultáneamente`);
      }
      totalDebe += l.monto_debe;
      totalHaber += l.monto_haber;
    }
    if (totalDebe !== totalHaber) {
      throw new Error(`Asiento descuadrado: DEBE=${formatSoles(totalDebe)} ≠ HABER=${formatSoles(totalHaber)}`);
    }

    const ejercicio = parseInt(periodo.substring(0, 4));

    const insertStmt = db.prepare(`
      INSERT INTO libro_diario_52 (
        workspace_id, user_id, periodo, cuo, correlativo_asiento, fecha_operacion, glosa,
        ref_codigo_libro, ref_periodo, ref_cuo, codigo_cuenta, denominacion_cuenta,
        codigo_auxiliar, denominacion_auxiliar, centro_costos, moneda, tipo_cambio,
        fecha_tipo_cambio, monto_debe, monto_haber, indicador_operacion,
        dato_estructurado, estado, origen_modulo, asiento_id_origen, ejercicio
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const transaction = db.transaction((rows) => {
      for (const l of rows) {
        insertStmt.run(
          workspaceId, userId, l.periodo, l.cuo, l.correlativo_asiento,
          l.fecha_operacion, l.glosa, l.ref_codigo_libro || null, l.ref_periodo || null,
          l.ref_cuo || null, l.codigo_cuenta, l.denominacion_cuenta || getDenominacion(l.codigo_cuenta),
          l.codigo_auxiliar || null, l.denominacion_auxiliar || null, l.centro_costos || null,
          l.moneda || '01', l.tipo_cambio || 0, l.fecha_tipo_cambio || null,
          l.monto_debe, l.monto_haber, l.indicador_operacion || null,
          l.dato_estructurado || null, l.estado || '1',
          l.origen_modulo || 'MANUAL', l.asiento_id_origen || null, ejercicio
        );
      }
    });
    transaction(lineas);
    return { success: true, cuo: lineas[0].cuo, lineas: lineas.length };
  };

  // ── Generar Asiento desde Compra ──
  const generarAsientoDesdeCompra = (purchase, workspaceId, userId) => {
    const periodo = fechaToPeriodo(purchase.fecha);
    if (!periodo) throw new Error('Fecha de compra inválida');

    const cuo = generarCUO(workspaceId, userId, periodo);
    const fecha = fechaToDD_MM_AAAA(purchase.fecha);
    const glosa = (purchase.glosa || `POR COMPRA ${purchase.tipo_doc || ''} ${purchase.serie || ''}-${purchase.numero || ''}`).substring(0, 200);
    const cuoRegistro = purchase.registro || purchase.id;
    const lineas = [];
    let lineNum = 0;

    const biCentimos = solesToCentimos(purchase.bi);
    const igvCentimos = solesToCentimos(purchase.igv);
    const noGravadaCentimos = solesToCentimos(purchase.noGravada);
    const iscCentimos = solesToCentimos(purchase.isc);
    const totalCentimos = solesToCentimos(purchase.total);
    const ctaGasto = (purchase.ctaGasto || '6011').trim();
    const ctaAbono = (purchase.ctaAbono || '4212').trim();

    const baseLine = { periodo, cuo, fecha_operacion: fecha, glosa, moneda: '01', tipo_cambio: 0, estado: '1', origen_modulo: 'COMPRAS', asiento_id_origen: purchase.id };

    if (biCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaGasto, denominacion_cuenta: getDenominacion(ctaGasto), monto_debe: biCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (noGravadaCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaGasto, denominacion_cuenta: getDenominacion(ctaGasto), monto_debe: noGravadaCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (igvCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '40111', denominacion_cuenta: getDenominacion('40111') || 'IGV - CUENTA PROPIA', monto_debe: igvCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (iscCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '4012', denominacion_cuenta: getDenominacion('4012') || 'ISC', monto_debe: iscCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    // Haber: Cuentas por Pagar
    lineNum++;
    lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaAbono, denominacion_cuenta: getDenominacion(ctaAbono) || 'FACTURAS POR PAGAR', monto_debe: 0, monto_haber: totalCentimos, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });

    // Destino Clase 9 (si la cuenta es gasto Clase 6)
    const gastoCentimos = biCentimos + noGravadaCentimos;
    if (gastoCentimos > 0 && ctaGasto.startsWith('6')) {
      const acc = db.prepare(`SELECT amarreDebe, amarreHaber FROM plan_global WHERE cta=?`).get(ctaGasto);
      if (acc && acc.amarreDebe && acc.amarreHaber) {
        lineNum++;
        lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: acc.amarreDebe.trim(), denominacion_cuenta: getDenominacion(acc.amarreDebe.trim()), monto_debe: gastoCentimos, monto_haber: 0, glosa: 'POR EL DESTINO DEL GASTO' });
        lineNum++;
        lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: acc.amarreHaber.trim(), denominacion_cuenta: getDenominacion(acc.amarreHaber.trim()), monto_debe: 0, monto_haber: gastoCentimos, glosa: 'POR EL DESTINO DEL GASTO' });
      }
    }

    return registrarAsiento(workspaceId, userId, lineas);
  };

  // ── Generar Asiento desde Venta ──
  const generarAsientoDesdeVenta = (sale, workspaceId, userId) => {
    const periodo = fechaToPeriodo(sale.fecha);
    if (!periodo) throw new Error('Fecha de venta inválida');

    const cuo = generarCUO(workspaceId, userId, periodo);
    const fecha = fechaToDD_MM_AAAA(sale.fecha);
    const glosa = (sale.glosa || `POR VENTA ${sale.tipo_doc || ''} ${sale.serie || ''}-${sale.numero || ''}`).substring(0, 200);
    const cuoRegistro = sale.registro || sale.id;
    const lineas = [];
    let lineNum = 0;

    const totalCentimos = solesToCentimos(sale.total);
    const igvCentimos = solesToCentimos(sale.igv);
    const biCentimos = solesToCentimos(sale.bi);
    const noGravadaCentimos = solesToCentimos(sale.noGravada);
    const iscCentimos = solesToCentimos(sale.isc);
    const ctaCargo = (sale.ctaCargo || '1212').trim();
    const ctaIngreso = (sale.ctaIngreso || '70111').trim();

    const baseLine = { periodo, cuo, fecha_operacion: fecha, glosa, moneda: '01', tipo_cambio: 0, estado: '1', origen_modulo: 'VENTAS', asiento_id_origen: sale.id };

    // Debe: Cuentas por Cobrar
    if (totalCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaCargo, denominacion_cuenta: getDenominacion(ctaCargo) || 'FACTURAS POR COBRAR', monto_debe: totalCentimos, monto_haber: 0, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    // Haber: IGV
    if (igvCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '40111', denominacion_cuenta: getDenominacion('40111') || 'IGV - CUENTA PROPIA', monto_debe: 0, monto_haber: igvCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    // Haber: Ingresos
    if (biCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaIngreso, denominacion_cuenta: getDenominacion(ctaIngreso) || 'VENTAS', monto_debe: 0, monto_haber: biCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (noGravadaCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaIngreso, denominacion_cuenta: getDenominacion(ctaIngreso), monto_debe: 0, monto_haber: noGravadaCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (iscCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '4012', denominacion_cuenta: getDenominacion('4012') || 'ISC', monto_debe: 0, monto_haber: iscCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    return registrarAsiento(workspaceId, userId, lineas);
  };

  // ── Generar Masivo (Todas las compras/ventas del período) ──
  const generarMasivo = (workspaceId, userId, periodo) => {
    const periodoYM = periodo.substring(0, 4) + '-' + periodo.substring(4, 6);

    // Limpiar asientos automáticos previos del período
    db.prepare(`DELETE FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND periodo=? AND origen_modulo IN ('COMPRAS','VENTAS')`)
      .run(workspaceId, userId, periodo);

    // Reset secuencia
    db.prepare(`DELETE FROM diario_52_secuencia WHERE workspace_id=? AND user_id=? AND periodo=?`)
      .run(workspaceId, userId, periodo);

    const purchases = db.prepare(`SELECT * FROM purchases WHERE workspace_id=? AND user_id=? AND fecha LIKE ?`)
      .all(workspaceId, userId, `${periodoYM}%`);
    const sales = db.prepare(`SELECT * FROM sales WHERE workspace_id=? AND user_id=? AND fecha LIKE ?`)
      .all(workspaceId, userId, `${periodoYM}%`);

    let countCompras = 0, countVentas = 0, errores = [];

    for (const p of purchases) {
      try { generarAsientoDesdeCompra(p, workspaceId, userId); countCompras++; }
      catch (e) { errores.push(`Compra ${p.serie}-${p.numero}: ${e.message}`); }
    }
    for (const s of sales) {
      try { generarAsientoDesdeVenta(s, workspaceId, userId); countVentas++; }
      catch (e) { errores.push(`Venta ${s.serie}-${s.numero}: ${e.message}`); }
    }

    return { success: true, compras: countCompras, ventas: countVentas, errores };
  };

  // ── Corrección de Asientos (Estados 8/9) ──
  const corregirAsiento = (workspaceId, userId, cuoOriginal, tipo, nuevasLineas) => {
    if (tipo !== 8 && tipo !== 9) throw new Error('Tipo de corrección debe ser 8 (omisión) o 9 (error)');

    if (tipo === 9) {
      db.prepare(`UPDATE libro_diario_52 SET estado='9' WHERE workspace_id=? AND user_id=? AND cuo=?`)
        .run(workspaceId, userId, cuoOriginal);
    }

    if (nuevasLineas && nuevasLineas.length > 0) {
      for (const l of nuevasLineas) { l.estado = String(tipo); }
      return registrarAsiento(workspaceId, userId, nuevasLineas);
    }
    return { success: true };
  };

  // ── Obtener Asientos del Período ──
  const obtenerAsientosPeriodo = (workspaceId, userId, periodo) => {
    return db.prepare(
      `SELECT * FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND periodo=? ORDER BY cuo, correlativo_asiento`
    ).all(workspaceId, userId, periodo);
  };

  // ── Validar Balance del Período ──
  const validarBalancePeriodo = (workspaceId, userId, periodo) => {
    const descuadrados = db.prepare(
      `SELECT * FROM v_balance_asientos_52 WHERE workspace_id=? AND user_id=? AND periodo=? AND estado_partida_doble='DESCUADRADO'`
    ).all(workspaceId, userId, periodo);

    const totales = db.prepare(
      `SELECT COALESCE(SUM(monto_debe),0) AS total_debe, COALESCE(SUM(monto_haber),0) AS total_haber FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND periodo=? AND estado IN ('1','8')`
    ).get(workspaceId, userId, periodo);

    return {
      valido: descuadrados.length === 0,
      descuadrados,
      totalDebe: totales?.total_debe || 0,
      totalHaber: totales?.total_haber || 0,
      cuadrado: (totales?.total_debe || 0) === (totales?.total_haber || 0)
    };
  };

  // ── Generar TXT PLE Formato 5.2 ──
  const generarTXT52 = (workspaceId, userId, periodo) => {
    const balance = validarBalancePeriodo(workspaceId, userId, periodo);
    if (!balance.valido) throw new Error(`Existen ${balance.descuadrados.length} asiento(s) descuadrados. Corrija antes de exportar.`);

    const asientos = obtenerAsientosPeriodo(workspaceId, userId, periodo);
    if (asientos.length === 0) throw new Error('No hay asientos para el período indicado');

    const lines = asientos.map(a => [
      a.periodo,
      a.cuo,
      a.correlativo_asiento,
      a.fecha_operacion,
      a.glosa,
      a.ref_codigo_libro || '',
      a.ref_periodo || '',
      a.ref_cuo || '',
      a.codigo_cuenta,
      a.denominacion_cuenta,
      a.codigo_auxiliar || '',
      a.denominacion_auxiliar || '',
      a.centro_costos || '',
      a.moneda || '',
      a.tipo_cambio ? Number(a.tipo_cambio).toFixed(3) : '',
      a.fecha_tipo_cambio || '',
      formatSoles(a.monto_debe),
      formatSoles(a.monto_haber),
      a.indicador_operacion || '',
      a.dato_estructurado || '',
      a.estado
    ].join('|'));

    return lines.join('\r\n');
  };

  // ── Nombre del archivo TXT ──
  const nombreArchivoTXT = (ruc, periodo) => {
    const periodoCorto = periodo.substring(0, 6);
    return `LE${ruc}${periodoCorto}050200001.txt`;
  };

  // ── Generar TXT Formato 5.4 (Plan Contable) ──
  const generarTXT54 = (workspaceId, userId, periodo) => {
    const plan = db.prepare(`SELECT * FROM plan_global ORDER BY cta`).all();
    const ejercicio = periodo.substring(0, 4);
    const lines = plan.map(p => [
      `${ejercicio}0100`,
      p.cta,
      p.description || '',
      p.cta.length <= 2 ? '01' : p.cta.length <= 3 ? '02' : p.cta.length <= 4 ? '03' : '04',
      '1'
    ].join('|'));
    return lines.join('\r\n');
  };

  const nombreArchivoTXT54 = (ruc, periodo) => {
    const periodoCorto = periodo.substring(0, 6);
    return `LE${ruc}${periodoCorto}050400001.txt`;
  };

  // ── Reporte Mayor por Cuenta ──
  const reporteMayor = (workspaceId, userId, cuenta, desde, hasta) => {
    return db.prepare(
      `SELECT * FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND codigo_cuenta=? AND periodo>=? AND periodo<=? AND estado IN ('1','8') ORDER BY periodo, cuo`
    ).all(workspaceId, userId, cuenta, desde, hasta);
  };

  return {
    generarCUO, registrarAsiento, generarAsientoDesdeCompra, generarAsientoDesdeVenta,
    generarMasivo, corregirAsiento, obtenerAsientosPeriodo, validarBalancePeriodo,
    generarTXT52, generarTXT54, nombreArchivoTXT, nombreArchivoTXT54, reporteMayor,
    solesToCentimos, centimosToSoles, formatSoles, fechaToPeriodo
  };
}

module.exports = createLibroDiario52Service;
