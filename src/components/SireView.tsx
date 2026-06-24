import React, { useState, useEffect, useMemo } from 'react';
import {
  CloudDownload,
  History,
  FileCheck,
  AlertCircle,
  Loader2,
  Search,
  Download,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Filter,
  RefreshCw,
  CheckCircle2,
  ArrowRightLeft,
  FileDown,
  Database,
  FileJson,
  Trash2
} from 'lucide-react';
import { useStore } from '../store';
import type { PurchaseEntry, SaleEntry } from '../store';
import { toast } from 'react-hot-toast';
import { parseSireTxt } from '../engine/sireParser';
import { reconcileSireWithERP, type ReconciliationSummary, type DiagnosticLevel } from '../engine/sireReconciliation';
import PageHeader from './ui/PageHeader';

const SireView: React.FC = () => {
  const { currentCompany, purchases, sales, syncCurrentWorkspace, deletePurchase, deleteSale, deletePurchases, deleteSales, setActiveTab } = useStore();
  const [proceso, setProceso] = useState<'Generar RCE' | 'Generar RVIE'>('Generar RCE');
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth());
  const [periodoAnio, setPeriodoAnio] = useState(new Date().getFullYear());
  const [isRunning, setIsRunning] = useState(false);
  const [viewMode, setViewMode] = useState<'comparacion' | 'archivos' | 'auditoria'>('comparacion');
  const [searchTerm, setSearchTerm] = useState('');
  const [archivos, setArchivos] = useState<{ nombre: string; fecha: string }[]>([]);
  const [isLoadingArchivos, setIsLoadingArchivos] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);

  const electron = (window as any).electronAPI;

  // --- Memos First ---
  const comparedData = useMemo(() => {
    const monthStr = String(periodoMes + 1).padStart(2, '0');
    const periodoStr = `${periodoAnio}-${monthStr}`;
    
    const allDocLocal = (proceso === 'Generar RCE' ? purchases : sales) as (PurchaseEntry | SaleEntry)[];
    
    // Filtrar por periodo (la fecha está en YYYY-MM-DD)
    // Agregamos HELPER para comparación de fechas robusta
    const isSamePeriod = (dateStr: string) => {
      if (!dateStr) return false;
      // Formato YYYY-MM-DD o DD/MM/YYYY
      if (dateStr.includes('-')) {
        const [y, m] = dateStr.split('-');
        return y === String(periodoAnio) && m === monthStr;
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        // Puede ser DD/MM/YYYY o YYYY/MM/DD
        if (parts[0].length === 4) return parts[0] === String(periodoAnio) && parts[1] === monthStr;
        return parts[2] === String(periodoAnio) && parts[1] === monthStr;
      }
      return dateStr.startsWith(periodoStr);
    };
    
    // Filtrar por periodo con la nueva lógica
    const localInPeriod = allDocLocal.filter(d => isSamePeriod(d.fecha) && (d.estado_sire === 'Local' || d.estado_sire === 'Aceptado'));
    const sunatInPeriod = allDocLocal.filter(d => isSamePeriod(d.fecha) && d.estado_sire === 'Propuesta');

    const result: any[] = [];
    const matchedLocalIds = new Set();

    sunatInPeriod.forEach(s => {
      const match = localInPeriod.find(l => 
        l.tipo_doc === s.tipo_doc && 
        l.serie?.toUpperCase() === s.serie?.toUpperCase() && 
        l.numero === s.numero
      );
      
      if (match) matchedLocalIds.add(match.id);
      
      result.push({
        id: String(s.id),
        sunat: s,
        local: match || null,
        status: match 
          ? (Math.abs(s.total - match.total) < 0.1 ? 'MATCH' : 'DISCREPANCY') 
          : 'ONLY_SUNAT'
      });
    });

    localInPeriod.forEach(l => {
      if (!matchedLocalIds.has(l.id)) {
        result.push({
          id: String(l.id),
          sunat: null,
          local: l,
          status: 'ONLY_LOCAL'
        });
      }
    });

    return result.filter(item => {
      const term = searchTerm.toLowerCase();
      const doc = item.sunat || item.local;
      return (
        doc.numero.toLowerCase().includes(term) ||
        doc.nombre.toLowerCase().includes(term) ||
        doc.doc_num.toLowerCase().includes(term)
      );
    });
  }, [purchases, sales, proceso, periodoMes, periodoAnio, searchTerm]);

  const stats = useMemo(() => {
    return {
      coinciden: comparedData.filter(d => d.status === 'MATCH').length,
      discrepancias: comparedData.filter(d => d.status === 'DISCREPANCY').length,
      soloSunat: comparedData.filter(d => d.status === 'ONLY_SUNAT').length,
      soloLocal: comparedData.filter(d => d.status === 'ONLY_LOCAL').length,
      totalSunat: comparedData.filter(d => d.sunat).reduce((acc, d) => acc + (d.sunat?.total || 0), 0),
      totalLocal: comparedData.filter(d => d.local).reduce((acc, d) => acc + (d.local?.total || 0), 0)
    };
  }, [comparedData]);

  const uniqueArchivos = useMemo(() => {
    const rucFilter = currentCompany?.ruc || '';
    if (!rucFilter) return [];

    const filtered = archivos.filter(file => {
      const nameUpper = file.nombre.toUpperCase();
      
      // Filtrar por RUC correspondiente
      const hasRuc = nameUpper.includes(rucFilter);
      if (!hasRuc) return false;

      // Filtrar por proceso (RCE o RVIE)
      if (proceso === 'Generar RCE') {
        return nameUpper.includes('RCE') || nameUpper.includes('080400');
      } else {
        return nameUpper.includes('RVIE') || nameUpper.includes('140400');
      }
    });

    const map = new Map<string, typeof archivos[0]>();
    filtered.forEach(file => {
      const parts = file.nombre.split('_');
      if (parts.length >= 3) {
        const key = `${parts[0]}_${parts[1]}_${parts[2]}`;
        if (!map.has(key)) map.set(key, file);
      } else {
        map.set(file.nombre, file);
      }
    });
    return Array.from(map.values());
  }, [archivos, proceso, currentCompany?.ruc]);

  // --- Handlers ---
  const loadArchivos = async () => {
    if (!electron) return;
    setIsLoadingArchivos(true);
    try {
      const docs = await electron.listarArchivosSire();
      if (Array.isArray(docs)) setArchivos(docs);
    } catch (error) {
      console.error("Error cargando archivos:", error);
    } finally {
      setIsLoadingArchivos(false);
    }
  };

  useEffect(() => {
    loadArchivos();
  }, []);

  const handleEjecutar = async () => {
    if (!electron) return;
    if (!currentCompany.sol_user || !currentCompany.sol_pass || !currentCompany.sunatClientId || !currentCompany.sunatClientSecret) {
      toast.error('Faltan credenciales SOL o API en Configuración.');
      return;
    }

    const periodo = `${periodoAnio}${String(periodoMes + 1).padStart(2, '0')}`;
    setIsRunning(true);
    const loadingToast = toast.loading(`Sincronizando con SUNAT para el periodo ${periodo}...`);

    try {
      const result = await electron.ejecutarSire({
        ruc: currentCompany.ruc,
        empresa: currentCompany.name,
        proceso: proceso,
        periodoInicio: periodo,
        rangoActivo: false,
        credentials: {
          ruc: currentCompany.ruc,
          usuario_sol: currentCompany.sol_user,
          clave_sol: currentCompany.sol_pass,
          client_id: currentCompany.sunatClientId,
          client_secret: currentCompany.sunatClientSecret
        },
        plan: 'premium'
      });

      if (result.success) {
        toast.success(`Sincronización exitosa.`, { id: loadingToast });
        await syncCurrentWorkspace(); // Recargar datos desde DB
        loadArchivos();
      } else {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
      }
    } catch (error: any) {
      toast.error(`Error crítico: ${error.message}`, { id: loadingToast });
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerarArchivoReemplazo = async () => {
    if (!electron || comparedData.length === 0) return;
    
    const periodo = `${periodoAnio}${String(periodoMes + 1).padStart(2, '0')}`;
    const loadingToast = toast.loading('Generando archivo de reemplazo...');
    
    try {
      const registros = comparedData.map(item => item.local || item.sunat);
      
      const result = await electron.generarArchivoSire({
        ruc: currentCompany.ruc,
        periodo: periodo,
        proceso: proceso,
        registros: registros
      });

      if (result.success) {
        toast.success(`Archivo generado en CARPETA SIRE SUNAT: ${result.filename}`, { id: loadingToast });
      } else {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: loadingToast });
    }
  };

  const handleImportToLocal = async (record: PurchaseEntry | SaleEntry) => {
    if (!electron) return;
    try {
      const table = proceso === 'Generar RCE' ? 'purchases' : 'sales';
      await electron.dbExecute(`UPDATE ${table} SET estado_sire = 'Local' WHERE id = ?`, [record.id]);
      toast.success('Documento importado a registros locales.');
      await syncCurrentWorkspace();
    } catch (error) {
      toast.error('Error al importar.');
    }
  };

  const handleDeleteRecord = async (item: any) => {
    let targetId = '';
    let isSunatRecord = false;
    let label = '';
    
    if (item.status === 'ONLY_LOCAL') {
      targetId = item.local?.id;
      isSunatRecord = false;
      label = `el comprobante contable local ${item.local?.tipo_doc} ${item.local?.serie}-${item.local?.numero}`;
    } else {
      targetId = item.sunat?.id;
      isSunatRecord = true;
      label = `el registro importado de SUNAT ${item.sunat?.tipo_doc} ${item.sunat?.serie}-${item.sunat?.numero}`;
    }
    
    if (!targetId) return;
    
    const confirmMessage = isSunatRecord
      ? `¿Estás seguro de que deseas eliminar ${label} de la propuesta del SIRE? (Podrás volver a sincronizarlo desde SUNAT)`
      : `⚠️ ADVERTENCIA: ¿Estás seguro de que deseas eliminar ${label}? Esto borrará el asiento contable local asociado.`;
      
    if (!window.confirm(confirmMessage)) return;
    
    try {
      if (proceso === 'Generar RCE') {
        await deletePurchase(targetId);
      } else {
        await deleteSale(targetId);
      }
      toast.success('Registro eliminado correctamente.');
      await syncCurrentWorkspace();
    } catch (e: any) {
      toast.error(`Error al eliminar: ${e.message}`);
    }
  };

  const showDiscrepancyDetails = (item: any) => {
    const diffTotal = (item.sunat?.total || 0) - (item.local?.total || 0);
    const diffBi = (item.sunat?.bi || 0) - (item.local?.bi || 0);
    const diffIgv = (item.sunat?.igv || 0) - (item.local?.igv || 0);
    
    toast((t) => (
      <div className="flex flex-col gap-1 text-[11px] font-bold">
        <p className="text-amber-500 font-black border-b border-app-border pb-1 mb-1">DETALLE DE DISCREPANCIAS</p>
        <p>Total SUNAT: S/ {item.sunat?.total.toFixed(2)} | Local: S/ {item.local?.total.toFixed(2)} (Diff: S/ {diffTotal.toFixed(2)})</p>
        <p>B.I. SUNAT: S/ {item.sunat?.bi.toFixed(2)} | Local: S/ {item.local?.bi.toFixed(2)} (Diff: S/ {diffBi.toFixed(2)})</p>
        <p>I.G.V. SUNAT: S/ {item.sunat?.igv.toFixed(2)} | Local: S/ {item.local?.igv.toFixed(2)} (Diff: S/ {diffIgv.toFixed(2)})</p>
      </div>
    ), { duration: 6000, icon: '🔍' });
  };

  const handleDeleteArchivo = async (nombre: string) => {
    if (!electron) return;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el archivo ${nombre}?`)) return;
    
    try {
      const result = await electron.eliminarArchivoSire(nombre);
      if (result.success) {
        toast.success('Archivo eliminado correctamente.');
        loadArchivos();
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  };

  const handleCentralizeSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un documento.');
      return;
    }

    const recordsToCentralize = comparedData
      .filter(d => selectedIds.has(d.id))
      .map(d => d.sunat || d.local);

    const loadingToast = toast.loading(`Centralizando ${recordsToCentralize.length} documentos...`);
    
    try {
      await useStore.getState().centralizeSireRecords(currentCompany.ruc, recordsToCentralize, proceso);
      toast.success('Centralización completada y asientos generados.', { id: loadingToast });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: loadingToast });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un documento.');
      return;
    }

    const confirmMessage = `¿Estás seguro de que deseas eliminar los ${selectedIds.size} registros seleccionados de la conciliación?
⚠️ ADVERTENCIA: Se eliminarán los registros importados de SUNAT y los comprobantes contables locales seleccionados (junto con sus asientos contables asociados).`;

    if (!window.confirm(confirmMessage)) return;

    const loadingToast = toast.loading(`Eliminando ${selectedIds.size} documentos...`);

    try {
      const targetIds = comparedData
        .filter(d => selectedIds.has(d.id))
        .map(d => d.sunat?.id || d.local?.id)
        .filter(Boolean) as string[];

      if (proceso === 'Generar RCE') {
        await deletePurchases(targetIds);
      } else {
        await deleteSales(targetIds);
      }

      toast.success('Registros eliminados correctamente.', { id: loadingToast });
      setSelectedIds(new Set());
      await syncCurrentWorkspace();
    } catch (error: any) {
      toast.error(`Error al eliminar: ${error.message}`, { id: loadingToast });
    }
  };

  const handleDeleteAll = async () => {
    if (comparedData.length === 0) return;

    const confirmMessage = `⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de que deseas eliminar TODOS los ${comparedData.length} registros listados en la conciliación?
Esto eliminará tanto los registros importados de SUNAT como los comprobantes locales de este período (con sus asientos asociados).`;

    if (!window.confirm(confirmMessage)) return;

    const loadingToast = toast.loading(`Eliminando todos los ${comparedData.length} registros...`);

    try {
      const targetIds = comparedData
        .map(d => d.sunat?.id || d.local?.id)
        .filter(Boolean) as string[];

      if (proceso === 'Generar RCE') {
        await deletePurchases(targetIds);
      } else {
        await deleteSales(targetIds);
      }

      toast.success('Todos los registros del período fueron eliminados.', { id: loadingToast });
      setSelectedIds(new Set());
      await syncCurrentWorkspace();
    } catch (error: any) {
      toast.error(`Error al eliminar todo: ${error.message}`, { id: loadingToast });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === comparedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(comparedData.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const handleImportTxt = async () => {
    if (!electron) return;
    const loadingToast = toast.loading('Importando archivo SIRE TXT...');
    try {
      const result = await electron.sireImportarTxt();
      if (!result.success) { toast.error(result.error, { id: loadingToast }); return; }
      const parsed = parseSireTxt(result.content, proceso === 'Generar RVIE');
      toast.success(`Parseados ${parsed.validRecords} registros de ${result.filename} (${parsed.errorRecords} con errores)`, { id: loadingToast });
      
      const erpRecords = proceso === 'Generar RCE' ? purchases : sales;
      const recon = reconcileSireWithERP(
        parsed.records,
        erpRecords as any,
        proceso === 'Generar RVIE',
        currentCompany?.ruc
      );
      setReconciliation(recon);
      setViewMode('auditoria');
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { id: loadingToast });
    }
  };

  const DIAGNOSTIC_STYLES: Record<DiagnosticLevel, { bg: string; text: string; label: string }> = {
    'ESTADO_OK': { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', label: 'OK' },
    'RIESGO_CRITICO': { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-500', label: 'CRÍTICO' },
    'RIESGO_ALTO': { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-500', label: 'ALTO' },
    'ALERTA_LEGAL_ESTADO': { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-500', label: 'LEGAL' },
    'ALERTA_MATEMATICA_VALOR': { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-500', label: 'IGV' },
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<CloudDownload size={18} />}
        title="Módulo SIRE"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">
            SUNAT SIRE
          </span>
        }
        subtitle={`${currentCompany?.name || ''} • RUC: ${currentCompany?.ruc || ''}`}
        actions={
          <div className="flex items-center gap-2 bg-app-surface p-1 rounded-xl border border-app-border shadow-sm">
            <button
              onClick={() => setViewMode('comparacion')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'comparacion' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-app-muted hover:text-app-text'}`}
            >
              Conciliación
            </button>
            <button
              onClick={() => setViewMode('archivos')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'archivos' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-app-muted hover:text-app-text'}`}
            >
              Historial ZIP
            </button>
            <button
              onClick={() => setViewMode('auditoria')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'auditoria' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20' : 'text-app-muted hover:text-app-text'}`}
            >
              Auditoría CAR
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* ═══ ULTRA-COMPACT CONTROLS & STATS ═══ */}
      {/* ═══ ULTRA-COMPACT CONTROLS & STATS ═══ */}
      <div className="flex flex-col gap-3 shrink-0">
        
        {/* Compact Filters Group */}
        <div className="w-full card-elevated !p-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex p-0.5 bg-app-bg rounded-lg border border-app-border">
              <button
                onClick={() => setProceso('Generar RCE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${proceso === 'Generar RCE' ? 'bg-app-surface text-app-text shadow-sm border border-app-border' : 'text-app-muted hover:text-blue-500'}`}
              >
                <TrendingDown size={12} /> Compras
              </button>
              <button
                onClick={() => setProceso('Generar RVIE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${proceso === 'Generar RVIE' ? 'bg-app-surface text-app-text shadow-sm border border-app-border' : 'text-app-muted hover:text-indigo-500'}`}
              >
                <TrendingUp size={12} /> Ventas
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={periodoMes}
                onChange={(e) => setPeriodoMes(parseInt(e.target.value))}
                className="bg-app-bg border-app-border text-[10px] font-black uppercase px-2 py-1.5 h-8"
              >
                {meses.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select
                value={periodoAnio}
                onChange={(e) => setPeriodoAnio(parseInt(e.target.value))}
                className="bg-app-bg border-app-border text-[10px] font-black uppercase px-2 py-1.5 h-8"
              >
                {anios.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleEjecutar}
              disabled={isRunning}
              className="h-8 px-4 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isRunning ? <Loader2 size={12} className="animate-spin" /> : <CloudDownload size={14} />}
              Descargar
            </button>
            <button
              onClick={handleCentralizeSelected}
              className="h-8 px-4 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2"
            >
              <Database size={14} /> Centralizar {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            {selectedIds.size > 0 ? (
              <button
                onClick={handleDeleteSelected}
                className="h-8 px-4 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 animate-fade-in"
                title="Eliminar comprobantes seleccionados"
              >
                <Trash2 size={14} /> Eliminar ({selectedIds.size})
              </button>
            ) : (
              comparedData.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="h-8 px-4 bg-rose-600/10 text-rose-500 border border-rose-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 animate-fade-in"
                  title="Eliminar todos los comprobantes del periodo"
                >
                  <Trash2 size={14} /> Eliminar Todo
                </button>
              )
            )}
            <button
              onClick={handleGenerarArchivoReemplazo}
              className="h-8 w-8 flex items-center justify-center bg-app-bg border border-app-border text-app-muted hover:text-emerald-500 hover:border-emerald-500/30 rounded-lg transition-all"
              title="Generar ZIP"
            >
              <FileJson size={16} />
            </button>
            <button
              onClick={handleImportTxt}
              className="h-8 px-4 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-violet-700 transition-all flex items-center gap-2"
              title="Importar archivo TXT del SIRE (Anexo 3 o 11)"
            >
              <FileDown size={14} /> Importar TXT
            </button>
          </div>
        </div>

        {/* Stats Badge Group (Now in its own row, extremely premium!) */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-3 flex items-center justify-between shadow-sm transition-all hover:scale-[1.01] hover:bg-emerald-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Coinciden</span>
              <span className="text-base font-black text-app-text leading-none">{stats.coinciden}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle2 size={14} />
            </div>
          </div>
          
          <div className="bg-rose-500/5 border border-rose-500/25 rounded-2xl p-3 flex items-center justify-between shadow-sm transition-all hover:scale-[1.01] hover:bg-rose-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Discrepancias</span>
              <span className="text-base font-black text-app-text leading-none">{stats.discrepancias}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <AlertCircle size={14} />
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-3 flex items-center justify-between shadow-sm transition-all hover:scale-[1.01] hover:bg-amber-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Solo Sunat</span>
              <span className="text-base font-black text-app-text leading-none">{stats.soloSunat}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <ArrowRightLeft size={14} />
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/25 rounded-2xl p-3 flex items-center justify-between shadow-sm transition-all hover:scale-[1.01] hover:bg-blue-500/10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Solo Local</span>
              <span className="text-base font-black text-app-text leading-none">{stats.soloLocal}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <History size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT AREA ═══ */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col gap-3">
        
        {viewMode === 'comparacion' ? (
          <div className="card-elevated !p-0 flex flex-col overflow-hidden h-full">
            <div className="px-5 py-3 border-b border-app-border flex items-center justify-between bg-app-surface/50 shrink-0">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className={`text-blue-500 ${isRunning ? 'animate-spin' : ''}`} />
                <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-app-text">Conciliación de Comprobantes</h3>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                <input
                  type="text"
                  placeholder="FILTRAR..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-app-bg border-app-border rounded-lg text-[9px] font-black w-48 focus:ring-1 ring-blue-500/30 transition-all uppercase h-7"
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-app-surface shadow-sm border-b border-app-border">
                  <tr className="text-[8px] font-black uppercase tracking-widest text-app-muted">
                    <th className="px-5 py-3 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-app-border bg-app-bg" 
                        checked={selectedIds.size === comparedData.length && comparedData.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Documento</th>
                    <th className="px-3 py-3">Entidad</th>
                    <th className="px-3 py-3 text-right">Total SUNAT</th>
                    <th className="px-3 py-3 text-right">Total Local</th>
                    <th className="px-3 py-3 text-center">Diferencia</th>
                    <th className="px-5 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/50">
                  {comparedData.map((item) => {
                    const doc = item.sunat || item.local;
                    const diff = (item.sunat?.total || 0) - (item.local?.total || 0);
                    const isSelected = selectedIds.has(item.id);
                    
                    return (
                      <tr key={item.id} className={`text-[10px] hover:bg-white/[0.02] transition-colors group ${isSelected ? 'bg-blue-500/5' : ''}`}>
                        <td className="px-3 py-2">
                          <input 
                            type="checkbox" 
                            className="rounded border-app-border bg-app-bg" 
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {item.status === 'MATCH' && <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-black text-[9px]">OK</span>}
                          {item.status === 'DISCREPANCY' && <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 font-black text-[9px]">OBS</span>}
                          {item.status === 'ONLY_SUNAT' && <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-black text-[9px]">SUNAT</span>}
                          {item.status === 'ONLY_LOCAL' && <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-black text-[9px]">LOCAL</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-app-text font-black tracking-tight leading-none">{doc.tipo_doc} {doc.serie}-{doc.numero}</span>
                            <span className="text-app-muted text-[8px] mt-0.5 font-bold">{doc.fecha}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col max-w-[200px]">
                            <span className="text-app-text font-bold truncate uppercase leading-none">{doc.nombre}</span>
                            <span className="text-app-muted text-[8px] font-mono mt-0.5">{doc.doc_num}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-app-text">
                          {item.sunat ? item.sunat.total.toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-app-text">
                          {item.local ? item.local.total.toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {Math.abs(diff) > 0.01 ? (
                            <span className={`font-mono font-bold text-[9px] ${diff > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                            </span>
                          ) : <span className="text-app-muted opacity-20">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right pr-8">
                          <div className="flex justify-end gap-1">
                            {item.status === 'ONLY_SUNAT' && (
                              <button 
                                onClick={() => handleImportToLocal(item.sunat)}
                                className="p-1.5 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-all" 
                                title="Importar a Local"
                              >
                                <FileDown size={14} />
                              </button>
                            )}
                            {item.status === 'DISCREPANCY' && (
                              <button 
                                onClick={() => showDiscrepancyDetails(item)}
                                className="p-1.5 hover:bg-amber-500/20 text-amber-500 rounded-lg transition-all" 
                                title="Ver detalles de discrepancias"
                              >
                                <AlertCircle size={14} />
                              </button>
                            )}
                            {item.local && (
                              <button 
                                onClick={() => setActiveTab(proceso === 'Generar RCE' ? 'COMPRAS' : 'VENTAS')}
                                className="p-1.5 hover:bg-blue-500/10 text-app-muted hover:text-white rounded-lg transition-all"
                                title="Ir a registro contable local"
                              >
                                <ExternalLink size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteRecord(item)}
                              className="p-1.5 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all" 
                              title={item.status === 'ONLY_LOCAL' ? 'Eliminar comprobante local' : 'Eliminar registro del SIRE'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {comparedData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-24 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <Filter size={48} strokeWidth={1} className="mb-4" />
                          <p className="text-[12px] font-black uppercase tracking-[0.2em]">No se encontraron registros</p>
                          <p className="text-[10px] font-bold mt-2 max-w-sm">
                            Asegúrate de haber seleccionado el periodo correcto y haz clic en 
                            <span className="text-blue-500 mx-1">DESCARGAR PROPUESTA</span> 
                            para traer datos de SUNAT.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Footer Summary */}
            <div className="px-5 py-2 bg-app-surface border-t border-app-border flex items-center justify-between shrink-0">
               <div className="flex items-center gap-5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[9px] font-black text-app-muted uppercase italic">Local:</span>
                    <span className="text-[10px] font-black text-app-text font-mono">S/ {stats.totalLocal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-app-border pl-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-[9px] font-black text-app-muted uppercase italic">SUNAT:</span>
                    <span className="text-[10px] font-black text-app-text font-mono">S/ {stats.totalSunat.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
               <div className="text-[8px] font-black text-app-muted/60 uppercase tracking-widest italic flex items-center gap-2">
                  <RefreshCw size={10} />
                  Actualizado: {new Date().toLocaleTimeString()}
               </div>
            </div>
          </div>
        ) : (
          /* ═══ FILES VIEW ═══ */
          <div className="card-elevated !p-0 flex flex-col h-full bg-app-surface/30">
            <div className="px-5 py-3 border-b border-app-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-blue-500" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-app-text">Archivos Generados</h3>
              </div>
              <button 
                onClick={loadArchivos}
                className="p-2 text-app-muted hover:text-app-text transition-colors"
              >
                <Loader2 size={14} className={isLoadingArchivos ? 'animate-spin' : ''} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-min">
              {uniqueArchivos.map((file, idx) => {
                let exactTime = file.fecha;
                const parts = file.nombre.split('_');
                if (parts.length >= 4) {
                  const timestampStr = parts[3].split('.')[0];
                  const ts = Number(timestampStr);
                  if (!isNaN(ts)) {
                    const date = new Date(ts);
                    exactTime = `F: ${date.toLocaleDateString('es-PE')} - H: ${date.toLocaleTimeString('es-PE')}`;
                  }
                }
                return (
                <div key={idx} className="bg-app-bg/50 border border-app-border hover:border-blue-500/30 rounded-xl p-3 flex items-center gap-3 group transition-all">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${file.nombre.includes('RCE') ? 'bg-violet-500/10 text-violet-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                    <FileCheck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-app-text truncate uppercase tracking-tight group-hover:text-blue-500 transition-colors">{file.nombre}</p>
                    <p className="text-[9px] text-app-muted font-bold mt-1">{exactTime}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => electron.abrirArchivoSire(file.nombre)}
                      className="p-1.5 text-app-muted hover:text-emerald-500 bg-app-surface rounded-md border border-app-border transition-all"
                      title="Abrir/Descargar"
                    >
                      <Download size={12} />
                    </button>
                    <button 
                      onClick={() => handleDeleteArchivo(file.nombre)}
                      className="p-1.5 text-app-muted hover:text-rose-500 bg-app-surface rounded-md border border-app-border transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )})}
              {uniqueArchivos.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center opacity-20">
                  <FileJson size={40} className="mb-3" />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">Sin archivos disponibles</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ AUDITORÍA CAR VIEW ═══ */}
        {viewMode === 'auditoria' && (
          <div className="card-elevated !p-0 flex flex-col overflow-hidden h-full">
            <div className="px-5 py-3 border-b border-app-border flex items-center justify-between bg-app-surface/50 shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-violet-500" />
                <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-app-text">Auditoría por CAR (27 chars) — Conciliación SIRE vs ERP</h3>
              </div>
              {reconciliation && (
                <div className="flex items-center gap-3 text-[9px] font-black">
                  <span className="text-emerald-500">OK: {reconciliation.estadoOK}</span>
                  <span className="text-rose-500">Crítico: {reconciliation.riesgoCritico}</span>
                  <span className="text-amber-500">Alto: {reconciliation.riesgoAlto}</span>
                  <span className="text-purple-500">Legal: {reconciliation.alertaLegal}</span>
                  <span className="text-orange-500">IGV: {reconciliation.alertaMatematica}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {reconciliation ? (
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="sticky top-0 z-20 bg-app-surface shadow-sm border-b border-app-border">
                    <tr className="text-[8px] font-black uppercase tracking-widest text-app-muted">
                      <th className="px-3 py-3">Diagnóstico</th>
                      <th className="px-3 py-3">CAR / Identificador</th>
                      <th className="px-3 py-3 text-right">Total SIRE</th>
                      <th className="px-3 py-3 text-right">Total ERP</th>
                      <th className="px-3 py-3 text-right">Diferencia</th>
                      <th className="px-3 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {reconciliation.results.map((r, idx) => {
                      const style = DIAGNOSTIC_STYLES[r.diagnostico];
                      return (
                        <tr key={idx} className="text-[10px] hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2">
                            <span className={`${style.bg} ${style.text} px-2 py-0.5 rounded border font-black text-[9px]`}>{style.label}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[9px] text-app-text">{r.identificador.substring(0, 27)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{r.valorSire > 0 ? r.valorSire.toFixed(2) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{r.valorERP > 0 ? r.valorERP.toFixed(2) : '—'}</td>
                          <td className="px-3 py-2 text-right">
                            {Math.abs(r.diferencia) > 0.01 ? (
                              <span className={`font-mono font-bold text-[9px] ${r.diferencia > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {r.diferencia > 0 ? `+${r.diferencia.toFixed(2)}` : r.diferencia.toFixed(2)}
                              </span>
                            ) : <span className="text-app-muted opacity-20">—</span>}
                          </td>
                          <td className="px-3 py-2 text-[9px] text-app-muted max-w-[300px] truncate">{r.diagnosticoDetalle}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-30">
                  <FileCheck size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-[12px] font-black uppercase tracking-[0.2em]">Sin datos de auditoría</p>
                  <p className="text-[10px] font-bold mt-2">Haz clic en <span className="text-violet-500">IMPORTAR TXT</span> para cargar un archivo del SIRE.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

        </div>
      </div>
    </div>
  );
};

export default SireView;
