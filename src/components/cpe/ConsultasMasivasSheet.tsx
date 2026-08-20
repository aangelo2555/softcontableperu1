import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { webApiBridge } from '../../services/apiBridge';
import { useStore } from '../../store';
import { formatPEN } from '../ConsultasView';
import {
  FileSpreadsheet,
  UploadCloud,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Layers,
  Search,
  ArrowDownToLine,
  History,
  Trash2,
  Eye,
  Loader2,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Sparkles,
  Check,
  FileText,
  AlertCircle,
  FileCode
} from 'lucide-react';

interface ConsultasMasivasSheetProps {
  activeCompany: any;
  onRefreshWorkspace?: () => void;
}

interface CpeRowInput {
  id: string;
  rucEmisor: string;
  razonSocial?: string;
  tipoCpe: string;
  serie: string;
  numero: string;
  fechaEmision?: string;
  monto?: number | string;
}

interface CpeProcessedResult {
  index: number;
  itemOriginal: CpeRowInput;
  success: boolean;
  encontrado: boolean;
  estado: 'ACEPTADO' | 'ANULADO' | 'NO_EXISTE' | 'ERROR';
  mensaje?: string;
  error?: string;
  resultado?: {
    rucEmisor: string;
    razonSocialEmisor: string;
    direccionEmisor: string;
    docReceptorNum: string;
    razonSocialReceptor: string;
    tipoCpe: string;
    serie: string;
    numero: string;
    moneda: string;
    fechaEmision: string;
    estado: string;
    montoGravado: number;
    montoExonerado: number;
    montoInafecto: number;
    montoIgv: number;
    montoIsc: number;
    montoTotal: number;
    desMontoLetras: string;
    items: Array<{
      cantidad: number;
      unidadMedida: string;
      descripcion: string;
      valorUnitario: number;
      montoTotal: number;
    }>;
  };
}

export default function ConsultasMasivasSheet({ activeCompany, onRefreshWorkspace }: ConsultasMasivasSheetProps) {
  const { purchases, syncCurrentWorkspace } = useStore();

  // Estados de carga de datos
  const [inputMode, setInputMode] = useState<'excel' | 'texto' | 'sire'>('excel');
  const [inputText, setInputText] = useState('');
  const [stagedList, setStagedList] = useState<CpeRowInput[]>([]);
  const [fileNameLoaded, setFileNameLoaded] = useState<string>('');

  // Estados de procesamiento
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatusText, setCurrentStatusText] = useState('');
  const [concurrency, setConcurrency] = useState<number>(4);

  // Estados de resultados
  const [batchResults, setBatchResults] = useState<CpeProcessedResult[]>([]);
  const [lastStats, setLastStats] = useState<any | null>(null);
  const [lastLoteId, setLastLoteId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filtros de resultados
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACEPTADO' | 'ANULADO' | 'NO_EXISTE' | 'ERROR'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Historial de lotes anteriores
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialLotes, setHistorialLotes] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar historial al abrir
  const loadHistorial = async () => {
    if (!activeCompany?.ruc) return;
    setLoadingHistorial(true);
    try {
      const res = await webApiBridge.cpeDirectObtenerHistorial(activeCompany.ruc);
      if (res.success) {
        setHistorialLotes(res.lotes || []);
      }
    } catch (e: any) {
      toast.error('Error al cargar historial: ' + e.message);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // ═══ DESCARGA DE PLANTILLA EXCEL ═══
  const descargarPlantilla = () => {
    const dataEjemplo = [
      {
        'RUC_EMISOR': '20609936224',
        'TIPO_COMPROBANTE': '01',
        'SERIE': 'E001',
        'NUMERO': '826',
        'FECHA_EMISION': '2026-07-31',
        'MONTO_TOTAL': '1224.00'
      },
      {
        'RUC_EMISOR': '20100070970',
        'TIPO_COMPROBANTE': '01',
        'SERIE': 'F001',
        'NUMERO': '10452',
        'FECHA_EMISION': '2026-08-05',
        'MONTO_TOTAL': '350.00'
      },
      {
        'RUC_EMISOR': '20512345678',
        'TIPO_COMPROBANTE': '03',
        'SERIE': 'B001',
        'NUMERO': '542',
        'FECHA_EMISION': '2026-08-10',
        'MONTO_TOTAL': '85.50'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(dataEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes');
    XLSX.writeFile(wb, 'Plantilla_Consultas_Masivas_CPE_SUNAT.xlsx');
    toast.success('Plantilla descargada.');
  };

  // ═══ PARSEO DE ARCHIVO EXCEL O CSV ═══
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileNameLoaded(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawData.length === 0) {
          toast.error('El archivo Excel está vacío.');
          return;
        }

        const parsed: CpeRowInput[] = rawData.map((row, idx) => {
          // Detectar columnas flexibles (mayúsculas, minúsculas, con o sin guión)
          const ruc = String(row['RUC_EMISOR'] || row['RUC'] || row['ruc'] || row['numRuc'] || row['doc_num'] || '').trim();
          const tipo = String(row['TIPO_COMPROBANTE'] || row['TIPO'] || row['tipo'] || row['tipo_doc'] || '01').trim().padStart(2, '0');
          const serie = String(row['SERIE'] || row['Serie'] || row['serie'] || '').trim().toUpperCase();
          const numero = String(row['NUMERO'] || row['Numero'] || row['numero'] || row['correlativo'] || '').trim();
          const fecha = String(row['FECHA_EMISION'] || row['FECHA'] || row['fecha'] || '').trim();
          const monto = row['MONTO_TOTAL'] || row['TOTAL'] || row['total'] || '';

          return {
            id: `staged-${idx}-${Date.now()}`,
            rucEmisor: ruc,
            tipoCpe: tipo || '01',
            serie,
            numero,
            fechaEmision: fecha,
            monto
          };
        }).filter(item => item.rucEmisor && item.serie && item.numero);

        if (parsed.length === 0) {
          toast.error('No se encontraron filas con RUC, Serie y Número válidos.');
          return;
        }

        setStagedList(parsed);
        toast.success(`Se cargaron ${parsed.length} comprobantes listos para consultar.`);
      } catch (err: any) {
        toast.error('Error al leer archivo Excel: ' + err.message);
      }
    };

    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ═══ PARSEO DE TEXTO MANUAL (COPIAR Y PEGAR DE EXCEL) ═══
  const handleParseText = () => {
    if (!inputText.trim()) {
      toast.error('Pegue filas de datos primero.');
      return;
    }

    const lines = inputText.split('\n').filter(l => l.trim().length > 0);
    const parsed: CpeRowInput[] = [];

    lines.forEach((line, idx) => {
      // Soportar separador por tabulador (\t), tubería (|) o coma (,)
      let parts = line.split('\t');
      if (parts.length < 3) parts = line.split('|');
      if (parts.length < 3) parts = line.split(',');

      const ruc = (parts[0] || '').trim();
      const tipo = (parts[1] || '01').trim().padStart(2, '0');
      const serie = (parts[2] || '').trim().toUpperCase();
      const numero = (parts[3] || '').trim();
      const fecha = (parts[4] || '').trim();
      const monto = (parts[5] || '').trim();

      if (ruc && serie && numero) {
        parsed.push({
          id: `txt-${idx}-${Date.now()}`,
          rucEmisor: ruc,
          tipoCpe: tipo,
          serie,
          numero,
          fechaEmision: fecha,
          monto
        });
      }
    });

    if (parsed.length === 0) {
      toast.error('No se pudo interpretar el formato. Use: RUC [tab/|/,] TIPO [tab] SERIE [tab] NUMERO');
      return;
    }

    setStagedList(parsed);
    toast.success(`Se prepararon ${parsed.length} comprobantes para consulta.`);
  };

  // ═══ CARGA DESDE EL MÓDULO DE COMPRAS (SIRE) ═══
  const handleCargarDesdeSire = () => {
    if (!purchases || purchases.length === 0) {
      toast.error('No hay compras registradas en el workspace actual.');
      return;
    }

    const parsed: CpeRowInput[] = purchases.slice(0, 100).map((p: any, idx: number) => ({
      id: `sire-${p.id || idx}`,
      rucEmisor: String(p.doc_num || '').trim(),
      razonSocial: p.nombre || '',
      tipoCpe: String(p.tipo_doc || '01').trim().padStart(2, '0'),
      serie: String(p.serie || '').trim().toUpperCase(),
      numero: String(p.numero || '').trim(),
      fechaEmision: p.fecha || '',
      monto: p.total || 0
    })).filter((item: CpeRowInput) => item.rucEmisor && item.serie && item.numero);

    setStagedList(parsed);
    toast.success(`Se importaron ${parsed.length} comprobantes desde Compras.`);
  };

  // ═══ EJECUCIÓN DE CONSULTA MASIVA CON API INVERSA ═══
  const handleEjecutarConsultaMasiva = async () => {
    if (!activeCompany?.ruc) {
      toast.error('Seleccione una empresa activa.');
      return;
    }

    if (!activeCompany.sol_user || !activeCompany.sol_pass) {
      toast.error('La empresa debe tener configuradas sus credenciales de Clave SOL.');
      return;
    }

    if (stagedList.length === 0) {
      toast.error('No hay comprobantes preparados para consultar.');
      return;
    }

    setProcessing(true);
    setProgress(10);
    setCurrentStatusText('Autenticando con Clave SOL y obteniendo token Bearer...');

    try {
      const res = await webApiBridge.cpeDirectConsultarMasivo({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        listaComprobantes: stagedList,
        origen_consulta: inputMode.toUpperCase(),
        concurrencia: concurrency
      });

      if (!res.success) {
        throw new Error(res.error || 'Fallo en la consulta masiva');
      }

      setProgress(100);
      setLastLoteId(res.loteId);
      setLastStats(res.stats);
      setBatchResults(res.resultados || []);

      const aceptados = res.stats?.aceptados || 0;
      const total = res.stats?.total || 0;

      toast.success(`¡Consulta masiva completada! ${aceptados} de ${total} comprobantes aceptados.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Error en consulta masiva: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessing(false);
      setProgress(0);
      setCurrentStatusText('');
    }
  };

  // ═══ INCORPORAR COMPROBANTES VALIDADOS A COMPRAS (1-CLIC) ═══
  const handleIncorporarACompras = async () => {
    const aceptados = batchResults
      .filter(r => r.success && r.encontrado && r.resultado)
      .map(r => r.resultado);

    if (aceptados.length === 0) {
      toast.error('No hay comprobantes aceptados para incorporar a compras.');
      return;
    }

    try {
      toast.loading('Incorporando a Compras...', { id: 'guardar-compras' });
      const res = await webApiBridge.cpeDirectGuardarEnCompras({
        workspace_id: activeCompany.ruc,
        comprobantes: aceptados
      });

      if (res.success) {
        toast.success(res.mensaje || `Se incorporaron ${res.insertados} compras exitosamente.`, { id: 'guardar-compras' });
        await syncCurrentWorkspace();
        if (onRefreshWorkspace) onRefreshWorkspace();
      } else {
        toast.error('Error: ' + res.error, { id: 'guardar-compras' });
      }
    } catch (err: any) {
      toast.error('Error al guardar en compras: ' + err.message, { id: 'guardar-compras' });
    }
  };

  // ═══ DESCARGA DIRECTA DE XML OFICIAL SUNAT ═══
  const handleDescargarXmlDirecto = async (item: any) => {
    const rucEmisor = item.rucEmisor || item.doc_num;
    const tipoCpe = item.tipoCpe || item.tipo || '01';
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
        procedencia: '2'
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

  // ═══ EXPORTAR RESULTADOS A EXCEL ═══
  const handleExportarExcel = () => {
    if (batchResults.length === 0) {
      toast.error('No hay resultados para exportar.');
      return;
    }

    const exportData = batchResults.map((r, idx) => {
      const orig: any = r.itemOriginal || {};
      const res: any = r.resultado || {};
      return {
        'N°': idx + 1,
        'ESTADO SUNAT': r.estado || (r.encontrado ? 'ACEPTADO' : 'NO EXISTE'),
        'RUC EMISOR': res.rucEmisor || orig.rucEmisor,
        'RAZON SOCIAL EMISOR': res.razonSocialEmisor || orig.razonSocial || '',
        'TIPO DOC': res.tipoCpe || orig.tipoCpe,
        'SERIE': res.serie || orig.serie,
        'NUMERO': res.numero || orig.numero,
        'FECHA EMISION': res.fechaEmision || orig.fechaEmision || '',
        'MONEDA': res.moneda || 'PEN',
        'MONTO GRAVADO (S/)': res.montoGravado || 0,
        'IGV (S/)': res.montoIgv || 0,
        'TOTAL (S/)': res.montoTotal || orig.monto || 0,
        'ITEMS DETALLE': (res.items || []).map((it: any) => `${it.cantidad}x ${it.descripcion} (S/ ${it.montoTotal})`).join('; '),
        'OBSERVACION': r.mensaje || r.error || 'OK'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados_CPE');
    XLSX.writeFile(wb, `Reporte_CPE_SUNAT_${activeCompany?.ruc || 'masivo'}_${Date.now()}.xlsx`);
    toast.success('Reporte Excel generado exitosamente.');
  };

  // Filtrar resultados por estado y texto
  const filteredResults = useMemo(() => {
    return batchResults.filter(r => {
      // Filtro por estado
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'ACEPTADO' && r.estado !== 'ACEPTADO') return false;
        if (filterStatus === 'ANULADO' && r.estado !== 'ANULADO') return false;
        if (filterStatus === 'NO_EXISTE' && r.estado !== 'NO_EXISTE') return false;
        if (filterStatus === 'ERROR' && r.estado !== 'ERROR') return false;
      }

      // Filtro por búsqueda de texto
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const orig: any = r.itemOriginal || {};
        const res: any = r.resultado || {};
        const matchRuc = (res.rucEmisor || orig.rucEmisor || '').toLowerCase().includes(query);
        const matchRazon = (res.razonSocialEmisor || orig.razonSocial || '').toLowerCase().includes(query);
        const matchDoc = `${res.serie || orig.serie}-${res.numero || orig.numero}`.toLowerCase().includes(query);
        if (!matchRuc && !matchRazon && !matchDoc) return false;
      }

      return true;
    });
  }, [batchResults, filterStatus, searchFilter]);

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in w-full">
      
      {/* ═══ BARRA SUPERIOR DE ACCIONES Y MÉTODOS DE ENTRADA ═══ */}
      <div className="card-elevated bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-app-text flex items-center gap-2">
                <span>Consultas Masivas de CPE</span>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  HTTP DIRECTO • 200ms / CPE
                </span>
              </h3>
              <p className="text-[11px] text-app-muted font-medium">
                Valida decenas de comprobantes por segundo directamente contra los microservicios de SUNAT SOL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={descargarPlantilla}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-app-bg hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer shadow-2xs"
            >
              <Download size={13} className="text-blue-500" />
              <span>Plantilla Excel</span>
            </button>
            <button
              onClick={() => {
                setShowHistorialModal(true);
                loadHistorial();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-app-bg hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer shadow-2xs"
            >
              <History size={13} className="text-indigo-500" />
              <span>Ver Historial de Lotes</span>
            </button>
          </div>
        </div>

        {/* Selector de Modos de Entrada */}
        <div className="flex items-center gap-2 mt-4 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setInputMode('excel')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              inputMode === 'excel'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-app-bg text-app-muted hover:text-app-text border border-app-border'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>1. Cargar Archivo Excel / CSV</span>
          </button>
          <button
            onClick={() => setInputMode('texto')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              inputMode === 'texto'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-app-bg text-app-muted hover:text-app-text border border-app-border'
            }`}
          >
            <FileText size={15} />
            <span>2. Pegar Columnas de Texto</span>
          </button>
          <button
            onClick={() => {
              setInputMode('sire');
              handleCargarDesdeSire();
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              inputMode === 'sire'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-app-bg text-app-muted hover:text-app-text border border-app-border'
            }`}
          >
            <Layers size={15} />
            <span>3. Desde Compras SIRE</span>
          </button>
        </div>

        {/* Panel del Modo Seleccionado */}
        <div className="mt-4">
          {inputMode === 'excel' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-app-border hover:border-blue-500/50 bg-app-bg/60 rounded-2xl p-6 transition-all group">
              <UploadCloud size={36} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
              <h4 className="text-xs font-black uppercase tracking-wider text-app-text mb-1">
                Arrastra tu archivo Excel o haz clic para seleccionarlo
              </h4>
              <p className="text-[10px] text-app-muted mb-3 text-center max-w-md">
                Debe contener las columnas: <span className="font-mono text-blue-400 font-bold">RUC_EMISOR, TIPO, SERIE, NUMERO</span>.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                id="file-excel-upload"
              />
              <label
                htmlFor="file-excel-upload"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
              >
                Seleccionar Archivo Excel
              </label>
              {fileNameLoaded && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                  <Check size={14} /> Archivo cargado: {fileNameLoaded} ({stagedList.length} registros)
                </div>
              )}
            </div>
          )}

          {inputMode === 'texto' && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-app-muted">
                Pega tus datos (Copia columnas de Excel y pégalas aquí):
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="20609936224	01	E001	826	2026-07-31	1224.00&#10;20100070970	01	F001	10452	2026-08-05	350.00"
                className="w-full h-32 p-3 bg-app-bg border border-app-border rounded-xl text-xs font-mono text-app-text outline-none focus:border-blue-500 resize-none custom-scrollbar"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleParseText}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer"
                >
                  Procesar Texto Pegado
                </button>
              </div>
            </div>
          )}

          {inputMode === 'sire' && (
            <div className="p-4 bg-app-bg/60 rounded-xl border border-app-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-blue-500" />
                <span className="text-xs font-bold text-app-text">
                  Se importaron automáticamente {stagedList.length} comprobantes desde el módulo de Compras locales.
                </span>
              </div>
              <button
                onClick={handleCargarDesdeSire}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-app-surface hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer"
              >
                Recargar Compras
              </button>
            </div>
          )}
        </div>

        {/* Barra de Control de Ejecución (cuando hay elementos en cola) */}
        {stagedList.length > 0 && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-app-muted uppercase">Comprobantes listos</span>
                <span className="text-base font-black font-mono text-app-text">{stagedList.length} comprobantes</span>
              </div>
              <div className="h-7 w-px bg-app-border" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-app-muted">Concurrencia:</span>
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="bg-app-surface border border-app-border text-xs font-bold text-app-text rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  <option value={2}>2 hilos (Estándar)</option>
                  <option value={4}>4 hilos (Rápido)</option>
                  <option value={6}>6 hilos (Ultra rápido)</option>
                  <option value={8}>8 hilos (Máxima potencia)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStagedList([])}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                Limpiar Cola
              </button>
              <button
                onClick={handleEjecutarConsultaMasiva}
                disabled={processing}
                className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{processing ? 'Consultando en SUNAT...' : 'Iniciar Consulta Masiva'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Barra de Progreso en Vivo */}
        {processing && (
          <div className="mt-4 p-3 bg-app-bg rounded-xl border border-app-border flex flex-col gap-1.5 animate-pulse">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-app-text">
              <span>{currentStatusText || 'Consultando comprobantes en SUNAT...'}</span>
              <span>Procesando...</span>
            </div>
            <div className="w-full bg-app-surface h-2 rounded-full overflow-hidden border border-app-border">
              <div
                className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `100%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══ TARJETAS DE MÉTRICAS DE RESULTADOS ═══ */}
      {lastStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Total Consultados</span>
            <span className="text-xl font-black font-mono text-app-text mt-1">{lastStats.total}</span>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Aceptados (Válidos)</span>
            <span className="text-xl font-black font-mono text-emerald-500 mt-1">{lastStats.aceptados}</span>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Anulados</span>
            <span className="text-xl font-black font-mono text-rose-500 mt-1">{lastStats.anulados}</span>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">No Encontrados</span>
            <span className="text-xl font-black font-mono text-amber-500 mt-1">{lastStats.noEncontrados}</span>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">Total IGV (S/)</span>
            <span className="text-sm font-black font-mono text-purple-400 mt-1">S/ {formatPEN(lastStats.montoTotalIgv)}</span>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Monto Total (S/)</span>
            <span className="text-sm font-black font-mono text-indigo-400 mt-1">S/ {formatPEN(lastStats.montoTotalGeneral)}</span>
          </div>
        </div>
      )}

      {/* ═══ TABLA DE RESULTADOS INTERACTIVA ═══ */}
      {batchResults.length > 0 && (
        <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
          
          {/* Cabecera y Filtros de la Tabla */}
          <div className="p-4 border-b border-app-border bg-app-bg/50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-app-bg border border-app-border rounded-xl p-0.5">
                {(['ALL', 'ACEPTADO', 'ANULADO', 'NO_EXISTE', 'ERROR'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      filterStatus === st
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-app-muted hover:text-app-text'
                    }`}
                  >
                    {st === 'ALL' ? 'Todos' : st === 'NO_EXISTE' ? 'No Existe' : st}
                  </button>
                ))}
              </div>

              {/* Input de Búsqueda */}
              <div className="flex items-center gap-1.5 px-3 py-1 bg-app-bg border border-app-border rounded-xl focus-within:border-blue-500">
                <Search size={13} className="text-app-muted" />
                <input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar RUC, serie o razón social..."
                  className="bg-transparent text-xs text-app-text outline-none w-48 border-none focus:ring-0"
                />
              </div>
            </div>

            {/* Acciones Masivas */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleIncorporarACompras}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer"
                title="Incorporar todos los comprobantes aceptados al registro de compras"
              >
                <ArrowDownToLine size={13} />
                <span>Incorporar a Compras</span>
              </button>

              <button
                onClick={handleExportarExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
              >
                <FileSpreadsheet size={13} />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Tabla de Registros */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-app-border bg-app-bg/80 text-[10px] font-black uppercase tracking-wider text-app-muted">
                  <th className="py-2.5 px-4 w-10">#</th>
                  <th className="py-2.5 px-4">Estado SUNAT</th>
                  <th className="py-2.5 px-4">Emisor (Proveedor)</th>
                  <th className="py-2.5 px-4">Comprobante</th>
                  <th className="py-2.5 px-4">Fecha Emisión</th>
                  <th className="py-2.5 px-4 text-right">Monto Gravado</th>
                  <th className="py-2.5 px-4 text-right">IGV</th>
                  <th className="py-2.5 px-4 text-right">Monto Total</th>
                  <th className="py-2.5 px-4 text-center">XML</th>
                  <th className="py-2.5 px-4 text-center">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40 text-xs">
                {filteredResults.map((r, idx) => {
                  const orig: any = r.itemOriginal || {};
                  const res: any = r.resultado || {};
                  const isExpanded = !!expandedRows[`row-${idx}`];
                  const hasItems = res.items && res.items.length > 0;

                  return (
                    <React.Fragment key={`res-row-${idx}`}>
                      <tr className="hover:bg-app-hover/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-app-muted">{idx + 1}</td>
                        
                        {/* Estado */}
                        <td className="py-2.5 px-4">
                          {r.estado === 'ACEPTADO' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle2 size={12} /> ACEPTADO
                            </span>
                          ) : r.estado === 'ANULADO' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <XCircle size={12} /> ANULADO
                            </span>
                          ) : r.estado === 'NO_EXISTE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <AlertTriangle size={12} /> NO EXISTE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20">
                              <AlertCircle size={12} /> {r.error || 'ERROR'}
                            </span>
                          )}
                        </td>

                        {/* Emisor */}
                        <td className="py-2.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-app-text">{res.rucEmisor || orig.rucEmisor}</span>
                            <span className="text-[11px] text-app-muted truncate max-w-xs">{res.razonSocialEmisor || orig.razonSocial || '—'}</span>
                          </div>
                        </td>

                        {/* Comprobante */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono text-[10px] font-bold border border-blue-500/20">
                              {res.tipoCpe || orig.tipoCpe}
                            </span>
                            <span className="font-mono font-black text-app-text">
                              {res.serie || orig.serie}-{res.numero || orig.numero}
                            </span>
                          </div>
                        </td>

                        {/* Fecha */}
                        <td className="py-2.5 px-4 font-mono text-app-text">
                          {res.fechaEmision || orig.fechaEmision || '—'}
                        </td>

                        {/* Gravado */}
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-app-text">
                          S/ {formatPEN(res.montoGravado || 0)}
                        </td>

                        {/* IGV */}
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-purple-400">
                          S/ {formatPEN(res.montoIgv || 0)}
                        </td>

                        {/* Total */}
                        <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-400">
                          S/ {formatPEN(res.montoTotal || orig.monto || 0)}
                        </td>

                        {/* Descarga XML Directa */}
                        <td className="py-2.5 px-4 text-center">
                          {r.estado === 'ACEPTADO' ? (
                            <button
                              onClick={() => handleDescargarXmlDirecto(res.rucEmisor ? res : orig)}
                              className="px-2 py-1 rounded-md text-[10px] font-black bg-blue-500/10 text-blue-500 hover:bg-blue-600 hover:text-white border border-blue-500/20 transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1"
                              title="Descargar XML oficial de SUNAT"
                            >
                              <FileCode size={12} />
                              <span>XML</span>
                            </button>
                          ) : (
                            <span className="text-app-muted text-[10px]">—</span>
                          )}
                        </td>

                        {/* Items Toggle */}
                        <td className="py-2.5 px-4 text-center">
                          {hasItems ? (
                            <button
                              onClick={() => toggleRowExpand(`row-${idx}`)}
                              className="p-1 rounded-lg hover:bg-app-hover text-blue-500 cursor-pointer transition-all"
                              title="Ver detalle de items"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          ) : (
                            <span className="text-app-muted text-[10px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Fila Desplegable de Items */}
                      {isExpanded && hasItems && (
                        <tr className="bg-blue-500/5">
                          <td colSpan={9} className="p-3">
                            <div className="bg-app-bg border border-app-border rounded-xl p-3 flex flex-col gap-2">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-blue-400">
                                Detalle de Items / Conceptos del Comprobante:
                              </h5>
                              <div className="divide-y divide-app-border text-xs">
                                {res.items.map((it: any, iIdx: number) => (
                                  <div key={iIdx} className="py-1.5 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-app-muted">{it.cantidad} {it.unidadMedida}</span>
                                      <span className="text-app-text font-medium">{it.descripcion}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-app-muted text-[11px]">Unit: S/ {formatPEN(it.valorUnitario)}</span>
                                      <span className="font-mono font-bold text-app-text">Total: S/ {formatPEN(it.montoTotal)}</span>
                                    </div>
                                  </div>
                                ))}
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
          </div>
        </div>
      )}

      {/* ═══ MODAL DE HISTORIAL DE LOTES ANTERIORES ═══ */}
      {showHistorialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="card-elevated bg-app-surface border border-app-border rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div className="flex items-center gap-2">
                <History size={18} className="text-indigo-500" />
                <h4 className="text-sm font-black uppercase text-app-text">
                  Historial de Consultas Masivas Realizadas
                </h4>
              </div>
              <button
                onClick={() => setShowHistorialModal(false)}
                className="p-1 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar my-4 space-y-2.5">
              {loadingHistorial ? (
                <div className="py-8 flex justify-center items-center text-app-muted gap-2">
                  <Loader2 size={16} className="animate-spin" /> Cargando historial...
                </div>
              ) : historialLotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-app-muted italic">
                  No hay lotes consultados previamente en este workspace.
                </div>
              ) : (
                historialLotes.map(lote => (
                  <div
                    key={lote.id}
                    className="p-3 rounded-xl bg-app-bg border border-app-border flex items-center justify-between flex-wrap gap-2 hover:border-blue-500/40 transition-all"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-app-text">
                        Lote {lote.origen_consulta || 'MANUAL'} • {new Date(lote.created_at).toLocaleString('es-PE')}
                      </span>
                      <span className="text-[11px] text-app-muted">
                        Total: {lote.total_registros} • Aceptados: {lote.total_aceptados} • Anulados: {lote.total_anulados} • S/ {formatPEN(lote.monto_total_general)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {lote.estado || 'COMPLETADO'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-app-border">
              <button
                onClick={() => setShowHistorialModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-app-bg hover:bg-app-hover border border-app-border text-app-text cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
