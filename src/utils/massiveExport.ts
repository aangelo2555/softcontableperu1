import { exportMultipleSheets, type SheetData, type ColumnDef } from './excelExport';
import type { AppState } from '../store';
import { calculateDeferredTaxSchedule } from '../engine/deferredTax';
import { generateNotesTemplates } from '../engine/notesGenerator';
import { calcularObligacionesContables } from './tributarioRules';
import { webApiBridge } from '../services/apiBridge';

// ─── Helper para obtener saldo por cuenta ───
function getAccountBalances(journal: AppState['journal']) {
  const balances: Record<string, { debe: number; haber: number }> = {};
  journal.filter(e => e.cta.trim().toUpperCase() !== 'GLOSA').forEach(e => {
    if (!balances[e.cta]) balances[e.cta] = { debe: 0, haber: 0 };
    balances[e.cta].debe += e.debe;
    balances[e.cta].haber += e.haber;
  });
  return balances;
}

function getSum(balances: Record<string, { debe: number; haber: number }>, prefixes: string[]) {
  return Object.entries(balances).reduce((sum, [cta, bal]) => {
    if (prefixes.some(p => cta.startsWith(p))) return sum + (bal.debe - bal.haber);
    return sum;
  }, 0);
}

/**
 * Generates a massive workbook with all accounting sheets from the store
 */
export async function generateMassiveWorkbook(state: AppState) {
  const { currentCompany, plan, balanceInicial, purchases, sales, honorarios, journal, asientos, fixedAssets, employees, products, inventoryMovements } = state;

  const companyInfo = {
    ruc: currentCompany?.ruc || '',
    name: currentCompany?.name || 'EMPRESA',
    period: currentCompany?.period || String(new Date().getFullYear()),
  };

  const r = currentCompany?.regimenTributario || 'RG';
  const s = currentCompany?.businessType || 'COMERCIAL';
  const i = Number(currentCompany?.annualIncomeUIT || 0);
  const valorUIT = 5500.00;
  const ingresosSoles = i * valorUIT;
  const obligations = calcularObligacionesContables(r, s, ingresosSoles, valorUIT);

  let ld52Entries: any[] = [];
  if (obligations.libroDiarioSimplificado) {
    const yearStr = companyInfo.period.substring(0, 4);
    const monthPromises = Array.from({ length: 12 }, async (_, idx) => {
      const monthStr = String(idx + 1).padStart(2, '0');
      const periodo = `${yearStr}${monthStr}00`;
      try {
        const res = await webApiBridge.ld52GetAsientos(companyInfo.ruc, periodo);
        if (res && res.success && Array.isArray(res.data)) {
          return res.data;
        }
      } catch (err) {
        console.warn(`[MassiveExport] Error loading LD 5.2 entries for period ${periodo}:`, err);
      }
      return [];
    });
    const results = await Promise.all(monthPromises);
    ld52Entries = results.flat();
  }

  const sheets: SheetData[] = [];

  // ═══ 1. PLAN CONTABLE ═══
  sheets.push({
    sheetName: '1. Plan Contable',
    title: 'PLAN CONTABLE GENERAL EMPRESARIAL',
    columns: [
      { header: 'CÓDIGO', key: 'cta', width: 12, alignment: 'center' },
      { header: 'DENOMINACIÓN', key: 'description', width: 50 },
      { header: 'TIPO', key: 'type', width: 12, alignment: 'center' },
      { header: 'AMARRE DEBE', key: 'amarreDebe', width: 14, alignment: 'center' },
      { header: 'AMARRE HABER', key: 'amarreHaber', width: 14, alignment: 'center' },
    ],
    rows: plan.map(a => ({ cta: a.cta, description: a.description, type: a.type, amarreDebe: a.amarreDebe || '', amarreHaber: a.amarreHaber || '' })),
    companyInfo,
  });

  // ═══ 2. BALANCE INICIAL ═══
  if (obligations.libroInventariosBalances && balanceInicial && balanceInicial.length > 0) {
    const biTotalDebe = balanceInicial.reduce((s, b) => s + (b.debe || 0), 0);
    const biTotalHaber = balanceInicial.reduce((s, b) => s + (b.haber || 0), 0);
    sheets.push({
      sheetName: '2. Balance Inicial',
      title: 'BALANCE INICIAL',
      columns: [
        { header: 'CUENTA', key: 'cta', width: 12, alignment: 'center' },
        { header: 'DESCRIPCIÓN', key: 'descripcion', width: 45 },
        { header: 'DEBE', key: 'debe', width: 18, style: 'currency', alignment: 'right' },
        { header: 'HABER', key: 'haber', width: 18, style: 'currency', alignment: 'right' },
      ],
      rows: balanceInicial.map(b => ({ cta: b.cta, descripcion: (b as any).desc || (b as any).descripcion || '', debe: b.debe || 0, haber: b.haber || 0 })),
      totals: { cta: '', descripcion: 'TOTALES', debe: biTotalDebe, haber: biTotalHaber },
      companyInfo,
    });
  }

  // ═══ 3. REGISTRO DE COMPRAS ═══
  const localPurchases = purchases.filter(p => p.estado_sire !== 'Propuesta');
  if (obligations.registroCompras && localPurchases.length > 0) {
    const pTotalBI = localPurchases.reduce((s, p) => s + p.bi, 0);
    const pTotalIGV = localPurchases.reduce((s, p) => s + p.igv, 0);
    const pTotal = localPurchases.reduce((s, p) => s + p.total, 0);
    sheets.push({
      sheetName: '3. Reg. Compras',
      title: 'REGISTRO DE COMPRAS',
      columns: [
        { header: 'N°', key: 'registro', width: 22, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'T.DOC', key: 'tipo_doc', width: 8, alignment: 'center' },
        { header: 'SERIE', key: 'serie', width: 8, alignment: 'center' },
        { header: 'NÚMERO', key: 'numero', width: 12, alignment: 'center' },
        { header: 'RUC/DNI', key: 'doc_num', width: 14 },
        { header: 'PROVEEDOR', key: 'nombre', width: 35 },
        { header: 'BASE IMP.', key: 'bi', width: 14, style: 'currency' },
        { header: 'IGV', key: 'igv', width: 12, style: 'currency' },
        { header: 'TOTAL', key: 'total', width: 14, style: 'currency' },
      ],
      rows: localPurchases,
      totals: { registro: '', fecha: '', tipo_doc: '', serie: '', numero: '', doc_num: '', nombre: 'TOTALES', bi: pTotalBI, igv: pTotalIGV, total: pTotal },
      companyInfo,
    });
  }

  // ═══ 4. REGISTRO DE VENTAS ═══
  const localSales = sales.filter(s => s.estado_sire !== 'Propuesta');
  if (obligations.registroVentas && localSales.length > 0) {
    const sTotalBI = localSales.reduce((s, v) => s + v.bi, 0);
    const sTotalIGV = localSales.reduce((s, v) => s + v.igv, 0);
    const sTotal = localSales.reduce((s, v) => s + v.total, 0);
    sheets.push({
      sheetName: '4. Reg. Ventas',
      title: 'REGISTRO DE VENTAS',
      columns: [
        { header: 'N°', key: 'registro', width: 22, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'T.DOC', key: 'tipo_doc', width: 8, alignment: 'center' },
        { header: 'SERIE', key: 'serie', width: 8, alignment: 'center' },
        { header: 'NÚMERO', key: 'numero', width: 12, alignment: 'center' },
        { header: 'RUC/DNI', key: 'doc_num', width: 14 },
        { header: 'CLIENTE', key: 'nombre', width: 35 },
        { header: 'BASE IMP.', key: 'bi', width: 14, style: 'currency' },
        { header: 'IGV', key: 'igv', width: 12, style: 'currency' },
        { header: 'TOTAL', key: 'total', width: 14, style: 'currency' },
      ],
      rows: localSales,
      totals: { registro: '', fecha: '', tipo_doc: '', serie: '', numero: '', doc_num: '', nombre: 'TOTALES', bi: sTotalBI, igv: sTotalIGV, total: sTotal },
      companyInfo,
    });
  }

  // ═══ 5. HONORARIOS ═══
  if (obligations.registroCompras && honorarios.length > 0) {
    const hTotal = honorarios.reduce((s, h) => s + h.total, 0);
    sheets.push({
      sheetName: '5. Honorarios',
      title: 'REGISTRO DE HONORARIOS',
      columns: [
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'T.DOC', key: 'tipo_doc', width: 8, alignment: 'center' },
        { header: 'SERIE', key: 'serie', width: 8, alignment: 'center' },
        { header: 'NÚMERO', key: 'numero', width: 12, alignment: 'center' },
        { header: 'RUC/DNI', key: 'doc_num', width: 14 },
        { header: 'EMISOR', key: 'nombre', width: 35 },
        { header: 'TOTAL', key: 'total', width: 14, style: 'currency' },
      ],
      rows: honorarios,
      totals: { fecha: '', tipo_doc: '', serie: '', numero: '', doc_num: '', nombre: 'TOTALES', total: hTotal },
      companyInfo,
    });
  }

  // ═══ 6. LIBRO DIARIO ═══
  const filteredJournal = journal.filter(e => e.cta.trim().toUpperCase() !== 'GLOSA');
  if (obligations.libroDiarioCompleto && filteredJournal.length > 0) {
    const jTotalDebe = filteredJournal.reduce((s, e) => s + e.debe, 0);
    const jTotalHaber = filteredJournal.reduce((s, e) => s + e.haber, 0);
    sheets.push({
      sheetName: '6. Libro Diario',
      title: 'LIBRO DIARIO - FORMATO 5.1',
      columns: [
        { header: 'ASIENTO', key: 'asiento', width: 24, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'GLOSA', key: 'glosa', width: 40 },
        { header: 'CUENTA', key: 'cta', width: 10, alignment: 'center' },
        { header: 'DESCRIPCIÓN', key: 'desc', width: 30 },
        { header: 'DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER', key: 'haber', width: 16, style: 'currency' },
      ],
      rows: filteredJournal,
      totals: { asiento: '', fecha: '', glosa: '', cta: '', desc: 'TOTALES', debe: jTotalDebe, haber: jTotalHaber },
      companyInfo,
    });
  }

  // ═══ 6. LIBRO DIARIO 5.2 ═══
  if (obligations.libroDiarioSimplificado && ld52Entries.length > 0) {
    const ld52TotalDebe = ld52Entries.reduce((s, e) => s + (e.monto_debe || 0), 0) / 100;
    const ld52TotalHaber = ld52Entries.reduce((s, e) => s + (e.monto_haber || 0), 0) / 100;
    sheets.push({
      sheetName: '6. Libro Diario 5.2',
      title: 'LIBRO DIARIO DE FORMATO SIMPLIFICADO - FORMATO 5.2',
      columns: [
        { header: 'PERIODO', key: 'periodo', width: 12, alignment: 'center' },
        { header: 'CUO', key: 'cuo', width: 14, alignment: 'center' },
        { header: 'CORRELATIVO', key: 'correlativo', width: 14, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'GLOSA', key: 'glosa', width: 40 },
        { header: 'CUENTA', key: 'cuenta', width: 10, alignment: 'center' },
        { header: 'DENOMINACIÓN', key: 'denominacion', width: 30 },
        { header: 'DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER', key: 'haber', width: 16, style: 'currency' },
        { header: 'ORIGEN', key: 'origen', width: 12, alignment: 'center' },
        { header: 'ESTADO', key: 'estado', width: 8, alignment: 'center' },
      ],
      rows: ld52Entries.map(e => ({
        periodo: e.periodo,
        cuo: e.cuo,
        correlativo: e.correlativo_asiento,
        fecha: e.fecha_operacion,
        glosa: e.glosa,
        cuenta: e.codigo_cuenta,
        denominacion: e.denominacion_cuenta,
        debe: (e.monto_debe || 0) / 100,
        haber: (e.monto_haber || 0) / 100,
        origen: e.origen_modulo,
        estado: e.estado
      })),
      totals: {
        periodo: '', cuo: '', correlativo: '', fecha: '', glosa: '', cuenta: '', denominacion: 'TOTALES',
        debe: ld52TotalDebe, haber: ld52TotalHaber, origen: '', estado: ''
      },
      companyInfo,
    });
  }

  // ═══ 7. LIBRO MAYOR ═══
  const balances = getAccountBalances(journal);
  const mayorRows = Object.entries(balances)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([cta, bal]) => {
      const acc = plan.find(a => a.cta === cta);
      return { cta, descripcion: acc?.description || '', debe: bal.debe, haber: bal.haber, saldo: bal.debe - bal.haber };
    });
  if (obligations.libroMayor && mayorRows.length > 0) {
    sheets.push({
      sheetName: '7. Libro Mayor',
      title: 'LIBRO MAYOR - FORMATO 6.1',
      columns: [
        { header: 'CUENTA', key: 'cta', width: 12, alignment: 'center' },
        { header: 'DENOMINACIÓN', key: 'descripcion', width: 40 },
        { header: 'DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER', key: 'haber', width: 16, style: 'currency' },
        { header: 'SALDO', key: 'saldo', width: 16, style: 'currency' },
      ],
      rows: mayorRows,
      totals: {
        cta: '', descripcion: 'TOTALES',
        debe: mayorRows.reduce((s, r) => s + r.debe, 0),
        haber: mayorRows.reduce((s, r) => s + r.haber, 0),
        saldo: mayorRows.reduce((s, r) => s + r.saldo, 0),
      },
      companyInfo,
    });
  }

  // ═══ 8. BALANCE DE COMPROBACIÓN ═══
  const hhttRows = Object.entries(balances)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([cta, bal]) => {
      const acc = plan.find(a => a.cta === cta);
      const saldoDeudor = bal.debe > bal.haber ? bal.debe - bal.haber : 0;
      const saldoAcreedor = bal.haber > bal.debe ? bal.haber - bal.debe : 0;
      return { cta, descripcion: acc?.description || '', debe: bal.debe, haber: bal.haber, saldoDeudor, saldoAcreedor };
    });
  if (obligations.libroInventariosBalances && hhttRows.length > 0) {
    sheets.push({
      sheetName: '8. Bal. Comprobación',
      title: 'BALANCE DE COMPROBACIÓN (HOJA DE TRABAJO)',
      columns: [
        { header: 'CUENTA', key: 'cta', width: 12, alignment: 'center' },
        { header: 'DENOMINACIÓN', key: 'descripcion', width: 38 },
        { header: 'SUMAS DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'SUMAS HABER', key: 'haber', width: 16, style: 'currency' },
        { header: 'SALDO DEUDOR', key: 'saldoDeudor', width: 16, style: 'currency' },
        { header: 'SALDO ACREEDOR', key: 'saldoAcreedor', width: 16, style: 'currency' },
      ],
      rows: hhttRows,
      totals: {
        cta: '', descripcion: 'TOTALES',
        debe: hhttRows.reduce((s, r) => s + r.debe, 0),
        haber: hhttRows.reduce((s, r) => s + r.haber, 0),
        saldoDeudor: hhttRows.reduce((s, r) => s + r.saldoDeudor, 0),
        saldoAcreedor: hhttRows.reduce((s, r) => s + r.saldoAcreedor, 0),
      },
      companyInfo,
    });
  }

  // ═══ 9. ESTADO DE RESULTADOS ═══
  if (obligations.libroInventariosBalances) {
    const absBal = getAccountBalances(journal);
    const getGSum = (prefixes: string[]) => getSum(absBal, prefixes);
    const ventas70 = -getGSum(['70']);
    const costo69 = getGSum(['69']);
    const gastoAdmin = getGSum(['94']);
    const gastoVenta = getGSum(['95']);
    const gastosFinan = getGSum(['67']);
    const otrosIngresos = -getGSum(['75', '76']);
    const utilidadBruta = ventas70 - costo69;
    const utilidadOperativa = utilidadBruta - gastoAdmin - gastoVenta;
    const utilidadNeta = utilidadOperativa - gastosFinan + otrosIngresos;

    sheets.push({
      sheetName: '9. Estado Resultados',
      title: 'ESTADO DE RESULTADOS POR FUNCIÓN',
      columns: [
        { header: 'CONCEPTO', key: 'concepto', width: 45 },
        { header: 'IMPORTE S/', key: 'importe', width: 20, style: 'currency' },
      ],
      rows: [
        { concepto: 'VENTAS NETAS', importe: ventas70 },
        { concepto: '(-) COSTO DE VENTAS', importe: -costo69 },
        { concepto: 'UTILIDAD BRUTA', importe: utilidadBruta },
        { concepto: '(-) GASTOS DE ADMINISTRACIÓN', importe: -gastoAdmin },
        { concepto: '(-) GASTOS DE VENTAS', importe: -gastoVenta },
        { concepto: 'UTILIDAD OPERATIVA', importe: utilidadOperativa },
        { concepto: '(-) GASTOS FINANCIEROS', importe: -gastosFinan },
        { concepto: '(+) OTROS INGRESOS', importe: otrosIngresos },
        { concepto: 'UTILIDAD NETA DEL EJERCICIO', importe: utilidadNeta },
      ],
      companyInfo,
    });
  }

  // ═══ 10. SITUACIÓN FINANCIERA ═══
  if (obligations.libroInventariosBalances) {
    const absBal = getAccountBalances(journal);
    const getGSum = (prefixes: string[]) => getSum(absBal, prefixes);
    const efectivo = getGSum(['10']);
    const ctasCobrar = getGSum(['12']);
    const existencias = getGSum(['20', '21', '22', '23', '24', '25', '26', '27', '28']);
    const totalAC = efectivo + ctasCobrar + getGSum(['11', '13', '14', '16', '17', '18']) + existencias + getGSum(['19', '29']);
    const ime = getGSum(['33', '35']);
    const deprec = getGSum(['39']);
    const totalANC = getGSum(['30', '31', '32']) + ime + deprec + getGSum(['34', '37', '38']);
    const totalActivo = totalAC + totalANC;
    const tributos = -getGSum(['40']);
    const ctasPagar = -getGSum(['42']);
    const totalPC = tributos + ctasPagar + (-getGSum(['41', '43', '44', '45', '46', '47', '49']));
    const totalPNC = -getGSum(['48']);
    const totalPasivo = totalPC + totalPNC;
    const capital = -getGSum(['50']);
    const reservas = -getGSum(['56', '58']);
    const resultAcum = -getGSum(['59']);
    const utilEjercicio = totalActivo - totalPasivo - capital - (-getGSum(['51', '52'])) - (-getGSum(['57'])) - reservas - resultAcum;
    const totalPatrimonio = capital + (-getGSum(['51', '52'])) + (-getGSum(['57'])) + reservas + resultAcum + utilEjercicio;

    sheets.push({
      sheetName: '10. Sit. Financiera',
      title: 'ESTADO DE SITUACIÓN FINANCIERA',
      columns: [
        { header: 'CONCEPTO', key: 'concepto', width: 45 },
        { header: 'IMPORTE S/', key: 'importe', width: 20, style: 'currency' },
      ],
      rows: [
        { concepto: '═══ A C T I V O ═══', importe: '' },
        { concepto: 'Efectivo y Equivalentes', importe: efectivo },
        { concepto: 'Ctas por Cobrar Comerciales', importe: ctasCobrar },
        { concepto: 'Inventarios', importe: existencias },
        { concepto: 'TOTAL ACTIVO CORRIENTE', importe: totalAC },
        { concepto: 'Inmuebles, Maquinaria y Equipo', importe: ime },
        { concepto: '(-) Depreciación Acumulada', importe: deprec },
        { concepto: 'TOTAL ACTIVO NO CORRIENTE', importe: totalANC },
        { concepto: 'TOTAL ACTIVO', importe: totalActivo },
        { concepto: '', importe: '' },
        { concepto: '═══ P A S I V O ═══', importe: '' },
        { concepto: 'Tributos por Pagar', importe: tributos },
        { concepto: 'Ctas por Pagar Comerciales', importe: ctasPagar },
        { concepto: 'TOTAL PASIVO', importe: totalPasivo },
        { concepto: '', importe: '' },
        { concepto: '═══ P A T R I M O N I O ═══', importe: '' },
        { concepto: 'Capital Social', importe: capital },
        { concepto: 'Resultados Acumulados', importe: resultAcum },
        { concepto: 'Resultado del Ejercicio', importe: utilEjercicio },
        { concepto: 'TOTAL PATRIMONIO', importe: totalPatrimonio },
        { concepto: '', importe: '' },
        { concepto: 'TOTAL PASIVO Y PATRIMONIO', importe: totalPasivo + totalPatrimonio },
      ],
      companyInfo,
    });
  }

  // ═══ 11. ACTIVOS FIJOS ═══
  if (obligations.libroInventariosBalances && fixedAssets && fixedAssets.length > 0) {
    sheets.push({
      sheetName: '11. Activos Fijos',
      title: 'REGISTRO DE ACTIVOS FIJOS',
      columns: [
        { header: 'DESCRIPCIÓN', key: 'descripcion', width: 35 },
        { header: 'COSTO', key: 'costo', width: 16, style: 'currency' },
        { header: 'MARCA', key: 'marca', width: 15 },
        { header: 'MODELO', key: 'modelo', width: 15 },
        { header: 'SERIE/PLACA', key: 'serie_placa', width: 15, alignment: 'center' },
      ],
      rows: fixedAssets,
      totals: { descripcion: 'TOTALES', costo: fixedAssets.reduce((s: number, a: any) => s + (a.costo || 0), 0), marca: '', modelo: '', serie_placa: '' },
      companyInfo,
    });
  }

  // ═══ 12. PLANILLAS ═══
  if ((obligations.libroDiarioSimplificado || obligations.libroDiarioCompleto) && employees && employees.length > 0) {
    sheets.push({
      sheetName: '12. Planillas',
      title: 'PLANILLA DE REMUNERACIONES',
      columns: [
        { header: 'NOMBRE', key: 'nombre', width: 30 },
        { header: 'DOC. N°', key: 'doc_num', width: 14, alignment: 'center' },
        { header: 'CARGO', key: 'cargo', width: 20 },
        { header: 'SUELDO', key: 'sueldo', width: 14, style: 'currency' },
        { header: 'AFP', key: 'afp', width: 12 },
        { header: 'F. INGRESO', key: 'fecha_ingreso', width: 12, alignment: 'center' },
      ],
      rows: employees,
      totals: { nombre: 'TOTALES', doc_num: '', cargo: '', sueldo: employees.reduce((s: number, e: any) => s + (e.sueldo || 0), 0), afp: '', fecha_ingreso: '' },
      companyInfo,
    });
  }

  // ═══ 13. ASIENTOS MANUALES ═══
  if (obligations.libroDiarioCompleto && asientos && asientos.length > 0) {
    const asientoRows: any[] = [];
    asientos.forEach(a => {
      a.lines.forEach(l => {
        asientoRows.push({
          asiento: a.header.asiento,
          fecha: a.header.fecEmi,
          glosa: a.header.glosa,
          cuenta: l.cuenta,
          detalle: l.detalle,
          debe: l.debe,
          haber: l.haber,
        });
      });
    });
    sheets.push({
      sheetName: '13. Asientos Manuales',
      title: 'ASIENTOS CONTABLES MANUALES',
      columns: [
        { header: 'ASIENTO', key: 'asiento', width: 22, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'GLOSA', key: 'glosa', width: 35 },
        { header: 'CUENTA', key: 'cuenta', width: 10, alignment: 'center' },
        { header: 'DETALLE', key: 'detalle', width: 28 },
        { header: 'DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER', key: 'haber', width: 16, style: 'currency' },
      ],
      rows: asientoRows,
      totals: {
        asiento: '', fecha: '', glosa: '', cuenta: '', detalle: 'TOTALES',
        debe: asientoRows.reduce((s, r) => s + r.debe, 0),
        haber: asientoRows.reduce((s, r) => s + r.haber, 0),
      },
      companyInfo,
    });
  }

  // ═══ 14. DAOT (PDT 3500) ═══
  if (obligations.registroVentas || obligations.registroCompras) {
    const currentYear = companyInfo.period.substring(0, 4);
    const daotRows: any[] = [];
    
    const clientTotals: Record<string, { ruc: string; nombre: string; total: number; docTipo: string }> = {};
    sales.filter(s => s.fecha.startsWith(currentYear) && s.estado_sire !== 'Propuesta').forEach(s => {
      const key = s.doc_num;
      if (!clientTotals[key]) {
        clientTotals[key] = { ruc: s.doc_num, nombre: s.nombre, total: 0, docTipo: s.doc_tipo || '6' };
      }
      clientTotals[key].total += s.total;
    });

    const supplierTotals: Record<string, { ruc: string; nombre: string; total: number; docTipo: string }> = {};
    purchases.filter(p => p.fecha.startsWith(currentYear) && p.estado_sire !== 'Propuesta').forEach(p => {
      const key = p.doc_num;
      if (!supplierTotals[key]) {
        supplierTotals[key] = { ruc: p.doc_num, nombre: p.nombre, total: 0, docTipo: p.doc_tipo || '6' };
      }
      supplierTotals[key].total += p.total;
    });

    Object.values(clientTotals).forEach(c => {
      if (c.total >= 3500) {
        daotRows.push({
          tipo_op: 'CLIENTE',
          doc_tipo: c.docTipo,
          doc_num: c.ruc,
          nombre: c.nombre,
          total: c.total
        });
      }
    });

    Object.values(supplierTotals).forEach(p => {
      if (p.total >= 3500) {
        daotRows.push({
          tipo_op: 'PROVEEDOR',
          doc_tipo: p.docTipo,
          doc_num: p.ruc,
          nombre: p.nombre,
          total: p.total
        });
      }
    });

    if (daotRows.length > 0) {
      sheets.push({
        sheetName: '14. DAOT (PDT 3500)',
        title: `OPERACIONES CON TERCEROS - DAOT (PDT 3500) - AÑO ${currentYear}`,
        columns: [
          { header: 'TIPO OPERACIÓN', key: 'tipo_op', width: 18, alignment: 'center' },
          { header: 'TIPO DOC', key: 'doc_tipo', width: 12, alignment: 'center' },
          { header: 'NÚMERO DOC', key: 'doc_num', width: 16, alignment: 'center' },
          { header: 'RAZÓN SOCIAL / NOMBRE', key: 'nombre', width: 45 },
          { header: 'MONTO ANUAL', key: 'total', width: 18, style: 'currency' }
        ],
        rows: daotRows,
        totals: {
          tipo_op: 'TOTAL DECLARABLE', doc_tipo: '', doc_num: '', nombre: '',
          total: daotRows.reduce((sum, r) => sum + r.total, 0)
        },
        companyInfo
      });
    }
  }

  // ═══ 15. NOTAS CONTABLES (NIIF) y 16. IMPUESTO DIFERIDO (NIC 12) ═══
  if (obligations.libroInventariosBalances) {
    const taxRate = state.deferredTaxComputation?.taxRate || 29.5;
    const overrides = state.deferredTaxComputation?.overrides || {};
    const dtSchedule = calculateDeferredTaxSchedule(journal, fixedAssets, taxRate, overrides);

    const baseNotes = generateNotesTemplates(state, dtSchedule.rows);
    const notesRows = baseNotes.map(n => {
      const userEdit = state.financeNotes?.find((fn: any) => fn.number === n.number);
      return {
        number: `Nota ${n.number}`,
        title: n.title,
        content: userEdit ? userEdit.content : n.content
      };
    });

    sheets.push({
      sheetName: '15. Notas NIIF',
      title: 'NOTAS A LOS ESTADOS FINANCIEROS (NIIF)',
      columns: [
        { header: 'N° NOTA', key: 'number', width: 15, alignment: 'center' },
        { header: 'TÍTULO DE LA NOTA', key: 'title', width: 35 },
        { header: 'CONTENIDO REVELADO', key: 'content', width: 90 }
      ],
      rows: notesRows,
      companyInfo
    });

    sheets.push({
      sheetName: '16. Impuesto Diferido (NIC 12)',
      title: 'CONCILIACIÓN DE DIFERENCIAS TEMPORARIAS (NIC 12)',
      columns: [
        { header: 'CONCEPTO', key: 'concepto', width: 45 },
        { header: 'CUENTA', key: 'cuenta', width: 12, alignment: 'center' },
        { header: 'BASE CONTABLE (NIIF)', key: 'accountingBase', width: 22, style: 'currency' },
        { header: 'BASE TRIBUTARIA (LIR)', key: 'taxBase', width: 22, style: 'currency' },
        { header: 'DIFERENCIA', key: 'diferencia', width: 22, style: 'currency' },
        { header: 'TIPO', key: 'tipo', width: 15, alignment: 'center' },
        { header: 'ACTIVO DIFERIDO', key: 'activoDiferido', width: 22, style: 'currency' },
        { header: 'PASIVO DIFERIDO', key: 'pasivoDiferido', width: 22, style: 'currency' }
      ],
      rows: dtSchedule.rows,
      totals: {
        concepto: 'TOTALES',
        cuenta: '',
        accountingBase: '',
        taxBase: '',
        diferencia: '',
        tipo: '',
        activoDiferido: dtSchedule.totalActivoDiferido,
        pasivoDiferido: dtSchedule.totalPasivoDiferido
      },
      companyInfo
    });
  }

  // ─── Generate & Download ───
  const filename = `LibroContable_${companyInfo.ruc}_${companyInfo.period}`;
  await exportMultipleSheets(sheets, filename);
  return sheets.length;
}
