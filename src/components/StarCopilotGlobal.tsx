import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, X, Send, Bot, RefreshCw, CheckCircle2, AlertTriangle, 
  BookOpen, Scale, ArrowRight, Brain, Zap, ShieldAlert, Copy, Check,
  ChevronDown, ChevronUp, Database, Activity, FileText, Trash2
} from 'lucide-react';
import { webApiBridge } from '../services/apiBridge';
import { useStore } from '../store';
import toast from 'react-hot-toast';

interface StarCopilotGlobalProps {
  activeTab: string;
}

interface StepExecution {
  tool: string;
  args: any;
  timestamp?: Date;
}

interface SuggestedEntry {
  glosa: string;
  lines: Array<{
    cuenta: string;
    detalle?: string;
    debe: number;
    haber: number;
  }>;
}

interface StarMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: StepExecution[];
  suggestedEntry?: SuggestedEntry;
  provider?: string;
  model?: string;
  timestamp: Date;
}

interface StarLearning {
  id: string;
  category: string;
  entity_key: string;
  learned_rule: any;
  confidence_score: number;
  occurrences_count: number;
}

export const StarCopilotGlobal: React.FC<StarCopilotGlobalProps> = ({ activeTab }) => {
  const { currentCompany, saveAsiento, getNextAsientoNumber } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'chat' | 'memory' | 'audit'>('chat');
  const [messages, setMessages] = useState<StarMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `¡Hola! Soy **STAR**, tu Copilot de Inteligencia Artificial y Auto-Aprendizaje para **SOFTCONTABLE**.
      
Tengo acceso en tiempo real a todas las hojas del sistema (**Compras, Ventas, Diario, Mayor, PCGE, Planillas, Kárdex, Balances y Tesorería**).

¿En qué puedo asistirte hoy?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<{ [msgId: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [learnings, setLearnings] = useState<StarLearning[]>([]);
  const [loadingLearnings, setLoadingLearnings] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<{ dailyUsed: number; dailyLimit: number; planName?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const companyRuc = currentCompany?.ruc || 'default';
  const companyName = currentCompany?.name || 'Mi Empresa';

  // Atajo de teclado global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cargar aprendizajes de la empresa al abrir o cambiar de empresa
  useEffect(() => {
    if (companyRuc && isOpen && activeViewTab === 'memory') {
      loadLearnings();
    }
  }, [companyRuc, isOpen, activeViewTab]);

  const loadLearnings = async () => {
    if (!companyRuc || companyRuc === 'default') return;
    setLoadingLearnings(true);
    try {
      const res = await webApiBridge.starGetLearnings(companyRuc);
      if (res.success && Array.isArray(res.learnings)) {
        setLearnings(res.learnings);
      }
    } catch (e) {
      console.warn('[STAR] Error cargando aprendizajes:', e);
    } finally {
      setLoadingLearnings(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: StarMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historyForApi = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await webApiBridge.starChat({
        query,
        conversationId: conversationId || undefined,
        workspaceId: companyRuc,
        activeTab,
        period: currentCompany?.period || new Date().toISOString().slice(0, 7),
        currentCompany,
        history: historyForApi
      });

      if (res.success) {
        if (res.conversationId) setConversationId(res.conversationId);
        if (res.quota) setQuotaInfo(res.quota);

        const assistantMsg: StarMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          steps: res.steps,
          suggestedEntry: res.suggestedEntry,
          provider: res.provider,
          model: res.model,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMsg]);
      } else {
        toast.error(res.error || 'Error procesando consulta con STAR.', { duration: 5000 });
      }
    } catch (e: any) {
      const quotaErrMsg = e.response?.data?.error || e.message;
      toast.error(quotaErrMsg, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await webApiBridge.starAuditSheet({
        workspaceId: companyRuc,
        activeTab,
        period: currentCompany?.period || new Date().toISOString().slice(0, 7),
        currentCompany
      });

      if (res.success && res.audit) {
        const auditText = `📋 **Resultado de Auditoría Cruzada — Periodo ${res.period}**
        
• **Ventas Totales**: S/ ${res.audit.metricasGenerales?.ventasTotales || '0.00'}
• **Compras Totales**: S/ ${res.audit.metricasGenerales?.comprasTotales || '0.00'}
• **IGV Estimado a Pagar**: S/ ${res.audit.metricasGenerales?.igvEstimadoPagar || '0.00'}
• **Ratio Compras/Ventas**: ${res.audit.metricasGenerales?.ratioComprasVentas || '0.0%'}

🚨 **Observaciones Detectadas**:
• Compras $\\ge$ S/ 2,000 en efectivo (Riesgo Ley 28194): **${res.audit.observacionesCriticas?.comprasSinBancarizarMayor2000 || 0} comprobantes** (Monto en riesgo: S/ ${res.audit.observacionesCriticas?.montoRiesgoBancarizacion || '0.00'})
• Asientos descuadrados en Libro Diario: **${res.audit.observacionesCriticas?.asientosDescuadradosDiario || 0}**`;

        const auditMsg: StarMessage = {
          id: `aud_${Date.now()}`,
          role: 'assistant',
          content: auditText,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, auditMsg]);
        toast.success('Auditoría completada.');
      }
    } catch (e: any) {
      toast.error('Error en auditoría rápida: ' + e.message);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleApplySuggestedEntry = async (entry: SuggestedEntry) => {
    if (!entry || !entry.lines || entry.lines.length === 0) return;

    try {
      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const numAsiento = getNextAsientoNumber ? getNextAsientoNumber() : `STAR-${Date.now().toString().slice(-4)}`;

      const header = {
        asiento: numAsiento,
        fecEmi: now.toISOString().slice(0, 10),
        glosa: entry.glosa || 'Asiento generado por STAR AI',
        anio: currentYear,
        mes: currentMonth
      };

      const lines = entry.lines.map((l, idx) => ({
        id: idx + 1,
        cuenta: l.cuenta,
        detalle: l.detalle || entry.glosa || '',
        debe: Number(l.debe || 0),
        haber: Number(l.haber || 0)
      }));

      await saveAsiento(header, lines);
      toast.success('¡Asiento contable registrado exitosamente en el Libro Diario!');
    } catch (e: any) {
      toast.error('Error aplicando asiento: ' + e.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copiado al portapapeles');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLearning = async (id: string) => {
    try {
      const res = await webApiBridge.starDeleteLearning(id, companyRuc);
      if (res.success) {
        setLearnings(prev => prev.filter(l => l.id !== id));
        toast.success('Regla eliminada de la memoria.');
      }
    } catch (e: any) {
      toast.error('Error eliminando regla: ' + e.message);
    }
  };

  return (
    <>
      {/* 🌟 Gatillador Flotante Omnipresente (Floating Trigger) */}
      <button
        id="star-copilot-trigger"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2.5 cursor-pointer group border border-white/20"
        title="Abrir STAR AI Copilot (Ctrl + K)"
      >
        <div className="relative">
          <Sparkles size={20} className="animate-spin-slow text-amber-200" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
        </div>
        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1">
            STAR AI
            <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded text-white font-bold">Ctrl+K</span>
          </span>
          <span className="text-[9.5px] text-indigo-100 font-medium leading-none">Copilot Contable</span>
        </div>
      </button>

      {/* 🌟 Panel Modal / Drawer de STAR */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full sm:w-[480px] md:w-[540px] h-[92vh] sm:h-[88vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header de STAR */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-indigo-600 p-0.5 shadow-md flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-300">
                    <Sparkles size={20} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black tracking-wide text-white">STAR AI COPILOT</h3>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Auto-Aprendizaje
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium truncate max-w-[260px]">
                    {companyName} ({companyRuc})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Context Banner Dinámico */}
            <div className="bg-indigo-50/90 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 px-4 py-2 flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200">
              <div className="flex items-center gap-2 truncate">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-indigo-600 dark:text-indigo-400 font-black">📍 Hoja:</span>
                  <span className="font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                    {activeTab}
                  </span>
                </div>
                {quotaInfo && (
                  <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                    <Zap size={10} className="text-amber-500" />
                    <span>{quotaInfo.dailyUsed}/{quotaInfo.dailyLimit} consultas hoy</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleQuickAudit}
                disabled={auditLoading}
                className="text-[11px] font-black text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {auditLoading ? <RefreshCw size={12} className="animate-spin" /> : <Activity size={12} />}
                <span>Auditar Hoja</span>
              </button>
            </div>

            {/* Pestañas Superiores de STAR */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-3 pt-2 gap-1 text-xs">
              <button
                onClick={() => setActiveViewTab('chat')}
                className={`pb-2 px-3 font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${activeViewTab === 'chat' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Bot size={14} /> Chat Inteligente
              </button>
              <button
                onClick={() => setActiveViewTab('memory')}
                className={`pb-2 px-3 font-black transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${activeViewTab === 'memory' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Brain size={14} /> Memoria de mi Empresa ({learnings.length})
              </button>
            </div>

            {/* CUERPO: PESTAÑA CHAT */}
            {activeViewTab === 'chat' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/20">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-bl-none'
                      }`}
                    >
                      {/* Badge de Herramientas Ejecutadas (Hermes Reasoning Visualizer) */}
                      {m.steps && m.steps.length > 0 && (
                        <div className="mb-2.5 border-b border-indigo-100 dark:border-slate-700 pb-2">
                          <button
                            onClick={() => setExpandedSteps(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                            className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Brain size={12} />
                            <span>STAR ejecutó {m.steps.length} {m.steps.length === 1 ? 'herramienta' : 'herramientas'} de lectura</span>
                            {expandedSteps[m.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          {expandedSteps[m.id] && (
                            <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-indigo-400">
                              {m.steps.map((st, sidx) => (
                                <div key={sidx} className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">
                                  ⚡ <strong className="text-indigo-600 dark:text-indigo-400">{st.tool}</strong> {JSON.stringify(st.args)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contenido Principal */}
                      <div className="whitespace-pre-line space-y-1">
                        {m.content}
                      </div>

                      {/* Asiento Sugerido con Botón de Inyección Directa */}
                      {m.suggestedEntry && (
                        <div className="mt-3 p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <Scale size={13} /> Asiento Contable Sugerido
                            </span>
                            <span className="text-[9px] font-bold text-slate-500">{m.suggestedEntry.glosa}</span>
                          </div>
                          
                          <div className="space-y-1 text-[11px] font-mono bg-white dark:bg-slate-900 p-2 rounded-lg border border-amber-100 dark:border-amber-900/40">
                            {m.suggestedEntry.lines.map((l, lidx) => (
                              <div key={lidx} className="flex justify-between items-center text-[10.5px]">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{l.cuenta} {l.detalle || ''}</span>
                                <div className="flex gap-3">
                                  <span className={Number(l.debe) > 0 ? 'text-indigo-600 font-black' : 'text-slate-400'}>D: S/ {Number(l.debe || 0).toFixed(2)}</span>
                                  <span className={Number(l.haber) > 0 ? 'text-emerald-600 font-black' : 'text-slate-400'}>H: S/ {Number(l.haber || 0).toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => handleApplySuggestedEntry(m.suggestedEntry!)}
                            className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Zap size={13} />
                            <span>⚡ Aplicar Asiento en Libro Diario</span>
                          </button>
                        </div>
                      )}

                      {/* Footer del mensaje */}
                      <div className="mt-2 flex justify-between items-center text-[9px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {m.role === 'assistant' && (m.model || m.provider) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold">
                              <Sparkles size={9} /> {m.model || m.provider}
                            </span>
                          )}
                        </div>
                        {m.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(m.content, m.id)}
                            className="hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
                          >
                            {copiedId === m.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                            <span>Copiar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-800 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 w-fit animate-pulse">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>STAR razonando y leyendo datos de {companyName}...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* CUERPO: PESTAÑA MEMORIA DE MI EMPRESA */}
            {activeViewTab === 'memory' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 dark:bg-slate-950/20">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
                  <h4 className="font-black flex items-center gap-1.5">
                    <Brain size={14} className="text-indigo-600" /> Banco de Aprendizaje Continuo (Hermes Learning)
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    STAR aprende automáticamente los patrones contables de tu empresa a medida que trabajas. Aquí puedes revisar o eliminar las reglas aprendidas.
                  </p>
                </div>

                {loadingLearnings ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-indigo-600" />
                    <span>Cargando memoria de {companyName}...</span>
                  </div>
                ) : learnings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                    <Database size={24} className="mx-auto text-slate-300" />
                    <p>Aún no hay reglas sintetizadas para esta empresa.</p>
                    <p className="text-[10.5px]">STAR aprenderá automáticamente cuando registres compras, ventas y asientos contables.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {learnings.map(item => {
                      let rule = item.learned_rule;
                      if (typeof rule === 'string') {
                        try { rule = JSON.parse(rule); } catch (_) {}
                      }
                      return (
                        <div key={item.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-2xs flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[9.5px] font-black uppercase">
                                {item.category}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                {Math.round((item.confidence_score || 0.85) * 100)}% certeza
                              </span>
                            </div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">
                              {item.category === 'PROVEEDOR_CUENTA' && rule
                                ? `Proveedor: ${rule.nombre || item.entity_key} ➔ Cuenta PCGE [${rule.cuentaHabitual}]`
                                : `${item.entity_key}: ${JSON.stringify(rule)}`}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Confirmado {item.occurrences_count || 1} veces en transacciones
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteLearning(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Input & Quick Chips */}
            <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
              {/* Chips de consulta rápida */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 text-[10.5px]">
                {[
                  `¿Hay descuadres en ${activeTab}?`,
                  'Compras sin bancarizar >= S/ 2,000',
                  'Auditar crédito fiscal IGV',
                  'Calcular provisión de gratificación'
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip)}
                    className="whitespace-nowrap bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 font-bold transition-all cursor-pointer shrink-0"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Caja de Texto */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder={`Pregunta a STAR sobre ${activeTab} o tu empresa...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={loading}
                  className="flex-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 rounded-xl text-xs outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-medium text-slate-800 dark:text-slate-100 shadow-2xs"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={loading || !input.trim()}
                  className="p-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40 shrink-0"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
