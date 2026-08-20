import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { parseCpeXml, base64ToUtf8, descargarXmlSeguro, generarCdrXmlOficial, type CpeParsedData } from '../../utils/cpeXmlParser';
import { webApiBridge } from '../../services/apiBridge';
import { useStore } from '../../store';
import {
  X,
  Printer,
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CpeVoucherModalProps {
  doc: {
    id?: string;
    rucEmisor?: string;
    tipoDoc?: string;
    tipoCpe?: string;
    serie?: string;
    numero?: string | number;
    estado?: string;
    mensaje?: string;
    razonSocial?: string;
    razonSocialEmisor?: string;
    direccionEmisor?: string;
    ubigeoEmisor?: string;
    docReceptorNum?: string;
    docReceptorTipo?: string;
    razonSocialReceptor?: string;
    direccionReceptor?: string;
    fechaEmision?: string;
    fechaRegistro?: string;
    moneda?: string;
    montoGravado?: number;
    montoExonerado?: number;
    montoInafecto?: number;
    montoIgv?: number;
    montoIsc?: number;
    montoIcbper?: number;
    montoOtrosTributos?: number;
    montoTotal?: number;
    total?: number | string;
    importeTotal?: string | number;
    desMontoLetras?: string;
    observacion?: string;
    items?: Array<{
      id?: number;
      cantidad?: number;
      unidadMedida?: string;
      codigo?: string;
      descripcion?: string;
      desItem?: string;
      valorUnitario?: number;
      montoTotal?: number;
    }>;
    xmlContent?: string;
    xmlBase64?: string;
    xmlFileName?: string;
    xmlPath?: string;
    cdrContent?: string;
    cdrBase64?: string;
    cdrFileName?: string;
    cdrPath?: string;
    capturaBase64?: string;
  };
  onClose: () => void;
}

// Formateador oficial de moneda nacional para Perú (PEN S/)
const formatPEN = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUnitPrice = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.0000';
  const num = typeof val === 'number' ? val : parseFloat(String(val)) || 0;
  return num.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

export default function CpeVoucherModal({ doc, onClose }: CpeVoucherModalProps) {
  const [activeTab, setActiveTab] = useState<'comprobante' | 'cdr'>('comprobante');
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const currentCompany = useStore((state) => state.currentCompany);
  const activeCompany = currentCompany;

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Gestos táctiles en móvil para deslizar y cerrar
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY !== null) {
      const touchEndY = e.changedTouches[0].clientY;
      if (touchEndY - touchStartY > 90) {
        onClose();
      }
      setTouchStartY(null);
    }
  };

  // Manejo de Impresión aislada
  const handleImprimir = () => {
    window.print();
  };

  // Parsear XML si viene adjunto
  const { parsedData, xmlString, cdrXmlString } = useMemo(() => {
    let p: CpeParsedData | null = null;
    let xmlStr: string | null = null;
    let cdrStr: string | null = null;

    if (doc.xmlContent) {
      xmlStr = doc.xmlContent;
      p = parseCpeXml(doc.xmlContent);
    } else if (doc.xmlBase64) {
      try {
        const decoded = base64ToUtf8(doc.xmlBase64);
        xmlStr = decoded;
        p = parseCpeXml(decoded);
      } catch (e) {
        console.warn('Error al decodificar base64 de XML:', e);
      }
    }

    if (doc.cdrContent) {
      cdrStr = doc.cdrContent;
    } else if (doc.cdrBase64) {
      try {
        cdrStr = base64ToUtf8(doc.cdrBase64);
      } catch (e) {
        console.warn('Error al decodificar base64 de CDR:', e);
      }
    }

    return { parsedData: p, xmlString: xmlStr, cdrXmlString: cdrStr };
  }, [doc]);

  // Construir displayData consolidado
  const displayData = useMemo(() => {
    if (parsedData) return parsedData;

    // Normalizar items
    const rawItems = doc.items && Array.isArray(doc.items) ? doc.items : [];
    const mappedItems = rawItems.length > 0 
      ? rawItems.map((it: any, idx: number) => {
          const cantidad = Number(it.cantidad || it.cntItems || 1);
          const valUnit = Number(it.valorUnitario || it.mtoValUnitario || 0);
          const totalItem = Number(it.montoTotal || it.mtoImpTotal || (cantidad * valUnit));
          return {
            id: idx + 1,
            cantidad: cantidad,
            unidadMedida: it.unidadMedida || it.desUnidadMedida || it.codUnidadMedida || 'NIU',
            descripcionUnidad: it.descripcionUnidad || it.desUnidadMedida || 'UNIDAD',
            codigo: it.codigo || it.desCodigo || '-',
            descripcion: it.descripcion || it.desItem || 'PRODUCTO / SERVICIO GENERAL',
            valorUnitario: valUnit > 0 ? valUnit : (totalItem / (cantidad || 1)),
            montoTotal: totalItem
          };
        })
      : [
          {
            id: 1,
            cantidad: 1,
            unidadMedida: 'NIU',
            descripcionUnidad: 'UNIDAD',
            codigo: '-',
            descripcion: doc.observacion && doc.observacion !== 'OK' && doc.observacion !== 'CONTADO' ? doc.observacion : 'CONSUMO / SERVICIO SEGÚN COMPROBANTE',
            valorUnitario: Number(doc.montoGravado || doc.montoTotal || doc.total || 0),
            montoTotal: Number(doc.montoTotal || doc.total || 0)
          }
        ];

    const gravadoNum = Number(doc.montoGravado || 0);
    const exoneradoNum = Number(doc.montoExonerado || 0);
    const inafectoNum = Number(doc.montoInafecto || 0);
    const igvNum = Number(doc.montoIgv || 0);
    const iscNum = Number(doc.montoIsc || 0);
    const icbperNum = Number(doc.montoIcbper || 0);
    const otrosNum = Number(doc.montoOtrosTributos || 0);
    const totalNum = Number(doc.montoTotal || doc.total || doc.importeTotal || (gravadoNum + igvNum));

    const tipoDocCode = doc.tipoDoc || doc.tipoCpe || (doc.serie?.toUpperCase().startsWith('B') ? '03' : '01');
    const tipoDocDesc = tipoDocCode === '03' 
      ? 'BOLETA DE VENTA ELECTRÓNICA' 
      : tipoDocCode === '07'
      ? 'NOTA DE CRÉDITO ELECTRÓNICA'
      : tipoDocCode === '08'
      ? 'NOTA DE DÉBITO ELECTRÓNICA'
      : 'FACTURA ELECTRÓNICA';

    return {
      tipoDoc: tipoDocCode,
      tipoDocDescripcion: tipoDocDesc,
      serie: (doc.serie || 'E001').toUpperCase(),
      numero: String(doc.numero || '1'),
      comprobanteCompleto: `${doc.serie || 'E001'}-${doc.numero || '1'}`,
      fechaEmision: doc.fechaEmision || new Date().toISOString().split('T')[0],
      fechaVencimiento: doc.fechaEmision || new Date().toISOString().split('T')[0],
      moneda: doc.moneda || 'PEN',
      monedaSimbolo: doc.moneda === 'USD' ? '$' : 'S/',
      formaPago: 'Contado',
      observacion: doc.observacion || 'CONTADO',
      cuotas: [],
      emisor: {
        ruc: doc.rucEmisor || '',
        razonSocial: doc.razonSocial || doc.razonSocialEmisor || 'EMPRESA EMISORA',
        nombreComercial: doc.razonSocial || doc.razonSocialEmisor || '',
        direccion: doc.direccionEmisor || 'LIMA - PERÚ'
      },
      receptor: {
        tipoDoc: doc.docReceptorTipo || '6',
        numDoc: doc.docReceptorNum || '',
        razonSocial: doc.razonSocialReceptor || '',
        direccion: doc.direccionReceptor || ''
      },
      items: mappedItems,
      totales: {
        subTotalVentas: gravadoNum,
        anticipos: 0,
        descuentos: 0,
        valorVenta: gravadoNum,
        gravado: gravadoNum,
        exonerado: exoneradoNum,
        inafecto: inafectoNum,
        gratuito: 0,
        exportacion: 0,
        isc: iscNum,
        igv: igvNum,
        icbper: icbperNum,
        otrosCargos: otrosNum,
        otrosTributos: 0,
        redondeo: 0,
        total: totalNum,
        montoEnLetras: doc.desMontoLetras || `SON: ${totalNum.toFixed(2)} ${doc.moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES'}`
      },
      seguridad: {
        hash: 'SUNAT-HTTP-DIRECT-VALIDATED',
        firma: ''
      },
      cdr: {
        codigoRespuesta: '0',
        descripcionRespuesta: `El comprobante ${doc.serie}-${doc.numero} ha sido ${doc.estado || 'ACEPTADO'} por SUNAT`,
        fechaRecepcion: doc.fechaEmision,
        aceptado: doc.estado === 'ACEPTADO' || doc.estado === 'AUTORIZADO'
      }
    } as unknown as CpeParsedData;
  }, [parsedData, doc]);

  // Manejo de Descarga de XML
  const handleDescargarXml = async () => {
    const fn = doc.xmlFileName || `${displayData.emisor.ruc}-${displayData.tipoDoc}-${displayData.serie}-${displayData.numero}.xml`;
    if (xmlString) {
      descargarXmlSeguro(xmlString, fn);
      toast.success('XML descargado exitosamente.');
      return;
    }
    if (doc.xmlBase64) {
      const decoded = base64ToUtf8(doc.xmlBase64);
      descargarXmlSeguro(decoded, fn);
      toast.success('XML descargado exitosamente.');
      return;
    }

    try {
      toast.loading(`Descargando XML de ${displayData.serie}-${displayData.numero}...`, { id: 'modal-xml' });
      const res = await webApiBridge.cpeDirectDescargarXml({
        ruc: (activeCompany?.ruc || doc.docReceptorNum || '') as string,
        usuario_sol: activeCompany?.sol_user,
        clave_sol: activeCompany?.sol_pass,
        rucEmisor: displayData.emisor.ruc,
        tipoCpe: displayData.tipoDoc,
        serie: displayData.serie,
        correlativo: displayData.numero,
        procedencia: displayData.serie.startsWith('E') ? '1' : '2'
      });

      if (res.success && (res.xmlContent || res.zipBase64)) {
        if (res.xmlContent) {
          descargarXmlSeguro(res.xmlContent, res.xmlFileName || fn);
        } else if (res.zipBase64) {
          const byteCharacters = atob(res.zipBase64);
          const byteArray = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: 'application/zip' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = res.nomArchivo || fn.replace('.xml', '.zip');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        }
        toast.success('XML descargado exitosamente.', { id: 'modal-xml' });
      } else {
        toast.error(res.error || 'XML no disponible para este comprobante en SUNAT', { id: 'modal-xml' });
      }
    } catch (e: any) {
      toast.error('Error al descargar XML: ' + e.message, { id: 'modal-xml' });
    }
  };

  // Manejo de Descarga de CDR
  const handleDescargarCdr = () => {
    const fn = doc.cdrFileName || `R-${displayData.emisor.ruc}-${displayData.tipoDoc}-${displayData.serie}-${displayData.numero}.xml`;
    if (cdrXmlString) {
      descargarXmlSeguro(cdrXmlString, fn);
      toast.success('Constancia CDR descargada.');
    } else if (doc.cdrBase64) {
      const decoded = base64ToUtf8(doc.cdrBase64);
      descargarXmlSeguro(decoded, fn);
      toast.success('Constancia CDR descargada.');
    } else {
      const generatedCdr = generarCdrXmlOficial(displayData);
      descargarXmlSeguro(generatedCdr, fn);
      toast.success('Constancia CDR generada y descargada.');
    }
  };

  const modalContent = (
    <>
      {/* ═══ Estilos de Impresión Exclusivos para el Comprobante ═══ */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          body * {
            visibility: hidden !important;
          }
          #cpe-print-document, #cpe-print-document * {
            visibility: visible !important;
          }
          #cpe-print-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: 2px solid black !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Backdrop con Cierre al Clic Exterior */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 overflow-y-auto animate-fade-in print:p-0 print:bg-transparent"
      >
        <div className="bg-app-surface border border-app-border rounded-3xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden relative my-auto print:border-none print:shadow-none print:max-h-none print:bg-transparent animate-scale-in">
          
          {/* Manija táctil para móvil */}
          <div className="w-12 h-1.5 rounded-full bg-neutral-500/40 mx-auto mt-2.5 sm:hidden" />

          {/* ═══ Header del Modal (Oculto en Impresión) ═══ */}
          <div className="px-6 py-4 border-b border-app-border bg-app-bg flex items-center justify-between gap-3 flex-wrap print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-2xs">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-app-text uppercase tracking-wider">
                    {displayData.tipoDocDescripcion} {displayData.serie}-{displayData.numero}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {doc.estado || 'ACEPTADO'}
                  </span>
                </div>
                <span className="text-[11px] text-app-muted font-medium block truncate max-w-md mt-0.5">
                  {displayData.emisor.razonSocial} • RUC: {displayData.emisor.ruc}
                </span>
              </div>
            </div>

            {/* Botones de Acción Superiores */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleImprimir}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-app-surface hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer shadow-2xs"
                title="Imprimir únicamente la factura oficial"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Imprimir</span>
              </button>

              <button
                onClick={handleDescargarXml}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
                title="Descargar archivo XML oficial"
              >
                <Download size={14} />
                <span>XML</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-app-bg hover:bg-app-hover border border-app-border text-app-muted hover:text-app-text transition-all cursor-pointer"
                title="Cerrar modal (Esc o Clic fuera)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ═══ Selector de Pestañas con Altura y Espaciado Amplio ═══ */}
          <div className="flex border-b border-app-border bg-app-bg/80 px-6 py-3.5 gap-3 overflow-x-auto print:hidden">
            <button
              onClick={() => setActiveTab('comprobante')}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                activeTab === 'comprobante'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-app-surface text-app-muted hover:text-app-text hover:bg-app-hover border border-app-border'
              }`}
            >
              <FileText size={15} />
              <span>Representación Impresa (PDF)</span>
            </button>

            <button
              onClick={() => setActiveTab('cdr')}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                activeTab === 'cdr'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-app-surface text-app-muted hover:text-app-text hover:bg-app-hover border border-app-border'
              }`}
            >
              <ShieldCheck size={15} />
              <span>Constancia CDR (SUNAT)</span>
            </button>
          </div>

          {/* ═══ Cuerpo del Modal: Estructura Oficial SUNAT ═══ */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 bg-neutral-900/40 custom-scrollbar flex items-start justify-center print:p-0 print:bg-transparent">
            
            {/* PESTAÑA 1: REPRESENTACIÓN IMPRESA EXACTA SUNAT (IMPRIMIBLE) */}
            {activeTab === 'comprobante' && (
              <div
                id="cpe-print-document"
                ref={printRef}
                className="bg-white text-black rounded-xs shadow-md p-5 sm:p-7 w-full max-w-[760px] mx-auto border-2 border-black font-sans text-xs flex flex-col gap-3.5 box-border"
              >
                {/* 1. Encabezado: Datos Emisor + Cuadro Oficial RUC */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border-b border-black pb-3">
                  {/* Lado Izquierdo: Emisor */}
                  <div className="md:col-span-7 flex flex-col gap-0.5">
                    <h1 className="text-sm sm:text-base font-black text-black tracking-tight uppercase leading-snug">
                      {displayData.emisor.razonSocial}
                    </h1>
                    {displayData.emisor.nombreComercial && displayData.emisor.nombreComercial !== displayData.emisor.razonSocial && (
                      <span className="text-[11px] font-bold text-neutral-800 uppercase">
                        {displayData.emisor.nombreComercial}
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-800 leading-tight mt-0.5">
                      {displayData.emisor.direccion || 'LIMA - PERÚ'}
                    </span>
                  </div>

                  {/* Lado Derecho: Cuadro Oficial R.U.C. (Borde Negro Fuerte) */}
                  <div className="md:col-span-5 border-2 border-black rounded-xs p-2.5 flex flex-col items-center justify-center text-center bg-white">
                    <span className="text-xs font-black tracking-wider uppercase">
                      {displayData.tipoDocDescripcion}
                    </span>
                    <span className="text-xs font-black tracking-wider uppercase my-0.5">
                      RUC: {displayData.emisor.ruc}
                    </span>
                    <span className="text-sm font-black font-mono tracking-wider">
                      {displayData.serie} - {displayData.numero}
                    </span>
                  </div>
                </div>

                {/* 2. Datos del Cliente y Condiciones */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-x-2 gap-y-1 text-[11px] border-b border-black pb-2.5">
                  <div className="sm:col-span-8 flex flex-col gap-0.5">
                    <div className="flex">
                      <span className="w-36 font-normal text-neutral-900">Fecha de Emisión</span>
                      <span className="font-medium">: {displayData.fechaEmision}</span>
                    </div>
                    <div className="flex">
                      <span className="w-36 font-normal text-neutral-900">Señor(es)</span>
                      <span className="font-bold">: {displayData.receptor.razonSocial}</span>
                    </div>
                    <div className="flex">
                      <span className="w-36 font-normal text-neutral-900">RUC</span>
                      <span className="font-mono font-medium">: {displayData.receptor.numDoc}</span>
                    </div>
                    {displayData.receptor.direccion && (
                      <div className="flex">
                        <span className="w-36 font-normal text-neutral-900 shrink-0">Dirección del Cliente</span>
                        <span className="font-normal text-neutral-800">: {displayData.receptor.direccion}</span>
                      </div>
                    )}
                    <div className="flex">
                      <span className="w-36 font-normal text-neutral-900">Tipo de Moneda</span>
                      <span className="font-medium">: {displayData.moneda === 'USD' ? 'DÓLAR AMERICANO (USD)' : 'SOL (PEN)'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-36 font-normal text-neutral-900">Observación</span>
                      <span className="font-medium">: {displayData.observacion || 'CONTADO'}</span>
                    </div>
                  </div>

                  <div className="sm:col-span-4 flex flex-col gap-0.5">
                    <div className="flex justify-between sm:justify-start gap-1">
                      <span className="font-normal text-neutral-900">Forma de pago :</span>
                      <span className="font-medium">{displayData.formaPago}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Tabla de Items con Formato Peruano de Moneda */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-black text-[10px]">
                    <thead>
                      <tr className="border-b border-black font-black uppercase text-center bg-white">
                        <th className="border-r border-black p-1.5 w-14">Cantidad</th>
                        <th className="border-r border-black p-1.5 w-20">Unidad Medida</th>
                        <th className="border-r border-black p-1.5 w-16">Código</th>
                        <th className="border-r border-black p-1.5 text-center">Descripción</th>
                        <th className="border-r border-black p-1.5 w-24 text-right">Valor Unitario</th>
                        <th className="p-1.5 w-16 text-right">ICBPER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-black/30">
                          <td className="border-r border-black p-1.5 text-center font-mono">{item.cantidad}</td>
                          <td className="border-r border-black p-1.5 text-center">{item.unidadMedida}</td>
                          <td className="border-r border-black p-1.5 text-center font-mono">{item.codigo || '-'}</td>
                          <td className="border-r border-black p-1.5 font-medium">{item.descripcion}</td>
                          <td className="border-r border-black p-1.5 text-right font-mono">{formatUnitPrice(item.valorUnitario)}</td>
                          <td className="p-1.5 text-right font-mono">{formatPEN(item.icbper)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Resumen de Totales e Impuestos */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border-t border-black pt-2">
                  {/* Lado Izquierdo: Operaciones Gratuitas + Son Letras */}
                  <div className="md:col-span-6 flex flex-col justify-between h-full gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-900">Valor de Venta de Operaciones Gratuitas :</span>
                      <span className="border border-black px-2 py-0.5 text-[10px] font-mono font-bold">
                        {displayData.monedaSimbolo} {formatPEN(displayData.totales.gratuito)}
                      </span>
                    </div>

                    <div className="text-[11px] font-black uppercase text-black">
                      {displayData.totales.montoEnLetras}
                    </div>
                  </div>

                  {/* Lado Derecho: Cuadro Estructurado de Totales SUNAT */}
                  <div className="md:col-span-6 border-l md:border-black md:pl-2">
                    <div className="flex flex-col text-[10px] gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Sub Total Ventas :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.subTotalVentas)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Anticipos :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.anticipos)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Descuentos :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.descuentos)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Valor Venta :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.valorVenta)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">ISC :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.isc)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">IGV :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.igv)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">ICBPER :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.icbper)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Otros Cargos :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.otrosCargos)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Otros Tributos :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.otrosTributos)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="w-40 text-right pr-2">Monto de Redondeo :</span>
                        <span className="border border-black px-2 py-0.5 w-28 text-right font-mono font-bold">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.redondeo)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center font-bold">
                        <span className="w-40 text-right pr-2 font-black">Importe Total :</span>
                        <span className="border-2 border-black px-2 py-0.5 w-28 text-right font-mono font-black text-xs">
                          {displayData.monedaSimbolo} {formatPEN(displayData.totales.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Pie de Página Legal Oficial SUNAT */}
                <div className="border border-black p-1 text-[9px] text-neutral-800 italic mt-1 text-center sm:text-left">
                  Esta es una representación impresa de la factura electrónica, generada en el Sistema de SUNAT. Puede verificarla utilizando su clave SOL.
                </div>
              </div>
            )}

            {/* PESTAÑA 2: CONSTANCIA DE RECEPCIÓN CDR */}
            {activeTab === 'cdr' && (
              <div className="bg-white text-black rounded-xs shadow-md p-6 sm:p-8 max-w-[650px] w-full border-2 border-black flex flex-col gap-4 text-xs mx-auto">
                <div className="flex items-center gap-3 border-b border-black pb-3">
                  <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-black">
                      Constancia de Recepción Electrónica (CDR SUNAT)
                    </h3>
                    <span className="text-[11px] text-neutral-600">
                      Respuesta Oficial del Servicio de Recepción de Comprobantes de Pago
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 bg-neutral-50 rounded border border-neutral-300 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-neutral-500 block">Comprobante</span>
                    <span className="font-mono font-bold text-sm">{displayData.serie}-{displayData.numero}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-neutral-500 block">Estado Oficial</span>
                    <span className="inline-flex items-center gap-1 font-black text-emerald-600 uppercase">
                      <CheckCircle2 size={12} /> {displayData.cdr?.aceptado ? 'ACEPTADO' : 'OBSERVADO'} (Código {displayData.cdr?.codigoRespuesta || '0'})
                    </span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-[9px] font-black uppercase text-neutral-500 block">Mensaje de SUNAT</span>
                    <span className="font-bold text-neutral-800">{displayData.cdr?.descripcionRespuesta}</span>
                  </div>
                  {displayData.cdr?.fechaRecepcion && (
                    <div>
                      <span className="text-[9px] font-black uppercase text-neutral-500 block">Fecha Recepción</span>
                      <span className="font-mono">{displayData.cdr.fechaRecepcion}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-black uppercase text-neutral-500 block">RUC Emisor</span>
                    <span className="font-mono">{displayData.emisor.ruc}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleDescargarCdr}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Descargar Constancia CDR</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ═══ Footer del Modal ═══ */}
          <div className="px-6 py-4 border-t border-app-border bg-app-surface flex items-center justify-between print:hidden">
            <span className="text-[10px] font-bold text-app-muted">
              Documento estructurado bajo estándar UBL 2.1 SUNAT
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-app-bg hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
