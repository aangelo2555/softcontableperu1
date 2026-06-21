import React, { useState } from 'react';
import { 
  Save, 
  X, 
  Plus, 
  Trash2, 
  UserPlus, 
  FileText
} from 'lucide-react';
import { DataTable } from './DataTable';
import DateInput from './shared/DateInput';

interface OperationLine {
  id: number;
  cuenta: string;
  descripcion: string;
  dh: 'D' | 'H';
  importe: number;
  costos: string;
}

interface BaseOperationFormProps {
  title: string;
  type: 'COMPRAS' | 'VENTAS' | 'HONORARIOS';
  defaultCta: string;
  onSave: (data: any) => void;
  onClose: () => void;
}

const BaseOperationForm: React.FC<BaseOperationFormProps> = ({ 
  title, 
  type, 
  defaultCta,
  onSave, 
  onClose 
}) => {
  const [lines, setLines] = useState<OperationLine[]>([]);
  const [currentLine, setCurrentLine] = useState<Partial<OperationLine>>({ dh: 'D' });
  
  // Header state
  const [header, setHeader] = useState({
    ctaCargo: '',
    tipOper: '',
    periodo: '202512',
    ruc: '',
    nombre: '',
    tipoDoc: '01',
    serie: '',
    numero: '',
    fecEmi: '',
    fecVto: '',
    moneda: 'S',
    tc: '1.000',
    glosa: '',
    subTotal: 0,
    igv: 0,
    noGravada: 0,
    isc: 0,
    total: 0,
    // Honorarios specific
    rent4ta: 0,
    retSolidari: 0,
    impNeto: 0,
    // Detraction
    detracNum: '',
    detracFec: '',
    detracMon: 0
  });

  const addLine = () => {
    if (!currentLine.cuenta || !currentLine.importe) return;
    const newLine: OperationLine = {
      id: Date.now(),
      cuenta: currentLine.cuenta,
      descripcion: 'DESCRIPCIÓN AUTOMÁTICA', // Would be looked up
      dh: currentLine.dh || 'D',
      importe: Number(currentLine.importe),
      costos: currentLine.costos || ''
    };
    setLines([...lines, newLine]);
    setCurrentLine({ dh: 'D', cuenta: '', importe: 0, costos: '' });
  };

  const removeLine = (id: number) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const totalDebe = lines.filter(l => l.dh === 'D').reduce((sum, l) => sum + l.importe, 0);
  const totalHaber = lines.filter(l => l.dh === 'H').reduce((sum, l) => sum + l.importe, 0);
  const balance = totalDebe - totalHaber;

  const columns = [
    { header: 'N° Cuenta', accessor: 'cuenta' as keyof OperationLine },
    { header: 'Descripción de Cuenta', accessor: 'descripcion' as keyof OperationLine },
    { header: 'D/H', accessor: 'dh' as keyof OperationLine, className: 'text-center' },
    { header: 'Importe', accessor: (row: OperationLine) => <span className="text-right block font-mono">{row.importe.toFixed(2)}</span> },
    { header: 'Centro de costos', accessor: 'costos' as keyof OperationLine },
    { header: '', accessor: (row: OperationLine) => (
      <button onClick={() => removeLine(row.id)} className="text-red-500 hover:text-red-400 p-1">
        <Trash2 size={14} />
      </button>
    )}
  ];

  return (
    <div className="flex flex-col h-full bg-app-bg text-dark-text animate-slide-up overflow-hidden">
      {/* Top Banner */}
      <div className="bg-pld-blue text-black px-4 py-1 text-[10px] font-black uppercase tracking-widest flex justify-between items-center">
        <span>Operaciones - {title}:</span>
        <button onClick={onClose} className="hover:bg-black/10 p-1 rounded">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Form Content */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          
          {/* Header Section */}
          <div className="glass p-4 rounded-lg border border-app-border/50 space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-6 md:col-span-4 space-y-2">
                <div className="flex flex-col">
                  <label>Cta cargo :</label>
                  <div className="flex gap-1">
                    <input type="text" className="w-full" value={header.ctaCargo} onChange={e => setHeader({...header, ctaCargo: e.target.value})} />
                    <select className="bg-app-bg border border-app-border text-xs px-2 rounded">
                      <option>▼</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label>Tip Oper :</label>
                  <select className="bg-app-bg border border-app-border py-1.5 px-2 rounded text-xs outline-none focus:border-pld-blue">
                    <option>REGISTRO ESTÁNDAR</option>
                  </select>
                </div>
              </div>

              <div className="col-span-12 sm:col-span-6 md:col-span-8 space-y-2 text-left sm:text-right">
                 {/* Period can go here */}
                 <div className="flex flex-col items-start sm:items-end">
                    <label>Periodo :</label>
                    <input type="text" className="w-24 text-center" value={header.periodo} readOnly />
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-4">
                 <label>Proveedor :</label>
                 <div className="flex gap-1">
                    <input type="text" className="w-full font-mono" placeholder="RUC..." />
                    <button className="bg-app-surface p-1 rounded border border-app-border hover:text-pld-blue"><UserPlus size={14} /></button>
                 </div>
              </div>
              <div className="col-span-12 sm:col-span-8 mt-0 sm:mt-5">
                 <input type="text" className="w-full bg-app-surface/30 border-none" placeholder="RAZÓN SOCIAL / NOMBRE" readOnly />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
               <div className="col-span-12 sm:col-span-4">
                  <label>Tipo Doc. :</label>
                  <select className="w-full">
                    <option>01 - FACTURA</option>
                    <option>03 - BOLETA</option>
                  </select>
               </div>
               <div className="col-span-8 sm:col-span-6">
                  <label>Documento :</label>
                  <div className="flex gap-1">
                    <input type="text" placeholder="SERIE" className="w-16" />
                    <input type="text" placeholder="NÚMERO" className="flex-1" />
                  </div>
               </div>
               <div className="col-span-4 sm:col-span-2 mt-5 flex justify-center">
                  <button className="p-1 glass rounded border-app-border text-pld-blue w-full h-8 flex items-center justify-center"><FileText size={16} /></button>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-10 gap-2">
               <div className="col-span-1 sm:col-span-2">
                  <label>Moneda :</label>
                  <select className="w-full">
                    <option>SOLES (S)</option>
                    <option>DOLARES ($)</option>
                  </select>
               </div>
               <div className="col-span-1 sm:col-span-2">
                  <label>Fec. Emisión :</label>
                  <DateInput className="w-full" placeholder="DD/MM/AAAA" value={header.fecEmi} onChange={v => setHeader({...header, fecEmi: v})} />
               </div>
               <div className="col-span-1 sm:col-span-2">
                  <label>{type === 'HONORARIOS' ? 'Fec. Pago' : 'Fec. Vcto'} :</label>
                  <DateInput className="w-full" placeholder="DD/MM/AAAA" value={header.fecVto} onChange={v => setHeader({...header, fecVto: v})} />
               </div>
               <div className="col-span-1 sm:col-span-4 flex items-end">
                  <div className="flex items-center gap-1 bg-app-bg border border-app-border px-3 py-1.5 rounded w-full">
                    <span className="text-[10px] text-app-muted font-bold">T.C.=</span>
                    <input type="text" className="border-none p-0 w-full text-right" value={header.tc} readOnly />
                  </div>
               </div>
            </div>

            {/* Totals Section */}
            <div className="grid grid-cols-12 gap-2 bg-app-bg/40 p-3 rounded border border-app-border/50">
               {type !== 'HONORARIOS' ? (
                 <>
                  <div className="col-span-6 sm:col-span-3">
                    <label>Sub total :</label>
                    <input type="number" className="w-full text-right font-mono" defaultValue={0} />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label>IGV :</label>
                    <input type="number" className="w-full text-right font-mono" defaultValue={0} />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label>No Gravada :</label>
                    <input type="number" className="w-full text-right font-mono" defaultValue={0} />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label>I.S.C :</label>
                    <input type="number" className="w-full text-right font-mono" defaultValue={0} />
                  </div>
                 </>
               ) : (
                 <>
                  <div className="col-span-4 sm:col-span-3">
                    <label>Importe :</label>
                    <input type="number" className="w-full text-right font-mono" defaultValue={0} />
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label>Rent. 4ta C. :</label>
                    <input type="number" className="w-full text-right font-mono text-red-400" defaultValue={0} />
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label>Ret. Solidari. :</label>
                    <input type="number" className="w-full text-right font-mono text-red-400" defaultValue={0} />
                  </div>
                 </>
               )}
               <div className="col-span-12 sm:col-span-3">
                  <label>Total S/. :</label>
                  <input type="number" className="w-full text-right font-mono font-bold text-pld-blue" defaultValue={0} />
               </div>
               <div className="col-span-12 mt-1">
                  <label>Glosa :</label>
                  <input type="text" className="w-full" placeholder="DESCRIPCIÓN DE LA OPERACIÓN" />
               </div>
            </div>

            {/* Detraction Section (Optional display) */}
            <div className="pt-2 border-t border-app-border/50 flex gap-4">
              <div className="flex gap-2 items-center">
                 <label className="mb-0">N° Detrac. :</label>
                 <input type="text" className="w-24 text-xs" />
              </div>
              <div className="flex gap-2 items-center">
                 <label className="mb-0">Fec. Detrac. :</label>
                 <DateInput className="w-24 text-xs" value={header.detracFec} onChange={v => setHeader({...header, detracFec: v})} />
              </div>
              <div className="flex gap-2 items-center flex-1">
                 <label className="mb-0">Mon. Detrac. :</label>
                 <input type="text" className="w-24 text-xs" />
                 <button className="ml-auto text-pld-blue hover:scale-110 transition-transform"><Plus size={18} /></button>
              </div>
            </div>
          </div>

          {/* Lower Section Logic */}
          <div className="flex flex-col flex-1 gap-2 min-h-0">
             <div className="grid grid-cols-12 gap-2 p-2 bg-app-surface/50 rounded-t-lg border border-app-border border-b-0">
                <div className="col-span-6 sm:col-span-2">
                   <label>N° Cuenta</label>
                   <input 
                    type="text" 
                    className="w-full text-xs" 
                    value={currentLine.cuenta || ''}
                    onChange={e => setCurrentLine({...currentLine, cuenta: e.target.value})}
                   />
                </div>
                <div className="col-span-12 sm:col-span-4">
                   <label>Descripción de Cuenta</label>
                   <input type="text" className="w-full text-xs bg-app-bg/50" readOnly />
                </div>
                <div className="col-span-6 sm:col-span-2 md:col-span-1">
                   <label>D/H</label>
                   <select 
                    className="w-full py-1 text-xs"
                    value={currentLine.dh}
                    onChange={e => setCurrentLine({...currentLine, dh: e.target.value as 'D' | 'H'})}
                   >
                     <option value="D">D</option>
                     <option value="H">H</option>
                   </select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                   <label>Importe</label>
                   <input 
                    type="number" 
                    className="w-full text-xs"
                    value={currentLine.importe || ''}
                    onChange={e => setCurrentLine({...currentLine, importe: Number(e.target.value)})}
                   />
                </div>
                <div className="col-span-12 sm:col-span-3">
                   <label>Centro de costos</label>
                   <div className="flex gap-1">
                      <select className="w-full text-xs py-1">
                        <option value="">(NINGUNO)</option>
                      </select>
                      <button 
                        onClick={addLine}
                        className="bg-pld-blue text-black p-1 rounded hover:bg-pld-accent"
                      >
                        <Plus size={14} />
                      </button>
                   </div>
                </div>
             </div>
             
             <div className="flex-1 overflow-hidden border border-app-border rounded-b-lg">
                <DataTable 
                  columns={columns} 
                  data={lines} 
                  emptyMessage="No hay cuentas agregadas."
                  totals={
                    <tr className="bg-app-surface/80">
                      <td colSpan={3} className="p-2 text-right tracking-[0.5em] text-pld-blue font-bold text-[10px] uppercase">TOTALES</td>
                      <td className="p-2 text-right font-mono flex flex-col items-end">
                         <div className="flex justify-between w-full text-[10px] text-app-muted">
                            <span>Debe:</span>
                            <span>{totalDebe.toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between w-full text-[10px] text-app-muted">
                            <span>Haber:</span>
                            <span>{totalHaber.toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between w-full text-pld-blue border-t border-app-border pt-1">
                            <span>Saldo:</span>
                            <span>{balance.toFixed(2)}</span>
                         </div>
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  }
                />
             </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="w-24 bg-app-surface border-l border-app-border flex flex-col gap-2 p-2 pt-4 shadow-2xl">
           <button 
            onClick={() => onSave(header)}
            className="flex flex-col items-center gap-1 py-4 px-1 rounded hover:bg-app-hover group transition-all"
           >
              <div className="p-2 bg-pld-blue/10 rounded-lg group-hover:bg-pld-blue transition-colors">
                <Save size={20} className="text-pld-blue group-hover:text-black" />
              </div>
              <span className="text-[10px] font-black uppercase text-app-muted group-hover:text-app-text">Guardar</span>
           </button>
           
           <button 
            onClick={onClose}
            className="flex flex-col items-center gap-1 py-4 px-1 rounded hover:bg-app-hover group mt-auto mb-4 transition-all"
           >
              <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500 transition-colors">
                <X size={20} className="text-red-500 group-hover:text-app-text" />
              </div>
              <span className="text-[10px] font-black uppercase text-app-muted group-hover:text-app-text">Salir</span>
           </button>

           <div className="mt-auto border-t border-app-border/50 py-4 flex flex-col items-center gap-2">
              <span className="text-[8px] font-black text-pld-blue animate-pulse">CÓDIGO:</span>
              <div className="bg-app-bg border border-pld-blue text-pld-blue font-mono px-2 py-1 rounded text-xs select-none shadow-[0_0_10px_rgba(0,212,255,0.2)]">
                {defaultCta}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BaseOperationForm;
