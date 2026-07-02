import React, { useEffect, useState } from 'react';
import { Landmark, Printer, FileDown } from 'lucide-react';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import StaleWarningBanner from './shared/StaleWarningBanner';
import toast from 'react-hot-toast';
import PageHeader from './ui/PageHeader';

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
  const store = useStore();
  const currentCompany = store.currentCompany || {} as any;
  const staleVersions = Array.isArray(store.staleVersions) ? store.staleVersions : [];
  const rawJournal = Array.isArray(store.journal) ? store.journal : [];
  const journal = rawJournal.filter(entry => entry.cta?.trim().toUpperCase() !== 'GLOSA');
  const { syncStaleVersions, markSynced } = store;

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
    toast.success('Estado de Situación Financiera recalculado con éxito');
  };

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
    const rows = [
      { concepto: 'ACTIVO CORRIENTE', importe: null },
      { concepto: 'Efectivo y Equivalentes de Efectivo', importe: efectivo },
      { concepto: 'Inversiones Financieras CP', importe: inversionesCP },
      { concepto: 'Cuentas por Cobrar Comerciales', importe: ctasComerciales },
      { concepto: '(-) Estimación de Cobranza Dudosa', importe: cobranzaDudosa },
      { concepto: 'Cuentas por Cobrar Relacionadas', importe: ctasRelacionadas },
      { concepto: 'Otras Cuentas por Cobrar', importe: otrasCtasCobrar },
      { concepto: 'Anticipos Otorgados', importe: anticiposActivo },
      { concepto: 'Inventarios / Existencias', importe: existencias },
      { concepto: '(-) Desvalorización de Inventarios', importe: desvalorizacionExistencias },
      { concepto: 'TOTAL ACTIVO CORRIENTE', importe: totalActivoCorriente },
      
      { concepto: '', importe: null },

      { concepto: 'ACTIVO NO CORRIENTE', importe: null },
      { concepto: 'Inversiones Mobiliarias', importe: inversionesMobiliarias },
      { concepto: 'Inversiones Inmobiliarias', importe: inversionesInmobiliarias },
      { concepto: 'Activos por Derecho de Uso', importe: derechoUso },
      { concepto: 'Inmuebles, Maquinaria y Equipo (IME)', importe: imeBruto },
      { concepto: '(-) Depreciación y Amortización Acumulada', importe: depreciacionAcumulada },
      { concepto: 'Activos Biológicos', importe: activosBiologicos },
      { concepto: 'Intangibles', importe: intangibles },
      { concepto: 'Otros Activos no Corrientes', importe: otrosActivosNoCorrientes },
      { concepto: 'TOTAL ACTIVO NO CORRIENTE', importe: totalActivoNoCorriente },

      { concepto: 'TOTAL ACTIVO', importe: totalActivo },

      { concepto: '', importe: null },

      { concepto: 'PASIVO CORRIENTE', importe: null },
      { concepto: 'Tributos por Pagar', importe: tributos },
      { concepto: 'Remuneraciones por Pagar', importe: remunPorPagar },
      { concepto: 'Cuentas por Pagar Comerciales', importe: ctasPagarComerciales },
      { concepto: 'Cuentas por Pagar Relacionadas', importe: ctasPagarRelacionadas },
      { concepto: 'Obligaciones Financieras CP', importe: obligacionesFinan },
      { concepto: 'Otras Cuentas por Pagar', importe: otrasCtasPagar },
      { concepto: 'Pasivo Diferido CP', importe: pasivoDiferido },
      { concepto: 'TOTAL PASIVO CORRIENTE', importe: totalPasivoCorriente },

      { concepto: '', importe: null },

      { concepto: 'PASIVO NO CORRIENTE', importe: null },
      { concepto: 'Provisiones LP', importe: provisionesLP },
      { concepto: 'TOTAL PASIVO NO CORRIENTE', importe: totalPasivoNoCorriente },
      
      { concepto: 'TOTAL PASIVO', importe: totalPasivo },

      { concepto: '', importe: null },

      { concepto: 'PATRIMONIO NETO', importe: null },
      { concepto: 'Capital Social', importe: capitalSocial },
      { concepto: 'Capital Adicional', importe: capitalAdicional },
      { concepto: 'Excedente de Revaluación', importe: excedenteReval },
      { concepto: 'Reservas / Otras Reservas', importe: reservas },
      { concepto: 'Resultados Acumulados', importe: resultadosAcumulados },
      { concepto: 'Resultados del Ejercicio', importe: utilidadEjercicio },
      { concepto: 'TOTAL PATRIMONIO NETO', importe: totalPatrimonio }
    ];

    exportSingleSheet({
      sheetName: 'Situación Financiera',
      title: `ESTADO DE SITUACIÓN FINANCIERA (AL 31 DE DICIEMBRE DEL ${currentCompany.period || '2025'})`,
      columns: [
        { header: 'RUBRO / CONCEPTO', key: 'concepto', width: 50 },
        { header: 'IMPORTE S/', key: 'importe', width: 22, style: 'currency' }
      ],
      rows,
      totals: {
        concepto: 'TOTAL PASIVO Y PATRIMONIO',
        importe: totalPasivo + totalPatrimonio
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: currentCompany?.period || String(new Date().getFullYear()),
      }
    }, 'Estado_Situacion_Financiera');
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Landmark size={18} />}
        title="Situación Financiera"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">
            Balance General
          </span>
        }
        subtitle={`AL 31 DE DICIEMBRE DEL ${currentCompany.period || '2025'} (Nuevos Soles) • RUC: ${currentCompany.ruc}`}
        actions={
          <div className="flex gap-2">
             <button onClick={() => window.print()} className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Imprimir"><Printer size={14} /> Imprimir</button>
             <button onClick={handleExport} className="h-8 px-3 bg-app-surface border border-app-border rounded-xl hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted" title="Excel"><FileDown size={14} /> Excel</button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* Main Content Area */}
      <StaleWarningBanner
        moduleName="eeff"
        isStale={isStale}
        staleSince={staleSince}
        onRecalculate={handleRecalculate}
        isRecalculating={isRecalculating}
      />

      <div className="flex-1 overflow-auto p-4 sm:p-8 custom-scrollbar bg-app-bg/50">
        <div className="max-w-6xl mx-auto bg-app-surface border border-app-border shadow-2xl p-4 sm:p-10 rounded-lg print:shadow-none print:border-none">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
            
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
    </div>
  </div>
  );
};

export default BalanceView;
