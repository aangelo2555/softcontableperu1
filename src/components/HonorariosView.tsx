import React, { useState, useEffect, useMemo } from 'react';
import { Users, Trash2, FileDown, Printer, FileText } from 'lucide-react';
import { exportSingleSheet } from '../utils/excelExport';
import { useStore } from '../store';
import type { HonorarioEntry } from '../store';
import DecimalInput from './shared/DecimalInput';
import Toast from './shared/Toast';
import type { ToastData } from './shared/Toast';
import { buscarContribuyente, detectarTipoDoc } from '../services/apiService';
import { TASA_RETENCION_4TA, UMBRAL_RETENCION_4TA, TIPO_DOC_IDENTIDAD } from '../constants/tributario';
import PageHeader from './ui/PageHeader';
import ActionBar from './ui/ActionBar';
import FormField from './ui/FormField';
import DateInput from './shared/DateInput';

const HonorariosView: React.FC = () => {
  const { plan, honorarios, saveHonorario, deleteHonorario, entities, draftHonorario, setDraftHonorario, getNextHonorarioNumber, currentCompany, exportarRetenciones41TXT } = useStore();

  const lookupAccount = (cta: string) => plan.find(a => a.cta === cta);

  const [toast, setToast] = useState<ToastData | null>(null);
  const emptyForm = (): Omit<HonorarioEntry, 'id'> => ({
    registro: getNextHonorarioNumber(),
    fecha: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    tipo_doc: '02',
    serie: 'E001',
    numero: '',
    doc_tipo: '6',
    doc_num: '',
    nombre: '',
    ctaGasto: '6322',
    ctaAbono: '424',
    bi: 0,
    retencion: 0,
    total: 0,
  });

  const [form, setFormLocal] = useState(() => ({ ...emptyForm(), ...draftHonorario }));

  const setForm = (updater: Omit<HonorarioEntry, 'id'> | ((prev: Omit<HonorarioEntry, 'id'>) => Omit<HonorarioEntry, 'id'>)) => {
    setFormLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setDraftHonorario(next);
      return next;
    });
  };

  useEffect(() => {
    setFormLocal(f => ({ ...f, registro: getNextHonorarioNumber() }));
  }, [honorarios.length, getNextHonorarioNumber]);

  // Auto-calc retención IR 4ta categoría
  useEffect(() => {
    const aplicaRetencion = form.bi > UMBRAL_RETENCION_4TA;
    const retencion = aplicaRetencion ? Math.round(form.bi * TASA_RETENCION_4TA * 100) / 100 : 0;
    const total = Math.round((form.bi - retencion) * 100) / 100;
    if (retencion !== form.retencion || total !== form.total) {
      setForm(f => ({ ...f, retencion, total }));
    }
  }, [form.bi]);

  // Auto-lookup name
  useEffect(() => {
    const fetchName = async () => {
      if (form.doc_num.length >= 8) {
        const autoTipo = detectarTipoDoc(form.doc_num);
        if (autoTipo !== form.doc_tipo) {
          setForm(f => ({ ...f, doc_tipo: autoTipo }));
        }
        const nombre = await buscarContribuyente(form.doc_num, autoTipo, entities);
        if (nombre) {
          setForm(f => ({ ...f, nombre }));
        }
      }
    };
    fetchName();
  }, [form.doc_num, entities]);

  const handleGuardar = () => {
    if (!form.doc_num || !form.nombre) {
      setToast({ type: 'error', message: 'Complete RUC y nombre del profesional.' });
      return;
    }
    if (form.bi <= 0) {
      setToast({ type: 'error', message: 'El monto total de honorarios debe ser mayor a 0.' });
      return;
    }
    const entry: HonorarioEntry = { ...form, id: `honorario-${Date.now()}` };
    saveHonorario(entry);
    setToast({ type: 'success', message: `Honorario ${entry.registro} guardado ✓` });
    const fresh = emptyForm();
    setFormLocal(fresh);
    setDraftHonorario(null);
  };

  const handleLimpiar = () => {
    setFormLocal(emptyForm());
    setDraftHonorario(null);
  };

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-hidden relative">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <PageHeader
        icon={<Users size={18} />}
        title="Registro de Honorarios"
        subtitle="Recibos por Honorarios — Servicios de Terceros"
        badge={
          <span className="ml-2 bg-app-bg px-3 py-1 rounded-full border border-app-border text-xs font-mono font-bold text-pld-blue">
            N° {form.registro}
          </span>
        }
        actions={
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                const y = parseInt(currentCompany?.period || String(new Date().getFullYear()));
                const m = new Date().getMonth() + 1;
                const periodo = `${y}${String(m).padStart(2, '0')}00`;
                exportarRetenciones41TXT(periodo);
              }}
              className="h-8 px-3 bg-gradient-to-r from-pld-blue/10 to-pld-magenta/10 border border-pld-blue/30 rounded-lg hover:border-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-pld-blue"
              title="Descargar archivo PLE Formato 4.1 (Retenciones 4ta categoría)"
            >
              <FileText size={14} /> PLE 4.1
            </button>
            <button onClick={() => window.print()} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><Printer size={14} /> Imprimir</button>
            <button onClick={() => exportSingleSheet({
              sheetName: 'Honorarios',
              title: 'REGISTRO DE HONORARIOS',
              columns: [
                { header: 'N°', key: 'registro', width: 22 },
                { header: 'FECHA', key: 'fecha', width: 12 },
                { header: 'SERIE', key: 'serie', width: 8 },
                { header: 'NÚMERO', key: 'numero', width: 12 },
                { header: 'RUC/DNI', key: 'doc_num', width: 14 },
                { header: 'NOMBRE', key: 'nombre', width: 35 },
                { header: 'HONORARIOS', key: 'bi', width: 14, style: 'currency' },
                { header: 'RETENCIÓN', key: 'retencion', width: 14, style: 'currency' },
                { header: 'NETO', key: 'total', width: 14, style: 'currency' }
              ],
              rows: honorarios,
              totals: {
                registro: '', fecha: '', serie: '', numero: '', doc_num: '', nombre: 'TOTALES',
                bi: honorarios.reduce((s, h) => s + h.bi, 0),
                retencion: honorarios.reduce((s, h) => s + h.retencion, 0),
                total: honorarios.reduce((s, h) => s + h.total, 0)
              },
              companyInfo: {
                ruc: currentCompany?.ruc || '',
                name: currentCompany?.name || 'EMPRESA',
                period: currentCompany?.period || String(new Date().getFullYear()),
              }
            }, 'Honorarios')} className="h-8 px-3 bg-app-bg border border-app-border rounded-lg hover:text-pld-blue transition-colors flex items-center gap-1.5 text-[10px] font-bold text-app-muted"><FileDown size={14} /> Excel</button>
          </div>
        }
      />

      {/* Form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto p-6 flex flex-col gap-5">

          {/* Row 1: Datos del Profesional */}
          <div className="section-card">
            <div className="section-card-header">
              <Users size={15} />
              <span>1. Datos del Profesional</span>
            </div>
            <div className="grid grid-cols-12 gap-3">
              <FormField label="Registro" className="col-span-6 sm:col-span-2">
                <input className="w-full text-sm font-mono font-bold text-pld-blue text-center bg-app-bg/50" readOnly value={form.registro} />
              </FormField>
              <FormField label="Fecha" className="col-span-6 sm:col-span-2">
                <DateInput className="w-full text-sm font-mono" value={form.fecha} onChange={v => setForm({ ...form, fecha: v })} />
              </FormField>
              <FormField label="Tipo" className="col-span-12 sm:col-span-2">
                <select className="w-full text-sm" value={form.doc_tipo} onChange={e => setForm({ ...form, doc_tipo: e.target.value })}>
                  {TIPO_DOC_IDENTIDAD.filter(t => ['6', '1', '4', '7'].includes(t.code)).map(t => (
                    <option key={t.code} value={t.code}>{t.code} - {t.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="RUC / DNI" accent required className="col-span-12 sm:col-span-3">
                <input className="w-full text-sm font-mono font-bold" placeholder="10XXXXXXXXX" value={form.doc_num} onChange={e => setForm({ ...form, doc_num: e.target.value })} />
              </FormField>
              <FormField label="Serie-Número" className="col-span-12 sm:col-span-3">
                <div className="flex gap-2">
                  <input className="w-20 text-sm font-mono" value={form.serie} onChange={e => setForm({ ...form, serie: e.target.value })} />
                  <input className="flex-1 text-sm font-mono font-bold" placeholder="0001" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
                </div>
              </FormField>
              <FormField label="Apellidos y Nombres" required className="col-span-12">
                <input className="w-full text-sm font-bold uppercase" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </FormField>
            </div>
          </div>

          {/* Row 2: Cuentas Contables */}
          <div className="section-card">
            <div className="section-card-header">
              <span>2. Cuentas Contables</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Cta Gasto / Servicio (Naturaleza)" accent>
                <input className="w-full text-sm font-mono uppercase" placeholder="6322, 634..." value={form.ctaGasto} onChange={e => setForm({ ...form, ctaGasto: e.target.value })} />
                <p className="text-[10px] text-app-muted italic mt-0.5">{lookupAccount(form.ctaGasto)?.description}</p>
              </FormField>
              <FormField label="Cta Abono (Pasivo)" accent>
                <input className="w-full text-sm font-mono uppercase" placeholder="424" value={form.ctaAbono} onChange={e => setForm({ ...form, ctaAbono: e.target.value })} />
                <p className="text-[10px] text-app-muted italic mt-0.5">{lookupAccount(form.ctaAbono)?.description}</p>
              </FormField>
            </div>
          </div>

          {/* Row 3: Importes */}
          <div className="section-card">
            <div className="section-card-header">
              <span>3. Importes y Retención</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <FormField label="Total Honorarios" accent>
                <DecimalInput className="w-full text-lg font-mono font-bold text-right text-pld-blue" value={form.bi} onChange={v => setForm({ ...form, bi: v })} />
              </FormField>
              <FormField label="Retención IR (8%)">
                <input className="w-full text-lg font-mono font-bold text-right text-pld-accent bg-app-bg/50 border-none" readOnly value={form.retencion.toFixed(2)} />
                <p className="text-[10px] text-app-muted mt-0.5">{form.bi > UMBRAL_RETENCION_4TA ? 'Aplica retención (> S/ 1,500)' : 'Sin retención (≤ S/ 1,500)'}</p>
              </FormField>
              <FormField label="Neto a Pagar">
                <div className="text-lg font-mono font-black text-right bg-gradient-to-br from-pld-blue to-pld-magenta text-white rounded-lg px-3 py-2">
                  S/ {form.total.toFixed(2)}
                </div>
              </FormField>
            </div>
          </div>

          {/* Records List */}
          {honorarios.length > 0 && (
            <div className="section-card !p-0 overflow-hidden">
              <div className="bg-app-bg px-4 py-2.5 text-[11px] font-bold text-app-muted uppercase tracking-wider border-b border-app-border">
                Honorarios Registrados ({honorarios.length})
              </div>
              <div className="overflow-x-auto max-h-60 custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-app-surface sticky top-0">
                    <tr className="text-app-muted font-bold uppercase">
                      <th className="p-2 text-left">Reg.</th>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">RUC</th>
                      <th className="p-2 text-left">Nombre</th>
                      <th className="p-2 text-right">Total Hon.</th>
                      <th className="p-2 text-right">Retención</th>
                      <th className="p-2 text-right">Neto</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {honorarios.map(h => (
                      <tr key={h.id} className="border-b border-app-border/50 font-mono hover:bg-app-hover">
                        <td className="p-2 text-pld-blue font-bold">{h.registro}</td>
                        <td className="p-2 text-app-muted">{h.fecha}</td>
                        <td className="p-2">{h.doc_num}</td>
                        <td className="p-2 uppercase font-bold font-sans text-xs">{h.nombre}</td>
                        <td className="p-2 text-right">{h.bi.toFixed(2)}</td>
                        <td className="p-2 text-right text-pld-accent">{h.retencion.toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">{h.total.toFixed(2)}</td>
                        <td className="p-2">
                          <button onClick={() => deleteHonorario(h.id)} className="text-red-500/40 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {honorarios.length === 0 && (
            <div className="flex items-center justify-center h-24 text-app-muted border border-dashed border-app-border rounded-lg">
              <p className="text-xs font-bold uppercase tracking-wider">No hay honorarios registrados</p>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      <ActionBar
        onSave={handleGuardar}
        onClear={handleLimpiar}
        saveLabel="Guardar Honorario"
        statusLeft={
          <div className="flex items-center gap-4 text-xs text-app-muted">
            <span className="font-mono font-bold text-pld-blue">{form.registro}</span>
            {form.bi > 0 && (
              <span className="bg-pld-blue/10 text-pld-blue px-2 py-0.5 rounded font-bold">
                S/ {form.total.toFixed(2)}
              </span>
            )}
          </div>
        }
      />
    </div>
  );
};

export default HonorariosView;
