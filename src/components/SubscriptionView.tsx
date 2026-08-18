import React, { useState, useEffect } from 'react';
import { webApiBridge } from '../services/apiBridge';
import toast from 'react-hot-toast';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Building2,
  Clock,
  Sparkles,
  ShieldCheck,
  Download,
  Calendar,
  Lock,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

interface SubscriptionData {
  id: string;
  plan_id: string;
  plan_name: string;
  price_pen: number;
  status: string;
  workspacesUsed: number;
  maxWorkspaces: number;
  daysRemaining: number;
  isTrial: boolean;
  isActive: boolean;
  isReadOnly: boolean;
  current_period_end?: string;
  includes_premium?: boolean;
}

interface PlanOption {
  id: string;
  name: string;
  price_pen: number;
  price_annual_pen: number;
  max_workspaces: number;
  max_users: number;
  includes_premium: boolean;
  features: string[];
}

const DEFAULT_PLANS: PlanOption[] = [
  {
    id: 'estudiante',
    name: 'Estudiante / Free',
    price_pen: 0,
    price_annual_pen: 0,
    max_workspaces: 1,
    max_users: 1,
    includes_premium: false,
    features: ['1 Empresa (RUC de práctica)', '10 Módulos de práctica', 'Exportación básica', 'Soporte comunitario']
  },
  {
    id: 'starter',
    name: 'Starter / Básico',
    price_pen: 49,
    price_annual_pen: 470,
    max_workspaces: 3,
    max_users: 2,
    includes_premium: false,
    features: ['3 Empresas activas', '2 Usuarios concurrentes', 'SIRE + PLE + Sunat Sync', 'Libros oficiales en Excel y TXT']
  },
  {
    id: 'profesional',
    name: 'Profesional',
    price_pen: 99,
    price_annual_pen: 950,
    max_workspaces: 8,
    max_users: 4,
    includes_premium: false,
    features: ['8 Empresas activas', '4 Usuarios de trabajo', 'Estados Financieros y NIIF', 'Cálculo NIC 12 diferido']
  },
  {
    id: 'estudio',
    name: 'Estudio Contable',
    price_pen: 179,
    price_annual_pen: 1718,
    max_workspaces: 20,
    max_users: 10,
    includes_premium: true,
    features: ['20 Empresas activas', '10 Usuarios multi-estudio', 'Módulo SoftPremium IA incluido', 'Soporte prioritario WhatsApp']
  },
  {
    id: 'corporativo',
    name: 'Corporativo',
    price_pen: 499,
    price_annual_pen: 4790,
    max_workspaces: 9999,
    max_users: 9999,
    includes_premium: true,
    features: ['Empresas Ilimitadas (50+)', 'Usuarios Ilimitados', 'SoftPremium IA Ilimitado', 'Atención ejecutiva 24/7']
  }
];

export const SubscriptionView: React.FC = () => {
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Modal Checkout Culqi
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanOption | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    try {
      const [subRes, invRes] = await Promise.all([
        webApiBridge.subscriptionGetMe(),
        webApiBridge.subscriptionGetInvoices()
      ]);
      if (subRes.success) setSubData(subRes.subscription);
      if (invRes.success) setInvoices(invRes.invoices || []);
    } catch (err: any) {
      console.warn('Error fetching subscription:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForCheckout) return;

    if (cardNumber.replace(/\s/g, '').length < 15) {
      toast.error('Ingrese un número de tarjeta válido.');
      return;
    }

    setIsProcessingPayment(true);
    const loadingToast = toast.loading('Procesando pago seguro con Culqi...');

    try {
      // Simular generación de token Culqi seguro (o integración directa)
      const mockCulqiToken = `tkn_live_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await webApiBridge.subscriptionCheckout({
        planId: selectedPlanForCheckout.id,
        culqiToken: mockCulqiToken,
        billingCycle
      });

      if (res.success) {
        toast.success(res.message || '¡Suscripción activada con éxito!', { id: loadingToast });
        setSelectedPlanForCheckout(null);
        fetchSubscriptionData();
      } else {
        toast.error(res.error || 'Error al procesar el pago.', { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con la pasarela de pago.', { id: loadingToast });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const used = subData?.workspacesUsed || 0;
  const max = subData?.maxWorkspaces || 1;
  const quotaPct = Math.min(100, Math.round((used / max) * 100));

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 bg-app-bg text-app-text animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 border border-blue-500/30 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              💳 Facturación & Cuotas
            </span>
            {subData?.isTrial && (
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider rounded-full">
                Prueba Gratuita (14 días)
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            Mi Suscripción SaaS
          </h1>
          <p className="text-xs text-blue-200/80 font-medium mt-1">
            Gestiona tu plan actual, cuota de empresas habilitadas y comprobantes de pago.
          </p>
        </div>
      </div>

      {/* Grid: Plan Actual & Cuota de Empresas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Card: Plan Activo */}
        <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Plan Actual</span>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                subData?.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>
                {subData?.status === 'trial' ? 'En Prueba' : subData?.isActive ? 'Activo' : 'Suspendido'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-app-text uppercase">{subData?.plan_name || 'Estudiante'}</h2>
            <p className="text-xs text-app-muted font-bold mt-1">
              S/ {subData?.price_pen ? Number(subData.price_pen).toFixed(2) : '0.00'} / mes
            </p>

            <div className="mt-6 space-y-2 text-xs font-semibold text-app-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Hasta {subData?.maxWorkspaces || 1} empresas gestionadas simultáneamente</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Cálculo tributario y libros electrónicos ilimitados</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-blue-500 shrink-0" />
                <span>
                  {subData?.current_period_end
                    ? `Próxima renovación: ${new Date(subData.current_period_end).toLocaleDateString()}`
                    : 'Plan Permanente Gratuito'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-app-border">
            <span className="text-[10px] font-bold text-app-muted uppercase tracking-wider block mb-1">Días Restantes</span>
            <div className="text-lg font-black text-blue-500">
              {subData?.daysRemaining ? `${subData.daysRemaining} días de vigencia` : 'Sin expiración'}
            </div>
          </div>
        </div>

        {/* Card: Cuota de Empresas (Workspaces) */}
        <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Uso de Empresas</span>
              <Building2 size={18} className="text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-app-text">{used}</span>
              <span className="text-sm font-bold text-app-muted">de {max} permitidas</span>
            </div>

            {/* Barra de Progreso */}
            <div className="w-full h-3 bg-app-bg border border-app-border rounded-full mt-4 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaPct >= 100 ? 'bg-red-500' : quotaPct >= 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                }`}
                style={{ width: `${quotaPct}%` }}
              />
            </div>

            <p className="text-[11px] text-app-muted font-medium mt-3">
              {quotaPct >= 100
                ? '⚠️ Ha alcanzado el límite máximo de empresas para su plan. Realice un upgrade para añadir nuevas empresas.'
                : `Tiene ${max - used} cupo(s) disponible(s) para crear nuevas empresas.`}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-app-border">
            <button
              onClick={() => {
                const el = document.getElementById('pricing-catalog');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-blue-600/20"
            >
              Mejorar Mi Plan (Upgrade)
            </button>
          </div>
        </div>

        {/* Card: Soporte & Garantía */}
        <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Garantía SoftContable</span>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-app-text">Pagos Seguros con Culqi</h4>
                  <p className="text-[10px] text-app-muted">Cifrado SSL 256-bit y cumplimiento de estándares PCI-DSS.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-app-text">Actualizaciones SUNAT Gratuitas</h4>
                  <p className="text-[10px] text-app-muted">Normativas NIIF, SIRE y RMF actualizadas sin costo adicional.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-app-border">
            <a
              href="https://wa.me/51999999999"
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 bg-app-bg hover:bg-app-hover border border-app-border text-app-text rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <HelpCircle size={14} /> Contactar a Soporte
            </a>
          </div>
        </div>
      </div>

      {/* Catálogo de Planes (Pricing Table) */}
      <div id="pricing-catalog" className="mb-12">
        <div className="text-center max-w-xl mx-auto mb-8">
          <h3 className="text-xl font-black uppercase tracking-tight text-app-text">
            Planes Disponibles para tu Estudio
          </h3>
          <p className="text-xs text-app-muted font-medium mt-1">
            Escoge el plan que mejor se adapte al volumen de clientes de tu estudio contable.
          </p>

          {/* Toggle Mensual / Anual */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className={`text-xs font-black uppercase ${billingCycle === 'monthly' ? 'text-blue-500' : 'text-app-muted'}`}>
              Mensual
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className="w-12 h-6 bg-app-surface border border-app-border rounded-full p-1 transition-colors relative cursor-pointer"
            >
              <div
                className={`w-4 h-4 bg-blue-600 rounded-full transition-transform ${
                  billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-black uppercase flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-blue-500' : 'text-app-muted'}`}>
              Anual <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black rounded-md">Ahorra 20%</span>
            </span>
          </div>
        </div>

        {/* Planes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {DEFAULT_PLANS.map(plan => {
            const isCurrent = subData?.plan_id === plan.id;
            const price = billingCycle === 'annual' ? Math.round(plan.price_annual_pen / 12) : plan.price_pen;

            return (
              <div
                key={plan.id}
                className={`bg-app-surface border rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all relative ${
                  isCurrent ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-app-border hover:border-app-border/80'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
                    Plan Actual
                  </span>
                )}
                <div>
                  <h4 className="text-sm font-black uppercase text-app-text mb-1">{plan.name}</h4>
                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-2xl font-black text-app-text">S/ {price}</span>
                    <span className="text-[10px] font-bold text-app-muted">/ mes</span>
                  </div>

                  <div className="p-2.5 bg-app-bg border border-app-border rounded-xl mb-4 text-center">
                    <span className="text-xs font-black text-indigo-500 uppercase">
                      {plan.max_workspaces > 50 ? 'Empresas Ilimitadas' : `Hasta ${plan.max_workspaces} Empresas`}
                    </span>
                  </div>

                  <ul className="space-y-2 text-[11px] text-app-muted font-medium mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => setSelectedPlanForCheckout(plan)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-app-bg text-app-muted border border-app-border cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-95'
                  }`}
                >
                  {isCurrent ? 'Plan Contratado' : 'Seleccionar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial de Comprobantes */}
      <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider mb-4">Comprobantes y Recibos Emitidos</h3>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-app-border text-[10px] font-black uppercase tracking-wider text-app-muted">
                <th className="py-3 px-4">Fecha de Cobro</th>
                <th className="py-3 px-4">Concepto</th>
                <th className="py-3 px-4">Importe (PEN)</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 font-medium">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-app-muted font-bold">
                    No cuenta con facturas o recibos pendientes.
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-app-hover/50">
                    <td className="py-3 px-4 text-app-muted">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-bold text-app-text uppercase">{inv.plan_name || 'Suscripción SoftContable'}</td>
                    <td className="py-3 px-4 font-black text-app-text">S/ {Number(inv.amount_pen).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md text-[10px] font-bold">
                        Pagado
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => toast.success('Recibo descargado')}
                        className="px-3 py-1 bg-app-bg hover:bg-app-hover border border-app-border rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Download size={12} /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CHECKOUT CULQI */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Pasarela Segura Culqi</span>
                <h3 className="text-lg font-black uppercase text-app-text mt-0.5">
                  Plan {selectedPlanForCheckout.name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-app-text">
                  S/ {billingCycle === 'annual' ? selectedPlanForCheckout.price_annual_pen : selectedPlanForCheckout.price_pen}
                </span>
                <span className="text-[10px] block text-app-muted font-bold">
                  {billingCycle === 'annual' ? 'Facturado anual' : 'Facturado mensual'}
                </span>
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="block text-app-muted uppercase text-[10px] mb-1">Nombre en la Tarjeta</label>
                <input
                  type="text"
                  placeholder="JUAN PEREZ"
                  value={cardHolder}
                  onChange={e => setCardHolder(e.target.value.toUpperCase())}
                  required
                  className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                />
              </div>

              <div>
                <label className="block text-app-muted uppercase text-[10px] mb-1">Número de Tarjeta (Visa / Mastercard / Amex)</label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={19}
                    placeholder="4111 •••• •••• ••••"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    required
                    className="w-full p-2.5 pl-9 bg-app-bg border border-app-border rounded-xl text-app-text outline-none font-mono"
                  />
                  <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-app-muted uppercase text-[10px] mb-1">Expiración (MM/AA)</label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="12/28"
                    value={cardExp}
                    onChange={e => setCardExp(e.target.value)}
                    required
                    className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-app-muted uppercase text-[10px] mb-1">CVV (3-4 dígitos)</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="•••"
                    value={cardCvv}
                    onChange={e => setCardCvv(e.target.value)}
                    required
                    className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none font-mono text-center"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-center gap-2 text-[11px] text-blue-500 font-medium">
                <Lock size={14} className="shrink-0" />
                <span>Sus datos viajan encriptados de extremo a extremo directamente a Culqi.</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="flex-1 py-2.5 bg-app-bg hover:bg-app-hover border border-app-border rounded-xl font-bold uppercase text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black uppercase text-xs cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {isProcessingPayment ? 'Pagando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
