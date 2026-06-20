import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { 
  FileSearch, 
  Download, 
  Printer,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

/**
 * LIBRO DE INVENTARIOS Y BALANCES — ANEXOS
 * ═══════════════════════════════════════════
 * Según R.S. N° 234-2006/SUNAT
 *
 * Formatos implementados (los más usados):
 *
 *  3.2  → Cta. 10 – Caja y Bancos
 *  3.3  → Cta. 12 – Cuentas por Cobrar Comerciales (Clientes)
 *  3.5  → Cta. 16 – Cuentas por Cobrar Diversas
 *  3.7  → Cta. 20/21 – Mercaderías / Productos Terminados
 *  3.12 → Cta. 42 – Cuentas por Pagar Comerciales (Proveedores)
 *  3.13 → Cta. 46/47 – Cuentas por Pagar Diversas
 *  3.15 → Cta. 49 – Pasivo Diferido
 *  3.16 → Cta. 50 – Capital
 *
 * Cada formato tiene su propia estructura de columnas tal como lo exige SUNAT.
 * Los datos se extraen automáticamente del Libro Diario (journal).
 */

type AnexoType = '3.2' | '3.3' | '3.5' | '3.7' | '3.12' | '3.13' | '3.15' | '3.16';

interface AnexoConfig {
  label: string;
  fullTitle: string;
  accountPrefixes: string[];
}

const ANEXO_CONFIG: Record<AnexoType, AnexoConfig> = {
  '3.2': {
    label: '3.2 Caja y Bancos',
    fullTitle: 'FORMATO 3.2: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 10 - CAJA Y BANCOS"',
    accountPrefixes: ['10'],
  },
  '3.3': {
    label: '3.3 CxC Comerciales',
    fullTitle: 'FORMATO 3.3: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 12 - CLIENTES"',
    accountPrefixes: ['12'],
  },
  '3.5': {
    label: '3.5 CxC Diversas',
    fullTitle: 'FORMATO 3.5: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 16 - CUENTAS POR COBRAR DIVERSAS"',
    accountPrefixes: ['16'],
  },
  '3.7': {
    label: '3.7 Existencias',
    fullTitle: 'FORMATO 3.7: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 20 - MERCADERÍAS Y LA CUENTA 21 - PRODUCTOS TERMINADOS"',
    accountPrefixes: ['20', '21'],
  },
  '3.12': {
    label: '3.12 Proveedores',
    fullTitle: 'FORMATO 3.12: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 42 - PROVEEDORES"',
    accountPrefixes: ['42'],
  },
  '3.13': {
    label: '3.13 CxP Diversas',
    fullTitle: 'FORMATO 3.13: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 46 - CUENTAS POR PAGAR DIVERSAS"',
    accountPrefixes: ['46', '47'],
  },
  '3.15': {
    label: '3.15 Pasivo Diferido',
    fullTitle: 'FORMATO 3.15: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 49 - PASIVO DIFERIDO"',
    accountPrefixes: ['49'],
  },
  '3.16': {
    label: '3.16 Capital',
    fullTitle: 'FORMATO 3.16: "LIBRO DE INVENTARIOS Y BALANCES - DETALLE DEL SALDO DE LA CUENTA 50 - CAPITAL"',
    accountPrefixes: ['50'],
  },
};

const ANEXO_TYPES: AnexoType[] = ['3.2', '3.3', '3.5', '3.7', '3.12', '3.13', '3.15', '3.16'];

interface SaldoRow {
  cta: string;
  desc: string;
  debe: number;
  haber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
}

const fmt = (n: number) => n !== 0
  ? n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '';

const fmtAlways = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BalanceAnexosView: React.FC = () => {
  const { journal, plan, currentCompany, products, inventoryMovements, purchases, sales } = useStore();
  const [anexoType, setAnexoType] = useState<AnexoType>('3.2');
  const [periodoAnio, setPeriodoAnio] = useState(parseInt(currentCompany.period) || new Date().getFullYear());

  const config = ANEXO_CONFIG[anexoType];

  // ─── Generic: Aggregate journal by sub-account ───
  const saldoRows: SaldoRow[] = useMemo(() => {
    const prefixes = config.accountPrefixes;

    const balances: Record<string, { cta: string; desc: string; debe: number; haber: number }> = {};

    journal
      .filter(j => {
        let matchYear = false;
        if (j.fecha.includes('-')) {
          matchYear = j.fecha.startsWith(String(periodoAnio));
        } else if (j.fecha.includes('/')) {
          const parts = j.fecha.split('/');
          matchYear = parts[2] === String(periodoAnio);
        }

        const matchAccount = prefixes.some(p => j.cta.startsWith(p));
        return matchYear && matchAccount && j.cta.trim() !== '' && j.cta.toUpperCase() !== 'GLOSA';
      })
      .forEach(j => {
        const key = j.cta;
        if (!balances[key]) {
          const planDesc = plan.find(p => p.cta === key)?.description || j.desc;
          balances[key] = { cta: key, desc: planDesc, debe: 0, haber: 0 };
        }
        balances[key].debe += j.debe;
        balances[key].haber += j.haber;
      });

    return Object.values(balances)
      .map(b => {
        const neto = b.debe - b.haber;
        return {
          ...b,
          saldoDeudor: neto > 0 ? neto : 0,
          saldoAcreedor: neto < 0 ? Math.abs(neto) : 0,
        };
      })
      .filter(b => b.saldoDeudor !== 0 || b.saldoAcreedor !== 0)
      .sort((a, b) => a.cta.localeCompare(b.cta));
  }, [journal, plan, config.accountPrefixes, periodoAnio]);

  // ─── 3.3 & 3.12: Enrich with client/provider info from purchases/sales ───
  const enrichedClientRows = useMemo(() => {
    if (anexoType !== '3.3') return [];
    // Group sales by client (doc_num)
    const clientMap: Record<string, { docTipo: string; docNum: string; nombre: string; total: number; ultimaFecha: string }> = {};
    sales.filter(s => s.fecha.startsWith(String(periodoAnio))).forEach(s => {
      if (!clientMap[s.doc_num]) {
        clientMap[s.doc_num] = { docTipo: s.doc_tipo, docNum: s.doc_num, nombre: s.nombre, total: 0, ultimaFecha: s.fecha };
      }
      clientMap[s.doc_num].total += s.total;
      if (s.fecha > clientMap[s.doc_num].ultimaFecha) clientMap[s.doc_num].ultimaFecha = s.fecha;
    });
    return Object.values(clientMap).filter(c => c.total !== 0).sort((a, b) => b.total - a.total);
  }, [sales, anexoType, periodoAnio]);

  const enrichedProviderRows = useMemo(() => {
    if (anexoType !== '3.12') return [];
    const provMap: Record<string, { docTipo: string; docNum: string; nombre: string; total: number; ultimaFecha: string }> = {};
    purchases.filter(p => p.fecha.startsWith(String(periodoAnio))).forEach(p => {
      if (!provMap[p.doc_num]) {
        provMap[p.doc_num] = { docTipo: p.doc_tipo, docNum: p.doc_num, nombre: p.nombre, total: 0, ultimaFecha: p.fecha };
      }
      provMap[p.doc_num].total += p.total;
      if (p.fecha > provMap[p.doc_num].ultimaFecha) provMap[p.doc_num].ultimaFecha = p.fecha;
    });
    return Object.values(provMap).filter(c => c.total !== 0).sort((a, b) => b.total - a.total);
  }, [purchases, anexoType, periodoAnio]);

  // ─── 3.7: Product/Inventory data ───
  const inventoryRows = useMemo(() => {
    if (anexoType !== '3.7') return [];
    return products.map(p => {
      const movements = inventoryMovements
        .filter(m => m.product_id === p.id)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
      const lastMovement = movements[movements.length - 1];
      const cantidad = lastMovement?.cantidad_saldo ?? 0;
      const costoUnit = lastMovement?.costo_unit_saldo ?? 0;
      const costoTotal = lastMovement?.total_saldo ?? 0;
      return {
        codigo: p.code,
        tipoExistencia: p.type_existence || '1',
        descripcion: p.name,
        unidMedida: p.unit_measure || '7',
        cantidad,
        costoUnit,
        costoTotal,
      };
    }).filter(r => r.cantidad !== 0 || r.costoTotal !== 0);
  }, [products, inventoryMovements, anexoType]);

  // ─── Totals ───
  const totalDeudor = saldoRows.reduce((s, r) => s + r.saldoDeudor, 0);
  const totalAcreedor = saldoRows.reduce((s, r) => s + r.saldoAcreedor, 0);

  // ─── Export ───
  const handleExport = () => {
    if (anexoType === '3.3') {
      const rowsFormatted = enrichedClientRows.map(r => ({
        tipoDoc: r.docTipo,
        num: r.docNum,
        nombre: r.nombre.toUpperCase(),
        monto: r.total,
        fecha: r.ultimaFecha
      }));
      exportSingleSheet({
        sheetName: 'Anexo 3.3',
        title: `FORMATO 3.3: DETALLE DEL SALDO DE LA CUENTA 12 - CLIENTES (AÑO: ${periodoAnio})`,
        columns: [
          { header: 'TIPO DOC', key: 'tipoDoc', width: 12, alignment: 'center' },
          { header: 'NÚMERO', key: 'num', width: 16, alignment: 'center' },
          { header: 'APELLIDOS Y NOMBRES / RAZÓN SOCIAL', key: 'nombre', width: 45 },
          { header: 'MONTO CXC S/', key: 'monto', width: 18, style: 'currency' },
          { header: 'FECHA EMISIÓN', key: 'fecha', width: 14, alignment: 'center' }
        ],
        rows: rowsFormatted,
        totals: {
          tipoDoc: '', num: '', nombre: 'TOTAL GENERAL',
          monto: enrichedClientRows.reduce((s, r) => s + r.total, 0),
          fecha: ''
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: String(periodoAnio),
        }
      }, `Anexo_3_3_${periodoAnio}`);
    } else if (anexoType === '3.12') {
      const rowsFormatted = enrichedProviderRows.map(r => ({
        tipoDoc: r.docTipo,
        num: r.docNum,
        nombre: r.nombre.toUpperCase(),
        monto: r.total,
        fecha: r.ultimaFecha
      }));
      exportSingleSheet({
        sheetName: 'Anexo 3.12',
        title: `FORMATO 3.12: DETALLE DEL SALDO DE LA CUENTA 42 - PROVEEDORES (AÑO: ${periodoAnio})`,
        columns: [
          { header: 'TIPO DOC', key: 'tipoDoc', width: 12, alignment: 'center' },
          { header: 'NÚMERO', key: 'num', width: 16, alignment: 'center' },
          { header: 'APELLIDOS Y NOMBRES / RAZÓN SOCIAL', key: 'nombre', width: 45 },
          { header: 'MONTO CXP S/', key: 'monto', width: 18, style: 'currency' },
          { header: 'FECHA EMISIÓN', key: 'fecha', width: 14, alignment: 'center' }
        ],
        rows: rowsFormatted,
        totals: {
          tipoDoc: '', num: '', nombre: 'TOTAL GENERAL',
          monto: enrichedProviderRows.reduce((s, r) => s + r.total, 0),
          fecha: ''
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: String(periodoAnio),
        }
      }, `Anexo_3_12_${periodoAnio}`);
    } else if (anexoType === '3.7') {
      const source = inventoryRows.length > 0 ? inventoryRows : saldoRows.map(r => ({
        codigo: r.cta, tipoExistencia: '01', descripcion: r.desc,
        unidMedida: '07', cantidad: 0, costoUnit: 0, costoTotal: r.saldoDeudor
      }));
      const rowsFormatted = source.map(r => ({
        codigo: r.codigo,
        tipo: r.tipoExistencia,
        descripcion: r.descripcion.toUpperCase(),
        unidad: r.unidMedida,
        cantidad: r.cantidad,
        costoUnit: r.costoUnit,
        costoTotal: r.costoTotal
      }));
      exportSingleSheet({
        sheetName: 'Anexo 3.7',
        title: `FORMATO 3.7: DETALLE DEL SALDO DE EXISTENCIAS (AÑO: ${periodoAnio})`,
        columns: [
          { header: 'CÓDIGO', key: 'codigo', width: 14, alignment: 'center' },
          { header: 'TIPO EXIST.', key: 'tipo', width: 12, alignment: 'center' },
          { header: 'DESCRIPCIÓN', key: 'descripcion', width: 40 },
          { header: 'UNIDAD', key: 'unidad', width: 10, alignment: 'center' },
          { header: 'CANTIDAD', key: 'cantidad', width: 12, alignment: 'right' },
          { header: 'COSTO UNIT.', key: 'costoUnit', width: 14, style: 'currency' },
          { header: 'COSTO TOTAL', key: 'costoTotal', width: 16, style: 'currency' }
        ],
        rows: rowsFormatted,
        totals: {
          codigo: '', tipo: '', descripcion: 'TOTAL GENERAL', unidad: '', cantidad: 0, costoUnit: 0,
          costoTotal: source.reduce((s, r) => s + r.costoTotal, 0)
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: String(periodoAnio),
        }
      }, `Anexo_3_7_${periodoAnio}`);
    } else {
      const rowsFormatted = saldoRows.map(r => ({
        cuenta: r.cta,
        desc: r.desc.toUpperCase(),
        deudor: r.saldoDeudor || 0,
        acreedor: r.saldoAcreedor || 0
      }));
      exportSingleSheet({
        sheetName: `Anexo ${anexoType}`,
        title: `${config.fullTitle} (AÑO: ${periodoAnio})`,
        columns: [
          { header: 'CUENTA', key: 'cuenta', width: 12, alignment: 'center' },
          { header: 'DENOMINACIÓN', key: 'desc', width: 45 },
          { header: 'SALDO DEUDOR S/', key: 'deudor', width: 18, style: 'currency' },
          { header: 'SALDO ACREEDOR S/', key: 'acreedor', width: 18, style: 'currency' }
        ],
        rows: rowsFormatted,
        totals: {
          cuenta: '', desc: 'TOTAL GENERAL',
          deudor: totalDeudor,
          acreedor: totalAcreedor
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: String(periodoAnio),
        }
      }, `Anexo_${anexoType.replace('.', '_')}_${periodoAnio}`);
    }
  };

  // ─── Render table based on annexe type ───
  const renderTable = () => {
    switch (anexoType) {
      case '3.2': return renderFormato32();
      case '3.3': return renderFormato33();
      case '3.5': return renderFormato35();
      case '3.7': return renderFormato37();
      case '3.12': return renderFormato312();
      case '3.13': return renderFormato313();
      case '3.15': return renderFormato315();
      case '3.16': return renderFormato316();
      default: return renderGeneric();
    }
  };

  // ═══ FORMATO 3.2: Caja y Bancos ═══
  const renderFormato32 = () => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20 text-pld-blue">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th colSpan={2} className="px-2 py-2.5 border border-blue-700/50 text-center">CUENTA</th>
          <th colSpan={3} className="px-2 py-2.5 border border-blue-700/50 text-center bg-blue-600/50">REFERENCIA DE LA CUENTA</th>
          <th colSpan={2} className="px-2 py-2.5 border border-blue-700/50 text-center">SALDO CONTABLE FINAL</th>
        </tr>
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-2 border border-blue-700/50 text-center w-14">CÓDIGO</th>
          <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[120px]">DENOMINACIÓN</th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-28 bg-blue-600/50">ENTIDAD<br/>FINANCIERA<br/><span className="text-[5.5px] opacity-70">(TABLA 3)</span></th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-24 bg-blue-600/50">NÚMERO DE<br/>CTA. CTE.</th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-16 bg-blue-600/50">TIPO DE<br/>MONEDA<br/><span className="text-[5.5px] opacity-70">(TABLA 4)</span></th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-24 text-yellow-200">DEUDOR</th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-24">ACREEDOR</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-black text-pld-magenta">{r.cta}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.desc}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-40">{r.cta.startsWith('104') ? '2' : ''}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center italic opacity-40">AUTO</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center">1</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">{fmt(r.saldoDeudor)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-rose-500 bg-rose-500/5">{fmt(r.saldoAcreedor)}</td>
          </tr>
        ))}
        {renderTotalsRow(7)}
      </tbody>
    </table>
  );

  // ═══ FORMATO 3.3: Clientes (CxC Comerciales) ═══
  const renderFormato33 = () => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th colSpan={3} className="px-2 py-2.5 border border-blue-700/50 text-center bg-blue-600/50">INFORMACIÓN DEL CLIENTE</th>
          <th rowSpan={2} className="px-2 py-2.5 border border-blue-700/50 text-center w-24">MONTO DE<br/>LA CUENTA<br/>POR COBRAR</th>
          <th rowSpan={2} className="px-2 py-2.5 border border-blue-700/50 text-center w-20">FECHA DE<br/>EMISIÓN DEL<br/>COMPROBANTE<br/>DE PAGO</th>
        </tr>
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-2 border border-blue-700/50 text-center w-12 bg-blue-600/50">TIPO<br/><span className="text-[5.5px] opacity-70">(TABLA 2)</span></th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-28 bg-blue-600/50">NÚMERO</th>
          <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[180px] bg-blue-600/50">APELLIDOS Y NOMBRES,<br/>DENOM. O RAZÓN SOCIAL</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {enrichedClientRows.length > 0 ? enrichedClientRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-60">{r.docTipo}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold text-pld-blue">{r.docNum}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase truncate max-w-[200px] text-app-text">{r.nombre}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">{fmtAlways(r.total)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center italic opacity-40">{r.ultimaFecha}</td>
          </tr>
        )) : saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center"></td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold"></td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.cta} - {r.desc}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">{fmt(r.saldoDeudor)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-40"></td>
          </tr>
        ))}
        <tr className="bg-pld-blue/10 font-black border-t-2 border-pld-blue">
          <td colSpan={3} className="px-3 py-2.5 border-r border-app-border/40 text-right uppercase italic text-[8px] text-pld-blue tracking-wider">SALDO TOTAL GENERAL S/</td>
          <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
            {fmtAlways(enrichedClientRows.length > 0 ? enrichedClientRows.reduce((s, r) => s + r.total, 0) : totalDeudor)}
          </td>
          <td className="px-2 py-2.5 border-r border-app-border/40"></td>
        </tr>
      </tbody>
    </table>
  );

  // ═══ FORMATO 3.5: CxC Diversas ═══
  const renderFormato35 = () => renderGenericCxC('COBRAR');

  // ═══ FORMATO 3.7: Existencias ═══
  const renderFormato37 = () => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-3 border border-blue-700/50 text-center w-20">CÓDIGO DE<br/>EXISTENCIA</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-16">TIPO DE<br/>EXISTENCIA<br/><span className="text-[5.5px] opacity-70">(TABLA 5)</span></th>
          <th className="px-2 py-3 border border-blue-700/50 text-center min-w-[180px]">DESCRIPCIÓN</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-16">CÓDIGO DE<br/>UNID. MEDIDA<br/><span className="text-[5.5px] opacity-70">(TABLA 6)</span></th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-20">CANTIDAD</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-20">COSTO<br/>UNITARIO</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-24">COSTO<br/>TOTAL</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {inventoryRows.length > 0 ? inventoryRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold text-pld-magenta">{r.codigo}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-60">{r.tipoExistencia}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.descripcion}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-60">{r.unidMedida}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-bold">{r.cantidad.toLocaleString()}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right">{fmtAlways(r.costoUnit)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">{fmtAlways(r.costoTotal)}</td>
          </tr>
        )) : saldoRows.length > 0 ? saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold text-pld-magenta">{r.cta}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-60">01</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.desc}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-60">07</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-bold">0</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right">0.00</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">{fmtAlways(r.saldoDeudor)}</td>
          </tr>
        )) : renderEmptyRow(7)}
        <tr className="bg-pld-blue/10 font-black border-t-2 border-pld-blue">
          <td colSpan={6} className="px-3 py-2.5 border-r border-app-border/40 text-right uppercase italic text-[8px] text-pld-blue tracking-wider">COSTO TOTAL GENERAL S/</td>
          <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
            {fmtAlways(inventoryRows.length > 0 ? inventoryRows.reduce((s, r) => s + r.costoTotal, 0) : totalDeudor)}
          </td>
        </tr>
      </tbody>
    </table>
  );

  // ═══ FORMATO 3.12: Proveedores (CxP Comerciales) ═══
  const renderFormato312 = () => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th colSpan={3} className="px-2 py-2.5 border border-blue-700/50 text-center bg-blue-600/50">INFORMACIÓN DEL PROVEEDOR</th>
          <th rowSpan={2} className="px-2 py-2.5 border border-blue-700/50 text-center w-24">MONTO DE<br/>CUENTA POR<br/>PAGAR</th>
          <th rowSpan={2} className="px-2 py-2.5 border border-blue-700/50 text-center w-20">FECHA DE<br/>EMISIÓN<br/>DEL COMPROB.<br/>DE PAGO</th>
        </tr>
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-2 border border-blue-700/50 text-center w-12 bg-blue-600/50">TIPO<br/><span className="text-[5.5px] opacity-70">(TABLA 2)</span></th>
          <th className="px-2 py-2 border border-blue-700/50 text-center w-28 bg-blue-600/50">NÚMERO</th>
          <th className="px-2 py-2 border border-blue-700/50 text-center min-w-[180px] bg-blue-600/50">APELLIDOS Y NOMBRES,<br/>DENOM. O RAZÓN SOCIAL</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {enrichedProviderRows.length > 0 ? enrichedProviderRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-60">{r.docTipo}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold text-pld-blue">{r.docNum}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase truncate max-w-[200px] text-app-text">{r.nombre}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-rose-500 bg-rose-500/5">{fmtAlways(r.total)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center italic opacity-40">{r.ultimaFecha}</td>
          </tr>
        )) : saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center"></td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-bold"></td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.cta} - {r.desc}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-rose-500 bg-rose-500/5">{fmt(r.saldoAcreedor)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center opacity-40"></td>
          </tr>
        ))}
        <tr className="bg-pld-blue/10 font-black border-t-2 border-pld-blue">
          <td colSpan={3} className="px-3 py-2.5 border-r border-app-border/40 text-right uppercase italic text-[8px] text-pld-blue tracking-wider">SALDO TOTAL GENERAL S/</td>
          <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
            {fmtAlways(enrichedProviderRows.length > 0 ? enrichedProviderRows.reduce((s, r) => s + r.total, 0) : totalAcreedor)}
          </td>
          <td className="px-2 py-2.5 border-r border-app-border/40"></td>
        </tr>
      </tbody>
    </table>
  );

  // ═══ FORMATO 3.13: CxP Diversas ═══
  const renderFormato313 = () => renderGenericCxC('PAGAR');

  // ═══ FORMATO 3.15: Pasivo Diferido ═══
  const renderFormato315 = () => renderGeneric();

  // ═══ FORMATO 3.16: Capital ═══
  const renderFormato316 = () => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-3 border border-blue-700/50 text-center min-w-[300px]">DETALLE DEL CAPITAL SOCIAL</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-28">VALOR S/</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8.5px] font-bold uppercase text-app-text">
              <span className="text-pld-magenta font-mono mr-2">{r.cta}</span>
              {r.desc}
            </td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/5">
              {fmtAlways(r.saldoAcreedor || r.saldoDeudor)}
            </td>
          </tr>
        ))}
        {saldoRows.length === 0 && renderEmptyRow(2)}
        <tr className="bg-pld-blue/10 font-black border-t-2 border-pld-blue">
          <td className="px-3 py-2.5 border-r border-app-border/40 text-right uppercase italic text-[8px] text-pld-blue tracking-wider">CAPITAL SOCIAL TOTAL S/</td>
          <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black text-[10px] underline underline-offset-4">
            {fmtAlways(totalAcreedor || totalDeudor)}
          </td>
        </tr>
      </tbody>
    </table>
  );

  // ─── Generic renderers ───
  const renderGenericCxC = (tipo: 'COBRAR' | 'PAGAR') => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-3 border border-blue-700/50 text-center w-14">CÓDIGO</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center min-w-[200px]">DENOMINACIÓN DE LA CUENTA POR {tipo}</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-24 text-yellow-200">SALDO DEUDOR</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-24 text-yellow-200">SALDO ACREEDOR</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-black text-pld-magenta">{r.cta}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.desc}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-pld-blue bg-blue-500/2">{fmt(r.saldoDeudor)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-black text-rose-500 bg-rose-500/2">{fmt(r.saldoAcreedor)}</td>
          </tr>
        ))}
        {saldoRows.length === 0 && renderEmptyRow(4)}
        {renderTotalsRow(4)}
      </tbody>
    </table>
  );

  const renderGeneric = () => (
    <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
      <thead className="sticky top-0 z-20">
        <tr className="bg-pld-blue text-white text-[7px] font-black uppercase">
          <th className="px-2 py-3 border border-blue-700/50 text-center w-14">CÓDIGO</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center min-w-[200px]">DENOMINACIÓN</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-24">SALDO DEUDOR</th>
          <th className="px-2 py-3 border border-blue-700/50 text-center w-24">SALDO ACREEDOR</th>
        </tr>
      </thead>
      <tbody className="font-mono text-[9px] bg-app-surface">
        {saldoRows.map((r, i) => (
          <tr key={i} className="border-b border-app-border/40 hover:bg-pld-blue/5 transition-colors">
            <td className="px-2 py-1.5 border-r border-app-border/40 text-center font-black text-pld-magenta">{r.cta}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-left font-sans text-[8px] font-bold uppercase text-app-text">{r.desc}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-bold text-pld-blue">{fmt(r.saldoDeudor)}</td>
            <td className="px-2 py-1.5 border-r border-app-border/40 text-right font-bold text-rose-500">{fmt(r.saldoAcreedor)}</td>
          </tr>
        ))}
        {saldoRows.length === 0 && renderEmptyRow(4)}
        {renderTotalsRow(4)}
      </tbody>
    </table>
  );

  const renderEmptyRow = (colSpan: number) => (
    <tr>
      <td colSpan={colSpan} className="text-center py-16">
        <div className="flex flex-col items-center gap-3 opacity-30 text-app-muted">
          <AlertCircle size={28} />
          <p className="text-[10px] font-black uppercase tracking-wider font-sans">
            No hay saldos registrados para este anexo en {periodoAnio}
          </p>
        </div>
      </td>
    </tr>
  );

  const renderTotalsRow = (colSpan: number) => (
    <tr className="bg-pld-blue/10 font-black border-t-2 border-pld-blue sticky bottom-0 z-10">
      <td colSpan={colSpan - 2} className="px-3 py-2.5 border-r border-app-border/40 text-right uppercase italic text-[8px] text-pld-blue tracking-wider">TOTAL GENERAL S/</td>
      <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
        {fmtAlways(totalDeudor)}
      </td>
      <td className="px-2 py-2.5 border-r border-app-border/40 text-right bg-pld-blue text-white font-black">
        {fmtAlways(totalAcreedor)}
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative print:bg-white print:p-0">
      <PageHeader
        icon={<FileSearch size={18} />}
        title="Anexos del Balance"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">
            Inventarios y Balances
          </span>
        }
        subtitle={`${config.label} - ${periodoAnio} • RUC: ${currentCompany.ruc}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            {/* Año Selector */}
            <div className="bg-app-bg border border-app-border rounded-lg flex items-center h-8 px-2 gap-2">
               <button onClick={() => setPeriodoAnio(p => p - 1)} className="p-1 hover:text-cyan-600 transition-colors"><ChevronLeft size={14} /></button>
               <span className="text-[10px] font-black w-8 text-center">{periodoAnio}</span>
               <button onClick={() => setPeriodoAnio(p => p + 1)} className="p-1 hover:text-cyan-600 transition-colors"><ChevronRight size={14} /></button>
            </div>
            <button
              onClick={handleExport}
              className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-cyan-600 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Download size={14} /> Excel
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-cyan-600 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Printer size={14} /> Imprimir
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* ═══ TABS AREA ═══ */}
      <div className="px-5 py-2 bg-app-surface border-b border-app-border flex gap-1 flex-wrap print:hidden">
        {ANEXO_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setAnexoType(type)}
            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              anexoType === type
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-app-muted hover:text-app-text hover:bg-app-bg'
            }`}
          >
            {ANEXO_CONFIG[type].label.split(' ')[0]} {ANEXO_CONFIG[type].label.split(' ').slice(1).join(' ')}
          </button>
        ))}
      </div>

      {/* ═══ MAIN TABLE ═══ */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="inline-block min-w-full border border-app-border shadow-2xl rounded-sm overflow-hidden bg-app-surface">
        {renderTable()}
        </div>
      </div>

        </div>
      </div>
    </div>
  );
};

export default BalanceAnexosView;
