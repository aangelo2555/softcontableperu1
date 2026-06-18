import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShoppingCart, 
  Calculator, 
  Edit2,
  Trash2,
  Unlock,
  Plus,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  ArrowRightLeft,
  UploadCloud,
  CheckCircle2,
  HelpCircle,
  Link2,
  Unlink,
  RefreshCw,
  ChevronRight,
  FileCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../store';
import { toast } from 'react-hot-toast';
import { exportMultipleSheets } from '../utils/excelExport';
import { parseBankStatement } from '../utils/bankImporter';
import { getMatchSuggestions } from '../engine/bankReconciliation';
import { validateCrossBook } from '../engine/crossBookValidator';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC'];

// --- Subcomponente: Celda Editable ---
interface EditableCellProps {
  value: number;
  onSave: (val: number) => void;
  isOverride?: boolean;
  onReset?: () => void;
  className?: string;
  prefix?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, isOverride, onReset, className = '', prefix = '' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toFixed(2));

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(tempValue.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed) && parsed !== value) {
      onSave(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setTempValue(value.toFixed(2));
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        className={`w-full bg-pld-blue/10 border-none outline-none text-right font-mono p-1 rounded text-app-text ${className}`}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div 
      className={`group cursor-pointer relative flex items-center justify-end gap-1 px-1 rounded hover:bg-app-hover transition-all ${isOverride ? 'text-pld-blue font-bold' : 'text-app-text'} ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {prefix}{value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {isOverride && onReset && (
        <button 
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-app-muted hover:text-pld-blue transition-all"
          title="Restablecer"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
};

// --- Componente Principal ---
const MovimientosView: React.FC = () => {
  const { 
    sales, 
    purchases, 
    currentCompany, 
    movimientosData, 
    upsertMovimientoData, 
    deleteMovimientoData,
    bankStatements,
    journal,
    loadBankStatements,
    importBankStatements,
    reconcileTransaction,
    unreconcileTransaction,
    autoMatchBank
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<'fiscal' | 'bancos'>('fiscal');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth());
  const [isAddingCta, setIsAddingCta] = useState<{ section: 'V' | 'C' | null }>({ section: null });
  const [newCtaValue, setNewCtaValue] = useState('');
  
  const [renamingCta, setRenamingCta] = useState<{ section: 'V' | 'C', oldCta: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Estados para Conciliación Bancaria
  const [selectedBankCta, setSelectedBankCta] = useState('10411');
  const [selectedStmtLineId, setSelectedStmtLineId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [bankFilter, setBankFilter] = useState<'todos' | 'conciliados' | 'pendientes'>('todos');
  const [crossBookTab, setCrossBookTab] = useState<'compras' | 'ventas'>('compras');

  const currentPeriod = currentCompany.period || new Date().getFullYear().toString();

  // Cargar extractos bancarios al iniciar o cambiar de empresa
  useEffect(() => {
    if (currentCompany?.ruc) {
      loadBankStatements();
    }
  }, [currentCompany?.ruc]);

  const handleSave = async (monthNum: number, section: string, key: string, value: number) => {
    await upsertMovimientoData({ month: monthNum, section, key, value });
    toast.success('Cambio guardado');
  };

  const handleReset = async (monthNum: number, section: string, key: string) => {
    await deleteMovimientoData(monthNum, section, key);
    toast.success('Valores restablecidos');
  };

  const handleAddAccountAction = () => {
    if (newCtaValue && /^\d+$/.test(newCtaValue) && isAddingCta.section) {
      const targetMonth = selectedMonthIndex + 1;
      handleSave(targetMonth, isAddingCta.section, newCtaValue, 0);
      setNewCtaValue('');
      setIsAddingCta({ section: null });
    } else if (isAddingCta.section) {
      toast.error('Ingrese un número de cuenta válido');
    }
  };

  const handleDeleteAccount = async (section: 'V' | 'C', cta: string) => {
    if (!window.confirm(`¿Seguro que desea eliminar la cuenta ${cta} y todo su contenido sobreescrito manualmente en todos los periodos?`)) return;
    const relevantList = movimientosData.filter(m => m.section === section && m.key === cta && m.period === currentPeriod);
    for (const m of relevantList) {
      await deleteMovimientoData(m.month, m.section, m.key);
    }
    toast.success('Cuenta eliminada');
  };

  const handleRenameAccountConfirm = async () => {
    if (!renamingCta) return;
    const { section, oldCta } = renamingCta;
    const newCta = renameValue.trim();
    
    if (!newCta || newCta === oldCta || !/^\d+$/.test(newCta)) {
       setRenamingCta(null);
       return;
    }
    
    const relevantList = movimientosData.filter(m => m.section === section && m.key === oldCta && m.period === currentPeriod);
    for (const m of relevantList) {
      await upsertMovimientoData({ ...m, key: newCta });
      await deleteMovimientoData(m.month, m.section, oldCta);
    }
    
    setRenamingCta(null);
    setRenameValue('');
    toast.success('Cuenta renombrada');
  };

  // --- Lógica del Dashboard Fiscal ---
  const monthlyData = useMemo(() => {
    const getCtaKeys = (section: string) => {
      const keys = movimientosData
        .filter(m => m.section === section && m.period === currentPeriod)
        .map(m => m.key)
        .filter(k => !['BI', 'EXO', 'IGV', 'TOT', 'V', 'C', 'VAL'].includes(k));
      return Array.from(new Set(keys));
    };

    const vManualKeys = getCtaKeys('V');
    const cManualKeys = getCtaKeys('C');

    const vDetectedKeys = Array.from(new Set(sales
      .filter(s => new Date(s.fecha).getFullYear().toString() === currentPeriod)
      .map(s => s.ctaIngreso || '70111')
    ));
    const cDetectedKeys = Array.from(new Set(purchases
      .filter(p => new Date(p.fecha).getFullYear().toString() === currentPeriod)
      .map(p => p.ctaGasto || '60111')
    ));

    const allVctas = Array.from(new Set([...vManualKeys, ...vDetectedKeys, '70111']));
    const allCctas = Array.from(new Set([...cManualKeys, ...cDetectedKeys, '60111', '63111']));

    return MONTHS.map((name, index) => {
      const monthNum = index + 1;

      const filterByMonth = (items: any[]) => items.filter(i => {
        const d = new Date(i.fecha);
        return (d.getMonth() + 1 === monthNum) && (d.getFullYear().toString() === currentPeriod);
      });

      const mSales = filterByMonth(sales);
      const mPurchases = filterByMonth(purchases);

      const salesAccounts: Record<string, { val: number, ov: boolean }> = {};
      allVctas.forEach(cta => {
        const sysVal = mSales.filter(s => (s.ctaIngreso || '70111') === cta).reduce((acc, s) => acc + s.bi, 0);
        const ovVal = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === cta && m.period === currentPeriod)?.value;
        salesAccounts[cta] = { val: ovVal ?? sysVal, ov: ovVal !== undefined };
      });

      const sBI = Object.values(salesAccounts).reduce((acc, a) => acc + a.val, 0);
      const sEXO_sys = mSales.reduce((acc, s) => acc + (s.noGravada || 0), 0);
      const sEXO_ov = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === 'EXO' && m.period === currentPeriod)?.value;
      const sEXO = sEXO_ov ?? sEXO_sys;

      const sIGV_sys = mSales.reduce((acc, s) => acc + s.igv, 0);
      const sIGV_ov = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === 'IGV' && m.period === currentPeriod)?.value;
      const hasAnyVov = Object.values(salesAccounts).some(a => a.ov);
      const sIGV = sIGV_ov ?? (hasAnyVov ? sBI * 0.18 : sIGV_sys);

      const sTotal_sys = mSales.reduce((acc, s) => acc + s.total, 0);
      const sTotal_ov = movimientosData.find(m => m.month === monthNum && m.section === 'V' && m.key === 'TOT' && m.period === currentPeriod)?.value;
      const sTotal = sTotal_ov ?? (hasAnyVov || sIGV_ov !== undefined ? sBI + sEXO + sIGV : sTotal_sys);

      const purchaseAccounts: Record<string, { val: number, ov: boolean }> = {};
      allCctas.forEach(cta => {
        const sysVal = mPurchases.filter(p => (p.ctaGasto || '60111') === cta).reduce((acc, p) => acc + p.bi, 0);
        const ovVal = movimientosData.find(m => m.month === monthNum && m.section === 'C' && m.key === cta && m.period === currentPeriod)?.value;
        purchaseAccounts[cta] = { val: ovVal ?? sysVal, ov: ovVal !== undefined };
      });

      const pBI = Object.values(purchaseAccounts).reduce((acc, a) => acc + a.val, 0);
      const pIGV_sys = mPurchases.reduce((acc, p) => acc + p.igv, 0);
      const pIGV_ov = movimientosData.find(m => m.month === monthNum && m.section === 'C' && m.key === 'IGV' && m.period === currentPeriod)?.value;
      const hasAnyPov = Object.values(purchaseAccounts).some(a => a.ov);
      const pIGV = pIGV_ov ?? (hasAnyPov ? pBI * 0.18 : pIGV_sys);

      const pTotal_sys = mPurchases.reduce((acc, p) => acc + p.total, 0);
      const pTotal_ov = movimientosData.find(m => m.month === monthNum && m.section === 'C' && m.key === 'TOT' && m.period === currentPeriod)?.value;
      const pTotal = pTotal_ov ?? (hasAnyPov || pIGV_ov !== undefined ? pBI + pIGV : pTotal_sys);

      const pdtV = movimientosData.find(m => m.month === monthNum && m.section === 'PDT' && m.key === 'V' && m.period === currentPeriod)?.value ?? 0;
      const pdtC = movimientosData.find(m => m.month === monthNum && m.section === 'PDT' && m.key === 'C' && m.period === currentPeriod)?.value ?? 0;
      const rentaManual = movimientosData.find(m => m.month === monthNum && m.section === 'R' && m.key === 'VAL' && m.period === currentPeriod)?.value;
      const isMYPE = currentCompany.regimenTributario === 'MYPE';
      const mypeRate = (currentCompany.annualIncomeUIT || 0) <= 300 ? 0.01 : 0.015;
      const renta = rentaManual ?? (sBI * (isMYPE ? mypeRate : 0.015));

      return {
        monthNum, name,
        sales: { bi: sBI, exo: sEXO, igv: sIGV, total: sTotal, acc: salesAccounts, ov: { exo: sEXO_ov!==undefined, igv: sIGV_ov!==undefined, tot: sTotal_ov!==undefined } },
        purchases: { bi: pBI, igv: pIGV, total: pTotal, acc: purchaseAccounts, ov: { igv: pIGV_ov!==undefined, tot: pTotal_ov!==undefined } },
        pdt: { v: pdtV, c: pdtC, ovV: pdtV!==0, ovC: pdtC!==0 },
        renta, isRentaOv: rentaManual !== undefined
      };
    });
  }, [sales, purchases, currentCompany, movimientosData]);

  const totals = useMemo(() => {
    return monthlyData.reduce((acc, m) => ({
      s: { bi: acc.s.bi + m.sales.bi, exo: acc.s.exo + m.sales.exo, igv: acc.s.igv + m.sales.igv, tot: acc.s.tot + m.sales.total },
      p: { bi: acc.p.bi + m.purchases.bi, igv: acc.p.igv + m.purchases.igv, tot: acc.p.tot + m.purchases.total },
      renta: acc.renta + m.renta
    }), { s: { bi: 0, exo: 0, igv: 0, tot: 0 }, p: { bi: 0, igv: 0, tot: 0 }, renta: 0 });
  }, [monthlyData]);

  const format = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- Lógica del Workspace de Conciliación Bancaria ---
  const selectedMonthStr = String(selectedMonthIndex + 1).padStart(2, '0');
  const selectedPeriodStr = `${currentPeriod}-${selectedMonthStr}`;

  // Filtrar extracto y diario
  const currentStatements = useMemo(() => {
    const list = bankStatements.filter(s => s.fecha.startsWith(selectedPeriodStr));
    if (bankFilter === 'conciliados') return list.filter(s => s.reconciled_journal_id !== null);
    if (bankFilter === 'pendientes') return list.filter(s => s.reconciled_journal_id === null);
    return list;
  }, [bankStatements, selectedPeriodStr, bankFilter]);

  const currentJournalEntries = useMemo(() => {
    // Filtrar asientos de diario del mes y de cuentas que empiezan con 10 (Caja y Bancos)
    return journal.filter(j => j.fecha.startsWith(selectedPeriodStr) && j.cta.startsWith(selectedBankCta));
  }, [journal, selectedPeriodStr, selectedBankCta]);

  // Líneas del diario contable que aún no están conciliadas
  const unreconciledJournalEntries = useMemo(() => {
    const reconciledIds = new Set(bankStatements.map(s => s.reconciled_journal_id).filter(Boolean));
    return currentJournalEntries.filter(j => !reconciledIds.has(j.id));
  }, [currentJournalEntries, bankStatements]);

  // Totales de conciliación
  const bankStats = useMemo(() => {
    const list = bankStatements.filter(s => s.fecha.startsWith(selectedPeriodStr));
    const total = list.reduce((sum, s) => sum + s.monto, 0);
    const reconciled = list.filter(s => s.reconciled_journal_id !== null).reduce((sum, s) => sum + s.monto, 0);
    const count = list.length;
    const reconciledCount = list.filter(s => s.reconciled_journal_id !== null).length;
    const rate = count > 0 ? Math.round((reconciledCount / count) * 100) : 0;
    return { total, reconciled, rate, count, reconciledCount };
  }, [bankStatements, selectedPeriodStr]);

  // Fila del extracto seleccionada actualmente
  const selectedStmtLine = useMemo(() => {
    return bankStatements.find(s => s.id === selectedStmtLineId);
  }, [bankStatements, selectedStmtLineId]);

  // Sugerencias de coincidencia contable
  const suggestions = useMemo(() => {
    if (!selectedStmtLine) return [];
    return getMatchSuggestions(selectedStmtLine, unreconciledJournalEntries);
  }, [selectedStmtLine, unreconciledJournalEntries]);

  // Reporte de Validación Cruzada (Cross-Book Validator)
  const crossBookReport = useMemo(() => {
    const periodJournal = journal.filter(j => j.fecha.startsWith(selectedPeriodStr));
    const periodPurchases = purchases.filter(p => p.fecha.startsWith(selectedPeriodStr));
    const periodSales = sales.filter(s => s.fecha.startsWith(selectedPeriodStr));
    return validateCrossBook(periodPurchases, periodSales, periodJournal);
  }, [purchases, sales, journal, selectedPeriodStr]);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileImport(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileImport(files[0]);
    }
  };

  const handleFileImport = async (file: File) => {
    const loader = toast.loading('Procesando extracto bancario...');
    try {
      const parsedLines = await parseBankStatement(file);
      if (parsedLines.length === 0) {
        toast.error('No se detectaron transacciones válidas en el archivo.', { id: loader });
        return;
      }
      
      const success = await importBankStatements(parsedLines);
      if (success) {
        toast.success(`Se importaron ${parsedLines.length} movimientos bancarios correctamente.`, { id: loader });
        setSelectedStmtLineId(null);
      } else {
        toast.error('Error al guardar movimientos en el servidor.', { id: loader });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Error al leer el archivo: ${error.message || error}`, { id: loader });
    }
  };

  const handleReconcile = async (journalId: string) => {
    if (!selectedStmtLineId) return;
    const success = await reconcileTransaction(selectedStmtLineId, journalId);
    if (success) {
      toast.success('Conciliación guardada con éxito.');
      setSelectedStmtLineId(null);
    } else {
      toast.error('Error al guardar la conciliación.');
    }
  };

  const handleUnreconcile = async (statementId: string) => {
    const success = await unreconcileTransaction(statementId);
    if (success) {
      toast.success('Conciliación deshecha correctamente.');
      setSelectedStmtLineId(null);
    } else {
      toast.error('Error al deshacer la conciliación.');
    }
  };

  const handleAutoMatch = async () => {
    setIsAutoMatching(true);
    const loader = toast.loading('Buscando coincidencia automática en base a reglas de partida doble...');
    try {
      const count = await autoMatchBank(selectedPeriodStr);
      if (count > 0) {
        toast.success(`Conciliación Automática Exitosa: Se encontraron y vincularon ${count} transacciones.`, { id: loader });
      } else {
        toast.success('El motor de conciliación analizó todas las líneas pero no encontró sugerencias con alta probabilidad.', { id: loader, duration: 4000 });
      }
    } catch (e: any) {
      toast.error(`Error en conciliación automática: ${e.message || e}`, { id: loader });
    } finally {
      setIsAutoMatching(false);
    }
  };

  const exportExcel = () => {
    const resumenData = monthlyData.map(m => ({
      Mes: m.name,
      'Ventas BI': m.sales.bi,
      'Ventas EXO': m.sales.exo,
      'Ventas IGV': m.sales.igv,
      'Ventas Total': m.sales.total,
      'Compras BI': m.purchases.bi,
      'Compras IGV': m.purchases.igv,
      'Compras Total': m.purchases.total,
      'P.A.C. Renta': m.renta,
      'PDT Calc (Sist)': m.sales.igv - m.purchases.igv,
      'PDT Decl (Manual)': m.pdt.v - m.pdt.c,
      'Diferencia': (m.sales.igv - m.purchases.igv) - (m.pdt.v - m.pdt.c)
    }));

    const ventasCtas: any[] = [];
    const allVctas = Object.keys(monthlyData[0].sales.acc).sort();
    allVctas.forEach(cta => {
      const row: any = { Cuenta: cta, Tipo: 'VENTAS' };
      MONTHS.forEach((m, i) => {
        row[m] = monthlyData[i].sales.acc[cta].val;
      });
      row['TOTAL'] = monthlyData.reduce((acc, m) => acc + m.sales.acc[cta].val, 0);
      ventasCtas.push(row);
    });

    const comprasCtas: any[] = [];
    const allCctas = Object.keys(monthlyData[0].purchases.acc).sort();
    allCctas.forEach(cta => {
      const row: any = { Cuenta: cta, Tipo: 'COMPRAS' };
      MONTHS.forEach((m, i) => {
        row[m] = monthlyData[i].purchases.acc[cta].val;
      });
      row['TOTAL'] = monthlyData.reduce((acc, m) => acc + m.purchases.acc[cta].val, 0);
      comprasCtas.push(row);
    });

    const monthColumns = MONTHS.map(m => ({
      header: m,
      key: m,
      width: 12,
      style: 'currency' as const,
      alignment: 'right' as const
    }));

    const salesTotals: Record<string, any> = { Cuenta: 'TOTAL GENERAL', Tipo: '' };
    MONTHS.forEach((m, idx) => {
      salesTotals[m] = monthlyData[idx].sales.bi;
    });
    salesTotals['TOTAL'] = totals.s.bi;

    const purchasesTotals: Record<string, any> = { Cuenta: 'TOTAL GENERAL', Tipo: '' };
    MONTHS.forEach((m, idx) => {
      purchasesTotals[m] = monthlyData[idx].purchases.bi;
    });
    purchasesTotals['TOTAL'] = totals.p.bi;

    exportMultipleSheets([
      {
        sheetName: 'Resumen Fiscal',
        title: 'RESUMEN FISCAL MENSUAL - IGV Y RENTA',
        columns: [
          { header: 'MES', key: 'Mes', width: 10, alignment: 'center' },
          { header: 'VENTAS BI', key: 'Ventas BI', width: 16, style: 'currency' },
          { header: 'VENTAS EXO', key: 'Ventas EXO', width: 16, style: 'currency' },
          { header: 'VENTAS IGV', key: 'Ventas IGV', width: 16, style: 'currency' },
          { header: 'VENTAS TOTAL', key: 'Ventas Total', width: 18, style: 'currency' },
          { header: 'COMPRAS BI', key: 'Compras BI', width: 16, style: 'currency' },
          { header: 'COMPRAS IGV', key: 'Compras IGV', width: 16, style: 'currency' },
          { header: 'COMPRAS TOTAL', key: 'Compras Total', width: 18, style: 'currency' },
          { header: 'P.A.C. RENTA', key: 'P.A.C. Renta', width: 16, style: 'currency' },
          { header: 'PDT CALC (SIST)', key: 'PDT Calc (Sist)', width: 16, style: 'currency' },
          { header: 'PDT DECL (MANUAL)', key: 'PDT Decl (Manual)', width: 16, style: 'currency' },
          { header: 'DIFERENCIA', key: 'Diferencia', width: 16, style: 'currency' }
        ],
        rows: resumenData,
        totals: {
          Mes: 'TOTAL GENERAL',
          'Ventas BI': totals.s.bi,
          'Ventas EXO': totals.s.exo,
          'Ventas IGV': totals.s.igv,
          'Ventas Total': totals.s.tot,
          'Compras BI': totals.p.bi,
          'Compras IGV': totals.p.igv,
          'Compras Total': totals.p.tot,
          'P.A.C. Renta': totals.renta,
          'PDT Calc (Sist)': totals.s.igv - totals.p.igv,
          'PDT Decl (Manual)': monthlyData.reduce((acc, m) => acc + (m.pdt.v - m.pdt.c), 0),
          'Diferencia': (totals.s.igv - totals.p.igv) - monthlyData.reduce((acc, m) => acc + (m.pdt.v - m.pdt.c), 0)
        },
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: currentPeriod,
        }
      },
      {
        sheetName: 'Detalle Ventas',
        title: 'DETALLE MENSUAL DE CUENTAS DE VENTAS (CLASE 7)',
        columns: [
          { header: 'CUENTA', key: 'Cuenta', width: 12, alignment: 'center' },
          { header: 'TIPO', key: 'Tipo', width: 12, alignment: 'center' },
          ...monthColumns,
          { header: 'TOTAL', key: 'TOTAL', width: 16, style: 'currency' }
        ],
        rows: ventasCtas,
        totals: salesTotals,
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: currentPeriod,
        }
      },
      {
        sheetName: 'Detalle Compras',
        title: 'DETALLE MENSUAL DE CUENTAS DE COMPRAS (CLASE 6)',
        columns: [
          { header: 'CUENTA', key: 'Cuenta', width: 12, alignment: 'center' },
          { header: 'TIPO', key: 'Tipo', width: 12, alignment: 'center' },
          ...monthColumns,
          { header: 'TOTAL', key: 'TOTAL', width: 16, style: 'currency' }
        ],
        rows: comprasCtas,
        totals: purchasesTotals,
        companyInfo: {
          ruc: currentCompany?.ruc || '',
          name: currentCompany?.name || 'EMPRESA',
          period: currentPeriod,
        }
      }
    ], `Reporte_Fiscal_${currentCompany.ruc}_${currentPeriod}`);
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10 h-full overflow-y-auto bg-app-bg custom-scrollbar animate-fade-in print:bg-white print:p-0">
      
      {/* Header */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-app-text flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20 text-white">
              <ArrowRightLeft size={24} />
            </div>
            {activeSubTab === 'fiscal' ? 'Movimientos Fiscales' : 'Conciliación Bancaria'}
          </h1>
          <p className="text-xs font-bold text-app-muted mt-1 uppercase tracking-widest">
            {currentCompany.name} • {currentCompany.period}
          </p>
        </div>
        <div className="flex gap-3">
          {activeSubTab === 'fiscal' && (
            <>
              <button onClick={exportExcel} className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2 text-[10px] font-black uppercase">
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button onClick={exportPDF} className="p-2.5 bg-app-surface border border-app-border text-app-text rounded-xl shadow-sm hover:scale-105 transition-all flex items-center gap-2 text-[10px] font-black uppercase">
                <FileText size={16} /> Imprimir
              </button>
            </>
          )}
          <div className="bg-app-surface px-4 py-2 rounded-xl shadow-sm border border-app-border flex items-center gap-2 ml-4">
            <Unlock size={14} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-app-muted">Edición Activa</span>
          </div>
        </div>
      </div>

      {/* Tabs de Sub-Módulo */}
      <div className="flex gap-4 border-b border-app-border pb-2 print:hidden">
        <button
          onClick={() => setActiveSubTab('fiscal')}
          className={`pb-2 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeSubTab === 'fiscal' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-app-muted hover:text-app-text'
          }`}
        >
          Resumen Fiscal (IGV/Renta)
        </button>
        <button
          onClick={() => setActiveSubTab('bancos')}
          className={`pb-2 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${
            activeSubTab === 'bancos' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-app-muted hover:text-app-text'
          }`}
        >
          Conciliación Bancaria
        </button>
      </div>

      {activeSubTab === 'fiscal' ? (
        <div className="grid grid-cols-1 gap-8 animate-in fade-in duration-300">
          
          {/* Ventas Table */}
          <div className="bg-app-surface rounded-3xl shadow-sm border border-app-border overflow-hidden">
            <div className="p-4 bg-app-bg border-b border-app-border flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                <TrendingUp size={16} /> Movimiento Ventas (Clase 7)
              </h2>
              <div className="flex gap-2">
                {isAddingCta.section === 'V' ? (
                  <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Número CTA..."
                      className="p-1 px-2 border border-blue-400 rounded-lg text-[10px] w-24 bg-app-bg text-app-text"
                      value={newCtaValue}
                      onChange={e => setNewCtaValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddAccountAction()}
                    />
                    <button onClick={handleAddAccountAction} className="p-1 px-2 bg-blue-600 text-white rounded-lg text-[10px] uppercase font-black">OK</button>
                    <button onClick={() => setIsAddingCta({ section: null })} className="p-1 px-2 bg-app-muted/50 text-app-text rounded-lg text-[10px] uppercase font-black">X</button>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingCta({ section: 'V' })} className="p-1 px-3 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-blue-700 transition-all print:hidden">
                    <Plus size={12} /> Añadir CTA
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="bg-app-bg text-app-muted uppercase text-[10px] font-black">
                    <th className="p-3 text-left pl-6 sticky left-0 bg-app-bg z-10 w-32 border-r border-app-border">Cuenta</th>
                    {MONTHS.map(m => <th key={m} className="p-3 min-w-[100px] text-center">{m}</th>)}
                    <th className="p-3 pr-6 bg-blue-500/10 text-blue-600">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {Object.keys(monthlyData[0].sales.acc).sort().map(cta => (
                    <tr key={cta} className="hover:bg-app-hover transition-colors group/row">
                      <td className="p-3 pl-6 text-left font-black text-app-text sticky left-0 bg-app-surface z-10 border-r border-app-border">
                        {renamingCta?.section === 'V' && renamingCta.oldCta === cta ? (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                            <input 
                              autoFocus
                              type="text"
                              className="p-1 px-2 border border-blue-400 rounded-lg text-[10px] w-20 font-bold bg-app-bg text-app-text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if(e.key === 'Enter') handleRenameAccountConfirm(); if(e.key === 'Escape') setRenamingCta(null); }}
                            />
                            <button onClick={handleRenameAccountConfirm} className="p-1 px-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black">OK</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                             <span>{cta}</span>
                             <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity print:hidden">
                               <button onClick={() => { setRenamingCta({ section: 'V', oldCta: cta }); setRenameValue(cta); }} className="text-app-muted hover:text-pld-blue"><Edit2 size={12} /></button>
                               <button onClick={() => handleDeleteAccount('V', cta)} className="text-app-muted hover:text-red-500"><Trash2 size={12} /></button>
                             </div>
                          </div>
                        )}
                      </td>
                      {monthlyData.map(m => (
                        <td key={m.name} className="p-3">
                          <EditableCell 
                            value={m.sales.acc[cta].val} 
                            onSave={v => handleSave(m.monthNum, 'V', cta, v)} 
                            isOverride={m.sales.acc[cta].ov} 
                            onReset={() => handleReset(m.monthNum, 'V', cta)} 
                          />
                        </td>
                      ))}
                      <td className="p-3 pr-6 font-black font-mono bg-app-bg text-app-text">
                        {format(monthlyData.reduce((acc, m) => acc + m.sales.acc[cta].val, 0))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-500/10 font-black">
                    <td className="p-3 pl-6 text-left text-blue-600 sticky left-0 bg-blue-500/10 z-10 border-r border-app-border">SUBTOTAL BI</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 text-blue-600">{format(m.sales.bi)}</td>)}
                    <td className="p-3 pr-6 font-black bg-blue-500/20 text-blue-600">{format(totals.s.bi)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 pl-6 text-left font-black text-app-text sticky left-0 bg-app-surface z-10 border-r border-app-border uppercase">Exonerado</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 ml-2"><EditableCell value={m.sales.exo} onSave={v => handleSave(m.monthNum, 'V', 'EXO', v)} isOverride={m.sales.ov.exo} onReset={() => handleReset(m.monthNum, 'V', 'EXO')} /></td>)}
                    <td className="p-3 pr-6 font-black text-app-muted">{format(totals.s.exo)}</td>
                  </tr>
                  <tr className="bg-amber-500/10">
                    <td className="p-3 pl-6 text-left font-black text-amber-500 sticky left-0 bg-amber-500/10 z-10 border-r border-amber-500/20">4011 (IGV)</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 font-bold text-amber-500"><EditableCell value={m.sales.igv} onSave={v => handleSave(m.monthNum, 'V', 'IGV', v)} isOverride={m.sales.ov.igv} onReset={() => handleReset(m.monthNum, 'V', 'IGV')} /></td>)}
                    <td className="p-3 pr-6 font-black bg-amber-500/20 text-amber-600">{format(totals.s.igv)}</td>
                  </tr>
                  <tr className="bg-app-bg border-t-2 border-app-border">
                    <td className="p-3 pl-6 text-left font-black text-app-text sticky left-0 bg-app-bg z-10 border-r border-app-border">1212 (TOTAL)</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 font-black"><EditableCell value={m.sales.total} onSave={v => handleSave(m.monthNum, 'V', 'TOT', v)} isOverride={m.sales.ov.tot} onReset={() => handleReset(m.monthNum, 'V', 'TOT')} /></td>)}
                    <td className="p-3 pr-6 font-black text-app-text">{format(totals.s.tot)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Compras Table */}
          <div className="bg-app-surface rounded-3xl shadow-sm border border-app-border overflow-hidden">
            <div className="p-4 bg-app-bg border-b border-app-border flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest text-violet-500 flex items-center gap-2">
                <ShoppingCart size={16} /> Movimiento Compras (Clase 6)
              </h2>
              <div className="flex gap-2">
                {isAddingCta.section === 'C' ? (
                  <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Número CTA..."
                      className="p-1 px-2 border border-violet-400 rounded-lg text-[10px] w-24 bg-app-bg text-app-text"
                      value={newCtaValue}
                      onChange={e => setNewCtaValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddAccountAction()}
                    />
                    <button onClick={handleAddAccountAction} className="p-1 px-2 bg-violet-600 text-white rounded-lg text-[10px] uppercase font-black">OK</button>
                    <button onClick={() => setIsAddingCta({ section: null })} className="p-1 px-2 bg-app-muted/50 text-app-text rounded-lg text-[10px] uppercase font-black">X</button>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingCta({ section: 'C' })} className="p-1 px-3 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-violet-700 transition-all print:hidden">
                    <Plus size={12} /> Añadir CTA
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse font-mono text-[12px]">
                <thead>
                  <tr className="bg-app-bg text-app-muted uppercase text-[10px] font-black">
                    <th className="p-3 text-left pl-6 sticky left-0 bg-app-bg z-10 w-32 border-r border-app-border">Cuenta</th>
                    {MONTHS.map(m => <th key={m} className="p-3 min-w-[100px] text-center">{m}</th>)}
                    <th className="p-3 pr-6 bg-violet-500/10 text-violet-500">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {Object.keys(monthlyData[0].purchases.acc).sort().map(cta => (
                    <tr key={cta} className="hover:bg-app-hover transition-colors group/row">
                      <td className="p-3 pl-6 text-left font-black text-app-text sticky left-0 bg-app-surface z-10 border-r border-app-border">
                        {renamingCta?.section === 'C' && renamingCta.oldCta === cta ? (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                            <input 
                              autoFocus
                              type="text"
                              className="p-1 px-2 border border-violet-400 rounded-lg text-[10px] w-20 font-bold bg-app-bg text-app-text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if(e.key === 'Enter') handleRenameAccountConfirm(); if(e.key === 'Escape') setRenamingCta(null); }}
                            />
                            <button onClick={handleRenameAccountConfirm} className="p-1 px-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-black">OK</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                             <span>{cta}</span>
                             <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity print:hidden">
                               <button onClick={() => { setRenamingCta({ section: 'C', oldCta: cta }); setRenameValue(cta); }} className="text-app-muted hover:text-violet-500"><Edit2 size={12} /></button>
                               <button onClick={() => handleDeleteAccount('C', cta)} className="text-app-muted hover:text-red-500"><Trash2 size={12} /></button>
                             </div>
                          </div>
                        )}
                      </td>
                      {monthlyData.map(m => (
                        <td key={m.name} className="p-3">
                          <EditableCell 
                            value={m.purchases.acc[cta].val} 
                            onSave={v => handleSave(m.monthNum, 'C', cta, v)} 
                            isOverride={m.purchases.acc[cta].ov} 
                            onReset={() => handleReset(m.monthNum, 'C', cta)} 
                          />
                        </td>
                      ))}
                      <td className="p-3 pr-6 font-black font-mono bg-app-bg text-app-text">
                        {format(monthlyData.reduce((acc, m) => acc + m.purchases.acc[cta].val, 0))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-violet-500/10 font-black">
                    <td className="p-3 pl-6 text-left text-violet-500 sticky left-0 bg-violet-500/10 z-10 border-r border-app-border">SUBTOTAL BI</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 text-violet-500">{format(m.purchases.bi)}</td>)}
                    <td className="p-3 pr-6 font-black bg-violet-500/20 text-violet-600">{format(totals.p.bi)}</td>
                  </tr>
                  <tr className="bg-amber-500/10">
                    <td className="p-3 pl-6 text-left font-black text-amber-500 sticky left-0 bg-amber-500/10 z-10 border-r border-amber-500/20">4011 (IGV)</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 font-bold text-amber-500"><EditableCell value={m.purchases.igv} onSave={v => handleSave(m.monthNum, 'C', 'IGV', v)} isOverride={m.purchases.ov.igv} onReset={() => handleReset(m.monthNum, 'C', 'IGV')} /></td>)}
                    <td className="p-3 pr-6 font-black bg-amber-500/20 text-amber-600">{format(totals.p.igv)}</td>
                  </tr>
                  <tr className="bg-app-bg border-t-2 border-app-border">
                    <td className="p-3 pl-6 text-left font-black text-app-text sticky left-0 bg-app-bg z-10 border-r border-app-border">4212 (TOTAL)</td>
                    {monthlyData.map(m => <td key={m.name} className="p-3 font-black"><EditableCell value={m.purchases.total} onSave={v => handleSave(m.monthNum, 'C', 'TOT', v)} isOverride={m.purchases.ov.tot} onReset={() => handleReset(m.monthNum, 'C', 'TOT')} /></td>)}
                    <td className="p-3 pr-6 font-black text-app-text">{format(totals.p.tot)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Detail Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Card: Monthly Breakdown and PDT Compare */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 italic">Análisis Mensual Detallado</h3>
                <select 
                  value={selectedMonthIndex} 
                  onChange={e => setSelectedMonthIndex(Number(e.target.value))}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-[10px] font-black uppercase text-blue-600"
                >
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm transition-all hover:shadow-md">
                  <p className="text-[10px] font-black text-blue-500 uppercase mb-4">SEGÚN SISTEMA</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-app-text"><span>IGV Ventas</span><span className="font-mono font-bold">{format(monthlyData[selectedMonthIndex].sales.igv)}</span></div>
                    <div className="flex justify-between text-xs text-app-text"><span>IGV Compras</span><span className="font-mono font-bold">{format(monthlyData[selectedMonthIndex].purchases.igv)}</span></div>
                    <div className="pt-2 border-t border-app-border flex justify-between text-xs font-black text-app-text"><span>POR PAGAR</span><span className="text-pld-blue">{format(monthlyData[selectedMonthIndex].sales.igv - monthlyData[selectedMonthIndex].purchases.igv)}</span></div>
                  </div>
                </div>

                <div className="bg-app-bg p-6 rounded-3xl border border-app-border shadow-sm transition-all hover:shadow-md group">
                  <p className="text-[10px] font-black text-amber-500 uppercase mb-4">SEGÚN PDT (MANUAL)</p>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-app-text"><span>IGV Decl. V</span><EditableCell value={monthlyData[selectedMonthIndex].pdt.v} onSave={v => handleSave(selectedMonthIndex+1, 'PDT', 'V', v)} isOverride={monthlyData[selectedMonthIndex].pdt.ovV} onReset={() => handleReset(selectedMonthIndex+1, 'PDT', 'V')} /></div>
                    <div className="flex justify-between text-xs text-app-text"><span>IGV Decl. C</span><EditableCell value={monthlyData[selectedMonthIndex].pdt.c} onSave={v => handleSave(selectedMonthIndex+1, 'PDT', 'C', v)} isOverride={monthlyData[selectedMonthIndex].pdt.ovC} onReset={() => handleReset(selectedMonthIndex+1, 'PDT', 'C')} /></div>
                    <div className="pt-2 border-t border-app-border flex justify-between text-xs font-black text-app-text"><span>DECLARADO</span><span className="text-amber-500">{format(monthlyData[selectedMonthIndex].pdt.v - monthlyData[selectedMonthIndex].pdt.c)}</span></div>
                  </div>
                </div>
              </div>

              {/* Error/Rectification Alert */}
              {(() => {
                const diffMonthNames = monthlyData
                  .filter(m => Math.abs((m.sales.igv - m.purchases.igv) - (m.pdt.v - m.pdt.c)) > 0.1)
                  .map(m => m.name);
                
                if (diffMonthNames.length === 0) return null;

                return (
                  <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 p-6 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-600/20"><AlertTriangle size={24} /></div>
                      <div>
                        <p className="text-sm font-black text-rose-600 uppercase tracking-widest">Inconsistencia Detectada (PDT vs Sistema)</p>
                        <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">Se han detectado discrepancias en {diffMonthNames.length} {diffMonthNames.length === 1 ? 'periodo' : 'periodos'}.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {monthlyData.map(m => {
                        const diff = (m.sales.igv - m.purchases.igv) - (m.pdt.v - m.pdt.c);
                        if (Math.abs(diff) <= 0.1) return null;
                        return (
                          <div key={m.name} className="p-2 bg-white/50 dark:bg-black/20 rounded-xl border border-rose-100 dark:border-rose-900/20 flex justify-between items-center px-4">
                            <span className="text-[10px] font-black text-slate-500">{m.name}</span>
                            <span className="text-xs font-mono font-black text-rose-600">S/ {format(Math.abs(diff))}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-rose-400 font-medium italic">* La diferencia puede deberse a facturas no registradas en el sistema o errores manuales en la declaración.</p>
                  </div>
                );
              })()}
            </div>

            {/* Renta and Impuestos Overview */}
            <div className="space-y-6">
               <div className="bg-indigo-600 text-white p-8 rounded-[2rem] shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-6">PAGOS A CUENTA - IMPUESTO A LA RENTA</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-4xl font-black italic tracking-tighter">S/ {format(totals.renta)}</p>
                        <p className="text-[10px] uppercase font-bold mt-2 opacity-60">Acumulado Periodo {currentCompany.period}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black uppercase mb-1">Cálculo Seleccionado ({MONTHS[selectedMonthIndex]})</p>
                         <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                            <EditableCell 
                               value={monthlyData[selectedMonthIndex].renta} 
                               onSave={v => handleSave(selectedMonthIndex+1, 'R', 'VAL', v)} 
                               isOverride={monthlyData[selectedMonthIndex].isRentaOv} 
                               onReset={() => handleReset(selectedMonthIndex+1, 'R', 'VAL')}
                               className="text-white text-lg"
                            />
                         </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
               </div>

               <div className="bg-app-surface p-8 rounded-[2rem] border border-app-border shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-app-text italic tracking-widest flex items-center gap-2"><Calculator size={16} /> Resumen Impuestos Totales</h4>
                    <p className="text-[10px] text-app-muted font-bold mt-1">IGV + Renta acumulados a pagar</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-rose-500">S/ {format(totals.s.igv - totals.p.igv + totals.renta)}</p>
                  </div>
               </div>
            </div>

          </div>

        </div>
      ) : (
        // --- VISTA DE CONCILIACIÓN BANCARIA (Sprint 4) ---
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Fila superior: Selectores e Indicador de Progreso */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Selector de Mes y Cuenta Contable */}
            <div className="bg-app-surface p-6 rounded-3xl border border-app-border flex flex-col justify-between gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-app-muted">Período de Conciliación</label>
                <div className="flex gap-2 mt-2">
                  <select 
                    value={selectedMonthIndex} 
                    onChange={e => { setSelectedMonthIndex(Number(e.target.value)); setSelectedStmtLineId(null); }}
                    className="w-full bg-app-bg border border-app-border p-2.5 rounded-xl text-xs font-bold text-app-text"
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m} {currentPeriod}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-app-muted">Cuenta Bancaria (Contable)</label>
                <select 
                  value={selectedBankCta} 
                  onChange={e => { setSelectedBankCta(e.target.value); setSelectedStmtLineId(null); }}
                  className="w-full bg-app-bg border border-app-border p-2.5 rounded-xl text-xs font-bold text-app-text mt-2 font-mono"
                >
                  <option value="10411">10411 - Banco de Crédito del Perú (BCP)</option>
                  <option value="10412">10412 - BBVA Continental</option>
                  <option value="10413">10413 - Interbank</option>
                  <option value="10414">10414 - Scotiabank</option>
                  <option value="10111">10111 - Caja Chica (Efectivo)</option>
                </select>
              </div>
            </div>

            {/* Barra de Progreso de Conciliación */}
            <div className="bg-app-surface p-6 rounded-3xl border border-app-border flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted">Estado del Período</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-black text-app-text">{bankStats.reconciledCount} de {bankStats.count}</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${bankStats.rate === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {bankStats.rate}% Conciliado
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-app-bg rounded-full h-3.5 overflow-hidden border border-app-border relative">
                  <div 
                    className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${bankStats.rate}%` }}
                  />
                </div>
              </div>
              <p className="text-[9px] text-app-muted mt-2 font-medium">
                * Asocie todos los movimientos para validar el cierre del período contable.
              </p>
            </div>

            {/* Saldos Comparados */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/60 p-6 rounded-3xl border border-indigo-500/20 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Diferencia por Conciliar</span>
                <h4 className="text-2xl font-black text-white mt-1">S/ {format(bankStats.total - bankStats.reconciled)}</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 mt-4 border-t border-white/10 pt-2 font-mono">
                <div>Saldo Banco: <span className="font-bold text-white">S/ {format(bankStats.total)}</span></div>
                <div>Conciliado: <span className="font-bold text-emerald-400">S/ {format(bankStats.reconciled)}</span></div>
              </div>
            </div>

          </div>

          {/* Seccion Drag and Drop & Boton AutoMatch */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Drag & Drop */}
            <div className="lg:col-span-8">
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-500/5' 
                    : 'border-app-border hover:border-slate-500 bg-app-surface'
                }`}
                onClick={() => document.getElementById('bank-file-input')?.click()}
              >
                <input 
                  type="file" 
                  id="bank-file-input" 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                />
                <UploadCloud size={32} className="text-blue-500 mb-2 animate-bounce" />
                <p className="text-xs font-black uppercase tracking-wide text-app-text">Arrastra tu extracto bancario aquí o haz click para subir</p>
                <p className="text-[9px] text-app-muted font-bold mt-1 uppercase">Soporta BCP, BBVA, Interbank y Genérico (Excel/CSV)</p>
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <button 
                onClick={handleAutoMatch}
                disabled={isAutoMatching || bankStats.count === 0}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAutoMatching ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Conciliación Automática
              </button>
              <div className="text-center">
                <span className="text-[9px] text-app-muted uppercase font-bold tracking-widest">
                  * Concilia por monto y margen de +/- 3 días.
                </span>
              </div>
            </div>

          </div>

          {/* Tablero Principal: Izquierda Extracto vs Derecha Diario */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* PANEL IZQUIERDO: EXTRACTO BANCARIO (5 Columns) */}
            <div className="xl:col-span-5 bg-app-surface rounded-3xl border border-app-border overflow-hidden flex flex-col h-[550px]">
              
              {/* Header Panel */}
              <div className="p-4 bg-app-bg border-b border-app-border flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">1. Extracto Bancario ({currentStatements.length})</h3>
                <div className="flex gap-1 bg-app-surface p-1 rounded-xl border border-app-border">
                  {(['todos', 'pendientes', 'conciliados'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setBankFilter(tab); setSelectedStmtLineId(null); }}
                      className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-all ${
                        bankFilter === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-app-muted hover:text-app-text'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body List */}
              <div className="overflow-y-auto flex-1 custom-scrollbar divide-y divide-app-border">
                {currentStatements.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center h-full gap-2">
                    <FileCheck size={36} className="text-app-muted" />
                    <p className="text-xs font-black uppercase text-app-muted">Sin movimientos bancarios</p>
                    <p className="text-[10px] text-app-muted">Por favor importe el extracto del mes en Excel/CSV.</p>
                  </div>
                ) : (
                  currentStatements.map(stmt => {
                    const isSelected = stmt.id === selectedStmtLineId;
                    const isReconciled = stmt.reconciled_journal_id !== null;
                    return (
                      <div 
                        key={stmt.id}
                        onClick={() => setSelectedStmtLineId(isSelected ? null : (stmt.id || null))}
                        className={`p-4 transition-all cursor-pointer flex justify-between items-start gap-4 ${
                          isSelected ? 'bg-blue-500/10 border-l-4 border-blue-600' : 'hover:bg-app-hover'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black font-mono text-slate-500 bg-app-bg px-2 py-0.5 rounded border border-app-border">{stmt.fecha}</span>
                            {stmt.referencia && (
                              <span className="text-[9px] font-mono text-app-muted font-bold bg-app-bg px-1.5 py-0.5 rounded border border-app-border">Ref: {stmt.referencia}</span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-app-text uppercase truncate max-w-[200px]" title={stmt.glosa}>{stmt.glosa}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {isReconciled ? (
                              <span className="text-[9px] font-black uppercase text-emerald-500 flex items-center gap-0.5"><Check size={10} /> Conciliado</span>
                            ) : (
                              <span className="text-[9px] font-black uppercase text-amber-500 flex items-center gap-0.5"><AlertCircle size={10} /> Pendiente</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <span className={`text-xs font-black font-mono ${stmt.monto >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {stmt.monto >= 0 ? '+' : ''}{format(stmt.monto)}
                          </span>
                          {isReconciled && (
                            <div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUnreconcile(stmt.id!); }}
                                className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                              >
                                Desvincular
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* PANEL DERECHO: LIBRO DIARIO / COINCIDENCIAS (7 Columns) */}
            <div className="xl:col-span-7 bg-app-surface rounded-3xl border border-app-border overflow-hidden flex flex-col h-[550px]">
              
              {/* Header Panel */}
              <div className="p-4 bg-app-bg border-b border-app-border">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {selectedStmtLineId 
                    ? `2. Conciliación de Movimiento: S/ ${format(selectedStmtLine?.monto || 0)} (${selectedStmtLine?.fecha})`
                    : '2. Movimientos Contables en Diario (Caja/Bancos)'
                  }
                </h3>
              </div>

              {/* Suggestions / Selection Workspace */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {selectedStmtLineId ? (
                  // Workspace de Selección Manual
                  <div className="space-y-4">
                    <div className="bg-app-bg p-4 rounded-2xl border border-app-border space-y-2">
                      <p className="text-[10px] font-black text-app-muted uppercase tracking-widest">Información del Banco Seleccionada</p>
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono text-app-text">
                        <div>Fecha: <span className="font-bold">{selectedStmtLine?.fecha}</span></div>
                        <div>Referencia: <span className="font-bold">{selectedStmtLine?.referencia || '-'}</span></div>
                        <div className="col-span-2">Glosa: <span className="font-bold uppercase">{selectedStmtLine?.glosa}</span></div>
                        <div>Importe: <span className={`font-black ${selectedStmtLine!.monto >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>S/ {format(selectedStmtLine!.monto)}</span></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Coincidencias Contables Recomendadas</h4>
                      
                      {suggestions.length === 0 ? (
                        <div className="bg-app-bg/50 p-6 rounded-2xl border border-app-border text-center text-xs font-bold text-app-muted">
                          No se encontraron asientos con el mismo importe en el período.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {suggestions.map(sug => {
                            const isExact = sug.score >= 80;
                            return (
                              <div 
                                key={sug.journalEntry.id}
                                className={`p-4 bg-app-bg border rounded-2xl flex justify-between items-center gap-4 transition-all hover:border-slate-500 ${
                                  isExact ? 'border-emerald-500/30' : 'border-app-border'
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black font-mono text-slate-500">{sug.journalEntry.fecha}</span>
                                    <span className="text-[9px] font-mono text-app-muted bg-app-surface px-1.5 py-0.5 rounded">Asiento: {sug.journalEntry.asiento}</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                                      sug.score >= 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                                    }`}>
                                      {sug.score}% Match
                                    </span>
                                  </div>
                                  <p className="text-xs font-bold text-app-text uppercase truncate max-w-[250px]">{sug.journalEntry.glosa || sug.journalEntry.desc}</p>
                                  <p className="text-[9px] text-app-muted font-bold font-mono">Cta: {sug.journalEntry.cta} ({sug.reason})</p>
                                </div>

                                <div className="text-right space-y-2">
                                  <span className="text-xs font-black font-mono text-app-text">
                                    S/ {format(sug.journalEntry.debe || sug.journalEntry.haber)}
                                  </span>
                                  <div>
                                    <button
                                      onClick={() => handleReconcile(sug.journalEntry.id)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                    >
                                      <Link2 size={12} /> Conciliar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Vista General de Asientos de Caja/Bancos
                  <div className="space-y-4">
                    <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl flex items-start gap-3">
                      <HelpCircle size={20} className="text-blue-500 mt-0.5" />
                      <div className="text-xs text-app-muted space-y-1">
                        <p className="font-bold text-app-text uppercase">¿Cómo conciliar manualmente?</p>
                        <p>1. Selecciona una transacción de la lista del **Extracto Bancario** de la izquierda.</p>
                        <p>2. El sistema filtrará y puntuará los asientos contables que coinciden por monto y fecha.</p>
                        <p>3. Haz click en el botón **Conciliar** para enlazarlos.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Asientos Contables del Período ({currentJournalEntries.length} totales, {unreconciledJournalEntries.length} pendientes)
                      </p>
                      
                      {unreconciledJournalEntries.length === 0 ? (
                        <div className="p-8 text-center text-xs font-bold text-app-muted">
                          Todos los asientos del diario están conciliados en este período.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {unreconciledJournalEntries.map(entry => (
                            <div key={entry.id} className="p-3 bg-app-bg/50 border border-app-border rounded-xl flex justify-between items-center text-xs font-mono">
                              <div>
                                <span className="text-slate-500 font-bold mr-2">{entry.fecha}</span>
                                <span className="font-bold text-app-text uppercase">{entry.glosa || entry.desc}</span>
                                <div className="text-[9px] text-app-muted mt-0.5">Asiento: {entry.asiento} • Cuenta: {entry.cta}</div>
                              </div>
                              <span className="font-black text-app-text">
                                S/ {format(entry.debe || entry.haber)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>

          </div>

          {/* VALIDADOR CRUZADO (Cross-Book Validator Report) */}
          <div className="bg-app-surface rounded-3xl border border-app-border p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Validador Cruzado de Comprobantes vs Caja (Libros Auxiliares vs Diario)
                </h3>
                <p className="text-[10px] text-app-muted font-bold mt-1">
                  Valida si las compras y ventas del mes tienen sus correspondientes asientos de cobro/pago registrados.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCrossBookTab('compras')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    crossBookTab === 'compras' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20' : 'bg-app-bg text-app-muted hover:text-app-text'
                  }`}
                >
                  Compras vs Pagos ({crossBookReport.purchasesPaidPct}% pagado)
                </button>
                <button
                  onClick={() => setCrossBookTab('ventas')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                    crossBookTab === 'ventas' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-app-bg text-app-muted hover:text-app-text'
                  }`}
                >
                  Ventas vs Cobros ({crossBookReport.salesCollectedPct}% cobrado)
                </button>
              </div>
            </div>

            {crossBookTab === 'compras' ? (
              // Compras vs Pagos
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-right border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-app-bg text-app-muted uppercase text-[9px] font-black border-b border-app-border">
                      <th className="p-3 text-left">F. Emisión</th>
                      <th className="p-3 text-left">Documento</th>
                      <th className="p-3 text-left">RUC / Razón Social</th>
                      <th className="p-3">Importe Total</th>
                      <th className="p-3 text-emerald-500">Monto Pagado</th>
                      <th className="p-3 text-rose-500">Saldo Pendiente</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Asientos Relac.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {crossBookReport.purchases.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center font-sans font-bold text-app-muted text-xs">
                          No se registraron compras en este período.
                        </td>
                      </tr>
                    ) : (
                      crossBookReport.purchases.map(item => (
                        <tr key={item.id} className="hover:bg-app-hover transition-colors">
                          <td className="p-3 text-left font-bold text-slate-500">{item.fecha}</td>
                          <td className="p-3 text-left font-black text-app-text">{item.documento}</td>
                          <td className="p-3 text-left text-app-muted uppercase truncate max-w-[200px]" title={item.nombre}>{item.ruc} • {item.nombre}</td>
                          <td className="p-3 font-bold text-app-text">S/ {format(item.total)}</td>
                          <td className="p-3 font-bold text-emerald-500">S/ {format(item.totalPagado)}</td>
                          <td className="p-3 font-bold text-rose-500">S/ {format(item.saldo)}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                              item.estado === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500' :
                              item.estado === 'PARCIAL' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                            }`}>
                              {item.estado}
                            </span>
                          </td>
                          <td className="p-3 text-center font-sans text-[10px] text-app-muted">
                            {item.asientosAsociados.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {item.asientosAsociados.map(a => (
                                  <span key={a} className="bg-app-bg px-1.5 py-0.5 rounded border border-app-border font-mono">{a}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="italic text-app-muted/50">Ninguno</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Ventas vs Cobros
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-right border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-app-bg text-app-muted uppercase text-[9px] font-black border-b border-app-border">
                      <th className="p-3 text-left">F. Emisión</th>
                      <th className="p-3 text-left">Documento</th>
                      <th className="p-3 text-left">RUC / Razón Social</th>
                      <th className="p-3">Importe Total</th>
                      <th className="p-3 text-emerald-500">Monto Cobrado</th>
                      <th className="p-3 text-rose-500">Saldo Pendiente</th>
                      <th className="p-3 text-center">Estado</th>
                      <th className="p-3 text-center">Asientos Relac.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {crossBookReport.sales.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center font-sans font-bold text-app-muted text-xs">
                          No se registraron ventas en este período.
                        </td>
                      </tr>
                    ) : (
                      crossBookReport.sales.map(item => (
                        <tr key={item.id} className="hover:bg-app-hover transition-colors">
                          <td className="p-3 text-left font-bold text-slate-500">{item.fecha}</td>
                          <td className="p-3 text-left font-black text-app-text">{item.documento}</td>
                          <td className="p-3 text-left text-app-muted uppercase truncate max-w-[200px]" title={item.nombre}>{item.ruc} • {item.nombre}</td>
                          <td className="p-3 font-bold text-app-text">S/ {format(item.total)}</td>
                          <td className="p-3 font-bold text-emerald-500">S/ {format(item.totalPagado)}</td>
                          <td className="p-3 font-bold text-rose-500">S/ {format(item.saldo)}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                              item.estado === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500' :
                              item.estado === 'PARCIAL' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                            }`}>
                              {item.estado === 'PAGADO' ? 'COBRADO' : item.estado}
                            </span>
                          </td>
                          <td className="p-3 text-center font-sans text-[10px] text-app-muted">
                            {item.asientosAsociados.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {item.asientosAsociados.map(a => (
                                  <span key={a} className="bg-app-bg px-1.5 py-0.5 rounded border border-app-border font-mono">{a}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="italic text-app-muted/50">Ninguno</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      <div className="mt-8 pt-8 border-t border-app-border text-center opacity-40">
        <p className="text-[9px] font-black uppercase tracking-[0.6em] text-app-muted">SoftContable Intelligence Division • Movimientos Dashboard</p>
      </div>

    </div>
  );
};

export default MovimientosView;
