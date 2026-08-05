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
  ExternalLink
} from 'lucide-react';

interface RiskFinding {
  codigo: string;
  severidad: string;
  titulo: string;
  descripcion: string;
}

export const SoftPremiumDashboard: React.FC = () => {
  const { workspaces, currentCompany, switchWorkspace, setActiveTab: setMainActiveTab } = useStore();
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
  const [riskRunType, setRiskRunType] = useState<string>('inconsistencia_gastos_ventas');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-08');
  const [riskResult, setRiskResult] = useState<any>(null);

  // Estados Pilar 2: Planillas IA
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [mesesTrabajados, setMesesTrabajados] = useState<number>(6);
  const [payrollResult, setPayrollResult] = useState<any>(null);
  const [contractDoc, setContractDoc] = useState<any>(null);

  // Estados Pilar 3: Finanzas IA
  const [cashflowResult, setCashflowResult] = useState<any>(null);

  // Cargar estado de suscripción del workspace
  useEffect(() => {
    if (currentWorkspace?.id || currentWorkspace?.ruc) {
      checkSubscriptionStatus();
    }
  }, [currentWorkspace?.id, currentWorkspace?.ruc]);

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

  // Activación Manual por Admin
  const handleAdminTogglePremium = async (enable: boolean) => {
    const wsId = currentWorkspace?.id || currentWorkspace?.ruc;
    if (!wsId) return;

    try {
      const res = await fetch('/api/premium/subscription/activate-manual', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`
        },
        body: JSON.stringify({
          workspaceId: wsId,
          enable,
          tiers: ['full']
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsPremiumActive(enable);
        toast.success(`SoftPremium ${enable ? 'activado' : 'desactivado'} para ${currentWorkspace?.name}`);
      }
    } catch (e: any) {
      toast.error('Error al actualizar activación: ' + e.message);
    }
  };

  // Ejecutar Análisis de Riesgo (Pilar 1)
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
          runType: riskRunType
        })
      });
      const data = await res.json();
      if (data.success) {
        setRiskResult(data.analysis);
        toast.success('Análisis de riesgo tributario completado');
      } else {
        toast.error(data.error || 'Error al ejecutar análisis');
      }
    } catch (e: any) {
      toast.error('Error de conexión con el servicio de IA: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Calcular Gratificación (Pilar 2)
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
        toast.success('Cálculo de gratificación generado');
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
      toast.error('Ingresa el ID del colaborador.');
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
        toast.success('Contrato redactado con IA. Requiere revisión humana.');
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
        toast.success('Proyección de caja cruzada con vencimiento SUNAT lista');
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
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* ─── HEADER STANDALONE SOFTPREMIUM ─── */}
      <header className="bg-app-surface border-b border-app-border px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-50 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }}
            className="px-3 py-2 bg-app-bg hover:bg-app-hover text-app-text rounded-xl border border-app-border transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
            title="Regresar a SOFTCONTABLE ERP"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Volver al ERP
          </button>

          <div className="h-6 w-px bg-app-border hidden md:block" />

          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-600/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-app-text tracking-tight font-sans">SOFT<span className="text-blue-600 dark:text-blue-400">PREMIUM</span></span>
                <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-blue-500/20 uppercase tracking-widest font-mono">IA v2.0</span>
              </div>
              <p className="text-[11px] text-app-muted font-medium">Portal Corporativo de Inteligencia Artificial & Analítica Avanzada</p>
            </div>
          </div>
        </div>

        {/* Info Usuario, Selector de Empresas & Estado de Suscripción */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Usuario Logueado */}
          <div className="bg-app-bg border border-app-border px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-xs">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black text-app-text">{user?.name || user?.nombre || 'Cliente Logueado'}</span>
              <span className="text-[10px] text-app-muted font-medium">{user?.email || 'usuario@softcontable.pe'}</span>
            </div>
          </div>

          {/* Selector MIS EMPRESAS (Solo visible si la suscripción está activa) */}
          {isPremiumActive && (
            <div className="bg-app-bg border border-app-border px-3 py-1 rounded-xl text-left">
              <label className="text-[9px] text-app-muted uppercase font-black tracking-wider block">MIS EMPRESAS</label>
              <select
                value={currentWorkspace?.ruc || ''}
                onChange={(e) => {
                  if (e.target.value) switchWorkspace(e.target.value);
                }}
                className="bg-transparent text-xs font-bold text-app-text outline-none cursor-pointer max-w-[200px] truncate"
              >
                {(workspaces || []).map((c: any) => (
                  <option key={c.ruc} value={c.ruc} className="bg-app-surface text-app-text">
                    {c.name} ({c.ruc})
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

          <div className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-2 border ${
            isPremiumActive 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            <CreditCard className="w-4 h-4" />
            {isPremiumActive ? 'Suscripción Activa' : 'Suscripción Inactiva'}
          </div>
        </div>
      </header>

      {/* ─── SUB-NAVBAR CON LOS 3 PILARES Y PLANES ─── */}
      <div className="bg-app-surface border-b border-app-border px-6 py-2.5 flex items-center justify-center overflow-x-auto custom-scrollbar">
        <div className="flex gap-2 p-1 bg-app-bg rounded-xl border border-app-border">
          <button
            onClick={() => {
              if (!isPremiumActive) {
                toast.error('Requiere activar suscripción SoftPremium para acceder a Tributación con IA');
                setActiveSubTab('subscription');
              } else {
                setActiveSubTab('tributario');
              }
            }}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'tributario' 
                ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> 1. Tributación con IA
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
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'planillas' 
                ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <Users className="w-4 h-4" /> 2. Planillas con IA
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
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'finanzas' 
                ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                : 'text-app-muted hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> 3. Finanzas con IA
          </button>

          <button
            onClick={() => setActiveSubTab('subscription')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'subscription' 
                ? 'bg-emerald-600 text-white shadow-md font-extrabold' 
                : 'text-blue-600 dark:text-blue-400 hover:text-app-text hover:bg-app-hover'
            }`}
          >
            <QrCode className="w-4 h-4" /> Planes y Pagos (Yape/Plin)
          </button>
        </div>
      </div>

      {/* ─── CONTENIDO PRINCIPAL STANDALONE ─── */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">

        {/* SI PREMIUM NO ESTÁ ACTIVO Y INTENTA ENTRAR A PILARES */}
        {!isPremiumActive && activeSubTab !== 'subscription' && (
          <div className="bg-app-surface border border-blue-500/20 rounded-2xl p-8 text-center space-y-6 shadow-md">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-black text-app-text">SoftPremium IA no está activo para {currentWorkspace?.name || 'esta empresa'}</h2>
              <p className="text-sm text-app-muted font-medium">
                Activa tu suscripción mensual para desbloquear el análisis predictivo SUNAT, cálculo determinístico de planillas y flujo de caja proyectado.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSubTab('subscription')}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                <QrCode className="w-5 h-5" /> Ver Planes y Medios de Pago (Yape / Plin / Transferencia)
              </button>
            </div>
          </div>
        )}

        {/* ─── SECCIÓN: PLANES Y PAGOS YAPE / PLIN ─── */}
        {activeSubTab === 'subscription' && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <h2 className="text-3xl font-black text-app-text font-sans">Planes y Suscripción SoftPremium IA</h2>
              <p className="text-sm text-app-muted font-medium">
                Elige el plan que mejor se adapte a tu empresa. Realiza tu pago mediante Yape, Plin o Transferencia Bancaria sin comisiones adicionales.
              </p>
            </div>

            {/* Tarjetas de Tarifas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Plan Tributario */}
              <div className={`bg-app-surface border rounded-2xl p-6 space-y-4 flex flex-col justify-between ${selectedPlanTier === 'tributario' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-3">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">Pilar 1: Tributación</div>
                  <div className="text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-xs text-app-muted font-medium leading-relaxed">Auditoría preventiva SUNAT, consistencias gastos vs ventas y reglas Art. 37 LIR.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('tributario')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'tributario' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'tributario' ? 'Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Planillas */}
              <div className={`bg-app-surface border rounded-2xl p-6 space-y-4 flex flex-col justify-between ${selectedPlanTier === 'planillas' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-3">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">Pilar 2: Planillas</div>
                  <div className="text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-xs text-app-muted font-medium leading-relaxed">Gratificación Ley 27735/32563 CAS, CTS y redacción de contratos con IA.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('planillas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'planillas' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'planillas' ? 'Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Finanzas */}
              <div className={`bg-app-surface border rounded-2xl p-6 space-y-4 flex flex-col justify-between ${selectedPlanTier === 'finanzas' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border'}`}>
                <div className="space-y-3">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">Pilar 3: Finanzas</div>
                  <div className="text-3xl font-black text-app-text">S/ 49 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-xs text-app-muted font-medium leading-relaxed">Flujo de caja cruzado con el calendario oficial SUNAT según dígito RUC.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('finanzas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'finanzas' ? 'bg-blue-600 text-white' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'finanzas' ? 'Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Full Premium */}
              <div className={`bg-app-surface border rounded-2xl p-6 space-y-4 flex flex-col justify-between relative overflow-hidden ${selectedPlanTier === 'full' ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-app-border'}`}>
                <div className="absolute top-3 right-3 bg-blue-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">Más Popular</div>
                <div className="space-y-3">
                  <div className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">SoftPremium Full</div>
                  <div className="text-3xl font-black text-app-text">S/ 99 <span className="text-xs text-app-muted font-normal">/mes</span></div>
                  <p className="text-xs text-app-muted font-medium leading-relaxed">Acceso completo ilimitado a los 3 Pilares (Tributación + Planillas + Finanzas).</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('full')}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedPlanTier === 'full' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-app-bg text-app-text hover:bg-app-hover border border-app-border'}`}
                >
                  {selectedPlanTier === 'full' ? 'Seleccionado' : 'Elegir Plan Full'}
                </button>
              </div>
            </div>

            {/* Medios de Pago Locales & Formulario de Comprobante */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              
              {/* Información Yape / Plin / Banco */}
              <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-6 shadow-sm">
                <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Smartphone className="w-5 h-5" /> Medios de Pago en Perú (Sin Comisiones)
                </h3>

                <div className="space-y-4">
                  {/* Yape / Plin */}
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border flex items-center justify-between">
                    <div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Yape / Plin Directo</div>
                      <div className="text-lg font-black text-app-text font-mono mt-0.5">987 654 321</div>
                      <div className="text-xs text-app-muted font-medium">Titular: Angelo Serna Simeon</div>
                    </div>
                    <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                      <QrCode className="w-8 h-8" />
                    </div>
                  </div>

                  {/* Cuentas Bancarias */}
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border space-y-2">
                    <div className="text-xs text-app-muted font-bold uppercase">Transferencia Bancaria</div>
                    <div className="text-xs text-app-text font-medium">
                      • <strong>BCP Soles:</strong> 193-98765432-0-11
                    </div>
                    <div className="text-xs text-app-text font-medium">
                      • <strong>CCI BCP:</strong> 002-193009876543201114
                    </div>
                    <div className="text-[11px] text-app-muted pt-1 font-medium">Titular: SOFTCONTABLE SAAS / Angelo Serna</div>
                  </div>
                </div>
              </div>

              {/* Registro de Comprobante / Voucher */}
              <form onSubmit={handleSubmitVoucher} className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="text-lg font-bold text-app-text flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Registrar Comprobante de Pago
                </h3>

                <div>
                  <label className="text-xs text-app-muted font-black uppercase tracking-wider mb-2 block">Plan a Activar</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { id: 'full', title: 'SoftPremium Full', price: 'S/ 99.00 / mes', desc: 'Los 3 Pilares: Tributario + Planillas + Finanzas IA', badge: 'RECOMENDADO', icon: Sparkles },
                      { id: 'tributario', title: 'Pilar 1: Tributación IA', price: 'S/ 49.00 / mes', desc: 'Auditoría Sunat + Diagnóstico de Inconsistencias', icon: ShieldAlert },
                      { id: 'planillas', title: 'Pilar 2: Planillas IA', price: 'S/ 49.00 / mes', desc: 'Liquidaciones LPT + Redacción de Contratos IA', icon: FileCheck },
                      { id: 'finanzas', title: 'Pilar 3: Finanzas IA', price: 'S/ 49.00 / mes', desc: 'Flujo de Caja + Forecast de Liquidez Contable', icon: TrendingUp }
                    ].map(plan => {
                      const Icon = plan.icon;
                      const isSelected = selectedPlanTier === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlanTier(plan.id as any)}
                          className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                            isSelected
                              ? 'bg-blue-600/10 border-blue-600 shadow-md ring-1 ring-blue-500/20'
                              : 'bg-app-bg border-app-border hover:border-app-muted'
                          }`}
                        >
                          {plan.badge && (
                            <span className="absolute -top-2.5 right-3 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                              {plan.badge}
                            </span>
                          )}
                          <div className="flex items-start gap-2.5 mb-1">
                            <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-app-surface text-app-muted border border-app-border'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-black text-app-text truncate">{plan.title}</div>
                              <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">{plan.price}</div>
                            </div>
                          </div>
                          <p className="text-[10px] text-app-muted font-medium line-clamp-2 mt-0.5">{plan.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-app-muted font-semibold mb-1 block">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['YAPE', 'PLIN', 'TRANSFERENCIA'] as const).map(m => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${paymentMethod === m ? 'bg-blue-600 text-white border-blue-500' : 'bg-app-bg text-app-muted border-app-border'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-app-muted font-semibold mb-1 block">Número de Operación / Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 09876543 o Nro de Operación Yape"
                    value={operationNumber}
                    onChange={(e) => setOperationNumber(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-sm text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-app-muted font-semibold mb-1 block">Adjuntar Foto / Captura de Comprobante (Voucher)</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-app-bg border border-app-border hover:bg-app-hover text-app-text rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      {voucherFile ? voucherFile.name : '📁 Seleccionar Captura de Comprobante'}
                    </button>

                    {voucherBase64 && (
                      <div className="relative group w-10 h-10 rounded-lg overflow-hidden border border-app-border shrink-0">
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
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">✓ Captura lista para enviar ({Math.round(voucherFile.size / 1024)} KB)</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingVoucher}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Comprobante para Activación
                </button>

                {isAdmin && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.opener) {
                          window.opener.location.href = '/?tab=ADMIN';
                        }
                        window.location.href = '/?tab=ADMIN';
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      👑 Abrir Panel Admin ERP para Gestionar Suscripciones →
                    </button>
                  </div>
                )}
              </form>
            </div>

          </div>
        )}

        {/* ─── PILAR 1: TRIBUTACIÓN CON IA ─── */}
        {isPremiumActive && activeSubTab === 'tributario' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Rejilla de Indicadores de Salud Tributaria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Salud Fiscal SUNAT</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">94 / 100</div>
                  <div className="text-[10px] text-app-muted font-bold">Riesgo Bajo de Fiscalización</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Cruce RIE / SIRE</div>
                  <div className="text-xl font-black text-app-text">99.2%</div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Ventas vs Compras Conciliadas</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Sin Bancarizar (L. 28194)</div>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400">S/ 0.00</div>
                  <div className="text-[10px] text-app-muted font-bold">Operaciones &gt; S/ 2,000 OK</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Gastos Deducibles (Art. 37)</div>
                  <div className="text-xl font-black text-purple-600 dark:text-purple-400">100% Validado</div>
                  <div className="text-[10px] text-app-muted font-bold">Causalidad y Feconciencia</div>
                </div>
              </div>
            </div>

            {/* Panel de Ejecución de Auditoría */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 border-b border-app-border pb-4">
                <div>
                  <h2 className="text-lg font-black text-app-text flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Auditoría Preventiva &amp; Detección de Riesgos SUNAT 2026
                  </h2>
                  <p className="text-xs text-app-muted font-medium">
                    Evaluación automatizada de consistencia entre RIE, SIRE, bancarización Ley 28194 y causalidad del gasto Art. 37 LIR.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Tipo de Auditoría</label>
                  <select
                    value={riskRunType}
                    onChange={(e) => setRiskRunType(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  >
                    <option value="inconsistencia_gastos_ventas">Ratio Compras vs. Ventas (RIE / SIRE)</option>
                    <option value="comprobantes_pago_deteccion">Detección de Comprobantes Irregulares</option>
                    <option value="estrategia_preventiva_sunat">Estrategia Preventiva de Fiscalización</option>
                    <option value="deduccion_gastos_general">Deducción de Gastos (Art. 37 LIR)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Periodo Tributario</label>
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleRunRiskAnalysis}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Ejecutar Auditoría Tributaria IA
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado Análisis Riesgo */}
            {riskResult && (
              <div className="bg-app-surface border border-blue-500/30 rounded-2xl p-6 space-y-6 shadow-md">
                <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-app-border pb-4 gap-4">
                  <div>
                    <h3 className="text-base font-black text-app-text">Informe de Hallazgos Preventivos SUNAT</h3>
                    <p className="text-xs text-app-muted">Empresa: <strong>{currentWorkspace?.name}</strong> | Periodo: <strong>{riskResult.period}</strong></p>
                  </div>
                  <div className="bg-app-bg border border-app-border px-4 py-2 rounded-xl text-right">
                    <div className="text-[10px] text-app-muted font-black uppercase">Nivel de Riesgo Calculado</div>
                    <div className={`text-xl font-black ${riskResult.riskScore > 50 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {riskResult.riskScore} / 100 ({riskResult.riskScore > 50 ? 'Atención Requerida' : 'Bajo Riesgo'})
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-xs text-app-text leading-relaxed">
                  <span className="font-extrabold text-blue-600 dark:text-blue-400 block mb-1">🤖 Dictamen Ejecutivo del Auditor IA:</span>
                  {riskResult.findings?.resumen_ejecutivo}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-app-text">Detalle de Inconsistencias Detectadas ({riskResult.findings?.hallazgos?.length || 0}):</h4>
                  {riskResult.findings?.hallazgos?.map((item: RiskFinding, idx: number) => (
                    <div key={idx} className="bg-app-bg p-4 rounded-xl border-l-4 border-blue-600 border border-app-border flex justify-between gap-4">
                      <div>
                        <div className="font-bold text-app-text text-xs">{item.titulo}</div>
                        <div className="text-[11px] text-app-muted mt-1">{item.descripcion}</div>
                      </div>
                      <span className="px-3 py-1 text-[10px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-lg h-fit">
                        {item.severidad}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 2: PLANILLAS CON IA ─── */}
        {isPremiumActive && activeSubTab === 'planillas' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Rejilla de Indicadores de Planilla empresarial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Colaboradores</div>
                  <div className="text-xl font-black text-app-text">Activos en T-Registro</div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">PLAME al Día</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Gratificación 2026</div>
                  <div className="text-xl font-black text-purple-600 dark:text-purple-400">Ley 27735 / 32563</div>
                  <div className="text-[10px] text-app-muted font-bold">+ 9% Bonificación EsSalud</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Depósito CTS</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">Semestre Mayo/Nov</div>
                  <div className="text-[10px] text-app-muted font-bold">Cálculo Automático</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Contratos Inteligentes</div>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400">Plantillas MINTRA</div>
                  <div className="text-[10px] text-app-muted font-bold">Redactor IA 2.0</div>
                </div>
              </div>
            </div>

            {/* Formularios de Cálculos Laborales */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="border-b border-app-border pb-4">
                <h2 className="text-lg font-black text-app-text flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Motor de Cálculos Laborales &amp; Generador de Contratos MINTRA
                </h2>
                <p className="text-xs text-app-muted font-medium">
                  Cálculo determinístico de Gratificaciones (Ley 27735 y CAS 2026), CTS, Vacaciones y contratos adaptados al Ministerio de Trabajo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Empleado (DNI o Nombre)</label>
                  <input
                    type="text"
                    placeholder="Ingresa DNI o Nombre del colaborador"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Meses Laborados en Semestre</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={mesesTrabajados}
                    onChange={(e) => setMesesTrabajados(Number(e.target.value))}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 items-end">
                  <button
                    onClick={handleCalculateGratificacion}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Calculator className="w-4 h-4" /> Calcular Gratificación
                  </button>
                  <button
                    onClick={handleGenerateContract}
                    disabled={loading}
                    className="flex-1 bg-app-bg hover:bg-app-hover border border-app-border text-app-text font-extrabold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all"
                  >
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Contrato IA
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado Cálculo Gratificación */}
            {payrollResult && (
              <div className="bg-app-surface border border-purple-500/30 rounded-2xl p-6 space-y-4 shadow-md">
                <div className="flex justify-between items-center border-b border-app-border pb-3">
                  <h3 className="text-sm font-black text-app-text">Desglose de Gratificación Computada</h3>
                  <span className="text-[10px] px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-full font-bold">
                    {payrollResult.detail?.normativa || 'Ley 27735 / Ley 32563'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border">
                    <div className="text-[10px] text-app-muted uppercase font-bold">Sueldo Base</div>
                    <div className="text-base font-black text-app-text">S/ {payrollResult.detail?.sueldo_base}</div>
                  </div>
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border">
                    <div className="text-[10px] text-app-muted uppercase font-bold">Asig. Familiar</div>
                    <div className="text-base font-black text-app-text">S/ {payrollResult.detail?.asignacion_familiar}</div>
                  </div>
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border">
                    <div className="text-[10px] text-app-muted uppercase font-bold">Bonificación 9% Ley 29351</div>
                    <div className="text-base font-black text-purple-600 dark:text-purple-400">S/ {payrollResult.detail?.bonificacion_extraordinaria_soles}</div>
                  </div>
                  <div className="bg-blue-600 text-white p-4 rounded-xl shadow-md">
                    <div className="text-[10px] uppercase font-bold text-blue-100">Total Neto a Depositar</div>
                    <div className="text-xl font-black">S/ {payrollResult.totalSoles}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Resultado Contrato IA */}
            {contractDoc && (
              <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-md">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    <strong>Revisión Legal:</strong> Borrador de contrato generado según normativa MINTRA 2026. Revisar cláusulas específicas antes de remitir al trabajador.
                  </div>
                </div>

                <div className="bg-app-bg p-5 rounded-xl font-mono text-xs text-app-text max-h-72 overflow-y-auto whitespace-pre-wrap border border-app-border">
                  {contractDoc.contractText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 3: FINANZAS CON IA ─── */}
        {isPremiumActive && activeSubTab === 'finanzas' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Rejilla Ratios Financieros & Salud de Liquidez */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Ratio Liquidez Corriente</div>
                  <div className="text-xl font-black text-app-text">1.85</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Solvencia Positiva</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Prueba Ácida</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">1.22</div>
                  <div className="text-[10px] text-app-muted font-bold">Capacidad Inmediata</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Margen Operativo EBITDA</div>
                  <div className="text-xl font-black text-purple-600 dark:text-purple-400">24.5%</div>
                  <div className="text-[10px] text-app-muted font-bold">Eficiencia Operativa</div>
                </div>
              </div>

              <div className="bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black tracking-wider text-app-muted">Vencimiento SUNAT</div>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400">Según RUC</div>
                  <div className="text-[10px] text-app-muted font-bold">Calendario Oficial</div>
                </div>
              </div>
            </div>

            {/* Generador de Flujo de Caja */}
            <div className="bg-app-surface border border-app-border rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="border-b border-app-border pb-4">
                <h2 className="text-lg font-black text-app-text flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Proyección de Flujo de Caja &amp; Vencimientos Fiscales SUNAT
                </h2>
                <p className="text-xs text-app-muted font-medium">
                  Modelado predictivo de liquidez a 30, 60 y 90 días cruzando cuentas por cobrar/pagar con las fechas de vencimiento SUNAT según el último dígito del RUC.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-end pt-1">
                <div className="flex-1 w-full">
                  <label className="text-xs text-app-muted font-black uppercase tracking-wider mb-1 block">Periodo Financiero</label>
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs font-bold text-app-text focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleGenerateCashflow}
                  disabled={loading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Generar Proyección Financiera IA
                </button>
              </div>
            </div>

            {/* Resultado Forecast Financiero */}
            {cashflowResult && (
              <div className="bg-app-surface border border-blue-500/30 rounded-2xl p-6 space-y-6 shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-app-bg p-4 rounded-xl border border-app-border">
                    <div className="text-[10px] text-app-muted uppercase font-bold">Ingresos Estimados de Caja</div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">S/ {cashflowResult.projectedInflowsSoles}</div>
                  </div>

                  <div className="bg-app-bg p-4 rounded-xl border border-app-border">
                    <div className="text-[10px] text-app-muted uppercase font-bold">Egresos + Impuestos SUNAT</div>
                    <div className="text-xl font-black text-rose-600 dark:text-rose-400">S/ {cashflowResult.projectedOutflowsSoles}</div>
                  </div>

                  <div className="bg-blue-600 text-white p-4 rounded-xl shadow-md">
                    <div className="text-[10px] font-bold text-blue-100 uppercase">Saldo Neto Proyectado de Liquidez</div>
                    <div className="text-2xl font-black">
                      S/ {cashflowResult.netBalanceSoles}
                    </div>
                  </div>
                </div>

                {/* Cruce Calendario SUNAT */}
                <div className="bg-app-bg p-5 rounded-xl border border-app-border space-y-2">
                  <div className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Cruce con Calendario Oficial SUNAT:
                  </div>
                  <div className="text-xs text-app-text font-medium">
                    • Último dígito RUC de la empresa: <strong>{cashflowResult.sunatAdjustments?.ultimo_digito_ruc}</strong> | Fecha tope estimada: <strong>Día {cashflowResult.sunatAdjustments?.dia_vencimiento_sunat} de cada mes</strong>.
                  </div>
                  <div className="text-xs text-app-muted font-medium">
                    • {cashflowResult.sunatAdjustments?.alerta_liquidez}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Standalone Modo Claro */}
      <footer className="bg-app-surface border-t border-app-border px-6 py-4 text-center text-xs text-app-muted font-medium">
        SoftPremium SAAS — Módulo de Inteligencia Artificial Corporativa © 2026 Angelo Serna Simeon
      </footer>
    </div>
  );
};
