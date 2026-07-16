import React, { useState, useMemo } from 'react';
import {
  GraduationCap, BookText, ShoppingCart, Tag, Scale, Calculator,
  BarChart3, CalendarDays, ChevronRight, CheckCircle2, Circle,
  Lightbulb, Activity, Loader2, Sparkles, Building2
} from 'lucide-react';
import { useStore, type RegimenCode } from '../store';
import PageHeader from './ui/PageHeader';

const TIPS_CONTABLES = [
  { tip: 'La partida doble establece que todo asiento debe tener al menos una cuenta al DEBE y otra al HABER, y ambos lados deben ser iguales.', norma: 'Principio Fundamental' },
  { tip: 'Las cuentas del Activo (clase 1-3) aumentan por el DEBE y disminuyen por el HABER.', norma: 'PCGE - Regla de Débito' },
  { tip: 'Las cuentas de Pasivo y Patrimonio (clase 4-5) aumentan por el HABER y disminuyen por el DEBE.', norma: 'PCGE - Regla de Crédito' },
  { tip: 'Las cuentas de Gastos (clase 6) siempre se cargan al DEBE. Los Ingresos (clase 7) siempre van al HABER.', norma: 'PCGE - Clases 6 y 7' },
  { tip: 'La cuenta 79 "Cargas Imputables" sirve para transferir el gasto al costo. Es el nexo entre las clases 6 y 9.', norma: 'PCGE - Dinámica' },
  { tip: 'El Balance de Comprobación es la herramienta que verifica el cuadre global: Σ Débitos = Σ Créditos.', norma: 'Hoja de Trabajo' },
  { tip: 'En el Estado de Resultados, la Utilidad Neta = Ingresos (clase 7) − Gastos (clase 6).', norma: 'NIC 1 - Presentación' },
  { tip: 'El Estado de Situación Financiera presenta Activos = Pasivos + Patrimonio (ecuación contable fundamental).', norma: 'NIC 1 - Balance' },
  { tip: 'Las cuentas de la clase 9 (Costos) son de uso interno y no aparecen en los estados financieros.', norma: 'PCGE - Clase 9' },
  { tip: 'El IGV (18%) se registra en la cuenta 40111 y no forma parte de la base imponible de compras ni ventas.', norma: 'Ley del IGV' },
  { tip: 'En una empresa COMERCIAL, la cuenta 60 registra la compra de mercaderías. En una empresa de SERVICIOS, se usa la cuenta 63.', norma: 'PCGE - Diferencias sectoriales' },
  { tip: 'La centralización es el proceso de trasladar los registros del Libro Diario al Libro Mayor por cada cuenta contable.', norma: 'Proceso Contable' },
];

const formatCurrency = (n: number) => `S/ ${Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

const StudentDashboard: React.FC = () => {
  const {
    currentCompany: _currentCompany,
    updateCompany,
    sales,
    purchases,
    asientos,
    journal,
    plan,
    setActiveTab,
    showCompanyConfig: showConfig,
    setShowCompanyConfig: setShowConfig
  } = useStore();
  const currentCompany = _currentCompany || {};

  // Rotating tip
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS_CONTABLES.length));
  const currentTip = TIPS_CONTABLES[tipIndex];

  // Loading sample data
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Cycle progress
  const cycleProgress = useMemo(() => {
    const hasPlan = plan.length > 0;
    const hasCompras = purchases.length > 0;
    const hasVentas = sales.length > 0;
    const hasAsientos = asientos.length > 0;
    const hasJournal = journal.length > 0;
    return { hasPlan, hasCompras, hasVentas, hasAsientos, hasJournal };
  }, [plan, purchases, sales, asientos, journal]);

  const completedSteps = Object.values(cycleProgress).filter(Boolean).length;

  // Cuadre check
  const cuadreStatus = useMemo(() => {
    if (asientos.length === 0) return { cuadrado: true, diferencia: 0 };
    let totalDebe = 0;
    let totalHaber = 0;
    asientos.forEach(a => {
      a.lines?.forEach(l => {
        totalDebe += l.debe || 0;
        totalHaber += l.haber || 0;
      });
    });
    return { cuadrado: Math.abs(totalDebe - totalHaber) < 0.01, diferencia: totalDebe - totalHaber };
  }, [asientos]);

  const handleLoadSampleData = async () => {
    setIsLoadingSample(true);
    try {
      const { saveAsiento, savePurchase, saveSale } = useStore.getState();

      // Sample purchases
      const samplePurchases = [
        {
          id: `sample-purchase-${Date.now()}-1`,
          registro: '000001',
          fecha: '15/01/2026',
          fecVcto: '15/01/2026',
          tipo_doc: '01',
          serie: 'F001',
          numero: '0001',
          doc_tipo: '6',
          doc_num: '20100130204',
          nombre: 'DISTRIBUIDORA ALFA S.A.C.',
          tipOper: '1',
          tipOperCode: '1',
          ctaGasto: '60111',
          ctaAbono: '4212',
          moneda: 'SOLES',
          tc: 1,
          bi: 5000,
          igv: 900,
          noGravada: 0,
          isc: 0,
          total: 5900,
          glosa: 'COMPRA DE MERCADERÍAS',
          detraccion: 0
        },
        {
          id: `sample-purchase-${Date.now()}-2`,
          registro: '000002',
          fecha: '20/01/2026',
          fecVcto: '20/01/2026',
          tipo_doc: '01',
          serie: 'F002',
          numero: '0045',
          doc_tipo: '6',
          doc_num: '20518574923',
          nombre: 'IMPORTACIONES BETA E.I.R.L.',
          tipOper: '1',
          tipOperCode: '1',
          ctaGasto: '60111',
          ctaAbono: '4212',
          moneda: 'SOLES',
          tc: 1,
          bi: 3200,
          igv: 576,
          noGravada: 0,
          isc: 0,
          total: 3776,
          glosa: 'COMPRA DE SUMINISTROS',
          detraccion: 0
        },
      ];
      for (const p of samplePurchases) {
        await savePurchase(p as any);
      }

      // Sample sales
      const sampleSales = [
        {
          id: `sample-sale-${Date.now()}-1`,
          registro: '000001',
          fecha: '18/01/2026',
          fecVcto: '18/01/2026',
          tipo_doc: '01',
          serie: 'F001',
          numero: '0001',
          doc_tipo: '6',
          doc_num: '20601234567',
          nombre: 'CLIENTE GAMMA S.A.',
          tipOper: '1',
          tipOperCode: '1',
          ctaCargo: '1212',
          ctaIngreso: '70111',
          moneda: 'SOLES',
          tc: 1,
          bi: 8000,
          igv: 1440,
          noGravada: 0,
          isc: 0,
          total: 9440,
          glosa: 'VENTA DE MERCADERÍAS',
          detraccion: 0
        },
        {
          id: `sample-sale-${Date.now()}-2`,
          registro: '000002',
          fecha: '25/01/2026',
          fecVcto: '25/01/2026',
          tipo_doc: '03',
          serie: 'B001',
          numero: '0001',
          doc_tipo: '1',
          doc_num: '00000000',
          nombre: 'CONSUMIDOR FINAL',
          tipOper: '1',
          tipOperCode: '1',
          ctaCargo: '1212',
          ctaIngreso: '70111',
          moneda: 'SOLES',
          tc: 1,
          bi: 1500,
          igv: 270,
          noGravada: 0,
          isc: 0,
          total: 1770,
          glosa: 'VENTA AL CONTADO',
          detraccion: 0
        },
      ];
      for (const s of sampleSales) {
        await saveSale(s as any);
      }

      // Sample journal entries
      await saveAsiento(
        { asiento: '001', fecEmi: '15/01/2026', glosa: 'COMPRA DE MERCADERÍAS AL CONTADO', anio: '2026', mes: '01' },
        [
          { id: Date.now(), cuenta: '60111', detalle: 'MERCADERÍAS MANUFACTURADAS', debe: 5000, haber: 0 },
          { id: Date.now() + 1, cuenta: '40111', detalle: 'IGV - CUENTA PROPIA', debe: 900, haber: 0 },
          { id: Date.now() + 2, cuenta: '4212', detalle: 'EMITIDAS EN CARTERA', debe: 0, haber: 5900 },
          { id: Date.now() + 3, cuenta: '20111', detalle: 'MERCADERÍAS MANUFACTURADAS - COSTO', debe: 5000, haber: 0 },
          { id: Date.now() + 4, cuenta: '61111', detalle: 'MERCADERÍAS MANUFACTURADAS', debe: 0, haber: 5000 },
        ]
      );

      await saveAsiento(
        { asiento: '002', fecEmi: '18/01/2026', glosa: 'VENTA DE MERCADERÍAS AL CONTADO', anio: '2026', mes: '01' },
        [
          { id: Date.now() + 10, cuenta: '1212', detalle: 'EMITIDAS EN CARTERA', debe: 9440, haber: 0 },
          { id: Date.now() + 11, cuenta: '40111', detalle: 'IGV - CUENTA PROPIA', debe: 0, haber: 1440 },
          { id: Date.now() + 12, cuenta: '70111', detalle: 'MERCADERÍAS MANUFACTURADAS - TERCEROS', debe: 0, haber: 8000 },
          { id: Date.now() + 13, cuenta: '69111', detalle: 'MERCADERÍAS - COSTO DE VENTAS', debe: 4000, haber: 0 },
          { id: Date.now() + 14, cuenta: '20111', detalle: 'MERCADERÍAS MANUFACTURADAS - COSTO', debe: 0, haber: 4000 },
        ]
      );

      await saveAsiento(
        { asiento: '003', fecEmi: '31/01/2026', glosa: 'DESTINO DEL GASTO - CENTRALIZACIÓN CLASE 9', anio: '2026', mes: '01' },
        [
          { id: Date.now() + 20, cuenta: '94', detalle: 'GASTOS ADMINISTRATIVOS', debe: 2000, haber: 0 },
          { id: Date.now() + 21, cuenta: '95', detalle: 'GASTOS DE VENTAS', debe: 1500, haber: 0 },
          { id: Date.now() + 22, cuenta: '79', detalle: 'CARGAS IMP. A CTAS DE COSTOS Y GASTOS', debe: 0, haber: 3500 },
        ]
      );

      // Set company defaults for student
      if (!currentCompany.name || currentCompany.name === 'Empresa') {
        updateCompany({
          name: 'EMPRESA DE PRÁCTICA ESTUDIANTIL S.A.C.',
          period: '2026',
          regimenTributario: 'RG' as RegimenCode,
          businessType: 'COMERCIAL',
          annualIncomeUIT: 600,
          ruc: '20000000001'
        });
      }

      const toast = (await import('react-hot-toast')).default;
      toast.success('🎓 ¡Datos de ejemplo cargados exitosamente! Explora los módulos.');
    } catch (err) {
      console.error('[STUDENT] Error cargando datos de ejemplo:', err);
      const toast = (await import('react-hot-toast')).default;
      toast.error('Error al cargar datos de ejemplo.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<GraduationCap size={18} className="text-indigo-400" />}
        title="Panel de Práctica"
        badge={
          <span className="ml-2 bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] border border-indigo-500/20">
            🎓 Modo Estudiante
          </span>
        }
        subtitle={`${currentCompany.name || 'Empresa de Práctica'} — Periodo ${currentCompany.period || new Date().getFullYear()}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('ASIENTOS')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
            >
              <BookText size={14} /> + Asiento
            </button>
            <button
              onClick={() => setActiveTab('HHTT')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            >
              <Scale size={14} /> Balance
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
        <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">

          {/* TIP CONTABLE */}
          <div className="bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 rounded-2xl p-5 flex items-start gap-4 animate-fade-in">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 shrink-0">
              <Lightbulb size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">💡 Tip Contable</p>
              <p className="text-sm font-medium text-app-text leading-relaxed">{currentTip.tip}</p>
              <p className="text-[10px] text-app-muted mt-1 font-bold">{currentTip.norma}</p>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-elevated group cursor-pointer" onClick={() => setActiveTab('ASIENTOS')}>
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-500"><BookText size={20} /></div>
                <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Asientos</span>
              </div>
              <h3 className="text-2xl font-black tracking-tighter">{asientos.length}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cuadreStatus.cuadrado ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {cuadreStatus.cuadrado ? '✓ Cuadrados' : `⚠ Dif: ${cuadreStatus.diferencia.toFixed(2)}`}
                </span>
                <span className="text-[10px] text-app-muted group-hover:text-indigo-500 transition-colors ml-auto flex items-center gap-1">
                  Ir <ChevronRight size={10} />
                </span>
              </div>
            </div>

            <div className="card-elevated group cursor-pointer" onClick={() => setActiveTab('COMPRAS')}>
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500"><ShoppingCart size={20} /></div>
                <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Compras</span>
              </div>
              <h3 className="text-2xl font-black tracking-tighter">{purchases.length}</h3>
              <span className="text-[10px] text-app-muted group-hover:text-violet-500 transition-colors ml-auto flex items-center gap-1 mt-2">
                Ver <ChevronRight size={10} />
              </span>
            </div>

            <div className="card-elevated group cursor-pointer" onClick={() => setActiveTab('VENTAS')}>
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500"><Tag size={20} /></div>
                <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Ventas</span>
              </div>
              <h3 className="text-2xl font-black tracking-tighter">{sales.length}</h3>
              <span className="text-[10px] text-app-muted group-hover:text-emerald-500 transition-colors ml-auto flex items-center gap-1 mt-2">
                Ver <ChevronRight size={10} />
              </span>
            </div>

            <div className="card-elevated">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500"><Activity size={20} /></div>
                <span className="text-[10px] font-bold tracking-widest text-app-muted uppercase">Mov. Diario</span>
              </div>
              <h3 className="text-2xl font-black tracking-tighter">{journal.length}</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 mt-2">
                Centralizados
              </span>
            </div>
          </div>

          {/* MIDDLE ROW: Cycle Progress + Quick Access */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cycle Progress */}
            <div className="lg:col-span-2 card-elevated !p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-app-border flex items-center justify-between">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-app-text flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  Progreso del Ciclo Contable
                </h3>
                <span className="text-[10px] font-bold text-indigo-400">{completedSteps}/5 pasos</span>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: 'Plan Contable cargado', done: cycleProgress.hasPlan, tab: 'PLAN', icon: BookText },
                  { label: 'Registrar compras', done: cycleProgress.hasCompras, tab: 'COMPRAS', icon: ShoppingCart },
                  { label: 'Registrar ventas', done: cycleProgress.hasVentas, tab: 'VENTAS', icon: Tag },
                  { label: 'Crear asientos contables', done: cycleProgress.hasAsientos, tab: 'ASIENTOS', icon: BookText },
                  { label: 'Centralizar en Libro Diario', done: cycleProgress.hasJournal, tab: 'DIARIO', icon: CalendarDays },
                ].map((step, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(step.tab)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-app-hover transition-all group"
                  >
                    {step.done ? (
                      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                    ) : (
                      <Circle size={18} className="text-app-border shrink-0" />
                    )}
                    <span className={`text-xs font-bold ${step.done ? 'text-emerald-500 line-through opacity-70' : 'text-app-text group-hover:text-indigo-400'} transition-colors`}>
                      {i + 1}. {step.label}
                    </span>
                    <ChevronRight size={12} className="text-app-border group-hover:text-indigo-400 transition-colors ml-auto shrink-0" />
                  </button>
                ))}

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="h-2 bg-app-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${(completedSteps / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Access */}
            <div className="card-elevated !p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-app-border">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-app-text flex items-center gap-2">
                  <ChevronRight size={14} className="text-indigo-400" /> Acceso Rápido
                </h3>
              </div>
              <div className="p-3 space-y-1.5">
                {[
                  { label: 'Asientos Contables', icon: BookText, tab: 'ASIENTOS', desc: 'Crear asiento manual' },
                  { label: 'Balance de Comprobación', icon: Scale, tab: 'HHTT', desc: 'Hoja de trabajo' },
                  { label: 'Estado de Resultados', icon: Calculator, tab: 'EGYP', desc: 'Ganancias y pérdidas' },
                  { label: 'Situación Financiera', icon: BarChart3, tab: 'BALANCE', desc: 'Balance general' },
                  { label: 'Libro Diario', icon: CalendarDays, tab: 'DIARIO', desc: 'Libro oficial' },
                  { label: 'Libro Mayor', icon: BarChart3, tab: 'MAYOR', desc: 'Cuentas individuales' },
                ].map(item => (
                  <button
                    key={item.tab}
                    onClick={() => setActiveTab(item.tab)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-app-hover transition-all group"
                  >
                    <div className="p-2 bg-app-bg rounded-lg text-app-muted group-hover:text-indigo-400 transition-colors shrink-0">
                      <item.icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-app-text group-hover:text-indigo-400 transition-colors">{item.label}</p>
                      <p className="text-[9px] text-app-muted truncate">{item.desc}</p>
                    </div>
                    <ChevronRight size={14} className="text-app-border group-hover:text-indigo-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CONFIG SECTION */}
          <div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-app-muted hover:text-indigo-400 transition-colors mb-3"
            >
              <GraduationCap size={14} />
              Configuración de Práctica
              <ChevronRight size={12} className={`transition-transform duration-200 ${showConfig ? 'rotate-90' : ''}`} />
            </button>

            {showConfig && (
              <div className="card-elevated animate-slide-up space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Nombre */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Building2 size={12} className="text-indigo-400" /> Nombre de Práctica
                    </label>
                    <input
                      type="text"
                      value={currentCompany.name || ''}
                      onChange={(e) => updateCompany({ name: e.target.value })}
                      placeholder="Ej. EMPRESA DE PRÁCTICA S.A.C."
                      className="w-full text-sm font-bold"
                    />
                  </div>

                  {/* Periodo */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <CalendarDays size={12} className="text-indigo-400" /> Periodo Contable
                    </label>
                    <select
                      value={currentCompany.period || '2026'}
                      onChange={(e) => updateCompany({ period: e.target.value })}
                      className="w-full text-sm font-bold"
                    >
                      {Array.from({ length: 10 }, (_, i) => 2020 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rubro / Sector */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted flex items-center gap-2">
                      <Activity size={12} className="text-indigo-400" /> Rubro / Sector
                    </label>
                    <select
                      value={currentCompany.businessType || 'COMERCIAL'}
                      onChange={(e) => updateCompany({ businessType: e.target.value as any })}
                      className="w-full text-sm font-bold"
                    >
                      <option value="COMERCIAL">COMERCIAL</option>
                      <option value="MANUFACTURERA">MANUFACTURERA</option>
                      <option value="SERVICIOS">SERVICIOS</option>
                    </select>
                    <p className="text-[9px] text-app-muted leading-snug">
                      ⚠️ El rubro afecta las cuentas del Balance de Comprobación (ej. Clase 6 y Clase 9).
                    </p>
                  </div>
                </div>

                {/* Load Sample Data */}
                <div className="flex items-center gap-4 pt-4 border-t border-app-border">
                  <button
                    onClick={handleLoadSampleData}
                    disabled={isLoadingSample}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isLoadingSample ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Cargar Datos de Ejemplo
                  </button>
                  <p className="text-[10px] text-app-muted">
                    Carga 2 compras, 2 ventas y 3 asientos de ejemplo para practicar el ciclo contable.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
