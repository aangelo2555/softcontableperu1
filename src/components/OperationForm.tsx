import React, { useState, useEffect } from 'react';
import { ShoppingCart, Tag, ReceiptText, Calculator, Zap, FileText, Package, Trash2, Edit, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useStore, type PurchaseEntry, type SaleEntry } from '../store';
import {
  TIPO_DOCS_COMPRAS, TIPO_DOCS_VENTAS,
  CTA_ABONO_COMPRAS, CTA_CARGO_VENTAS,
  TIPO_OPERACION_COMPRAS, TIPO_OPERACION_VENTAS,
  TIPO_DOC_IDENTIDAD
} from '../constants/tributario';
import { consultarRUC, consultarDNI } from '../services/apiService';
import DecimalInput from './shared/DecimalInput';
import Toast from './shared/Toast';
import type { ToastData } from './shared/Toast';
import PageHeader from './ui/PageHeader';
import ActionBar from './ui/ActionBar';
import FormField from './ui/FormField';
import DateInput from './shared/DateInput';

// ─── Mode Configuration ───────────────────────────────

interface ModeConfig {
  title: string;
  icon: React.FC<{ size?: number; className?: string }>;
  accent: string;
  tipoDocs: { code: string; label: string }[];
  tipoOps: { code: string; label: string }[];
  defaultTipoDoc: string;
  defaultSerie: string;
  defaultTipOper: string;
  defaultTipOperCode: string;
  defaultGlosa: string;
  // Account labels & defaults
  ctaLeftLabel: string;
  ctaLeftDefault: string;
  ctaLeftIsSelect: boolean;
  ctaLeftOptions?: { code: string; label: string }[];
  ctaRightLabel: string;
  ctaRightDefault: string;
  ctaRightIsSelect: boolean;
  ctaRightOptions?: { code: string; label: string }[];
  // Partners
  partnerLabel: string;
  partnerPlaceholder: string;
  // Source label for table preview
  sourceType: 'COMPRA' | 'VENTA';
}

const MODES: Record<'compra' | 'venta', ModeConfig> = {
  compra: {
    title: 'Registro de Compras',
    icon: ShoppingCart,
    accent: 'text-violet-500',
    tipoDocs: TIPO_DOCS_COMPRAS,
    tipoOps: TIPO_OPERACION_COMPRAS,
    defaultTipoDoc: '01',
    defaultSerie: 'F001',
    defaultTipOper: 'COMPRA INTERNA GRAVADA',
    defaultTipOperCode: '02',
    defaultGlosa: 'POR LA COMPRA DE MERCADERIA',
    ctaLeftLabel: 'Cta Gasto / Activo (Debe)',
    ctaLeftDefault: '6011',
    ctaLeftIsSelect: false,
    ctaRightLabel: 'Cta C×P (Haber)',
    ctaRightDefault: '4212',
    ctaRightIsSelect: true,
    ctaRightOptions: CTA_ABONO_COMPRAS,
    partnerLabel: 'Proveedor',
    partnerPlaceholder: 'NOMBRE DEL PROVEEDOR',
    sourceType: 'COMPRA',
  },
  venta: {
    title: 'Registro de Ventas e Ingresos',
    icon: Tag,
    accent: 'text-pld-blue',
    tipoDocs: TIPO_DOCS_VENTAS,
    tipoOps: TIPO_OPERACION_VENTAS,
    defaultTipoDoc: '03',
    defaultSerie: 'B001',
    defaultTipOper: 'VENTA INTERNA GRAVADA',
    defaultTipOperCode: '01',
    defaultGlosa: 'POR LA VENTA DE MERCADERIA',
    ctaLeftLabel: 'Cta Cobrar (Activo)',
    ctaLeftDefault: '1212',
    ctaLeftIsSelect: true,
    ctaLeftOptions: CTA_CARGO_VENTAS,
    ctaRightLabel: 'Cta Ingresos (Resultados)',
    ctaRightDefault: '70111',
    ctaRightIsSelect: false,
    partnerLabel: 'Cliente',
    partnerPlaceholder: 'NOMBRE DEL CLIENTE',
    sourceType: 'VENTA',
  },
};

// ─── Shared Form Data ─────────────────────────────────

interface FormData {
  id: string;
  registro: string;
  fecha: string;
  fecVcto: string;
  tipo_doc: string;
  serie: string;
  numero: string;
  doc_tipo: string;
  doc_num: string;
  nombre: string;
  tipOper: string;
  tipOperCode: string;
  ctaLeft: string;   // ctaGasto (compra) or ctaCargo (venta)
  ctaRight: string;  // ctaAbono (compra) or ctaIngreso (venta)
  moneda: string;
  tc: number;
  bi: number;
  igv: number;
  noGravada: number;
  isc: number;
  total: number;
  glosa: string;
  detraccion: number;
  productId: string;
  quantity: number;

  spot_tipo: string;
  spot_monto: number;
  spot_constancia: string;
  spot_fecha: string;
  retencion_monto: number;
  retencion_comprobante: string;
  retencion_fecha: string;
  percepcion_monto: number;
  percepcion_comprobante: string;
  // --- NC/ND Reference ---
  ref_tipo_doc: string;
  ref_serie: string;
  ref_numero: string;
}

// ─── Component ────────────────────────────────────────

interface OperationFormProps {
  mode: 'compra' | 'venta';
}

const OperationForm: React.FC<OperationFormProps> = ({ mode }) => {
  const cfg = MODES[mode];
  const {
    plan, savePurchase, saveSale,
    getNextPurchaseNumber, getNextSaleNumber,
    draftCompra, setDraftCompra, draftVenta, setDraftVenta,
    purchases, sales,
    deletePurchase, deleteSale,
    products, recordInventoryMovement, inventoryMovements,
    currentCompany,
    facturacionEmitirComprobanteAction
  } = useStore();

  const [tasaIgv, setTasaIgv] = useState(0.18);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [showRecords, setShowRecords] = useState(true);

  const getNextNumber = () => mode === 'compra' ? getNextPurchaseNumber() : getNextSaleNumber();
  const draft = mode === 'compra' ? draftCompra : draftVenta;

  const emptyForm = (): FormData => ({
    id: `${mode}-${Date.now()}`,
    registro: getNextNumber(),
    fecha: '',
    fecVcto: '',
    tipo_doc: cfg.defaultTipoDoc,
    serie: cfg.defaultSerie,
    numero: '',
    doc_tipo: mode === 'compra' ? '6' : '1',
    doc_num: '',
    nombre: '',
    tipOper: cfg.defaultTipOper,
    tipOperCode: cfg.defaultTipOperCode,
    ctaLeft: cfg.ctaLeftDefault,
    ctaRight: cfg.ctaRightDefault,
    moneda: 'SOLES',
    tc: 1,
    bi: 0,
    igv: 0,
    noGravada: 0,
    isc: 0,
    total: 0,
    glosa: cfg.defaultGlosa,
    detraccion: 0,
    productId: '',
    quantity: 0,
    spot_tipo: '',
    spot_monto: 0,
    spot_constancia: '',
    spot_fecha: '',
    retencion_monto: 0,
    retencion_comprobante: '',
    retencion_fecha: '',
    percepcion_monto: 0,
    percepcion_comprobante: '',
    ref_tipo_doc: '',
    ref_serie: '',
    ref_numero: '',
  });

  const handleEmitirCPE = async (comprobanteId: string) => {
    try {
      const res = await facturacionEmitirComprobanteAction(comprobanteId);
      if (res?.success) {
        setToast({
          message: `CPE emitido con éxito. SUNAT/OSE respondió: ${res.mensaje || 'Aceptado'}`,
          type: 'success'
        });
      } else {
        setToast({
          message: res?.error || 'No se pudo emitir el comprobante.',
          type: 'error'
        });
      }
    } catch (e: any) {
      setToast({
        message: `Error de red o servidor: ${e.message || e}`,
        type: 'error'
      });
    }
  };

  const draftToForm = (): FormData => {
    if (!draft) return emptyForm();
    const d = draft as any;
    return {
      ...emptyForm(),
      ...d,
      ctaLeft: d.ctaGasto || d.ctaCargo || cfg.ctaLeftDefault,
      ctaRight: d.ctaAbono || d.ctaIngreso || cfg.ctaRightDefault,
    };
  };

  const [form, setFormLocal] = useState<FormData>(draftToForm);

  const setForm = (updater: FormData | ((prev: FormData) => FormData)) => {
    setFormLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Save draft in the appropriate mode
      if (mode === 'compra') {
        setDraftCompra({ ...next, ctaGasto: next.ctaLeft, ctaAbono: next.ctaRight } as any);
      } else {
        setDraftVenta({ ...next, ctaCargo: next.ctaLeft, ctaIngreso: next.ctaRight } as any);
      }
      return next;
    });
  };

  // Auto-calc IGV & total
  useEffect(() => {
    const calcIgv = form.bi > 0 ? form.bi * tasaIgv : 0;
    const total = form.bi + calcIgv + form.noGravada + form.isc;
    setForm(prev => ({ ...prev, igv: calcIgv, total }));
  }, [form.bi, tasaIgv, form.noGravada, form.isc]);

  // Auto-calc SPOT (Detracción) & Retenciones
  useEffect(() => {
    const total = form.total;
    let newSpotMonto = 0;
    let newRetencionMonto = form.retencion_monto;

    // 1. Calculate Detracción (SPOT)
    if (form.spot_tipo) {
      newRetencionMonto = 0; // SPOT and Retención are mutually exclusive
      const rate = form.spot_tipo === '4%' ? 0.04 : form.spot_tipo === '10%' ? 0.10 : form.spot_tipo === '12%' ? 0.12 : 0;
      if (rate > 0) {
        const threshold = rate === 0.04 ? 2475 : 700;
        if (total >= threshold) {
          newSpotMonto = Math.round(total * rate);
        }
      }
    }

    // 2. Calculate Retención (3% for standard purchases, 1.5% for liquidaciones de compra 04)
    if (mode === 'compra' && form.tipo_doc === '04') {
      newRetencionMonto = Number((form.bi * 0.015).toFixed(2));
    } else if (!form.spot_tipo && mode === 'compra' && currentCompany?.agente_retencion && total > 700 && form.tipo_doc === '01') {
      newRetencionMonto = Number((total * 0.03).toFixed(2));
    } else if (form.spot_tipo) {
      newRetencionMonto = 0;
    }

    if (newSpotMonto !== form.spot_monto || newRetencionMonto !== form.retencion_monto) {
      setForm(prev => ({
        ...prev,
        spot_monto: newSpotMonto,
        retencion_monto: newRetencionMonto
      }));
    }
  }, [form.total, form.bi, form.spot_tipo, form.tipo_doc, currentCompany?.agente_retencion, mode]);

  // Auto-lookup RUC/DNI
  useEffect(() => {
    if (form.doc_num.length === 8 && form.doc_tipo === '1') {
      consultarDNI(form.doc_num).then(data => {
        if (data?.nombres) {
          setForm(prev => ({ ...prev, nombre: `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`.trim(), doc_tipo: '1' }));
        }
      });
    } else if (form.doc_num.length === 11) {
      consultarRUC(form.doc_num).then(data => {
        if (data?.razonSocial) {
          setForm(prev => ({ ...prev, nombre: data.razonSocial, doc_tipo: '6' }));
        }
      });
    }
  }, [form.doc_num]);

  // Auto-adjust serie based on tipo_doc
  useEffect(() => {
    if (form.tipo_doc === '01' && !form.serie.startsWith('F')) {
      setForm(prev => ({ ...prev, serie: 'F001' }));
    } else if (form.tipo_doc === '03' && !form.serie.startsWith('B')) {
      setForm(prev => ({ ...prev, serie: 'B001' }));
    } else if (form.tipo_doc === '14' && mode === 'compra') {
      setForm(prev => ({ ...prev, tipOper: 'SERVICIO PUBLICO', tipOperCode: '04' }));
    }
  }, [form.tipo_doc]);

  // Auto-calculate the next document number for the current mode, tipo_doc and serie
  useEffect(() => {
    const records = mode === 'compra' ? purchases : sales;
    const sameSerie = records.filter(r => r.tipo_doc === form.tipo_doc && r.serie === form.serie);
    
    let nextNum = 1;
    if (sameSerie.length > 0) {
      const maxNum = Math.max(...sameSerie.map(r => {
        const parsed = parseInt(r.numero, 10);
        return isNaN(parsed) ? 0 : parsed;
      }));
      nextNum = maxNum + 1;
    }
    
    const nextNumeroStr = nextNum.toString().padStart(4, '0');
    setForm(prev => ({ ...prev, numero: nextNumeroStr }));
  }, [form.tipo_doc, form.serie, purchases, sales, mode]);

  // --- Auto-calculate BI based on Average Cost from Kardex (Venta) ---
  useEffect(() => {
    if (mode === 'venta' && form.productId && form.quantity > 0) {
      const product = products.find(p => p.id === form.productId);
      if (product) {
        // Get movements to find current Average Cost (Costo Unitario Promedio)
        const movements = inventoryMovements.filter(m => m.product_id === form.productId);
        let costToUse = 0;
        
        if (movements.length > 0) {
          // Use the last calculated average cost from the Kardex
          costToUse = movements[movements.length - 1].costo_unit_saldo;
        } else {
          // Fallback to product price if no inventory history exists
          costToUse = product.sale_price || 0;
        }
        
        const calculatedBi = costToUse * form.quantity;
        if (calculatedBi > 0) {
          setForm(prev => ({ ...prev, bi: calculatedBi }));
        }
      }
    }
  }, [form.productId, form.quantity, mode, inventoryMovements, products]);

  const lookupAccount = (code: string) => plan.find(a => a.cta === code);

  const handleGuardar = () => {
    if (!form.fecha || !form.numero || !form.doc_num || !form.nombre) {
      setToast({ type: 'error', message: 'Complete los campos obligatorios (fecha, número, RUC, nombre).' });
      return;
    }
    if (form.total <= 0 && form.tipo_doc !== '07') {
      setToast({ type: 'error', message: 'El Total debe ser mayor a 0.' });
      return;
    }

    // --- Stock Validation for Sales ---
    if (mode === 'venta' && form.productId && form.quantity > 0) {
      const movements = useStore.getState().inventoryMovements.filter(m => m.product_id === form.productId);
      const currentStock = movements.length > 0 ? movements[movements.length - 1].cantidad_saldo : 0;
      
      if (form.quantity > currentStock) {
        setToast({ type: 'error', message: `Stock insuficiente. Stock actual: ${currentStock} ${products.find(p => p.id === form.productId)?.unit_measure}` });
        return;
      }
    }

    const isNCND = form.tipo_doc === '07' || form.tipo_doc === '08';
    const isNC = form.tipo_doc === '07';

    // Para Notas de Crédito, los montos se almacenan negativos para revertir la operación original
    if (isNC) {
      form.bi = -Math.abs(form.bi);
      form.igv = -Math.abs(form.igv);
      form.noGravada = -Math.abs(form.noGravada);
      form.isc = -Math.abs(form.isc);
      form.total = -Math.abs(form.total);
    }

    if (mode === 'compra') {
      const entry: PurchaseEntry = {
        id: form.id,
        registro: form.registro, fecha: form.fecha, fecVcto: form.fecVcto,
        tipo_doc: form.tipo_doc, serie: form.serie, numero: form.numero,
        doc_tipo: form.doc_tipo, doc_num: form.doc_num, nombre: form.nombre,
        tipOper: form.tipOper, tipOperCode: form.tipOperCode,
        ctaGasto: form.ctaLeft, ctaAbono: form.ctaRight,
        moneda: form.moneda, tc: form.tc,
        bi: form.bi, igv: form.igv, noGravada: form.noGravada, isc: form.isc,
        total: form.total, glosa: form.glosa, detraccion: form.detraccion,
        productId: form.productId || undefined,
        quantity: form.quantity || undefined,
        spot_tipo: form.spot_tipo || undefined,
        spot_monto: form.spot_monto || 0,
        spot_constancia: form.spot_constancia || undefined,
        spot_fecha: form.spot_fecha || undefined,
        retencion_monto: form.retencion_monto || 0,
        retencion_comprobante: form.retencion_comprobante || undefined,
        retencion_fecha: form.retencion_fecha || undefined,
        percepcion_monto: form.percepcion_monto || 0,
        percepcion_comprobante: form.percepcion_comprobante || undefined,
        id_referencia: isNCND ? `${form.ref_tipo_doc}|${form.ref_serie}|${form.ref_numero}` : undefined,
      };
      savePurchase(entry);
    } else {
      const entry: SaleEntry = {
        id: form.id,
        registro: form.registro, fecha: form.fecha, fecVcto: form.fecVcto,
        tipo_doc: form.tipo_doc, serie: form.serie, numero: form.numero,
        doc_tipo: form.doc_tipo, doc_num: form.doc_num, nombre: form.nombre,
        tipOper: form.tipOper, tipOperCode: form.tipOperCode,
        ctaCargo: form.ctaLeft, ctaIngreso: form.ctaRight,
        moneda: form.moneda, tc: form.tc,
        bi: form.bi, igv: form.igv, noGravada: form.noGravada, isc: form.isc,
        total: form.total, glosa: form.glosa, detraccion: form.detraccion,
        productId: form.productId || undefined,
        quantity: form.quantity || undefined,
        costo_venta: (form.productId && form.quantity > 0) ? 
          (inventoryMovements.filter(m => m.product_id === form.productId).slice(-1)[0]?.costo_unit_saldo * form.quantity) : 0,
        spot_tipo: form.spot_tipo || undefined,
        spot_monto: form.spot_monto || 0,
        spot_constancia: form.spot_constancia || undefined,
        spot_fecha: form.spot_fecha || undefined,
        retencion_monto: form.retencion_monto || 0,
        retencion_comprobante: form.retencion_comprobante || undefined,
        retencion_fecha: form.retencion_fecha || undefined,
        id_referencia: isNCND ? `${form.ref_tipo_doc}|${form.ref_serie}|${form.ref_numero}` : undefined,
      };
      saveSale(entry);
    }

    // --- Record Inventory Movement ---
    if (form.productId && form.quantity > 0) {
      recordInventoryMovement({
        id: '',
        product_id: form.productId,
        fecha: form.fecha,
        tipo_operacion: mode === 'compra' ? '02' : '01', // 02 Compra, 01 Venta
        tipo_doc: form.tipo_doc,
        serie: form.serie,
        numero: form.numero,
        cantidad_in: mode === 'compra' ? form.quantity : 0,
        costo_unit_in: mode === 'compra' ? (form.bi / form.quantity) : 0,
        total_in: mode === 'compra' ? form.bi : 0,
        cantidad_out: mode === 'venta' ? form.quantity : 0,
        costo_unit_out: 0, // Se calcula en el store
        total_out: 0,      // Se calcula en el store
        reference_id: form.id
      });
    }

    setToast({ type: 'success', message: `${mode === 'compra' ? 'Compra' : 'Venta'} ${form.serie}-${form.numero} guardada ✓ Registro N° ${form.registro}` });

    const nextRegistro = getNextNumber();
    setFormLocal({
      ...emptyForm(),
      registro: nextRegistro,
      fecha: form.fecha,
      fecVcto: form.fecVcto,
      tipo_doc: form.tipo_doc,
      serie: form.serie,
      moneda: form.moneda,
      ctaLeft: form.ctaLeft,
      ctaRight: form.ctaRight,
      tc: form.tc,
    });
    if (mode === 'compra') setDraftCompra(null);
    else setDraftVenta(null);
  };

  const handleLimpiar = () => {
    setFormLocal(emptyForm());
    if (mode === 'compra') setDraftCompra(null);
    else setDraftVenta(null);
  };

  const handleEditRecord = (record: any) => {
    // Populate form with record data
    setForm({
      ...emptyForm(),
      ...record,
      ctaLeft: record.ctaGasto || record.ctaCargo || cfg.ctaLeftDefault,
      ctaRight: record.ctaAbono || record.ctaIngreso || cfg.ctaRightDefault,
    });
    // Scroll to top
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allRecords = mode === 'compra' ? purchases : sales;
  const records = allRecords.filter(r => !r.estado_sire || r.estado_sire === 'Local' || r.estado_sire === 'Aceptado');
  const deleteRecord = mode === 'compra' ? deletePurchase : deleteSale;

  // ─── Preview lines for automatic journal entry ───
  const previewLines: { cta: string; desc: string; debe: number; haber: number }[] = [];
  if (mode === 'compra') {
    if (form.tipo_doc === '04') {
      const rentaRetenida = Number((form.bi * 0.015).toFixed(2));
      const igvRetenido = form.igv; // 100%
      const netoPagar = form.bi - rentaRetenida;

      if (form.bi > 0) previewLines.push({ cta: form.ctaLeft, desc: lookupAccount(form.ctaLeft)?.description || 'MATERIA PRIMA / GASTO', debe: form.bi, haber: 0 });
      if (form.igv > 0) {
        previewLines.push({ cta: '40111', desc: 'IGV – CREDITO FISCAL (ASUMIDO)', debe: form.igv, haber: 0 });
        previewLines.push({ cta: '40114', desc: 'IGV – RETENCIONES LIQ. COMPRA', debe: 0, haber: form.igv });
      }
      if (rentaRetenida > 0) previewLines.push({ cta: '40173', desc: 'IR RETENCIONES 3RA CAT.', debe: 0, haber: rentaRetenida });
      if (netoPagar > 0) previewLines.push({ cta: form.ctaRight, desc: lookupAccount(form.ctaRight)?.description || 'PROVEEDORES - LIQ. COMPRA', debe: 0, haber: netoPagar });

      // Destino del Gasto
      if (form.bi > 0) {
        const acc = lookupAccount(form.ctaLeft);
        if (acc?.amarreDebe && acc?.amarreHaber) {
          previewLines.push({ cta: acc.amarreDebe, desc: lookupAccount(acc.amarreDebe)?.description || 'DESTINO DEBE', debe: form.bi, haber: 0 });
          previewLines.push({ cta: acc.amarreHaber, desc: lookupAccount(acc.amarreHaber)?.description || 'DESTINO HABER', debe: 0, haber: form.bi });
        }
      }
    } else {
      if (form.bi > 0 || form.noGravada > 0) previewLines.push({ cta: form.ctaLeft, desc: lookupAccount(form.ctaLeft)?.description || 'GASTO / ACTIVO', debe: form.bi + form.noGravada, haber: 0 });
      if (form.igv > 0) previewLines.push({ cta: '40111', desc: 'IGV – CTA PROPIA', debe: form.igv, haber: 0 });
      if (form.isc > 0) previewLines.push({ cta: '4012', desc: 'I.S.C.', debe: form.isc, haber: 0 });
      if (form.total > 0) previewLines.push({ cta: form.ctaRight, desc: lookupAccount(form.ctaRight)?.description || 'CTAS POR PAGAR', debe: 0, haber: form.total });

      // --- DESTINO (20 / 61) ---
      const totalGasto = form.bi + form.noGravada;
      if (totalGasto > 0) {
        const acc = lookupAccount(form.ctaLeft);
        if (acc?.amarreDebe && acc?.amarreHaber) {
          previewLines.push({ cta: acc.amarreDebe, desc: lookupAccount(acc.amarreDebe)?.description || 'DESTINO DEBE', debe: totalGasto, haber: 0 });
          previewLines.push({ cta: acc.amarreHaber, desc: lookupAccount(acc.amarreHaber)?.description || 'DESTINO HABER', debe: 0, haber: totalGasto });
        }
      }
    }
  } else {
    if (form.total > 0) previewLines.push({ cta: form.ctaLeft, desc: lookupAccount(form.ctaLeft)?.description || 'EMITIDAS EN COBRANZA', debe: form.total, haber: 0 });
    if (form.igv > 0) previewLines.push({ cta: '40112', desc: 'IGV – CTA PROPIA', debe: 0, haber: form.igv });
    if (form.bi > 0 || form.noGravada > 0) previewLines.push({ cta: form.ctaRight, desc: lookupAccount(form.ctaRight)?.description || 'INGRESOS', debe: 0, haber: form.bi + form.noGravada });

    // --- COSTO DE VENTAS (69 / 20) ---
    if (form.productId && form.quantity > 0) {
      const lastMov = inventoryMovements.filter(m => m.product_id === form.productId).slice(-1)[0];
      const costoCalculado = lastMov ? (lastMov.costo_unit_saldo * form.quantity) : 0;
      if (costoCalculado > 0) {
        previewLines.push({ cta: '6911', desc: 'COSTO DE VENTAS', debe: costoCalculado, haber: 0 });
        previewLines.push({ cta: '2011', desc: 'MERCADERIAS', debe: 0, haber: costoCalculado });
      }
    }
  }

  const Icon = cfg.icon;

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<Icon size={18} />}
        title={cfg.title}
        badge={
          <span className="ml-2 bg-app-bg px-3 py-1 rounded-full border border-app-border text-xs font-mono font-bold text-pld-blue">
            N° {form.registro}
          </span>
        }
      />

      {/* Main scrollable form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">

          {/* ═══ ROW 1: Documento + Identidad ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* SECCIÓN 1: Documento */}
            <div className="section-card">
              <div className="section-card-header">
                <ReceiptText size={15} />
                <span>1. Datos del Documento</span>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <FormField label="Tipo Doc" className="col-span-5">
                  <select className="w-full text-sm" value={form.tipo_doc} onChange={e => setForm({ ...form, tipo_doc: e.target.value })}>
                    {cfg.tipoDocs.map(t => <option key={t.code} value={t.code}>{t.code} - {t.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Serie" className="col-span-3">
                  <input className="w-full text-sm font-mono uppercase" value={form.serie} onChange={e => setForm({ ...form, serie: e.target.value })} />
                </FormField>
                <FormField label="Número" required className="col-span-4">
                  <input className="w-full text-sm font-mono font-bold" placeholder="0001234" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
                </FormField>

                <FormField label="Fecha Emisión" required className="col-span-6">
                  <DateInput className="w-full text-sm font-mono" placeholder="DD/MM/YYYY" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} />
                </FormField>
                <FormField label="Fecha Vcto." className="col-span-6">
                  <DateInput className="w-full text-sm font-mono" placeholder="DD/MM/YYYY" value={form.fecVcto} onChange={v => setForm({ ...form, fecVcto: v })} />
                </FormField>
              </div>
            </div>

            {/* Liquidación de Compra Info Section */}
            {mode === 'compra' && form.tipo_doc === '04' && (
              <div className="section-card !border-purple-500/30 !bg-gradient-to-br from-purple-500/5 to-indigo-500/5">
                <div className="section-card-header !text-purple-400">
                  <ShieldCheck size={15} />
                  <span>Liquidación de Compra (Autoemitido)</span>
                </div>
                <div className="mb-3 px-3 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] font-bold text-purple-300 uppercase tracking-wider space-y-1">
                  <p>⚠️ Se retendrá automáticamente el 100% del IGV (asumido por la empresa compradora).</p>
                  <p>⚠️ Se retendrá el 1.5% de la Base Imponible por Impuesto a la Renta de Tercera Categoría.</p>
                  <p>Neto a Pagar: Base Imponible − Renta Retenida (S/ {(form.bi - Number((form.bi * 0.015).toFixed(2))).toFixed(2)})</p>
                </div>
              </div>
            )}

            {/* NC/ND Reference Section */}
            {(form.tipo_doc === '07' || form.tipo_doc === '08') && (
              <div className="section-card !border-amber-500/30 !bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                <div className="section-card-header !text-amber-600">
                  <AlertTriangle size={15} />
                  <span>{form.tipo_doc === '07' ? 'Nota de Crédito' : 'Nota de Débito'} — Documento de Referencia</span>
                </div>
                {form.tipo_doc === '07' && (
                  <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                    ⚠️ Los montos de la NC se registrarán con signo negativo para revertir la operación original
                  </div>
                )}
                <div className="grid grid-cols-12 gap-3">
                  <FormField label="Tipo Doc Original" className="col-span-4">
                    <select className="w-full text-sm" value={form.ref_tipo_doc} onChange={e => setForm({ ...form, ref_tipo_doc: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      <option value="01">01 - Factura</option>
                      <option value="03">03 - Boleta</option>
                      <option value="12">12 - Ticket</option>
                    </select>
                  </FormField>
                  <FormField label="Serie Original" className="col-span-4">
                    <input className="w-full text-sm font-mono uppercase" placeholder="F001" value={form.ref_serie} onChange={e => setForm({ ...form, ref_serie: e.target.value })} />
                  </FormField>
                  <FormField label="Número Original" className="col-span-4">
                    <input className="w-full text-sm font-mono font-bold" placeholder="0001234" value={form.ref_numero} onChange={e => setForm({ ...form, ref_numero: e.target.value })} />
                  </FormField>
                </div>
              </div>
            )}

            {/* SECCIÓN 2: Identidad */}
            <div className="section-card">
              <div className="section-card-header">
                <Zap size={15} />
                <span>2. Datos del {cfg.partnerLabel}</span>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <FormField label="Identidad" className="col-span-4">
                  <select className="w-full text-sm" value={form.doc_tipo} onChange={e => setForm({ ...form, doc_tipo: e.target.value })}>
                    {TIPO_DOC_IDENTIDAD.filter(t => ['6', '1', '4', '0'].includes(t.code)).map(t => (
                      <option key={t.code} value={t.code}>{t.code} - {t.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="RUC/DNI (Buscar)" accent required className="col-span-8">
                  <input className="w-full text-sm font-mono font-bold" placeholder="20XXXXXXXXX" value={form.doc_num} onChange={e => setForm({ ...form, doc_num: e.target.value })} />
                </FormField>
                <FormField label="Razón Social o Nombre" required className="col-span-12">
                  <input className="w-full text-sm font-bold uppercase" placeholder={cfg.partnerPlaceholder} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </FormField>
              </div>
            </div>
          </div>

          {/* ═══ ROW 2: Contable + Importes ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* SECCIÓN 3: Configuración Contable */}
            <div className="section-card">
              <div className="section-card-header">
                <Calculator size={15} />
                <span>3. Configuración del Asiento</span>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <FormField label="Moneda" className="col-span-4">
                  <select className="w-full text-sm" value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}>
                    <option value="SOLES">Soles (PEN)</option>
                    <option value="DOLARES">Dólares (USD)</option>
                  </select>
                </FormField>
                <FormField label="Tipo Operación" className="col-span-8">
                  <select className="w-full text-sm" value={form.tipOperCode} onChange={e => {
                    const op = cfg.tipoOps.find(o => o.code === e.target.value);
                    setForm({ ...form, tipOperCode: e.target.value, tipOper: op?.label || form.tipOper });
                  }}>
                    {cfg.tipoOps.map(o => <option key={o.code} value={o.code}>{o.code} - {o.label}</option>)}
                  </select>
                </FormField>

                <FormField label={cfg.ctaLeftLabel} accent className="col-span-6">
                  {cfg.ctaLeftIsSelect ? (
                    <select className="w-full text-sm" value={form.ctaLeft} onChange={e => setForm({ ...form, ctaLeft: e.target.value })}>
                      {cfg.ctaLeftOptions!.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  ) : (
                    <div>
                      <input className="w-full text-sm font-mono uppercase" placeholder={cfg.ctaLeftDefault} value={form.ctaLeft} onChange={e => setForm({ ...form, ctaLeft: e.target.value })} />
                      <p className="text-[10px] text-app-muted italic mt-0.5 truncate">{lookupAccount(form.ctaLeft)?.description}</p>
                    </div>
                  )}
                </FormField>
                <FormField label={cfg.ctaRightLabel} accent className="col-span-6">
                  {cfg.ctaRightIsSelect ? (
                    <select className="w-full text-sm" value={form.ctaRight} onChange={e => setForm({ ...form, ctaRight: e.target.value })}>
                      {cfg.ctaRightOptions!.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                    </select>
                  ) : (
                    <div>
                      <input className="w-full text-sm font-mono uppercase" placeholder={cfg.ctaRightDefault} value={form.ctaRight} onChange={e => setForm({ ...form, ctaRight: e.target.value })} />
                      <p className="text-[10px] text-app-muted italic mt-0.5 truncate">{lookupAccount(form.ctaRight)?.description}</p>
                    </div>
                  )}
                </FormField>
              </div>
            </div>

            {/* SECCIÓN 4: Almacén / Inventario */}
            <div className="section-card">
              <div className="section-card-header">
                <Package size={15} />
                <span>4. Asociación de Inventario (Opcional)</span>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <FormField label="Producto" className="col-span-8">
                   <select 
                     className="w-full text-sm" 
                     value={form.productId} 
                     onChange={e => setForm({ ...form, productId: e.target.value })}
                   >
                     <option value="">-- NINGUNO (SOLO SERVICIO) --</option>
                     {products.map(p => (
                       <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                     ))}
                   </select>
                </FormField>
                <FormField label="Cantidad" className="col-span-4">
                   <input 
                     type="number" 
                     className="w-full text-sm font-mono text-right font-bold" 
                     placeholder="0.00" 
                     value={form.quantity || ''} 
                     onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                   />
                </FormField>
                {form.productId && (
                  <div className="col-span-12 p-2 bg-pld-blue/5 border border-pld-blue/10 rounded text-[10px] italic flex justify-between">
                    <span>SE GENERARÁ UN MOVIMIENTO DE {mode === 'compra' ? 'ENTRADA' : 'SALIDA'} EN EL KÁRDEX.</span>
                    <span className="font-bold text-pld-blue uppercase">{products.find(p => p.id === form.productId)?.unit_measure}</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 4: Importes e Impuestos */}
            <div className="section-card relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-pld-blue/5 blur-[40px] rounded-full pointer-events-none" />
              <div className="section-card-header relative">
                <Tag size={15} />
                <span>4. Importes e Impuestos</span>
              </div>
              <div className="flex flex-col gap-4 relative">
                <FormField label="Base Imponible (Gravada)">
                  <DecimalInput className="w-full text-xl font-mono font-bold text-right bg-transparent border-b-2 border-app-border focus:border-pld-blue rounded-none px-2 py-1 outline-none transition-colors" value={form.bi} onChange={v => setForm({ ...form, bi: v })} />
                </FormField>

                <div className="grid grid-cols-2 gap-3 bg-app-bg/50 p-3 rounded-lg border border-app-border/50">
                  <FormField label="Tasa IGV">
                    <select className="w-full text-sm font-bold" value={tasaIgv} onChange={e => setTasaIgv(parseFloat(e.target.value))}>
                      <option value={0.18}>18.0% (General)</option>
                      <option value={0.10}>10.0% (Especiales)</option>
                    </select>
                  </FormField>
                  <FormField label="IGV (Modificable)" accent>
                    <DecimalInput 
                      className="w-full text-sm font-mono font-bold text-right text-pld-blue bg-pld-blue/5 border-pld-blue/20" 
                      value={form.igv} 
                      onChange={v => {
                        setForm(prev => ({
                          ...prev,
                          igv: v,
                          total: prev.bi + v + prev.noGravada + prev.isc
                        }));
                      }} 
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Inafecto / Exo">
                    <DecimalInput className="w-full text-sm font-mono text-right" value={form.noGravada} onChange={v => setForm({ ...form, noGravada: v })} />
                  </FormField>
                  <FormField label="I.S.C.">
                    <DecimalInput className="w-full text-sm font-mono text-right" value={form.isc} onChange={v => setForm({ ...form, isc: v })} />
                  </FormField>
                </div>

                {form.moneda === 'DOLARES' && (
                  <div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                    <FormField label="Tipo de Cambio">
                      <DecimalInput className="w-full text-sm font-mono text-right text-orange-600 font-bold bg-transparent border-none" value={form.tc} onChange={v => setForm({ ...form, tc: v === 0 ? 1 : v })} />
                    </FormField>
                  </div>
                )}

                {/* TOTAL */}
                <div className="flex justify-between items-end bg-gradient-to-br from-pld-blue to-pld-magenta p-4 rounded-xl shadow-lg text-white mt-1">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-90">Total<br />Documento</span>
                  <div className="text-2xl font-mono font-black">
                    <span className="text-lg opacity-70 mr-1">{form.moneda === 'SOLES' ? 'S/' : '$'}</span>
                    {form.total.toFixed(2)}
                  </div>
                </div>

                <FormField label="Glosa / Descripción">
                  <textarea className="w-full text-sm font-medium uppercase resize-none h-14" value={form.glosa} onChange={e => setForm({ ...form, glosa: e.target.value })} placeholder="Descripción de la operación" />
                </FormField>
              </div>
            </div>

            {/* SECCIÓN 5: Tributos Especiales (SPOT, Retención, Percepción) */}
            <div className="section-card relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-pld-magenta/5 blur-[40px] rounded-full pointer-events-none" />
              <div className="section-card-header relative">
                <ShieldCheck size={15} className="text-pld-magenta" />
                <span>5. Tributos Especiales (SPOT, Retención, Percepción)</span>
              </div>
              <div className="flex flex-col gap-4 relative">
                
                {/* DETRACCIÓN SPOT */}
                <div className="border border-app-border/40 p-3 rounded-lg bg-app-bg/25">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="SPOT (Detracción)">
                      <select 
                        className="w-full text-sm font-bold" 
                        value={form.spot_tipo} 
                        onChange={e => {
                          const val = e.target.value;
                          setForm(prev => ({ 
                            ...prev, 
                            spot_tipo: val,
                            // Clear retencion if choosing detraction
                            retencion_monto: val ? 0 : prev.retencion_monto,
                            retencion_comprobante: val ? '' : prev.retencion_comprobante,
                            retencion_fecha: val ? '' : prev.retencion_fecha
                          }));
                        }}
                      >
                        <option value="">NINGUNO</option>
                        <option value="4%">4% (Servicios / Transportes)</option>
                        <option value="10%">10% (Servicios Generales)</option>
                        <option value="12%">12% (Otros contratos de const.)</option>
                      </select>
                    </FormField>
                    <FormField label="Monto Detracción">
                      <DecimalInput 
                        className="w-full text-sm font-mono text-right font-bold bg-app-surface border border-app-border" 
                        value={form.spot_monto} 
                        onChange={v => setForm(prev => ({ ...prev, spot_monto: v }))} 
                        readOnly={!!form.spot_tipo} // Read-only if auto-calculated
                      />
                    </FormField>
                  </div>
                  
                  {form.spot_tipo && (
                    <div className="grid grid-cols-2 gap-3 mt-3 animate-fade-in">
                      <FormField label="Nº Constancia Depósito">
                        <input 
                          type="text" 
                          placeholder="Nº Constancia"
                          className="w-full text-sm font-mono" 
                          value={form.spot_constancia} 
                          onChange={e => setForm(prev => ({ ...prev, spot_constancia: e.target.value }))} 
                        />
                      </FormField>
                      <FormField label="Fecha Pago Constancia">
                        <DateInput 
                          placeholder="DD/MM/YYYY"
                          className="w-full text-sm font-mono" 
                          value={form.spot_fecha} 
                          onChange={v => setForm(prev => ({ ...prev, spot_fecha: v }))} 
                        />
                      </FormField>
                      {mode === 'compra' && (!form.spot_constancia || !form.spot_fecha) && (
                        <div className="col-span-2 mt-1 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded flex items-center gap-1.5 text-[9px] font-bold text-rose-500 uppercase">
                          <AlertTriangle size={12} className="shrink-0" />
                          <span>Crédito Fiscal IGV suspendido hasta registrar depósito</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* RETENCIÓN IGV */}
                <div className="border border-app-border/40 p-3 rounded-lg bg-app-bg/25">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={mode === 'compra' ? "Retención IGV (3%)" : "Retención Cliente (3%)"}>
                      <DecimalInput 
                        className="w-full text-sm font-mono text-right font-bold" 
                        value={form.retencion_monto} 
                        onChange={v => {
                          setForm(prev => ({ 
                            ...prev, 
                            retencion_monto: v,
                            // Clear spot if choosing retencion manually
                            spot_tipo: v > 0 ? '' : prev.spot_tipo,
                            spot_monto: v > 0 ? 0 : prev.spot_monto,
                            spot_constancia: v > 0 ? '' : prev.spot_constancia,
                            spot_fecha: v > 0 ? '' : prev.spot_fecha
                          }));
                        }} 
                      />
                    </FormField>
                    {mode === 'compra' && !currentCompany?.agente_retencion && (
                      <div className="flex items-center text-[9px] text-app-muted leading-tight uppercase font-medium">
                        (Habilitar Agente de Retención en Panel Principal para cálculo automático)
                      </div>
                    )}
                    {form.retencion_monto > 0 && (
                      <div className="col-span-2 grid grid-cols-2 gap-3 mt-3 animate-fade-in">
                        <FormField label="Nº Comprobante Retención">
                          <input 
                            type="text" 
                            placeholder="Comprobante"
                            className="w-full text-sm font-mono" 
                            value={form.retencion_comprobante} 
                            onChange={e => setForm(prev => ({ ...prev, retencion_comprobante: e.target.value }))} 
                          />
                        </FormField>
                        <FormField label="Fecha Comprobante">
                          <DateInput 
                            placeholder="DD/MM/YYYY"
                            className="w-full text-sm font-mono" 
                            value={form.retencion_fecha} 
                            onChange={v => setForm(prev => ({ ...prev, retencion_fecha: v }))} 
                          />
                        </FormField>
                      </div>
                    )}
                  </div>
                </div>

                {/* PERCEPCIÓN IGV (Solo compras) */}
                {mode === 'compra' && (
                  <div className="border border-app-border/40 p-3 rounded-lg bg-app-bg/25">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Percepción IGV">
                        <DecimalInput 
                          className="w-full text-sm font-mono text-right font-bold" 
                          value={form.percepcion_monto} 
                          onChange={v => setForm(prev => ({ ...prev, percepcion_monto: v }))} 
                        />
                      </FormField>
                      {form.percepcion_monto > 0 && (
                        <FormField label="Nº Comprobante Percepción">
                          <input 
                            type="text" 
                            placeholder="Comprobante"
                            className="w-full text-sm font-mono" 
                            value={form.percepcion_comprobante} 
                            onChange={e => setForm(prev => ({ ...prev, percepcion_comprobante: e.target.value }))} 
                          />
                        </FormField>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* ═══ Preview Asiento ═══ */}
          {previewLines.length > 0 && (
            <div className="section-card !p-0 overflow-hidden">
              <div className="bg-app-bg px-4 py-2 text-[11px] font-bold text-app-muted uppercase tracking-wider flex items-center gap-2">
                <FileText size={13} /> Vista Previa del Asiento Automático
              </div>
              <table className="w-full text-sm">
                <thead className="bg-app-surface border-y border-app-border">
                  <tr className="text-app-muted font-bold text-xs">
                    <th className="p-2.5 text-left w-24 border-r border-app-border/50">Cuenta</th>
                    <th className="p-2.5 text-left">Denominación</th>
                    <th className="p-2.5 text-right w-28 text-emerald-600">Debe</th>
                    <th className="p-2.5 text-right w-28 text-red-500">Haber</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {previewLines.map((line, i) => (
                    <tr key={i} className="border-b border-app-border/50 hover:bg-app-hover">
                      <td className="p-2.5 border-r border-app-border/50 font-bold text-pld-blue">{line.cta}</td>
                      <td className="p-2.5 text-app-text font-sans">{line.desc}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-500">{line.debe > 0 ? line.debe.toFixed(2) : '—'}</td>
                      <td className="p-2.5 text-right font-bold text-red-500">{line.haber > 0 ? line.haber.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ Registros Guardados ═══ */}
          {records.length > 0 && (
            <div className="section-card !p-0 overflow-hidden">
              <button
                onClick={() => setShowRecords(!showRecords)}
                className="w-full bg-app-bg px-4 py-2.5 text-[11px] font-bold text-app-muted uppercase tracking-wider flex items-center justify-between hover:bg-app-hover transition-colors"
              >
                <span>{mode === 'compra' ? 'Compras' : 'Ventas'} Registradas ({records.length})</span>
                <span className="text-pld-blue">{showRecords ? '▲ Ocultar' : '▼ Mostrar'}</span>
              </button>
              {showRecords && (
                <div className="overflow-x-auto max-h-60 custom-scrollbar">
                  <table className="w-full text-xs">
                    <thead className="bg-app-surface sticky top-0">
                      <tr className="text-app-muted font-bold uppercase">
                        <th className="p-2 text-left">Reg.</th>
                        <th className="p-2 text-left">Fecha</th>
                        <th className="p-2 text-left">Serie-Número</th>
                        <th className="p-2 text-left">RUC</th>
                        <th className="p-2 text-left">Nombre</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 w-20 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(r => (
                        <tr key={r.id} className="border-b border-app-border/50 font-mono hover:bg-app-hover">
                          <td className="p-2 text-pld-blue font-bold">{r.registro}</td>
                          <td className="p-2 text-app-muted">{r.fecha}</td>
                          <td className="p-2 font-bold">{r.serie}-{r.numero}</td>
                          <td className="p-2">{r.doc_num}</td>
                          <td className="p-2 uppercase font-sans text-xs truncate max-w-[200px]">{r.nombre}</td>
                          <td className="p-2 text-right font-bold">{r.total.toFixed(2)}</td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-2 text-app-muted">
                               {mode === 'venta' && (
                                 <button
                                   onClick={() => handleEmitirCPE(r.id)}
                                   className="hover:text-emerald-500 text-emerald-600 transition-colors"
                                   title="Emitir CPE firmado digitalmente a SUNAT/OSE"
                                 >
                                   <Zap size={14} />
                                 </button>
                               )}
                               <button 
                                 onClick={() => handleEditRecord(r)} 
                                 className="hover:text-pld-blue transition-colors"
                                 title="Editar Registro"
                               >
                                 <Edit size={14} />
                               </button>
                               <button 
                                 onClick={() => deleteRecord(r.id)} 
                                 className="hover:text-red-500 transition-colors"
                                 title="Eliminar Registro"
                               >
                                 <Trash2 size={14} />
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Bottom spacing for action bar */}
          <div className="h-4" />
        </div>
      </div>

      {/* ═══ Action Bar (sticky bottom) ═══ */}
      <ActionBar
        onSave={handleGuardar}
        onClear={handleLimpiar}
        saveLabel="Guardar Registro"
        statusLeft={
          <div className="flex items-center gap-4 text-xs text-app-muted">
            <span className="font-mono font-bold text-pld-blue">{form.registro}</span>
            {form.total > 0 && (
              <span className="flex items-center gap-1 bg-pld-blue/10 text-pld-blue px-2 py-0.5 rounded font-bold">
                {form.moneda === 'SOLES' ? 'S/' : '$'} {form.total.toFixed(2)}
              </span>
            )}
          </div>
        }
      />
    </div>
  );
};

export default OperationForm;
