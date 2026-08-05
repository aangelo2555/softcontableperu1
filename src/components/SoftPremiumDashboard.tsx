import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { apiBridge } from '../services/apiBridge';
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
  BookOpen
} from 'lucide-react';

interface RiskFinding {
  codigo: string;
  severidad: string;
  titulo: string;
  descripcion: string;
}

export const SoftPremiumDashboard: React.FC = () => {
  const { currentWorkspace, user } = useStore();
  const [activeTab, setActiveTab] = useState<'tributario' | 'planillas' | 'finanzas' | 'subscription'>('tributario');
  const [isPremiumActive, setIsPremiumActive] = useState<boolean>(true);
  const [premiumTiers, setPremiumTiers] = useState<string[]>(['full']);
  const [loading, setLoading] = useState<boolean>(false);

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
    if (currentWorkspace?.id) {
      checkSubscriptionStatus();
    }
  }, [currentWorkspace?.id]);

  const checkSubscriptionStatus = async () => {
    try {
      const res = await fetch(`/api/premium/subscription/status?workspaceId=${currentWorkspace?.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setIsPremiumActive(data.premium_enabled || user?.role === 'admin');
        setPremiumTiers(data.premium_tiers || ['full']);
      }
    } catch (e) {
      console.warn('Uso predeterminado de Premium para Admin/Dev');
    }
  };

  // Ejecutar Análisis de Riesgo (Pilar 1)
  const handleRunRiskAnalysis = async () => {
    if (!currentWorkspace?.id) {
      toast.error('Selecciona una empresa primero.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/tributario/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-Id': currentWorkspace.id
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
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
    if (!currentWorkspace?.id || !selectedEmployeeId) {
      toast.error('Selecciona un empleado de tu empresa.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/planillas/gratificacion', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-Id': currentWorkspace.id
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
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

  // Generar Contrato de Trabajo con IA (Pilar 2)
  const handleGenerateContract = async () => {
    if (!currentWorkspace?.id || !selectedEmployeeId) {
      toast.error('Selecciona un empleado.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/planillas/contrato', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-Id': currentWorkspace.id
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
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

  // Generar Proyección de Flujo de Caja (Pilar 3)
  const handleGenerateCashflow = async () => {
    if (!currentWorkspace?.id) {
      toast.error('Selecciona una empresa.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/premium/finanzas/forecast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-Id': currentWorkspace.id
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
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
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header SoftPremium */}
      <div className="bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-700 rounded-2xl p-6 shadow-xl border border-amber-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Módulo IA Premium
            </span>
            <span className="text-xs text-purple-200">v2.0.0</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-1 tracking-tight">SoftPremium SAAS</h1>
          <p className="text-purple-100 text-sm mt-1 max-w-2xl">
            Inteligencia Artificial avanzada para Tributación, Planillas y Finanzas Corporativas en Perú.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-purple-200">Empresa Actual</div>
            <div className="text-sm font-semibold text-white">{currentWorkspace?.name || 'No seleccionada'}</div>
            <div className="text-xs text-amber-300 font-mono">RUC: {currentWorkspace?.ruc || '—'}</div>
          </div>
        </div>
      </div>

      {/* Selector de Pilares */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('tributario')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'tributario' 
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-lg' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> 1. Tributación con IA
        </button>

        <button
          onClick={() => setActiveTab('planillas')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'planillas' 
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold shadow-lg' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" /> 2. Planillas con IA
        </button>

        <button
          onClick={() => setActiveTab('finanzas')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'finanzas' 
              ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold shadow-lg' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> 3. Finanzas con IA
        </button>
      </div>

      {/* ─── PILAR 1: TRIBUTACIÓN CON IA ─── */}
      {activeTab === 'tributario' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-amber-500"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-amber-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunRiskAnalysis}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Ejecutar Auditoría IA
                </button>
              </div>
            </div>
          </div>

          {/* Resultado Análisis Riesgo */}
          {riskResult && (
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Informe de Hallazgos Preventivos</h3>
                  <p className="text-xs text-slate-400">Periodo evaluado: {riskResult.period}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Nivel de Riesgo Tributario</div>
                  <div className={`text-2xl font-black ${riskResult.riskScore > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {riskResult.riskScore} / 100
                  </div>
                </div>
              </div>

              {/* Dictamen IA */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed">
                <span className="font-semibold text-amber-300 block mb-1">🤖 Recomendación Ejecutiva IA:</span>
                {riskResult.findings?.resumen_ejecutivo}
              </div>

              {/* Hallazgos detallados */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-300">Hallazgos Específicos Detectados ({riskResult.findings?.hallazgos?.length || 0}):</h4>
                {riskResult.findings?.hallazgos?.map((item: RiskFinding, idx: number) => (
                  <div key={idx} className="bg-slate-950 p-3.5 rounded-lg border-l-4 border-amber-500 border-t border-r border-b border-slate-800 flex justify-between gap-4">
                    <div>
                      <div className="font-bold text-amber-300 text-sm">{item.titulo}</div>
                      <div className="text-xs text-slate-400 mt-1">{item.descripcion}</div>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 rounded h-fit">
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
      {activeTab === 'planillas' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-purple-500"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 items-end">
                <button
                  onClick={handleCalculateGratificacion}
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1 shadow-lg"
                >
                  <Calculator className="w-3.5 h-3.5" /> Gratificación
                </button>
                <button
                  onClick={handleGenerateContract}
                  disabled={loading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1 shadow-lg"
                >
                  <FileText className="w-3.5 h-3.5" /> Contrato IA
                </button>
              </div>
            </div>
          </div>

          {/* Resultado Cálculo Gratificación */}
          {payrollResult && (
            <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-purple-300">Desglose de Gratificación Computada</h3>
                <span className="text-xs px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-full font-mono">
                  {payrollResult.detail?.normativa}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">Sueldo Base</div>
                  <div className="text-base font-bold text-white">S/ {payrollResult.detail?.sueldo_base}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">Asig. Familiar</div>
                  <div className="text-base font-bold text-white">S/ {payrollResult.detail?.asignacion_familiar}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">Bonificación 9%</div>
                  <div className="text-base font-bold text-purple-300">S/ {payrollResult.detail?.bonificacion_extraordinaria_soles}</div>
                </div>
                <div className="bg-purple-950/60 p-3 rounded-lg border border-purple-500/40">
                  <div className="text-xs text-purple-300 font-semibold">Total a Pagar</div>
                  <div className="text-lg font-black text-amber-400">S/ {payrollResult.totalSoles}</div>
                </div>
              </div>
            </div>
          )}

          {/* Resultado Contrato IA */}
          {contractDoc && (
            <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/40 p-3 rounded-lg flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div className="text-xs text-amber-200">
                  <strong>Revisión Humana Obligatoria:</strong> Este contrato fue redactado por IA. Requiere validación del profesional contable/legal antes de su firma.
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                {contractDoc.contractText}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PILAR 3: FINANZAS CON IA ─── */}
      {activeTab === 'finanzas' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleGenerateCashflow}
                disabled={loading}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm flex items-center gap-2 shadow-lg"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Generar Proyección Financiera
              </button>
            </div>
          </div>

          {/* Resultado Forecast Financiero */}
          {cashflowResult && (
            <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-6 space-y-6">
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
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
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
    </div>
  );
};
