import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Mail, Paperclip, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Building2, Download, Loader2, LogOut, FileText, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PageHeader from './ui/PageHeader';

// Registro global de procesos de sincronización activos por RUC para mantener el estado al cambiar de pestaña
interface SyncState {
  loading: boolean;
  statusText: string;
  error: string | null;
}
const globalSyncState: Record<string, SyncState> = {};
const globalSyncListeners: Record<string, (state: SyncState) => void> = {};

const BuzonView: React.FC = () => {
  const isElectron = !!(window as any).electronAPI;
  const { workspaces, currentCompany, buzonMensajes, setBuzonMensajes, markBuzonMensajeAsRead, clearBuzonStorage, loadBuzonFromStorage } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [detalleHtml, setDetalleHtml] = useState<string | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [selectedRuc, setSelectedRuc] = useState(currentCompany.ruc);
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const filteredWorkspaces = workspaces.filter(ws => {
    const name = ws?.name || '';
    const ruc = ws?.ruc || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || ruc.includes(searchTerm);
  });
  const [activeBrowserId, setActiveBrowserId] = useState<string | null>(() => {
    return sessionStorage.getItem(`activeBuzonBrowserId_${currentCompany.ruc}`);
  });
  const [statusText, setStatusText] = useState('');
  const [downloadingText, setDownloadingText] = useState('');
  
  // Constancias Modal State
  const [showConstancias, setShowConstancias] = useState(false);
  const [constancias, setConstancias] = useState<any[]>([]);
  const [loadingConstancias, setLoadingConstancias] = useState(false);



  // Sincronizar activeBrowserId y cargar buzón persistido cuando cambia selectedRuc
  useEffect(() => {
    const savedId = sessionStorage.getItem(`activeBuzonBrowserId_${selectedRuc}`);
    setActiveBrowserId(savedId);
    
    // Cargar mensajes persistidos para la empresa seleccionada
    loadBuzonFromStorage(selectedRuc);
    console.log('[BUZON] Cambiando a empresa:', selectedRuc);
    setSelectedMessage(null); // Limpiar mensaje seleccionado
    setDetalleHtml(null); // Limpiar detalle
  }, [selectedRuc]);

  // Sincronizar el estado del proceso de sincronización activo cuando cambia de pestaña o de cliente
  useEffect(() => {
    const rucState = globalSyncState[selectedRuc] || { loading: false, statusText: '', error: null };
    setLoading(rucState.loading);
    setStatusText(rucState.statusText);
    setError(rucState.error);

    globalSyncListeners[selectedRuc] = (state: SyncState) => {
      setLoading(state.loading);
      setStatusText(state.statusText);
      setError(state.error);
    };

    return () => {
      delete globalSyncListeners[selectedRuc];
    };
  }, [selectedRuc]);

  // ⚠️ NOTA: El auto-sync del buzón ahora se maneja a nivel global en App.tsx
  // Se ejecuta automáticamente cuando se selecciona una empresa con credenciales SOL
  // No es necesario tener el componente BuzonModule abierto

  const setSyncState = (ruc: string, updates: Partial<SyncState>) => {
    const currentState = globalSyncState[ruc] || { loading: false, statusText: '', error: null };
    const newState = { ...currentState, ...updates };
    globalSyncState[ruc] = newState;
    
    if (ruc === selectedRuc) {
      setLoading(newState.loading);
      setStatusText(newState.statusText);
      setError(newState.error);
    }
    
    if (globalSyncListeners[ruc]) {
      globalSyncListeners[ruc](newState);
    }
  };

  const updateBrowserId = (id: string | null) => {
    setActiveBrowserId(id);
    if (id) {
      sessionStorage.setItem(`activeBuzonBrowserId_${selectedRuc}`, id);
    } else {
      sessionStorage.removeItem(`activeBuzonBrowserId_${selectedRuc}`);
    }
  };

  const handleCerrarSesion = async () => {
    try {
      if ((window as any).electronAPI?.buzonCerrarTodas) {
        await (window as any).electronAPI.buzonCerrarTodas();
      }
      clearBuzonStorage(selectedRuc);
      setSelectedMessage(null);
      setDetalleHtml(null);
      updateBrowserId(null);
      setStatusText('');
      setError(null);
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
    }
  };

  const generateSrcDoc = (content: string) => {
    if (!content) return '';
    const secureContent = content.replace(/http:\/\/([a-z0-9-]+\.)*sunat\.gob\.pe/g, 'https://$1sunat.gob.pe');
    return `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <base href="https://ww1.sunat.gob.pe/">
          <style>
            html, body { 
              background-color: #ffffff !important; 
              padding: 0;
              margin: 0;
              height: 100%;
              width: 100%;
              overflow-y: auto !important;
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch;
            }
            .document-wrapper {
              background-color: white !important;
              color: #1a202c !important; 
              width: 100%;
              max-width: 100%;
              min-height: 100%;
              margin: 0 auto;
              padding: 10px;
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.5;
              overflow-wrap: break-word;
              word-wrap: break-word;
            }
            img { max-width: 100%; height: auto; margin: 5px 0; }
            a { color: #2b6cb0 !important; text-decoration: underline !important; font-weight: 500; }
            table { border-collapse: collapse; width: 100% !important; max-width: 100% !important; margin: 0.5rem 0; font-size: 0.85rem; }
            th, td { border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }
            th { background-color: #f7fafc; font-weight: 700; }
            .inlined-iframe-content { margin-top: 0.5rem; }
            /* Estilizar los iframes embebidos de SUNAT para permitir desplazamiento vertical continuo */
            iframe {
              width: 100% !important;
              max-width: 100% !important;
              min-height: 480px !important;
              height: 100% !important;
              border: 1px solid #e2e8f0 !important;
              border-radius: 6px !important;
              margin-top: 5px !important;
              display: block;
              overflow-y: auto !important;
            }
            /* Prevenir que elementos anchos desborden el contenedor */
            * { max-width: 100%; box-sizing: border-box; }
            pre, code { white-space: pre-wrap; word-break: break-all; }
            /* Scrollbar estilizada */
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: #f1f5f9; }
            ::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="document-wrapper">
            ${secureContent}
          </div>
          <script>
            // Definir dummy para evitar errores de referencia por parte de los scripts inline de SUNAT en iframes anidados
            window.disableContextMenu = function() {
              console.log("[SOFTCONTABLE] Evento disableContextMenu gestionado.");
            };

            document.addEventListener('click', (e) => {
              const target = e.target.closest('a');
              if (target && target.getAttribute('href')) {
                // Asegurar que abran en nueva pestaña si son links externos
                target.setAttribute('target', '_blank');
              }
            });
          </script>
        </body>
      </html>
    `;
  };

  // Favor root currentCompany if it matches selectedRuc for live reactivity
  const activeWs = workspaces.find(ws => ws.ruc === selectedRuc);
  const isCurrentActive = selectedRuc === currentCompany.ruc;
  const companyToUse = isCurrentActive ? currentCompany : (activeWs || currentCompany);

  useEffect(() => {
    if (selectedMessage) {
      if (selectedMessage.contenido) {
        setDetalleHtml(selectedMessage.contenido);
        setLoadingDetalle(false);
        return;
      }

      if (activeBrowserId) {
        const fetchDetalle = async () => {
          setLoadingDetalle(true);
          setDetalleHtml(null);
          try {
            const res = await (window as any).electronAPI.buzonExtraerDetalle({
              browserId: activeBrowserId,
              mensajeId: selectedMessage.id
            });
            if (res.success && res.html) {
              setDetalleHtml(res.html);
              const updated = buzonMensajes.map(m => m.id === selectedMessage.id ? { ...m, contenido: res.html } : m);
              setBuzonMensajes(updated, selectedRuc);
            } else {
              const fallback = selectedMessage.contenido || '<center style="padding:20px;color:#d32f2f">No se pudo extraer el contenido HTML de este mensaje.</center>';
              setDetalleHtml(fallback);
            }
          } catch (e) {
            console.error("Error extrayendo HTML:", e);
            const errFallback = selectedMessage.contenido || '<center style="padding:20px;color:#d32f2f">Error de conexión al obtener detalles.</center>';
            setDetalleHtml(errFallback);
          } finally {
            setLoadingDetalle(false);
          }
        };
        
        fetchDetalle();
      } else {
        setDetalleHtml(selectedMessage.contenido || null);
        setLoadingDetalle(false);
      }
    } else {
      setDetalleHtml(null);
      setLoadingDetalle(false);
    }
  }, [selectedMessage, activeBrowserId]);

  const handleConsultar = async () => {
    if (!companyToUse.sol_user || !companyToUse.sol_pass) {
      setSyncState(companyToUse.ruc, { error: `Configure el Usuario/Clave SOL para: ${companyToUse.name}` });
      return;
    }
    
    const ruc = companyToUse.ruc;
    setSyncState(ruc, { loading: true, error: null, statusText: 'Iniciando sesión en SUNAT...' });

    try {
      if ((window as any).electronAPI && (window as any).electronAPI.buzonConsultar) {
        // Enviar todos los datos necesarios (ruc, usuario, clave, email, empresa)
        const result = await (window as any).electronAPI.buzonConsultar({
           ruc: companyToUse.ruc,
           usuario: companyToUse.sol_user,
           clave: companyToUse.sol_pass,
           empresa: companyToUse.name,
           email: '' // Se podría sacar de un campo "email" en CompanyData si existiera
        });
        
        if (result.success) {
           setBuzonMensajes(result.mensajes, ruc);
           updateBrowserId(result.browserId);
           setSyncState(ruc, { loading: false, statusText: 'Sincronización finalizada correctamente' });
           toast.success('Buzón actualizado');
           setTimeout(() => setSyncState(ruc, { statusText: '' }), 3000);
        } else {
           setSyncState(ruc, { loading: false, error: result.error || 'No se pudo conectar con el Buzón SUNAT.', statusText: '' });
        }
      } else {
        // MOCK para desarrollo/navegador
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          setTimeout(() => {
            setBuzonMensajes([
              { id: '900001', asunto: 'Resolución de Intendencia N° 023-2026', fecha: '28/03/2026', tieneAdjunto: true, estado: 'no_leido' },
              { id: '900002', asunto: 'Notificación de Orden de Pago', fecha: '25/03/2026', tieneAdjunto: true, estado: 'leido' }
            ], ruc);
            setSyncState(ruc, { loading: false, statusText: '' });
          }, 1500);
        } else {
          setSyncState(ruc, { loading: false, error: 'La sincronización automática del buzón tributario requiere instalar el cliente de escritorio de SoftContable.', statusText: '' });
          toast.error('Función no disponible en entorno web');
        }
      }
    } catch (err: any) {
      setSyncState(ruc, { loading: false, error: err.message || 'Error inesperado del sistema.', statusText: '' });
    }
  };

  const handleVerConstancias = async () => {
    if (!(window as any).electronAPI) {
      toast.error('Función no disponible: requiere el cliente de escritorio de SoftContable.');
      return;
    }
    setShowConstancias(true);
    setLoadingConstancias(true);
    try {
      const res = await (window as any).electronAPI.buzonListarConstancias({ ruc: companyToUse.ruc });
      if (res.success) {
        setConstancias(res.constancias);
      } else {
        alert('Error al listar constancias: ' + res.error);
      }
    } catch (e) {
      alert('Error de conexión.');
    } finally {
      setLoadingConstancias(false);
    }
  };

  const handleAbrirConstancia = async (ruta: string) => {
    if (!(window as any).electronAPI) {
      toast.error('Función no disponible: requiere el cliente de escritorio de SoftContable.');
      return;
    }
    try {
      const res = await (window as any).electronAPI.buzonAbrirConstancia({ ruta });
      if (res.success) {
        if (res.fileBase64) {
          const linkSource = `data:${res.fileType || 'application/pdf'};base64,${res.fileBase64}`;
          const downloadLink = document.createElement("a");
          downloadLink.href = linkSource;
          downloadLink.download = res.fileName || "constancia.pdf";
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          toast.success("Constancia descargada en su navegador.");
        } else {
          toast.success("Constancia abierta localmente.");
        }
      } else {
        alert('No se pudo abrir: ' + res.error);
      }
    } catch (e) {
      alert('Error al abrir archivo.');
    }
  };

  const handleDownload = async (msgId: string) => {
    if (!(window as any).electronAPI) {
      toast.error('Función no disponible: requiere el cliente de escritorio de SoftContable.');
      return;
    }
    if (!activeBrowserId) {
      setError('La sesión ha expirado. Por favor consulte el buzón nuevamente.');
      return;
    }
    
    setDownloadingText('Descargando adjunto...');
    try {
      const res = await (window as any).electronAPI.buzonDescargarAdjunto({
        browserId: activeBrowserId,
        mensajeId: msgId
      });
      if (res.success) {
        if (res.fileBase64) {
          const linkSource = `data:${res.fileType || 'application/pdf'};base64,${res.fileBase64}`;
          const downloadLink = document.createElement("a");
          downloadLink.href = linkSource;
          downloadLink.download = res.fileName || "constancia.pdf";
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          toast.success("Adjunto descargado correctamente en su navegador.");
        } else {
          alert('Archivo guardado en: ' + res.ruta);
        }
      } else {
        setError('Error al descargar: ' + res.error);
      }
    } catch (e) {
      setError('Error de comunicación con el proceso principal.');
    } finally {
      setDownloadingText('');
    }
  };


  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text animate-fade-in relative">
      <PageHeader
        icon={<Mail size={18} />}
        title="Buzón Electrónico SUNAT"
        badge={
          <span className="px-2 py-0.5 rounded-lg bg-pld-blue/10 text-[9px] text-pld-blue border border-pld-blue/10 tracking-[0.2em] uppercase">
            Buzón SOL
          </span>
        }
        subtitle={`${companyToUse.name} • RUC: ${selectedRuc}`}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-start md:justify-end w-full md:w-auto">
            {(statusText || downloadingText) && (
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-pld-blue animate-pulse uppercase tracking-widest bg-pld-blue/5 px-2 py-1.5 rounded-xl border border-pld-blue/10">
                <Loader2 size={10} className="animate-spin" />
                <span>{statusText || downloadingText}</span>
              </div>
            )}

            <button 
              onClick={handleCerrarSesion}
              className="flex items-center justify-center gap-1 h-8 px-2.5 sm:px-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-red-500 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0"
              title="Salir de SUNAT"
            >
              <LogOut size={12} />
              <span className="hidden lg:inline">Salir</span>
            </button>
            <button 
              onClick={handleVerConstancias}
              className="flex items-center justify-center gap-1 h-8 px-2.5 sm:px-3 bg-app-surface border border-app-border text-app-text rounded-xl font-bold uppercase tracking-wider text-[10px] hover:border-pld-blue hover:text-pld-blue transition-all active:scale-95 cursor-pointer shrink-0"
              title="Ver constancias descargadas"
            >
              <Paperclip size={12} />
              <span className="hidden lg:inline">Constancias</span>
            </button>
            <button 
              onClick={handleConsultar}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 h-8 px-3 sm:px-4 bg-pld-blue text-white rounded-xl font-black uppercase tracking-wider text-[10px] hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-pld-blue/20 active:scale-95 cursor-pointer shrink-0"
              title="Sincronizar mensajes"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              <span className="hidden lg:inline">Sincronizar</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="max-w-[1600px] w-full mx-auto p-2.5 md:p-3.5 flex flex-col gap-2.5 md:gap-3 flex-1 min-h-0">
          
          {/* Selector Horizontal de Empresas */}
          <div className="bg-app-surface/60 border border-app-border rounded-xl p-2.5 flex flex-col gap-2 shrink-0 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 size={13} className="text-pld-blue shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-wider text-app-muted shrink-0 hidden sm:inline">Cliente Activo:</span>
                <span className="text-[10px] font-black text-pld-blue uppercase truncate">{companyToUse.name}</span>
                <span className="text-[9px] text-app-muted font-mono bg-app-bg px-2 py-0.5 rounded border border-app-border shrink-0">RUC: {selectedRuc}</span>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="relative w-24 sm:w-32 lg:w-36">
                  <span className="absolute top-1/2 -translate-y-1/2 text-app-muted left-1.5 pointer-events-none">
                    <Search size={10} />
                  </span>
                  <input
                    type="text"
                    placeholder="BUSCAR..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-app-bg hover:bg-app-hover border border-app-border rounded-md pl-5 pr-1 py-0.5 h-6 text-[8px] sm:text-[9px] font-bold uppercase text-app-text outline-none focus:border-pld-blue transition-all"
                  />
                </div>
                <button
                  onClick={() => setIsSelectorExpanded(!isSelectorExpanded)}
                  className="px-2 py-0.5 h-6 bg-app-bg hover:bg-app-hover border border-app-border rounded-md text-[8px] sm:text-[9px] font-black uppercase text-app-text hover:text-pld-blue transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Building2 size={10} />
                  <span>{isSelectorExpanded ? 'Ocultar' : 'Cambiar'}</span>
                </button>
              </div>
            </div>

            {isSelectorExpanded && (
              <div className="flex gap-2 overflow-x-auto pt-2 pb-1 custom-scrollbar border-t border-app-border/40 animate-in fade-in duration-200">
                {filteredWorkspaces.map((ws) => {
                  const isSelected = ws.ruc === selectedRuc;
                  return (
                    <button
                      key={ws.ruc}
                      onClick={() => {
                        setSelectedRuc(ws.ruc);
                        setIsSelectorExpanded(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left shrink-0 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-pld-blue/10 border-pld-blue text-pld-blue font-bold shadow-sm'
                          : 'bg-app-bg hover:bg-app-hover border-app-border text-app-text'
                      }`}
                    >
                      <Building2 size={12} className={isSelected ? 'text-pld-blue' : 'text-app-muted'} />
                      <div className="text-[10px] font-bold uppercase truncate max-w-[180px]">{ws.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!isElectron && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl px-3 py-1.5 flex items-center justify-between text-[10px] font-bold shrink-0 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={14} className="shrink-0 text-amber-500" />
                <span className="truncate">Modo Web: La auto-sincronización y descarga en vivo de constancias requieren la app de escritorio.</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl animate-in slide-in-from-top duration-300 shrink-0">
               <AlertCircle size={16} />
               <p className="text-xs font-bold uppercase">{error}</p>
            </div>
          )}

          {/* Inbox Grid */}
          <div className="flex flex-col md:flex-row flex-1 gap-2.5 md:gap-3 min-h-0">
            
            {/* Left: Message List */}
            <div className={`w-full md:w-1/3 flex flex-col bg-app-surface/20 border border-app-border rounded-xl overflow-hidden shadow-sm ${
              selectedMessage ? 'hidden md:flex' : 'flex'
            }`}>
              <div className="p-3 border-b border-app-border bg-app-surface/40 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-black text-pld-blue uppercase tracking-widest">
                   Bandeja de Entrada ({buzonMensajes.length})
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                {buzonMensajes.length === 0 && !loading && (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-3 p-4">
                    <Mail size={40} />
                    <span className="text-xs font-bold uppercase tracking-widest">Vacío</span>
                  </div>
                )}

                {loading && buzonMensajes.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-pld-blue space-y-3 p-4">
                    <Loader2 size={28} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Autenticando...</span>
                  </div>
                )}

                {buzonMensajes.map(msg => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (msg.estado === 'no_leido') markBuzonMensajeAsRead(msg.id);
                    }}
                    className={`w-full text-left p-2.5 sm:p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                      selectedMessage?.id === msg.id 
                      ? 'bg-pld-blue/10 border-pld-blue' 
                      : 'bg-app-bg border-app-border hover:border-app-muted'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        {msg.estado === 'no_leido' && <div className="w-2 h-2 rounded-full bg-pld-blue shrink-0" />}
                        <span className="text-[9px] font-black text-app-muted uppercase">{msg.fecha}</span>
                      </div>
                      <h4 className={`text-xs truncate ${msg.estado === 'no_leido' ? 'font-black text-app-text' : 'font-medium text-app-text/70'}`}>
                        {msg.asunto}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {msg.tieneAdjunto && <Paperclip size={13} className="text-pld-blue" />}
                      <ChevronRight size={15} className={`text-app-muted group-hover:text-pld-blue transition-all ${selectedMessage?.id === msg.id ? 'translate-x-0.5' : ''}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Message Content */}
            <div className={`w-full md:w-2/3 flex flex-col bg-app-surface/20 border border-app-border rounded-xl shadow-sm overflow-hidden min-h-0 ${
              selectedMessage ? 'flex' : 'hidden md:flex'
            }`}>
                {selectedMessage ? (
                  <div className="flex flex-col h-full min-h-0 animate-in zoom-in-95 fade-in duration-300">
                      {/* Header fijo ultra-compacto (para dar máximo espacio vertical al cuadro del mensaje) */}
                      <div className="p-1.5 px-2.5 sm:px-3 border-b border-app-border flex justify-between items-center gap-2 shrink-0 bg-app-surface/40 min-h-[34px]">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <button
                            onClick={() => setSelectedMessage(null)}
                            className="md:hidden p-1 hover:bg-app-bg border border-app-border rounded text-app-text transition-all shrink-0 flex items-center justify-center cursor-pointer"
                            title="Regresar a la bandeja"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <div className="min-w-0 flex-1 flex items-center gap-1.5">
                            <span className="text-[8px] font-black text-pld-blue uppercase tracking-wider shrink-0">
                              ASUNTO:
                            </span>
                            <h2 className="text-[9px] sm:text-[10px] md:text-xs font-bold text-app-text leading-tight uppercase truncate">
                              {selectedMessage.asunto}
                            </h2>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                           <button 
                             onClick={async () => {
                               if (!activeBrowserId) return;
                               setLoadingDetalle(true);
                               const res = await (window as any).electronAPI.buzonExtraerDetalle({
                                 browserId: activeBrowserId,
                                 mensajeId: selectedMessage.id
                               });
                               if (res.success && res.html) {
                                 setDetalleHtml(res.html);
                                 const updated = buzonMensajes.map(m => m.id === selectedMessage.id ? { ...m, contenido: res.html } : m);
                                 setBuzonMensajes(updated, selectedRuc);
                               }
                               setLoadingDetalle(false);
                             }}
                             className="p-1 hover:bg-pld-blue/10 text-pld-blue rounded transition-colors border border-app-border/40 hover:border-pld-blue/30 cursor-pointer"
                             title="Refrescar contenido"
                           >
                             <Loader2 size={12} className={loadingDetalle ? 'animate-spin' : ''} />
                           </button>
                           <div className="bg-app-bg px-1.5 py-0.5 rounded border border-app-border">
                               <span className="text-[8px] font-bold text-app-muted uppercase font-mono">{selectedMessage.fecha}</span>
                           </div>
                        </div>
                      </div>

                      {/* Cuadro donde se encuentra el mensaje (Flex-1 con scroll continuo perfecto) */}
                      <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-1 sm:p-1.5 w-full h-full">
                        {loadingDetalle ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-pld-blue space-y-3">
                             <Loader2 size={28} className="animate-spin" />
                             <span className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Cargando Documento...</span>
                          </div>
                        ) : detalleHtml || selectedMessage.contenido ? (
                          <div className="flex-1 min-h-0 bg-white rounded-lg overflow-hidden shadow-sm border border-app-border w-full h-full relative">
                            <iframe 
                              key={`${selectedMessage.id}-${detalleHtml ? 'detail' : 'basic'}-${loadingDetalle}`}
                              id="buzon-iframe"
                              title="Contenido del Mensaje"
                              className="w-full h-full border-none bg-white block absolute inset-0"
                              srcDoc={generateSrcDoc(detalleHtml || selectedMessage.contenido)}
                              sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin allow-top-navigation"
                            />
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-gray-900/30 rounded-xl border border-dashed border-gray-700/50">
                            <div className="bg-gray-800/50 p-2.5 rounded-full mb-2">
                               <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                               </svg>
                            </div>
                            <p className="text-gray-400 font-medium text-xs">Contenido no disponible</p>
                            <p className="text-gray-500 text-[10px] mt-0.5">Este mensaje se encuentra en formato PDF o no tiene cuerpo de texto.</p>
                          </div>
                        )}
                      </div>

                      {/* Footer fijo ultra compacto */}
                      <div className="shrink-0 p-2.5 pt-0 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[9px] text-app-muted px-1">
                          <span className="flex items-center gap-1 font-bold">
                            <CheckCircle2 size={11} className="text-pld-blue shrink-0" />
                            Canal encriptado con Servidores SUNAT
                          </span>
                        </div>

                        {selectedMessage.tieneAdjunto && (
                          <div className="pt-1 border-t border-app-border">
                              <button 
                                onClick={() => handleDownload(selectedMessage.id)}
                                className="w-full py-1.5 bg-pld-blue/10 border border-pld-blue/30 text-pld-blue font-bold uppercase tracking-widest text-[9px] rounded-lg hover:bg-pld-blue hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                              >
                                <Download size={13} />
                                Descargar Constancia / Adjunto
                              </button>
                          </div>
                        )}
                      </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-app-muted space-y-4 opacity-30">
                    <Mail size={64} strokeWidth={1} />
                    <span className="text-xs font-black uppercase tracking-[0.3em]">Vista de Lectura</span>
                  </div>
                )}
            </div>
          </div>

      {/* Modal Ver Constancias */}
      {showConstancias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-app-surface border border-app-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-app-border flex justify-between items-center bg-gray-900/40">
                 <div>
                    <h3 className="text-xl font-black text-pld-blue uppercase tracking-widest">Constancias Descargadas</h3>
                    <p className="text-xs text-app-muted mt-1 uppercase font-bold">Cliente: {companyToUse.ruc}</p>
                 </div>
                 <button onClick={() => setShowConstancias(false)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-bold">
                    ✕
                 </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-app-bg">
                 {loadingConstancias ? (
                    <div className="flex flex-col items-center justify-center space-y-4 py-12 text-pld-blue">
                       <Loader2 size={32} className="animate-spin" />
                       <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Cargando Disco...</span>
                    </div>
                 ) : constancias.length === 0 ? (
                    <div className="text-center py-12 text-app-muted">
                       <span className="text-sm font-bold uppercase tracking-widest opacity-50">No hay descargas para este cliente.</span>
                    </div>
                 ) : (
                    <div className="space-y-4">
                       {constancias.map((grupo, i) => (
                          <div key={grupo.id || i} className="bg-app-surface/50 border border-app-border rounded-xl p-4 hover:border-pld-blue/50 transition-all flex flex-col gap-3">
                             <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-app-border/40 pb-2 gap-2">
                                <div className="flex flex-col min-w-0">
                                   <span className="font-black text-pld-blue text-xs uppercase tracking-wider flex items-center gap-1.5">
                                      <FileText size={12} />
                                      Grupo de Notificación
                                   </span>
                                   <span className="text-[10px] text-app-muted font-bold mt-0.5">
                                      DESCARGADO: {grupo.fecha}
                                   </span>
                                </div>
                                <span className="text-[9px] bg-app-bg text-app-text border border-app-border px-2 py-0.5 rounded-md font-bold uppercase shrink-0 self-start sm:self-auto">
                                   {grupo.archivos?.length || 0} {grupo.archivos?.length === 1 ? 'Archivo' : 'Archivos'}
                                </span>
                             </div>
                             
                             <div className="flex flex-col gap-2">
                                {(grupo.archivos || []).map((archivo: any, aIdx: number) => {
                                   let friendlyLabel = "Archivo Adjunto";
                                   if (archivo.nombre.startsWith('MERGED_')) {
                                      friendlyLabel = "PDF Fusionado (Carta + Constancia)";
                                   } else if (archivo.nombre.includes('Carta_') || archivo.nombre.toLowerCase().includes('carta')) {
                                      friendlyLabel = "Carta / Notificación";
                                   } else if (archivo.nombre.startsWith('constancia_')) {
                                      friendlyLabel = "Constancia de Recepción";
                                   }

                                   return (
                                      <div key={aIdx} className="flex items-center justify-between bg-app-bg/50 border border-app-border/40 rounded-lg p-2.5 hover:bg-app-bg transition-colors">
                                         <div className="flex flex-col min-w-0 pr-2">
                                            <span className="text-[10px] font-black text-app-text truncate">{archivo.nombre}</span>
                                            <div className="flex gap-2 text-[9px] text-app-muted font-bold mt-0.5">
                                               <span className="text-pld-blue uppercase">{friendlyLabel}</span>
                                               <span>•</span>
                                               <span>{archivo.tamano}</span>
                                            </div>
                                         </div>
                                         <button
                                           onClick={() => handleAbrirConstancia(archivo.ruta)}
                                           className="shrink-0 px-3 py-1.5 bg-pld-blue/10 text-pld-blue rounded-md text-[10px] font-black uppercase hover:bg-pld-blue hover:text-white transition-all active:scale-95 cursor-pointer"
                                         >
                                           Abrir
                                         </button>
                                      </div>
                                   );
                                })}
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};

export default BuzonView;
