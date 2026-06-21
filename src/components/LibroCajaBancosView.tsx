import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { 
  Wallet, 
  Building2, 
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

/**
 * LIBRO CAJA Y BANCOS
 * ═══════════════════════════════════════════════
 * Según R.S. N° 234-2006/SUNAT
 *
 * FORMATO 1.1 — DETALLE DE LOS MOVIMIENTOS DEL EFECTIVO
 *   Muestra TODAS las líneas de cada asiento que involucre cuentas 101x (Caja).
 *   Columnas: N° Correl, Fecha, Descripción, Cta Contable Asociada (Código + Denom), Deudor, Acreedor
 *
 * FORMATO 1.2 — DETALLE DE LOS MOVIMIENTOS DE LA CUENTA CORRIENTE
 *   Muestra TODAS las líneas de cada asiento que involucre cuentas 104x (Bancos).
 *   Columnas adicionales: Medio de Pago (Tabla 1), Descripción, Razón Social, N° Transacción
 *
 * LÓGICA:
 *   1. Agrupar journal entries por asiento (mismo asiento + fecha)
 *   2. Filtrar grupos que contengan al menos una línea con cuenta 101x (1.1) o 104x (1.2)
 *   3. Mostrar TODAS las líneas de cada grupo, con correlativo solo en la primera línea
 *   4. Cada línea: su cuenta en "Cuenta Asociada", su debe en DEUDOR, su haber en ACREEDOR
 */

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const isCaja = (cta: string) => cta.startsWith('101');
const isBanco = (cta: string) => cta.startsWith('104');

/** Each display row in the table */
interface DisplayRow {
  /** Correlative number (only for the first line of each asiento) */
  correlativo: number | null;
  fecha: string;
  glosa: string;
  /** Shows true if this is the first line of the asiento group */
  isFirstLine: boolean;
  ctaCodigo: string;
  ctaDenom: string;
  deudor: number;
  acreedor: number;
  asientoKey: string;
  // Formato 1.2 extras
  medioPago?: string;
  razonSocial?: string;
  nroTransaccion?: string;
}

const fmt = (n: number) => n !== 0
  ? n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '';

const fmtAlways = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LibroCajaBancosView: React.FC = () => {
  const { journal, plan, currentCompany } = useStore();
  const [formato, setFormato] = useState<'1.1' | '1.2'>('1.1');
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth());
  const [periodoAnio, setPeriodoAnio] = useState(parseInt(currentCompany.period) || new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // Helper: lookup account description from plan
  const getCtaDenom = (cta: string): string => {
    const acc = plan.find(p => p.cta === cta);
    return acc?.description || '';
  };

  // ─── Build display rows from Journal ───
  const rows: DisplayRow[] = useMemo(() => {
    const isTarget = formato === '1.1' 
      ? (cta: string) => cta.startsWith('101')
      : (cta: string) => cta.startsWith('104') || cta.startsWith('106');

    const periodoStr = `${periodoAnio}-${String(periodoMes + 1).padStart(2, '0')}`;

    // 1. Get ALL entries that could be in this period (any format)
    const allEntries = journal.filter(e => {
      let matchesPeriod = false;
      if (e.fecha.includes('-')) {
        matchesPeriod = e.fecha.startsWith(periodoStr);
      } else if (e.fecha.includes('/')) {
        const [d, m, y] = e.fecha.split('/');
        matchesPeriod = y === String(periodoAnio) && m === String(periodoMes + 1).padStart(2, '0');
      }
      return matchesPeriod && e.cta.trim() !== '' && e.cta.trim().toUpperCase() !== 'GLOSA';
    });

    // 2. Group by seat to find counterparts
    const seatGroups = new Map<string, typeof allEntries>();
    allEntries.forEach(e => {
      const key = `${e.asiento}||${e.fecha}`;
      if (!seatGroups.has(key)) seatGroups.set(key, []);
      seatGroups.get(key)!.push(e);
    });

    const result: DisplayRow[] = [];
    let correlativo = 0;

    // Sort seats
    const sortedKeys = Array.from(seatGroups.keys()).sort((a, b) => {
      const [, aDate] = a.split('||');
      const [, bDate] = b.split('||');
      return aDate.localeCompare(bDate) || a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      const lines = seatGroups.get(key)!;
      const isOpening = lines[0].asiento.toUpperCase().includes('APERTURA');

      // Find movements of the target account (101 or 104/106)
      const movements = lines.filter(l => isTarget(l.cta));
      if (movements.length === 0) continue;

      correlativo++;
      const fecha = lines[0].fecha;
      const glosa = lines[0].glosa;

      if (isOpening) {
        // For Opening Balance, show a single summary line per cash/bank account found
        movements.forEach((m, idx) => {
          result.push({
            correlativo: idx === 0 ? correlativo : null,
            fecha,
            glosa: 'SALDO INICIAL - APERTURA',
            isFirstLine: idx === 0,
            ctaCodigo: m.cta, // In opening, we show the account itself as reference or the counterpart? 
            // Usually in opening, the associated account is technically the capital/assets/etc. 
            // But SUNAT often accepts the account itself or "VARIAS".
            ctaDenom: getCtaDenom(m.cta),
            deudor: m.debe,
            acreedor: m.haber,
            asientoKey: key
          });
        });
      } else {
        // For regular movements:
        // For each cash/bank line, we show its counterpart(s)
        movements.forEach((m, idx) => {
          // Find counterparts (lines in the same seat that ARE NOT cash/bank)
          const counterparts = lines.filter(l => !isTarget(l.cta));
          
          // If there's only one counterpart, show it. If many, show "VARIAS"
          const associatedCta = counterparts.length === 1 ? counterparts[0].cta : 'VARIAS';
          const associatedDenom = counterparts.length === 1 ? getCtaDenom(counterparts[0].cta) : 'VER DETALLE EN DIARIO';

          result.push({
            correlativo: idx === 0 ? correlativo : null,
            fecha,
            glosa,
            isFirstLine: idx === 0,
            ctaCodigo: associatedCta,
            ctaDenom: associatedDenom,
            deudor: m.debe, // Deudor in 101/104 means INFLOW
            acreedor: m.haber, // Acreedor in 101/104 means OUTFLOW
            asientoKey: key,
            // 1.2 Extras (if available in the seat data)
            medioPago: (m as any).medio_pago || '',
            razonSocial: (m as any).razon_social || '',
            nroTransaccion: (m as any).nro_transaccion || ''
          });
        });
      }
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchingKeys = new Set(
        result.filter(r =>
          r.glosa.toLowerCase().includes(term) ||
          r.ctaCodigo.includes(term) ||
          r.ctaDenom.toLowerCase().includes(term)
        ).map(r => r.asientoKey)
      );
      return result.filter(r => matchingKeys.has(r.asientoKey));
    }

    return result;
  }, [journal, plan, formato, periodoMes, periodoAnio, searchTerm]);

  // ─── Totales ───
  const totals = useMemo(() => {
    const deudor = rows.reduce((sum, r) => sum + r.deudor, 0);
    const acreedor = rows.reduce((sum, r) => sum + r.acreedor, 0);
    return { deudor, acreedor, saldo: deudor - acreedor };
  }, [rows]);

  // ─── Export Excel ───
  const handleExportExcel = () => {
    if (formato === '1.1') {
      const rowsFormatted = rows.map(r => ({
        correlativo: r.correlativo ?? '',
        fecha: r.isFirstLine ? r.fecha : '',
        glosa: r.isFirstLine ? r.glosa.toUpperCase() : '',
        ctaCodigo: r.ctaCodigo,
        ctaDenom: r.ctaDenom.toUpperCase(),
        deudor: r.deudor || 0,
        acreedor: r.acreedor || 0
      }));

      exportSingleSheet({
        sheetName: 'Formato 1.1',
        title: `LIBRO CAJA Y BANCOS - DETALLE DE MOVIMIENTOS DE EFECTIVO (PERIODO: ${MONTHS[periodoMes]} ${periodoAnio})`,
        columns: [
          { header: 'N° CORREL.', key: 'correlativo', width: 14, alignment: 'center' },
          { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
          { header: 'DESCRIPCIÓN DE LA OPERACIÓN', key: 'glosa', width: 40 },
          { header: 'CÓDIGO CTA', key: 'ctaCodigo', width: 12, alignment: 'center' },
          { header: 'DENOMINACIÓN CTA', key: 'ctaDenom', width: 35 },
          { header: 'DEUDOR (INGRESOS)', key: 'deudor', width: 16, style: 'currency' },
          { header: 'ACREEDOR (SALIDAS)', key: 'acreedor', width: 16, style: 'currency' }
        ],
        rows: rowsFormatted,
        totals: {
          correlativo: '', fecha: '', glosa: 'TOTAL GENERAL', ctaCodigo: '', ctaDenom: '',
          deudor: totals.deudor,
          acreedor: totals.acreedor
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: `${periodoAnio}-${String(periodoMes + 1).padStart(2, '0')}`,
        }
      }, `Libro_CajaBancos_1_1_${periodoAnio}_${String(periodoMes + 1).padStart(2, '0')}`);
    } else {
      const rowsFormatted = rows.map(r => ({
        correlativo: r.correlativo ?? '',
        fecha: r.isFirstLine ? r.fecha : '',
        medioPago: r.isFirstLine ? (r.medioPago || '') : '',
        glosa: r.isFirstLine ? r.glosa.toUpperCase() : '',
        razonSocial: r.isFirstLine ? (r.razonSocial || '').toUpperCase() : '',
        ctaCodigo: r.ctaCodigo,
        ctaDenom: r.ctaDenom.toUpperCase(),
        deudor: r.deudor || 0,
        acreedor: r.acreedor || 0
      }));

      exportSingleSheet({
        sheetName: 'Formato 1.2',
        title: `LIBRO CAJA Y BANCOS - DETALLE DE MOVIMIENTOS DE CUENTA CORRIENTE (PERIODO: ${MONTHS[periodoMes]} ${periodoAnio})`,
        columns: [
          { header: 'N° CORREL.', key: 'correlativo', width: 14, alignment: 'center' },
          { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
          { header: 'M. PAGO', key: 'medioPago', width: 10, alignment: 'center' },
          { header: 'DESCRIPCIÓN DE LA OPERACIÓN', key: 'glosa', width: 30 },
          { header: 'APELLIDOS Y NOMBRES / RAZÓN SOCIAL', key: 'razonSocial', width: 30 },
          { header: 'CÓDIGO CTA', key: 'ctaCodigo', width: 12, alignment: 'center' },
          { header: 'DENOMINACIÓN CTA', key: 'ctaDenom', width: 30 },
          { header: 'DEUDOR (INGRESOS)', key: 'deudor', width: 16, style: 'currency' },
          { header: 'ACREEDOR (SALIDAS)', key: 'acreedor', width: 16, style: 'currency' }
        ],
        rows: rowsFormatted,
        totals: {
          correlativo: '', fecha: '', medioPago: '', glosa: 'TOTAL GENERAL', razonSocial: '', ctaCodigo: '', ctaDenom: '',
          deudor: totals.deudor,
          acreedor: totals.acreedor
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: `${periodoAnio}-${String(periodoMes + 1).padStart(2, '0')}`,
        }
      }, `Libro_CajaBancos_1_2_${periodoAnio}_${String(periodoMes + 1).padStart(2, '0')}`);
    }
  };

  const formatoLabel = formato === '1.1'
    ? 'Detalle de los Movimientos del Efectivo'
    : 'Detalle de los Movimientos de la Cuenta Corriente';


  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative print:bg-white print:p-0">
      <PageHeader
        icon={formato === '1.1' ? <Wallet size={18} /> : <Building2 size={18} />}
        title={`Libro Caja y Bancos (${formato})`}
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-[9px] text-indigo-600 border border-indigo-500/10 tracking-[0.2em] uppercase">
            {formato === '1.1' ? 'Formato 1.1' : 'Formato 1.2'}
          </span>
        }
        subtitle={`${formatoLabel} • ${MONTHS[periodoMes]} ${periodoAnio} • RUC: ${currentCompany.ruc}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Format Switcher */}
            <div className="bg-app-bg border border-app-border rounded-lg flex p-0.5 h-8">
               <button
                 onClick={() => setFormato('1.1')}
                 className={`px-3 rounded-md text-[8px] font-black uppercase transition-all ${formato === '1.1' ? 'bg-indigo-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'}`}
               >
                 1.1 Efec.
               </button>
               <button
                 onClick={() => setFormato('1.2')}
                 className={`px-3 rounded-md text-[8px] font-black uppercase transition-all ${formato === '1.2' ? 'bg-violet-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'}`}
               >
                 1.2 Bancos
               </button>
            </div>

            {/* Mes Selector */}
            <div className="bg-app-bg border border-app-border rounded-lg flex items-center h-8 px-1">
               <button onClick={() => setPeriodoMes(prev => prev === 0 ? 11 : prev - 1)} className="p-1 hover:text-indigo-600 transition-colors"><ChevronLeft size={14} /></button>
               <select
                 value={periodoMes}
                 onChange={e => setPeriodoMes(parseInt(e.target.value))}
                 className="bg-transparent border-none text-[9px] font-black uppercase text-app-text focus:ring-0 cursor-pointer py-0 w-20 appearance-none text-center"
               >
                 {MONTHS.map((m, i) => <option key={m} value={i} className="bg-app-surface">{m}</option>)}
               </select>
               <button onClick={() => setPeriodoMes(prev => prev === 11 ? 0 : prev + 1)} className="p-1 hover:text-indigo-600 transition-colors"><ChevronRight size={14} /></button>
            </div>

            {/* Año Selector */}
            <div className="bg-app-bg border border-app-border rounded-lg flex items-center h-8 px-2 gap-2">
               <button onClick={() => setPeriodoAnio(p => p - 1)} className="p-1 hover:text-indigo-600 transition-colors"><ChevronLeft size={14} /></button>
               <span className="text-[10px] font-black w-8 text-center">{periodoAnio}</span>
               <button onClick={() => setPeriodoAnio(p => p + 1)} className="p-1 hover:text-indigo-600 transition-colors"><ChevronRight size={14} /></button>
            </div>

            {/* Buscador */}
            <div className="relative group">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-indigo-600 transition-colors" size={12} />
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-app-bg border border-app-border rounded-lg pl-7 pr-3 h-8 text-[10px] w-36 focus:ring-1 focus:ring-indigo-600 outline-none transition-all font-bold"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={handleExportExcel}
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Download size={14} /> Excel
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Printer size={14} /> Imprimir
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
        <div className="inline-block min-w-full border border-app-border shadow-2xl rounded-sm overflow-x-auto bg-app-surface custom-scrollbar">
        <table id="libro-caja-table" className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface shadow-xl">

          {/* ──── THEAD ──── */}
          <thead className="sticky top-0 z-20">
            {formato === '1.1' ? (
              /* ═══ FORMATO 1.1: EFECTIVO ═══ */
              <>
                <tr className="bg-pld-blue text-white text-[7.5px] font-black uppercase">
                  <th rowSpan={2} className="px-2 py-3 border border-blue-700/50 text-center w-14">NÚMERO<br />CORRELATIVO<br />DEL REGISTRO<br />O CÓDIGO<br />ÚNICO DE LA<br />OPERACIÓN</th>
                  <th rowSpan={2} className="px-2 py-3 border border-blue-700/50 text-center w-16">FECHA DE<br />LA<br />OPERACIÓN</th>
                  <th rowSpan={2} className="px-2 py-3 border border-blue-700/50 text-center min-w-[220px]">DESCRIPCIÓN DE<br />LA OPERACIÓN</th>
                  <th colSpan={2} className="px-2 py-2 border border-blue-700/50 text-center bg-blue-600/50">CUENTA CONTABLE ASOCIADA</th>
                  <th colSpan={2} className="px-2 py-2 border border-blue-700/50 text-center">SALDOS Y MOVIMIENTOS</th>
                </tr>
                <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-14 bg-blue-600/50">CÓDIGO</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[130px] bg-blue-600/50">DENOMINACIÓN</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-24 text-yellow-200">DEUDOR</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-24">ACREEDOR</th>
                </tr>
              </>
            ) : (
              /* ═══ FORMATO 1.2: CUENTAS CORRIENTES ═══ */
              <>
                <tr className="bg-pld-blue text-white text-[7.5px] font-black uppercase">
                  <th rowSpan={2} className="px-2 py-3 border border-blue-700/50 text-center w-14">NÚMERO<br />CORRELATIVO<br />DEL REGISTRO O<br />CÓDIGO<br />ÚNICO DE LA<br />OPERACIÓN</th>
                  <th colSpan={4} className="px-2 py-2 border border-blue-700/50 text-center bg-blue-600/50">OPERACIONES BANCARIAS</th>
                  <th colSpan={2} className="px-2 py-2 border border-blue-700/50 text-center bg-blue-700/30">CUENTA CONTABLE ASOCIADA</th>
                  <th colSpan={2} className="px-2 py-2 border border-blue-700/50 text-center">SALDOS Y MOVIMIENTOS</th>
                </tr>
                <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-16">FECHA DE<br />LA<br />OPERACIÓN</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-14">MEDIO<br />DE PAGO<br /><span className="text-[5.5px] opacity-70">(TABLA 1)</span></th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[150px]">DESCRIPCIÓN<br />DE LA<br />OPERACIÓN</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[160px]">APELLIDOS Y NOMBRES,<br />DENOMINACIÓN<br />O RAZÓN SOCIAL</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-14 bg-blue-700/30">CÓDIGO</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[100px] bg-blue-700/30">DENOMINACIÓN</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-24 text-yellow-200">DEUDOR</th>
                  <th className="px-2 py-2 border border-blue-700/50 text-center w-24">ACREEDOR</th>
                </tr>
              </>
            )}
          </thead>

          {/* ──── TBODY ──── */}
          <tbody className="font-mono text-[9px] bg-app-surface">
            {rows.length === 0 && (
              <tr>
                <td colSpan={formato === '1.1' ? 7 : 9} className="text-center py-20">
                  <div className="flex flex-col items-center gap-3 opacity-30">
                    <AlertCircle size={32} />
                    <p className="text-xs font-black uppercase tracking-wider font-sans">
                      No hay movimientos de {formato === '1.1' ? 'efectivo (Cta. 101x)' : 'cuenta corriente (Cta. 104x)'} en este periodo
                    </p>
                    <p className="text-[10px] font-sans">
                      Los movimientos se extraen automáticamente de los asientos del Libro Diario
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {formato === '1.1' ? (
              /* ═══ ROWS FORMATO 1.1 ═══ */
              rows.map((r, idx) => (
                <tr
                  key={`${r.asientoKey}-${idx}`}
                  className={`transition-colors border-b border-app-border/40 ${r.isFirstLine ? 'hover:bg-pld-blue/5' : 'hover:bg-pld-blue/2'}`}
                >
                  {/* N° Correlativo — solo primera línea */}
                  <td className={`px-2 py-1.5 border-r border-app-border/40 text-center font-bold ${r.isFirstLine ? 'text-pld-blue' : ''}`}>
                    {r.correlativo ?? ''}
                  </td>
                  {/* Fecha — solo primera línea */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-center whitespace-nowrap italic">
                    {r.isFirstLine ? r.fecha : ''}
                  </td>
                  {/* Descripción — solo primera línea */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8.5px] font-bold uppercase text-app-text">
                    {r.isFirstLine ? r.glosa : ''}
                  </td>
                  {/* Cuenta Código */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-black text-pld-magenta">{r.ctaCodigo}</td>
                  {/* Cuenta Denominación */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] uppercase truncate max-w-[160px] opacity-70" title={r.ctaDenom}>{r.ctaDenom}</td>
                  {/* Deudor */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">
                    {fmt(r.deudor)}
                  </td>
                  {/* Acreedor */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-rose-500 bg-rose-500/5">
                    {fmt(r.acreedor)}
                  </td>
                </tr>
              ))
            ) : (
              /* ═══ ROWS FORMATO 1.2 ═══ */
              rows.map((r, idx) => (
                <tr
                  key={`${r.asientoKey}-${idx}`}
                  className={`transition-colors border-b border-app-border/40 ${r.isFirstLine ? 'hover:bg-pld-blue/5' : 'hover:bg-pld-blue/2'}`}
                >
                  {/* N° Correlativo */}
                  <td className={`px-2 py-1.5 border-r border-app-border/40 text-center font-bold ${r.isFirstLine ? 'text-pld-blue' : ''}`}>
                    {r.correlativo ?? ''}
                  </td>
                  {/* Fecha */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-center whitespace-nowrap italic">
                    {r.isFirstLine ? r.fecha : ''}
                  </td>
                  {/* Medio de Pago */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold">
                    {r.isFirstLine ? (r.medioPago || '') : ''}
                  </td>
                  {/* Descripción */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8.5px] font-bold uppercase text-app-text">
                    {r.isFirstLine ? r.glosa : ''}
                  </td>
                  {/* Razón Social */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] uppercase truncate max-w-[160px]">
                    {r.isFirstLine ? (r.razonSocial || '') : ''}
                  </td>
                  {/* Cuenta Código */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-black text-pld-magenta">{r.ctaCodigo}</td>
                  {/* Cuenta Denominación */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] uppercase truncate max-w-[120px] opacity-70" title={r.ctaDenom}>{r.ctaDenom}</td>
                  {/* Deudor */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">
                    {fmt(r.deudor)}
                  </td>
                  {/* Acreedor */}
                  <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-rose-500 bg-rose-500/5">
                    {fmt(r.acreedor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* ──── TFOOT: Totals ──── */}
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-10 bg-app-surface">
              <tr className="font-black text-[9px] border-t-2 border-pld-blue bg-pld-blue/10">
                <td colSpan={formato === '1.1' ? 5 : 7} className="px-3 py-2.5 border-r border-app-border/40 text-right uppercase italic text-[8px] text-pld-blue tracking-wider">
                  TOTAL GENERAL S/
                </td>
                <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
                  {fmtAlways(totals.deudor)}
                </td>
                <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
                  {fmtAlways(totals.acreedor)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>

      {/* ═══ FOOTER INFO ═══ */}
      <div className="px-5 py-3 bg-app-surface border-t border-app-border flex justify-between items-center text-[8px] font-black uppercase text-app-muted print:hidden shrink-0">
        <div className="flex gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Deudor = Ingresos de {formato === '1.1' ? 'Efectivo' : 'Banco'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Acreedor = Salidas de {formato === '1.1' ? 'Efectivo' : 'Banco'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Datos extraídos del Libro Diario (Cuentas {formato === '1.1' ? '101x' : '104x'})
          </div>
        </div>
        <div>
          Saldo: S/ {fmtAlways(totals.saldo)}
        </div>
      </div>

        </div>
      </div>
  );
};

export default LibroCajaBancosView;
