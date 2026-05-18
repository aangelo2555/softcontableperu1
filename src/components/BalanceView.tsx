import React from 'react';
import { Landmark, Printer, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { exportRawDataToXLSX } from '../utils/export';

const ReportLine: React.FC<{ label: string; value: number; indent?: boolean; subtract?: boolean }> = ({ label, value, indent, subtract }) => {
  const formattedValue = value !== 0 ? Math.abs(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
  const isNegative = value < 0 || subtract;
  return (
    <div className={`flex justify-between text-[11px] py-1 border-b border-app-border/40 ${indent ? 'pl-6' : ''}`}>
      <span className={indent ? 'text-app-muted font-sans text-xs' : 'font-black uppercase tracking-wider text-xs'}>{label}</span>
      <span className={`font-mono text-xs ${isNegative && value !== 0 ? 'text-red-500 font-semibold' : 'text-app-text'}`}>
        {isNegative && value !== 0 ? `(${formattedValue})` : formattedValue}
      </span>
    </div>
  );
};

const BalanceView: React.FC = () => {
  const { currentCompany } = useStore();
  const journal = useStore().journal.filter(entry => entry.cta.trim().toUpperCase() !== 'GLOSA');

  // Logic to derive balance amounts from journal
  const accountBalances = journal.reduce((acc, entry) => {
    acc[entry.cta] = (acc[entry.cta] || 0) + (entry.debe - entry.haber);
    return acc;
  }, {} as Record<string, number>);

  const getSum = (prefixes: string[]) => {
    return Object.entries(accountBalances).reduce((sum, [cta, bal]) => {
      if (prefixes.some(p => cta.startsWith(p))) return sum + bal;
      return sum;
    }, 0);
  };

  // --- ACTIVO CORRIENTE ---
  const efectivo = getSum(['10']);
  const inversionesCP = getSum(['11']);
  const ctasComerciales = getSum(['12']);
  const cobranzaDudosa = getSum(['19']); // Negative asset (debit-positive)
  const ctasRelacionadas = getSum(['13']);
  const otrasCtasCobrar = getSum(['14', '16', '17']);
  const anticiposActivo = getSum(['18']);
  
  // existencias grouped
  const existencias = getSum(['20', '21', '22', '23', '24', '25', '26', '27', '28']);
  const desvalorizacionExistencias = getSum(['29']); // Negative asset (debit-positive)

  const totalActivoCorriente = efectivo + inversionesCP + ctasComerciales + cobranzaDudosa + ctasRelacionadas + otrasCtasCobrar + anticiposActivo + existencias + desvalorizacionExistencias;

  // --- ACTIVO NO CORRIENTE ---
  const inversionesMobiliarias = getSum(['30']);
  const inversionesInmobiliarias = getSum(['31']);
  const derechoUso = getSum(['32']);
  const imeBruto = getSum(['33', '35']);
  const depreciacionAcumulada = getSum(['39']); // Negative asset (debit-positive)
  const activosBiologicos = getSum(['37']);
  const intangibles = getSum(['34']);
  const otrosActivosNoCorrientes = getSum(['38']);

  const totalActivoNoCorriente = inversionesMobiliarias + inversionesInmobiliarias + derechoUso + imeBruto + depreciacionAcumulada + activosBiologicos + intangibles + otrosActivosNoCorrientes;

  const totalActivo = totalActivoCorriente + totalActivoNoCorriente;

  // --- PASIVO CORRIENTE ---
  const tributos = -getSum(['40']);
  const remunPorPagar = -getSum(['41']);
  const ctasPagarComerciales = -getSum(['42']);
  const ctasPagarRelacionadas = -getSum(['43']);
  const obligacionesFinan = -getSum(['45']);
  const otrasCtasPagar = -getSum(['44', '46', '47']);
  const pasivoDiferido = -getSum(['49']);

  const totalPasivoCorriente = tributos + remunPorPagar + ctasPagarComerciales + ctasPagarRelacionadas + obligacionesFinan + otrasCtasPagar + pasivoDiferido;

  // --- PASIVO NO CORRIENTE ---
  const provisionesLP = -getSum(['48']);
  const totalPasivoNoCorriente = provisionesLP;

  const totalPasivo = totalPasivoCorriente + totalPasivoNoCorriente;

  // --- PATRIMONIO ---
  const capitalSocial = -getSum(['50']);
  const capitalAdicional = -getSum(['51', '52']);
  const excedenteReval = -getSum(['57']);
  const reservas = -getSum(['56', '58']);
  const resultadosAcumulados = -getSum(['59']);

  // Utilidad del Ejercicio
  const utilidadEjercicio = totalActivo - totalPasivo - capitalSocial - capitalAdicional - excedenteReval - reservas - resultadosAcumulados;

  const totalPatrimonio = capitalSocial + capitalAdicional + excedenteReval + reservas + resultadosAcumulados + utilidadEjercicio;

  const handleExport = () => {
    exportRawDataToXLSX('Estado_de_Situacion_Financiera', [
      ['ESTADO DE SITUACIÓN FINANCIERA CONSOLIDADO (PCGE 2024/2025)'],
      ['EMPRESA:', currentCompany.name],
      ['RUC:', currentCompany.ruc],
      ['PERIODO:', currentCompany.period || '2025'],
      [],
      ['ACTIVO', '', '', 'PASIVO Y PATRIMONIO', ''],
      ['ACTIVO CORRIENTE', '', '', 'PASIVO CORRIENTE', ''],
      ['Efectivo y Equivalentes de Efectivo', efectivo.toFixed(2), '', 'Tributos por Pagar', tributos.toFixed(2)],
      ['Inversiones Financieras CP', inversionesCP.toFixed(2), '', 'Remuneraciones por Pagar', remunPorPagar.toFixed(2)],
      ['Cuentas por Cobrar Comerciales', ctasComerciales.toFixed(2), '', 'Cuentas por Pagar Comerciales', ctasPagarComerciales.toFixed(2)],
      ['(-) Estimación de Cobranza Dudosa', cobranzaDudosa.toFixed(2), '', 'Cuentas por Pagar Relacionadas', ctasPagarRelacionadas.toFixed(2)],
      ['Cuentas por Cobrar Relacionadas', ctasRelacionadas.toFixed(2), '', 'Obligaciones Financieras CP', obligacionesFinan.toFixed(2)],
      ['Otras Cuentas por Cobrar', otrasCtasCobrar.toFixed(2), '', 'Otras Cuentas por Pagar', otrasCtasPagar.toFixed(2)],
      ['Anticipos Otorgados', anticiposActivo.toFixed(2), '', 'Pasivo Diferido CP', pasivoDiferido.toFixed(2)],
      ['Inventarios / Existencias', existencias.toFixed(2), '', 'TOTAL PASIVO CORRIENTE', totalPasivoCorriente.toFixed(2)],
      ['(-) Desvalorización de Inventarios', desvalorizacionExistencias.toFixed(2), '', '', ''],
      ['TOTAL ACTIVO CORRIENTE', totalActivoCorriente.toFixed(2), '', 'PASIVO NO CORRIENTE', ''],
      ['', '', '', 'Provisiones LP', provisionesLP.toFixed(2)],
      ['ACTIVO NO CORRIENTE', '', '', 'TOTAL PASIVO NO CORRIENTE', totalPasivoNoCorriente.toFixed(2)],
      ['Inversiones Mobiliarias', inversionesMobiliarias.toFixed(2), '', 'TOTAL PASIVO', totalPasivo.toFixed(2)],
      ['Inversiones Inmobiliarias', inversionesInmobiliarias.toFixed(2), '', '', ''],
      ['Activos por Derecho de Uso', derechoUso.toFixed(2), '', 'PATRIMONIO NETO', ''],
      ['Inmuebles, Maquinaria y Equipo (IME)', imeBruto.toFixed(2), '', 'Capital Social', capitalSocial.toFixed(2)],
      ['(-) Depreciación y Amortización Acumulada', depreciacionAcumulada.toFixed(2), '', 'Capital Adicional', capitalAdicional.toFixed(2)],
      ['Activos Biológicos', activosBiologicos.toFixed(2), '', 'Excedente de Revaluación', excedenteReval.toFixed(2)],
      ['Intangibles', intangibles.toFixed(2), '', 'Reservas / Otras Reservas', reservas.toFixed(2)],
      ['Otros Activos no Corrientes', otrosActivosNoCorrientes.toFixed(2), '', 'Resultados Acumulados', resultadosAcumulados.toFixed(2)],
      ['', '', '', 'Resultados del Ejercicio', utilidadEjercicio.toFixed(2)],
      ['TOTAL ACTIVO NO CORRIENTE', totalActivoNoCorriente.toFixed(2), '', 'TOTAL PATRIMONIO NETO', totalPatrimonio.toFixed(2)],
      [],
      ['TOTAL ACTIVO', totalActivo.toFixed(2), '', 'TOTAL PASIVO Y PATRIMONIO', (totalPasivo + totalPatrimonio).toFixed(2)],
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-slide-up relative">

      {/* Header Toolbar */}
      <div className="h-12 px-5 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 toolbar">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pld-blue/10 rounded-lg">
            <Landmark size={16} className="text-pld-blue" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-app-text">Estado de Situación Financiera</h2>
            <div className="flex gap-3 text-[9px] items-center text-app-muted">
               <span>AL 31 DE DICIEMBRE DEL {currentCompany.period || '2025'}</span>
               <span>(Nuevos Soles)</span>
               <span>RUC: {currentCompany.ruc}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Imprimir"><Printer size={14} /> Imprimir</button>
           <button onClick={handleExport} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Excel"><FileDown size={14} /> Excel</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-app-bg/50">
        <div className="max-w-6xl mx-auto bg-app-surface border border-app-border shadow-2xl p-10 rounded-lg print:shadow-none print:border-none">
          
          <div className="grid grid-cols-2 gap-16">
            
            {/* LEFT COLUMN: ACTIVO */}
            <div className="space-y-6">
              <h3 className="text-sm font-black border-b-2 border-app-border pb-1 tracking-[0.3em] mb-4 text-pld-blue">A C T I V O</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-pld-blue uppercase tracking-widest mb-2">ACTIVO CORRIENTE</h4>
                  <ReportLine label="Efectivo y Equivalentes de Efectivo" value={efectivo} indent />
                  <ReportLine label="Inversiones Financieras CP" value={inversionesCP} indent />
                  <ReportLine label="Cuentas por Cobrar Comerciales" value={ctasComerciales} indent />
                  <ReportLine label="(-) Estimación de Cobranza Dudosa" value={cobranzaDudosa} indent subtract />
                  <ReportLine label="Cuentas por Cobrar Relacionadas" value={ctasRelacionadas} indent />
                  <ReportLine label="Otras Cuentas por Cobrar" value={otrasCtasCobrar} indent />
                  <ReportLine label="Anticipos Otorgados" value={anticiposActivo} indent />
                  <ReportLine label="Inventarios / Existencias" value={existencias} indent />
                  <ReportLine label="(-) Desvalorización de Inventarios" value={desvalorizacionExistencias} indent subtract />
                  <div className="flex justify-end pt-2">
                    <span className="font-mono text-xs font-black border-t-2 border-app-border pt-1 w-32 text-right text-pld-blue">
                      {totalActivoCorriente.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-pld-blue uppercase tracking-widest mb-2 mt-4">ACTIVO NO CORRIENTE</h4>
                  <ReportLine label="Inversiones Mobiliarias" value={inversionesMobiliarias} indent />
                  <ReportLine label="Inversiones Inmobiliarias" value={inversionesInmobiliarias} indent />
                  <ReportLine label="Activos por Derecho de Uso" value={derechoUso} indent />
                  <ReportLine label="Inmuebles, Maquinaria y Equipo (IME)" value={imeBruto} indent />
                  <ReportLine label="(-) Depreciación y Amortización Acumulada" value={depreciacionAcumulada} indent subtract />
                  <ReportLine label="Activos Biológicos" value={activosBiologicos} indent />
                  <ReportLine label="Intangibles" value={intangibles} indent />
                  <ReportLine label="Otros Activos no Corrientes" value={otrosActivosNoCorrientes} indent />
                  <div className="flex justify-end pt-2">
                    <span className="font-mono text-xs font-black border-t-2 border-app-border pt-1 w-32 text-right text-pld-blue">
                      {totalActivoNoCorriente.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-10 flex justify-between items-center border-t-2 border-app-border">
                <span className="text-xs font-black tracking-widest uppercase">TOTAL ACTIVO</span>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] text-app-muted font-bold">S/.</span>
                   <span className="text-lg font-mono font-black text-pld-blue border-b-4 border-double border-pld-blue/40">
                    {totalActivo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PASIVO Y PATRIMONIO */}
            <div className="space-y-6">
              <h3 className="text-sm font-black border-b-2 border-app-border pb-1 tracking-[0.3em] mb-4 text-right text-red-500">P A S I V O   Y   P A T R I M O N I O</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">PASIVO CORRIENTE</h4>
                  <ReportLine label="Tributos por Pagar" value={tributos} indent />
                  <ReportLine label="Remuneraciones por Pagar" value={remunPorPagar} indent />
                  <ReportLine label="Cuentas por Pagar Comerciales" value={ctasPagarComerciales} indent />
                  <ReportLine label="Cuentas por Pagar Relacionadas" value={ctasPagarRelacionadas} indent />
                  <ReportLine label="Obligaciones Financieras CP" value={obligacionesFinan} indent />
                  <ReportLine label="Otras Cuentas por Pagar" value={otrasCtasPagar} indent />
                  <ReportLine label="Pasivo Diferido CP" value={pasivoDiferido} indent />
                  <div className="flex justify-end pt-2">
                    <span className="font-mono text-xs font-black border-t-2 border-app-border pt-1 w-32 text-right text-red-500">
                      {totalPasivoCorriente.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 mt-4">PASIVO NO CORRIENTE</h4>
                  <ReportLine label="Provisiones Largo Plazo" value={provisionesLP} indent />
                  <div className="flex justify-end pt-2">
                    <span className="font-mono text-xs font-black border-t-2 border-app-border pt-1 w-32 text-right text-red-500">
                      {totalPasivoNoCorriente.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-pld-magenta uppercase tracking-widest mb-2 mt-4">PATRIMONIO NETO</h4>
                  <ReportLine label="Capital Social" value={capitalSocial} indent />
                  <ReportLine label="Capital Adicional" value={capitalAdicional} indent />
                  <ReportLine label="Excedente de Revaluación" value={excedenteReval} indent />
                  <ReportLine label="Reservas / Otras Reservas" value={reservas} indent />
                  <ReportLine label="Resultados Acumulados" value={resultadosAcumulados} indent />
                  <ReportLine label="Resultados del Ejercicio" value={utilidadEjercicio} indent />
                  <div className="flex justify-end pt-2">
                    <span className="font-mono text-xs font-black border-t-2 border-app-border pt-1 w-32 text-right text-pld-magenta">
                      {totalPatrimonio.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-10 flex justify-between items-center border-t-2 border-app-border">
                <span className="text-xs font-black tracking-widest uppercase">TOTAL PASIVO Y PATRIMONIO</span>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] text-app-muted font-bold">S/.</span>
                   <span className="text-lg font-mono font-black text-app-text border-b-4 border-double border-app-text/40">
                    {(totalPasivo + totalPatrimonio).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </span>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-12 pt-4 border-t border-app-border/50 text-right flex justify-between items-center bg-app-bg px-4 py-2 rounded-lg">
             <span className="text-[9px] text-app-muted font-bold uppercase tracking-widest">Diferencia de Ecuación Contable (Activo - Pasivo y Patrimonio)</span>
             <span className="font-mono text-sm text-app-muted font-bold">
              {Math.abs(totalActivo - (totalPasivo + totalPatrimonio)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BalanceView;
