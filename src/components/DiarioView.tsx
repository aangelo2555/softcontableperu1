import React, { useState, useMemo } from 'react';
import { Book, Printer, FileDown, Trash2, Edit, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';
import { CustomSelect, type SelectOption } from './ui/CustomSelect';
import { ConfirmModal } from './ui/ConfirmModal';
import Pagination from './ui/Pagination';
import toast from 'react-hot-toast';

const MESES: SelectOption[] = [
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

const DiarioView: React.FC = () => {
  const store = useStore();
  const { currentCompany, deleteJournalEntry } = store;

  const currentYear = new Date().getFullYear();
  const aniosOptions: SelectOption[] = Array.from({ length: 6 }, (_, i) => {
    const y = String(currentYear - i);
    return { value: y, label: y };
  });

  const initialYear = currentCompany.period || String(currentYear);
  const initialMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedAnio, setSelectedAnio] = useState(initialYear);
  const [selectedMes, setSelectedMes] = useState(initialMonth);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal confirmation states
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; desc: string } | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getYearAndMonth = (dateStr: string) => {
    if (!dateStr) return { year: '', month: '' };
    try {
      const clean = dateStr.trim().split('T')[0].split(' ')[0];
      const sep = clean.includes('/') ? '/' : clean.includes('-') ? '-' : null;
      if (sep) {
        const parts = clean.split(sep);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return { year: parts[0], month: parts[1].padStart(2, '0') };
          }
          if (parts[2].length === 4 || parts[2].length === 2) {
            const fullYear = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            return { year: fullYear, month: parts[1].padStart(2, '0') };
          }
        }
        if (parts.length === 2) {
          if (parts[0].length === 4) {
            return { year: parts[0], month: parts[1].padStart(2, '0') };
          }
        }
      }
      if (/^\d{6}/.test(clean)) {
        return { year: clean.substring(0, 4), month: clean.substring(4, 6) };
      }
    } catch (e) {
      // Ignore
    }
    return { year: '', month: '' };
  };

  const filterPeriodo = useMemo(() => {
    return `${selectedAnio}${selectedMes}`;
  }, [selectedAnio, selectedMes]);

  const journal = useMemo(() => {
    return store.journal.filter(entry => {
      if (!entry.cta || entry.cta.trim().toUpperCase() === 'GLOSA') return false;

      // 1. Filtrar por fecha exacta del asiento
      const { year, month } = getYearAndMonth(entry.fecha);
      if (year && month) {
        return year === selectedAnio && month === selectedMes;
      }

      // 2. Fallback por estructura de código del asiento
      if (entry.asiento) {
        if (filterPeriodo && entry.asiento.includes(filterPeriodo)) return true;
        if (entry.asiento.includes(`${selectedAnio}-${selectedMes}`)) return true;
        if (entry.asiento.includes(`${selectedAnio}/${selectedMes}`)) return true;
        if (entry.asiento.endsWith(`-${selectedMes}`)) return true;
      }

      return false;
    });
  }, [store.journal, selectedAnio, selectedMes, filterPeriodo]);

  const totalDebe = useMemo(() => journal.reduce((sum, entry) => sum + (entry.debe || 0), 0), [journal]);
  const totalHaber = useMemo(() => journal.reduce((sum, entry) => sum + (entry.haber || 0), 0), [journal]);

  // Pagination calculation
  const totalPages = Math.ceil(journal.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, journal.length);
  const paginatedEntries = useMemo(() => {
    return journal.slice(startIndex, endIndex);
  }, [journal, startIndex, endIndex]);

  // Reset to page 1 on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedAnio, selectedMes]);

  const handleDeleteSingle = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteJournalEntry(entryToDelete.id);
      toast.success('Línea eliminada del libro diario correctamente');
      setEntryToDelete(null);
    } catch (e: any) {
      toast.error(`Error al eliminar: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (journal.length === 0) return;
    setIsDeleting(true);
    const loadingToast = toast.loading('Eliminando asientos del período...');
    try {
      const electron = (window as any).electronAPI;
      const ruc = currentCompany.ruc;
      if (electron && ruc) {
        // Delete all matching entries in DB
        for (const entry of journal) {
          await electron.dbExecute(`DELETE FROM journal WHERE id = ? AND workspace_id = ?`, [entry.id, ruc]);
        }
        const data = await electron.dbGetWorkspaceData(ruc);
        store.setWorkspaceData(data);
      }
      toast.success(`Se eliminaron ${journal.length} registros del Libro Diario`, { id: loadingToast });
      setShowDeleteAllModal(false);
    } catch (e: any) {
      toast.error(`Error al eliminar asientos: ${e.message}`, { id: loadingToast });
    } finally {
      setIsDeleting(false);
    }
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
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`;
        }
      }
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
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Book size={18} />}
        title="Libro Diario (5.1)"
        badge={<span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-[9px] text-blue-600 dark:text-blue-400 border border-blue-500/20 tracking-[0.2em] uppercase font-bold">Formato 5.1</span>}
        subtitle={`Periodo: ${selectedAnio}-${selectedMes} • RUC: ${currentCompany.ruc || ''} • ${journal.length} Registros`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector dropdowns */}
            <div className="flex items-center bg-app-surface border border-app-border rounded-xl p-1 gap-1.5 shadow-sm">
              <span className="text-[9px] font-black text-app-muted uppercase px-1.5">Periodo:</span>
              <CustomSelect
                value={selectedMes}
                onChange={setSelectedMes}
                options={MESES}
                compact
                className="w-28"
              />
              <CustomSelect
                value={selectedAnio}
                onChange={setSelectedAnio}
                options={aniosOptions}
                compact
                className="w-20"
              />
            </div>

            {/* Delete All Button */}
            {journal.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="h-8 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                title="Eliminar todos los asientos del período"
              >
                <Trash2 size={13} />
                <span>Eliminar Todos</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-blue-600 hover:border-blue-500/30 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted shadow-sm cursor-pointer"
              title="Imprimir Libro Diario"
            >
              <Printer size={14} /> Imprimir
            </button>

            <button
              onClick={handleExportExcel}
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-1.5 text-[10px] font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
              title="Exportar a Excel"
            >
              <FileDown size={14} /> Excel
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {/* Table Container */}
        <div className="flex-1 overflow-auto custom-scrollbar border border-app-border rounded-2xl shadow-xl bg-app-surface">
          <table id="diario-table" className="w-full text-left border-collapse text-[9px]">
            {/* Minimalist White / App Surface Table Header */}
            <thead>
              <tr className="bg-app-surface text-app-text text-[8px] font-black uppercase text-center border-b border-app-border">
                <th rowSpan={2} className="p-2 border-r border-app-border text-center w-24">CUO</th>
                <th rowSpan={2} className="p-2 border-r border-app-border text-center w-20">FECHA</th>
                <th rowSpan={2} className="p-2 border-r border-app-border text-left min-w-[200px] px-3">GLOSA / DESCRIPCIÓN</th>
                <th colSpan={3} className="p-2 border-r border-app-border text-center bg-blue-500/5">REFERENCIA</th>
                <th colSpan={2} className="p-2 border-r border-app-border text-center bg-purple-500/5">CUENTA CONTABLE</th>
                <th colSpan={2} className="p-2 border-r border-app-border text-center bg-emerald-500/5">MOVIMIENTO (S/)</th>
                <th rowSpan={2} className="p-2 text-center w-16">ACCIONES</th>
              </tr>
              <tr className="bg-app-surface/90 text-app-muted text-[7.5px] font-extrabold uppercase text-center border-b border-app-border">
                <th className="py-1.5 px-2 border-r border-app-border text-center w-16">LIBRO</th>
                <th className="py-1.5 px-2 border-r border-app-border text-center w-16">CORRELAT</th>
                <th className="py-1.5 px-2 border-r border-app-border text-center w-20">DOC</th>
                <th className="py-1.5 px-2 border-r border-app-border text-center w-16">CÓDIGO</th>
                <th className="py-1.5 px-2 border-r border-app-border text-left">DENOMINACIÓN</th>
                <th className="py-1.5 px-2 border-r border-app-border text-right w-24 text-emerald-600 dark:text-emerald-400">DEBE</th>
                <th className="py-1.5 px-2 border-r border-app-border text-right w-24 text-rose-600 dark:text-rose-400">HABER</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="bg-app-surface text-app-text font-mono text-[9px]">
              {paginatedEntries.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-20 text-app-muted font-sans italic text-sm">
                    No se encontraron asientos contables en el Libro Diario 5.1 para este periodo ({selectedAnio}-{selectedMes})
                  </td>
                </tr>
              )}

              {paginatedEntries.map((row, i) => {
                const parts = row.asiento.split('-');
                const libro = parts.length >= 3 ? parts[0] : (row.source === 'COMPRA' ? '08' : row.source === 'VENTA' ? '14' : row.source === 'HONORARIO' ? '08' : '05');
                const correlat = parts.length >= 3 ? parts[parts.length - 1] : (startIndex + i + 1).toString();
                const strictCuo = getStrictCuo(row.asiento);

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
                  <tr
                    key={row.id || i}
                    className="hover:bg-app-text/[0.03] transition-colors border-b border-app-border/40"
                  >
                    <td className="p-2 border-r border-app-border/40 text-center font-bold text-blue-600 dark:text-blue-400">
                      {strictCuo}
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-center text-app-muted font-sans">
                      {formatDate(row.fecha)}
                    </td>
                    <td className="p-2 border-r border-app-border/40 font-sans text-app-text text-[9px] uppercase truncate max-w-[280px]" title={row.glosa}>
                      {row.glosa}
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-center text-app-muted font-bold">
                      <span className="px-1.5 py-0.5 rounded bg-app-bg border border-app-border text-[8.5px]">
                        {libro}
                      </span>
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-center text-app-muted font-bold">
                      {correlat}
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-center font-sans text-app-muted">
                      {refDoc}
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-center font-black font-mono text-blue-600 dark:text-blue-400">
                      {row.cta}
                    </td>
                    <td className="p-2 border-r border-app-border/40 uppercase text-app-muted font-sans text-[8.5px] truncate max-w-[180px]" title={row.desc}>
                      {row.desc}
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {row.debe > 0 ? row.debe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="p-2 border-r border-app-border/40 text-right font-black text-rose-600 dark:text-rose-400">
                      {row.haber > 0 ? row.haber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(row.source, row.id)}
                          className="p-1 text-app-muted hover:text-blue-600 transition-colors bg-app-bg/60 border border-app-border rounded-lg"
                          title="Editar Registro de Origen"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => setEntryToDelete({ id: row.id, desc: `${row.cta} - ${row.glosa || 'Asiento'}` })}
                          className="p-1 text-app-muted hover:text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors bg-app-bg/60 border border-app-border rounded-lg"
                          title="Eliminar Asiento"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer - Grand Totals */}
            <tfoot className="bg-app-surface sticky bottom-0 border-t-2 border-app-border">
              <tr className="font-black text-xs bg-app-surface text-app-text">
                <td colSpan={8} className="p-3 text-right border-r border-app-border uppercase tracking-[0.2em] text-app-muted font-sans text-[10px]">
                  Total General ({journal.length} filas):
                </td>
                <td className="p-3 text-right border-r border-app-border font-mono text-emerald-600 dark:text-emerald-400">
                  {totalDebe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-3 text-right border-r border-app-border font-mono text-rose-600 dark:text-rose-400">
                  {totalHaber.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-3 text-center">
                  {Math.abs(totalDebe - totalHaber) < 0.01 ? (
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Cuadrado
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      Descuadre: S/ {(Math.abs(totalDebe - totalHaber)).toFixed(2)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onFirstPage={() => setCurrentPage(1)}
          onLastPage={() => setCurrentPage(totalPages)}
          onPrevPage={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          onNextPage={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(val) => {
            setItemsPerPage(val);
            setCurrentPage(1);
          }}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={journal.length}
        />
      </div>

      {/* Confirmation Modal - Delete Single Line */}
      <ConfirmModal
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        onConfirm={handleDeleteSingle}
        title="¿Eliminar Asiento Contable?"
        message={
          <div>
            <p>¿Estás seguro de que deseas eliminar esta línea del libro diario?</p>
            {entryToDelete && (
              <div className="mt-2 p-2.5 rounded-xl bg-app-bg border border-app-border font-mono text-[11px] text-app-text font-bold">
                {entryToDelete.desc}
              </div>
            )}
            <p className="mt-2 text-[10px] text-app-muted">
              Esta acción eliminará el registro contable seleccionado de forma permanente.
            </p>
          </div>
        }
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Confirmation Modal - Delete All Entries */}
      <ConfirmModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleDeleteAll}
        title="¿Eliminar Todos los Asientos del Período?"
        message={
          <div>
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 font-bold mb-3">
              <AlertTriangle size={16} className="shrink-0" />
              <span>Esta acción es irreversible y eliminará {journal.length} asientos del período {selectedAnio}-{selectedMes}.</span>
            </div>
            <p className="text-xs text-app-muted">
              Se eliminarán todas las líneas de libro diario generadas o registradas para el mes de {MESES.find(m => m.value === selectedMes)?.label} {selectedAnio}.
            </p>
          </div>
        }
        confirmText="Sí, Eliminar Todos"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default DiarioView;
