import React, { useState, useEffect, useMemo } from 'react';
import { webApiBridge } from '../services/apiBridge';
import { useStore } from '../store';
import { toast } from 'react-hot-toast';
import PageHeader from './ui/PageHeader';
import CpeVoucherModal from './cpe/CpeVoucherModal';
import {
  descargarXmlSeguro,
  base64ToUtf8,
  generarCdrXmlOficial,
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
  PackageCheck
} from 'lucide-react';

interface ConsultasViewProps {
  currentWorkspace?: any;
}

export default function ConsultasView({ currentWorkspace }: ConsultasViewProps) {
  const { currentCompany, purchases, cpeConsultaTarget, setCpeConsultaTarget, syncCurrentWorkspace } = useStore();
  const activeCompany = currentWorkspace || currentCompany;

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'individual' | 'masiva'>('individual');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<any | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    rucEmisor: '',
    tipoDoc: '01',
    serie: '',
    numero: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    total: ''
  });
  const [masivaText, setMasivaText] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [showRecentSelector, setShowRecentSelector] = useState(true);

  const toggleExpandRow = (rowId: string) => {
    setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
  };

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

  const procesarFacturas = async (facturas: any[]) => {
    if (!activeCompany?.ruc) {
      toast.error('Debe seleccionar una empresa activa primero.');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading(`Consultando ${facturas.length} comprobante(s) en SUNAT API...`);
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
      setResultados(prev => [...resList, ...prev]);
      
      if (resList.length > 0 && resList[0].estado === 'ACEPTADO') {
        setSelectedDocForPreview(resList[0]);
      }
      
      // Descarga automática en el navegador de XML si está disponible
      let descargasContadas = 0;
      resList.forEach((r: any) => {
        if (r.xmlBase64) {
          descargarBase64(r.xmlBase64, r.xmlFileName || `${r.id}.xml`, 'application/xml');
          descargasContadas++;
        }
      });

      const aceptados = resList.filter((r: any) => r.estado === 'ACEPTADO').length;
      toast.success(
        `Consulta completada (${aceptados} Aceptados). ${descargasContadas > 0 ? `Se descargó el archivo XML a tu equipo.` : ''}`,
        { id: loadingToast, duration: 4500 }
      );
      await syncCurrentWorkspace();
    } catch (error: any) {
      console.error(error);
      const msg = error?.response?.data?.error || error.message || 'Error al consultar SUNAT';
      toast.error(`Error: ${msg}`, { id: loadingToast, duration: 6000 });
    } finally {
      setLoading(false);
    }
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
    const aceptados = resultados.filter(r => r.estado === 'ACEPTADO').length;
    const anulados = resultados.filter(r => r.estado === 'ANULADO' || r.estado?.includes('ANULADO')).length;
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
            <span className="flex items-center gap-2">
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
                onClick={() => setResultados([])}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all cursor-pointer"
                title="Limpiar resultados de pantalla"
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
              <span>{showRecentSelector ? 'Ocultar Recientes' : 'Cargar de SIRE/Compras'}</span>
            </button>
          </div>
        }
      />

      {/* ═══ Contenedor Principal con Scrollbar Fluido y 100% de Ancho ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-6 w-full">

          {/* ═══ Selector Rápido de Comprobantes Recientes (Comunicación Directa SIRE/Compras) ═══ */}
          {showRecentSelector && purchases && purchases.length > 0 && (
            <div className="card-elevated p-4 flex flex-col gap-3 animate-fade-in bg-app-surface/60 border border-app-border rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                    Comprobantes Registrados en el Período (1-Click para Cargar o Consultar)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-app-muted">
                  {purchases.slice(0, 8).length} comprobantes recientes disponibles
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {purchases.slice(0, 8).map((p: any) => (
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
                        S/ {Number(p.total || 0).toFixed(2)} • {p.fecha}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleSelectRecentPurchase(p, false)}
                        className="p-1.5 rounded-lg bg-app-surface hover:bg-blue-500/20 text-app-muted hover:text-blue-500 border border-app-border transition-all"
                        title="Cargar datos en el formulario"
                      >
                        <ArrowRight size={13} />
                      </button>
                      <button
                        onClick={() => handleSelectRecentPurchase(p, true)}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
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

          {/* ═══ Resumen de Estadísticas (Cards) ═══ */}
          {resultados.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Total Consultadas</span>
                  <span className="text-xl font-black text-app-text leading-none mt-1">{stats.total}</span>
                </div>
                <Layers className="text-blue-500/40" size={24} />
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Aceptadas (Válidas)</span>
                  <span className="text-xl font-black text-emerald-500 leading-none mt-1">{stats.aceptados}</span>
                </div>
                <CheckCircle2 className="text-emerald-500/40" size={24} />
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Anuladas / Rechazadas</span>
                  <span className="text-xl font-black text-rose-500 leading-none mt-1">{stats.anulados}</span>
                </div>
                <AlertCircle className="text-rose-500/40" size={24} />
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Otros / Observados</span>
                  <span className="text-xl font-black text-purple-500 leading-none mt-1">{stats.otros}</span>
                </div>
                <FileCheck className="text-purple-500/40" size={24} />
              </div>
            </div>
          )}

          {/* ═══ Contenido: Formulario y Tabla de Resultados ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Panel Izquierdo: Formulario */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
              <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                {/* Selector de Pestañas */}
                <div className="flex border-b border-app-border bg-app-bg/50 p-1">
                  <button
                    onClick={() => setActiveTab('individual')}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                      activeTab === 'individual'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setActiveTab('masiva')}
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                      activeTab === 'masiva'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                    }`}
                  >
                    Lote Masivo
                  </button>
                </div>

                <div className="p-5">
                  {activeTab === 'individual' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1.5">
                          Tipo de Documento
                        </label>
                        <select
                          name="tipoDoc"
                          value={formData.tipoDoc}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 bg-app-bg border border-app-border rounded-xl text-xs font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                        >
                          <option value="01">Factura Electrónica (01)</option>
                          <option value="03">Boleta de Venta (03)</option>
                          <option value="07">Nota de Crédito (07)</option>
                          <option value="08">Nota de Débito (08)</option>
                          <option value="R1">Recibo por Honorarios (R1)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1.5">
                          RUC Emisor (Proveedor / Empresa)
                        </label>
                        <div className="relative">
                          <input
                            name="rucEmisor"
                            value={formData.rucEmisor}
                            onChange={handleInputChange}
                            placeholder="Ej. 20609396033"
                            maxLength={11}
                            className="w-full pl-9 pr-3 py-2.5 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                          />
                          <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1.5">
                            Serie
                          </label>
                          <input
                            name="serie"
                            value={formData.serie}
                            onChange={handleInputChange}
                            placeholder="F001"
                            maxLength={4}
                            className="w-full px-3 py-2.5 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text uppercase outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1.5">
                            Número
                          </label>
                          <input
                            name="numero"
                            value={formData.numero}
                            onChange={handleInputChange}
                            placeholder="84"
                            className="w-full px-3 py-2.5 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1.5">
                            Fecha Emisión
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              name="fechaEmision"
                              value={formData.fechaEmision}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-app-muted mb-1.5">
                            Monto Total
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              name="total"
                              step="0.01"
                              value={formData.total}
                              onChange={handleInputChange}
                              placeholder="0.00"
                              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-xl text-xs font-mono font-bold text-app-text outline-none focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleConsultarIndividual}
                        disabled={loading}
                        className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Search size={16} />
                        )}
                        <span>Consultar y Descargar CPE</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
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
                                toast.success(`Se importaron ${purchases.slice(0, 50).length} facturas de compras.`);
                              }
                            }}
                            className="text-[9px] font-black text-blue-500 uppercase hover:underline cursor-pointer"
                          >
                            Cargar de Compras
                          </button>
                        </div>
                        <textarea
                          value={masivaText}
                          onChange={(e) => setMasivaText(e.target.value)}
                          placeholder="20609396033|01|F001|84|2026-08-12|3693.11&#10;20609396033|01|F001|83|2026-08-12|262.61"
                          className="w-full h-52 p-3 bg-app-bg border border-app-border rounded-xl text-xs font-mono text-app-text outline-none focus:border-blue-500 transition-all resize-none custom-scrollbar whitespace-pre leading-relaxed"
                        />
                      </div>

                      <button
                        onClick={handleConsultarMasiva}
                        disabled={loading}
                        className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest py-3 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Layers size={16} />
                        )}
                        <span>Procesar Lote Masivo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel Derecho: Tabla de Resultados Full-Size con Concepto de Factura */}
            <div className="col-span-1 lg:col-span-8 flex flex-col">
              <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm min-h-[480px] flex flex-col">
                <div className="px-5 py-3.5 border-b border-app-border bg-app-bg/40 flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-app-text">
                      Historial de Consultas Realizadas
                    </h3>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full">
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
                        No hay consultas recientes en esta sesión
                      </p>
                      <p className="text-[11px] text-app-muted max-w-sm mt-1">
                        Utiliza el formulario de la izquierda o haz clic en "Cargar de SIRE/Compras" para consultar la validez de cualquier factura en SUNAT.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse min-w-[880px]">
                      <thead className="sticky top-0 z-10 bg-app-surface border-b border-app-border shadow-xs">
                        <tr className="text-[9px] font-black uppercase tracking-widest text-app-muted">
                          <th className="px-4 py-3 w-[25%]">Comprobante / Emisor</th>
                          <th className="px-3 py-3 w-[15%]">Estado & Monto</th>
                          <th className="px-4 py-3 w-[40%]">Concepto de Factura</th>
                          <th className="px-4 py-3 w-[20%] text-right">Descargas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border/40 text-xs">
                        {resultados.map((res: any, idx: number) => {
                          const isAceptado = res.estado === 'ACEPTADO';
                          const isAnulado = res.estado?.includes('ANULADO');
                          const rowId = String(res.id || `row-${idx}`);
                          const isExpanded = !!expandedRows[rowId];

                          // Obtener ítems parseados del XML
                          let items: CpeItem[] | null = null;
                          if (res.items && Array.isArray(res.items) && res.items.length > 0) {
                            items = res.items;
                          } else {
                            const rawXml = res.xmlContent || (res.xmlBase64 ? base64ToUtf8(res.xmlBase64) : '');
                            if (rawXml) {
                              try {
                                const parsed = parseCpeXml(rawXml);
                                if (parsed.items && parsed.items.length > 0) {
                                  items = parsed.items;
                                }
                              } catch (e) {}
                            }
                          }

                          return (
                            <tr key={idx} className="hover:bg-app-hover/40 transition-colors">
                              {/* 1. Comprobante / Emisor */}
                              <td className="px-4 py-3.5 align-top">
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
                              <td className="px-3 py-3.5 align-top">
                                <div className="flex flex-col gap-1.5">
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
                                  <div className="flex flex-col">
                                    <span className="text-[9px] text-app-muted font-bold uppercase">Total</span>
                                    <span className="text-xs font-black font-mono text-app-text">
                                      S/ {Number(String(res.importeTotal || '0').replace(/[^0-9.]/g, '') || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* 3. CONCEPTO DE FACTURA (Ítems / Cantidades / Precios) */}
                              <td className="px-4 py-3.5 align-top">
                                {items && items.length > 0 ? (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-app-text flex items-center gap-1">
                                        <PackageCheck size={13} className="text-emerald-500" />
                                        {items.length} {items.length === 1 ? 'Ítem Detallado' : 'Ítems Detallados'}
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

                                    {/* Lista de Conceptos / Productos */}
                                    <div className="space-y-1">
                                      {(isExpanded ? items : items.slice(0, 2)).map((it, itIdx) => (
                                        <div
                                          key={itIdx}
                                          className="p-1.5 rounded-lg bg-app-bg/80 border border-app-border/70 text-[10px] flex flex-col gap-0.5 hover:border-app-border transition-colors"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="font-bold text-app-text leading-tight flex-1">
                                              {it.descripcion}
                                            </span>
                                            <span className="font-mono font-bold text-app-text shrink-0">
                                              S/ {Number(it.subtotal || (it.cantidad * it.valorUnitario)).toFixed(2)}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 text-[9px] text-app-muted flex-wrap">
                                            <span className="px-1 py-0.2 rounded bg-app-surface border border-app-border font-mono font-medium">
                                              {it.cantidad} {it.unidadMedida}
                                            </span>
                                            {it.codigo && it.codigo !== '-' && (
                                              <span className="font-mono">Cód: {it.codigo}</span>
                                            )}
                                            <span>V. Unit: S/ {Number(it.valorUnitario).toFixed(4)}</span>
                                            {it.icbper > 0 && <span>ICBPER: S/ {Number(it.icbper).toFixed(2)}</span>}
                                          </div>
                                        </div>
                                      ))}
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

                              {/* 4. Descargas y Acciones */}
                              <td className="px-4 py-3.5 align-top text-right">
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

                                  {/* Botón XML */}
                                  {(res.xmlBase64 || res.xmlContent || res.xmlPath) && (
                                    <button
                                      onClick={() => {
                                        if (res.xmlBase64) {
                                          descargarBase64(res.xmlBase64, res.xmlFileName || `${res.id}.xml`, 'application/xml');
                                        } else if (res.xmlContent) {
                                          descargarXmlSeguro(res.xmlContent, res.xmlFileName || `${res.id}.xml`);
                                        } else if (res.xmlPath) {
                                          handleDescargarArchivoPorRuta(res.xmlPath, res.xmlFileName || `${res.id}.xml`);
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                                      title="Descargar archivo XML oficial"
                                    >
                                      <Download size={11} />
                                      <span>XML</span>
                                    </button>
                                  )}

                                  {/* Botón CDR */}
                                  {(res.cdrBase64 || res.cdrContent || res.cdrPath || res.xmlBase64 || res.xmlContent) && (
                                    <button
                                      onClick={() => {
                                        if (res.cdrBase64) {
                                          descargarBase64(res.cdrBase64, res.cdrFileName || `R-${res.id}.xml`, 'application/xml');
                                        } else if (res.cdrContent) {
                                          descargarXmlSeguro(res.cdrContent, res.cdrFileName || `R-${res.id}.xml`);
                                        } else if (res.cdrPath) {
                                          handleDescargarArchivoPorRuta(res.cdrPath, res.cdrFileName || `R-${res.id}.xml`);
                                        } else if (res.xmlBase64 || res.xmlContent) {
                                          try {
                                            const rawXml = res.xmlContent || base64ToUtf8(res.xmlBase64);
                                            const parsed = parseCpeXml(rawXml);
                                            const genCdr = generarCdrXmlOficial(parsed);
                                            descargarXmlSeguro(genCdr, `R-${res.rucEmisor || activeCompany?.ruc || '20000000001'}-${res.tipoDoc || '01'}-${res.serie}-${res.numero}.xml`);
                                            toast.success('Constancia CDR generada y descargada.');
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
                                  )}

                                  {/* Botón Captura PNG */}
                                  {(res.capturaBase64 || res.capturaPath) && (
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
