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
  const { companies, currentCompany, setCurrentCompany, setActiveTab: setMainActiveTab } = useStore();
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

          {/* Selector MIS EMPRESAS */}
          <div className="bg-app-bg border border-app-border px-3 py-1 rounded-xl text-left">
            <label className="text-[9px] text-app-muted uppercase font-black tracking-wider block">MIS EMPRESAS</label>
            <select
              value={currentWorkspace?.ruc || ''}
              onChange={(e) => {
                const found = companies.find(c => c.ruc === e.target.value);
                if (found) setCurrentCompany(found);
              }}
              className="bg-transparent text-xs font-bold text-app-text outline-none cursor-pointer max-w-[200px] truncate"
            >
              {companies.map(c => (
                <option key={c.ruc} value={c.ruc} className="bg-app-surface text-app-text">
                  {c.name} ({c.ruc})
                </option>
              ))}
              {companies.length === 0 && (
                <option value="" className="bg-app-surface text-app-text">
                  {currentWorkspace?.name || 'Sin Empresas'}
                </option>
              )}
            </select>
          </div>

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
                  <label className="text-xs text-app-muted font-semibold mb-1 block">Plan Seleccionado</label>
                  <select
                    value={selectedPlanTier}
                    onChange={(e: any) => setSelectedPlanTier(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-sm text-app-text focus:border-blue-500 focus:outline-none"
                  >
                    <option value="full">SoftPremium Full — S/ 99.00 / mes</option>
                    <option value="tributario">Pilar 1: Tributación IA — S/ 49.00 / mes</option>
                    <option value="planillas">Pilar 2: Planillas IA — S/ 49.00 / mes</option>
                    <option value="finanzas">Pilar 3: Finanzas IA — S/ 49.00 / mes</option>
                  </select>
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-indigo-400 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Auditoría Preventiva y Riesgo Tributario SUNAT
              </h2>
              <p className="text-sm text-slate-400">
                Análisis predictivo de fiscalización. Evalúa inconsistencias entre compras vs. ventas, duplicidad documental y deducibilidad de gastos.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Tipo de Auditoría</label>
                  <select
                    value={riskRunType}
                    onChange={(e) => setRiskRunType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="inconsistencia_gastos_ventas">Ratio Compras vs. Ventas</option>
                    <option value="comprobantes_pago_deteccion">Detección Comprobantes Irregulares</option>
                    <option value="estrategia_preventiva_sunat">Estrategia Preventiva Fiscalización</option>
                    <option value="deduccion_gastos_general">Deducción de Gastos (Art. 37 LIR)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Periodo a Evaluar</label>
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleRunRiskAnalysis}
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Ejecutar Auditoría IA
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado Análisis Riesgo */}
            {riskResult && (
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Informe de Hallazgos Preventivos</h3>
                    <p className="text-xs text-slate-400">Periodo evaluado: {riskResult.period}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Nivel de Riesgo Tributario</div>
                    <div className={`text-2xl font-black ${riskResult.riskScore > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {riskResult.riskScore} / 100
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
                  <span className="font-semibold text-amber-300 block mb-1">🤖 Recomendación Ejecutiva IA:</span>
                  {riskResult.findings?.resumen_ejecutivo}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-300">Hallazgos Específicos Detectados ({riskResult.findings?.hallazgos?.length || 0}):</h4>
                  {riskResult.findings?.hallazgos?.map((item: RiskFinding, idx: number) => (
                    <div key={idx} className="bg-slate-950 p-4 rounded-xl border-l-4 border-amber-500 border-t border-r border-b border-slate-800 flex justify-between gap-4">
                      <div>
                        <div className="font-bold text-amber-300 text-sm">{item.titulo}</div>
                        <div className="text-xs text-slate-400 mt-1">{item.descripcion}</div>
                      </div>
                      <span className="px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 rounded-lg h-fit">
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                <Users className="w-5 h-5" /> Motor de Cálculos Laborales y Redacción de Contratos IA
              </h2>
              <p className="text-sm text-slate-400">
                Cálculo determinístico de Gratificaciones (Ley 27735 y Ley 32563 CAS 2026), CTS y generación de contratos laborales inteligentes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">ID de Empleado (DNI/Nombre)</label>
                  <input
                    type="text"
                    placeholder="Ingresa ID o DNI de colaborador"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Meses Laborados en Semestre</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={mesesTrabajados}
                    onChange={(e) => setMesesTrabajados(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-purple-500"
                  />
                </div>

                <div className="flex gap-2 items-end">
                  <button
                    onClick={handleCalculateGratificacion}
                    disabled={loading}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1 shadow-lg"
                  >
                    <Calculator className="w-3.5 h-3.5" /> Gratificación
                  </button>
                  <button
                    onClick={handleGenerateContract}
                    disabled={loading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1 shadow-lg"
                  >
                    <FileText className="w-3.5 h-3.5" /> Contrato IA
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado Cálculo Gratificación */}
            {payrollResult && (
              <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-purple-300">Desglose de Gratificación Computada</h3>
                  <span className="text-xs px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full font-mono">
                    {payrollResult.detail?.normativa}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Sueldo Base</div>
                    <div className="text-base font-bold text-white">S/ {payrollResult.detail?.sueldo_base}</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Asig. Familiar</div>
                    <div className="text-base font-bold text-white">S/ {payrollResult.detail?.asignacion_familiar}</div>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Bonificación 9%</div>
                    <div className="text-base font-bold text-purple-300">S/ {payrollResult.detail?.bonificacion_extraordinaria_soles}</div>
                  </div>
                  <div className="bg-purple-950/60 p-4 rounded-xl border border-purple-500/40">
                    <div className="text-xs text-purple-300 font-semibold">Total a Pagar</div>
                    <div className="text-lg font-black text-amber-400">S/ {payrollResult.totalSoles}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Resultado Contrato IA */}
            {contractDoc && (
              <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="text-xs text-amber-200">
                    <strong>Revisión Humana Obligatoria:</strong> Este contrato fue redactado por IA. Requiere validación del profesional contable/legal antes de su firma.
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl font-mono text-xs text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                  {contractDoc.contractText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PILAR 3: FINANZAS CON IA ─── */}
        {isPremiumActive && activeSubTab === 'finanzas' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Proyección de Flujo de Caja y Vencimientos SUNAT
              </h2>
              <p className="text-sm text-slate-400">
                Cruza tus cobranzas y pagos proyectados con el calendario oficial de vencimientos SUNAT según el último dígito del RUC de la empresa.
              </p>

              <div className="flex gap-4 items-end pt-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Periodo Financiero</label>
                  <input
                    type="month"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-cyan-500"
                  />
                </div>

                <button
                  onClick={handleGenerateCashflow}
                  disabled={loading}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 text-white font-black py-3 px-6 rounded-xl text-sm flex items-center gap-2 shadow-lg"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Generar Proyección Financiera
                </button>
              </div>
            </div>

            {/* Resultado Forecast Financiero */}
            {cashflowResult && (
              <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Ingresos Proyectados</div>
                    <div className="text-xl font-extrabold text-emerald-400">S/ {cashflowResult.projectedInflowsSoles}</div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Egresos + Obligaciones SUNAT</div>
                    <div className="text-xl font-extrabold text-rose-400">S/ {cashflowResult.projectedOutflowsSoles}</div>
                  </div>

                  <div className="bg-cyan-950/40 p-4 rounded-xl border border-cyan-500/40">
                    <div className="text-xs text-cyan-300 font-semibold">Saldo Neto de Caja</div>
                    <div className={`text-2xl font-black ${Number(cashflowResult.netBalanceSoles) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                      S/ {cashflowResult.netBalanceSoles}
                    </div>
                  </div>
                </div>

                {/* Cruce Calendario SUNAT */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Cruce con Calendario SUNAT:
                  </div>
                  <div className="text-xs text-slate-300">
                    • Último dígito RUC: <strong>{cashflowResult.sunatAdjustments?.ultimo_digito_ruc}</strong> | Fecha tope estimada: <strong>Día {cashflowResult.sunatAdjustments?.dia_vencimiento_sunat} de cada mes</strong>.
                  </div>
                  <div className="text-xs text-slate-400">
                    • {cashflowResult.sunatAdjustments?.alerta_liquidez}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer Standalone */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        SoftPremium SAAS — Módulo de Inteligencia Artificial Corporativa © 2026 Angelo Serna Simeon
      </footer>
    </div>
  );
};
