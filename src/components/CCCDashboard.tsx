import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Clock, DollarSign, RefreshCw, Package, Users, Landmark, ArrowRight, FileDown, Printer } from 'lucide-react';
import { useStore } from '../store';
import PageHeader from './ui/PageHeader';
import { toast } from 'react-hot-toast';
import { exportSingleSheet } from '../utils/excelExport';

interface CCCMetrics {
  dio: number;
  dso: number;
  dpo: number;
  ccc: number;
}

const CCCDashboard: React.FC = () => {
  const { currentCompany } = useStore();
  const [metrics, setMetrics] = useState<CCCMetrics>({ dio: 0, dso: 0, dpo: 0, ccc: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const electron = (window as any).electronAPI;

  const loadMetrics = async () => {
    if (!electron) {
      toast.error('Error: API de sistema no disponible');
      return;
    }
    
    if (!currentCompany?.ruc || currentCompany.ruc.trim() === '') {
      toast.error('Seleccione una empresa con RUC válido para ver las métricas');
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading('Calculando métricas financieras...');
    try {
      console.log('Solicitando métricas CCC para RUC:', currentCompany.ruc);
      const result = await electron.analyticsCCCMetrics(currentCompany.ruc);
      
      if (result.success) {
        setMetrics(result.data);
        toast.success('Hoja Actualizada', { id: loadingToast });
      } else {
        toast.error('Error: ' + (result.error || 'No se pudieron calcular las métricas'), { id: loadingToast });
      }
    } catch (e: any) {
      console.error('Error cargando métricas CCC:', e);
      toast.error('Error de conexión: ' + e.message, { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadMetrics(); }, [currentCompany?.ruc]);

  const cccHealth = metrics.ccc <= 0 ? 'Excelente' : metrics.ccc <= 30 ? 'Saludable' : metrics.ccc <= 60 ? 'Moderado' : 'Crítico';
  const cccColor = metrics.ccc <= 0 ? 'text-emerald-500' : metrics.ccc <= 30 ? 'text-blue-500' : metrics.ccc <= 60 ? 'text-amber-500' : 'text-rose-500';
  const cccBg = metrics.ccc <= 0 ? 'from-emerald-600/20 to-emerald-600/5' : metrics.ccc <= 30 ? 'from-blue-600/20 to-blue-600/5' : metrics.ccc <= 60 ? 'from-amber-600/20 to-amber-600/5' : 'from-rose-600/20 to-rose-600/5';

  const maxBar = Math.max(metrics.dio, metrics.dso, metrics.dpo, 1);

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-hidden">
      <PageHeader
        icon={<Activity size={18} />}
        title="Ciclo de Conversión de Efectivo (CCC)"
        subtitle="Cash Conversion Cycle — Lawrence Gitman | CCC = DIO + DSO − DPO"
        actions={
          <div className="flex gap-2">
            <button onClick={loadMetrics} disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> ACTUALIZAR
            </button>
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Ciclo Operativo (CCC)',
              title: 'CICLO DE CONVERSIÓN DE EFECTIVO (CCC)',
              columns: [
                { header: 'MÉTRICA / INDICADOR', key: 'name', width: 35 },
                { header: 'DÍAS', key: 'days', width: 15, style: 'number', alignment: 'center' }
              ],
              rows: [
                { name: 'DIO - Días de Inventario', days: metrics.dio },
                { name: 'DSO - Días de Cobro', days: metrics.dso },
                { name: 'DPO - Días de Pago', days: metrics.dpo },
                { name: 'CCC - Ciclo Conversión Efectivo', days: metrics.ccc }
              ],
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Ciclo_Efectivo_CCC')} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

          {/* ═══ HERO KPI ═══ */}
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cccBg} border border-app-border p-6 md:p-8`}>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted mb-2">Ciclo de Conversión de Efectivo</p>
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl md:text-6xl font-black font-mono ${cccColor}`}>{metrics.ccc}</span>
                  <span className="text-xl md:text-2xl font-bold text-app-muted">días</span>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cccColor} bg-app-surface/50 border border-app-border`}>
                    {cccHealth}
                  </span>
                  <span className="text-[10px] text-app-muted font-bold">
                    {currentCompany?.name || 'Empresa'} — Periodo {currentCompany?.period || '2026'}
                  </span>
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-app-muted mb-2">Fórmula</div>
                <div className="bg-app-surface/60 backdrop-blur-sm rounded-xl px-4 py-3 md:px-6 md:py-4 border border-app-border">
                  <div className="flex items-center gap-2 text-base md:text-lg font-mono font-bold flex-wrap">
                    <span className="text-blue-500">{metrics.dio}</span>
                    <span className="text-app-muted">+</span>
                    <span className="text-amber-500">{metrics.dso}</span>
                    <span className="text-app-muted">−</span>
                    <span className="text-emerald-500">{metrics.dpo}</span>
                    <span className="text-app-muted">=</span>
                    <span className={cccColor}>{metrics.ccc}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] font-bold text-app-muted uppercase tracking-widest mt-1">
                    <span>DIO</span><span>+</span><span>DSO</span><span>−</span><span>DPO</span><span>=</span><span>CCC</span>
                  </div>
                </div>
              </div>
            </div>
            <Activity size={200} className="absolute -right-10 -bottom-10 text-app-border/20 hidden md:block" strokeWidth={0.5} />
          </div>

          {/* ═══ KPI CARDS ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* DIO */}
            <div className="section-card group hover:border-blue-500/50 transition-all">
              <div className="section-card-header !border-0">
                <Package size={15} className="text-blue-500" />
                <span className="text-blue-500">DIO — Días de Inventario</span>
              </div>
              <div className="px-5 pb-5">
                <p className="text-4xl font-black font-mono text-blue-500">{metrics.dio}<span className="text-lg text-app-muted ml-1">días</span></p>
                <p className="text-[10px] text-app-muted mt-2 font-bold">Promedio de días que el inventario permanece en almacén antes de ser vendido.</p>
                <div className="mt-3 h-2 bg-app-bg rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${Math.min((metrics.dio / maxBar) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* DSO */}
            <div className="section-card group hover:border-amber-500/50 transition-all">
              <div className="section-card-header !border-0">
                <Users size={15} className="text-amber-500" />
                <span className="text-amber-500">DSO — Días de Cobro</span>
              </div>
              <div className="px-5 pb-5">
                <p className="text-4xl font-black font-mono text-amber-500">{metrics.dso}<span className="text-lg text-app-muted ml-1">días</span></p>
                <p className="text-[10px] text-app-muted mt-2 font-bold">Promedio de días que toma cobrar las ventas a crédito (Cuentas 121).</p>
                <div className="mt-3 h-2 bg-app-bg rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: `${Math.min((metrics.dso / maxBar) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* DPO */}
            <div className="section-card group hover:border-emerald-500/50 transition-all">
              <div className="section-card-header !border-0">
                <Landmark size={15} className="text-emerald-500" />
                <span className="text-emerald-500">DPO — Días de Pago</span>
              </div>
              <div className="px-5 pb-5">
                <p className="text-4xl font-black font-mono text-emerald-500">{metrics.dpo}<span className="text-lg text-app-muted ml-1">días</span></p>
                <p className="text-[10px] text-app-muted mt-2 font-bold">Promedio de días para pagar a proveedores (Cuentas 421). Mayor = mejor.</p>
                <div className="mt-3 h-2 bg-app-bg rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.min((metrics.dpo / maxBar) * 100, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ VISUAL TIMELINE ═══ */}
          <div className="section-card">
            <div className="section-card-header">
              <Clock size={15} />
              <span>Flujo del Ciclo Operativo</span>
            </div>
            <div className="px-5 pb-6">
              <div className="flex items-center justify-between gap-4">
                {/* Compra */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Package size={24} className="text-blue-500" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Compra</span>
                </div>

                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="flex items-center gap-1 text-blue-500">
                    <div className="h-px flex-1 bg-blue-500/30" />
                    <span className="text-[10px] font-black font-mono">{metrics.dio} días</span>
                    <ArrowRight size={12} />
                    <div className="h-px flex-1 bg-blue-500/30" />
                  </div>
                  <span className="text-[8px] font-bold text-blue-500/60 uppercase">Inventario</span>
                </div>

                {/* Venta */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <TrendingUp size={24} className="text-amber-500" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Venta</span>
                </div>

                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="flex items-center gap-1 text-amber-500">
                    <div className="h-px flex-1 bg-amber-500/30" />
                    <span className="text-[10px] font-black font-mono">{metrics.dso} días</span>
                    <ArrowRight size={12} />
                    <div className="h-px flex-1 bg-amber-500/30" />
                  </div>
                  <span className="text-[8px] font-bold text-amber-500/60 uppercase">Cobranza</span>
                </div>

                {/* Cobro */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <DollarSign size={24} className="text-emerald-500" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Efectivo</span>
                </div>
              </div>

              {/* DPO offset */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <TrendingDown size={14} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-app-muted">
                  Financiamiento de proveedores: <span className="text-emerald-500 font-black font-mono">{metrics.dpo} días</span> de DPO reducen el ciclo
                </span>
              </div>
            </div>
          </div>

          {/* ═══ INTERPRETATION ═══ */}
          <div className="section-card bg-gradient-to-br from-app-surface to-app-bg">
            <div className="section-card-header">
              <Activity size={15} />
              <span>Interpretación Automática</span>
            </div>
            <div className="px-5 pb-5 space-y-3 text-[11px]">
              {metrics.ccc <= 0 && (
                <p className="text-emerald-500 font-bold">✅ Su empresa genera efectivo antes de necesitar pagar a proveedores. Posición financiera óptima.</p>
              )}
              {metrics.ccc > 0 && metrics.ccc <= 30 && (
                <p className="text-blue-500 font-bold">✅ Ciclo saludable. La empresa convierte inventario en efectivo en menos de un mes.</p>
              )}
              {metrics.ccc > 30 && metrics.ccc <= 60 && (
                <p className="text-amber-500 font-bold">⚠️ Ciclo moderado. Considere negociar mejores plazos de pago con proveedores o acelerar la cobranza.</p>
              )}
              {metrics.ccc > 60 && (
                <p className="text-rose-500 font-bold">🚨 Ciclo crítico. El capital de trabajo está atrapado {metrics.ccc} días. Riesgo de liquidez.</p>
              )}
              
              {metrics.dio > 45 && (
                <p className="text-app-muted">📦 <strong>DIO alto ({metrics.dio} días):</strong> Posible sobrestock. Evalúe rotación de productos lentos.</p>
              )}
              {metrics.dso > 30 && (
                <p className="text-app-muted">👥 <strong>DSO alto ({metrics.dso} días):</strong> La cobranza es lenta. Considere descuentos por pronto pago.</p>
              )}
              {metrics.dpo < 15 && metrics.dpo > 0 && (
                <p className="text-app-muted">🏦 <strong>DPO bajo ({metrics.dpo} días):</strong> Paga muy rápido a proveedores. Negocie plazos mayores.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CCCDashboard;
