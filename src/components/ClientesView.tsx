import React, { useState, useRef } from 'react';
import {
  Building2, Plus, Trash2, ArrowRightCircle, Download, Upload,
  CheckCircle2, Loader2, Search, HardDrive, Hash, AlertCircle, FileDown, Printer 
} from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import ConfirmModal from './shared/ConfirmModal';
import PageHeader from './ui/PageHeader';

const ClientesView: React.FC = () => {
  const {
    workspaces, currentCompany, switchWorkspace, createWorkspace,
    deleteWorkspace, restoreBackup, syncCurrentWorkspace
  } = useStore();

  const [newRuc, setNewRuc] = useState('');
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [confirmDeleteWS, setConfirmDeleteWS] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    syncCurrentWorkspace();
    const state = useStore.getState();
    const backupData = JSON.stringify(state, null, 2);
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pld_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmImport(file);
    e.target.value = '';
  };

  const executeImport = () => {
    if (!confirmImport) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const backupData = JSON.parse(result);
        await restoreBackup(backupData);
        setConfirmImport(null);
      } catch { alert("Error: archivo JSON inválido o corrupto."); }
    };
    reader.readAsText(confirmImport);
  };

  const handleCreateClient = async () => {
    if (!newRuc || newRuc.length !== 11) {
      alert("Ingrese un RUC válido de 11 dígitos");
      return;
    }
    setIsSearchingRuc(true);
    setFetchSuccess(false);
    try {
      const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFhbmdlbG8yNTU1QGdtYWlsLmNvbSJ9.oqXPZP_ielNYSWrNo9p45PUjua1IHKIJ3gBj-tK2irY";
      const response = await fetch(`https://dniruc.apisperu.com/api/v1/ruc/${newRuc}?token=${token}`);
      let tempName = "NUEVA EMPRESA", tempAddress = "", tempLocation = "";
      if (response.ok) {
        const data = await response.json();
        if (data?.razonSocial) {
          tempName = data.razonSocial;
          tempAddress = data.direccion || "";
          tempLocation = [data.departamento, data.provincia, data.distrito].filter(Boolean).join(' - ');
          setFetchSuccess(true);
        }
      }
      createWorkspace({ ruc: newRuc, name: tempName, address: tempAddress, location: tempLocation, period: new Date().getFullYear().toString() });
      setNewRuc('');
      setTimeout(() => setFetchSuccess(false), 3000);
    } catch {
      createWorkspace({ ruc: newRuc });
    } finally { setIsSearchingRuc(false); }
  };

  const workspaceList = Object.values(workspaces);
  const filtered = searchFilter
    ? workspaceList.filter(ws =>
        ws.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        ws.ruc.includes(searchFilter)
      )
    : workspaceList;

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Building2 size={18} />}
        title="Mis Empresas"
        subtitle={`${workspaceList.length} empresa${workspaceList.length !== 1 ? 's' : ''} registrada${workspaceList.length !== 1 ? 's' : ''}`}
        actions={
          <>
            <div className="relative hidden md:block group">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-pld-blue transition-colors" />
              <input type="text" placeholder="Buscar empresa o RUC..."
                className="w-64 pl-11 h-10 text-[11px] bg-app-bg border border-app-border rounded-xl outline-none focus:border-pld-blue focus:ring-4 focus:ring-pld-blue/5 transition-all shadow-sm"
                style={{ paddingLeft: '2.75rem' }}
                value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
            </div>

            <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button onClick={handleImportClick}
              className="h-8 bg-app-bg border border-app-border hover:border-pld-blue hover:text-pld-blue transition-all rounded-xl text-[10px] font-bold uppercase flex items-center gap-1.5 px-3">
              <Upload size={13} /> Importar
            </button>
            <button onClick={handleExport}
              className="h-8 bg-pld-blue hover:bg-blue-700 text-white transition-all rounded-xl text-[10px] font-bold uppercase flex items-center gap-1.5 px-3 shadow-sm shadow-pld-blue/20">
              <Download size={13} /> Exportar
            </button>
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={13} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Empresas',
              title: 'LISTADO DE EMPRESAS REGISTRADAS',
              columns: [
                { header: 'RUC', key: 'ruc', width: 15 },
                { header: 'RAZÓN SOCIAL', key: 'name', width: 45 },
                { header: 'DIRECCIÓN', key: 'address', width: 40 },
                { header: 'UBICACIÓN', key: 'location', width: 35 },
                { header: 'PERIODO', key: 'period', width: 10, alignment: 'center' }
              ],
              rows: workspaceList,
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Empresas')} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={13} /> Excel</button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 max-w-6xl mx-auto flex flex-col gap-5">
          <div className="grid lg:grid-cols-3 xl:grid-cols-4 gap-5">

          {/* ═══ ADD NEW CLIENT CARD ═══ */}
          <div className="border border-dashed border-app-border hover:border-pld-blue/40 transition-all rounded-2xl p-6 flex flex-col justify-center items-center text-center gap-4 group bg-app-surface/30">
            <div className="w-14 h-14 rounded-2xl bg-app-bg border border-app-border group-hover:bg-pld-blue/10 group-hover:border-pld-blue/30 flex items-center justify-center transition-all">
              <HardDrive size={24} className="text-app-muted group-hover:text-pld-blue transition-colors" />
            </div>
            <div className="space-y-1.5 w-full relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-pld-blue block">Nuevo Cliente (RUC)</label>
              <input type="text" maxLength={11} placeholder="20XXXXXXXXX"
                className="w-full h-10 text-center text-sm font-mono tracking-wider bg-app-bg border border-app-border rounded-xl focus:border-pld-blue transition-colors"
                value={newRuc}
                onChange={e => setNewRuc(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleCreateClient()} />
              {isSearchingRuc && <Loader2 size={14} className="absolute right-3 top-9 text-pld-blue animate-spin" />}
              {fetchSuccess && <CheckCircle2 size={14} className="absolute right-3 top-9 text-emerald-500" />}
            </div>
            <button onClick={handleCreateClient}
              disabled={isSearchingRuc || newRuc.length !== 11}
              className="w-full h-9 bg-app-bg hover:bg-pld-blue/10 text-app-text hover:text-pld-blue border border-app-border rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus size={14} /> Crear Espacio
            </button>
          </div>

          {/* ═══ CLIENT CARDS ═══ */}
          {filtered.map(ws => {
            const isActive = ws.ruc === currentCompany.ruc;
            // Note: Stats are only available for the currently loaded workspace
            const journalCount = isActive ? useStore.getState().journal.length : 0;
            const salesCount = isActive ? useStore.getState().sales.length : 0;
            const purchasesCount = isActive ? useStore.getState().purchases.length : 0;

            return (
              <div key={ws.ruc}
                className={`card-elevated relative transition-all ${
                  isActive
                    ? 'ring-2 ring-pld-blue/50 border-pld-blue/30'
                    : 'hover:border-pld-blue/20'
                }`}>

                {isActive && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-pld-blue text-white text-[8px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-lg shadow-pld-blue/20">
                    Activo
                  </div>
                )}

                {/* Header Row */}
                <div className="flex items-start justify-between mb-4 mt-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-br from-pld-blue to-pld-magenta'
                      : 'bg-app-bg border border-app-border'
                  }`}>
                    <Building2 size={18} className={isActive ? 'text-white' : 'text-app-muted'} />
                  </div>
                  {!isActive && (
                    <button onClick={() => setConfirmDeleteWS(ws.ruc)}
                      className="p-1.5 text-app-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Company Info */}
                <div className="flex-1 space-y-1 mb-5">
                  <h3 className="font-bold uppercase tracking-tight text-sm leading-tight text-app-text line-clamp-2" title={ws.name}>
                    {ws.name || 'SIN NOMBRE'}
                  </h3>
                  <p className="font-mono text-xs text-app-muted flex items-center gap-1.5">
                    <Hash size={10} /> {ws.ruc}
                  </p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Ventas', count: isActive ? salesCount : '—' },
                    { label: 'Compras', count: isActive ? purchasesCount : '—' },
                    { label: 'Asientos', count: isActive ? journalCount : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-app-bg rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[8px] text-app-muted font-bold uppercase tracking-wider">{s.label}</p>
                      <p className="text-xs font-black text-app-text">{s.count}</p>
                    </div>
                  ))}
                </div>

                {/* Action */}
                <div className="pt-3 border-t border-app-border">
                  {isActive ? (
                    <div className="h-9 flex items-center justify-center rounded-xl bg-pld-blue/10 text-pld-blue font-black uppercase text-[10px] tracking-wider">
                      <CheckCircle2 size={13} className="mr-2" /> Seleccionado
                    </div>
                  ) : (
                    <button onClick={() => switchWorkspace(ws.ruc)}
                      className="w-full h-9 flex items-center justify-center gap-2 rounded-xl bg-app-text text-app-bg hover:bg-pld-blue font-black uppercase text-[10px] tracking-wider transition-all shadow-sm">
                      Cargar <ArrowRightCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

      <ConfirmModal 
        isOpen={!!confirmDeleteWS}
        title="¿Eliminar Empresa?"
        message={`¿Estás seguro de que deseas eliminar la empresa ${workspaces.find(ws => ws.ruc === confirmDeleteWS)?.name}? Todos sus datos locales se perderán permanentemente.`}
        onConfirm={() => {
          if (confirmDeleteWS) {
            deleteWorkspace(confirmDeleteWS);
            setConfirmDeleteWS(null);
          }
        }}
        onCancel={() => setConfirmDeleteWS(null)}
      />

      <ConfirmModal 
        isOpen={!!confirmImport}
        title="⚠️ ADVERTENCIA DE IMPORTACIÓN"
        message="Importar un archivo de respaldo reemplazará TODA la base de datos actual. ¿Deseas continuar?"
        confirmLabel="Si, Importar Todo"
        onConfirm={executeImport}
        onCancel={() => setConfirmImport(null)}
      />
    </div>
  );
};

export default ClientesView;
