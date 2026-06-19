import React from 'react';
import { Book, Printer, FileDown, Trash2, Edit } from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';

const DiarioView: React.FC = () => {
  const store = useStore();
  const { currentCompany, deleteJournalEntry } = store;
  
  const meses = [
    { value: '01', label: 'Enero' },
    { value: '02', label: 'Febrero' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Mayo' },
    { value: '06', label: 'Junio' },
    { value: '07', label: 'Julio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const currentYear = new Date().getFullYear();
  const anios = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  const initialYear = currentCompany.period || String(currentYear);
  const initialMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedAnio, setSelectedAnio] = React.useState(initialYear);
  const [selectedMes, setSelectedMes] = React.useState(initialMonth);

  const getYearAndMonth = (dateStr: string) => {
    if (!dateStr) return { year: '', month: '' };
    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          const fullYear = y.length === 2 ? '20' + y : y;
          return { year: fullYear, month: m.padStart(2, '0') };
        }
      }
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts;
          const fullYear = y.length === 2 ? '20' + y : y;
          return { year: fullYear, month: m.padStart(2, '0') };
        }
      }
    } catch (e) {
      // Ignore
    }
    return { year: '', month: '' };
  };

  const filterPeriodo = React.useMemo(() => {
    return `${selectedAnio}${selectedMes}`;
  }, [selectedAnio, selectedMes]);

  const journal = store.journal.filter(entry => {
    if (entry.cta.trim().toUpperCase() === 'GLOSA') return false;
    
    // Filtrar usando la fecha real del asiento/documento (más robusto)
    const { year, month } = getYearAndMonth(entry.fecha);
    if (year && month) {
      return year === selectedAnio && month === selectedMes;
    }
    
    // Fallback si la fecha no se pudo parsear
    if (!filterPeriodo) return true;
    return entry.asiento.includes(filterPeriodo);
  });

  const totalDebe = journal.reduce((sum, entry) => sum + entry.debe, 0);
  const totalHaber = journal.reduce((sum, entry) => sum + entry.haber, 0);

  const handleDelete = (fullId: string) => {
    if (!window.confirm('¿Desea eliminar esta línea del libro diario?')) return;
    deleteJournalEntry(fullId);
  };

  const handleEdit = (source: string, fullId: string) => {
    if (source === 'COMPRA') {
      const purchaseId = fullId.replace(/^compra-/, '').replace(/-[^-]+$/, '');
      const item = store.purchases.find(p => p.id === purchaseId);
      if (item) {
         store.setDraftCompra(item);
         store.setActiveTab('COMPRAS');
      }
    } else if (source === 'VENTA') {
      const saleId = fullId.replace(/^venta-/, '').replace(/-[^-]+$/, '');
      const item = store.sales.find(p => p.id === saleId);
      if (item) {
         store.setDraftVenta(item);
         store.setActiveTab('VENTAS');
      }
    } else if (source === 'HONORARIO') {
      const honorarioId = fullId.replace(/^honor-/, '').replace(/-[^-]+$/, '');
      const item = store.honorarios.find(p => p.id === honorarioId);
      if (item) {
         store.setDraftHonorario(item);
         store.setActiveTab('HONORARIOS');
      }
    } else if (source === 'ASIENTO') {
      const asientoId = fullId.split('-line-')[0];
      const item = store.asientos.find(p => p.id === asientoId);
      if (item) {
         store.setDraftAsiento({ header: item.header, lines: item.lines, editingId: item.id });
         store.setActiveTab('ASIENTOS');
      }
    }
  };

  // Generate strict sequential CUOs for each unique transaction ID
  const cuoMap = new Map<string, string>();
  let cuoCounter = 1;
  const getStrictCuo = (asientoId: string) => {
    if (!cuoMap.has(asientoId)) {
      cuoMap.set(asientoId, `M${cuoCounter.toString().padStart(5, '0')}`);
      cuoCounter++;
    }
    return cuoMap.get(asientoId)!;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      // Caso dd/mm/yyyy o dd/mm/yy
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`;
        }
      }
      // Caso yyyy-mm-dd
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const [y, m, d] = parts;
          return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`;
        }
      }
    } catch (e) {
      return dateStr;
    }
    return dateStr;
  };

  const handleExportExcel = () => {
    const localCuoMap = new Map<string, string>();
    let localCuoCounter = 1;
    const getLocalStrictCuo = (asientoId: string) => {
      if (!localCuoMap.has(asientoId)) {
        localCuoMap.set(asientoId, `M${localCuoCounter.toString().padStart(5, '0')}`);
        localCuoCounter++;
      }
      return localCuoMap.get(asientoId)!;
    };

    const rows = journal.map((row, i) => {
      const parts = row.asiento.split('-');
      const libro = parts.length >= 3 ? parts[0] : (row.source === 'COMPRA' ? '08' : row.source === 'VENTA' ? '14' : row.source === 'HONORARIO' ? '08' : '05');
      const correlat = parts.length >= 3 ? parts[parts.length - 1] : (i+1).toString();
      const strictCuo = getLocalStrictCuo(row.asiento);
      
      let refDoc = '-';
      if (row.source === 'COMPRA') {
        const p = store.purchases.find(x => x.registro === row.asiento);
        if (p) refDoc = `${p.serie}-${p.numero}`;
      } else if (row.source === 'VENTA') {
        const s = store.sales.find(x => x.registro === row.asiento);
        if (s) refDoc = `${s.serie}-${s.numero}`;
      } else if (row.source === 'HONORARIO') {
        const h = store.honorarios.find(x => x.registro === row.asiento);
        if (h) refDoc = `${h.serie}-${h.numero}`;
      }

      return {
        cuo: strictCuo,
        fecha: formatDate(row.fecha),
        glosa: row.glosa.toUpperCase(),
        libro,
        correlativo: correlat,
        refDoc,
        cta: row.cta,
        desc: row.desc.toUpperCase(),
        debe: row.debe || 0,
        haber: row.haber || 0
      };
    });

    exportSingleSheet({
      sheetName: 'Libro Diario',
      title: 'LIBRO DIARIO - FORMATO 5.1',
      columns: [
        { header: 'CUO', key: 'cuo', width: 14, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
        { header: 'GLOSA / DESCRIPCIÓN', key: 'glosa', width: 40 },
        { header: 'LIBRO', key: 'libro', width: 8, alignment: 'center' },
        { header: 'CORRELATIVO', key: 'correlativo', width: 14, alignment: 'center' },
        { header: 'REF DOC', key: 'refDoc', width: 15, alignment: 'center' },
        { header: 'CUENTA', key: 'cta', width: 10, alignment: 'center' },
        { header: 'DENOMINACIÓN', key: 'desc', width: 35 },
        { header: 'DEBE', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER', key: 'haber', width: 16, style: 'currency' }
      ],
      rows,
      totals: {
        cuo: '', fecha: '', glosa: '', libro: '', correlativo: '', refDoc: '', cta: '', desc: 'TOTAL GENERAL',
        debe: totalDebe,
        haber: totalHaber
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: `${selectedAnio}-${selectedMes}`,
      }
    }, `Libro_Diario_${selectedAnio}_${selectedMes}`);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-slide-up relative">

      {/* Header / Toolbar */}
      <div className="h-12 px-5 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 toolbar">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pld-blue/10 rounded-lg">
            <Book size={16} className="text-pld-blue" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-app-text">Libro Diario (5.1)</h2>
            <div className="flex gap-3 text-[9px] items-center text-app-muted">
               <span>FORMATO: 5.1</span>
               <span>PERIODO: {currentCompany.period || '2025'}</span>
               <span>RUC: {currentCompany.ruc}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
            <div className="flex items-center bg-app-bg border border-app-border rounded-lg px-2 mr-2 gap-1 h-8">
              <span className="text-[9px] font-bold text-app-muted uppercase mr-1">Periodo:</span>
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] font-bold text-pld-blue uppercase cursor-pointer"
              >
                {meses.map((m) => (
                  <option key={m.value} value={m.value} className="bg-app-surface text-app-text">
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedAnio}
                onChange={(e) => setSelectedAnio(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] font-bold text-pld-blue cursor-pointer"
              >
                {anios.map((y) => (
                  <option key={y} value={y} className="bg-app-surface text-app-text">
                    {y}
                  </option>
                ))}
              </select>
            </div>
           <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Imprimir"><Printer size={14} /> Imprimir</button>
           <button onClick={handleExportExcel} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Exportar a Excel"><FileDown size={14} /> Excel</button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="min-w-[1250px] border border-app-border shadow-2xl rounded-sm overflow-hidden bg-app-surface">
          <table id="diario-table" className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-pld-blue text-white text-[9px] font-bold uppercase tracking-tighter">
                <th rowSpan={2} className="p-2 border border-blue-700/50 text-center w-24">CUO</th>
                <th rowSpan={2} className="p-2 border border-blue-700/50 text-center w-24">FECHA</th>
                <th rowSpan={2} className="p-2 border border-blue-700/50 text-center">GLOSA / DESCRIPCIÓN</th>
                <th colSpan={3} className="p-2 border border-blue-700/50 text-center">REFERENCIA</th>
                <th colSpan={2} className="p-2 border border-blue-700/50 text-center">CUENTA CONTABLE</th>
                <th colSpan={2} className="p-2 border border-blue-700/50 text-center">MOVIMIENTO</th>
                <th rowSpan={2} className="p-2 border border-blue-700/50 text-center w-16">ACC</th>
              </tr>
              <tr className="bg-pld-blue text-white text-[8px] font-bold uppercase tracking-tighter">
                <th className="p-1 border border-blue-400/30 text-center w-20">LIBRO</th>
                <th className="p-1 border border-blue-400/30 text-center w-20">CORRELAT</th>
                <th className="p-1 border border-blue-400/30 text-center w-24">DOC</th>
                <th className="p-1 border border-blue-400/30 text-center w-20">CÓDIGO</th>
                <th className="p-1 border border-blue-400/30 text-center">DENOMINACIÓN</th>
                <th className="p-1 border border-blue-400/30 text-center w-24">DEBE</th>
                <th className="p-1 border border-blue-400/30 text-center w-24">HABER</th>
              </tr>
            </thead>
            <tbody className="bg-app-surface text-app-text">
              {journal.map((row, i) => {
                const parts = row.asiento.split('-');
                const libro = parts.length >= 3 ? parts[0] : (row.source === 'COMPRA' ? '08' : row.source === 'VENTA' ? '14' : row.source === 'HONORARIO' ? '08' : '05');
                const correlat = parts.length >= 3 ? parts[parts.length - 1] : (i+1).toString();
                const strictCuo = getStrictCuo(row.asiento);
                
                // Lookup Document Reference
                let refDoc = '-';
                if (row.source === 'COMPRA') {
                  const p = store.purchases.find(x => x.registro === row.asiento);
                  if (p) refDoc = `${p.serie}-${p.numero}`;
                } else if (row.source === 'VENTA') {
                  const s = store.sales.find(x => x.registro === row.asiento);
                  if (s) refDoc = `${s.serie}-${s.numero}`;
                } else if (row.source === 'HONORARIO') {
                  const h = store.honorarios.find(x => x.registro === row.asiento);
                  if (h) refDoc = `${h.serie}-${h.numero}`;
                }

                return (
                  <tr key={i} className="hover:bg-app-hover transition-colors border-b border-app-border/50 text-[11px] font-mono">
                    <td className="p-2 border border-app-border/50 text-center text-pld-blue uppercase">{strictCuo}</td>
                    <td className="p-2 border border-app-border/50 text-center">{formatDate(row.fecha)}</td>
                    <td className="p-2 border border-app-border/50 uppercase truncate max-w-[300px] font-sans">{row.glosa}</td>
                    <td className="p-2 border border-app-border/50 text-center text-app-muted font-bold">{libro}</td>
                    <td className="p-2 border border-app-border/50 text-center text-app-muted font-bold">{correlat}</td>
                    <td className="p-2 border border-app-border/50 text-center">{refDoc}</td>
                    <td className="p-2 border border-app-border/50 text-center font-bold font-mono text-pld-blue">{row.cta}</td>
                    <td className="p-2 border border-app-border/50 uppercase text-app-muted font-sans text-[10px]">{row.desc}</td>
                    <td className="p-2 border border-app-border/50 text-right font-bold text-pld-blue">{row.debe > 0 ? row.debe.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td className="p-2 border border-app-border/50 text-right font-bold text-red-500">{row.haber > 0 ? row.haber.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td className="p-2 border border-app-border/50 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(row.source, row.id)} 
                          className="text-app-muted hover:text-pld-blue transition-colors" 
                          title="Editar Registro de Origen"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(row.id)} 
                          className="text-app-muted hover:text-red-500 transition-colors" 
                          title="Eliminar Asiento (Línea o Voucher)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Dummy rows for visual density if empty */}
              {journal.length === 0 && Array.from({ length: 15 }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-app-border/50 h-8 opacity-20">
                   {Array.from({ length: 11 }).map((_, j) => <td key={j} className="p-2 border border-app-border/50"></td>)}
                </tr>
              ))}
              {journal.length > 0 && journal.length < 10 && Array.from({ length: 10 - journal.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="border-b border-app-border/50 h-8 opacity-10">
                   {Array.from({ length: 11 }).map((_, j) => <td key={j} className="p-2 border border-app-border/50"></td>)}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-app-surface sticky bottom-0">
               <tr className="font-black text-[12px] bg-blue-500/10 text-app-text">
                  <td colSpan={8} className="p-3 text-right border border-app-border uppercase tracking-[0.3em] text-pld-blue">Totales S/</td>
                  <td className="p-3 text-right border border-app-border font-mono text-pld-blue underline decoration-double">
                    {totalDebe.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right border border-app-border font-mono text-red-500 underline decoration-double">
                    {totalHaber.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 border border-app-border"></td>
               </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DiarioView;

