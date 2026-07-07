import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookText, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle, X, Edit2, PlusCircle, FileDown, Printer, Bot } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DataTable } from './DataTable';
import { useStore } from '../store';
import type { AsientoCompleto, AsientoLine } from '../store';
import PageHeader from './ui/PageHeader';
import { exportSingleSheet } from '../utils/excelExport';
import ActionBar from './ui/ActionBar';
import FormField from './ui/FormField';
import Button from './ui/Button';
import Toast from './shared/Toast';
import type { ToastData } from './shared/Toast';
import Modal from './shared/Modal';
import DateInput from './shared/DateInput';
import { AIChatPanel } from './AIChatPanel';
import { webApiBridge } from '../services/apiBridge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val).replace('PEN', 'S/');
};

const formatWithCommas = (val: string | number) => {
  const s = val.toString();
  if (!s) return "";
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join('.');
};

const EMPTY_HEADER = {
  asiento: '',
  fecEmi: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  glosa: '',
  anio: new Date().getFullYear().toString(),
  mes: (new Date().getMonth() + 1).toString().padStart(2, '0'),
};

function parseFechaDisplay(fecha: string): { anio: string; mes: string } {
  if (fecha.includes('/')) {
    const parts = fecha.split('/');
    if (parts.length === 3 && parts[2].length === 4) return { anio: parts[2], mes: parts[1].padStart(2, '0') };
  }
  if (fecha.includes('-')) {
    const parts = fecha.split('-');
    if (parts.length === 3) return { anio: parts[0], mes: parts[1].padStart(2, '0') };
  }
  return { anio: new Date().getFullYear().toString(), mes: (new Date().getMonth() + 1).toString().padStart(2, '0') };
}

const AsientosView: React.FC = () => {
  const { plan, asientos, saveAsiento, deleteAsientoById, saveAuditLog, getNextAsientoNumber, draftAsiento, setDraftAsiento, addAccount, glosasHabituales, saveGlosaHabitual, currentCompany } = useStore();
  
  const companyRubro = currentCompany?.businessType || 'COMERCIAL';
  const mappedCategory = companyRubro === 'MANUFACTURERA' ? 'INDUSTRIAL' : companyRubro;
  const filteredGlosas = glosasHabituales.filter(g => g.category === mappedCategory || g.category === 'PERSONAL');

  const [lines, setLines] = useState<AsientoLine[]>(draftAsiento?.lines || []);
  const [currentInput, setCurrentInput] = useState({ cuenta: '', debe: '' as string | number, haber: '' as string | number });
  const [detalleLookup, setDetalleLookup] = useState('');
  const [editingId, setEditingId] = useState<string | null>(draftAsiento?.editingId || null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [suggestionCategory, setSuggestionCategory] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAIChat, setShowAIChat] = useState(() => {
    return sessionStorage.getItem('softcontable_show_ai_chat') === 'true';
  });
  const [saveToAi, setSaveToAi] = useState(false);

  const isAdmin = useMemo(() => {
    const token = localStorage.getItem('softcontable_token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const email = (payload.email || '').trim().toLowerCase();
      return payload.role === 'admin' || email === 'aangelo2555@gmail.com' || email.startsWith('admin');
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('softcontable_show_ai_chat', String(showAIChat));
  }, [showAIChat]);
  const [pendingLines, setPendingLines] = useState<Omit<AsientoLine, 'id'>[]>([]);
  const [focusedField, setFocusedField] = useState<'debe' | 'haber' | null>(null);
  const [glosaModal, setGlosaModal] = useState<{ show: boolean, glosa: string, lines: any[] } | null>(null);
  const [auditModal, setAuditModal] = useState<{
    show: boolean;
    type: 'edit' | 'delete';
    id: string;
    onConfirm: (justificacion: string) => void;
  } | null>(null);
  const [justificacionText, setJustificacionText] = useState('');
  
  const nextNum = getNextAsientoNumber();
  const [header, setHeader] = useState({
    asiento: draftAsiento?.header?.asiento || nextNum,
    fecEmi: draftAsiento?.header?.fecEmi || EMPTY_HEADER.fecEmi,
    glosa: draftAsiento?.header?.glosa || '',
    anio: draftAsiento?.header?.anio || EMPTY_HEADER.anio,
    mes: draftAsiento?.header?.mes || EMPTY_HEADER.mes,
  });

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const cuentaRef = useRef<HTMLInputElement>(null);
  const detalleRef = useRef<HTMLInputElement>(null);
  const debeRef = useRef<HTMLInputElement>(null);
  const haberRef = useRef<HTMLInputElement>(null);

  const lookupAccount = (cta: string) => plan.find(a => a.cta === cta);

  // Requirement: Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    if (showSuggestions) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSuggestions]);

  useEffect(() => { setDraftAsiento({ header, lines, editingId }); }, [header, lines, editingId, setDraftAsiento]);

  useEffect(() => {
    if (!editingId && lines.length === 0) {
      const nextAsiento = getNextAsientoNumber();
      setHeader(h => h.asiento === nextAsiento ? h : { ...h, asiento: nextAsiento });
    }
  }, [asientos.length, editingId, lines.length, getNextAsientoNumber]);

  useEffect(() => {
    if (header.fecEmi) {
      const { anio, mes } = parseFechaDisplay(header.fecEmi);
      setHeader(h => ({ ...h, anio, mes }));
    }
  }, [header.fecEmi]);

  useEffect(() => {
    const ctaNorm = currentInput.cuenta.trim();
    if (ctaNorm) {
      const acc = lookupAccount(ctaNorm);
      setDetalleLookup(acc ? acc.description : '');
    } else { setDetalleLookup(''); }
  }, [currentInput.cuenta, plan]); // Adding plan to dependencies ensures it updates if plan loads later

  const addLine = (insertAt?: number): boolean => {
    const dNum = Number(currentInput.debe);
    const hNum = Number(currentInput.haber);
    
    // Support GLOSA if account is empty but detail exists
    const isGlosa = !currentInput.cuenta && detalleLookup.trim() !== '';
    const finalCuenta = isGlosa ? 'GLOSA' : currentInput.cuenta;

    if (!finalCuenta) { setToast({ type: 'error', message: 'Ingrese un número de cuenta.' }); return false; }
    if (!isGlosa && dNum === 0 && hNum === 0) { setToast({ type: 'error', message: 'Ingrese monto en DEBE o HABER.' }); return false; }
    
    let acc = lookupAccount(finalCuenta);
    const manualDetalle = detalleLookup.trim().toUpperCase() || (isGlosa ? '' : finalCuenta);
    
    // Auto-save new account if it doesn't already exist and the user typed a detail
    if (!acc && detalleLookup.trim() && /^\d+$/.test(finalCuenta)) {
      addAccount({
        cta: finalCuenta,
        description: manualDetalle,
        type: 'Balance',
        reqCenCos: false,
        amarreDebe: '',
        amarreHaber: ''
      });
      acc = { cta: finalCuenta, description: manualDetalle } as any;
      setToast({ type: 'success', message: `Nueva cuenta ${finalCuenta} agregada al plan contable.` });
    }

    const newLine: AsientoLine = {
      id: Date.now(),
      cuenta: finalCuenta,
      detalle: acc ? acc.description : manualDetalle,
      debe: Number(currentInput.debe),
      haber: Number(currentInput.haber),
    };

    // Requirement: Update existing 0.00 entries instead of duplicating (Fixes bug reported)
    const existingIdx = lines.findIndex(l => l.cuenta === finalCuenta && l.debe === 0 && l.haber === 0 && finalCuenta !== 'GLOSA');
    
    if (existingIdx !== -1 && insertAt === undefined) {
      // UPDATE EXISTING (only if not forcing an insertion)
      setLines(prev => prev.map((l, i) => i === existingIdx ? { ...l, detalle: manualDetalle, debe: Number(currentInput.debe), haber: Number(currentInput.haber) } : l));
      setToast({ type: 'success', message: `Línea ${finalCuenta} actualizada.` });
    } else {
      // ADD NEW (End or Insertion)
      if (insertAt !== undefined) {
        setLines(prev => {
          const newArr = [...prev];
          newArr.splice(insertAt + 1, 0, newLine);
          return newArr;
        });
        setToast({ type: 'success', message: `Línea insertada después de la posición ${insertAt + 1}.` });
      } else {
        setLines(prev => [...prev, newLine]);
      }
    }
    
    // Requirement 3: Automatic Account Sequence
    // If we have pending lines, pre-fill the next one
    if (pendingLines.length > 0) {
      const next = pendingLines[0];
      setCurrentInput({ cuenta: next.cuenta, debe: '', haber: '' });
      setPendingLines(prev => prev.slice(1));
    } else {
      setCurrentInput({ cuenta: '', debe: '', haber: '' });
    }
    setDetalleLookup('');
    return true;
  };

  const addGlosaDown = (idx: number) => {
    const newLine: AsientoLine = {
      id: Date.now() + Math.random(),
      cuenta: 'GLOSA',
      detalle: '',
      debe: 0,
      haber: 0,
    };
    setLines(prev => {
      const newArr = [...prev];
      newArr.splice(idx + 1, 0, newLine);
      return newArr;
    });
    setToast({ type: 'success', message: 'Línea de glosa añadida.' });
  };

  const removeLine = (id: number) => setLines(prev => prev.filter(l => l.id !== id));
  
  const handleEditLine = (line: AsientoLine) => {
    // Populate input with line data
    setCurrentInput({ cuenta: line.cuenta, debe: line.debe.toString(), haber: line.haber.toString() });
    setDetalleLookup(line.detalle);
    // Remove the line so it can be re-added after editing
    removeLine(line.id);
    setToast({ type: 'success', message: 'Editando línea...' });
  };

  const totalDebe = lines.reduce((sum, l) => sum + l.debe, 0);
  const totalHaber = lines.reduce((sum, l) => sum + l.haber, 0);
  const balanced = Math.abs(totalDebe - totalHaber) < 0.01;

  const handleGuardar = async () => {
    if (lines.length === 0) { setToast({ type: 'error', message: 'Agregue al menos una línea.' }); return; }
    if (!balanced) { setToast({ type: 'error', message: `No cuadra. Diferencia: ${(totalDebe - totalHaber).toFixed(2)}` }); return; }
    if (!header.glosa.trim()) { setToast({ type: 'error', message: 'Ingrese una glosa.' }); return; }
    
    // Save to AI Knowledge Base if toggled (Feedback Loop)
    if (saveToAi) {
      try {
        const caseItem = {
          sector: currentCompany?.businessType || 'COMERCIAL',
          regimen: currentCompany?.regimenTributario || 'RG',
          niif_norma: 'PCGE MANUAL',
          categoria: 'MANUAL_LEARNING',
          premisa: `Registro manual de asiento para: ${header.glosa}`,
          glosa: header.glosa,
          asiento_json: lines.map(l => ({
            cuenta: l.cuenta,
            detalle: l.detalle,
            debe: Number(l.debe || 0),
            haber: Number(l.haber || 0)
          })),
          explicacion: `Patrón contable aprendido mediante feedback loop desde el editor manual de asientos diarios para la empresa ${currentCompany?.name || 'Local'}.`,
          tags: 'manual, feedback, training'
        };
        await webApiBridge.aiSaveKnowledge(caseItem);
        setSaveToAi(false);
      } catch (err: any) {
        console.error('[AI FEEDBACK LOOP ERROR]:', err);
      }
    }

    if (editingId) {
      setAuditModal({
        show: true,
        type: 'edit',
        id: editingId,
        onConfirm: async (justificacion) => {
          const oldItem = asientos.find(x => x.id === editingId);
          await deleteAsientoById(editingId, justificacion);
          const newId = await saveAsiento({ asiento: header.asiento, fecEmi: header.fecEmi, glosa: header.glosa, anio: header.anio, mes: header.mes }, lines);
          await saveAuditLog(header.asiento || newId, 'UPDATE', oldItem, { header, lines }, justificacion);
          setToast({ type: 'success', message: `Asiento ${header.asiento} actualizado ✓` });

          // Check if glosa is new to suggest saving as habitual
          const isHabitual = glosasHabituales.some(g => g.glosa.toUpperCase() === header.glosa.toUpperCase());
          if (!isHabitual) {
            setGlosaModal({ show: true, glosa: header.glosa.toUpperCase(), lines: [...lines] });
          }

          handleLimpiar();
          setTimeout(() => cuentaRef.current?.focus(), 100);
        }
      });
    } else {
      const newId = await saveAsiento({ asiento: header.asiento, fecEmi: header.fecEmi, glosa: header.glosa, anio: header.anio, mes: header.mes }, lines);
      setToast({ type: 'success', message: `Asiento ${header.asiento} guardado ✓` });

      // Check if glosa is new to suggest saving as habitual
      const isHabitual = glosasHabituales.some(g => g.glosa.toUpperCase() === header.glosa.toUpperCase());
      if (!isHabitual) {
        setGlosaModal({ show: true, glosa: header.glosa.toUpperCase(), lines: [...lines] });
      }

      handleLimpiar();
      setTimeout(() => cuentaRef.current?.focus(), 100);
    }
  };

  const handleConfirmSaveGlosa = () => {
    if (glosaModal) {
      const simpleLines = glosaModal.lines.map(l => ({ cuenta: l.cuenta, detalle: l.detalle }));
      saveGlosaHabitual(glosaModal.glosa, simpleLines, mappedCategory);
      setToast({ type: 'success', message: 'Glosa guardada como habitual.' });
      setGlosaModal(null);
      setTimeout(() => cuentaRef.current?.focus(), 100);
    }
  };

  const handleCargarCategoria = (category: string) => {
    const matching = filteredGlosas.filter(g => g.category === category);
    if (matching.length === 0) return;

    const fechaParts = header.fecEmi.split('/');
    const ddmm = fechaParts.length >= 2 ? `${fechaParts[0]}/${fechaParts[1]}` : '';

    let allLines: AsientoLine[] = [];
    matching.forEach((g, gIdx) => {
      const processedLines = g.lines.map(l => ({
        ...l,
        detalle: l.detalle.replace('{FECHA}', ddmm),
        debe: 0,
        haber: 0
      }));
      
      const convertedLines: AsientoLine[] = processedLines.map((l, idx) => ({
        id: Date.now() + (gIdx * 100) + idx + Math.random(),
        ...l
      }));
      allLines = [...allLines, ...convertedLines];
    });

    setLines(prev => [...prev, ...allLines]);
    setToast({ type: 'success', message: `Todo el sector ${category} cargado.` });
    setSuggestionCategory(null);
    setShowSuggestions(false);
    setHeader(prev => ({ ...prev, glosa: `SECTOR: ${category}` }));
  };

  const handleEliminar = () => {
    if (editingId) {
      setAuditModal({
        show: true,
        type: 'delete',
        id: editingId,
        onConfirm: async (justificacion) => {
          await deleteAsientoById(editingId, justificacion);
          setToast({ type: 'success', message: 'Asiento eliminado.' });
          handleLimpiar();
        }
      });
    }
    else { setLines([]); setPendingLines([]); }
  };

  const handleLimpiarLineas = () => {
    setLines([]);
    setPendingLines([]);
    setCurrentInput({ cuenta: '', debe: '', haber: '' });
    setToast({ type: 'success', message: 'Líneas limpiadas.' });
  };

  const handleLimpiar = () => {
    setLines([]); setPendingLines([]); setCurrentInput({ cuenta: '', debe: '', haber: '' }); setDetalleLookup('');
    setEditingId(null); setDraftAsiento(null);
    setHeader({ asiento: getNextAsientoNumber(), fecEmi: EMPTY_HEADER.fecEmi, glosa: '', anio: EMPTY_HEADER.anio, mes: EMPTY_HEADER.mes });
    setTimeout(() => cuentaRef.current?.focus(), 50);
  };

  const loadAsiento = (a: AsientoCompleto) => { setEditingId(a.id); setHeader({ ...a.header }); setLines([...a.lines]); };

  const handleNavPrev = () => {
    if (asientos.length === 0) return;
    if (!editingId) { loadAsiento(asientos[asientos.length - 1]); return; }
    const idx = asientos.findIndex(a => a.id === editingId);
    if (idx > 0) loadAsiento(asientos[idx - 1]);
  };

  const handleNavNext = () => {
    if (asientos.length === 0 || !editingId) return;
    const idx = asientos.findIndex(a => a.id === editingId);
    if (idx < asientos.length - 1) loadAsiento(asientos[idx + 1]);
    else handleLimpiar();
  };

  const columns = [
    { 
      header: 'CUENTA', 
      accessor: (row: AsientoLine) => (
        <span className={cn(
          "font-mono", 
          row.cuenta === 'GLOSA' ? "text-app-muted/30 italic text-[10px]" : "font-bold"
        )}>
          {row.cuenta === 'GLOSA' ? '—' : row.cuenta}
        </span>
      ), 
      className: 'w-28' 
    },
    { 
      header: 'DETALLE DE CUENTA', 
      accessor: (row: AsientoLine) => (
        <input 
          className={cn(
            "w-full bg-transparent border-none focus:ring-0 p-0",
            row.cuenta === 'GLOSA' ? "italic font-black text-app-text ml-8" : "ml-4"
          )}
          value={row.detalle}
          onChange={(e) => {
            const newVal = e.target.value;
            setLines(prev => prev.map(l => l.id === row.id ? { ...l, detalle: newVal } : l));
          }}
        />
      )
    },
    { 
      header: 'DEBE', 
      accessor: (row: AsientoLine) => (
        <span className="text-right block font-mono font-bold text-emerald-500">
          {row.cuenta !== 'GLOSA' && row.debe > 0 ? formatCurrency(row.debe) : '—'}
        </span>
      ), 
      className: 'w-40' 
    },
    { 
      header: 'HABER', 
      accessor: (row: AsientoLine) => (
        <span className="text-right block font-mono font-bold text-red-500">
          {row.cuenta !== 'GLOSA' && row.haber > 0 ? formatCurrency(row.haber) : '—'}
        </span>
      ), 
      className: 'w-40' 
    },
    { header: '', accessor: (row: AsientoLine, idx: number) => (
      <div className="flex gap-1.5">
        <button onClick={() => addLine(idx)} className="text-emerald-500/50 hover:text-emerald-500 p-1" title="Insertar debajo">
          <PlusCircle size={15} />
        </button>
        <button onClick={() => addGlosaDown(idx)} className="text-pld-blue/50 hover:text-pld-blue p-1" title="Añadir Glosa debajo">
          <BookText size={15} />
        </button>
        <button onClick={() => handleEditLine(row)} className="text-blue-500/50 hover:text-blue-500 p-1" title="Editar"><Edit2 size={15} /></button>
        <button onClick={() => removeLine(row.id)} className="text-red-500/50 hover:text-red-500 p-1" title="Eliminar"><Trash2 size={15} /></button>
      </div>
    ), className: 'w-40' },
  ];

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<BookText size={18} />}
        title="Asientos Contables"
        badge={editingId ? <span className="ml-2 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded text-[10px] font-bold">EDITANDO</span> : undefined}
        actions={
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAIChat(!showAIChat)} 
              className={`h-8 px-3 rounded-lg hover:opacity-95 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${showAIChat ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/10' : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border border-purple-500/20'}`}
              title="Asistente IA Contable"
            >
              <Bot size={14} className={showAIChat ? 'animate-pulse' : ''} />
              Asistente IA
            </button>
            <button onClick={handleNavPrev} className="p-1.5 rounded-lg hover:bg-app-hover transition-colors" title="Anterior"><ChevronLeft size={15} className="text-app-muted" /></button>
            <span className="text-[11px] text-app-muted font-bold">{asientos.length} guardados</span>
            <button onClick={handleNavNext} className="p-1.5 rounded-lg hover:bg-app-hover transition-colors" title="Siguiente"><ChevronRight size={15} className="text-app-muted" /></button>
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Voucher',
              title: `ASIENTO CONTABLE N° ${header.asiento}`,
              columns: [
                { header: 'CUENTA CONTABLE', key: 'cuenta', width: 18, alignment: 'center' },
                { header: 'GLOSA / DETALLE', key: 'detalle', width: 45 },
                { header: 'DEBE (S/)', key: 'debe', width: 15, style: 'currency' },
                { header: 'HABER (S/)', key: 'haber', width: 15, style: 'currency' }
              ],
              rows: lines,
              totals: {
                cuenta: '', detalle: 'TOTAL GENERAL',
                debe: lines.reduce((acc, curr) => acc + (Number(curr.debe) || 0), 0),
                haber: lines.reduce((acc, curr) => acc + (Number(curr.haber) || 0), 0)
              },
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, `Asiento_${header.asiento}`)} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">

          {/* Header Data */}
          <div className="section-card">
            <div className="grid grid-cols-12 gap-4">
              <FormField label="Asiento" accent className="col-span-6 md:col-span-2">
                <input className="w-full text-center font-mono text-base font-bold" value={header.asiento} onChange={e => setHeader({ ...header, asiento: e.target.value })} />
              </FormField>
              <FormField label="Fec. Emisión" className="col-span-6 md:col-span-3">
                <DateInput className="w-full text-sm" placeholder="DD/MM/YYYY" value={header.fecEmi} onChange={v => setHeader({ ...header, fecEmi: v })} />
              </FormField>
              <FormField label="Glosa" required className="col-span-12 md:col-span-5 relative">
                  <input 
                    className="w-full text-sm font-bold text-pld-blue uppercase" 
                    placeholder="Descripción del asiento o busque sector..." 
                    value={header.glosa} 
                    onFocus={() => setShowSuggestions(true)}
                    onChange={e => {
                      const val = e.target.value;
                      setHeader({ ...header, glosa: val });
                      if (!showSuggestions) setShowSuggestions(true);
                    }} 
                  />
                  
                  {/* Panel de Sugerencias Inteligentes */}
                  {showSuggestions && (
                    <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1 bg-app-surface border border-pld-blue/30 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-3 py-2 bg-pld-blue/5 border-b border-app-border flex justify-between items-center">
                        <span className="text-[10px] font-black text-pld-blue uppercase tracking-widest">
                          {suggestionCategory ? `SITUACIÓN: ${suggestionCategory}` : 'CASUÍSTICA SECTORIAL'}
                        </span>
                        <div className="flex gap-2">
                          {suggestionCategory && (
                            <button onClick={() => setSuggestionCategory(null)} className="text-[9px] bg-app-bg px-2 py-0.5 rounded border border-app-border hover:bg-app-hover transition-colors">VOLVER</button>
                          )}
                          <button onClick={() => setShowSuggestions(false)} className="text-[9px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/20 transition-colors">CERRAR</button>
                        </div>
                      </div>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                        {!suggestionCategory ? (
                          <div className="p-1 flex flex-col gap-1">
                            <div className="grid grid-cols-2 gap-1 mb-1">
                              {Array.from(new Set(filteredGlosas.map(g => g.category)))
                                .filter(c => !header.glosa || (c && c.toUpperCase().includes(header.glosa.toUpperCase())))
                                .map(cat => (
                                  <button
                                    key={cat}
                                    onClick={() => setSuggestionCategory(cat || null)}
                                    className="text-left px-3 py-2.5 hover:bg-pld-blue/10 rounded-lg transition-colors border border-transparent hover:border-pld-blue/20 bg-app-bg/30"
                                  >
                                    <span className="block text-[11px] font-black text-pld-blue">{cat}</span>
                                    <span className="text-[9px] text-app-muted italic">{filteredGlosas.filter(g => g.category === cat).length} casos</span>
                                  </button>
                                ))
                              }
                            </div>

                            {header.glosa.length >= 4 && (
                              <div className="border-t border-app-border mt-1 pt-1 px-1">
                                <div className="px-2 py-1 text-[9px] font-bold text-app-muted uppercase italic">Coincidencias individuales</div>
                                {filteredGlosas
                                  .filter(g => g.glosa.toUpperCase().includes(header.glosa.toUpperCase()))
                                  .map(g => (
                                    <button
                                      key={g.id}
                                      onClick={() => {
                                        const fechaParts = header.fecEmi.split('/');
                                        const ddmm = fechaParts.length >= 2 ? `${fechaParts[0]}/${fechaParts[1]}` : '';

                                        const processed = g.lines.map(l => ({
                                          cuenta: l.cuenta,
                                          detalle: l.detalle.replace('{FECHA}', ddmm),
                                          debe: 0,
                                          haber: 0
                                        }));

                                        const withIds: AsientoLine[] = processed.map((l, idx) => ({
                                          id: Date.now() + idx + Math.random(),
                                          ...l
                                        }));

                                        setLines(prev => [...prev, ...withIds]);
                                        
                                        const accounts = processed.filter(l => l.cuenta !== 'GLOSA');
                                        if (accounts.length > 0) {
                                          setCurrentInput({ cuenta: accounts[0].cuenta, debe: '', haber: '' });
                                          setPendingLines(accounts.slice(1));
                                        }

                                        setToast({ type: 'success', message: `Plantilla "${g.glosa}" cargada.` });
                                        setHeader(prev => ({ ...prev, glosa: g.glosa }));
                                        setSuggestionCategory(null);
                                        setShowSuggestions(false);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-pld-blue/10 rounded-md transition-colors group flex justify-between items-center"
                                    >
                                      <span className="text-xs font-bold text-app-text group-hover:text-pld-blue uppercase">{g.glosa}</span>
                                      <span className="text-[8px] bg-pld-blue/10 text-pld-blue px-1 rounded font-black">{g.category}</span>
                                    </button>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                        ) : (
                          // VISTA DE ITEMS DENTRO DE CATEGORÍA
                          <>
                            <button
                              onClick={() => handleCargarCategoria(suggestionCategory)}
                              className="w-full text-left px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/10 border-b border-app-border transition-colors group"
                            >
                              <span className="block text-[11px] font-black text-emerald-600 uppercase">⚡ CARGAR TODO EL SECTOR {suggestionCategory}</span>
                              <span className="text-[9px] text-emerald-500/70 italic">Se añadirán todos los asientos correlativos de este sector</span>
                            </button>
                            {filteredGlosas
                              .filter(g => g.category === suggestionCategory)
                              .map(g => (
                                <button
                                  key={g.id}
                                  onClick={() => {
                                    const fechaParts = header.fecEmi.split('/');
                                    const ddmm = fechaParts.length >= 2 ? `${fechaParts[0]}/${fechaParts[1]}` : '';

                                    const processed = g.lines.map(l => ({
                                      cuenta: l.cuenta,
                                      detalle: l.detalle.replace('{FECHA}', ddmm),
                                      debe: 0,
                                      haber: 0
                                    }));

                                    const withIds: AsientoLine[] = processed.map((l, idx) => ({
                                      id: Date.now() + idx + Math.random(),
                                      ...l
                                    }));

                                    setLines(prev => [...prev, ...withIds]);
                                    
                                    const accounts = processed.filter(l => l.cuenta !== 'GLOSA');
                                    if (accounts.length > 0) {
                                      setCurrentInput({ cuenta: accounts[0].cuenta, debe: '', haber: '' });
                                      setPendingLines(accounts.slice(1));
                                    }

                                    setToast({ type: 'success', message: `Plantilla "${g.glosa}" cargada.` });
                                    setHeader(prev => ({ ...prev, glosa: g.glosa }));
                                    setSuggestionCategory(null);
                                    setShowSuggestions(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-pld-blue/10 border-b border-app-border/50 last:border-0 transition-colors group"
                                >
                                  <span className="block text-xs font-bold text-app-text group-hover:text-pld-blue uppercase">{g.glosa}</span>
                                  <div className="flex gap-2 mt-1">
                                    {g.lines.filter(l => l.cuenta !== 'GLOSA').slice(0, 3).map((l, i) => (
                                      <span key={i} className="text-[9px] bg-app-bg text-app-muted px-1.5 py-0.5 rounded border border-app-border">{l.cuenta}</span>
                                    ))}
                                  </div>
                                </button>
                              ))
                            }
                          </>
                        )}
                      </div>
                    </div>
                  )}
              </FormField>
              <FormField label="Año" className="col-span-6 md:col-span-1">
                <input className="w-full text-center font-bold text-pld-blue bg-app-bg/50 border-none text-sm" value={header.anio} readOnly />
              </FormField>
              <FormField label="Mes" className="col-span-6 md:col-span-1">
                <input className="w-full text-center font-bold text-pld-blue bg-app-bg/50 border-none text-sm" value={header.mes} readOnly />
              </FormField>
            </div>

            {isAdmin && (
              <div className="mt-3 pt-3 border-t border-app-border/40 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="saveToAiKnowledge" 
                  checked={saveToAi} 
                  onChange={(e) => setSaveToAi(e.target.checked)}
                  className="w-4 h-4 text-pld-blue border-app-border rounded focus:ring-pld-blue/15 focus:ring-2 bg-app-bg cursor-pointer"
                />
                <label htmlFor="saveToAiKnowledge" className="text-xs font-bold text-app-muted cursor-pointer flex items-center gap-1.5 hover:text-app-text transition-colors select-none">
                  <span>🤖 Guardar este asiento como patrón de aprendizaje de IA</span>
                  <span className="text-[9px] bg-pld-blue/10 text-pld-blue px-1.5 py-0.5 rounded uppercase font-black tracking-wider">Feedback Loop</span>
                </label>
              </div>
            )}
          </div>

          {/* Line Input */}
          <div className="grid grid-cols-12 gap-3 items-end bg-app-surface p-4 rounded-lg border border-app-border">
            <FormField label="Cuenta" className="col-span-12 sm:col-span-2">
               <input 
                 ref={cuentaRef}
                 className="w-full text-sm font-mono tracking-wider" 
                 value={currentInput.cuenta} 
                 onChange={e => setCurrentInput({ ...currentInput, cuenta: e.target.value })} 
                 placeholder="Ej: 1041" 
                 onKeyDown={e => {
                   if (e.key === 'Enter') {
                     const acc = lookupAccount(currentInput.cuenta.trim());
                     if (acc) {
                       debeRef.current?.focus();
                     } else {
                       detalleRef.current?.focus();
                     }
                   }
                 }} 
               />
            </FormField>
            <FormField label="Detalle" className="col-span-12 sm:col-span-4">
              <input 
                ref={detalleRef}
                className={`w-full text-sm ${lookupAccount(currentInput.cuenta.trim()) ? 'italic bg-app-bg/30 text-app-muted' : 'border-blue-400 focus:ring-blue-500/20'}`} 
                readOnly={!!lookupAccount(currentInput.cuenta.trim())} 
                placeholder="(NUEVO DETALLE)" 
                value={detalleLookup}
                onChange={e => setDetalleLookup(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    debeRef.current?.focus();
                  }
                }}
              />
            </FormField>
            <FormField label="Debe" accent className="col-span-6 sm:col-span-2">
              <input 
                type="text" 
                className="w-full text-sm font-mono text-right font-bold text-emerald-500" 
                value={focusedField === 'debe' ? formatWithCommas(currentInput.debe) : formatCurrency(Number(currentInput.debe))} 
                ref={debeRef}
                onFocus={() => setFocusedField('debe')}
                onBlur={() => setFocusedField(null)}
                onChange={e => {
                  const val = e.target.value.replace(/,/g, '');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setCurrentInput({ ...currentInput, debe: val, haber: '' });
                  }
                }} 
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    haberRef.current?.focus();
                  } else if (e.key === 'Enter') {
                    if (addLine()) {
                      setTimeout(() => cuentaRef.current?.focus(), 10);
                    }
                  }
                }} 
             />
            </FormField>
            <FormField label="Haber" className="col-span-6 sm:col-span-2">
              <input 
                type="text" 
                className="w-full text-sm font-mono text-right font-bold text-red-500" 
                value={focusedField === 'haber' ? formatWithCommas(currentInput.haber) : formatCurrency(Number(currentInput.haber))} 
                ref={haberRef}
                onFocus={() => setFocusedField('haber')}
                onBlur={() => setFocusedField(null)}
                onChange={e => {
                  const val = e.target.value.replace(/,/g, '');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setCurrentInput({ ...currentInput, haber: val, debe: '' });
                  }
                }} 
                onKeyDown={e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    debeRef.current?.focus();
                  } else if (e.key === 'Enter') {
                    if (addLine()) {
                      setTimeout(() => cuentaRef.current?.focus(), 10);
                    }
                  }
                }} 
             />
            </FormField>
            <div className="col-span-12 sm:col-span-2 flex gap-2">
              <Button variant="primary" size="md" icon={<Plus size={15} />} onClick={() => addLine()} className="flex-1">
                Agregar
              </Button>
              <button 
                onClick={handleLimpiarLineas}
                className="p-2.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20" 
                title="Limpiar todas las líneas"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Lines Table */}
          <div className="flex-1 overflow-hidden">
            <DataTable
              columns={columns}
              data={lines}
              emptyMessage="Ingrese líneas de asiento contable para comenzar."
              totals={
                <tr className="bg-app-surface">
                  <td colSpan={2} className="p-3 text-center text-pld-blue tracking-widest font-bold uppercase text-xs">TOTALES</td>
                  <td className="p-3 text-right font-mono text-lg font-bold text-emerald-500 border-l border-app-border/50">{formatCurrency(totalDebe)}</td>
                  <td className="p-3 text-right font-mono text-lg font-bold text-red-500 border-l border-app-border/50">{formatCurrency(totalHaber)}</td>
                  <td></td>
                </tr>
              }
            />
          </div>

          {/* Balance Indicator */}
          {lines.length > 0 && (
            <div className="flex justify-end">
              <div className={`flex items-center gap-4 px-6 py-3 rounded-xl border ${balanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-app-muted uppercase tracking-wider">Diferencia</p>
                  <p className={`text-xl font-mono font-bold ${balanced ? 'text-emerald-500' : 'text-red-400'}`}>
                    {(totalDebe - totalHaber).toFixed(2)}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${balanced ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {balanced ? <CheckCircle size={28} /> : <X size={28} />}
                </div>
              </div>
            </div>
          )}

          {/* Saved Asientos */}
          {asientos.length > 0 && (
            <div className="section-card !p-0 overflow-hidden">
              <div className="bg-app-bg px-4 py-2.5 text-[11px] font-bold text-app-muted uppercase tracking-wider border-b border-app-border">
                Asientos Guardados ({asientos.length})
              </div>
              <div className="overflow-x-auto max-h-44 custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-app-surface sticky top-0">
                    <tr className="text-app-muted font-bold uppercase">
                      <th className="p-2 text-left">N°</th>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Glosa</th>
                      <th className="p-2 text-right">Debe</th>
                      <th className="p-2 text-right">Haber</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {asientos.map(a => {
                      const td = a.lines.reduce((s, l) => s + l.debe, 0);
                      const th = a.lines.reduce((s, l) => s + l.haber, 0);
                      return (
                        <tr key={a.id} onClick={() => loadAsiento(a)}
                          className={`cursor-pointer border-b border-app-border/50 hover:bg-app-hover transition-colors font-mono ${editingId === a.id ? 'bg-pld-blue/10' : ''}`}>
                          <td className="p-2 text-pld-blue font-bold">{a.header.asiento}</td>
                          <td className="p-2 text-app-muted">{a.header.fecEmi}</td>
                          <td className="p-2 uppercase truncate max-w-[200px] font-sans">{a.header.glosa}</td>
                          <td className="p-2 text-right text-emerald-500">{formatCurrency(td)}</td>
                          <td className="p-2 text-right text-red-500">{formatCurrency(th)}</td>
                          <td className="p-2">
                            <button onClick={e => {
                              e.stopPropagation();
                              setAuditModal({
                                show: true,
                                type: 'delete',
                                id: a.id,
                                onConfirm: async (justificacion) => {
                                  await deleteAsientoById(a.id, justificacion);
                                  if (editingId === a.id) handleLimpiar();
                                }
                              });
                            }} className="text-red-500/50 hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      <ActionBar
        onSave={handleGuardar}
        onClear={handleLimpiar}
        saveDisabled={!balanced || lines.length === 0}
        saveLabel={editingId ? 'Actualizar' : 'Guardar Asiento'}
        extraActions={
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="md" 
              icon={<BookText size={14} />} 
              onClick={() => addGlosaDown(lines.length - 1)}
              className="border-pld-blue/30 text-pld-blue hover:bg-pld-blue/5"
            >
              Glosa
            </Button>
            {editingId && (
              <Button variant="danger" size="md" icon={<Trash2 size={14} />} onClick={handleEliminar}>
                Eliminar
              </Button>
            )}
          </div>
        }
        statusLeft={
          <div className="flex items-center gap-3 text-xs text-app-muted">
            <span className="font-mono font-bold text-pld-blue">{header.asiento}</span>
            {lines.length > 0 && (
              <span className={`px-2 py-0.5 rounded font-bold ${balanced ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {balanced ? '✓ Cuadrado' : `✗ Dif: ${(totalDebe - totalHaber).toFixed(2)}`}
              </span>
            )}
          </div>
        }
      />

        </div>
        {showAIChat && (
          <AIChatPanel
            onClose={() => setShowAIChat(false)}
            onApplyEntry={(generatedLines, glosa) => {
              setLines(generatedLines);
              setHeader(prev => ({ ...prev, glosa }));
              const accounts = generatedLines.filter(l => l.cuenta !== 'GLOSA');
              if (accounts.length > 0) {
                setCurrentInput({ cuenta: accounts[0].cuenta, debe: '', haber: '' });
              }
            }}
          />
        )}
      </div>

      {/* Modal de Confirmación de Glosa Habitual */}
      <Modal 
        open={!!glosaModal?.show} 
        onClose={() => { setGlosaModal(null); setTimeout(() => cuentaRef.current?.focus(), 50); }}
        title="Nueva Glosa Detectada"
        subtitle="Sugerencia de automatización"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-5">
          <div className="p-4 bg-pld-blue/5 border border-pld-blue/20 rounded-xl">
            <p className="text-[10px] font-black text-pld-blue uppercase tracking-widest mb-1">Concepto</p>
            <p className="text-sm font-bold text-app-text">{glosaModal?.glosa}</p>
          </div>
          
          <p className="text-xs text-app-muted leading-relaxed">
            ¿Deseas añadir esta descripción y su estructura de cuentas como <span className="text-pld-blue font-bold">glosa habitual</span> para esta empresa? 
            Esto te permitirá cargar este asiento automáticamente en el futuro.
          </p>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              size="md" 
              className="flex-1 border-app-border text-app-muted" 
              onClick={() => { setGlosaModal(null); setTimeout(() => cuentaRef.current?.focus(), 50); }}
            >
              No, gracias
            </Button>
            <Button 
              variant="primary" 
              size="md" 
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-lg shadow-blue-600/20" 
              onClick={handleConfirmSaveGlosa}
              icon={<Plus size={14} />}
            >
              Sí, Guardar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Justificación de Auditoría */}
      <Modal
        open={!!auditModal?.show}
        onClose={() => {
          setAuditModal(null);
          setJustificacionText('');
          setTimeout(() => cuentaRef.current?.focus(), 50);
        }}
        title="JUSTIFICACIÓN DE AUDITORÍA REQUERIDA"
        subtitle={auditModal?.type === 'delete' ? "Está eliminando un asiento contable manual." : "Está modificando un asiento contable manual."}
        maxWidth="max-w-md"
        accentColor="amber-500"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-app-muted leading-relaxed">
            De acuerdo con las políticas de control interno y cumplimiento 2026, debe ingresar una justificación obligatoria detallando el motivo de este cambio para el registro inmutable en los logs de auditoría de los accionistas.
          </p>
          <textarea
            className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 transition-all font-sans text-app-text min-h-[100px]"
            placeholder="Ingrese el motivo detallado de la modificación/eliminación aquí..."
            value={justificacionText}
            onChange={e => setJustificacionText(e.target.value)}
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="flex-1 border-app-border text-app-muted"
              onClick={() => {
                setAuditModal(null);
                setJustificacionText('');
                setTimeout(() => cuentaRef.current?.focus(), 50);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-none shadow-lg shadow-amber-600/20"
              onClick={() => {
                if (!justificacionText.trim()) {
                  setToast({ type: 'error', message: 'La justificación es obligatoria.' });
                  return;
                }
                auditModal?.onConfirm(justificacionText.trim());
                setAuditModal(null);
                setJustificacionText('');
              }}
            >
              Confirmar Cambio
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AsientosView;
