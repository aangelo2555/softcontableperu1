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
  HelpCircle, 
  BookOpen, 
  Send, 
  RefreshCw, 
  Download, 
  DollarSign, 
  Calculator, 
  CreditCard,
  UploadCloud,
  FileCheck,
  Check,
  Zap,
  Clock,
  ArrowLeft,
  Cpu,
  BarChart3,
  MessageSquare,
  Scale,
  Activity,
  Award,
  Copy,
  Info,
  Building,
  X,
  Search
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
              name: payload.name || payload.nombre || payload.email?.split('@')[0] || 'Usuario Logueado',
              email: payload.email || '',
              role: payload.role || 'user'
            };
          }
        }
      }
    } catch (e) {}
    return null;
  }, []);

  const isAdmin = user?.role === 'admin' || (user?.email || '').toLowerCase() === 'aangelo2555@gmail.com';

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = (urlParams.get('tab') as 'tributario' | 'planillas' | 'finanzas' | 'subscription') || 'subscription';

  const [activeSubTab, setActiveSubTab] = useState<'tributario' | 'planillas' | 'finanzas' | 'subscription'>(initialTab);
  const [isPremiumActive, setIsPremiumActive] = useState<boolean>(false);
  const [premiumTiers, setPremiumTiers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Módulo Expandido Inline (Accordion Responsivo)
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Estado de Sub-Pestañas Modulares dentro de cada Módulo (Eliminación de ruido visual)
  const [moduleSubTabs, setModuleSubTabs] = useState<Record<string, 'DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI'>>({});

  const getModuleSubTab = (moduleKey: string): 'DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI' => {
    return moduleSubTabs[moduleKey] || 'DIAGNOSTICO';
  };

  const setModuleSubTab = (moduleKey: string, tab: 'DIAGNOSTICO' | 'NORMATIVA' | 'GROQ_AI') => {
    setModuleSubTabs(prev => ({ ...prev, [moduleKey]: tab }));
  };

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
        const hasAccess = data.hasAccess || data.premium_enabled || data.role === 'admin' || userEmail === 'aangelo2555@gmail.com';
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

    // Métricas del store local para la empresa seleccionada
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

        // Garantizar alineación total con la empresa seleccionada
        const totalVentas = (localSales.length > 0 || storeTotalVentas > 0) ? storeTotalVentas : serverVentas;
        const totalCompras = (localPurchases.length > 0 || storeTotalCompras > 0) ? storeTotalCompras : serverCompras;
        const igvEstimado = (localSales.length > 0 || localPurchases.length > 0) ? storeIgvEstimado : serverIgv;

        const ratioComprasVentas = totalVentas > 0 ? (totalCompras / totalVentas) * 100 : 0;
        const sinBancarizarMonto = parseFloat(trib.sinBancarizarSoles || trib.sinBancarizarMonto || '0');

        const colaboradoresCount = (employees && employees.length > 0) ? employees.length : (pla.colaboradoresCount || 0);
        const gratiEstimadaTotal = (employees && employees.length > 0)
          ? employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0)
          : parseFloat(pla.gratiEstimadaTotalSoles || pla.gratiEstimadaTotal || '0');
        const ctsEstimadaTotal = gratiEstimadaTotal / 2;

        const scoreRiesgoSunat = ratioComprasVentas > 85 ? 'MEDIO' : (trib.saludFiscalScore >= 80 ? 'BAJO' : 'ALTO');

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
      console.error('[SOFTPREMIUM] Error cargando KPIs del servidor:', e);
    }

    // Fallback local instantáneo con datos exclusivos de la empresa seleccionada
    const ratioComprasVentas = storeTotalVentas > 0 ? (storeTotalCompras / storeTotalVentas) * 100 : 0;
    setKpis({
      totalVentas: storeTotalVentas,
      totalCompras: storeTotalCompras,
      igvEstimado: storeIgvEstimado,
      ratioComprasVentas,
      sinBancarizarCount: 0,
      sinBancarizarMonto: 0,
      colaboradoresCount: employees ? employees.length : 0,
      gratiEstimadaTotal: employees ? employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0) : 0,
      ctsEstimadaTotal: employees ? (employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0) / 2) : 0,
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

  return (
    <div className="flex flex-col min-h-screen w-full bg-app-bg text-app-text animate-fade-in font-sans selection:bg-blue-600 selection:text-white">
      {/* ─── HEADER PRINCIPAL SOFTPREMIUM ─── */}
      <header className="bg-app-surface border-b border-app-border px-3 sm:px-5 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-opacity-95">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={handleVolver}
              className="p-1.5 px-2.5 rounded-xl bg-app-bg hover:bg-app-hover text-app-text transition-all flex items-center gap-1 text-[11px] font-bold border border-app-border cursor-pointer shrink-0"
              title="Volver al Sistema Principal"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-blue-500" />
              <span>VOLVER</span>
            </button>
            <div className="h-4 w-px bg-app-border hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <img src="/assets/logo.png" alt="Softcontable Logo" className="w-8 h-8 object-contain shrink-0" />
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-app-text">SOFT<span className="text-blue-600 dark:text-blue-400">PREMIUM</span></span>
            </div>
          </div>

          <div className="md:hidden flex items-center gap-2">
            {!isPremiumActive && (
              <button 
                onClick={() => setActiveSubTab('subscription')}
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              >
                <CreditCard className="w-3 h-3" />
                Inactivo
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <div className="bg-app-bg border border-app-border px-2.5 py-1 rounded-xl flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-[10px] shrink-0">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left max-w-[110px] sm:max-w-none truncate">
              <span className="text-[11px] font-bold text-app-text truncate">{user?.name || user?.nombre || 'Usuario Logueado'}</span>
              <span className="text-[9px] text-app-muted font-medium truncate hidden sm:block">{user?.email || 'softcontable10@gmail.com'}</span>
            </div>
          </div>

          {/* BOTÓN ABRE MODAL MIS EMPRESAS */}
          {workspaces && workspaces.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompanyModal(true)}
              className="bg-app-bg border border-app-border px-3 py-1 rounded-xl text-left flex items-center gap-2 hover:border-blue-500/40 transition-all cursor-pointer shrink-0"
            >
              <div>
                <label className="text-[7.5px] text-app-muted uppercase font-black tracking-widest block leading-tight">MIS EMPRESAS</label>
                <span className="text-[11px] font-bold text-app-text block max-w-[130px] sm:max-w-[170px] truncate leading-tight">
                  {currentCompany?.name ? (currentCompany.name.length > 16 ? currentCompany.name.substring(0, 14) + '...' : currentCompany.name) : 'Seleccionar'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-app-muted shrink-0" />
            </button>
          )}

          {!isPremiumActive && (
            <button 
              onClick={() => setActiveSubTab('subscription')}
              className="hidden md:flex px-3 py-1 rounded-xl font-bold text-[11px] items-center gap-1.5 border shrink-0 transition-all cursor-pointer bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Suscripción Inactiva (Ver Planes)
            </button>
          )}

          {isPremiumActive && (
            <div className="hidden md:flex px-3 py-1 rounded-xl font-bold text-[11px] items-center gap-1.5 border shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ✓ Suscripción Activa
            </div>
          )}
        </div>
      </header>

      {/* ─── SUB-NAVBAR PILARES CON ESTILO COMPACTO ─── */}
      <nav className="bg-app-surface/60 border-b border-app-border px-3 sm:px-6 py-2 flex items-center justify-start md:justify-center overflow-x-auto no-scrollbar shrink-0 backdrop-blur-sm">
        <div className="flex gap-1.5 p-1 bg-app-bg rounded-xl border border-app-border max-w-full overflow-x-auto no-scrollbar shadow-inner">
          <button
            onClick={() => setActiveSubTab('tributario')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'tributario'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            1. Tributación RAG
          </button>

          <button
            onClick={() => setActiveSubTab('planillas')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'planillas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            2. Planillas RAG
          </button>

          <button
            onClick={() => setActiveSubTab('finanzas')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'finanzas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            3. Finanzas RAG
          </button>

          {!isPremiumActive && (
            <button
              onClick={() => setActiveSubTab('subscription')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSubTab === 'subscription'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-amber-500 dark:text-amber-400 hover:bg-app-hover'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Planes y Pagos (Yape/Plin)
            </button>
          )}
        </div>
      </nav>

      {/* ─── CONTENIDO PRINCIPAL SEGÚN PILAR ─── */}
      <main className="flex-1 p-3 sm:p-5 md:p-6 max-w-[1500px] w-full mx-auto space-y-4">
        
        {/* PILAR 1: TRIBUTACIÓN RAG */}
        {activeSubTab === 'tributario' && (
          <div className="space-y-4 animate-fade-in">
            {/* Header del Pilar */}
            <div className="bg-app-surface border border-app-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    PILAR 1
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-app-text tracking-tight flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Auditoría Tributaria RAG &amp; Groq AI
                  </h2>
                </div>
                <p className="text-[11px] sm:text-xs text-app-muted font-medium max-w-2xl leading-relaxed">
                  Análisis preventivo de cumplimiento SUNAT, crédito fiscal, bancarización Ley 28194 y scoring de riesgo fiscal.
                </p>
              </div>

              {/* KPI Cards de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto shrink-0">
                <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                  <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Ventas</span>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-500">S/ {kpis.totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                  <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Compras</span>
                  <span className="text-xs sm:text-sm font-extrabold text-blue-500">S/ {kpis.totalCompras.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                  <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">IGV Est.</span>
                  <span className="text-xs sm:text-sm font-extrabold text-amber-500">S/ {kpis.igvEstimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                  <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Riesgo SUNAT</span>
                  <span className="text-[11px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {kpis.scoreRiesgoSunat}
                  </span>
                </div>
              </div>
            </div>

            {/* Módulos en Grilla Responsiva */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Módulo 1: Coherencia Compras/Ventas */}
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:border-blue-500/40">
                <div 
                  onClick={() => toggleModule('trib_m1')}
                  className="p-4 flex items-center justify-between cursor-pointer bg-gradient-to-r from-transparent via-transparent to-blue-500/5 hover:bg-app-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-app-text">Módulo 1.1</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Ratio {kpis.ratioComprasVentas.toFixed(1)}%</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-app-text">Coherencia de Ventas vs Compras (Crédito Fiscal)</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-500 hidden sm:inline">{expandedModule === 'trib_m1' ? 'Cerrar' : 'Ver Análisis'}</span>
                    {expandedModule === 'trib_m1' ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-app-muted" />}
                  </div>
                </div>

                {/* CUERPO EXPANDIDO CON SUB-PESTAÑAS */}
                {expandedModule === 'trib_m1' && (
                  <div className="border-t border-app-border bg-app-bg/50 p-4 space-y-3 animate-scale-up">
                    
                    {/* Selector de Sub-Pestañas */}
                    <div className="flex bg-app-surface p-1 rounded-lg border border-app-border gap-1">
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'DIAGNOSTICO'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'NORMATIVA'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Normativa RAG
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'GROQ_AI'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> GROQ + IA en Vivo
                      </button>
                    </div>

                    {/* Sub-Pestaña 1: DIAGNÓSTICO */}
                    {getModuleSubTab('trib_m1') === 'DIAGNOSTICO' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-app-muted">Ventas Declaradas</span>
                            <p className="text-xs sm:text-sm font-bold text-emerald-500">S/ {kpis.totalVentas.toFixed(2)}</p>
                          </div>
                          <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-app-muted">Compras Sustentadas</span>
                            <p className="text-xs sm:text-sm font-bold text-blue-500">S/ {kpis.totalCompras.toFixed(2)}</p>
                          </div>
                          <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                            <span className="text-[9px] font-bold uppercase text-app-muted">Cobertura Compras</span>
                            <p className="text-xs sm:text-sm font-bold text-amber-500">{kpis.ratioComprasVentas.toFixed(1)}%</p>
                          </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg space-y-1">
                          <h4 className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Diagnóstico Automatizado
                          </h4>
                          <p className="text-[11px] text-app-text leading-relaxed">
                            {kpis.ratioComprasVentas > 85 
                              ? 'Alerta: El ratio de compras supera el 85% de tus ventas. SUNAT suele fiscalizar empresas con márgenes operativos excesivamente reducidos.' 
                              : 'Tu relación compras/ventas se encuentra dentro de los márgenes óptimos sustentables.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sub-Pestaña 2: NORMATIVA */}
                    {getModuleSubTab('trib_m1') === 'NORMATIVA' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-transparent p-3 rounded-lg border border-blue-500/20 space-y-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Metodología de Cálculo 4.0</span>
                          <p className="text-[11px] font-semibold text-app-text font-mono">
                            Cobertura (%) = (Compras / Ventas) x 100
                          </p>
                        </div>

                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-2">
                          <h4 className="text-[11px] font-bold text-app-text flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-amber-500" /> Base Legal &amp; Jurisprudencia RTF
                          </h4>
                          <ul className="space-y-1.5 text-[11px] text-app-text">
                            <li className="flex items-start gap-1.5 bg-app-bg p-2 rounded-md border border-app-border">
                              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded font-bold text-[9px] shrink-0 font-mono">TUO Ley IGV</span>
                              <span><strong>Art. 18 y 19:</strong> Requisitos sustanciales y formales para el crédito fiscal.</span>
                            </li>
                            <li className="flex items-start gap-1.5 bg-app-bg p-2 rounded-md border border-app-border">
                              <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded font-bold text-[9px] shrink-0 font-mono">RTF N° 01245-1-2021</span>
                              <span>Criterios del Tribunal Fiscal sobre coherencia de márgenes comerciales.</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Sub-Pestaña 3: GROQ + IA */}
                    {getModuleSubTab('trib_m1') === 'GROQ_AI' && (
                      <div className="space-y-3 animate-fade-in">
                        {/* Chips de Preguntas Sugeridas */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Consultas Sugeridas RAG:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              '¿Cómo sustento la fehaciencia de compras?',
                              '¿Qué pasa si mi margen es menor al 10%?',
                              '¿SUNAT me puede reparar el crédito fiscal?'
                            ].map((chip, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleAskRAG('tributario', 'trib_m1', chip)}
                                className="text-[10px] font-bold text-app-text hover:text-blue-600 dark:hover:text-blue-400 bg-app-surface hover:bg-blue-500/10 border border-app-border hover:border-blue-500/40 px-2.5 py-1 rounded-lg transition-all text-left cursor-pointer"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Prompt Input */}
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Escribe tu duda sobre este módulo..."
                            value={ragQueries['trib_m1'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, trib_m1: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleAskRAG('tributario', 'trib_m1')}
                            className="flex-1 bg-app-surface border border-app-border px-3 py-2 rounded-lg text-[11px] font-bold outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleAskRAG('tributario', 'trib_m1')}
                            disabled={ragLoading['trib_m1']}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {ragLoading['trib_m1'] ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Consultar
                          </button>
                        </div>

                        {/* Respuesta IA */}
                        {ragAnswers['trib_m1'] && (
                          <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg space-y-1.5 relative animate-fade-in">
                            <div className="flex justify-between items-center border-b border-blue-500/20 pb-1.5">
                              <span className="text-[9px] font-bold uppercase text-blue-500 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Respuesta Groq LLaMA-3.3 RAG
                              </span>
                              <button 
                                onClick={() => copyToClipboard(ragAnswers['trib_m1'])}
                                className="text-[9px] font-bold text-app-muted hover:text-blue-500 flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Copiar
                              </button>
                            </div>
                            <div className="text-[11px] text-app-text leading-relaxed whitespace-pre-line">
                              {ragAnswers['trib_m1']}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Módulo 2: Bancarización Ley 28194 */}
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:border-blue-500/40">
                <div 
                  onClick={() => toggleModule('trib_m2')}
                  className="p-4 flex items-center justify-between cursor-pointer bg-gradient-to-r from-transparent via-transparent to-amber-500/5 hover:bg-app-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-app-text">Módulo 1.2</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">Sin Medios: S/ {kpis.sinBancarizarMonto.toFixed(2)}</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-app-text">Control de Bancarización &amp; Medios de Pago</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-500 hidden sm:inline">{expandedModule === 'trib_m2' ? 'Cerrar' : 'Ver Análisis'}</span>
                    {expandedModule === 'trib_m2' ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-app-muted" />}
                  </div>
                </div>

                {/* CUERPO EXPANDIDO */}
                {expandedModule === 'trib_m2' && (
                  <div className="border-t border-app-border bg-app-bg/50 p-4 space-y-3 animate-scale-up">
                    <div className="flex bg-app-surface p-1 rounded-lg border border-app-border gap-1">
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m2') === 'DIAGNOSTICO'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m2') === 'NORMATIVA'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Normativa RAG
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m2') === 'GROQ_AI'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> GROQ + IA en Vivo
                      </button>
                    </div>

                    {getModuleSubTab('trib_m2') === 'DIAGNOSTICO' && (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="p-3 bg-app-surface rounded-lg border border-app-border flex justify-between items-center">
                          <div>
                            <span className="text-[9px] font-bold text-app-muted uppercase">Operaciones &ge; S/ 2,000 / $500 sin Medios de Pago</span>
                            <p className="text-xs sm:text-sm font-bold text-rose-500">S/ {kpis.sinBancarizarMonto.toFixed(2)}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-bold rounded">
                            {kpis.sinBancarizarMonto > 0 ? 'Riesgo de Rechazo de Gastos' : '100% Bancarizado'}
                          </span>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m2') === 'NORMATIVA' && (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-1">
                          <h4 className="text-[11px] font-bold text-app-text flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-amber-500" /> Ley 28194 &amp; D.S. 150-2007-EF
                          </h4>
                          <p className="text-[11px] text-app-text leading-relaxed">
                            Las compras o gastos iguales o superiores a S/ 2,000 o US$ 500 cancelados en efectivo perderán el derecho al costo/gasto impositivo y al crédito fiscal del IGV.
                          </p>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('trib_m2') === 'GROQ_AI' && (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Consultar sobre medios de pago permitidos..."
                            value={ragQueries['trib_m2'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, trib_m2: e.target.value })}
                            className="flex-1 bg-app-surface border border-app-border px-3 py-2 rounded-lg text-[11px] font-bold outline-none"
                          />
                          <button
                            onClick={() => handleAskRAG('tributario', 'trib_m2')}
                            className="px-3 py-2 bg-blue-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            Consultar
                          </button>
                        </div>
                        {ragAnswers['trib_m2'] && (
                          <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg text-[11px] text-app-text whitespace-pre-line">
                            {ragAnswers['trib_m2']}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* PILAR 2: PLANILLAS RAG */}
        {activeSubTab === 'planillas' && (() => {
          const realColaboradores = (kpis.colaboradoresCount > 0) ? kpis.colaboradoresCount : (employees ? employees.length : 0);
          const realGrati = (kpis.gratiEstimadaTotal > 0) ? kpis.gratiEstimadaTotal : (employees ? employees.reduce((sum, e) => sum + Number(e.sueldo_basico || 1130), 0) : 0);
          const realCts = (kpis.ctsEstimadaTotal > 0) ? kpis.ctsEstimadaTotal : (realGrati / 2);

          return (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-app-surface border border-app-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      PILAR 2
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-app-text tracking-tight flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-500" /> Planillas RAG &amp; Gestión Laboral IA
                    </h2>
                  </div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium max-w-2xl leading-relaxed">
                    Sincronización fluida de nómina SaaS, cálculo proyectado de Gratificaciones, CTS, Asignación Familiar y régimen PLAME peruano 2026.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto shrink-0">
                  <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                    <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Trabajadores</span>
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-500">{realColaboradores} Registrados</span>
                  </div>
                  <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                    <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Grati Est.</span>
                    <span className="text-xs sm:text-sm font-extrabold text-blue-500">S/ {realGrati.toFixed(2)}</span>
                  </div>
                  <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                    <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">CTS Est.</span>
                    <span className="text-xs sm:text-sm font-extrabold text-purple-500">S/ {realCts.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Módulo Planillas */}
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
                <div 
                  onClick={() => toggleModule('pla_m1')}
                  className="p-4 flex items-center justify-between cursor-pointer bg-gradient-to-r from-transparent via-transparent to-emerald-500/5 hover:bg-app-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-app-text">Módulo 2.1</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Sincronizado SaaS</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-app-text">Proyección de Gratificaciones &amp; CTS (Ley 27735)</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-500 hidden sm:inline">{expandedModule === 'pla_m1' ? 'Cerrar' : 'Ver Proyección'}</span>
                    {expandedModule === 'pla_m1' ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-app-muted" />}
                  </div>
                </div>

                {expandedModule === 'pla_m1' && (
                  <div className="border-t border-app-border bg-app-bg/50 p-4 space-y-3 animate-scale-up">
                    <div className="flex bg-app-surface p-1 rounded-lg border border-app-border gap-1">
                      <button
                        onClick={() => setModuleSubTab('pla_m1', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('pla_m1') === 'DIAGNOSTICO'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico Nómina
                      </button>
                      <button
                        onClick={() => setModuleSubTab('pla_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('pla_m1') === 'NORMATIVA'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Normativa MINTRA
                      </button>
                      <button
                        onClick={() => setModuleSubTab('pla_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('pla_m1') === 'GROQ_AI'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> GROQ + IA en Vivo
                      </button>
                    </div>

                    {getModuleSubTab('pla_m1') === 'DIAGNOSTICO' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fade-in">
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Colaboradores Activos</span>
                          <p className="text-xs sm:text-sm font-bold text-emerald-500">{realColaboradores}</p>
                        </div>
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Monto Proyectado Gratificación</span>
                          <p className="text-xs sm:text-sm font-bold text-blue-500">S/ {realGrati.toFixed(2)}</p>
                        </div>
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Monto Proyectado CTS</span>
                          <p className="text-xs sm:text-sm font-bold text-purple-500">S/ {realCts.toFixed(2)}</p>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('pla_m1') === 'NORMATIVA' && (
                      <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-1.5 animate-fade-in">
                        <h4 className="text-[11px] font-bold text-app-text flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-emerald-500" /> Ley N° 27735 (Gratificaciones) &amp; D.S. 001-97-TR (CTS)
                        </h4>
                        <p className="text-[11px] text-app-text leading-relaxed">
                          Cálculo computable integrado con remuneración básica, asignación familiar (S/ 113.00 en 2026) y bonificación extraordinaria del 9% (EsSalud).
                        </p>
                      </div>
                    )}

                    {getModuleSubTab('pla_m1') === 'GROQ_AI' && (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Consultar sobre licencias, gratificaciones o CTS..."
                            value={ragQueries['pla_m1'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, pla_m1: e.target.value })}
                            className="flex-1 bg-app-surface border border-app-border px-3 py-2 rounded-lg text-[11px] font-bold outline-none"
                          />
                          <button
                            onClick={() => handleAskRAG('planillas', 'pla_m1')}
                            className="px-3 py-2 bg-blue-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            Consultar
                          </button>
                        </div>
                        {ragAnswers['pla_m1'] && (
                          <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg text-[11px] text-app-text whitespace-pre-line">
                            {ragAnswers['pla_m1']}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* PILAR 3: FINANZAS RAG */}
        {activeSubTab === 'finanzas' && (() => {
          const liquidez = kpis.totalCompras > 0 ? (kpis.totalVentas / kpis.totalCompras).toFixed(2) : (kpis.totalVentas > 0 ? '2.50' : '1.00');
          const ebitda = kpis.totalVentas > 0 ? (((kpis.totalVentas - kpis.totalCompras) / kpis.totalVentas) * 100).toFixed(1) : '0.0';
          const rucDigit = (currentCompany?.ruc || '').slice(-1);
          const sunatDay = Math.min(22, 12 + (parseInt(rucDigit || '0', 10) || 1));

          return (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-app-surface border border-app-border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-500 border border-purple-500/20">
                      PILAR 3
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-app-text tracking-tight flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-purple-500" /> Finanzas &amp; Flujo de Caja IA
                    </h2>
                  </div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium max-w-2xl leading-relaxed">
                    Predicción de liquidez, proyección de vencimientos tributarios SUNAT y ratios financieros estratégicos.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto shrink-0">
                  <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                    <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Liquidez</span>
                    <span className="text-xs sm:text-sm font-extrabold text-purple-500">{liquidez} x</span>
                  </div>
                  <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                    <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Margen EBITDA</span>
                    <span className="text-xs sm:text-sm font-extrabold text-emerald-500">{ebitda}%</span>
                  </div>
                  <div className="bg-app-bg border border-app-border p-2.5 rounded-lg">
                    <span className="text-[8px] font-bold text-app-text uppercase tracking-wider block">Vcto. SUNAT</span>
                    <span className="text-xs sm:text-sm font-extrabold text-amber-500">Día {sunatDay}</span>
                  </div>
                </div>
              </div>

              {/* Módulo Finanzas */}
              <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
                <div 
                  onClick={() => toggleModule('fin_m1')}
                  className="p-4 flex items-center justify-between cursor-pointer bg-gradient-to-r from-transparent via-transparent to-purple-500/5 hover:bg-app-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg border border-purple-500/20">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-app-text">Módulo 3.1</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">Liquidez {liquidez}x</span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-app-text">Estrategia de Liquidez &amp; Flujo de Caja Proyectado</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-blue-500 hidden sm:inline">{expandedModule === 'fin_m1' ? 'Cerrar' : 'Ver Análisis'}</span>
                    {expandedModule === 'fin_m1' ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-app-muted" />}
                  </div>
                </div>

                {expandedModule === 'fin_m1' && (
                  <div className="border-t border-app-border bg-app-bg/50 p-4 space-y-3 animate-scale-up">
                    <div className="flex bg-app-surface p-1 rounded-lg border border-app-border gap-1">
                      <button
                        onClick={() => setModuleSubTab('fin_m1', 'DIAGNOSTICO')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('fin_m1') === 'DIAGNOSTICO'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico Financiero
                      </button>
                      <button
                        onClick={() => setModuleSubTab('fin_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('fin_m1') === 'NORMATIVA'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Ratios Estratégicos
                      </button>
                      <button
                        onClick={() => setModuleSubTab('fin_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('fin_m1') === 'GROQ_AI'
                            ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold'
                            : 'text-app-muted hover:text-app-text hover:bg-app-hover'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> GROQ + IA en Vivo
                      </button>
                    </div>

                    {getModuleSubTab('fin_m1') === 'DIAGNOSTICO' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-fade-in">
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Ratio Liquidez Corriente</span>
                          <p className="text-xs sm:text-sm font-bold text-purple-500">{liquidez} x</p>
                        </div>
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Margen Bruto EBITDA</span>
                          <p className="text-xs sm:text-sm font-bold text-emerald-500">{ebitda} %</p>
                        </div>
                        <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-app-muted">Próximo Vencimiento SUNAT</span>
                          <p className="text-xs sm:text-sm font-bold text-amber-500">Día {sunatDay} del mes</p>
                        </div>
                      </div>
                    )}

                    {getModuleSubTab('fin_m1') === 'NORMATIVA' && (
                      <div className="bg-app-surface p-3 rounded-lg border border-app-border space-y-1.5 animate-fade-in">
                        <h4 className="text-[11px] font-bold text-app-text flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-purple-500" /> Fórmulas &amp; Metodología Financiera 4.0
                        </h4>
                        <p className="text-[11px] text-app-text leading-relaxed font-mono">
                          Liquidez Corriente = Ventas Totales / Compras Totales<br />
                          Margen EBITDA (%) = ((Ventas - Compras) / Ventas) x 100
                        </p>
                      </div>
                    )}

                    {getModuleSubTab('fin_m1') === 'GROQ_AI' && (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Ej: ¿Cuál es mi nivel de liquidez proyectado para el próximo mes?"
                            value={ragQueries['fin_m1'] || ''}
                            onChange={(e) => setRagQueries({ ...ragQueries, fin_m1: e.target.value })}
                            className="flex-1 bg-app-surface border border-app-border px-3 py-2 rounded-lg text-[11px] font-bold outline-none"
                          />
                          <button
                            onClick={() => handleAskRAG('finanzas', 'fin_m1')}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            Consultar
                          </button>
                        </div>
                        {ragAnswers['fin_m1'] && (
                          <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg text-[11px] text-app-text whitespace-pre-line">
                            {ragAnswers['fin_m1']}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB: PLANES Y PAGOS YAPE / PLIN */}
        {activeSubTab === 'subscription' && (
          <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
            <div className="text-center space-y-1">
              <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-bold uppercase tracking-widest rounded-full">
                Suscripción SoftPremium
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-app-text tracking-tight">Activa Inteligencia Artificial 4.0 para tu Sistema</h2>
              <p className="text-[11px] text-app-muted font-medium max-w-xl mx-auto">
                Realiza tu pago mediante Yape, Plin o Transferencia e ingresa el número de operación para la activación inmediata.
              </p>
            </div>

            {/* Planes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setSelectedPlanTier('full')}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 relative ${
                  selectedPlanTier === 'full' 
                    ? 'bg-blue-600/10 border-blue-500 shadow-md scale-[1.01]' 
                    : 'bg-app-surface border-app-border hover:border-blue-500/40'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">RECOMENDADO</span>
                    <h3 className="text-sm font-bold text-app-text">Plan SoftPremium FULL</h3>
                  </div>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">S/ 49<span className="text-[10px] font-normal text-app-muted">/mes</span></span>
                </div>
                <ul className="text-[11px] text-app-text space-y-1.5">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Acceso Completo a los 3 Pilares</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Inteligencia Artificial en Vivo 2026</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Sincronización Automática con SaaS</li>
                </ul>
              </div>

              <div 
                className={`p-4 rounded-xl border transition-all space-y-3 relative ${
                  ['tributario', 'planillas', 'finanzas'].includes(selectedPlanTier)
                    ? 'bg-indigo-600/10 border-indigo-500 shadow-md' 
                    : 'bg-app-surface border-app-border'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">INDIVIDUAL</span>
                    <h3 className="text-sm font-bold text-app-text">Plan Pilar Individual</h3>
                  </div>
                  <span className="text-lg font-bold text-app-text">S/ 25<span className="text-[10px] font-normal text-app-muted">/mes</span></span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[9px] font-bold uppercase text-app-muted block">Elige 1 Pilar a activar:</label>
                  <div className="space-y-1">
                    {[
                      { id: 'tributario', label: '1. Pilar Tributario (Auditoría SUNAT)' },
                      { id: 'planillas', label: '2. Pilar Planillas & PLAME' },
                      { id: 'finanzas', label: '3. Pilar Finanzas & Flujo de Caja' }
                    ].map(pilar => (
                      <button
                        key={pilar.id}
                        type="button"
                        onClick={() => setSelectedPlanTier(pilar.id as any)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-all flex items-center justify-between cursor-pointer border ${
                          selectedPlanTier === pilar.id
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : 'bg-app-bg text-app-muted hover:text-app-text border-app-border'
                        }`}
                      >
                        <span>{pilar.label}</span>
                        {selectedPlanTier === pilar.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario de Pago */}
            <form onSubmit={handleSubmitVoucher} className="bg-app-surface border border-app-border p-4 sm:p-5 rounded-xl space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-app-text flex items-center gap-1.5 border-b border-app-border pb-2">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" /> Registro de Pago Yape / Plin / Transferencia
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold uppercase text-app-muted block mb-1">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full bg-app-bg border border-app-border p-2 rounded-lg text-[11px] font-bold outline-none"
                  >
                    <option value="YAPE">Yape (923887478 - Angelo Serna)</option>
                    <option value="PLIN">Plin (923887478 - Angelo Serna)</option>
                    <option value="TRANSFERENCIA">Transferencia BCP / Interbank (softcontable10@gmail.com)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase text-app-muted block mb-1">Número de Operación / Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 0984124"
                    value={operationNumber}
                    onChange={(e) => setOperationNumber(e.target.value)}
                    className="w-full bg-app-bg border border-app-border p-2 rounded-lg text-[11px] font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-app-muted block mb-1">Captura del Voucher de Pago</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-app-border hover:border-blue-500/50 bg-app-bg p-4 rounded-lg text-center cursor-pointer transition-colors space-y-1"
                >
                  <UploadCloud className="w-6 h-6 text-blue-500 mx-auto" />
                  <p className="text-[11px] font-bold text-app-text">
                    {voucherFile ? voucherFile.name : 'Haz clic para adjuntar la foto del voucher'}
                  </p>
                  <span className="text-[9px] text-app-muted">Formatos JPG, PNG o WEBP (máx 8MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingVoucher}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] uppercase tracking-wider shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submittingVoucher ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Enviar Voucher para Activación
              </button>
            </form>
          </div>
        )}
      </main>

      {/* MODAL OVERLAY MIS EMPRESAS */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCompanyModal(false)}>
          <div className="bg-app-surface border border-app-border max-w-md w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-app-border">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-black uppercase text-app-text tracking-wider">Seleccionar Empresa (Mis Empresas)</h3>
              </div>
              <button 
                onClick={() => setShowCompanyModal(false)}
                className="text-app-muted hover:text-app-text p-1 hover:bg-app-hover rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 border-b border-app-border bg-app-bg">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-app-muted absolute left-3" />
                <input
                  type="text"
                  placeholder="Buscar por RUC o Razón Social..."
                  value={companySearchTerm}
                  onChange={(e) => setCompanySearchTerm(e.target.value)}
                  className="w-full bg-app-surface border border-app-border rounded-xl pl-9 pr-3 py-2 text-xs font-bold outline-none text-app-text focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-3 overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
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
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
                        isSelected 
                          ? 'bg-blue-600/10 border-blue-500 text-blue-500 font-bold shadow-sm' 
                          : 'bg-app-bg border-app-border text-app-text hover:bg-app-hover'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-app-text">{c.name}</div>
                        <div className="text-[10px] text-app-muted font-mono mt-0.5">RUC: {c.ruc}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER SOFTPREMIUM */}
      <footer className="border-t border-app-border px-4 py-3 text-center text-[10px] text-app-muted font-medium bg-app-surface mt-auto">
        SoftPremium SAAS — Módulo Groq LLaMA-3.3 RAG 4.0 © 2026 Angelo Serna Simeon
      </footer>
    </div>
  );
};
