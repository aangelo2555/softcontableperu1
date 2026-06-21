import React, { useState } from 'react';
import { Search, PlusCircle, Users, Edit2, Trash2, Globe, FileText, Loader2, FileDown, Printer } from 'lucide-react';
import { exportSingleSheet } from '../utils/excelExport';
import { DataTable } from './DataTable';
import { useStore, type Entity } from '../store';
import Modal from './shared/Modal';
import PageHeader from './ui/PageHeader';

const CliProView: React.FC = () => {
  const { entities, addEntity, updateEntity, deleteEntity, currentCompany, sales, purchases } = useStore();
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [tipo, setTipo] = useState('6');
  const [ruc, setRuc] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [isLoadingRuc, setIsLoadingRuc] = useState(false);

  const filteredData = entities.filter(e =>
    e.ruc.includes(query) ||
    e.descripcion.toLowerCase().includes(query.toLowerCase()) ||
    e.id.includes(query)
  );

  const handleConsultarRuc = async () => {
    if (!ruc || ruc.length < 11) return;
    setIsLoadingRuc(true);
    try {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFhbmdlbG8yNTU1QGdtYWlsLmNvbSJ9.oqXPZP_ielNYSWrNo9p45PUjua1IHKIJ3gBj-tK2irY';
      const resp = await fetch(`https://dniruc.apisperu.com/api/v1/ruc/${ruc}?token=${token}`);
      const data = await resp.json();
      if (data?.razonSocial) setDescripcion(data.razonSocial);
    } catch (err) { console.error("Error consultando RUC", err); }
    finally { setIsLoadingRuc(false); }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruc || !descripcion) return;
    if (editingId) {
      updateEntity(editingId, { tipo, ruc, descripcion });
    } else {
      addEntity({ tipo, ruc, descripcion });
    }
    resetForm();
  };

  const handleEdit = (ent: Entity) => {
    setEditingId(ent.id);
    setTipo(ent.tipo);
    setRuc(ent.ruc);
    setDescripcion(ent.descripcion);
    setShowModal(true);
  };

  const resetForm = () => {
    setTipo('6'); setRuc(''); setDescripcion('');
    setEditingId(null); setShowModal(false);
  };

  const tipoLabels: Record<string, string> = { '6': 'RUC', '1': 'DNI', '4': 'CE', '0': 'OTRO' };

  const columns = [
    {
      header: 'TIPO',
      accessor: (row: Entity) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
          row.tipo === '6' ? 'bg-pld-blue/10 text-pld-blue' :
          row.tipo === '1' ? 'bg-emerald-500/10 text-emerald-500' :
          'bg-app-hover text-app-muted'
        }`}>
          {tipoLabels[row.tipo] || row.tipo}
        </span>
      ),
      className: 'w-20 text-center'
    },
    {
      header: 'RUC / DNI',
      accessor: (row: Entity) => <span className="font-mono text-pld-blue font-bold tracking-wider">{row.ruc}</span>,
      className: 'w-36'
    },
    {
      header: 'RAZÓN SOCIAL / NOMBRE',
      accessor: (row: Entity) => {
        const currentYear = currentCompany?.period ? currentCompany.period.substring(0, 4) : new Date().getFullYear().toString();
        const totalSales = sales.filter(s => s.doc_num === row.ruc && s.fecha.startsWith(currentYear)).reduce((acc, s) => acc + s.total, 0);
        const totalPurchases = purchases.filter(p => p.doc_num === row.ruc && p.fecha.startsWith(currentYear)).reduce((acc, p) => acc + p.total, 0);
        const maxAmount = Math.max(totalSales, totalPurchases);
        
        return (
          <div className="flex flex-col">
            <span className="uppercase text-[11px] font-bold tracking-tight">{row.descripcion}</span>
            {maxAmount >= 2800 && (
              <div className="flex gap-2 mt-0.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider ${
                  maxAmount >= 3500 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  DAOT {maxAmount >= 3500 ? 'ALERTA 100%' : 'ADVERTENCIA 80%'}: S/ {maxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        );
      },
      className: 'uppercase text-[11px] font-bold tracking-tight'
    },
    {
      header: '',
      accessor: (row: Entity) => (
        <div className="flex gap-1 justify-center">
          <button onClick={() => handleEdit(row)} className="p-1.5 hover:text-pld-blue hover:bg-pld-blue/10 rounded-lg transition-all"><Edit2 size={13} /></button>
          <button onClick={() => { if (confirm('¿Eliminar?')) deleteEntity(row.id) }} className="p-1.5 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
        </div>
      ),
      className: 'w-24 text-center'
    }
  ];

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Users size={18} />}
        title="Directorio"
        subtitle={`${entities.length} entidades registradas`}
        actions={
          <>
            <div className="relative flex-1 max-w-sm group">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-pld-blue transition-colors" />
              <input type="text" placeholder="Buscar cliente o proveedor (RUC/Nombre)..."
                autoFocus
                className="w-full pl-11 h-10 text-[11px] bg-app-bg border border-app-border rounded-xl outline-none focus:border-pld-blue focus:ring-4 focus:ring-pld-blue/5 transition-all shadow-sm"
                style={{ paddingLeft: '2.75rem' }}
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <button onClick={() => { resetForm(); setShowModal(true); }}
              className="h-9 bg-pld-blue hover:bg-blue-700 text-white font-bold px-4 rounded-xl flex items-center gap-2 transition-all text-[10px] uppercase tracking-wider shadow-sm shadow-pld-blue/20 shrink-0">
              <PlusCircle size={14} /> Nueva Entidad
            </button>
            <button onClick={() => window.print()} className="h-9 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Directorio',
              title: 'DIRECTORIO DE CLIENTES Y PROVEEDORES',
              columns: [
                { header: 'TIPO', key: 'tipo', width: 8, alignment: 'center' },
                { header: 'RUC/DNI', key: 'ruc', width: 14 },
                { header: 'RAZÓN SOCIAL', key: 'descripcion', width: 50 }
              ],
              rows: entities,
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Directorio')} className="h-9 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
          {filteredData.length > 0 ? (
            <DataTable
              columns={columns}
              data={filteredData}
              emptyMessage="Sin entidades registradas"
              headerClassName="bg-app-bg/80 text-app-muted uppercase text-[9px] font-black h-10 sticky top-0 backdrop-blur-md"
              rowClassName="h-11 border-b border-app-border/30 hover:bg-app-hover cursor-default transition-colors"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-app-muted">
              <FileText size={40} strokeWidth={1.5} className="mb-3 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest mb-1">
                {query ? 'Sin resultados' : 'Directorio vacío'}
              </p>
              <p className="text-[10px] opacity-70">
                {query ? `No se encontró "${query}"` : 'Agrega clientes o proveedores para comenzar'}
              </p>
              {!query && (
                <button onClick={() => { resetForm(); setShowModal(true); }}
                  className="mt-4 h-9 px-5 bg-pld-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-pld-blue/20">
                  + Agregar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={resetForm} title={editingId ? 'Editar Entidad' : 'Nueva Entidad'} subtitle="Directorio de Clientes y Proveedores">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted">Tipo Doc</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="w-full h-11 bg-app-bg border border-app-border rounded-xl px-3 text-xs font-bold outline-none focus:border-pld-blue">
                <option value="6">RUC (6)</option>
                <option value="1">DNI (1)</option>
                <option value="4">CE (4)</option>
                <option value="0">OTROS (0)</option>
              </select>
            </div>
            <div className="col-span-12 sm:col-span-8 space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted">N° Identificación</label>
              <div className="flex gap-2">
                <input type="text" maxLength={11} required placeholder="20XXXXXXXXX" value={ruc}
                  onChange={e => setRuc(e.target.value)}
                  className="flex-1 h-11 bg-app-bg border border-app-border rounded-xl px-3 text-sm font-mono font-bold outline-none focus:border-pld-blue" />
                {tipo === '6' && (
                  <button type="button" onClick={handleConsultarRuc}
                    disabled={isLoadingRuc || ruc.length < 11}
                    className="bg-pld-blue/10 text-pld-blue h-11 px-4 rounded-xl hover:bg-pld-blue/20 disabled:opacity-30 transition-all flex items-center">
                    {isLoadingRuc ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-app-muted">Razón Social / Nombre</label>
            <textarea required rows={2}
              className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-sm font-bold uppercase outline-none focus:border-pld-blue resize-none"
              placeholder="Nombre completo..." value={descripcion} onChange={e => setDescripcion(e.target.value)} />
          </div>

          <div className="pt-4 flex flex-col gap-2.5">
            <button type="submit"
              className="w-full h-12 bg-pld-blue hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-pld-blue/15 flex items-center justify-center gap-2">
              {editingId ? 'Guardar Cambios' : 'Registrar Entidad'}
            </button>
            <button type="button" onClick={resetForm}
              className="w-full h-12 border border-app-border hover:bg-app-hover rounded-xl text-xs font-bold uppercase transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CliProView;
