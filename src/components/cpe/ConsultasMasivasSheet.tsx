import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { webApiBridge } from '../../services/apiBridge';
import { useStore } from '../../store';
import { formatPEN } from '../ConsultasView';
import CpeVoucherModal from './CpeVoucherModal';
import ModernSelect from '../ui/ModernSelect';
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
  FileCode,
  X,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Zap,
  Clock
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
  const [inputMode, setInputMode] = useState<'excel' | 'sire'>('excel');
  const [stagedList, setStagedList] = useState<CpeRowInput[]>([]);
  const [fileNameLoaded, setFileNameLoaded] = useState<string>('');

  // Modo de velocidad / latencia
  const [speedMode, setSpeedMode] = useState<'safe' | 'fast' | 'ultra_stable'>('safe');

  // Estados de SIRE por Año y Mes
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

  const [selectedSireYear, setSelectedSireYear] = useState<string>(availableYears[0] || '2026');
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

  // Comprobantes del año
  const sireYearPurchases = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter((p: any) => p.fecha?.startsWith(`${selectedSireYear}-`));
  }, [purchases, selectedSireYear]);

  // Estados de procesamiento
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatusText, setCurrentStatusText] = useState('');

  // Estados de resultados
  const [batchResults, setBatchResults] = useState<CpeProcessedResult[]>([]);
  const [lastStats, setLastStats] = useState<any | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Filtros de resultados
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACEPTADO' | 'ANULADO' | 'NO_EXISTE' | 'ERROR'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  // Visor modal de Voucher / PDF
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Arrastre horizontal con el mouse (Mouse Drag-to-Scroll estilo móvil / táctil)
  const isDraggingMouse = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
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
    const walk = (x - dragStartX.current) * 1.5;
    tableContainerRef.current.scrollLeft = dragStartScrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingMouse.current = false;
    setIsDragging(false);
  };

  // Lista de comprobantes con error para reintento manual
  const errorResults = useMemo(() => {
    return batchResults.filter(r => r.estado === 'ERROR' || (!r.encontrado && !r.success) || (r.error && r.error.length > 0));
  }, [batchResults]);

  // ═══ DESCARGA DE PLANTILLA EXCEL ═══
  const descargarPlantilla = () => {
    const dataEjemplo = [
      {
        'RUC_EMISOR': '20609936224',
        'RAZON_SOCIAL': 'EL HUERTO DE MI AMADA SAC',
        'TIPO_COMPROBANTE': '01',
        'SERIE': 'E001',
        'NUMERO': '826',
        'FECHA_EMISION': '2026-07-31',
        'MONEDA': 'PEN',
        'MONTO_TOTAL': '1224.00'
      },
      {
        'RUC_EMISOR': '20609396033',
        'RAZON_SOCIAL': 'MILLAN MACHINERY PARTS SAC',
        'TIPO_COMPROBANTE': '01',
        'SERIE': 'F001',
        'NUMERO': '84',
        'FECHA_EMISION': '2026-08-12',
        'MONEDA': 'PEN',
        'MONTO_TOTAL': '3693.11'
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
          const ruc = String(row['RUC_EMISOR'] || row['RUC'] || row['ruc'] || row['numRuc'] || row['doc_num'] || '').trim();
          const razon = String(row['RAZON_SOCIAL'] || row['RAZON'] || row['nombre'] || row['PROVEEDOR'] || '').trim();
          const tipo = String(row['TIPO_COMPROBANTE'] || row['TIPO'] || row['tipo'] || row['tipo_doc'] || '01').trim().padStart(2, '0');
          const serie = String(row['SERIE'] || row['Serie'] || row['serie'] || '').trim().toUpperCase();
          const numero = String(row['NUMERO'] || row['Numero'] || row['numero'] || row['correlativo'] || '').trim();
          const fecha = String(row['FECHA_EMISION'] || row['FECHA'] || row['fecha'] || '').trim();
          const monto = row['MONTO_TOTAL'] || row['TOTAL'] || row['total'] || '';

          return {
            id: `staged-${idx}-${Date.now()}`,
            rucEmisor: ruc,
            razonSocial: razon,
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

  // ═══ CARGAR COMPROBANTES DE UN MES ESPECÍFICO DE SIRE ═══
  const handleSeleccionarMesSire = (mesKey: string) => {
    setSelectedSireMonth(mesKey);
    const mPurchases = sireYearPurchases.filter((p: any) => p.fecha?.startsWith(`${selectedSireYear}-${mesKey}`));
    
    if (mPurchases.length === 0) {
      toast.error('No hay compras registradas en este mes.');
      setStagedList([]);
      return;
    }

    const parsed: CpeRowInput[] = mPurchases.map((p: any, idx: number) => ({
      id: `sire-${p.id || idx}-${Date.now()}`,
      rucEmisor: String(p.doc_num || '').trim(),
      razonSocial: p.nombre || '',
      tipoCpe: String(p.tipo_doc || '01').trim().padStart(2, '0'),
      serie: String(p.serie || '').trim().toUpperCase(),
      numero: String(p.numero || '').trim(),
      fechaEmision: p.fecha || '',
      monto: p.total || 0
    })).filter((item: CpeRowInput) => item.rucEmisor && item.serie && item.numero);

    setStagedList(parsed);
    const mesObj = MESES_INFO.find(m => m.key === mesKey);
    toast.success(`Se cargaron ${parsed.length} comprobantes de ${mesObj?.nombre} ${selectedSireYear} listos para consultar.`);
  };

  // ═══ EJECUCIÓN DE CONSULTA MASIVA CON API INVERSA DIRECTA ═══
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

    const speedConfig = {
      safe: { concurrencia: 2, delayMs: 180 },
      fast: { concurrencia: 3, delayMs: 80 },
      ultra_stable: { concurrencia: 1, delayMs: 300 }
    }[speedMode];

    setProcessing(true);
    setProgress(15);
    setCurrentStatusText(`Consultando ${stagedList.length} comprobantes en SUNAT API (${speedMode === 'safe' ? 'Modo Seguro' : speedMode === 'fast' ? 'Modo Rápido' : 'Modo Ultra Estable'})...`);

    try {
      const res = await webApiBridge.cpeDirectConsultarMasivo({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        listaComprobantes: stagedList,
        origen_consulta: inputMode.toUpperCase(),
        concurrencia: speedConfig.concurrencia,
        delayMs: speedConfig.delayMs
      });

      if (!res.success) {
        throw new Error(res.error || 'Fallo en la consulta masiva');
      }

      setProgress(100);
      setLastStats(res.stats);
      setBatchResults(res.resultados || []);

      const aceptados = res.stats?.aceptados || 0;
      const total = res.stats?.total || 0;
      const errores = res.stats?.errores || 0;

      if (errores > 0) {
        toast(`Consulta finalizada: ${aceptados} de ${total} aceptados (${errores} con error transitorio). Puedes usar "Refrescar Errores".`, { icon: '⚠️', duration: 5000 });
      } else {
        toast.success(`¡Consulta masiva completada! ${aceptados} de ${total} comprobantes aceptados.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error en consulta masiva: ' + (err.response?.data?.error || err.message));
    } finally {
      setProcessing(false);
      setProgress(0);
      setCurrentStatusText('');
    }
  };

  // ═══ BOTÓN GENERAL: REINTENTAR / REFRESCAR SOLO LOS COMPROBANTES CON ERROR ═══
  const handleReintentarErrores = async () => {
    if (errorResults.length === 0) {
      toast.success('No hay comprobantes con error para reintentar.');
      return;
    }

    setProcessing(true);
    setProgress(20);
    setCurrentStatusText(`Reintentando ${errorResults.length} comprobante(s) con error en SUNAT (Modo Ultra Seguro)...`);

    try {
      const itemsToRetry = errorResults.map(r => r.itemOriginal);
      const res = await webApiBridge.cpeDirectConsultarMasivo({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        listaComprobantes: itemsToRetry,
        origen_consulta: 'REINTENTO_ERRORES',
        concurrencia: 1,
        delayMs: 250
      });

      if (res.success && Array.isArray(res.resultados)) {
        setBatchResults(prev => {
          const copy = [...prev];
          res.resultados.forEach((newItem: any) => {
            const idx = copy.findIndex(c => 
              c.itemOriginal.serie === newItem.itemOriginal.serie && 
              String(c.itemOriginal.numero) === String(newItem.itemOriginal.numero) && 
              c.itemOriginal.rucEmisor === newItem.itemOriginal.rucEmisor
            );
            if (idx !== -1) {
              copy[idx] = { ...newItem, index: idx };
            }
          });
          return copy;
        });

        // Recalcular estadísticas
        const total = batchResults.length;
        const aceptados = batchResults.filter(r => r.estado === 'ACEPTADO' || (r.success && r.encontrado)).length;
        const anulados = batchResults.filter(r => r.estado === 'ANULADO').length;
        const noEncontrados = batchResults.filter(r => r.estado === 'NO_EXISTE').length;
        const errores = total - aceptados - anulados - noEncontrados;

        setLastStats((prev: any) => ({
          ...(prev || {}),
          aceptados,
          anulados,
          noEncontrados,
          errores
        }));

        toast.success(`Se reintentaron los ${errorResults.length} comprobantes con éxito.`);
      } else {
        toast.error(res.error || 'No se pudieron recuperar los comprobantes fallidos.');
      }
    } catch (err: any) {
      toast.error('Error al reintentar fallidos: ' + err.message);
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

  // ═══ DESCARGA DIRECTA DE XML OFICIAL SUNAT VÍA API INVERSA ═══
  const handleDescargarXmlDirecto = async (item: any) => {
    const rucEmisor = item.rucEmisor || item.doc_num || item.ruc;
    const tipoCpe = item.tipoCpe || item.tipo || item.tipo_doc || item.tipoDoc || '01';
    const serie = item.serie;
    const correlativo = item.numero || item.correlativo || item.numCpe;

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
        toast.error(res.error || 'No se pudo obtener el XML desde SUNAT.', { id: 'down-xml' });
      }
    } catch (err: any) {
      toast.error('Error al descargar XML: ' + err.message, { id: 'down-xml' });
    }
  };

  // ═══ DESCARGA MASIVA DE TODOS LOS XMLS EN UN ARCHIVO ZIP ═══
  const handleDescargarXmlMasivo = async () => {
    const validComps = batchResults
      .filter(r => (r.resultado?.estado === 'ACEPTADO' || r.estado === 'ACEPTADO' || r.success) && (r.resultado?.rucEmisor || r.itemOriginal?.rucEmisor || (r.itemOriginal as any)?.doc_num))
      .map(r => r.resultado || r.itemOriginal);

    if (validComps.length === 0) {
      toast.error('No hay comprobantes aceptados para descargar XML.');
      return;
    }

    try {
      toast.loading(`Generando archivo ZIP con ${validComps.length} XMLs oficiales...`, { id: 'zip-xml' });
      const blob = await webApiBridge.cpeDirectDescargarXmlMasivoZip({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        listaComprobantes: validComps
      });

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `COMPROBANTES_XML_${activeCompany.ruc}_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`¡ZIP con ${validComps.length} XMLs descargado exitosamente!`, { id: 'zip-xml' });
    } catch (err: any) {
      toast.error('Error al descargar ZIP de XMLs: ' + err.message, { id: 'zip-xml' });
    }
  };

  // ═══ DESCARGA MASIVA DE TODOS LOS PDFS EN UN ARCHIVO ZIP ═══
  const handleDescargarPdfMasivo = async () => {
    const validComps = batchResults
      .filter(r => (r.resultado?.estado === 'ACEPTADO' || r.estado === 'ACEPTADO' || r.success) && (r.resultado?.rucEmisor || r.itemOriginal?.rucEmisor || (r.itemOriginal as any)?.doc_num))
      .map(r => r.resultado || r.itemOriginal);

    if (validComps.length === 0) {
      toast.error('No hay comprobantes aceptados para descargar PDF.');
      return;
    }

    try {
      toast.loading(`Generando archivo ZIP con ${validComps.length} PDFs oficiales...`, { id: 'zip-pdf' });
      const blob = await webApiBridge.cpeDirectDescargarPdfMasivoZip({
        ruc: activeCompany.ruc,
        usuario_sol: activeCompany.sol_user,
        clave_sol: activeCompany.sol_pass,
        listaComprobantes: validComps
      });

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `COMPROBANTES_PDF_${activeCompany.ruc}_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`¡ZIP con ${validComps.length} PDFs descargado exitosamente!`, { id: 'zip-pdf' });
    } catch (err: any) {
      toast.error('Error al descargar ZIP de PDFs: ' + err.message, { id: 'zip-pdf' });
    }
  };

  // ═══ EXPORTAR A EXCEL ═══
  const handleExportarExcel = () => {
    if (batchResults.length === 0) {
      toast.error('No hay resultados para exportar.');
      return;
    }

    const dataToExport = batchResults.map((r, idx) => {
      const orig: any = r.itemOriginal || {};
      const res: any = r.resultado || {};
      const hasItems = res.items && res.items.length > 0;
      const itemsText = hasItems
        ? res.items.map((it: any) => `${it.cantidad}x ${it.descripcion} (S/ ${formatPEN(it.montoTotal)})`).join(' | ')
        : '';

      return {
        'N°': idx + 1,
        'ESTADO SUNAT': res.estado || r.estado || 'ACEPTADO',
        'RUC EMISOR': res.rucEmisor || orig.rucEmisor,
        'RAZON SOCIAL': res.razonSocialEmisor || orig.razonSocial || '',
        'TIPO DOC': res.tipoCpe || orig.tipoCpe || '01',
        'SERIE': res.serie || orig.serie,
        'NUMERO': res.numero || orig.numero,
        'FECHA EMISION': res.fechaEmision || orig.fechaEmision || '',
        'MONEDA': res.moneda || 'PEN',
        'MONTO GRAVADO': res.montoGravado || 0,
        'IGV (S/)': res.montoIgv || 0,
        'TOTAL (S/)': res.montoTotal || orig.monto || 0,
        'ITEMS DETALLE': itemsText,
        'OBSERVACION': r.error || r.mensaje || 'OK'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consultas CPE');
    XLSX.writeFile(wb, `Reporte_Consultas_CPE_SUNAT_${Date.now()}.xlsx`);
    toast.success('Reporte Excel generado y descargado.');
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtrado
  const filteredResults = useMemo(() => {
    return batchResults.filter(r => {
      const orig: any = r.itemOriginal || {};
      const res: any = r.resultado || {};
      const currentStatus = res.estado || r.estado;

      if (filterStatus !== 'ALL') {
        if (filterStatus === 'ACEPTADO' && currentStatus !== 'ACEPTADO') return false;
        if (filterStatus === 'ANULADO' && currentStatus !== 'ANULADO') return false;
        if (filterStatus === 'NO_EXISTE' && currentStatus !== 'NO_EXISTE') return false;
        if (filterStatus === 'ERROR' && currentStatus !== 'ERROR') return false;
      }

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const ruc = (res.rucEmisor || orig.rucEmisor || '').toLowerCase();
        const razon = (res.razonSocialEmisor || orig.razonSocial || '').toLowerCase();
        const serie = (res.serie || orig.serie || '').toLowerCase();
        const numero = String(res.numero || orig.numero || '').toLowerCase();

        return ruc.includes(q) || razon.includes(q) || serie.includes(q) || numero.includes(q);
      }

      return true;
    });
  }, [batchResults, filterStatus, searchFilter]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full animate-fade-in">
      
      {/* ═══ PANEL DE ENTRADA Y FUENTES DE DATOS ═══ */}
      <div className="card-elevated bg-app-surface border border-app-border rounded-2xl p-4 sm:p-5 shadow-sm">
        
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-app-text flex items-center gap-2 flex-wrap">
                <span>CONSULTAS MASIVAS DE CPE</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black tracking-widest uppercase font-mono">
                  HTTP DIRECTO • MICROSERVICIOS SUNAT
                </span>
              </h2>
              <p className="text-[11px] text-app-muted">
                Valida decenas de comprobantes directamente contra los microservicios de SUNAT SOL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={descargarPlantilla}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-app-bg hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer shadow-2xs active:scale-98"
            >
              <Download size={13} className="text-blue-500" />
              <span>Plantilla Excel</span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE 2 SUB-PESTAÑAS: EXCEL Y COMPRAS SIRE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => setInputMode('excel')}
            className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              inputMode === 'excel'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-app-bg text-app-muted hover:text-app-text border-app-border hover:border-blue-500/30'
            }`}
          >
            <FileSpreadsheet size={15} />
            <span>1. CARGAR ARCHIVO EXCEL / CSV</span>
          </button>

          <button
            onClick={() => setInputMode('sire')}
            className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              inputMode === 'sire'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-app-bg text-app-muted hover:text-app-text border-app-border hover:border-blue-500/30'
            }`}
          >
            <Layers size={15} />
            <span>2. DESDE COMPRAS SIRE</span>
          </button>
        </div>

        {/* ═══ CONTENIDO SUB-PESTAÑA 1: CARGA DE ARCHIVO EXCEL ═══ */}
        {inputMode === 'excel' && (
          <div className="mt-4 flex flex-col gap-3 animate-fade-in">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-app-border hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-app-bg/50 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2 group shadow-2xs"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
                <UploadCloud size={28} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-app-text">
                  {fileNameLoaded ? `Archivo cargado: ${fileNameLoaded}` : 'Arrastra tu archivo Excel o haz clic para seleccionarlo'}
                </p>
                <p className="text-[10px] text-app-muted mt-0.5">
                  Debe contener las columnas: RUC_EMISOR, TIPO, SERIE, NUMERO.
                </p>
              </div>
              <button
                type="button"
                className="mt-1 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider shadow-xs transition-all pointer-events-none"
              >
                Seleccionar Archivo Excel
              </button>
            </div>
          </div>
        )}

        {/* ═══ CONTENIDO SUB-PESTAÑA 2: DESDE COMPRAS SIRE (CON SELECTORES MODERNOS) ═══ */}
        {inputMode === 'sire' && (
          <div className="mt-4 flex flex-col gap-3.5 bg-app-bg/60 border border-app-border p-4 rounded-2xl animate-fade-in shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-app-border/80">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-app-text">
                  IMPORTACIÓN DESDE COMPRAS REGISTRADAS (SIRE)
                </span>
              </div>

              {/* Controles de selección con ModernSelect (Requerimiento 2 e Imagen 2 y 3) */}
              <div className="flex items-center gap-3 flex-wrap">
                
                {/* Selector de Ejercicio con ModernSelect */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-app-muted tracking-wider">Ejercicio:</span>
                  <ModernSelect
                    value={selectedSireYear}
                    options={availableYears.map(y => ({
                      value: y,
                      label: y
                    }))}
                    onChange={(val) => {
                      setSelectedSireYear(String(val));
                      setSelectedSireMonth(null);
                      setStagedList([]);
                    }}
                    icon={<Calendar size={13} />}
                    size="sm"
                    variant="compact"
                  />
                </div>

                {/* Selector de Mes con ModernSelect (badges y conteo) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-app-muted tracking-wider">Mes:</span>
                  <ModernSelect
                    value={selectedSireMonth || ''}
                    options={MESES_INFO.map(m => {
                      const count = sireYearPurchases.filter((p: any) => p.fecha?.startsWith(`${selectedSireYear}-${m.key}`)).length;
                      return {
                        value: m.key,
                        label: `${m.nombre}`,
                        count: count,
                        badge: 'compras',
                        disabled: false
                      };
                    })}
                    emptyLabel="-- Seleccionar Mes --"
                    onChange={(val) => {
                      if (val) {
                        handleSeleccionarMesSire(String(val));
                      } else {
                        setSelectedSireMonth(null);
                        setStagedList([]);
                      }
                    }}
                    size="sm"
                    variant="compact"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const allParsed: CpeRowInput[] = sireYearPurchases.map((p: any, idx: number) => ({
                      id: `sire-all-${p.id || idx}-${Date.now()}`,
                      rucEmisor: String(p.doc_num || '').trim(),
                      razonSocial: p.nombre || '',
                      tipoCpe: String(p.tipo_doc || '01').trim().padStart(2, '0'),
                      serie: String(p.serie || '').trim().toUpperCase(),
                      numero: String(p.numero || '').trim(),
                      fechaEmision: p.fecha || '',
                      monto: p.total || 0
                    })).filter((item: CpeRowInput) => item.rucEmisor && item.serie && item.numero);

                    setStagedList(allParsed);
                    toast.success(`Se cargaron todos los ${allParsed.length} comprobantes del ejercicio ${selectedSireYear}.`);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  Cargar Todo el Año ({sireYearPurchases.length})
                </button>
              </div>
            </div>

            <p className="text-[11px] text-app-muted">
              💡 Puedes seleccionar el mes en el selector desplegable de arriba para cargar automáticamente todos los comprobantes listos para consultar.
            </p>
          </div>
        )}

        {/* Resumen de Comprobantes Preparados para Consulta + Selector de Latencia */}
        {stagedList.length > 0 && (
          <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex flex-col gap-3 animate-fade-in shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-app-text block">
                    {stagedList.length} Comprobantes Listos para Consultar
                  </span>
                  <span className="text-[11px] text-app-muted">
                    Origen: {inputMode === 'excel' ? `Excel (${fileNameLoaded || 'cargado'})` : `SIRE Compras (${selectedSireMonth ? MESES_INFO.find(m => m.key === selectedSireMonth)?.nombre : 'Ejercicio'} ${selectedSireYear})`}
                  </span>
                </div>
              </div>

              {/* Selector de Modo de Latencia / Velocidad */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[10px] font-black uppercase text-app-muted tracking-wider">Latencia:</span>
                <div className="flex bg-app-bg border border-app-border rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSpeedMode('safe')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                      speedMode === 'safe'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-app-muted hover:text-app-text'
                    }`}
                    title="2 concurrentes con 180ms delay y auto-reintento. Máxima estabilidad."
                  >
                    <ShieldCheck size={12} />
                    <span>🛡️ Seguro (Recomendado)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeedMode('fast')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                      speedMode === 'fast'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-app-muted hover:text-app-text'
                    }`}
                    title="3 concurrentes con 80ms delay. Para lotes pequeños."
                  >
                    <Zap size={12} />
                    <span>⚡ Rápido</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeedMode('ultra_stable')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                      speedMode === 'ultra_stable'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-app-muted hover:text-app-text'
                    }`}
                    title="1 concurrente con 300ms delay. Ideal para lotes masivos de >100 comprobantes."
                  >
                    <Clock size={12} />
                    <span>🐢 Ultra Estable</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-500/10">
              <button
                onClick={() => setStagedList([])}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer shadow-2xs active:scale-98"
              >
                Descartar
              </button>

              <button
                onClick={handleEjecutarConsultaMasiva}
                disabled={processing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                <span>{processing ? 'Consultando en SUNAT...' : `Consultar ${stagedList.length} Comprobantes en SUNAT`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Barra de Progreso en Vivo */}
        {processing && (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-blue-600/10 to-emerald-600/10 rounded-2xl border border-blue-500/30 flex flex-col gap-2 animate-pulse shadow-sm">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-app-text">
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                {currentStatusText || 'Consultando comprobantes en SUNAT...'}
              </span>
              <span className="font-mono text-emerald-500 font-bold">Procesando...</span>
            </div>
            <div className="w-full bg-app-surface h-2 rounded-full overflow-hidden border border-app-border">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══ TARJETAS DE MÉTRICAS DE RESULTADOS ═══ */}
      {lastStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-blue-500">Total Consultados</span>
            <span className="text-lg font-black font-mono text-app-text mt-0.5">{lastStats.total}</span>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Aceptados (Válidos)</span>
            <span className="text-lg font-black font-mono text-emerald-500 mt-0.5">{lastStats.aceptados}</span>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-rose-500">Anulados</span>
            <span className="text-lg font-black font-mono text-rose-500 mt-0.5">{lastStats.anulados}</span>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-500">No Encontrados</span>
            <span className="text-lg font-black font-mono text-amber-500 mt-0.5">{lastStats.noEncontrados}</span>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-purple-400">Errores / Obs</span>
            <span className="text-lg font-black font-mono text-purple-400 mt-0.5">{lastStats.errores}</span>
          </div>

          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Monto Total (S/)</span>
            <span className="text-xs font-black font-mono text-indigo-400 mt-0.5">S/ {formatPEN(lastStats.montoTotalGeneral)}</span>
          </div>
        </div>
      )}

      {/* ═══ TABLA DE RESULTADOS MASIVOS ═══ */}
      {batchResults.length > 0 && (
        <div className="card-elevated bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
          
          {/* Cabecera y Filtros de la Tabla */}
          <div className="p-3.5 border-b border-app-border bg-app-bg/50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-app-bg border border-app-border rounded-xl p-0.5 shadow-2xs">
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
              <div className="flex items-center gap-1.5 px-3 py-1 bg-app-bg border border-app-border rounded-xl focus-within:border-blue-500 shadow-2xs">
                <Search size={13} className="text-app-muted" />
                <input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar RUC, serie o razón social..."
                  className="bg-transparent text-xs text-app-text outline-none w-44 sm:w-56 border-none focus:ring-0"
                />
              </div>
            </div>

            {/* Acciones Masivas y Botón de Reintento de Errores */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Botón Reintentar Errores si existen fallidos */}
              {errorResults.length > 0 && (
                <button
                  onClick={handleReintentarErrores}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white shadow-md transition-all cursor-pointer animate-pulse disabled:opacity-50 active:scale-98"
                  title="Reintentar comprobantes que tuvieron error de procesamiento en SUNAT"
                >
                  <RotateCcw size={13} className={processing ? 'animate-spin' : ''} />
                  <span>Refrescar / Reintentar Errores ({errorResults.length})</span>
                </button>
              )}

              <button
                onClick={handleIncorporarACompras}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer active:scale-98"
                title="Incorporar todos los comprobantes aceptados al registro de compras"
              >
                <ArrowDownToLine size={13} />
                <span>Incorporar a Compras</span>
              </button>

              <button
                onClick={handleDescargarPdfMasivo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all cursor-pointer active:scale-98"
                title="Descargar todos los PDFs oficiales en un archivo ZIP"
              >
                <FileText size={13} />
                <span>PDF Masivo</span>
              </button>

              <button
                onClick={handleDescargarXmlMasivo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all cursor-pointer active:scale-98"
                title="Descargar todos los XMLs oficiales en un archivo ZIP"
              >
                <FileCode size={13} />
                <span>XML Masivo</span>
              </button>

              <button
                onClick={handleExportarExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer active:scale-98"
              >
                <FileSpreadsheet size={13} />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Tabla de Registros Estilo Excel con Arrastre Táctil / Mouse Drag */}
          <div
            ref={tableContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className={`overflow-x-auto select-none custom-scrollbar ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="border-b border-app-border bg-app-bg/80 text-[10px] font-black uppercase tracking-wider text-app-muted sticky top-0 z-10 shadow-2xs">
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
                {filteredResults.map((r, idx) => {
                  const orig: any = r.itemOriginal || {};
                  const res: any = r.resultado || {};
                  const rowId = `row-${idx}`;
                  const isExpanded = !!expandedRows[rowId];
                  const hasItems = res.items && res.items.length > 0;
                  const itemsPreview = hasItems
                    ? res.items.map((it: any) => `${it.cantidad}x ${it.descripcion}`).join(', ')
                    : '—';

                  const isError = r.estado === 'ERROR' || (!r.encontrado && !r.success);
                  const isAceptado = r.estado === 'ACEPTADO' || (r.success && r.encontrado);
                  const isAnulado = r.estado === 'ANULADO';

                  return (
                    <React.Fragment key={`res-row-${idx}`}>
                      <tr className="hover:bg-app-hover/50 transition-colors">
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
                          ) : r.estado === 'NO_EXISTE' ? (
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
                          {res.rucEmisor || orig.rucEmisor}
                        </td>

                        {/* RAZON SOCIAL */}
                        <td className="py-2 px-3">
                          <span className="text-[11px] font-semibold text-app-text truncate max-w-[200px] block" title={res.razonSocialEmisor || orig.razonSocial}>
                            {res.razonSocialEmisor || orig.razonSocial || '—'}
                          </span>
                        </td>

                        {/* TIPO DOC */}
                        <td className="py-2 px-2 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono text-[10px] font-bold border border-blue-500/20">
                            {res.tipoCpe || orig.tipoCpe || '01'}
                          </span>
                        </td>

                        {/* SERIE */}
                        <td className="py-2 px-3 font-mono font-bold text-app-text text-center">
                          {res.serie || orig.serie}
                        </td>

                        {/* NUMERO */}
                        <td className="py-2 px-3 font-mono font-bold text-app-text text-center">
                          {res.numero || orig.numero}
                        </td>

                        {/* FECHA EMISION */}
                        <td className="py-2 px-3 font-mono text-app-text">
                          {res.fechaEmision || orig.fechaEmision || '—'}
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
                          {formatPEN(res.montoTotal || orig.monto || 0)}
                        </td>

                        {/* ITEMS DETALLE */}
                        <td 
                          onClick={() => hasItems && toggleRowExpand(rowId)}
                          className={`py-2 px-3 transition-colors ${hasItems ? 'cursor-pointer hover:bg-blue-500/10 select-none' : ''}`}
                          title={hasItems ? 'Clic para desplegar / contraer el detalle de items' : ''}
                        >
                          <div className="flex items-center gap-1.5 max-w-xs">
                            <span className="text-[11px] text-app-text truncate">
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
                            title={r.error || r.mensaje || 'OK'}
                          >
                            {r.error || r.mensaje || 'OK'}
                          </span>
                        </td>

                        {/* ACCIONES (PDF + XML) */}
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isAceptado && (
                              <button
                                onClick={() => setSelectedDocForPreview(res.rucEmisor ? res : orig)}
                                className="px-2 py-1 rounded-md text-[10px] font-black bg-purple-500/10 text-purple-400 hover:bg-purple-600 hover:text-white border border-purple-500/20 transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1"
                                title="Ver Representación Impresa (PDF / Voucher)"
                              >
                                <FileText size={12} />
                                <span>PDF</span>
                              </button>
                            )}
                            {isAceptado ? (
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
                          </div>
                        </td>
                      </tr>

                      {/* Fila Desplegable de Items */}
                      {isExpanded && hasItems && (
                        <tr className="bg-blue-500/5">
                          <td colSpan={15} className="p-3">
                            <div className="sticky left-4 max-w-3xl bg-app-surface border border-app-border rounded-xl p-3 shadow-md">
                              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-app-border">
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                                  <Layers size={13} />
                                  <span>Detalle de Items / Conceptos ({res.serie || orig.serie}-{res.numero || orig.numero}) • {res.items.length} item(s)</span>
                                </h5>
                                <span className="text-[10px] font-bold text-app-muted">
                                  Emisor: {res.razonSocialEmisor || orig.razonSocial || res.rucEmisor}
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
          </div>

        </div>
      )}

      {/* ═══ MODAL VISOR DE VOUCHER / PDF OFICIAL DE SUNAT ═══ */}
      {selectedDocForPreview && (
        <CpeVoucherModal
          doc={selectedDocForPreview}
          onClose={() => setSelectedDocForPreview(null)}
        />
      )}

    </div>
  );
}
