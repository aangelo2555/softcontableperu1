import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, Activity,
  Building2, Hash, MapPin, MapPinHouse, MessageCircleMore,
  Loader2, CheckCircle2, CalendarDays, Upload, Trash2,
  Shield, Settings, BookText, Tag, ShoppingCart, ReceiptText,
  ArrowRight, Clock, FileText, Users, ChevronRight, Wallet, Scale,
  AlertCircle, Calculator
} from 'lucide-react';
import { useStore, type CompanyData, type RegimenCode } from '../store';
import { REGIMENES_TRIBUTARIOS, getUIT } from '../constants/tributario';
import * as apiService from '../services/apiService';
import { calcularObligacionesContables } from '../utils/tributarioRules';
import { evaluateRegime } from '../engine/regimeEngine';

// ─── Helpers ───
const formatCurrency = (n: number) => `S/ ${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const EmpresaView: React.FC = () => {
  const { currentCompany: _currentCompany, updateCompany, sales, purchases, honorarios, journal, asientos, entities, setActiveTab, showCompanyConfig: showConfig, setShowCompanyConfig: setShowConfig, facturacionConfigurarCertificadoAction } = useStore();
  const currentCompany = _currentCompany || {};
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [supportLinkDraft, setSupportLinkDraft] = useState('');
  const [isSupportSaved, setIsSupportSaved] = useState(!!currentCompany.support);

  const [localUIT, setLocalUIT] = useState<string>('');

  // ─── Computed Metrics (Excluyendo Propuestas SIRE) ───
  const localSales = useMemo(() => sales.filter(s => s.estado_sire !== 'Propuesta'), [sales]);
  const localPurchases = useMemo(() => purchases.filter(p => p.estado_sire !== 'Propuesta'), [purchases]);

  // active period calculations
  const activePeriodYear = currentCompany.period || new Date().getFullYear().toString();

  const isInActivePeriod = (dateStr: string) => {
    if (!dateStr) return false;
    if (dateStr.includes('/')) {
      return dateStr.endsWith('/' + activePeriodYear);
    }
    if (dateStr.includes('-')) {
      return dateStr.startsWith(activePeriodYear + '-');
    }
    return false;
  };

  const getMonthFromDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return parseInt(parts[1]) || 0;
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      return parseInt(parts[1]) || 0;
    }
    return 0;
  };

  const periodSales = useMemo(() => localSales.filter(s => isInActivePeriod(s.fecha)), [localSales, activePeriodYear]);
  const periodPurchases = useMemo(() => localPurchases.filter(p => isInActivePeriod(p.fecha)), [localPurchases, activePeriodYear]);

  const compiledFinancials = useMemo(() => {
    const annualRevenue = periodSales.reduce((acc, s) => acc + (s.bi || 0), 0);
    const annualPurchases = periodPurchases.reduce((acc, p) => acc + (p.bi || 0), 0);

    const salesByMonth: Record<number, number> = {};
    const purchasesByMonth: Record<number, number> = {};

    periodSales.forEach(s => {
      const m = getMonthFromDate(s.fecha);
      if (m >= 1 && m <= 12) {
        salesByMonth[m] = (salesByMonth[m] || 0) + (s.bi || 0);
      }
    });

    periodPurchases.forEach(p => {
      const m = getMonthFromDate(p.fecha);
      if (m >= 1 && m <= 12) {
        purchasesByMonth[m] = (purchasesByMonth[m] || 0) + (p.bi || 0);
      }
    });

    const monthlyRevenue = Math.max(0, ...Object.values(salesByMonth));
    const monthlyPurchases = Math.max(0, ...Object.values(purchasesByMonth));

    return {
      annualRevenue,
      monthlyRevenue,
      annualPurchases,
      monthlyPurchases
    };
  }, [periodSales, periodPurchases]);

  const evaluation = useMemo(() => {
    const regimeInput = currentCompany.regimenTributario || 'RG';
    const regime = (regimeInput === 'MYPE' ? 'RMT' : regimeInput) as any;
    const ciiuCode = currentCompany.ciiuCode || '';
    const fixedAssetsValue = Number(currentCompany.fixedAssetsValue || 0);
    const employeeCount = Number(currentCompany.employeeCount || 0);

    return evaluateRegime(regime, {
      annualRevenue: compiledFinancials.annualRevenue,
      monthlyRevenue: compiledFinancials.monthlyRevenue,
      annualPurchases: compiledFinancials.annualPurchases,
      monthlyPurchases: compiledFinancials.monthlyPurchases,
      fixedAssetsValue,
      employeeCount,
      ciiuCode
    });
  }, [currentCompany.regimenTributario, currentCompany.ciiuCode, currentCompany.fixedAssetsValue, currentCompany.employeeCount, compiledFinancials]);

  // Estados para Firma Digital / Facturación Electrónica
  const [certPass, setCertPass] = useState('');
  const [certBase64, setCertBase64] = useState('');
  const [certName, setCertName] = useState('');
  const [isSavingCert, setIsSavingCert] = useState(false);

  // Estados para panel interactivo NRUS
  const [nrusIngresos, setNrusIngresos] = useState<number>(0);
  const [nrusCompras, setNrusCompras] = useState<number>(0);
  const [nrusDeclaraciones, setNrusDeclaraciones] = useState<{ periodo: string; ingresos: number; compras: number; categoria: number; cuota: number }[]>([]);

  useEffect(() => {
    setNrusIngresos(compiledFinancials.monthlyRevenue);
    setNrusCompras(compiledFinancials.monthlyPurchases);
  }, [compiledFinancials.monthlyRevenue, compiledFinancials.monthlyPurchases]);

  // Categoría y cuota calculada NRUS
  const nrusCalculo = useMemo(() => {
    const maxVal = Math.max(nrusIngresos, nrusCompras);
    if (maxVal <= 5000) {
      return { categoria: 1, cuota: 20, mensaje: 'Categoría 1 (Hasta S/ 5,000)' };
    } else if (maxVal <= 8000) {
      return { categoria: 2, cuota: 50, mensaje: 'Categoría 2 (Hasta S/ 8,000)' };
    } else {
      return { categoria: 0, cuota: 0, mensaje: '⚠️ ¡Supera el límite de S/ 8,000 mensual del NRUS! Sugerimos migrar al Régimen Especial (RER) o MYPE.' };
    }
  }, [nrusIngresos, nrusCompras]);

  // Cálculo de impuestos RER (Régimen Especial - Tasa Fija 1.5% Renta)
  const rerCalculo = useMemo(() => {
    const baseVentas = periodSales.reduce((acc, s) => acc + (s.bi || 0), 0);
    const igvVentas = periodSales.reduce((acc, s) => acc + (s.igv || 0), 0);
    const igvCompras = periodPurchases.reduce((acc, p) => acc + (p.igv || 0), 0);
    const rentaRer = baseVentas * 0.015;
    const igvPagar = Math.max(0, igvVentas - igvCompras);
    return {
      renta: rentaRer,
      igv: igvPagar,
      total: rentaRer + igvPagar
    };
  }, [periodSales, periodPurchases]);

  const handleConfigurarCertificado = async () => {
    if (!certBase64 || !certPass) {
      return;
    }
    setIsSavingCert(true);
    try {
      const res = await facturacionConfigurarCertificadoAction(certPass, certBase64);
      if (res?.success) {
        setCertPass('');
        setCertBase64('');
        setCertName('');
      }
    } finally {
      setIsSavingCert(false);
    }
  };

  useEffect(() => {
    setLocalUIT(String(currentCompany.annualIncomeUIT || 0));
  }, [currentCompany.ruc, currentCompany.annualIncomeUIT]);

  const totalSales = useMemo(() => localSales.reduce((acc, s) => acc + s.total, 0), [localSales]);
  const totalPurchases = useMemo(() => localPurchases.reduce((acc, p) => acc + p.total, 0), [localPurchases]);
  const igvSales = useMemo(() => localSales.reduce((acc, s) => acc + s.igv, 0), [localSales]);
  const igvPurchases = useMemo(() => localPurchases.reduce((acc, p) => {
    // Suspend IGV Credit for purchases with SPOT but no deposit constancia/date
    if (p.spot_monto && p.spot_monto > 0 && (!p.spot_constancia || !p.spot_fecha)) {
      return acc;
    }
    return acc + p.igv;
  }, 0), [localPurchases]);
  const estimatedIgv = igvSales - igvPurchases;


  // Recent activity (last 8 operations)
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

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 overflow-y-auto animate-fade-in custom-scrollbar pb-24 h-full">

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <img src="assets/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
            <span className="text-gradient">Panel de Control</span>
          </h1>
          <p className="text-sm text-app-muted mt-1 font-medium">
            {currentCompany.name || 'Empresa'} — Periodo {currentCompany.period || new Date().getFullYear()}
          </p>
        </div>

        {/* Quick action pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Compra', icon: ShoppingCart, tab: 'COMPRAS', color: 'text-violet-500 bg-violet-500/10 hover:bg-violet-500/20' },
            { label: 'Venta', icon: Tag, tab: 'VENTAS', color: 'text-pld-blue bg-pld-blue/10 hover:bg-pld-blue/20' },
            { label: 'Asiento', icon: BookText, tab: 'ASIENTOS', color: 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' },
          ].map(q => (
            <button
              key={q.tab}
              onClick={() => setActiveTab(q.tab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${q.color}`}
            >
              <q.icon size={14} />
              + {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Ventas */}
        <div className="card-elevated group cursor-pointer" onClick={() => setActiveTab('VENTAS')}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500"><TrendingUp size={20} /></div>
            <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Ventas</span>
          </div>
          <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(totalSales)}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">{localSales.length} registros</span>
            <span className="text-[10px] text-app-muted group-hover:text-emerald-500 transition-colors ml-auto flex items-center gap-1">
              Ver <ChevronRight size={10} />
            </span>
          </div>
        </div>

        {/* Compras */}
        <div className="card-elevated group cursor-pointer" onClick={() => setActiveTab('COMPRAS')}>
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500"><ShoppingBag size={20} /></div>
            <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Compras</span>
          </div>
          <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(totalPurchases)}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-bold bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded-full">{localPurchases.length} registros</span>
            <span className="text-[10px] text-app-muted group-hover:text-violet-500 transition-colors ml-auto flex items-center gap-1">
              Ver <ChevronRight size={10} />
            </span>
          </div>
        </div>

        {/* IGV Estimado */}
        <div className="card-elevated">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-orange-500/10 rounded-xl text-orange-500"><Wallet size={20} /></div>
            <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">IGV Estimado</span>
          </div>
          <h3 className="text-2xl font-black tracking-tighter">{formatCurrency(estimatedIgv)}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estimatedIgv > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              {estimatedIgv > 0 ? 'Por Pagar' : 'Saldo a Favor'}
            </span>
          </div>
        </div>

        {/* Resumen Contable */}
        <div className="card-elevated">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-pld-blue/10 rounded-xl text-pld-blue"><Activity size={20} /></div>
            <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Resumen</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-app-muted">Asientos</span>
              <span className="font-bold font-mono">{asientos.length}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-app-muted">Honorarios</span>
              <span className="font-bold font-mono">{honorarios.length}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-app-muted">Mov. Diario</span>
              <span className="font-bold font-mono">{journal.length}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-app-muted">Directorio</span>
              <span className="font-bold font-mono">{entities.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MIDDLE ROW: Activity + Quick Links ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Activity */}
        <div className="lg:col-span-2 card-elevated !p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-app-border flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-app-text flex items-center gap-2">
              <Clock size={14} className="text-pld-blue" />
              Últimas Operaciones
            </h3>
            <span className="text-[10px] text-app-muted">{localSales.length + localPurchases.length + honorarios.length + asientos.length} total</span>
          </div>
          {recentOps.length > 0 ? (
            <div className="divide-y divide-app-border/50">
              {recentOps.map((op, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-app-hover transition-colors">
                  <div className={`p-2 rounded-lg shrink-0 ${op.type === 'venta' ? 'bg-emerald-500/10 text-emerald-500' :
                    op.type === 'compra' ? 'bg-violet-500/10 text-violet-500' :
                      op.type === 'honorario' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-blue-500/10 text-blue-500'
                    }`}>
                    <op.icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-app-text uppercase truncate">{op.type}: {op.label}</p>
                    <p className="text-[10px] text-app-muted font-mono">{op.date || '—'}</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-app-text shrink-0">{formatCurrency(op.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-app-muted">
              <FileText size={32} strokeWidth={1.5} className="mb-2 opacity-30" />
              <p className="text-xs font-bold uppercase tracking-widest">Sin operaciones aún</p>
              <p className="text-[10px] mt-1 opacity-70">Registra compras o ventas para ver la actividad</p>
            </div>
          )}
        </div>

        {/* Quick Access Panel */}
        <div className="card-elevated !p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-app-border">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-app-text flex items-center gap-2">
              <ArrowRight size={14} className="text-pld-blue" />
              Acceso Rápido
            </h3>
          </div>
          <div className="p-3 space-y-1.5">
            {[
              { label: 'Registro de Compras', icon: ShoppingCart, tab: 'COMPRAS', desc: 'Ingresar nueva compra' },
              { label: 'Registro de Ventas', icon: Tag, tab: 'VENTAS', desc: 'Ingresar nueva venta' },
              { label: 'Asientos Contables', icon: BookText, tab: 'ASIENTOS', desc: 'Crear asiento manual' },
              { label: 'Balance de Comprobación', icon: Scale, tab: 'HHTT', desc: 'Balance de comprobación' },
              { label: 'Mis Empresas', icon: Building2, tab: 'CLIENTES', desc: 'Cambiar empresa activa' },
              { label: 'Directorio', icon: Users, tab: 'CLI_PRO', desc: 'Clientes y proveedores' },
            ].map(item => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-app-hover transition-all group"
              >
                <div className="p-2 bg-app-bg rounded-lg text-app-muted group-hover:text-pld-blue transition-colors shrink-0">
                  <item.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-app-text group-hover:text-pld-blue transition-colors">{item.label}</p>
                  <p className="text-[9px] text-app-muted truncate">{item.desc}</p>
                </div>
                <ChevronRight size={14} className="text-app-border group-hover:text-pld-blue transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ COMPANY CONFIGURATION (Collapsible) ═══ */}
      <div id="company-config-section" className="scroll-mt-6">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-app-muted hover:text-pld-blue transition-colors mb-3"
        >
          <Settings size={14} />
          Parámetros de la Entidad
          <ChevronRight size={12} className={`transition-transform duration-200 ${showConfig ? 'rotate-90' : ''}`} />
        </button>

        {showConfig && (
          <div className="card-elevated animate-slide-up">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

              {/* Form (Left 8 cols) */}
              <div className="lg:col-span-8 space-y-6">

                {/* Row 1: RUC & Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Hash size={12} className="text-pld-blue" /> RUC
                    </label>
                    <div className="relative">
                      <input id="empresa-ruc-input" type="text" value={currentCompany.ruc} onChange={handleRucChange}
                        placeholder="Ingrese RUC..." maxLength={11}
                        className="w-full text-sm font-mono tracking-wider pr-10" />
                      {isSearchingRuc && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-pld-blue animate-spin" />}
                      {fetchSuccess && !isSearchingRuc && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Building2 size={12} className="text-pld-blue" /> Razón Social
                    </label>
                    <input type="text" value={currentCompany.name}
                      onChange={(e) => updateCompany({ name: e.target.value })}
                      className="w-full text-sm font-bold" />
                  </div>
                </div>

                {/* Row 2: Address */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <MapPinHouse size={12} className="text-pld-blue" /> Domicilio Fiscal
                    </label>
                    <input type="text" value={currentCompany.address}
                      onChange={(e) => updateCompany({ address: e.target.value })}
                      className="w-full text-sm" />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <MapPin size={12} className="text-pld-blue" /> Ubigeo / Lugar
                    </label>
                    <input type="text" value={currentCompany.location}
                      onChange={(e) => updateCompany({ location: e.target.value })}
                      className="w-full text-sm" />
                  </div>
                </div>

                {/* Row 3: Period, Regimen, Business Type & UIT */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <CalendarDays size={12} className="text-pld-blue" /> Periodo Contable
                    </label>
                    <select value={currentCompany.period || '2025'}
                      onChange={(e) => updateCompany({ period: e.target.value })}
                      className="w-full text-sm font-bold">
                      {Array.from({ length: 16 }, (_, i) => 2020 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Shield size={12} className="text-pld-blue" /> Régimen Tributario
                    </label>
                    <select value={currentCompany.regimenTributario || 'RG'}
                      onChange={(e) => updateCompany({ regimenTributario: e.target.value as RegimenCode })}
                      className="w-full text-sm font-bold">
                      {REGIMENES_TRIBUTARIOS.map(r => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!currentCompany.agente_retencion}
                        onChange={(e) => updateCompany({ agente_retencion: e.target.checked })}
                        className="rounded border-app-border text-pld-blue focus:ring-pld-blue h-3.5 w-3.5"
                      />
                      <span className="text-[10px] font-black uppercase tracking-wider text-app-muted">Agente de Retención</span>
                    </label>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Activity size={12} className="text-pld-blue" /> Rubro / Sector
                    </label>
                    <select value={currentCompany.businessType || 'COMERCIAL'}
                      onChange={(e) => updateCompany({ businessType: e.target.value as any })}
                      className="w-full text-sm font-bold">
                      <option value="COMERCIAL">COMERCIAL</option>
                      <option value="MANUFACTURERA">MANUFACTURERA</option>
                      <option value="SERVICIOS">SERVICIOS</option>
                    </select>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Calculator size={12} className="text-pld-blue" /> Ingresos Anuales (UIT)
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
                          if (val !== currentCompany.annualIncomeUIT) {
                            updateCompany({ annualIncomeUIT: val });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = Math.max(0, parseFloat(localUIT) || 0);
                            if (val !== currentCompany.annualIncomeUIT) {
                              updateCompany({ annualIncomeUIT: val });
                            }
                          }
                        }}
                        className="w-full text-sm font-bold pr-12"
                      />
                      <span className="absolute right-3 text-[10px] font-bold text-app-muted select-none">
                        UIT
                      </span>
                    </div>
                    <span className="text-[10px] text-app-muted">
                      Equiv: S/ {((parseFloat(localUIT) || 0) * getUIT(currentCompany.period || '2026')).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Row 4: CIIU Code, Fixed Assets & Employee Count */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Hash size={12} className="text-pld-blue" /> Código CIIU
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={currentCompany.ciiuCode || ''}
                      onChange={(e) => updateCompany({ ciiuCode: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="Ej: 6920"
                      className="w-full text-sm font-mono"
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Wallet size={12} className="text-pld-blue" /> Activos Fijos (S/)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={currentCompany.fixedAssetsValue === undefined ? '' : currentCompany.fixedAssetsValue}
                      onChange={(e) => updateCompany({ fixedAssetsValue: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })}
                      placeholder="0.00"
                      className="w-full text-sm font-bold"
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Users size={12} className="text-pld-blue" /> Número de Trabajadores
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={currentCompany.employeeCount === undefined ? '' : currentCompany.employeeCount}
                      onChange={(e) => updateCompany({ employeeCount: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0) })}
                      placeholder="0"
                      className="w-full text-sm font-bold"
                    />
                  </div>
                </div>

                {/* Regimen Info & Dynamic Obligations */}
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
                        { name: 'Balance de Comprobación (Hoja de Trabajo)', required: obligaciones.libroInventariosBalances, note: 'Inventarios y Balances' },
                        { name: 'Estado de Situación Financiera', required: obligaciones.libroInventariosBalances, note: 'Estados Financieros' },
                        { name: 'Estado de Resultados', required: obligaciones.libroInventariosBalances, note: 'Estados Financieros' },
                        { name: 'Estado de Flujo de Efectivo', required: obligaciones.libroInventariosBalances, note: 'Estados Financieros' },
                        { name: 'Estado de Cambios en el Patrimonio', required: obligaciones.libroInventariosBalances, note: 'Estados Financieros' },
                        { name: 'Notas a los Estados Financieros', required: obligaciones.libroInventariosBalances, note: 'Revelaciones' },
                        { name: 'Impuesto a la Renta Diferido (NIC 12)', required: obligaciones.libroInventariosBalances, note: 'IFRS / NIC' },
                        { name: 'Inventario Permanente Unidades', required: obligaciones.kardexFisico, note: 'Comercio/Manuf > 500 UIT' },
                        { name: 'Inventario Permanente Valorizado', required: obligaciones.kardexValorizado, note: 'Comercio/Manuf > 1500 UIT' },
                        { name: 'Registro de Costos', required: obligaciones.registroCostos, note: 'Solo Manuf > 1500 UIT' }
                      ]
                    };
                  };

                  const currentRules = getObligationsList();

                  return (
                    <div className="flex flex-col gap-4">
                      {/* Banner de Mensaje de Obligación */}
                      <div className={`flex items-start gap-3 p-4 rounded-xl border ${currentRules.isRed
                        ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
                        : 'bg-pld-blue/5 border-pld-blue/15 text-app-text'
                        }`}>
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold leading-relaxed">{currentRules.message}</p>
                        </div>
                      </div>

                      {/* Alerts from Regime Evaluation Engine */}
                      {evaluation.alerts.length > 0 && (
                        <div className="flex flex-col gap-2.5">
                          {evaluation.alerts.map((alert, idx) => (
                            <div key={idx} className={`flex items-start gap-3 p-4 rounded-xl border ${alert.level === 'CRITICAL'
                              ? 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-400'
                              : alert.level === 'WARNING'
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400'
                                : 'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-400'
                              }`}>
                              <AlertCircle size={18} className="shrink-0 mt-0.5 text-current" />
                              <div>
                                <p className="text-xs font-bold leading-relaxed">{alert.message}</p>
                                {alert.recommendation && (
                                  <p className="text-[10px] font-medium opacity-85 mt-1">Recomendación: {alert.recommendation}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Lista Detallada de Libros y Estados */}
                      <div className="bg-app-bg border border-app-border rounded-xl p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-app-muted mb-3">
                          Estado de Obligación de Libros y Registros
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                          {currentRules.books.map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-app-border/40 last:border-0">
                              <span className="font-medium text-app-text">{b.name}</span>
                              <div className="flex items-center gap-2">
                                {b.note && (
                                  <span className="text-[8px] uppercase tracking-wider font-bold text-app-muted bg-app-hover px-1.5 py-0.5 rounded border border-app-border">
                                    {b.note}
                                  </span>
                                )}
                                {b.required ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                    ✓ Activo
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
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
                        <div className="bg-app-bg border border-app-border rounded-xl p-4 space-y-4 animate-fade-in">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-pld-blue flex items-center gap-2">
                            <Calculator size={14} /> Calculadora de Cuota Fija NRUS
                          </h4>
                          <p className="text-[10px] text-app-muted leading-tight uppercase font-medium">
                            El Nuevo RUS tributa mediante una cuota fija mensual determinada por el mayor valor entre tus ingresos brutos y compras mensuales.
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-app-muted">Ingresos Brutos del Mes (S/)</label>
                              <input
                                type="number"
                                className="w-full text-sm font-mono font-bold bg-app-bg border border-app-border rounded-xl px-3 outline-none"
                                value={nrusIngresos || ''}
                                onChange={e => setNrusIngresos(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0.00"
                              />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-app-muted">Compras del Mes (S/)</label>
                              <input
                                type="number"
                                className="w-full text-sm font-mono font-bold bg-app-bg border border-app-border rounded-xl px-3 outline-none"
                                value={nrusCompras || ''}
                                onChange={e => setNrusCompras(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-pld-blue/10 border border-pld-blue/20 p-3 rounded-lg">
                            <div>
                              <p className="text-[10px] text-app-muted uppercase font-bold">Cuota a Pagar</p>
                              <p className="text-xs font-black text-app-text">{nrusCalculo.mensaje}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xl font-mono font-black text-pld-blue">S/ {nrusCalculo.cuota.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Panel Interactivo RER */}
                      {r === 'RER' && (
                        <div className="bg-app-bg border border-app-border rounded-xl p-4 space-y-4 animate-fade-in">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-pld-blue flex items-center gap-2">
                            <Calculator size={14} /> Panel de Obligaciones RER (Simplificado)
                          </h4>
                          <p className="text-[10px] text-app-muted leading-tight uppercase font-medium">
                            El Régimen Especial (RER) determina un impuesto a la renta de tasa única fija de 1.5% sobre la Base Imponible de las ventas, más el IGV del periodo.
                          </p>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-app-surface border border-app-border p-3 rounded-lg">
                              <p className="text-[9px] text-app-muted uppercase font-bold">Renta RER (1.5%)</p>
                              <p className="text-base font-mono font-black text-pld-blue">S/ {rerCalculo.renta.toFixed(2)}</p>
                            </div>
                            <div className="bg-app-surface border border-app-border p-3 rounded-lg">
                              <p className="text-[9px] text-app-muted uppercase font-bold">IGV a Pagar</p>
                              <p className="text-base font-mono font-black text-pld-magenta">S/ {rerCalculo.igv.toFixed(2)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-pld-blue to-pld-magenta p-3 rounded-lg text-white">
                              <p className="text-[9px] uppercase font-bold opacity-80">Total Tributo</p>
                              <p className="text-base font-mono font-black">S/ {rerCalculo.total.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="h-px w-full bg-app-border" />

                {/* SOL Credentials */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-pld-blue uppercase tracking-widest flex items-center gap-2">
                    Integración API (SUNAT SOL)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-app-bg/50 p-4 rounded-xl border border-app-border">
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Usuario SOL</label>
                      <input type="text" value={currentCompany.sol_user || ''}
                        onChange={(e) => updateCompany({ sol_user: e.target.value })} placeholder="Ej: JSANTOS1" />
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Clave SOL</label>
                      <input type="password" value={currentCompany.sol_pass || ''}
                        onChange={(e) => updateCompany({ sol_pass: e.target.value })} placeholder="••••••••••••" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-app-bg/50 p-4 rounded-xl border border-app-border">
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Client ID (SIRE)</label>
                      <input type="text" value={currentCompany.sunatClientId || ''}
                        onChange={(e) => updateCompany({ sunatClientId: e.target.value })} placeholder="Ingrese Client ID..." />
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Client Secret (SIRE)</label>
                      <input type="password" value={currentCompany.sunatClientSecret || ''}
                        onChange={(e) => updateCompany({ sunatClientSecret: e.target.value })} placeholder="••••••••••••" />
                    </div>
                  </div>

                  {/* Facturación Electrónica UBL 2.1 */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-pld-blue uppercase tracking-widest flex items-center gap-2">
                      Facturación Electrónica (UBL 2.1)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-app-bg/50 p-4 rounded-xl border border-app-border">
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-app-muted tracking-widest">Certificado Digital (.pfx)</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => document.getElementById('cert-upload-input')?.click()}
                            className="px-3 py-2 bg-app-bg border border-app-border rounded-xl text-[10px] font-bold uppercase hover:border-pld-blue/50 transition-colors"
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
                            type="password"
                            value={certPass}
                            onChange={(e) => setCertPass(e.target.value)}
                            placeholder="Contraseña del PFX..."
                            className="flex-1 text-xs bg-app-bg border border-app-border rounded-xl px-3 outline-none"
                          />
                          <button
                            type="button"
                            disabled={!certBase64 || !certPass || isSavingCert}
                            onClick={handleConfigurarCertificado}
                            className="px-4 py-2 bg-pld-blue text-white rounded-xl text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-pld-blue/90 transition-colors"
                          >
                            {isSavingCert ? 'Guardando...' : 'Cargar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-5">
                {/* Logo Upload */}
                <div
                  className="flex flex-col items-center justify-center p-6 bg-app-bg rounded-2xl border border-dashed border-app-border hover:border-pld-blue/40 transition-colors relative group cursor-pointer overflow-hidden min-h-[200px]"
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
                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-lg z-10">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-app-muted group-hover:text-pld-blue transition-colors">
                      <Building2 size={40} strokeWidth={1} />
                      <p className="text-xs font-bold uppercase tracking-widest">Subir Logotipo</p>
                      <p className="text-[10px] opacity-60">PNG o JPG</p>
                    </div>
                  )}
                </div>

                {/* Support Link */}
                <div className="bg-gradient-to-br from-pld-blue to-pld-magenta rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <MessageCircleMore size={18} />
                      <h3 className="font-bold tracking-widest text-[10px] uppercase">Soporte</h3>
                    </div>
                    <p className="text-[10px] opacity-80 leading-tight">Enlace rápido de soporte técnico.</p>
                    {isSupportSaved && currentCompany.support ? (
                      <div className="flex items-center gap-2 mt-1">
                        <a href={currentCompany.support} target="_blank" rel="noopener noreferrer"
                          className="flex-1 text-center py-2 bg-white text-pld-blue text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-white/90 transition-colors">
                          Abrir Portal
                        </a>
                        <button onClick={() => { setSupportLinkDraft(currentCompany.support || ''); setIsSupportSaved(false); }}
                          className="p-2 bg-white/15 hover:bg-white/25 rounded-lg transition-colors"><Settings size={12} /></button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 mt-1">
                        <input type="text" className="text-xs p-2 rounded-lg bg-black/20 border-white/10 text-white placeholder-white/40"
                          placeholder="URL del portal..." value={!isSupportSaved ? supportLinkDraft : (currentCompany.support || '')}
                          onChange={(e) => { setSupportLinkDraft(e.target.value); setIsSupportSaved(false); }} />
                        <button disabled={!supportLinkDraft.trim()}
                          onClick={() => { if (supportLinkDraft.trim()) { updateCompany({ support: supportLinkDraft.trim() }); setIsSupportSaved(true); } }}
                          className="py-2 bg-white text-pld-magenta text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-40">
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
  );
};

export default EmpresaView;
