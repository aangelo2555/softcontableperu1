import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Package, TrendingUp, Activity, FileText, Download, PlusCircle, Trash2, Edit, FileDown, Printer } from 'lucide-react';
import { exportSingleSheet } from '../utils/excelExport';
import { useStore, type InventoryMovement } from '../store';
import PageHeader from './ui/PageHeader';
import { DataTable } from './DataTable';
import Modal from './shared/Modal';
import FormField from './ui/FormField';
import DecimalInput from './shared/DecimalInput';
import DateInput from './shared/DateInput';

const KardexView: React.FC = () => {
  const { 
    products, inventoryMovements, currentCompany, recordInventoryMovement, 
    deleteInventoryMovement, setActiveTab, setDraftCompra, setDraftVenta,
    purchases, sales, exportarPle121TXT
  } = useStore();
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form para Saldo Inicial
  const [initialForm, setInitialForm] = useState({
    id: '', // Empty for new, has ID for edit
    fecha: new Date().toISOString().split('T')[0].split('-').reverse().join('/'),
    cantidad: 0,
    costoTotal: 0
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const movements = useMemo(() => {
    return inventoryMovements
      .filter(m => m.product_id === selectedProductId)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  }, [inventoryMovements, selectedProductId]);

  const lastMovement = movements[movements.length - 1];

  const formatCurrency = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totals = useMemo(() => {
    return movements.reduce((acc, curr) => ({
      entCant: acc.entCant + curr.cantidad_in,
      entTotal: acc.entTotal + curr.total_in,
      salCant: acc.salCant + curr.cantidad_out,
      salTotal: acc.salTotal + curr.total_out,
    }), { entCant: 0, entTotal: 0, salCant: 0, salTotal: 0 });
  }, [movements]);

  const handleSaveInitial = () => {
    if (!selectedProductId) return;
    recordInventoryMovement({
      id: (initialForm.id as any) || undefined, // Support update
      product_id: selectedProductId,
      fecha: initialForm.fecha,
      tipo_operacion: '16', // SALDO INICIAL
      tipo_doc: '00',
      serie: '0000',
      numero: '000000',
      cantidad_in: initialForm.cantidad,
      costo_unit_in: initialForm.costoTotal / initialForm.cantidad,
      total_in: initialForm.costoTotal,
      cantidad_out: 0,
      costo_unit_out: 0,
      total_out: 0,
      reference_id: initialForm.id || `init-${Date.now()}`
    });
    setIsModalOpen(false);
    setInitialForm({ id: '', fecha: new Date().toISOString().split('T')[0].split('-').reverse().join('/'), cantidad: 0, costoTotal: 0 });
  };

  const handleDeleteMovement = (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este movimiento? Esto recalculará todo el kárdex.')) {
      deleteInventoryMovement(id);
    }
  };

  const handleEditMovement = (m: InventoryMovement) => {
    if (m.tipo_operacion === '16') {
      // Saldo Inicial
      setInitialForm({
        id: m.reference_id || '',
        fecha: m.fecha,
        cantidad: m.cantidad_in,
        costoTotal: m.total_in
      });
      setIsModalOpen(true);
      return;
    }

    if (m.reference_id) {
      // Find source record
      const p = purchases.find(x => x.id === m.reference_id);
      const s = sales.find(x => x.id === m.reference_id);

      if (p) {
        setDraftCompra(p as any);
        setActiveTab('COMPRAS');
      } else if (s) {
        setDraftVenta(s as any);
        setActiveTab('VENTAS');
      }
    }
  };

  const columns = [
    { header: 'FECHA', accessor: (row: InventoryMovement) => <span className="font-mono text-[10px]">{row.fecha}</span>, className: 'w-24' },
    { header: 'TIPO (T10)', accessor: (row: InventoryMovement) => <span className="text-[10px] text-center block font-bold">{row.tipo_doc}</span>, className: 'w-16' },
    { header: 'SERIE', accessor: (row: InventoryMovement) => <span className="text-[10px] text-center block font-mono">{row.serie}</span>, className: 'w-16' },
    { header: 'NÚMERO', accessor: (row: InventoryMovement) => <span className="text-[10px] font-mono">{row.numero}</span>, className: 'w-24' },
    { header: 'OP. (T12)', accessor: (row: InventoryMovement) => <span className="text-[9px] uppercase font-bold text-app-muted text-center block">{row.tipo_operacion}</span>, className: 'w-20 border-r border-app-border/30' },
    
    { header: 'CANTIDAD', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-emerald-500 font-bold">{row.cantidad_in > 0 ? row.cantidad_in : '—'}</span> },
    { header: 'COSTO UNIT.', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-emerald-500/70">{row.cantidad_in > 0 ? formatCurrency(row.costo_unit_in) : '—'}</span> },
    { header: 'COSTO TOTAL', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-emerald-500/70 border-r border-app-border/30">{row.cantidad_in > 0 ? formatCurrency(row.total_in) : '—'}</span> },
    
    { header: 'CANTIDAD', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-red-400 font-bold">{row.cantidad_out > 0 ? row.cantidad_out : '—'}</span> },
    { header: 'COSTO UNIT.', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-red-400/70">{row.cantidad_out > 0 ? formatCurrency(row.costo_unit_out) : '—'}</span> },
    { header: 'COSTO TOTAL', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-red-400/70 border-r border-app-border/30">{row.cantidad_out > 0 ? formatCurrency(row.total_out) : '—'}</span> },
    
    { header: 'CANTIDAD', accessor: (row: InventoryMovement) => <span className="text-right block font-mono font-bold text-pld-blue">{row.cantidad_saldo}</span> },
    { header: 'COSTO UNIT.', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-pld-blue/70">{formatCurrency(row.costo_unit_saldo)}</span> },
    { header: 'COSTO TOTAL', accessor: (row: InventoryMovement) => <span className="text-right block font-mono text-pld-blue/70 font-bold">{formatCurrency(row.total_saldo)}</span> },
    { 
      header: 'ACC.', 
      accessor: (row: InventoryMovement) => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleEditMovement(row)} className="text-app-muted hover:text-pld-blue transition-colors">
            <Edit size={12} />
          </button>
          <button onClick={() => handleDeleteMovement(row.id)} className="text-app-muted hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      ),
      className: 'w-16 border-l border-app-border/30 print:hidden'
    }
  ];

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-hidden relative print:bg-white print:p-0">
      <div className="print:hidden">
      <PageHeader 
        icon={<BookOpen size={18} />} 
        title="Inventario Permanente Valorizado" 
        subtitle={`Formato 13.1 • Periodo: ${currentCompany?.period || ''} • RUC: ${currentCompany?.ruc || ''}`}
        actions={
          <div className="flex gap-2">
            <button 
              onClick={() => setIsModalOpen(true)}
              disabled={!selectedProductId}
              className={`h-8 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm ${!selectedProductId ? 'bg-app-muted/20 text-app-muted cursor-not-allowed border border-app-border/50' : 'bg-pld-blue hover:bg-pld-blue/80 text-white'}`}
            >
              <PlusCircle size={14} /> Saldo Inicial
            </button>
            <button 
              onClick={() => {
                const per = currentCompany.period ? `${currentCompany.period.replace('-', '')}00` : '20260100';
                exportarPle121TXT(per);
              }}
              className="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Download size={14} /> PLE 12.1
            </button>
            <button 
              onClick={() => window.print()} 
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Printer size={14} /> Imprimir (PDF)
            </button>
            <button onClick={() => {
              if (!selectedProduct || movements.length === 0) return;
              exportSingleSheet({
                sheetName: 'Kardex',
                title: `KÁRDEX VALORIZADO - ${selectedProduct.name}`,
                columns: [
                  { header: 'FECHA', key: 'fecha', width: 12 },
                  { header: 'TIPO', key: 'tipo_doc', width: 8, alignment: 'center' },
                  { header: 'SERIE', key: 'serie', width: 10 },
                  { header: 'NÚMERO', key: 'numero', width: 12 },
                  { header: 'ENT. CANT', key: 'cantidad_in', width: 12, style: 'number' },
                  { header: 'ENT. TOTAL', key: 'total_in', width: 14, style: 'currency' },
                  { header: 'SAL. CANT', key: 'cantidad_out', width: 12, style: 'number' },
                  { header: 'SAL. TOTAL', key: 'total_out', width: 14, style: 'currency' },
                  { header: 'SALDO CANT', key: 'cantidad_saldo', width: 12, style: 'number' },
                  { header: 'SALDO TOTAL', key: 'total_saldo', width: 14, style: 'currency' }
                ],
                rows: movements,
                companyInfo: {
                  ruc: currentCompany?.ruc || '',
                  name: currentCompany?.name || 'EMPRESA',
                  period: currentCompany?.period || String(new Date().getFullYear()),
                }
              }, `Kardex_${selectedProduct.code}`);
            }} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
          </div>
        }
      />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 print:p-0 print:overflow-visible">
        <div className="max-w-[1450px] mx-auto space-y-6">
          
          <div className="grid grid-cols-12 gap-6 print:flex print:flex-col print:gap-4">
            <div className="col-span-12 md:col-span-4 section-card h-fit print:hidden">
              <div className="section-card-header">
                <Search size={15} />
                <span>Búsqueda de Existencia</span>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                  <input 
                    className="w-full pl-9 pr-3 py-2 text-sm bg-app-bg border border-app-border rounded-lg focus:border-pld-blue outline-none"
                    placeholder="Código o nombre del producto..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar border border-app-border rounded-lg bg-app-bg/50">
                  {filteredProducts.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`w-full text-left px-3 py-2 text-xs border-b border-app-border/50 hover:bg-app-hover transition-colors flex justify-between items-center ${selectedProductId === p.id ? 'bg-pld-blue/10 border-l-4 border-l-pld-blue' : ''}`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-app-text">{p.code}</span>
                        <span className="ml-2 text-app-muted uppercase truncate">{p.name}</span>
                      </div>
                      <span className="text-[10px] text-pld-blue font-mono shrink-0">{p.unit_measure}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-8 section-card print:col-span-12 print:border-none print:shadow-none print:p-0">
               <div className="section-card-header">
                 <FileText size={15} />
                 <span>Información del Registro (SUNAT)</span>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-[11px]">
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Período:</p>
                    <p className="font-mono font-bold text-pld-blue">{currentCompany.period || '2026'}</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">RUC:</p>
                    <p className="font-mono font-bold text-pld-blue">{currentCompany.ruc || '—'}</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Razón Social:</p>
                    <p className="font-bold text-app-text uppercase truncate">{currentCompany.name || '—'}</p>
                  </div>
                  
                  <div className="col-span-3 h-px bg-app-border my-1" />

                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Código Existencia:</p>
                    <p className="font-mono font-bold text-pld-magenta">{selectedProduct?.code || '—'}</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Tipo (Tabla 5):</p>
                    <p className="font-bold text-app-text">{selectedProduct?.type_existence || '01'} - {selectedProduct?.type_existence === '01' ? 'MERCADERÍA' : 'OTRO'}</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Descripción:</p>
                    <p className="font-bold text-app-text uppercase truncate">{selectedProduct?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">U. Medida (Tabla 6):</p>
                    <p className="font-bold text-app-text">{selectedProduct?.unit_measure || 'NIU'}</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Método Valuación:</p>
                    <p className="font-bold text-pld-blue">PROMEDIO PONDERADO</p>
                  </div>
                  <div>
                    <p className="text-app-muted font-bold uppercase tracking-widest mb-1">Establecimiento:</p>
                    <p className="font-bold text-app-text">0000 - PRINCIPAL</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="section-card !p-0 overflow-hidden shadow-2xl">
            <div className="grid grid-cols-[380px_1fr_1fr_1fr] text-[10px] font-black uppercase text-center bg-app-surface border-b border-app-border">
               <div className="py-2 border-r border-app-border">Documento de Traslado / Comp. Pago</div>
               <div className="py-2 border-r border-app-border bg-emerald-600/10 text-emerald-600">Entradas</div>
               <div className="py-2 border-r border-app-border bg-red-500/10 text-red-500">Salidas</div>
               <div className="py-2 bg-pld-blue/10 text-pld-blue">Saldo Final</div>
            </div>
            
            <DataTable 
              columns={columns} 
              data={movements} 
              emptyMessage={selectedProductId ? "No hay movimientos registrados para este producto." : "Seleccione un producto para generar el reporte."} 
            />

            {movements.length > 0 && (
              <div className="grid grid-cols-[380px_1fr_1fr_1fr] text-xs font-mono font-black bg-app-surface/80 border-t border-app-border divide-x divide-app-border">
                <div className="p-3 text-right text-app-muted uppercase italic">Totales del Período:</div>
                <div className="grid grid-cols-3 p-3 text-emerald-500">
                  <span className="text-right">{totals.entCant}</span>
                  <span />
                  <span className="text-right">{formatCurrency(totals.entTotal)}</span>
                </div>
                <div className="grid grid-cols-3 p-3 text-red-400">
                  <span className="text-right">{totals.salCant}</span>
                  <span />
                  <span className="text-right">{formatCurrency(totals.salTotal)}</span>
                </div>
                <div className="grid grid-cols-3 p-3 text-pld-blue bg-pld-blue/5">
                  <span className="text-right">{lastMovement.cantidad_saldo}</span>
                  <span />
                  <span className="text-right">{formatCurrency(lastMovement.total_saldo)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6 print:hidden">
            <div className="card-elevated group hover:border-emerald-500/50 transition-all">
              <Package className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" size={20} />
              <p className="text-[10px] font-black uppercase text-app-muted">Stock Disponible</p>
              <h3 className="text-3xl font-black font-mono">{lastMovement?.cantidad_saldo || 0}</h3>
            </div>
            <div className="card-elevated group hover:border-pld-blue/50 transition-all">
              <Activity className="text-pld-blue mb-2 group-hover:scale-110 transition-transform" size={20} />
              <p className="text-[10px] font-black uppercase text-app-muted">Costo Unitario Promedio</p>
              <h3 className="text-3xl font-black font-mono">S/ {lastMovement ? formatCurrency(lastMovement.costo_unit_saldo) : '0.00'}</h3>
            </div>
            <div className="card-elevated group hover:border-pld-magenta/50 transition-all">
              <TrendingUp className="text-pld-magenta mb-2 group-hover:scale-110 transition-transform" size={20} />
              <p className="text-[10px] font-black uppercase text-app-muted">Inversión en Inventario</p>
              <h3 className="text-3xl font-black font-mono text-gradient">S/ {lastMovement ? formatCurrency(lastMovement.total_saldo) : '0.00'}</h3>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL SALDO INICIAL */}
      <Modal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Registrar Saldo Inicial (Apertura)"
      >
        <div className="p-4 space-y-4">
          <div className="bg-pld-blue/5 p-3 rounded-lg border border-pld-blue/10">
            <p className="text-[10px] font-bold text-pld-blue uppercase tracking-widest">Producto seleccionado:</p>
            <p className="text-sm font-black uppercase">{selectedProduct?.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <FormField label="Fecha de Apertura">
                <DateInput value={initialForm.fecha} onChange={v => setInitialForm({...initialForm, fecha: v})} />
             </FormField>
             <FormField label="Cantidad en Stock">
                <DecimalInput value={initialForm.cantidad} onChange={v => setInitialForm({...initialForm, cantidad: v})} className="text-right font-mono font-bold" />
             </FormField>
          </div>
          
          <FormField label="Costo Total de la Existencia">
             <DecimalInput value={initialForm.costoTotal} onChange={v => setInitialForm({...initialForm, costoTotal: v})} className="text-xl font-mono font-black text-right text-pld-blue" />
          </FormField>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase text-app-muted hover:text-app-text transition-colors">Cancelar</button>
            <button 
              onClick={handleSaveInitial}
              disabled={initialForm.cantidad <= 0 || initialForm.costoTotal <= 0}
              className="px-6 py-2 bg-pld-blue text-white rounded-lg text-xs font-bold uppercase shadow-lg shadow-pld-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar Apertura
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KardexView;
