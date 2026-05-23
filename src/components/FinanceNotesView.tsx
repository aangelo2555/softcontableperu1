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
  const [activeSubTab, setActiveSubTab] = useState<'NIC12' | 'NOTES'>('NIC12');
  const [taxRate, setTaxRate] = useState(29.5);
  const [isClosed, setIsClosed] = useState(false);

  // NIC 12 calculation base overrides
  // key -> { taxBase, isCustom, concepto, cuenta, accountingBase }
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  
  // Custom temporary difference form
  const [customConcept, setCustomConcept] = useState('');
  const [customCta, setCustomCta] = useState('');
  const [customAccBase, setCustomAccBase] = useState(0);
  const [customTaxBase, setCustomTaxBase] = useState(0);

  // Note edits
  const [noteEdits, setNoteEdits] = useState<Record<number, string>>({});
  const [showNotesWithTables, setShowNotesWithTables] = useState<FinanceNote[]>([]);

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
      } else {
        setTaxRate(29.5);
        setOverrides({});
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

  const handleSaveNIC12 = async () => {
    await saveDeferredTax(selectedPeriod, {
      taxRate,
      overrides
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
      ) : (
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
      )}

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
