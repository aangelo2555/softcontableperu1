import React, { useState, useEffect } from 'react';
import { TrendingUp, Printer, FileDown, Layers, Layout } from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import StaleWarningBanner from './shared/StaleWarningBanner';
import toast from 'react-hot-toast';
import PageHeader from './ui/PageHeader';

const EgypLine: React.FC<{ label: string; value: number; indent?: boolean; bold?: boolean; isTotal?: boolean; isNet?: boolean }> = ({ label, value, indent, bold, isTotal, isNet }) => (
  <div className={`flex justify-between text-[11px] py-1 border-b border-app-border/50 ${indent ? 'pl-8' : ''} ${isTotal ? 'border-t-2 border-app-border pt-2' : ''} ${isNet ? 'bg-pld-blue/10 p-2 rounded border-none mt-4 ring-1 ring-pld-blue/20' : ''}`}>
    <span className={`${bold || isNet || isTotal ? 'font-black uppercase tracking-widest' : 'text-app-muted font-sans'} ${isNet ? 'text-pld-blue' : ''}`}>{label}</span>
    <div className="flex items-center gap-1">
      {value < 0 && <span className="text-red-500 font-semibold font-mono">({Math.abs(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>}
      {value >= 0 && <span className={`font-mono ${isNet ? 'text-lg text-pld-blue font-bold' : 'text-app-text'}`}>
        {value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>}
    </div>
  </div>
);

const EgypView: React.FC = () => {
  const store = useStore();
  const currentCompany = store.currentCompany || {} as any;
  const staleVersions = Array.isArray(store.staleVersions) ? store.staleVersions : [];
  const rawJournal = Array.isArray(store.journal) ? store.journal : [];
  const journal = rawJournal.filter(entry => entry.cta?.trim().toUpperCase() !== 'GLOSA');
  const { syncStaleVersions, markSynced } = store;
  const [viewMode, setViewMode] = useState<'FUNCION' | 'NATURALEZA'>('FUNCION');

  const currentYear = currentCompany.period || '2025';

  // Determine the most common month from journal entries
  const monthCounts: Record<string, number> = {};
  journal.forEach(entry => {
    const parts = entry.fecha.includes('/') ? entry.fecha.split('/') : entry.fecha.split('-');
    const m = entry.fecha.includes('/') ? parts[1] : parts[1];
    if (m) monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  const dominantMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '12';
  const periodStr = `${currentYear}-${dominantMonth.padStart(2, '0')}`;

  useEffect(() => {
    syncStaleVersions(periodStr);
  }, [periodStr, syncStaleVersions]);

  const eeffStale = staleVersions.find((x: any) => x.module === 'eeff');
  const isStale = eeffStale?.is_stale === 1 || eeffStale?.is_stale === true;
  const staleSince = eeffStale?.stale_since;

  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    await markSynced('eeff', periodStr);
    setIsRecalculating(false);
    toast.success('Estado de Resultados recalculado con éxito');
  };

  // Aggregate results from journal with trimming
  const accountBalances = journal.reduce((acc, entry) => {
    const cta = (entry.cta || '').trim();
    if (!cta) return acc;
    const d = typeof entry.debe === 'number' ? entry.debe : (parseFloat(String(entry.debe || 0)) || 0);
    const h = typeof entry.haber === 'number' ? entry.haber : (parseFloat(String(entry.haber || 0)) || 0);
    acc[cta] = (acc[cta] || 0) + (d - h);
    return acc;
  }, {} as Record<string, number>);

  const getSum = (prefixes: string[]) => {
    return Object.entries(accountBalances).reduce((sum, [cta, bal]) => {
      if (prefixes.some(p => cta.startsWith(p))) return sum + bal;
      return sum;
    }, 0);
  };

  // --- Common ---
  const ingresosFinancieros = -getSum(['77']);
  const gastosFinancieros = getSum(['67', '97']); // Support both nature and function finance costs
  const impuestoRenta = getSum(['88']);
  const participacionTrabajadores = getSum(['87']);

  // --- Logic: POR FUNCIÓN ---
  const fVentasBrutas = -getSum(['70']);
  const fOtrosIngresos = -getSum(['75', '76']);
  const fTotalIngresos = fVentasBrutas + fOtrosIngresos;
  const fCostoVentas = getSum(['69']);
  const fUtilidadBruta = fVentasBrutas - fCostoVentas;
  const fGastosAdmin = getSum(['94']);
  const fGastosVentas = getSum(['95']);
  const fUtilidadOperativa = fUtilidadBruta - fGastosAdmin - fGastosVentas + fOtrosIngresos;
  const fResultAntesDePartIR = fUtilidadOperativa + ingresosFinancieros - gastosFinancieros;
  const fUtilidadNeta = fResultAntesDePartIR - participacionTrabajadores - impuestoRenta;

  // --- Logic: POR NATURALEZA ---
  const nVentasBrutas = -getSum(['70']);
  const nOtrosIngresos = -getSum(['75', '76']);
  const nVariacionExist = -getSum(['71']); // Variación de la producción almacenada
  const nCompras = getSum(['60']);
  const nVariacionInventario = getSum(['61']);
  const nServiciosTerceros = getSum(['63']);
  
  const nMargenComercial = nVentasBrutas - (nCompras + nVariacionInventario);
  
  const nProduccionInmov = -getSum(['72']);
  const nValorAgregado = nMargenComercial + nProduccionInmov + nVariacionExist - nServiciosTerceros;
  
  const nGastosPersonal = getSum(['62']);
  const nTributos = getSum(['64']);
  const nExcedenteBruto = nValorAgregado - nGastosPersonal - nTributos;
  
  const nOtrosGastosGest = getSum(['65']);
  const nValuacionDeterioro = getSum(['68']);
  const nUtilidadOperativa = nExcedenteBruto - nOtrosGastosGest - nValuacionDeterioro + nOtrosIngresos;
  const nResultAntesDePartIR = nUtilidadOperativa + ingresosFinancieros - gastosFinancieros;
  const nUtilidadNeta = nResultAntesDePartIR - participacionTrabajadores - impuestoRenta;

  const currentUtilidadNeta = viewMode === 'FUNCION' ? fUtilidadNeta : nUtilidadNeta;
  const currentResultAntes = viewMode === 'FUNCION' ? fResultAntesDePartIR : nResultAntesDePartIR;

  const handleExport = () => {
    const dataRows = viewMode === 'FUNCION' ? [
      { concepto: 'VENTAS / INGRESOS OPERACIONALES', importe: fVentasBrutas },
      { concepto: 'OTROS INGRESOS DE GESTIÓN', importe: fOtrosIngresos },
      { concepto: 'TOTAL INGRESOS BRUTOS', importe: fTotalIngresos },
      { concepto: 'COSTO DE VENTAS', importe: -fCostoVentas },
      { concepto: 'UTILIDAD BRUTA', importe: fUtilidadBruta },
      { concepto: 'GASTOS ADMINISTRATIVOS', importe: -fGastosAdmin },
      { concepto: 'GASTOS DE VENTAS', importe: -fGastosVentas },
      { concepto: 'UTILIDAD OPERATIVA', importe: fUtilidadOperativa }
    ] : [
      { concepto: 'VENTAS NETAS', importe: nVentasBrutas },
      { concepto: '(-) COMPRAS DE MERCADERÍAS', importe: -nCompras },
      { concepto: '(-) VARIACIÓN DE MERCADERÍAS (CTA 61)', importe: -nVariacionInventario },
      { concepto: 'MARGEN COMERCIAL', importe: nMargenComercial },
      { concepto: 'VARIACIÓN DE LA PRODUCCIÓN ALMACENADA', importe: nVariacionExist },
      { concepto: 'PRODUCCIÓN DE ACTIVO INMOVILIZADO', importe: nProduccionInmov },
      { concepto: '(-) GASTOS DE SERVICIOS PRESTADOS POR TERCEROS', importe: -nServiciosTerceros },
      { concepto: 'VALOR AGREGADO', importe: nValorAgregado },
      { concepto: '(-) GASTOS DE PERSONAL, DIRECTORES Y GERENTES', importe: -nGastosPersonal },
      { concepto: '(-) GASTOS POR TRIBUTOS', importe: -nTributos },
      { concepto: 'EXCEDENTE BRUTO DE EXPLOTACIÓN', importe: nExcedenteBruto },
      { concepto: '(-) OTROS GASTOS DE GESTIÓN', importe: -nOtrosGastosGest },
      { concepto: '(-) VALUACIÓN Y DETERIORO DE ACTIVOS Y PROV.', importe: -nValuacionDeterioro },
      { concepto: 'OTROS INGRESOS DE GESTIÓN', importe: nOtrosIngresos },
      { concepto: 'UTILIDAD OPERATIVA (POR NATURALEZA)', importe: nUtilidadOperativa }
    ];

    dataRows.push(
      { concepto: 'INGRESOS FINANCIEROS', importe: ingresosFinancieros },
      { concepto: '(-) GASTOS FINANCIEROS', importe: -gastosFinancieros },
      { concepto: 'RESULTADO ANTES DE PART. E IR', importe: currentResultAntes },
      { concepto: '(-) PARTICIPACIÓN DE TRABAJADORES (CTA 87)', importe: -participacionTrabajadores },
      { concepto: '(-) IMPUESTO A LA RENTA (CTA 88)', importe: -impuestoRenta }
    );

    exportSingleSheet({
      sheetName: `Resultados ${viewMode === 'FUNCION' ? 'Función' : 'Naturaleza'}`,
      title: `ESTADO DE RESULTADOS INTEGRALES (POR ${viewMode === 'FUNCION' ? 'FUNCIÓN' : 'NATURALEZA'})`,
      columns: [
        { header: 'CONCEPTO', key: 'concepto', width: 50 },
        { header: 'IMPORTE S/', key: 'importe', width: 22, style: 'currency' }
      ],
      rows: dataRows,
      totals: {
        concepto: 'UTILIDAD (PÉRDIDA) NETA DEL EJERCICIO',
        importe: currentUtilidadNeta
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: currentCompany?.period || String(new Date().getFullYear()),
      }
    }, `Estado_Resultados_${viewMode}`);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<TrendingUp size={18} />}
        title="Estado de Resultados"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">
            ER Integrales
          </span>
        }
        subtitle={`Periodo: AL 31 DE DICIEMBRE DEL ${currentCompany.period || '2025'} • RUC: ${currentCompany.ruc}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
             {/* View Selector Toggle */}
             <div className="flex bg-app-bg border border-app-border p-0.5 rounded-lg">
               <button 
                 onClick={() => setViewMode('FUNCION')}
                 className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${viewMode === 'FUNCION' ? 'bg-pld-blue text-white shadow-sm' : 'text-app-muted hover:text-pld-blue'}`}
               >
                 Función
               </button>
               <button 
                 onClick={() => setViewMode('NATURALEZA')}
                 className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${viewMode === 'NATURALEZA' ? 'bg-pld-blue text-white shadow-sm' : 'text-app-muted hover:text-pld-blue'}`}
               >
                 Naturaleza
               </button>
             </div>

             <div className="flex gap-2">
                <button onClick={() => window.print()} className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Imprimir"><Printer size={14} /> Imprimir</button>
                <button onClick={handleExport} className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Excel"><FileDown size={14} /> Excel</button>
             </div>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* Content Area */}
      <StaleWarningBanner
        moduleName="eeff"
        isStale={isStale}
        staleSince={staleSince}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />

      <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-app-bg/50">
        <div className="max-w-3xl mx-auto bg-app-surface border border-app-border shadow-2xl p-10 rounded-lg print:shadow-none print:border-none">
          
          <div className="text-center mb-10 space-y-1">
             <h3 className="text-sm font-black uppercase tracking-[0.4em]">{currentCompany.name}</h3>
             <p className="text-[10px] font-bold text-app-muted uppercase">Estado de Resultados Integrales (Por {viewMode === 'FUNCION' ? 'Función' : 'Naturaleza'})</p>
             <div className="h-px bg-gradient-to-r from-transparent via-pld-blue/30 to-transparent my-4" />
          </div>

          <div className="space-y-1">
             {viewMode === 'FUNCION' ? (
               <>
                 <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Ingresos y Costos Operacionales</h4>
                 <EgypLine label="VENTAS MERCADERIAS" value={fVentasBrutas} indent />
                 <EgypLine label="OTROS INGRESOS DE GESTIÓN" value={fOtrosIngresos} indent />
                 <EgypLine label="TOTAL INGRESOS BRUTOS" value={fTotalIngresos} isTotal bold />

                 <div className="h-4" />
                 <EgypLine label="COSTO DE VENTAS" value={fCostoVentas} />
                 <EgypLine label="UTILIDAD BRUTA" value={fUtilidadBruta} isTotal bold />

                 <div className="h-6" />
                 <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Gastos Operativos</h4>
                 <EgypLine label="GASTOS ADMINISTRATIVOS" value={fGastosAdmin} />
                 <EgypLine label="GASTOS DE VENTAS" value={fGastosVentas} />
                 <EgypLine label="UTILIDAD OPERATIVA" value={fUtilidadOperativa} isTotal bold />
               </>
             ) : (
               <>
                 <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Cálculo del Margen Comercial</h4>
                 <EgypLine label="VENTAS NETAS" value={nVentasBrutas} />
                 <EgypLine label="COMPRAS DE MERCADERÍAS" value={nCompras} />
                 <EgypLine label="VARIACIÓN DE MERCADERÍAS (CTA 61)" value={nVariacionInventario} />
                 <EgypLine label="MARGEN COMERCIAL" value={nMargenComercial} isTotal bold />

                 <div className="h-4" />
                 <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Producción y Valor Agregado</h4>
                 <EgypLine label="VARIACIÓN DE LA PRODUCCIÓN ALMACENADA" value={nVariacionExist} />
                 <EgypLine label="PRODUCCIÓN DE ACTIVO INMOVILIZADO" value={nProduccionInmov} />
                 <EgypLine label="GASTOS DE SERVICIOS PRESTADOS POR TERCEROS" value={nServiciosTerceros} />
                 <EgypLine label="VALOR AGREGADO" value={nValorAgregado} isTotal bold />

                 <div className="h-4" />
                 <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Excedente Bruto</h4>
                 <EgypLine label="GASTOS DE PERSONAL, DIRECTORES Y GERENTES" value={nGastosPersonal} />
                 <EgypLine label="GASTOS POR TRIBUTOS" value={nTributos} />
                 <EgypLine label="EXCEDENTE BRUTO DE EXPLOTACIÓN" value={nExcedenteBruto} isTotal bold />

                 <div className="h-4" />
                 <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Resultado de Explotación</h4>
                 <EgypLine label="OTROS GASTOS DE GESTIÓN" value={nOtrosGastosGest} />
                 <EgypLine label="VALUACIÓN Y DETERIORO DE ACTIVOS Y PROV." value={nValuacionDeterioro} />
                 <EgypLine label="OTROS INGRESOS DE GESTIÓN" value={nOtrosIngresos} />
                 <EgypLine label="UTILIDAD OPERATIVA (POR NATURALEZA)" value={nUtilidadOperativa} isTotal bold />
               </>
             )}

             <div className="h-6" />
             <h4 className="text-[10px] font-black text-pld-blue mb-2 uppercase tracking-widest">Resultados Finales</h4>

             <EgypLine label="INGRESOS FINANCIEROS" value={ingresosFinancieros} />
             <EgypLine label="GASTOS FINANCIEROS" value={gastosFinancieros} />
             <EgypLine label="RESULTADO ANTES DE PART. E IR" value={currentResultAntes} isTotal bold />

             <div className="h-6" />

             <EgypLine label="PARTICIPACIÓN DE TRABAJADORES (CTA 87)" value={participacionTrabajadores} />
             <EgypLine label="IMPUESTO A LA RENTA (CTA 88)" value={impuestoRenta} />
             <EgypLine label="UTILIDAD (PERDIDA) NETA DEL EJERCICIO" value={currentUtilidadNeta} isNet bold />
          </div>

        </div>

        </div>
      </div>
    </div>
  </div>
  );
};

export default EgypView;
