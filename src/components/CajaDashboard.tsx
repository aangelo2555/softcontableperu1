import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { 
  TrendingUp, 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calculator
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportSingleSheet } from '../utils/excelExport';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Reutilizamos el EditableCell del dashboard fiscal por consistencia
const EditableCell: React.FC<{ 
  value: number; 
  onSave: (val: number) => void; 
  isOverride?: boolean;
  onReset?: () => void;
  className?: string;
}> = ({ value, onSave, isOverride, onReset, className = "" }) => {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value.toString());

  if (editing) {
    return (
      <input 
        autoFocus
        className={`w-full bg-pld-blue/10 text-right p-1 rounded border border-pld-blue/40 outline-none font-mono text-app-text ${className}`}
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={() => {
          const n = parseFloat(temp);
          if (!isNaN(n)) onSave(n);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const n = parseFloat(temp);
            if (!isNaN(n)) onSave(n);
            setEditing(false);
          }
          if (e.key === 'Escape') {
            setTemp(value.toString());
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div 
      className={`group relative cursor-pointer text-right min-h-[20px] transition-all ${isOverride ? 'text-pld-blue font-bold' : 'text-app-text'} ${className}`}
      onClick={() => { setTemp(value.toString()); setEditing(true); }}
    >
      {value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {isOverride && onReset && (
        <button 
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          className="absolute -left-5 top-1 opacity-0 group-hover:opacity-100 p-0 text-app-muted hover:text-rose-500 transition-all"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
};

const CajaDashboard: React.FC = () => {
  const { sales, purchases, currentCompany, movimientosData, upsertMovimientoData, deleteMovimientoData } = useStore();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth());
  const [isAddingCta, setIsAddingCta] = useState<{ section: 'CAJA_I' | 'CAJA_E' | null }>({ section: null });
  const [newCtaValue, setNewCtaValue] = useState('');
  
  const [renamingCta, setRenamingCta] = useState<{ section: 'CAJA_I' | 'CAJA_E', oldCta: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const currentPeriod = currentCompany.period || new Date().getFullYear().toString();

  const handleSave = async (monthNum: number, section: string, key: string, value: number) => {
    await upsertMovimientoData({ month: monthNum, section, key, value });
    toast.success('Cambio guardado en Caja');
  };

  const handleReset = async (monthNum: number, section: string, key: string) => {
    await deleteMovimientoData(monthNum, section, key);
    toast.success('Valor restablecido');
  };

  const handleAddAccountAction = () => {
    if (newCtaValue && /^\d+$/.test(newCtaValue) && isAddingCta.section) {
      handleSave(selectedMonthIndex + 1, isAddingCta.section, newCtaValue, 0);
      setNewCtaValue('');
      setIsAddingCta({ section: null });
    } else if (isAddingCta.section) {
      toast.error('Ingrese un número de cuenta válido');
    }
  };

  const handleDeleteAccount = async (section: 'CAJA_I' | 'CAJA_E', cta: string) => {
    if (!window.confirm(`¿Seguro que desea eliminar la cuenta ${cta} y todo su contenido?`)) return;
    const relevantList = movimientosData.filter(m => m.section === section && m.key === cta && m.period === currentPeriod);
    for (const m of relevantList) {
      await deleteMovimientoData(m.month, m.section, m.key);
    }
    toast.success('Cuenta eliminada');
  };

  const handleRenameAccountConfirm = async () => {
    if (!renamingCta) return;
    const { section, oldCta } = renamingCta;
    const newCta = renameValue.trim();
    
    if (!newCta || newCta === oldCta || !/^\d+$/.test(newCta)) {
       setRenamingCta(null);
       return;
    }
    
    const relevantList = movimientosData.filter(m => m.section === section && m.key === oldCta && m.period === currentPeriod);
    for (const m of relevantList) {
      await upsertMovimientoData({ ...m, key: newCta });
      await deleteMovimientoData(m.month, m.section, oldCta);
    }
    
    setRenamingCta(null);
    setRenameValue('');
    toast.success('Cuenta renombrada');
  };

  const cajaMonthlyData = useMemo(() => {
    const getExtraKeys = (section: string) => {
      return Array.from(new Set(movimientosData
        .filter(m => m.section === section && m.period === currentPeriod)
        .map(m => m.key)
      ));
    };

    const vManualKeys = getExtraKeys('V');
    const vDetectedKeys = Array.from(new Set(sales
      .filter(s => new Date(s.fecha).getFullYear().toString() === currentPeriod)
      .map(s => s.ctaIngreso || '70111')
    ));
    const allVctas = Array.from(new Set([...vManualKeys, ...vDetectedKeys, '70111']));

    const cManualKeys = getExtraKeys('C');
    const cDetectedKeys = Array.from(new Set(purchases
      .filter(p => new Date(p.fecha).getFullYear().toString() === currentPeriod)
      .map(p => p.ctaGasto || '60111')
    ));
    const allCctas = Array.from(new Set([...cManualKeys, ...cDetectedKeys, '60111', '63111']));

    const extraIngresosKeys = getExtraKeys('CAJA_I');
    const extraEgresosKeys = getExtraKeys('CAJA_E');

    // Mapeo inicial de meses
    let prevSaldoFinal = 0;

    return MONTHS.map((name, index) => {
      const monthNum = index + 1;
      
      const filterByMonth = (items: any[]) => items.filter(i => {
        const d = new Date(i.fecha);
        return (d.getMonth() + 1 === monthNum) && (d.getFullYear().toString() === currentPeriod);
      });

      const mSales = filterByMonth(sales);
      const mPurchases = filterByMonth(purchases);

      // --- FISCAL MATH (Mirror of MovimientosDashboard logic) ---
      // 1. Ventas Total (CTA 12)
      const vAccounts: Record<string, number> = {};
      allVctas.forEach(cta => {
        const sysVal = mSales.filter(s => (s.ctaIngreso || '70111') === cta).reduce((acc, s) => acc + s.bi, 0);
        const ovVal = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === cta && m.period === currentPeriod)?.value;
        vAccounts[cta] = ovVal ?? sysVal;
      });
      const sBI = Object.values(vAccounts).reduce((a, b) => a + b, 0);
      const sEXO = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === 'EXO' && m.period === currentPeriod)?.value ?? mSales.reduce((acc, s) => acc + (s.noGravada || 0), 0);
      const sIGV_ov = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === 'IGV' && m.period === currentPeriod)?.value;
      const hasAnyVov = allVctas.some(cta => movimientosData.some(m => m.month === monthNum && m.section === 'V' && m.key === cta && m.period === currentPeriod));
      const sIGV = sIGV_ov ?? (hasAnyVov ? sBI * 0.18 : mSales.reduce((acc, s) => acc + s.igv, 0));
      const sTotal_ov = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === 'TOT' && m.period === currentPeriod)?.value;
      const ingreso12 = sTotal_ov ?? (hasAnyVov || sIGV_ov !== undefined ? sBI + sEXO + sIGV : mSales.reduce((acc, s) => acc + s.total, 0));

      // 2. Compras Total (CTA 42)
      const pAccounts: Record<string, number> = {};
      allCctas.forEach(cta => {
        const sysVal = mPurchases.filter(p => (p.ctaGasto || '60111') === cta).reduce((acc, p) => acc + p.bi, 0);
        const ovVal = movimientosData.find(m => m.month === monthNum && m.section === 'C' && m.key === cta && m.period === currentPeriod)?.value;
        pAccounts[cta] = ovVal ?? sysVal;
      });
      const pBI = Object.values(pAccounts).reduce((a, b) => a + b, 0);
      const pIGV_ov = movimientosData.find(m => m.month === monthNum && m.section === 'C' && m.key === 'IGV' && m.period === currentPeriod)?.value;
      const hasAnyPov = allCctas.some(cta => movimientosData.some(m => m.month === monthNum && m.section === 'C' && m.key === cta && m.period === currentPeriod));
      const pIGV = pIGV_ov ?? (hasAnyPov ? pBI * 0.18 : mPurchases.reduce((acc, p) => acc + p.igv, 0));
      const pTotal_ov = movimientosData.find(m => m.month === monthNum && m.section === 'C' && m.key === 'TOT' && m.period === currentPeriod)?.value;
      const egreso42 = pTotal_ov ?? (hasAnyPov || pIGV_ov !== undefined ? pBI + pIGV : mPurchases.reduce((acc, p) => acc + p.total, 0));

      // --- 1. SALDO INICIAL ---
      const manualSaldoI = movimientosData.find(m => m.month === monthNum && m.section === 'CAJA' && m.key === 'SALDO_I' && m.period === currentPeriod)?.value;
      const saldoInicial = (monthNum === 1) ? (manualSaldoI ?? 0) : (manualSaldoI !== undefined ? manualSaldoI : prevSaldoFinal);

      // --- 2. INGRESOS EXTRAS ---
      const extrasIngresos: Record<string, number> = {};
      extraIngresosKeys.forEach(k => {
        extrasIngresos[k] = movimientosData.find(m => m.month === monthNum && m.section === 'CAJA_I' && m.key === k && m.period === currentPeriod)?.value ?? 0;
      });

      const totalIngresos = ingreso12 + Object.values(extrasIngresos).reduce((a, b) => a + b, 0);
      const saldoDisponible = saldoInicial + totalIngresos;

      // --- 3. EGRESOS EXTRAS Y TAXES ---
      const pdtV = movimientosData.find(m => m.month === monthNum && m.section === 'PDT' && m.key === 'V' && m.period === currentPeriod)?.value ?? 0;
      const pdtC = movimientosData.find(m => m.month === monthNum && m.section === 'PDT' && m.key === 'C' && m.period === currentPeriod)?.value ?? 0;
      const pdtIGV = (pdtV !== 0 || pdtC !== 0) ? Math.max(0, pdtV - pdtC) : Math.max(0, sIGV - pIGV);
      const rentaManual = movimientosData.find(m => m.month === monthNum && m.section === 'R' && m.key === 'VAL' && m.period === currentPeriod)?.value;
      const isMYPE = currentCompany.regimenTributario === 'MYPE';
      const mypeRate = (currentCompany.annualIncomeUIT || 0) <= 300 ? 0.01 : 0.015;
      const calcRenta = rentaManual ?? (sBI * (isMYPE ? mypeRate : 0.015));

      const extrasEgresos: Record<string, number> = {};
      extraEgresosKeys.forEach(k => {
        extrasEgresos[k] = movimientosData.find(m => m.month === monthNum && m.section === 'CAJA_E' && m.key === k && m.period === currentPeriod)?.value ?? 0;
      });

      const totalEgresos = egreso42 + pdtIGV + calcRenta + Object.values(extrasEgresos).reduce((a, b) => a + b, 0);
      const saldoFinal = saldoDisponible - totalEgresos;

      // Guardar para el siguiente mes
      prevSaldoFinal = saldoFinal;

      return {
        monthNum, name,
        saldoInicial,
        ingresos: { total: totalIngresos, cta12: ingreso12, extras: extrasIngresos },
        saldoDisponible,
        egresos: { total: totalEgresos, cta42: egreso42, igv: pdtIGV, renta: calcRenta, extras: extrasEgresos },
        saldoFinal,
        isSaldoIOv: manualSaldoI !== undefined
      };
    });
  }, [sales, purchases, currentCompany, movimientosData, currentPeriod]);

  const totals = useMemo(() => {
    return cajaMonthlyData.reduce((acc, m) => ({
      ingresos: acc.ingresos + m.ingresos.total,
      egresos: acc.egresos + m.egresos.total
    }), { ingresos: 0, egresos: 0 });
  }, [cajaMonthlyData]);

  const format = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleExportExcel = () => {
    const rowsFormatted = cajaMonthlyData.map(m => ({
      Mes: m.name.toUpperCase(),
      saldoInicial: m.saldoInicial,
      ingresos12: m.ingresos.cta12,
      totalIngresos: m.ingresos.total,
      saldoDisponible: m.saldoDisponible,
      egresos42: m.egresos.cta42,
      impuestos: m.egresos.igv + m.egresos.renta,
      totalEgresos: m.egresos.total,
      saldoFinal: m.saldoFinal
    }));

    exportSingleSheet({
      sheetName: 'Caja Fiscal',
      title: `FLUJO DE CAJA FISCAL - CASH FLOW (PERIODO: ${currentPeriod})`,
      columns: [
        { header: 'MES', key: 'Mes', width: 12, alignment: 'center' },
        { header: 'SALDO INICIAL', key: 'saldoInicial', width: 18, style: 'currency' },
        { header: 'INGRESOS CTA 12', key: 'ingresos12', width: 18, style: 'currency' },
        { header: 'TOTAL INGRESOS', key: 'totalIngresos', width: 18, style: 'currency' },
        { header: 'SALDO DISPONIBLE', key: 'saldoDisponible', width: 20, style: 'currency' },
        { header: 'EGRESOS CTA 42', key: 'egresos42', width: 18, style: 'currency' },
        { header: 'IMPUESTOS (IGV+RENTA)', key: 'impuestos', width: 22, style: 'currency' },
        { header: 'TOTAL EGRESOS', key: 'totalEgresos', width: 18, style: 'currency' },
        { header: 'SALDO FINAL', key: 'saldoFinal', width: 20, style: 'currency' }
      ],
      rows: rowsFormatted,
      totals: {
        Mes: 'TOTAL GENERAL',
        saldoInicial: cajaMonthlyData[0].saldoInicial,
        ingresos12: cajaMonthlyData.reduce((a, b) => a + b.ingresos.cta12, 0),
        totalIngresos: totals.ingresos,
        saldoDisponible: cajaMonthlyData[11].saldoDisponible,
        egresos42: cajaMonthlyData.reduce((a, b) => a + b.egresos.cta42, 0),
        impuestos: cajaMonthlyData.reduce((a, b) => a + (b.egresos.igv + b.egresos.renta), 0),
        totalEgresos: totals.egresos,
        saldoFinal: cajaMonthlyData[11].saldoFinal
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: String(currentPeriod),
      }
    }, `Flujo_Caja_${currentCompany.ruc}_${currentPeriod}`);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10 h-full overflow-y-auto bg-app-bg custom-scrollbar animate-fade-in print:bg-white print:p-0">
      
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-app-text flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 text-white"><Wallet size={24} /></div>
            Flujo de Caja Fiscal (Cash Flow)
          </h1>
          <p className="text-xs font-bold text-app-muted mt-1 uppercase tracking-widest">{currentCompany.name} • {currentPeriod}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportExcel} className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2 text-[10px] font-black uppercase">
            <FileSpreadsheet size={16} /> Exportar Caja
          </button>
          <button onClick={() => window.print()} className="p-2.5 bg-app-surface border border-app-border text-app-text rounded-xl shadow-sm hover:scale-105 transition-all flex items-center gap-2 text-[10px] font-black uppercase">
            <FileText size={16} /> Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* INGRESOS SECTION */}
        <div className="bg-app-surface rounded-3xl shadow-sm border border-app-border overflow-hidden">
          <div className="p-4 bg-app-bg border-b border-app-border flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2"><ArrowUpRight size={16} /> Ingresos y Disponibilidad</h2>
            <div className="flex gap-2">
              {isAddingCta.section === 'CAJA_I' ? (
                <div className="flex items-center gap-1">
                  <input autoFocus type="text" placeholder="CTA..." className="p-1 px-2 border border-emerald-400 rounded-lg text-[10px] w-24" value={newCtaValue} onChange={e => setNewCtaValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAccountAction()} />
                  <button onClick={handleAddAccountAction} className="p-1 px-2 bg-emerald-600 text-white rounded-lg text-[10px] uppercase font-black">OK</button>
                  <button onClick={() => setIsAddingCta({ section: null })} className="p-1 px-2 bg-app-muted/50 text-app-text rounded-lg text-[10px] uppercase font-black">X</button>
                </div>
              ) : (
                <button onClick={() => setIsAddingCta({ section: 'CAJA_I' })} className="p-1 px-3 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-emerald-700 transition-all print:hidden">
                  <Plus size={12} /> Añadir Cuenta Ingreso
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse font-mono text-[11px]">
              <thead>
                <tr className="bg-app-bg text-app-muted uppercase text-[10px] font-black">
                  <th className="p-3 text-left pl-6 sticky left-0 bg-app-bg z-10 w-40 border-r border-app-border">Detalle</th>
                  {MONTHS.map(m => <th key={m} className="p-3 min-w-[100px] text-center">{m}</th>)}
                  <th className="p-3 pr-6 bg-emerald-500/10 text-emerald-500">TOTALES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                <tr className="bg-indigo-500/10 font-bold">
                  <td className="p-3 pl-6 text-left text-indigo-500 sticky left-0 bg-indigo-500/10 z-10 border-r border-app-border">SALDO INICIAL</td>
                  {cajaMonthlyData.map(m => (
                    <td key={m.name} className="p-3">
                      <EditableCell 
                        value={m.saldoInicial} 
                        onSave={v => handleSave(m.monthNum, 'CAJA', 'SALDO_I', v)} 
                        isOverride={m.isSaldoIOv} 
                        onReset={() => handleReset(m.monthNum, 'CAJA', 'SALDO_I')}
                        className="font-black"
                      />
                    </td>
                  ))}
                  <td className="p-3 pr-6 bg-indigo-500/20 text-indigo-500">{format(cajaMonthlyData[0].saldoInicial)}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-left text-app-muted sticky left-0 bg-app-surface z-10 border-r border-app-border font-black">
                    <span>12 <span className="font-normal text-[9px] opacity-60">(VENTAS)</span></span>
                  </td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-3 font-mono font-semibold text-app-text">{format(m.ingresos.cta12)}</td>)}
                  <td className="p-3 pr-6 text-app-text font-black">{format(cajaMonthlyData.reduce((a, b) => a + b.ingresos.cta12, 0))}</td>
                </tr>
                {Object.keys(cajaMonthlyData[0].ingresos.extras).map(k => (
                  <tr key={k} className="hover:bg-app-hover transition-colors group/row">
                    <td className="p-3 pl-6 text-left text-app-muted sticky left-0 bg-app-surface z-10 border-r border-app-border font-black">
                      {renamingCta?.section === 'CAJA_I' && renamingCta.oldCta === k ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                          <input 
                            autoFocus
                            type="text"
                            className="p-1 px-2 border border-emerald-400 rounded-lg text-[10px] w-20 font-bold"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if(e.key === 'Enter') handleRenameAccountConfirm(); if(e.key === 'Escape') setRenamingCta(null); }}
                          />
                          <button onClick={handleRenameAccountConfirm} className="p-1 px-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black">OK</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                           <span>{k}</span>
                           <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity print:hidden">
                             <button onClick={() => { setRenamingCta({ section: 'CAJA_I', oldCta: k }); setRenameValue(k); }} className="text-app-muted hover:text-emerald-500"><Edit2 size={12} /></button>
                             <button onClick={() => handleDeleteAccount('CAJA_I', k)} className="text-app-muted hover:text-red-500"><Trash2 size={12} /></button>
                           </div>
                        </div>
                      )}
                    </td>
                    {cajaMonthlyData.map(m => <td key={m.name} className="p-3"><EditableCell value={m.ingresos.extras[k]} onSave={v => handleSave(m.monthNum, 'CAJA_I', k, v)} isOverride={m.ingresos.extras[k] !== 0} onReset={() => handleReset(m.monthNum, 'CAJA_I', k)} /></td>)}
                    <td className="p-3 pr-6 text-app-text font-black">{format(cajaMonthlyData.reduce((a, b) => a + b.ingresos.extras[k], 0))}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-500/10 font-black text-[12px]">
                  <td className="p-3 pl-6 text-left text-emerald-500 sticky left-0 bg-emerald-500/10 z-10 border-r border-emerald-500/20">SALDO DISPONIBLE</td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-3 text-emerald-500">{format(m.saldoDisponible)}</td>)}
                  <td className="p-3 pr-6 text-emerald-500 bg-emerald-500/20">{format(cajaMonthlyData[11].saldoDisponible)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* EGRESOS SECTION */}
        <div className="bg-app-surface rounded-3xl shadow-sm border border-app-border overflow-hidden">
          <div className="p-4 bg-app-bg border-b border-app-border flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest text-rose-500 flex items-center gap-2"><ArrowDownRight size={16} /> Egresos y Pagos</h2>
            <div className="flex gap-2">
              {isAddingCta.section === 'CAJA_E' ? (
                <div className="flex items-center gap-1">
                  <input autoFocus type="text" placeholder="CTA..." className="p-1 px-2 border border-rose-400 rounded-lg text-[10px] w-24" value={newCtaValue} onChange={e => setNewCtaValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAccountAction()} />
                  <button onClick={handleAddAccountAction} className="p-1 px-2 bg-rose-600 text-white rounded-lg text-[10px] uppercase font-black">OK</button>
                  <button onClick={() => setIsAddingCta({ section: null })} className="p-1 px-2 bg-app-muted/50 text-app-text rounded-lg text-[10px] uppercase font-black">X</button>
                </div>
              ) : (
                <button onClick={() => setIsAddingCta({ section: 'CAJA_E' })} className="p-1 px-3 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-rose-700 transition-all print:hidden">
                  <Plus size={12} /> Añadir Cuenta Egreso
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse font-mono text-[11px]">
              <tbody className="divide-y divide-app-border">
                <tr>
                  <td className="p-3 pl-6 text-left text-app-muted sticky left-0 bg-app-surface z-10 border-r border-app-border font-black">
                    <span>42 <span className="font-normal text-[9px] opacity-60">(COMPRAS)</span></span>
                  </td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-3 font-mono font-semibold text-app-text">{format(m.egresos.cta42)}</td>)}
                  <td className="p-3 pr-6 text-app-text font-black">{format(cajaMonthlyData.reduce((a, b) => a + b.egresos.cta42, 0))}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-left text-amber-500 sticky left-0 bg-app-surface z-10 border-r border-app-border font-black">
                    <span>4011 <span className="font-normal text-[9px] opacity-70">(IGV PDT)</span></span>
                  </td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-3 font-mono font-semibold text-amber-500">{format(m.egresos.igv)}</td>)}
                  <td className="p-3 pr-6 text-amber-500 font-black">{format(cajaMonthlyData.reduce((a, b) => a + b.egresos.igv, 0))}</td>
                </tr>
                <tr>
                  <td className="p-3 pl-6 text-left text-violet-400 sticky left-0 bg-app-surface z-10 border-r border-app-border font-black">
                    <span>4017 <span className="font-normal text-[9px] opacity-70">(RENTA PAC)</span></span>
                  </td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-3 font-mono font-semibold text-violet-400">{format(m.egresos.renta)}</td>)}
                  <td className="p-3 pr-6 text-violet-400 font-black">{format(cajaMonthlyData.reduce((a, b) => a + b.egresos.renta, 0))}</td>
                </tr>
                {Object.keys(cajaMonthlyData[0].egresos.extras).map(k => (
                  <tr key={k} className="hover:bg-app-hover transition-colors group/row">
                    <td className="p-3 pl-6 text-left text-app-muted sticky left-0 bg-app-surface z-10 border-r border-app-border font-black">
                      {renamingCta?.section === 'CAJA_E' && renamingCta.oldCta === k ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                          <input 
                            autoFocus
                            type="text"
                            className="p-1 px-2 border border-rose-400 rounded-lg text-[10px] w-20 font-bold"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if(e.key === 'Enter') handleRenameAccountConfirm(); if(e.key === 'Escape') setRenamingCta(null); }}
                          />
                          <button onClick={handleRenameAccountConfirm} className="p-1 px-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black">OK</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                           <span>{k}</span>
                           <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity print:hidden">
                             <button onClick={() => { setRenamingCta({ section: 'CAJA_E', oldCta: k }); setRenameValue(k); }} className="text-app-muted hover:text-rose-500"><Edit2 size={12} /></button>
                             <button onClick={() => handleDeleteAccount('CAJA_E', k)} className="text-app-muted hover:text-red-500"><Trash2 size={12} /></button>
                           </div>
                        </div>
                      )}
                    </td>
                    {cajaMonthlyData.map(m => <td key={m.name} className="p-3"><EditableCell value={m.egresos.extras[k]} onSave={v => handleSave(m.monthNum, 'CAJA_E', k, v)} isOverride={m.egresos.extras[k] !== 0} onReset={() => handleReset(m.monthNum, 'CAJA_E', k)} /></td>)}
                    <td className="p-3 pr-6 text-app-text font-black">{format(cajaMonthlyData.reduce((a, b) => a + b.egresos.extras[k], 0))}</td>
                  </tr>
                ))}
                <tr className="bg-rose-500/10 font-bold">
                  <td className="p-3 pl-6 text-left text-rose-500 sticky left-0 bg-rose-500/10 z-10 border-r border-rose-500/20 uppercase">Total Egresos</td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-3 text-rose-500 font-black">{format(m.egresos.total)}</td>)}
                  <td className="p-3 pr-6 text-rose-500 bg-rose-500/20">{format(totals.egresos)}</td>
                </tr>
                <tr className="bg-app-surface border-t-2 border-app-border font-black text-[13px]">
                  <td className="p-4 pl-6 text-left sticky left-0 bg-app-surface z-10 border-r border-app-border text-app-text">SALDO SIGUIENTE MES</td>
                  {cajaMonthlyData.map(m => <td key={m.name} className="p-4 text-center text-app-text">{format(m.saldoFinal)}</td>)}
                  <td className="p-4 pr-6 text-pld-blue bg-pld-blue/10">{format(cajaMonthlyData[selectedMonthIndex].saldoFinal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM ANALYSIS */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 italic">Análisis Mensual Detallado</h3>
            <select 
              value={selectedMonthIndex} 
              onChange={e => setSelectedMonthIndex(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-[10px] font-black uppercase text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-pld-blue text-white p-8 rounded-[2rem] shadow-xl shadow-pld-blue/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Resumen Disponibilidad ({MONTHS[selectedMonthIndex]})</p>
                <p className="text-4xl font-black italic tracking-tighter">S/ {format(cajaMonthlyData[selectedMonthIndex].saldoFinal)}</p>
              </div>
              <div className="text-right">
                <Calculator size={40} className="opacity-20 inline-block mb-2" />
                <p className="text-[10px] uppercase font-bold opacity-60">Calculado bajo lógica contable de arrastre</p>
              </div>
           </div>
           
           <div className="bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-sm flex items-center gap-6">
              <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500"><TrendingUp size={32} /></div>
              <div>
                <h3 className="text-sm font-black uppercase text-app-text">Eficiencia de Caja</h3>
                <p className="text-xs text-app-muted font-bold mt-1">Ingresos Totales: S/ {format(totals.ingresos)}</p>
                <p className="text-xs text-app-muted font-bold">Egresos Totales: S/ {format(totals.egresos)}</p>
              </div>
           </div>
        </div>
      </div>

      </div>

      <div className="mt-8 pt-8 border-t border-app-border text-center opacity-40">
        <p className="text-[9px] font-black uppercase tracking-[0.6em] text-app-muted">SoftContable Cashflow Intelligence • Referencia Movimientos Fiscales</p>
      </div>

    </div>
  );
};

export default CajaDashboard;
