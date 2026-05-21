import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
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
  ShieldCheck
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { 
    adminSuggestions, 
    adminUsers, 
    loadAdminSuggestions, 
    loadAdminUsers, 
    resolveAdminSuggestion, 
    startInspectingWorkspace 
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState<'BUZON' | 'USUARIOS'>('BUZON');
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
    <div className="flex-1 overflow-hidden p-6 bg-app-bg text-app-text flex flex-col gap-4">
      
      {/* Encabezado Principal */}
      <div className="flex items-center justify-between border-b border-app-border pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">
            <ShieldCheck size={12} />
            Entorno de Control Admin
          </div>
          <h1 className="text-2xl font-black tracking-tight text-app-text">Panel de Administración</h1>
          <p className="text-[11px] font-semibold text-app-muted mt-0.5">Supervisa usuarios registrados, diagnostica incidentes y audita lógicas contables.</p>
        </div>

        {/* Interruptor de Pestañas */}
        <div className="flex bg-app-bg p-1 rounded-xl border border-app-border shrink-0">
          <button
            onClick={() => setActiveSubTab('BUZON')}
            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
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
            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'USUARIOS' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-app-muted hover:text-app-text'
            }`}
          >
            <Users size={12} />
            Usuarios & Auditoría
          </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Globales (Ocultas al expandir un reporte para maximizar el espacio vertical) */}
      {!selectedSuggestion && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
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
                <div className="flex-1 min-h-0 bg-app-surface border border-app-border rounded-2xl p-6 pb-20 flex flex-col gap-6 shadow-sm overflow-y-auto custom-scrollbar">
                  
                  {/* Cabecera del Detalle */}
                  <div className="flex justify-between items-start border-b border-app-border pb-4 shrink-0">
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
                      <div className="bg-app-bg border border-app-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
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

        ) : (

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
              <table className="w-full text-left text-xs font-semibold text-app-text">
                <thead className="bg-app-bg border-b border-app-border text-[10px] font-black uppercase text-app-muted tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Rol</th>
                    <th className="px-6 py-4 text-center">Empresas</th>
                    <th className="px-6 py-4 text-center">Registros (Com/Ven/Dia)</th>
                    <th className="px-6 py-4">Empresas del Usuario (Inspeccionar)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-app-hover">
                      <td className="px-6 py-4 font-bold text-app-text">{u.name}</td>
                      <td className="px-6 py-4 font-semibold text-app-muted">{u.email}</td>
                      <td className="px-6 py-4">
                        {u.role === 'admin' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">ADMIN</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-app-bg text-app-muted border border-app-border">USER</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-emerald-600">{u.workspaceCount || 0}</td>
                      <td className="px-6 py-4 text-center font-semibold text-app-muted">
                        {u.purchaseCount} / {u.saleCount} / {u.journalCount}
                      </td>
                      <td className="px-6 py-4">
                        {u.workspaces && u.workspaces.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {u.workspaces.map((w: any) => (
                              <div key={w.ruc} className="flex items-center justify-between gap-4 bg-app-bg px-3 py-1.5 rounded-xl border border-app-border">
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-app-text block truncate">{w.name}</span>
                                  <span className="text-[9px] font-semibold text-app-muted block">RUC: {w.ruc}</span>
                                </div>
                                <button
                                  onClick={() => startInspectingWorkspace(u.id, w.ruc, w.name)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-blue-500/20 transition-all cursor-pointer shrink-0 shadow-sm"
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
  );
};
