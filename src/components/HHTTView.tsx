import React, { useState, useMemo, useEffect } from 'react';
import { Scale, Printer, FileDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import StaleWarningBanner from './shared/StaleWarningBanner';
import toast from 'react-hot-toast';
import PageHeader from './ui/PageHeader';

/**
 * HHTT — BALANCE DE COMPROBACIÓN
 * ═══════════════════════════════════════════════════
 * Clasificación PCGE conforme CONCAR:
 *
 *   INVENTARIO (Balance):  Clases 1–5
 *   NATURALEZA:            Clases 6 (no 69), 7 (no 79), 8
 *   FUNCIÓN:               Clase 69, 79, 9
 *
 * Columnas (16 + CTA + DESC):
 *   1-2   Sumas del Mayor (Debe / Haber)
 *   3-4   Saldos (Deudor / Acreedor)
 *   5-6   Ajustes (Debe / Haber)
 *   7-8   Saldo Ajustado (Deudor / Acreedor)
 *   9-10  Inventario (Activo / Pasivo)
 *   11-12 Resultados Naturaleza (Pérdida / Ganancia)
 *   13-14 Resultados Función (Pérdida / Ganancia)
 */

interface HHTTRow {
  cta: string;
  desc: string;
  debe: number;
  haber: number;
  deudor: number;
  acreedor: number;
  adjDebe: number;
  adjHaber: number;
  adjDeudor: number;
  adjAcreedor: number;
  activo: number;
  pasivo: number;
  perdidaNaturaleza: number;
  gananciaNaturaleza: number;
  perdidaFuncion: number;
  gananciaFuncion: number;
}

 function classifyAccount(cta: string, businessType: string): ('INVENTARIO' | 'NATURALEZA' | 'FUNCION')[] {
  const p1 = parseInt(cta.substring(0, 1), 10);
  const p2 = parseInt(cta.substring(0, 2), 10);
  const types: ('INVENTARIO' | 'NATURALEZA' | 'FUNCION')[] = [];

  // Clases 1–5 → INVENTARIO (Balance General)
  if (p1 >= 1 && p1 <= 5) {
    types.push('INVENTARIO');
  }

  // Clase 6 (Gastos)
  if (p1 === 6) {
    // 69 (Costo de ventas) va ÚNICAMENTE a FUNCION
    if (p2 === 69) {
      types.push('FUNCION');
    }
    // 66 y 67 (Pérdidas financieras/valor razonable) van a AMBOS (Naturaleza y Función)
    else if (p2 === 66 || p2 === 67) {
      types.push('NATURALEZA');
      types.push('FUNCION');
    }
    // Todos los demás gastos de clase 6 van a NATURALEZA
    else {
      types.push('NATURALEZA');
    }
  }

  // Clase 7 (Ingresos)
  if (p1 === 7) {
    // 79 (Cargas imputables) se elimina en ajustes (se clasifica conceptualmente en función)
    if (p2 === 79) {
      types.push('FUNCION');
    }
    // 71, 72, 78 van ÚNICAMENTE a NATURALEZA (no se presentan en Función)
    else if (p2 === 71 || p2 === 72 || p2 === 78) {
      types.push('NATURALEZA');
    }
    // Todos los demás ingresos de clase 7 van a AMBOS (Naturaleza y Función)
    else {
      types.push('NATURALEZA');
      types.push('FUNCION');
    }
  }

  // Clase 8 (Saldos intermediarios de gestión)
  if (p1 === 8) {
    // 88 (Impuesto a la renta) va tanto a NATURALEZA como a FUNCION
    if (p2 === 88) {
      types.push('NATURALEZA');
      types.push('FUNCION');
    } else {
      types.push('NATURALEZA');
    }
  }

  // Clase 9 (Gastos por Función) → FUNCIÓN
  if (p1 === 9) {
    types.push('FUNCION');
  }

  if (types.length === 0) {
    types.push('INVENTARIO');
  }
  return types;
}

const fmt = (n: number) => n !== 0 ? n.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-';
const fmtAlways = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

const HHTTView: React.FC = () => {
  const { currentCompany, plan, hhttAdjustments, setHhttAdjustment, staleVersions, syncStaleVersions, markSynced } = useStore();
  const journal = useStore().journal.filter(entry => entry.cta.trim().toUpperCase() !== 'GLOSA');
  const [digits, setDigits] = useState<number>(100);

  const currentYear = currentCompany.period || '2025';

  // Determine the most common month from journal entries
  const monthCounts: Record<string, number> = {};
  journal.forEach(entry => {
    const parts = entry.fecha.includes('/') ? entry.fecha.split('/') : entry.fecha.split('-');
    const m = entry.fecha.includes('/') ? parts[1] : parts[1];
    if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const dominantMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';
  const periodStr = `${currentYear}-${dominantMonth.padStart(2, '0')}`;

  useEffect(() => {
    syncStaleVersions(periodStr);
  }, [periodStr, syncStaleVersions]);

  const hhttStale = staleVersions.find((x: any) => x.module === 'hhtt');
  const isStale = hhttStale?.is_stale === 1 || hhttStale?.is_stale === true;
  const staleSince = hhttStale?.stale_since;

  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    await markSynced('hhtt', periodStr);
    setIsRecalculating(false);
    toast.success('Hoja de Trabajo (HHTT) recalculada con éxito');
  };

  const handleAdjust = (cta: string, field: 'debe' | 'haber', valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setHhttAdjustment(cta, field, val);
  };

   // ─── Aggregate journal entries ───
  const rows: HHTTRow[] = useMemo(() => {
    // Basic aggregation
    const rolledUpMap = journal.reduce((acc, entry) => {
      const cta = digits !== 100 ? entry.cta.substring(0, digits) : entry.cta;
      if (!acc[cta]) {
        const planAcc = plan.find(p => p.cta === cta);
        acc[cta] = {
          cta,
          desc: planAcc ? planAcc.description : (digits !== 100 ? `Resumen Cta. ${cta}` : entry.desc),
          debe: 0,
          haber: 0,
        };
      }
      acc[cta].debe += entry.debe;
      acc[cta].haber += entry.haber;
      return acc;
    }, {} as Record<string, { cta: string; desc: string; debe: number; haber: number }>);

    const initialRows = Object.values(rolledUpMap);

    // Calculate Automatic Adjustments
    const autoAdjusts: Record<string, { debe: number; haber: number }> = {};
    const bType = currentCompany.businessType || 'COMERCIAL';

    // 1. Elimination of Cost of Sales (69)
    const cta69Balance = initialRows.filter(r => r.cta.startsWith('69')).reduce((sum, r) => sum + (r.debe - r.haber), 0);
    if (cta69Balance !== 0) {
      // Credit 69
      initialRows.filter(r => r.cta.startsWith('69')).forEach(r => {
        const bal = r.debe - r.haber;
        autoAdjusts[r.cta] = { debe: 0, haber: bal };
      });
      // Debit 61 or 71
      const targetCta = bType === 'COMERCIAL' ? '6111' : '7111';
      autoAdjusts[targetCta] = { 
        debe: (autoAdjusts[targetCta]?.debe || 0) + Math.abs(cta69Balance), 
        haber: (autoAdjusts[targetCta]?.haber || 0) 
      };
    }

    // 2. Elimination of Destination (79 vs 9x)
    const cta79Balance = initialRows.filter(r => r.cta.startsWith('79')).reduce((sum, r) => sum + (r.debe - r.haber), 0);
    if (cta79Balance !== 0) {
      // Debit 79
      initialRows.filter(r => r.cta.startsWith('79')).forEach(r => {
        const bal = r.haber - r.debe;
        autoAdjusts[r.cta] = { debe: bal, haber: 0 };
      });
      // Credit Element 9 accounts
      initialRows.filter(r => r.cta.startsWith('9')).forEach(r => {
        const bal = r.debe - r.haber;
        autoAdjusts[r.cta] = { 
          debe: (autoAdjusts[r.cta]?.debe || 0), 
          haber: (autoAdjusts[r.cta]?.haber || 0) + bal 
        };
      });
    }

    // Combine manual and automatic adjustments
    const finalAdjusts = { ...autoAdjusts };
    Object.keys(hhttAdjustments).forEach(cta => {
      finalAdjusts[cta] = {
        debe: (finalAdjusts[cta]?.debe || 0) + (hhttAdjustments[cta]?.debe || 0),
        haber: (finalAdjusts[cta]?.haber || 0) + (hhttAdjustments[cta]?.haber || 0),
      };
    });

    // Ensure all accounts in adjustments exist in rows
    Object.keys(finalAdjusts).forEach(cta => {
      if (!rolledUpMap[cta]) {
        const planAcc = plan.find(p => p.cta === cta);
        rolledUpMap[cta] = {
          cta,
          desc: planAcc ? planAcc.description : `Cta. Ajuste ${cta}`,
          debe: 0,
          haber: 0,
        };
      }
    });

    return Object.values(rolledUpMap).map(row => {
      const deudor = row.debe > row.haber ? row.debe - row.haber : 0;
      const acreedor = row.haber > row.debe ? row.haber - row.debe : 0;

      const adjDebe = finalAdjusts[row.cta]?.debe || 0;
      const adjHaber = finalAdjusts[row.cta]?.haber || 0;

      const netAdjDebe = deudor + adjDebe;
      const netAdjHaber = acreedor + adjHaber;
      const adjDeudor = netAdjDebe > netAdjHaber ? netAdjDebe - netAdjHaber : 0;
      const adjAcreedor = netAdjHaber > netAdjDebe ? netAdjHaber - netAdjDebe : 0;

      const classifications = classifyAccount(row.cta, bType);

      // Logical distribution for Nature/Function based on accounting principles
      let pNat = 0, gNat = 0, pFun = 0, gFun = 0;

      if (classifications.includes('NATURALEZA')) {
        pNat = adjDeudor;
        gNat = adjAcreedor;
      }
      if (classifications.includes('FUNCION')) {
        // Special case for 69, 79, 9x in Function
        // Function results use the UNADJUSTED balances for 69 and 9x
        if (row.cta.startsWith('69') || row.cta.startsWith('9')) {
          pFun = deudor;
        } else if (row.cta.startsWith('70')) {
          gFun = acreedor;
        } else if (row.cta.startsWith('79')) {
          // 79 is cancelled out, shouldn't show in either if properly adjusted
          pFun = 0; gFun = 0;
        } else {
          pFun = adjDeudor;
          gFun = adjAcreedor;
        }
      }

      return {
        ...row,
        deudor, acreedor,
        adjDebe, adjHaber,
        adjDeudor, adjAcreedor,
        activo: classifications.includes('INVENTARIO') ? adjDeudor : 0,
        pasivo: classifications.includes('INVENTARIO') ? adjAcreedor : 0,
        perdidaNaturaleza: pNat,
        gananciaNaturaleza: gNat,
        perdidaFuncion: pFun,
        gananciaFuncion: gFun,
      };
    }).sort((a, b) => a.cta.localeCompare(b.cta));
  }, [journal, plan, hhttAdjustments, digits, currentCompany.businessType]);

  // ─── Totales ───
  const totals = rows.reduce((acc, row) => ({
    debe: acc.debe + row.debe,
    haber: acc.haber + row.haber,
    deudor: acc.deudor + row.deudor,
    acreedor: acc.acreedor + row.acreedor,
    adjDebe: acc.adjDebe + row.adjDebe,
    adjHaber: acc.adjHaber + row.adjHaber,
    adjDeudor: acc.adjDeudor + row.adjDeudor,
    adjAcreedor: acc.adjAcreedor + row.adjAcreedor,
    activo: acc.activo + row.activo,
    pasivo: acc.pasivo + row.pasivo,
    perdidaNaturaleza: acc.perdidaNaturaleza + row.perdidaNaturaleza,
    gananciaNaturaleza: acc.gananciaNaturaleza + row.gananciaNaturaleza,
    perdidaFuncion: acc.perdidaFuncion + row.perdidaFuncion,
    gananciaFuncion: acc.gananciaFuncion + row.gananciaFuncion,
  }), {
    debe: 0, haber: 0, deudor: 0, acreedor: 0,
    adjDebe: 0, adjHaber: 0, adjDeudor: 0, adjAcreedor: 0,
    activo: 0, pasivo: 0,
    perdidaNaturaleza: 0, gananciaNaturaleza: 0,
    perdidaFuncion: 0, gananciaFuncion: 0,
  });

  // ─── Utilidad / Pérdida del Ejercicio (balancing row) ───
  const invDiff = Math.abs(totals.activo - totals.pasivo);
  const invUtilidadActivo = totals.activo < totals.pasivo ? invDiff : 0;   // Pérdida → goes in Activo to balance
  const invUtilidadPasivo = totals.activo > totals.pasivo ? invDiff : 0;   // Utilidad → goes in Pasivo to balance

  const natDiff = Math.abs(totals.perdidaNaturaleza - totals.gananciaNaturaleza);
  const natUtilidadPerdida = totals.gananciaNaturaleza > totals.perdidaNaturaleza ? natDiff : 0; // Utilidad → goes in Pérdida to balance
  const natUtilidadGanancia = totals.perdidaNaturaleza > totals.gananciaNaturaleza ? natDiff : 0; // Pérdida → goes in Ganancia to balance

  const funDiff = Math.abs(totals.perdidaFuncion - totals.gananciaFuncion);
  const funUtilidadPerdida = totals.gananciaFuncion > totals.perdidaFuncion ? funDiff : 0;
  const funUtilidadGanancia = totals.perdidaFuncion > totals.gananciaFuncion ? funDiff : 0;

  // Validation checks
  const sumasBalanced = Math.abs(totals.debe - totals.haber) < 0.01;
  const saldosBalanced = Math.abs(totals.deudor - totals.acreedor) < 0.01;
  const adjSaldosBalanced = Math.abs(totals.adjDeudor - totals.adjAcreedor) < 0.01;

  // After adding utilidad, each pair should balance
  const invBalanced = Math.abs((totals.activo + invUtilidadActivo) - (totals.pasivo + invUtilidadPasivo)) < 0.01;
  const natBalanced = Math.abs((totals.perdidaNaturaleza + natUtilidadPerdida) - (totals.gananciaNaturaleza + natUtilidadGanancia)) < 0.01;
  const funBalanced = Math.abs((totals.perdidaFuncion + funUtilidadPerdida) - (totals.gananciaFuncion + funUtilidadGanancia)) < 0.01;

  const handleExportExcel = () => {
    const mainRows = rows.map(r => ({
      cta: r.cta,
      desc: r.desc.toUpperCase(),
      debe: r.debe || 0,
      haber: r.haber || 0,
      deudor: r.deudor || 0,
      acreedor: r.acreedor || 0,
      adjDebe: r.adjDebe || 0,
      adjHaber: r.adjHaber || 0,
      adjDeudor: r.adjDeudor || 0,
      adjAcreedor: r.adjAcreedor || 0,
      activo: r.activo || 0,
      pasivo: r.pasivo || 0,
      perdidaNaturaleza: r.perdidaNaturaleza || 0,
      gananciaNaturaleza: r.gananciaNaturaleza || 0,
      perdidaFuncion: r.perdidaFuncion || 0,
      gananciaFuncion: r.gananciaFuncion || 0
    }));

    mainRows.push({
      cta: '',
      desc: 'UTILIDAD / PÉRDIDA DEL EJERCICIO',
      debe: 0,
      haber: 0,
      deudor: 0,
      acreedor: 0,
      adjDebe: 0,
      adjHaber: 0,
      adjDeudor: 0,
      adjAcreedor: 0,
      activo: invUtilidadActivo,
      pasivo: invUtilidadPasivo,
      perdidaNaturaleza: natUtilidadPerdida,
      gananciaNaturaleza: natUtilidadGanancia,
      perdidaFuncion: funUtilidadPerdida,
      gananciaFuncion: funUtilidadGanancia
    });

    exportSingleSheet({
      sheetName: 'Bal. Comprobación',
      title: `BALANCE DE COMPROBACIÓN - HOJA DE TRABAJO (NIVEL: ${digits} DÍGITOS)`,
      columns: [
        { header: 'CUENTA', key: 'cta', width: 12, alignment: 'center' },
        { header: 'DENOMINACIÓN', key: 'desc', width: 35 },
        { header: 'SUMAS DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'SUMAS HABER', key: 'haber', width: 16, style: 'currency' },
        { header: 'SALDO DEUDOR', key: 'deudor', width: 16, style: 'currency' },
        { header: 'SALDO ACREEDOR', key: 'acreedor', width: 16, style: 'currency' },
        { header: 'AJUSTE DEBE', key: 'adjDebe', width: 14, style: 'currency' },
        { header: 'AJUSTE HABER', key: 'adjHaber', width: 14, style: 'currency' },
        { header: 'AJUSTADO DEUDOR', key: 'adjDeudor', width: 16, style: 'currency' },
        { header: 'AJUSTADO ACREEDOR', key: 'adjAcreedor', width: 16, style: 'currency' },
        { header: 'ACTIVO', key: 'activo', width: 16, style: 'currency' },
        { header: 'PASIVO', key: 'pasivo', width: 16, style: 'currency' },
        { header: 'PÉRDIDA NAT.', key: 'perdidaNaturaleza', width: 16, style: 'currency' },
        { header: 'GANANCIA NAT.', key: 'gananciaNaturaleza', width: 16, style: 'currency' },
        { header: 'PÉRDIDA FUN.', key: 'perdidaFuncion', width: 16, style: 'currency' },
        { header: 'GANANCIA FUN.', key: 'gananciaFuncion', width: 16, style: 'currency' }
      ],
      rows: mainRows,
      totals: {
        cta: '',
        desc: 'TOTALES FINALES',
        debe: totals.debe,
        haber: totals.haber,
        deudor: totals.deudor,
        acreedor: totals.acreedor,
        adjDebe: totals.adjDebe,
        adjHaber: totals.adjHaber,
        adjDeudor: totals.adjDeudor,
        adjAcreedor: totals.adjAcreedor,
        activo: totals.activo + invUtilidadActivo,
        pasivo: totals.pasivo + invUtilidadPasivo,
        perdidaNaturaleza: totals.perdidaNaturaleza + natUtilidadPerdida,
        gananciaNaturaleza: totals.gananciaNaturaleza + natUtilidadGanancia,
        perdidaFuncion: totals.perdidaFuncion + funUtilidadPerdida,
        gananciaFuncion: totals.gananciaFuncion + funUtilidadGanancia
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: currentCompany?.period || String(new Date().getFullYear()),
      }
    }, `Balance_Comprobacion_${digits}_Digitos`);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Scale size={18} />}
        title="Balance de Comprobación"
        badge={<span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">{currentCompany.businessType || 'COMERCIAL'}</span>}
        subtitle={`Periodo: ${currentCompany.period || '2025'} • RUC: ${currentCompany.ruc}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
             {/* Validation Badges */}
             <div className="flex items-center gap-1.5">
               <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${sumasBalanced ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                 {sumasBalanced ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                 Sumas
               </div>
               <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${saldosBalanced ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                 {saldosBalanced ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                 Saldos
               </div>
               <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold uppercase ${adjSaldosBalanced ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                 {adjSaldosBalanced ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                 Ajustado
               </div>
             </div>

             <div className="flex items-center gap-2">
               <label className="text-[9px] font-bold text-app-muted uppercase">Nivel</label>
               <select
                 className="bg-app-bg border border-app-border rounded-lg px-2 py-1 text-[10px] font-bold h-8"
                 value={digits}
                 onChange={(e) => setDigits(Number(e.target.value))}
               >
                 <option value={100}>Todas Analíticas</option>
                 <option value={8}>8 Dígitos</option>
                 <option value={6}>6 Dígitos</option>
                 <option value={4}>4 Dígitos</option>
                 <option value={2}>2 Dígitos</option>
                 <option value={1}>1 Dígito (Clase)</option>
               </select>
             </div>
             <button onClick={() => window.print()} className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-pld-blue transition-colors text-app-muted" title="Imprimir"><Printer size={14} /></button>
             <button onClick={handleExportExcel} className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-pld-blue transition-colors text-app-muted" title="Excel"><FileDown size={14} /></button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      <StaleWarningBanner
        moduleName="hhtt"
        isStale={isStale}
        staleSince={staleSince}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />

      {/* High-Density Table */}
      <div className="flex-1 overflow-auto p-2 custom-scrollbar">
        <div className="min-w-[2100px] border border-app-border bg-app-surface rounded-sm shadow-xl">
          <table id="hhtt-table" className="w-full text-left border-collapse table-fixed">
            <thead>
              {/* Row 1: Group Headers */}
              <tr className="bg-app-surface text-[9px] font-black uppercase tracking-tighter text-app-text">
                <th rowSpan={2} className="p-1 border border-app-border text-center w-16">CUENTA</th>
                <th rowSpan={2} className="p-1 border border-app-border text-center w-44">DENOMINACIÓN</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-blue-600/5">SUMAS DEL MAYOR</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-indigo-600/5">SALDOS</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-app-hover text-app-muted">AJUSTES</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-violet-600/5">SALDO AJUSTADO</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-emerald-600/5">INVENTARIO</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-amber-600/5">RESULTADO NAT.</th>
                <th colSpan={2} className="p-1 border border-app-border text-center bg-rose-600/5">RESULTADO FUNC.</th>
              </tr>
              {/* Row 2: Sub-headers */}
              <tr className="bg-app-surface text-[8px] font-black uppercase tracking-tighter text-app-text">
                <th className="p-1 border border-app-border text-center w-[90px] bg-blue-600/5">DEBE</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-blue-600/5">HABER</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-indigo-600/5">DEUDOR</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-indigo-600/5">ACREEDOR</th>
                <th className="p-1 border border-app-border text-center w-[80px] bg-app-hover text-app-muted">D</th>
                <th className="p-1 border border-app-border text-center w-[80px] bg-app-hover text-app-muted">H</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-violet-600/5">DEUDOR</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-violet-600/5">ACREEDOR</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-emerald-600/5 text-emerald-600 dark:text-emerald-400">ACTIVO</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-emerald-600/5 text-red-600 dark:text-red-400">PASIVO</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-amber-600/5 text-red-500">PÉRDIDA</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-amber-600/5 text-emerald-500">GANANCIA</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-rose-600/5 text-red-500">PÉRDIDA</th>
                <th className="p-1 border border-app-border text-center w-[90px] bg-rose-600/5 text-emerald-500">GANANCIA</th>
              </tr>
            </thead>
            <tbody className="text-[10px] font-mono">
              {rows.map((row, i) => {
                const classifications = classifyAccount(row.cta, currentCompany.businessType || 'COMERCIAL');
                const isInv = classifications.includes('INVENTARIO');
                const isNat = classifications.includes('NATURALEZA');
                const isFun = classifications.includes('FUNCION');
                
                let borderClass = 'border-l-2 border-l-app-border';
                if (isInv) borderClass = 'border-l-2 border-l-emerald-500/30';
                else if (isNat && isFun) borderClass = 'border-l-2 border-l-indigo-500/30';
                else if (isNat) borderClass = 'border-l-2 border-l-amber-500/30';
                else if (isFun) borderClass = 'border-l-2 border-l-rose-500/30';

                return (
                  <tr key={i} className={`hover:bg-app-hover transition-colors border-b border-app-border/50 ${borderClass}`}>
                    <td className="p-1 border-r border-app-border/50 text-center font-bold text-pld-blue">{row.cta}</td>
                    <td className="p-1 border-r border-app-border/50 uppercase truncate px-2 font-sans text-[9px]">{row.desc}</td>

                    {/* Sumas del Mayor */}
                    <td className="p-1 border-r border-app-border/50 text-right bg-blue-600/[0.02]">{fmtAlways(row.debe)}</td>
                    <td className="p-1 border-r border-app-border/50 text-right bg-blue-600/[0.02]">{fmtAlways(row.haber)}</td>

                    {/* Saldos */}
                    <td className="p-1 border-r border-app-border/50 text-right font-bold text-pld-blue">{fmt(row.deudor)}</td>
                    <td className="p-1 border-r border-app-border/50 text-right font-bold text-red-500">{fmt(row.acreedor)}</td>

                    {/* Ajustes (editable) */}
                    <td className="p-0 border-r border-app-border/50 bg-app-hover/30">
                      <input type="number"
                        className="w-full h-full min-h-[24px] bg-transparent text-right outline-none px-1 text-app-muted focus:text-app-text text-[10px] font-mono"
                        value={row.adjDebe || ''}
                        onChange={e => handleAdjust(row.cta, 'debe', e.target.value)} />
                    </td>
                    <td className="p-0 border-r border-app-border/50 bg-app-hover/30">
                      <input type="number"
                        className="w-full h-full min-h-[24px] bg-transparent text-right outline-none px-1 text-app-muted focus:text-app-text text-[10px] font-mono"
                        value={row.adjHaber || ''}
                        onChange={e => handleAdjust(row.cta, 'haber', e.target.value)} />
                    </td>

                    {/* Saldo Ajustado */}
                    <td className="p-1 border-r border-app-border/50 text-right font-bold text-pld-blue bg-violet-600/[0.02]">{fmt(row.adjDeudor)}</td>
                    <td className="p-1 border-r border-app-border/50 text-right font-bold text-red-500 bg-violet-600/[0.02]">{fmt(row.adjAcreedor)}</td>

                    {/* Inventario */}
                    <td className="p-1 border-r border-app-border/50 text-right text-emerald-600 dark:text-emerald-400 bg-emerald-600/[0.02]">{fmt(row.activo)}</td>
                    <td className="p-1 border-r border-app-border/50 text-right text-red-600 dark:text-red-400 bg-emerald-600/[0.02]">{fmt(row.pasivo)}</td>

                    {/* Naturaleza */}
                    <td className="p-1 border-r border-app-border/50 text-right text-red-500 bg-amber-600/[0.02]">{fmt(row.perdidaNaturaleza)}</td>
                    <td className="p-1 border-r border-app-border/50 text-right text-emerald-500 bg-amber-600/[0.02]">{fmt(row.gananciaNaturaleza)}</td>

                    {/* Función */}
                    <td className="p-1 border-r border-app-border/50 text-right text-red-500 bg-rose-600/[0.02]">{fmt(row.perdidaFuncion)}</td>
                    <td className="p-1 border-r border-app-border/50 text-right text-emerald-500 bg-rose-600/[0.02]">{fmt(row.gananciaFuncion)}</td>
                  </tr>
                );
              })}

              {/* Empty rows placeholder */}
              {rows.length === 0 && Array.from({ length: 15 }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-app-border/50 h-7 opacity-20">
                   {Array.from({ length: 16 }).map((_, j) => <td key={j} className="border-r border-app-border/50"></td>)}
                </tr>
              ))}
            </tbody>

            <tfoot className="sticky bottom-0 bg-app-surface shadow-[0_-5px_15px_rgba(0,0,0,0.1)]">
               {/* TOTALES Row */}
               <tr className="text-[10px] font-black border-t-2 border-app-border">
                  <td colSpan={2} className="p-2 text-right text-pld-blue uppercase tracking-widest text-[9px]">TOTALES S/</td>
                  {/* Sumas */}
                  <td className="p-2 text-right border-l border-app-border">{fmtAlways(totals.debe)}</td>
                  <td className="p-2 text-right border-l border-app-border">{fmtAlways(totals.haber)}</td>
                  {/* Saldos */}
                  <td className="p-2 text-right border-l border-app-border text-pld-blue">{fmtAlways(totals.deudor)}</td>
                  <td className="p-2 text-right border-l border-app-border text-red-500">{fmtAlways(totals.acreedor)}</td>
                  {/* Ajustes */}
                  <td className={`p-2 text-right border-l border-app-border ${totals.adjDebe !== totals.adjHaber ? 'text-red-500' : 'text-app-muted'}`}>
                    {fmtAlways(totals.adjDebe)}
                  </td>
                  <td className={`p-2 text-right border-l border-app-border ${totals.adjDebe !== totals.adjHaber ? 'text-red-500' : 'text-app-muted'}`}>
                    {fmtAlways(totals.adjHaber)}
                  </td>
                  {/* Saldo Ajustado */}
                  <td className="p-2 text-right border-l border-app-border text-pld-blue">{fmtAlways(totals.adjDeudor)}</td>
                  <td className="p-2 text-right border-l border-app-border text-red-500">{fmtAlways(totals.adjAcreedor)}</td>
                  {/* Inventario */}
                  <td className="p-2 text-right border-l border-app-border text-emerald-600 dark:text-emerald-400">{fmtAlways(totals.activo)}</td>
                  <td className="p-2 text-right border-l border-app-border text-red-600 dark:text-red-400">{fmtAlways(totals.pasivo)}</td>
                  {/* Naturaleza */}
                  <td className="p-2 text-right border-l border-app-border text-red-500">{fmtAlways(totals.perdidaNaturaleza)}</td>
                  <td className="p-2 text-right border-l border-app-border text-emerald-500">{fmtAlways(totals.gananciaNaturaleza)}</td>
                  {/* Función */}
                  <td className="p-2 text-right border-l border-app-border text-red-500">{fmtAlways(totals.perdidaFuncion)}</td>
                  <td className="p-2 text-right border-l border-app-border text-emerald-500">{fmtAlways(totals.gananciaFuncion)}</td>
               </tr>

               {/* UTILIDAD / PÉRDIDA DEL EJERCICIO Row */}
               {rows.length > 0 && (
                 <tr className="text-[10px] bg-pld-blue/5 font-black text-pld-blue border-t border-app-border">
                    <td colSpan={10} className="p-2 text-right uppercase tracking-widest text-[9px] italic">
                      Utilidad / Pérdida del Ejercicio
                    </td>
                    {/* Inventario balancing */}
                    <td className="p-2 text-right border-l border-app-border text-emerald-600 dark:text-emerald-400">
                      {invUtilidadActivo > 0 ? fmtAlways(invUtilidadActivo) : '-'}
                    </td>
                    <td className="p-2 text-right border-l border-app-border text-red-600 dark:text-red-400">
                      {invUtilidadPasivo > 0 ? fmtAlways(invUtilidadPasivo) : '-'}
                    </td>
                    {/* Naturaleza balancing */}
                    <td className="p-2 text-right border-l border-app-border text-red-500">
                      {natUtilidadPerdida > 0 ? fmtAlways(natUtilidadPerdida) : '-'}
                    </td>
                    <td className="p-2 text-right border-l border-app-border text-emerald-500">
                      {natUtilidadGanancia > 0 ? fmtAlways(natUtilidadGanancia) : '-'}
                    </td>
                    {/* Función balancing */}
                    <td className="p-2 text-right border-l border-app-border text-red-500">
                      {funUtilidadPerdida > 0 ? fmtAlways(funUtilidadPerdida) : '-'}
                    </td>
                    <td className="p-2 text-right border-l border-app-border text-emerald-500">
                      {funUtilidadGanancia > 0 ? fmtAlways(funUtilidadGanancia) : '-'}
                    </td>
                 </tr>
               )}

               {/* TOTALES FINALES (balanced) Row */}
               {rows.length > 0 && (
                 <tr className="text-[10px] bg-app-hover font-black border-t-2 border-pld-blue/50">
                    <td colSpan={10} className="p-2 text-right uppercase tracking-[0.3em] text-pld-blue text-[9px]">
                      TOTALES FINALES
                    </td>
                    {/* Inventario final */}
                    <td className={`p-2 text-right border-l border-app-border font-black underline decoration-double ${invBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      {fmtAlways(totals.activo + invUtilidadActivo)}
                    </td>
                    <td className={`p-2 text-right border-l border-app-border font-black underline decoration-double ${invBalanced ? 'text-red-600 dark:text-red-400' : 'text-red-500'}`}>
                      {fmtAlways(totals.pasivo + invUtilidadPasivo)}
                    </td>
                    {/* Naturaleza final */}
                    <td className={`p-2 text-right border-l border-app-border font-black underline decoration-double ${natBalanced ? 'text-red-500' : 'text-orange-500'}`}>
                      {fmtAlways(totals.perdidaNaturaleza + natUtilidadPerdida)}
                    </td>
                    <td className={`p-2 text-right border-l border-app-border font-black underline decoration-double ${natBalanced ? 'text-emerald-500' : 'text-orange-500'}`}>
                      {fmtAlways(totals.gananciaNaturaleza + natUtilidadGanancia)}
                    </td>
                    {/* Función final */}
                    <td className={`p-2 text-right border-l border-app-border font-black underline decoration-double ${funBalanced ? 'text-red-500' : 'text-orange-500'}`}>
                      {fmtAlways(totals.perdidaFuncion + funUtilidadPerdida)}
                    </td>
                    <td className={`p-2 text-right border-l border-app-border font-black underline decoration-double ${funBalanced ? 'text-emerald-500' : 'text-orange-500'}`}>
                      {fmtAlways(totals.gananciaFuncion + funUtilidadGanancia)}
                    </td>
                 </tr>
               )}
            </tfoot>
          </table>
        </div>

        </div>
      </div>
    </div>
  </div>
  );
};

export default HHTTView;
