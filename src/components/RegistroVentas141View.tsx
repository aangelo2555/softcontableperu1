import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Printer, 
  Search, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
  }
  
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
  }

  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * FORMATO 14.1: REGISTRO DE VENTAS E INGRESOS
 * ══════════════════════════════════════════════
 * Estructura oficial SUNAT para el Libro de Ventas.
 * 
 * Columnas según Resolución de Superintendencia N° 234-2006/SUNAT:
 * 
 * GRUPO 1 — Datos del Registro:
 *   1. N° Correlativo
 *   2. Fecha de Emisión
 *   3. Fecha de Vcto./Pago
 *
 * GRUPO 2 — Comprobante de Pago:
 *   4. Tipo (Tabla 10)
 *   5. Serie
 *   6. Número
 *
 * GRUPO 3 — Información del Cliente:
 *   7. Doc. Identidad Tipo (Tabla 2)
 *   8. Doc. Identidad Número
 *   9. Apellidos y Nombres / Razón Social
 *
 * GRUPO 4 — Valor Venta (Exportación):
 *  10. Valor Facturado Exportación
 *
 * GRUPO 5 — Base Imponible Operación Gravada:
 *  11. Cuenta Contable (Ingresos: 70xx)
 *  12. Base Imponible
 *
 * GRUPO 6 — Importe Total de la Operación:
 *  13. Exonerada
 *  14. Inafecta
 *
 * GRUPO 7 — Tributos:
 *  15. ISC
 *  16. IGV y/o IPM
 *  17. ICBPER
 *  18. Otros Tributos y Cargos
 *
 * GRUPO 8 — Importe Total:
 *  19. Cuenta Contable (Cargo: 12xx)
 *  20. Importe Total del Comprobante
 *
 * GRUPO 9 — Tipo de Cambio
 *
 * GRUPO 10 — Referencia Comprobante Original:
 *  21. Fecha
 *  22. Tipo
 *  23. Serie
 *  24. Número
 */

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const fmt = (n: number | string) => {
  const val = Number(n || 0);
  return val !== 0
    ? val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
};

const fmtAlways = (n: number | string) =>
  Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RegistroVentasView: React.FC = () => {
  const { sales, currentCompany } = useStore();
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth());
  const [periodoAnio, setPeriodoAnio] = useState(parseInt(currentCompany.period) || new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Filtrado por Periodo ───
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const d = parseLocalDate(s.fecha);
      if (!d) return false;
      const matchMonth = d.getMonth() === periodoMes;
      const matchYear = d.getFullYear() === periodoAnio;
      const matchSearch = searchTerm === '' ||
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.doc_num.includes(searchTerm) ||
        s.numero.includes(searchTerm) ||
        s.serie.includes(searchTerm);
      return matchMonth && matchYear && matchSearch;
    }).sort((a, b) => {
      // Ordenar por fecha, luego por registro
      const dateCompare = a.fecha.localeCompare(b.fecha);
      return dateCompare !== 0 ? dateCompare : a.registro.localeCompare(b.registro);
    });
  }, [sales, periodoMes, periodoAnio, searchTerm]);

  // ─── Totales ───
  const totals = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const bi = typeof s.bi === 'number' ? s.bi : (parseFloat(String(s.bi || 0)) || 0);
      const noGrav = typeof s.noGravada === 'number' ? s.noGravada : (parseFloat(String(s.noGravada || 0)) || 0);
      const isc = typeof s.isc === 'number' ? s.isc : (parseFloat(String(s.isc || 0)) || 0);
      const igv = typeof s.igv === 'number' ? s.igv : (parseFloat(String(s.igv || 0)) || 0);
      const icbper = typeof s.icbper === 'number' ? s.icbper : (parseFloat(String(s.icbper || 0)) || 0);
      const otros = typeof s.otros_tributos === 'number' ? s.otros_tributos : (parseFloat(String(s.otros_tributos || 0)) || 0);
      const total = typeof s.total === 'number' ? s.total : (parseFloat(String(s.total || 0)) || 0);
      return {
        exportacion: acc.exportacion + (s.tipOperCode === '02' ? bi : 0),
        bi: acc.bi + bi,
        exonerada: acc.exonerada + noGrav,
        inafecta: 0,
        isc: acc.isc + isc,
        igv: acc.igv + igv,
        icbper: acc.icbper + icbper,
        otros: acc.otros + otros,
        total: acc.total + total,
      };
    }, {
      exportacion: 0, bi: 0, exonerada: 0, inafecta: 0,
      isc: 0, igv: 0, icbper: 0, otros: 0, total: 0,
    });
  }, [filteredSales]);

  const handleExportExcel = () => {
    const rows = filteredSales.map(s => ({
      registro: s.registro,
      fecha: s.fecha,
      fecVcto: s.fecVcto || '',
      tipo_doc: s.tipo_doc,
      serie: s.serie,
      numero: s.numero,
      doc_tipo: s.doc_tipo,
      doc_num: s.doc_num,
      nombre: s.nombre.toUpperCase(),
      valExp: s.tipOperCode === '02' ? s.bi : 0,
      ctaIngreso: s.ctaIngreso || '70111',
      bi: s.bi,
      exonerada: s.noGravada || 0,
      inafecta: 0,
      isc: s.isc || 0,
      igv: s.igv,
      otros: s.otros_tributos || 0,
      ctaCargo: s.ctaCargo || '1212',
      total: s.total,
      tc: s.moneda === 'DOLARES' ? s.tc : ''
    }));

    exportSingleSheet({
      sheetName: 'Reg. Ventas',
      title: `REGISTRO DE VENTAS E INGRESOS - FORMATO 14.1 (PERIODO: ${MONTHS[periodoMes]} ${periodoAnio})`,
      columns: [
        { header: 'N° CORREL', key: 'registro', width: 14, alignment: 'center' },
        { header: 'FECHA EMISIÓN', key: 'fecha', width: 14, alignment: 'center' },
        { header: 'FECHA VCTO', key: 'fecVcto', width: 14, alignment: 'center' },
        { header: 'TIPO DOC', key: 'tipo_doc', width: 10, alignment: 'center' },
        { header: 'SERIE', key: 'serie', width: 10, alignment: 'center' },
        { header: 'NÚMERO', key: 'numero', width: 12, alignment: 'center' },
        { header: 'TIPO IDENT.', key: 'doc_tipo', width: 12, alignment: 'center' },
        { header: 'NÚMERO IDENT.', key: 'doc_num', width: 15, alignment: 'center' },
        { header: 'APELLIDOS Y NOMBRES / RAZÓN SOCIAL', key: 'nombre', width: 35 },
        { header: 'VALOR EXP.', key: 'valExp', width: 14, style: 'currency' },
        { header: 'CTA INGRESO', key: 'ctaIngreso', width: 12, alignment: 'center' },
        { header: 'BASE IMPONIBLE', key: 'bi', width: 16, style: 'currency' },
        { header: 'EXONERADA', key: 'exonerada', width: 14, style: 'currency' },
        { header: 'INAFECTA', key: 'inafecta', width: 14, style: 'currency' },
        { header: 'ISC', key: 'isc', width: 12, style: 'currency' },
        { header: 'IGV', key: 'igv', width: 14, style: 'currency' },
        { header: 'OTROS TRIBUTOS', key: 'otros', width: 14, style: 'currency' },
        { header: 'CTA CARGO', key: 'ctaCargo', width: 12, alignment: 'center' },
        { header: 'IMPORTE TOTAL', key: 'total', width: 16, style: 'currency' },
        { header: 'T.C.', key: 'tc', width: 10, alignment: 'center' }
      ],
      rows,
      totals: {
        registro: '', fecha: '', fecVcto: '', tipo_doc: '', serie: '', numero: '', doc_tipo: '', doc_num: '', nombre: 'TOTAL GENERAL',
        valExp: totals.exportacion,
        ctaIngreso: '',
        bi: totals.bi,
        exonerada: totals.exonerada,
        inafecta: 0,
        isc: totals.isc,
        igv: totals.igv,
        otros: totals.otros,
        ctaCargo: '',
        total: totals.total,
        tc: ''
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: `${periodoAnio}-${String(periodoMes + 1).padStart(2, '0')}`,
      }
    }, `Registro_Ventas_${periodoAnio}_${String(periodoMes + 1).padStart(2, '0')}`);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative print:bg-white print:p-0">
      <PageHeader
        icon={<BookOpen size={18} />}
        title="Registro de Ventas e Ingresos"
        badge={<span className="px-2 py-0.5 rounded-lg bg-pld-magenta/10 text-[9px] text-pld-magenta border border-pld-magenta/10 tracking-[0.2em] uppercase">Formato 14.1</span>}
        subtitle={`${MONTHS[periodoMes]} ${periodoAnio} • RUC: ${currentCompany.ruc}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mes Selector */}
            <div className="bg-app-bg border border-app-border rounded-lg flex items-center h-8 px-1">
               <button onClick={() => setPeriodoMes(prev => prev === 0 ? 11 : prev - 1)} className="p-1 hover:text-pld-magenta transition-colors"><ChevronLeft size={14} /></button>
               <select
                 value={periodoMes}
                 onChange={e => setPeriodoMes(parseInt(e.target.value))}
                 className="bg-transparent border-none text-[9px] font-black uppercase text-app-text focus:ring-0 cursor-pointer py-0 w-20 appearance-none text-center"
               >
                 {MONTHS.map((m, i) => <option key={m} value={i} className="bg-app-surface">{m}</option>)}
               </select>
               <button onClick={() => setPeriodoMes(prev => prev === 11 ? 0 : prev + 1)} className="p-1 hover:text-pld-magenta transition-colors"><ChevronRight size={14} /></button>
            </div>

            {/* Buscador Propio */}
            <div className="relative group">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-pld-magenta transition-colors" size={12} />
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-app-bg border border-app-border rounded-lg pl-7 pr-3 h-8 text-[10px] w-40 focus:ring-1 focus:ring-pld-magenta outline-none transition-all font-bold"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={handleExportExcel}
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-magenta transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Download size={14} /> Excel
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-magenta transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Printer size={14} /> Imprimir
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
        <div className="inline-block min-w-full border border-app-border shadow-2xl rounded-sm overflow-x-auto bg-app-surface custom-scrollbar">
          <table id="registro-ventas-table" className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface shadow-xl">

            {/* ──── THEAD: 3-row grouped headers ──── */}
            <thead className="sticky top-0 z-20">
              {/* ROW 1: Top-level groups */}
              <tr className="bg-app-surface text-app-text text-[7.5px] font-black uppercase">
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-10">N°<br />CORREL</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-16">FECHA<br />EMISIÓN</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-16">FECHA<br />VCTO.</th>
                <th colSpan={3} className="px-1.5 py-2 border border-app-border text-center">COMPROBANTE DE PAGO<br />O DOCUMENTO</th>
                <th colSpan={3} className="px-1.5 py-2 border border-app-border text-center bg-rose-600/5">INFORMACIÓN DEL<br />CLIENTE</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-20">VALOR<br />FACTURADO<br />EXPORTACIÓN</th>
                <th colSpan={2} className="px-1.5 py-2 border border-app-border text-center bg-indigo-600/5">BASE IMPONIBLE<br />OP. GRAVADA</th>
                <th colSpan={2} className="px-1.5 py-2 border border-app-border text-center">IMPORTE TOTAL<br />DE LA OPERACIÓN</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-14">ISC</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-16">IGV<br />Y/O IPM</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-14">OTROS<br />TRIBUTOS<br />Y CARGOS</th>
                <th colSpan={2} className="px-1.5 py-2 border border-app-border text-center bg-emerald-600/5">IMPORTE<br />TOTAL</th>
                <th rowSpan={3} className="px-1.5 py-2 border border-app-border text-center w-12">T.C.</th>
                <th colSpan={4} className="px-1.5 py-2 border border-app-border text-center">REFERENCIA DEL COMPROBANTE<br />DE PAGO O DOC. QUE SE MODIFICA</th>
              </tr>

              {/* ROW 2: Sub-groups */}
              <tr className="bg-app-surface text-app-text text-[7px] font-black uppercase">
                {/* Comprobante sub */}
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-10">TIPO<br /><span className="text-[6px] opacity-70">(TABLA 10)</span></th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-12">SERIE</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-16">NÚMERO</th>
                {/* Cliente sub */}
                <th colSpan={2} className="px-1 py-1.5 border border-app-border text-center bg-rose-600/5">DOCUMENTO DE IDENTIDAD</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center min-w-[130px] bg-rose-600/5">APELLIDOS Y NOMBRES,<br />DENOMINACIÓN<br />O RAZÓN SOCIAL</th>
                {/* BI Gravada */}
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-14">CUENTA<br />CONTABLE</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-20">BASE<br />IMPONIBLE</th>
                {/* Operación */}
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-16">EXONERADA</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-16">INAFECTA</th>
                {/* Importe Total */}
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-14">CUENTA<br />CONTABLE</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-20">IMPORTE<br />TOTAL<br />DEL<br />COMPROBANTE</th>
                {/* Referencia */}
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-16">FECHA</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-10">TIPO</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-12">SERIE</th>
                <th rowSpan={2} className="px-1 py-1.5 border border-app-border text-center w-16">N° DEL<br />COMPROB.</th>
              </tr>

              {/* ROW 3: Doc identity sub-sub */}
              <tr className="bg-app-surface text-app-text text-[7px] font-black uppercase">
                <th className="px-1 py-1 border border-app-border text-center w-8 bg-rose-600/5">TIPO<br /><span className="text-[6px] opacity-70">(TABLA 2)</span></th>
                <th className="px-1 py-1 border border-app-border text-center w-24 bg-rose-600/5">NÚMERO</th>
              </tr>
            </thead>

            {/* ──── TBODY: Data rows ──── */}
            <tbody className="font-mono text-[9px] bg-app-surface">
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={24} className="text-center py-16 text-app-muted font-sans italic text-sm">
                    No se encontraron ventas registradas para {MONTHS[periodoMes]} {periodoAnio}
                  </td>
                </tr>
              )}

              {filteredSales.map((s) => (
                <tr key={s.id} className="hover:bg-app-text/[0.03] transition-colors border-b border-app-border/50">
                  {/* N° Correlativo */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center font-bold text-app-text">{s.registro}</td>
                  {/* Fecha Emisión */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center whitespace-nowrap italic text-app-muted">{s.fecha}</td>
                  {/* Fecha Vcto */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center whitespace-nowrap text-app-muted italic">{s.fecVcto || ''}</td>
                  {/* Tipo Doc */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center font-bold opacity-70 text-app-text">{s.tipo_doc}</td>
                  {/* Serie */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center uppercase text-app-muted">{s.serie}</td>
                  {/* Número */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center font-black text-app-text">{s.numero}</td>
                  {/* Doc Identidad Tipo */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center text-app-muted">{s.doc_tipo}</td>
                  {/* Doc Identidad Número */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center font-bold text-app-text">{s.doc_num}</td>
                  {/* Razón Social */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-left uppercase font-sans text-[8px] font-bold truncate max-w-[160px] text-app-text" title={s.nombre}>{s.nombre}</td>
                  {/* Exportación */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right text-app-text">{s.tipOperCode === '02' ? fmt(s.bi) : ''}</td>
                  {/* Cuenta Contable Ingreso */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center font-bold text-app-text">{s.ctaIngreso || '70111'}</td>
                  {/* Base Imponible */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right font-black text-app-text">{fmt(s.bi)}</td>
                  {/* Exonerada */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right text-app-muted">{fmt(s.noGravada || 0)}</td>
                  {/* Inafecta */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right"></td>
                  {/* ISC */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right text-app-muted">{fmt(s.isc || 0)}</td>
                  {/* IGV */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right font-bold text-app-text">{fmt(s.igv)}</td>
                  {/* Otros Tributos */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right text-app-muted">{fmt(s.otros_tributos || 0)}</td>
                  {/* Cuenta Contable Cargo */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center font-bold text-app-text">{s.ctaCargo || '1212'}</td>
                  {/* Importe Total */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-right font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">{fmt(s.total)}</td>
                  {/* T.C. */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center text-app-muted">{s.moneda === 'DOLARES' ? s.tc.toFixed(3) : ''}</td>
                  {/* Referencia: Fecha, Tipo, Serie, N° */}
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center"></td>
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center"></td>
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center"></td>
                  <td className="px-1.5 py-1 border-r border-app-border/40 text-center"></td>
                </tr>
              ))}
            </tbody>

            {/* ──── TFOOT: Totals ──── */}
            {filteredSales.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 bg-app-surface">
                <tr className="font-black text-[9px] border-t-2 border-app-border bg-app-surface">
                  <td colSpan={9} className="px-3 py-2.5 border-r border-app-border text-right uppercase italic text-[8px] text-app-text tracking-wider">TOTAL GENERAL S/</td>
                  {/* Exportación */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-app-text">{fmt(totals.exportacion)}</td>
                  {/* Cuenta (vacío) */}
                  <td className="px-1.5 py-2.5 border-r border-app-border"></td>
                  {/* BI Gravada */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-app-text font-black">{fmtAlways(totals.bi)}</td>
                  {/* Exonerada */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-app-muted">{fmt(totals.exonerada)}</td>
                  {/* Inafecta */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right"></td>
                  {/* ISC */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-app-muted">{fmt(totals.isc)}</td>
                  {/* IGV */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-app-text font-black">{fmtAlways(totals.igv)}</td>
                  {/* Otros */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-app-muted">{fmt(totals.otros)}</td>
                  {/* Cuenta (vacío) */}
                  <td className="px-1.5 py-2.5 border-r border-app-border"></td>
                  {/* Importe Total */}
                  <td className="px-1.5 py-2.5 border-r border-app-border text-right text-emerald-600 dark:text-emerald-400 font-black text-[10px] underline underline-offset-4">{fmtAlways(totals.total)}</td>
                  {/* T.C. + Referencia (vacío) */}
                  <td colSpan={5} className="px-1.5 py-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        </div>
      </div>

      {/* ═══ Print Header (only visible when printing) ═══ */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          table { font-size: 7px !important; }
          th, td { padding: 2px 3px !important; }
        }
      `}</style>
    </div>
  );
};

export default RegistroVentasView;
