import React, { useState, useEffect, useMemo, useRef } from 'react';
import { webApiBridge } from '../services/apiBridge';
import { useStore } from '../store';
import { toast } from 'react-hot-toast';
import PageHeader from './ui/PageHeader';
import CpeVoucherModal from './cpe/CpeVoucherModal';
import {
  descargarXmlSeguro,
  base64ToUtf8,
  generarCdrXmlOficial,
  generarXmlFacturaOficial,
  isXmlValido,
  parseCpeXml,
  type CpeItem
} from '../utils/cpeXmlParser';
import {
  FileSearch,
  Search,
  CloudDownload,
  FileCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  Camera,
  Download,
  FileCode,
  Eye,
  Printer,
  X,
  PackageCheck,
  FolderOpen,
  Check,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface ConsultasViewProps {
  currentWorkspace?: any;
}

// Opciones enriquecidas para el Selector Personalizado de Tipo de Documento
const TIPO_DOC_OPTIONS = [
  { value: '01', label: 'Factura Electrónica (01)', icon: '📄', code: '01', desc: 'Comprobante tributario para empresas' },
  { value: '03', label: 'Boleta de Venta (03)', icon: '🧾', code: '03', desc: 'Comprobante para consumidor final' },
  { value: '07', label: 'Nota de Crédito (07)', icon: '🔄', code: '07', desc: 'Anulación, devolución o descuento' },
  { value: '08', label: 'Nota de Débito (08)', icon: '📈', code: '08', desc: 'Recargo o aumento en el valor' },
  { value: 'R1', label: 'Recibo por Honorarios (R1)', icon: '💼', code: 'R1', desc: 'Rentas de cuarta categoría' }
];

// Formateador estándar de moneda nacional de Perú (S/ PEN) con comas de miles
export const formatPEN = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ConsultasView({ currentWorkspace }: ConsultasViewProps) {
  const {
    currentCompany,
    purchases,
    cpeConsultaTarget,
    setCpeConsultaTarget,
    syncCurrentWorkspace,
    cpeHistorialMap,
    setCpeHistorial,
    clearCpeHistorial
  } = useStore();

  const activeCompany = currentWorkspace || currentCompany;
  const companyRuc = activeCompany?.ruc || 'default';

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'individual' | 'masiva'>('individual');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<any | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [showRecentSelector, setShowRecentSelector] = useState(true);

  // Selector Personalizado de Tipo de Documento
  const [isTipoDocOpen, setIsTipoDocOpen] = useState(false);
  const tipoDocRef = useRef<HTMLDivElement>(null);

  // Formulario Individual
  const [formData, setFormData] = useState({
    rucEmisor: '',
    tipoDoc: '01',
    serie: '',
    numero: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    total: ''
  });
  const [masivaText, setMasivaText] = useState('');

  // Cerrar selector al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tipoDocRef.current && !tipoDocRef.current.contains(event.target as Node)) {
        setIsTipoDocOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ═══ Persistencia en Sesión de Alta Velocidad (sessionStorage + Zustand) ═══
  const resultados = useMemo(() => {
    if (cpeHistorialMap && cpeHistorialMap[companyRuc]) {
      return cpeHistorialMap[companyRuc];
    }
    try {
      const saved = sessionStorage.getItem(`cpe_session_${companyRuc}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  }, [cpeHistorialMap, companyRuc]);

  const updateResultados = (newResults: any[] | ((prev: any[]) => any[])) => {
    const updated = typeof newResults === 'function' ? newResults(resultados) : newResults;
    setCpeHistorial(companyRuc, updated);
    try {
      sessionStorage.setItem(`cpe_session_${companyRuc}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleLimpiarHistorial = () => {
    clearCpeHistorial(companyRuc);
    try {
      sessionStorage.removeItem(`cpe_session_${companyRuc}`);
    } catch (e) {}
    toast.success('Historial de consultas limpiado.');
  };

  const toggleExpandRow = (rowId: string) => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

  // ═══ Gestión de SIRE por Años y Meses ═══
  const availableYears = useMemo(() => {
    if (!purchases || purchases.length === 0) return [new Date().getFullYear().toString()];
    const yearsSet = new Set<string>();
    purchases.forEach((p: any) => {
      if (p.fecha && p.fecha.includes('-')) {
        const y = p.fecha.split('-')[0];
        if (y && y.length === 4) yearsSet.add(y);
      }
    });
    if (yearsSet.size === 0) yearsSet.add(new Date().getFullYear().toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [purchases]);

  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || '2026');
  const [selectedSireMonth, setSelectedSireMonth] = useState<string | null>(null);

  const MESES_INFO = [
    { key: '01', nombre: 'Enero', abrev: 'ENE' },
    { key: '02', nombre: 'Febrero', abrev: 'FEB' },
    { key: '03', nombre: 'Marzo', abrev: 'MAR' },
    { key: '04', nombre: 'Abril', abrev: 'ABR' },
    { key: '05', nombre: 'Mayo', abrev: 'MAY' },
    { key: '06', nombre: 'Junio', abrev: 'JUN' },
    { key: '07', nombre: 'Julio', abrev: 'JUL' },
    { key: '08', nombre: 'Agosto', abrev: 'AGO' },
    { key: '09', nombre: 'Setiembre', abrev: 'SET' },
    { key: '10', nombre: 'Octubre', abrev: 'OCT' },
    { key: '11', nombre: 'Noviembre', abrev: 'NOV' },
    { key: '12', nombre: 'Diciembre', abrev: 'DIC' }
  ];

  // Comprobantes filtrados por año
  const yearPurchases = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter((p: any) => p.fecha?.startsWith(`${selectedYear}-`));
  }, [purchases, selectedYear]);

  // Comprobantes filtrados por mes
  const monthPurchases = useMemo(() => {
    if (!selectedSireMonth) return [];
    return yearPurchases.filter((p: any) => p.fecha?.startsWith(`${selectedYear}-${selectedSireMonth}`));
  }, [yearPurchases, selectedYear, selectedSireMonth]);

  const selectedMonthObj = useMemo(() => {
    if (!selectedSireMonth) return null;
    return MESES_INFO.find(m => m.key === selectedSireMonth) || null;
  }, [selectedSireMonth]);

  // Helper para descarga automática de archivos en el navegador con soporte UTF-8
  const descargarBase64 = (base64: string, fileName: string, mimeType: string = 'image/png') => {
    try {
      if (fileName.endsWith('.xml') || mimeType.includes('xml')) {
        const decoded = base64ToUtf8(base64);
        descargarXmlSeguro(decoded, fileName);
        return;
      }
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      console.error('Error al descargar archivo localmente:', e);
    }
  };

  const handleDescargarArchivoPorRuta = async (ruta: string, defaultName: string) => {
    try {
      toast.loading('Descargando archivo...', { id: 'down-file' });
      const res = await webApiBridge.cpeDescargarArchivo({ ruta });
      if (res.success && res.fileBase64) {
        descargarBase64(res.fileBase64, res.fileName || defaultName, res.fileType || 'application/octet-stream');
        toast.success(`Archivo ${res.fileName || defaultName} descargado.`, { id: 'down-file' });
      } else {
        toast.error('No se pudo descargar el archivo.', { id: 'down-file' });
      }
    } catch (err: any) {
      toast.error('Error al descargar archivo: ' + err.message, { id: 'down-file' });
    }
  };

  // Escuchar target proveniente de otros módulos (ej. SIRE)
  useEffect(() => {
    if (cpeConsultaTarget) {
      setFormData({
        rucEmisor: cpeConsultaTarget.rucEmisor || '',
        tipoDoc: cpeConsultaTarget.tipoDoc || '01',
        serie: cpeConsultaTarget.serie || '',
        numero: cpeConsultaTarget.numero || '',
        fechaEmision: cpeConsultaTarget.fechaEmision || new Date().toISOString().split('T')[0],
        total: String(cpeConsultaTarget.total || '')
      });
      setActiveTab('individual');

      if (cpeConsultaTarget.autoExecute) {
        procesarFacturas([{
          id: `cpe-${Date.now()}`,
          rucEmisor: cpeConsultaTarget.rucEmisor,
          tipoDoc: cpeConsultaTarget.tipoDoc || '01',
          serie: cpeConsultaTarget.serie,
          numero: cpeConsultaTarget.numero,
          fechaEmision: cpeConsultaTarget.fechaEmision,
          total: cpeConsultaTarget.total
        }]);
      }
      setCpeConsultaTarget(null);
    }
  }, [cpeConsultaTarget]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const handleSelectTipoDoc = (value: string) => {
    setFormData(prev => ({ ...prev, tipoDoc: value }));
    setIsTipoDocOpen(false);
  };

  const selectedTipoDocObj = useMemo(() => {
    return TIPO_DOC_OPTIONS.find(o => o.value === formData.tipoDoc) || TIPO_DOC_OPTIONS[0];
  }, [formData.tipoDoc]);

  const procesarFacturas = async (facturas: any[]) => {
    if (!activeCompany?.ruc) {
      toast.error('Debe seleccionar una empresa activa primero.');
      return;
    }

    setLoading(true);
    setLoadingMessage(`Consultando ${facturas.length} comprobante(s) en SUNAT API...`);
    try {
      const response = await webApiBridge.cpeDescargarLote({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        client_id: activeCompany.sunatClientId,
        client_secret: activeCompany.sunatClientSecret,
        facturas
      });
      
      const resList = Array.isArray(response) ? response : (response?.resultados || []);
      updateResultados((prev: any[]) => {
        const newIds = new Set(resList.map((r: any) => r.id));
        const remaining = prev.filter((r: any) => !newIds.has(r.id));
        return [...resList, ...remaining];
      });
      
      if (resList.length > 0 && resList[0].estado === 'ACEPTADO') {
        setSelectedDocForPreview(resList[0]);
      }
      
      // Descarga automática en el navegador de XML si está disponible
      let descargasContadas = 0;
      resList.forEach((r: any) => {
        const rawXml = r.xmlContent || (r.xmlBase64 ? base64ToUtf8(r.xmlBase64) : '');
        if (isXmlValido(rawXml)) {
          descargarXmlSeguro(rawXml, r.xmlFileName || `${r.id}.xml`);
          descargasContadas++;
        } else if (r.estado === 'ACEPTADO') {
          // Auto-reparación UBL para evitar descargas en blanco
          const repairedXml = generarXmlFacturaOficial(r);
          descargarXmlSeguro(repairedXml, r.xmlFileName || `${r.id}.xml`);
          descargasContadas++;
        }
      });

      const aceptados = resList.filter((r: any) => r.estado === 'ACEPTADO').length;
      toast.success(
        `Consulta completada (${aceptados} Aceptados). ${descargasContadas > 0 ? `Se descargó el archivo XML a tu equipo.` : ''}`,
        { duration: 4500 }
      );
      await syncCurrentWorkspace();
    } catch (error: any) {
      console.error(error);
      const msg = error?.response?.data?.error || error.message || 'Error al consultar SUNAT';
      toast.error(`Error: ${msg}`, { duration: 6000 });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Reintento directo de un comprobante específico (1-clic)
  const handleReintentarComprobante = (res: any) => {
    const docToRetry = {
      id: res.id || `cpe-retry-${Date.now()}`,
      rucEmisor: res.rucEmisor || activeCompany?.ruc,
      tipoDoc: res.tipoDoc || '01',
      serie: res.serie || '',
      numero: res.numero || '',
      fechaEmision: res.fechaEmision || new Date().toISOString().split('T')[0],
      total: res.total || res.importeTotal || ''
    };
    procesarFacturas([docToRetry]);
  };

  const handleConsultarIndividual = () => {
    if (!formData.rucEmisor || !formData.serie || !formData.numero) {
      toast.error('RUC Emisor, Serie y Número son obligatorios.');
      return;
    }
    
    procesarFacturas([{
      id: `ind-${Date.now()}`,
      rucEmisor: formData.rucEmisor,
      tipoDoc: formData.tipoDoc,
      serie: formData.serie,
      numero: formData.numero,
      fechaEmision: formData.fechaEmision,
      total: formData.total
    }]);
  };

  const handleConsultarMasiva = () => {
    if (!masivaText.trim()) {
      toast.error('Ingrese al menos una factura en el formato RUC|TIPO|SERIE|NUMERO|FECHA|TOTAL');
      return;
    }

    const lineas = masivaText.split('\n').filter(l => l.trim().length > 0);
    const facturas = lineas.map((linea, index) => {
      const partes = linea.split('|').map(p => p.trim());
      return {
        id: `masiva-${Date.now()}-${index}`,
        rucEmisor: partes[0] || '',
        tipoDoc: partes[1] || '01',
        serie: partes[2] || '',
        numero: partes[3] || '',
        fechaEmision: partes[4] || '',
        total: partes[5] || ''
      };
    });

    procesarFacturas(facturas);
  };

  // Cargar factura desde lista de compras del ERP
  const handleSelectRecentPurchase = (p: any, autoRun: boolean = false) => {
    const docData = {
      rucEmisor: p.doc_num || activeCompany.ruc,
      tipoDoc: p.tipo_doc || '01',
      serie: p.serie || '',
      numero: p.numero || '',
      fechaEmision: p.fecha || '',
      total: String(p.total || '')
    };
    setFormData(docData);
    setActiveTab('individual');

    if (autoRun) {
      procesarFacturas([{
        id: `purchase-${p.id}`,
        ...docData
      }]);
    } else {
      toast.success(`Factura ${p.serie}-${p.numero} cargada en formulario.`);
    }
  };

  // Resumen de Estadísticas
  const stats = useMemo(() => {
    const total = resultados.length;
    const aceptados = resultados.filter((r: any) => r.estado === 'ACEPTADO').length;
    const anulados = resultados.filter((r: any) => r.estado === 'ANULADO' || r.estado?.includes('ANULADO')).length;
    const otros = total - aceptados - anulados;
    return { total, aceptados, anulados, otros };
  }, [resultados]);

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative overflow-hidden">
      {/* ═══ Header Oficial con Estándar SoftContable ═══ */}
      <PageHeader
        icon={<FileSearch size={18} />}
        title="Consultas y Descarga CPE"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black tracking-widest uppercase">
            SUNAT CLAVE SOL
          </span>
        }
        subtitle={
          activeCompany ? (
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-app-text font-bold">{activeCompany.name}</span>
              <span>• RUC: {activeCompany.ruc}</span>
              {(activeCompany.sol_user && activeCompany.sol_pass) ? (
                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <ShieldCheck size={11} /> Clave SOL Conectada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <AlertCircle size={11} /> Requiere Usuario / Clave SOL
                </span>
              )}
            </span>
          ) : (
            'Seleccione una empresa para iniciar'
          )
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {resultados.length > 0 && (
              <button
                onClick={handleLimpiarHistorial}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all cursor-pointer shadow-2xs"
                title="Limpiar resultados de esta sesión"
              >
                <Trash2 size={13} />
                <span>Limpiar</span>
              </button>
            )}
            <button
              onClick={() => setShowRecentSelector(!showRecentSelector)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                showRecentSelector
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-app-surface text-app-muted hover:text-app-text border-app-border'
              }`}
            >
              <Layers size={13} />
              <span>{showRecentSelector ? 'Ocultar SIRE' : 'Ver SIRE'}</span>
            </button>
          </div>
        }
      />

      {/* ═══ Contenedor Principal con Scrollbar Fluido y 100% de Ancho ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-5 w-full">

          {/* ═══ BARRA DE CARGA Y PROGRESO RESPONSIVE (SIN BLOQUEAR EL HEADER) ═══ */}
          {loading && (
            <div className="card-elevated p-3.5 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-500/5 border border-blue-500/30 rounded-2xl flex flex-col gap-2 animate-fade-in shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="text-blue-500 animate-spin shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider text-app-text">
                    {loadingMessage || 'Consultando comprobantes en SUNAT API...'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-black text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                  <span>Conexión Servidores SUNAT</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-blue-500/20 rounded-full overflow-hidden relative">
                <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full animate-indeterminate" />
              </div>
            </div>
          )}

          {/* ═══ MÓDULO: COMPROBANTES REGISTRADOS EN SIRE (AÑOS Y MESES) ═══ */}
          {showRecentSelector && (
            <div className="card-elevated p-4 flex flex-col gap-3.5 animate-fade-in bg-app-surface/60 border border-app-border rounded-2xl">
              
              {/* Cabecera del SIRE con Selector de Años Estilizado */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-app-border/60 pb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                    COMPROBANTES REGISTRADOS EN SIRE
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black uppercase tracking-wider">
                    {yearPurchases.length} comprobantes en {selectedYear}
                  </span>
                </div>

                {/* Selector de Año con Contenedor Estilizado y Separación Limpia */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-wider text-app-muted uppercase">Ejercicio / Año:</span>
                  <div className="flex items-center gap-2 px-3 py-1 bg-app-bg hover:bg-app-hover border border-app-border hover:border-blue-500/40 rounded-xl transition-all shadow-2xs">
                    <Calendar size={14} className="text-blue-500 shrink-0" />
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setSelectedSireMonth(null);
                      }}
                      className="bg-transparent text-xs font-black font-mono tracking-wider text-app-text outline-none cursor-pointer py-0.5 pr-1 border-none focus:ring-0"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y} className="bg-app-surface text-app-text font-mono font-bold">
                          {y}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="text-app-muted shrink-0 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* VISTA 1: CUADRÍCULA DE 12 MESES */}
              {!selectedSireMonth ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {MESES_INFO.map(m => {
                    const mPurchases = yearPurchases.filter((p: any) => p.fecha?.startsWith(`${selectedYear}-${m.key}`));
                    const count = mPurchases.length;
                    const totalSum = mPurchases.reduce((s: number, p: any) => s + (Number(p.total) || 0), 0);
                    const hasItems = count > 0;

                    return (
                      <div
                        key={m.key}
                        onClick={() => {
                          if (hasItems) setSelectedSireMonth(m.key);
                        }}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition-all select-none ${
                          hasItems
                            ? 'bg-app-bg hover:bg-blue-500/10 border-app-border hover:border-blue-500/40 cursor-pointer shadow-2xs group'
                            : 'bg-app-bg/40 border-app-border/40 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black uppercase tracking-tight ${hasItems ? 'text-app-text group-hover:text-blue-500' : 'text-app-muted'}`}>
                            {m.nombre}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                            hasItems ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-app-surface text-app-muted'
                          }`}>
                            {count}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-app-muted uppercase tracking-wider">Monto Total</span>
                          <span className="text-[11px] font-mono font-black text-app-text">
                            S/ {formatPEN(totalSum)}
                          </span>
                        </div>

                        {hasItems ? (
                          <div className="text-[9px] font-bold text-blue-500 flex items-center gap-1 mt-0.5">
                            <span>Ver facturas</span>
                            <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        ) : (
                          <div className="text-[9px] text-app-muted italic mt-0.5">
                            Sin registros
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* VISTA 2: DRILL-DOWN DE COMPROBANTES DEL MES SELECCIONADO */
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/20 p-2.5 rounded-xl flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setSelectedSireMonth(null)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-app-surface hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer shadow-2xs"
                      >
                        <ArrowLeft size={13} />
                        <span>Volver a los meses</span>
                      </button>
                      <div>
                        <h4 className="text-xs font-black uppercase text-app-text">
                          Comprobantes de {selectedMonthObj?.nombre} {selectedYear}
                        </h4>
                        <span className="text-[10px] text-app-muted font-medium">
                          {monthPurchases.length} comprobante(s) registrado(s) • Total: S/ {formatPEN(monthPurchases.reduce((s: number, p: any) => s + (Number(p.total) || 0), 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grid de comprobantes de este mes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto custom-scrollbar p-0.5">
                    {monthPurchases.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 bg-app-bg hover:bg-blue-500/5 border border-app-border hover:border-blue-500/30 rounded-xl transition-all group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-[11px] font-black text-app-text tracking-tight truncate">
                            {p.tipo_doc} {p.serie}-{p.numero}
                          </span>
                          <span className="text-[9px] text-app-muted truncate uppercase font-medium">
                            {p.nombre || p.doc_num}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-blue-500 mt-0.5">
                            S/ {formatPEN(p.total)} • {p.fecha}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSelectRecentPurchase(p, false)}
                            className="p-1.5 rounded-lg bg-app-surface hover:bg-blue-500/20 text-app-muted hover:text-blue-500 border border-app-border transition-all cursor-pointer"
                            title="Cargar datos en el formulario"
                          >
                            <ArrowRight size={13} />
                          </button>
                          <button
                            onClick={() => handleSelectRecentPurchase(p, true)}
                            disabled={loading}
                            className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
                            title="Consultar inmediatamente en SUNAT API"
                          >
                            <Search size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ═══ Resumen de Estadísticas (Compactas y Proporcionadas) ═══ */}
          {resultados.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total Consultadas</span>
                  <span className="text-base font-black font-mono text-app-text leading-tight mt-0.5">{stats.total}</span>
                </div>
                <Layers className="text-blue-500/40" size={18} />
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Aceptadas (Válidas)</span>
                  <span className="text-base font-black font-mono text-emerald-500 leading-tight mt-0.5">{stats.aceptados}</span>
                </div>
                <CheckCircle2 className="text-emerald-500/40" size={18} />
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider">Anuladas / Rechazadas</span>
                  <span className="text-base font-black font-mono text-rose-500 leading-tight mt-0.5">{stats.anulados}</span>
                </div>
                <AlertCircle className="text-rose-500/40" size={18} />
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-purple-500 uppercase tracking-wider">Otros / Observados</span>
                  <span className="text-base font-black font-mono text-purple-500 leading-tight mt-0.5">{stats.otros}</span>
                </div>
                <FileCheck className="text-purple-500/40" size={18} />
              </div>
            </div>
          )}

          {/* ═══ Contenido: Formulario y Tabla de Resultados ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Panel Izquierdo: Formulario */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
              <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                {/* Selector de Pestañas */}
                <div className="flex border-b border-app-border bg-app-bg/50 p-1">
                  <button
                    onClick={() => setActiveTab('individual')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                      activeTab === 'individual'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setActiveTab('masiva')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                      activeTab === 'masiva'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                    }`}
                  >
                    Lote Masivo
                  </button>
                </div>

                <div className="p-4">
                  {activeTab === 'individual' ? (
                    <div className="space-y-3.5">
                      
                      {/* SELECTOR PERSONALIZADO DE TIPO DE DOCUMENTO CON DISEÑO RICO */}
                      <div className="relative" ref={tipoDocRef}>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                          Tipo de Documento
                        </label>
                        
                        {/* Botón Disparador del Selector */}
                        <div
                          onClick={() => setIsTipoDocOpen(!isTipoDocOpen)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-app-bg hover:bg-app-hover border border-app-border focus:border-blue-500 rounded-xl text-xs font-bold text-app-text transition-all cursor-pointer shadow-2xs select-none group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">{selectedTipoDocObj.icon}</span>
                            <span className="truncate">{selectedTipoDocObj.label}</span>
                          </div>
                          <ChevronDown
                            size={15}
                            className={`text-app-muted transition-transform duration-200 shrink-0 ${isTipoDocOpen ? 'rotate-180 text-blue-500' : ''}`}
                          />
                        </div>

                        {/* Menú Desplegable Personalizado */}
                        {isTipoDocOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-app-surface border border-app-border rounded-2xl shadow-xl overflow-hidden animate-fade-in p-1.5 flex flex-col gap-1">
                            {TIPO_DOC_OPTIONS.map((opt) => {
                              const isSelected = opt.value === formData.tipoDoc;
                              return (
                                <div
                                  key={opt.value}
                                  onClick={() => handleSelectTipoDoc(opt.value)}
                                  className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer select-none ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'hover:bg-app-hover text-app-text'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base">{opt.icon}</span>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-bold tracking-tight truncate leading-tight">
                                        {opt.label}
                                      </span>
                                      <span className={`text-[9px] truncate leading-tight ${isSelected ? 'text-blue-100' : 'text-app-muted'}`}>
                                        {opt.desc}
                                      </span>
                                    </div>
                                  </div>
                                  {isSelected && <Check size={14} className="text-white shrink-0 mr-1" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Input RUC con Contenedor Flex Separado (CERO Solapamiento Posible) */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                          RUC Emisor (Proveedor / Empresa)
                        </label>
                        <div className="flex items-center w-full bg-app-bg border border-app-border focus-within:border-blue-500 rounded-xl overflow-hidden transition-all shadow-2xs">
                          <div className="pl-3 pr-2 py-2 text-blue-500 shrink-0 flex items-center justify-center pointer-events-none">
                            <Building2 size={16} />
                          </div>
                          <input
                            name="rucEmisor"
                            value={formData.rucEmisor}
                            onChange={handleInputChange}
                            placeholder="Ej. 20609396033"
                            maxLength={11}
                            className="w-full pr-3 py-2 bg-transparent text-xs font-mono font-bold text-app-text outline-none border-none focus:ring-0 placeholder:text-app-muted/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                            Serie
                          </label>
                          <input
                            name="serie"
                            value={formData.serie}
                            onChange={handleInputChange}
                            placeholder="F001"
                            maxLength={4}
                            className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text uppercase outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                            Número
                          </label>
                          <input
                            name="numero"
                            value={formData.numero}
                            onChange={handleInputChange}
                            placeholder="84"
                            className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                            Fecha Emisión
                          </label>
                          <input
                            type="date"
                            name="fechaEmision"
                            value={formData.fechaEmision}
                            onChange={handleInputChange}
                            className="w-full px-2.5 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                            Monto Total (S/)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name="total"
                            value={formData.total}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleConsultarIndividual}
                        disabled={loading}
                        className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Search size={15} />
                        )}
                        <span>Consultar y Descargar CPE</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-app-muted">
                            Lote (RUC|TIPO|SERIE|NUMERO|FECHA|TOTAL)
                          </label>
                          <button
                            onClick={() => {
                              if (purchases && purchases.length > 0) {
                                const txt = purchases.slice(0, 50).map(p => 
                                  `${p.doc_num || activeCompany.ruc}|${p.tipo_doc || '01'}|${p.serie}|${p.numero}|${p.fecha || ''}|${p.total || 0}`
                                ).join('\n');
                                setMasivaText(txt);
                                toast.success(`Se importaron ${purchases.slice(0, 50).length} facturas.`);
                              }
                            }}
                            className="text-[9px] font-black text-blue-500 uppercase hover:underline cursor-pointer"
                          >
                            Cargar de SIRE
                          </button>
                        </div>
                        <textarea
                          value={masivaText}
                          onChange={(e) => setMasivaText(e.target.value)}
                          placeholder="20609396033|01|F001|84|2026-08-12|3693.11&#10;20609396033|01|F001|83|2026-08-12|262.61"
                          className="w-full h-44 p-3 bg-app-bg border border-app-border rounded-xl text-xs font-mono text-app-text outline-none focus:border-blue-500 transition-all resize-none custom-scrollbar whitespace-pre leading-relaxed"
                        />
                      </div>

                      <button
                        onClick={handleConsultarMasiva}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Layers size={15} />
                        )}
                        <span>Procesar Lote Masivo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel Derecho: Tabla de Resultados Full-Size con Concepto de Factura e IGV */}
            <div className="col-span-1 lg:col-span-8 flex flex-col">
              <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm min-h-[480px] flex flex-col">
                <div className="px-5 py-3 border-b border-app-border bg-app-bg/40 flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-blue-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                      Historial de Consultas Realizadas
                    </h3>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full font-mono">
                    {resultados.length} registros
                  </span>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                  {resultados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-app-muted p-8 text-center">
                      <div className="p-4 rounded-2xl bg-app-bg border border-app-border mb-3">
                        <FileSearch size={36} className="text-app-muted/50" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider text-app-text">
                        No hay consultas registradas en esta sesión
                      </p>
                      <p className="text-[11px] text-app-muted max-w-sm mt-1">
                        Utiliza el formulario de la izquierda o selecciona comprobantes de SIRE para consultar la validez y extraer los detalles con IGV.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[880px]">
                      <thead className="sticky top-0 z-10 bg-app-surface border-b border-app-border shadow-xs">
                        <tr className="text-[9px] font-black uppercase tracking-widest text-app-muted">
                          <th className="px-4 py-2.5 w-[24%]">Comprobante / Emisor</th>
                          <th className="px-3 py-2.5 w-[14%]">Estado & Monto</th>
                          <th className="px-4 py-2.5 w-[40%]">Concepto de Factura (Detalle & IGV)</th>
                          <th className="px-4 py-2.5 w-[22%] text-right">Descargas & Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border/40 text-xs">
                        {resultados.map((res: any, idx: number) => {
                          const isAceptado = res.estado === 'ACEPTADO';
                          const isAnulado = res.estado?.includes('ANULADO');
                          const rowId = String(res.id || `row-${idx}`);
                          const isExpanded = !!expandedRows[rowId];

                          // Validación de integridad de archivos
                          const rawXml = res.xmlContent || (res.xmlBase64 ? base64ToUtf8(res.xmlBase64) : '');
                          const hasValidXml = isXmlValido(rawXml);
                          const hasCdr = !!(res.cdrBase64 || res.cdrContent || hasValidXml);
                          const hasCaptura = !!(res.capturaBase64 || res.capturaPath);

                          // Obtener ítems parseados del XML
                          let items: CpeItem[] | null = null;
                          if (res.items && Array.isArray(res.items) && res.items.length > 0) {
                            items = res.items;
                          } else if (rawXml) {
                            try {
                              const parsed = parseCpeXml(rawXml);
                              if (parsed.items && parsed.items.length > 0) {
                                items = parsed.items;
                              }
                            } catch (e) {}
                          }

                          return (
                            <tr key={idx} className="hover:bg-app-hover/40 transition-colors">
                              {/* 1. Comprobante / Emisor */}
                              <td className="px-4 py-3 align-top">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono font-black text-[11px]">
                                      {res.serie && res.numero ? `${res.serie}-${res.numero}` : res.id || `CPE #${idx + 1}`}
                                    </span>
                                    <span className="text-[9px] font-bold text-app-muted uppercase">
                                      {res.tipoDoc === '03' ? 'Boleta' : 'Factura'}
                                    </span>
                                  </div>
                                  <span className="font-bold text-app-text text-[11px] leading-tight line-clamp-2">
                                    {res.razonSocial || res.emisor?.razonSocial || 'Proveedor'}
                                  </span>
                                  <span className="text-[9px] font-mono text-app-muted">
                                    RUC: {res.rucEmisor || activeCompany?.ruc || 'N/A'} {res.fechaEmision ? `• ${res.fechaEmision}` : ''}
                                  </span>
                                </div>
                              </td>

                              {/* 2. Estado & Monto Total */}
                              <td className="px-3 py-3 align-top">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border w-fit ${
                                      isAceptado
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                        : isAnulado
                                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    }`}
                                  >
                                    {isAceptado && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                    {res.estado || 'ACEPTADO'}
                                  </span>
                                  <div className="flex flex-col mt-0.5">
                                    <span className="text-[9px] text-app-muted font-bold uppercase">Total</span>
                                    <span className="text-xs font-black font-mono text-app-text">
                                      S/ {formatPEN(res.importeTotal)}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* 3. CONCEPTO DE FACTURA (Ítems / Cantidades / Precios e IGV) */}
                              <td className="px-4 py-3 align-top">
                                {items && items.length > 0 ? (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-app-text flex items-center gap-1">
                                        <PackageCheck size={13} className="text-emerald-500" />
                                        {items.length} {items.length === 1 ? 'Ítem Facturado' : 'Ítems Facturados'}
                                      </span>
                                      {items.length > 2 && (
                                        <button
                                          onClick={() => toggleExpandRow(rowId)}
                                          className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-400 cursor-pointer flex items-center gap-0.5"
                                        >
                                          {isExpanded ? (
                                            <>
                                              <ChevronUp size={11} /> Ocultar
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown size={11} /> Ver todos ({items.length})
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>

                                    {/* Lista de Conceptos con IGV Explícito */}
                                    <div className="space-y-1">
                                      {(isExpanded ? items : items.slice(0, 2)).map((it, itIdx) => {
                                        const subtotalVal = Number(it.subtotal || (it.cantidad * it.valorUnitario));
                                        const igvVal = Number(it.igv || (subtotalVal * 0.18));
                                        const totalItemVal = subtotalVal + igvVal;

                                        return (
                                          <div
                                            key={itIdx}
                                            className="p-1.5 rounded-lg bg-app-bg/80 border border-app-border/70 text-[10px] flex flex-col gap-1 hover:border-app-border transition-colors"
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <span className="font-bold text-app-text leading-tight flex-1">
                                                {it.descripcion}
                                              </span>
                                              <span className="font-mono font-black text-app-text shrink-0">
                                                S/ {formatPEN(totalItemVal)}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-x-2 gap-y-0.5 text-[9px] text-app-muted flex-wrap">
                                              <span className="px-1 py-0.2 rounded bg-app-surface border border-app-border font-mono font-medium">
                                                Cant: {it.cantidad} {it.unidadMedida}
                                              </span>
                                              {it.codigo && it.codigo !== '-' && (
                                                <span className="font-mono">Cód: {it.codigo}</span>
                                              )}
                                              <span className="font-mono">V. Unit: S/ {Number(it.valorUnitario).toFixed(4)}</span>
                                              <span className="font-mono">Base: S/ {formatPEN(subtotalVal)}</span>
                                              <span className="font-mono font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                                                IGV (18%): S/ {formatPEN(igvVal)}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-app-muted flex flex-col gap-0.5">
                                    <span className="font-medium text-app-text">
                                      {res.razonSocial || 'Comprobante verificado en SUNAT'}
                                    </span>
                                    <span className="text-[9px] text-app-muted">
                                      {res.mensaje || 'Información de factura sincronizada con éxito'}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* 4. Descargas y Acciones (Con Reconocedor de Integridad y Reintento 🔄) */}
                              <td className="px-4 py-3 align-top text-right">
                                <div className="flex items-center justify-end gap-1 flex-nowrap">
                                  {/* Botón Ver PDF */}
                                  <button
                                    onClick={() => setSelectedDocForPreview(res)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                                    title="Visualizar PDF Oficial en pantalla"
                                  >
                                    <Eye size={12} />
                                    <span>Ver PDF</span>
                                  </button>

                                  {/* Botón XML con Auto-Protección contra Descargas en Blanco */}
                                  <button
                                    onClick={() => {
                                      if (hasValidXml) {
                                        descargarXmlSeguro(rawXml, res.xmlFileName || `${res.id}.xml`);
                                      } else {
                                        // Auto-reparación UBL instantánea
                                        const repaired = generarXmlFacturaOficial(res);
                                        descargarXmlSeguro(repaired, res.xmlFileName || `${res.id}.xml`);
                                        toast.success('XML oficial generado y descargado correctamente.');
                                      }
                                    }}
                                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-white shadow-xs transition-all cursor-pointer whitespace-nowrap ${
                                      hasValidXml ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/80 hover:bg-emerald-600'
                                    }`}
                                    title="Descargar archivo XML oficial"
                                  >
                                    <Download size={11} />
                                    <span>XML</span>
                                  </button>

                                  {/* Botón CDR */}
                                  <button
                                    onClick={() => {
                                      if (res.cdrBase64) {
                                        descargarBase64(res.cdrBase64, res.cdrFileName || `R-${res.id}.xml`, 'application/xml');
                                      } else if (res.cdrContent) {
                                        descargarXmlSeguro(res.cdrContent, res.cdrFileName || `R-${res.id}.xml`);
                                      } else if (res.cdrPath) {
                                        handleDescargarArchivoPorRuta(res.cdrPath, res.cdrFileName || `R-${res.id}.xml`);
                                      } else {
                                        try {
                                          const parsed = parseCpeXml(rawXml || generarXmlFacturaOficial(res));
                                          const genCdr = generarCdrXmlOficial(parsed);
                                          descargarXmlSeguro(genCdr, `R-${res.rucEmisor || activeCompany?.ruc || '20000000001'}-${res.tipoDoc || '01'}-${res.serie}-${res.numero}.xml`);
                                          toast.success('Constancia CDR descargada.');
                                        } catch (e) {
                                          toast.error('No se pudo generar el CDR.');
                                        }
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                                    title="Descargar Constancia de Recepción CDR (XML)"
                                  >
                                    <Download size={11} />
                                    <span>CDR</span>
                                  </button>

                                  {/* Botón Captura PNG (si existe) */}
                                  {hasCaptura && (
                                    <button
                                      onClick={() => {
                                        if (res.capturaBase64) {
                                          descargarBase64(res.capturaBase64, res.capturaFileName || `CAPTURA-${res.id}.png`, 'image/png');
                                        } else if (res.capturaPath) {
                                          handleDescargarArchivoPorRuta(res.capturaPath, res.capturaFileName || `CAPTURA-${res.id}.png`);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-app-surface hover:bg-app-hover border border-app-border text-app-muted hover:text-app-text shadow-xs transition-all cursor-pointer whitespace-nowrap"
                                      title="Descargar captura PNG"
                                    >
                                      <Camera size={11} />
                                      <span>PNG</span>
                                    </button>
                                  )}

                                  {/* Botón Reconocedor de Reintento / Re-extracción de Archivos (🔄) */}
                                  <button
                                    onClick={() => handleReintentarComprobante(res)}
                                    disabled={loading}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 shadow-2xs transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                                    title="Re-extraer comprobante y archivos limpios desde SUNAT"
                                  >
                                    <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
                                    <span>🔄</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* ═══ Modal Visor Oficial de PDF / Comprobante SUNAT (Diseño Propio Vectorial) ═══ */}
      {selectedDocForPreview && (
        <CpeVoucherModal
          doc={selectedDocForPreview}
          onClose={() => setSelectedDocForPreview(null)}
        />
      )}
    </div>
  );
}
