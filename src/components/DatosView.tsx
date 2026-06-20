import React, { useState, useMemo } from 'react';
import { Database, Search, FileDown, Printer } from 'lucide-react';
import { DataTable } from './DataTable';
import { useStore } from '../store';
import { exportSingleSheet } from '../utils/excelExport';
import PageHeader from './ui/PageHeader';

const DatosView: React.FC = () => {
  const { currentCompany, journal } = useStore();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

  // Filter journal data
  const filteredJournal = useMemo(() => {
    let data = journal;
    if (sourceFilter !== 'ALL') {
      data = data.filter(j => j.source === sourceFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter(j =>
        j.glosa.toLowerCase().includes(q) ||
        j.cta.includes(q) ||
        j.desc.toLowerCase().includes(q) ||
        j.asiento.toLowerCase().includes(q)
      );
    }
    return data;
  }, [journal, query, sourceFilter]);

  const handleExport = () => {
    const rows = filteredJournal.map(row => ({
      mes: '12',
      anio: currentCompany.period || '2025',
      libro: row.source === 'COMPRA' ? '08' : row.source === 'VENTA' ? '14' : row.source === 'HONORARIO' ? '08' : '05',
      asiento: row.asiento,
      fecha: row.fecha,
      glosa: row.glosa,
      cta: row.cta,
      desc: row.desc,
      debe: row.debe,
      haber: row.haber,
      diferencia: row.debe - row.haber
    }));

    exportSingleSheet({
      sheetName: 'SQL Data',
      title: 'SQL DATA EXPLORER - REGISTRO GENERAL DE TRANSACCIONES',
      columns: [
        { header: 'MES', key: 'mes', width: 10, alignment: 'center' },
        { header: 'AÑO', key: 'anio', width: 10, alignment: 'center' },
        { header: 'LIBRO', key: 'libro', width: 10, alignment: 'center' },
        { header: 'ASIENTO', key: 'asiento', width: 14, alignment: 'center' },
        { header: 'FECHA', key: 'fecha', width: 14, alignment: 'center' },
        { header: 'GLOSA', key: 'glosa', width: 35 },
        { header: 'CUENTA', key: 'cta', width: 12, alignment: 'center' },
        { header: 'DESCRIPCIÓN', key: 'desc', width: 25 },
        { header: 'DEBE (S/)', key: 'debe', width: 16, style: 'currency' },
        { header: 'HABER (S/)', key: 'haber', width: 16, style: 'currency' },
        { header: 'DIFERENCIA (S/)', key: 'diferencia', width: 16, style: 'currency' }
      ],
      rows,
      totals: {
        mes: 'TOTAL GENERAL',
        debe: filteredJournal.reduce((acc, r) => acc + r.debe, 0),
        haber: filteredJournal.reduce((acc, r) => acc + r.haber, 0),
        diferencia: filteredJournal.reduce((acc, r) => acc + (r.debe - r.haber), 0)
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: currentCompany?.period || String(new Date().getFullYear()),
      }
    }, 'SQL_Data_Transacciones');
  };

  const columns = [
    { header: 'mes', accessor: () => '12', className: 'font-mono text-[10px] w-10' },
    { header: 'anio', accessor: () => currentCompany.period || '2025', className: 'font-mono text-[10px] w-10' },
    { header: 'Acod', accessor: (row: any) => {
      if (row.source === 'COMPRA') return '08';
      if (row.source === 'VENTA') return '14';
      if (row.source === 'HONORARIO') return '08';
      return '05';
    }, className: 'font-mono text-[10px] w-10' },
    { header: 'Aasien', accessor: 'asiento' as any, className: 'font-mono text-[10px] text-pld-blue font-bold' },
    { header: 'Afec', accessor: 'fecha' as any, className: 'font-mono text-[10px]' },
    { header: 'Aglosa', accessor: 'glosa' as any, className: 'italic text-[10px] max-w-[150px] truncate' },
    { header: 'Acta', accessor: 'cta' as any, className: 'font-mono text-[10px] text-pld-blue' },
    { header: 'Adesc', accessor: 'desc' as any, className: 'text-[10px] max-w-[150px] truncate' },
    { header: 'Adebe', accessor: (row: any) => <span className="text-right block font-mono text-[10px] text-pld-blue">{row.debe.toFixed(2)}</span> },
    { header: 'Ahaber', accessor: (row: any) => <span className="text-right block font-mono text-[10px] text-pld-accent">{row.haber.toFixed(2)}</span> },
    { header: 'Adif', accessor: (row: any) => <span className="text-right block font-mono text-[10px]">{(row.debe - row.haber).toFixed(2)}</span> },
    { header: 'Source', accessor: (row: any) => (
      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
        row.source === 'COMPRA' ? 'bg-indigo-500/10 text-indigo-400' :
        row.source === 'VENTA' ? 'bg-blue-500/10 text-blue-400' :
        row.source === 'HONORARIO' ? 'bg-amber-500/10 text-amber-400' :
        'bg-emerald-500/10 text-emerald-400'
      }`}>{row.source}</span>
    ), className: 'text-center' },
  ];

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Database size={18} />}
        title="SQL Data Explorer"
        subtitle={`Transacciones — ${filteredJournal.length} registros`}
        actions={
          <>
            <div className="relative group w-64 md:w-80">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted group-focus-within:text-pld-blue transition-colors" />
              <input
                type="text"
                placeholder="Filtrar por glosa, cuenta, asiento o RUC..."
                className="w-full pl-11 h-10 text-[11px] bg-app-bg border border-app-border rounded-xl outline-none focus:border-pld-blue focus:ring-4 focus:ring-pld-blue/5 transition-all shadow-sm"
                style={{ paddingLeft: '2.75rem' }}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="h-8 text-xs bg-app-bg border border-app-border rounded-lg px-2"
            >
              <option value="ALL">Todos</option>
              <option value="COMPRA">Compras</option>
              <option value="VENTA">Ventas</option>
              <option value="HONORARIO">Honorarios</option>
              <option value="ASIENTO">Asientos</option>
            </select>
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button onClick={handleExport} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
          <DataTable
            columns={columns}
            data={filteredJournal}
            emptyMessage="No hay datos técnicos disponibles. Registre Compras, Ventas u Honorarios primero."
          />
        </div>
      </div>
    </div>
  );
};

export default DatosView;
