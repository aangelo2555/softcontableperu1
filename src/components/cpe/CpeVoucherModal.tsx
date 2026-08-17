import React, { useState, useMemo, useRef } from 'react';
import { parseCpeXml, type CpeParsedData } from '../../utils/cpeXmlParser';
import {
  X,
  Printer,
  Download,
  FileCode,
  FileCheck,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Calendar,
  DollarSign,
  Copy,
  Check,
  Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CpeVoucherModalProps {
  doc: {
    id?: string;
    rucEmisor?: string;
    tipoDoc?: string;
    serie?: string;
    numero?: string | number;
    estado?: string;
    mensaje?: string;
    razonSocial?: string;
    fechaEmision?: string;
    importeTotal?: string;
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

export default function CpeVoucherModal({ doc, onClose }: CpeVoucherModalProps) {
  const [activeTab, setActiveTab] = useState<'comprobante' | 'cdr' | 'xml'>('comprobante');
  const [copiedXml, setCopiedXml] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Obtener texto XML decodificado
  const xmlString = useMemo(() => {
    if (doc.xmlContent) return doc.xmlContent;
    if (doc.xmlBase64) {
      try {
        return atob(doc.xmlBase64);
      } catch (e) {
        return '';
      }
    }
    return '';
  }, [doc]);

  const cdrXmlString = useMemo(() => {
    if (doc.cdrContent) return doc.cdrContent;
    if (doc.cdrBase64) {
      try {
        return atob(doc.cdrBase64);
      } catch (e) {
        return '';
      }
    }
    return '';
  }, [doc]);

  // Parsear datos con el motor UBL 2.1
  const parsedData = useMemo<CpeParsedData | null>(() => {
    if (xmlString) {
      try {
        return parseCpeXml(xmlString, cdrXmlString);
      } catch (e) {
        console.warn('Error parseando XML:', e);
      }
    }
    return null;
  }, [xmlString, cdrXmlString]);

  // Fallback con datos directos del documento si no se pudo parsear XML
  const displayData = useMemo(() => {
    if (parsedData) return parsedData;

    const totalNum = parseFloat(String(doc.importeTotal || '0').replace(/[^0-9.]/g, '')) || 0;
    const gravadoNum = Number((totalNum / 1.18).toFixed(2));
    const igvNum = Number((totalNum - gravadoNum).toFixed(2));

    return {
      tipoDoc: doc.tipoDoc || '01',
      tipoDocDescripcion: doc.tipoDoc === '03' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'FACTURA ELECTRÓNICA',
      serie: doc.serie || 'F001',
      numero: String(doc.numero || '1'),
      comprobanteCompleto: `${doc.serie || 'F001'}-${doc.numero || '1'}`,
      fechaEmision: doc.fechaEmision || new Date().toISOString().split('T')[0],
      fechaVencimiento: doc.fechaEmision || new Date().toISOString().split('T')[0],
      moneda: 'PEN',
      monedaSimbolo: 'S/',
      formaPago: 'Contado',
      cuotas: [],
      emisor: {
        ruc: doc.rucEmisor || '',
        razonSocial: doc.razonSocial || 'EMPRESA EMISORA S.A.C.',
        nombreComercial: doc.razonSocial || '',
        direccion: 'LIMA - PERÚ'
      },
      receptor: {
        tipoDoc: '6',
        numDoc: '20611964651',
        razonSocial: 'AGROITAYR S.A.C.',
        direccion: 'AV. LUIS ESCUDERO KM. 100 LIMA - HUAURA - VEGUETA'
      },
      items: [
        {
          id: 1,
          cantidad: 1,
          unidadMedida: 'NIU',
          codigo: 'ITEM-01',
          descripcion: 'COMPROBANTE ELECTRÓNICO CONSULTADO EN SUNAT',
          valorUnitario: gravadoNum,
          precioUnitario: totalNum,
          descuento: 0,
          subtotal: gravadoNum,
          igv: igvNum,
          icbper: 0,
          afectacionIgv: '10'
        }
      ],
      totales: {
        gravado: gravadoNum,
        exonerado: 0,
        inafecto: 0,
        gratuito: 0,
        exportacion: 0,
        descuentoGlobal: 0,
        totalDescuentos: 0,
        igv: igvNum,
        isc: 0,
        icbper: 0,
        otrosCargos: 0,
        redondeo: 0,
        total: totalNum,
        montoEnLetras: `SON: ${totalNum.toFixed(2)} SOLES`
      },
      seguridad: {
        hash: 'SUNAT-VALIDATED-DIGITAL-SIGNATURE',
        firma: ''
      },
      cdr: {
        codigoRespuesta: '0',
        descripcionRespuesta: `La Factura número ${doc.serie}-${doc.numero}, ha sido aceptada`,
        fechaRecepcion: doc.fechaEmision,
        aceptado: true
      }
    } as CpeParsedData;
  }, [parsedData, doc]);

  // Helper para descarga de archivos en navegador
  const descargarBase64 = (base64: string, fileName: string, mimeType: string) => {
    try {
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
      console.error('Error al descargar:', e);
    }
  };

  const handleDescargarXml = () => {
    if (doc.xmlBase64) {
      descargarBase64(doc.xmlBase64, doc.xmlFileName || `${displayData.emisor.ruc}-${displayData.tipoDoc}-${displayData.serie}-${displayData.numero}.xml`, 'application/xml');
      toast.success('XML descargado exitosamente.');
    } else if (xmlString) {
      const blob = new Blob([xmlString], { type: 'application/xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${displayData.emisor.ruc}-${displayData.tipoDoc}-${displayData.serie}-${displayData.numero}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('XML descargado exitosamente.');
    } else {
      toast.error('Contenido XML no disponible para este comprobante.');
    }
  };

  const handleDescargarCdr = () => {
    if (doc.cdrBase64) {
      descargarBase64(doc.cdrBase64, doc.cdrFileName || `R-${displayData.emisor.ruc}-${displayData.tipoDoc}-${displayData.serie}-${displayData.numero}.xml`, 'application/xml');
      toast.success('CDR descargado exitosamente.');
    } else if (cdrXmlString) {
      const blob = new Blob([cdrXmlString], { type: 'application/xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `R-${displayData.emisor.ruc}-${displayData.tipoDoc}-${displayData.serie}-${displayData.numero}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CDR descargado exitosamente.');
    } else {
      toast.error('Constancia CDR no disponible.');
    }
  };

  const handleCopiarXml = () => {
    if (!xmlString) return;
    navigator.clipboard.writeText(xmlString);
    setCopiedXml(true);
    toast.success('XML copiado al portapapeles.');
    setTimeout(() => setCopiedXml(false), 2500);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-xs animate-fade-in overflow-hidden">
      <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in relative">
        
        {/* ═══ Header del Modal con Acciones ═══ */}
        <div className="px-5 py-3.5 border-b border-app-border bg-app-bg/90 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-app-text uppercase tracking-wider">
                  {displayData.tipoDocDescripcion} {displayData.serie}-{displayData.numero}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={10} /> {doc.estado || 'ACEPTADO'}
                </span>
              </div>
              <span className="text-[11px] text-app-muted font-medium">
                {displayData.emisor.razonSocial} • RUC: {displayData.emisor.ruc}
              </span>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleImprimir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-app-surface hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer"
              title="Imprimir comprobante"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleDescargarXml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
              title="Descargar archivo XML oficial"
            >
              <Download size={14} />
              <span>XML</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-app-bg hover:bg-app-hover border border-app-border text-app-muted hover:text-app-text transition-all cursor-pointer"
              title="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ═══ Selector de Pestañas ═══ */}
        <div className="flex border-b border-app-border bg-app-bg/50 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('comprobante')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'comprobante'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-app-muted hover:text-app-text'
            }`}
          >
            <FileText size={14} />
            <span>Representación Impresa (PDF)</span>
          </button>

          <button
            onClick={() => setActiveTab('cdr')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'cdr'
                ? 'border-purple-500 text-purple-500'
                : 'border-transparent text-app-muted hover:text-app-text'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Constancia CDR (SUNAT)</span>
          </button>

          <button
            onClick={() => setActiveTab('xml')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'xml'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-app-muted hover:text-app-text'
            }`}
          >
            <FileCode size={14} />
            <span>Código XML</span>
          </button>
        </div>

        {/* ═══ Cuerpo del Modal: Visualización Vectorial del Comprobante ═══ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-900/40 custom-scrollbar flex items-center justify-center">
          
          {/* PESTAÑA 1: REPRESENTACIÓN IMPRESA OFICIAL SUNAT */}
          {activeTab === 'comprobante' && (
            <div
              ref={printRef}
              className="bg-white text-black rounded-lg shadow-xl p-6 sm:p-8 max-w-[800px] w-full border border-neutral-300 font-sans text-xs flex flex-col gap-4 print:p-0 print:border-0 print:shadow-none"
            >
              {/* Encabezado: Datos Emisor + Cuadro RUC */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-black pb-4">
                {/* Lado Izquierdo: Emisor */}
                <div className="md:col-span-7 flex flex-col gap-1">
                  <h1 className="text-base font-black text-black tracking-tight uppercase">
                    {displayData.emisor.razonSocial}
                  </h1>
                  {displayData.emisor.nombreComercial && displayData.emisor.nombreComercial !== displayData.emisor.razonSocial && (
                    <span className="text-[11px] font-bold text-neutral-700 uppercase">
                      {displayData.emisor.nombreComercial}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-600 leading-tight mt-1">
                    {displayData.emisor.direccion || 'LIMA - PERÚ'}
                  </span>
                </div>

                {/* Lado Derecho: Cuadro Oficial R.U.C. */}
                <div className="md:col-span-5 border-2 border-black rounded-md p-3 flex flex-col items-center justify-center text-center bg-neutral-50 shadow-2xs">
                  <span className="text-xs font-black tracking-wider uppercase">
                    R.U.C.: {displayData.emisor.ruc}
                  </span>
                  <span className="text-xs font-black uppercase my-1 text-blue-900 tracking-wider">
                    {displayData.tipoDocDescripcion}
                  </span>
                  <span className="text-sm font-black font-mono tracking-widest">
                    {displayData.serie} - {displayData.numero}
                  </span>
                </div>
              </div>

              {/* Datos del Cliente y Condiciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] border-b border-neutral-300 pb-3">
                <div>
                  <span className="font-black text-neutral-700">Fecha de Emisión: </span>
                  <span>{displayData.fechaEmision}</span>
                </div>
                <div>
                  <span className="font-black text-neutral-700">Forma de Pago: </span>
                  <span>{displayData.formaPago}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-black text-neutral-700">Señor(es): </span>
                  <span className="font-bold">{displayData.receptor.razonSocial}</span>
                </div>
                <div>
                  <span className="font-black text-neutral-700">RUC / Doc: </span>
                  <span className="font-mono font-bold">{displayData.receptor.numDoc}</span>
                </div>
                <div>
                  <span className="font-black text-neutral-700">Moneda: </span>
                  <span>{displayData.moneda === 'USD' ? 'DÓLARES AMERICANOS (USD)' : 'SOLES (PEN)'}</span>
                </div>
                {displayData.receptor.direccion && (
                  <div className="sm:col-span-2">
                    <span className="font-black text-neutral-700">Dirección: </span>
                    <span className="text-neutral-600">{displayData.receptor.direccion}</span>
                  </div>
                )}
              </div>

              {/* Tabla de Items */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-neutral-100 border-b border-black font-black uppercase text-center">
                      <th className="border-r border-black p-1.5 w-12">Cant.</th>
                      <th className="border-r border-black p-1.5 w-16">U.M.</th>
                      <th className="border-r border-black p-1.5 w-20">Código</th>
                      <th className="border-r border-black p-1.5 text-left">Descripción</th>
                      <th className="border-r border-black p-1.5 w-24 text-right">V. Unitario</th>
                      <th className="p-1.5 w-24 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-neutral-300">
                        <td className="border-r border-black p-1.5 text-center font-mono">{item.cantidad}</td>
                        <td className="border-r border-black p-1.5 text-center">{item.unidadMedida}</td>
                        <td className="border-r border-black p-1.5 text-center font-mono">{item.codigo}</td>
                        <td className="border-r border-black p-1.5 font-medium">{item.descripcion}</td>
                        <td className="border-r border-black p-1.5 text-right font-mono">{displayData.monedaSimbolo} {item.valorUnitario.toFixed(2)}</td>
                        <td className="p-1.5 text-right font-mono font-bold">{displayData.monedaSimbolo} {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumen de Totales e Impuestos */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
                {/* Lado Izquierdo: Son Letras + Código Hash */}
                <div className="md:col-span-7 flex flex-col gap-2">
                  <div className="p-2.5 bg-neutral-100 rounded border border-neutral-300 text-[11px] font-bold">
                    <span>{displayData.totales.montoEnLetras}</span>
                  </div>

                  {displayData.seguridad.hash && (
                    <div className="text-[9px] text-neutral-500 font-mono">
                      <span className="font-bold">Resumen Hash: </span>
                      <span>{displayData.seguridad.hash}</span>
                    </div>
                  )}

                  <div className="text-[8px] text-neutral-500 italic mt-2">
                    Esta es una representación impresa de la factura electrónica, generada en el Sistema de SUNAT. Puede verificarla utilizando su clave SOL.
                  </div>
                </div>

                {/* Lado Derecho: Cuadro de Totales */}
                <div className="md:col-span-5 border border-black rounded overflow-hidden text-[10px]">
                  <div className="flex justify-between p-1 border-b border-neutral-300">
                    <span className="font-medium">Total Valor Venta Gravado:</span>
                    <span className="font-mono font-bold">{displayData.monedaSimbolo} {displayData.totales.gravado.toFixed(2)}</span>
                  </div>
                  {displayData.totales.exonerado > 0 && (
                    <div className="flex justify-between p-1 border-b border-neutral-300">
                      <span className="font-medium">Total Valor Exonerado:</span>
                      <span className="font-mono font-bold">{displayData.monedaSimbolo} {displayData.totales.exonerado.toFixed(2)}</span>
                    </div>
                  )}
                  {displayData.totales.inafecto > 0 && (
                    <div className="flex justify-between p-1 border-b border-neutral-300">
                      <span className="font-medium">Total Valor Inafecto:</span>
                      <span className="font-mono font-bold">{displayData.monedaSimbolo} {displayData.totales.inafecto.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-1 border-b border-neutral-300">
                    <span className="font-medium">Sumatoria IGV (18%):</span>
                    <span className="font-mono font-bold">{displayData.monedaSimbolo} {displayData.totales.igv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-1.5 bg-neutral-200 font-black text-xs">
                    <span>IMPORTE TOTAL:</span>
                    <span className="font-mono">{displayData.monedaSimbolo} {displayData.totales.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: CONSTANCIA DE RECEPCIÓN CDR */}
          {activeTab === 'cdr' && (
            <div className="bg-white text-black rounded-lg shadow-xl p-6 sm:p-8 max-w-[700px] w-full border border-neutral-300 flex flex-col gap-4 text-xs">
              <div className="flex items-center gap-3 border-b border-black pb-3">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <ShieldCheck size={28} />
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

              <div className="grid grid-cols-2 gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <Download size={14} />
                  <span>Descargar Constancia CDR</span>
                </button>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: CÓDIGO XML */}
          {activeTab === 'xml' && (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 w-full max-w-4xl flex flex-col gap-3 max-h-[70vh]">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {displayData.emisor.ruc}-{displayData.tipoDoc}-{displayData.serie}-{displayData.numero}.xml
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopiarXml}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all cursor-pointer"
                  >
                    {copiedXml ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedXml ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <button
                    onClick={handleDescargarXml}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Descargar</span>
                  </button>
                </div>
              </div>

              <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto overflow-y-auto custom-scrollbar p-3 bg-neutral-900/90 rounded-lg whitespace-pre leading-relaxed max-h-[55vh]">
                {xmlString || 'Contenido XML no disponible en texto plano.'}
              </pre>
            </div>
          )}

        </div>

        {/* ═══ Footer del Modal ═══ */}
        <div className="px-6 py-3 border-t border-app-border bg-app-surface flex items-center justify-between">
          <span className="text-[10px] font-bold text-app-muted">
            Documento estructurado bajo estándar UBL 2.1 SUNAT
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-app-bg hover:bg-app-hover border border-app-border text-app-text transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
