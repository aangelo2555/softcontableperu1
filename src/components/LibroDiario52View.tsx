import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  BookOpen, 
  Download, 
  Plus, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  Edit3, 
  Search, 
  Calendar,
  X,
  Save,
  Check,
  Printer
} from 'lucide-react';
import { useStore } from '../store';
import { toast } from 'react-hot-toast';
import { exportTableToXLSX } from '../utils/export';
import { exportLd52FisicoToXLSX } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

interface AsientoLineaInput {
  codigo_cuenta: string;
  denominacion_cuenta: string;
  monto_debe: number; // en soles en el frontend (lo convertimos a céntimos al enviar)
  monto_haber: number; // en soles en el frontend (lo convertimos a céntimos al enviar)
  centro_costos?: string;
  codigo_auxiliar?: string;
  denominacion_auxiliar?: string;
}

const LibroDiario52View: React.FC = () => {
  const { 
    currentCompany,
    plan,
    ld52Entries,
    ld52FisicoEntries,
    ld52TotalDebe,
    ld52TotalHaber,
    ld52BalanceValido,
    ld52Descuadrados,
    loadLd52Entries,
    loadLd52FisicoEntries,
    generarLd52Masivo,
    registrarLd52Asiento,
    corregirLd52Asiento,
    validarLd52Balance,
    exportarLd52TXT,
    exportarLd52TXT54
  } = useStore();

  const [activeTabSub, setActiveTabSub] = useState<'ple' | 'tabla9'>('ple');
  const [periodoMes, setPeriodoMes] = useState(new Date().getMonth());
  const [periodoAnio, setPeriodoAnio] = useState(parseInt(currentCompany.period) || new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  
  // New entry form state
  const [fechaAsiento, setFechaAsiento] = useState('');
  const [glosaAsiento, setGlosaAsiento] = useState('');
  const [refLibro, setRefLibro] = useState('');
  const [refPeriodo, setRefPeriodo] = useState('');
  const [refCuo, setRefCuo] = useState('');
  const [lineasInput, setLineasInput] = useState<AsientoLineaInput[]>([
    { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 },
    { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 }
  ]);

  // Correction entry state
  const [cuoOriginalCorr, setCuoOriginalCorr] = useState('');
  const [tipoCorreccion, setTipoCorreccion] = useState<number>(9); // 8 o 9
  const [lineasCorrInput, setLineasCorrInput] = useState<AsientoLineaInput[]>([
    { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 },
    { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 }
  ]);

  const yyyy = periodoAnio.toString();
  const mm = (periodoMes + 1).toString().padStart(2, '0');
  const periodoActual = `${yyyy}${mm}00`;

  // Load entries when period changes or active tab changes
  useEffect(() => {
    loadLd52Entries(periodoActual);
    loadLd52FisicoEntries(periodoActual);
  }, [periodoMes, periodoAnio, currentCompany.ruc, activeTabSub]);

  // Filtered entries for UI searching
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return ld52Entries;
    const term = searchTerm.toLowerCase();
    return ld52Entries.filter(e => 
      e.cuo.toLowerCase().includes(term) ||
      e.glosa.toLowerCase().includes(term) ||
      e.codigo_cuenta.includes(term) ||
      e.denominacion_cuenta.toLowerCase().includes(term)
    );
  }, [ld52Entries, searchTerm]);

  // Helper formatting function
  const fmt = (n: number) => n !== 0
    ? n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '-';

  const formatSolesNum = (centimos: number) => centimos / 100;

  // Add line to manual form
  const handleAddLine = (isCorr = false) => {
    const newLine = { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 };
    if (isCorr) {
      setLineasCorrInput([...lineasCorrInput, newLine]);
    } else {
      setLineasInput([...lineasInput, newLine]);
    }
  };

  // Remove line from manual form
  const handleRemoveLine = (index: number, isCorr = false) => {
    if (isCorr) {
      if (lineasCorrInput.length <= 2) return;
      setLineasCorrInput(lineasCorrInput.filter((_, i) => i !== index));
    } else {
      if (lineasInput.length <= 2) return;
      setLineasInput(lineasInput.filter((_, i) => i !== index));
    }
  };

  // Update line field
  const handleUpdateLine = (index: number, field: keyof AsientoLineaInput, value: any, isCorr = false) => {
    const list = isCorr ? [...lineasCorrInput] : [...lineasInput];
    
    if (field === 'codigo_cuenta') {
      const match = plan.find(p => p.cta === value);
      list[index] = {
        ...list[index],
        codigo_cuenta: value,
        denominacion_cuenta: match ? match.description : ''
      };
    } else {
      list[index] = {
        ...list[index],
        [field]: value
      };
    }

    if (isCorr) {
      setLineasCorrInput(list);
    } else {
      setLineasInput(list);
    }
  };

  // Calculate totals of current input form
  const getInputTotals = (isCorr = false) => {
    const list = isCorr ? lineasCorrInput : lineasInput;
    return list.reduce((acc, l) => ({
      debe: acc.debe + (Number(l.monto_debe) || 0),
      haber: acc.haber + (Number(l.monto_haber) || 0)
    }), { debe: 0, haber: 0 });
  };

  // Quick auto-balance
  const handleAutoBalance = (isCorr = false) => {
    const list = isCorr ? [...lineasCorrInput] : [...lineasInput];
    const totals = getInputTotals(isCorr);
    const diff = Math.abs(totals.debe - totals.haber);
    if (diff === 0) return;

    // Find the last line and see if we can balance it
    const lastIdx = list.length - 1;
    if (totals.debe > totals.haber) {
      list[lastIdx].monto_haber = Number((list[lastIdx].monto_haber + diff).toFixed(2));
      list[lastIdx].monto_debe = 0;
    } else {
      list[lastIdx].monto_debe = Number((list[lastIdx].monto_debe + diff).toFixed(2));
      list[lastIdx].monto_haber = 0;
    }

    if (isCorr) {
      setLineasCorrInput(list);
    } else {
      setLineasInput(list);
    }
  };

  // Trigger massive generation from purchases & sales
  const handleGenerarMasivo = async () => {
    try {
      const result = await generarLd52Masivo(periodoActual);
      if (result.errores && result.errores.length > 0) {
        toast.error(`⚠️ Hubo errores al procesar: ${result.errores.join(', ')}`);
      }
    } catch (e) {
      // toast shown in store
    }
  };

  // Submit new manual asiento
  const handleSubmitAsiento = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fechaAsiento) {
      toast.error('Indique la fecha de operación');
      return;
    }
    if (!glosaAsiento) {
      toast.error('Indique una glosa / descripción para el asiento');
      return;
    }

    // Convert date string to DD/MM/YYYY
    const [y, m, d] = fechaAsiento.split('-');
    const formattedFecha = `${d}/${m}/${y}`;

    // Validate accounts
    for (let i = 0; i < lineasInput.length; i++) {
      const l = lineasInput[i];
      if (!l.codigo_cuenta) {
        toast.error(`Línea ${i + 1}: Seleccione una cuenta contable`);
        return;
      }
      if (l.monto_debe === 0 && l.monto_haber === 0) {
        toast.error(`Línea ${i + 1}: Debe registrar un monto en DEBE o HABER`);
        return;
      }
    }

    // Double entry validation on frontend
    const totals = getInputTotals(false);
    if (Math.round(totals.debe * 100) !== Math.round(totals.haber * 100)) {
      toast.error(`⚠️ El asiento no cuadra. Diferencia: S/ ${Math.abs(totals.debe - totals.haber).toFixed(2)}`);
      return;
    }

    // Map to database schema
    const formattedLines = lineasInput.map((l, index) => ({
      periodo: periodoActual,
      cuo: '', // Will be generated in the service
      correlativo_asiento: `M${index + 1}`,
      fecha_operacion: formattedFecha,
      glosa: glosaAsiento.toUpperCase(),
      ref_codigo_libro: refLibro || null,
      ref_periodo: refPeriodo || null,
      ref_cuo: refCuo || null,
      codigo_cuenta: l.codigo_cuenta,
      denominacion_cuenta: l.denominacion_cuenta,
      monto_debe: Math.round(l.monto_debe * 100),
      monto_haber: Math.round(l.monto_haber * 100),
      estado: '1' // General
    }));

    try {
      await registrarLd52Asiento(formattedLines);
      setShowNewModal(false);
      // Reset form
      setFechaAsiento('');
      setGlosaAsiento('');
      setRefLibro('');
      setRefPeriodo('');
      setRefCuo('');
      setLineasInput([
        { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 },
        { codigo_cuenta: '', denominacion_cuenta: '', monto_debe: 0, monto_haber: 0 }
      ]);
      await loadLd52Entries(periodoActual);
    } catch (e) {}
  };

  // Open correction modal for specific CUO
  const handleOpenCorrection = (cuo: string) => {
    const related = ld52Entries.filter(e => e.cuo === cuo);
    if (related.length === 0) return;

    setCuoOriginalCorr(cuo);
    setTipoCorreccion(9); // Default to rectify error

    // Map current lines to form inputs
    const mapped: AsientoLineaInput[] = related.map(r => ({
      codigo_cuenta: r.codigo_cuenta,
      denominacion_cuenta: r.denominacion_cuenta,
      monto_debe: formatSolesNum(r.monto_debe),
      monto_haber: formatSolesNum(r.monto_haber),
      centro_costos: r.centro_costos || undefined,
      codigo_auxiliar: r.codigo_auxiliar || undefined,
      denominacion_auxiliar: r.denominacion_auxiliar || undefined
    }));

    setLineasCorrInput(mapped);
    setShowCorrectionModal(true);
  };

  // Submit corrected asiento
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate double entry
    const totals = getInputTotals(true);
    if (Math.round(totals.debe * 100) !== Math.round(totals.haber * 100)) {
      toast.error(`⚠️ El asiento corregido no cuadra. Diferencia: S/ ${Math.abs(totals.debe - totals.haber).toFixed(2)}`);
      return;
    }

    // Map to database schema
    const original = ld52Entries.find(e => e.cuo === cuoOriginalCorr);
    const fecha = original ? original.fecha_operacion : '';
    const glosa = original ? original.glosa : 'CORRECCION DE ASIENTO';

    const formattedLines = lineasCorrInput.map((l, index) => ({
      periodo: periodoActual,
      cuo: cuoOriginalCorr,
      correlativo_asiento: `M${index + 1}`,
      fecha_operacion: fecha,
      glosa: glosa.toUpperCase(),
      codigo_cuenta: l.codigo_cuenta,
      denominacion_cuenta: l.denominacion_cuenta,
      monto_debe: Math.round(l.monto_debe * 100),
      monto_haber: Math.round(l.monto_haber * 100),
      estado: String(tipoCorreccion)
    }));

    try {
      await corregirLd52Asiento(cuoOriginalCorr, tipoCorreccion, formattedLines);
      setShowCorrectionModal(false);
      await loadLd52Entries(periodoActual);
    } catch (e) {}
  };

  const currentTotals = getInputTotals(false);
  const corrTotals = getInputTotals(true);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const keys = [
      'c10_d', 'c10_h', 'c12_d', 'c12_h', 'c16_d', 'c16_h', 'c20_d', 'c20_h', 'c21_d', 'c21_h',
      'c33_d', 'c33_h', 'c34_d', 'c34_h', 'c38_d', 'c38_h', 'c39_d', 'c39_h',
      'c4011D', 'c4011C', 'c4017D', 'c4017C', 'c402_d', 'c402_h', 'c42_d', 'c42_h', 'c46_d', 'c46_h',
      'c50_d', 'c50_h', 'c58_d', 'c58_h', 'c59_d', 'c59_h',
      'c60_d', 'c60_h', 'c61_d', 'c61_h', 'c62_d', 'c62_h', 'c63_d', 'c63_h', 'c65_d', 'c65_h',
      'c66_d', 'c66_h', 'c67_d', 'c67_h', 'c68_d', 'c68_h', 'c69_d', 'c69_h', 'c96_d', 'c96_h', 'c97_d', 'c97_h',
      'c70_d', 'c70_h', 'c75_d', 'c75_h', 'c76_d', 'c76_h', 'c77_d', 'c77_h', 'c79_d', 'c79_h'
    ];
    for (const key of keys) {
      totals[key] = 0;
    }
    for (const r of ld52FisicoEntries) {
      for (const key of keys) {
        totals[key] += r[key] || 0;
      }
    }
    return totals;
  }, [ld52FisicoEntries]);

  const sumDebitsFisico = useMemo(() => {
    const debKeys = [
      'c10_d', 'c12_d', 'c16_d', 'c20_d', 'c21_d', 'c33_d', 'c34_d', 'c38_d', 'c39_d',
      'c4011D', 'c4017D', 'c402_d', 'c42_d', 'c46_d',
      'c50_d', 'c58_d', 'c59_d',
      'c60_d', 'c61_d', 'c62_d', 'c63_d', 'c65_d', 'c66_d', 'c67_d', 'c68_d', 'c69_d', 'c96_d', 'c97_d',
      'c70_d', 'c75_d', 'c76_d', 'c77_d', 'c79_d'
    ];
    return debKeys.reduce((sum, key) => sum + (columnTotals[key] || 0), 0);
  }, [columnTotals]);

  const sumCreditsFisico = useMemo(() => {
    const credKeys = [
      'c10_h', 'c12_h', 'c16_h', 'c20_h', 'c21_h', 'c33_h', 'c34_h', 'c38_h', 'c39_h',
      'c4011C', 'c4017C', 'c402_h', 'c42_h', 'c46_h',
      'c50_h', 'c58_h', 'c59_h',
      'c60_h', 'c61_h', 'c62_h', 'c63_h', 'c65_h', 'c66_h', 'c67_h', 'c68_h', 'c69_h', 'c96_h', 'c97_h',
      'c70_h', 'c75_h', 'c76_h', 'c77_h', 'c79_h'
    ];
    return credKeys.reduce((sum, key) => sum + (columnTotals[key] || 0), 0);
  }, [columnTotals]);

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text select-none animate-fade-in relative">
      <PageHeader
        icon={<BookOpen size={18} />}
        title="Libro Diario Simplificado"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-magenta/10 text-[9px] text-pld-magenta border border-pld-magenta/10 tracking-[0.2em] uppercase">
            Formato 5.2
          </span>
        }
        subtitle="PLE Sunat · RS 286-2009 | Periodo de Ingreso: ≤300 UIT"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── Period Selector ── */}
            <div className="flex items-center bg-app-bg border border-app-border rounded-lg p-0.5">
              <select
                value={periodoMes}
                onChange={(e) => setPeriodoMes(parseInt(e.target.value))}
                className="bg-transparent border-0 text-[11px] font-bold text-app-text focus:ring-0 px-2 py-1 cursor-pointer"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>
              <div className="w-[1px] h-4 bg-app-border" />
              <input
                type="number"
                value={periodoAnio}
                onChange={(e) => setPeriodoAnio(parseInt(e.target.value))}
                className="bg-transparent border-0 text-[11px] font-bold text-app-text focus:ring-0 w-16 text-center py-1 font-mono"
              />
            </div>

            <button
              onClick={handleGenerarMasivo}
              title="Sincroniza y regenera todos los asientos del Registro de Compras y Ventas del período seleccionado"
              className="h-8 px-3 bg-pld-magenta/10 border border-pld-magenta/20 text-pld-magenta rounded-lg hover:bg-pld-magenta hover:text-white transition-all flex items-center gap-1.5 text-[10px] font-bold"
            >
              <Sparkles size={14} /> Generar Asientos
            </button>

            <button
              onClick={() => setShowNewModal(true)}
              className="h-8 px-3 bg-pld-blue/10 border border-pld-blue/20 text-pld-blue rounded-lg hover:bg-pld-blue hover:text-white transition-all flex items-center gap-1.5 text-[10px] font-bold"
            >
              <Plus size={14} /> Nuevo Asiento
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* ═══ VALIDATION AND EXPORTS BAR ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-app-surface/50 border-b border-app-border">
        {/* Balance Status */}
        <div className="flex items-center gap-3">
          <div className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${
            ld52BalanceValido 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
          }`}>
            {ld52BalanceValido ? (
              <>
                <CheckCircle size={12} /> Balance Cuadrado
              </>
            ) : (
              <>
                <AlertTriangle size={12} /> Desbalance en Periodo
              </>
            )}
          </div>

          <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-app-muted">
            <div>TOTAL DEBE: <span className="text-app-text font-black">S/ {fmt(ld52TotalDebe)}</span></div>
            <div className="w-[1px] h-3 bg-app-border" />
            <div>TOTAL HABER: <span className="text-app-text font-black">S/ {fmt(ld52TotalHaber)}</span></div>
            {Math.abs(ld52TotalDebe - ld52TotalHaber) > 0.001 && (
              <>
                <div className="w-[1px] h-3 bg-app-border" />
                <div className="text-rose-400 font-black">
                  DIF: S/ {fmt(Math.abs(ld52TotalDebe - ld52TotalHaber))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Downloads */}
        <div className="flex items-center gap-2 print:hidden">
          {activeTabSub === 'ple' ? (
            <>
              <button
                onClick={() => exportarLd52TXT54(periodoActual)}
                className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue hover:border-pld-blue/30 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
              >
                <Download size={14} /> PLE Plan 5.4 (.TXT)
              </button>

              <button
                onClick={() => exportarLd52TXT(periodoActual)}
                disabled={!ld52BalanceValido}
                className={`h-8 px-3 rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold ${
                  ld52BalanceValido
                    ? 'bg-pld-magenta text-white hover:bg-pld-magenta/90 cursor-pointer'
                    : 'bg-app-bg border border-app-border text-app-muted cursor-not-allowed opacity-50'
                }`}
              >
                <Download size={14} /> Exportar PLE 5.2 (.TXT)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => window.print()}
                className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue hover:border-pld-blue/30 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
              >
                <Printer size={14} /> Imprimir / PDF
              </button>

              <button
                onClick={() => {
                  const filename = `Libro_Diario_Fisico_5_2_${currentCompany.ruc || ''}_${periodoActual}`;
                  exportLd52FisicoToXLSX(
                    ld52FisicoEntries,
                    columnTotals,
                    {
                      ruc: currentCompany.ruc || '',
                      name: currentCompany.name || 'EMPRESA',
                      period: periodoActual
                    },
                    filename
                  );
                  toast.success('📊 Exportando a Excel...');
                }}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold"
              >
                <Download size={14} /> Exportar Excel (.XLSX)
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ DESCUADRADOS ALERTS ═══ */}
      {!ld52BalanceValido && ld52Descuadrados.length > 0 && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 p-3 flex flex-col gap-1.5 text-[11px] text-rose-300">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle size={14} className="text-rose-400" />
            Los siguientes asientos se encuentran descuadrados. Edítelos o corríjalos antes de generar el TXT oficial de SUNAT:
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {ld52Descuadrados.map((d: any) => (
              <button
                key={d.cuo}
                onClick={() => handleOpenCorrection(d.cuo)}
                className="px-2 py-1 bg-rose-950/40 border border-rose-500/30 rounded text-[10px] font-mono hover:bg-rose-900/40 transition-colors flex items-center gap-1 text-rose-300 font-bold"
              >
                CUO {d.cuo} (Diff: S/ {(Math.abs(d.total_debe - d.total_haber) / 100).toFixed(2)}) <Edit3 size={10} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sub-tabs ── */}
      <div className="flex bg-app-surface/30 border-b border-app-border px-4 py-1 gap-2 print:hidden animate-fade-in">
        <button
          onClick={() => setActiveTabSub('ple')}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-colors ${
            activeTabSub === 'ple'
              ? 'bg-pld-magenta text-white shadow-md'
              : 'text-app-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          Vista PLE 5.2 (Plano)
        </button>
        <button
          onClick={() => setActiveTabSub('tabla9')}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-colors ${
            activeTabSub === 'tabla9'
              ? 'bg-pld-magenta text-white shadow-md'
              : 'text-app-muted hover:text-app-text hover:bg-app-surface'
          }`}
        >
          Vista Columnas T9 (Físico)
        </button>
      </div>

      {/* ═══ SEARCH FILTER ═══ */}
      {activeTabSub === 'ple' && (
        <div className="px-4 py-2 border-b border-app-border bg-app-surface/20 flex items-center gap-3 print:hidden">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-app-muted" />
            <input
              type="text"
              placeholder="Buscar por CUO, cuenta, descripción o glosa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-9 pr-4 bg-app-bg border border-app-border rounded-lg text-[10px] text-app-text placeholder:text-app-muted focus:ring-pld-magenta focus:border-pld-magenta font-bold"
            />
          </div>
        </div>
      )}

      {/* ═══ MAIN TABLE ═══ */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className="inline-block min-w-full border border-app-border shadow-2xl rounded-sm overflow-hidden bg-app-surface">
          {activeTabSub === 'ple' ? (
            <table className="min-w-full border-collapse text-[9px] border border-app-border bg-app-surface">
              <thead>
                <tr className="bg-pld-magenta text-white text-[8px] font-black uppercase text-center">
                  <th className="px-2 py-2 border border-pink-700/50 w-16">PERIODO</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-28">CUO</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-14">ASIENTO</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-20">FECHA OP</th>
                  <th className="px-2 py-2 border border-pink-700/50 min-w-[200px]">GLOSA / DESCRIPCION</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-16">CUENTA</th>
                  <th className="px-2 py-2 border border-pink-700/50 min-w-[120px]">DENOMINACION CUENTA</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-24">DEBE (S/)</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-24">HABER (S/)</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-20">ORIGEN</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-10">ESTADO</th>
                  <th className="px-2 py-2 border border-pink-700/50 w-12">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[9px] bg-app-surface">
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center py-16 text-app-muted font-sans italic text-sm">
                      No se encontraron asientos contables en el Libro Diario 5.2 para este periodo
                    </td>
                  </tr>
                )}

                {filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-pld-magenta/5 transition-colors border-b border-app-border/40">
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-center text-app-muted">{e.periodo}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 font-bold text-pld-magenta text-center">{e.cuo}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-center">{e.correlativo_asiento}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-center">{e.fecha_operacion}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-left font-sans text-[8.5px] truncate max-w-[280px]" title={e.glosa}>{e.glosa}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-center font-bold text-pld-blue">{e.codigo_cuenta}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-left font-sans text-[8px] truncate max-w-[140px]" title={e.denominacion_cuenta}>{e.denominacion_cuenta}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-right font-black text-emerald-400">{e.monto_debe > 0 ? fmt(e.monto_debe / 100) : ''}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-right font-black text-rose-400">{e.monto_haber > 0 ? fmt(e.monto_haber / 100) : ''}</td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-center font-sans font-bold text-[8px]">
                      <span className={`px-1.5 py-0.5 rounded-full ${
                        e.origen_modulo === 'COMPRAS' 
                          ? 'bg-pld-magenta/10 text-pld-magenta' 
                          : e.origen_modulo === 'VENTAS'
                            ? 'bg-pld-blue/10 text-pld-blue'
                            : 'bg-app-bg text-app-muted border border-app-border'
                      }`}>
                        {e.origen_modulo}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 border-r border-app-border/30 text-center font-bold">{e.estado}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleOpenCorrection(e.cuo)}
                        className="p-1 text-app-muted hover:text-pld-magenta transition-colors bg-app-bg/50 border border-app-border rounded"
                        title="Editar / Corregir Asiento (Estado 8 u 9)"
                      >
                        <Edit3 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table id="tabla9-pcge-table" className="min-w-[2800px] border-collapse text-[8px] border border-app-border bg-app-surface table-fixed">
              <thead>
                {/* Row 1: Groups */}
                <tr className="bg-pld-magenta text-white text-[8px] font-black uppercase text-center">
                  <th colSpan={4} className="px-2 py-1.5 border border-pink-700/50">DATOS DE CABECERA</th>
                  <th colSpan={18} className="px-2 py-1.5 border border-pink-700/50 bg-blue-950/40 text-blue-300">ACTIVO</th>
                  <th colSpan={10} className="px-2 py-1.5 border border-pink-700/50 bg-emerald-950/40 text-emerald-300">PASIVO</th>
                  <th colSpan={6} className="px-2 py-1.5 border border-pink-700/50 bg-amber-950/40 text-amber-300">PATRIMONIO</th>
                  <th colSpan={22} className="px-2 py-1.5 border border-pink-700/50 bg-rose-950/40 text-rose-300">CUENTAS DE GASTOS (E6 / E9)</th>
                  <th colSpan={10} className="px-2 py-1.5 border border-pink-700/50 bg-teal-950/40 text-teal-300">CUENTAS DE INGRESOS (E7)</th>
                </tr>
                {/* Row 2: Sub-columns */}
                <tr className="bg-app-surface/90 text-app-text text-[7px] font-bold uppercase text-center font-mono">
                  <th className="px-1 py-1 border border-app-border w-24 shrink-0">CUO</th>
                  <th className="px-1 py-1 border border-app-border w-16 shrink-0">FECHA</th>
                  <th className="px-1 py-1 border border-app-border min-w-[120px]">GLOSA</th>
                  <th className="px-1 py-1 border border-app-border w-24 shrink-0">CAR</th>
                  
                  {/* ACTIVO */}
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">10 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">10 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10 font-black text-pld-blue">12 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10 font-black text-pld-blue">12 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">16 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">16 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">20 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">20 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">21 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">21 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">33 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">33 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">34 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">34 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">38 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10">38 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10 text-rose-400">39 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-blue-900/10 text-rose-400">39 H</th>

                  {/* PASIVO */}
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10 text-emerald-400">4011 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10 text-emerald-400">4011 C</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10">4017 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10">4017 C</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10">402 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10">402 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10 font-black text-emerald-400">42 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10 font-black text-emerald-400">42 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10">46 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-emerald-900/10">46 H</th>

                  {/* PATRIMONIO */}
                  <th className="px-1 py-1 border border-app-border w-12 bg-amber-900/10">50 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-amber-900/10">50 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-amber-900/10">58 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-amber-900/10">58 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-amber-900/10">59 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-amber-900/10">59 H</th>

                  {/* GASTOS */}
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">60 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">60 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">61 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">61 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">62 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">62 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">63 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">63 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">65 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">65 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">66 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">66 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">67 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">67 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">68 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">68 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">69 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">69 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">96 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">96 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">97 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-rose-900/10">97 H</th>

                  {/* INGRESOS */}
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">70 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">70 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">75 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">75 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">76 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">76 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">77 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">77 H</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">79 D</th>
                  <th className="px-1 py-1 border border-app-border w-12 bg-teal-900/10">79 H</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[7px] bg-app-surface divide-y divide-app-border/40">
                {ld52FisicoEntries.length === 0 && (
                  <tr>
                    <td colSpan={68} className="text-center py-16 text-app-muted font-sans italic text-sm">
                      No se encontraron asientos contables físicos para este periodo. Use "Generar Asientos" para crearlos.
                    </td>
                  </tr>
                )}
                {ld52FisicoEntries.map((r, idx) => (
                  <tr key={idx} className="hover:bg-app-bg/30">
                    <td className="px-1 py-1 border border-app-border text-center font-bold text-app-text">{r.cuo}</td>
                    <td className="px-1 py-1 border border-app-border text-center text-app-muted">{r.fecha}</td>
                    <td className="px-1.5 py-1 border border-app-border text-left truncate max-w-[180px] font-bold text-app-text uppercase">{r.glosa}</td>
                    <td className="px-1 py-1 border border-app-border text-center text-app-muted font-mono">{r.car}</td>
                    
                    {/* ACTIVO */}
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c10_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c10_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5 font-bold">{fmt(r.c12_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5 font-bold">{fmt(r.c12_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c16_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c16_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c20_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c20_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c21_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c21_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c33_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c33_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c34_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c34_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5">{fmt(r.c38_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5">{fmt(r.c38_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-blue-900/5 text-rose-300">{fmt(r.c39_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-blue-900/5 text-rose-300">{fmt(r.c39_h)}</td>

                    {/* PASIVO */}
                    <td className="px-1 py-1 text-right border border-app-border text-emerald-300 bg-emerald-900/5">{fmt(r.c4011D)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-emerald-300 bg-emerald-900/5">{fmt(r.c4011C)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-emerald-900/5">{fmt(r.c4017D)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-emerald-900/5">{fmt(r.c4017C)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-emerald-900/5">{fmt(r.c402_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-emerald-900/5">{fmt(r.c402_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-emerald-300 bg-emerald-900/5 font-bold">{fmt(r.c42_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-emerald-300 bg-emerald-900/5 font-bold">{fmt(r.c42_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-emerald-900/5">{fmt(r.c46_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-emerald-900/5">{fmt(r.c46_h)}</td>

                    {/* PATRIMONIO */}
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-amber-900/5">{fmt(r.c50_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-amber-900/5">{fmt(r.c50_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-amber-900/5">{fmt(r.c58_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-amber-900/5">{fmt(r.c58_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-amber-900/5">{fmt(r.c59_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-amber-900/5">{fmt(r.c59_h)}</td>

                    {/* GASTOS */}
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c60_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c60_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c61_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c61_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c62_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c62_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c63_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c63_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c65_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c65_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c66_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c66_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c67_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c67_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c68_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c68_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c69_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c69_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c96_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c96_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-rose-900/5">{fmt(r.c97_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-rose-900/5">{fmt(r.c97_h)}</td>

                    {/* INGRESOS */}
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-teal-900/5">{fmt(r.c70_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-teal-900/5">{fmt(r.c70_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-teal-900/5">{fmt(r.c75_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-teal-900/5">{fmt(r.c75_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-teal-900/5">{fmt(r.c76_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-teal-900/5">{fmt(r.c76_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-teal-900/5">{fmt(r.c77_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-teal-900/5">{fmt(r.c77_h)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-text bg-teal-900/5">{fmt(r.c79_d)}</td>
                    <td className="px-1 py-1 text-right border border-app-border text-app-muted bg-teal-900/5">{fmt(r.c79_h)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals Row */}
              <tfoot>
                <tr className="bg-app-surface/90 text-app-text text-[7px] font-black uppercase text-center font-mono border-t border-app-border">
                  <td colSpan={4} className="px-2 py-1.5 border border-app-border text-right font-black text-[8px]">TOTALES PERIODO:</td>
                  
                  {/* ACTIVO */}
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c10_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c10_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-pld-blue font-bold">{fmt(columnTotals.c12_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-pld-blue font-bold">{fmt(columnTotals.c12_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c16_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c16_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c20_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c20_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c21_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c21_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c33_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c33_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c34_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c34_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c38_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-app-text">{fmt(columnTotals.c38_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-rose-300">{fmt(columnTotals.c39_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-blue-950/20 text-rose-300">{fmt(columnTotals.c39_h)}</td>

                  {/* PASIVO */}
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-emerald-300">{fmt(columnTotals.c4011D)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-emerald-300">{fmt(columnTotals.c4011C)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-app-text">{fmt(columnTotals.c4017D)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-app-text">{fmt(columnTotals.c4017C)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-app-text">{fmt(columnTotals.c402_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-app-text">{fmt(columnTotals.c402_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-emerald-300 font-bold">{fmt(columnTotals.c42_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-emerald-300 font-bold">{fmt(columnTotals.c42_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-app-text">{fmt(columnTotals.c46_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-emerald-950/20 text-app-text">{fmt(columnTotals.c46_h)}</td>

                  {/* PATRIMONIO */}
                  <td className="px-1 py-1 text-right border border-app-border bg-amber-950/20 text-app-text">{fmt(columnTotals.c50_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-amber-950/20 text-app-text">{fmt(columnTotals.c50_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-amber-950/20 text-app-text">{fmt(columnTotals.c58_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-amber-950/20 text-app-text">{fmt(columnTotals.c58_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-amber-950/20 text-app-text">{fmt(columnTotals.c59_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-amber-950/20 text-app-text">{fmt(columnTotals.c59_h)}</td>

                  {/* GASTOS */}
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c60_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c60_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c61_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c61_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c62_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c62_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c63_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c63_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c65_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c65_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c66_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c66_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c67_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c67_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c68_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c68_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c69_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c69_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c96_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c96_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c97_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-rose-950/20 text-app-text">{fmt(columnTotals.c97_h)}</td>

                  {/* INGRESOS */}
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c70_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c70_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c75_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c75_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c76_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c76_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c77_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c77_h)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c79_d)}</td>
                  <td className="px-1 py-1 text-right border border-app-border bg-teal-950/20 text-app-text">{fmt(columnTotals.c79_h)}</td>
                </tr>
                <tr className="bg-pld-magenta/15 text-app-text text-[9px] font-black uppercase text-left font-mono">
                  <td colSpan={4} className="px-2 py-2 border border-app-border text-right">CUADRE DE COLUMNAS (DEBE vs HABER):</td>
                  <td colSpan={28} className="px-2 py-2 border border-app-border text-left">
                    SUMA DE COLUMNAS DEBE: <span className="text-emerald-400 font-extrabold">S/ {fmt(sumDebitsFisico)}</span>
                  </td>
                  <td colSpan={36} className="px-2 py-2 border border-app-border text-left">
                    SUMA DE COLUMNAS HABER: <span className="text-emerald-400 font-extrabold">S/ {fmt(sumCreditsFisico)}</span>
                    {Math.abs(sumDebitsFisico - sumCreditsFisico) > 0.01 && (
                      <span className="ml-4 text-rose-400 font-black animate-pulse">⚠️ DESBALANCE: S/ {fmt(Math.abs(sumDebitsFisico - sumCreditsFisico))}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ═══ Print Styles ═══ */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          table { font-size: 6px !important; }
          th, td { padding: 1px 2px !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      {/* ═══ MODAL: NEW MANUAL ENTRY ═══ */}
      {showNewModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <div className="w-full max-w-4xl bg-app-surface border border-app-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-app-border">
              <div className="flex items-center gap-2 text-pld-blue">
                <BookOpen size={18} />
                <span className="text-xs font-black uppercase">Registrar Nuevo Asiento Manual (5.2)</span>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-app-muted hover:text-app-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitAsiento} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                {/* Asiento Metadata Header */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-app-bg/50 p-3 rounded-lg border border-app-border/50">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-app-muted">FECHA OPERACIÓN</label>
                    <input
                      type="date"
                      required
                      value={fechaAsiento}
                      onChange={(e) => setFechaAsiento(e.target.value)}
                      className="h-8 bg-app-bg border border-app-border rounded px-2.5 text-[10px] text-app-text font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1 md:col-span-3">
                    <label className="text-[9px] font-bold text-app-muted">GLOSA / DESCRIPCIÓN DEL ASIENTO</label>
                    <input
                      type="text"
                      required
                      placeholder="GLOSA SIMPLIFICADA PARA EL LIBRO DIARIO..."
                      value={glosaAsiento}
                      onChange={(e) => setGlosaAsiento(e.target.value)}
                      className="h-8 bg-app-bg border border-app-border rounded px-2.5 text-[10px] text-app-text font-bold uppercase"
                    />
                  </div>
                </div>

                {/* References Block (SUNAT compliance) */}
                <div className="bg-app-bg/20 p-3 rounded-lg border border-app-border/30 flex flex-col gap-2">
                  <div className="text-[9px] font-black text-pld-magenta uppercase">REFERENCIA COMPROBANTE DE PAGO O DOCUMENTO (OPCIONAL)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-bold text-app-muted">LIBRO/REGISTRO ORIGEN (TABLA 8)</label>
                      <input
                        type="text"
                        placeholder="Ej. 08 (Compras), 14 (Ventas)"
                        value={refLibro}
                        onChange={(e) => setRefLibro(e.target.value)}
                        maxLength={2}
                        className="h-8 bg-app-bg border border-app-border rounded px-2.5 text-[10px] text-app-text font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-bold text-app-muted">PERIODO ORIGEN</label>
                      <input
                        type="text"
                        placeholder="Ej. YYYYMM00"
                        value={refPeriodo}
                        onChange={(e) => setRefPeriodo(e.target.value)}
                        maxLength={8}
                        className="h-8 bg-app-bg border border-app-border rounded px-2.5 text-[10px] text-app-text font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-bold text-app-muted">CUO REGISTRO ORIGEN</label>
                      <input
                        type="text"
                        placeholder="Correlativo del registro de origen"
                        value={refCuo}
                        onChange={(e) => setRefCuo(e.target.value)}
                        className="h-8 bg-app-bg border border-app-border rounded px-2.5 text-[10px] text-app-text font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Lines Grid */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-app-text">Detalle del Asiento (Partida Doble)</span>
                    <button
                      type="button"
                      onClick={() => handleAddLine(false)}
                      className="px-2 py-1 bg-app-bg border border-app-border rounded hover:text-pld-blue hover:border-pld-blue/30 transition-colors text-[9px] font-bold text-app-muted"
                    >
                      + Añadir Fila
                    </button>
                  </div>

                  <div className="border border-app-border rounded overflow-hidden">
                    <table className="min-w-full text-[9px]">
                      <thead>
                        <tr className="bg-app-bg text-app-muted border-b border-app-border font-bold text-left">
                          <th className="p-2 w-12 text-center">#</th>
                          <th className="p-2 w-36">CUENTA CONTABLE</th>
                          <th className="p-2">DENOMINACIÓN</th>
                          <th className="p-2 w-28 text-right">DEBE (S/)</th>
                          <th className="p-2 w-28 text-right">HABER (S/)</th>
                          <th className="p-2 w-12 text-center">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasInput.map((l, index) => (
                          <tr key={index} className="border-b border-app-border/40 hover:bg-app-surface/20">
                            <td className="p-2 text-center font-bold text-app-muted">{index + 1}</td>
                            <td className="p-1">
                              <input
                                type="text"
                                list="plan-contable-autocomplete"
                                required
                                value={l.codigo_cuenta}
                                onChange={(e) => handleUpdateLine(index, 'codigo_cuenta', e.target.value, false)}
                                className="w-full h-7 bg-app-bg border border-app-border rounded px-2 text-[10px] font-mono text-center font-bold text-pld-blue"
                                placeholder="Escribe cta..."
                              />
                            </td>
                            <td className="p-2 text-app-muted truncate max-w-[200px]" title={l.denominacion_cuenta}>
                              {l.denominacion_cuenta || <span className="italic text-rose-500/60">Cuenta inválida o no registrada</span>}
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.monto_debe || ''}
                                onChange={(e) => handleUpdateLine(index, 'monto_debe', parseFloat(e.target.value) || 0, false)}
                                className="w-full h-7 bg-app-bg border border-app-border rounded px-2 text-right text-[10px] font-mono font-bold text-emerald-400"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.monto_haber || ''}
                                onChange={(e) => handleUpdateLine(index, 'monto_haber', parseFloat(e.target.value) || 0, false)}
                                className="w-full h-7 bg-app-bg border border-app-border rounded px-2 text-right text-[10px] font-mono font-bold text-rose-400"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(index, false)}
                                disabled={lineasInput.length <= 2}
                                className="p-1 text-rose-400 hover:text-rose-500 disabled:opacity-40 transition-colors"
                              >
                                <X size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Form Footer Totals */}
                  <div className="flex items-center justify-between bg-app-bg/40 p-2.5 border border-app-border rounded-lg mt-1 font-mono text-[10px]">
                    <div className="flex gap-4">
                      <div>DEBE FORM: <span className="text-emerald-400 font-black">S/ {currentTotals.debe.toFixed(2)}</span></div>
                      <div>HABER FORM: <span className="text-rose-400 font-black">S/ {currentTotals.haber.toFixed(2)}</span></div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {Math.abs(currentTotals.debe - currentTotals.haber) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAutoBalance(false)}
                          className="px-2 py-0.5 bg-pld-blue/10 border border-pld-blue/20 text-pld-blue hover:bg-pld-blue hover:text-white transition-colors rounded text-[9px] font-bold"
                        >
                          Cuadrar Asiento (Diff: S/ {Math.abs(currentTotals.debe - currentTotals.haber).toFixed(2)})
                        </button>
                      )}
                      {Math.abs(currentTotals.debe - currentTotals.haber) === 0 ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold"><Check size={12} /> Formulario Cuadrado</span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Descuadrado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-app-border flex items-center justify-end gap-2 bg-app-surface">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="h-8 px-4 bg-app-bg border border-app-border rounded hover:text-app-text transition-colors text-[10px] font-bold text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-pld-magenta text-white hover:bg-pld-magenta/90 rounded transition-colors text-[10px] font-bold flex items-center gap-1.5"
                >
                  <Save size={14} /> Guardar Asiento
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ MODAL: CORRECTION (STATE 8 / 9) ═══ */}
      {showCorrectionModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-app-surface border border-app-border rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-app-border">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={18} />
                <span className="text-xs font-black uppercase">Corregir Asiento (CUO: {cuoOriginalCorr})</span>
              </div>
              <button onClick={() => setShowCorrectionModal(false)} className="text-app-muted hover:text-app-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                
                {/* Correction Mode Choice */}
                <div className="bg-app-bg/50 p-3 rounded-lg border border-app-border/50 flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-app-muted uppercase">Tipo de Ajuste PLE SUNAT (RS 286-2009)</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-app-text cursor-pointer">
                      <input
                        type="radio"
                        name="tipo_corr"
                        value={9}
                        checked={tipoCorreccion === 9}
                        onChange={() => setTipoCorreccion(9)}
                        className="text-pld-magenta focus:ring-0"
                      />
                      <span>Estado 9: Rectificar error en asiento existente (invalida el asiento original y registra este en su lugar)</span>
                    </label>

                    <label className="flex items-center gap-2 text-[10px] font-bold text-app-text cursor-pointer">
                      <input
                        type="radio"
                        name="tipo_corr"
                        value={8}
                        checked={tipoCorreccion === 8}
                        onChange={() => setTipoCorreccion(8)}
                        className="text-pld-magenta focus:ring-0"
                      />
                      <span>Estado 8: Añadir asiento omitido en periodos anteriores</span>
                    </label>
                  </div>
                </div>

                {/* Lines Grid */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-app-text">Nuevas Líneas del Asiento</span>
                    <button
                      type="button"
                      onClick={() => handleAddLine(true)}
                      className="px-2 py-1 bg-app-bg border border-app-border rounded hover:text-pld-blue hover:border-pld-blue/30 transition-colors text-[9px] font-bold text-app-muted"
                    >
                      + Añadir Fila
                    </button>
                  </div>

                  <div className="border border-app-border rounded overflow-hidden">
                    <table className="min-w-full text-[9px]">
                      <thead>
                        <tr className="bg-app-bg text-app-muted border-b border-app-border font-bold text-left">
                          <th className="p-2 w-12 text-center">#</th>
                          <th className="p-2 w-36">CUENTA CONTABLE</th>
                          <th className="p-2">DENOMINACIÓN</th>
                          <th className="p-2 w-28 text-right">DEBE (S/)</th>
                          <th className="p-2 w-28 text-right">HABER (S/)</th>
                          <th className="p-2 w-12 text-center">ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasCorrInput.map((l, index) => (
                          <tr key={index} className="border-b border-app-border/40 hover:bg-app-surface/20">
                            <td className="p-2 text-center font-bold text-app-muted">{index + 1}</td>
                            <td className="p-1">
                              <input
                                type="text"
                                list="plan-contable-autocomplete"
                                required
                                value={l.codigo_cuenta}
                                onChange={(e) => handleUpdateLine(index, 'codigo_cuenta', e.target.value, true)}
                                className="w-full h-7 bg-app-bg border border-app-border rounded px-2 text-[10px] font-mono text-center font-bold text-pld-blue"
                                placeholder="Cta..."
                              />
                            </td>
                            <td className="p-2 text-app-muted truncate max-w-[200px]" title={l.denominacion_cuenta}>
                              {l.denominacion_cuenta || <span className="italic text-rose-500/60">Cuenta inválida</span>}
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.monto_debe || ''}
                                onChange={(e) => handleUpdateLine(index, 'monto_debe', parseFloat(e.target.value) || 0, true)}
                                className="w-full h-7 bg-app-bg border border-app-border rounded px-2 text-right text-[10px] font-mono font-bold text-emerald-400"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.monto_haber || ''}
                                onChange={(e) => handleUpdateLine(index, 'monto_haber', parseFloat(e.target.value) || 0, true)}
                                className="w-full h-7 bg-app-bg border border-app-border rounded px-2 text-right text-[10px] font-mono font-bold text-rose-400"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(index, true)}
                                disabled={lineasCorrInput.length <= 2}
                                className="p-1 text-rose-400 hover:text-rose-500 disabled:opacity-40 transition-colors"
                              >
                                <X size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Form Footer Totals */}
                  <div className="flex items-center justify-between bg-app-bg/40 p-2.5 border border-app-border rounded-lg mt-1 font-mono text-[10px]">
                    <div className="flex gap-4">
                      <div>DEBE FORM: <span className="text-emerald-400 font-black">S/ {corrTotals.debe.toFixed(2)}</span></div>
                      <div>HABER FORM: <span className="text-rose-400 font-black">S/ {corrTotals.haber.toFixed(2)}</span></div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {Math.abs(corrTotals.debe - corrTotals.haber) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAutoBalance(true)}
                          className="px-2 py-0.5 bg-pld-blue/10 border border-pld-blue/20 text-pld-blue hover:bg-pld-blue hover:text-white transition-colors rounded text-[9px] font-bold"
                        >
                          Cuadrar Asiento (Diff: S/ {Math.abs(corrTotals.debe - corrTotals.haber).toFixed(2)})
                        </button>
                      )}
                      {Math.abs(corrTotals.debe - corrTotals.haber) === 0 ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold"><Check size={12} /> Formulario Cuadrado</span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 font-bold"><AlertTriangle size={12} /> Descuadrado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-app-border flex items-center justify-end gap-2 bg-app-surface">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="h-8 px-4 bg-app-bg border border-app-border rounded hover:text-app-text transition-colors text-[10px] font-bold text-app-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 bg-rose-500 text-white hover:bg-rose-600 rounded transition-colors text-[10px] font-bold flex items-center gap-1.5"
                >
                  <Save size={14} /> Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Datalist for account autocomplete */}
      <datalist id="plan-contable-autocomplete">
        {plan.map(p => (
          <option key={p.cta} value={p.cta}>{p.cta} - {p.description}</option>
        ))}
      </datalist>
    </div>

        </div>
      </div>
  );
};

export default LibroDiario52View;
