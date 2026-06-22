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
  const getDenominacion = (codigoCuenta, userId) => {
    let row = db.prepare(`SELECT description FROM plan_global WHERE cta=? AND user_id=?`).get(codigoCuenta, userId);
    if (!row) {
      row = db.prepare(`SELECT description FROM plan_global WHERE cta=? AND user_id='system'`).get(codigoCuenta);
    }
    return row ? row.description : codigoCuenta;
  };

  // ── Validar cuenta existe en plan ──
  const validarCuenta = (codigoCuenta, userId) => {
    let row = db.prepare(`SELECT cta, div FROM plan_global WHERE cta=? AND user_id=?`).get(codigoCuenta, userId);
    if (!row) {
      row = db.prepare(`SELECT cta, div FROM plan_global WHERE cta=? AND user_id='system'`).get(codigoCuenta);
    }
    if (!row) return false;
    return row.div !== 0;
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

  const resolverMapeoTabla9 = (codigoCuenta, montoDebe, montoHaber) => {
    if (codigoCuenta.startsWith('4011')) {
      return {
        columna: montoDebe > 0 ? '4011D' : '4011C',
        grupo: 'PASIVO'
      };
    }
    if (codigoCuenta.startsWith('4017')) {
      return {
        columna: montoDebe > 0 ? '4017D' : '4017C',
        grupo: 'PASIVO'
      };
    }
    const row = db.prepare(`
      SELECT columna_tabla9, grupo
      FROM mapa_pcge_tabla9
      WHERE ? LIKE (codigo_cuenta_prefijo || '%')
      ORDER BY length(codigo_cuenta_prefijo) DESC
      LIMIT 1
    `).get(codigoCuenta);

    if (row) {
      return { columna: row.columna_tabla9, grupo: row.grupo };
    }
    return { columna: '38', grupo: 'ACTIVO' }; // Default fallback
  };

  // ── Registrar Asiento (Transacción Atómica) ──
  const registrarAsiento = (workspaceId, userId, lineas) => {
    if (!lineas || lineas.length === 0) throw new Error('No hay líneas para registrar');

    const periodo = lineas[0].periodo;
    if (!isPeriodoAbierto(workspaceId, userId, periodo)) {
      throw new Error(`El período ${periodo} está cerrado o bloqueado`);
    }

    // Validar partida doble y validez de las cuentas (no agrupadoras)
    let totalDebe = 0, totalHaber = 0;
    for (const l of lineas) {
      if (l.monto_debe > 0 && l.monto_haber > 0) {
        throw new Error(`Línea ${l.correlativo_asiento}: no puede tener DEBE y HABER simultáneamente`);
      }
      if (!validarCuenta(l.codigo_cuenta, userId)) {
        throw new Error(`Línea ${l.correlativo_asiento}: la cuenta ${l.codigo_cuenta} no existe o es una cuenta de cabecera/agrupadora (no permite movimientos).`);
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
        dato_estructurado, estado, origen_modulo, asiento_id_origen, ejercicio,
        columna_tabla9, grupo_tabla9
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const transaction = db.transaction((rows) => {
      for (const l of rows) {
        const mapping = resolverMapeoTabla9(l.codigo_cuenta, l.monto_debe, l.monto_haber);
        insertStmt.run(
          workspaceId, userId, l.periodo, l.cuo, l.correlativo_asiento,
          l.fecha_operacion, l.glosa, l.ref_codigo_libro || null, l.ref_periodo || null,
          l.ref_cuo || null, l.codigo_cuenta, l.denominacion_cuenta || getDenominacion(l.codigo_cuenta, userId),
          l.codigo_auxiliar || null, l.denominacion_auxiliar || null, l.centro_costos || null,
          l.moneda || '01', l.tipo_cambio || 0, l.fecha_tipo_cambio || null,
          l.monto_debe, l.monto_haber, l.indicador_operacion || null,
          l.dato_estructurado || null, l.estado || '1',
          l.origen_modulo || 'MANUAL', l.asiento_id_origen || null, ejercicio,
          mapping.columna, mapping.grupo
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
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaGasto, denominacion_cuenta: getDenominacion(ctaGasto, userId), monto_debe: biCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (noGravadaCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaGasto, denominacion_cuenta: getDenominacion(ctaGasto, userId), monto_debe: noGravadaCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (igvCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '40111', denominacion_cuenta: getDenominacion('40111', userId) || 'IGV - CUENTA PROPIA', monto_debe: igvCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (iscCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '4012', denominacion_cuenta: getDenominacion('4012', userId) || 'ISC', monto_debe: iscCentimos, monto_haber: 0, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    // Haber: Cuentas por Pagar
    lineNum++;
    lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaAbono, denominacion_cuenta: getDenominacion(ctaAbono, userId) || 'FACTURAS POR PAGAR', monto_debe: 0, monto_haber: totalCentimos, ref_codigo_libro: '08', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('080100', periodo, cuoRegistro, `M${lineNum}`) });

    // Destino Clase 9 (si la cuenta es gasto Clase 6)
    const gastoCentimos = biCentimos + noGravadaCentimos;
    if (gastoCentimos > 0 && ctaGasto.startsWith('6')) {
      let acc = db.prepare(`SELECT cta_cc1, pct_cc1, cta_cc2, pct_cc2, cta_cc3, pct_cc3, destino_haber FROM plan_global WHERE cta=? AND user_id=?`).get(ctaGasto, userId);
      if (!acc) {
        acc = db.prepare(`SELECT cta_cc1, pct_cc1, cta_cc2, pct_cc2, cta_cc3, pct_cc3, destino_haber FROM plan_global WHERE cta=? AND user_id='system'`).get(ctaGasto);
      }
      if (acc && acc.destino_haber && acc.destino_haber.trim() !== '') {
        const destHaber = acc.destino_haber.trim();
        
        // Determinar centros de costo activos
        const ccList = [];
        if (acc.cta_cc1 && acc.cta_cc1.trim() !== '' && Number(acc.pct_cc1) > 0) {
          ccList.push({ cta: acc.cta_cc1.trim(), pct: Number(acc.pct_cc1) });
        }
        if (acc.cta_cc2 && acc.cta_cc2.trim() !== '' && Number(acc.pct_cc2) > 0) {
          ccList.push({ cta: acc.cta_cc2.trim(), pct: Number(acc.pct_cc2) });
        }
        if (acc.cta_cc3 && acc.cta_cc3.trim() !== '' && Number(acc.pct_cc3) > 0) {
          ccList.push({ cta: acc.cta_cc3.trim(), pct: Number(acc.pct_cc3) });
        }

        if (ccList.length > 0) {
          // Generar los cargos (Debe) prorrateados
          let totalAsignado = 0;
          const lineasCc = [];
          
          for (let i = 0; i < ccList.length; i++) {
            const cc = ccList[i];
            let montoCc = Math.round(gastoCentimos * (cc.pct / 100.0));
            
            // Si es el último, absorber diferencia para cuadrar exacto los céntimos
            if (i === ccList.length - 1) {
              montoCc = gastoCentimos - totalAsignado;
            } else {
              totalAsignado += montoCc;
            }

            if (montoCc > 0) {
              lineasCc.push({
                ...baseLine,
                codigo_cuenta: cc.cta,
                denominacion_cuenta: getDenominacion(cc.cta, userId),
                monto_debe: montoCc,
                monto_haber: 0,
                glosa: 'POR EL DESTINO DEL GASTO'
              });
            }
          }

          // Solo registrar destinos si se asignó al menos algo
          if (lineasCc.length > 0) {
            // Añadir los Debe al listado de líneas
            for (const lc of lineasCc) {
              lineNum++;
              lineas.push({ ...lc, correlativo_asiento: `M${lineNum}` });
            }

            // Añadir el abono (Haber) a la cuenta destino_haber (100% del gasto)
            lineNum++;
            lineas.push({
              ...baseLine,
              correlativo_asiento: `M${lineNum}`,
              codigo_cuenta: destHaber,
              denominacion_cuenta: getDenominacion(destHaber, userId),
              monto_debe: 0,
              monto_haber: gastoCentimos,
              glosa: 'POR EL DESTINO DEL GASTO'
            });
          }
        }
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
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaCargo, denominacion_cuenta: getDenominacion(ctaCargo, userId) || 'FACTURAS POR COBRAR', monto_debe: totalCentimos, monto_haber: 0, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    // Haber: IGV
    if (igvCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '40111', denominacion_cuenta: getDenominacion('40111', userId) || 'IGV - CUENTA PROPIA', monto_debe: 0, monto_haber: igvCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }

    // Haber: Ingresos
    if (biCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaIngreso, denominacion_cuenta: getDenominacion(ctaIngreso, userId) || 'VENTAS', monto_debe: 0, monto_haber: biCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (noGravadaCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: ctaIngreso, denominacion_cuenta: getDenominacion(ctaIngreso, userId), monto_debe: 0, monto_haber: noGravadaCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
    }
    if (iscCentimos > 0) {
      lineNum++;
      lineas.push({ ...baseLine, correlativo_asiento: `M${lineNum}`, codigo_cuenta: '4012', denominacion_cuenta: getDenominacion('4012', userId) || 'ISC', monto_debe: 0, monto_haber: iscCentimos, ref_codigo_libro: '14', ref_periodo: periodo, ref_cuo: cuoRegistro, dato_estructurado: construirDatoEstructurado('140100', periodo, cuoRegistro, `M${lineNum}`) });
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

  // ── Obtener Formato Físico (Pivote Tabla 9 PCGE) ──
  const obtenerFormatoFisico = (workspaceId, userId, periodo) => {
    const lines = db.prepare(`
      SELECT * FROM libro_diario_52
      WHERE workspace_id = ? AND user_id = ? AND periodo = ? AND estado IN ('1','8')
      ORDER BY cuo, correlativo_asiento
    `).all(workspaceId, userId, periodo);

    const groups = {};
    for (const l of lines) {
      if (!groups[l.cuo]) groups[l.cuo] = [];
      groups[l.cuo].push(l);
    }

    const rows = [];
    for (const cuo of Object.keys(groups)) {
      const g = groups[cuo];
      const first = g[0];
      const row = {
        periodo: first.periodo,
        cuo: first.cuo,
        fecha: fechaToDD_MM_AAAA(first.fecha_operacion),
        glosa: first.glosa,
        car: first.dato_estructurado || '',
        // ACTIVO
        c10_d: 0, c10_h: 0,
        c12_d: 0, c12_h: 0,
        c16_d: 0, c16_h: 0,
        c20_d: 0, c20_h: 0,
        c21_d: 0, c21_h: 0,
        c33_d: 0, c33_h: 0,
        c34_d: 0, c34_h: 0,
        c38_d: 0, c38_h: 0,
        c39_d: 0, c39_h: 0,
        // PASIVO
        c4011D: 0, c4011C: 0,
        c4017D: 0, c4017C: 0,
        c402_d: 0, c402_h: 0,
        c42_d: 0, c42_h: 0,
        c46_d: 0, c46_h: 0,
        // PATRIMONIO
        c50_d: 0, c50_h: 0,
        c58_d: 0, c58_h: 0,
        c59_d: 0, c59_h: 0,
        // GASTOS
        c60_d: 0, c60_h: 0,
        c61_d: 0, c61_h: 0,
        c62_d: 0, c62_h: 0,
        c63_d: 0, c63_h: 0,
        c65_d: 0, c65_h: 0,
        c66_d: 0, c66_h: 0,
        c67_d: 0, c67_h: 0,
        c68_d: 0, c68_h: 0,
        c69_d: 0, c69_h: 0,
        c96_d: 0, c96_h: 0,
        c97_d: 0, c97_h: 0,
        // INGRESOS
        c70_d: 0, c70_h: 0,
        c75_d: 0, c75_h: 0,
        c76_d: 0, c76_h: 0,
        c77_d: 0, c77_h: 0,
        c79_d: 0, c79_h: 0,
      };

      for (const line of g) {
        const col = line.columna_tabla9;
        if (!col) continue;

        if (col === '4011D' || col === '4011C' || col === '4017D' || col === '4017C') {
          row[col] += (line.monto_debe + line.monto_haber) / 100;
        } else {
          const keyD = `c${col}_d`;
          const keyH = `c${col}_h`;
          if (keyD in row) row[keyD] += line.monto_debe / 100;
          if (keyH in row) row[keyH] += line.monto_haber / 100;
        }
      }
      rows.push(row);
    }

    return rows;
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
    const plan = db.prepare(`SELECT * FROM plan_global WHERE user_id=? ORDER BY cta`).all(userId);
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
    obtenerFormatoFisico, solesToCentimos, centimosToSoles, formatSoles, fechaToPeriodo
  };
}

module.exports = createLibroDiario52Service;
