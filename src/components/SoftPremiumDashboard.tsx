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
  const { currentCompany, setActiveTab: setMainActiveTab } = useStore();
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

  // Formulario Yape / Plin / Transferencia
  const [selectedPlanTier, setSelectedPlanTier] = useState<'tributario' | 'planillas' | 'finanzas' | 'full'>('full');
  const [paymentMethod, setPaymentMethod] = useState<'YAPE' | 'PLIN' | 'TRANSFERENCIA'>('YAPE');
  const [operationNumber, setOperationNumber] = useState<string>('');
  const [submittingVoucher, setSubmittingVoucher] = useState<boolean>(false);

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
        toast.success('¡Comprobante enviado! Un administrador verificará y activará tu suscripción.');
        setOperationNumber('');
      } else {
        toast.error(data.error || 'Error al registrar comprobante.');
      }
    } catch (err: any) {
      toast.error('Error enviando datos: ' + err.message);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      
      {/* ─── HEADER STANDALONE SOFTPREMIUM ─── */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-50 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
            title="Regresar a SOFTCONTABLE ERP"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" /> Volver al ERP
          </button>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white tracking-tight font-sans">SOFT<span className="text-indigo-400">PREMIUM</span></span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-500/30 uppercase tracking-widest font-mono">IA v2.0</span>
              </div>
              <p className="text-[11px] text-slate-400">Portal Corporativo de Inteligencia Artificial & Analítica Avanzada</p>
            </div>
          </div>
        </div>

        {/* Info Empresa & Navegación */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-xl text-right">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Empresa Activa</div>
            <div className="text-xs font-bold text-white truncate max-w-[200px]">{currentWorkspace?.name || 'No seleccionada'}</div>
            <div className="text-[10px] text-indigo-400 font-mono">RUC: {currentWorkspace?.ruc || '—'}</div>
          </div>

          <button
            onClick={() => setActiveSubTab('subscription')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border cursor-pointer ${
              isPremiumActive 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                : 'bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 font-extrabold shadow-md shadow-indigo-600/20'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {isPremiumActive ? 'Suscripción Activa' : 'Activar SoftPremium IA'}
          </button>
        </div>
      </header>

      {/* ─── SUB-NAVBAR CON LOS 3 PILARES Y PLANES ─── */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center justify-center overflow-x-auto custom-scrollbar">
        <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
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
                ? 'bg-indigo-600 text-white shadow-md font-extrabold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
                ? 'bg-indigo-600 text-white shadow-md font-extrabold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
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
                ? 'bg-indigo-600 text-white shadow-md font-extrabold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> 3. Finanzas con IA
          </button>

          <button
            onClick={() => setActiveSubTab('subscription')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'subscription' 
                ? 'bg-emerald-600 text-white shadow-md font-extrabold' 
                : 'text-indigo-400 hover:text-white hover:bg-slate-900'
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
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-8 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-500/20">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <h2 className="text-2xl font-black text-white">SoftPremium IA no está activo para {currentWorkspace?.name || 'esta empresa'}</h2>
              <p className="text-sm text-slate-300">
                Activa tu suscripción mensual para desbloquear el análisis predictivo SUNAT, cálculo determinístico de planillas y flujo de caja proyectado.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setActiveSubTab('subscription')}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
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
              <h2 className="text-3xl font-black text-white font-sans">Planes y Suscripción SoftPremium IA</h2>
              <p className="text-sm text-slate-400">
                Elige el plan que mejor se adapte a tu empresa. Realiza tu pago mediante Yape, Plin o Transferencia Bancaria sin comisiones adicionales.
              </p>
            </div>

            {/* Tarjetas de Tarifas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Plan Tributario */}
              <div className={`bg-slate-900 border rounded-2xl p-6 space-y-4 flex flex-col justify-between ${selectedPlanTier === 'tributario' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800'}`}>
                <div className="space-y-3">
                  <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider">Pilar 1: Tributación</div>
                  <div className="text-3xl font-black text-white">S/ 49 <span className="text-xs text-slate-400 font-normal">/mes</span></div>
                  <p className="text-xs text-slate-400 leading-relaxed">Auditoría preventiva SUNAT, consistencias gastos vs ventas y reglas Art. 37 LIR.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('tributario')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'tributario' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {selectedPlanTier === 'tributario' ? 'Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Planillas */}
              <div className={`bg-slate-900 border rounded-2xl p-6 space-y-4 flex flex-col justify-between ${selectedPlanTier === 'planillas' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800'}`}>
                <div className="space-y-3">
                  <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider">Pilar 2: Planillas</div>
                  <div className="text-3xl font-black text-white">S/ 49 <span className="text-xs text-slate-400 font-normal">/mes</span></div>
                  <p className="text-xs text-slate-400 leading-relaxed">Gratificación Ley 27735/32563 CAS, CTS y redacción de contratos con IA.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('planillas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'planillas' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {selectedPlanTier === 'planillas' ? 'Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Finanzas */}
              <div className={`bg-slate-900 border rounded-2xl p-6 space-y-4 flex flex-col justify-between ${selectedPlanTier === 'finanzas' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800'}`}>
                <div className="space-y-3">
                  <div className="text-indigo-400 font-bold text-xs uppercase tracking-wider">Pilar 3: Finanzas</div>
                  <div className="text-3xl font-black text-white">S/ 49 <span className="text-xs text-slate-400 font-normal">/mes</span></div>
                  <p className="text-xs text-slate-400 leading-relaxed">Flujo de caja cruzado con el calendario oficial SUNAT según dígito RUC.</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('finanzas')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedPlanTier === 'finanzas' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {selectedPlanTier === 'finanzas' ? 'Seleccionado' : 'Elegir Plan'}
                </button>
              </div>

              {/* Plan Full Premium */}
              <div className={`bg-slate-900 border rounded-2xl p-6 space-y-4 flex flex-col justify-between relative overflow-hidden ${selectedPlanTier === 'full' ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-slate-800'}`}>
                <div className="absolute top-3 right-3 bg-indigo-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider">Más Popular</div>
                <div className="space-y-3">
                  <div className="text-indigo-300 font-bold text-xs uppercase tracking-wider">SoftPremium Full</div>
                  <div className="text-3xl font-black text-white">S/ 99 <span className="text-xs text-slate-400 font-normal">/mes</span></div>
                  <p className="text-xs text-slate-300 leading-relaxed">Acceso completo ilimitado a los 3 Pilares (Tributación + Planillas + Finanzas).</p>
                </div>
                <button
                  onClick={() => setSelectedPlanTier('full')}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${selectedPlanTier === 'full' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {selectedPlanTier === 'full' ? 'Seleccionado' : 'Elegir Plan Full'}
                </button>
              </div>
            </div>

            {/* Medios de Pago Locales & Formulario de Comprobante */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              
              {/* Información Yape / Plin / Banco */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                  <Smartphone className="w-5 h-5" /> Medios de Pago en Perú (Sin Comisiones)
                </h3>

                <div className="space-y-4">
                  {/* Yape / Plin */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Yape / Plin Directo</div>
                      <div className="text-lg font-black text-white font-mono mt-0.5">987 654 321</div>
                      <div className="text-xs text-slate-400">Titular: Angelo Serna Simeon</div>
                    </div>
                    <div className="p-2 bg-purple-600/20 text-purple-300 rounded-lg">
                      <QrCode className="w-8 h-8" />
                    </div>
                  </div>

                  {/* Cuentas Bancarias */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs text-slate-400 font-bold uppercase">Transferencia Bancaria</div>
                    <div className="text-xs text-slate-300">
                      • <strong>BCP Soles:</strong> 193-98765432-0-11
                    </div>
                    <div className="text-xs text-slate-300">
                      • <strong>CCI BCP:</strong> 002-193009876543201114
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1">Titular: SOFTCONTABLE SAAS / Angelo Serna</div>
                  </div>
                </div>
              </div>

              {/* Registro de Comprobante / Voucher */}
              <form onSubmit={handleSubmitVoucher} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-400" /> Registrar Comprobante de Pago
                </h3>

                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Plan Seleccionado</label>
                  <select
                    value={selectedPlanTier}
                    onChange={(e: any) => setSelectedPlanTier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="full">SoftPremium Full — S/ 99.00 / mes</option>
                    <option value="tributario">Pilar 1: Tributación IA — S/ 49.00 / mes</option>
                    <option value="planillas">Pilar 2: Planillas IA — S/ 49.00 / mes</option>
                    <option value="finanzas">Pilar 3: Finanzas IA — S/ 49.00 / mes</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['YAPE', 'PLIN', 'TRANSFERENCIA'] as const).map(m => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${paymentMethod === m ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Número de Operación / Referencia</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 09876543 o Nro de Operación Yape"
                    value={operationNumber}
                    onChange={(e) => setOperationNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingVoucher}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submittingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Comprobante para Activación
                </button>
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
