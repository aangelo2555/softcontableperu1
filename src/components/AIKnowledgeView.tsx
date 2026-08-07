import React, { useState, useEffect, useMemo } from 'react';
import { Database, Search, Plus, Trash2, Edit2, Play, CheckCircle, AlertTriangle, HelpCircle, RefreshCw, X, Save, Sparkles, BrainCircuit } from 'lucide-react';
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

// --- Subcomponente de Gestión RAG SoftPremium (Groq + IA) ---
const SoftPremiumRAGManager: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const [pillar, setPillar] = useState<'tributario' | 'planillas' | 'finanzas'>('tributario');
  const [moduleKey, setModuleKey] = useState<string>('all');
  const [title, setTitle] = useState<string>('');
  const [lawArticlesStr, setLawArticlesStr] = useState<string>('');
  const [calculationMethodology, setCalculationMethodology] = useState<string>('');
  const [customPromptRules, setCustomPromptRules] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/premium/admin/rag-knowledge', {
        headers: { Authorization: `Bearer ${localStorage.getItem('softcontable_token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
      }
    } catch (e: any) {
      toast.error('Error al cargar reglas RAG SoftPremium');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setPillar(item.pillar || 'tributario');
      setModuleKey(item.module_key || 'all');
      setTitle(item.title || '');
      let articles = item.law_articles;
      if (typeof articles === 'string') {
        try { articles = JSON.parse(articles); } catch (e) {}
      }
      setLawArticlesStr(Array.isArray(articles) ? articles.join('\n') : (item.law_articles || ''));
      setCalculationMethodology(item.calculation_methodology || '');
      setCustomPromptRules(item.custom_prompt_rules || '');
    } else {
      setSelectedItem(null);
      setPillar('tributario');
      setModuleKey('all');
      setTitle('');
      setLawArticlesStr('');
      setCalculationMethodology('');
      setCustomPromptRules('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Ingresa un título descriptivo para la norma RAG.');
      return;
    }

    const articlesArray = lawArticlesStr
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    try {
      const res = await fetch('/api/premium/admin/rag-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('softcontable_token')}`
        },
        body: JSON.stringify({
          id: selectedItem ? selectedItem.id : undefined,
          pillar,
          moduleKey,
          title,
          lawArticles: articlesArray,
          calculationMethodology,
          customPromptRules
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(selectedItem ? 'Regla RAG actualizada.' : 'Regla RAG guardada.');
        setShowModal(false);
        loadData();
      } else {
        toast.error(data.error || 'Error guardando regla RAG.');
      }
    } catch (err: any) {
      toast.error('Error de conexión: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro de eliminar esta regla RAG normativo?')) return;
    try {
      const res = await fetch(`/api/premium/admin/rag-knowledge/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('softcontable_token')}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Regla RAG eliminada.');
        loadData();
      } else {
        toast.error(data.error || 'Error al eliminar.');
      }
    } catch (e: any) {
      toast.error('Error al eliminar: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 bg-app-surface/40 rounded-2xl border border-app-border">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-black text-app-text flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" /> Base de Conocimiento RAG SoftPremium (Groq + IA)
          </h3>
          <p className="text-xs text-app-muted font-medium">
            Agrega o edita artículos de ley, jurisprudencia y metodologías de cálculo para alimentar las inferencias de Groq AI en los 3 Pilares (Tributario, Planillas y Finanzas).
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all"
        >
          <Plus size={14} /> Nueva Regla Normativa RAG
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-app-muted font-bold">Cargando base de conocimiento RAG...</div>
      ) : items.length === 0 ? (
        <div className="p-8 bg-app-bg border border-app-border rounded-xl text-center space-y-2">
          <p className="text-xs text-app-muted font-bold">No hay reglas RAG personalizadas ingresadas en la base de datos.</p>
          <p className="text-[11px] text-app-muted">SoftPremium utilizará automáticamente la base de conocimiento normativa estándar del sistema.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            let articles = item.law_articles;
            if (typeof articles === 'string') {
              try { articles = JSON.parse(articles); } catch (e) {}
            }
            return (
              <div key={item.id} className="bg-app-bg border border-app-border rounded-xl p-4 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      Pilar: {item.pillar} | Módulo: {item.module_key}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenModal(item)} className="p-1 text-app-muted hover:text-blue-500 hover:bg-app-hover rounded">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-app-muted hover:text-rose-500 hover:bg-rose-500/10 rounded">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-xs font-black text-app-text">{item.title}</h4>
                  {Array.isArray(articles) && articles.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-app-muted uppercase">Leyes &amp; Artículos Base:</div>
                      <ul className="text-[11px] text-app-text space-y-0.5 pl-3 list-disc">
                        {articles.map((art: string, i: number) => (
                          <li key={i}>{art}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.calculation_methodology && (
                    <div className="text-[11px] text-app-muted font-medium bg-app-surface p-2 rounded border border-app-border">
                      <strong>Metodología:</strong> {item.calculation_methodology}
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-app-muted text-right font-mono">
                  Actualizado: {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-app-surface border border-app-border max-w-xl w-full rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-app-border pb-3">
              <h3 className="text-sm font-black text-app-text flex items-center gap-2">
                <Database size={14} className="text-blue-500" />
                {selectedItem ? 'Editar Regla RAG SoftPremium' : 'Nueva Regla RAG SoftPremium'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-app-muted hover:text-app-text rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-app-muted mb-1 block">Pilar Contable</label>
                  <select
                    value={pillar}
                    onChange={(e: any) => setPillar(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-2 text-xs font-bold text-app-text outline-none"
                  >
                    <option value="tributario">1. Tributación RAG</option>
                    <option value="planillas">2. Planillas RAG</option>
                    <option value="finanzas">3. Finanzas RAG</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-app-muted mb-1 block">Módulo Específico</label>
                  <input
                    type="text"
                    placeholder="Ej. ratio_compras_ventas o 'all'"
                    value={moduleKey}
                    onChange={(e) => setModuleKey(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl p-2 text-xs font-bold text-app-text outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-app-muted mb-1 block">Título de la Norma o Regla</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Criterio de Fehaciencia de Gastos en Servicios Digitales 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs font-bold text-app-text outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-app-muted mb-1 block">Artículos de Ley y RTF (Un artículo por línea)</label>
                <textarea
                  rows={4}
                  placeholder="Ej:&#10;TUO Ley del IGV (D.S. 055-99-EF, Art. 18) — Requisitos del Crédito Fiscal.&#10;RTF N° 01245-1-2021 — Sustento de fehaciencia."
                  value={lawArticlesStr}
                  onChange={(e) => setLawArticlesStr(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2.5 text-xs font-medium text-app-text outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-app-muted mb-1 block">Metodología de Cálculo / Algoritmo</label>
                <input
                  type="text"
                  placeholder="Ej. Cobertura = (Ventas - Compras) / Ventas x 100"
                  value={calculationMethodology}
                  onChange={(e) => setCalculationMethodology(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2 text-xs font-bold text-app-text outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-app-muted mb-1 block">Reglas Adicionales de Inferencia para Groq AI</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Recomendar siempre verificar el RUC en el portal de SUNAT antes de proceder con la deducción."
                  value={customPromptRules}
                  onChange={(e) => setCustomPromptRules(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl p-2 text-xs font-medium text-app-text outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-app-bg border border-app-border text-app-text rounded-xl text-xs font-bold hover:bg-app-hover"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md"
                >
                  {selectedItem ? 'Guardar Cambios' : 'Crear Regla RAG'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const AIKnowledgeView: React.FC = () => {
  const [ragSubTab, setRagSubTab] = useState<'ASIENTOS_RAG' | 'SOFTPREMIUM_RAG'>('ASIENTOS_RAG');
  const [cases, setCases] = useState<AIKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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
    if (isExpanded) {
      loadCases();
    }
  }, [isExpanded, filters.sector, filters.regimen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExpanded(true);
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

      {/* Selector de Apartados RAG */}
      <div className="bg-app-surface border-b border-app-border px-6 py-2.5 flex items-center justify-start gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setRagSubTab('ASIENTOS_RAG')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            ragSubTab === 'ASIENTOS_RAG'
              ? 'bg-blue-600 text-white shadow-md font-extrabold'
              : 'text-app-muted hover:text-app-text hover:bg-app-hover'
          }`}
        >
          <BrainCircuit className="w-4 h-4" /> 1. Asientos Contables RAG (SaaS)
        </button>

        <button
          onClick={() => setRagSubTab('SOFTPREMIUM_RAG')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            ragSubTab === 'SOFTPREMIUM_RAG'
              ? 'bg-blue-600 text-white shadow-md font-extrabold'
              : 'text-app-muted hover:text-app-text hover:bg-app-hover'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" /> 2. RAG SoftPremium Normativo (Groq + IA)
        </button>
      </div>

      {ragSubTab === 'SOFTPREMIUM_RAG' ? (
        <div className="p-6">
          <SoftPremiumRAGManager />
        </div>
      ) : (
        <>
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
            onChange={e => { setFilters({ ...filters, sector: e.target.value }); setIsExpanded(true); }}
          >
            <option value="">TODOS LOS SECTORES</option>
            <option value="COMERCIAL">COMERCIAL</option>
            <option value="INDUSTRIAL">INDUSTRIAL</option>
            <option value="SERVICIOS">SERVICIOS</option>
          </select>

          <select
            className="text-xs bg-app-bg border border-app-border rounded-xl px-3 py-2.5 font-bold text-app-text min-w-[140px]"
            value={filters.regimen}
            onChange={e => { setFilters({ ...filters, regimen: e.target.value }); setIsExpanded(true); }}
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
        {!isExpanded ? (
          <div className="max-w-2xl mx-auto my-12 bg-app-surface border border-app-border/60 rounded-2xl p-8 text-center shadow-lg animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-6 bg-pld-blue/10 rounded-full flex items-center justify-center text-pld-blue">
              <Database size={32} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-app-text mb-2">Base de Conocimiento RAG</h3>
            <p className="text-xs text-app-muted leading-relaxed mb-6">
              El motor de Inferencia Generativa Aumentada por Recuperación (RAG) guía a la Inteligencia Artificial mediante plantillas y reglas contables validadas del PCGE. Expande la base de datos para visualizar, editar o sembrar nuevos templates contables.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsExpanded(true)}
              className="bg-pld-blue hover:opacity-95 font-bold uppercase tracking-wider text-xs px-8 py-3 mx-auto"
            >
              Cargar Base de Datos RAG
            </Button>
          </div>
        ) : loading ? (
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
      </>
      )}
    </div>
  );
};
