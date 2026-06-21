import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { FixedAsset } from '../store';
import { 
  HardDrive, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Calculator,
  Search,
  FileDown,
  Printer
} from 'lucide-react';
import { exportSingleSheet } from '../utils/excelExport';
import { toast } from 'react-hot-toast';
import PageHeader from './ui/PageHeader';

const ActivosFijosView: React.FC = () => {
  const { fixedAssets, saveFixedAsset, deleteFixedAsset, currentCompany, exportarPle71TXT } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAssets = useMemo(() => {
    return (fixedAssets || []).filter(a => 
      a.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.serie_placa?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fixedAssets, searchTerm]);

  const handleAddAsset = () => {
    const id = crypto.randomUUID();
    const newAsset: FixedAsset = {
      id,
      codigo: `AF-${String(fixedAssets.length + 1).padStart(4, '0')}`,
      descripcion: 'NUEVO ACTIVO FIJO',
      marca: '',
      modelo: '',
      serie_placa: '',
      fecha_adquisicion: new Date().toISOString().split('T')[0],
      fecha_uso: new Date().toISOString().split('T')[0],
      costo_adquisicion: 0,
      saldo_inicial: 0,
      adquisiciones: 0,
      mejoras: 0,
      retiros_bajas: 0,
      otros_ajustes: 0,
      ajuste_inflacion: 0,
      tasa_depreciacion: 10,
      deprec_ejercicio: 0,
      deprec_bajas: 0,
      deprec_otros: 0,
      deprec_acum_anterior: 0,
      depreciacion_acumulada: 0,
      tasa_depreciacion_tributaria: 10,
      deprec_ejercicio_tributaria: 0,
      depreciacion_acumulada_tributaria: 0,
      deprec_acum_anterior_tributaria: 0,
      metodo: 'LINEA RECTA',
      cuenta_activo: '33',
      cuenta_depreciacion: '39'
    };
    saveFixedAsset(newAsset);
    toast.success('Activo agregado');
  };

  const calculateHistorico = (a: FixedAsset) => {
    return (a.saldo_inicial || 0) + (a.adquisiciones || 0) + (a.mejoras || 0) - (a.retiros_bajas || 0) + (a.otros_ajustes || 0);
  };

  const calculateAjustado = (a: FixedAsset) => {
    return calculateHistorico(a) + (a.ajuste_inflacion || 0);
  };

  const totalCosto = useMemo(() => fixedAssets.reduce((acc, a) => acc + calculateHistorico(a), 0), [fixedAssets]);
  const totalDeprecContable = useMemo(() => fixedAssets.reduce((acc, a) => acc + (a.depreciacion_acumulada || 0), 0), [fixedAssets]);
  const totalDeprecTributaria = useMemo(() => fixedAssets.reduce((acc, a) => acc + (a.depreciacion_acumulada_tributaria || 0), 0), [fixedAssets]);
  
  const diferenciaDiferida = totalDeprecContable - totalDeprecTributaria; // Carrying value vs Tax base
  const efectoNic12 = Math.abs(diferenciaDiferida) * 0.295; // 29.5% tax rate

  const handleExport = () => {
    const rows = filteredAssets.map(a => ({
      codigo: a.codigo,
      cuenta_activo: a.cuenta_activo,
      descripcion: a.descripcion,
      marca: a.marca,
      modelo: a.modelo,
      serie_placa: a.serie_placa,
      saldo_inicial: a.saldo_inicial || 0,
      adquisiciones: a.adquisiciones || 0,
      mejoras: a.mejoras || 0,
      retiros_bajas: a.retiros_bajas || 0,
      otros_ajustes: a.otros_ajustes || 0,
      valor_historico: calculateHistorico(a),
      fecha_adquisicion: a.fecha_adquisicion,
      fecha_uso: a.fecha_uso,
      tasa_depreciacion: (a.tasa_depreciacion || 0) / 100,
      deprec_acum_anterior: a.deprec_acum_anterior || 0,
      deprec_ejercicio: a.deprec_ejercicio || 0,
      depreciacion_acumulada: a.depreciacion_acumulada || 0,
      tasa_tributaria: (a.tasa_depreciacion_tributaria || 0) / 100,
      deprec_ejercicio_trib: a.deprec_ejercicio_tributaria || 0,
      deprec_acum_trib: a.depreciacion_acumulada_tributaria || 0
    }));

    exportSingleSheet({
      sheetName: 'Formato 7.1 Dual',
      title: 'FORMATO 7.1: REGISTRO DE ACTIVOS FIJOS - DETALLE DE LOS MOVIMIENTOS (TASA DUAL)',
      columns: [
        { header: 'CÓDIGO', key: 'codigo', width: 12, alignment: 'center' },
        { header: 'CUENTA', key: 'cuenta_activo', width: 10, alignment: 'center' },
        { header: 'DESCRIPCIÓN', key: 'descripcion', width: 30 },
        { header: 'MARCA', key: 'marca', width: 15 },
        { header: 'MODELO', key: 'modelo', width: 15 },
        { header: 'SERIE/PLACA', key: 'serie_placa', width: 15 },
        { header: 'SALDO INICIAL', key: 'saldo_inicial', width: 16, style: 'currency' },
        { header: 'ADQUISICIONES', key: 'adquisiciones', width: 16, style: 'currency' },
        { header: 'MEJORAS', key: 'mejoras', width: 16, style: 'currency' },
        { header: 'RETIROS/BAJAS', key: 'retiros_bajas', width: 16, style: 'currency' },
        { header: 'OTROS AJUSTES', key: 'otros_ajustes', width: 16, style: 'currency' },
        { header: 'VALOR HISTÓRICO', key: 'valor_historico', width: 18, style: 'currency' },
        { header: 'FECHA ADQ.', key: 'fecha_adquisicion', width: 14, alignment: 'center' },
        { header: 'FECHA USO', key: 'fecha_uso', width: 14, alignment: 'center' },
        { header: 'TASA CONTABLE %', key: 'tasa_depreciacion', width: 15, style: 'percent', alignment: 'right' },
        { header: 'DEP. ACUM. CONTABLE', key: 'depreciacion_acumulada', width: 18, style: 'currency' },
        { header: 'TASA TRIBUTARIA %', key: 'tasa_tributaria', width: 15, style: 'percent', alignment: 'right' },
        { header: 'DEP. ACUM. TRIBUTARIA', key: 'deprec_acum_trib', width: 18, style: 'currency' }
      ],
      rows,
      totals: {
        codigo: 'TOTALES',
        saldo_inicial: filteredAssets.reduce((acc, a) => acc + (a.saldo_inicial || 0), 0),
        adquisiciones: filteredAssets.reduce((acc, a) => acc + (a.adquisiciones || 0), 0),
        mejoras: filteredAssets.reduce((acc, a) => acc + (a.mejoras || 0), 0),
        retiros_bajas: filteredAssets.reduce((acc, a) => acc + (a.retiros_bajas || 0), 0),
        otros_ajustes: filteredAssets.reduce((acc, a) => acc + (a.otros_ajustes || 0), 0),
        valor_historico: filteredAssets.reduce((acc, a) => acc + calculateHistorico(a), 0),
        depreciacion_acumulada: filteredAssets.reduce((acc, a) => acc + (a.depreciacion_acumulada || 0), 0),
        deprec_acum_trib: filteredAssets.reduce((acc, a) => acc + (a.depreciacion_acumulada_tributaria || 0), 0)
      },
      companyInfo: {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'EMPRESA',
        period: currentCompany?.period || String(new Date().getFullYear()),
      }
    }, 'SUNAT_Formato_7.1_Tasa_Dual');
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<HardDrive size={18} />}
        title="Activos Fijos"
        badge={<span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-[9px] text-amber-600 border border-amber-500/10 tracking-[0.2em] uppercase">Tasa Dual PLE 7.1</span>}
        subtitle={
          <span className="flex items-center gap-2">
            <Calculator size={12} className="text-amber-500" />
            Depreciación Paralela (NIIF vs LIR) y Libro SUNAT 7.1
          </span>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAddAsset}
              className="h-8 px-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1.5 text-[10px] font-bold shadow-sm"
            >
              <Plus size={14} /> Nuevo Activo
            </button>
            <button 
              onClick={() => window.print()} 
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-amber-600 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button 
              onClick={handleExport} 
              className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-amber-600 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"
            >
              <FileDown size={14} /> Excel
            </button>
            <button 
              onClick={() => {
                const p = currentCompany?.period ? (currentCompany.period.length === 4 ? `${currentCompany.period}1200` : `${currentCompany.period}00`) : `${new Date().getFullYear()}1200`;
                exportarPle71TXT(p);
              }} 
              className="h-8 px-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5 text-[10px] font-bold shadow-sm"
            >
              <FileDown size={14} /> PLE 7.1 (TXT)
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 shrink-0">
         <div className="card-elevated !p-4 bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-amber-500/20 relative overflow-hidden group">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Valor Histórico Total</p>
            <h3 className="text-xl font-black text-app-text italic">
               S/ {totalCosto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
         </div>
         <div className="card-elevated !p-4 bg-gradient-to-br from-rose-500/10 to-pink-600/10 border-rose-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Deprec. Contable vs Tributaria</p>
            <h3 className="text-base font-black text-rose-500 italic">
               C: S/ {totalDeprecContable.toLocaleString('es-PE', { minimumFractionDigits: 2 })} <br/>
               T: S/ {totalDeprecTributaria.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
         </div>
         <div className="card-elevated !p-4 bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border-emerald-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Diferencia Temporaria PPE</p>
            <h3 className="text-xl font-black text-emerald-600 italic">
               S/ {diferenciaDiferida.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </h3>
            <span className="text-[8px] font-bold text-app-muted">
              {diferenciaDiferida < 0 ? 'Deducible (Activo Diferido)' : diferenciaDiferida > 0 ? 'Gravable (Pasivo Diferido)' : 'Sin diferencia'}
            </span>
         </div>
         <div className="card-elevated !p-4 flex flex-col justify-center bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border-indigo-500/20">
            <p className="text-[9px] font-black uppercase tracking-widest text-app-muted mb-1">Efecto NIC 12 IR Diferido</p>
            <p className="text-xl font-black text-indigo-500 tracking-tighter italic">
              S/ {efectoNic12.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[8px] font-bold text-app-muted">Tasa aplicada: 29.5%</span>
         </div>
      </div>

      {/* Main Table Container */}
      <div className="card-elevated !p-0 flex flex-col overflow-hidden shadow-2xl border-app-border/40">
        <div className="px-4 py-2 border-b border-app-border flex items-center justify-between bg-app-surface/30 shrink-0">
           <div className="flex items-center gap-3">
              <div className="p-1.5 bg-app-bg rounded-lg border border-app-border">
                <Search size={14} className="text-app-muted" />
              </div>
              <input 
                type="text" 
                placeholder="BUSCAR ACTIVO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-[0.2em] w-64 focus:ring-0 text-app-text placeholder-app-muted/30"
              />
           </div>
           <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-app-muted uppercase bg-app-bg px-2 py-0.5 rounded-full border border-app-border">
                Vista Técnica Expandida
              </span>
           </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-app-surface/20">
          <table className="w-full text-left border-collapse min-w-[2800px]">
             <thead className="sticky top-0 z-20 shadow-md">
                <tr className="bg-app-bg text-[8px] font-black uppercase tracking-widest text-app-muted border-b border-app-border">
                  <th className="px-4 py-3 bg-app-bg border-r border-app-border shadow-sm sm:sticky sm:left-0 sm:z-30 min-w-[120px]">Código</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[70px]">Cta</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[300px]">Descripción Activo</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[110px]">Marca</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[110px]">Modelo</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[130px]">Serie / Placa</th>
                  <th className="px-3 py-3 bg-amber-500/5 text-amber-600 min-w-[120px] text-right">Saldo Inicial</th>
                  <th className="px-3 py-3 bg-amber-500/5 text-amber-600 min-w-[120px] text-right">Adquisiciones</th>
                  <th className="px-3 py-3 bg-amber-500/5 text-amber-600 min-w-[120px] text-right">Mejoras</th>
                  <th className="px-3 py-3 bg-rose-500/5 text-rose-600 min-w-[120px] text-right">Bajas</th>
                  <th className="px-3 py-3 bg-blue-500/5 text-blue-600 min-w-[120px] text-right italic">Valor Histórico</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[130px]">Fecha Adq.</th>
                  <th className="px-3 py-3 bg-app-bg/95 min-w-[130px]">F. Inicio Uso</th>
                  
                  {/* Contable Section */}
                  <th className="px-3 py-3 bg-indigo-500/5 text-indigo-600 min-w-[100px] text-right border-l border-app-border">Tasa C. %</th>
                  <th className="px-3 py-3 bg-indigo-500/5 text-indigo-600 min-w-[120px] text-right">Acum. Ant. C.</th>
                  <th className="px-3 py-3 bg-indigo-500/5 text-indigo-600 min-w-[120px] text-right font-bold">Ejerc. C.</th>
                  <th className="px-3 py-3 bg-indigo-500/5 text-indigo-600 min-w-[130px] text-right font-black">Deprec. Tot. C.</th>

                  {/* Tributaria Section */}
                  <th className="px-3 py-3 bg-emerald-500/5 text-emerald-600 min-w-[100px] text-right border-l border-app-border">Tasa T. %</th>
                  <th className="px-3 py-3 bg-emerald-500/5 text-emerald-600 min-w-[120px] text-right">Acum. Ant. T.</th>
                  <th className="px-3 py-3 bg-emerald-500/5 text-emerald-600 min-w-[120px] text-right font-bold">Ejerc. T.</th>
                  <th className="px-3 py-3 bg-emerald-500/5 text-emerald-600 min-w-[130px] text-right font-black">Deprec. Tot. T.</th>
                  
                  <th className="px-4 py-3 bg-app-bg text-right pr-6 min-w-[100px]">Acciones</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-app-border/40">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="text-[9px] hover:bg-app-text/[0.03] transition-colors group">
                    <td className="px-4 py-2 border-r border-app-border sm:sticky sm:left-0 sm:z-10 bg-app-surface font-mono font-black text-amber-600 group-hover:bg-app-hover">
                        <input 
                        type="text" 
                        value={asset.codigo} 
                        onChange={(e) => saveFixedAsset({...asset, codigo: e.target.value.toUpperCase()})}
                        className="bg-transparent border-none p-0 focus:ring-0 w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        value={asset.cuenta_activo} 
                        onChange={(e) => saveFixedAsset({...asset, cuenta_activo: e.target.value})}
                        className="bg-transparent border-none p-0 text-app-muted font-bold focus:ring-0 w-full font-mono"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        value={asset.descripcion} 
                        onChange={(e) => saveFixedAsset({...asset, descripcion: e.target.value.toUpperCase()})}
                        className="bg-transparent border-none p-0 text-app-text font-bold focus:ring-0 w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        value={asset.marca || ''} 
                        onChange={(e) => saveFixedAsset({...asset, marca: e.target.value.toUpperCase()})}
                        className="bg-transparent border-none p-0 text-app-muted focus:ring-0 w-full"
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        value={asset.modelo || ''} 
                        onChange={(e) => saveFixedAsset({...asset, modelo: e.target.value.toUpperCase()})}
                        className="bg-transparent border-none p-0 text-app-muted focus:ring-0 w-full"
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="text" 
                        value={asset.serie_placa || ''} 
                        onChange={(e) => saveFixedAsset({...asset, serie_placa: e.target.value.toUpperCase()})}
                        className="bg-transparent border-none p-0 text-app-muted focus:ring-0 w-full"
                        placeholder="-"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.saldo_inicial || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, saldo_inicial: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-app-text font-bold focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.adquisiciones || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, adquisiciones: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-app-text font-bold focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.mejoras || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, mejoras: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-emerald-500 font-bold focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.retiros_bajas || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, retiros_bajas: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-rose-500 font-bold focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-blue-500 font-black italic bg-blue-500/5">
                        {calculateHistorico(asset).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="date" 
                        value={asset.fecha_adquisicion} 
                        onChange={(e) => saveFixedAsset({...asset, fecha_adquisicion: e.target.value})}
                        className="bg-transparent border-none p-0 text-app-muted font-mono focus:ring-0 w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                        <input 
                        type="date" 
                        value={asset.fecha_uso} 
                        onChange={(e) => saveFixedAsset({...asset, fecha_uso: e.target.value})}
                        className="bg-transparent border-none p-0 text-app-muted font-mono focus:ring-0 w-full"
                      />
                    </td>
                    
                    {/* Contable Values */}
                    <td className="px-3 py-2 text-right border-l border-app-border/40">
                        <input 
                        type="number" 
                        value={asset.tasa_depreciacion} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, tasa_depreciacion: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-indigo-500 font-black focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.deprec_acum_anterior || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, deprec_acum_anterior: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-app-muted font-bold focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.deprec_ejercicio || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, deprec_ejercicio: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-rose-400 font-black focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-indigo-500/5 text-indigo-500 font-black text-[11px] italic">
                        <input 
                        type="number" 
                        value={asset.depreciacion_acumulada || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, depreciacion_acumulada: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>

                    {/* Tributaria Values */}
                    <td className="px-3 py-2 text-right border-l border-app-border/40">
                        <input 
                        type="number" 
                        value={asset.tasa_depreciacion_tributaria || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, tasa_depreciacion_tributaria: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-emerald-500 font-black focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.deprec_acum_anterior_tributaria || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, deprec_acum_anterior_tributaria: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-app-muted font-bold focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                        <input 
                        type="number" 
                        value={asset.deprec_ejercicio_tributaria || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, deprec_ejercicio_tributaria: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right text-rose-400 font-black focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>
                    <td className="px-3 py-2 text-right bg-emerald-500/5 text-emerald-600 font-black text-[11px] italic">
                        <input 
                        type="number" 
                        value={asset.depreciacion_acumulada_tributaria || 0} 
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => saveFixedAsset({...asset, depreciacion_acumulada_tributaria: parseFloat(e.target.value) || 0})}
                        className="bg-transparent border-none p-0 text-right focus:ring-0 w-full [appearance:textfield]"
                      />
                    </td>

                    <td className="px-4 py-2 text-right pr-6">
                      <button 
                        onClick={() => deleteFixedAsset(asset.id)}
                        className="p-2 text-rose-500/50 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-500/10"
                        title="Eliminar Activo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={18} className="py-40 text-center">
                       <div className="flex flex-col items-center grayscale opacity-10">
                          <HardDrive size={120} strokeWidth={0.5} className="mb-6" />
                          <p className="text-[11px] font-black uppercase tracking-[0.4em]">No hay activos fijos registrados</p>
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
                 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                 <span className="font-bold uppercase tracking-wider">Identificación</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <span className="font-bold uppercase tracking-wider">Valores de Activo</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                 <span className="font-bold uppercase tracking-wider">Depreciación</span>
              </div>
           </div>
           <p className="font-bold italic">© SOFTCONTABLE ERP - Cumplimiento R.S. N° 234-2006/SUNAT</p>
        </div>
      </div>

        </div>
      </div>
    </div>
  );
};

export default ActivosFijosView;
