import React, { useState, useEffect, useMemo, useRef } from 'react';
import { webApiBridge } from '../services/apiBridge';
import { useStore } from '../store';
import { toast } from 'react-hot-toast';
import PageHeader from './ui/PageHeader';
import ModernSelect from './ui/ModernSelect';
import CpeVoucherModal from './cpe/CpeVoucherModal';
import ConsultasMasivasSheet from './cpe/ConsultasMasivasSheet';
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
  RotateCcw,
  XCircle,
  AlertTriangle,
  Hash,
  Clock,
  Filter
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
  const [activeTab, setActiveTab] = useState<'individual' | 'consultas_masivas'>('individual');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<any | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [showRecentSelector, setShowRecentSelector] = useState(true);
  const [tableSearch, setTableSearch] = useState('');

  // ═══ Control de Scroll Horizontal Perenne y Sincronizado ═══
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const stickyScrollbarRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [tableScrollInfo, setTableScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    canScrollLeft: false,
    canScrollRight: false
  });

  // Arrastre horizontal con el mouse (Mouse Drag-to-Scroll estilo móvil)
  const isDraggingMouse = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollInfo = () => {
    if (!tableContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    setTableScrollInfo({
      scrollLeft,
      scrollWidth,
      clientWidth,
      canScrollLeft: scrollLeft > 5,
      canScrollRight: scrollLeft < maxScroll - 5
    });
  };

  const handleTableScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (tableContainerRef.current && stickyScrollbarRef.current) {
      stickyScrollbarRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
    }
    updateScrollInfo();
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    updateScrollInfo();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollInfo();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [expandedRows]);

  // Manejadores de arrastre con el ratón
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, select, textarea')) return;
    if (!tableContainerRef.current) return;
    isDraggingMouse.current = true;
    dragStartX.current = e.pageX - tableContainerRef.current.offsetLeft;
    dragStartScrollLeft.current = tableContainerRef.current.scrollLeft;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingMouse.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.25;
    tableContainerRef.current.scrollLeft = dragStartScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingMouse.current = false;
    setIsDragging(false);
  };

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

  // Helper para descarga directa de XML oficial vía API Inversa
  const handleDescargarXmlDirecto = async (item: any) => {
    const rucEmisor = item.rucEmisor || item.doc_num;
    const tipoCpe = item.tipoDoc || item.tipoCpe || item.tipo || '01';
    const serie = item.serie;
    const correlativo = item.numero || item.correlativo;

    if (!rucEmisor || !serie || !correlativo) {
      toast.error('Datos incompletos para descargar XML.');
      return;
    }

    try {
      toast.loading(`Descargando XML de ${serie}-${correlativo}...`, { id: 'down-xml' });
      const res = await webApiBridge.cpeDirectDescargarXml({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        rucEmisor,
        tipoCpe,
        serie,
        correlativo,
        procedencia: item.procedencia || (serie.toUpperCase().startsWith('E') ? '1' : '2')
      });

      if (res.success && (res.xmlContent || res.zipBase64)) {
        if (res.xmlContent) {
          const blob = new Blob([res.xmlContent], { type: 'application/xml;charset=utf-8' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = res.xmlFileName || `${rucEmisor}-${tipoCpe}-${serie}-${correlativo}.xml`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        } else if (res.zipBase64) {
          const byteCharacters = atob(res.zipBase64);
          const byteArray = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: 'application/zip' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = res.nomArchivo || `${rucEmisor}-${tipoCpe}-${serie}-${correlativo}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }
        toast.success(`XML de ${serie}-${correlativo} descargado.`, { id: 'down-xml' });
      } else {
        toast.error(res.error || 'No se pudo obtener el XML.', { id: 'down-xml' });
      }
    } catch (err: any) {
      toast.error('Error al descargar XML: ' + err.message, { id: 'down-xml' });
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
        ejecutarConsultaDirecta(cpeConsultaTarget.rucEmisor, cpeConsultaTarget.tipoDoc || '01', cpeConsultaTarget.serie, cpeConsultaTarget.numero);
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

  // ═══ MOTOR 100% INGENIERÍA INVERSA HTTP DIRECTA (CERO SCRAPING) ═══
  const ejecutarConsultaDirecta = async (rucEmisor: string, tipoDoc: string, serie: string, numero: string) => {
    if (!activeCompany?.ruc) {
      toast.error('Debe seleccionar una empresa activa.');
      return;
    }

    if (!activeCompany.sol_user || !activeCompany.sol_pass) {
      toast.error('Configure el Usuario y Clave SOL en la empresa.');
      return;
    }

    setLoading(true);
    setLoadingMessage(`Consultando ${serie}-${numero} en microservicios SUNAT SOL...`);

    try {
      const directRes = await webApiBridge.cpeDirectConsultarIndividual({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        rucEmisor: rucEmisor.trim(),
        tipoCpe: tipoDoc.trim().padStart(2, '0'),
        serie: serie.trim().toUpperCase(),
        correlativo: numero.trim(),
        procedencia: '2'
      });

      if (directRes.success && directRes.encontrado && directRes.data) {
        const d = directRes.data;
        const resultObj = {
          id: `ind-${Date.now()}`,
          rucEmisor: d.rucEmisor,
          razonSocial: d.razonSocialEmisor,
          tipoDoc: d.tipoCpe,
          serie: d.serie,
          numero: d.numero,
          fechaEmision: d.fechaEmision,
          moneda: d.moneda || 'PEN',
          total: d.montoTotal,
          importeTotal: d.montoTotal,
          estado: d.estado || 'ACEPTADO',
          montoGravado: d.montoGravado || 0,
          montoIgv: d.montoIgv || 0,
          items: d.items || [],
          docReceptorNum: d.docReceptorNum,
          razonSocialReceptor: d.razonSocialReceptor,
          observacion: 'OK'
        };

        updateResultados((prev: any[]) => [resultObj, ...prev.filter((r: any) => r.id !== resultObj.id)]);
        setSelectedDocForPreview(resultObj);
        toast.success(`Comprobante ${d.serie}-${d.numero} verificado: ${d.estado}`);
      } else {
        const errorObj = {
          id: `ind-err-${Date.now()}`,
          rucEmisor,
          razonSocial: '—',
          tipoDoc,
          serie,
          numero,
          fechaEmision: formData.fechaEmision,
          moneda: 'PEN',
          total: formData.total || 0,
          importeTotal: formData.total || 0,
          estado: directRes.encontrado === false ? 'NO_EXISTE' : 'ERROR',
          montoGravado: 0,
          montoIgv: 0,
          items: [],
          observacion: directRes.mensaje || directRes.error || 'Comprobante no existe en SUNAT'
        };
        updateResultados((prev: any[]) => [errorObj, ...prev]);
        toast.error(directRes.mensaje || 'Comprobante no encontrado en SUNAT');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error al consultar comprobante: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleConsultarIndividual = () => {
    if (!formData.rucEmisor || !formData.serie || !formData.numero) {
      toast.error('RUC Emisor, Serie y Número son obligatorios.');
      return;
    }
    ejecutarConsultaDirecta(formData.rucEmisor, formData.tipoDoc, formData.serie, formData.numero);
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
      ejecutarConsultaDirecta(docData.rucEmisor, docData.tipoDoc, docData.serie, docData.numero);
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

  // Filtrado en tabla individual
  const filteredResultados = useMemo(() => {
    if (!tableSearch.trim()) return resultados;
    const q = tableSearch.toLowerCase().trim();
    return resultados.filter((r: any) => {
      const ruc = (r.rucEmisor || '').toLowerCase();
      const razon = (r.razonSocial || '').toLowerCase();
      const serie = (r.serie || '').toLowerCase();
      const numero = String(r.numero || '').toLowerCase();
      const estado = (r.estado || '').toLowerCase();
      return ruc.includes(q) || razon.includes(q) || serie.includes(q) || numero.includes(q) || estado.includes(q);
    });
  }, [resultados, tableSearch]);

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative overflow-hidden">
      {/* ═══ Header Oficial con Estándar SoftContable ═══ */}
      <PageHeader
        icon={<FileSearch size={18} />}
        title="Consultas y Descarga CPE"
        subtitle={
          activeCompany ? (
            <span className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-app-text font-bold">{activeCompany.name}</span>
              <span className="text-app-muted">• RUC: {activeCompany.ruc}</span>
              {(activeCompany.sol_user && activeCompany.sol_pass) ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  <ShieldCheck size={12} /> Clave SOL Conectada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <AlertCircle size={12} /> Requiere Usuario / Clave SOL
                </span>
              )}
            </span>
          ) : (
            'Seleccione una empresa para iniciar'
          )
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {resultados.length > 0 && (
              <button
                onClick={handleLimpiarHistorial}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all cursor-pointer shadow-2xs"
                title="Limpiar resultados de esta sesión"
              >
                <Trash2 size={13} />
                <span>Limpiar</span>
              </button>
            )}
            <button
              onClick={() => setShowRecentSelector(!showRecentSelector)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 md:p-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4 sm:gap-5 w-full">

          {/* ═══ BARRA DE CARGA Y PROGRESO RESPONSIVE ═══ */}
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
            <div className="card-elevated p-4 sm:p-5 flex flex-col gap-3.5 animate-fade-in bg-app-surface/80 border border-app-border rounded-2xl shadow-sm relative z-20">
              
              {/* Cabecera del SIRE con Selector de Años con ModernSelect */}
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-app-border/60 pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                      <span>COMPROBANTES REGISTRADOS EN SIRE</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black uppercase font-mono">
                        {yearPurchases.length} en {selectedYear}
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Selector de Año con ModernSelect (Requerimiento 2) */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-wider text-app-muted uppercase">Ejercicio / Año:</span>
                  <ModernSelect
                    value={selectedYear}
                    options={availableYears.map(y => ({
                      value: y,
                      label: y
                    }))}
                    onChange={(val) => {
                      setSelectedYear(String(val));
                      setSelectedSireMonth(null);
                    }}
                    icon={<Calendar size={13} />}
                    size="sm"
                    variant="compact"
                  />
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
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all select-none ${
                          hasItems
                            ? 'bg-app-bg hover:bg-blue-500/10 border-app-border hover:border-blue-500/40 cursor-pointer shadow-2xs group hover:-translate-y-0.5'
                            : 'bg-app-bg/40 border-app-border/40 opacity-50 cursor-not-allowed'
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
                            <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
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
                /* VISTA 2: DRILL-DOWN DE COMPROBANTES DEL MES SELECCIONADO (Sin botón eliminado) */
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/20 p-3 rounded-xl flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => setSelectedSireMonth(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-app-surface hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer shadow-2xs active:scale-98"
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
                        className="flex items-center justify-between p-2.5 bg-app-bg hover:bg-blue-500/5 border border-app-border hover:border-blue-500/30 rounded-xl transition-all group shadow-2xs"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Total Consultadas</span>
                  <span className="text-base sm:text-lg font-black font-mono text-app-text leading-tight mt-0.5">{stats.total}</span>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Layers size={16} />
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Aceptadas (Válidas)</span>
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-500 leading-tight mt-0.5">{stats.aceptados}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 size={16} />
                </div>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider">Anuladas / Rechazadas</span>
                  <span className="text-base sm:text-lg font-black font-mono text-rose-500 leading-tight mt-0.5">{stats.anulados}</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                  <AlertCircle size={16} />
                </div>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-purple-500 uppercase tracking-wider">Otros / Observados</span>
                  <span className="text-base sm:text-lg font-black font-mono text-purple-500 leading-tight mt-0.5">{stats.otros}</span>
                </div>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <FileCheck size={16} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ SELECTOR PRINCIPAL DE HOJAS: 2 PESTAÑAS MODERNAS Y RESPONSIVAS ═══ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-app-surface border border-app-border rounded-2xl shadow-xs">
            <button
              onClick={() => setActiveTab('individual')}
              className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'individual'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-app-muted hover:text-app-text hover:bg-app-hover'
              }`}
            >
              <Search size={16} />
              <span>1. CONSULTA INDIVIDUAL</span>
            </button>

            <button
              onClick={() => setActiveTab('consultas_masivas')}
              className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
                activeTab === 'consultas_masivas'
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-md'
                  : 'text-app-muted hover:text-app-text hover:bg-app-hover'
              }`}
            >
              <Sparkles size={16} className={activeTab === 'consultas_masivas' ? 'text-amber-300 animate-pulse' : 'text-purple-400'} />
              <span>2. CONSULTAS MASIVAS</span>
              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest font-mono ${
                activeTab === 'consultas_masivas' ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              }`}>
                API INVERSA
              </span>
            </button>
          </div>

          {/* ═══ VISTA DE CONSULTAS MASIVAS DEDICADA ═══ */}
          {activeTab === 'consultas_masivas' ? (
            <ConsultasMasivasSheet
              activeCompany={activeCompany}
              onRefreshWorkspace={syncCurrentWorkspace}
            />
          ) : (
            /* ═══ VISTA DE CONSULTA INDIVIDUAL Y TABLA DE HISTORIAL ═══ */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Panel Izquierdo: Formulario Individual */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
              <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-app-border bg-app-bg/50 flex items-center gap-2">
                  <Search size={15} className="text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                    Formulario de Consulta Individual
                  </h3>
                </div>

                <div className="p-4 space-y-3.5">
                  {/* SELECTOR PERSONALIZADO DE TIPO DE DOCUMENTO */}
                  <div className={`relative ${isTipoDocOpen ? 'z-50' : 'z-10'}`} ref={tipoDocRef}>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                      Tipo de Documento
                    </label>
                    
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

                    {isTipoDocOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 z-[100] bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1.5 flex flex-col gap-1">
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

                  {/* Input RUC */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1">
                      RUC Emisor (Proveedor)
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
                        className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text uppercase outline-none focus:border-blue-500 transition-all shadow-2xs"
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
                        className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all shadow-2xs"
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
                        className="w-full px-2.5 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-bold text-app-text outline-none focus:border-blue-500 transition-all shadow-2xs"
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
                        className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all shadow-2xs"
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
                    <span>Consultar en SUNAT</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Derecho: Tabla de Resultados con Estructura Exacta de Excel */}
            <div className="col-span-1 lg:col-span-8 flex flex-col">
              <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm min-h-[480px] flex flex-col relative">
                
                {/* Cabecera del Historial con Buscador */}
                <div className="px-4 py-3 border-b border-app-border bg-app-bg/40 flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                      Historial de Consultas Realizadas
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {resultados.length > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 bg-app-bg border border-app-border rounded-xl focus-within:border-blue-500 shadow-2xs">
                        <Search size={12} className="text-app-muted" />
                        <input
                          type="text"
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          placeholder="Filtrar..."
                          className="bg-transparent text-xs text-app-text outline-none w-28 sm:w-36 border-none focus:ring-0 p-0"
                        />
                      </div>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl font-mono shrink-0">
                      {filteredResultados.length} {filteredResultados.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                </div>

                {/* Tabla con Estructura de Columnas de Excel */}
                <div
                  ref={tableContainerRef}
                  onScroll={handleTableScroll}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                  className={`flex-1 overflow-x-auto overflow-y-auto custom-scrollbar select-none ${
                    isDragging ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                >
                  {filteredResultados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-app-muted p-8 text-center">
                      <div className="p-4 rounded-2xl bg-app-bg border border-app-border mb-3">
                        <FileSearch size={36} className="text-app-muted/50" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider text-app-text">
                        {resultados.length === 0 ? 'No hay consultas registradas en esta sesión' : 'No se encontraron resultados para el filtro'}
                      </p>
                      <p className="text-[11px] text-app-muted max-w-sm mt-1">
                        Utiliza el formulario de la izquierda o selecciona comprobantes de SIRE para consultar la validez contra SUNAT.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                      <thead className="sticky top-0 z-10 bg-app-surface border-b border-app-border shadow-xs">
                        <tr className="text-[9px] font-black uppercase tracking-wider text-app-muted">
                          <th className="py-2.5 px-3 w-10 text-center">N°</th>
                          <th className="py-2.5 px-3">ESTADO SUNAT</th>
                          <th className="py-2.5 px-3 font-mono">RUC EMISOR</th>
                          <th className="py-2.5 px-3">RAZON SOCIAL</th>
                          <th className="py-2.5 px-2 text-center">TIPO DOC</th>
                          <th className="py-2.5 px-3 font-mono text-center">SERIE</th>
                          <th className="py-2.5 px-3 font-mono text-center">NUMERO</th>
                          <th className="py-2.5 px-3 font-mono">FECHA EMISION</th>
                          <th className="py-2.5 px-2 font-mono text-center">MONEDA</th>
                          <th className="py-2.5 px-3 font-mono text-right">MONTO GRAVADO</th>
                          <th className="py-2.5 px-3 font-mono text-right">IGV (S/)</th>
                          <th className="py-2.5 px-3 font-mono text-right">TOTAL (S/)</th>
                          <th className="py-2.5 px-3">ITEMS DETALLE</th>
                          <th className="py-2.5 px-3">OBSERVACION</th>
                          <th className="py-2.5 px-3 text-center">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border/40 text-xs">
                        {filteredResultados.map((res: any, idx: number) => {
                          const isAceptado = res.estado === 'ACEPTADO';
                          const isAnulado = res.estado?.includes('ANULADO');
                          const isError = res.estado === 'ERROR' || res.estado === 'NO_EXISTE';
                          const rowId = String(res.id || `row-${idx}`);
                          const isExpanded = !!expandedRows[rowId];
                          const hasItems = res.items && Array.isArray(res.items) && res.items.length > 0;
                          const itemsPreview = hasItems
                            ? res.items.map((it: any) => `${it.cantidad}x ${it.descripcion}`).join(', ')
                            : '—';

                          return (
                            <React.Fragment key={idx}>
                              <tr className="hover:bg-app-hover/40 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-app-muted text-center">{idx + 1}</td>
                                
                                {/* ESTADO SUNAT */}
                                <td className="py-2 px-3">
                                  {isAceptado ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                      <CheckCircle2 size={11} /> ACEPTADO
                                    </span>
                                  ) : isAnulado ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                      <XCircle size={11} /> ANULADO
                                    </span>
                                  ) : res.estado === 'NO_EXISTE' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                      <AlertTriangle size={11} /> NO EXISTE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                      <AlertCircle size={11} /> ERROR
                                    </span>
                                  )}
                                </td>

                                {/* RUC EMISOR */}
                                <td className="py-2 px-3 font-mono font-bold text-app-text">
                                  {res.rucEmisor || activeCompany?.ruc}
                                </td>

                                {/* RAZON SOCIAL */}
                                <td className="py-2 px-3">
                                  <span className="text-[11px] font-semibold text-app-text truncate max-w-[180px] block" title={res.razonSocial}>
                                    {res.razonSocial || '—'}
                                  </span>
                                </td>

                                {/* TIPO DOC */}
                                <td className="py-2 px-2 text-center">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono text-[10px] font-bold border border-blue-500/20">
                                    {res.tipoDoc || '01'}
                                  </span>
                                </td>

                                {/* SERIE */}
                                <td className="py-2 px-3 font-mono font-bold text-app-text text-center">
                                  {res.serie}
                                </td>

                                {/* NUMERO */}
                                <td className="py-2 px-3 font-mono font-bold text-app-text text-center">
                                  {res.numero}
                                </td>

                                {/* FECHA EMISION */}
                                <td className="py-2 px-3 font-mono text-app-text">
                                  {res.fechaEmision || '—'}
                                </td>

                                {/* MONEDA */}
                                <td className="py-2 px-2 font-mono text-center font-bold text-app-muted">
                                  {res.moneda || 'PEN'}
                                </td>

                                {/* MONTO GRAVADO */}
                                <td className="py-2 px-3 text-right font-mono font-bold text-app-text">
                                  {formatPEN(res.montoGravado || 0)}
                                </td>

                                {/* IGV */}
                                <td className="py-2 px-3 text-right font-mono font-bold text-purple-400">
                                  {formatPEN(res.montoIgv || 0)}
                                </td>

                                {/* TOTAL */}
                                <td className="py-2 px-3 text-right font-mono font-black text-emerald-400">
                                  {formatPEN(res.total || res.importeTotal || 0)}
                                </td>

                                {/* ITEMS DETALLE (CLIC EN TODA LA CELDA PARA DESPLEGAR) */}
                                <td 
                                  onClick={() => hasItems && toggleExpandRow(rowId)}
                                  className={`py-2 px-3 transition-colors ${hasItems ? 'cursor-pointer hover:bg-blue-500/10 select-none' : ''}`}
                                  title={hasItems ? 'Clic para desplegar / contraer el detalle de items' : ''}
                                >
                                  <div className="flex items-center gap-1.5 max-w-xs">
                                    <span className="text-[11px] text-app-text truncate" title={itemsPreview}>
                                      {itemsPreview}
                                    </span>
                                    {hasItems && (
                                      <span className="p-0.5 rounded text-blue-500 shrink-0">
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* OBSERVACION */}
                                <td className="py-2 px-3">
                                  <span
                                    className={`text-[10px] font-mono truncate max-w-xs block ${
                                      isError ? 'text-purple-400' : 'text-emerald-500 font-bold'
                                    }`}
                                    title={res.observacion || res.mensaje || 'OK'}
                                  >
                                    {res.observacion || res.mensaje || 'OK'}
                                  </span>
                                </td>

                                {/* ACCIONES (PDF + XML) */}
                                <td className="py-2 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {isAceptado && (
                                      <button
                                        onClick={() => setSelectedDocForPreview(res)}
                                        className="px-2 py-1 rounded-md text-[10px] font-black bg-purple-500/10 text-purple-400 hover:bg-purple-600 hover:text-white border border-purple-500/20 transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1"
                                        title="Ver Representación Impresa (PDF / Voucher)"
                                      >
                                        <FileText size={12} />
                                        <span>PDF</span>
                                      </button>
                                    )}
                                    {isAceptado ? (
                                      <button
                                        onClick={() => handleDescargarXmlDirecto(res)}
                                        className="px-2 py-1 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1"
                                        title="Descargar XML oficial de SUNAT"
                                      >
                                        <FileCode size={12} />
                                        <span>XML</span>
                                      </button>
                                    ) : (
                                      <span className="text-app-muted text-[10px]">—</span>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              {/* Fila Desplegable de Items Estructurada */}
                              {isExpanded && hasItems && (
                                <tr className="bg-blue-500/5">
                                  <td colSpan={15} className="p-3">
                                    <div className="sticky left-4 max-w-3xl bg-app-surface border border-app-border rounded-xl p-3 shadow-md">
                                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-app-border">
                                        <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                                          <Layers size={13} />
                                          <span>Detalle de Items / Conceptos ({res.serie}-{res.numero}) • {res.items.length} item(s)</span>
                                        </h5>
                                        <span className="text-[10px] font-bold text-app-muted">
                                          Emisor: {res.razonSocialEmisor || res.razonSocial || res.rucEmisor}
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto rounded-lg border border-app-border">
                                        <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-app-bg text-[10px] font-black text-app-muted uppercase tracking-wider">
                                            <tr>
                                              <th className="py-1.5 px-3 w-10 text-center">#</th>
                                              <th className="py-1.5 px-3 w-28 text-center">Cantidad / Und</th>
                                              <th className="py-1.5 px-3">Descripción del Producto / Servicio</th>
                                              <th className="py-1.5 px-3 w-28 text-right">V. Unitario</th>
                                              <th className="py-1.5 px-3 w-28 text-right">Importe Total</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-app-border bg-app-surface">
                                            {res.items.map((it: any, iIdx: number) => (
                                              <tr key={iIdx} className="hover:bg-app-hover/50 transition-colors">
                                                <td className="py-1.5 px-3 text-center font-mono text-[10px] text-app-muted">{iIdx + 1}</td>
                                                <td className="py-1.5 px-3 text-center font-mono font-bold text-app-text">
                                                  <span className="px-1.5 py-0.5 rounded bg-app-bg border border-app-border text-[10px]">
                                                    {it.cantidad || 1} {it.unidadMedida || it.desUnidadMedida || 'NIU'}
                                                  </span>
                                                </td>
                                                <td className="py-1.5 px-3 text-app-text font-medium text-xs">
                                                  {it.descripcion || it.desItem || '—'}
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-mono font-bold text-app-muted text-xs">
                                                  S/ {formatPEN(it.valorUnitario || ((it.montoTotal || 0) / (it.cantidad || 1)))}
                                                </td>
                                                <td className="py-1.5 px-3 text-right font-mono font-black text-emerald-500 text-xs">
                                                  S/ {formatPEN(it.montoTotal)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ═══ Modal Visor Oficial de PDF / Comprobante SUNAT ═══ */}
      {selectedDocForPreview && (
        <CpeVoucherModal
          doc={selectedDocForPreview}
          onClose={() => setSelectedDocForPreview(null)}
        />
      )}
    </div>
  );
}
