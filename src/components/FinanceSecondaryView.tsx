import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { 
  TrendingUp, 
  Download, 
  BarChart,
  Printer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';

/**
 * ESTADOS FINANCIEROS SECUNDARIOS (Standardized Design)
 * ═══════════════════════════════════════════
 * FORMATO 3.18 — FLUJO DE EFECTIVO
 * FORMATO 3.19 — CAMBIOS EN EL PATRIMONIO
 */

const fmtAlways = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt = (n: number) => n !== 0 ? fmtAlways(n) : '';

const FinanceSecondaryView: React.FC = () => {
  const { journal, currentCompany } = useStore();
  const [reportType, setReportType] = useState<'3.18' | '3.19'>('3.18');
  const [periodoAnio, setPeriodoAnio] = useState(parseInt(currentCompany.period) || new Date().getFullYear());

  // ═══════════════════════════════════════════
  // FORMATO 3.18: LOGIC
  // ═══════════════════════════════════════════
  const cashFlowData = useMemo(() => {
    if (reportType !== '3.18') return null;

    const yearEntries = journal.filter(j =>
      j.fecha.startsWith(String(periodoAnio)) &&
      j.cta.trim() !== '' &&
      j.cta.toUpperCase() !== 'GLOSA'
    );

    const asientoGroups: Record<string, typeof yearEntries> = {};
    yearEntries.forEach(e => {
      const key = `${e.asiento}||${e.fecha}`;
      if (!asientoGroups[key]) asientoGroups[key] = [];
      asientoGroups[key].push(e);
    });

    let cobranzaVentas = 0, cobranzaHonorarios = 0, cobranzaIntereses = 0, otrosCobrosOp = 0;
    let pagoProveedores = 0, pagoRemuneraciones = 0, pagoTributos = 0, pagoIntereses = 0, otrosPagosOp = 0;
    let ventaValores = 0, ventaIME = 0, ventaIntangibles = 0, otrosCobrosInv = 0;
    let compraValores = 0, compraIME = 0, compraIntangibles = 0, otrosPagosInv = 0;
    let cobranzaEmision = 0, cobranzaObligLP = 0, otrosCobrosFinanc = 0;
    let pagoAmortizacion = 0, pagoDividendos = 0, otrosPagosFinanc = 0;

    Object.values(asientoGroups).forEach(lines => {
      const cashLines = lines.filter(l => l.cta.startsWith('10'));
      if (cashLines.length === 0) return;
      const otherLines = lines.filter(l => !l.cta.startsWith('10'));
      const cashDebe = cashLines.reduce((s, l) => s + l.debe, 0);
      const cashHaber = cashLines.reduce((s, l) => s + l.haber, 0);

      otherLines.forEach(ol => {
        const cta = ol.cta;
        const amount = ol.haber > 0 ? ol.haber : ol.debe;
        if (cashDebe > 0) {
          if (cta.startsWith('70') || cta.startsWith('12')) cobranzaVentas += amount;
          else if (cta.startsWith('74') || cta.startsWith('75') || cta.startsWith('76')) cobranzaHonorarios += amount;
          else if (cta.startsWith('77')) cobranzaIntereses += amount;
          else if (cta.startsWith('31') || cta.startsWith('30')) ventaValores += amount;
          else if (cta.startsWith('33')) ventaIME += amount;
          else if (cta.startsWith('34')) ventaIntangibles += amount;
          else if (cta.startsWith('50') || cta.startsWith('52')) cobranzaEmision += amount;
          else if (cta.startsWith('45') || cta.startsWith('46')) cobranzaObligLP += amount;
          else otrosCobrosOp += amount;
        }
        if (cashHaber > 0) {
          if (cta.startsWith('60') || cta.startsWith('61') || cta.startsWith('42') || cta.startsWith('43')) pagoProveedores += amount;
          else if (cta.startsWith('41') || cta.startsWith('62') || cta.startsWith('47')) pagoRemuneraciones += amount;
          else if (cta.startsWith('40')) pagoTributos += amount;
          else if (cta.startsWith('67')) pagoIntereses += amount;
          else if (cta.startsWith('31') || cta.startsWith('30')) compraValores += amount;
          else if (cta.startsWith('33')) compraIME += amount;
          else if (cta.startsWith('34')) compraIntangibles += amount;
          else if (cta.startsWith('45') || cta.startsWith('46')) pagoAmortizacion += amount;
          else if (cta.startsWith('44') || cta.startsWith('89')) pagoDividendos += amount;
          else if (cta.startsWith('50')) otrosPagosFinanc += amount;
          else otrosPagosOp += amount;
        }
      });
    });

    const priorEntries = journal.filter(j => j.fecha < `${periodoAnio}-01-01` && j.cta.startsWith('10'));
    const saldoInicial = priorEntries.reduce((s, e) => s + e.debe - e.haber, 0);
    const totalOperacion = cobranzaVentas + cobranzaHonorarios + cobranzaIntereses + otrosCobrosOp - (pagoProveedores + pagoRemuneraciones + pagoTributos + pagoIntereses + otrosPagosOp);
    const totalInversion = ventaValores + ventaIME + ventaIntangibles + otrosCobrosInv - (compraValores + compraIME + compraIntangibles + otrosPagosInv);
    const totalFinanciamiento = cobranzaEmision + cobranzaObligLP + otrosCobrosFinanc - (pagoAmortizacion + pagoDividendos + otrosPagosFinanc);
    const netoCashFlow = totalOperacion + totalInversion + totalFinanciamiento;

    return {
      operacion: {
        items: [
          { label: 'Cobranza de venta de bienes o servicios', monto: cobranzaVentas },
          { label: 'Cobranza de regalías, honorarios, comisiones', monto: cobranzaHonorarios },
          { label: 'Cobranza de intereses y dividendos', monto: cobranzaIntereses },
          { label: 'Otros cobros de efectivo operacionales', monto: otrosCobrosOp },
        ],
        menos: [
          { label: 'Pago a proveedores de bienes y servicios', monto: pagoProveedores },
          { label: 'Pago de remuneraciones y beneficios', monto: pagoRemuneraciones },
          { label: 'Pago de tributos', monto: pagoTributos },
          { label: 'Pago de intereses y rendimientos', monto: pagoIntereses },
          { label: 'Otros pagos de efectivo operacionales', monto: otrosPagosOp },
        ],
        total: totalOperacion,
      },
      inversion: {
        items: [
          { label: 'Venta de valores e inversiones', monto: ventaValores },
          { label: 'Venta de inmuebles, maquinaria y equipo', monto: ventaIME },
          { label: 'Venta de activos intangibles', monto: ventaIntangibles },
          { label: 'Otros cobros de inversión', monto: otrosCobrosInv },
        ],
        menos: [
          { label: 'Compra de valores e inversiones', monto: compraValores },
          { label: 'Compra de inmuebles, maquinaria y equipo', monto: compraIME },
          { label: 'Compra de activos intangibles', monto: compraIntangibles },
          { label: 'Otros pagos de inversión', monto: otrosPagosInv },
        ],
        total: totalInversion,
      },
      financiamiento: {
        items: [
          { label: 'Cobranza de emisión de acciones', monto: cobranzaEmision },
          { label: 'Cobranza de préstamos u obligaciones L.P.', monto: cobranzaObligLP },
          { label: 'Otros cobros de financiamiento', monto: otrosCobrosFinanc },
        ],
        menos: [
          { label: 'Amortización de deudas L.P.', monto: pagoAmortizacion },
          { label: 'Pago de dividendos', monto: pagoDividendos },
          { label: 'Otros pagos de financiamiento', monto: otrosPagosFinanc },
        ],
        total: totalFinanciamiento,
      },
      netoCashFlow,
      saldoInicial,
      saldoFinal: saldoInicial + netoCashFlow,
    };
  }, [journal, periodoAnio, reportType]);

  // ═══════════════════════════════════════════
  // FORMATO 3.19: LOGIC
  // ═══════════════════════════════════════════
  const patrimonioData = useMemo(() => {
    if (reportType !== '3.19') return null;

    const getBalance = (prefix: string, beforeDate?: string) => {
      return journal
        .filter(j => (j.cta.startsWith(prefix) && j.cta.toUpperCase() !== 'GLOSA') && (beforeDate ? j.fecha < beforeDate : j.fecha.startsWith(String(periodoAnio))))
        .reduce((s, j) => s + j.haber - j.debe, 0);
    };

    const getMovement = (prefix: string) => {
      const relevant = journal.filter(j => j.cta.startsWith(prefix) && j.cta.toUpperCase() !== 'GLOSA' && j.fecha.startsWith(String(periodoAnio)));
      return relevant.reduce((s, j) => s + j.haber - j.debe, 0);
    };

    const cols = [
      { key: 'capital', label: 'Capital', prefix: '50' },
      { key: 'capitalAdicional', label: 'Capital Adicional', prefix: '52' },
      { key: 'accionesInversion', label: 'Acciones de Inv.', prefix: '53' },
      { key: 'excedenteReval', label: 'Excedente Reval.', prefix: '57' },
      { key: 'reservaLegal', label: 'Reserva Legal', prefix: '58' },
      { key: 'otrasReservas', label: 'Otras Reservas', prefix: '59' },
      { key: 'resultadosAcum', label: 'Resultados Acum.', prefix: '89' },
    ];

    const saldoInicial: Record<string, number> = {};
    const movimiento: Record<string, number> = {};
    const saldoFinal: Record<string, number> = {};
    cols.forEach(c => {
      saldoInicial[c.key] = getBalance(c.prefix, `${periodoAnio}-01-01`);
      movimiento[c.key] = getMovement(c.prefix);
      saldoFinal[c.key] = saldoInicial[c.key] + movimiento[c.key];
    });

    const rows = [
      { num: '1.', label: 'Cambios en políticas contables' },
      { num: '2.', label: 'Distribución de utilidades' },
      { num: '3.', label: 'Dividendos acordados' },
      { num: '4.', label: 'Nuevos aportes' },
      { num: '5.', label: 'Primas y donaciones' },
      { num: '6.', label: 'Fusiones o escisiones' },
      { num: '7.', label: 'Revaluación de activos' },
      { num: '8.', label: 'Capitalización de partidas' },
      { num: '9.', label: 'Redención de acciones' },
      { num: '10.', label: 'Utilidad neta del ejercicio' },
      { num: '11.', label: 'Otros movimientos' },
    ];

    return { cols, saldoInicial, movimiento, saldoFinal, rows };
  }, [journal, periodoAnio, reportType]);

  const handleExport = () => {
    const ws = XLSX.utils.aoa_to_sheet([['Reporte generado desde SOFTCONTABLE']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Formato ${reportType}`);
    XLSX.writeFile(wb, `Estado_Financiero_${reportType}_${periodoAnio}.xlsx`);
    toast.success('Excel exportado');
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-slide-up relative print:bg-white print:p-0">

      {/* Toolbar */}
      <div className="h-12 px-5 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 toolbar print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pld-blue/10 rounded-lg">
            {reportType === '3.18' ? <TrendingUp size={16} className="text-pld-blue" /> : <BarChart size={16} className="text-pld-magenta" />}
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-app-text">
              {reportType === '3.18' ? 'Estado de Flujos de Efectivo' : 'Estado de Cambios en el Patrimonio'}
            </h2>
            <div className="flex gap-3 text-[9px] items-center text-app-muted">
               <span>FORMATO {reportType}</span>
               <span>AÑO {periodoAnio}</span>
               <span>RUC: {currentCompany.ruc}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-app-bg border border-app-border rounded-lg flex p-0.5 h-8">
             <button onClick={() => setReportType('3.18')} className={`px-3 rounded-md text-[8px] font-black uppercase transition-all ${reportType === '3.18' ? 'bg-pld-blue text-white' : 'text-app-muted hover:text-app-text'}`}>3.18 Flujo</button>
             <button onClick={() => setReportType('3.19')} className={`px-3 rounded-md text-[8px] font-black uppercase transition-all ${reportType === '3.19' ? 'bg-pld-magenta text-white' : 'text-app-muted hover:text-app-text'}`}>3.19 Patr.</button>
          </div>
          <div className="h-4 w-px bg-app-border mx-1" />
          <div className="bg-app-bg border border-app-border rounded-lg flex items-center h-8 px-2 gap-2">
             <button onClick={() => setPeriodoAnio(p => p - 1)} className="p-1 hover:text-pld-blue transition-colors"><ChevronLeft size={14} /></button>
             <span className="text-[10px] font-black w-8 text-center">{periodoAnio}</span>
             <button onClick={() => setPeriodoAnio(p => p + 1)} className="p-1 hover:text-pld-blue transition-colors"><ChevronRight size={14} /></button>
          </div>
          <div className="h-4 w-px bg-app-border mx-1" />
          <button onClick={handleExport} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Download size={14} /> Excel</button>
          <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="inline-block min-w-full border border-app-border shadow-2xl rounded-lg overflow-hidden bg-app-surface">

          {reportType === '3.18' && cashFlowData && (
            <div className="p-1">
              <table className="min-w-full border-collapse text-xs border border-app-border/40">
                <thead>
                  <tr className="bg-app-surface text-app-muted text-[10px] font-bold uppercase tracking-wider border-b border-app-border">
                    <th className="p-2.5 text-left border-r border-app-border/30">CONCEPTO / ACTIVIDAD</th>
                    <th className="p-2.5 text-right w-32">IMPORTE S/</th>
                  </tr>
                </thead>
                <tbody className="bg-app-surface text-app-text">
                  <tr className="bg-app-surface/60 font-bold uppercase border-b border-app-border text-pld-blue text-[10px]">
                    <td className="p-2.5 pl-4" colSpan={2}>Actividades de Operación</td>
                  </tr>
                  {cashFlowData.operacion.items.map((it, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 pl-6 font-sans text-xs">{it.label}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-pld-blue text-xs border-l border-app-border/20">{fmt(it.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-app-surface/20 border-b border-app-border/30 font-bold text-red-500">
                    <td className="p-2.5 pl-6 text-xs" colSpan={2}>MENOS:</td>
                  </tr>
                  {cashFlowData.operacion.menos.map((it, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 pl-6 font-sans text-xs">{it.label}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-xs border-l border-app-border/20">{fmt(it.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-pld-blue/[0.08] font-bold border-b border-app-border">
                    <td className="p-2.5 pl-4 text-xs font-black">Neto Actividades de Operación</td>
                    <td className="p-2.5 text-right font-mono font-black text-pld-blue text-xs border-l border-app-border/20">{fmtAlways(cashFlowData.operacion.total)}</td>
                  </tr>

                  <tr className="bg-app-surface/60 font-bold uppercase border-b border-app-border text-pld-blue text-[10px]">
                    <td className="p-2.5 pl-4" colSpan={2}>Actividades de Inversión</td>
                  </tr>
                  {cashFlowData.inversion.items.map((it, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 pl-6 font-sans text-xs">{it.label}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-pld-blue text-xs border-l border-app-border/20">{fmt(it.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-app-surface/20 border-b border-app-border/30 font-bold text-red-500">
                    <td className="p-2.5 pl-6 text-xs" colSpan={2}>MENOS:</td>
                  </tr>
                  {cashFlowData.inversion.menos.map((it, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 pl-6 font-sans text-xs">{it.label}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-xs border-l border-app-border/20">{fmt(it.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-pld-blue/[0.08] font-bold border-b border-app-border">
                    <td className="p-2.5 pl-4 text-xs font-black">Neto Actividades de Inversión</td>
                    <td className="p-2.5 text-right font-mono font-black text-pld-blue text-xs border-l border-app-border/20">{fmtAlways(cashFlowData.inversion.total)}</td>
                  </tr>

                  <tr className="bg-app-surface/60 font-bold uppercase border-b border-app-border text-pld-blue text-[10px]">
                    <td className="p-2.5 pl-4" colSpan={2}>Actividades de Financiamiento</td>
                  </tr>
                  {cashFlowData.financiamiento.items.map((it, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 pl-6 font-sans text-xs">{it.label}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-pld-blue text-xs border-l border-app-border/20">{fmt(it.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-app-surface/20 border-b border-app-border/30 font-bold text-red-500">
                    <td className="p-2.5 pl-6 text-xs" colSpan={2}>MENOS:</td>
                  </tr>
                  {cashFlowData.financiamiento.menos.map((it, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 pl-6 font-sans text-xs">{it.label}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-xs border-l border-app-border/20">{fmt(it.monto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-pld-blue/[0.08] font-bold border-b border-app-border">
                    <td className="p-2.5 pl-4 text-xs font-black">Neto Actividades de Financiamiento</td>
                    <td className="p-2.5 text-right font-mono font-black text-pld-blue text-xs border-l border-app-border/20">{fmtAlways(cashFlowData.financiamiento.total)}</td>
                  </tr>

                  <tr className="bg-pld-blue/[0.15] font-black border-b border-app-border">
                    <td className="p-3 uppercase text-xs">Aumento (Disminución) Neto de Efectivo</td>
                    <td className="p-3 text-right font-mono text-xs font-black text-pld-blue border-l border-app-border/20 underline decoration-double">{fmtAlways(cashFlowData.netoCashFlow)}</td>
                  </tr>
                  <tr className="bg-app-surface/40 font-bold border-b border-app-border/30">
                    <td className="p-2.5 pl-4 text-xs">Saldo al Inicio del Ejercicio</td>
                    <td className="p-2.5 text-right font-mono text-xs border-l border-app-border/20">{fmtAlways(cashFlowData.saldoInicial)}</td>
                  </tr>
                  <tr className="bg-pld-blue/[0.2] font-black border-t-2 border-pld-blue">
                    <td className="p-3 text-xs uppercase">SALDO FINAL DE EFECTIVO</td>
                    <td className="p-3 text-right font-mono text-sm text-pld-blue border-l border-app-border/20">{fmtAlways(cashFlowData.saldoFinal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {reportType === '3.19' && patrimonioData && (
            <div className="overflow-x-auto p-1">
              <table className="min-w-max border-collapse text-xs border border-app-border/40">
                <thead>
                  <tr className="bg-app-surface text-app-muted text-[9px] font-bold uppercase tracking-wider border-b border-app-border">
                    <th className="p-2.5 text-left border-r border-app-border/30">DETALLE DE MOVIMIENTOS</th>
                    {patrimonioData.cols.map(c => <th key={c.key} className="p-2.5 text-right border-r border-app-border/30 w-24">{c.label}</th>)}
                    <th className="p-2.5 text-right w-28">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="bg-app-surface text-app-text">
                  <tr className="bg-pld-blue/[0.03] font-bold border-b border-app-border/40">
                    <td className="p-2.5 font-bold pl-4 text-xs">Saldos al 01 de Enero</td>
                    {patrimonioData.cols.map(c => <td key={c.key} className="p-2.5 text-right font-mono font-bold text-pld-blue text-xs border-l border-app-border/20">{fmt(patrimonioData.saldoInicial[c.key])}</td>)}
                    <td className="p-2.5 text-right font-mono bg-pld-blue/[0.08] font-black text-xs border-l border-app-border/20">{fmtAlways(Object.values(patrimonioData.saldoInicial).reduce((s,v)=>s+v,0))}</td>
                  </tr>
                  {patrimonioData.rows.map((row, i) => (
                    <tr key={i} className="border-b border-app-border/30 hover:bg-pld-blue/[0.04] transition-colors">
                      <td className="p-2.5 font-sans text-xs pl-6"><span className="text-pld-blue font-black mr-2">{row.num}</span> {row.label}</td>
                      {patrimonioData.cols.map(c => <td key={c.key} className="p-2.5 text-right font-mono text-xs border-l border-app-border/20">{row.num === '10.' && c.key === 'resultadosAcum' ? fmt(patrimonioData.movimiento[c.key]) : ''}</td>)}
                      <td className="p-2.5 text-right font-mono font-bold text-xs border-l border-app-border/20">{row.num === '10.' ? fmt(patrimonioData.movimiento.resultadosAcum) : ''}</td>
                    </tr>
                  ))}
                  <tr className="bg-pld-blue/[0.1] font-black border-t-2 border-pld-blue/50">
                    <td className="p-2.5 uppercase font-bold text-xs pl-4">Saldos al 31 de Diciembre</td>
                    {patrimonioData.cols.map(c => <td key={c.key} className="p-2.5 text-right font-mono text-pld-blue text-xs font-black border-l border-app-border/20">{fmtAlways(patrimonioData.saldoFinal[c.key])}</td>)}
                    <td className="p-2.5 text-right font-mono bg-pld-blue/[0.2] text-pld-blue font-black text-xs border-l border-app-border/20 underline">
                      {fmtAlways(Object.values(patrimonioData.saldoFinal).reduce((s,v)=>s+v,0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceSecondaryView;
