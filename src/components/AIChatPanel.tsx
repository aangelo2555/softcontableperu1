import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Bot, Sparkles, X, Loader2, CheckCircle, Database, HelpCircle, AlertCircle, Bookmark, BookmarkCheck } from 'lucide-react';
import { webApiBridge } from '../services/apiBridge';
import { useStore } from '../store';
import toast from 'react-hot-toast';
import { auditSuggestedAccounts } from '../engine/pcgeAuditor';

interface AIChatPanelProps {
  onClose: () => void;
  onApplyEntry: (lines: any[], glosa: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  entry?: {
    glosa: string;
    asiento_json: { cuenta: string; detalle: string; debe: number; haber: number }[];
    explicacion?: string;
    niif_norma?: string;
    asientos?: {
      glosa: string;
      lines: { cuenta: string; detalle: string; debe: number; haber: number }[];
    }[];
  };
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ onClose, onApplyEntry }) => {
  const { plan, currentCompany, addAccount } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem('softcontable_ai_chat_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      } catch (e) {
        console.error('Error parsing saved chat messages:', e);
      }
    }
    return [
      {
        id: 'welcome',
        role: 'model',
        content: `¡Hola! Soy tu **Asistente Contable IA**. 🧠✨

Escribe una premisa o caso de negocio en lenguaje natural, y generaré el asiento contable correspondiente usando el **Plan Contable General Empresarial (PCGE)** y aplicando las **normas NIIF/NIC**.

*Ejemplo:*
> "Cobro de factura por 5000 soles con retención del 8% de cuarta categoría"
> "Consumo de materia prima por S/ 3,000 en fábrica"`,
        timestamp: new Date()
      }
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determinar si el usuario es Admin
  const isAdmin = useMemo(() => {
    const token = localStorage.getItem('softcontable_token');
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const email = (payload.email || '').trim().toLowerCase();
      return payload.role === 'admin' || email === 'aangelo2555@gmail.com' || email.startsWith('admin');
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('softcontable_ai_chat_messages', JSON.stringify(messages));
  }, [messages]);

  // Auto-scroll al final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText) return;

    if (!textToSend) {
      setInput('');
    }

    // Agregar mensaje del usuario
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const companyContext = {
        ruc: currentCompany?.ruc || '',
        name: currentCompany?.name || 'Empresa Local',
        sector: currentCompany?.businessType || 'COMERCIAL',
        regimen: currentCompany?.regimenTributario || 'RG'
      };

      // Mapear el plan contable para enviar solo lo necesario
      const planContableResumido = plan.map(a => ({
        cta: a.cta,
        description: a.description
      }));

      const response = await webApiBridge.aiGenerate(queryText, companyContext, planContableResumido);

      if (response.success && response.data) {
        const aiData = response.data;
        
        // Agregar respuesta del bot
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'model',
          content: aiData.explicacion || 'Aquí tienes la propuesta de asiento contable generada:',
          timestamp: new Date(),
          entry: {
            glosa: aiData.glosa || 'ASIENTO GENERADO POR IA',
            asiento_json: aiData.asiento_json || aiData.lines || [],
            explicacion: aiData.explicacion,
            niif_norma: aiData.niif_norma,
            asientos: aiData.asientos || []
          }
        };

        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(response.error || 'No se pudo generar el asiento contable.');
      }
    } catch (err: any) {
      console.error('[AI CHAT PANEL ERROR]:', err);
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: 'model',
        content: `⚠️ **Error al generar asiento:** ${err.message || 'Error de comunicación con el servicio de IA. Por favor, intente de nuevo.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (msgEntry: any, specificAsiento?: any) => {
    const targetGlosa = specificAsiento ? specificAsiento.glosa : msgEntry.glosa;
    const targetLines = specificAsiento ? (specificAsiento.asiento_json || specificAsiento.lines) : (msgEntry.asiento_json || msgEntry.lines);

    if (!targetLines || targetLines.length === 0) {
      toast.error('No hay líneas en este asiento para aplicar.');
      return;
    }
    
    // Mapear líneas para el draft contable
    const mappedLines = targetLines.map((l: any, idx: number) => ({
      id: Date.now() + idx + Math.random(),
      cuenta: l.cuenta,
      detalle: l.detalle || targetGlosa,
      debe: Number(l.debe || 0),
      haber: Number(l.haber || 0)
    }));

    onApplyEntry(mappedLines, targetGlosa);
    toast.success(`¡Asiento "${targetGlosa}" aplicado al borrador actual! ⚡`);
  };

  const handleApplyAllMerged = (msgEntry: any) => {
    if (!msgEntry.asientos || msgEntry.asientos.length === 0) return;
    
    let allLines: any[] = [];
    msgEntry.asientos.forEach((asiento: any) => {
      const lines = asiento.lines || asiento.asiento_json || [];
      lines.forEach((l: any) => {
        allLines.push({
          cuenta: l.cuenta,
          detalle: l.detalle || asiento.glosa,
          debe: l.debe,
          haber: l.haber
        });
      });
    });

    if (allLines.length === 0) {
      toast.error('No hay líneas para aplicar.');
      return;
    }

    const mappedLines = allLines.map((l: any, idx: number) => ({
      id: Date.now() + idx + Math.random(),
      cuenta: l.cuenta,
      detalle: l.detalle,
      debe: Number(l.debe || 0),
      haber: Number(l.haber || 0)
    }));

    onApplyEntry(mappedLines, msgEntry.glosa || 'ASIENTOS FUSIONADOS');
    toast.success('¡Todos los asientos fusionados aplicados al borrador! ⚡');
  };

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedCases, setSavedCases] = useState<Set<string>>(new Set());

  const handleSaveToKnowledge = async (msgId: string, msgEntry: any, userQuery: string) => {
    setSavingId(msgId);
    try {
      const caseItem = {
        sector: currentCompany?.businessType || 'COMERCIAL',
        regimen: currentCompany?.regimenTributario || 'RG',
        niif_norma: msgEntry.niif_norma || '',
        categoria: 'IA_GENERATED',
        premisa: userQuery,
        glosa: msgEntry.glosa,
        asiento_json: msgEntry.asiento_json,
        explicacion: msgEntry.explicacion || '',
        tags: 'ia, chat, training'
      };

      const res = await webApiBridge.aiSaveKnowledge(caseItem);
      if (res.success) {
        setSavedCases(prev => {
          const next = new Set(prev);
          next.add(msgId);
          return next;
        });
        toast.success('¡Caso práctico guardado en la Base de Conocimiento IA! 💾');
      } else {
        throw new Error(res.error || 'Error al guardar el caso.');
      }
    } catch (err: any) {
      toast.error(`Error al guardar en RAG: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const prefillSuggestion = (text: string) => {
    setInput(text);
  };

  return (
    <div className="w-full md:w-[450px] border-l border-app-border bg-app-surface flex flex-col h-full shadow-2xl relative animate-in slide-in-from-right duration-300 z-50">
      
      {/* Header */}
      <div className="p-4 border-b border-app-border bg-gradient-to-r from-pld-blue/10 via-purple-500/5 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="p-2 rounded-xl bg-pld-blue/15 text-pld-blue flex items-center justify-center">
              <Bot size={20} className="animate-pulse" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-app-surface"></span>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-app-text flex items-center gap-1.5">
              Asistente Contable IA
              <Sparkles size={12} className="text-yellow-500 fill-yellow-500/20" />
            </h3>
            <span className="text-[10px] text-app-muted font-bold block mt-0.5">Groq Llama 3.3 + RAG Activo</span>
          </div>
        </div>
        
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-lg hover:bg-app-hover text-app-muted hover:text-app-text transition-all"
          title="Cerrar Asistente"
        >
          <X size={16} />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-app-bg/15">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          
          // Buscar la pregunta del usuario previa a este mensaje de respuesta para el RAG
          const userQueryMsg = !isUser ? messages.slice(0, index).reverse().find(m => m.role === 'user') : null;
          const userQuery = userQueryMsg ? userQueryMsg.content : '';

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col max-w-[90%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
            >
              <div 
                className={`p-3.5 rounded-2xl text-xs leading-relaxed border shadow-sm ${
                  isUser 
                    ? 'bg-pld-blue text-white border-pld-blue/20 rounded-tr-none' 
                    : 'bg-app-surface text-app-text border-app-border/70 rounded-tl-none'
                }`}
              >
                {/* Formatear Markdown básico */}
                <div className="whitespace-pre-line font-medium space-y-2">
                  {msg.content}
                </div>

                {/* Mostrar Asiento Contable */}
                {msg.entry && (
                  <div className="mt-4 flex flex-col gap-3 font-sans text-app-text">
                    {/* Si tiene múltiples sub-asientos contables desglosados */}
                    {msg.entry.asientos && msg.entry.asientos.length > 0 ? (
                      msg.entry.asientos.map((asiento, subIdx) => {
                        const subDebe = asiento.lines.reduce((sum, item) => sum + (Number(item.debe) || 0), 0);
                        const subHaber = asiento.lines.reduce((sum, item) => sum + (Number(item.haber) || 0), 0);
                        const subBalanced = Math.abs(subDebe - subHaber) < 0.01;

                        return (
                          <div key={subIdx} className="bg-app-bg/60 rounded-xl p-3 border border-app-border/40">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black uppercase text-pld-blue tracking-widest">
                                ASIENTO {subIdx + 1}
                              </span>
                              {subBalanced && (
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-500 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  PARTIDA DOBLE OK
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] font-extrabold mb-2.5 uppercase tracking-wider text-app-text/90">
                              {asiento.glosa}
                            </p>

                            {/* Tabla de Cuentas */}
                            <div className="overflow-x-auto rounded-lg border border-app-border/50 bg-app-surface/40">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="bg-app-bg/80 text-[8px] font-bold text-app-muted border-b border-app-border/50 uppercase">
                                    <th className="p-1.5 text-center w-12">Cuenta</th>
                                    <th className="p-1.5 text-left">Detalle</th>
                                    <th className="p-1.5 text-right w-16">Debe</th>
                                    <th className="p-1.5 text-right w-16">Haber</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {asiento.lines.map((l, i) => (
                                    <tr key={i} className="border-b border-app-border/20 last:border-0 hover:bg-app-hover/30">
                                      <td className="p-1.5 text-center font-mono font-black text-pld-blue">{l.cuenta}</td>
                                      <td className="p-1.5 font-bold truncate max-w-[120px]">{l.detalle}</td>
                                      <td className="p-1.5 text-right font-mono font-extrabold text-emerald-500">
                                        {l.debe > 0 ? Number(l.debe).toFixed(2) : '-'}
                                      </td>
                                      <td className="p-1.5 text-right font-mono font-extrabold text-red-400">
                                        {l.haber > 0 ? Number(l.haber).toFixed(2) : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Totales */}
                            <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-app-border/40 text-[10px]">
                              <span className="font-extrabold text-[8px] text-app-muted">TOTAL:</span>
                              <div className="text-right font-mono font-black text-app-text">
                                S/ {subDebe.toFixed(2)}
                              </div>
                            </div>

                            {/* Botón Aplicar a este asiento */}
                            <div className="mt-3">
                              <button
                                onClick={() => handleApply(msg.entry, asiento)}
                                className="w-full bg-gradient-to-r from-pld-blue to-blue-600 hover:from-pld-blue/95 hover:to-blue-600/95 text-white py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 active:scale-[0.98] transition-all shadow-sm"
                              >
                                <Sparkles size={10} />
                                Aplicar Asiento {subIdx + 1}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* Retrocompatibilidad con asiento plano */
                      msg.entry.asiento_json && msg.entry.asiento_json.length > 0 && (
                        <div className="bg-app-bg/60 rounded-xl p-3 border border-app-border/40">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase text-pld-blue tracking-widest">
                              PROPUESTA DE ASIENTO
                            </span>
                          </div>

                          <p className="text-[11px] font-extrabold mb-3 uppercase tracking-wider text-app-text/90">
                            Glosa: {msg.entry.glosa}
                          </p>

                          <div className="overflow-x-auto rounded-lg border border-app-border/50 bg-app-surface/40">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="bg-app-bg/80 text-[8px] font-bold text-app-muted border-b border-app-border/50 uppercase">
                                  <th className="p-1.5 text-center w-12">Cuenta</th>
                                  <th className="p-1.5 text-left">Detalle</th>
                                  <th className="p-1.5 text-right w-16">Debe</th>
                                  <th className="p-1.5 text-right w-16">Haber</th>
                                </tr>
                              </thead>
                              <tbody>
                                {msg.entry.asiento_json.map((l, i) => (
                                  <tr key={i} className="border-b border-app-border/20 last:border-0 hover:bg-app-hover/30">
                                    <td className="p-1.5 text-center font-mono font-black text-pld-blue">{l.cuenta}</td>
                                    <td className="p-1.5 font-bold truncate max-w-[120px]">{l.detalle}</td>
                                    <td className="p-1.5 text-right font-mono font-extrabold text-emerald-500">
                                      {l.debe > 0 ? Number(l.debe).toFixed(2) : '-'}
                                    </td>
                                    <td className="p-1.5 text-right font-mono font-extrabold text-red-400">
                                      {l.haber > 0 ? Number(l.haber).toFixed(2) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-app-border/40 text-[10px]">
                            <span className="font-extrabold text-[8px] text-app-muted">TOTAL DEBE/HABER:</span>
                            <div className="text-right font-mono font-black text-app-text">
                              S/ {msg.entry.asiento_json.reduce((sum, item) => sum + (Number(item.debe) || 0), 0).toFixed(2)}
                            </div>
                          </div>

                          <div className="mt-3">
                            <button
                              onClick={() => handleApply(msg.entry)}
                              className="w-full bg-gradient-to-r from-pld-blue to-blue-600 hover:from-pld-blue/95 hover:to-blue-600/95 text-white py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 active:scale-[0.98] transition-all shadow-sm"
                            >
                              <Sparkles size={10} />
                              Aplicar al Asiento
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    {/* Explicación general de NIIF y Base Legal */}
                    <div className="bg-app-surface/60 rounded-xl p-3 border border-app-border/30 text-[10px] space-y-2 mt-1">
                      {msg.entry.niif_norma && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[9px] text-pld-blue uppercase">Normativa:</span>
                          <span className="bg-pld-blue/5 text-pld-blue px-1.5 py-0.5 rounded border border-pld-blue/10 font-bold">{msg.entry.niif_norma}</span>
                        </div>
                      )}
                      {msg.entry.explicacion && (
                        <p className="text-app-muted leading-relaxed font-medium">
                          {msg.entry.explicacion}
                        </p>
                      )}
                    </div>

                    {/* Auditoría de Cuentas del PCGE */}
                    {(() => {
                      const missing = auditSuggestedAccounts(msg.entry.asientos || [], msg.entry.asiento_json || [], plan);
                      if (missing.length === 0) return null;

                      return (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[10px] space-y-2 mt-1">
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                            <AlertCircle size={12} />
                            <span>Auditoría de Cuentas (PCGE)</span>
                          </div>
                          <p className="text-app-muted leading-relaxed font-medium">
                            Las siguientes cuentas sugeridas por la IA no existen en tu catálogo de empresa:
                          </p>
                          <div className="flex flex-wrap gap-1.5 py-1">
                            {missing.map((acc) => (
                              <span key={acc.cta} className="bg-amber-500/5 text-amber-600 dark:text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-500/20 font-bold" title={acc.description}>
                                {acc.cta} (El. {acc.element})
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                for (const acc of missing) {
                                  await addAccount({
                                    cta: acc.cta,
                                    description: acc.description.toUpperCase(),
                                    type: 'Balance',
                                    reqCenCos: false,
                                    amarreDebe: '',
                                    amarreHaber: ''
                                  });
                                }
                                toast.success('¡Cuentas creadas y sincronizadas en tu catálogo! ⚡');
                              } catch (err: any) {
                                toast.error(`Error al auto-crear cuentas: ${err.message}`);
                              }
                            }}
                            className="w-full bg-amber-500/15 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 active:scale-[0.98] transition-all border border-amber-500/20 font-extrabold"
                          >
                            <Database size={10} />
                            Auto-crear Cuentas Faltantes ({missing.length})
                          </button>
                        </div>
                      );
                    })()}

                    {/* Botones de control global de la respuesta (Entrenar IA, etc) */}
                    <div className="flex gap-2 mt-1">
                      {msg.entry.asientos && msg.entry.asientos.length > 1 && (
                        <button
                          onClick={() => handleApplyAllMerged(msg.entry)}
                          className="flex-1 bg-app-surface hover:bg-app-hover border border-app-border text-app-text py-2 px-3 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-[0.98]"
                        >
                          <Sparkles size={10} />
                          Aplicar Todo Fusionado
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => handleSaveToKnowledge(msg.id, msg.entry, userQuery)}
                          disabled={savingId === msg.id || savedCases.has(msg.id)}
                          className={`px-3 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-[0.98] ${
                            savedCases.has(msg.id)
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex-1'
                              : 'bg-app-surface hover:bg-app-hover border-app-border text-app-muted hover:text-app-text flex-1'
                          }`}
                          title="Guardar este asiento como caso práctico RAG para entrenar a la IA"
                        >
                          {savingId === msg.id ? (
                            <Loader2 size={11} className="animate-spin text-pld-blue" />
                          ) : savedCases.has(msg.id) ? (
                            <>
                              <CheckCircle size={11} className="text-emerald-500" />
                              Entrenado
                            </>
                          ) : (
                            <>
                              <Database size={11} />
                              Entrenar IA
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[9px] text-app-muted mt-1 px-1 font-bold">
                {msg.timestamp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 self-start bg-app-surface border border-app-border/70 p-3 rounded-2xl rounded-tl-none max-w-[80%]">
            <Loader2 size={16} className="animate-spin text-pld-blue" />
            <span className="text-xs font-bold text-app-muted animate-pulse">Analizando premisa y generando asiento...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 border-t border-app-border/40 bg-app-surface/50 flex flex-col gap-1.5">
          <span className="text-[8px] font-black text-app-muted uppercase tracking-wider">Premisas de ejemplo rápidos</span>
          <div className="flex flex-wrap gap-1">
            {[
              'Anticipo recibido de cliente por 1,000 + IGV',
              'Provisión de planilla de operarios con ESSALUD y AFP',
              'Destrucción de mercadería obsoleta con desmedro notarial',
              'Servicio de consultoría facturado con detracción del 12%'
            ].map((txt, i) => (
              <button
                key={i}
                onClick={() => prefillSuggestion(txt)}
                className="text-[9px] font-bold text-pld-blue bg-pld-blue/5 hover:bg-pld-blue/10 border border-pld-blue/10 px-2 py-1 rounded-lg text-left transition-colors truncate max-w-full"
              >
                {txt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="p-4 border-t border-app-border bg-app-surface flex gap-2 items-end"
      >
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Detalla la operación aquí... (ej. venta, gasto, planilla, NIIF...)"
            className="w-full text-xs p-3 pr-10 rounded-xl border border-app-border focus:border-pld-blue focus:ring-2 focus:ring-pld-blue/15 bg-app-bg resize-none max-h-24 custom-scrollbar font-medium"
            rows={2}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="h-10 w-10 rounded-xl bg-pld-blue hover:bg-pld-blue/95 text-white flex items-center justify-center shadow-lg shadow-pld-blue/15 hover:shadow-pld-blue/20 transition-all disabled:opacity-50 disabled:shadow-none active:scale-[0.96]"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
