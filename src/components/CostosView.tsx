import React, { useState } from 'react';
import { Scale, ArrowLeftRight, PieChart, Plus, Trash2, FileDown, Printer } from 'lucide-react';
import { exportSingleSheet } from '../utils/excelExport';
import { DataTable } from './DataTable';
import { useStore  } from '../store';
import type { CostEntry } from '../store';

const CostosView: React.FC = () => {
  const { costs, addCost, updateCost, deleteCost, currentCompany, exportarPle101TXT } = useStore();
  const [view, setView] = useState<'TRANSFERENCIA' | 'DETALLE'>('TRANSFERENCIA');

  // ─── Form state for Transferencia ───
  const [newCodigo, setNewCodigo] = useState('');
  const [newDescripcion, setNewDescripcion] = useState('');

  // ─── Form state for Detalle ───
  const [detCostId, setDetCostId] = useState('');
  const [detCuentaDebe, setDetCuentaDebe] = useState('');
  const [detCuentaHaber, setDetCuentaHaber] = useState('');
  const [detPorcentaje, setDetPorcentaje] = useState('100');

  const transferColumns = [
    { header: 'N°', accessor: 'codigo' as keyof CostEntry, className: 'w-20 font-mono font-bold text-pld-blue' },
    { header: 'DESCRIPCION', accessor: 'descripcion' as keyof CostEntry, className: 'uppercase font-bold' },
    { header: '%', accessor: (row: CostEntry) => <span className="font-mono text-center block">{row.porcentaje}</span>, className: 'w-16 text-center' },
    {
      header: 'ACCIÓN',
      accessor: (row: CostEntry) => (
        <div className="flex gap-2 justify-center">
          <button onClick={() => { if (confirm('¿Eliminar este centro de costo?')) deleteCost(row.id); }} className="p-1 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'w-16 text-center'
    }
  ];

  const detailColumns = [
    { header: 'N°', accessor: 'codigo' as keyof CostEntry, className: 'w-20 font-mono font-bold text-pld-blue' },
    { header: 'DESCRIPCION', accessor: 'descripcion' as keyof CostEntry, className: 'uppercase font-bold' },
    { header: 'DEBE', accessor: (row: CostEntry) => <span className="text-right block font-mono text-pld-blue">{row.cuenta_debe || '94111'}</span>, className: 'w-32' },
    { header: 'HABER', accessor: (row: CostEntry) => <span className="text-right block font-mono text-pld-accent">{row.cuenta_haber || '79111'}</span>, className: 'w-32' },
    { header: '%', accessor: (row: CostEntry) => <span className="w-20 font-mono text-center block">{row.porcentaje}</span> },
    {
      header: 'ACCIÓN',
      accessor: (row: CostEntry) => (
        <div className="flex gap-2 justify-center">
          <button onClick={() => { if (confirm('¿Eliminar este centro de costo?')) deleteCost(row.id); }} className="p-1 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'w-16 text-center'
    }
  ];

  const handleSaveTransferencia = () => {
    if (!newCodigo || !newDescripcion) return;
    addCost({
      codigo: newCodigo,
      descripcion: newDescripcion.toUpperCase(),
      porcentaje: 100,
      monto: 0,
      cuenta_debe: '94111',
      cuenta_haber: '79111',
    });
    setNewCodigo('');
    setNewDescripcion('');
  };

  const handleSaveDetalle = () => {
    if (!detCostId) return;
    const cost = costs.find(c => c.id === detCostId);
    if (!cost) return;
    updateCost(cost.id, { 
      porcentaje: parseFloat(detPorcentaje) || 100,
      cuenta_debe: detCuentaDebe || '94111',
      cuenta_haber: detCuentaHaber || '79111'
    });
    setDetCostId('');
    setDetCuentaDebe('');
    setDetCuentaHaber('');
    setDetPorcentaje('100');
  };

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-hidden">
      {/* Header */}
      <div className="h-12 px-5 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-pld-blue/10 rounded-lg">
              <Scale size={16} className="text-pld-blue" />
           </div>
           <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-app-text">
                {view === 'TRANSFERENCIA' ? 'Transferencia de Costos' : 'Detalle de Transferencia'}
              </h2>
              <p className="text-[9px] text-app-muted uppercase tracking-wider">Centros de Costo</p>
           </div>
        </div>

        <div className="flex bg-app-bg p-1 rounded-lg border border-app-border/50">
           <button
             onClick={() => setView('TRANSFERENCIA')}
             className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${view === 'TRANSFERENCIA' ? 'bg-pld-blue text-white shadow-sm' : 'text-app-muted hover:text-app-text'}`}
           >
             <ArrowLeftRight size={12} /> Transferencia
           </button>
           <button
             onClick={() => setView('DETALLE')}
             className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-2 ${view === 'DETALLE' ? 'bg-pld-blue text-white shadow-sm' : 'text-app-muted hover:text-app-text'}`}
           >
             <PieChart size={12} /> Detalle
           </button>
        </div>
         <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button 
              onClick={() => {
                const per = currentCompany?.period ? `${currentCompany.period.replace('-', '')}00` : '20260100';
                exportarPle101TXT(per);
              }}
              className="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-[10px] font-bold shadow-lg shadow-purple-600/20"
            >
              <FileDown size={14} /> PLE 10.1 (TXT)
            </button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Centros de Costo',
              title: 'CENTROS DE COSTO',
              columns: [
                { header: 'CÓDIGO', key: 'codigo', width: 12, alignment: 'center' },
                { header: 'DESCRIPCIÓN', key: 'descripcion', width: 45 },
                { header: 'CUENTA DEBE', key: 'cuenta_debe', width: 15, alignment: 'center' },
                { header: 'CUENTA HABER', key: 'cuenta_haber', width: 15, alignment: 'center' },
                { header: '%', key: 'porcentaje', width: 10, style: 'number', alignment: 'center' }
              ],
              rows: costs,
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Centros_Costo')} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
         </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4">
        <DataTable
          columns={view === 'TRANSFERENCIA' ? transferColumns : detailColumns}
          data={costs}
          headerClassName="bg-gray-200 dark:bg-app-surface text-black dark:text-app-text uppercase text-[10px] font-black h-8 border-b-2 border-gray-400 dark:border-app-border"
          rowClassName="h-8 border-b border-app-border/50 hover:bg-app-hover text-[11px]"
        />
      </div>

      {/* Entry Footer */}
      <div className="p-4 bg-app-surface border-t border-app-border flex flex-wrap items-end gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
        {view === 'TRANSFERENCIA' ? (
          <>
            <div className="flex-none w-20">
              <label className="block text-[10px] font-black text-pld-blue uppercase mb-1">N°</label>
              <input type="text" className="w-full h-8 text-xs font-mono" placeholder="105"
                value={newCodigo} onChange={e => setNewCodigo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTransferencia()} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black text-pld-blue uppercase mb-1">Descripción</label>
              <input type="text" className="w-full h-8 text-xs uppercase" placeholder="NUEVO CENTRO DE COSTO"
                value={newDescripcion} onChange={e => setNewDescripcion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTransferencia()} />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1">
              <label className="block text-[10px] font-black text-pld-blue uppercase mb-1">C. Costo</label>
              <select className="w-full h-8 text-xs bg-app-bg border-app-border text-app-text rounded px-2"
                value={detCostId} onChange={e => {
                  const val = e.target.value;
                  setDetCostId(val);
                  const found = costs.find(c => c.id === val);
                  if (found) {
                    setDetCuentaDebe(found.cuenta_debe || '94111');
                    setDetCuentaHaber(found.cuenta_haber || '79111');
                    setDetPorcentaje(String(found.porcentaje));
                  } else {
                    setDetCuentaDebe('');
                    setDetCuentaHaber('');
                    setDetPorcentaje('100');
                  }
                }}>
                <option value="">SELECCIONAR...</option>
                {costs.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-black text-pld-blue uppercase mb-1">C. Debe</label>
              <input type="text" className="w-full h-8 text-xs font-mono" placeholder="94111"
                value={detCuentaDebe} onChange={e => setDetCuentaDebe(e.target.value)} />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-black text-pld-blue uppercase mb-1">C. Haber</label>
              <input type="text" className="w-full h-8 text-xs font-mono" placeholder="79111"
                value={detCuentaHaber} onChange={e => setDetCuentaHaber(e.target.value)} />
            </div>
            <div className="w-16">
              <label className="block text-[10px] font-black text-pld-blue uppercase mb-1">%</label>
              <input type="text" className="w-full h-8 text-xs font-mono text-center" placeholder="100"
                value={detPorcentaje} onChange={e => setDetPorcentaje(e.target.value)} />
            </div>
          </>
        )}
        <button
          onClick={view === 'TRANSFERENCIA' ? handleSaveTransferencia : handleSaveDetalle}
          className="h-8 bg-green-600 hover:bg-green-500 text-white px-6 rounded font-black text-[10px] uppercase flex items-center gap-2 transition-all shadow-lg shadow-green-900/20"
        >
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  );
};

export default CostosView;
