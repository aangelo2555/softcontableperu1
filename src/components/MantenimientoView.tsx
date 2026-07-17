import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Search, AlertTriangle, Edit2, X, Save, Lock, Unlock, Calendar, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { DataTable } from './DataTable';
import { useStore } from '../store';
import PageHeader from './ui/PageHeader';
import type { MaintenanceRecord } from '../store';
import toast from 'react-hot-toast';

const ANEXOS = [
  { code: '01', label: '01 - REGISTRO VENTAS' },
  { code: '02', label: '02 - REGISTRO COMPRAS' },
  { code: '03', label: '03 - CAJA / EFECTIVO' },
  { code: '04', label: '04 - BANCOS' },
  { code: '05', label: '05 - HONORARIOS' },
  { code: '06', label: '06 - PLANILLAS' },
  { code: '07', label: '07 - ACTIVOS FIJOS' },
  { code: '10', label: '10 - MOVIMIENTOS ALMACÉN (KARDEX)' },
  { code: '11', label: '11 - CAJA CHICA' },
  { code: '31', label: '31 - LIBRO DIARIO' },
  { code: '32', label: '32 - ASIENTOS DE AJUSTE' },
  { code: '33', label: '33 - CIERRE CONTABLE' },
];

const MantenimientoView: React.FC = () => {
  const { currentCompany, maintenanceRecords, clearAllData, updateMaintenance, loadPeriods, periodsList, closePeriodAction, reopenPeriodAction } = useStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingRec, setEditingRec] = useState<MaintenanceRecord | null>(null);
  const [activeSection, setActiveSection] = useState<'comprobantes' | 'periodos'>('comprobantes');
  const [closingPeriodo, setClosingPeriodo] = useState<string | null>(null);
  const [closeReport, setCloseReport] = useState<any>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Edit form state
  const [editDesc, setEditDesc] = useState('');
  const [editMonto, setEditMonto] = useState('');

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

  const [selectedAnio, setSelectedAnio] = useState(initialYear);
  const [selectedMes, setSelectedMes] = useState(initialMonth);

  const filterPeriodo = React.useMemo(() => {
    return `${selectedAnio}${selectedMes}`;
  }, [selectedAnio, selectedMes]);

  const [filterAnexo, setFilterAnexo] = useState('01');
  const [filteredRecords, setFilteredRecords] = useState(maintenanceRecords);

  const handleProcesar = async () => {
    const loadingToast = toast.loading('Sincronizando y procesando registros...');
    try {
      await useStore.getState().syncMaintenance();
      
      const updatedRecords = useStore.getState().maintenanceRecords;
      const filtered = updatedRecords.filter(rec => {
        const matchesPeriodo = !filterPeriodo || rec.periodo.includes(filterPeriodo);
        const matchesAnexo = !filterAnexo || rec.anexo === filterAnexo;
        return matchesPeriodo && matchesAnexo;
      });
      
      setFilteredRecords(filtered);
      if (filtered.length > 0) {
        toast.success(`Se encontraron ${filtered.length} registros.`, { id: loadingToast });
      } else {
        toast.error("No se encontraron registros para el periodo y anexo seleccionados.", { id: loadingToast });
      }
    } catch (e) {
      toast.error("Error al procesar registros", { id: loadingToast });
    }
  };

  // Keep filteredRecords in sync with data changes
  useEffect(() => {
    setFilteredRecords(maintenanceRecords);
  }, [maintenanceRecords]);

  const handleStartEdit = (rec: MaintenanceRecord) => {
    setEditingRec(rec);
    setEditDesc(rec.descripcion);
    setEditMonto(rec.monto);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRec) {
      updateMaintenance(editingRec.id, {
        descripcion: editDesc,
        monto: editMonto
      });
      setEditingRec(null);
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' as any, className: 'w-16 font-mono text-[10px] text-center opacity-50' },
    { header: 'PERIODO', accessor: 'periodo' as any, className: 'w-24 font-mono text-pld-blue font-bold text-center' },
    { header: 'ANEXO', accessor: 'anexo' as any, className: 'w-20 font-mono text-center' },
    { header: 'DESCRIPCIÓN VOUCHER', accessor: 'descripcion' as any, className: 'uppercase font-bold tracking-tight px-4' },
    {
      header: 'TOTAL S/',
      accessor: (row: MaintenanceRecord) => Number(row.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      className: 'w-32 font-mono text-right font-black text-emerald-500 pr-6'
    },
    {
      header: 'ACCIONES',
      accessor: (row: MaintenanceRecord) => (
        <div className="flex gap-2 justify-center">
          <button onClick={() => handleStartEdit(row)} className="p-1 hover:text-pld-blue transition-colors">
            <Edit2 size={14} />
          </button>
        </div>
      ),
      className: 'w-24 text-center'
    }
  ];

  const handleClearBase = () => {
    clearAllData();
    setShowClearConfirm(false);
    alert("Base de datos limpiada con éxito.");
  };

  // --- Period Management ---
  useEffect(() => {
    if (activeSection === 'periodos') {
      loadPeriods();
    }
  }, [activeSection]);

  const periodYear = parseInt(currentCompany.period) || new Date().getFullYear();
  const allMonths = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0');
    return `${periodYear}-${mm}`;
  });

  const getPeriodStatus = (periodo: string) => {
    const found = (periodsList || []).find((p: any) => p.periodo === periodo && p.tipo === 'MENSUAL');
    return found ? found.estado : 'ABIERTO';
  };

  const handleClosePeriod = async (periodo: string) => {
    setClosingPeriodo(periodo);
    setIsClosing(true);
    try {
      const result = await closePeriodAction(periodo, 'MENSUAL');
      setCloseReport(result?.report || result);
    } catch (e) {
      console.error(e);
    }
    setIsClosing(false);
  };

  const handleReopenPeriod = async (periodo: string) => {
    await reopenPeriodAction(periodo, 'MENSUAL');
    await loadPeriods();
  };

  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Settings size={18} />}
        title="Configuración y Mantenimiento"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">
            SISTEMA
          </span>
        }
        subtitle={`${currentCompany.name} • Período: ${currentCompany.period}`}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-app-bg rounded-lg border border-app-border overflow-hidden p-0.5">
              <button
                onClick={() => setActiveSection('comprobantes')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                  activeSection === 'comprobantes' ? 'bg-pld-blue/20 text-pld-blue' : 'text-app-muted hover:text-app-text'
                }`}
              >
                Comprobantes
              </button>
              <button
                onClick={() => setActiveSection('periodos')}
                className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                  activeSection === 'periodos' ? 'bg-amber-500/20 text-amber-600' : 'text-app-muted hover:text-app-text'
                }`}
              >
                Períodos
              </button>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="h-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold px-3 rounded-xl flex items-center gap-1.5 border border-red-500/20 transition-all text-[10px] uppercase tracking-wider"
            >
              <Trash2 size={12} /> Limpiar Base
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

        {activeSection === 'periodos' ? (
          /* ─── Períodos Contables Panel ─── */
          <div className="flex-1 overflow-auto custom-scrollbar space-y-4">
            <div className="bg-app-surface p-6 rounded-2xl border border-app-border/40 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-600 flex items-center gap-2">
                  <Lock size={14} /> Gestión de Períodos Contables {currentYear}
                </h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-lg border border-amber-500/10">
                  <ShieldCheck size={12} className="text-amber-600" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-amber-600">Un período cerrado bloquea compras, ventas, honorarios y asientos</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allMonths.map((periodo, idx) => {
                  const estado = getPeriodStatus(periodo);
                  const isCerrado = estado === 'CERRADO';
                  return (
                    <div
                      key={periodo}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCerrado
                          ? 'bg-gradient-to-br from-red-500/5 to-red-600/5 border-red-500/20'
                          : 'bg-gradient-to-br from-emerald-500/5 to-teal-600/5 border-emerald-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs font-black text-app-text">{MONTH_NAMES[idx]}</p>
                          <p className="text-[9px] font-mono text-app-muted">{periodo}</p>
                        </div>
                        {isCerrado ? (
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <Lock size={14} className="text-red-500" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Unlock size={14} className="text-emerald-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${
                          isCerrado ? 'text-red-500' : 'text-emerald-500'
                        }`}>
                          {estado}
                        </span>
                        {isCerrado ? (
                          <button
                            onClick={() => handleReopenPeriod(periodo)}
                            className="px-3 py-1.5 rounded-lg bg-app-bg border border-app-border text-[8px] font-black uppercase tracking-wider text-app-muted hover:text-amber-600 hover:border-amber-500/30 transition-all"
                          >
                            Reabrir
                          </button>
                        ) : (
                          <button
                            onClick={() => handleClosePeriod(periodo)}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[8px] font-black uppercase tracking-wider text-red-500 hover:bg-red-500 hover:text-white transition-all"
                          >
                            Cerrar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ─── Comprobantes Panel (Original) ─── */
          <>
          <div className="bg-app-surface p-6 rounded-2xl border border-app-border/40 space-y-6 shadow-xl">
             <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-pld-blue flex items-center gap-2">
                <Search size={14} /> Búsqueda de Registros
             </h3>

             <div className="flex flex-wrap items-end gap-6">
                <div className="w-56 space-y-2">
                   <label className="block text-[10px] font-black text-app-muted uppercase tracking-widest">Periodo</label>
                   <div className="flex gap-2 w-full">
                     <select className="flex-1 h-11 bg-app-bg border border-app-border text-app-text rounded-xl px-3 outline-none focus:border-pld-blue transition-all text-xs font-bold"
                       value={selectedMes} onChange={e => setSelectedMes(e.target.value)}>
                       {meses.map(m => <option key={m.value} value={m.value} className="bg-app-surface text-app-text">{m.label}</option>)}
                     </select>
                     <select className="w-24 h-11 bg-app-bg border border-app-border text-app-text rounded-xl px-3 outline-none focus:border-pld-blue transition-all text-xs font-bold"
                       value={selectedAnio} onChange={e => setSelectedAnio(e.target.value)}>
                       {anios.map(y => <option key={y} value={y} className="bg-app-surface text-app-text">{y}</option>)}
                     </select>
                   </div>
                </div>
                <div className="w-64 space-y-2">
                   <label className="block text-[10px] font-black text-app-muted uppercase tracking-widest">Sub-Diario (Anexo)</label>
                   <select className="w-full h-11 text-xs bg-app-bg border border-app-border text-app-text rounded-xl px-4 outline-none focus:border-pld-blue transition-all font-bold"
                     value={filterAnexo} onChange={e => setFilterAnexo(e.target.value)}>
                      {ANEXOS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
                   </select>
                </div>
                <div className="flex-1 h-11 flex items-center gap-3 text-[10px] font-bold text-pld-accent uppercase italic bg-pld-accent/5 px-4 rounded-xl border border-pld-accent/10">
                   Nota: El ajuste de asientos permite modificar glosa y montos consolidados.
                </div>
                <button onClick={handleProcesar} className="h-11 bg-pld-blue hover:bg-pld-accent text-black px-10 rounded-xl font-black text-xs uppercase flex items-center gap-3 transition-all shadow-xl shadow-pld-blue/10">
                   <Search size={18} /> Procesar
                </button>
             </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar border border-app-border/40 rounded-2xl shadow-inner bg-app-surface/30">
             <DataTable
               columns={columns}
               data={filteredRecords}
               emptyMessage="No se encontraron registros para el periodo seleccionado"
               headerClassName="bg-app-surface text-app-text uppercase text-[9px] font-black h-12 sticky top-0"
               rowClassName="h-12 border-b border-app-border/30 hover:bg-app-hover transition-colors text-xs"
             />
          </div>
          </>
        )}
        </div>
      </div>

      {/* Close Period Report Modal */}
      {closingPeriodo && closeReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-app-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-app-border animate-in zoom-in duration-200">
            <div className="p-5 border-b border-app-border bg-gradient-to-br from-amber-500/10 to-orange-500/10">
              <h3 className="text-sm font-black uppercase tracking-widest text-app-text flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber-600" /> Reporte de Cierre: {closingPeriodo}
              </h3>
            </div>
            <div className="p-5 space-y-3 max-h-80 overflow-auto custom-scrollbar">
              {(closeReport.checks || []).map((check: any) => (
                <div key={check.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  check.ok ? 'bg-emerald-500/5 border-emerald-500/15' : check.bloqueante ? 'bg-red-500/5 border-red-500/15' : 'bg-amber-500/5 border-amber-500/15'
                }`}>
                  {check.ok ? (
                    <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={16} className={`${check.bloqueante ? 'text-red-500' : 'text-amber-500'} shrink-0 mt-0.5`} />
                  )}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-app-text">{check.nombre}</p>
                    <p className="text-[9px] text-app-muted">{check.detalle}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-app-border">
              {closeReport.canClose ? (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">✅ Período cerrado exitosamente</span>
                  <button onClick={() => { setClosingPeriodo(null); setCloseReport(null); }} className="px-4 py-2 rounded-xl bg-app-bg border border-app-border text-[10px] font-black uppercase hover:bg-app-hover transition-colors">Cerrar</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">⛔ No se puede cerrar: {(closeReport.blockers || []).join(', ')}</span>
                  <button onClick={() => { setClosingPeriodo(null); setCloseReport(null); }} className="px-4 py-2 rounded-xl bg-app-bg border border-app-border text-[10px] font-black uppercase hover:bg-app-hover transition-colors">Entendido</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legacy Styled Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
           <div className="bg-app-surface text-app-text border border-app-border w-full max-w-sm rounded-2xl shadow-[0_0_50px_rgba(255,0,0,0.2)] overflow-hidden animate-in zoom-in duration-200">
              <div className="p-4 border-b border-app-border bg-red-500/10 flex items-center justify-between">
                 <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Alerta Crítica</span>
                 <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="p-8 text-center">
                 <p className="text-sm font-bold leading-relaxed">
                   ¿Confirmar eliminación masiva de base de datos?
                 </p>
                 <p className="text-[10px] text-red-500/60 mt-4 uppercase font-black">
                   Esta acción no se puede deshacer
                 </p>
              </div>
              <div className="flex border-t border-app-border">
                 <button onClick={handleClearBase} className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase transition-colors">BORRAR TODO</button>
                 <button onClick={() => setShowClearConfirm(false)} className="flex-1 h-14 bg-app-surface hover:bg-app-hover text-app-text font-bold text-xs uppercase transition-colors">CANCELAR</button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRec && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-app-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-app-border animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-app-border bg-app-bg/50 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-pld-blue">Ajuste de Comprobante</h3>
              <button onClick={() => setEditingRec(null)} className="text-app-muted hover:text-pld-blue transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 opacity-50">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted">Periodo</label>
                    <input disabled value={editingRec.periodo} className="w-full h-10 bg-app-bg border border-app-border rounded-xl px-4 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted">Anexo</label>
                    <input disabled value={editingRec.anexo} className="w-full h-10 bg-app-bg border border-app-border rounded-xl px-4 text-xs font-mono" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-app-muted">Descripción / Glosa del Voucher</label>
                  <textarea
                    rows={3}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-sm font-bold uppercase outline-none focus:border-pld-blue transition-all"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-app-muted">Monto Total S/.</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-12 bg-app-bg border border-app-border rounded-xl px-4 text-xl font-mono font-black text-emerald-500 text-right outline-none focus:border-pld-blue transition-all"
                    value={editMonto}
                    onChange={e => setEditMonto(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-6 flex flex-col gap-3">
                <button type="submit" className="w-full h-14 bg-pld-blue hover:bg-pld-accent text-black rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-pld-blue/10 flex items-center justify-center gap-3">
                  <Save size={18} /> Guardar Cambios
                </button>
                <button type="button" onClick={() => setEditingRec(null)} className="w-full h-14 border border-app-border hover:bg-app-hover rounded-2xl text-xs font-bold uppercase transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MantenimientoView;
