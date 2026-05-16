import React, { useMemo, useState } from 'react';
import { useStore, type BalanceInicialItem, type SectionType } from '../store';
import { 
  Calculator, 
  Printer, 
  FileDown, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  AlertCircle,
  TrendingUp,
  Landmark,
  PiggyBank
} from 'lucide-react';
import toast from 'react-hot-toast';

// type SectionType = ... (eliminado para usar el del store)

const DEFAULT_STRUCTURE: { cta: string; desc: string; section: SectionType }[] = [
  { cta: '101', desc: 'Caja y Bancos', section: 'ACTIVO_CORRIENTE' },
  { cta: '111', desc: 'Valores Negociables', section: 'ACTIVO_CORRIENTE' },
  { cta: '121', desc: 'Cuentas por Cobrar Comerciales', section: 'ACTIVO_CORRIENTE' },
  { cta: '131', desc: 'Cuentas por Cobrar a Vinculadas', section: 'ACTIVO_CORRIENTE' },
  { cta: '141', desc: 'Otras Cuentas por Cobrar', section: 'ACTIVO_CORRIENTE' },
  { cta: '201', desc: 'Existencias', section: 'ACTIVO_CORRIENTE' },
  { cta: '181', desc: 'Gastos Pagados por Anticipado', section: 'ACTIVO_CORRIENTE' },
  
  { cta: '331', desc: 'Inmuebles, Maquinaria y Equipo', section: 'ACTIVO_NO_CORRIENTE' },
  { cta: '341', desc: 'Activos Intangibles', section: 'ACTIVO_NO_CORRIENTE' },
  
  { cta: '451', desc: 'Sobregiros y Pagarés Bancarios', section: 'PASIVO_CORRIENTE' },
  { cta: '421', desc: 'Cuentas por Pagar Comerciales', section: 'PASIVO_CORRIENTE' },
  { cta: '431', desc: 'Cuentas por Pagar a Vinculadas', section: 'PASIVO_CORRIENTE' },
  { cta: '461', desc: 'Otras Cuentas por Pagar', section: 'PASIVO_CORRIENTE' },
  
  { cta: '501', desc: 'Capital', section: 'PATRIMONIO' },
  { cta: '591', desc: 'Resultados Acumulados', section: 'PATRIMONIO' },
];

export default function BalanceInicialView() {
  const { balanceInicial, currentCompany, saveBalanceInicialItem, saveBalanceInicialBulk, deleteBalanceInicialItem, setActiveTab, setDraftAsiento } = useStore();
  const [isInitializing, setIsInitializing] = useState(false);

  // --- Lógica de Datos y Cálculos ---
  const items = useMemo(() => {
    // Ordenar por sección y luego por cuenta
    return [...balanceInicial].sort((a, b) => {
      if (a.section !== b.section) return 0; // Mantener orden de secciones del render
      return a.cta.localeCompare(b.cta);
    });
  }, [balanceInicial]);

  const totals = useMemo(() => {
    const activo = items.filter(i => i.section.startsWith('ACTIVO')).reduce((acc, i) => acc + (i.debe || 0), 0);
    const pasivoPat = items.filter(i => !i.section.startsWith('ACTIVO')).reduce((acc, i) => acc + (i.haber || 0), 0);
    return { activo, pasivoPat, diff: Math.abs(activo - pasivoPat) };
  }, [items]);

  // --- Acciones ---
  const handleUpdate = async (id: string, updates: Partial<BalanceInicialItem>) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updated = { ...item, ...updates } as BalanceInicialItem;
    await saveBalanceInicialItem(updated);
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const payload = DEFAULT_STRUCTURE.map((d, i) => ({
        id: `fixed-${Date.now()}-${i}`,
        cta: d.cta,
        desc: d.desc,
        section: d.section,
        debe: 0,
        haber: 0
      }));
      await saveBalanceInicialBulk(payload);
      toast.success('Formato inicializado');
    } catch (e) {
      toast.error('Error al inicializar');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAddRow = async (section: SectionType) => {
    const newItem: BalanceInicialItem = {
      id: `custom-${Date.now()}`,
      cta: '',
      desc: 'NUEVA CUENTA',
      section,
      debe: 0,
      haber: 0
    };
    await saveBalanceInicialItem(newItem);
  };

  // --- Renderizado de Secciones ---
  const renderSection = (title: string, section: SectionType) => (
    <div className="mb-6">
      <div className="flex justify-between items-center bg-app-surface/50 border-b border-app-border px-3 py-1.5 mb-1">
        <span className="text-[10px] font-black text-app-muted uppercase tracking-widest">{title}</span>
        <button 
          onClick={() => handleAddRow(section)}
          className="p-1 hover:text-blue-600 text-app-muted transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      
      {items.filter(i => i.section === section).map(item => (
        <div key={item.id} className="group flex h-9 border-b border-app-border hover:bg-app-hover transition-colors">
          <div className="flex-1 flex items-center border-r border-app-border">
            <input 
              type="text"
              value={item.desc}
              onChange={(e) => handleUpdate(item.id, { desc: e.target.value.toUpperCase() })}
              className="w-full bg-transparent border-none px-3 text-[11px] font-medium text-app-text outline-none uppercase"
              placeholder="Descripción..."
            />
          </div>
          <div className="w-20 flex items-center justify-center border-r border-app-border">
            <input 
              type="text"
              value={item.cta}
              onChange={(e) => handleUpdate(item.id, { cta: e.target.value })}
              className="w-full bg-transparent border-none text-center text-[10px] font-black text-blue-600 outline-none"
              placeholder="000"
            />
          </div>
          <div className="w-32 flex items-center relative">
            <input 
              type="number"
              value={item.debe || item.haber || ''}
              onChange={(e) => handleUpdate(item.id, { 
                debe: section.startsWith('ACTIVO') ? parseFloat(e.target.value) || 0 : 0,
                haber: !section.startsWith('ACTIVO') ? parseFloat(e.target.value) || 0 : 0
              })}
              className="w-full bg-transparent border-none text-right px-3 text-[11px] font-mono font-bold text-app-text outline-none"
              placeholder="0.00"
            />
            <button 
              onClick={() => deleteBalanceInicialItem(item.id)}
              className="absolute -left-6 opacity-0 group-hover:opacity-100 text-rose-500 p-1 transition-opacity"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-app-bg animate-fade-in">
      {/* Header Premium */}
      <header className="h-16 px-6 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Calculator size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tighter text-app-text">Balance Inicial</h1>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${totals.diff < 0.01 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {totals.diff < 0.01 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {totals.diff < 0.01 ? 'Balance Cuadrado' : `Descuadre: S/ ${totals.diff.toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleInitialize} className="h-10 px-4 text-app-muted hover:text-app-text text-[10px] font-black uppercase flex items-center gap-2 transition-colors">
            {isInitializing ? '...' : 'Reiniciar Formato'}
          </button>
          <button onClick={() => window.print()} className="h-10 px-4 bg-app-surface text-app-text border border-app-border rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-app-hover transition-colors shadow-sm">
            <Printer size={16} /> Imprimir
          </button>
          <button 
            onClick={() => {
              const journalLines = items
                .filter(i => (i.debe || 0) > 0 || (i.haber || 0) > 0)
                .map((i, index) => {
                  let d = i.debe || 0;
                  let h = i.haber || 0;
                  
                  // Lógica automática para cuentas de valuación (19, 29, 39)
                  // En un balance de apertura, si están en el Activo (Debe), 
                  // deben pasar al Haber para restar.
                  if (i.cta.startsWith('19') || i.cta.startsWith('29') || i.cta.startsWith('39')) {
                    if (d > 0) { h = d; d = 0; }
                  }

                  return {
                    id: index + 1,
                    cuenta: i.cta,
                    detalle: i.desc,
                    debe: d,
                    haber: h
                  };
                });

              if (journalLines.length === 0) {
                toast.error('No hay montos para generar el asiento');
                return;
              }
              
              if (totals.diff > 0.01) {
                toast.error('El balance debe estar cuadrado');
                return;
              }

              setDraftAsiento({
                header: {
                  asiento: '000000',
                  fecEmi: `${currentCompany?.period}-01-01`,
                  glosa: `ASIENTO DE APERTURA - ${currentCompany?.period}`,
                  anio: String(currentCompany?.period),
                  mes: '00'
                },
                lines: journalLines,
                editingId: null
              } as any);
              setActiveTab('ASIENTOS');
              toast.success('Asiento cargado en borradores');
            }}
            className="h-10 px-6 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase shadow-lg shadow-blue-600/20 flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
          >
            <CheckCircle2 size={18} /> Generar Asiento
          </button>
        </div>
      </header>

      {/* Papel Contable */}
      <div className="flex-1 overflow-auto custom-scrollbar p-6 lg:p-10 bg-app-bg">
        <div className="max-w-6xl mx-auto bg-app-surface border border-app-border shadow-2xl rounded-xl p-12 min-h-[1000px] transition-all duration-500">
          
          <div className="mb-10 text-center border-b border-app-border pb-6">
            <h2 className="text-lg font-black uppercase tracking-tighter text-app-text mb-2">Libro de Inventarios y Balances</h2>
            <p className="text-xs font-bold text-app-muted uppercase tracking-widest">Formato 3.1 - Estado de Situación Financiera</p>
          </div>

          <div className="grid grid-cols-2 gap-12">
            {/* Columna Activo */}
            <div>
              <div className="flex bg-app-text text-app-surface p-3 rounded-t-lg font-black text-[11px] uppercase items-center gap-2">
                <TrendingUp size={14} /> ACTIVO
              </div>
              {renderSection('Activo Corriente', 'ACTIVO_CORRIENTE')}
              {renderSection('Activo No Corriente', 'ACTIVO_NO_CORRIENTE')}
              
              <div className="flex justify-between items-center p-4 bg-blue-600/5 border-2 border-blue-600/20 rounded-xl mt-4">
                <span className="text-xs font-black uppercase text-app-text">Total Activo</span>
                <span className="text-sm font-mono font-black text-blue-600">S/ {totals.activo.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Columna Pasivo/Patrimonio */}
            <div>
              <div className="flex bg-app-text text-app-surface p-3 rounded-t-lg font-black text-[11px] uppercase items-center gap-2">
                <PiggyBank size={14} /> PASIVO Y PATRIMONIO
              </div>
              {renderSection('Pasivo Corriente', 'PASIVO_CORRIENTE')}
              {renderSection('Pasivo No Corriente', 'PASIVO_NO_CORRIENTE')}
              {renderSection('Patrimonio Neto', 'PATRIMONIO')}

              <div className="flex justify-between items-center p-4 bg-emerald-600/5 border-2 border-emerald-600/20 rounded-xl mt-4">
                <span className="text-xs font-black uppercase text-app-text">Total Pasivo y Pat.</span>
                <span className="text-sm font-mono font-black text-emerald-600">S/ {totals.pasivoPat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Información de la Empresa al Final */}
          <div className="mt-20 pt-8 border-t border-app-border grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] font-black text-app-muted uppercase mb-1">Ejercicio</p>
              <p className="text-xs font-bold text-app-text">{currentCompany?.period || '2026'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-app-muted uppercase mb-1">RUC</p>
              <p className="text-xs font-bold text-app-text">{currentCompany?.ruc || '---'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-app-muted uppercase mb-1">Empresa</p>
              <p className="text-xs font-bold text-app-text uppercase">{currentCompany?.name || '---'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
