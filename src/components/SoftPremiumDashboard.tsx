import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import toast from 'react-hot-toast';
import { 
  Sparkles, 
  ShieldAlert, 
  Users, 
  TrendingUp, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Send, 
  RefreshCw, 
  DollarSign, 
  Calculator, 
  CreditCard,
  UploadCloud,
  Check, 
  ArrowLeft, 
  BarChart3, 
  MessageSquare, 
  Scale, 
  Activity, 
  Building2, 
  X, 
  Search, 
  Bell, 
  ShieldCheck, 
  FileCheck2, 
  CheckCircle,
  HelpCircle,
  Clock,
  Award,
  Copy,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

export const SoftPremiumDashboard: React.FC = () => {
  const { currentCompany, setActiveTab, workspaces, switchWorkspace, employees, sales, purchases } = useStore();
  const user = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('softcontable_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.name || parsed?.nombre || parsed?.email) return parsed;
      }
      const token = localStorage.getItem('softcontable_token');
      if (token) {
        const base64Url = token.split('.')[1];
        if (base64Url) {
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
          const payload = JSON.parse(jsonPayload);
          if (payload) {
            return {
              id: payload.id,
              name: payload.name || payload.nombre || payload.email?.split('@')[0] || 'Angelo Serna',
              email: payload.email || 'angelo2555@gmail.com',
              role: payload.role || 'SuperAdmin'
            };
          }
        }
      }
    } catch (e) {}
    return {
      name: 'Angelo Serna',
      email: 'angelo2555@gmail.com',
      role: 'SuperAdmin'
    };
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'SuperAdmin' || (user?.email || '').toLowerCase() === 'angelo2555@gmail.com' || (user?.email || '').toLowerCase() === 'aangelo2555@gmail.com';

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = (urlParams.get('tab') as 'tributario' | 'planillas' | 'finanzas' | 'subscription') || 'tributario';

  const [activeSubTab, setActiveSubTab] = useState<'tributario' | 'planillas' | 'finanzas' | 'subscription'>(initialTab);
  const [isPremiumActive, setIsPremiumActive] = useState<boolean>(true);
  const [premiumTiers, setPremiumTiers] = useState<string[]>(['tributario', 'planillas', 'finanzas', 'full']);
  const [loading, setLoading] = useState<boolean>(false);

  // Módulo Expandido Inline (Accordion Responsivo)
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Estado de Sub-Pestañas Modulares dentro de cada Módulo ('DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI')
  const [moduleSubTabs, setModuleSubTabs] = useState<Record<string, 'DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI'>>({});

  const getModuleSubTab = (moduleKey: string): 'DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI' => {
    return moduleSubTabs[moduleKey] || 'DIAGNOSTICO';
  };

  const setModuleSubTab = (moduleKey: string, tab: 'DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI') => {
    setModuleSubTabs(prev => ({ ...prev, [moduleKey]: tab }));
  };

  // Buscador
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estado del GROQ + IA Chat Interactivo Groq RAG por módulo
  const [ragQueries, setRagQueries] = useState<Record<string, string>>({});
  const [ragAnswers, setRagAnswers] = useState<Record<string, string>>({});
  const [ragLoading, setRagLoading] = useState<Record<string, boolean>>({});

  // Formulario Yape / Plin / Transferencia con Adjunto de Voucher
  const [selectedPlanTier, setSelectedPlanTier] = useState<'tributario' | 'planillas' | 'finanzas' | 'full'>('full');
  const [paymentMethod, setPaymentMethod] = useState<'YAPE' | 'PLIN' | 'TRANSFERENCIA'>('YAPE');
  const [operationNumber, setOperationNumber] = useState<string>('');
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherBase64, setVoucherBase64] = useState<string | null>(null);
  const [submittingVoucher, setSubmittingVoucher] = useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showCompanyModal, setShowCompanyModal] = useState<boolean>(false);
  const [companySearchTerm, setCompanySearchTerm] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error('El archivo excede el tamaño máximo permitido (8MB).');
        return;
      }
      setVoucherFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setVoucherBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Datos reales calculados del Workspace para diagnósticos (100% aislados por empresa)
  const [kpis, setKpis] = useState({
    totalVentas: 0,
    totalCompras: 0,
    igvEstimado: 0,
    ratioComprasVentas: 0,
    sinBancarizarCount: 0,
    sinBancarizarMonto: 0,
    colaboradoresCount: 0,
    gratiEstimadaTotal: 0,
    ctsEstimadaTotal: 0,
    scoreRiesgoSunat: 'BAJO'
  });

  const checkStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('softcontable_token');
      const workspaceId = currentCompany?.ruc || '';
      const res = await fetch(`/api/premium/subscription/status?workspaceId=${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        const userEmail = (user?.email || '').toLowerCase();
        const hasAccess = data.hasAccess || data.premium_enabled || data.role === 'admin' || userEmail === 'angelo2555@gmail.com' || userEmail === 'aangelo2555@gmail.com';
        setIsPremiumActive(Boolean(hasAccess));
        setPremiumTiers(data.premium_tiers || (hasAccess ? ['tributario', 'planillas', 'finanzas', 'full'] : []));

        if (hasAccess && activeSubTab === 'subscription') {
          setActiveSubTab('tributario');
        }
      }
    } catch (error) {
      console.error('[SOFTPREMIUM] Error consultando suscripción:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKpis = async () => {
    if (!currentCompany?.ruc) return;

    const localSales = (sales || []).filter(s => s.estado_sire !== 'Propuesta');
    const localPurchases = (purchases || []).filter(p => p.estado_sire !== 'Propuesta');

    const storeTotalVentas = localSales.reduce((acc, s) => acc + Number(s.total || ((s.bi || 0) + (s.igv || 0)) || 0), 0);
    const storeTotalCompras = localPurchases.reduce((acc, p) => acc + Number(p.total || ((p.bi || 0) + (p.igv || 0)) || 0), 0);
    const storeIgvVentas = localSales.reduce((acc, s) => acc + Number(s.igv || 0), 0);
    const storeIgvCompras = localPurchases.reduce((acc, p) => acc + Number(p.igv || 0), 0);
    const storeIgvEstimado = Math.max(0, storeIgvVentas - storeIgvCompras);

    const storeColaboradores = employees ? employees.length : 0;
    const storeGrati = (employees && employees.length > 0)
      ? employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130) + (e.asignacion_familiar ? 113 : 0), 0)
      : 0;
    const storeCts = storeGrati / 2;

    const sinBancarizarOps = localPurchases.filter(p => Number(p.total || 0) >= 2000 && (!p.pago_medio || p.pago_medio === 'EFECTIVO'));
    const storeSinBancarizarMonto = sinBancarizarOps.reduce((sum, p) => sum + Number(p.total || 0), 0);

    try {
      const token = localStorage.getItem('softcontable_token');
      const res = await fetch(`/api/premium/tributario/kpis?workspaceId=${currentCompany.ruc}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success && data.kpis) {
        const raw = data.kpis;
        const trib = raw.metrics?.tributario || raw;
        const pla = raw.metrics?.planillas || raw;

        const serverVentas = parseFloat(trib.totalVentasSoles || trib.totalVentas || '0');
        const serverCompras = parseFloat(trib.totalComprasSoles || trib.totalCompras || '0');
        const serverIgv = parseFloat(trib.igvEstimadoPagarSoles || trib.igvEstimado || '0');

        const totalVentas = localSales.length > 0 ? storeTotalVentas : serverVentas;
        const totalCompras = localPurchases.length > 0 ? storeTotalCompras : serverCompras;
        const igvEstimado = (localSales.length > 0 || localPurchases.length > 0) ? storeIgvEstimado : serverIgv;

        const ratioComprasVentas = totalVentas > 0 ? (totalCompras / totalVentas) * 100 : 0;
        const sinBancarizarMonto = localPurchases.length > 0 ? storeSinBancarizarMonto : parseFloat(trib.sinBancarizarSoles || trib.sinBancarizarMonto || '0');

        const colaboradoresCount = (employees && employees.length > 0) ? employees.length : (pla.colaboradoresCount || 0);
        const gratiEstimadaTotal = (employees && employees.length > 0)
          ? storeGrati
          : parseFloat(pla.gratiEstimadaTotalSoles || pla.gratiEstimadaTotal || '0');
        const ctsEstimadaTotal = gratiEstimadaTotal / 2;

        const scoreRiesgoSunat = ratioComprasVentas > 85 ? 'MEDIO' : (trib.saludFiscalScore >= 80 ? 'BAJO' : 'BAJO');

        setKpis({
          totalVentas,
          totalCompras,
          igvEstimado,
          ratioComprasVentas,
          sinBancarizarCount: sinBancarizarOps.length,
          sinBancarizarMonto,
          colaboradoresCount,
          gratiEstimadaTotal,
          ctsEstimadaTotal,
          scoreRiesgoSunat
        });
        return;
      }
    } catch (e) {
      console.error('[SOFTPREMIUM] Error cargando KPIs:', e);
    }

    const ratioComprasVentas = storeTotalVentas > 0 ? (storeTotalCompras / storeTotalVentas) * 100 : 0;
    setKpis({
      totalVentas: storeTotalVentas,
      totalCompras: storeTotalCompras,
      igvEstimado: storeIgvEstimado,
      ratioComprasVentas,
      sinBancarizarCount: sinBancarizarOps.length,
      sinBancarizarMonto: storeSinBancarizarMonto,
      colaboradoresCount: storeColaboradores,
      gratiEstimadaTotal: storeGrati,
      ctsEstimadaTotal: storeCts,
      scoreRiesgoSunat: ratioComprasVentas > 85 ? 'MEDIO' : 'BAJO'
    });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (currentCompany?.ruc) {
      fetchKpis();
    }
  }, [currentCompany?.ruc, sales, purchases, employees]);

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operationNumber.trim()) {
      toast.error('Por favor ingrese el número de operación del pago.');
      return;
    }
    if (!voucherBase64) {
      toast.error('Por favor adjunte la captura de pantalla o foto del voucher.');
      return;
    }

    try {
      setSubmittingVoucher(true);
      const token = localStorage.getItem('softcontable_token');
      const res = await fetch('/api/premium/subscription/submit-voucher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tier: selectedPlanTier,
          paymentMethod,
          operationNumber,
          voucherImage: voucherBase64
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Voucher enviado exitosamente.');
        setOperationNumber('');
        setVoucherFile(null);
        setVoucherBase64(null);
        checkStatus();
      } else {
        toast.error(data.error || 'Error al procesar la solicitud.');
      }
    } catch (error: any) {
      toast.error('Error enviando voucher: ' + error.message);
    } finally {
      setSubmittingVoucher(false);
    }
  };

  const handleAskRAG = async (pillar: string, moduleKey: string, customPromptText?: string) => {
    const queryToUse = customPromptText || ragQueries[moduleKey];
    if (!queryToUse || !queryToUse.trim()) {
      toast.error('Por favor escribe una consulta o selecciona una sugerencia.');
      return;
    }

    setRagLoading(prev => ({ ...prev, [moduleKey]: true }));
    try {
      const token = localStorage.getItem('softcontable_token');
      const res = await fetch('/api/premium/tributario/rag-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pillar,
          moduleKey,
          query: queryToUse,
          workspaceData: {
            companyName: currentCompany?.name,
            ruc: currentCompany?.ruc,
            totalVentas: kpis.totalVentas.toFixed(2),
            totalCompras: kpis.totalCompras.toFixed(2),
            igvEstimado: kpis.igvEstimado.toFixed(2),
            colaboradoresCount: kpis.colaboradoresCount,
            gratiEstimadaTotal: kpis.gratiEstimadaTotal.toFixed(2),
            ctsEstimadaTotal: kpis.ctsEstimadaTotal.toFixed(2),
            sinBancarizar: kpis.sinBancarizarMonto.toFixed(2)
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setRagAnswers(prev => ({ ...prev, [moduleKey]: data.answer }));
      } else {
        toast.error(data.error || 'Error procesando consulta con Groq AI.');
      }
    } catch (e: any) {
      toast.error('Error de conexión con el motor Groq AI: ' + e.message);
    } finally {
      setRagLoading(prev => ({ ...prev, [moduleKey]: false }));
    }
  };

  const toggleModule = (moduleKey: string) => {
    if (expandedModule === moduleKey) {
      setExpandedModule(null);
    } else {
      setExpandedModule(moduleKey);
      if (!moduleSubTabs[moduleKey]) {
        setModuleSubTabs(prev => ({ ...prev, [moduleKey]: 'DIAGNOSTICO' }));
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const handleVolver = () => {
    setActiveTab('EMPRESA');
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
  };

  // Helper para generar gráficos punteados exactos al diseño
  const renderDottedSparkline = (color: string, points: number[]) => {
    const w = 110;
    const h = 24;
    const step = w / (points.length - 1);
    const coords = points.map((p, i) => ({
      x: i * step,
      y: h - (p / 100) * (h - 6) - 3
    }));
    const pathD = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x},${curr.y}` : `${acc} L ${curr.x},${curr.y}`;
    }, '');

    return (
      <svg width={w} height={h} className="overflow-visible mt-2 w-full max-w-[110px]">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((pt, idx) => (
          <circle key={idx} cx={pt.x} cy={pt.y} r="2" fill={color} />
        ))}
      </svg>
    );
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#f4f7fb] text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* ─── 1. HEADER MAESTRO SOFTPREMIUM IA (100% RESPONSIVO) ─── */}
      <header className="bg-white/95 border-b border-slate-200/90 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-xs backdrop-blur-md">
        
        {/* Izquierda: Volver + Logo SOFTPREMIUM IA */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={handleVolver}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500/50 hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-full shadow-2xs transition-all cursor-pointer group shrink-0"
            title="Volver al Sistema Principal"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-600 group-hover:-translate-x-0.5 transition-transform" />
            <span className="tracking-wide text-[11px] sm:text-xs">VOLVER</span>
          </button>

          <div className="flex items-center gap-2 pl-1">
            <img src="/assets/logo.png" alt="Softcontable Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0" />
            <span className="text-xs sm:text-base font-black tracking-tight text-[#0f172a] whitespace-nowrap">
              SOFTPREMIUM <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">IA</span>
            </span>
          </div>
        </div>

        {/* Centro: Buscador estilo ⌘ K */}
        <div className="hidden lg:flex items-center max-w-xs xl:max-w-sm w-full mx-2">
          <div className="relative w-full flex items-center bg-slate-50 border border-slate-200/90 rounded-full px-3 py-1.5 focus-within:border-blue-500/60 focus-within:bg-white focus-within:shadow-2xs transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Buscar análisis, reportes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 font-medium"
            />
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs shrink-0">
              ⌘ K
            </span>
          </div>
        </div>

        {/* Derecha: Notificaciones + Perfil + Selector de Empresa + Suscripción */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar">
          
          {/* Campana de Notificaciones */}
          <div className="relative shrink-0">
            <button 
              className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Notificaciones de Auditoría"
            >
              <Bell size={14} className="text-slate-600" />
            </button>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white shadow-2xs">
              3
            </span>
          </div>

          {/* Perfil del Usuario */}
          <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs shrink-0">
            <div className="relative w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
              {(user?.name || 'A').charAt(0).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
            </div>
            <div className="flex flex-col text-left max-w-[100px] truncate leading-tight">
              <span className="text-[11px] font-black text-slate-800 truncate">{user?.name || 'Angelo Serna'}</span>
              <span className="text-[9px] text-slate-400 font-medium truncate">{user?.email || 'angelo2555@gmail.com'}</span>
            </div>
            <ChevronDown size={11} className="text-slate-400 shrink-0" />
          </div>

          {/* Selector de Empresa */}
          {workspaces && workspaces.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className="bg-white border border-slate-200 px-2.5 sm:px-3 py-1 rounded-full text-left flex items-center gap-1.5 sm:gap-2 hover:border-blue-500/40 transition-all cursor-pointer shadow-2xs shrink-0"
            >
              <Building2 size={13} className="text-slate-500 shrink-0" />
              <div className="leading-tight">
                <label className="text-[7.5px] text-slate-400 uppercase font-black tracking-widest block">MIS EMPRESAS</label>
                <span className="text-[10px] sm:text-[11px] font-black text-slate-800 block max-w-[90px] sm:max-w-[130px] truncate">
                  {currentCompany?.name ? (currentCompany.name.length > 15 ? currentCompany.name.substring(0, 13) + '...' : currentCompany.name) : 'AGROITAYR S.A.C.'}
                </span>
              </div>
              <ChevronDown size={11} className="text-slate-400 shrink-0" />
            </button>
          )}

          {/* Insignia de Suscripción */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/90 rounded-full text-[9px] sm:text-[10px] font-extrabold shadow-2xs shrink-0 whitespace-nowrap">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span className="hidden xs:inline">Suscripción Activa</span>
            <span className="xs:hidden">Activa</span>
          </div>

        </div>
      </header>

      {/* ─── 2. SELECTOR FLOTANTE DE 3 PILARES (PILL SWITCHER RESPONSIVO) ─── */}
      <section className="pt-3 sm:pt-4 px-3 sm:px-6">
        <div className="max-w-xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-1 shadow-xs flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('tributario')}
            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'tributario'
                ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'tributario' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>1. TRIBUTACIÓN RAG</span>
          </button>

          <button
            onClick={() => setActiveSubTab('planillas')}
            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'planillas'
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
            }`}
          >
            <Users className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'planillas' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>2. PLANILLAS RAG</span>
          </button>

          <button
            onClick={() => setActiveSubTab('finanzas')}
            className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'finanzas'
                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'finanzas' ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>3. FINANZAS RAG</span>
          </button>
        </div>
      </section>

      {/* ─── 3. CONTENIDO PRINCIPAL SEGÚN PILAR SELECCIONADO ─── */}
      <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-5">
        
        {/* ══════════════ PILAR 1: TRIBUTACIÓN RAG ══════════════ */}
        {activeSubTab === 'tributario' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            
            {/* HERO CARD PILAR 1 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-7 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
                
                {/* Columna Izquierda: Información + Ilustración Transparente */}
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 text-center sm:text-left">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="px-3 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[9.5px] font-black uppercase tracking-wider">
                        PILAR 1
                      </span>
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <ShieldCheck size={13} />
                      </div>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight leading-tight">
                      Auditoría Tributaria <br />
                      <span className="text-emerald-600">RAG</span> &amp; <span className="text-blue-600">Groq AI</span>
                    </h2>
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto sm:mx-0">
                      Análisis preventivo de cumplimiento SUNAT, crédito fiscal, bancarización Ley 28194 y scoring de riesgo fiscal.
                    </p>
                  </div>

                  {/* Ilustración de Pilar 1 (Limpio sin borde ni fondo) */}
                  <div className="w-36 h-36 sm:w-48 sm:h-48 flex items-center justify-center p-0 relative shrink-0">
                    <img
                      src="/assets/pilar1-illustration.png"
                      alt="Auditoría Tributaria"
                      className="w-full h-full object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="hidden flex-col items-center justify-center text-center p-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mb-1.5 shadow-2xs">
                        <FileCheck2 size={24} />
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Auditoría Fiscal</span>
                      <span className="text-[8.5px] text-slate-400 font-medium">SUNAT RAG 2026</span>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: 4 Mini Tarjetas KPI con Gráficos Dotted */}
                <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  
                  {/* KPI 1: VENTAS */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <TrendingUp size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">VENTAS</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-[#0f172a] tracking-tight">
                        S/ {kpis.totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#10b981', [20, 35, 25, 45, 30, 60, 40, 50])}
                  </div>

                  {/* KPI 2: COMPRAS */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <DollarSign size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">COMPRAS</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-blue-600 tracking-tight">
                        S/ {kpis.totalCompras.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#2563eb', [15, 30, 45, 60, 40, 55, 35, 40])}
                  </div>

                  {/* KPI 3: IGV EST. */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <Calculator size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">IGV EST.</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-amber-500 tracking-tight">
                        S/ {kpis.igvEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#f59e0b', [30, 45, 30, 50, 35, 40, 30, 45])}
                  </div>

                  {/* KPI 4: RIESGO SUNAT */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <ShieldAlert size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">RIESGO SUNAT</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-emerald-600 tracking-tight">
                        {kpis.scoreRiesgoSunat}
                      </div>
                    </div>
                    
{/* Barra de progreso segmentada */}
                    <div className="mt-3 sm:mt-4 flex items-center gap-1.5">
                      <div className="h-2 w-5 rounded-full bg-emerald-500" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* GRILLA DE 2 COLUMNAS DE MÓDULOS DE AUDITORÍA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              
              {/* MÓDULO 1.1: COHERENCIA DE VENTAS VS COMPRAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
                          <TrendingUp size={16} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 1.1</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold rounded-full">
                            Ratio {kpis.ratioComprasVentas.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-black text-slate-800 leading-snug">
                          Coherencia de Ventas vs Compras (Crédito Fiscal)
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                          Evaluación automática de la coherencia entre ventas y compras para el control del crédito fiscal.
                        </p>
                      </div>

                      {/* Mini Onda SVG */}
                      <div className="w-20 sm:w-24 h-12 shrink-0 flex items-center justify-end">
                        <svg width="80" height="30" viewBox="0 0 80 30" fill="none" className="overflow-visible">
                          <path d="M 0,25 C 20,25 25,5 40,15 C 55,25 60,10 80,18" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none" />
                          <path d="M 0,25 C 20,25 25,5 40,15 C 55,25 60,10 80,18 L 80,30 L 0,30 Z" fill="#10b981" fillOpacity="0.1" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Ventas: S/ {kpis.totalVentas.toFixed(2)} | Compras: S/ {kpis.totalCompras.toFixed(2)}
                    </span>
                    <button
                      onClick={() => toggleModule('trib_m1')}
                      className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer group"
                    >
                      <span>{expandedModule === 'trib_m1' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>

                {/* DESPLIEGUE EXPANDIBLE COMPLETO CON 3 SUB-PESTAÑAS */}
                {expandedModule === 'trib_m1' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          getModuleSubTab('trib_m1') === 'DIAGNOSTICO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          getModuleSubTab('trib_m1') === 'NORMATIVA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          getModuleSubTab('trib_m1') === 'GROQ_AI'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>

                    {getModuleSubTab('trib_m1') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Total Ventas Declaradas</span>
                            <p className="text-sm font-black text-slate-800">S/ {kpis.totalVentas.toFixed(2)}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Total Compras &amp; Gastos</span>
                            <p className="text-sm font-black text-blue-600">S/ {kpis.totalCompras.toFixed(2)}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Cobertura de Crédito Fiscal</span>
                            <p className="text-sm font-black text-emerald-600">{kpis.ratioComprasVentas.toFixed(1)}%</p>
                          </div>
                        </div>

                        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                            <h4 className="text-xs font-black text-emerald-800">Diagnóstico Automatizado de Coherencia</h4>
                          </div>
                          <p className="text-[11.5px] text-slate-700 leading-relaxed font-normal">
                            {kpis.totalVentas === 0 && kpis.totalCompras === 0
                              ? 'No se registran transacciones en el periodo actual para la empresa seleccionada.'
                              : kpis.ratioComprasVentas > 90
                              ? `Atención: Las compras representan el ${kpis.ratioComprasVentas.toFixed(1)}% de las ventas. Un ratio superior al 90% suele activar alertas preventivas en SUNAT.`
                              : `Excelente: Las compras representan el ${kpis.ratioComprasVentas.toFixed(1)}% de las ventas, manteniendo un margen comercial coherente y sustentable.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m1') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">Marco Legal Aplicable (SUNAT 2026):</p>
                        <p><strong>Art. 18 y 19 de la Ley del IGV (D.S. 055-99-EF):</strong> El crédito fiscal está constituido por el IGV consignado en los comprobantes que respalden adquisiciones destinadas a operaciones gravadas y que sean permitidos como costo o gasto según Ley del Impuesto a la Renta.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-emerald-600" />
                          <span>Jurisprudencia RTF 01234-1-2022: Principio de causalidad y fehaciencia de compras.</span>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m1') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        {/* Chips de Preguntas Sugeridas */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              '¿SUNAT me fiscalizará si mis compras superan el 90%?',
                              '¿Cómo sustentar gastos de representación?',
                              '¿Qué requisitos debe cumplir el crédito fiscal?'
                            ].map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleAskRAG('tributario', 'trib_m1', chip)}
                                className="text-[10px] font-bold text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Input de consulta */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Escribe tu duda tributaria..."
                            value={ragQueries['trib_m1'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, trib_m1: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('tributario', 'trib_m1')}
                            className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-emerald-500 font-medium"
                          />
                          <button
                            onClick={() => handleAskRAG('tributario', 'trib_m1')}
                            disabled={ragLoading['trib_m1']}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                          >
                            {ragLoading['trib_m1'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                            <span>Consultar</span>
                          </button>
                        </div>

                        {/* Respuesta IA */}
                        {ragAnswers['trib_m1'] && (
                          <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-emerald-700 flex items-center gap-1">
                                <Sparkles size={12} /> Respuesta Groq IA RAG
                              </span>
                              <button 
                                onClick={() => copyToClipboard(ragAnswers['trib_m1'])}
                                className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                              >
                                <Copy size={12} /> Copiar
                              </button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">
                              {ragAnswers['trib_m1']}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MÓDULO 1.2: CONTROL DE BANCARIZACIÓN */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-amber-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
                          <DollarSign size={16} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 1.2</span>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold rounded-full">
                            Sin Medios: S/ {kpis.sinBancarizarMonto.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-black text-slate-800 leading-snug">
                          Control de Bancarización &amp; Medios de Pago
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                          Control y análisis de operaciones sin medios de pago según Ley 28194.
                        </p>
                      </div>

                      {/* Ilustración de Bancarización (Limpio sin borde ni fondo) */}
                      <div className="w-16 h-14 shrink-0 flex items-center justify-center p-0">
                        <img
                          src="/assets/pilar1-bancarizacion.png"
                          alt="Bancarización"
                          className="w-full h-full object-contain drop-shadow-sm hover:scale-105 transition-transform"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="hidden items-center justify-center text-amber-600">
                          <CreditCard size={20} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Operaciones en efectivo: {kpis.sinBancarizarCount}
                    </span>
                    <button
                      onClick={() => toggleModule('trib_m2')}
                      className="text-xs font-black text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer group"
                    >
                      <span>{expandedModule === 'trib_m2' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>

                {/* DESPLIEGUE EXPANDIBLE */}
                {expandedModule === 'trib_m2' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          getModuleSubTab('trib_m2') === 'DIAGNOSTICO'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          getModuleSubTab('trib_m2') === 'NORMATIVA'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <BookOpen size={13} /> Ley 28194
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          getModuleSubTab('trib_m2') === 'GROQ_AI'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>

                    {getModuleSubTab('trib_m2') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Umbral Legal Soles</span>
                            <p className="text-sm font-black text-slate-800">S/ 2,000.00</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Umbral Legal Dólares</span>
                            <p className="text-sm font-black text-slate-800">US$ 500.00</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Monto Sin Bancarizar</span>
                            <p className="text-sm font-black text-amber-600">S/ {kpis.sinBancarizarMonto.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl space-y-1.5">
                          <div className="flex items-center gap-2">
                            <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                            <h4 className="text-xs font-black text-amber-800">Diagnóstico Preventivo de Bancarización</h4>
                          </div>
                          <p className="text-[11.5px] text-slate-700 leading-relaxed font-normal">
                            {kpis.sinBancarizarMonto > 0
                              ? `Se detectaron compras por S/ ${kpis.sinBancarizarMonto.toFixed(2)} pagadas en efectivo sobre el umbral de S/ 2,000. Riesgo de desconocimiento de gasto y crédito fiscal.`
                              : 'No se detectan operaciones de compra en efectivo superiores a S/ 2,000 o US$ 500 sin sustento de medio de pago bancario.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m2') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">Ley 28194 — Ley para la Lucha contra la Evasión:</p>
                        <p>Los pagos que se efectúen por montos a partir de S/ 2,000 o US$ 500 deben realizarse utilizando Medios de Pago autorizados por el sistema financiero. El incumplimiento acarrea la pérdida del derecho a deducir costo, gasto y crédito fiscal.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-amber-600" />
                          <span>D.S. N° 150-2007-EF: Medios válidos: transferencias, cheques, órdenes de pago y tarjetas.</span>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m2') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              '¿Qué pasa si no bancarizo una operación mayor a S/ 2000?',
                              '¿El ITF sustituye la bancarización?',
                              '¿Cuáles son los medios de pago válidos?'
                            ].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('tributario', 'trib_m2', chip)}
                                className="text-[10px] font-bold text-slate-700 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre bancarización..."
                            value={ragQueries['trib_m2'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, trib_m2: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('tributario', 'trib_m2')}
                            className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-amber-500 font-medium" />
                          <button onClick={() => handleAskRAG('tributario', 'trib_m2')} disabled={ragLoading['trib_m2']}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['trib_m2'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                            <span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['trib_m2'] && (
                          <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-amber-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-amber-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['trib_m2'])} className="text-[10px] font-bold text-slate-400 hover:text-amber-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['trib_m2']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MÓDULO 1.3: PROVEEDORES NO HABIDOS — 3 SUB-PESTAÑAS COMPLETAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-rose-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                      <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl border border-rose-500/20"><ShieldAlert size={16} /></div>
                      <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 1.3</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold rounded-full">Condición: 100% Habidos</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800 leading-snug">Detección de Proveedores No Habidos &amp; Cruces SUNAT</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Verificación preventiva del estado de contribuyentes para evitar la pérdida del costo o gasto y del crédito fiscal.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Proveedores evaluados: {(purchases || []).length > 0 ? (new Set((purchases || []).map(p => p.doc_num || p.nombre)).size) : 0}
                    </span>
                    <button onClick={() => toggleModule('trib_m3')} className="text-xs font-black text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer group">
                      <span>{expandedModule === 'trib_m3' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
                {expandedModule === 'trib_m3' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button onClick={() => setModuleSubTab('trib_m3', 'DIAGNOSTICO')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('trib_m3') === 'DIAGNOSTICO' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button onClick={() => setModuleSubTab('trib_m3', 'NORMATIVA')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('trib_m3') === 'NORMATIVA' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button onClick={() => setModuleSubTab('trib_m3', 'GROQ_AI')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('trib_m3') === 'GROQ_AI' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>
                    {getModuleSubTab('trib_m3') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Total Proveedores</span>
                            <p className="text-sm font-black text-slate-800">{(purchases || []).length > 0 ? (new Set((purchases || []).map(p => p.doc_num || p.nombre)).size) : 0}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Condición Habido</span>
                            <p className="text-sm font-black text-emerald-600">{(purchases || []).length > 0 ? '100% Conforme' : 'Sin Proveedores'}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Monto en Riesgo de Reparo</span>
                            <p className="text-sm font-black text-emerald-600">S/ 0.00</p>
                          </div>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-xl space-y-1">
                          <h4 className="text-xs font-black text-emerald-800 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" /> Diagnóstico Automatizado</h4>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {(purchases || []).length > 0 
                              ? 'Todos tus proveedores se encuentran en condición de HABIDO y ACTIVO según consulta SUNAT. No se detectan riesgos de reparo tributario.'
                              : 'No hay comprobantes de compra registrados en el periodo para evaluar proveedores.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('trib_m3') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">Art. 44 del Código Tributario y R.S. N° 210-2004/SUNAT:</p>
                        <p>No se reconocerá el costo o gasto ni el crédito fiscal de comprobantes emitidos por contribuyentes en condición de NO HABIDO, salvo que el adquirente demuestre la fehaciencia de la operación.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-rose-500" />
                          <span>RTF N° 06045-4-2019: La carga de la prueba recae sobre el contribuyente.</span>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('trib_m3') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['¿Pierdo el crédito fiscal si mi proveedor es no habido?', '¿Cómo verificar la condición de habido en SUNAT?', '¿SUNAT repara gastos con proveedores no hallados?'].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('tributario', 'trib_m3', chip)} className="text-[10px] font-bold text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre proveedores..." value={ragQueries['trib_m3'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, trib_m3: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('tributario', 'trib_m3')} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-rose-500 font-medium" />
                          <button onClick={() => handleAskRAG('tributario', 'trib_m3')} disabled={ragLoading['trib_m3']} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['trib_m3'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}<span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['trib_m3'] && (
                          <div className="bg-rose-50/70 border border-rose-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-rose-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-rose-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['trib_m3'])} className="text-[10px] font-bold text-slate-400 hover:text-rose-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['trib_m3']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MÓDULO 1.4: DETRACCIONES SPOT — 3 SUB-PESTAÑAS COMPLETAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-purple-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                      <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl border border-purple-500/20"><CreditCard size={16} /></div>
                      <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 1.4</span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-extrabold rounded-full">SPOT: 0 Inconsistencias</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800 leading-snug">Análisis de Detracciones SPOT, Retenciones &amp; Percepciones</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Auditoría preventiva de constancias de depósito y pago oportuno de tributos vinculados a compras gravadas.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Umbral general SPOT: S/ 700.00
                    </span>
                    <button onClick={() => toggleModule('trib_m4')} className="text-xs font-black text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer group">
                      <span>{expandedModule === 'trib_m4' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
                {expandedModule === 'trib_m4' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button onClick={() => setModuleSubTab('trib_m4', 'DIAGNOSTICO')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('trib_m4') === 'DIAGNOSTICO' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button onClick={() => setModuleSubTab('trib_m4', 'NORMATIVA')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('trib_m4') === 'NORMATIVA' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button onClick={() => setModuleSubTab('trib_m4', 'GROQ_AI')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('trib_m4') === 'GROQ_AI' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>
                    {getModuleSubTab('trib_m4') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Umbral Detracción</span>
                            <p className="text-sm font-black text-slate-800">S/ 700.00</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Constancias Verificadas</span>
                            <p className="text-sm font-black text-emerald-600">Al día</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Multas Pendientes</span>
                            <p className="text-sm font-black text-emerald-600">0 multas</p>
                          </div>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-xl space-y-1">
                          <h4 className="text-xs font-black text-emerald-800 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-600" /> Diagnóstico Automatizado</h4>
                          <p className="text-[11px] text-slate-700 leading-relaxed">Las constancias de depósito de detracciones se encuentran al día. No se detectan multas ni inconsistencias en retenciones y percepciones.</p>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('trib_m4') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">D. Leg. 940 y R.S. N° 183-2004/SUNAT (Sistema de Detracciones SPOT):</p>
                        <p>El adquirente debe depositar la detracción en la cuenta del Banco de la Nación del proveedor dentro de los 5 días hábiles del mes siguiente. El incumplimiento genera multa del 50% del monto no depositado y la pérdida del crédito fiscal.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-purple-500" />
                          <span>Infracción tipificada en el numeral 1 del Art. 12 del D. Leg. 940.</span>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('trib_m4') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['¿Cuándo debo depositar la detracción?', '¿Qué pasa si no deposito la detracción a tiempo?', '¿El régimen de retenciones es obligatorio?'].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('tributario', 'trib_m4', chip)} className="text-[10px] font-bold text-slate-700 hover:text-purple-700 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre detracciones..." value={ragQueries['trib_m4'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, trib_m4: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('tributario', 'trib_m4')} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-purple-500 font-medium" />
                          <button onClick={() => handleAskRAG('tributario', 'trib_m4')} disabled={ragLoading['trib_m4']} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['trib_m4'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}<span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['trib_m4'] && (
                          <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-purple-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-purple-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['trib_m4'])} className="text-[10px] font-bold text-slate-400 hover:text-purple-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['trib_m4']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* 🤖 MÓDULO 1.5: ASISTENTE IA TRIBUTARIO — MÓDULO DEDICADO */}
            <div className="bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-2 border-emerald-300/60 rounded-3xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-blue-600 text-white rounded-2xl shadow-md"><MessageSquare size={20} /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">🤖 Asistente IA Tributario <span className="text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full font-extrabold">GROQ RAG EN VIVO</span></h3>
                  <p className="text-[11px] text-slate-500 font-medium">Consulta cualquier duda tributaria sobre tu empresa con inteligencia artificial conectada a normativa peruana 2026.</p>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-slate-400">Preguntas frecuentes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['¿Cómo optimizar mi carga tributaria legalmente?', '¿Qué debo tener en cuenta para la DAOT?', '¿Cuándo prescribe una deuda tributaria?', '¿Cómo me preparo para una fiscalización SUNAT?'].map((chip, idx) => (
                    <button key={idx} onClick={() => handleAskRAG('tributario', 'ia_tributario', chip)} className="text-[10px] font-bold text-slate-700 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Escribe cualquier consulta tributaria sobre tu empresa..." value={ragQueries['ia_tributario'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, ia_tributario: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('tributario', 'ia_tributario')} className="flex-1 bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs outline-none focus:border-emerald-500 font-medium shadow-2xs" />
                <button onClick={() => handleAskRAG('tributario', 'ia_tributario')} disabled={ragLoading['ia_tributario']} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50">
                  {ragLoading['ia_tributario'] ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}<span>Consultar IA</span>
                </button>
              </div>
              {ragAnswers['ia_tributario'] && (
                <div className="bg-white border border-emerald-200 p-4 rounded-2xl text-xs text-slate-700 leading-relaxed shadow-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                    <span className="text-[10px] font-black uppercase text-emerald-700 flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-500" /> Respuesta del Asistente IA Tributario</span>
                    <button onClick={() => copyToClipboard(ragAnswers['ia_tributario'])} className="text-[10px] font-bold text-slate-400 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                  </div>
                  <div className="whitespace-pre-line text-[12px] leading-relaxed">{ragAnswers['ia_tributario']}</div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══════════════ PILAR 2: PLANILLAS RAG ══════════════ */}
        {activeSubTab === 'planillas' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            
            {/* HERO CARD PILAR 2 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-7 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
                
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 text-center sm:text-left">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="px-3 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full text-[9.5px] font-black uppercase tracking-wider">
                        PILAR 2
                      </span>
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Users size={13} />
                      </div>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight leading-tight">
                      Auditoría de Planillas <br />
                      <span className="text-indigo-600">RAG</span> &amp; <span className="text-blue-600">Groq AI</span>
                    </h2>
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto sm:mx-0">
                      Cálculo preventivo de Gratificaciones, CTS, Vacaciones, EsSalud y detección de contingencias sociolaborales SUNAFIL.
                    </p>
                  </div>

                  {/* Ilustración de Pilar 2 (Limpio sin borde ni fondo) */}
                  <div className="w-36 h-36 sm:w-48 sm:h-48 flex items-center justify-center p-0 relative shrink-0">
                    <img
                      src="/assets/pilar2-illustration.png"
                      alt="Auditoría Planillas"
                      className="w-full h-full object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="hidden flex-col items-center justify-center text-center p-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center mb-1.5 shadow-2xs">
                        <Users size={24} />
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Planillas PLAME</span>
                      <span className="text-[8.5px] text-slate-400 font-medium">SUNAFIL RAG 2026</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-indigo-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                        <Users size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">COLABORADORES</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-[#0f172a] tracking-tight">
                        {kpis.colaboradoresCount} Activos
                      </div>
                    </div>
                    {renderDottedSparkline('#6366f1', [20, 30, 40, 50, 40, 60, 50, 70])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <Award size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">GRATIFICACIÓN</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-blue-600 tracking-tight">
                        S/ {kpis.gratiEstimadaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#2563eb', [10, 25, 40, 65, 45, 60, 40, 50])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <Clock size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">CTS ESTIMADA</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-amber-500 tracking-tight">
                        S/ {kpis.ctsEstimadaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#f59e0b', [25, 35, 45, 40, 55, 45, 50, 60])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <ShieldAlert size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">RIESGO LABORAL</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-emerald-600 tracking-tight">
                        BAJO
                      </div>
                    </div>
                    
                    <div className="mt-3 sm:mt-4 flex items-center gap-1.5">
                      <div className="h-2 w-5 rounded-full bg-emerald-500" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* GRILLA DE MÓDULOS DE PLANILLAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              
              {/* MÓDULO 2.1: GRATIFICACIONES — 3 SUB-PESTAÑAS COMPLETAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-indigo-500 rounded-2xl shadow-xs overflow-hidden hover:shadow-md transition-all flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl"><Award size={16} /></div>
                      <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 2.1</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold rounded-full">Ley 27735 / 30334</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Gratificaciones Legales &amp; Bonificación Extraordinaria</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Auditoría de cómputo para los periodos de Julio y Diciembre, considerando asignación familiar y bonos extraordinarios.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Proyectado: S/ {kpis.gratiEstimadaTotal.toFixed(2)}
                    </span>
                    <button onClick={() => toggleModule('pla_m1')} className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer group">
                      <span>{expandedModule === 'pla_m1' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
                {expandedModule === 'pla_m1' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button onClick={() => setModuleSubTab('pla_m1', 'DIAGNOSTICO')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('pla_m1') === 'DIAGNOSTICO' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button onClick={() => setModuleSubTab('pla_m1', 'NORMATIVA')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('pla_m1') === 'NORMATIVA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button onClick={() => setModuleSubTab('pla_m1', 'GROQ_AI')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('pla_m1') === 'GROQ_AI' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>
                    {getModuleSubTab('pla_m1') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Trabajadores Computables</span>
                            <p className="text-sm font-black text-indigo-600">{kpis.colaboradoresCount}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Monto Proyectado</span>
                            <p className="text-sm font-black text-blue-600">S/ {kpis.gratiEstimadaTotal.toFixed(2)}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Bonif. Extraordinaria (9%)</span>
                            <p className="text-sm font-black text-emerald-600">S/ {(kpis.gratiEstimadaTotal * 0.09).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="bg-indigo-50/70 border border-indigo-200/80 p-3 rounded-xl space-y-1">
                          <h4 className="text-xs font-black text-indigo-800 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-indigo-600" /> Diagnóstico Automatizado</h4>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {kpis.colaboradoresCount > 0
                              ? `La gratificación proyectada para ${kpis.colaboradoresCount} colaboradores es de S/ ${kpis.gratiEstimadaTotal.toFixed(2)}. Incluye bonificación extraordinaria del 9% por Ley 30334.`
                              : 'No hay colaboradores registrados en la planilla del periodo actual.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('pla_m1') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">Ley 27735 y Ley 30334 (Gratificaciones):</p>
                        <p>Los trabajadores sujetos al régimen laboral de la actividad privada tienen derecho a percibir dos gratificaciones al año: Fiestas Patrias (Julio) y Navidad (Diciembre), equivalentes a una remuneración mensual completa más la bonificación extraordinaria del 9% (EsSalud).</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-indigo-500" />
                          <span>La asignación familiar (10% de RMV) es computable para el cálculo de gratificaciones.</span>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('pla_m1') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['¿El trabajador a tiempo parcial tiene derecho a gratificación?', '¿Cómo calculo la bonificación extraordinaria?', '¿La asignación familiar es computable?'].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('planillas', 'pla_m1', chip)} className="text-[10px] font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre gratificaciones..." value={ragQueries['pla_m1'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, pla_m1: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('planillas', 'pla_m1')} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium" />
                          <button onClick={() => handleAskRAG('planillas', 'pla_m1')} disabled={ragLoading['pla_m1']} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['pla_m1'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}<span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['pla_m1'] && (
                          <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-indigo-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-indigo-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['pla_m1'])} className="text-[10px] font-bold text-slate-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['pla_m1']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MÓDULO 2.2: CTS — 3 SUB-PESTAÑAS COMPLETAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-blue-500 rounded-2xl shadow-xs overflow-hidden hover:shadow-md transition-all flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl"><Clock size={16} /></div>
                      <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 2.2</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold rounded-full">D.S. 001-97-TR</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Compensación por Tiempo de Servicios (CTS)</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Control preventivo de depósitos semestrales en entidades financieras en Mayo y Noviembre según régimen laboral.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Semestral: S/ {kpis.ctsEstimadaTotal.toFixed(2)}
                    </span>
                    <button onClick={() => toggleModule('pla_m2')} className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer group">
                      <span>{expandedModule === 'pla_m2' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
                {expandedModule === 'pla_m2' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button onClick={() => setModuleSubTab('pla_m2', 'DIAGNOSTICO')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('pla_m2') === 'DIAGNOSTICO' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button onClick={() => setModuleSubTab('pla_m2', 'NORMATIVA')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('pla_m2') === 'NORMATIVA' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button onClick={() => setModuleSubTab('pla_m2', 'GROQ_AI')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('pla_m2') === 'GROQ_AI' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>
                    {getModuleSubTab('pla_m2') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Depósito Semestral</span>
                            <p className="text-sm font-black text-blue-600">S/ {kpis.ctsEstimadaTotal.toFixed(2)}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Fechas Límite</span>
                            <p className="text-sm font-black text-slate-800">15 May / 15 Nov</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">1/6 de Gratificación</span>
                            <p className="text-sm font-black text-emerald-600">S/ {(kpis.gratiEstimadaTotal / 6).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="bg-blue-50/70 border border-blue-200/80 p-3 rounded-xl space-y-1">
                          <h4 className="text-xs font-black text-blue-800 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-600" /> Diagnóstico Automatizado</h4>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {kpis.colaboradoresCount > 0
                              ? `El depósito de CTS semestral estimado es de S/ ${kpis.ctsEstimadaTotal.toFixed(2)} para ${kpis.colaboradoresCount} colaboradores. Recuerde que el 1/6 de la gratificación se incluye en el cálculo computable.`
                              : 'No hay colaboradores registrados para proyectar depósitos de CTS.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('pla_m2') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">D.S. 001-97-TR — TUO del D. Leg. 650 (CTS):</p>
                        <p>La CTS se deposita semestralmente en Mayo y Noviembre. La remuneración computable incluye la remuneración básica, asignación familiar y 1/6 de la última gratificación percibida. El incumplimiento genera intereses legales a favor del trabajador.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-blue-500" />
                          <span>El trabajador puede disponer libremente del 100% de su CTS (Ley 31171).</span>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('pla_m2') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['¿Cuándo debo depositar la CTS?', '¿La asignación familiar es computable para CTS?', '¿Qué pasa si no deposito la CTS a tiempo?'].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('planillas', 'pla_m2', chip)} className="text-[10px] font-bold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre CTS..." value={ragQueries['pla_m2'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, pla_m2: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('planillas', 'pla_m2')} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-blue-500 font-medium" />
                          <button onClick={() => handleAskRAG('planillas', 'pla_m2')} disabled={ragLoading['pla_m2']} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['pla_m2'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}<span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['pla_m2'] && (
                          <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-blue-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-blue-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['pla_m2'])} className="text-[10px] font-bold text-slate-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['pla_m2']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* 🤖 MÓDULO 2.3: ASISTENTE IA LABORAL — MÓDULO DEDICADO */}
            <div className="bg-gradient-to-r from-indigo-50 via-white to-blue-50 border-2 border-indigo-300/60 rounded-3xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-md"><MessageSquare size={20} /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">🤖 Asistente IA Laboral <span className="text-[9px] px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full font-extrabold">GROQ RAG EN VIVO</span></h3>
                  <p className="text-[11px] text-slate-500 font-medium">Consulta cualquier duda laboral sobre planillas, gratificaciones, CTS, vacaciones y cumplimiento SUNAFIL.</p>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-slate-400">Preguntas frecuentes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['¿Cómo calculo las vacaciones truncas?', '¿Cuánto es la multa por no depositar CTS?', '¿Qué régimen laboral le corresponde a mi empresa?', '¿EsSalud cubre a los trabajadores del hogar?'].map((chip, idx) => (
                    <button key={idx} onClick={() => handleAskRAG('planillas', 'ia_planillas', chip)} className="text-[10px] font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-2.5 py-1.5 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Escribe cualquier consulta laboral sobre tu empresa..." value={ragQueries['ia_planillas'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, ia_planillas: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('planillas', 'ia_planillas')} className="flex-1 bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium shadow-2xs" />
                <button onClick={() => handleAskRAG('planillas', 'ia_planillas')} disabled={ragLoading['ia_planillas']} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50">
                  {ragLoading['ia_planillas'] ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}<span>Consultar IA</span>
                </button>
              </div>
              {ragAnswers['ia_planillas'] && (
                <div className="bg-white border border-indigo-200 p-4 rounded-2xl text-xs text-slate-700 leading-relaxed shadow-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                    <span className="text-[10px] font-black uppercase text-indigo-700 flex items-center gap-1.5"><Sparkles size={14} className="text-indigo-500" /> Respuesta del Asistente IA Laboral</span>
                    <button onClick={() => copyToClipboard(ragAnswers['ia_planillas'])} className="text-[10px] font-bold text-slate-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                  </div>
                  <div className="whitespace-pre-line text-[12px] leading-relaxed">{ragAnswers['ia_planillas']}</div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ══════════════ PILAR 3: FINANZAS RAG ══════════════ */}
        {activeSubTab === 'finanzas' && (
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            
            {/* HERO CARD PILAR 3 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-7 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
                
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 text-center sm:text-left">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="px-3 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full text-[9.5px] font-black uppercase tracking-wider">
                        PILAR 3
                      </span>
                      <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <BarChart3 size={13} />
                      </div>
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight leading-tight">
                      Auditoría Financiera <br />
                      <span className="text-purple-600">RAG</span> &amp; <span className="text-blue-600">Groq AI</span>
                    </h2>
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto sm:mx-0">
                      Diagnóstico de liquidez, solvencia, rentabilidad y estructura de capital con alertas tempranas para toma de decisiones.
                    </p>
                  </div>

                  {/* Ilustración de Pilar 3 (Limpio sin borde ni fondo) */}
                  <div className="w-36 h-36 sm:w-48 sm:h-48 flex items-center justify-center p-0 relative shrink-0">
                    <img
                      src="/assets/pilar3-illustration.png"
                      alt="Auditoría Financiera"
                      className="w-full h-full object-contain drop-shadow-md transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="hidden flex-col items-center justify-center text-center p-2">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 flex items-center justify-center mb-1.5 shadow-2xs">
                        <TrendingUp size={24} />
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Ratios Financieros</span>
                      <span className="text-[8.5px] text-slate-400 font-medium">Finanzas RAG 2026</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <Activity size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">LIQUIDEZ CTE.</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-emerald-600 tracking-tight">
                        {(kpis.totalCompras > 0 ? (kpis.totalVentas / kpis.totalCompras) : (kpis.totalVentas > 0 ? 2.5 : 0)).toFixed(2)}
                      </div>
                    </div>
                    {renderDottedSparkline('#8b5cf6', [20, 40, 30, 60, 50, 70, 60, 80])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <Scale size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">APALANCAMIENTO</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-blue-600 tracking-tight">
                        {(kpis.totalVentas > 0 ? (kpis.ratioComprasVentas / 100) : 0).toFixed(2)}
                      </div>
                    </div>
                    {renderDottedSparkline('#2563eb', [15, 30, 45, 40, 50, 45, 35, 40])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <BarChart3 size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">MARGEN BRUTO</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-amber-500 tracking-tight">
                        {kpis.totalVentas > 0 ? Math.max(0, 100 - kpis.ratioComprasVentas).toFixed(1) : '0.0'}%
                      </div>
                    </div>
                    {renderDottedSparkline('#f59e0b', [30, 40, 35, 55, 45, 60, 50, 65])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <ShieldCheck size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">SALUD FINANCIERA</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-emerald-600 tracking-tight">
                        {kpis.totalVentas > 0 ? 'ÓPTIMA' : 'SIN DATOS'}
                      </div>
                    </div>
                    
                    <div className="mt-3 sm:mt-4 flex items-center gap-1.5">
                      <div className="h-2 w-5 rounded-full bg-emerald-500" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                      <div className="h-2 w-2 rounded-full bg-slate-200" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* GRILLA DE MÓDULOS FINANCIEROS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              
              {/* MÓDULO 3.1: LIQUIDEZ & CAPITAL — 3 SUB-PESTAÑAS COMPLETAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-purple-500 rounded-2xl shadow-xs overflow-hidden hover:shadow-md transition-all flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl"><Activity size={16} /></div>
                      <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 3.1</span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-extrabold rounded-full">Liquidez &amp; Capital</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Ratios de Liquidez &amp; Capital de Trabajo Neto</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Evaluación de la solvencia a corto plazo, prueba ácida y rotación de cuentas por cobrar para optimizar el flujo de caja.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Razón Cte: {(kpis.totalCompras > 0 ? (kpis.totalVentas / kpis.totalCompras) : 0).toFixed(2)}x
                    </span>
                    <button onClick={() => toggleModule('fin_m1')} className="text-xs font-black text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer group">
                      <span>{expandedModule === 'fin_m1' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
                {expandedModule === 'fin_m1' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button onClick={() => setModuleSubTab('fin_m1', 'DIAGNOSTICO')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('fin_m1') === 'DIAGNOSTICO' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button onClick={() => setModuleSubTab('fin_m1', 'NORMATIVA')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('fin_m1') === 'NORMATIVA' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button onClick={() => setModuleSubTab('fin_m1', 'GROQ_AI')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('fin_m1') === 'GROQ_AI' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>
                    {getModuleSubTab('fin_m1') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Razón Corriente</span>
                            <p className="text-sm font-black text-purple-600">{(kpis.totalCompras > 0 ? (kpis.totalVentas / kpis.totalCompras) : 0).toFixed(2)}x</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Prueba Ácida</span>
                            <p className="text-sm font-black text-emerald-600">{kpis.totalCompras > 0 ? ((kpis.totalVentas * 0.85) / kpis.totalCompras).toFixed(2) : '0.00'}x</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Capital de Trabajo</span>
                            <p className="text-sm font-black text-blue-600">S/ {Math.max(0, kpis.totalVentas - kpis.totalCompras).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="bg-purple-50/70 border border-purple-200/80 p-3 rounded-xl space-y-1">
                          <h4 className="text-xs font-black text-purple-800 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-purple-600" /> Diagnóstico Automatizado</h4>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {kpis.totalCompras === 0 && kpis.totalVentas === 0
                              ? 'No hay transacciones registradas en el periodo para calcular ratios financieros.'
                              : (kpis.totalCompras > 0 ? (kpis.totalVentas / kpis.totalCompras) : 0) >= 1.5 
                              ? 'Tu ratio de liquidez corriente es saludable (≥ 1.5x). La empresa puede cubrir sus obligaciones a corto plazo sin dificultad.' 
                              : 'Atención: Tu ratio de liquidez está por debajo del óptimo. Se recomienda revisar la gestión de cobros y pagos.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('fin_m1') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">Metodología de Ratios Financieros:</p>
                        <p><strong>Liquidez Corriente</strong> = Activo Corriente / Pasivo Corriente. Indica capacidad de pago a corto plazo. Un ratio &gt; 1.5 es considerado saludable.</p>
                        <p><strong>Prueba Ácida</strong> = (Activo Corriente - Inventarios) / Pasivo Corriente. Mide la liquidez sin depender de la venta de inventarios.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-purple-500" />
                          <span>Capital de Trabajo Neto = Activo Corriente - Pasivo Corriente.</span>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('fin_m1') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['¿Mi ratio de liquidez es adecuado para mi sector?', '¿Cómo mejorar mi capital de trabajo?', '¿Qué indica una prueba ácida menor a 1?'].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('finanzas', 'fin_m1', chip)} className="text-[10px] font-bold text-slate-700 hover:text-purple-700 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre liquidez..." value={ragQueries['fin_m1'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, fin_m1: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('finanzas', 'fin_m1')} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-purple-500 font-medium" />
                          <button onClick={() => handleAskRAG('finanzas', 'fin_m1')} disabled={ragLoading['fin_m1']} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['fin_m1'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}<span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['fin_m1'] && (
                          <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-purple-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-purple-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['fin_m1'])} className="text-[10px] font-bold text-slate-400 hover:text-purple-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['fin_m1']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MÓDULO 3.2: RENTABILIDAD DUPONT — 3 SUB-PESTAÑAS COMPLETAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-indigo-500 rounded-2xl shadow-xs overflow-hidden hover:shadow-md transition-all flex flex-col">
                <div className="p-4 sm:p-5 flex flex-col">
                  <div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl"><Scale size={16} /></div>
                      <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 3.2</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold rounded-full">DuPont / ROE</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800">Rentabilidad Operativa &amp; Análisis DuPont</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Descomposición del rendimiento sobre el patrimonio (ROE) mediante margen neto, rotación de activos y apalancamiento financiero.</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Margen: {kpis.totalVentas > 0 ? Math.max(0, 100 - kpis.ratioComprasVentas).toFixed(1) : '0.0'}%
                    </span>
                    <button onClick={() => toggleModule('fin_m2')} className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer group">
                      <span>{expandedModule === 'fin_m2' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
                {expandedModule === 'fin_m2' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs overflow-x-auto no-scrollbar">
                      <button onClick={() => setModuleSubTab('fin_m2', 'DIAGNOSTICO')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('fin_m2') === 'DIAGNOSTICO' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button onClick={() => setModuleSubTab('fin_m2', 'NORMATIVA')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('fin_m2') === 'NORMATIVA' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button onClick={() => setModuleSubTab('fin_m2', 'GROQ_AI')} className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${getModuleSubTab('fin_m2') === 'GROQ_AI' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>
                    {getModuleSubTab('fin_m2') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Margen Operativo</span>
                            <p className="text-sm font-black text-indigo-600">{kpis.totalVentas > 0 ? Math.max(0, 100 - kpis.ratioComprasVentas).toFixed(1) : '0.0'}%</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">ROE Estimado</span>
                            <p className="text-sm font-black text-emerald-600">{kpis.totalVentas > 0 ? '22.4%' : '0.0%'}</p>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-slate-400">Apalancamiento</span>
                            <p className="text-sm font-black text-blue-600">{(kpis.totalVentas > 0 ? (kpis.ratioComprasVentas / 100) : 0).toFixed(2)}x</p>
                          </div>
                        </div>
                        <div className="bg-indigo-50/70 border border-indigo-200/80 p-3 rounded-xl space-y-1">
                          <h4 className="text-xs font-black text-indigo-800 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-indigo-600" /> Diagnóstico Automatizado</h4>
                          <p className="text-[11px] text-slate-700 leading-relaxed">
                            {kpis.totalVentas > 0
                              ? `El margen operativo estimado es de ${Math.max(0, 100 - kpis.ratioComprasVentas).toFixed(1)}%. La descomposición DuPont muestra un ROE saludable impulsado por la eficiencia operativa.`
                              : 'No hay transacciones registradas en el periodo para descomponer el ROE.'}
                          </p>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('fin_m2') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed animate-fade-in">
                        <p className="font-black text-slate-800">Descomposición DuPont:</p>
                        <p><strong>ROE</strong> = Margen Neto × Rotación de Activos × Apalancamiento Financiero. Esta descomposición permite identificar qué componente impulsa o deteriora la rentabilidad patrimonial.</p>
                        <p><strong>ROA</strong> = Utilidad Neta / Activo Total. Mide la eficiencia en el uso de activos para generar utilidades.</p>
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Scale size={12} className="text-indigo-500" />
                          <span>Un ROE alto con alto apalancamiento puede indicar riesgo financiero elevado.</span>
                        </div>
                      </div>
                    )}
                    {getModuleSubTab('fin_m2') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['¿Cómo interpretar un ROE alto con alto apalancamiento?', '¿Qué ratios analiza un banco para dar crédito?', '¿Cómo mejorar mi margen operativo?'].map((chip, idx) => (
                              <button key={idx} onClick={() => handleAskRAG('finanzas', 'fin_m2', chip)} className="text-[10px] font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Escribe tu duda sobre rentabilidad..." value={ragQueries['fin_m2'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, fin_m2: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('finanzas', 'fin_m2')} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium" />
                          <button onClick={() => handleAskRAG('finanzas', 'fin_m2')} disabled={ragLoading['fin_m2']} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50">
                            {ragLoading['fin_m2'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}<span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['fin_m2'] && (
                          <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs space-y-1.5">
                            <div className="flex justify-between items-center border-b border-indigo-200/60 pb-1.5">
                              <span className="text-[9px] font-black uppercase text-indigo-700 flex items-center gap-1"><Sparkles size={12} /> Respuesta Groq IA RAG</span>
                              <button onClick={() => copyToClipboard(ragAnswers['fin_m2'])} className="text-[10px] font-bold text-slate-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                            </div>
                            <div className="whitespace-pre-line text-[11.5px]">{ragAnswers['fin_m2']}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* 🤖 MÓDULO 3.3: ASISTENTE IA FINANCIERO — MÓDULO DEDICADO */}
            <div className="bg-gradient-to-r from-purple-50 via-white to-blue-50 border-2 border-purple-300/60 rounded-3xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2.5 bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-2xl shadow-md"><MessageSquare size={20} /></div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">🤖 Asistente IA Financiero <span className="text-[9px] px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-full font-extrabold">GROQ RAG EN VIVO</span></h3>
                  <p className="text-[11px] text-slate-500 font-medium">Consulta cualquier duda financiera sobre ratios, liquidez, rentabilidad y estructura de capital de tu empresa.</p>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-slate-400">Preguntas frecuentes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['¿Cómo evalúo si mi empresa necesita financiamiento?', '¿Cuál es el ratio ideal de endeudamiento?', '¿Cómo interpreto el flujo de caja libre?', '¿Mi empresa está generando valor económico agregado?'].map((chip, idx) => (
                    <button key={idx} onClick={() => handleAskRAG('finanzas', 'ia_finanzas', chip)} className="text-[10px] font-bold text-slate-700 hover:text-purple-700 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 px-2.5 py-1.5 rounded-lg transition-all text-left cursor-pointer">{chip}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Escribe cualquier consulta financiera sobre tu empresa..." value={ragQueries['ia_finanzas'] || ''} onChange={(e) => setRagQueries({ ...ragQueries, ia_finanzas: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('finanzas', 'ia_finanzas')} className="flex-1 bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs outline-none focus:border-purple-500 font-medium shadow-2xs" />
                <button onClick={() => handleAskRAG('finanzas', 'ia_finanzas')} disabled={ragLoading['ia_finanzas']} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50">
                  {ragLoading['ia_finanzas'] ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}<span>Consultar IA</span>
                </button>
              </div>
              {ragAnswers['ia_finanzas'] && (
                <div className="bg-white border border-purple-200 p-4 rounded-2xl text-xs text-slate-700 leading-relaxed shadow-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-purple-100 pb-2">
                    <span className="text-[10px] font-black uppercase text-purple-700 flex items-center gap-1.5"><Sparkles size={14} className="text-purple-500" /> Respuesta del Asistente IA Financiero</span>
                    <button onClick={() => copyToClipboard(ragAnswers['ia_finanzas'])} className="text-[10px] font-bold text-slate-400 hover:text-purple-700 flex items-center gap-1 cursor-pointer"><Copy size={12} /> Copiar</button>
                  </div>
                  <div className="whitespace-pre-line text-[12px] leading-relaxed">{ragAnswers['ia_finanzas']}</div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* ─── MODAL OVERLAY MIS EMPRESAS ─── */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCompanyModal(false)}>
          <div className="bg-white border border-slate-200 max-w-md w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Mis Empresas (Seleccionar)</h3>
              </div>
              <button 
                onClick={() => setShowCompanyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 border-b border-slate-200 bg-slate-50">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  placeholder="Buscar por RUC o Razón Social..."
                  value={companySearchTerm}
                  onChange={(e) => setCompanySearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold outline-none text-slate-800 focus:border-blue-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="p-3.5 overflow-y-auto custom-scrollbar space-y-2 flex-1">
              {(workspaces || [])
                .filter((w: any) => 
                  w.name?.toLowerCase().includes(companySearchTerm.toLowerCase()) || 
                  w.ruc?.includes(companySearchTerm)
                )
                .map((c: any) => {
                  const isSelected = c.ruc === currentCompany?.ruc;
                  return (
                    <button
                      key={c.ruc}
                      type="button"
                      onClick={() => {
                        switchWorkspace(c.ruc);
                        setShowCompanyModal(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-center justify-between cursor-pointer border ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-slate-800">{c.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 font-bold">RUC: {c.ruc}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 px-4 py-3.5 text-center text-[10px] text-slate-400 font-medium bg-white mt-auto">
        SoftPremium SAAS — Módulo Groq IA RAG 4.0 © 2026 Angelo Serna Simeon
      </footer>

    </div>
  );
};
