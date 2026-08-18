import React, { useState, useEffect } from 'react';
import { webApiBridge } from '../services/apiBridge';
import { useStore } from '../store';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  ShieldAlert,
  Server,
  Key,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Edit3,
  ExternalLink,
  Lock,
  ChevronRight,
  Database,
  ArrowUpRight
} from 'lucide-react';

interface SuperAdminMetrics {
  mrr: number;
  arr: number;
  totalUsers: number;
  totalWorkspaces: number;
  payingClients: number;
  activeSubs: number;
  trialSubs: number;
  suspendedSubs: number;
  churnRate: string;
  plansDistribution: Record<string, number>;
  dbSizeMb: string | number;
  poolActiveConnections: number;
}

interface ClientItem {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  subscription_id?: string;
  plan_id?: string;
  plan_name?: string;
  price_pen?: number;
  subscription_status?: string;
  max_workspaces?: number;
  max_users?: number;
  current_period_end?: string;
  trial_ends_at?: string;
  workspaces_count?: number;
}

interface InvoiceItem {
  id: string;
  user_email: string;
  user_name: string;
  plan_name: string;
  amount_pen: number;
  status: string;
  culqi_charge_id?: string;
  paid_at?: string;
  created_at: string;
}

export const SuperAdminView: React.FC = () => {
  const [metrics, setMetrics] = useState<SuperAdminMetrics | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'INVOICES' | 'TELEMETRY'>('CLIENTS');

  // Modal para editar plan
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [editPlanId, setEditPlanId] = useState('profesional');
  const [editStatus, setEditStatus] = useState('active');
  const [editMaxWorkspaces, setEditMaxWorkspaces] = useState<number>(8);
  const [editDaysToAdd, setEditDaysToAdd] = useState<number>(30);
  const [isUpdating, setIsUpdating] = useState(false);

  // Modal para impersonar
  const [impersonateTarget, setImpersonateTarget] = useState<ClientItem | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, cRes, iRes] = await Promise.all([
        webApiBridge.superadminGetMetrics(),
        webApiBridge.superadminGetClients(),
        webApiBridge.superadminGetInvoices()
      ]);

      if (mRes.success) setMetrics(mRes.metrics);
      if (cRes.success) setClients(cRes.clients || []);
      if (iRes.success) setInvoices(iRes.invoices || []);
    } catch (err: any) {
      toast.error('Error al cargar datos de SuperAdmin: ' + (err.message || 'Sin autorización'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdatePlan = async () => {
    if (!selectedClient) return;
    setIsUpdating(true);
    try {
      const res = await webApiBridge.superadminUpdateClientPlan(selectedClient.id, {
        planId: editPlanId,
        status: editStatus,
        maxWorkspaces: Number(editMaxWorkspaces),
        daysToAdd: Number(editDaysToAdd)
      });
      if (res.success) {
        toast.success(`Plan de ${selectedClient.email} actualizado a ${editPlanId}`);
        setSelectedClient(null);
        fetchData();
      } else {
        toast.error(res.error || 'Error al actualizar');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar cambio');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImpersonate = async () => {
    if (!impersonateTarget) return;
    setIsImpersonating(true);
    try {
      const res = await webApiBridge.superadminImpersonate(impersonateTarget.id);
      if (res.success && res.impersonationToken) {
        toast.success(`Iniciando sesión como ${impersonateTarget.email}...`);
        localStorage.setItem('softcontable_token', res.impersonationToken);
        localStorage.setItem('softcontable_user', JSON.stringify(res.targetUser));
        (window as any).isImpersonated = true;
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(res.error || 'No se pudo iniciar sesión como el cliente.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error en impersonación');
    } finally {
      setIsImpersonating(false);
    }
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.plan_id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || (c.subscription_status || 'active') === statusFilter;
    const matchesPlan = planFilter === 'ALL' || (c.plan_id || 'estudiante') === planFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 bg-app-bg text-app-text animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              👑 SuperAdmin Master Console
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider rounded-full">
              Angelo Serna Simeon
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            Panel Propietario SaaS
          </h1>
          <p className="text-xs text-indigo-200/80 font-medium mt-1">
            Gobernanza global de clientes, facturación MRR/ARR, cuotas de empresas y telemetría de producción.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-400/40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* MRR Card */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">MRR (Mensual)</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-app-text">S/ {metrics?.mrr.toFixed(2) || '0.00'}</p>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            <ArrowUpRight size={14} />
            <span>ARR: S/ {metrics?.arr.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        {/* Paying Clients */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Clientes de Pago</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <UserCheck size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-app-text">{metrics?.payingClients || 0}</p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-app-muted mt-2">
            <span>{metrics?.totalUsers || 0} usuarios totales</span>
          </div>
        </div>

        {/* Workspaces Totales */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Empresas en Nube</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Building2 size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-app-text">{metrics?.totalWorkspaces || 0}</p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-app-muted mt-2">
            <span>Promedio: {metrics?.totalUsers ? ((metrics.totalWorkspaces / metrics.totalUsers).toFixed(1)) : '1.0'} emp/usuario</span>
          </div>
        </div>

        {/* Churn & Retención */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Tasa de Churn</span>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-app-text">{metrics?.churnRate || '0.0%'}</p>
          <div className="flex items-center gap-2 text-[11px] font-medium text-app-muted mt-2">
            <span>{metrics?.suspendedSubs || 0} suspendidas</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-app-border pb-3">
        <button
          onClick={() => setActiveTab('CLIENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'CLIENTS'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-app-surface text-app-muted hover:text-app-text hover:bg-app-hover border border-app-border'
          }`}
        >
          Directorio de Clientes ({filteredClients.length})
        </button>
        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'INVOICES'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-app-surface text-app-muted hover:text-app-text hover:bg-app-hover border border-app-border'
          }`}
        >
          Historial de Facturación ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'TELEMETRY'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-app-surface text-app-muted hover:text-app-text hover:bg-app-hover border border-app-border'
          }`}
        >
          Salud y Telemetría BD
        </button>
      </div>

      {/* TAB 1: CLIENTES */}
      {activeTab === 'CLIENTS' && (
        <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por correo, nombre o plan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                className="w-full pl-10 pr-4 py-2.5 bg-app-bg border border-app-border text-xs rounded-xl focus:outline-none focus:border-blue-500 text-app-text transition-colors"
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-app-bg border border-app-border text-xs font-bold rounded-xl text-app-text outline-none cursor-pointer"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="active">Activos</option>
                <option value="trial">Trial (Prueba)</option>
                <option value="suspended">Suspendidos</option>
                <option value="cancelled">Cancelados</option>
              </select>

              <select
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value)}
                className="px-3 py-2 bg-app-bg border border-app-border text-xs font-bold rounded-xl text-app-text outline-none cursor-pointer"
              >
                <option value="ALL">Todos los Planes</option>
                <option value="estudiante">Estudiante (S/ 0)</option>
                <option value="starter">Starter (S/ 49)</option>
                <option value="profesional">Profesional (S/ 99)</option>
                <option value="estudio">Estudio Contable (S/ 179)</option>
                <option value="corporativo">Corporativo (S/ 499)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border text-[10px] font-black uppercase tracking-wider text-app-muted">
                  <th className="py-3 px-4">Cliente / Email</th>
                  <th className="py-3 px-4">Plan Activo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Empresas Usadas</th>
                  <th className="py-3 px-4">Vencimiento</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40 font-medium">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-app-muted font-bold">
                      No se encontraron clientes que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(c => {
                    const status = c.subscription_status || 'active';
                    const planId = c.plan_id || 'estudiante';
                    const used = c.workspaces_count || 0;
                    const max = c.max_workspaces || 1;
                    const pct = Math.min(100, Math.round((used / max) * 100));

                    return (
                      <tr key={c.id} className="hover:bg-app-hover/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-app-text">{c.name || 'Sin nombre'}</div>
                          <div className="text-[11px] text-app-muted">{c.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-black uppercase tracking-wide text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {c.plan_name || planId}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {status === 'active' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Activo
                            </span>
                          )}
                          {status === 'trial' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Trial (14d)
                            </span>
                          )}
                          {status === 'suspended' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                              Suspendido
                            </span>
                          )}
                          {status === 'cancelled' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 border border-slate-500/20">
                              Cancelado
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.plan_id === 'corporativo' || max >= 50 ? (
                            <span className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                              {used} / Ilimitadas
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{used} / {max}</span>
                              <div className="w-16 h-1.5 bg-app-bg border border-app-border rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-600'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-app-muted text-[11px]">
                          {c.current_period_end ? new Date(c.current_period_end).toLocaleDateString() : 'Permanente'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedClient(c);
                                const targetPlan = c.plan_id || 'profesional';
                                setEditPlanId(targetPlan);
                                setEditStatus(c.subscription_status || 'active');
                                if (targetPlan === 'corporativo') {
                                  setEditMaxWorkspaces(9999);
                                } else if (targetPlan === 'estudio') {
                                  setEditMaxWorkspaces(20);
                                } else if (targetPlan === 'profesional') {
                                  setEditMaxWorkspaces(8);
                                } else if (targetPlan === 'starter') {
                                  setEditMaxWorkspaces(3);
                                } else {
                                  setEditMaxWorkspaces(c.max_workspaces || 1);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-app-bg hover:bg-app-hover border border-app-border text-app-text hover:text-blue-500 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                              title="Modificar plan y cuotas"
                            >
                              <Edit3 size={12} className="inline mr-1" />
                              Plan
                            </button>
                            <button
                              onClick={() => setImpersonateTarget(c)}
                              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white border border-amber-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                              title="Ingresar como cliente"
                            >
                              <Key size={12} className="inline mr-1" />
                              Acceder
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FACTURAS */}
      {activeTab === 'INVOICES' && (
        <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider mb-4">Registro Global de Transacciones</h3>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border text-[10px] font-black uppercase tracking-wider text-app-muted">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Plan Contratado</th>
                  <th className="py-3 px-4">Monto (PEN)</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">ID Transacción Culqi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40 font-medium">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-app-muted font-bold">
                      No hay transacciones registradas todavía.
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-app-hover/50">
                      <td className="py-3 px-4 text-app-muted">{new Date(inv.created_at).toLocaleString()}</td>
                      <td className="py-3 px-4 font-bold text-app-text">{inv.user_email}</td>
                      <td className="py-3 px-4 uppercase text-blue-500 font-bold">{inv.plan_name || 'Suscripción'}</td>
                      <td className="py-3 px-4 font-black text-app-text">S/ {Number(inv.amount_pen).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {inv.status === 'paid' ? 'Pagado' : inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-app-muted">{inv.culqi_charge_id || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TELEMETRIA */}
      {activeTab === 'TELEMETRY' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
              <Server size={18} className="text-indigo-500" />
              Estado de la Base de Datos PostgreSQL
            </h3>
            <div className="space-y-4 text-xs font-medium">
              <div className="flex justify-between border-b border-app-border pb-2">
                <span className="text-app-muted">Tamaño Total Almacenado:</span>
                <span className="font-black text-app-text">{metrics?.dbSizeMb || 0} MB</span>
              </div>
              <div className="flex justify-between border-b border-app-border pb-2">
                <span className="text-app-muted">Límite Incluido Railway Pro:</span>
                <span className="font-black text-emerald-500">5,000 MB (5 GB)</span>
              </div>
              <div className="flex justify-between border-b border-app-border pb-2">
                <span className="text-app-muted">Capacidad de Empresas Estimada:</span>
                <span className="font-black text-app-text">~75 empresas activas</span>
              </div>
              <div className="flex justify-between border-b border-app-border pb-2">
                <span className="text-app-muted">Conexiones Activas en el Pool:</span>
                <span className="font-black text-blue-500">{metrics?.poolActiveConnections || 1} / 30</span>
              </div>
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
              <Database size={18} className="text-blue-500" />
              Distribución de Suscripciones por Plan
            </h3>
            <div className="space-y-3">
              {Object.entries(metrics?.plansDistribution || {}).map(([p, count]) => (
                <div key={p} className="flex justify-between items-center text-xs">
                  <span className="font-bold uppercase text-app-text">{p}:</span>
                  <span className="px-3 py-1 bg-app-bg border border-app-border rounded-lg font-black text-blue-500">
                    {count} usuarios
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PLAN */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl p-6 shadow-2xl animate-scale-up">
            <h3 className="text-base font-black uppercase tracking-wider text-app-text mb-1">
              Modificar Plan de Cliente
            </h3>
            <p className="text-xs text-app-muted mb-4 font-medium">{selectedClient.email}</p>

            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-app-muted uppercase text-[10px] mb-1">Plan SaaS</label>
                <select
                  value={editPlanId}
                  onChange={e => {
                    const nextPlan = e.target.value;
                    setEditPlanId(nextPlan);
                    if (nextPlan === 'corporativo') setEditMaxWorkspaces(9999);
                    else if (nextPlan === 'estudio') setEditMaxWorkspaces(20);
                    else if (nextPlan === 'profesional') setEditMaxWorkspaces(8);
                    else if (nextPlan === 'starter') setEditMaxWorkspaces(3);
                    else if (nextPlan === 'estudiante') setEditMaxWorkspaces(1);
                  }}
                  className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                >
                  <option value="estudiante">Estudiante / Free (1 empresa)</option>
                  <option value="starter">Starter / Básico (3 empresas - S/ 49)</option>
                  <option value="profesional">Profesional (8 empresas - S/ 99)</option>
                  <option value="estudio">Estudio Contable (20 empresas - S/ 179)</option>
                  <option value="corporativo">Corporativo (Empresas Ilimitadas - S/ 499)</option>
                </select>
              </div>

              <div>
                <label className="block text-app-muted uppercase text-[10px] mb-1">Estado de Suscripción</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                >
                  <option value="active">Activo</option>
                  <option value="trial">Trial (Prueba)</option>
                  <option value="grace">Período de Gracia (Solo Lectura)</option>
                  <option value="suspended">Suspendido (Bloqueado)</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-app-muted uppercase text-[10px] mb-1">
                    Límite Empresas {editPlanId === 'corporativo' && '(Ilimitado)'}
                  </label>
                  <input
                    type="text"
                    value={editPlanId === 'corporativo' ? 'Ilimitadas (50+)' : editMaxWorkspaces}
                    disabled={editPlanId === 'corporativo'}
                    onChange={e => setEditMaxWorkspaces(Number(e.target.value))}
                    className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-app-muted uppercase text-[10px] mb-1">Días a Añadir</label>
                  <input
                    type="number"
                    value={editDaysToAdd}
                    onChange={e => setEditDaysToAdd(Number(e.target.value))}
                    className="w-full p-2.5 bg-app-bg border border-app-border rounded-xl text-app-text outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedClient(null)}
                className="flex-1 py-2.5 bg-app-bg hover:bg-app-hover border border-app-border rounded-xl font-bold uppercase text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={isUpdating}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs cursor-pointer shadow-md shadow-blue-600/20"
              >
                {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPERSONACIÓN */}
      {impersonateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-app-surface border border-amber-500/30 rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                <AlertTriangle size={24} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-app-text">
                  Sesión de Soporte
                </h3>
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Impersonación Auditada</p>
              </div>
            </div>

            <p className="text-xs text-app-muted leading-relaxed font-medium mb-4">
              Ingresarás temporalmente a la cuenta de <strong className="text-app-text">{impersonateTarget.email}</strong> durante un máximo de 2 horas. Esta acción quedará registrada en los logs de auditoría.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setImpersonateTarget(null)}
                className="flex-1 py-2.5 bg-app-bg hover:bg-app-hover border border-app-border rounded-xl font-bold uppercase text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleImpersonate}
                disabled={isImpersonating}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-black uppercase text-xs cursor-pointer shadow-lg shadow-amber-600/20"
              >
                {isImpersonating ? 'Iniciando...' : 'Ingresar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
