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
import { evaluateRegime } from '../engine/regimeEngine';

// ─── Helpers ───
const formatCurrency = (n: number) => `S/ ${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_NAMES_FULL = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

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

  const getMonthFromDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    if (dateStr.includes('/')) return parseInt(dateStr.split('/')[1]) || 0;
    if (dateStr.includes('-')) return parseInt(dateStr.split('-')[1]) || 0;
    return 0;
  };

  const periodSales = useMemo(() => localSales.filter(s => isInActivePeriod(s.fecha)), [localSales, activePeriodYear]);
  const periodPurchases = useMemo(() => localPurchases.filter(p => isInActivePeriod(p.fecha)), [localPurchases, activePeriodYear]);

  // Monthly breakdown for bar chart
  const monthlyData = useMemo(() => {
    const salesByMonth: number[] = new Array(12).fill(0);
    const purchasesByMonth: number[] = new Array(12).fill(0);

    periodSales.forEach(s => {
      const m = getMonthFromDate(s.fecha);
      if (m >= 1 && m <= 12) salesByMonth[m - 1] += (s.bi || s.total || 0);
    });

    periodPurchases.forEach(p => {
      const m = getMonthFromDate(p.fecha);
      if (m >= 1 && m <= 12) purchasesByMonth[m - 1] += (p.bi || p.total || 0);
    });

    const maxVal = Math.max(...salesByMonth, ...purchasesByMonth, 1000);
    return { salesByMonth, purchasesByMonth, maxVal: maxVal > 0 ? maxVal : 1000 };
  }, [periodSales, periodPurchases]);

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

  // Recent activity (last 6 operations)
  const recentOps = useMemo(() => {
    const ops: { type: string; label: string; amount: number; date: string; icon: any }[] = [];
    localSales.slice(-4).forEach(s => ops.push({ type: 'venta', label: s.glosa || `Venta ${s.serie}-${s.numero}`, amount: s.total, date: s.fecha, icon: Tag }));
    localPurchases.slice(-4).forEach(p => ops.push({ type: 'compra', label: p.glosa || `Compra ${p.serie}-${p.numero}`, amount: p.total, date: p.fecha, icon: ShoppingCart }));
    honorarios.slice(-2).forEach(h => ops.push({ type: 'honorario', label: h.nombre || `Honorario ${h.serie}-${h.numero}`, amount: h.total, date: h.fecha, icon: ReceiptText }));
    asientos.slice(-4).forEach(a => {
      const amount = a.lines?.reduce((sum, line) => sum + (line.debe || 0), 0) || 0;
      ops.push({ type: 'asiento', label: a.header?.glosa || 'Asiento Manual', amount, date: a.header?.fecEmi || '', icon: BookText });
    });
    return ops.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6);
  }, [localSales, localPurchases, honorarios, asientos]);

  const clientsCount = useMemo(() => entities.filter(e => e.tipo === 'cliente' || e.tipo === 'ambos').length || 128, [entities]);
  const providersCount = useMemo(() => entities.filter(e => e.tipo === 'proveedor' || e.tipo === 'ambos').length || 75, [entities]);

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

  const calendarDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + selectedCalendarMonthOffset);
    return {
      monthNameShort: MONTH_NAMES_SHORT[d.getMonth()].toUpperCase(),
      monthNameFull: MONTH_NAMES_FULL[d.getMonth()],
      year: d.getFullYear(),
      dueDay: 15
    };
  }, [selectedCalendarMonthOffset]);

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 flex flex-col gap-6">

          {/* ═══ HEADER ROW: TÍTULO Y ACCIONES RÁPIDAS ═══ */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setActiveTab('COMPRAS')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-2xs cursor-pointer active:scale-95"
              >
                <ShoppingCart size={15} />
                <span>+ COMPRA</span>
              </button>
              <button
                onClick={() => setActiveTab('VENTAS')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs cursor-pointer active:scale-95"
              >
                <Tag size={15} />
                <span>+ VENTA</span>
              </button>
              <button
                onClick={() => setActiveTab('ASIENTOS')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs cursor-pointer active:scale-95"
              >
                <BookText size={15} />
                <span>+ ASIENTO</span>
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FILA 1: TARJETAS KPI CON ONDAS SPARKLINES SVG
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

            {/* 1. Ventas Card */}
            <div
              onClick={() => setActiveTab('VENTAS')}
              className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <TrendingUp size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-app-muted uppercase">Ventas</span>
                </div>
                <h3 className="text-2xl sm:text-[26px] font-black tracking-tight text-app-text">{formatCurrency(totalSales)}</h3>
                <div className="mt-2">
                  <span className="text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    {localSales.length} registros
                  </span>
                </div>
              </div>

              {/* Sparkline Wave SVG */}
              <div className="mt-3 relative h-10 w-full overflow-hidden">
                <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparklineGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,35 C30,35 45,28 70,30 C95,32 120,15 150,22 C175,28 190,10 200,12 L200,40 L0,40 Z" fill="url(#sparklineGreen)" />
                  <path d="M0,35 C30,35 45,28 70,30 C95,32 120,15 150,22 C175,28 190,10 200,12" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex justify-end pt-1">
                <span className="text-[10px] font-bold text-app-muted group-hover:text-emerald-500 transition-colors flex items-center gap-1">
                  Ver detalle <ChevronRight size={11} />
                </span>
              </div>
            </div>

            {/* 2. Compras Card */}
            <div
              onClick={() => setActiveTab('COMPRAS')}
              className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                    <ShoppingBag size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-app-muted uppercase">Compras</span>
                </div>
                <h3 className="text-2xl sm:text-[26px] font-black tracking-tight text-app-text">{formatCurrency(totalPurchases)}</h3>
                <div className="mt-2">
                  <span className="text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                    {localPurchases.length} registros
                  </span>
                </div>
              </div>

              {/* Sparkline Wave SVG */}
              <div className="mt-3 relative h-10 w-full overflow-hidden">
                <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparklinePurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,32 C40,32 50,18 85,25 C120,32 140,15 170,18 C185,20 195,12 200,10 L200,40 L0,40 Z" fill="url(#sparklinePurple)" />
                  <path d="M0,32 C40,32 50,18 85,25 C120,32 140,15 170,18 C185,20 195,12 200,10" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex justify-end pt-1">
                <span className="text-[10px] font-bold text-app-muted group-hover:text-purple-500 transition-colors flex items-center gap-1">
                  Ver detalle <ChevronRight size={11} />
                </span>
              </div>
            </div>

            {/* 3. IGV Estimado Card */}
            <div
              className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Wallet size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-app-muted uppercase">IGV Estimado</span>
                </div>
                <h3 className="text-2xl sm:text-[26px] font-black tracking-tight text-app-text">{formatCurrency(estimatedIgv)}</h3>
                <div className="mt-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${estimatedIgv > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                    {estimatedIgv > 0 ? 'Por Pagar' : 'Saldo a Favor'}
                  </span>
                </div>
              </div>

              {/* Sparkline Wave SVG */}
              <div className="mt-3 relative h-10 w-full overflow-hidden">
                <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparklineOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,28 C35,28 60,35 90,30 C120,25 145,35 175,25 C190,20 195,15 200,16 L200,40 L0,40 Z" fill="url(#sparklineOrange)" />
                  <path d="M0,28 C35,28 60,35 90,30 C120,25 145,35 175,25 C190,20 195,15 200,16" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>

              <div className="flex justify-end pt-1">
                <span className="text-[10px] font-bold text-app-muted hover:text-amber-500 transition-colors flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('TRIBUTARIO')}>
                  Ver detalle <ChevronRight size={11} />
                </span>
              </div>
            </div>

            {/* 4. Resumen Card */}
            <div
              className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2.5">
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Activity size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-app-muted uppercase">Resumen</span>
                </div>

                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-muted font-medium">Asientos</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{asientos.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-muted font-medium">Honorarios</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{honorarios.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-muted font-medium">Mov. Diario</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{journal.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-app-muted font-medium">Directorio</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{entities.length}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <span className="text-[10px] font-bold text-app-muted hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('ASIENTOS')}>
                  Ver detalle <ChevronRight size={11} />
                </span>
              </div>
            </div>

          </div>


          {/* ═══════════════════════════════════════════════════════════════
              FILA 2: SECCIÓN CENTRAL (IZQ: ACTIVIDAD Y BARRAS, DER: ACCESOS Y CALENDARIO)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ─── COLUMNA IZQUIERDA (2 COLS EN LG) ─── */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* 1. ÚLTIMAS OPERACIONES */}
              <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-app-border flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                    <Clock size={15} className="text-blue-600 dark:text-blue-400" />
                    <span>Últimas Operaciones</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('COMPRAS')}
                    className="px-2.5 py-1 text-[10px] font-bold text-app-muted hover:text-app-text bg-app-bg hover:bg-app-hover border border-app-border rounded-lg transition-colors uppercase cursor-pointer"
                  >
                    Ver todas
                  </button>
                </div>

                {recentOps.length > 0 ? (
                  <div className="divide-y divide-app-border/40">
                    {recentOps.map((op, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-app-hover transition-colors">
                        <div className={`p-2.5 rounded-xl shrink-0 ${op.type === 'venta' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            op.type === 'compra' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                              op.type === 'honorario' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}>
                          <op.icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-app-text uppercase truncate">{op.type}: {op.label}</p>
                          <p className="text-[10px] text-app-muted font-mono mt-0.5">{op.date || '—'}</p>
                        </div>
                        <span className="text-xs sm:text-sm font-mono font-bold text-app-text shrink-0">{formatCurrency(op.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <div className="p-2.5 bg-purple-500/10 text-purple-600 rounded-xl">
                      <ShoppingCart size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-app-text uppercase truncate">COMPRA: POR LA COMPRA DE MERCADERIA</p>
                      <p className="text-[10px] text-app-muted font-mono mt-0.5">2026-08-13</p>
                    </div>
                    <span className="text-xs sm:text-sm font-mono font-bold text-app-text shrink-0">S/ 1,000.00</span>
                  </div>
                )}
              </div>

              {/* 2. RESUMEN MENSUAL DE VENTAS Y COMPRAS (GRÁFICO DE BARRAS) */}
              <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-app-border">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                    <span>Resumen Mensual de Ventas y Compras</span>
                  </h3>
                  <div className="flex items-center gap-4">
                    {/* Legend */}
                    <div className="flex items-center gap-3 text-[10px] font-bold">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Ventas (S/)
                      </span>
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <span className="w-2.5 h-2.5 rounded-xs bg-purple-600 inline-block" /> Compras (S/)
                      </span>
                    </div>

                    {/* Period Badge */}
                    <span className="text-[10px] font-extrabold px-2.5 py-1 bg-app-bg border border-app-border rounded-lg text-app-text flex items-center gap-1">
                      {activePeriodYear} <ChevronDown size={11} className="text-app-muted" />
                    </span>
                  </div>
                </div>

                {/* SVG Bar Chart */}
                <div className="mt-6 w-full">
                  <div className="flex items-end gap-1.5 sm:gap-2.5 h-48 sm:h-56 pt-6 pb-2 border-b border-app-border/70 relative">
                    {/* Background Guideline Lines */}
                    <div className="absolute inset-x-0 top-0 border-b border-dashed border-app-border/40 text-[9px] text-app-muted font-mono pl-1">1.5M</div>
                    <div className="absolute inset-x-0 top-1/3 border-b border-dashed border-app-border/40 text-[9px] text-app-muted font-mono pl-1">1M</div>
                    <div className="absolute inset-x-0 top-2/3 border-b border-dashed border-app-border/40 text-[9px] text-app-muted font-mono pl-1">500K</div>

                    {MONTH_NAMES_SHORT.map((monthName, idx) => {
                      const salesVal = monthlyData.salesByMonth[idx];
                      const purchasesVal = monthlyData.purchasesByMonth[idx];

                      // Normalize height percentage (max 85% for visual headroom)
                      const salesHeight = salesVal > 0 ? Math.max(8, Math.min(85, (salesVal / monthlyData.maxVal) * 85)) : 2;
                      const purchasesHeight = purchasesVal > 0 ? Math.max(8, Math.min(85, (purchasesVal / monthlyData.maxVal) * 85)) : 2;

                      return (
                        <div key={monthName} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          {/* Tooltip on Hover */}
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-mono py-1 px-2 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                            V: {formatCurrency(salesVal)} | C: {formatCurrency(purchasesVal)}
                          </div>

                          {/* Dual Bar Container */}
                          <div className="w-full flex items-end justify-center gap-1 h-full">
                            {/* Ventas Bar */}
                            <div
                              style={{ height: `${salesHeight}%` }}
                              className={`w-2 sm:w-3.5 rounded-t-xs transition-all duration-500 ${salesVal > 0 ? 'bg-emerald-500 group-hover:brightness-110 shadow-2xs' : 'bg-emerald-500/20'}`}
                            />
                            {/* Compras Bar */}
                            <div
                              style={{ height: `${purchasesHeight}%` }}
                              className={`w-2 sm:w-3.5 rounded-t-xs transition-all duration-500 ${purchasesVal > 0 ? 'bg-purple-600 group-hover:brightness-110 shadow-2xs' : 'bg-purple-600/20'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X Axis Month Labels */}
                  <div className="flex justify-between items-center pt-2">
                    {MONTH_NAMES_SHORT.map((monthName) => (
                      <span key={monthName} className="flex-1 text-center text-[9px] sm:text-[10px] font-bold text-app-muted uppercase">
                        {monthName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>


            {/* ─── COLUMNA DERECHA (1 COL EN LG) ─── */}
            <div className="flex flex-col gap-6">

              {/* 1. ACCESO RÁPIDO */}
              <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-app-border">
                  <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                    <Zap size={15} className="text-blue-600 dark:text-blue-400" />
                    <span>Acceso Rápido</span>
                  </h3>
                </div>
                <div className="p-3 space-y-1.5">
                  {[
                    { label: 'Registro de Compras', icon: ShoppingCart, tab: 'COMPRAS', desc: 'Ingresar nueva compra' },
                    { label: 'Registro de Ventas', icon: Tag, tab: 'VENTAS', desc: 'Ingresar nueva venta' },
                    { label: 'Asientos Contables', icon: BookText, tab: 'ASIENTOS', desc: 'Crear asiento manual' },
                    { label: 'Libro Diario', icon: BookOpen, tab: 'DIARIO', desc: 'Ver movimientos registrados' },
                  ].map(item => (
                    <button
                      key={item.tab}
                      onClick={() => setActiveTab(item.tab)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left hover:bg-app-hover transition-all group cursor-pointer"
                    >
                      <div className="p-2 bg-app-bg rounded-xl text-app-muted group-hover:text-blue-600 dark:group-hover:text-blue-400 border border-app-border/60 transition-colors shrink-0">
                        <item.icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-app-text group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.label}</p>
                        <p className="text-[10px] text-app-muted truncate mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight size={14} className="text-app-border group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. CALENDARIO TRIBUTARIO */}
              <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-app-border">
                    <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-2">
                      <Calendar size={15} className="text-blue-600 dark:text-blue-400" />
                      <span>Calendario Tributario</span>
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedCalendarMonthOffset(selectedCalendarMonthOffset - 1)}
                        className="p-1 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors cursor-pointer"
                        title="Mes anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setSelectedCalendarMonthOffset(selectedCalendarMonthOffset + 1)}
                        className="p-1 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-colors cursor-pointer"
                        title="Mes siguiente"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                      {calendarDate.monthNameFull} {calendarDate.year}
                    </p>

                    <div className="mt-3 flex items-center gap-3.5 bg-app-bg/50 border border-app-border p-3 rounded-xl">
                      {/* Date Badge */}
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        <span className="text-base font-black leading-none">{calendarDate.dueDay}</span>
                        <span className="text-[9px] font-black tracking-wider uppercase mt-0.5">{calendarDate.monthNameShort}</span>
                      </div>

                      {/* Info & Badges */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-app-text uppercase truncate">IGV - OPERACIONES MENSUALES</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-app-muted font-bold">Formulario 621</span>
                          <span className="text-[8.5px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                            Por vencer
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-app-border flex justify-end">
                  <span className="text-[10px] font-bold text-app-muted">
                    Faltan 10 días
                  </span>
                </div>
              </div>

            </div>

          </div>


          {/* ═══════════════════════════════════════════════════════════════
              FILA 3: TARJETAS DE RESUMEN INFERIOR (CLIENTES, PROVEEDORES, LIBROS, COMPROBANTES)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">

            {/* 1. Clientes Activos */}
            <div
              onClick={() => setActiveTab('CLI_PRO')}
              className="bg-app-surface border border-app-border rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0">
                  <Users size={22} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase block">Clientes Activos</span>
                  <h4 className="text-xl sm:text-2xl font-black text-app-text mt-0.5">{clientsCount}</h4>
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <span className="text-[9.5px] font-bold text-app-muted group-hover:text-blue-500 transition-colors flex items-center gap-1">
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

            {/* 2. Proveedores */}
            <div
              onClick={() => setActiveTab('CLI_PRO')}
              className="bg-app-surface border border-app-border rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                  <Briefcase size={22} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase block">Proveedores</span>
                  <h4 className="text-xl sm:text-2xl font-black text-app-text mt-0.5">{providersCount}</h4>
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <span className="text-[9.5px] font-bold text-app-muted group-hover:text-emerald-500 transition-colors flex items-center gap-1">
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

            {/* 3. Libros Electrónicos */}
            <div
              onClick={() => setActiveTab('SIRE')}
              className="bg-app-surface border border-app-border rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl shrink-0">
                  <FileText size={22} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase block">Libros Electrónicos</span>
                  <h4 className="text-xl sm:text-2xl font-black text-app-text mt-0.5">12</h4>
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <span className="text-[9.5px] font-bold text-app-muted group-hover:text-purple-500 transition-colors flex items-center gap-1">
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

            {/* 4. Comprobantes Emitidos */}
            <div
              onClick={() => setActiveTab('VENTAS')}
              className="bg-app-surface border border-app-border rounded-2xl p-4.5 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
                  <ReceiptText size={22} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest text-app-muted uppercase block">Comprobantes Emitidos</span>
                  <h4 className="text-xl sm:text-2xl font-black text-app-text mt-0.5">
                    {localSales.length > 0 ? localSales.length.toLocaleString('es-PE') : '2,456'}
                  </h4>
                </div>
              </div>
              <div className="flex justify-end pt-3">
                <span className="text-[9.5px] font-bold text-app-muted group-hover:text-amber-500 transition-colors flex items-center gap-1">
                  Ver detalle <ChevronRight size={10} />
                </span>
              </div>
            </div>

          </div>


          {/* ═══════════════════════════════════════════════════════════════
              PARÁMETROS DE LA ENTIDAD (COLLAPSIBLE)
             ═══════════════════════════════════════════════════════════════ */}
          <div id="company-config-section" className="scroll-mt-6 pt-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-app-muted hover:text-blue-600 transition-colors mb-3 cursor-pointer"
            >
              <Settings size={15} />
              <span>Parámetros de la Entidad y Configuración</span>
              <ChevronRight size={14} className={`transition-transform duration-200 ${showConfig ? 'rotate-90' : ''}`} />
            </button>

            {showConfig && (
              <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm animate-slide-up">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                  {/* Formulario (Left 8 cols) */}
                  <div className="lg:col-span-8 space-y-6">

                    {/* Fila 1: RUC & Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col space-y-2 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <Hash size={12} className="text-blue-600" /> RUC
                        </label>
                        <div className="relative">
                          <input id="empresa-ruc-input" type="text" value={currentCompany.ruc} onChange={handleRucChange}
                            placeholder="Ingrese RUC..." maxLength={11}
                            className="w-full text-sm font-mono tracking-wider pr-10 p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                          {isSearchingRuc && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" />}
                          {fetchSuccess && !isSearchingRuc && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <Building2 size={12} className="text-blue-600" /> Razón Social
                        </label>
                        <input type="text" value={currentCompany.name}
                          onChange={(e) => updateCompany({ name: e.target.value })}
                          className="w-full text-sm font-bold p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    {/* Fila 2: Dirección y Ubicación */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <MapPinHouse size={12} className="text-blue-600" /> Domicilio Fiscal
                        </label>
                        <input type="text" value={currentCompany.address}
                          onChange={(e) => updateCompany({ address: e.target.value })}
                          className="w-full text-sm p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                      </div>
                      <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <MapPin size={12} className="text-blue-600" /> Ubicación (Dep - Prov - Dist)
                        </label>
                        <input type="text" value={currentCompany.location}
                          onChange={(e) => updateCompany({ location: e.target.value })}
                          className="w-full text-sm p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    {/* Fila 3: Régimen y Periodo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <Shield size={12} className="text-blue-600" /> Régimen Tributario
                        </label>
                        <select
                          value={currentCompany.regimenTributario || 'RG'}
                          onChange={(e) => updateCompany({ regimenTributario: e.target.value as RegimenCode })}
                          className="w-full text-sm p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500 cursor-pointer font-bold"
                        >
                          <option value="RG">Régimen General (RG)</option>
                          <option value="MYPE">Régimen MYPE Tributario (RMT)</option>
                          <option value="RER">Régimen Especial de Renta (RER)</option>
                          <option value="NRUS">Nuevo RUS (NRUS)</option>
                        </select>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                          <CalendarDays size={12} className="text-blue-600" /> Periodo Activo
                        </label>
                        <input
                          type="text"
                          value={currentCompany.period || new Date().getFullYear().toString()}
                          onChange={(e) => updateCompany({ period: e.target.value })}
                          className="w-full text-sm font-mono p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Credenciales SOL */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        Credenciales SUNAT Clave SOL & SIRE
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-app-bg/50 p-4 rounded-xl border border-app-border">
                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Usuario SOL</label>
                          <input type="text" value={currentCompany.sol_user || ''}
                            onChange={(e) => updateCompany({ sol_user: e.target.value })} placeholder="Ej: MODDATOS"
                            className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-lg text-app-text outline-none" />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Clave SOL</label>
                          <input type="text" style={{ WebkitTextSecurity: 'disc' } as any} autoComplete="new-password" value={currentCompany.sol_pass || ''}
                            onChange={(e) => updateCompany({ sol_pass: e.target.value })} placeholder="••••••••••••"
                            className="w-full text-xs p-2 bg-app-bg border border-app-border rounded-lg text-app-text outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Facturación Electrónica UBL 2.1 */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        Facturación Electrónica (UBL 2.1)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-app-bg/50 p-4 rounded-xl border border-app-border">
                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Certificado Digital (.pfx)</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => document.getElementById('cert-upload-input')?.click()}
                              className="px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] font-bold uppercase hover:border-blue-500/50 transition-colors cursor-pointer"
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
                            {certName && <span className="text-[10px] text-emerald-500 font-mono truncate max-w-[150px]">{certName}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Contraseña del Certificado</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              style={{ WebkitTextSecurity: 'disc' } as any}
                              autoComplete="new-password"
                              value={certPass}
                              onChange={(e) => setCertPass(e.target.value)}
                              placeholder="Contraseña del PFX..."
                              className="flex-1 text-xs bg-app-bg border border-app-border rounded-xl px-3 outline-none"
                            />
                            <button
                              type="button"
                              disabled={!certBase64 || !certPass || isSavingCert}
                              onClick={handleConfigurarCertificado}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                              {isSavingCert ? 'Guardando...' : 'Cargar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Logo Upload & Soporte (Right 4 cols) */}
                  <div className="lg:col-span-4 flex flex-col gap-5">
                    {/* Logo Upload */}
                    <div
                      className="flex flex-col items-center justify-center p-6 bg-app-bg rounded-2xl border border-dashed border-app-border hover:border-blue-500/40 transition-colors relative group cursor-pointer overflow-hidden min-h-[200px]"
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
                          <img src={currentCompany.logoBase64} alt="Logo" className="max-w-full max-h-[140px] object-contain" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                            <span className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Upload size={14} /> Cambiar</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); updateCompany({ logoBase64: undefined }); }}
                            className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-lg z-10 cursor-pointer">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-app-muted group-hover:text-blue-600 transition-colors">
                          <Building2 size={40} strokeWidth={1} />
                          <p className="text-xs font-bold uppercase tracking-widest">Subir Logotipo</p>
                          <p className="text-[10px] opacity-60">PNG o JPG</p>
                        </div>
                      )}
                    </div>

                    {/* Soporte */}
                    <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                      <div className="relative z-10 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2">
                          <MessageCircleMore size={18} />
                          <h3 className="font-bold tracking-widest text-[10px] uppercase">Soporte Técnico</h3>
                        </div>
                        <p className="text-[10px] opacity-90 leading-tight">Enlace directo a atención y soporte contable.</p>
                        {isSupportSaved && currentCompany.support ? (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={currentCompany.support} target="_blank" rel="noopener noreferrer"
                              className="flex-1 text-center py-2 bg-white text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-white/90 transition-colors shadow-sm">
                              Abrir Portal
                            </a>
                            <button onClick={() => { setSupportLinkDraft(currentCompany.support || ''); setIsSupportSaved(false); }}
                              className="p-2 bg-white/15 hover:bg-white/25 rounded-xl transition-colors cursor-pointer"><Settings size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 mt-1">
                            <input type="text" className="text-xs p-2 rounded-xl bg-black/20 border border-white/15 text-white placeholder-white/50 outline-none"
                              placeholder="URL del portal..." value={!isSupportSaved ? supportLinkDraft : (currentCompany.support || '')}
                              onChange={(e) => { setSupportLinkDraft(e.target.value); setIsSupportSaved(false); }} />
                            <button disabled={!supportLinkDraft.trim()}
                              onClick={() => { if (supportLinkDraft.trim()) { updateCompany({ support: supportLinkDraft.trim() }); setIsSupportSaved(true); } }}
                              className="py-2 bg-white text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40 cursor-pointer shadow-sm">
                              Guardar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-white/10 blur-2xl rounded-full" />
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
