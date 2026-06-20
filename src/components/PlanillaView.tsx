import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Employee } from '../store';
import { 
  Users, 
  Plus, 
  Trash2, 
  Download,
  Search,
  ShieldCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Printer,
  Landmark,
  ChevronDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

const PlanillaView: React.FC = () => {
  const { employees, saveEmployee, deleteEmployee, currentCompany, saveAsiento, plan } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth());
  const [periodoAnio, setPeriodoAnio] = useState(parseInt(currentCompany.period) || new Date().getFullYear());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProvisionesPanel, setShowProvisionesPanel] = useState(false);
  const [showProvisionesConfirm, setShowProvisionesConfirm] = useState(false);

  const MONTHS = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  const filteredEmployees = useMemo(() => {
    return (employees || []).filter(e => 
      e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.dni.includes(searchTerm) ||
      e.puesto.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  // Constantes de Ley 2026 (Perú)
  const RMV = 1130;
  const ASIG_FAMILIAR = 113.00; // 10% de RMV
  const ESSALUD_TASA = 0.09;
  const ONP_TASA = 0.13;
  const UIT = 5500;
  const DEDUCCION_5TA = 7 * UIT; // S/ 38,500 en 2026

  const AFP_RATES: Record<string, { fondo: number, seguro: number, comision: number }> = {
    'INTEGRA': { fondo: 0.10, seguro: 0.017, comision: 0.0155 },
    'PRIMA': { fondo: 0.10, seguro: 0.017, comision: 0.0160 },
    'PROFUTURO': { fondo: 0.10, seguro: 0.017, comision: 0.0169 },
    'HABITAT': { fondo: 0.10, seguro: 0.017, comision: 0.0147 },
  };

  const calculateTotalRemuneracion = (e: Employee) => {
    const basico = e.sueldo_basico || 0;
    const af = e.asignacion_familiar ? ASIG_FAMILIAR : 0;
    const he = e.horas_extras_importe || 0;
    return basico + af + he;
  };

  const calculateEssalud = (e: Employee) => {
    const totalRem = calculateTotalRemuneracion(e);
    const minBase = RMV * ((e.dias_trabajados || 30) / 30);
    return Math.max(totalRem, minBase) * ESSALUD_TASA;
  };

  const calculate5taRenta = (e: Employee) => {
    const totalRem = calculateTotalRemuneracion(e);
    const sueldoProyectado = totalRem * 12;
    const gratificaciones = totalRem * 2;
    const ingresosAnuales = sueldoProyectado + gratificaciones;
    const baseImponible = Math.max(0, ingresosAnuales - DEDUCCION_5TA);
    if (baseImponible <= 0) return 0;

    let impuestoAnual = 0;
    let baseRestante = baseImponible;

    const tramos = [
      { limite: 5 * UIT, tasa: 0.08 },
      { limite: 20 * UIT, tasa: 0.14 },
      { limite: 35 * UIT, tasa: 0.17 },
      { limite: 45 * UIT, tasa: 0.20 },
      { limite: Infinity, tasa: 0.30 }
    ];

    let anteriorLimite = 0;
    for (const tramo of tramos) {
      const rango = tramo.limite - anteriorLimite;
      if (baseRestante > rango) {
        impuestoAnual += rango * tramo.tasa;
        baseRestante -= rango;
        anteriorLimite = tramo.limite;
      } else {
        impuestoAnual += baseRestante * tramo.tasa;
        break;
      }
    }

    return parseFloat((impuestoAnual / 12).toFixed(2));
  };

  const calculateDescuentos = (e: Employee) => {
    const totalRem = calculateTotalRemuneracion(e);
    let totalD = 0;

    if (e.regimen_pensionario === 'ONP') {
      totalD = totalRem * ONP_TASA;
    } else if (AFP_RATES[e.regimen_pensionario]) {
      const rates = AFP_RATES[e.regimen_pensionario];
      const fondo = totalRem * rates.fondo;
      const seguro = totalRem * rates.seguro;
      const comision = totalRem * rates.comision;
      totalD = fondo + seguro + comision;
    }

    const renta5ta = e.impuesto_renta_5ta !== undefined ? e.impuesto_renta_5ta : calculate5taRenta(e);
    const otrosD = (e.essalud_vida || 0) + renta5ta + (e.retencion_judicial || 0);
    return totalD + otrosD;
  };

  const getAFPValues = (e: Employee) => {
    const totalRem = calculateTotalRemuneracion(e);
    if (!AFP_RATES[e.regimen_pensionario]) return { fondo: 0, seguro: 0, comision: 0 };
    const r = AFP_RATES[e.regimen_pensionario];
    return {
      fondo: totalRem * r.fondo,
      seguro: totalRem * r.seguro,
      comision: totalRem * r.comision
    };
  };

  const stats = useMemo(() => {
    const totalBruto = filteredEmployees.reduce((acc, e) => acc + calculateTotalRemuneracion(e), 0);
    const totalEssalud = filteredEmployees.reduce((acc, e) => acc + calculateEssalud(e), 0);
    
    let totalONP = 0;
    let totalAFP = 0;
    let totalRenta5ta = 0;
    let totalOtrosDesc = 0;

    filteredEmployees.forEach(e => {
      const totalRem = calculateTotalRemuneracion(e);
      if (e.regimen_pensionario === 'ONP') {
        totalONP += totalRem * ONP_TASA;
      } else if (AFP_RATES[e.regimen_pensionario]) {
        const rates = AFP_RATES[e.regimen_pensionario];
        totalAFP += totalRem * (rates.fondo + rates.seguro + rates.comision);
      }
      totalRenta5ta += e.impuesto_renta_5ta !== undefined ? e.impuesto_renta_5ta : calculate5taRenta(e);
      totalOtrosDesc += (e.essalud_vida || 0) + (e.retencion_judicial || 0);
    });

    totalONP = parseFloat(totalONP.toFixed(2));
    totalAFP = parseFloat(totalAFP.toFixed(2));
    totalRenta5ta = parseFloat(totalRenta5ta.toFixed(2));
    totalOtrosDesc = parseFloat(totalOtrosDesc.toFixed(2));

    const totalNeto = totalBruto - (totalONP + totalAFP + totalRenta5ta + totalOtrosDesc);

    return {
      bruto: totalBruto,
      neto: totalNeto,
      essalud: totalEssalud,
      totalONP,
      totalAFP,
      totalRenta5ta,
      totalOtrosDesc,
      count: filteredEmployees.length,
      // Provisiones mensuales
      provCTS: parseFloat((totalBruto / 12).toFixed(2)),           // 1/12 de la remuneración
      provVacaciones: parseFloat((totalBruto / 12).toFixed(2)),    // 1/12 de la remuneración
      provGratificaciones: parseFloat((totalBruto / 6).toFixed(2)) // 1/6 de la remuneración (2 gratificaciones / 12 meses)
    };
  }, [filteredEmployees]);

  const handleAddEmployee = () => {
    const id = crypto.randomUUID();
    const newEmployee: Employee = {
      id,
      dni: '',
      nombre: 'NUEVO TRABAJADOR',
      fecha_nacimiento: '2000-01-01',
      edad: 24,
      puesto: 'OPERARIO',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      regimen_pensionario: 'ONP',
      sueldo_basico: RMV,
      asignacion_familiar: 0,
      dias_trabajados: 30,
      jornal_diario: RMV / 30,
    };
    saveEmployee(newEmployee);
    toast.success('Trabajador agregado');
  };

  const handleExportPLAME = () => {
    let content = "";
    filteredEmployees.forEach(e => {
      content += `${e.dni}|0121|${e.sueldo_basico.toFixed(2)}|\n`;
      if (e.asignacion_familiar) {
        content += `${e.dni}|0201|${ASIG_FAMILIAR.toFixed(2)}|\n`;
      }
    });
    
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `PLAME_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}.rem`;
    document.body.appendChild(element);
    element.click();
    toast.success('Archivo PLAME (.rem) generado');
  };

  const handleGenerarAsiento = async () => {
    if (stats.count === 0) {
      toast.error('No hay trabajadores registrados en este periodo');
      return;
    }
    setShowConfirmModal(true);
  };

  const processGenerarAsiento = async () => {
    setShowConfirmModal(false);
    try {
      const monthStr = String(periodoMes + 1).padStart(2, '0');
      // Formato de fecha dd/mm/yyyy para que el sistema lo tome correctamente
      const dateStr = `30/${monthStr}/${periodoAnio}`;
      
      const header = {
        asiento: `06-PLA-${monthStr}`, // Formato 3 partes: [Libro]-[Prefijo]-[Correlativo]
        fecEmi: dateStr,
        glosa: `POR LA CENTRALIZACION DE LA PLANILLA DE ${MONTHS[periodoMes]} ${periodoAnio}`,
        anio: String(periodoAnio),
        mes: monthStr
      };

      const lines = [
        { id: 1, cuenta: '6211', detalle: 'REMUNERACIONES - SUELDOS', debe: stats.bruto, haber: 0 },
        { id: 2, cuenta: '6271', detalle: 'ESSALUD EMPLEADOR', debe: stats.essalud, haber: 0 },
        { id: 3, cuenta: '4031', detalle: 'ESSALUD POR PAGAR', debe: 0, haber: stats.essalud },
      ];

      let currentId = 4;
      if (stats.totalONP > 0) {
        lines.push({ id: currentId++, cuenta: '4032', detalle: 'ONP POR PAGAR', debe: 0, haber: stats.totalONP });
      }
      if (stats.totalAFP > 0) {
        lines.push({ id: currentId++, cuenta: '417', detalle: 'AFP POR PAGAR (PCGE 417)', debe: 0, haber: stats.totalAFP });
      }
      if (stats.totalRenta5ta > 0) {
        lines.push({ id: currentId++, cuenta: '40173', detalle: 'IMPUESTO A LA RENTA 5TA CATEGORÍA', debe: 0, haber: stats.totalRenta5ta });
      }
      if (stats.totalOtrosDesc > 0) {
        lines.push({ id: currentId++, cuenta: '419', detalle: 'OTROS DESCUENTOS Y RETENCIONES', debe: 0, haber: stats.totalOtrosDesc });
      }

      lines.push({ id: currentId++, cuenta: '4111', detalle: 'SUELDOS POR PAGAR', debe: 0, haber: stats.neto });

      // Agregar amarres de destino si existen en el plan para las cuentas 62
      const acc6211 = plan.find(a => a.cta === '6211' || a.cta === '621');
      if (acc6211?.amarreDebe && acc6211?.amarreHaber) {
        lines.push({ id: currentId++, cuenta: acc6211.amarreDebe, detalle: 'GASTOS ADMIN (PLANILLA)', debe: stats.bruto, haber: 0 });
        lines.push({ id: currentId++, cuenta: acc6211.amarreHaber, detalle: 'CARGAS IMPUTABLES', debe: 0, haber: stats.bruto });
      }

      const acc6271 = plan.find(a => a.cta === '6271' || a.cta === '627');
      if (acc6271?.amarreDebe && acc6271?.amarreHaber) {
        lines.push({ id: currentId++, cuenta: acc6271.amarreDebe, detalle: 'GASTOS ADMIN (ESSALUD)', debe: stats.essalud, haber: 0 });
        lines.push({ id: currentId++, cuenta: acc6271.amarreHaber, detalle: 'CARGAS IMPUTABLES', debe: 0, haber: stats.essalud });
      }

      await saveAsiento(header, lines);
      toast.success(`Asiento generado correctamente: ${header.asiento}`);
    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al generar el asiento');
    }
  };

  const processGenerarAsientoProvisiones = async () => {
    setShowProvisionesConfirm(false);
    try {
      const monthStr = String(periodoMes + 1).padStart(2, '0');
      const dateStr = `30/${monthStr}/${periodoAnio}`;

      const header = {
        asiento: `06-PROV-${monthStr}`,
        fecEmi: dateStr,
        glosa: `POR LA PROVISION DE CTS, VACACIONES Y GRATIFICACIONES DE ${MONTHS[periodoMes]} ${periodoAnio}`,
        anio: String(periodoAnio),
        mes: monthStr
      };

      const lines: any[] = [];
      let currentId = 1;

      // CTS: 6291 → 4151
      if (stats.provCTS > 0) {
        lines.push({ id: currentId++, cuenta: '6291', detalle: 'PROVISIÓN CTS (1/12)', debe: stats.provCTS, haber: 0 });
        lines.push({ id: currentId++, cuenta: '4151', detalle: 'CTS POR PAGAR', debe: 0, haber: stats.provCTS });
      }

      // Vacaciones: 6214 → 4115
      if (stats.provVacaciones > 0) {
        lines.push({ id: currentId++, cuenta: '6214', detalle: 'PROVISIÓN VACACIONES (1/12)', debe: stats.provVacaciones, haber: 0 });
        lines.push({ id: currentId++, cuenta: '4115', detalle: 'VACACIONES POR PAGAR', debe: 0, haber: stats.provVacaciones });
      }

      // Gratificaciones: 6215 → 4114
      if (stats.provGratificaciones > 0) {
        lines.push({ id: currentId++, cuenta: '6215', detalle: 'PROVISIÓN GRATIFICACIONES (1/6)', debe: stats.provGratificaciones, haber: 0 });
        lines.push({ id: currentId++, cuenta: '4114', detalle: 'GRATIFICACIONES POR PAGAR', debe: 0, haber: stats.provGratificaciones });
      }

      // Destino Clase 9 para cada cuenta 62xx
      const totalProvGasto = stats.provCTS + stats.provVacaciones + stats.provGratificaciones;
      if (totalProvGasto > 0) {
        const acc62 = plan.find(a => a.cta === '621' || a.cta === '6211');
        if (acc62?.amarreDebe && acc62?.amarreHaber) {
          lines.push({ id: currentId++, cuenta: acc62.amarreDebe, detalle: 'GASTOS ADMIN (PROVISIONES)', debe: totalProvGasto, haber: 0 });
          lines.push({ id: currentId++, cuenta: acc62.amarreHaber, detalle: 'CARGAS IMPUTABLES', debe: 0, haber: totalProvGasto });
        }
      }

      if (lines.length === 0) {
        toast.error('No hay provisiones para generar');
        return;
      }

      await saveAsiento(header, lines);
      toast.success(`✅ Asiento de provisiones ${MONTHS[periodoMes]} generado correctamente`);
    } catch (error) {
      console.error(error);
      toast.error('Error al generar el asiento de provisiones');
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Users size={18} />}
        title="Libro Planilla"
        badge={<span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-[9px] text-indigo-500 border border-indigo-500/10 tracking-[0.2em] uppercase">Estructura PLAME</span>}
        subtitle={`Empresa: ${currentCompany.name || 'Sin Especificar'} | RUC: ${currentCompany.ruc || '-'}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de Periodo */}
            <div className="flex items-center gap-1 bg-app-surface/50 border border-app-border rounded-xl px-2 py-1 mr-2 shadow-inner">
               <button 
                  onClick={() => setPeriodoMes(prev => prev === 0 ? 11 : prev - 1)}
                  className="p-1.5 hover:bg-app-bg rounded-lg text-app-muted transition-colors"
               >
                  <ChevronLeft size={14} />
               </button>
               <div className="px-3 py-1 flex flex-col items-center min-w-[100px]">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter leading-none">{MONTHS[periodoMes]}</span>
                  <span className="text-[8px] font-black text-app-muted/50 tracking-[0.2em]">{periodoAnio}</span>
               </div>
               <button 
                  onClick={() => setPeriodoMes(prev => prev === 11 ? 0 : prev + 1)}
                  className="p-1.5 hover:bg-app-bg rounded-lg text-app-muted transition-colors"
               >
                  <ChevronRight size={14} />
               </button>
            </div>

            <button
              onClick={handleGenerarAsiento}
              className="px-5 py-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/10"
            >
              <Calculator size={14} /> Generar Asiento
            </button>
            <button
              onClick={handleAddEmployee}
              className="px-5 py-2.5 bg-app-surface text-app-text border border-app-border rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg hover:bg-app-hover transition-all flex items-center gap-2"
            >
              <Plus size={14} /> Alta Trabajador
            </button>
            <button
              onClick={handleExportPLAME}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Download size={14} /> Generar PLAME
            </button>
            <button onClick={() => window.print()} className="px-5 py-2.5 bg-app-surface text-app-text border border-app-border rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg hover:bg-app-hover transition-all flex items-center gap-2"><Printer size={14} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Planilla',
              title: `PLANILLA DE SUELDOS Y SALARIOS - ${MONTHS[periodoMes]} ${periodoAnio}`,
              columns: [
                { header: 'TRABAJADOR', key: 'nombre', width: 30 },
                { header: 'DNI', key: 'dni', width: 14 },
                { header: 'PUESTO', key: 'puesto', width: 20 },
                { header: 'R. PENSIÓN', key: 'regimen_pensionario', width: 15 },
                { header: 'SUELDO BÁSICO', key: 'sueldo_basico', width: 14, style: 'currency' },
                { header: 'NETO', key: 'neto', width: 14, style: 'currency' }
              ],
              rows: employees.map(e => ({
                ...e,
                neto: calculateTotalRemuneracion(e) - calculateDescuentos(e)
              })),
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: `${periodoAnio}-${String(periodoMes + 1).padStart(2, '0')}`,
              }
            }, `Planilla_${MONTHS[periodoMes]}_${periodoAnio}`)} className="px-5 py-2.5 bg-app-surface text-app-text border border-app-border rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg hover:bg-app-hover transition-all flex items-center gap-2"><FileDown size={14} /> Excel</button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 shrink-0">
         <div className="card-elevated !p-4 bg-gradient-to-br from-indigo-500/10 to-blue-600/10 border-indigo-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Total Planilla Bruta</p>
            <h3 className="text-xl font-black text-app-text italic">
               S/ {stats.bruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
         </div>
         <div className="card-elevated !p-4 bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border-emerald-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Aportes Empleador (9%)</p>
            <h3 className="text-xl font-black text-emerald-500 italic">
               S/ {stats.essalud.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
         </div>
         <div className="card-elevated !p-4 bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Total Neto a Pagar</p>
            <h3 className="text-xl font-black text-blue-500 italic">
               S/ {stats.neto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
         </div>
         <div className="card-elevated !p-4 flex flex-col justify-center items-center bg-app-surface/50 border-app-border/40">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted">Trabajadores</p>
            <p className="text-2xl font-black text-app-text tracking-tighter italic">{stats.count}</p>
         </div>
      </div>

      {/* Provisiones Mensuales Panel */}
      {stats.count > 0 && (
        <div className="card-elevated !p-0 overflow-hidden shrink-0">
          <button
            onClick={() => setShowProvisionesPanel(!showProvisionesPanel)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500">
                <Landmark size={16} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Provisiones Mensuales</p>
                <p className="text-[8px] text-app-muted font-bold">CTS (1/12) · Vacaciones (1/12) · Gratificaciones (1/6)</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-black text-amber-600 italic">
                S/ {(stats.provCTS + stats.provVacaciones + stats.provGratificaciones).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </span>
              <ChevronDown size={16} className={`text-app-muted transition-transform duration-200 ${showProvisionesPanel ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {showProvisionesPanel && (
            <div className="p-5 border-t border-app-border space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* CTS */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 to-amber-600/5 border border-amber-500/15">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">CTS (1/12)</span>
                    <span className="text-[8px] font-bold text-app-muted">Cta 6291 → 4151</span>
                  </div>
                  <p className="text-lg font-black text-amber-600 italic">
                    S/ {stats.provCTS.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[8px] text-app-muted mt-1">= Remuneración Computable ÷ 12</p>
                </div>

                {/* Vacaciones */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/5 to-teal-600/5 border border-teal-500/15">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-teal-600">Vacaciones (1/12)</span>
                    <span className="text-[8px] font-bold text-app-muted">Cta 6214 → 4115</span>
                  </div>
                  <p className="text-lg font-black text-teal-600 italic">
                    S/ {stats.provVacaciones.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[8px] text-app-muted mt-1">= Remuneración Computable ÷ 12</p>
                </div>

                {/* Gratificaciones */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/5 to-violet-600/5 border border-violet-500/15">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-violet-600">Gratificaciones (1/6)</span>
                    <span className="text-[8px] font-bold text-app-muted">Cta 6215 → 4114</span>
                  </div>
                  <p className="text-lg font-black text-violet-600 italic">
                    S/ {stats.provGratificaciones.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[8px] text-app-muted mt-1">= Remuneración Computable ÷ 6 (2 gratificaciones anuales)</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-app-border/50">
                <div className="text-[9px] text-app-muted font-bold">
                  <span className="text-amber-600">Base de cálculo:</span> Total Rem. Bruta S/ {stats.bruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })} × {stats.count} trabajadores
                </div>
                <button
                  onClick={() => setShowProvisionesConfirm(true)}
                  className="px-5 py-2.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/10"
                >
                  <Calculator size={14} /> Generar Asiento de Provisiones
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Table Container */}
      <div className="card-elevated !p-0 flex flex-col overflow-hidden shadow-2xl border-app-border/40">
        <div className="px-4 py-2 border-b border-app-border flex items-center justify-between bg-app-surface/30 shrink-0">
           <div className="flex items-center gap-3">
              <div className="p-1.5 bg-app-bg rounded-lg border border-app-border">
                <Search size={14} className="text-app-muted" />
              </div>
              <input 
                type="text" 
                placeholder="BUSCAR TRABAJADOR POR NOMBRE O DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-[0.2em] w-80 focus:ring-0 text-app-text placeholder-app-muted/30"
              />
           </div>
           <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-lg text-blue-500 border border-blue-500/10">
                <Calculator size={12} />
                <span className="text-[8px] font-black uppercase tracking-wider">Cálculos en Tiempo Real (PLAME)</span>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-app-surface/20">
          <table className="w-full text-left border-collapse min-w-[3000px]">
             <thead className="sticky top-0 z-20 shadow-md">
                {/* Doble Encabezado */}
                <tr className="bg-app-bg text-[8px] font-black uppercase tracking-widest text-app-muted border-b border-app-border">
                  <th colSpan={9} className="px-4 py-2 border-r border-app-border text-center bg-app-bg">Datos del Trabajador</th>
                  <th colSpan={7} className="px-4 py-2 border-r border-app-border text-center bg-app-bg">Conceptos Remunerativos</th>
                  <th colSpan={9} className="px-4 py-2 border-r border-app-border text-center bg-app-bg/50 text-indigo-500">Descuentos</th>
                  <th colSpan={2} className="px-4 py-2 border-r border-app-border text-center bg-emerald-500/5 text-emerald-600 italic">Empleador</th>
                  <th rowSpan={2} className="px-4 py-2 text-right pr-6 min-w-[100px]">Acciones</th>
                </tr>
                <tr className="bg-app-bg/95 text-[8px] font-black uppercase tracking-widest text-app-muted border-b border-app-border italic">
                  {/* Trabajador */}
                  <th className="px-4 py-3 bg-app-bg border-r border-app-border shadow-sm sticky left-0 z-30 min-w-[50px]">N°</th>
                  <th className="px-4 py-3 bg-app-bg border-r border-app-border shadow-sm sticky left-[50px] z-30 min-w-[280px]">Apellidos y Nombres</th>
                  <th className="px-3 py-3 min-w-[100px]">DNI</th>
                  <th className="px-3 py-3 min-w-[125px]">F. Nac</th>
                  <th className="px-3 py-3 min-w-[50px] text-center">Edad</th>
                  <th className="px-3 py-3 min-w-[160px]">Ocupación (Puesto)</th>
                  <th className="px-3 py-3 min-w-[125px]">F. Ingreso</th>
                  <th className="px-3 py-3 min-w-[125px]">F. Salida</th>
                  <th className="px-3 py-3 border-r border-app-border min-w-[140px]">Pensión (AFP/ONP)</th>

                  {/* Remuneraciones */}
                  <th className="px-3 py-3 text-center min-w-[55px]">Días</th>
                  <th className="px-3 py-3 text-right min-w-[90px]">Jorn. Diario</th>
                  <th className="px-3 py-3 text-right min-w-[110px]">Rem. Mensual</th>
                  <th className="px-3 py-3 text-center min-w-[50px]">A.F.</th>
                  <th colSpan={2} className="px-3 py-3 text-center min-w-[120px] bg-blue-500/5">Horas Extras (N° / S/)</th>
                  <th className="px-3 py-3 text-right min-w-[120px] font-black text-app-text border-r border-app-border bg-blue-500/5">Total Rem. Bruta</th>

                  {/* Descuentos */}
                  <th className="px-3 py-3 text-right min-w-[100px]">Pensión S/</th>
                  <th className="px-3 py-3 text-right min-w-[90px]">EsS. Vida</th>
                  <th className="px-3 py-3 text-right min-w-[90px]">5ta Renta</th>
                  <th className="px-3 py-3 text-right min-w-[90px]">Ret. Judic.</th>
                  <th colSpan={3} className="px-3 py-3 text-center min-w-[240px] bg-indigo-500/5">Desglose AFP (Fondo/Seg/Com)</th>
                  <th className="px-3 py-3 text-right min-w-[100px] bg-indigo-500/5 font-black text-rose-500">Total Desc.</th>
                  <th className="px-3 py-3 text-right min-w-[120px] font-black text-blue-500 border-r border-app-border bg-indigo-500/5">NETO A PAGAR</th>

                  {/* Empleador */}
                  <th className="px-3 py-3 text-right min-w-[100px]">EsSalud 9%</th>
                  <th className="px-3 py-3 text-right min-w-[90px]">SCTR</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-app-border/40">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="text-[9px] hover:bg-app-text/[0.03] transition-colors group">
                    {/* Trabajador */}
                    <td className="px-4 py-2 border-r border-app-border sticky left-0 z-10 bg-app-surface font-mono font-black text-indigo-500 group-hover:bg-app-hover">
                      {(idx + 1).toString().padStart(3, '0')}
                    </td>
                    <td className="px-4 py-2 border-r border-app-border sticky left-[50px] z-10 bg-app-surface group-hover:bg-app-hover">
                        <input 
                        type="text" 
                        autoComplete="new-password"
                        value={emp.nombre} 
                        onChange={(e) => saveEmployee({...emp, nombre: e.target.value.toUpperCase()})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-app-text font-black focus:ring-0 w-full outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        autoComplete="new-password"
                        value={emp.dni} 
                        onChange={(e) => saveEmployee({...emp, dni: e.target.value})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-app-muted font-bold focus:ring-0 w-full font-mono outline-none"
                        placeholder="DNI..."
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="date" 
                        value={emp.fecha_nacimiento} 
                        onChange={(e) => saveEmployee({...emp, fecha_nacimiento: e.target.value})}
                        className="bg-app-bg/30 border border-app-border/30 px-1 py-1 rounded-md text-app-muted font-mono focus:ring-0 w-full outline-none text-[8px]"
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-app-muted font-bold">
                        {emp.edad || '-'}
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        value={emp.puesto} 
                        onChange={(e) => saveEmployee({...emp, puesto: e.target.value.toUpperCase()})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-app-muted focus:ring-0 w-full outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="date" 
                        value={emp.fecha_ingreso} 
                        onChange={(e) => saveEmployee({...emp, fecha_ingreso: e.target.value})}
                        className="bg-app-bg/30 border border-app-border/30 px-1 py-1 rounded-md text-app-muted font-mono focus:ring-0 w-full outline-none text-[8px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="date" 
                        value={emp.fecha_salida} 
                        onChange={(e) => saveEmployee({...emp, fecha_salida: e.target.value})}
                        className="bg-app-bg/30 border border-app-border/30 px-1 py-1 rounded-md text-app-muted font-mono focus:ring-0 w-full outline-none text-[8px]"
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-app-border">
                        <select 
                        value={emp.regimen_pensionario} 
                        onChange={(e) => saveEmployee({...emp, regimen_pensionario: e.target.value})}
                        className="bg-app-bg/30 border border-app-border/30 px-1 py-1 rounded-md text-app-text font-black focus:ring-0 uppercase text-[8px] w-full outline-none"
                      >
                        <option value="ONP">ONP (13%)</option>
                        <option value="INTEGRA">AFP INTEGRA</option>
                        <option value="PRIMA">AFP PRIMA</option>
                        <option value="PROFUTURO">AFP PROFUTURO</option>
                        <option value="HABITAT">AFP HABITAT</option>
                      </select>
                    </td>

                    {/* Remuneraciones */}
                    <td className="px-2 py-2 text-center">
                        <input 
                        type="number" 
                        value={emp.dias_trabajados} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, dias_trabajados: parseInt(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-1 py-1 rounded-md text-center text-app-text font-bold focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                        <input 
                        type="number" 
                        value={emp.jornal_diario?.toFixed(2)} 
                        readOnly
                        className="bg-transparent border-none p-0 text-right text-app-muted focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                        <input 
                        type="number" 
                        value={emp.sueldo_basico} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, sueldo_basico: parseFloat(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-right text-app-text font-black focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                        <input 
                        type="checkbox" 
                        checked={!!emp.asignacion_familiar} 
                        onChange={(e) => saveEmployee({...emp, asignacion_familiar: e.target.checked ? 1 : 0})}
                        className="w-3.5 h-3.5 rounded border-app-border bg-app-bg text-indigo-600 focus:ring-indigo-500/20"
                      />
                    </td>
                    <td className="px-3 py-2 text-center bg-blue-500/5">
                        <input 
                        type="number" 
                        value={emp.horas_extras_cantidad} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, horas_extras_cantidad: parseInt(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-1 py-1 rounded-md text-center text-blue-500 font-bold focus:ring-0 w-10 [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-blue-500/5">
                        <input 
                        type="number" 
                        value={emp.horas_extras_importe} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, horas_extras_importe: parseFloat(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-right text-blue-600 font-black focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-black text-[10px] text-app-text border-r border-app-border bg-blue-500/5 italic">
                        {calculateTotalRemuneracion(emp).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Descuentos */}
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={(calculateTotalRemuneracion(emp) * (emp.regimen_pensionario === 'ONP' ? 0.13 : 0)).toFixed(2)} 
                        readOnly
                        className="bg-transparent border-none p-0 text-right text-rose-500 font-bold focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={emp.essalud_vida} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, essalud_vida: parseFloat(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-right text-app-muted focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={emp.impuesto_renta_5ta !== undefined ? emp.impuesto_renta_5ta : calculate5taRenta(emp)} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, impuesto_renta_5ta: parseFloat(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-right text-app-muted focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={emp.retencion_judicial} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, retencion_judicial: parseFloat(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-right text-app-muted focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-indigo-500/5">
                        <input 
                        type="number" 
                        value={getAFPValues(emp).fondo.toFixed(2)} 
                        readOnly
                        className="bg-transparent border-none p-0 text-right text-indigo-400 font-bold focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-indigo-500/5">
                        <input 
                        type="number" 
                        value={getAFPValues(emp).seguro.toFixed(2)} 
                        readOnly
                        className="bg-transparent border-none p-0 text-right text-indigo-400 font-bold focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-indigo-500/5">
                        <input 
                        type="number" 
                        value={getAFPValues(emp).comision.toFixed(2)} 
                        readOnly
                        className="bg-transparent border-none p-0 text-right text-indigo-400 font-bold focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-rose-500/5 text-rose-500 font-black">
                        {calculateDescuentos(emp).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right font-black text-[11px] text-blue-500 border-r border-app-border bg-blue-500/5 italic">
                        {(calculateTotalRemuneracion(emp) - calculateDescuentos(emp)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Empleador */}
                    <td className="px-3 py-2 text-right">
                        {calculateEssalud(emp).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={emp.sctr_empleador} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveEmployee({...emp, sctr_empleador: parseFloat(e.target.value) || 0})}
                        className="bg-app-bg/30 border border-app-border/30 px-2 py-1 rounded-md text-right text-emerald-600 font-bold focus:ring-0 w-full [appearance:textfield] outline-none"
                      />
                    </td>

                    <td className="px-4 py-2 text-right pr-6">
                      <button 
                        onClick={() => deleteEmployee(emp.id)}
                        className="p-2 text-rose-500/50 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-500/10"
                        title="Eliminar Trabajador"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={27} className="py-40 text-center">
                       <div className="flex flex-col items-center grayscale opacity-10">
                          <Users size={120} strokeWidth={0.5} className="mb-6" />
                          <p className="text-[11px] font-black uppercase tracking-[0.4em]">No hay trabajadores registrados</p>
                       </div>
                    </td>
                  </tr>
                )}
             </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-app-surface/80 border-t border-app-border flex items-center justify-between text-[10px] text-app-muted shrink-0">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                 <span className="font-bold uppercase tracking-wider text-[9px]">Conceptos Fijos</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <span className="font-bold uppercase tracking-wider text-[9px]">Remuneración Bruta</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                 <span className="font-bold uppercase tracking-wider text-[9px]">Deducciones de Ley</span>
              </div>
           </div>
           <p className="font-bold italic">© SOFTCONTABLE ERP - Cumplimiento normativo PLAME / T-Registro</p>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN PREMIUM */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-indigo-500/10 to-blue-600/10 border-b border-app-border">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                       <Calculator size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-app-text tracking-tight uppercase">Confirmar Asiento</h3>
                       <p className="text-[10px] text-app-muted font-bold tracking-widest uppercase italic">Planilla: {MONTHS[periodoMes]} {periodoAnio}</p>
                    </div>
                 </div>
                 <p className="text-[11px] text-app-text/70 leading-relaxed font-medium italic">
                    ¿Estás seguro de centralizar la planilla? Se generará un asiento automático en el Libro Diario con los siguientes importes:
                 </p>
              </div>

              {/* Body / Summary */}
              <div className="p-6 space-y-3">
                 <div className="flex items-center justify-between p-3 bg-app-bg/30 rounded-2xl border border-app-border/50">
                    <span className="text-[10px] font-black text-app-muted uppercase tracking-wider">Remuneración (6211)</span>
                    <span className="text-xs font-black text-app-text italic">S/ {stats.bruto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-app-bg/30 rounded-2xl border border-app-border/50">
                    <span className="text-[10px] font-black text-app-muted uppercase tracking-wider">Essalud Empl. (6271)</span>
                    <span className="text-xs font-black text-app-text italic">S/ {stats.essalud.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                 </div>
                  {stats.totalONP > 0 && (
                    <div className="flex items-center justify-between p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                       <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">ONP Por Pagar (4032)</span>
                       <span className="text-xs font-black text-rose-500 italic">S/ {stats.totalONP.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {stats.totalAFP > 0 && (
                    <div className="flex items-center justify-between p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                       <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">AFP Por Pagar (417)</span>
                       <span className="text-xs font-black text-indigo-500 italic">S/ {stats.totalAFP.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {stats.totalRenta5ta > 0 && (
                    <div className="flex items-center justify-between p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                       <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">Renta 5ta (40173)</span>
                       <span className="text-xs font-black text-amber-500 italic">S/ {stats.totalRenta5ta.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {stats.totalOtrosDesc > 0 && (
                    <div className="flex items-center justify-between p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                       <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Otros Desc. (419)</span>
                       <span className="text-xs font-black text-rose-400 italic">S/ {stats.totalOtrosDesc.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                 <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">NETO A PAGAR (4111)</span>
                    <span className="text-lg font-black text-blue-600 italic tracking-tighter">S/ {stats.neto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                 </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-app-surface border-t border-app-border flex gap-3">
                 <button 
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-app-border text-[10px] font-black uppercase tracking-widest text-app-muted hover:bg-app-bg transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={processGenerarAsiento}
                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                 >
                    Confirmar y Generar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PROVISIONES */}
      {showProvisionesConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-app-bg/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-app-surface border border-app-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-b border-app-border">
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                       <Landmark size={24} />
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-app-text tracking-tight uppercase">Provisiones</h3>
                       <p className="text-[10px] text-app-muted font-bold tracking-widest uppercase italic">{MONTHS[periodoMes]} {periodoAnio}</p>
                    </div>
                 </div>
                 <p className="text-[11px] text-app-text/70 leading-relaxed font-medium italic">
                    Se generará un asiento contable con las provisiones de CTS, Vacaciones y Gratificaciones:
                 </p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-3">
                 <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">CTS 1/12 (6291 → 4151)</span>
                    <span className="text-xs font-black text-amber-600 italic">S/ {stats.provCTS.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-teal-500/5 rounded-2xl border border-teal-500/10">
                    <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider">Vacaciones 1/12 (6214 → 4115)</span>
                    <span className="text-xs font-black text-teal-600 italic">S/ {stats.provVacaciones.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-violet-500/5 rounded-2xl border border-violet-500/10">
                    <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Gratificaciones 1/6 (6215 → 4114)</span>
                    <span className="text-xs font-black text-violet-600 italic">S/ {stats.provGratificaciones.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">TOTAL PROVISIONES</span>
                    <span className="text-lg font-black text-amber-700 italic tracking-tighter">
                       S/ {(stats.provCTS + stats.provVacaciones + stats.provGratificaciones).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                 </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-app-surface border-t border-app-border flex gap-3">
                 <button 
                    onClick={() => setShowProvisionesConfirm(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-app-border text-[10px] font-black uppercase tracking-widest text-app-muted hover:bg-app-bg transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={processGenerarAsientoProvisiones}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                 >
                    Confirmar y Generar
                 </button>
              </div>
           </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};

export default PlanillaView;
