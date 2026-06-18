import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { calculateDeferredTaxSchedule, type DeferredTaxRow } from '../engine/deferredTax';
import { generateNotesTemplates, type FinanceNote } from '../engine/notesGenerator';
import { Plus, Trash2, Save, FileText, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FinanceNotesView() {
  const {
    currentCompany,
    journal,
    fixedAssets,
    financeNotes,
    deferredTaxComputation,
    loadFinanceNotes,
    saveFinanceNotes,
    loadDeferredTax,
    saveDeferredTax,
    postDeferredTaxJournalEntry,
    checkIfPeriodClosed
  } = useStore();

  const currentYear = currentCompany?.period?.substring(0, 4) || new Date().getFullYear().toString();
  
  // States
  const [selectedPeriod, setSelectedPeriod] = useState(`${currentYear}-12`);
  const [activeSubTab, setActiveSubTab] = useState<'NIC12' | 'NOTES' | 'ADIC_DED' | 'ITAN'>('NIC12');
  const [taxRate, setTaxRate] = useState(29.5);
  const [isClosed, setIsClosed] = useState(false);

  // ITAN States
  const [itanBase, setItanBase] = useState<number>(0);
  const [itanCuotas, setItanCuotas] = useState<Array<{ cuota: number; monto: number; pagada: boolean; fechaPago: string; operacion: string }>>([]);

  // NIC 12 calculation base overrides
  // key -> { taxBase, isCustom, concepto, cuenta, accountingBase }
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  
  // Custom temporary difference form
  const [customConcept, setCustomConcept] = useState('');
  const [customCta, setCustomCta] = useState('');
  const [customAccBase, setCustomAccBase] = useState(0);
  const [customTaxBase, setCustomTaxBase] = useState(0);

  // Losses states
  const [lossAmount, setLossAmount] = useState<number>(0);
  const [lossSystem, setLossSystem] = useState<'A' | 'B'>('A');

  // Note edits
  const [noteEdits, setNoteEdits] = useState<Record<number, string>>({});
  const [showNotesWithTables, setShowNotesWithTables] = useState<FinanceNote[]>([]);

  // Adiciones/Deducciones state
  interface AdicDedItem {
    id: string;
    tipo: 'ADICION' | 'DEDUCCION';
    concepto: string;
    base: string;
    permanente: boolean;
    monto: number;
  }
  const [adicDedItems, setAdicDedItems] = useState<AdicDedItem[]>([
    { id: 'ad-1', tipo: 'ADICION', concepto: 'Gastos de representación en exceso (Art. 37 inc. q)', base: 'LIR Art. 37', permanente: true, monto: 0 },
    { id: 'ad-2', tipo: 'ADICION', concepto: 'Multas, intereses moratorios y sanciones', base: 'LIR Art. 44 inc. c)', permanente: true, monto: 0 },
    { id: 'ad-3', tipo: 'ADICION', concepto: 'Gastos sin comprobante de pago válido', base: 'Rgmto. Art. 25 inc. b)', permanente: true, monto: 0 },
    { id: 'ad-4', tipo: 'ADICION', concepto: 'Exceso de depreciación sobre tasas máximas', base: 'LIR Art. 38-39', permanente: false, monto: 0 },
    { id: 'ad-5', tipo: 'ADICION', concepto: 'Provisiones no admitidas tributariamente', base: 'LIR Art. 44 inc. f)', permanente: false, monto: 0 },
    { id: 'ad-6', tipo: 'ADICION', concepto: 'Boletas NRUS > 6% de compras', base: 'LIR Art. 37 penúltimo párrafo', permanente: true, monto: 0 },
    { id: 'dd-1', tipo: 'DEDUCCION', concepto: 'Depreciación acelerada aprobada por SUNAT', base: 'D.Leg. 1488', permanente: false, monto: 0 },
    { id: 'dd-2', tipo: 'DEDUCCION', concepto: 'Donaciones a entidades calificadas (límite)', base: 'LIR Art. 37 inc. x)', permanente: true, monto: 0 },
    { id: 'dd-3', tipo: 'DEDUCCION', concepto: 'Gastos de I+D+i con beneficio 175%', base: 'Ley 30309', permanente: true, monto: 0 },
  ]);

  // Load period data
  useEffect(() => {
    const checkClosed = async () => {
      const closed = await checkIfPeriodClosed(`${selectedPeriod}-01`);
      setIsClosed(closed);
    };
    checkClosed();
    
    // Load persisted DB data
    loadDeferredTax(selectedPeriod).then((saved) => {
      if (saved) {
        setTaxRate(saved.taxRate || 29.5);
        setOverrides(saved.overrides || {});
        if (saved.itan) {
          setItanBase(saved.itan.base || 0);
          setItanCuotas(saved.itan.cuotas || []);
        } else {
          // Suggestions
          const sumActivos = journal.filter(j => j.cta?.startsWith('1') || j.cta?.startsWith('2') || j.cta?.startsWith('3')).reduce((s, j) => s + (j.debe || 0) - (j.haber || 0), 0);
          const sumDeprec = journal.filter(j => j.cta?.startsWith('39')).reduce((s, j) => s + (j.debe || 0) - (j.haber || 0), 0);
          const baseSugerida = Math.max(0, sumActivos + sumDeprec);
          setItanBase(baseSugerida);
          
          const itanTotal = Math.max(0, baseSugerida - 1000000) * 0.004;
          const montoCuota = Number((itanTotal / 9).toFixed(2));
          setItanCuotas(Array.from({ length: 9 }, (_, i) => ({
            cuota: i + 1,
            monto: montoCuota,
            pagada: false,
            fechaPago: '',
            operacion: ''
          })));
        }
      } else {
        setTaxRate(29.5);
        setOverrides({});
        const sumActivos = journal.filter(j => j.cta?.startsWith('1') || j.cta?.startsWith('2') || j.cta?.startsWith('3')).reduce((s, j) => s + (j.debe || 0) - (j.haber || 0), 0);
        const sumDeprec = journal.filter(j => j.cta?.startsWith('39')).reduce((s, j) => s + (j.debe || 0) - (j.haber || 0), 0);
        const baseSugerida = Math.max(0, sumActivos + sumDeprec);
        setItanBase(baseSugerida);
        
        const itanTotal = Math.max(0, baseSugerida - 1000000) * 0.004;
        const montoCuota = Number((itanTotal / 9).toFixed(2));
        setItanCuotas(Array.from({ length: 9 }, (_, i) => ({
          cuota: i + 1,
          monto: montoCuota,
          pagada: false,
          fechaPago: '',
          operacion: ''
        })));
      }
    });

    loadFinanceNotes(selectedPeriod).then((savedNotes) => {
      if (savedNotes && savedNotes.length > 0) {
        const edits: Record<number, string> = {};
        savedNotes.forEach((n: any) => {
          edits[n.number] = n.content;
        });
        setNoteEdits(edits);
      } else {
        setNoteEdits({});
      }
    });
  }, [selectedPeriod]);

  // Compute NIC 12 Schedule
  const schedule = calculateDeferredTaxSchedule(journal, fixedAssets, taxRate, overrides);

  // Generate IFRS Notes list
  useEffect(() => {
    const baseNotes = generateNotesTemplates(useStore.getState() as any, schedule.rows);
    const updated = baseNotes.map(n => {
      if (noteEdits[n.number] !== undefined) {
        return { ...n, content: noteEdits[n.number] };
      }
      return n;
    });
    setShowNotesWithTables(updated);
  }, [schedule.rows, noteEdits]);

  // Handlers
  const handleTaxBaseChange = (key: string, val: number, defaults?: any) => {
    setOverrides(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        taxBase: val,
        ...defaults
      }
    }));
  };

  const handleAddCustomDifference = () => {
    if (!customConcept.trim() || !customCta.trim()) {
      toast.error('⚠️ Por favor completa el concepto y cuenta contable.');
      return;
    }
    const key = `custom-${Date.now()}`;
    setOverrides(prev => ({
      ...prev,
      [key]: {
        taxBase: customTaxBase,
        accountingBase: customAccBase,
        concepto: customConcept,
        cuenta: customCta,
        isCustom: true
      }
    }));
    setCustomConcept('');
    setCustomCta('');
    setCustomAccBase(0);
    setCustomTaxBase(0);
    toast.success('➕ Diferencia temporaria personalizada agregada.');
  };

  const handleRemoveCustomDifference = (key: string) => {
    setOverrides(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    toast.success('🗑️ Diferencia eliminada.');
  };

  const handleRegisterLoss = () => {
    if (lossAmount <= 0) {
      toast.error('⚠️ Por favor ingresa un monto válido para la pérdida.');
      return;
    }
    const key = lossSystem === 'A' ? 'perdida_arrastrable_a' : 'perdida_arrastrable_b';
    setOverrides(prev => {
      const copy = { ...prev };
      delete copy['perdida_arrastrable_a'];
      delete copy['perdida_arrastrable_b'];
      copy[key] = {
        taxBase: lossAmount,
        isCustom: false,
        concepto: lossSystem === 'A'
          ? 'Pérdida Tributaria Arrastrable - Sistema A (Límite 4 años)'
          : 'Pérdida Tributaria Arrastrable - Sistema B (Límite 50% Renta Neta)',
        cuenta: '3712',
        accountingBase: 0
      };
      return copy;
    });
    setLossAmount(0);
    toast.success('📉 Pérdida tributaria arrastrable registrada.');
  };

  const handleSaveNIC12 = async () => {
    await saveDeferredTax(selectedPeriod, {
      taxRate,
      overrides,
      itan: {
        base: itanBase,
        cuotas: itanCuotas
      }
    });
  };

  const handlePostNIC12Journal = async () => {
    if (schedule.suggestedJournalEntries.length === 0) {
      toast.error('⚠️ No hay diferencias temporarias netas para contabilizar.');
      return;
    }
    
    const lines = schedule.suggestedJournalEntries.map(e => ({
      cuenta: e.cuenta,
      debe: e.debe,
      haber: e.haber,
      detalle: e.detalle
    }));

    await postDeferredTaxJournalEntry(selectedPeriod, {
      lines,
      glosa: `AJUSTE IMPUESTO DIFERIDO NIC 12 - PERÍODO ${selectedPeriod}`
    });
  };

  const handleSaveNotes = async () => {
    const notesToSave = showNotesWithTables.map(n => ({
      number: n.number,
      title: n.title,
      content: n.content
    }));
    await saveFinanceNotes(selectedPeriod, notesToSave);
  };

  const handlePrint = () => {
    window.print();
  };

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div className="finance-notes-container p-6 space-y-6 max-w-7xl mx-auto text-app-text h-full overflow-y-auto custom-scrollbar pb-24">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-app-surface/70 backdrop-blur-md p-6 rounded-2xl border border-app-border shadow-xl gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300 Outfit flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-400" />
            Notas Financieras NIIF & NIC 12
          </h2>
          <p className="text-sm text-app-muted mt-1 font-medium">
            Cumplimiento contable bajo la norma internacional NIC 12 y notas dinámicas estructuradas
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-app-muted">Período Contable:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-app-bg border border-app-border rounded-xl px-4 py-2 text-app-text font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {months.map(m => (
                <option key={m} value={`${currentYear}-${m}`}>{`${currentYear}-${m}`}</option>
              ))}
            </select>
          </div>

          {isClosed && (
            <span className="flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg">
              <AlertTriangle className="h-4 w-4" /> Período Cerrado
            </span>
          )}
        </div>
      </div>

      {/* TAB SYSTEM */}
      <div className="flex bg-app-bg p-1.5 rounded-xl border border-app-border w-fit">
        <button
          onClick={() => setActiveSubTab('NIC12')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
            activeSubTab === 'NIC12'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-app-muted hover:text-app-text hover:bg-app-hover'
          }`}
        >
          Impuesto Diferido (NIC 12)
        </button>
        <button
          onClick={() => setActiveSubTab('NOTES')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
            activeSubTab === 'NOTES'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-app-muted hover:text-app-text hover:bg-app-hover'
          }`}
        >
          Notas a los EE.FF. (NIIF)
        </button>
        <button
          onClick={() => setActiveSubTab('ADIC_DED')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
            activeSubTab === 'ADIC_DED'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'
              : 'text-app-muted hover:text-app-text hover:bg-app-hover'
          }`}
        >
          Adiciones y Deducciones
        </button>
        <button
          onClick={() => setActiveSubTab('ITAN')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
            activeSubTab === 'ITAN'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
              : 'text-app-muted hover:text-app-text hover:bg-app-hover'
          }`}
        >
          ITAN (Exceso S/ 1M)
        </button>
      </div>

      {/* SUB-TABS CONTENT */}
      {activeSubTab === 'NIC12' ? (
        <div className="space-y-6">
          
          {/* PARAMETERS BLOCK */}
          <div className="bg-app-surface/50 backdrop-blur-sm p-6 rounded-2xl border border-app-border flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-app-text flex items-center gap-2">
                Parámetros de Cálculo NIC 12
              </h3>
              <p className="text-xs text-app-muted">
                Define la tasa impositiva y calcula las diferencias temporarias activas o pasivas
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-app-muted font-semibold">Tasa del Impuesto a la Renta (%):</span>
              <input
                type="number"
                step="0.1"
                value={taxRate}
                disabled={isClosed}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-24 bg-app-bg border border-app-border rounded-xl px-4 py-2 text-app-text font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* MAIN CALCULATION SCHEDULE */}
          <div className="bg-app-surface/70 backdrop-blur-md rounded-2xl border border-app-border shadow-xl overflow-hidden">
            <div className="p-6 border-b border-app-border">
              <h3 className="text-lg font-bold text-app-text">Conciliación de Diferencias Temporarias</h3>
              <p className="text-xs text-app-muted mt-0.5">Base Contable NIIF vs Base Tributaria</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-bg/60 text-app-muted text-xs font-bold uppercase border-b border-app-border">
                    <th className="p-4">Concepto</th>
                    <th className="p-4 text-center">Cuenta</th>
                    <th className="p-4 text-right">Base Contable (NIIF)</th>
                    <th className="p-4 text-right">Base Tributaria (LIR)</th>
                    <th className="p-4 text-right">Diferencia</th>
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4 text-right">Activo Diferido</th>
                    <th className="p-4 text-right">Pasivo Diferido</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/80 text-sm">
                  {schedule.rows.map((row) => (
                    <tr key={row.key} className="hover:bg-app-hover transition-colors">
                      <td className="p-4 font-semibold text-app-text max-w-xs truncate">{row.concepto}</td>
                      <td className="p-4 text-center text-app-muted font-mono">{row.cuenta}</td>
                      <td className="p-4 text-right text-app-text font-semibold">
                        {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(row.accountingBase)}
                      </td>
                      <td className="p-4 text-right">
                        <input
                          type="number"
                          value={row.taxBase}
                          disabled={isClosed}
                          onChange={(e) => handleTaxBaseChange(row.key, Number(e.target.value), {
                            isCustom: row.isCustom,
                            concepto: row.concepto,
                            cuenta: row.cuenta,
                            accountingBase: row.accountingBase
                          })}
                          className="w-32 bg-app-bg border border-app-border rounded-lg px-2.5 py-1.5 text-right font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-app-text"
                        />
                      </td>
                      <td className="p-4 text-right text-amber-400 font-semibold">
                        {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(row.diferencia)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-extrabold ${
                          row.tipo === 'DEDUCIBLE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {row.tipo}
                        </span>
                      </td>
                      <td className="p-4 text-right text-emerald-400 font-bold">
                        {row.activoDiferido > 0 ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(row.activoDiferido) : '-'}
                      </td>
                      <td className="p-4 text-right text-red-400 font-bold">
                        {row.pasivoDiferido > 0 ? new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(row.pasivoDiferido) : '-'}
                      </td>
                      <td className="p-4 text-center">
                        {row.isCustom ? (
                          <button
                            onClick={() => handleRemoveCustomDifference(row.key)}
                            disabled={isClosed}
                            className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-app-hover transition"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        ) : (
                          <span className="text-app-muted text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {/* TOTALS ROW */}
                  <tr className="bg-app-bg/80 font-bold text-app-text border-t-2 border-app-border">
                    <td className="p-4" colSpan={6}>TOTALES</td>
                    <td className="p-4 text-right text-emerald-400 font-extrabold">
                      {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(schedule.totalActivoDiferido)}
                    </td>
                    <td className="p-4 text-right text-red-400 font-extrabold">
                      {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(schedule.totalPasivoDiferido)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* NET BALANCE RECONCILIATION SUMMARY */}
            <div className="bg-app-bg/40 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-app-border gap-4">
              <div>
                <span className="text-xs text-app-muted uppercase font-bold tracking-wider">Efecto Tributario Diferido Neto:</span>
                <h4 className={`text-2xl font-black mt-0.5 ${
                  schedule.netDeferredTax >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Math.abs(schedule.netDeferredTax))}
                  <span className="text-xs font-semibold ml-2">
                    ({schedule.netDeferredTax >= 0 ? 'ACTIVO DIFERIDO NETO' : 'PASIVO DIFERIDO NETO'})
                  </span>
                </h4>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleSaveNIC12}
                  disabled={isClosed}
                  className="bg-app-surface hover:bg-app-hover text-app-text font-bold px-5 py-2.5 rounded-xl border border-app-border transition flex items-center gap-2 hover:scale-[1.02]"
                >
                  <Save className="h-4.5 w-4.5 text-app-muted" /> Guardar Parámetros
                </button>

                <button
                  onClick={handlePostNIC12Journal}
                  disabled={isClosed}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-600/10 hover:scale-[1.02]"
                >
                  <CheckCircle2 className="h-4.5 w-4.5" /> Contabilizar NIC 12
                </button>
              </div>
            </div>
          </div>

          {/* ADD CUSTOM DIFFERENCES SECTION */}
          {!isClosed && (
            <div className="bg-app-surface/50 backdrop-blur-sm p-6 rounded-2xl border border-app-border space-y-4">
              <h4 className="text-md font-bold text-app-text flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-400" />
                Agregar Diferencia Temporaria Adicional
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-xs text-app-muted font-bold uppercase">Concepto / Glosa</label>
                  <input
                    type="text"
                    placeholder="Ej. Pérdida tributaria arrastrable"
                    value={customConcept}
                    onChange={(e) => setCustomConcept(e.target.value)}
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-app-muted font-bold uppercase">Cuenta Relac.</label>
                  <input
                    type="text"
                    placeholder="Ej. 37"
                    value={customCta}
                    onChange={(e) => setCustomCta(e.target.value)}
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-app-muted font-bold uppercase">Base Contable</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={customAccBase}
                    onChange={(e) => setCustomAccBase(Number(e.target.value))}
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-app-muted font-bold uppercase">Base Tributaria</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={customTaxBase}
                    onChange={(e) => setCustomTaxBase(Number(e.target.value))}
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  />
                </div>
              </div>
              <button
                onClick={handleAddCustomDifference}
                className="bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                Agregar Fila Personalizada
              </button>
            </div>
          )}

          {/* LOSS CARRYFORWARD SECTION */}
          {!isClosed && (
            <div className="bg-app-surface/50 backdrop-blur-sm p-6 rounded-2xl border border-app-border space-y-4">
              <h4 className="text-md font-bold text-app-text flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                Registro de Pérdida Tributaria Arrastrable (LIR Art. 50)
              </h4>
              <p className="text-xs text-app-muted">
                Registra pérdidas acumuladas de ejercicios anteriores para calcular el activo diferido (29.5%)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-app-muted font-bold uppercase">Sistema de Arrastre</label>
                  <select
                    value={lossSystem}
                    onChange={(e) => setLossSystem(e.target.value as 'A' | 'B')}
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="A">Sistema A (4 Años de límite)</option>
                    <option value="B">Sistema B (Límite 50% Renta Neta)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-app-muted font-bold uppercase">Monto de la Pérdida (S/)</label>
                  <input
                    type="number"
                    value={lossAmount}
                    onChange={(e) => setLossAmount(Number(e.target.value))}
                    placeholder="Monto acumulado"
                    className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleRegisterLoss}
                    className="w-full h-[38px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition shadow-lg shadow-indigo-600/20"
                  >
                    Registrar Pérdida
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUGGESTED JOURNAL PREVIEW */}
          <div className="bg-app-surface/70 backdrop-blur-md p-6 rounded-2xl border border-app-border space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-app-muted">Asiento Sugerido NIC 12</h4>
            <div className="bg-app-bg p-4 rounded-xl font-mono text-xs border border-app-border divide-y divide-app-border/80">
              {schedule.suggestedJournalEntries.map((e, index) => (
                <div key={index} className="py-2.5 flex justify-between items-center text-app-muted">
                  <div className="flex gap-4 items-center">
                    <span className="text-blue-400 font-black">{e.cuenta}</span>
                    <span>{e.detalle}</span>
                  </div>
                  <div className="flex gap-8">
                    {e.debe > 0 && <span className="text-emerald-400 font-bold w-24 text-right">D: {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(e.debe)}</span>}
                    {e.haber > 0 && <span className="text-red-400 font-bold w-24 text-right">H: {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(e.haber)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeSubTab === 'NOTES' ? (
        /* NOTAS CONTABLES (NIIF) TAB */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <h3 className="text-lg font-bold text-app-text">Notas a los Estados Financieros</h3>
              <p className="text-xs text-app-muted">Edita y estructura las notas para su presentación y exportación</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="bg-app-surface hover:bg-app-hover text-app-text font-bold px-4 py-2.5 rounded-xl border border-app-border transition flex items-center gap-2"
              >
                <Printer className="h-4.5 w-4.5 text-app-muted" /> Imprimir Notas
              </button>
              
              <button
                onClick={handleSaveNotes}
                disabled={isClosed}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg"
              >
                <Save className="h-4.5 w-4.5" /> Guardar Notas
              </button>
            </div>
          </div>

          {/* EDITABLE NOTES GRID */}
          <div className="grid grid-cols-1 gap-6">
            {showNotesWithTables.map((note) => (
              <div
                key={note.number}
                className="bg-app-surface/70 backdrop-blur-md p-6 rounded-2xl border border-app-border shadow-xl space-y-4 print:bg-white print:text-black print:border-none print:shadow-none print:p-0"
              >
                {/* Note title */}
                <div className="flex justify-between items-center border-b border-app-border pb-2 print:border-black">
                  <h4 className="text-md font-bold text-app-text print:text-black font-Outfit flex items-center gap-2">
                    <span className="text-blue-400 font-extrabold print:text-black">Nota {note.number}:</span>
                    {note.title}
                  </h4>
                </div>

                {/* Content Editor */}
                <textarea
                  value={note.content}
                  disabled={isClosed}
                  onChange={(e) => setNoteEdits(prev => ({
                    ...prev,
                    [note.number]: e.target.value
                  }))}
                  rows={4}
                  className="w-full bg-app-bg border border-app-border rounded-xl p-4 text-sm text-app-text focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 leading-relaxed font-normal print:bg-transparent print:border-none print:text-black print:p-0 print:resize-none"
                />

                {/* Table Data Preview (If exist) */}
                {note.tableData && (
                  <div className="overflow-x-auto rounded-xl border border-app-border bg-app-bg/30 print:border-black print:bg-transparent">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-app-bg/80 text-app-muted font-bold border-b border-app-border print:text-black print:border-black">
                          {note.tableData.headers.map((h, i) => (
                            <th key={i} className="p-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border/60 print:divide-black">
                        {note.tableData.rows.map((row, ri) => (
                          <tr key={ri} className="text-app-muted print:text-black">
                            {row.map((cell, ci) => (
                              <td key={ci} className={`p-3 ${ci === row.length - 1 ? 'font-bold text-right' : ''}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : activeSubTab === 'ADIC_DED' ? (
        /* ADICIONES Y DEDUCCIONES TAB */
        <div className="space-y-6">
          <div className="bg-app-surface/70 backdrop-blur-md rounded-2xl border border-app-border shadow-xl overflow-hidden">
            <div className="p-6 border-b border-app-border">
              <h3 className="text-lg font-bold text-app-text">Conciliación Tributaria: Utilidad Contable → Renta Neta Imponible</h3>
              <p className="text-xs text-app-muted mt-1">Art. 33-44 TUO LIR — Adiciones (gastos no deducibles) y Deducciones (beneficios tributarios)</p>
            </div>

            {/* Adiciones Section */}
            <div className="p-6 border-b border-app-border">
              <h4 className="text-sm font-black uppercase tracking-wider text-red-400 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span> (+) ADICIONES A LA RENTA NETA
              </h4>
              <div className="space-y-2">
                {adicDedItems.filter(i => i.tipo === 'ADICION').map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-app-text">{item.concepto}</p>
                      <p className="text-[9px] text-app-muted">{item.base} • {item.permanente ? 'Permanente' : 'Temporal'}</p>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={item.monto}
                      disabled={isClosed}
                      onChange={(e) => setAdicDedItems(prev => prev.map(p => p.id === item.id ? { ...p, monto: Number(e.target.value) } : p))}
                      className="w-36 bg-app-bg border border-app-border rounded-lg px-3 py-2 text-right text-sm font-bold text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Deducciones Section */}
            <div className="p-6 border-b border-app-border">
              <h4 className="text-sm font-black uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span> (−) DEDUCCIONES A LA RENTA NETA
              </h4>
              <div className="space-y-2">
                {adicDedItems.filter(i => i.tipo === 'DEDUCCION').map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-app-text">{item.concepto}</p>
                      <p className="text-[9px] text-app-muted">{item.base} • {item.permanente ? 'Permanente' : 'Temporal'}</p>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={item.monto}
                      disabled={isClosed}
                      onChange={(e) => setAdicDedItems(prev => prev.map(p => p.id === item.id ? { ...p, monto: Number(e.target.value) } : p))}
                      className="w-36 bg-app-bg border border-app-border rounded-lg px-3 py-2 text-right text-sm font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {(() => {
              // Calculate from journal
              const totalIngresos = journal.filter(j => j.cta?.startsWith('7')).reduce((s, j) => s + (j.haber || 0) - (j.debe || 0), 0);
              const totalGastos = journal.filter(j => j.cta?.startsWith('6')).reduce((s, j) => s + (j.debe || 0) - (j.haber || 0), 0);
              const utilidadContable = totalIngresos - totalGastos;
              const totalAdiciones = adicDedItems.filter(i => i.tipo === 'ADICION').reduce((s, i) => s + i.monto, 0);
              const totalDeducciones = adicDedItems.filter(i => i.tipo === 'DEDUCCION').reduce((s, i) => s + i.monto, 0);
              const rentaNeta = utilidadContable + totalAdiciones - totalDeducciones;
              const rentaNetaFinal = Math.max(0, rentaNeta);

              // RMT or General based on company regime
              const regime = currentCompany?.regimen || 'RG';
              let ir = 0;
              if (regime === 'MYPE') {
                const tier1Max = 15 * 5500; // 15 UIT
                if (rentaNetaFinal <= tier1Max) {
                  ir = rentaNetaFinal * 0.10;
                } else {
                  ir = tier1Max * 0.10 + (rentaNetaFinal - tier1Max) * 0.295;
                }
              } else {
                ir = rentaNetaFinal * 0.295;
              }

              const fmt = (n: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);

              return (
                <div className="p-6 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-app-bg/30 rounded-xl border border-app-border/50">
                    <span className="text-xs font-bold text-app-muted uppercase">Utilidad (Pérdida) Contable del Ejercicio</span>
                    <span className={`text-sm font-black ${utilidadContable >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(utilidadContable)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                    <span className="text-xs font-bold text-red-400 uppercase">(+) Total Adiciones</span>
                    <span className="text-sm font-black text-red-400">{fmt(totalAdiciones)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                    <span className="text-xs font-bold text-emerald-400 uppercase">(−) Total Deducciones</span>
                    <span className="text-sm font-black text-emerald-400">{fmt(totalDeducciones)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
                    <span className="text-xs font-black text-amber-500 uppercase tracking-wider">RENTA NETA IMPONIBLE</span>
                    <span className="text-xl font-black text-amber-500">{fmt(rentaNetaFinal)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-xl border border-indigo-500/20">
                    <div>
                      <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">IMPUESTO A LA RENTA ({regime})</span>
                      <p className="text-[9px] text-app-muted mt-0.5">
                        {regime === 'MYPE' ? '10% hasta 15 UIT + 29.5% exceso' : '29.5% tasa fija'}
                      </p>
                    </div>
                    <span className="text-xl font-black text-indigo-400">{fmt(ir)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : activeSubTab === 'ITAN' ? (
        /* ITAN TAB */
        <div className="bg-app-surface/70 backdrop-blur-md rounded-2xl border border-app-border overflow-hidden shadow-2xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-app-border pb-4">
            <div>
              <h3 className="text-lg font-black text-app-text flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-500 animate-pulse"></span>
                Impuesto Temporal a los Activos Netos (ITAN)
              </h3>
              <p className="text-xs text-app-muted mt-0.5">
                Gravado con 0.4% sobre el exceso de S/ 1,000,000 de los Activos Netos
              </p>
            </div>
            <button
              onClick={handleSaveNIC12}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all"
            >
              Guardar Configuración ITAN
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-elevated !p-5 bg-app-bg border border-app-border space-y-4">
              <h4 className="text-xs font-black uppercase text-app-muted tracking-wider">Base Imponible de Activos</h4>
              <div className="space-y-2">
                <label className="text-[10px] text-app-muted font-bold block uppercase">Activos Netos Declarados (S/)</label>
                <input
                  type="number"
                  value={itanBase}
                  onChange={(e) => {
                    const base = parseFloat(e.target.value) || 0;
                    setItanBase(base);
                    // Autocalcular cuotas
                    const itanTotal = Math.max(0, base - 1000000) * 0.004;
                    const montoCuota = Number((itanTotal / 9).toFixed(2));
                    setItanCuotas(prev => prev.map(c => ({ ...c, monto: montoCuota })));
                  }}
                  className="w-full bg-app-surface border border-app-border rounded-xl px-4 py-2.5 text-base font-black text-app-text text-right focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[9px] text-app-muted block italic">
                  Sugerencia del Balance de Cuentas 1, 2, 3 netas de la 39.
                </span>
              </div>

              <div className="pt-2 divide-y divide-app-border/40 text-[11px] font-bold text-app-muted space-y-2">
                <div className="flex justify-between py-1">
                  <span>Monto Inafecto (Tramos LIR)</span>
                  <span>S/ 1,000,000.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Base Excedente Afecta</span>
                  <span className="text-app-text font-black">S/ {Math.max(0, itanBase - 1000000).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Tasa ITAN</span>
                  <span>0.4 %</span>
                </div>
                <div className="flex justify-between py-2 text-xs font-black text-purple-400">
                  <span>ITAN Anual Calculado</span>
                  <span>S/ {(Math.max(0, itanBase - 1000000) * 0.004).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 card-elevated !p-5 bg-app-bg border border-app-border space-y-4">
              <h4 className="text-xs font-black uppercase text-app-muted tracking-wider flex justify-between items-center">
                <span>Cronograma de Pago (9 Cuotas)</span>
                <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2.5 py-0.5 rounded-full">Marzo a Noviembre</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-app-border text-app-muted uppercase font-black tracking-widest text-[8px]">
                      <th className="py-2">Cuota</th>
                      <th className="py-2 text-right">Monto (S/)</th>
                      <th className="py-2 text-center">Estado</th>
                      <th className="py-2">Fecha Pago</th>
                      <th className="py-2">Nro Operación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/30">
                    {itanCuotas.map((c, idx) => (
                      <tr key={idx} className="hover:bg-app-surface/20">
                        <td className="py-2.5 font-bold">Cuota N° 0{c.cuota}</td>
                        <td className="py-2.5 text-right font-black">
                          <input
                            type="number"
                            value={c.monto}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setItanCuotas(prev => prev.map(item => item.cuota === c.cuota ? { ...item, monto: val } : item));
                            }}
                            className="bg-transparent border-none p-0 text-right w-24 text-[10px] font-black focus:ring-0 text-app-text"
                          />
                        </td>
                        <td className="py-2.5 text-center">
                          <button
                            onClick={() => {
                              setItanCuotas(prev => prev.map(item => item.cuota === c.cuota ? { ...item, pagada: !item.pagada } : item));
                            }}
                            className={`px-3 py-1 rounded-lg font-bold text-[8px] uppercase tracking-wider transition ${
                              c.pagada ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {c.pagada ? 'Pagada' : 'Pendiente'}
                          </button>
                        </td>
                        <td className="py-2.5">
                          <input
                            type="date"
                            value={c.fechaPago || ''}
                            onChange={(e) => {
                              setItanCuotas(prev => prev.map(item => item.cuota === c.cuota ? { ...item, fechaPago: e.target.value } : item));
                            }}
                            className="bg-app-surface border border-app-border rounded-lg px-2 py-1 text-[9px] w-28 focus:outline-none text-app-text"
                          />
                        </td>
                        <td className="py-2.5">
                          <input
                            type="text"
                            placeholder="Transacción"
                            value={c.operacion || ''}
                            onChange={(e) => {
                              setItanCuotas(prev => prev.map(item => item.cuota === c.cuota ? { ...item, operacion: e.target.value } : item));
                            }}
                            className="bg-app-surface border border-app-border rounded-lg px-2 py-1 text-[9px] w-24 focus:outline-none text-app-text uppercase font-mono"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-start gap-3 text-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-400 mt-1 flex-shrink-0 animate-ping"></div>
            <div>
              <h5 className="font-black text-purple-400 uppercase tracking-wide">Compensación del ITAN como Crédito Tributario (NIC 12 / NIC 1)</h5>
              <p className="text-app-muted mt-1 leading-relaxed">
                El ITAN efectivamente pagado (sea en cuotas o al contado) constituye un crédito compensable contra los pagos a cuenta del Impuesto a la Renta de los periodos de marzo a diciembre del mismo ejercicio, o contra el Impuesto a la Renta anual en la Declaración Jurada Anual de regularización. Las cuotas no aplicadas en el ejercicio pueden ser devueltas por SUNAT mediante el Formulario 1649.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
            color: black !important;
          }
          .finance-notes-container, .finance-notes-container * {
            visibility: visible;
          }
          .finance-notes-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide non-print items */
          button, select, input, .flex.bg-\\[\\#121b2e\\], .flex.gap-2, label, label + input {
            display: none !important;
          }
          textarea {
            border: none !important;
            resize: none !important;
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
