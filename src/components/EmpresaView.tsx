import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, Activity,
  Building2, Hash, MapPin, MapPinHouse, MessageCircleMore,
  Loader2, CheckCircle2, CalendarDays, Upload, Trash2,
  Shield, Settings, BookText, Tag, ShoppingCart, ReceiptText,
  ArrowRight, Clock, FileText, Users, ChevronRight, ChevronLeft, ChevronDown, Wallet, Scale,
  AlertCircle, Calculator, Zap, Calendar, Briefcase, BarChart3,
  BookOpen, Layers, CheckCircle, Flame
} from 'lucide-react';
import { useStore, type CompanyData, type RegimenCode } from '../store';
import { REGIMENES_TRIBUTARIOS, getUIT } from '../constants/tributario';
import * as apiService from '../services/apiService';
import { calcularObligacionesContables } from '../utils/tributarioRules';
import { evaluateRegime, type CompanyFinancials } from '../engine/regimeEngine';
import { calcularVencimientoSunat, getProximoPeriodoIndex, CRONOGRAMA_SUNAT_2026 } from '../constants/cronogramaSunat2026';

// ─── Helpers ───
const formatCurrency = (n: number) => `S/ ${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/**
 * Generador reactivo de ondas SVG Catmull-Rom para sparklines reales
 */
function generateRealSparklinePath(values: number[], width = 200, height = 30): { strokePath: string; areaPath: string } {
  if (!values || values.length === 0) {
    const flat = `M 0,${height - 4} L ${width},${height - 4}`;
    return { strokePath: flat, areaPath: `${flat} L ${width},${height} L 0,${height} Z` };
  }

  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal;

  const points: { x: number; y: number }[] = values.map((val, idx) => {
    const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * width;
    let y = height - 4;
    if (range > 0) {
      y = 4 + (1 - (val - minVal) / range) * (height - 8);
    }
    return { x, y };
  });

  if (points.length === 1) {
    const p = points[0];
    const strokePath = `M 0,${height - 4} Q ${p.x},${p.y} ${width},${height - 4}`;
    const areaPath = `${strokePath} L ${width},${height} L 0,${height} Z`;
    return { strokePath, areaPath };
  }

  let strokePath = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i > 0 ? i - 1 : i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    strokePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  const areaPath = `${strokePath} L ${width},${height} L 0,${height} Z`;
  return { strokePath, areaPath };
}

const EmpresaView: React.FC = () => {
  const {
    currentCompany: _currentCompany,
    updateCompany,
    sales,
    purchases,
    honorarios,
    journal,
    asientos,
    entities,
    setActiveTab,
    showCompanyConfig: showConfig,
    setShowCompanyConfig: setShowConfig,
    facturacionConfigurarCertificadoAction
  } = useStore();

  const currentCompany = _currentCompany || {};
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [supportLinkDraft, setSupportLinkDraft] = useState('');
  const [isSupportSaved, setIsSupportSaved] = useState(!!currentCompany.support);

  const [localUIT, setLocalUIT] = useState<string>('');
  const [selectedCalendarMonthOffset, setSelectedCalendarMonthOffset] = useState<number>(0);

  // Selector interactivo de año para el Resumen Mensual
  const [selectedChartYear, setSelectedChartYear] = useState<string>(
    currentCompany.period || new Date().getFullYear().toString()
  );

  useEffect(() => {
    if (currentCompany.period) {
      setSelectedChartYear(currentCompany.period);
    }
  }, [currentCompany.period]);

  // Estados para calculadoras tributarias en parámetros
  const [nrusIngresos, setNrusIngresos] = useState<number>(0);
  const [nrusCompras, setNrusCompras] = useState<number>(0);

  // ─── Computed Metrics (Excluyendo Propuestas SIRE) ───
  const localSales = useMemo(() => sales.filter(s => s.estado_sire !== 'Propuesta'), [sales]);
  const localPurchases = useMemo(() => purchases.filter(p => p.estado_sire !== 'Propuesta'), [purchases]);

  // active period calculations
  const activePeriodYear = currentCompany.period || new Date().getFullYear().toString();

  const isInActivePeriod = (dateStr: string) => {
    if (!dateStr) return false;
    if (dateStr.includes('/')) return dateStr.endsWith('/' + activePeriodYear);
    if (dateStr.includes('-')) return dateStr.startsWith(activePeriodYear + '-');
    return false;
  };

  const isInChartYear = (dateStr: string) => {
    if (!dateStr) return false;
    if (dateStr.includes('/')) return dateStr.endsWith('/' + selectedChartYear);
    if (dateStr.includes('-')) return dateStr.startsWith(selectedChartYear + '-');
    return false;
  };

  const getMonthFromDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    if (dateStr.includes('/')) return parseInt(dateStr.split('/')[1]) || 0;
    if (dateStr.includes('-')) return parseInt(dateStr.split('-')[1]) || 0;
    return 0;
  };

  const periodSales = useMemo(() => localSales.filter(s => isInActivePeriod(s.fecha)), [localSales, activePeriodYear]);
  const periodPurchases = useMemo(() => localPurchases.filter(p => isInActivePeriod(p.fecha)), [localPurchases, activePeriodYear]);

  const chartSales = useMemo(() => localSales.filter(s => isInChartYear(s.fecha)), [localSales, selectedChartYear]);
  const chartPurchases = useMemo(() => localPurchases.filter(p => isInChartYear(p.fecha)), [localPurchases, selectedChartYear]);

  // Monthly breakdown for bar chart (Calculado dinámicamente con selectedChartYear)
  const monthlyData = useMemo(() => {
    const salesByMonth: number[] = new Array(12).fill(0);
    const purchasesByMonth: number[] = new Array(12).fill(0);

    chartSales.forEach(s => {
      const m = getMonthFromDate(s.fecha);
      if (m >= 1 && m <= 12) salesByMonth[m - 1] += (s.bi || s.total || 0);
    });

    chartPurchases.forEach(p => {
      const m = getMonthFromDate(p.fecha);
      if (m >= 1 && m <= 12) purchasesByMonth[m - 1] += (p.bi || p.total || 0);
    });

    const maxVal = Math.max(...salesByMonth, ...purchasesByMonth, 1000);
    return { salesByMonth, purchasesByMonth, maxVal: maxVal > 0 ? maxVal : 1000 };
  }, [chartSales, chartPurchases]);

  // Sparklines en Ondas con Datos Reales de la Base de Datos
  const salesSparklinePoints = useMemo(() => monthlyData.salesByMonth, [monthlyData]);
  const purchasesSparklinePoints = useMemo(() => monthlyData.purchasesByMonth, [monthlyData]);
  const igvSparklinePoints = useMemo(() => {
    return monthlyData.salesByMonth.map((s, idx) => {
      const p = monthlyData.purchasesByMonth[idx];
      return Math.max(0, s * 0.18 - p * 0.18);
    });
  }, [monthlyData]);

  const salesSparkline = useMemo(() => generateRealSparklinePath(salesSparklinePoints), [salesSparklinePoints]);
  const purchasesSparkline = useMemo(() => generateRealSparklinePath(purchasesSparklinePoints), [purchasesSparklinePoints]);
  const igvSparkline = useMemo(() => generateRealSparklinePath(igvSparklinePoints), [igvSparklinePoints]);

  // Estados para Firma Digital / Facturación Electrónica
  const [certPass, setCertPass] = useState('');
  const [certBase64, setCertBase64] = useState('');
  const [certName, setCertName] = useState('');
  const [isSavingCert, setIsSavingCert] = useState(false);

  const handleConfigurarCertificado = async () => {
    if (!certBase64 || !certPass) return;
    setIsSavingCert(true);
    try {
      const res = await facturacionConfigurarCertificadoAction(certPass, certBase64);
      if (res?.success) {
        setCertPass(''); setCertBase64(''); setCertName('');
      }
    } finally { setIsSavingCert(false); }
  };

  useEffect(() => { setLocalUIT(String(currentCompany.annualIncomeUIT || 0)); }, [currentCompany.ruc, currentCompany.annualIncomeUIT]);

  const totalSales = useMemo(() => localSales.reduce((acc, s) => acc + s.total, 0), [localSales]);
  const totalPurchases = useMemo(() => localPurchases.reduce((acc, p) => acc + p.total, 0), [localPurchases]);
  const igvSales = useMemo(() => localSales.reduce((acc, s) => acc + s.igv, 0), [localSales]);
  const igvPurchases = useMemo(() => localPurchases.reduce((acc, p) => {
    if (p.spot_monto && p.spot_monto > 0 && (!p.spot_constancia || !p.spot_fecha)) return acc;
    return acc + p.igv;
  }, 0), [localPurchases]);
  const estimatedIgv = igvSales - igvPurchases;

  // Recent activity (Compact: Exactly top 3 items)
  const recentOps = useMemo(() => {
    const ops: { type: string; label: string; amount: number; date: string; icon: any }[] = [];
    localSales.slice(-3).forEach(s => ops.push({ type: 'venta', label: s.glosa || `Venta ${s.serie}-${s.numero}`, amount: s.total, date: s.fecha, icon: Tag }));
    localPurchases.slice(-3).forEach(p => ops.push({ type: 'compra', label: p.glosa || `Compra ${p.serie}-${p.numero}`, amount: p.total, date: p.fecha, icon: ShoppingCart }));
    honorarios.slice(-2).forEach(h => ops.push({ type: 'honorario', label: h.nombre || `Honorario ${h.serie}-${h.numero}`, amount: h.total, date: h.fecha, icon: ReceiptText }));
    asientos.slice(-3).forEach(a => {
      const amount = a.lines?.reduce((sum, line) => sum + (line.debe || 0), 0) || 0;
      ops.push({ type: 'asiento', label: a.header?.glosa || 'Asiento Manual', amount, date: a.header?.fecEmi || '', icon: BookText });
    });
    return ops.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
  }, [localSales, localPurchases, honorarios, asientos]);

  // ─── Métricas Reales Conectadas a la Base de Datos ───
  const realClientsCount = useMemo(() => {
    const clients = new Set<string>();
    entities.forEach(e => {
      if (e.tipo === 'cliente' || e.tipo === 'ambos') {
        if (e.ruc) clients.add(e.ruc);
        else if (e.descripcion) clients.add(e.descripcion);
        else if (e.id) clients.add(String(e.id));
      }
    });
    localSales.forEach(s => {
      if (s.doc_num) clients.add(s.doc_num);
      else if (s.nombre) clients.add(s.nombre);
    });
    return clients.size || (localSales.length > 0 ? 1 : 0);
  }, [entities, localSales]);

  const realProvidersCount = useMemo(() => {
    const providers = new Set<string>();
    entities.forEach(e => {
      if (e.tipo === 'proveedor' || e.tipo === 'ambos') {
        if (e.ruc) providers.add(e.ruc);
        else if (e.descripcion) providers.add(e.descripcion);
        else if (e.id) providers.add(String(e.id));
      }
    });
    localPurchases.forEach(p => {
      if (p.doc_num) providers.add(p.doc_num);
      else if (p.nombre) providers.add(p.nombre);
    });
    return providers.size || (localPurchases.length > 0 ? 1 : 0);
  }, [entities, localPurchases]);

  const realRequiredBooksCount = useMemo(() => {
    const r = currentCompany.regimenTributario || 'RG';
    const s = currentCompany.businessType || 'COMERCIAL';
    const i = Number(currentCompany.annualIncomeUIT || 0);
    const valorUIT = 5500.00;
    const ingresosSoles = i * valorUIT;
    const obligaciones = calcularObligacionesContables(r, s, ingresosSoles, valorUIT);

    let count = 0;
    if (obligaciones.registroVentas) count++;
    if (obligaciones.registroCompras) count++;
    if (obligaciones.libroDiarioSimplificado || obligaciones.libroDiarioCompleto) count++;
    if (obligaciones.libroMayor) count++;
    if (obligaciones.libroCajaBancos) count++;
    if (obligaciones.libroInventariosBalances) count++;
    if (obligaciones.kardexFisico) count++;
    if (obligaciones.kardexValorizado) count++;
    if (obligaciones.registroCostos) count++;
    return Math.max(count, r === 'NRUS' ? 0 : 2);
  }, [currentCompany]);

  const realIssuedVouchersCount = useMemo(() => {
    return periodSales.length;
  }, [periodSales]);

  const handleRucChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    updateCompany({ ruc: value });
    setFetchSuccess(false);
    if (value.length === 11) {
      setIsSearchingRuc(true);
      try {
        const data = await apiService.consultarRUC(value);
        if (data && data.razonSocial) {
          const loc = [data.departamento, data.provincia, data.distrito].filter(Boolean).join(' - ');
          updateCompany({ name: data.razonSocial, address: data.direccion || currentCompany.address, location: loc || currentCompany.location });
          setFetchSuccess(true);
          setTimeout(() => setFetchSuccess(false), 3000);
        }
      } catch { /* silent */ } finally { setIsSearchingRuc(false); }
    }
  };

  // ─── Calendario Tributario SUNAT 2026 Oficial por Último Dígito de RUC ───
  const baseProximoIndex = useMemo(() => {
    return getProximoPeriodoIndex(
      currentCompany.ruc,
      !!currentCompany.agente_retencion,
      new Date()
    );
  }, [currentCompany.ruc, currentCompany.agente_retencion]);

  const activeTaxPeriodIndex = useMemo(() => {
    return ((baseProximoIndex + selectedCalendarMonthOffset) % 12 + 12) % 12;
  }, [baseProximoIndex, selectedCalendarMonthOffset]);

  const taxCalendarInfo = useMemo(() => {
    return calcularVencimientoSunat(
      currentCompany.ruc,
      activeTaxPeriodIndex,
      !!currentCompany.agente_retencion,
      new Date()
    );
  }, [currentCompany.ruc, activeTaxPeriodIndex, currentCompany.agente_retencion]);

  const evaluation = useMemo(() => {
    const rawRegime = currentCompany.regimenTributario || 'RG';
    const regimeCode = (rawRegime === 'MYPE' ? 'RMT' : rawRegime) as any;
    const uitVal = getUIT(currentCompany.period || '2026');
    const annualRev = (Number(currentCompany.annualIncomeUIT) || 0) * uitVal || totalSales;
    const monthlyRev = periodSales.reduce((acc, s) => acc + (s.bi || s.total || 0), 0);
    const annualPurch = totalPurchases;
    const monthlyPurch = periodPurchases.reduce((acc, p) => acc + (p.bi || p.total || 0), 0);

    const financials: CompanyFinancials = {
      annualRevenue: annualRev,
      monthlyRevenue: monthlyRev,
      annualPurchases: annualPurch,
      monthlyPurchases: monthlyPurch,
      fixedAssetsValue: currentCompany.fixedAssetsValue || 0,
      employeeCount: currentCompany.employeeCount || 0,
      ciiuCode: currentCompany.ciiuCode || '',
    };

    return evaluateRegime(regimeCode, financials);
  }, [currentCompany, totalSales, totalPurchases, periodSales, periodPurchases]);

  const nrusCalculo = useMemo(() => {
    const mayor = Math.max(nrusIngresos || 0, nrusCompras || 0);
    if (mayor <= 5000) return { cuota: 20.0, categoria: 1, mensaje: 'Categoría 1 (Hasta S/ 5,000)' };
    if (mayor <= 8000) return { cuota: 50.0, categoria: 2, mensaje: 'Categoría 2 (Hasta S/ 8,000)' };
    return { cuota: 0, categoria: 0, mensaje: 'Excede el límite del NRUS (S/ 8,000 / mes)' };
  }, [nrusIngresos, nrusCompras]);

  const rerCalculo = useMemo(() => {
    const biVentas = periodSales.reduce((acc, s) => acc + (s.bi || s.total || 0), 0);
    const igvV = periodSales.reduce((acc, s) => acc + s.igv, 0);
    const igvC = periodPurchases.reduce((acc, p) => acc + p.igv, 0);
    const renta = biVentas * 0.015;
    const igvPagar = Math.max(0, igvV - igvC);
    return { renta, igv: igvPagar, total: renta + igvPagar };
  }, [periodSales, periodPurchases]);

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
        <div className="max-w-7xl mx-auto p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">

          {/* ═══ HEADER ROW: TÍTULO Y ACCIONES RÁPIDAS ═══ */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-app-text">
                PANEL DE CONTROL
              </h1>
              <div className="flex items-center gap-1.5 text-xs font-bold text-app-muted mt-0.5">
                <span>{currentCompany.name || 'EMPRESA REGISTRADA'} — Periodo {currentCompany.period || new Date().getFullYear()}</span>
                <ChevronDown size={14} className="text-app-muted cursor-pointer hover:text-app-text" />
              </div>
            </div>

            {/* Quick Action Pill Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab('COMPRAS')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-2xs cursor-pointer active:scale-95"
              >
                <ShoppingCart size={14} />
                <span>+ COMPRA</span>
              </button>
              <button
                onClick={() => setActiveTab('VENTAS')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs cursor-pointer active:scale-95"
              >
                <Tag size={14} />
                <span>+ VENTA</span>
              </button>
              <button
                onClick={() => setActiveTab('ASIENTOS')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs cursor-pointer active:scale-95"
              >
                <BookText size={14} />
                <span>+ ASIENTO</span>
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: 4 TARJETAS KPI CON SPARKLINES EN ONDAS 100% REALES
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">

            {/* 1. Ventas Card */}
            <div
              onClick={() => setActiveTab('VENTAS')}
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <TrendingUp size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase">Ventas</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-app-text">{formatCurrency(totalSales)}</h3>
                <div className="mt-1">
                  <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {localSales.length} registros
                  </span>
                </div>
              </div>

              {/* Sparkline Wave SVG Reactivo con Datos Reales */}
              <div className="mt-2 relative h-7 w-full overflow-hidden">
                <svg viewBox="0 0 200 30" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparklineGreenReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={salesSparkline.areaPath} fill="url(#sparklineGreenReal)" />
                  <path d={salesSparkline.strokePath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex justify-end pt-1">
                <span className="text-[9.5px] font-bold text-app-muted group-hover:text-emerald-500 transition-colors flex items-center gap-0.5">
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

            {/* 2. Compras Card */}
            <div
              onClick={() => setActiveTab('COMPRAS')}
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                    <ShoppingBag size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase">Compras</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-app-text">{formatCurrency(totalPurchases)}</h3>
                <div className="mt-1">
                  <span className="text-[9px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
                    {localPurchases.length} registros
                  </span>
                </div>
              </div>

              {/* Sparkline Wave SVG Reactivo con Datos Reales */}
              <div className="mt-2 relative h-7 w-full overflow-hidden">
                <svg viewBox="0 0 200 30" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparklinePurpleReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={purchasesSparkline.areaPath} fill="url(#sparklinePurpleReal)" />
                  <path d={purchasesSparkline.strokePath} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex justify-end pt-1">
                <span className="text-[9.5px] font-bold text-app-muted group-hover:text-purple-500 transition-colors flex items-center gap-0.5">
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

            {/* 3. IGV Estimado Card */}
            <div
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 sm:p-4 shadow-sm transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Wallet size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase">IGV Estimado</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-app-text">{formatCurrency(estimatedIgv)}</h3>
                <div className="mt-1">
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${estimatedIgv > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                    {estimatedIgv > 0 ? 'Por Pagar' : 'Saldo a Favor'}
                  </span>
                </div>
              </div>

              {/* Sparkline Wave SVG Reactivo con Datos Reales */}
              <div className="mt-2 relative h-7 w-full overflow-hidden">
                <svg viewBox="0 0 200 30" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparklineOrangeReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={igvSparkline.areaPath} fill="url(#sparklineOrangeReal)" />
                  <path d={igvSparkline.strokePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex justify-end pt-1">
                <span className="text-[9.5px] font-bold text-app-muted hover:text-amber-500 transition-colors flex items-center gap-0.5 cursor-pointer" onClick={() => setActiveTab('TRIBUTARIO')}>
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

            {/* 4. Resumen Card */}
            <div
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 sm:p-4 shadow-sm transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Activity size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase">Resumen</span>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-app-muted font-medium text-[10px]">Asientos</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px]">{asientos.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-app-muted font-medium text-[10px]">Honorarios</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px]">{honorarios.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-app-muted font-medium text-[10px]">Mov. Diario</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px]">{journal.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-app-muted font-medium text-[10px]">Directorio</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-[11px]">{entities.length}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <span className="text-[9.5px] font-bold text-app-muted hover:text-blue-500 transition-colors flex items-center gap-0.5 cursor-pointer" onClick={() => setActiveTab('ASIENTOS')}>
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 2: SECCIÓN CENTRAL (IZQ: ACTIVIDAD Y BARRAS, DER: ACCESOS Y CALENDARIO)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

            {/* ─── COLUMNA IZQUIERDA (2 COLS EN LG) ─── */}
            <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">

              {/* 1. ÚLTIMAS OPERACIONES (COMPACTO - 3 ITEMS) */}
              <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                    <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Últimas Operaciones</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('COMPRAS')}
                    className="px-2 py-0.5 text-[9.5px] font-bold text-app-muted hover:text-app-text bg-app-bg hover:bg-app-hover border border-app-border rounded-lg transition-colors uppercase cursor-pointer"
                  >
                    Ver todas
                  </button>
                </div>

                {recentOps.length > 0 ? (
                  <div className="divide-y divide-app-border/40">
                    {recentOps.map((op, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-app-hover transition-colors">
                        <div className={`p-1.5 rounded-lg shrink-0 ${op.type === 'venta' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            op.type === 'compra' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                              op.type === 'honorario' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}>
                          <op.icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-app-text uppercase truncate">{op.type}: {op.label}</p>
                          <p className="text-[9.5px] text-app-muted font-mono">{op.date || '—'}</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-app-text shrink-0">{formatCurrency(op.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="p-1.5 bg-purple-500/10 text-purple-600 rounded-lg">
                      <ShoppingCart size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-app-text uppercase truncate">COMPRA: POR LA COMPRA DE MERCADERIA</p>
                      <p className="text-[9.5px] text-app-muted font-mono">2026-08-13</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-app-text shrink-0">S/ 1,000.00</span>
                  </div>
                )}
              </div>

              {/* 2. RESUMEN MENSUAL DE VENTAS Y COMPRAS CON SELECTOR INTERACTIVO DE AÑO */}
              <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-app-border">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                    <span>Resumen Mensual de Ventas y Compras</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[9.5px] font-bold">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" /> Ventas (S/)
                      </span>
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <span className="w-2 h-2 rounded-xs bg-purple-600 inline-block" /> Compras (S/)
                      </span>
                    </div>

                    {/* SELECTOR INTERACTIVO DE AÑO */}
                    <div className="relative inline-flex items-center">
                      <select
                        value={selectedChartYear}
                        onChange={(e) => setSelectedChartYear(e.target.value)}
                        className="appearance-none bg-app-bg border border-app-border text-app-text text-[10px] font-extrabold uppercase rounded-lg pl-2.5 pr-6 py-1 outline-none cursor-pointer hover:border-blue-500 transition-colors shadow-2xs"
                      >
                        {Array.from({ length: 16 }, (_, i) => 2020 + i).map(year => (
                          <option key={year} value={year.toString()}>{year}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="absolute right-1.5 text-app-muted pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* SVG Bar Chart (Calculado dinámicamente con selectedChartYear) */}
                <div className="mt-4 w-full">
                  <div className="flex items-end gap-1.5 sm:gap-2 h-32 sm:h-36 pt-4 pb-1 border-b border-app-border/70 relative">
                    {/* Background Guideline Lines */}
                    <div className="absolute inset-x-0 top-0 border-b border-dashed border-app-border/40 text-[8.5px] text-app-muted font-mono pl-1">1.5M</div>
                    <div className="absolute inset-x-0 top-1/3 border-b border-dashed border-app-border/40 text-[8.5px] text-app-muted font-mono pl-1">1M</div>
                    <div className="absolute inset-x-0 top-2/3 border-b border-dashed border-app-border/40 text-[8.5px] text-app-muted font-mono pl-1">500K</div>

                    {MONTH_NAMES_SHORT.map((monthName, idx) => {
                      const salesVal = monthlyData.salesByMonth[idx];
                      const purchasesVal = monthlyData.purchasesByMonth[idx];

                      const salesHeight = salesVal > 0 ? Math.max(8, Math.min(85, (salesVal / monthlyData.maxVal) * 85)) : 2;
                      const purchasesHeight = purchasesVal > 0 ? Math.max(8, Math.min(85, (purchasesVal / monthlyData.maxVal) * 85)) : 2;

                      return (
                        <div key={monthName} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          {/* Tooltip on Hover */}
                          <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8.5px] font-mono py-1 px-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                            V: {formatCurrency(salesVal)} | C: {formatCurrency(purchasesVal)}
                          </div>

                          {/* Dual Bar Container */}
                          <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                            <div
                              style={{ height: `${salesHeight}%` }}
                              className={`w-1.5 sm:w-2.5 rounded-t-xs transition-all duration-500 ${salesVal > 0 ? 'bg-emerald-500 group-hover:brightness-110' : 'bg-emerald-500/20'}`}
                            />
                            <div
                              style={{ height: `${purchasesHeight}%` }}
                              className={`w-1.5 sm:w-2.5 rounded-t-xs transition-all duration-500 ${purchasesVal > 0 ? 'bg-purple-600 group-hover:brightness-110' : 'bg-purple-600/20'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X Axis Month Labels */}
                  <div className="flex justify-between items-center pt-1.5">
                    {MONTH_NAMES_SHORT.map((monthName) => (
                      <span key={monthName} className="flex-1 text-center text-[8.5px] sm:text-[9.5px] font-bold text-app-muted uppercase">
                        {monthName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* ─── COLUMNA DERECHA (1 COL EN LG) ─── */}
            <div className="flex flex-col gap-4 sm:gap-5">

              {/* 1. ACCESO RÁPIDO */}
              <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b border-app-border">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                    <Zap size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>Acceso Rápido</span>
                  </h3>
                </div>
                <div className="p-2 space-y-1">
                  {[
                    { label: 'Registro de Compras', icon: ShoppingCart, tab: 'COMPRAS', desc: 'Ingresar nueva compra' },
                    { label: 'Registro de Ventas', icon: Tag, tab: 'VENTAS', desc: 'Ingresar nueva venta' },
                    { label: 'Asientos Contables', icon: BookText, tab: 'ASIENTOS', desc: 'Crear asiento manual' },
                    { label: 'Libro Diario', icon: BookOpen, tab: 'DIARIO', desc: 'Ver movimientos registrados' },
                  ].map(item => (
                    <button
                      key={item.tab}
                      onClick={() => setActiveTab(item.tab)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-app-hover transition-all group cursor-pointer"
                    >
                      <div className="p-1.5 bg-app-bg rounded-lg text-app-muted group-hover:text-blue-600 dark:group-hover:text-blue-400 border border-app-border/60 transition-colors shrink-0">
                        <item.icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-app-text group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.label}</p>
                        <p className="text-[9.5px] text-app-muted truncate">{item.desc}</p>
                      </div>
                      <ChevronRight size={12} className="text-app-border group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. CALENDARIO TRIBUTARIO SUNAT 2026 OFICIAL POR ÚLTIMO DÍGITO DEL RUC */}
              <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-app-border">
                    <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                      <Calendar size={14} className="text-blue-600 dark:text-blue-400" />
                      <span>Calendario Tributario</span>
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedCalendarMonthOffset(selectedCalendarMonthOffset - 1)}
                        className="p-1 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors cursor-pointer"
                        title="Mes anterior"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <button
                        onClick={() => setSelectedCalendarMonthOffset(selectedCalendarMonthOffset + 1)}
                        className="p-1 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors cursor-pointer"
                        title="Mes siguiente"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[9.5px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                        {taxCalendarInfo.mesNombre}
                      </p>
                      <span className="text-[8.5px] font-bold text-app-muted uppercase">
                        RUC: {currentCompany.ruc ? `Termina en ${taxCalendarInfo.ultimoDigito}` : 'General (Dígito 0)'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 bg-app-bg/60 border border-app-border p-2.5 rounded-xl">
                      {/* Date Badge */}
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <span className="text-base font-black leading-none">{taxCalendarInfo.diaVencimiento}</span>
                        <span className="text-[8px] font-black tracking-wider uppercase mt-0.5">{taxCalendarInfo.mesVencimientoNombre}</span>
                      </div>

                      {/* Info & Badges */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-app-text uppercase truncate">IGV - OPERACIONES MENSUALES</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[8.5px] text-app-muted font-bold">Formulario 621</span>
                          <span className="text-[8px] text-app-muted/60">•</span>
                          <span className="text-[8.5px] text-blue-600 dark:text-blue-400 font-bold uppercase">Periodo {taxCalendarInfo.periodoDeclarado}</span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded-md border ${taxCalendarInfo.estadoBadge === 'vencido'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : taxCalendarInfo.estadoBadge === 'vence_hoy' || taxCalendarInfo.estadoBadge === 'vence_pronto'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            }`}>
                            {taxCalendarInfo.textoEstadoBadge}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-app-border flex justify-between items-center text-[9.5px]">
                  <span className="text-app-muted font-medium">Vencimiento: {taxCalendarInfo.fechaVencimientoCompleta}</span>
                  <span className={`font-black ${taxCalendarInfo.estadoBadge === 'vencido' ? 'text-rose-500' : 'text-app-text'}`}>
                    {taxCalendarInfo.textoDias}
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 3: TARJETAS DE RESUMEN INFERIOR (100% DATOS REALES DE BD)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">

            {/* 1. Clientes Activos (Dato Real) */}
            <div
              onClick={() => setActiveTab('CLI_PRO')}
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                  <Users size={18} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[9.5px] font-black tracking-widest text-app-muted uppercase block">Clientes Activos</span>
                  <h4 className="text-lg sm:text-xl font-black text-app-text mt-0.5">{realClientsCount}</h4>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <span className="text-[9px] font-bold text-app-muted group-hover:text-blue-500 transition-colors flex items-center gap-0.5">
                  Ver detalle <ChevronRight size={9} />
                </span>
              </div>
            </div>

            {/* 2. Proveedores (Dato Real) */}
            <div
              onClick={() => setActiveTab('CLI_PRO')}
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                  <Briefcase size={18} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[9.5px] font-black tracking-widest text-app-muted uppercase block">Proveedores</span>
                  <h4 className="text-lg sm:text-xl font-black text-app-text mt-0.5">{realProvidersCount}</h4>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <span className="text-[9px] font-bold text-app-muted group-hover:text-emerald-500 transition-colors flex items-center gap-0.5">
                  Ver detalle <ChevronRight size={9} />
                </span>
              </div>
            </div>

            {/* 3. Libros Electrónicos (Dato Real según SUNAT) */}
            <div
              onClick={() => setActiveTab('SIRE')}
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                  <FileText size={18} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[9.5px] font-black tracking-widest text-app-muted uppercase block">Libros Electrónicos</span>
                  <h4 className="text-lg sm:text-xl font-black text-app-text mt-0.5">{realRequiredBooksCount}</h4>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <span className="text-[9px] font-bold text-app-muted group-hover:text-purple-500 transition-colors flex items-center gap-0.5">
                  Ver detalle <ChevronRight size={9} />
                </span>
              </div>
            </div>

            {/* 4. Comprobantes Emitidos (Dato Real de Ventas de la BD) */}
            <div
              onClick={() => setActiveTab('VENTAS')}
              className="bg-app-surface border border-app-border rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                  <ReceiptText size={18} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[9.5px] font-black tracking-widest text-app-muted uppercase block">Comprobantes Emitidos</span>
                  <h4 className="text-lg sm:text-xl font-black text-app-text mt-0.5">
                    {realIssuedVouchersCount}
                  </h4>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <span className="text-[9px] font-bold text-app-muted group-hover:text-amber-500 transition-colors flex items-center gap-0.5">
                  Ver detalle <ChevronRight size={9} />
                </span>
              </div>
            </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              PARÁMETROS DE LA ENTIDAD Y CONFIGURACIÓN (RESTAURADO COMPLETO)
             ═══════════════════════════════════════════════════════════════ */}
          <div id="company-config-section" className="scroll-mt-4 pt-1">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-app-muted hover:text-blue-600 transition-colors mb-2 cursor-pointer"
            >
              <Settings size={14} />
              <span>Parámetros de la Entidad y Configuración</span>
              <ChevronRight size={13} className={`transition-transform duration-200 ${showConfig ? 'rotate-90' : ''}`} />
            </button>

            {showConfig && (
              <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm animate-slide-up space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                  {/* Formulario Principal (Left 8 cols) */}
                  <div className="lg:col-span-8 space-y-5">

                    {/* Fila 1: RUC & Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-1.5 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <Hash size={12} className="text-blue-600" /> RUC
                        </label>
                        <div className="relative">
                          <input id="empresa-ruc-input" type="text" value={currentCompany.ruc} onChange={handleRucChange}
                            placeholder="Ingrese RUC..." maxLength={11}
                            className="w-full text-xs font-mono tracking-wider pr-10 p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                          {isSearchingRuc && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />}
                          {fetchSuccess && !isSearchingRuc && <CheckCircle2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <Building2 size={12} className="text-blue-600" /> Razón Social
                        </label>
                        <input type="text" value={currentCompany.name}
                          onChange={(e) => updateCompany({ name: e.target.value })}
                          className="w-full text-xs font-bold p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    {/* Fila 2: Dirección y Ubicación */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <MapPinHouse size={12} className="text-blue-600" /> Domicilio Fiscal
                        </label>
                        <input type="text" value={currentCompany.address}
                          onChange={(e) => updateCompany({ address: e.target.value })}
                          className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <MapPin size={12} className="text-blue-600" /> Ubicación (Dep - Prov - Dist)
                        </label>
                        <input type="text" value={currentCompany.location}
                          onChange={(e) => updateCompany({ location: e.target.value })}
                          className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    {/* Fila 3: Periodo, Régimen, Rubro & Ingresos UIT */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <CalendarDays size={12} className="text-blue-600" /> Periodo Contable
                        </label>
                        <select value={currentCompany.period || '2026'}
                          onChange={(e) => updateCompany({ period: e.target.value })}
                          className="w-full text-xs font-bold p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none">
                          {Array.from({ length: 16 }, (_, i) => 2020 + i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <Shield size={12} className="text-blue-600" /> Régimen Tributario
                        </label>
                        <select value={currentCompany.regimenTributario || 'RG'}
                          onChange={(e) => updateCompany({ regimenTributario: e.target.value as RegimenCode })}
                          className="w-full text-xs font-bold p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none">
                          {REGIMENES_TRIBUTARIOS.map(r => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 mt-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!currentCompany.agente_retencion}
                            onChange={(e) => updateCompany({ agente_retencion: e.target.checked })}
                            className="rounded border-app-border text-blue-600 focus:ring-blue-500 h-3 w-3"
                          />
                          <span className="text-[9px] font-black uppercase tracking-wider text-app-muted">Agente de Retención</span>
                        </label>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <Activity size={12} className="text-blue-600" /> Rubro / Sector
                        </label>
                        <select value={currentCompany.businessType || 'COMERCIAL'}
                          onChange={(e) => updateCompany({ businessType: e.target.value as any })}
                          className="w-full text-xs font-bold p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none">
                          <option value="COMERCIAL">COMERCIAL</option>
                          <option value="MANUFACTURERA">MANUFACTURERA</option>
                          <option value="SERVICIOS">SERVICIOS</option>
                        </select>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <Calculator size={12} className="text-blue-600" /> Ingresos (UIT)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={localUIT}
                            onChange={(e) => setLocalUIT(e.target.value)}
                            onBlur={() => {
                              const val = Math.max(0, parseFloat(localUIT) || 0);
                              if (val !== currentCompany.annualIncomeUIT) updateCompany({ annualIncomeUIT: val });
                            }}
                            className="w-full text-xs font-bold pr-10 p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                          />
                          <span className="absolute right-2.5 text-[9px] font-bold text-app-muted select-none">UIT</span>
                        </div>
                        <span className="text-[8.5px] text-app-muted">
                          Equiv: S/ {((parseFloat(localUIT) || 0) * getUIT(currentCompany.period || '2026')).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Fila 4: CIIU, Activos Fijos & Trabajadores */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <Hash size={12} className="text-blue-600" /> Código CIIU
                        </label>
                        <input
                          type="text"
                          maxLength={4}
                          value={currentCompany.ciiuCode || ''}
                          onChange={(e) => updateCompany({ ciiuCode: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          placeholder="Ej: 6920"
                          className="w-full text-xs font-mono p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                        />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <Wallet size={12} className="text-blue-600" /> Activos Fijos (S/)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentCompany.fixedAssetsValue === undefined ? '' : currentCompany.fixedAssetsValue}
                          onChange={(e) => updateCompany({ fixedAssetsValue: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })}
                          placeholder="0.00"
                          className="w-full text-xs font-bold p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                        />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-1.5">
                          <Users size={12} className="text-blue-600" /> Trabajadores
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentCompany.employeeCount === undefined ? '' : currentCompany.employeeCount}
                          onChange={(e) => updateCompany({ employeeCount: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0) })}
                          placeholder="0"
                          className="w-full text-xs font-bold p-2 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                        />
                      </div>
                    </div>

                    {/* Régimen Info & Dynamic Obligations Engine */}
                    {(() => {
                      const r = currentCompany.regimenTributario || 'RG';
                      const s = currentCompany.businessType || 'COMERCIAL';
                      const i = Number(currentCompany.annualIncomeUIT || 0);

                      const getObligationsList = () => {
                        const valorUIT = 5500.00;
                        const ingresosSoles = i * valorUIT;
                        const tramosUit = i;
                        const obligaciones = calcularObligacionesContables(r, s, ingresosSoles, valorUIT);

                        let message = '';
                        let isRed = false;

                        if (r === 'NRUS') {
                          message = "El Nuevo RUS no exige llevar libros contables. Solo conserva tus comprobantes de pago de compras y ventas.";
                          isRed = true;
                        } else if (r === 'RER') {
                          message = "El Régimen Especial de Renta (RER) solo exige llevar 2 registros obligatorios (Ventas y Compras), sin distinción de ingresos.";
                        } else if (r === 'MYPE') {
                          if (tramosUit <= 300) message = "Régimen MYPE (≤ 300 UIT - Tramo 1): Pago a cuenta del Impuesto a la Renta de 1.0% sobre Ingresos Netos. Obligación simplificada (Ventas, Compras y Libro Diario Simplificado).";
                          else if (tramosUit <= 500) message = "Régimen MYPE (> 300 a ≤ 500 UIT - Tramo 2): Pago a cuenta del Impuesto a la Renta de 1.5% o coeficiente. Obligado a llevar Libro Diario Completo y Libro Mayor.";
                          else message = "Régimen MYPE (> 500 UIT - Tramo 2): Pago a cuenta del Impuesto a la Renta de 1.5% o coeficiente. Contabilidad Completa (hasta 1,700 UIT).";
                        } else if (r === 'RG') {
                          if (tramosUit <= 300) message = "Régimen General (≤ 300 UIT): Obligación simplificada (Ventas, Compras y Libro Diario Simplificado).";
                          else if (tramosUit <= 500) message = "Régimen General (> 300 a ≤ 500 UIT): Obligado a llevar Libro Diario Completo y Libro Mayor.";
                          else if (tramosUit <= 1700) message = "Régimen General (> 500 a ≤ 1,700 UIT): Contabilidad Completa Básica.";
                          else message = "Régimen General (> 1,700 UIT): Contabilidad Completa Integral (Incluye Caja y Bancos).";
                        }

                        return {
                          message,
                          isRed,
                          books: [
                            { name: 'Registro de Ventas e Ingresos', required: obligaciones.registroVentas },
                            { name: 'Registro de Compras', required: obligaciones.registroCompras },
                            { name: 'Libro Diario (Simplificado)', required: obligaciones.libroDiarioSimplificado, note: 'Hasta 300 UIT' },
                            { name: 'Libro Diario (Completo)', required: obligaciones.libroDiarioCompleto },
                            { name: 'Libro Mayor', required: obligaciones.libroMayor },
                            { name: 'Libro Caja y Bancos', required: obligaciones.libroCajaBancos, note: 'Exclusivo > 1,700 UIT' },
                            { name: 'Libro de Inventarios y Balances', required: obligaciones.libroInventariosBalances },
                            { name: 'Registro de Activos Fijos', required: obligaciones.libroInventariosBalances, note: 'Anexo de Balances' },
                            { name: 'Balance de Comprobación', required: obligaciones.libroInventariosBalances, note: 'Inventarios y Balances' },
                            { name: 'Estado de Situación Financiera', required: obligaciones.libroInventariosBalances, note: 'Estados Financieros' },
                            { name: 'Estado de Resultados', required: obligaciones.libroInventariosBalances, note: 'Estados Financieros' },
                            { name: 'Inventario Permanente Unidades', required: obligaciones.kardexFisico, note: 'Comercio/Manuf > 500 UIT' },
                            { name: 'Inventario Permanente Valorizado', required: obligaciones.kardexValorizado, note: 'Comercio/Manuf > 1500 UIT' },
                            { name: 'Registro de Costos', required: obligaciones.registroCostos, note: 'Solo Manuf > 1500 UIT' }
                          ]
                        };
                      };

                      const currentRules = getObligationsList();

                      return (
                        <div className="flex flex-col gap-3.5 pt-2">
                          {/* Banner de Mensaje de Obligación */}
                          <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${currentRules.isRed
                            ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
                            : 'bg-blue-500/5 border-blue-500/15 text-app-text'
                            }`}>
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold leading-relaxed">{currentRules.message}</p>
                          </div>

                          {/* Alerts from Regime Evaluation Engine */}
                          {evaluation.alerts.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {evaluation.alerts.map((alert, idx) => (
                                <div key={idx} className={`flex items-start gap-2.5 p-3 rounded-xl border ${alert.level === 'CRITICAL'
                                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
                                  : alert.level === 'WARNING'
                                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
                                    : 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
                                  }`}>
                                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-current" />
                                  <div>
                                    <p className="text-xs font-bold leading-relaxed">{alert.message}</p>
                                    {alert.recommendation && (
                                      <p className="text-[10px] font-medium opacity-85 mt-0.5">Recomendación: {alert.recommendation}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Lista Detallada de Libros y Estados */}
                          <div className="bg-app-bg border border-app-border rounded-xl p-3.5">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-app-muted mb-2.5">
                              Estado de Obligación de Libros y Registros
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5">
                              {currentRules.books.map((b, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-app-border/40 last:border-0">
                                  <span className="font-medium text-app-text text-[11px]">{b.name}</span>
                                  <div className="flex items-center gap-1.5">
                                    {b.note && (
                                      <span className="text-[8px] uppercase tracking-wider font-bold text-app-muted bg-app-hover px-1.5 py-0.5 rounded border border-app-border">
                                        {b.note}
                                      </span>
                                    )}
                                    {b.required ? (
                                      <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-bold uppercase">
                                        ✓ Activo
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 bg-rose-500/10 text-rose-600 rounded-full text-[9px] font-bold uppercase">
                                        ✗ Omitido
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Panel Interactivo NRUS */}
                          {r === 'NRUS' && (
                            <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-3 animate-fade-in">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                                <Calculator size={13} /> Calculadora de Cuota Fija NRUS
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col space-y-1">
                                  <label className="text-[9.5px] uppercase font-bold text-app-muted">Ingresos Brutos del Mes (S/)</label>
                                  <input
                                    type="number"
                                    className="w-full text-xs font-mono font-bold bg-app-surface border border-app-border rounded-xl px-2.5 py-1.5 outline-none"
                                    value={nrusIngresos || ''}
                                    onChange={e => setNrusIngresos(Math.max(0, parseFloat(e.target.value) || 0))}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="flex flex-col space-y-1">
                                  <label className="text-[9.5px] uppercase font-bold text-app-muted">Compras del Mes (S/)</label>
                                  <input
                                    type="number"
                                    className="w-full text-xs font-mono font-bold bg-app-surface border border-app-border rounded-xl px-2.5 py-1.5 outline-none"
                                    value={nrusCompras || ''}
                                    onChange={e => setNrusCompras(Math.max(0, parseFloat(e.target.value) || 0))}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-lg">
                                <div>
                                  <p className="text-[9px] text-app-muted uppercase font-bold">Cuota a Pagar</p>
                                  <p className="text-xs font-black text-app-text">{nrusCalculo.mensaje}</p>
                                </div>
                                <span className="text-lg font-mono font-black text-blue-600">S/ {nrusCalculo.cuota.toFixed(2)}</span>
                              </div>
                            </div>
                          )}

                          {/* Panel Interactivo RER */}
                          {r === 'RER' && (
                            <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-3 animate-fade-in">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
                                <Calculator size={13} /> Panel de Obligaciones RER (Simplificado)
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
                                <div className="bg-app-surface border border-app-border p-2.5 rounded-lg">
                                  <p className="text-[8.5px] text-app-muted uppercase font-bold">Renta RER (1.5%)</p>
                                  <p className="text-sm font-mono font-black text-blue-600">S/ {rerCalculo.renta.toFixed(2)}</p>
                                </div>
                                <div className="bg-app-surface border border-app-border p-2.5 rounded-lg">
                                  <p className="text-[8.5px] text-app-muted uppercase font-bold">IGV a Pagar</p>
                                  <p className="text-sm font-mono font-black text-purple-600">S/ {rerCalculo.igv.toFixed(2)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-lg text-white">
                                  <p className="text-[8.5px] uppercase font-bold opacity-80">Total Tributo</p>
                                  <p className="text-sm font-mono font-black">S/ {rerCalculo.total.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Credenciales SOL & SIRE */}
                    <div className="space-y-3 pt-1">
                      <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        Integración API (SUNAT SOL & SIRE)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-app-bg/50 p-3.5 rounded-xl border border-app-border">
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9.5px] uppercase font-bold text-app-muted tracking-widest flex items-center gap-1.5">
                            Usuario SOL
                            <span className="text-[8.5px] bg-blue-500/10 text-blue-600 px-1.5 py-0.2 rounded-full border border-blue-500/20">Auto Buzón</span>
                          </label>
                          <input type="text" value={currentCompany.sol_user || ''}
                            onChange={(e) => updateCompany({ sol_user: e.target.value })} placeholder="Ej: MODDATOS"
                            className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-lg text-app-text outline-none" />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9.5px] uppercase font-bold text-app-muted tracking-widest">Clave SOL</label>
                          <input type="text" style={{ WebkitTextSecurity: 'disc' } as any} autoComplete="new-password" value={currentCompany.sol_pass || ''}
                            onChange={(e) => updateCompany({ sol_pass: e.target.value })} placeholder="••••••••••••"
                            className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-lg text-app-text outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-app-bg/50 p-3.5 rounded-xl border border-app-border">
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9.5px] uppercase font-bold text-app-muted tracking-widest flex items-center gap-1.5">
                            Client ID (SIRE)
                            <span className="text-[8.5px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 rounded-full border border-emerald-500/20">Auto SIRE</span>
                          </label>
                          <input type="text" value={currentCompany.sunatClientId || ''}
                            onChange={(e) => updateCompany({ sunatClientId: e.target.value })} placeholder="Ingrese Client ID..."
                            className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-lg text-app-text outline-none" />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9.5px] uppercase font-bold text-app-muted tracking-widest">Client Secret (SIRE)</label>
                          <input type="text" style={{ WebkitTextSecurity: 'disc' } as any} autoComplete="new-password" value={currentCompany.sunatClientSecret || ''}
                            onChange={(e) => updateCompany({ sunatClientSecret: e.target.value })} placeholder="••••••••••••"
                            className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-lg text-app-text outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Facturación Electrónica UBL 2.1 */}
                    <div className="space-y-3 pt-1">
                      <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        Facturación Electrónica (UBL 2.1)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-app-bg/50 p-3.5 rounded-xl border border-app-border">
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9.5px] uppercase font-bold text-app-muted tracking-widest">Certificado Digital (.pfx)</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => document.getElementById('cert-upload-input')?.click()}
                              className="px-3 py-1.5 bg-app-bg border border-app-border rounded-xl text-[9.5px] font-bold uppercase hover:border-blue-500/50 transition-colors cursor-pointer"
                            >
                              Seleccionar Certificado
                            </button>
                            <input
                              id="cert-upload-input"
                              type="file"
                              accept=".pfx"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    const base64 = (ev.target?.result as string).split(',')[1];
                                    setCertBase64(base64);
                                    setCertName(file.name);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            {certName && <span className="text-[9.5px] text-emerald-500 font-mono truncate max-w-[140px]">{certName}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <label className="text-[9.5px] uppercase font-bold text-app-muted tracking-widest">Contraseña del Certificado</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              style={{ WebkitTextSecurity: 'disc' } as any}
                              autoComplete="new-password"
                              value={certPass}
                              onChange={(e) => setCertPass(e.target.value)}
                              placeholder="Contraseña del PFX..."
                              className="flex-1 text-xs bg-app-bg border border-app-border rounded-xl px-2.5 outline-none"
                            />
                            <button
                              type="button"
                              disabled={!certBase64 || !certPass || isSavingCert}
                              onClick={handleConfigurarCertificado}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[9.5px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              {isSavingCert ? 'Guardando...' : 'Cargar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Logo Upload & Soporte (Right 4 cols) */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    {/* Logo Upload */}
                    <div
                      className="flex flex-col items-center justify-center p-5 bg-app-bg rounded-2xl border border-dashed border-app-border hover:border-blue-500/40 transition-colors relative group cursor-pointer overflow-hidden min-h-[180px]"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      <input id="logo-upload" type="file" accept="image/png, image/jpeg" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => updateCompany({ logoBase64: ev.target?.result as string });
                            reader.readAsDataURL(file);
                          }
                        }} />
                      {currentCompany.logoBase64 ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
                          <img src={currentCompany.logoBase64} alt="Logo" className="max-w-full max-h-[120px] object-contain" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <span className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-1.5"><Upload size={13} /> Cambiar</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); updateCompany({ logoBase64: undefined }); }}
                            className="absolute top-2 right-2 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-lg z-10 cursor-pointer">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-app-muted group-hover:text-blue-600 transition-colors">
                          <Building2 size={36} strokeWidth={1} />
                          <p className="text-xs font-bold uppercase tracking-widest">Subir Logotipo</p>
                          <p className="text-[9.5px] opacity-60">PNG o JPG</p>
                        </div>
                      )}
                    </div>

                    {/* Soporte */}
                    <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 rounded-2xl p-4.5 text-white shadow-lg relative overflow-hidden">
                      <div className="relative z-10 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <MessageCircleMore size={16} />
                          <h3 className="font-bold tracking-widest text-[9.5px] uppercase">Soporte Técnico</h3>
                        </div>
                        <p className="text-[9.5px] opacity-90 leading-tight">Enlace directo a atención y soporte contable.</p>
                        {isSupportSaved && currentCompany.support ? (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={currentCompany.support} target="_blank" rel="noopener noreferrer"
                              className="flex-1 text-center py-1.5 bg-white text-blue-600 text-[9.5px] font-black uppercase tracking-wider rounded-xl hover:bg-white/90 transition-colors shadow-sm">
                              Abrir Portal
                            </a>
                            <button onClick={() => { setSupportLinkDraft(currentCompany.support || ''); setIsSupportSaved(false); }}
                              className="p-1.5 bg-white/15 hover:bg-white/25 rounded-xl transition-colors cursor-pointer"><Settings size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 mt-1">
                            <input type="text" className="text-xs p-2 rounded-xl bg-black/20 border border-white/15 text-white placeholder-white/50 outline-none"
                              placeholder="URL del portal..." value={!isSupportSaved ? supportLinkDraft : (currentCompany.support || '')}
                              onChange={(e) => { setSupportLinkDraft(e.target.value); setIsSupportSaved(false); }} />
                            <button disabled={!supportLinkDraft.trim()}
                              onClick={() => { if (supportLinkDraft.trim()) { updateCompany({ support: supportLinkDraft.trim() }); setIsSupportSaved(true); } }}
                              className="py-1.5 bg-white text-blue-700 text-[9.5px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 cursor-pointer shadow-sm">
                              Guardar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white/10 blur-2xl rounded-full" />
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default EmpresaView;
