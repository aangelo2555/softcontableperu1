import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import PageHeader from './ui/PageHeader';
import { webApiBridge } from '../services/apiBridge';
import { 
  Users, 
  MessageSquare, 
  Database, 
  Eye, 
  CheckCircle, 
  Calendar, 
  Building, 
  BrainCircuit, 
  Search, 
  Maximize2,
  X,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  RefreshCw
} from 'lucide-react';

// --- Subcomponente de Gestión de Base de Conocimiento IA ---
const AIKnowledgeManager: React.FC = () => {
  const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [sectorFilter, setSectorFilter] = useState('');
  const [regimenFilter, setRegimenFilter] = useState('');
  const [search, setSearch] = useState('');
  
  // State del modal de creación/edición
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  
  const [formValues, setFormValues] = useState({
    sector: 'COMERCIAL',
    regimen: 'RG',
    niif_norma: '',
    categoria: 'GENERAL',
    premisa: '',
    glosa: '',
    asiento_json: '',
    explicacion: '',
    tags: ''
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await webApiBridge.aiGetKnowledge({
        sector: sectorFilter || undefined,
        regimen: regimenFilter || undefined,
        search: search || undefined
      });
      if (res.success) {
        setKnowledgeList(res.data || []);
      }
    } catch (error: any) {
      console.error('Error al cargar base de conocimiento:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sectorFilter, regimenFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleSeed = async () => {
    if (!window.confirm('¿Estás seguro de que deseas precargar los 15 templates por defecto? Esto inicializará la base de datos con casos prácticos.')) return;
    try {
      setSeeding(true);
      setErrorMsg(null);
      const res = await webApiBridge.aiSeedKnowledge();
      if (res.success) {
        setSuccessMsg('¡Templates cargados con éxito!');
        loadData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'No se pudieron precargar los templates.');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error de comunicación con el servidor.');
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedItem(null);
    setFormValues({
      sector: 'COMERCIAL',
      regimen: 'RG',
      niif_norma: '',
      categoria: 'GENERAL',
      premisa: '',
      glosa: '',
      asiento_json: JSON.stringify([
        { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS", debe: 1000, haber: 0 },
        { cuenta: "1212", detalle: "EMITIDAS EN CARTERA", debe: 0, haber: 1000 }
      ], null, 2),
      explicacion: '',
      tags: ''
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setSelectedItem(item);
    setFormValues({
      sector: item.sector || 'COMERCIAL',
      regimen: item.regimen || 'RG',
      niif_norma: item.niif_norma || '',
      categoria: item.categoria || 'GENERAL',
      premisa: item.premisa || '',
      glosa: item.glosa || '',
      asiento_json: typeof item.asiento_json === 'string' 
        ? item.asiento_json 
        : JSON.stringify(item.asiento_json || [], null, 2),
      explicacion: item.explicacion || '',
      tags: item.tags || ''
    });
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este caso práctico?')) return;
    try {
      const res = await webApiBridge.aiDeleteKnowledge(id);
      if (res.success) {
        setSuccessMsg('Caso práctico eliminado.');
        loadData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(res.error || 'No se pudo eliminar el caso.');
      }
    } catch (error: any) {
      alert(error.message || 'Error de conexión.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validar JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(formValues.asiento_json);
      if (!Array.isArray(parsedJson)) {
        throw new Error('El asiento contable debe ser un array de objetos con cuenta, detalle, debe, haber.');
      }
    } catch (err: any) {
      setErrorMsg('Error de formato JSON: ' + err.message);
      return;
    }

    try {
      const payload = {
        ...formValues,
        asiento_json: parsedJson
      };

      let res;
      if (selectedItem) {
        res = await webApiBridge.aiUpdateKnowledge(selectedItem.id, payload);
      } else {
        res = await webApiBridge.aiSaveKnowledge(payload);
      }

      if (res.success) {
        setSuccessMsg(selectedItem ? 'Caso actualizado.' : 'Nuevo caso guardado.');
        setShowModal(false);
        loadData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'Error al guardar el caso contable.');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error de red.');
    }
  };

  const loadTemplate = () => {
    setFormValues(prev => ({
      ...prev,
      asiento_json: JSON.stringify([
        { cuenta: "60111", detalle: "MERCADERÍAS - COSTO", debe: 1000, haber: 0 },
        { cuenta: "40111", detalle: "IGV - CUENTA PROPIA", debe: 180, haber: 0 },
        { cuenta: "4212", detalle: "EMITIDAS EN CARTERA", debe: 0, haber: 1180 }
      ], null, 2)
    }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden gap-4">
      {/* Cabecera y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-app-surface border border-app-border p-4 rounded-2xl shadow-sm shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 bg-app-bg border border-app-border px-3 py-1.5 rounded-xl max-w-sm w-full">
          <Search size={14} className="text-app-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por premisa, tags o glosa..."
            className="bg-transparent border-none text-[11px] font-bold outline-none text-app-text w-full placeholder:text-app-muted/50"
          />
          {search && (
            <button type="button" onClick={() => { setSearch(''); setTimeout(loadData, 50); }} className="text-app-muted hover:text-app-text">
              <X size={12} />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="h-8 px-3 bg-app-bg border border-app-border rounded-lg text-[10px] font-black uppercase text-app-text outline-none"
          >
            <option value="">Todos los sectores</option>
            <option value="COMERCIAL">Comercial</option>
            <option value="INDUSTRIAL">Industrial</option>
            <option value="SERVICIOS">Servicios</option>
          </select>

          <select
            value={regimenFilter}
            onChange={(e) => setRegimenFilter(e.target.value)}
            className="h-8 px-3 bg-app-bg border border-app-border rounded-lg text-[10px] font-black uppercase text-app-text outline-none"
          >
            <option value="">Todos los regímenes</option>
            <option value="RG">Régimen General (RG)</option>
            <option value="MYPE">Tributario MYPE (RMT)</option>
            <option value="RER">Especial (RER)</option>
            <option value="NRUS">Único Simplificado (RUS)</option>
          </select>

          <button
            onClick={handleSeed}
            disabled={seeding}
            className="h-8 px-3 bg-app-bg border border-app-border hover:bg-app-hover rounded-lg text-[10px] font-black uppercase text-app-text flex items-center gap-1.5 transition-colors disabled:opacity-55 cursor-pointer"
          >
            <RefreshCw size={11} className={seeding ? 'animate-spin' : ''} />
            Precargar 15 Casos
          </button>

          <button
            onClick={handleOpenCreate}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-black uppercase text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-blue-600/10"
          >
            <Plus size={12} />
            Nuevo Caso IA
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="mx-6 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-xs font-bold animate-fade-in shrink-0">
          {successMsg}
        </div>
      )}

      {/* Lista de Casos */}
      <div className="flex-1 overflow-y-auto custom-scrollbar border border-app-border bg-app-surface rounded-2xl shadow-sm pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-app-muted">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider">Cargando base de conocimiento...</span>
          </div>
        ) : knowledgeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-app-muted">
            <Database size={28} className="text-app-muted/40" />
            <span className="text-xs font-bold uppercase tracking-wider">No hay casos prácticos registrados.</span>
            <button onClick={handleSeed} className="text-blue-500 hover:underline text-xs font-bold mt-2">
              Precargar templates iniciales ahora
            </button>
          </div>
        ) : (
          <div className="responsive-table-container">
            <table className="w-full text-left text-xs font-semibold text-app-text min-w-[950px]">
              <thead className="bg-app-bg border-b border-app-border text-[10px] font-black uppercase text-app-muted tracking-widest sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 md:px-6 md:py-4">Sector / Régimen</th>
                  <th className="px-4 py-3 md:px-6 md:py-4">Categoría / NIIF</th>
                  <th className="px-4 py-3 md:px-6 md:py-4 w-[35%]">Premisa / Descripción</th>
                  <th className="px-4 py-3 md:px-6 md:py-4">Asiento Resultante (Cuentas)</th>
                  <th className="px-4 py-3 md:px-6 md:py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {knowledgeList.map((item) => {
                  let lines: any[] = [];
                  try {
                    lines = typeof item.asiento_json === 'string' ? JSON.parse(item.asiento_json) : item.asiento_json || [];
                  } catch {}

                  return (
                    <tr key={item.id} className="hover:bg-app-hover">
                      <td className="px-4 py-3 md:px-6 md:py-4 font-bold text-app-text">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/10 text-blue-600 mr-2">
                          {item.sector}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-purple-500/10 text-purple-600">
                          {item.regimen}
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 font-bold text-app-text">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-black tracking-wider text-app-muted">{item.categoria}</span>
                          {item.niif_norma && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded w-max">
                              {item.niif_norma}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 font-semibold text-app-text leading-relaxed">
                        <div className="font-bold text-app-text mb-1">{item.glosa}</div>
                        <div className="text-[11px] text-app-muted font-medium">{item.premisa}</div>
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4">
                        {expandedRows.has(item.id) ? (
                          <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto custom-scrollbar">
                            <button
                              type="button"
                              onClick={() => {
                                const next = new Set(expandedRows);
                                next.delete(item.id);
                                setExpandedRows(next);
                              }}
                              className="text-[9px] font-black uppercase text-red-500 hover:underline mb-1.5 text-left flex items-center gap-0.5"
                            >
                              Ocultar Asiento ▲
                            </button>
                            {lines.map((l: any, i: number) => (
                              <div key={i} className="text-[10px] font-mono flex items-center gap-1">
                                <span className="font-bold text-pld-blue">{l.cuenta}</span>
                                <span className="text-app-muted truncate max-w-[80px]">({l.detalle})</span>
                                {l.debe > 0 && <span className="text-emerald-500 font-bold ml-auto">D: {l.debe}</span>}
                                {l.haber > 0 && <span className="text-rose-500 font-bold ml-auto">H: {l.haber}</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(expandedRows);
                              next.add(item.id);
                              setExpandedRows(next);
                            }}
                            className="bg-pld-blue/10 hover:bg-pld-blue/20 text-pld-blue px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            Ver Asiento ({lines.length} ctas) ▼
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-app-muted hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Editar caso contable"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-app-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar caso"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para Crear / Editar Caso */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-app-surface border border-app-border max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-up">
            {/* Header del modal */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-app-border shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase text-app-text flex items-center gap-2">
                  <Sparkles size={14} className="text-blue-500 animate-pulse" />
                  {selectedItem ? 'Modificar Caso Contable IA' : 'Nuevo Caso Práctico IA'}
                </h3>
                <p className="text-[10px] font-semibold text-app-muted mt-0.5">Alimenta la base de RAG para guiar las inferencias de la IA.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-app-muted hover:text-app-text p-1 hover:bg-app-hover rounded-lg">
                <X size={16} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-4">
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-bold leading-relaxed shrink-0">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Sector de Empresa</label>
                  <select
                    value={formValues.sector}
                    onChange={(e) => setFormValues(prev => ({ ...prev, sector: e.target.value }))}
                    className="w-full h-9 bg-app-bg border border-app-border px-3 rounded-lg text-xs font-bold text-app-text outline-none focus:border-blue-500"
                  >
                    <option value="COMERCIAL">Comercial</option>
                    <option value="INDUSTRIAL">Industrial</option>
                    <option value="SERVICIOS">Servicios</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Régimen Tributario</label>
                  <select
                    value={formValues.regimen}
                    onChange={(e) => setFormValues(prev => ({ ...prev, regimen: e.target.value }))}
                    className="w-full h-9 bg-app-bg border border-app-border px-3 rounded-lg text-xs font-bold text-app-text outline-none focus:border-blue-500"
                  >
                    <option value="RG">Régimen General (RG)</option>
                    <option value="MYPE">Tributario MYPE (RMT)</option>
                    <option value="RER">Especial (RER)</option>
                    <option value="NRUS">Único Simplificado (RUS)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 shrink-0">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Categoría Operación</label>
                  <input
                    type="text"
                    required
                    value={formValues.categoria}
                    onChange={(e) => setFormValues(prev => ({ ...prev, categoria: e.target.value.toUpperCase() }))}
                    placeholder="E.g. COMPRAS, VENTAS, PLANILLAS"
                    className="w-full h-9 bg-app-bg border border-app-border px-3 rounded-lg text-xs font-bold text-app-text outline-none focus:border-blue-500 placeholder:text-app-muted/30"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Norma Contable NIIF (Opcional)</label>
                  <input
                    type="text"
                    value={formValues.niif_norma}
                    onChange={(e) => setFormValues(prev => ({ ...prev, niif_norma: e.target.value }))}
                    placeholder="E.g. NIIF 15, NIC 2"
                    className="w-full h-9 bg-app-bg border border-app-border px-3 rounded-lg text-xs font-bold text-app-text outline-none focus:border-blue-500 placeholder:text-app-muted/30"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Glosa / Concepto del Asiento</label>
                <input
                  type="text"
                  required
                  value={formValues.glosa}
                  onChange={(e) => setFormValues(prev => ({ ...prev, glosa: e.target.value }))}
                  placeholder="Concepto simplificado o título del caso contable..."
                  className="w-full h-9 bg-app-bg border border-app-border px-3 rounded-lg text-xs font-bold text-app-text outline-none focus:border-blue-500 placeholder:text-app-muted/30"
                />
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Premisa / Enunciado Práctico</label>
                <textarea
                  required
                  rows={2}
                  value={formValues.premisa}
                  onChange={(e) => setFormValues(prev => ({ ...prev, premisa: e.target.value }))}
                  placeholder="Enunciado detallado: 'Venta de mercaderías por S/ 10,000 en efectivo más IGV...'"
                  className="w-full bg-app-bg border border-app-border p-3 rounded-lg text-xs font-medium text-app-text outline-none focus:border-blue-500 placeholder:text-app-muted/30 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Estructura del Asiento (Array JSON)</label>
                  <button
                    type="button"
                    onClick={loadTemplate}
                    className="text-[9px] font-bold text-blue-500 hover:underline"
                  >
                    Cargar plantilla básica
                  </button>
                </div>
                <textarea
                  required
                  rows={5}
                  value={formValues.asiento_json}
                  onChange={(e) => setFormValues(prev => ({ ...prev, asiento_json: e.target.value }))}
                  className="w-full bg-app-bg border border-app-border p-3 rounded-lg font-mono text-[10px] text-app-text outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Explicación Tributaria / Contable (Opcional)</label>
                <textarea
                  rows={2}
                  value={formValues.explicacion}
                  onChange={(e) => setFormValues(prev => ({ ...prev, explicacion: e.target.value }))}
                  placeholder="Detalles sobre el porqué de las cuentas, destinos, etc."
                  className="w-full bg-app-bg border border-app-border p-3 rounded-lg text-xs font-medium text-app-text outline-none focus:border-blue-500 placeholder:text-app-muted/30 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-[9px] font-black uppercase tracking-wider text-app-muted">Tags (Separados por comas)</label>
                <input
                  type="text"
                  value={formValues.tags}
                  onChange={(e) => setFormValues(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="E.g. igv, venta, anticipo, detraccion"
                  className="w-full h-9 bg-app-bg border border-app-border px-3 rounded-lg text-xs font-bold text-app-text outline-none focus:border-blue-500 placeholder:text-app-muted/30"
                />
              </div>

              {/* Botones de acción del formulario */}
              <div className="flex justify-end gap-3 pt-4 border-t border-app-border mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-app-bg border border-app-border hover:bg-app-hover text-app-text rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md shadow-blue-600/10"
                >
                  {selectedItem ? 'Guardar Cambios' : 'Registrar Caso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminView: React.FC = () => {
  const { 
    adminSuggestions, 
    adminUsers, 
    loadAdminSuggestions, 
    loadAdminUsers, 
    resolveAdminSuggestion, 
    startInspectingWorkspace 
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<'BUZON' | 'USUARIOS' | 'CONOCIMIENTO_IA'>('BUZON');
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    loadAdminSuggestions();
    loadAdminUsers();
  }, []);

  // Cálculos estadísticos
  const totalUsers = adminUsers.length;
  const pendingSuggestionsCount = adminSuggestions.filter(s => s.status === 'PENDIENTE').length;
  const totalWorkspaces = adminUsers.reduce((acc, u) => acc + (u.workspaceCount || 0), 0);
  const totalEntries = adminUsers.reduce((acc, u) => acc + (u.purchaseCount || 0) + (u.saleCount || 0) + (u.journalCount || 0), 0);

  // Filtrar sugerencias
  const sortedSuggestions = [...adminSuggestions].sort((a, b) => {
    if (a.status === 'PENDIENTE' && b.status !== 'PENDIENTE') return -1;
    if (a.status !== 'PENDIENTE' && b.status === 'PENDIENTE') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Filtrar usuarios
  const filteredUsers = adminUsers.filter(u => 
    u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'ERROR_CALCULO':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/10 text-red-500 border border-red-500/20">Cálculo</span>;
      case 'INCONSISTENCIA_TRIBUTARIA':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">SUNAT</span>;
      case 'INTERFAZ_USUARIO':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/10 text-purple-500 border border-purple-500/20">Diseño</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">Otro</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PENDIENTE') {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">Pendiente</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Resuelto</span>;
  };

  const parseSystemState = (stateStr: string) => {
    try {
      return JSON.parse(stateStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<ShieldCheck size={18} />}
        title="Panel de Administración"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-[9px] text-blue-500 border border-blue-500/20 tracking-[0.2em] uppercase">
            CONTROL ADMIN
          </span>
        }
        subtitle="Supervisa usuarios registrados, diagnostica incidentes y audita lógicas contables."
        actions={
          <div className="flex bg-app-bg p-1 rounded-xl border border-app-border shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => setActiveSubTab('BUZON')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeSubTab === 'BUZON' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <MessageSquare size={12} />
              Buzón Inteligente
              {pendingSuggestionsCount > 0 && (
                <span className="bg-rose-500 text-white font-bold text-[9px] h-3.5 min-w-3.5 px-1 rounded-full flex items-center justify-center">
                  {pendingSuggestionsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('USUARIOS')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeSubTab === 'USUARIOS' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <Users size={12} />
              Usuarios & Auditoría
            </button>
            <button
              onClick={() => setActiveSubTab('CONOCIMIENTO_IA')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeSubTab === 'CONOCIMIENTO_IA' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <BrainCircuit size={12} />
              Base de IA
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1600px] mx-auto p-6 flex flex-col gap-6">
 
      {/* Tarjetas de Estadísticas Globales (Ocultas al expandir un reporte para maximizar el espacio vertical) */}
      {!selectedSuggestion && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Usuarios</span>
              <span className="text-2xl font-black text-app-text">{totalUsers}</span>
              <span className="text-[9px] font-semibold text-app-muted/80">En base de datos</span>
            </div>
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-500 rounded-xl">
              <Users size={18} />
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Pendientes</span>
              <span className="text-2xl font-black text-rose-500">{pendingSuggestionsCount}</span>
              <span className="text-[9px] font-semibold text-app-muted/80">Por resolver</span>
            </div>
            <div className="p-2.5 bg-rose-600/10 border border-rose-500/20 text-rose-500 rounded-xl">
              <MessageSquare size={18} />
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Empresas</span>
              <span className="text-2xl font-black text-emerald-600">{totalWorkspaces}</span>
              <span className="text-[9px] font-semibold text-app-muted/80">Configuradas</span>
            </div>
            <div className="p-2.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 rounded-xl">
              <Building size={18} />
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-app-muted">Registros</span>
              <span className="text-2xl font-black text-indigo-600">{totalEntries}</span>
              <span className="text-[9px] font-semibold text-app-muted/80">Operaciones cargadas</span>
            </div>
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 rounded-xl">
              <Database size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Contenido de la Vista Activa */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSubTab === 'BUZON' ? (
          
          /* --- BUZÓN INTELIGENTE --- */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Vista A: Si no hay sugerencia seleccionada, mostramos la lista en ancho completo */}
            {!selectedSuggestion ? (
              <div className="flex-1 flex flex-col overflow-hidden gap-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-app-muted flex items-center gap-2 shrink-0">
                  📂 Reportes Recibidos
                </h2>
                
                {sortedSuggestions.length === 0 ? (
                  <div className="bg-app-surface border border-app-border rounded-2xl p-8 text-center text-app-muted font-semibold text-xs shadow-sm">
                    No hay sugerencias registradas.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortedSuggestions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSuggestion(s)}
                          className="p-4 border border-app-border bg-app-surface hover:border-blue-500 hover:shadow-md transition-all cursor-pointer rounded-2xl flex flex-col gap-2.5 text-app-text min-h-[140px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {getCategoryBadge(s.id.startsWith('sug-') ? 'ERROR_CALCULO' : 'OTRO')}
                              {getStatusBadge(s.status)}
                            </div>
                            <span className="text-[10px] font-bold text-app-muted flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(s.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <p className="text-xs font-bold leading-relaxed line-clamp-3">
                            {s.user_comment}
                          </p>

                          <div className="flex items-center justify-between gap-2 border-t border-app-border pt-2 text-[10px] font-semibold text-app-muted mt-auto">
                            <span className="truncate max-w-[150px]">{s.user_email}</span>
                            <span className="text-blue-600 dark:text-blue-400 font-bold">{s.view_context}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Vista B: Si hay sugerencia seleccionada, expande el reporte a ancho completo (12 columnas) y retrae las tarjetas */
              <div className="flex-1 flex flex-col overflow-hidden gap-4">
                
                {/* Botón para volver y retraer la visualización (Respetando el tema nativo) */}
                <div className="flex justify-between items-center bg-app-surface border border-app-border px-4 py-2.5 rounded-2xl shadow-sm shrink-0">
                  <button
                    onClick={() => setSelectedSuggestion(null)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-app-bg hover:bg-app-hover text-app-text border border-app-border rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                  >
                    <X size={14} />
                    Cerrar Detalle
                  </button>
                  <div className="text-[10px] font-bold text-app-muted uppercase tracking-widest">
                    Visualizando Incidencia ID: <span className="text-blue-600 font-black">{selectedSuggestion.id}</span>
                  </div>
                </div>

                {/* Contenedor del Detalle que escala de forma exacta y se desplaza internamente */}
                <div className="flex-1 min-h-0 bg-app-surface border border-app-border rounded-2xl p-6 pb-24 flex flex-col gap-6 shadow-sm overflow-y-auto">
                  
                  {/* Cabecera del Detalle */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start border-b border-app-border pb-4 shrink-0 gap-3">
                    <div>
                      <h3 className="text-lg font-black text-app-text">{selectedSuggestion.workspace_name || 'Sin empresa'}</h3>
                      <p className="text-xs font-bold text-app-muted uppercase tracking-widest mt-1">
                        RUC: <span className="text-app-text">{selectedSuggestion.workspace_ruc || 'N/A'}</span> • Pestaña: <span className="text-blue-600 dark:text-blue-400">{selectedSuggestion.view_context}</span>
                      </p>
                    </div>
                    
                    {selectedSuggestion.status === 'PENDIENTE' && (
                      <button
                        onClick={() => resolveAdminSuggestion(selectedSuggestion.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        <CheckCircle size={14} />
                        Resolver Incidencia
                      </button>
                    )}
                  </div>

                  {/* Comentario del Usuario */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-app-muted">Reporte del Usuario</span>
                    <div className="bg-app-bg border border-app-border rounded-xl p-4 text-xs font-bold text-app-text leading-relaxed">
                      {selectedSuggestion.user_comment}
                    </div>
                    <span className="text-[10px] text-app-muted font-medium">Enviado por: {selectedSuggestion.user_email}</span>
                  </div>

                  {/* Imagen Adjunta si Existe */}
                  {selectedSuggestion.image_base64 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-app-muted">Evidencia / Captura Adjunta</span>
                      <div className="relative group max-w-sm rounded-xl overflow-hidden border border-app-border bg-app-bg p-2">
                        <img 
                          src={selectedSuggestion.image_base64} 
                          alt="Evidencia adjunta" 
                          className="w-full h-auto rounded-lg object-contain max-h-[220px]"
                        />
                        <div 
                          onClick={() => setZoomedImage(selectedSuggestion.image_base64)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-white font-bold text-xs"
                        >
                          <Maximize2 size={16} />
                          Ver a Pantalla Completa
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Datos del Estado Técnico */}
                  {selectedSuggestion.system_state && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-app-muted">Datos Técnicos del Formulario</span>
                      <div className="bg-app-bg border border-app-border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        {Object.entries(parseSystemState(selectedSuggestion.system_state) || {}).map(([key, val]: any) => (
                          <div key={key} className="bg-app-surface border border-app-border p-2.5 rounded-lg shadow-sm">
                            <span className="text-[8px] font-black text-app-muted uppercase tracking-widest block truncate">{key}</span>
                            <span className="text-xs font-bold text-app-text mt-1 block truncate">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diagnóstico Contable IA */}
                  {selectedSuggestion.ai_analysis && (
                    <div className="bg-gradient-to-br from-app-surface to-blue-500/5 border border-blue-500/20 rounded-xl p-5 flex flex-col gap-3 shadow-sm mb-6">
                      <div className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        <BrainCircuit size={16} className="text-blue-500 dark:text-blue-400 animate-pulse" />
                        Análisis Contable Inteligente
                      </div>
                      <div className="text-[11px] text-app-text font-semibold leading-relaxed whitespace-pre-line border-t border-app-border pt-3">
                        {selectedSuggestion.ai_analysis}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>

        ) : activeSubTab === 'USUARIOS' ? (
          
          /* --- AUDITORÍA Y USUARIOS --- */
          <div className="flex-1 flex flex-col overflow-hidden gap-4">
            
            {/* Barra de búsqueda */}
            <div className="flex items-center gap-4 bg-app-surface border border-app-border px-4 py-2.5 rounded-2xl max-w-md shadow-sm shrink-0">
              <Search size={16} className="text-app-muted" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o correo electrónico..."
                className="bg-transparent border-none text-xs font-bold outline-none text-app-text w-full placeholder:text-app-muted/50"
              />
            </div>

            {/* Tabla de Usuarios en contenedor con scroll interno */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-app-border bg-app-surface rounded-2xl shadow-sm pb-6">
              <div className="responsive-table-container">
                <table className="w-full text-left text-xs font-semibold text-app-text min-w-[900px]">
                <thead className="bg-app-bg border-b border-app-border text-[10px] font-black uppercase text-app-muted tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 md:px-6 md:py-4">Usuario</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Email</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Rol</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-center">Empresas</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-center">Registros (Com/Ven/Dia)</th>
                    <th className="px-4 py-3 md:px-6 md:py-4">Empresas del Usuario (Inspeccionar)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-app-hover">
                      <td className="px-4 py-3 md:px-6 md:py-4 font-bold text-app-text">{u.name}</td>
                      <td className="px-4 py-3 md:px-6 md:py-4 font-semibold text-app-muted">{u.email}</td>
                      <td className="px-4 py-3 md:px-6 md:py-4">
                        {u.role === 'admin' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">ADMIN</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-app-bg text-app-muted border border-app-border">USER</span>
                        )}
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center font-bold text-emerald-600">{u.workspaceCount || 0}</td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-center font-semibold text-app-muted">
                        {u.purchaseCount} / {u.saleCount} / {u.journalCount}
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4">
                        {u.workspaces && u.workspaces.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {u.workspaces.map((w: any) => (
                              <div key={w.ruc} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 bg-app-bg p-2 sm:px-3 sm:py-1.5 rounded-xl border border-app-border">
                                <div className="min-w-0 w-full sm:w-auto">
                                  <span className="text-[10px] font-bold text-app-text block truncate">{w.name}</span>
                                  <span className="text-[9px] font-semibold text-app-muted block">RUC: {w.ruc}</span>
                                </div>
                                <button
                                  onClick={() => startInspectingWorkspace(u.id, w.ruc, w.name)}
                                  className="flex items-center justify-center gap-1 w-full sm:w-auto px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-blue-500/20 transition-all cursor-pointer shrink-0 shadow-sm"
                                >
                                  <Eye size={10} />
                                  Inspeccionar
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-app-muted text-[11px] font-medium">Sin empresas configuradas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

          </div>

        ) : (
          <AIKnowledgeManager />
        )}
      </div>

      {/* Modal Overlay para ver Imagen Ampliada (Fijo en centro con escala máxima y botón Cerrar integrado) */}
      {zoomedImage && (
        <div 
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 cursor-zoom-out animate-fade-in"
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* Fila del Botón para Cerrar (Siempre visible encima de la imagen) */}
            <div className="w-full flex justify-end">
              <button 
                onClick={() => setZoomedImage(null)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md hover:scale-105"
              >
                <X size={14} />
                Cerrar Imagen
              </button>
            </div>
            
            {/* Tarjeta contenedora de la imagen */}
            <div className="bg-slate-900 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-center max-w-full">
              <img 
                src={zoomedImage} 
                alt="Captura ampliada" 
                className="max-h-[70vh] max-w-full object-contain rounded-xl select-none" 
              />
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};
