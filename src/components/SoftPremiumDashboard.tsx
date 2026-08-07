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
  Info
} from 'lucide-react';

export const SoftPremiumDashboard: React.FC = () => {
  const { currentCompany, setActiveTab, workspaces, switchWorkspace, employees } = useStore();
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
    try {
      const token = localStorage.getItem('softcontable_token');
      const res = await fetch(`/api/premium/tributario/kpis?ruc=${currentCompany.ruc}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.kpis) {
        setKpis(data.kpis);
      }
    } catch (e) {
      console.error('[SOFTPREMIUM] Error cargando KPIs:', e);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (isPremiumActive && currentCompany?.ruc) {
      fetchKpis();
    }
  }, [isPremiumActive, currentCompany?.ruc]);

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
    setActiveTab('compras');
    if (window.location.pathname === '/premium' || window.location.pathname.includes('/premium')) {
      window.location.href = '/';
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
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded-lg shadow-sm shrink-0">
                <Cpu className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-extrabold tracking-tight text-app-text">SOFT<span className="text-blue-600 dark:text-blue-400">PREMIUM</span></span>
                  <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase font-mono">GROQ RAG 4.0</span>
                </div>
                <p className="text-[10px] text-app-muted font-medium hidden sm:block">Motor Inferencia Groq LLaMA-3.3 &amp; Inteligencia Normativa 2026</p>
              </div>
            </div>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button 
              onClick={() => setActiveSubTab('subscription')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 border ${
                isPremiumActive 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}
            >
              <CreditCard className="w-3 h-3" />
              {isPremiumActive ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          <div className="bg-app-bg border border-app-border px-2.5 py-1 rounded-xl flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-[10px] shrink-0">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left max-w-[110px] sm:max-w-none truncate">
              <span className="text-[11px] font-bold text-app-text truncate">{user?.name || user?.nombre || 'Usuario Logueado'}</span>
              <span className="text-[9px] text-app-muted font-medium truncate hidden sm:block">{user?.email || 'usuario@softcontable.pe'}</span>
            </div>
          </div>

          {workspaces && workspaces.length > 0 && (
            <div className="bg-app-bg border border-app-border px-2.5 py-1 rounded-xl text-left shrink-0">
              <label className="text-[8px] text-app-muted uppercase font-bold tracking-wider block">MIS EMPRESAS</label>
              <select
                value={currentCompany?.ruc || ''}
                onChange={(e) => {
                  if (e.target.value) switchWorkspace(e.target.value);
                }}
                className="bg-transparent text-[11px] font-bold text-app-text outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
              >
                {workspaces.map((c: any) => (
                  <option key={c.ruc} value={c.ruc} className="bg-app-surface text-app-text">
                    {c.name && c.name.length > 18 ? c.name.substring(0, 16) + '...' : c.name} ({c.ruc})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={() => setActiveSubTab('subscription')}
            className={`hidden md:flex px-3 py-1 rounded-xl font-bold text-[11px] items-center gap-1.5 border shrink-0 transition-all cursor-pointer ${
              isPremiumActive 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            {isPremiumActive ? '✓ Suscripción Activa (Groq RAG 4.0)' : 'Suscripción Inactiva (Ver Planes)'}
          </button>
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
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'DIAGNOSTICO'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-app-muted hover:text-app-text'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'NORMATIVA'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-app-muted hover:text-app-text'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Normativa RAG
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m1') === 'GROQ_AI'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-app-muted hover:text-app-text'
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
                                className="text-[10px] font-semibold bg-app-surface hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded border border-app-border transition-colors cursor-pointer"
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
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m2') === 'DIAGNOSTICO' ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m2') === 'NORMATIVA' ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Normativa RAG
                      </button>
                      <button
                        onClick={() => setModuleSubTab('trib_m2', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('trib_m2') === 'GROQ_AI' ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
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
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('pla_m1') === 'DIAGNOSTICO' ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" /> Diagnóstico Nómina
                      </button>
                      <button
                        onClick={() => setModuleSubTab('pla_m1', 'NORMATIVA')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('pla_m1') === 'NORMATIVA' ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
                        }`}
                      >
                        <Scale className="w-3.5 h-3.5" /> Normativa MINTRA
                      </button>
                      <button
                        onClick={() => setModuleSubTab('pla_m1', 'GROQ_AI')}
                        className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          getModuleSubTab('pla_m1') === 'GROQ_AI' ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
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
        {activeSubTab === 'finanzas' && (
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
            </div>

            <div className="bg-app-surface border border-app-border rounded-xl shadow-sm p-5 text-center space-y-2.5">
              <TrendingUp className="w-8 h-8 text-purple-500 mx-auto animate-bounce" />
              <h3 className="text-sm font-bold text-app-text">Motor Financiero Groq LLaMA-3.3 4.0</h3>
              <p className="text-[11px] text-app-muted max-w-xl mx-auto">
                Realiza consultas directas sobre estrategias de liquidez o proyecciones de caja para la empresa {currentCompany?.name}.
              </p>
              <div className="max-w-xl mx-auto flex gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Ej: ¿Cuál es mi nivel de liquidez proyectado para el próximo mes?"
                  value={ragQueries['fin_m1'] || ''}
                  onChange={(e) => setRagQueries({ ...ragQueries, fin_m1: e.target.value })}
                  className="flex-1 bg-app-bg border border-app-border px-3.5 py-2 rounded-lg text-[11px] font-bold outline-none"
                />
                <button
                  onClick={() => handleAskRAG('finanzas', 'fin_m1')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  Consultar
                </button>
              </div>
              {ragAnswers['fin_m1'] && (
                <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg text-[11px] text-app-text text-left max-w-xl mx-auto whitespace-pre-line">
                  {ragAnswers['fin_m1']}
                </div>
              )}
            </div>
          </div>
        )}

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
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Acceso Ilimitado a los 3 Pilares RAG</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Motor Groq LLaMA-3.3 Ultra-Rápido</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Sincronización Automática de Planillas SaaS</li>
                </ul>
              </div>

              <div 
                onClick={() => setSelectedPlanTier('tributario')}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 relative ${
                  selectedPlanTier === 'tributario' 
                    ? 'bg-blue-600/10 border-blue-500 shadow-md scale-[1.01]' 
                    : 'bg-app-surface border-app-border hover:border-blue-500/40'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold text-app-muted uppercase tracking-wider">INDIVIDUAL</span>
                    <h3 className="text-sm font-bold text-app-text">Plan Pilar Individual</h3>
                  </div>
                  <span className="text-lg font-bold text-app-text">S/ 25<span className="text-[10px] font-normal text-app-muted">/mes</span></span>
                </div>
                <ul className="text-[11px] text-app-text space-y-1.5">
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Acceso a 1 Pilar Seleccionado</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Motor Groq LLaMA-3.3</li>
                </ul>
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
                    <option value="YAPE">Yape (987654321 - Angelo Serna)</option>
                    <option value="PLIN">Plin (987654321 - Angelo Serna)</option>
                    <option value="TRANSFERENCIA">Transferencia BCP / Interbank</option>
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

      {/* FOOTER SOFTPREMIUM */}
      <footer className="border-t border-app-border px-4 py-3 text-center text-[10px] text-app-muted font-medium bg-app-surface mt-auto">
        SoftPremium SAAS — Módulo Groq LLaMA-3.3 RAG 4.0 © 2026 Angelo Serna Simeon
      </footer>
    </div>
  );
};
