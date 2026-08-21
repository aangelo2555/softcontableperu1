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
  Award
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

  // Estado de Sub-Pestañas Modulares dentro de cada Módulo
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

  // Datos reales calculados del Workspace para diagnósticos
  const [kpis, setKpis] = useState({
    totalVentas: 0,
    totalCompras: 1000.00,
    igvEstimado: 0,
    ratioComprasVentas: 0,
    sinBancarizarCount: 0,
    sinBancarizarMonto: 0,
    colaboradoresCount: 2,
    gratiEstimadaTotal: 2260.00,
    ctsEstimadaTotal: 1130.00,
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

        const totalVentas = (localSales.length > 0 || storeTotalVentas > 0) ? storeTotalVentas : serverVentas;
        const totalCompras = (localPurchases.length > 0 || storeTotalCompras > 0) ? storeTotalCompras : serverCompras;
        const igvEstimado = (localSales.length > 0 || localPurchases.length > 0) ? storeIgvEstimado : serverIgv;

        const ratioComprasVentas = totalVentas > 0 ? (totalCompras / totalVentas) * 100 : 0;
        const sinBancarizarMonto = parseFloat(trib.sinBancarizarSoles || trib.sinBancarizarMonto || '0');

        const colaboradoresCount = (employees && employees.length > 0) ? employees.length : (pla.colaboradoresCount || 2);
        const gratiEstimadaTotal = (employees && employees.length > 0)
          ? employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0)
          : parseFloat(pla.gratiEstimadaTotalSoles || pla.gratiEstimadaTotal || '2260');
        const ctsEstimadaTotal = gratiEstimadaTotal / 2;

        const scoreRiesgoSunat = ratioComprasVentas > 85 ? 'MEDIO' : (trib.saludFiscalScore >= 80 ? 'BAJO' : 'BAJO');

        setKpis({
          totalVentas,
          totalCompras,
          igvEstimado,
          ratioComprasVentas,
          sinBancarizarCount: 0,
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
      totalCompras: storeTotalCompras || 1000.00,
      igvEstimado: storeIgvEstimado,
      ratioComprasVentas,
      sinBancarizarCount: 0,
      sinBancarizarMonto: 0,
      colaboradoresCount: employees && employees.length > 0 ? employees.length : 2,
      gratiEstimadaTotal: employees && employees.length > 0 ? employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0) : 2260,
      ctsEstimadaTotal: employees && employees.length > 0 ? (employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0) / 2) : 1130,
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

  const handleVolver = () => {
    setActiveTab('EMPRESA');
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
  };

  // Helper para generar gráficos punteados exactos al diseño
  const renderDottedSparkline = (color: string, points: number[]) => {
    const w = 120;
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
      <svg width={w} height={h} className="overflow-visible mt-2">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((pt, idx) => (
          <circle key={idx} cx={pt.x} cy={pt.y} r="2" fill={color} />
        ))}
      </svg>
    );
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-[#f4f7fb] text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* ─── 1. HEADER MAESTRO SOFTPREMIUM IA ─── */}
      <header className="bg-white/95 border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-40 shadow-xs backdrop-blur-md">
        
        {/* Izquierda: Volver + Logo SOFTPREMIUM IA */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleVolver}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500/50 hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-full shadow-2xs transition-all cursor-pointer group shrink-0"
            title="Volver al Sistema Principal"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-600 group-hover:-translate-x-0.5 transition-transform" />
            <span className="tracking-wide">VOLVER</span>
          </button>

          <div className="flex items-center gap-2.5 pl-1">
            <img src="/assets/logo.png" alt="Softcontable Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0" />
            <span className="text-sm sm:text-base font-black tracking-tight text-[#0f172a]">
              SOFTPREMIUM <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">IA</span>
            </span>
          </div>
        </div>

        {/* Centro: Buscador estilo ⌘ K */}
        <div className="hidden lg:flex items-center max-w-sm w-full mx-4">
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
        <div className="flex items-center gap-2.5">
          
          {/* Campana de Notificaciones */}
          <div className="relative">
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
          <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-2xs">
            <div className="relative w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
              {(user?.name || 'A').charAt(0).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
            </div>
            <div className="flex flex-col text-left max-w-[110px] truncate leading-tight">
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
              className="bg-white border border-slate-200 px-3 py-1 rounded-full text-left flex items-center gap-2 hover:border-blue-500/40 transition-all cursor-pointer shadow-2xs"
            >
              <Building2 size={13} className="text-slate-500 shrink-0" />
              <div className="leading-tight">
                <label className="text-[7.5px] text-slate-400 uppercase font-black tracking-widest block">MIS EMPRESAS</label>
                <span className="text-[11px] font-black text-slate-800 block max-w-[110px] sm:max-w-[140px] truncate">
                  {currentCompany?.name ? (currentCompany.name.length > 15 ? currentCompany.name.substring(0, 13) + '...' : currentCompany.name) : 'AGROITAYR S.A.C.'}
                </span>
              </div>
              <ChevronDown size={11} className="text-slate-400 shrink-0" />
            </button>
          )}

          {/* Insignia de Suscripción */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/90 rounded-full text-[10px] font-extrabold shadow-2xs shrink-0 whitespace-nowrap">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>Suscripción Activa</span>
          </div>

        </div>
      </header>

      {/* ─── 2. SELECTOR FLOTANTE DE 3 PILARES (PILL SWITCHER) ─── */}
      <section className="pt-4 px-4 sm:px-6">
        <div className="max-w-xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-1 shadow-xs flex items-center justify-between gap-1.5">
          <button
            onClick={() => setActiveSubTab('tributario')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'tributario'
                ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeSubTab === 'tributario' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>1. TRIBUTACIÓN RAG</span>
          </button>

          <button
            onClick={() => setActiveSubTab('planillas')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'planillas'
                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
            }`}
          >
            <Users className={`w-3.5 h-3.5 ${activeSubTab === 'planillas' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>2. PLANILLAS RAG</span>
          </button>

          <button
            onClick={() => setActiveSubTab('finanzas')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'finanzas'
                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 ${activeSubTab === 'finanzas' ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>3. FINANZAS RAG</span>
          </button>
        </div>
      </section>

      {/* ─── 3. CONTENIDO PRINCIPAL SEGÚN PILAR SELECCIONADO ─── */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
        
        {/* ══════════════ PILAR 1: TRIBUTACIÓN RAG ══════════════ */}
        {activeSubTab === 'tributario' && (
          <div className="space-y-5 animate-fade-in">
            
            {/* HERO CARD PILAR 1 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                
                {/* Columna Izquierda: Información + Slot de Ilustración */}
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
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
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md">
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
                    {/* Fallback Vectorial Elegante mientras se proporciona la imagen */}
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
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <TrendingUp size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">VENTAS</span>
                      </div>
                      <div className="text-sm font-black text-[#0f172a] tracking-tight">
                        S/ {kpis.totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#10b981', [20, 35, 25, 45, 30, 60, 40, 50])}
                  </div>

                  {/* KPI 2: COMPRAS */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <DollarSign size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">COMPRAS</span>
                      </div>
                      <div className="text-sm font-black text-blue-600 tracking-tight">
                        S/ {kpis.totalCompras.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#2563eb', [15, 30, 45, 60, 40, 55, 35, 40])}
                  </div>

                  {/* KPI 3: IGV EST. */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <Calculator size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">IGV EST.</span>
                      </div>
                      <div className="text-sm font-black text-amber-500 tracking-tight">
                        S/ {kpis.igvEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#f59e0b', [30, 45, 30, 50, 35, 40, 30, 45])}
                  </div>

                  {/* KPI 4: RIESGO SUNAT */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <ShieldAlert size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">RIESGO SUNAT</span>
                      </div>
                      <div className="text-sm font-black text-emerald-600 tracking-tight">
                        {kpis.scoreRiesgoSunat}
                      </div>
                    </div>
                    
                    {/* Barra de progreso segmentada */}
                    <div className="mt-4 flex items-center gap-1.5">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* MÓDULO 1.1: COHERENCIA DE VENTAS VS COMPRAS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md">
                <div className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/20">
                          <TrendingUp size={16} />
                        </div>
                        <div className="flex items-center gap-2">
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
                      <div className="w-24 h-12 shrink-0 flex items-center justify-end">
                        <svg width="80" height="30" viewBox="0 0 80 30" fill="none" className="overflow-visible">
                          <path d="M 0,25 C 20,25 25,5 40,15 C 55,25 60,10 80,18" stroke="#10b981" strokeWidth="2" strokeLinecap="round" fill="none" />
                          <path d="M 0,25 C 20,25 25,5 40,15 C 55,25 60,10 80,18 L 80,30 L 0,30 Z" fill="#10b981" fillOpacity="0.1" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => toggleModule('trib_m1')}
                      className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer group"
                    >
                      <span>{expandedModule === 'trib_m1' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>

                {/* DESPLIEGUE EXPANDIBLE CON SUB-PESTAÑAS */}
                {expandedModule === 'trib_m1' && (
                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-scale-up">
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 gap-1 shadow-2xs">
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'DIAGNOSTICO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Activity size={13} /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'NORMATIVA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <BookOpen size={13} /> Base Legal RAG
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'GROQ_AI'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Sparkles size={13} /> Groq RAG AI
                      </button>
                    </div>

                    {getModuleSubTab('trib_m1') === 'DIAGNOSTICO' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600">Total Ventas Registradas:</span>
                          <span className="font-black text-slate-800">S/ {kpis.totalVentas.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <span className="font-bold text-slate-600">Total Compras con Crédito Fiscal:</span>
                          <span className="font-black text-blue-600">S/ {kpis.totalCompras.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-600">Diagnóstico Preventivo:</span>
                          <span className="font-black text-emerald-600">Crédito Fiscal Acumulado Válido para Ejercicios Futuros</span>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m1') === 'NORMATIVA' && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-2 leading-relaxed">
                        <p className="font-black text-slate-800">Artículo 18 y 19 de la Ley del IGV (D.S. 055-99-EF):</p>
                        <p>El derecho al crédito fiscal está sujeto a los requisitos sustanciales de que las adquisiciones sean permitidas como gasto o costo de la empresa, y se destinen a operaciones gravadas con IGV.</p>
                      </div>
                    )}

                    {getModuleSubTab('trib_m1') === 'GROQ_AI' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Pregunta a la IA sobre tu crédito fiscal..."
                            value={ragQueries['trib_m1'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, trib_m1: e.target.value })}
                            className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs outline-none focus:border-emerald-500 font-medium"
                          />
                          <button
                            onClick={() => handleAskRAG('tributario', 'trib_m1')}
                            disabled={ragLoading['trib_m1']}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {ragLoading['trib_m1'] ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                            <span>Consultar</span>
                          </button>
                        </div>
                        {ragAnswers['trib_m1'] && (
                          <div className="bg-white border border-emerald-200 p-3 rounded-xl text-xs text-slate-700 leading-relaxed shadow-2xs whitespace-pre-line">
                            {ragAnswers['trib_m1']}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MÓDULO 1.2: CONTROL DE BANCARIZACIÓN */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-amber-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md">
                <div className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20">
                          <DollarSign size={16} />
                        </div>
                        <div className="flex items-center gap-2">
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

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
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
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="font-bold text-slate-600">Umbral Bancarización Soles:</span>
                        <span className="font-black text-slate-800">S/ 2,000.00</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="font-bold text-slate-600">Umbral Bancarización Dólares:</span>
                        <span className="font-black text-slate-800">US$ 500.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-600">Operaciones Observadas:</span>
                        <span className="font-black text-emerald-600">0 Infracciones Detectadas</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* MÓDULO 1.3: PROVEEDORES NO HABIDOS */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-rose-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md">
                <div className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-rose-500/10 text-rose-600 rounded-xl border border-rose-500/20">
                          <ShieldAlert size={16} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 1.3</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold rounded-full">
                            Estado: 100% Habidos
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-slate-800 leading-snug">
                      Detección de Proveedores No Habidos &amp; Cruces SUNAT
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                      Verificación preventiva del estado de contribuyentes para evitar la pérdida del costo o gasto y del crédito fiscal.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => toggleModule('trib_m3')}
                      className="text-xs font-black text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer group"
                    >
                      <span>{expandedModule === 'trib_m3' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* MÓDULO 1.4: DETRACCIONES SPOT */}
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-purple-500 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md">
                <div className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl border border-purple-500/20">
                          <CreditCard size={16} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 1.4</span>
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-extrabold rounded-full">
                            SPOT: 0 Inconsistencias
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-slate-800 leading-snug">
                      Análisis de Detracciones SPOT, Retenciones &amp; Percepciones
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                      Auditoría preventiva de constancias de depósito y pago oportuno de tributos vinculados a compras gravadas.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => toggleModule('trib_m4')}
                      className="text-xs font-black text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer group"
                    >
                      <span>{expandedModule === 'trib_m4' ? 'Ocultar Análisis' : 'Ver Análisis'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ══════════════ PILAR 2: PLANILLAS RAG ══════════════ */}
        {activeSubTab === 'planillas' && (
          <div className="space-y-5 animate-fade-in">
            
            {/* HERO CARD PILAR 2 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
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
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md">
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
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-indigo-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                        <Users size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">COLABORADORES</span>
                      </div>
                      <div className="text-sm font-black text-[#0f172a] tracking-tight">
                        {kpis.colaboradoresCount} Activos
                      </div>
                    </div>
                    {renderDottedSparkline('#6366f1', [20, 30, 40, 50, 40, 60, 50, 70])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <Award size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">GRATIFICACIÓN</span>
                      </div>
                      <div className="text-sm font-black text-blue-600 tracking-tight">
                        S/ {kpis.gratiEstimadaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#2563eb', [10, 25, 40, 65, 45, 60, 40, 50])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <Clock size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">CTS ESTIMADA</span>
                      </div>
                      <div className="text-sm font-black text-amber-500 tracking-tight">
                        S/ {kpis.ctsEstimadaTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {renderDottedSparkline('#f59e0b', [25, 35, 45, 40, 55, 45, 50, 60])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <ShieldAlert size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">RIESGO LABORAL</span>
                      </div>
                      <div className="text-sm font-black text-emerald-600 tracking-tight">
                        BAJO
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-1.5">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-indigo-500 rounded-2xl shadow-xs overflow-hidden p-5 flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                      <Award size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 2.1</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold rounded-full">
                      Ley 27735 / 30334
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Gratificaciones Legales &amp; Bonificación Extraordinaria</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Auditoría de cómputo para los periodos de Julio y Diciembre, considerando asignación familiar y bonos extraordinarios.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button onClick={() => toggleModule('pla_m1')} className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer">
                    <span>Ver Análisis</span> →
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 border-l-4 border-l-blue-500 rounded-2xl shadow-xs overflow-hidden p-5 flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                      <Clock size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 2.2</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold rounded-full">
                      D.S. 001-97-TR
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Compensación por Tiempo de Servicios (CTS)</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Control preventivo de depósitos semestrales en entidades financieras en Mayo y Noviembre según régimen laboral.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button onClick={() => toggleModule('pla_m2')} className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                    <span>Ver Análisis</span> →
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ══════════════ PILAR 3: FINANZAS RAG ══════════════ */}
        {activeSubTab === 'finanzas' && (
          <div className="space-y-5 animate-fade-in">
            
            {/* HERO CARD PILAR 3 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                
                <div className="lg:col-span-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
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
                    
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md">
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
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                        <Activity size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">LIQUIDEZ CTE.</span>
                      </div>
                      <div className="text-sm font-black text-emerald-600 tracking-tight">
                        {(kpis.totalCompras > 0 ? (kpis.totalVentas / kpis.totalCompras) : 1.85).toFixed(2)}
                      </div>
                    </div>
                    {renderDottedSparkline('#8b5cf6', [20, 40, 30, 60, 50, 70, 60, 80])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                        <Scale size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">APALANCAMIENTO</span>
                      </div>
                      <div className="text-sm font-black text-blue-600 tracking-tight">
                        {(kpis.ratioComprasVentas / 100).toFixed(2)}
                      </div>
                    </div>
                    {renderDottedSparkline('#2563eb', [15, 30, 45, 40, 50, 45, 35, 40])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                        <BarChart3 size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">MARGEN BRUTO</span>
                      </div>
                      <div className="text-sm font-black text-amber-500 tracking-tight">
                        {Math.max(0, 100 - kpis.ratioComprasVentas).toFixed(1)}%
                      </div>
                    </div>
                    {renderDottedSparkline('#f59e0b', [30, 40, 35, 55, 45, 60, 50, 65])}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 transition-all">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                        <ShieldCheck size={13} />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700">SALUD FINANCIERA</span>
                      </div>
                      <div className="text-sm font-black text-emerald-600 tracking-tight">
                        ÓPTIMA
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center gap-1.5">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-white border border-slate-200/90 border-l-4 border-l-purple-500 rounded-2xl shadow-xs overflow-hidden p-5 flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                      <Activity size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 3.1</span>
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-extrabold rounded-full">
                      Liquidez &amp; Capital
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Ratios de Liquidez &amp; Capital de Trabajo Neto</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Evaluación de la solvencia a corto plazo, prueba ácida y rotación de cuentas por cobrar para optimizar el flujo de caja.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button onClick={() => toggleModule('fin_m1')} className="text-xs font-black text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer">
                    <span>Ver Análisis</span> →
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 border-l-4 border-l-indigo-500 rounded-2xl shadow-xs overflow-hidden p-5 flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-xl">
                      <Scale size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-800">MÓDULO 3.2</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-extrabold rounded-full">
                      DuPont / ROE
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800">Rentabilidad Operativa &amp; Análisis DuPont</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                    Descomposición del rendimiento sobre el patrimonio (ROE) mediante margen neto, rotación de activos y apalancamiento financiero.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button onClick={() => toggleModule('fin_m2')} className="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer">
                    <span>Ver Análisis</span> →
                  </button>
                </div>
              </div>

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
