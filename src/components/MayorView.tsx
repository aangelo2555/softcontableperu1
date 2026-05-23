import React, { useState, useEffect } from 'react';
import { Printer, FileDown, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import StaleWarningBanner from './shared/StaleWarningBanner';
import toast from 'react-hot-toast';

/**
 * LIBRO MAYOR (Formato 6.1)
 * ══════════════════════════
 * Rediseñado en cuadrícula compacta con saldo acumulado (CONCAR style).
 * Cada cuenta es un card pequeño que muestra movimientos + saldo progresivo.
 */

const MONTHS = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const MayorView: React.FC = () => {
  const { currentCompany, plan, staleVersions, syncStaleVersions, markSynced } = useStore();
  const journal = useStore().journal.filter(entry => entry.cta.trim().toUpperCase() !== 'GLOSA');
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const currentYear = currentCompany.period || '2025';

  // Determine the most common month from journal entries
  const monthCounts: Record<string, number> = {};
  journal.forEach(entry => {
    const parts = entry.fecha.includes('/') ? entry.fecha.split('/') : entry.fecha.split('-');
    const m = entry.fecha.includes('/') ? parts[1] : parts[1];
    if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const dominantMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';
  const monthName = MONTHS[parseInt(dominantMonth, 10)] || 'DICIEMBRE';

  const periodStr = `${currentYear}-${dominantMonth.padStart(2, '0')}`;
  
  useEffect(() => {
    syncStaleVersions(periodStr);
  }, [periodStr, syncStaleVersions]);

  const mayorStale = staleVersions.find((x: any) => x.module === 'mayor');
  const isStale = mayorStale?.is_stale === 1 || mayorStale?.is_stale === true;
  const staleSince = mayorStale?.stale_since;

  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    await markSynced('mayor', periodStr);
    setIsRecalculating(false);
    toast.success('Libro Mayor recalculado con éxito');
  };

  // Group journal entries by account code
  const accountsMap = journal.reduce((acc, entry) => {
    if (!acc[entry.cta]) {
      const planAcc = plan.find(a => a.cta === entry.cta);
      acc[entry.cta] = {
        code: entry.cta,
        desc: planAcc?.description || entry.desc,
        items: []
      };
    }
    acc[entry.cta].items.push({
      fecha: entry.fecha,
      correlativo: entry.asiento,
      glosa: entry.glosa,
      deudor: entry.debe,
      acreedor: entry.haber,
    });
    return acc;
  }, {} as Record<string, { code: string; desc: string; items: { fecha: string; correlativo: string; glosa: string; deudor: number; acreedor: number }[] }>);

  let accounts = Object.values(accountsMap).sort((a, b) => a.code.localeCompare(b.code));

  // Search filter
  if (searchQuery) {
    accounts = accounts.filter(acc =>
      acc.code.includes(searchQuery) ||
      acc.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const toggleCollapse = (code: string) => {
    setCollapsedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const collapseAll = () => setCollapsedAccounts(new Set(accounts.map(a => a.code)));
  const expandAll = () => setCollapsedAccounts(new Set());

  const handleExportExcel = () => {
    const rows: any[] = [];
    let grandDebe = 0;
    let grandHaber = 0;

    accounts.forEach(acc => {
      const totalDeudor = acc.items.reduce((sum, item) => sum + item.deudor, 0);
      const totalAcreedor = acc.items.reduce((sum, item) => sum + item.acreedor, 0);
      
      grandDebe += totalDeudor;
      grandHaber += totalAcreedor;

      rows.push({
        cta: acc.code,
        desc: `[${acc.code}] ${acc.desc.toUpperCase()}`,
        fecha: '',
        cuo: 'APERTURA',
        debe: 0,
        haber: 0,
        saldo: 0
      });

      let running = 0;
      acc.items.forEach(item => {
        running += item.deudor - item.acreedor;
        rows.push({
          cta: '',
          desc: item.glosa.toUpperCase(),
          fecha: item.fecha,
          cuo: item.correlativo,
          debe: item.deudor || 0,
          haber: item.acreedor || 0,
          saldo: running
        });
      });

      rows.push({
        cta: '',
        desc: `TOTAL CUENTA ${acc.code}`,
        fecha: '',
        cuo: '',
        debe: totalDeudor,
        haber: totalAcreedor,
        saldo: totalDeudor - totalAcreedor
      });
      rows.push({ cta: '', desc: '', fecha: '', cuo: '', debe: '', haber: '', saldo: '' });
    });

    exportSingleSheet({
      sheetName: 'Libro Mayor',
      title: `LIBRO MAYOR - FORMATO 6.1 (PERIODO: ${monthName} ${currentYear})`,
      columns: [
        { header: 'CUENTA', key: 'cta', width: 14, alignment: 'center' },
        { header: 'GLOSA / DETALLE', key: 'desc', width: 45 },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'ASIENTO/CUO', key: 'cuo', width: 22, alignment: 'center' },
        { header: 'DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER', key: 'haber', width: 16, style: 'currency' },
        { header: 'SALDO', key: 'saldo', width: 16, style: 'currency' }
      ],
      rows,
      totals: {
        cta: '', desc: 'TOTAL GENERAL MAYOR', fecha: '', cuo: '',
        debe: grandDebe,
        haber: grandHaber,
        saldo: grandDebe - grandHaber
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: `${currentYear}-${dominantMonth}`,
      }
    }, `Libro_Mayor_6_1_${currentYear}_${dominantMonth}`);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-slide-up relative">

      {/* Header / Toolbar */}
      <div className="h-12 px-5 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 toolbar">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pld-blue/10 rounded-lg">
            <Printer size={16} className="text-pld-blue" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-app-text">Libro Mayor (6.1)</h2>
            <div className="flex gap-3 text-[9px] items-center text-app-muted">
               <span>PERIODO: {monthName} {currentYear}</span>
               <span>RUC: {currentCompany.ruc}</span>
               <span className="text-pld-blue font-bold">{accounts.length} CUENTAS</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative group">
             <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-pld-blue transition-colors" />
             <input
               type="text"
               placeholder="Buscar cuenta..."
               className="h-10 pl-11 pr-4 w-56 text-[11px] bg-app-bg border border-app-border rounded-xl outline-none focus:border-pld-blue transition-all shadow-sm"
               style={{ paddingLeft: '2.75rem' }}
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
           </div>
           <button onClick={collapseAll} className="h-8 text-[9px] font-bold uppercase bg-app-bg border border-app-border px-3 rounded-lg hover:text-pld-blue transition-colors">Colapsar</button>
           <button onClick={expandAll} className="h-8 text-[9px] font-bold uppercase bg-app-bg border border-app-border px-3 rounded-lg hover:text-pld-blue transition-colors">Expandir</button>
           <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors text-app-muted" title="Imprimir"><Printer size={14} /></button>
           <button onClick={handleExportExcel} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors text-app-muted" title="Excel"><FileDown size={14} /></button>
        </div>
      </div>

      <StaleWarningBanner
        moduleName="mayor"
        isStale={isStale}
        staleSince={staleSince}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />

      <div id="mayor-container" className="flex-1 overflow-auto p-3 custom-scrollbar">
        {accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-app-muted border border-dashed border-app-border rounded-lg">
             <Printer size={48} className="opacity-10 mb-4" />
             <p className="uppercase tracking-widest text-xs font-black">No hay movimientos mayorizados</p>
             <p className="text-[10px] mt-2 opacity-50">Procese el Registro de Compras o Ventas primero</p>
          </div>
        )}

        {/* Grid Layout: 2 columns */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
          {accounts.map((acc) => {
            const isCollapsed = collapsedAccounts.has(acc.code);
            const totalDeudor = acc.items.reduce((sum, item) => sum + item.deudor, 0);
            const totalAcreedor = acc.items.reduce((sum, item) => sum + item.acreedor, 0);
            const saldoFinal = totalDeudor - totalAcreedor;

            return (
              <div key={acc.code} className="border border-app-border rounded overflow-hidden shadow-sm bg-app-surface">
                {/* Compact Account Header */}
                <div
                  className="flex items-center justify-between px-3 py-1.5 bg-app-hover/50 border-b border-app-border cursor-pointer hover:bg-app-hover transition-colors"
                  onClick={() => toggleCollapse(acc.code)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={12} className="text-app-muted" /> : <ChevronDown size={12} className="text-pld-blue" />}
                    <span className="text-[11px] font-mono font-black text-pld-blue">{acc.code}</span>
                    <span className="text-[10px] uppercase text-app-muted truncate max-w-[250px]">{acc.desc}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono font-bold">
                    <span className="text-pld-blue">{totalDeudor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-red-500">{totalAcreedor.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] ${saldoFinal >= 0 ? 'bg-blue-500/10 text-pld-blue' : 'bg-red-500/10 text-red-500'}`}>
                      S/ {saldoFinal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Detail Table (collapsible) */}
                {!isCollapsed && (
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-app-bg/50 text-[8px] font-black uppercase tracking-tighter text-app-muted">
                          <th className="p-1.5 border-r border-app-border/50 text-center w-20">FECHA</th>
                          <th className="p-1.5 border-r border-app-border/50 text-center w-28">CUO</th>
                          <th className="p-1.5 border-r border-app-border/50">GLOSA</th>
                          <th className="p-1.5 border-r border-app-border/50 text-center w-24">DEUDOR</th>
                          <th className="p-1.5 border-r border-app-border/50 text-center w-24">ACREEDOR</th>
                          <th className="p-1.5 text-center w-24">SALDO</th>
                        </tr>
                     </thead>
                     <tbody className="bg-app-bg/20">
                        {acc.items.map((item, i) => {
                          // Compute running balance (saldo acumulado)
                          const runningBalance = acc.items.slice(0, i + 1).reduce((s, it) => s + it.deudor - it.acreedor, 0);

                          return (
                            <tr key={i} className="text-[10px] font-mono border-b border-app-border/30 hover:bg-app-hover/50">
                              <td className="p-1 border-r border-app-border/30 text-center text-[9px]">{item.fecha}</td>
                              <td className="p-1 border-r border-app-border/30 text-center text-[9px]">{item.correlativo}</td>
                              <td className="p-1 border-r border-app-border/30 uppercase font-sans text-[9px] truncate max-w-[200px]">{item.glosa}</td>
                              <td className="p-1 border-r border-app-border/30 text-right text-pld-blue">{item.deudor > 0 ? item.deudor.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
                              <td className="p-1 border-r border-app-border/30 text-right text-red-500">{item.acreedor > 0 ? item.acreedor.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
                              <td className={`p-1 text-right font-bold ${runningBalance >= 0 ? 'text-pld-blue' : 'text-red-500'}`}>
                                {runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals Row */}
                        <tr className="bg-pld-blue/5 text-pld-blue font-black text-[10px]">
                          <td colSpan={3} className="p-1.5 text-right uppercase tracking-widest text-[8px]">TOTALES S/.</td>
                          <td className="p-1.5 text-right underline decoration-double">
                            {totalDeudor.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-1.5 text-right underline decoration-double text-red-500">
                            {totalAcreedor.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`p-1.5 text-right font-black underline decoration-double ${saldoFinal >= 0 ? 'text-pld-blue' : 'text-red-500'}`}>
                            {saldoFinal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                     </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MayorView;
