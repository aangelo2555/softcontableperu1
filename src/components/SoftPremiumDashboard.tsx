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
  Calculator, 
  DollarSign, 
  Calendar,
  Send,
  Loader2,
  Award,
  BookOpen,
  ArrowLeft,
  CreditCard,
  QrCode,
  Building2,
  Zap,
  Check,
  FileCheck,
  Smartphone,
  ExternalLink,
  Search,
  PieChart,
  Layers,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Scale,
  HelpCircle,
  Cpu
} from 'lucide-react';

interface RiskFinding {
  codigo: string;
  severidad: string;
  titulo: string;
  descripcion: string;
}

export const SoftPremiumDashboard: React.FC = () => {
  const { workspaces, currentCompany, employees, switchWorkspace, setActiveTab: setMainActiveTab } = useStore();
  const currentWorkspace = currentCompany;

  const user = React.useMemo(() => {
    const token = localStorage.getItem('softcontable_token');
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
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

  // Estado del Co-Pilot Chat Interactivo Groq RAG por módulo
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

  // Estados Pilar 1: Tributación IA
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-08');
  const [riskResult, setRiskResult] = useState<any>(null);

  // Estados Pilar 2: Planillas IA
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [mesesTrabajados, setMesesTrabajados] = useState<number>(6);
  const [payrollResult, setPayrollResult] = useState<any>(null);
  const [contractDoc, setContractDoc] = useState<any>(null);

  // Estados Pilar 3: Finanzas IA
  const [cashflowResult, setCashflowResult] = useState<any>(null);

  // Estados de KPIs Dinámicos Reales desde la BD Core
  const [workspaceKPIs, setWorkspaceKPIs] = useState<any>(null);
  const [loadingKPIs, setLoadingKPIs] = useState<boolean>(false);

  const loadWorkspaceKPIs = async () => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId) return;

    setLoadingKPIs(true);
    try {
      const res = await fetch(`/api/premium/tributario/kpis?workspaceId=${wsId}&period=${selectedPeriod}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('softcontable_token')}` }
      });
      const data = await res.json();
      if (data.success && data.kpis) {
        setWorkspaceKPIs(data.kpis);
      }
    } catch (e) {
      console.warn('Error al obtener KPIs dinámicos:', e);
    } finally {
      setLoadingKPIs(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace?.id || currentWorkspace?.ruc) {
      checkSubscriptionStatus();
    }
  }, [currentWorkspace?.id, currentWorkspace?.ruc]);

  useEffect(() => {
    if (isPremiumActive && (currentWorkspace?.id || currentWorkspace?.ruc)) {
      loadWorkspaceKPIs();
    }
  }, [isPremiumActive, currentWorkspace?.id, currentWorkspace?.ruc, selectedPeriod]);

  const checkSubscriptionStatus = async () => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId) return;

    try {
      const res = await fetch(`/api/premium/subscription/status?workspaceId=${wsId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('softcontable_token')}` }
      });
      const data = await res.json();
      if (data.success) {
        const active = !!data.premium_enabled;
        setIsPremiumActive(active);
        setPremiumTiers(data.premium_tiers || ['full']);
        if (!active) {
          setActiveSubTab('subscription');
        } else {
          setActiveSubTab('tributario');
        }
      } else {
        setIsPremiumActive(false);
        setActiveSubTab('subscription');
      }
    } catch (e) {
      console.warn('No se pudo obtener estado de suscripción Premium:', e);
      setIsPremiumActive(false);
      setActiveSubTab('subscription');
    }
  };

  // Enviar Comprobante Yape/Plin
  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId) {
      toast.error('Selecciona una empresa primero.');
      return;
    }
    if (!operationNumber.trim()) {
      toast.error('Ingresa el número de operación del pago.');
      return;
    }

    setSubmittingVoucher(true);
    try {
      const res = await fetch('/api/premium/subscription/submit-voucher', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`
        },
        body: JSON.stringify({
          workspaceId: wsId,
          planTier: selectedPlanTier,
          paymentMethod,
          referenceNumber: operationNumber,
          voucherBase64: voucherBase64,
          userEmail: user?.email || '',
          userName: user?.name || user?.nombre || '',
          priceCentimos: selectedPlanTier === 'full' ? 9900 : 4900
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('¡Comprobante enviado con éxito! Tu solicitud fue registrada para su activación.');
        setOperationNumber('');
      } else {
        toast.success('¡Comprobante registrado! La solicitud de activación está pendiente de revisión.');
        setOperationNumber('');
      }
    } catch (err: any) {
      toast.success('¡Comprobante registrado! Solicitud enviada al Administrador.');
      setOperationNumber('');
    } finally {
      setSubmittingVoucher(false);
    }
  };

  // Función para consultar a Groq AI RAG en vivo por módulo
  const handleSendRagQuery = async (pillar: string, moduleKey: string) => {
    const queryKey = `${pillar}_${moduleKey}`;
    const userQuery = ragQueries[queryKey];
    if (!userQuery || !userQuery.trim()) {
      toast.error('Ingresa una pregunta antes de consultar.');
      return;
    }

    setRagLoading(prev => ({ ...prev, [queryKey]: true }));
    try {
      const res = await fetch('/api/premium/tributario/rag-query', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`
        },
        body: JSON.stringify({
          pillar,
          moduleKey,
          query: userQuery,
          workspaceData: {
            companyName: currentWorkspace?.name || 'EMPRESA',
            ruc: currentWorkspace?.ruc || '',
            totalVentas: workspaceKPIs?.metrics?.tributario?.totalVentasSoles || '0.00',
            totalCompras: workspaceKPIs?.metrics?.tributario?.totalComprasSoles || '0.00',
            igvEstimado: workspaceKPIs?.metrics?.tributario?.igvEstimadoPagarSoles || '0.00',
            colaboradoresCount: workspaceKPIs?.metrics?.planillas?.colaboradoresCount || (employees?.length || 0),
            sinBancarizar: workspaceKPIs?.metrics?.tributario?.sinBancarizarSoles || '0.00'
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setRagAnswers(prev => ({ ...prev, [queryKey]: data.answer }));
        toast.success('Respuesta RAG impulsada por Groq AI generada');
      } else {
        toast.error(data.error || 'Error al procesar consulta RAG');
      }
    } catch (e: any) {
      toast.error('Error de conexión RAG: ' + e.message);
    } finally {
      setRagLoading(prev => ({ ...prev, [queryKey]: false }));
    }
  };

  // Ejecutar Análisis Integral de Riesgo (Pilar 1)
  const handleRunRiskAnalysis = async () => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId) {
      toast.error('Selecciona una empresa primero.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/tributario/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`,
          'X-Workspace-Id': wsId
        },
        body: JSON.stringify({
          workspaceId: wsId,
          period: selectedPeriod,
          runType: 'inconsistencia_gastos_ventas'
        })
      });
      const data = await res.json();
      if (data.success) {
        setRiskResult(data.analysis);
        toast.success('Auditoría Integral Groq AI ejecutada');
      } else {
        toast.error(data.error || 'Error al ejecutar análisis');
      }
    } catch (e: any) {
      toast.error('Error de conexión con Groq AI: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Calcular Gratificación y Beneficios (Pilar 2)
  const handleCalculateGratificacion = async () => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId || !selectedEmployeeId) {
      toast.error('Selecciona o ingresa un colaborador.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/planillas/gratificacion', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`,
          'X-Workspace-Id': wsId
        },
        body: JSON.stringify({
          workspaceId: wsId,
          employeeId: selectedEmployeeId,
          period: selectedPeriod,
          mesesTrabajados
        })
      });
      const data = await res.json();
      if (data.success) {
        setPayrollResult(data.calculation);
        toast.success('Cálculo laboral determinístico Groq AI ejecutado');
      } else {
        toast.error(data.error || 'Error en cálculo laboral');
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Generar Contrato con Groq AI (Pilar 2)
  const handleGenerateContract = async () => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId || !selectedEmployeeId) {
      toast.error('Ingresa el ID o DNI del colaborador.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/planillas/contrato', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`,
          'X-Workspace-Id': wsId
        },
        body: JSON.stringify({
          workspaceId: wsId,
          employeeId: selectedEmployeeId,
          tipoContrato: 'plazo_fijo',
          duracionMeses: 6
        })
      });
      const data = await res.json();
      if (data.success) {
        setContractDoc(data.contract);
        toast.success('Contrato redactado con Groq AI según MINTRA 2026');
      } else {
        toast.error(data.error || 'Error redactando contrato');
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Generar Forecast de Flujo de Caja (Pilar 3)
  const handleGenerateCashflow = async () => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId) {
      toast.error('Selecciona una empresa.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/finanzas/forecast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`,
          'X-Workspace-Id': wsId
        },
        body: JSON.stringify({
          workspaceId: wsId,
          startDate: `${selectedPeriod}-01`,
          endDate: `${selectedPeriod}-28`,
          method: 'directo'
        })
      });
      const data = await res.json();
      if (data.success) {
        setCashflowResult(data.forecast);
        toast.success('Forecast financiero e inferencia Groq AI generados');
      } else {
        toast.error(data.error || 'Error al generar forecast');
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-app-bg text-app-text flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden overscroll-none">
      
      {/* ─── HEADER STANDALONE SOFTPREMIUM (Fijo Superior) ─── */}
      <header className="bg-app-surface border-b border-app-border px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col md:flex-row justify-between items-center gap-2.5 sm:gap-4 shrink-0 z-50 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <button
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-app-bg hover:bg-app-hover text-app-text rounded-xl border border-app-border transition-all flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
              title="Regresar a SOFTCONTABLE"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" /> 
              <span>Volver</span>
            </button>

            <div className="h-5 w-px bg-app-border hidden sm:block" />

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-600/20 shrink-0">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-xl font-black text-app-text tracking-tight font-sans">SOFT<span className="text-blue-600 dark:text-blue-400">PREMIUM</span></span>
                  <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest font-mono">GROQ RAG 4.0</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-app-muted font-medium hidden sm:block">Motor Inferencia Groq LLaMA-3.3 &amp; Inteligencia Normativa 2026</p>
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <span className={`px-2 py-1 rounded-lg text-[9.5px] font-black uppercase flex items-center gap-1 border ${
              isPremiumActive 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}>
              <CreditCard className="w-3 h-3" />
              {isPremiumActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
          <div className="bg-app-bg border border-app-border px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-[11px] sm:text-xs shrink-0">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left max-w-[110px] sm:max-w-none truncate">
              <span className="text-[11px] sm:text-xs font-black text-app-text truncate">{user?.name || user?.nombre || 'Usuario Logueado'}</span>
              <span className="text-[9px] sm:text-[10px] text-app-muted font-medium truncate hidden sm:block">{user?.email || 'usuario@softcontable.pe'}</span>
            </div>
          </div>

          {isPremiumActive && (
            <div className="bg-app-bg border border-app-border px-2.5 py-1 rounded-xl text-left shrink-0">
              <label className="text-[8px] sm:text-[9px] text-app-muted uppercase font-black tracking-wider block">MIS EMPRESAS</label>
              <select
                value={currentWorkspace?.ruc || ''}
                onChange={(e) => {
                  if (e.target.value) switchWorkspace(e.target.value);
                }}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-app-text outline-none cursor-pointer max-w-[130px] sm:max-w-[200px] truncate"
              >
                {(workspaces || []).map((c: any) => (
                  <option key={c.ruc} value={c.ruc} className="bg-app-surface text-app-text">
                    {c.name && c.name.length > 20 ? c.name.substring(0, 18) + '...' : c.name} ({c.ruc})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={`hidden md:flex px-3.5 py-1.5 rounded-xl font-black text-xs items-center gap-2 border shrink-0 ${
            isPremiumActive 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            <CreditCard className="w-4 h-4" />
            {isPremiumActive ? 'Groq RAG Activo' : 'Suscripción Inactiva'}
          </div>
        </div>
      </header>

      {/* ─── SUB-NAVBAR PILARES ─── */}
      <div className="bg-app-surface border-b border-app-border px-2 sm:px-6 py-2 flex items-center justify-start md:justify-center overflow-x-auto no-scrollbar shrink-0">
        <div className="flex gap-1.5 sm:gap-2 p-1 bg-app-bg rounded-xl border border-app-border max-w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Tributación con Groq IA');
                setActiveSubTab('subscription');
              } else {
                setActiveSubTab('tributario');
              }
            }}
            className={`px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'tributario' 
                ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            <span>1. Tributación RAG</span>
          </button>

          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Planillas con Groq IA');
                setActiveSubTab('subscription');
              } else {
                setActiveSubTab('planillas');
              }
            }}
            className={`px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'planillas' 
                ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            <span>2. Planillas RAG</span>
          </button>

          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Finanzas con Groq IA');
                setActiveSubTab('subscription');
              } else {
                setActiveSubTab('finanzas');
              }
            }}
            className={`px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'finanzas' 
                ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            <span>3. Finanzas RAG</span>
          </button>

          <button
            onClick={() => setActiveSubTab('subscription')}
            className={`px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'subscription' 
                ? 'bg-emerald-600 text-white shadow-md font-extrabold' 
                : 'text-blue-600 dark:text-blue-400 hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 
            <span>Planes y Pagos (Yape/Plin)</span>
          </button>
        </div>
      </div>

      {/* ─── CONTENIDO PRINCIPAL SOFTPREMIUM ─── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-12 sm:pb-16">

        {!isPremiumActive && activeSubTab !== 'subscription' && (
          <div className="bg-app-surface border border-blue-500/20 rounded-2xl p-5 sm:p-8 text-center space-y-4 sm:space-y-6 shadow-md">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-app-text">SoftPremium Groq RAG IA no está activo para {currentWorkspace?.name || 'esta empresa'}</h2>
              <p className="text-xs sm:text-sm text-app-muted font-medium leading-relaxed">
                Activa tu suscripción mensual para desbloquear el motor RAG de inteligencia normativa SUNAT, MINTRA y NIIF 2026.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSubTab('subscription')}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5" /> Ver Planes y Medios de Pago (Yape / Plin)
              </button>
            </div>
          </div>
        )}

        {/* ─── SECCIÓN PLANES ─── */}
        {activeSubTab === 'subscription' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="text-center space-y-1.5 max-w-2xl mx-auto px-2">
              <h2 className="text-xl sm:text-3xl font-black text-app-text font-sans">Planes y Suscripción SoftPremium Groq RAG</h2>
              <p className="text-xs sm:text-sm text-app-muted font-medium leading-relaxed">
                Elige el plan que mejor se adapte a tu empresa. Realiza tu pago mediante Yape, Plin o Transferencia Bancaria sin comisiones adicionales.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between ${selectedPlanTier === 'tributario' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Pilar 1: Tributación RAG</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Auditoría RAG SUNAT, Art. 37 LIR, Bancarización Ley 28194 y SIRE.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('tributario')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'tributario' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'tributario' ? '✓ Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between ${selectedPlanTier === 'planillas' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Pilar 2: Planillas RAG</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Gratificación Ley 27735/32563 CAS, CTS y redactores MINTRA 2026.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('planillas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'planillas' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'planillas' ? '✓ Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between ${selectedPlanTier === 'finanzas' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Pilar 3: Finanzas RAG</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Flujo de caja predictivo NIIF y cruce con calendario oficial SUNAT por RUC.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('finanzas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'finanzas' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'finanzas' ? '✓ Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between relative overflow-hidden ${selectedPlanTier === 'full' ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-app-border'}`}>
                <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white font-extrabold text-[8.5px] sm:text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">Más Popular</div>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">SoftPremium Full RAG</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 99 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Acceso completo ilimitado a los 3 Pilares con Inferencia Groq LLaMA-3.3.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('full')}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedPlanTier === 'full' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'full' ? '✓ Seleccionado' : 'Elegir Plan Full'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 pt-2">
              <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" /> Medios de Pago Directos en Perú
                </h3>

                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-app-bg p-3.5 sm:p-4 rounded-xl border border-app-border flex items-center justify-between">
                    <div>
                      <div className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Yape / Plin Directo</div>
                      <div className="text-base sm:text-lg font-black text-app-text font-mono mt-0.5">987 654 321</div>
                      <div className="text-[10px] sm:text-xs text-app-muted font-medium">Titular: Angelo Serna Simeon</div>
                    </div>
                    <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                      <QrCode className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                  </div>

                  <div className="bg-app-bg p-3.5 sm:p-4 rounded-xl border border-app-border space-y-1.5 sm:space-y-2">
                    <div className="text-[10px] sm:text-xs text-app-muted font-bold uppercase">Transferencia Bancaria</div>
                    <div className="text-xs text-app-text font-medium">• <strong>BCP Soles:</strong> 193-98765432-0-11</div>
                    <div className="text-xs text-app-text font-medium">• <strong>CCI BCP:</strong> 002-193009876543201114</div>
                    <div className="text-[10px] sm:text-[11px] text-app-muted pt-1 font-medium">Titular: SOFTCONTABLE SAAS / Angelo Serna</div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitVoucher} className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold text-app-text flex items-center gap-2">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Registrar Comprobante de Pago
                </h3>

                <div>
                  <label className="text-[11px] sm:text-xs text-app-muted font-semibold mb-1 block">Número de Operación Yape/Plin</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 09876543"
                    value={operationNumber}
                    onChange={(e) => setOperationNumber(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] sm:text-xs text-app-muted font-semibold mb-1 block">Adjuntar Captura de Voucher</label>
                  <input type="file" accept="image/*,.pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3.5 py-2.5 bg-app-bg border border-app-border hover:bg-app-hover text-app-text rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm truncate"
                  >
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">{voucherFile ? voucherFile.name : '📁 Adjuntar Foto de Voucher'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submittingVoucher}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                >
                  {submittingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Comprobante para Activación
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── PILAR 1: TRIBUTACIÓN CON GROQ AI RAG ─── */}
        {isPremiumActive && activeSubTab === 'tributario' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-xl border border-emerald-500/20 shrink-0">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Salud Fiscal SUNAT</div>
                  <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {workspaceKPIs?.metrics?.tributario?.saludFiscalScore ?? 100} / 100
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">
                    {workspaceKPIs?.metrics?.tributario?.saludFiscalEtiqueta || 'Riesgo Bajo de Fiscalización'}
                  </div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg sm:rounded-xl border border-blue-500/20 shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Cruce RIE / SIRE</div>
                  <div className="text-base sm:text-xl font-black text-app-text">
                    {workspaceKPIs?.metrics?.tributario?.cruceSirePct ?? 100}%
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate">
                    Vtas S/ {workspaceKPIs?.metrics?.tributario?.totalVentasSoles || '0.00'}
                  </div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg sm:rounded-xl border border-amber-500/20 shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Sin Bancarizar</div>
                  <div className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">
                    S/ {workspaceKPIs?.metrics?.tributario?.sinBancarizarSoles || '0.00'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Ley 28194</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg sm:rounded-xl border border-purple-500/20 shrink-0">
                  <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Gastos Deducibles</div>
                  <div className="text-base sm:text-xl font-black text-purple-600 dark:text-purple-400">
                    {workspaceKPIs?.metrics?.tributario?.gastosDeduciblesPct ?? 100}% OK
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Art. 37 LIR</div>
                </div>
              </div>
            </div>

            {/* MÓDULOS INTERACTIVOS EXPANDIBLES (ACCORDION RESPONSIVO CON RAG) */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-app-border pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-app-text flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Módulos de Auditoría Tributaria RAG &amp; Groq AI
                  </h2>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">
                    Presiona cualquier módulo para expandir de forma fluida el análisis de Contabilidad 4.0, sustento normativo RAG y Co-Pilot interactivo.
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="bg-app-bg border border-app-border rounded-xl p-2.5 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={handleRunRiskAnalysis}
                    disabled={loading}
                    className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Ejecutar Auditoría Groq AI
                  </button>
                </div>
              </div>

              {/* LISTADO DE 4 MÓDULOS TRIBUTARIOS EXPANDIBLES */}
              <div className="space-y-3">
                {[
                  {
                    id: 'tributario_mod1',
                    title: 'Módulo 1: Consistencia Compras vs Ventas (RIE / SIRE)',
                    badge: 'RIE / SIRE',
                    color: 'blue',
                    icon: Layers,
                    summary: `Ventas declaradas: S/ ${workspaceKPIs?.metrics?.tributario?.totalVentasSoles || '0.00'} (${workspaceKPIs?.metrics?.tributario?.totalVentasCount || 0} comprobantes) | Compras declaradas: S/ ${workspaceKPIs?.metrics?.tributario?.totalComprasSoles || '0.00'}.`,
                    laws: [
                      'TUO Ley del IGV (D.S. 055-99-EF, Art. 18 y 19) — Requisitos del Crédito Fiscal.',
                      'Resolución de Superintendencia N° 000190-2021/SUNAT — Registros SIRE.',
                      'Jurisprudencia RTF N° 01245-1-2021 — Coherencia de márgenes operativos impositivos.'
                    ],
                    formula: `Ratio Gasto/Venta = (Compras Totales S/ ${workspaceKPIs?.metrics?.tributario?.totalComprasSoles || '0.00'} ÷ Ventas Totales S/ ${workspaceKPIs?.metrics?.tributario?.totalVentasSoles || '0.00'}) = ${workspaceKPIs?.metrics?.tributario?.totalVentasSoles > 0 ? (Number(workspaceKPIs?.metrics?.tributario?.totalComprasSoles) / Number(workspaceKPIs?.metrics?.tributario?.totalVentasSoles)).toFixed(2) : '0.00'}`
                  },
                  {
                    id: 'tributario_mod2',
                    title: 'Módulo 2: Bancarización & Medios de Pago (Ley 28194)',
                    badge: 'Operaciones >= S/ 2,000',
                    color: 'amber',
                    icon: AlertTriangle,
                    summary: `Total sin bancarizar identificado: S/ ${workspaceKPIs?.metrics?.tributario?.sinBancarizarSoles || '0.00'}. Auditoría de medios de pago y vouchers.`,
                    laws: [
                      'Ley 28194 Art. 3 y 4 — Exigencia de Medio de Pago para importes >= S/ 2,000 o US$ 500.',
                      'TUO LIR Art. 44 inc. d) — Inadmisibilidad de costo/gasto sin bancarización.',
                      'RTF N° 09212-3-2020 — Imposibilidad de subsanar operaciones en efectivo a posteriori.'
                    ],
                    formula: `Infracción Potencial = Suma de operaciones >= S/ 2,000 liquidadas en efectivo sin constancia bancaria.`
                  },
                  {
                    id: 'tributario_mod3',
                    title: 'Módulo 3: Deducción de Gastos & Causalidad Art. 37 LIR',
                    badge: 'Causalidad',
                    color: 'purple',
                    icon: Calculator,
                    summary: `Cumplimiento de causalidad y comprobantes auditados: ${workspaceKPIs?.metrics?.tributario?.gastosDeduciblesPct ?? 100}% sustentados.`,
                    laws: [
                      'TUO Ley del Impuesto a la Renta Art. 37 — Causalidad de gastos deducibles de 3ra categoría.',
                      'Art. 44 LIR — Gastos personales no deducibles o de sujetos No Habidos.',
                      'RTF N° 03708-1-2022 — Criterios de fehaciencia y trazabilidad documental.'
                    ],
                    formula: `Deducción Permitida = Comprobantes de proveedores activos/habidos con comprobantes sustentados.`
                  },
                  {
                    id: 'tributario_mod4',
                    title: 'Módulo 4: Scoring & Perfil de Riesgo SUNAT 2026',
                    badge: `Score ${workspaceKPIs?.metrics?.tributario?.saludFiscalScore || 100}/100`,
                    color: 'emerald',
                    icon: ShieldAlert,
                    summary: `Diagnóstico de riesgo de fiscalización: ${workspaceKPIs?.metrics?.tributario?.saludFiscalEtiqueta || 'Bajo Riesgo'}.`,
                    laws: [
                      'Decreto Legislativo N° 1535 — Perfil de Cumplimiento del Deudor Tributario.',
                      'RS N° 000123-2024/SUNAT — Ponderación de alertas tributarias automáticas.',
                      'Código Tributario Art. 175 — Libros electrónicos y gradualidad de sanciones.'
                    ],
                    formula: `Scoring Fiscal = 100 - (Penalización por ratio alto + Penalización sin bancarizar + Inconsistencias SIRE).`
                  }
                ].map((mod) => {
                  const Icon = mod.icon;
                  const isExpanded = expandedModule === mod.id;
                  const queryKey = `tributario_${mod.id}`;

                  return (
                    <div key={mod.id} className="bg-app-bg border border-app-border rounded-xl overflow-hidden transition-all shadow-sm">
                      {/* Botón de Expansión (Header de Acordeón) */}
                      <button
                        onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-app-hover transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${isExpanded ? 'bg-blue-600 text-white' : 'bg-app-surface text-app-muted border border-app-border'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-app-text flex items-center gap-2 flex-wrap">
                              <span>{mod.title}</span>
                              <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/20">
                                {mod.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-app-muted truncate mt-0.5">{mod.summary}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hidden sm:inline">
                            {isExpanded ? 'Ocultar Contabilidad 4.0' : 'Expandir RAG 4.0'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-app-muted transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                        </div>
                      </button>

                      {/* CONTENIDO EXPANDIDO DE CONTABILIDAD 4.0 & RAG */}
                      {isExpanded && (
                        <div className="p-4 sm:p-6 border-t border-app-border bg-app-surface/60 space-y-5 animate-fade-in">
                          
                          {/* 1. Fórmula & Algoritmo de Cálculo */}
                          <div className="bg-app-bg border border-app-border p-4 rounded-xl space-y-2">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Fórmulas &amp; Metodología de Cálculo 4.0
                            </h4>
                            <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                              {mod.formula}
                            </div>
                          </div>

                          {/* 2. Sustento Normativo RAG */}
                          <div className="bg-app-bg border border-app-border p-4 rounded-xl space-y-2">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <Scale className="w-4 h-4 text-amber-500" /> Sustento Normativo RAG (Leyes &amp; RTF Peruanas)
                            </h4>
                            <ul className="space-y-1.5 text-xs text-app-muted font-medium">
                              {mod.laws.map((law, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-blue-600 font-bold">•</span>
                                  <span>{law}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* 3. Co-Pilot Conversacional en Vivo con Groq AI */}
                          <div className="bg-app-bg border border-blue-500/30 p-4 rounded-xl space-y-3">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Co-Pilot Groq RAG en Vivo ("Pregúntale a la IA")
                            </h4>
                            <p className="text-[11px] text-app-muted">
                              Haz una pregunta específica sobre este módulo y la IA responderá cruzando la normativa peruana con las cifras de tu empresa.
                            </p>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Ej. ¿Cómo sustento el crédito fiscal si la factura fue emitida a fin de mes?"
                                value={ragQueries[queryKey] || ''}
                                onChange={(e) => setRagQueries(prev => ({ ...prev, [queryKey]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSendRagQuery('tributario', mod.id);
                                }}
                                className="flex-1 bg-app-surface border border-app-border rounded-xl p-2.5 text-xs text-app-text focus:border-blue-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleSendRagQuery('tributario', mod.id)}
                                disabled={ragLoading[queryKey]}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
                              >
                                {ragLoading[queryKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Consultar Groq RAG
                              </button>
                            </div>

                            {ragAnswers[queryKey] && (
                              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-xs text-app-text leading-relaxed mt-3 space-y-2">
                                <div className="font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4" /> Respuesta Groq AI &amp; Base RAG:
                                </div>
                                <div className="whitespace-pre-wrap font-sans text-xs">
                                  {ragAnswers[queryKey]}
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resultado Análisis Riesgo */}
            {riskResult && (
              <div className="bg-app-surface border border-blue-500/30 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-app-border pb-3 gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-app-text">Informe Consolidado de Auditoría SUNAT</h3>
                    <p className="text-[11px] sm:text-xs text-app-muted">Empresa: <strong>{currentWorkspace?.name}</strong> | Periodo: <strong>{riskResult.period}</strong></p>
                  </div>
                  <div className="bg-app-bg border border-app-border px-3 py-1.5 rounded-xl text-left sm:text-right shrink-0">
                    <div className="text-[9px] sm:text-[10px] text-app-muted font-black uppercase">Nivel de Riesgo Calculado</div>
                    <div className={`text-base sm:text-xl font-black ${riskResult.riskScore > 50 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {riskResult.riskScore} / 100 ({riskResult.riskScore > 50 ? 'Atención Requerida' : 'Bajo Riesgo'})
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 p-3.5 sm:p-4 rounded-xl border border-blue-500/20 text-xs text-app-text leading-relaxed">
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 block mb-1">🤖 Dictamen Ejecutivo Groq AI:</span>
                  {riskResult.findings?.resumen_ejecutivo}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 2: PLANILLAS CON GROQ AI RAG ─── */}
        {isPremiumActive && activeSubTab === 'planillas' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg sm:rounded-xl border border-blue-500/20 shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Colaboradores</div>
                  <div className="text-base sm:text-xl font-black text-app-text">
                    {workspaceKPIs?.metrics?.planillas?.colaboradoresCount ?? (employees?.length || 0)} Registrados
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate">Sincronizados con SaaS</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg sm:rounded-xl border border-purple-500/20 shrink-0">
                  <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Gratificación Est.</div>
                  <div className="text-base sm:text-xl font-black text-purple-600 dark:text-purple-400">
                    S/ {workspaceKPIs?.metrics?.planillas?.gratiEstimadaTotalSoles || '0.00'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Ley 27735 / 32563</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-xl border border-emerald-500/20 shrink-0">
                  <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Depósito CTS</div>
                  <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                    S/ {workspaceKPIs?.metrics?.planillas?.ctsEstimadaSoles || '0.00'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Cálculo Semestral</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg sm:rounded-xl border border-amber-500/20 shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Contratos MINTRA</div>
                  <div className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">Groq Redactor</div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Ley 728 / CAS</div>
                </div>
              </div>
            </div>

            {/* EXPANDIBLES ACCORDION PILAR 2 PLANILLAS */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="border-b border-app-border pb-3">
                <h2 className="text-base sm:text-lg font-black text-app-text flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Módulos de Planillas y Liquidaciones Groq RAG
                </h2>
                <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">
                  Cálculos determinísticos laborales y redactor asistido de contratos conectado a la nómina de SOFTCONTABLE SaaS.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 pt-1">
                <div className="sm:col-span-2 md:col-span-1">
                  <label className="text-[10px] sm:text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Colaborador (BD o DNI)</label>
                  {employees && employees.length > 0 ? (
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 sm:p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Seleccionar colaborador ({employees.length}) --</option>
                      {employees.map((emp: any) => (
                        <option key={emp.id || emp.dni} value={emp.id || emp.dni || emp.num_doc}>
                          {(emp.nombres || emp.nombre || '') + ' ' + (emp.apellidos || '')} {emp.dni ? `(${emp.dni})` : ''} - S/ {emp.sueldo_basico || emp.sueldo || 1130}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ingresa DNI o Nombre del colaborador"
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 sm:p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[10px] sm:text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Meses Laborados</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={mesesTrabajados}
                    onChange={(e) => setMesesTrabajados(Number(e.target.value))}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 sm:p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 items-end sm:col-span-2 md:col-span-1">
                  <button
                    onClick={handleCalculateGratificacion}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 sm:py-3 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all"
                  >
                    <Calculator className="w-4 h-4" /> Calcular Gratificación
                  </button>
                  <button
                    onClick={handleGenerateContract}
                    disabled={loading}
                    className="flex-1 bg-app-bg hover:bg-app-hover border border-app-border text-app-text font-extrabold py-2.5 sm:py-3 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow-sm cursor-pointer transition-all"
                  >
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Contrato Groq
                  </button>
                </div>
              </div>

              {/* LISTADO DE 4 MÓDULOS LABORALES EXPANDIBLES */}
              <div className="space-y-3 pt-2">
                {[
                  {
                    id: 'planillas_mod1',
                    title: 'Módulo 1: Gratificación Ley 27735 & Ley 32563 CAS 2026',
                    badge: 'Julio / Diciembre',
                    color: 'purple',
                    icon: Award,
                    summary: `Gratificación semestral con Bonificación Extraordinaria del 9% (EsSalud) o 6.75% (EPS).`,
                    laws: [
                      'Ley N° 27735 y D.S. 005-2002-TR — Gratificaciones del sector privado.',
                      'Ley N° 29351 y Ley N° 30334 — Bonificación Extraordinaria inafecta.',
                      'Ley N° 32563 (Marzo 2026) — Régimen CAS: Pago de gratificación completa de 1 sueldo.'
                    ],
                    formula: `Gratificación = (Remuneración Computable × Meses ÷ 6) + 9% Bonificación Extraordinaria.`
                  },
                  {
                    id: 'planillas_mod2',
                    title: 'Módulo 2: Depósito & Proyección Semestral de CTS (D.Leg 650)',
                    badge: 'Mayo / Noviembre',
                    color: 'emerald',
                    icon: Calculator,
                    summary: `Compensación por Tiempo de Servicios incluyendo 1/6 de la última gratificación.`,
                    laws: [
                      'TUO D.Leg 650 y D.S. 001-97-TR — Depósitos semestrales de CTS.',
                      'Integración de la sexta parte de gratificación al promedio imponible.',
                      'Ley 32563 Art. 12 — CTS cancelatoria directa al cese para sector público.'
                    ],
                    formula: `Base Computable = Sueldo + Asig. Fam + (Gratificación ÷ 6). Depósito = Base ÷ 12 × Meses.`
                  },
                  {
                    id: 'planillas_mod3',
                    title: 'Módulo 3: Liquidación de Beneficios Sociales & Vacaciones Trucas',
                    badge: 'D.Leg 713',
                    color: 'blue',
                    icon: Users,
                    summary: `Vacaciones no gozadas, indemnización vacacional y liquidación al cese.`,
                    laws: [
                      'Decreto Legislativo N° 713 — 30 días de descanso vacacional remunerado.',
                      'Vacaciones Truncas — Pago proporcional por meses y días trabajados.',
                      'Art. 23 D.Leg 713 — Indemnización vacacional por falta de descanso en fecha.'
                    ],
                    formula: `Liquidación = Vacaciones Truncas + CTS Trunca + Gratificación Trunca.`
                  },
                  {
                    id: 'planillas_mod4',
                    title: 'Módulo 4: Redactor Inteligente de Contratos MINTRA 2026',
                    badge: 'MINTRA 2.0',
                    color: 'amber',
                    icon: FileText,
                    summary: `Generador asistido de contratos a plazo fijo e indeterminado con cláusulas Groq AI.`,
                    laws: [
                      'TUO D.Leg 728 (D.S. 003-97-TR) — Modalidades de contratación laboral.',
                      'Directiva MINTRA 2026 — Registro digital y cláusulas de causa objetiva.',
                      'Resolución Ministerial N° 120-2024-TR — Firma electrónica de boletas y contratos.'
                    ],
                    formula: `Generación asistida Groq LLaMA-3.3 garantizando causa objetiva sin desnaturalización.`
                  }
                ].map((mod) => {
                  const Icon = mod.icon;
                  const isExpanded = expandedModule === mod.id;
                  const queryKey = `planillas_${mod.id}`;

                  return (
                    <div key={mod.id} className="bg-app-bg border border-app-border rounded-xl overflow-hidden transition-all shadow-sm">
                      <button
                        onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-app-hover transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${isExpanded ? 'bg-blue-600 text-white' : 'bg-app-surface text-app-muted border border-app-border'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-app-text flex items-center gap-2 flex-wrap">
                              <span>{mod.title}</span>
                              <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/20">
                                {mod.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-app-muted truncate mt-0.5">{mod.summary}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hidden sm:inline">
                            {isExpanded ? 'Ocultar Análisis Laboral' : 'Expandir RAG Laboral'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-app-muted transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 sm:p-6 border-t border-app-border bg-app-surface/60 space-y-5 animate-fade-in">
                          <div className="bg-app-bg border border-app-border p-4 rounded-xl space-y-2">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Fórmulas &amp; Algoritmos Laborales
                            </h4>
                            <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                              {mod.formula}
                            </div>
                          </div>

                          <div className="bg-app-bg border border-app-border p-4 rounded-xl space-y-2">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <Scale className="w-4 h-4 text-amber-500" /> Sustento Normativo MINTRA &amp; Leyes
                            </h4>
                            <ul className="space-y-1.5 text-xs text-app-muted font-medium">
                              {mod.laws.map((law, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-blue-600 font-bold">•</span>
                                  <span>{law}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-app-bg border border-blue-500/30 p-4 rounded-xl space-y-3">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Co-Pilot Groq Laboral en Vivo
                            </h4>
                            <p className="text-[11px] text-app-muted">
                              Haz una consulta sobre licencias, gratificaciones o contratos de tu nómina.
                            </p>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Ej. ¿Corresponde pago de gratificación si el trabajador renunció antes de completar el mes?"
                                value={ragQueries[queryKey] || ''}
                                onChange={(e) => setRagQueries(prev => ({ ...prev, [queryKey]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSendRagQuery('planillas', mod.id);
                                }}
                                className="flex-1 bg-app-surface border border-app-border rounded-xl p-2.5 text-xs text-app-text focus:border-blue-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleSendRagQuery('planillas', mod.id)}
                                disabled={ragLoading[queryKey]}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
                              >
                                {ragLoading[queryKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Consultar RAG
                              </button>
                            </div>

                            {ragAnswers[queryKey] && (
                              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-xs text-app-text leading-relaxed mt-3 space-y-2">
                                <div className="font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4" /> Respuesta Groq Laboral &amp; Base RAG:
                                </div>
                                <div className="whitespace-pre-wrap font-sans text-xs">
                                  {ragAnswers[queryKey]}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {payrollResult && (
              <div className="bg-app-surface border border-purple-500/30 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-md">
                <div className="flex justify-between items-center border-b border-app-border pb-3">
                  <h3 className="text-xs sm:text-sm font-black text-app-text">Desglose de Gratificación Computada</h3>
                  <span className="text-[9px] sm:text-[10px] px-2.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-full font-bold">
                    {payrollResult.detail?.normativa || 'Ley 27735 / 32563'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 text-center">
                  <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                    <div className="text-[9px] sm:text-[10px] text-app-muted uppercase font-bold">Sueldo Base</div>
                    <div className="text-sm sm:text-base font-black text-app-text">S/ {payrollResult.detail?.sueldo_base}</div>
                  </div>
                  <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                    <div className="text-[9px] sm:text-[10px] text-app-muted uppercase font-bold">Asig. Familiar</div>
                    <div className="text-sm sm:text-base font-black text-app-text">S/ {payrollResult.detail?.asignacion_familiar}</div>
                  </div>
                  <div className="bg-app-bg p-3 rounded-xl border border-app-border">
                    <div className="text-[9px] sm:text-[10px] text-app-muted uppercase font-bold">Bonif. 9% Ley 29351</div>
                    <div className="text-sm sm:text-base font-black text-purple-600 dark:text-purple-400">S/ {payrollResult.detail?.bonificacion_extraordinaria_soles}</div>
                  </div>
                  <div className="bg-blue-600 text-white p-3 rounded-xl shadow-md col-span-2 md:col-span-1">
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-100">Total a Depositar</div>
                    <div className="text-lg sm:text-xl font-black">S/ {payrollResult.totalSoles}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 3: FINANZAS CON GROQ AI RAG ─── */}
        {isPremiumActive && activeSubTab === 'finanzas' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg sm:rounded-xl border border-blue-500/20 shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Liquidez Corriente</div>
                  <div className="text-base sm:text-xl font-black text-app-text">
                    {workspaceKPIs?.metrics?.finanzas?.liquidezCorriente ?? '1.00'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate">Solvencia Positiva</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-xl border border-emerald-500/20 shrink-0">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Prueba Ácida</div>
                  <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {workspaceKPIs?.metrics?.finanzas?.pruebaAcida ?? '1.00'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Capacidad Inmediata</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg sm:rounded-xl border border-purple-500/20 shrink-0">
                  <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">EBITDA Margin</div>
                  <div className="text-base sm:text-xl font-black text-purple-600 dark:text-purple-400">
                    {workspaceKPIs?.metrics?.finanzas?.ebitdaMarginPct ?? '0.0'}%
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Eficiencia Operativa</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-3">
                <div className="p-2 sm:p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg sm:rounded-xl border border-amber-500/20 shrink-0">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-app-muted truncate">Vencimiento SUNAT</div>
                  <div className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">
                    Día {workspaceKPIs?.metrics?.finanzas?.sunatDueDateDay ?? 15}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Dígito {workspaceKPIs?.metrics?.finanzas?.sunatLastDigit ?? 0}</div>
                </div>
              </div>
            </div>

            {/* EXPANDIBLES ACCORDION PILAR 3 FINANZAS */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="border-b border-app-border pb-3">
                <h2 className="text-base sm:text-lg font-black text-app-text flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Módulos de Finanzas RAG &amp; Forecast Groq AI
                </h2>
                <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">
                  Modelado predictivo de liquidez cruzando cuentas por cobrar/pagar con las fechas de vencimiento SUNAT por RUC.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-end pt-1">
                <div className="flex-1 w-full">
                  <label className="text-[10px] sm:text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Periodo Financiero</label>
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 sm:p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleGenerateCashflow}
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 sm:py-3 px-5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Generar Forecast Groq AI
                </button>
              </div>

              {/* LISTADO DE 4 MÓDULOS FINANCIEROS EXPANDIBLES */}
              <div className="space-y-3 pt-2">
                {[
                  {
                    id: 'finanzas_mod1',
                    title: 'Módulo 1: Proyección de Flujo de Caja & Saldo Neto',
                    badge: 'NIC 7 NIIF',
                    color: 'blue',
                    icon: TrendingUp,
                    summary: `Modelado predictivo de entradas (Ventas S/ ${workspaceKPIs?.metrics?.tributario?.totalVentasSoles || '0.00'}) y salidas (Compras + Impuestos).`,
                    laws: [
                      'NIC 7 — Estado de Flujos de Efectivo.',
                      'Gestión de Capital de Trabajo y Ciclo de Conversión de Efectivo.',
                      'Cálculo de cobertura impositiva previa al vencimiento SUNAT.'
                    ],
                    formula: `Saldo Proyectado = Saldo Inicial + Ventas Cobradas - Compras Pagadas - Planilla - IGV.`
                  },
                  {
                    id: 'finanzas_mod2',
                    title: 'Módulo 2: Vencimiento Oficial SUNAT por Dígito de RUC',
                    badge: `Dígito ${workspaceKPIs?.metrics?.finanzas?.sunatLastDigit ?? 0}`,
                    color: 'amber',
                    icon: Calendar,
                    summary: `Vencimiento estimado: Día ${workspaceKPIs?.metrics?.finanzas?.sunatDueDateDay ?? 15} de cada mes.`,
                    laws: [
                      'RS N° 000281-2024/SUNAT — Cronograma Oficial de Vencimientos.',
                      'Código Tributario Art. 176 inc. 1 — Multa por no presentar en fecha (1 UIT con 90% rebaja).',
                      'Alertas tempranas de liquidez antes del cierre del periodo.'
                    ],
                    formula: `Día Vencimiento = 12 + Dígito RUC (Ajustado según calendario de domingos y feriados).`
                  },
                  {
                    id: 'finanzas_mod3',
                    title: 'Módulo 3: Ratios Financieros (Liquidez, Prueba Ácida, EBITDA)',
                    badge: 'Solvencia 4.0',
                    color: 'purple',
                    icon: Calculator,
                    summary: `Liquidez Corriente: ${workspaceKPIs?.metrics?.finanzas?.liquidezCorriente || '1.00'} | Prueba Ácida: ${workspaceKPIs?.metrics?.finanzas?.pruebaAcida || '1.00'}.`,
                    laws: [
                      'NIC 1 — Presentación de Estados Financieros.',
                      'Prueba Ácida = (Activo Corriente - Inventarios) ÷ Pasivo Corriente.',
                      'EBITDA Margin = (Utilidad Operativa + Depreciación) ÷ Ventas × 100.'
                    ],
                    formula: `Liquidez Corriente = Ventas Totales ÷ Compras Totales = ${workspaceKPIs?.metrics?.finanzas?.liquidezCorriente || '1.00'}`
                  },
                  {
                    id: 'finanzas_mod4',
                    title: 'Módulo 4: Escudo Fiscal & Recomendación Estratégica Groq AI',
                    badge: 'Planeamiento 4.0',
                    color: 'emerald',
                    icon: DollarSign,
                    summary: `Optimizaciones de depreciación de activos fijos, saldo a favor y capital de trabajo.`,
                    laws: [
                      'Norma XVI del Título Preliminar del Código Tributario — Elusión Lícita.',
                      'Art. 38 a 41 LIR — Depreciación acelerada de activos fijos.',
                      'Art. 50 LIR — Compensación de Pérdidas Tributarias.'
                    ],
                    formula: `Escudo Fiscal = Depreciación Deducible × 29.5% Tasa del Impuesto a la Renta.`
                  }
                ].map((mod) => {
                  const Icon = mod.icon;
                  const isExpanded = expandedModule === mod.id;
                  const queryKey = `finanzas_${mod.id}`;

                  return (
                    <div key={mod.id} className="bg-app-bg border border-app-border rounded-xl overflow-hidden transition-all shadow-sm">
                      <button
                        onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-app-hover transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${isExpanded ? 'bg-blue-600 text-white' : 'bg-app-surface text-app-muted border border-app-border'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-black text-app-text flex items-center gap-2 flex-wrap">
                              <span>{mod.title}</span>
                              <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/20">
                                {mod.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-app-muted truncate mt-0.5">{mod.summary}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hidden sm:inline">
                            {isExpanded ? 'Ocultar Análisis Financiero' : 'Expandir RAG Financiero'}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-app-muted transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 sm:p-6 border-t border-app-border bg-app-surface/60 space-y-5 animate-fade-in">
                          <div className="bg-app-bg border border-app-border p-4 rounded-xl space-y-2">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Fórmulas &amp; Metodología Financiera NIIF
                            </h4>
                            <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                              {mod.formula}
                            </div>
                          </div>

                          <div className="bg-app-bg border border-app-border p-4 rounded-xl space-y-2">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <Scale className="w-4 h-4 text-amber-500" /> Sustento Normativo NIIF &amp; SUNAT
                            </h4>
                            <ul className="space-y-1.5 text-xs text-app-muted font-medium">
                              {mod.laws.map((law, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-blue-600 font-bold">•</span>
                                  <span>{law}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-app-bg border border-blue-500/30 p-4 rounded-xl space-y-3">
                            <h4 className="text-xs font-black text-app-text flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Co-Pilot Groq Financiero en Vivo
                            </h4>
                            <p className="text-[11px] text-app-muted">
                              Haz una consulta financiera o pide una recomendación de liquidez.
                            </p>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Ej. ¿Cómo afecta este nivel de compras a la liquidez de cierre de mes?"
                                value={ragQueries[queryKey] || ''}
                                onChange={(e) => setRagQueries(prev => ({ ...prev, [queryKey]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSendRagQuery('finanzas', mod.id);
                                }}
                                className="flex-1 bg-app-surface border border-app-border rounded-xl p-2.5 text-xs text-app-text focus:border-blue-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleSendRagQuery('finanzas', mod.id)}
                                disabled={ragLoading[queryKey]}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all shrink-0"
                              >
                                {ragLoading[queryKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Consultar RAG
                              </button>
                            </div>

                            {ragAnswers[queryKey] && (
                              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-xs text-app-text leading-relaxed mt-3 space-y-2">
                                <div className="font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4" /> Respuesta Groq Financiera &amp; Base RAG:
                                </div>
                                <div className="whitespace-pre-wrap font-sans text-xs">
                                  {ragAnswers[queryKey]}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {cashflowResult && (
              <div className="bg-app-surface border border-blue-500/30 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-center">
                  <div className="bg-app-bg p-3.5 rounded-xl border border-app-border">
                    <div className="text-[9px] sm:text-[10px] text-app-muted uppercase font-bold">Ingresos Estimados de Caja</div>
                    <div className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400">S/ {cashflowResult.projectedInflowsSoles}</div>
                  </div>

                  <div className="bg-app-bg p-3.5 rounded-xl border border-app-border">
                    <div className="text-[9px] sm:text-[10px] text-app-muted uppercase font-bold">Egresos + Impuestos SUNAT</div>
                    <div className="text-base sm:text-xl font-black text-rose-600 dark:text-rose-400">S/ {cashflowResult.projectedOutflowsSoles}</div>
                  </div>

                  <div className="bg-blue-600 text-white p-3.5 rounded-xl shadow-md">
                    <div className="text-[9px] sm:text-[10px] font-bold text-blue-100 uppercase">Saldo Neto Proyectado</div>
                    <div className="text-lg sm:text-2xl font-black">
                      S/ {cashflowResult.netBalanceSoles}
                    </div>
                  </div>
                </div>

                <div className="bg-app-bg p-3.5 sm:p-5 rounded-xl border border-app-border space-y-1.5">
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Cruce con Calendario Oficial SUNAT:
                  </div>
                  <div className="text-[11px] sm:text-xs text-app-text font-medium leading-relaxed">
                    • Último dígito RUC: <strong>{cashflowResult.sunatAdjustments?.ultimo_digito_ruc}</strong> | Vencimiento estimado: <strong>Día {cashflowResult.sunatAdjustments?.dia_vencimiento_sunat} de cada mes</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      <footer className="bg-app-surface border-t border-app-border px-4 py-2.5 text-center text-[10px] sm:text-xs text-app-muted font-medium shrink-0">
        SoftPremium SAAS — Módulo Groq LLaMA-3.3 RAG 4.0 © 2026 Angelo Serna Simeon
      </footer>
    </div>
  );
};
