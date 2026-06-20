import React, { useState } from 'react';
import { Files, Search, Plus, X, Edit2, Trash2, FileDown, Printer } from 'lucide-react';
import { DataTable } from './DataTable';
import { useStore } from '../store';
import type { Account } from '../logic/plan';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

const PlanView: React.FC = () => {
  const { plan, addAccount, updateAccount, deleteAccount, currentCompany } = useStore();
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);

  // Form state
  const [newCta, setNewCta] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'Balance' | 'Resultados' | 'Registro'>('Balance');
  const [reqCenCos, setReqCenCos] = useState(false);
  const [amarreDebe, setAmarreDebe] = useState('');
  const [amarreHaber, setAmarreHaber] = useState('');

  // Filter accounts
  const filteredData = plan.filter(acc => 
    acc.cta.includes(query) || 
    acc.description.toLowerCase().includes(query.toLowerCase())
  );

  const columns = [
    { header: 'Cuenta', accessor: (row: Account) => <span className="font-mono font-bold text-pld-blue">{row.cta}</span> },
    { header: 'Descripción', accessor: 'description' as keyof Account },
    { header: 'Tipo', accessor: 'type' as keyof Account, className: 'text-app-muted italic' },
    { header: 'Amarre D/H', accessor: (row: Account) => (
      row.amarreDebe || row.amarreHaber ? 
      <span className="font-mono text-[10px]">{row.amarreDebe || '-'} / {row.amarreHaber || '-'}</span> 
      : '-'
    ), className: 'text-center' },
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
  ];

  const handleStartEdit = (acc: Account) => {
    setEditingAcc(acc);
    setNewCta(acc.cta);
    setNewDesc(acc.description);
    setNewType(acc.type);
    setReqCenCos(acc.reqCenCos || false);
    setAmarreDebe(acc.amarreDebe || '');
    setAmarreHaber(acc.amarreHaber || '');
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
      amarreDebe: amarreDebe || undefined,
      amarreHaber: amarreHaber || undefined,
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
    setEditingAcc(null);
    setShowAddModal(false);
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
                { header: 'AMARRE DEBE', key: 'amarreDebe', width: 14, alignment: 'center' },
                { header: 'AMARRE HABER', key: 'amarreHaber', width: 14, alignment: 'center' }
              ],
              rows: plan,
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Plan_Contable')} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
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
          />
        </div>
      </div>

      {/* Add/Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-app-surface w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-app-border/50 animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-app-border bg-app-bg flex justify-between items-center">
              <h3 className="font-black uppercase text-xs tracking-widest text-pld-blue">
                {editingAcc ? 'Editar Cuenta Contable' : 'Agregar Nueva Cuenta'}
              </h3>
              <button onClick={resetForm} className="text-app-muted hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddOrUpdate} className="p-6 space-y-5">
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

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest uppercase text-app-muted">Amarre Debe</label>
                  <input 
                    type="text"
                    value={amarreDebe}
                    onChange={e => setAmarreDebe(e.target.value)}
                    className="w-full h-10 font-mono text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                    placeholder="Ej: 941"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest uppercase text-app-muted">Amarre Haber</label>
                  <input 
                    type="text"
                    value={amarreHaber}
                    onChange={e => setAmarreHaber(e.target.value)}
                    className="w-full h-10 font-mono text-sm bg-app-bg border border-app-border rounded px-3 outline-none focus:border-pld-blue"
                    placeholder="Ej: 791"
                  />
                </div>
              </div>

              <div className="pt-6 flex flex-col gap-2">
                <button 
                  type="submit"
                  className="w-full h-12 bg-pld-blue hover:bg-pld-accent text-black rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-pld-blue/20"
                >
                  {editingAcc ? 'Actualizar Cuenta' : 'Guardar Cuenta'}
                </button>
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="w-full h-12 border border-app-border hover:bg-app-hover rounded-lg text-xs font-bold uppercase transition-colors"
                >
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

export default PlanView;
