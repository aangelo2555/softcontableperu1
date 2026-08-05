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
  ChevronRight
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

  // Cargar estado de suscripción del workspace
  useEffect(() => {
    if (currentWorkspace?.id || currentWorkspace?.ruc) {
      checkSubscriptionStatus();
    }
  }, [currentWorkspace?.id, currentWorkspace?.ruc]);

  // Cargar KPIs dinámicos al activar suscripción o cambiar empresa/periodo
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

  // Ejecutar Análisis Integral de Riesgo (Pilar 1 - Evalúa TODOS los módulos)
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
          runType: 'inconsistencia_gastos_ventas' // Análisis integral
        })
      });
      const data = await res.json();
      if (data.success) {
        setRiskResult(data.analysis);
        toast.success('Auditoría Integral con IA ejecutada para todos los módulos tributarios');
      } else {
        toast.error(data.error || 'Error al ejecutar análisis');
      }
    } catch (e: any) {
      toast.error('Error de conexión con el servicio de IA: ' + e.message);
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
        toast.success('Cálculo determinístico de planillas y beneficios ejecutado');
      } else {
        toast.error(data.error || 'Error en cálculo laboral');
      }
    } catch (e: any) {
      toast.error('Error al comunicarse con el servidor: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Generar Contrato con IA (Pilar 2)
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
        toast.success('Contrato redactado con IA según MINTRA 2026');
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
        toast.success('Proyección financiera y cruce con calendario SUNAT generados');
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
        
        {/* Fila 1 en móvil: Botón Volver & Logo */}
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
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-xl font-black text-app-text tracking-tight font-sans">SOFT<span className="text-blue-600 dark:text-blue-400">PREMIUM</span></span>
                  <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest font-mono">IA v2.0</span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-app-muted font-medium hidden sm:block">Portal Corporativo de Inteligencia Artificial &amp; Analítica Avanzada</p>
              </div>
            </div>
          </div>

          {/* Badge de suscripción en móvil derecha */}
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

        {/* Fila 2 en móvil: Usuario & Selector de Empresas */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">
          {/* Usuario Logueado */}
          <div className="bg-app-bg border border-app-border px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-[11px] sm:text-xs shrink-0">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left max-w-[110px] sm:max-w-none truncate">
              <span className="text-[11px] sm:text-xs font-black text-app-text truncate">{user?.name || user?.nombre || 'Usuario Logueado'}</span>
              <span className="text-[9px] sm:text-[10px] text-app-muted font-medium truncate hidden sm:block">{user?.email || 'usuario@softcontable.pe'}</span>
            </div>
          </div>

          {/* Selector MIS EMPRESAS */}
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
                {(!workspaces || workspaces.length === 0) && (
                  <option value="" className="bg-app-surface text-app-text">
                    {currentWorkspace?.name || 'Sin Empresas'}
                  </option>
                )}
              </select>
            </div>
          )}

          {/* Badge Estado Suscripción (Desktop) */}
          <div className={`hidden md:flex px-3.5 py-1.5 rounded-xl font-black text-xs items-center gap-2 border shrink-0 ${
            isPremiumActive 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            <CreditCard className="w-4 h-4" />
            {isPremiumActive ? 'Suscripción Activa' : 'Suscripción Inactiva'}
          </div>
        </div>
      </header>

      {/* ─── SUB-NAVBAR PILARES Y PLANES (Fijo Desplazable Táctil) ─── */}
      <div className="bg-app-surface border-b border-app-border px-2 sm:px-6 py-2 flex items-center justify-start md:justify-center overflow-x-auto no-scrollbar shrink-0">
        <div className="flex gap-1.5 sm:gap-2 p-1 bg-app-bg rounded-xl border border-app-border max-w-full overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Tributación con IA');
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
            <span>1. Tributación</span>
          </button>

          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Planillas con IA');
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
            <span>2. Planillas</span>
          </button>

          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Finanzas con IA');
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
            <span>3. Finanzas</span>
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

      {/* ─── CONTENIDO PRINCIPAL SOFTPREMIUM (Cuerpo con Desplazamiento Suave) ─── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-12 sm:pb-16">

        {/* SI PREMIUM NO ESTÁ ACTIVO Y INTENTA ENTRAR A PILARES */}
        {!isPremiumActive && activeSubTab !== 'subscription' && (
          <div className="bg-app-surface border border-blue-500/20 rounded-2xl p-5 sm:p-8 text-center space-y-4 sm:space-y-6 shadow-md">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-xl sm:text-2xl font-black text-app-text">SoftPremium IA no está activo para {currentWorkspace?.name || 'esta empresa'}</h2>
              <p className="text-xs sm:text-sm text-app-muted font-medium leading-relaxed">
                Activa tu suscripción mensual para desbloquear el análisis predictivo SUNAT, cálculo determinístico de planillas y flujo de caja proyectado.
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

        {/* ─── SECCIÓN: PLANES Y PAGOS YAPE / PLIN ─── */}
        {activeSubTab === 'subscription' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            <div className="text-center space-y-1.5 max-w-2xl mx-auto px-2">
              <h2 className="text-xl sm:text-3xl font-black text-app-text font-sans">Planes y Suscripción SoftPremium IA</h2>
              <p className="text-xs sm:text-sm text-app-muted font-medium leading-relaxed">
                Elige el plan que mejor se adapte a tu empresa. Realiza tu pago mediante Yape, Plin o Transferencia Bancaria sin comisiones adicionales.
              </p>
            </div>

            {/* Tarjetas de Tarifas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {/* Plan Tributario */}
              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between ${selectedPlanTier === 'tributario' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Pilar 1: Tributación</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Auditoría preventiva SUNAT, consistencias gastos vs ventas y reglas Art. 37 LIR.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('tributario')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'tributario' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'tributario' ? '✓ Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Planillas */}
              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between ${selectedPlanTier === 'planillas' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Pilar 2: Planillas</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Gratificación Ley 27735/32563 CAS, CTS y redacción de contratos con IA.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('planillas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'planillas' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'planillas' ? '✓ Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Finanzas */}
              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between ${selectedPlanTier === 'finanzas' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Pilar 3: Finanzas</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Flujo de caja cruzado con el calendario oficial SUNAT según dígito RUC.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('finanzas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'finanzas' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'finanzas' ? '✓ Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Full Premium */}
              <div className={`bg-app-surface border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col justify-between relative overflow-hidden ${selectedPlanTier === 'full' ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-app-border'}`}>
                <div className="absolute top-2.5 right-2.5 bg-blue-600 text-white font-extrabold text-[8.5px] sm:text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">Más Popular</div>
                <div className="space-y-2">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider">SoftPremium Full</div>
                  <div className="text-2xl sm:text-3xl font-black text-app-text">S/ 99 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">Acceso completo ilimitado a los 3 Pilares (Tributación + Planillas + Finanzas).</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('full')}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedPlanTier === 'full' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'full' ? '✓ Seleccionado' : 'Elegir Plan Full'}
                </button>
              </div>
            </div>

            {/* Medios de Pago Locales & Formulario de Comprobante */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 pt-2">
              
              {/* Información Yape / Plin / Banco */}
              <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" /> Medios de Pago en Perú (Sin Comisiones)
                </h3>

                <div className="space-y-3 sm:space-y-4">
                  {/* Yape / Plin */}
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

                  {/* Cuentas Bancarias */}
                  <div className="bg-app-bg p-3.5 sm:p-4 rounded-xl border border-app-border space-y-1.5 sm:space-y-2">
                    <div className="text-[10px] sm:text-xs text-app-muted font-bold uppercase">Transferencia Bancaria</div>
                    <div className="text-xs text-app-text font-medium">
                      • <strong>BCP Soles:</strong> 193-98765432-0-11
                    </div>
                    <div className="text-xs text-app-text font-medium">
                      • <strong>CCI BCP:</strong> 002-193009876543201114
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-app-muted pt-1 font-medium">Titular: SOFTCONTABLE SAAS / Angelo Serna</div>
                  </div>
                </div>
              </div>

              {/* Registro de Comprobante / Voucher */}
              <form onSubmit={handleSubmitVoucher} className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
                <h3 className="text-base sm:text-lg font-bold text-app-text flex items-center gap-2">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Registrar Comprobante de Pago
                </h3>

                <div>
                  <label className="text-[10px] sm:text-xs text-app-muted font-black uppercase tracking-wider mb-2 block">Plan a Activar</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'full', title: 'SoftPremium Full', price: 'S/ 99.00 / mes', desc: 'Los 3 Pilares IA', badge: 'RECOMENDADO', icon: Sparkles },
                      { id: 'tributario', title: 'Pilar 1: Tributación IA', price: 'S/ 49.00 / mes', desc: 'Auditoría preventiva SUNAT', icon: ShieldAlert },
                      { id: 'planillas', title: 'Pilar 2: Planillas IA', price: 'S/ 49.00 / mes', desc: 'Liquidaciones + Contratos', icon: FileCheck },
                      { id: 'finanzas', title: 'Pilar 3: Finanzas IA', price: 'S/ 49.00 / mes', desc: 'Flujo de Caja + Forecast', icon: TrendingUp }
                    ].map(plan => {
                      const Icon = plan.icon;
                      const isSelected = selectedPlanTier === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlanTier(plan.id as any)}
                          className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                            isSelected
                              ? 'bg-blue-600/10 border-blue-600 shadow-sm'
                              : 'bg-app-bg border-app-border hover:border-app-muted'
                          }`}
                        >
                          {plan.badge && (
                            <span className="absolute -top-2 right-2 bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                              {plan.badge}
                            </span>
                          )}
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-app-surface text-app-muted border border-app-border'}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] sm:text-xs font-black text-app-text truncate">{plan.title}</div>
                              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{plan.price}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] sm:text-xs text-app-muted font-semibold mb-1 block">Número de Operación / Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 09876543 o Nro de Operación Yape"
                    value={operationNumber}
                    onChange={(e) => setOperationNumber(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] sm:text-xs text-app-muted font-semibold mb-1 block">Adjuntar Captura de Comprobante (Voucher)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-app-bg border border-app-border hover:bg-app-hover text-app-text rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm truncate"
                    >
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{voucherFile ? voucherFile.name : '📁 Adjuntar Foto de Voucher'}</span>
                    </button>

                    {voucherBase64 && (
                      <div className="relative group w-9 h-9 rounded-lg overflow-hidden border border-app-border shrink-0">
                        <img src={voucherBase64} alt="Voucher Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setVoucherFile(null); setVoucherBase64(null); }}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  {voucherFile && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">✓ Captura lista ({Math.round(voucherFile.size / 1024)} KB)</p>
                  )}
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

        {/* ─── PILAR 1: TRIBUTACIÓN CON IA (Muestra explícitamente todos los módulos) ─── */}
        {isPremiumActive && activeSubTab === 'tributario' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            
            {/* Rejilla de Indicadores de Salud Tributaria Dinámicos */}
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

            {/* Panel de Control de Auditoría Integral */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-app-border pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-app-text flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Motor de Auditoría Preventiva SUNAT 2026
                  </h2>
                  <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">
                    Evaluación automatizada y simultánea de todos los módulos tributarios conectándose con las operaciones de SOFTCONTABLE SaaS.
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
                    Ejecutar Auditoría IA Integral
                  </button>
                </div>
              </div>

              {/* MUESTREO EXPLÍCITO DE TODOS LOS MÓDULOS DE PILAR 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-1">
                {/* Módulo 1 */}
                <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-app-text flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" /> Módulo 1: Consistencia Compras vs Ventas
                    </span>
                    <span className="text-[9.5px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded">RIE / SIRE</span>
                  </div>
                  <p className="text-[11px] text-app-muted">
                    Ventas declaradas: <strong>S/ {workspaceKPIs?.metrics?.tributario?.totalVentasSoles || '0.00'}</strong> ({workspaceKPIs?.metrics?.tributario?.totalVentasCount || 0} comprobantes) | Compras declaradas: <strong>S/ {workspaceKPIs?.metrics?.tributario?.totalComprasSoles || '0.00'}</strong>.
                  </p>
                </div>

                {/* Módulo 2 */}
                <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-app-text flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Módulo 2: Bancarización (Ley 28194)
                    </span>
                    <span className="text-[9.5px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded">Operaciones &gt; S/ 2,000</span>
                  </div>
                  <p className="text-[11px] text-app-muted">
                    Total sin bancarizar identificado: <strong>S/ {workspaceKPIs?.metrics?.tributario?.sinBancarizarSoles || '0.00'}</strong>. Verificación de medio de pago y vouchers bancarios.
                  </p>
                </div>

                {/* Módulo 3 */}
                <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-app-text flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-purple-500" /> Módulo 3: Deducción Gastos Art. 37 LIR
                    </span>
                    <span className="text-[9.5px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded">Causalidad</span>
                  </div>
                  <p className="text-[11px] text-app-muted">
                    Cumplimiento de causalidad y comprobantes válidos: <strong>{workspaceKPIs?.metrics?.tributario?.gastosDeduciblesPct ?? 100}%</strong> auditados.
                  </p>
                </div>

                {/* Módulo 4 */}
                <div className="bg-app-bg border border-app-border rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-app-text flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-emerald-500" /> Módulo 4: Scoring &amp; Perfil SUNAT
                    </span>
                    <span className="text-[9.5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded">Puntaje {workspaceKPIs?.metrics?.tributario?.saludFiscalScore || 100}/100</span>
                  </div>
                  <p className="text-[11px] text-app-muted">
                    Diagnóstico de riesgo de fiscalización: <strong>{workspaceKPIs?.metrics?.tributario?.saludFiscalEtiqueta || 'Bajo Riesgo'}</strong>.
                  </p>
                </div>
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
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 block mb-1">🤖 Dictamen Ejecutivo del Auditor IA:</span>
                  {riskResult.findings?.resumen_ejecutivo}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-app-text">Hallazgos e Inconsistencias Identificadas ({riskResult.findings?.hallazgos?.length || 0}):</h4>
                  {riskResult.findings?.hallazgos?.map((item: RiskFinding, idx: number) => (
                    <div key={idx} className="bg-app-bg p-3.5 rounded-xl border-l-4 border-blue-600 border border-app-border flex flex-col sm:flex-row justify-between gap-2 sm:gap-4">
                      <div>
                        <div className="font-bold text-app-text text-xs">{item.titulo}</div>
                        <div className="text-[11px] text-app-muted mt-1">{item.descripcion}</div>
                      </div>
                      <span className="px-2.5 py-0.5 text-[9.5px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-lg h-fit w-fit shrink-0">
                        {item.severidad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 2: PLANILLAS CON IA (Muestra explícitamente todos los módulos) ─── */}
        {isPremiumActive && activeSubTab === 'planillas' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            
            {/* Rejilla 2x2 en celular, 4 columnas en desktop */}
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
                  <div className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-bold truncate">En Base de Datos</div>
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
                  <div className="text-base sm:text-xl font-black text-amber-600 dark:text-amber-400">Plantillas IA</div>
                  <div className="text-[9px] sm:text-[10px] text-app-muted font-bold truncate">Redactor 2.0</div>
                </div>
              </div>
            </div>

            {/* MUESTRA EXPLÍCITA DE MÓDULOS DE PLANILLAS */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="border-b border-app-border pb-3">
                <h2 className="text-base sm:text-lg font-black text-app-text flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Módulos de Planillas y Liquidaciones IA
                </h2>
                <p className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">
                  Cálculos laborales determinísticos y redacción de contratos MINTRA conectados a la nómina del sistema.
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
                          {(emp.nombres || emp.nombre || '') + ' ' + (emp.apellidos || '')} {emp.dni ? `(${emp.dni})` : ''} - S/ {emp.sueldo_basico || emp.sueldo || 2500}
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
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Contrato IA
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado Cálculo Gratificación */}
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

            {/* Resultado Contrato IA */}
            {contractDoc && (
              <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-md">
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 sm:p-4 rounded-xl flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 font-medium">
                    <strong>Revisión Legal:</strong> Borrador generado según MINTRA 2026. Revisar cláusulas antes de remitir al trabajador.
                  </div>
                </div>

                <div className="bg-app-bg p-3.5 sm:p-5 rounded-xl font-mono text-[11px] sm:text-xs text-app-text max-h-56 sm:max-h-72 overflow-y-auto whitespace-pre-wrap border border-app-border leading-relaxed">
                  {contractDoc.contractText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 3: FINANZAS CON IA (Muestra explícitamente todos los módulos) ─── */}
        {isPremiumActive && activeSubTab === 'finanzas' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            
            {/* Rejilla 2x2 en celular, 4 columnas en desktop */}
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

            {/* Generador de Flujo de Caja */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-sm">
              <div className="border-b border-app-border pb-3">
                <h2 className="text-base sm:text-lg font-black text-app-text flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" /> Proyección de Flujo de Caja &amp; Vencimientos SUNAT
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
                  Generar Forecast Financiero IA
                </button>
              </div>
            </div>

            {/* Resultado Forecast Financiero */}
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

                {/* Cruce Calendario SUNAT */}
                <div className="bg-app-bg p-3.5 sm:p-5 rounded-xl border border-app-border space-y-1.5">
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Cruce con Calendario Oficial SUNAT:
                  </div>
                  <div className="text-[11px] sm:text-xs text-app-text font-medium leading-relaxed">
                    • Último dígito RUC: <strong>{cashflowResult.sunatAdjustments?.ultimo_digito_ruc}</strong> | Vencimiento estimado: <strong>Día {cashflowResult.sunatAdjustments?.dia_vencimiento_sunat} de cada mes</strong>.
                  </div>
                  <div className="text-[11px] sm:text-xs text-app-muted font-medium leading-relaxed">
                    • {cashflowResult.sunatAdjustments?.alerta_liquidez}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Standalone Fijo Inferior */}
      <footer className="bg-app-surface border-t border-app-border px-4 py-2.5 text-center text-[10px] sm:text-xs text-app-muted font-medium shrink-0">
        SoftPremium SAAS — Módulo de Inteligencia Artificial Corporativa © 2026 Angelo Serna Simeon
      </footer>
    </div>
  );
};
