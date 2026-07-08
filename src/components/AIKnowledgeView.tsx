import React, { useState, useEffect, useMemo } from 'react';
import { Database, Search, Plus, Trash2, Edit2, Play, CheckCircle, AlertTriangle, HelpCircle, RefreshCw, X, Save } from 'lucide-react';
import { webApiBridge } from '../services/apiBridge';
import PageHeader from './ui/PageHeader';
import FormField from './ui/FormField';
import Button from './ui/Button';
import Modal from './shared/Modal';
import toast from 'react-hot-toast';

interface AIKnowledgeItem {
  id: string;
  sector: string;
  regimen: string;
  niif_norma?: string;
  categoria: string;
  premisa: string;
  glosa: string;
  asiento_json: { cuenta: string; detalle: string; debe: number; haber: number }[];
  explicacion?: string;
  tags?: string;
}

export const AIKnowledgeView: React.FC = () => {
  const [cases, setCases] = useState<AIKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    sector: '',
    regimen: '',
    search: ''
  });

  // Modal de edición/creación
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<AIKnowledgeItem> | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  // Sub-formulario de líneas de asiento para el caso
  const [lines, setLines] = useState<{ cuenta: string; detalle: string; debe: number; haber: number }[]>([]);
  const [newLine, setNewLine] = useState({ cuenta: '', detalle: '', debe: 0, haber: 0 });

  const loadCases = async () => {
    setLoading(true);
    try {
      const res = await webApiBridge.aiGetKnowledge(filters);
      if (res.success) {
        setCases(res.data || []);
      }
    } catch (err: any) {
      toast.error(`Error al cargar base de conocimiento: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [filters.sector, filters.regimen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCases();
  };

  const handleSeed = async () => {
    if (!window.confirm('¿Está seguro de sembrar los 15 templates contables predefinidos en la base de datos? Esto enriquecerá la precisión del RAG de inmediato.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await webApiBridge.aiSeedKnowledge();
      if (res.success) {
        toast.success(`¡Se sembraron ${res.count} casos de éxito en la base de datos! 🌱`);
        loadCases();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Error al sembrar base contable: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro de eliminar este caso práctico contable de la base IA?')) {
      return;
    }

    try {
      const res = await webApiBridge.aiDeleteKnowledge(id);
      if (res.success) {
        toast.success('Caso eliminado correctamente.');
        loadCases();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Error al eliminar caso: ${err.message}`);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem({
      sector: 'COMERCIAL',
      regimen: 'RG',
      categoria: 'GENERAL',
      premisa: '',
      glosa: '',
      explicacion: '',
      niif_norma: '',
      tags: ''
    });
    setLines([]);
    setNewLine({ cuenta: '', detalle: '', debe: 0, haber: 0 });
    setShowModal(true);
  };

  const handleOpenEdit = (item: AIKnowledgeItem) => {
    setEditingItem(item);
    setLines(item.asiento_json || []);
    setNewLine({ cuenta: '', detalle: '', debe: 0, haber: 0 });
    setShowModal(true);
  };

  const handleAddLine = () => {
    if (!newLine.cuenta) {
      toast.error('Ingrese cuenta contable.');
      return;
    }
    if (newLine.debe === 0 && newLine.haber === 0) {
      toast.error('Ingrese un monto en Debe o Haber.');
      return;
    }

    setLines(prev => [...prev, { ...newLine }]);
    setNewLine({ cuenta: '', detalle: '', debe: 0, haber: 0 });
  };

  const handleRemoveLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  // Validaciones del asiento del caso
  const totalDebe = useMemo(() => lines.reduce((acc, curr) => acc + Number(curr.debe || 0), 0), [lines]);
  const totalHaber = useMemo(() => lines.reduce((acc, curr) => acc + Number(curr.haber || 0), 0), [lines]);
  const isBalanced = useMemo(() => {
    return lines.length > 0 && Math.abs(totalDebe - totalHaber) < 0.01;
  }, [lines, totalDebe, totalHaber]);

  const handleSave = async () => {
    if (!editingItem?.premisa || !editingItem?.glosa) {
      toast.error('La premisa contable y la glosa son obligatorias.');
      return;
    }

    if (lines.length === 0) {
      toast.error('Debe añadir al menos una línea de asiento contable.');
      return;
    }

    if (!isBalanced) {
      toast.error('El asiento no cumple con el principio de partida doble (no está cuadrado).');
      return;
    }

    try {
      const payload = {
        ...editingItem,
        asiento_json: lines
      };

      let res;
      if (editingItem.id) {
        res = await webApiBridge.aiUpdateKnowledge(editingItem.id, payload);
      } else {
        res = await webApiBridge.aiSaveKnowledge(payload);
      }

      if (res.success) {
        toast.success(editingItem.id ? 'Caso práctico actualizado.' : 'Caso práctico guardado.');
        setShowModal(false);
        loadCases();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in">
      <PageHeader
        icon={<Database size={18} />}
        title="Entrenamiento IA: Base de Conocimiento RAG"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSeed}
              className="h-8 px-3 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              title="Sembrar templates predefinidos"
            >
              <RefreshCw size={12} />
              Sembrar Templates
            </button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={handleOpenCreate}
              className="bg-pld-blue hover:opacity-95"
            >
              Nuevo Caso
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <div className="bg-app-surface px-6 py-4 border-b border-app-border flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar por premisa, glosa, cuentas o tags..."
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-app-border bg-app-bg focus:border-pld-blue focus:ring-4 focus:ring-pld-blue/10"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Buscar
          </Button>
        </form>

        <div className="flex gap-3 w-full md:w-auto">
          <select
            className="text-xs bg-app-bg border border-app-border rounded-xl px-3 py-2.5 font-bold text-app-text min-w-[140px]"
            value={filters.sector}
            onChange={e => setFilters({ ...filters, sector: e.target.value })}
          >
            <option value="">TODOS LOS SECTORES</option>
            <option value="COMERCIAL">COMERCIAL</option>
            <option value="INDUSTRIAL">INDUSTRIAL</option>
            <option value="SERVICIOS">SERVICIOS</option>
          </select>

          <select
            className="text-xs bg-app-bg border border-app-border rounded-xl px-3 py-2.5 font-bold text-app-text min-w-[140px]"
            value={filters.regimen}
            onChange={e => setFilters({ ...filters, regimen: e.target.value })}
          >
            <option value="">TODOS LOS RÉGIMENES</option>
            <option value="RG">REGIMEN GENERAL (RG)</option>
            <option value="RER">RÉGIMEN ESPECIAL (RER)</option>
            <option value="MYPE">TRIBUTARIO MYPE (RMT)</option>
            <option value="NRUS">NUEVO RUS (NRUS)</option>
          </select>
        </div>
      </div>

      {/* Cases List */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2">
            <RefreshCw size={24} className="animate-spin text-pld-blue" />
            <span className="text-sm font-bold text-app-muted">Cargando base de conocimiento...</span>
          </div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-app-surface/30 rounded-2xl border border-app-border/50">
            <Database size={48} className="text-app-muted mb-4 opacity-50" />
            <h4 className="text-sm font-black uppercase tracking-wider mb-2">Base de Conocimiento Vacía</h4>
            <p className="text-xs text-app-muted max-w-sm mb-6 leading-relaxed">
              No se encontraron casos prácticos en la base de datos. Siembra los templates predefinidos o crea uno nuevo para empezar a alimentar a la IA.
            </p>
            <button
              onClick={handleSeed}
              className="px-4 py-2 bg-pld-blue/10 hover:bg-pld-blue/20 text-pld-blue font-bold rounded-lg text-xs transition-colors"
            >
              Sembrar Casos Iniciales
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cases.map((c) => (
              <div
                key={c.id}
                className="section-card flex flex-col gap-4 hover:border-pld-blue/30 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-pld-blue/5 text-pld-blue px-3 py-1 text-[9px] font-black uppercase rounded-bl-xl border-l border-b border-pld-blue/10">
                  {c.sector} | {c.regimen}
                </div>

                <div className="flex flex-col gap-1.5 pr-20">
                  <span className="text-[10px] text-pld-blue font-black uppercase tracking-widest flex items-center gap-1.5">
                    {c.categoria}
                    {c.niif_norma && (
                      <span className="text-[9px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold px-1.5 py-0.2 rounded">
                        {c.niif_norma}
                      </span>
                    )}
                  </span>
                  <h4 className="text-xs font-extrabold text-app-text uppercase mt-1">Glosa: {c.glosa}</h4>
                </div>

                <div className="p-3 bg-app-bg/50 border border-app-border/40 rounded-xl">
                  <p className="text-[11px] font-bold text-app-muted uppercase mb-1">Premisa de Entrenamiento RAG</p>
                  <p className="text-xs font-semibold text-app-text leading-relaxed italic">"{c.premisa}"</p>
                </div>

                <div className="flex justify-between items-center mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Set(expandedCardIds);
                      if (next.has(c.id)) {
                        next.delete(c.id);
                      } else {
                        next.add(c.id);
                      }
                      setExpandedCardIds(next);
                    }}
                    className="text-[10px] font-black uppercase text-pld-blue hover:text-pld-blue/80 flex items-center gap-1 transition-colors"
                  >
                    {expandedCardIds.has(c.id) ? 'Colapsar Caso ▲' : `Ver Detalle (${c.asiento_json?.length || 0} ctas) ▼`}
                  </button>
                  
                  {!expandedCardIds.has(c.id) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1 rounded bg-pld-blue/10 text-pld-blue hover:bg-pld-blue/20 transition-all"
                        title="Editar Caso"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                        title="Eliminar Caso"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>

                {expandedCardIds.has(c.id) && (
                  <>
                    {/* Asiento Table */}
                    <div className="rounded-xl border border-app-border bg-app-bg/25 overflow-hidden animate-fade-in">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-app-surface text-[8px] font-bold text-app-muted border-b border-app-border uppercase">
                            <th className="p-2 text-center w-12">Cuenta</th>
                            <th className="p-2 text-left">Detalle</th>
                            <th className="p-2 text-right w-16">Debe</th>
                            <th className="p-2 text-right w-16">Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.asiento_json?.map((l, i) => (
                            <tr key={i} className="border-b border-app-border/10 last:border-0">
                              <td className="p-2 text-center font-mono font-black text-pld-blue">{l.cuenta}</td>
                              <td className="p-2 font-bold truncate max-w-[180px]">{l.detalle}</td>
                              <td className="p-2 text-right font-mono font-extrabold text-emerald-500">
                                {l.debe > 0 ? Number(l.debe).toFixed(2) : '-'}
                              </td>
                              <td className="p-2 text-right font-mono font-extrabold text-red-400">
                                {l.haber > 0 ? Number(l.haber).toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Explicación */}
                    {c.explicacion && (
                      <p className="text-[10px] font-bold text-app-muted leading-relaxed animate-fade-in">
                        💡 <span className="font-extrabold text-app-text">Explicación IA:</span> {c.explicacion}
                      </p>
                    )}

                    {/* Acciones */}
                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-app-border/50 animate-fade-in">
                      <span className="text-[9px] text-app-muted font-bold">
                        Tags: {c.tags || 'sin tags'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg bg-pld-blue/10 text-pld-blue hover:bg-pld-blue/20 transition-all"
                          title="Editar Caso"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                          title="Eliminar Caso"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {showModal && editingItem && (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title={editingItem.id ? 'Editar Caso Práctico RAG' : 'Nuevo Caso Práctico RAG'}
          subtitle="Entrenamiento del Modelo de IA"
          maxWidth="max-w-xl"
        >
          <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-2">
            
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sector Contable">
                <select
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                  value={editingItem.sector}
                  onChange={e => setEditingItem({ ...editingItem, sector: e.target.value })}
                >
                  <option value="COMERCIAL">COMERCIAL</option>
                  <option value="INDUSTRIAL">INDUSTRIAL</option>
                  <option value="SERVICIOS">SERVICIOS</option>
                </select>
              </FormField>

              <FormField label="Régimen Tributario">
                <select
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                  value={editingItem.regimen}
                  onChange={e => setEditingItem({ ...editingItem, regimen: e.target.value })}
                >
                  <option value="RG">REGIMEN GENERAL (RG)</option>
                  <option value="RER">RÉGIMEN ESPECIAL (RER)</option>
                  <option value="MYPE">TRIBUTARIO MYPE (RMT)</option>
                  <option value="NRUS">NUEVO RUS (NRUS)</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Referencia NIIF / NIC (ej. NIC 2)">
                <input
                  type="text"
                  placeholder="Ej. NIC 2, NIIF 15"
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                  value={editingItem.niif_norma}
                  onChange={e => setEditingItem({ ...editingItem, niif_norma: e.target.value })}
                />
              </FormField>

              <FormField label="Categoría de Caso">
                <input
                  type="text"
                  placeholder="Ej. ANTICIPOS, DESMEDROS"
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                  value={editingItem.categoria}
                  onChange={e => setEditingItem({ ...editingItem, categoria: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Premisa / Prompt Detallado (Entrenamiento)">
              <textarea
                rows={3}
                placeholder="Escribe la premisa que el usuario ingresará para generar este asiento..."
                className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                value={editingItem.premisa}
                onChange={e => setEditingItem({ ...editingItem, premisa: e.target.value })}
              />
            </FormField>

            <FormField label="Glosa Recomendada">
              <input
                type="text"
                placeholder="Ej. PROVISIÓN DE PLANILLA DE OPERARIOS"
                className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text uppercase"
                value={editingItem.glosa}
                onChange={e => setEditingItem({ ...editingItem, glosa: e.target.value.toUpperCase() })}
              />
            </FormField>

            {/* Subformulario de Asientos */}
            <div className="border border-app-border rounded-xl p-4 bg-app-surface/50">
              <span className="block text-[10px] font-black uppercase text-pld-blue tracking-wider mb-3">
                LÍNEAS DEL ASIENTO CONTABLE
              </span>

              {/* Agregar línea */}
              <div className="grid grid-cols-12 gap-2 items-end mb-3 pb-3 border-b border-app-border/40">
                <div className="col-span-2">
                  <label className="text-[8px] font-bold text-app-muted uppercase">Cuenta</label>
                  <input
                    type="text"
                    placeholder="1041"
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2 text-[10px]"
                    value={newLine.cuenta}
                    onChange={e => setNewLine({ ...newLine, cuenta: e.target.value })}
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-[8px] font-bold text-app-muted uppercase">Detalle</label>
                  <input
                    type="text"
                    placeholder="CC OPERATIVAS"
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2 text-[10px]"
                    value={newLine.detalle}
                    onChange={e => setNewLine({ ...newLine, detalle: e.target.value })}
                  />
                </div>
                <div className="col-span-2.5">
                  <label className="text-[8px] font-bold text-app-muted uppercase">Debe</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2 text-[10px]"
                    value={newLine.debe || ''}
                    onChange={e => setNewLine({ ...newLine, debe: Number(e.target.value), haber: 0 })}
                  />
                </div>
                <div className="col-span-2.5">
                  <label className="text-[8px] font-bold text-app-muted uppercase">Haber</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-app-bg border border-app-border rounded-lg p-2 text-[10px]"
                    value={newLine.haber || ''}
                    onChange={e => setNewLine({ ...newLine, haber: Number(e.target.value), debe: 0 })}
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="w-full h-8 bg-pld-blue text-white rounded-lg flex items-center justify-center hover:opacity-90 active:scale-[0.95] transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Lista de líneas */}
              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                {lines.length === 0 ? (
                  <p className="text-[10px] text-app-muted italic text-center py-4">No hay líneas en este asiento.</p>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-[8px] text-app-muted uppercase border-b border-app-border">
                        <th className="p-1.5 text-center">Cta</th>
                        <th className="p-1.5 text-left">Detalle</th>
                        <th className="p-1.5 text-right">Debe</th>
                        <th className="p-1.5 text-right">Haber</th>
                        <th className="p-1.5 w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={idx} className="border-b border-app-border/10">
                          <td className="p-1.5 text-center font-mono font-bold text-pld-blue">{l.cuenta}</td>
                          <td className="p-1.5 font-bold truncate max-w-[130px]">{l.detalle}</td>
                          <td className="p-1.5 text-right font-mono font-bold text-emerald-500">
                            {l.debe > 0 ? l.debe.toFixed(2) : '-'}
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold text-red-400">
                            {l.haber > 0 ? l.haber.toFixed(2) : '-'}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Status de Balance */}
              {lines.length > 0 && (
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-app-border/40 text-[9px] font-bold">
                  <div className="flex items-center gap-1">
                    {isBalanced ? (
                      <>
                        <CheckCircle size={12} className="text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">PARTIDA DOBLE OK</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={12} className="text-amber-500 animate-bounce" />
                        <span className="text-amber-600 dark:text-amber-400">ASIENTO DESCUADRADO</span>
                      </>
                    )}
                  </div>
                  <div className="text-app-text">
                    T. Debe: S/ {totalDebe.toFixed(2)} | T. Haber: S/ {totalHaber.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <FormField label="Explicación / Teoría Contable">
              <textarea
                rows={2}
                placeholder="Escribe la justificación teórica o reglas contables aplicables (NIIF/SUNAT) para este caso..."
                className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                value={editingItem.explicacion}
                onChange={e => setEditingItem({ ...editingItem, explicacion: e.target.value })}
              />
            </FormField>

            <FormField label="Tags de búsqueda (separados por comas)">
              <input
                type="text"
                placeholder="ej. igv, detraccion, anticipo, NIC 2"
                className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs text-app-text"
                value={editingItem.tags}
                onChange={e => setEditingItem({ ...editingItem, tags: e.target.value })}
              />
            </FormField>

            <div className="flex gap-3 pt-4 border-t border-app-border">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Save size={14} />}
                className="flex-1 bg-pld-blue"
                onClick={handleSave}
                disabled={!isBalanced}
              >
                Guardar Caso
              </Button>
            </div>

          </div>
        </Modal>
      )}
    </div>
  );
};
