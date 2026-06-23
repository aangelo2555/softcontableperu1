import React, { useState } from 'react';
import { Files, Search, Plus, X, Edit2, Trash2, FileDown, Printer } from 'lucide-react';
import { DataTable } from './DataTable';
import { useStore } from '../store';
import type { Account } from '../logic/plan';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

const PlanView: React.FC = () => {
  const { plan, addAccount, updateAccount, deleteAccount, resetPlanToBase, currentCompany } = useStore();
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  const [resetting, setResetting] = useState(false);

  // Form state
  const [newCta, setNewCta] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'Balance' | 'Resultados' | 'Registro'>('Balance');
  const [reqCenCos, setReqCenCos] = useState(false);
  const [amarreDebe, setAmarreDebe] = useState('');
  const [amarreHaber, setAmarreHaber] = useState('');
  const [divValue, setDivValue] = useState<number>(1);
  const [ctaCc1, setCtaCc1] = useState('');
  const [pctCc1, setPctCc1] = useState<number>(100);
  const [ctaCc2, setCtaCc2] = useState('');
  const [pctCc2, setPctCc2] = useState<number>(0);
  const [ctaCc3, setCtaCc3] = useState('');
  const [pctCc3, setPctCc3] = useState<number>(0);
  const [destinoHaber, setDestinoHaber] = useState('');
  const [niif18Category, setNiif18Category] = useState<string>('');

  // Filter accounts
  const filteredData = React.useMemo(() => {
    return plan
      .filter(acc => 
        acc.cta.includes(query) || 
        acc.description.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => a.cta.localeCompare(b.cta));
  }, [plan, query]);

  const columns = React.useMemo(() => [
    { header: 'Cuenta', accessor: (row: Account) => <span className="font-mono font-bold text-pld-blue">{row.cta}</span> },
    { header: 'Descripción', accessor: 'description' as keyof Account },
    { header: 'Tipo', accessor: 'type' as keyof Account, className: 'text-app-muted italic' },
    { 
      header: 'Detalle', 
      accessor: (row: Account) => (
        row.div === 0 ? 
        <span className="px-2 py-0.5 text-[10px] bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30 rounded-full font-semibold">Agrupadora</span> : 
        <span className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30 rounded-full font-semibold">Registro</span>
      ), 
      className: 'text-center' 
    },
    { 
      header: 'Distribución Costos', 
      accessor: (row: Account) => {
        const parts = [];
        if (row.cta_cc1) parts.push(`${row.cta_cc1} (${row.pct_cc1}%)`);
        if (row.cta_cc2) parts.push(`${row.cta_cc2} (${row.pct_cc2}%)`);
        if (row.cta_cc3) parts.push(`${row.cta_cc3} (${row.pct_cc3}%)`);
        return (
          <div className="flex flex-col gap-0.5 text-[10px] font-mono text-left max-w-[150px]">
            {parts.map((p, idx) => <span key={idx}>{p}</span>)}
            {row.destino_haber && <span className="text-app-muted">Haber: {row.destino_haber}</span>}
            {parts.length === 0 && !row.destino_haber && <span className="text-app-muted">-</span>}
          </div>
        );
      }
    },
    { 
      header: 'NIIF 18', 
      accessor: (row: Account) => (
        row.niif18_category ? 
        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold uppercase">{row.niif18_category}</span> : 
        <span className="text-app-muted text-[10px]">-</span>
      ), 
      className: 'text-center' 
    },
    { 
      header: 'Acciones', 
      accessor: (row: Account) => (
        <div className="flex gap-2 justify-center">
          <button 
            onClick={() => handleStartEdit(row)}
            className="p-1 hover:text-pld-blue transition-colors"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={() => { if(confirm('¿Eliminar cuenta?')) deleteAccount(row.cta) }}
            className="p-1 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'w-24 text-center'
    }
  ], [deleteAccount]);

  const handleStartEdit = (acc: Account) => {
    setEditingAcc(acc);
    setNewCta(acc.cta);
    setNewDesc(acc.description);
    setNewType(acc.type);
    setReqCenCos(acc.reqCenCos || false);
    setAmarreDebe(acc.amarreDebe || acc.cta_cc1 || '');
    setAmarreHaber(acc.amarreHaber || acc.destino_haber || '');
    setDivValue(acc.div !== undefined ? acc.div : 1);
    setCtaCc1(acc.cta_cc1 || acc.amarreDebe || '');
    setPctCc1(acc.pct_cc1 !== undefined ? acc.pct_cc1 : (acc.amarreDebe ? 100 : 0));
    setCtaCc2(acc.cta_cc2 || '');
    setPctCc2(acc.pct_cc2 || 0);
    setCtaCc3(acc.cta_cc3 || '');
    setPctCc3(acc.pct_cc3 || 0);
    setDestinoHaber(acc.destino_haber || acc.amarreHaber || '');
    setNiif18Category(acc.niif18_category || '');
    setShowAddModal(true);
  };

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCta || !newDesc) return;
    
    const accountData: Account = {
      cta: newCta,
      description: newDesc,
      type: newType,
      reqCenCos,
      amarreDebe: ctaCc1 || undefined,
      amarreHaber: destinoHaber || undefined,
      div: divValue,
      cta_cc1: ctaCc1 || undefined,
      pct_cc1: pctCc1,
      cta_cc2: ctaCc2 || undefined,
      pct_cc2: pctCc2,
      cta_cc3: ctaCc3 || undefined,
      pct_cc3: pctCc3,
      destino_haber: destinoHaber || undefined,
      niif18_category: (niif18Category || undefined) as any
    };

    if (editingAcc) {
      updateAccount(editingAcc.cta, accountData);
    } else {
      if (plan.find(a => a.cta === newCta)) {
        alert("La cuenta ya existe.");
        return;
      }
      addAccount(accountData);
    }
    
    resetForm();
  };

  const resetForm = () => {
    setNewCta('');
    setNewDesc('');
    setNewType('Balance');
    setReqCenCos(false);
    setAmarreDebe('');
    setAmarreHaber('');
    setDivValue(1);
    setCtaCc1('');
    setPctCc1(100);
    setCtaCc2('');
    setPctCc2(0);
    setCtaCc3('');
    setPctCc3(0);
    setDestinoHaber('');
    setNiif18Category('');
    setEditingAcc(null);
    setShowAddModal(false);
  };

  const handleResetPlan = async () => {
    if (confirm('¿Está seguro de que desea restablecer el Plan Contable al plan base oficial 2026? Esto restaurará todas las cuentas del sistema y sobrescribirá cualquier cambio personalizado en las cuentas estándar. Los datos registrados de asientos no se verán afectados.')) {
      setResetting(true);
      try {
        await resetPlanToBase();
        alert('Plan Contable restablecido con éxito.');
      } catch (err: any) {
        alert('Error al restablecer el plan: ' + err.message);
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Files size={18} />}
        title="Plan Contable"
        subtitle={`PCGE ${plan.length} cuentas`}
        actions={
          <>
            <div className="relative group">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-pld-blue transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar cuenta contable (Código/Nombre)..." 
                className="h-10 pl-11 pr-4 w-64 text-[11px] bg-app-bg border border-app-border rounded-xl outline-none focus:border-pld-blue focus:ring-4 focus:ring-pld-blue/5 transition-all shadow-sm"
                style={{ paddingLeft: '2.75rem' }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="h-8 bg-pld-blue hover:bg-blue-700 text-white font-bold px-4 rounded-lg flex items-center gap-2 transition-all text-[10px] uppercase tracking-wider shadow-sm"
            >
              <Plus size={14} /> Nuevo
            </button>
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Plan Contable',
              title: 'PLAN CONTABLE GENERAL EMPRESARIAL',
              columns: [
                { header: 'CUENTA', key: 'cta', width: 12, alignment: 'center' },
                { header: 'DENOMINACIÓN', key: 'description', width: 50 },
                { header: 'TIPO', key: 'type', width: 15, alignment: 'center' },
                { header: 'DETALLE', key: 'div', width: 10, alignment: 'center' },
                { header: 'CC 1', key: 'cta_cc1', width: 12, alignment: 'center' },
                { header: 'PCT 1', key: 'pct_cc1', width: 10, alignment: 'center' },
                { header: 'CC 2', key: 'cta_cc2', width: 12, alignment: 'center' },
                { header: 'PCT 2', key: 'pct_cc2', width: 10, alignment: 'center' },
                { header: 'CC 3', key: 'cta_cc3', width: 12, alignment: 'center' },
                { header: 'PCT 3', key: 'pct_cc3', width: 10, alignment: 'center' },
                { header: 'DESTINO HABER', key: 'destino_haber', width: 15, alignment: 'center' },
                { header: 'NIIF 18', key: 'niif18_category', width: 15, alignment: 'center' }
              ],
              rows: plan,
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Plan_Contable')} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
            <button 
              onClick={handleResetPlan}
              disabled={resetting}
              className="h-8 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold disabled:opacity-50"
              title="Restablece el plan contable del espacio de trabajo al plan base 2026 oficial (Borrará los cambios personalizados de las cuentas base)"
            >
              <Trash2 size={14} /> {resetting ? 'Restableciendo...' : 'Restablecer Plan'}
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
          <DataTable 
            columns={columns} 
            data={filteredData} 
            emptyMessage="No se encontraron cuentas con ese criterio."
            rowClassName="hover:bg-app-hover border-b border-app-border/50 text-xs"
            pageSize={100}
          />
        </div>
      </div>

      {/* Add/Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden border border-app-border/50 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-app-border bg-app-bg flex justify-between items-center shrink-0">
              <h3 className="font-black uppercase text-xs tracking-widest text-pld-blue">
                {editingAcc ? 'Editar Cuenta Contable' : 'Agregar Nueva Cuenta'}
              </h3>
              <button onClick={resetForm} className="text-app-muted hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddOrUpdate} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Columna Izquierda: Información General */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-pld-blue border-b border-app-border/30 pb-1.5">Datos Generales</h4>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black tracking-widest uppercase text-app-muted flex items-center gap-1">Cuenta <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      autoFocus
                      required
                      disabled={!!editingAcc}
                      value={newCta}
                      onChange={e => setNewCta(e.target.value)}
                      className={`w-full h-10 font-mono text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue ${editingAcc ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="Ej: 10411"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black tracking-widest uppercase text-app-muted flex items-center gap-1">Descripción <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      className="w-full h-10 uppercase text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                      placeholder="Nombre de la cuenta..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black tracking-widest uppercase text-app-muted">Tipo de Cuenta</label>
                    <select 
                      value={newType}
                      onChange={e => setNewType(e.target.value as any)}
                      className="w-full h-10 text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                    >
                      <option value="Balance">Balance</option>
                      <option value="Registro">Registro (Naturaleza)</option>
                      <option value="Resultados">Resultados</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black tracking-widest uppercase text-app-muted">¿Permite Asientos/Movimientos?</label>
                    <select 
                      value={divValue}
                      onChange={e => setDivValue(Number(e.target.value))}
                      className="w-full h-10 text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                    >
                      <option value={1}>Sí (Cuenta de Registro / Detalle)</option>
                      <option value={0}>No (Cuenta Agrupadora / Cabecera)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black tracking-widest uppercase text-app-muted">Categoría NIIF 18</label>
                    <select 
                      value={niif18Category}
                      onChange={e => setNiif18Category(e.target.value)}
                      className="w-full h-10 text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                    >
                      <option value="">Ninguna / No aplica</option>
                      <option value="Operacion">Operación</option>
                      <option value="Inversion">Inversión</option>
                      <option value="Financiamiento">Financiamiento</option>
                      <option value="Impuestos">Impuestos</option>
                      <option value="Discontinuadas">Operaciones Discontinuadas</option>
                    </select>
                  </div>
                </div>

                {/* Columna Derecha: Prorrateo de Costos */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-pld-blue border-b border-app-border/30 pb-1.5">Destino de Costos (Clase 6)</h4>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black tracking-widest uppercase text-app-muted">Destino Haber (Elemento 79)</label>
                    <input 
                      type="text"
                      value={destinoHaber}
                      onChange={e => setDestinoHaber(e.target.value)}
                      className="w-full h-10 font-mono text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                      placeholder="Ej: 791"
                    />
                  </div>

                  <div className="bg-app-bg/50 border border-app-border/40 p-4 rounded-lg space-y-3">
                    <span className="text-[10px] font-bold text-app-muted block uppercase tracking-wider">Distribución por Centro de Costos</span>
                    
                    {/* CC 1 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] uppercase text-app-muted font-bold">Cta CC 1</label>
                        <input 
                          type="text"
                          value={ctaCc1}
                          onChange={e => setCtaCc1(e.target.value)}
                          className="w-full h-9 font-mono text-xs bg-app-bg border border-app-border rounded px-2.5 outline-none focus:border-pld-blue"
                          placeholder="Ej: 941"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase text-app-muted font-bold">% 1</label>
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={pctCc1}
                          onChange={e => setPctCc1(Number(e.target.value))}
                          className="w-full h-9 font-mono text-xs bg-app-bg border border-app-border rounded px-2.5 outline-none focus:border-pld-blue"
                        />
                      </div>
                    </div>

                    {/* CC 2 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] uppercase text-app-muted font-bold">Cta CC 2</label>
                        <input 
                          type="text"
                          value={ctaCc2}
                          onChange={e => setCtaCc2(e.target.value)}
                          className="w-full h-9 font-mono text-xs bg-app-bg border border-app-border rounded px-2.5 outline-none focus:border-pld-blue"
                          placeholder="Ej: 951"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase text-app-muted font-bold">% 2</label>
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={pctCc2}
                          onChange={e => setPctCc2(Number(e.target.value))}
                          className="w-full h-9 font-mono text-xs bg-app-bg border border-app-border rounded px-2.5 outline-none focus:border-pld-blue"
                        />
                      </div>
                    </div>

                    {/* CC 3 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] uppercase text-app-muted font-bold">Cta CC 3</label>
                        <input 
                          type="text"
                          value={ctaCc3}
                          onChange={e => setCtaCc3(e.target.value)}
                          className="w-full h-9 font-mono text-xs bg-app-bg border border-app-border rounded px-2.5 outline-none focus:border-pld-blue"
                          placeholder="Ej: 971"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase text-app-muted font-bold">% 3</label>
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={pctCc3}
                          onChange={e => setPctCc3(Number(e.target.value))}
                          className="w-full h-9 font-mono text-xs bg-app-bg border border-app-border rounded px-2.5 outline-none focus:border-pld-blue"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-right font-mono font-bold pr-1 pt-1">
                      Total: <span className={Math.abs((pctCc1 + pctCc2 + pctCc3) - 100) < 0.001 || (pctCc1 + pctCc2 + pctCc3) === 0 ? "text-green-400" : "text-yellow-500"}>
                        {(pctCc1 + pctCc2 + pctCc3).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-app-border/40 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="h-10 px-5 border border-app-border hover:bg-app-hover rounded-lg text-xs font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="h-10 px-6 bg-pld-blue hover:bg-pld-accent text-black rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-pld-blue/20"
                >
                  {editingAcc ? 'Actualizar Cuenta' : 'Guardar Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanView;
