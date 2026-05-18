import React, { useState } from 'react';
import { TrendingUp, Printer, FileDown, Layers, Layout } from 'lucide-react';
import { useStore } from '../store';
import { exportRawDataToXLSX } from '../utils/export';

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
  const { currentCompany } = useStore();
  const journal = useStore().journal.filter(entry => entry.cta.trim().toUpperCase() !== 'GLOSA');
  const [viewMode, setViewMode] = useState<'FUNCION' | 'NATURALEZA'>('FUNCION');

  // Aggregate results from journal with trimming
  const accountBalances = journal.reduce((acc, entry) => {
    const cta = (entry.cta || '').trim();
    if (!cta) return acc;
    acc[cta] = (acc[cta] || 0) + (entry.debe - entry.haber);
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
    const title = `ESTADO DE RESULTADOS INTEGRALES (POR ${viewMode === 'FUNCION' ? 'FUNCIÓN' : 'NATURALEZA'})`;
    const data = viewMode === 'FUNCION' ? [
      ['RUBRO', 'MONTO S/'],
      ['VENTAS / INGRESOS OPERACIONALES', fVentasBrutas.toFixed(2)],
      ['OTROS INGRESOS DE GESTION', fOtrosIngresos.toFixed(2)],
      ['TOTAL INGRESOS BRUTOS', fTotalIngresos.toFixed(2)],
      [],
      ['COSTO DE VENTAS', fCostoVentas.toFixed(2)],
      ['UTILIDAD BRUTA', fUtilidadBruta.toFixed(2)],
      [],
      ['GASTOS ADMINISTRATIVOS', fGastosAdmin.toFixed(2)],
      ['GASTOS DE VENTAS', fGastosVentas.toFixed(2)],
      ['UTILIDAD OPERATIVA', fUtilidadOperativa.toFixed(2)],
    ] : [
      ['RUBRO', 'MONTO S/'],
      ['VENTAS NETAS', nVentasBrutas.toFixed(2)],
      ['COMPRAS DE MERCADERIAS', nCompras.toFixed(2)],
      ['VARIACION DE MERCADERIAS', nVariacionInventario.toFixed(2)],
      ['MARGEN COMERCIAL', nMargenComercial.toFixed(2)],
      [],
      ['VARIACION DE LA PRODUCCION ALMACENADA', nVariacionExist.toFixed(2)],
      ['GASTOS DE SERVICIOS PRESTADOS POR TERCEROS', nServiciosTerceros.toFixed(2)],
      ['VALOR AGREGADO', nValorAgregado.toFixed(2)],
      [],
      ['GASTOS DE PERSONAL, DIRECTORES Y GERENTES', nGastosPersonal.toFixed(2)],
      ['GASTOS POR TRIBUTOS', nTributos.toFixed(2)],
      ['EXCEDENTE (INSUFICIENCIA) BRUTO DE EXPLOTACION', nExcedenteBruto.toFixed(2)],
    ];

    exportRawDataToXLSX(`Estado_Resultados_${viewMode}`, [
      [title],
      ['EMPRESA:', currentCompany.name],
      ['RUC:', currentCompany.ruc],
      ['PERIODO:', currentCompany.period || '2025'],
      [],
      ...data,
      [],
      ['INGRESOS FINANCIEROS', ingresosFinancieros.toFixed(2)],
      ['GASTOS FINANCIEROS', gastosFinancieros.toFixed(2)],
      ['RESULTADO ANTES DE PART. E IR', currentResultAntes.toFixed(2)],
      ['(-) PARTICIPACION DE TRABAJADORES (CTA 87)', participacionTrabajadores.toFixed(2)],
      ['(-) IMPUESTO A LA RENTA (CTA 88)', impuestoRenta.toFixed(2)],
      [],
      ['UTILIDAD (PERDIDA) NETA DEL EJERCICIO', currentUtilidadNeta.toFixed(2)]
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-slide-up relative">

      {/* Header Toolbar */}
      <div className="h-12 px-5 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 toolbar">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pld-blue/10 rounded-lg">
            <TrendingUp size={16} className="text-pld-blue" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-app-text">Estado de Resultados Integrales</h2>
            <div className="flex gap-3 text-[9px] items-center text-app-muted">
               <span>AL 31 DE DICIEMBRE DEL {currentCompany.period || '2025'}</span>
               <span>(Nuevos Soles)</span>
               <span>RUC: {currentCompany.ruc}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* View Selector Toggle */}
           <div className="flex bg-app-bg border border-app-border p-1 rounded-xl shadow-inner">
             <button 
               onClick={() => setViewMode('FUNCION')}
               className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'FUNCION' ? 'bg-pld-blue text-white shadow-md' : 'text-app-muted hover:text-pld-blue'}`}
             >
               <Layout size={12} /> Función
             </button>
             <button 
               onClick={() => setViewMode('NATURALEZA')}
               className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'NATURALEZA' ? 'bg-pld-blue text-white shadow-md' : 'text-app-muted hover:text-pld-blue'}`}
             >
               <Layers size={12} /> Naturaleza
             </button>
           </div>

           <div className="h-6 w-px bg-app-border" />

           <div className="flex gap-2">
              <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Imprimir"><Printer size={14} /> Imprimir</button>
              <button onClick={handleExport} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Excel"><FileDown size={14} /> Excel</button>
           </div>
        </div>
      </div>

      {/* Content Area */}
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
  );
};

export default EgypView;
