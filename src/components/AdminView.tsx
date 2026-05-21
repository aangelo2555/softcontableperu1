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
  FileText, 
  Search, 
  ArrowRight,
  TrendingUp, 
  Sparkles,
  Maximize2,
  X,
  ShieldCheck,
  AlertTriangle
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

  // Seleccionar la primera sugerencia por defecto si existe y ninguna está seleccionada
  useEffect(() => {
    if (adminSuggestions.length > 0 && !selectedSuggestion) {
      setSelectedSuggestion(adminSuggestions[0]);
    }
  }, [adminSuggestions]);

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
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">Cálculo</span>;
      case 'INCONSISTENCIA_TRIBUTARIA':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">SUNAT</span>;
      case 'INTERFAZ_USUARIO':
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">Diseño</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">Otro</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PENDIENTE') {
      return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">Pendiente</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resuelto</span>;
  };

  const parseSystemState = (stateStr: string) => {
    try {
      return JSON.parse(stateStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-950 text-slate-100 flex flex-col gap-8">
      
      {/* Encabezado Principal */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-blue-500 uppercase tracking-widest mb-1.5">
            <ShieldCheck size={12} />
            Entorno de Control Admin
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Panel de Administración</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">Supervisa usuarios registrados, diagnostica incidentes y audita lógicas contables.</p>
        </div>

        {/* Interruptor de Pestañas */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('BUZON')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'BUZON' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={14} />
            Buzón Inteligente
            {pendingSuggestionsCount > 0 && (
              <span className="bg-rose-500 text-white font-bold text-[9px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center">
                {pendingSuggestionsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('USUARIOS')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'USUARIOS' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={14} />
            Usuarios & Auditoría
          </button>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex items-center justify-between shadow-xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Usuarios Registrados</span>
            <span className="text-3xl font-black text-white">{totalUsers}</span>
            <span className="text-[10px] font-semibold text-slate-400">En base de datos</span>
          </div>
          <div className="p-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex items-center justify-between shadow-xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reportes Pendientes</span>
            <span className="text-3xl font-black text-rose-400">{pendingSuggestionsCount}</span>
            <span className="text-[10px] font-semibold text-slate-400">Por resolver</span>
          </div>
          <div className="p-4 bg-rose-600/10 border border-rose-500/20 text-rose-400 rounded-2xl">
            <MessageSquare size={24} />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex items-center justify-between shadow-xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Empresas (Workspaces)</span>
            <span className="text-3xl font-black text-emerald-400">{totalWorkspaces}</span>
            <span className="text-[10px] font-semibold text-slate-400">Configuradas</span>
          </div>
          <div className="p-4 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <Building size={24} />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-6 flex items-center justify-between shadow-xl">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Volumen Registros</span>
            <span className="text-3xl font-black text-indigo-400">{totalEntries}</span>
            <span className="text-[10px] font-semibold text-slate-400">Operaciones cargadas</span>
          </div>
          <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
            <Database size={24} />
          </div>
        </div>
      </div>

      {/* Contenido de la Vista Activa */}
      {activeSubTab === 'BUZON' ? (
        
        /* --- BUZÓN INTELIGENTE --- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[500px]">
          
          {/* Listado de Reportes (Izquierda) */}
          <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto max-h-[600px] pr-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              📂 Reportes Recibidos
            </h2>
            
            {sortedSuggestions.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-900 rounded-3xl p-8 text-center text-slate-500 font-semibold text-xs">
                No hay sugerencias registradas.
              </div>
            ) : (
              sortedSuggestions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSuggestion(s)}
                  className={`p-4 border rounded-2xl transition-all cursor-pointer flex flex-col gap-2.5 ${
                    selectedSuggestion?.id === s.id
                      ? 'bg-slate-900 border-blue-500 shadow-lg shadow-blue-500/5'
                      : 'bg-slate-900/30 border-slate-800/80 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {getCategoryBadge(s.id.startsWith('sug-') ? 'ERROR_CALCULO' : 'OTRO')} {/* Categoría simulada por defecto o extraida */}
                      {getStatusBadge(s.status)}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-xs font-bold text-white line-clamp-2 leading-relaxed">
                    {s.user_comment}
                  </p>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-800/50 pt-2 text-[10px] font-semibold text-slate-400">
                    <span className="truncate max-w-[150px]">{s.user_email}</span>
                    <span className="text-blue-400 font-bold">{s.view_context}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detalle del Reporte e Informe IA (Derecha) */}
          <div className="lg:col-span-7 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 flex flex-col gap-6 overflow-y-auto max-h-[600px]">
            {selectedSuggestion ? (
              <div className="flex flex-col gap-6">
                
                {/* Cabecera del Detalle */}
                <div className="flex justify-between items-start border-b border-slate-900 pb-5">
                  <div>
                    <h3 className="text-md font-black text-white">{selectedSuggestion.workspace_name || 'Sin empresa'}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      RUC: <span className="text-slate-300">{selectedSuggestion.workspace_ruc || 'N/A'}</span> • Pestaña: <span className="text-blue-400">{selectedSuggestion.view_context}</span>
                    </p>
                  </div>
                  
                  {selectedSuggestion.status === 'PENDIENTE' && (
                    <button
                      onClick={() => resolveAdminSuggestion(selectedSuggestion.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <CheckCircle size={12} />
                      Resolver Incidencia
                    </button>
                  )}
                </div>

                {/* Comentario del Usuario */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reporte del Usuario</span>
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-bold text-slate-200 leading-relaxed">
                    {selectedSuggestion.user_comment}
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium">Enviado por: {selectedSuggestion.user_email}</span>
                </div>

                {/* Imagen Adjunta si Existe */}
                {selectedSuggestion.image_base64 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Evidencia / Captura Adjunta</span>
                    <div className="relative group max-w-sm rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 p-2">
                      <img 
                        src={selectedSuggestion.image_base64} 
                        alt="Evidencia adjunta" 
                        className="w-full h-auto rounded-xl object-contain max-h-[220px]"
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Datos Técnicos del Formulario</span>
                    <div className="bg-slate-950/50 border border-slate-900 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      {Object.entries(parseSystemState(selectedSuggestion.system_state) || {}).map(([key, val]: any) => (
                        <div key={key} className="bg-slate-950 border border-slate-900/50 p-2 rounded-xl">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block truncate">{key}</span>
                          <span className="text-xs font-bold text-slate-200 mt-1 block truncate">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diagnóstico Contable IA */}
                {selectedSuggestion.ai_analysis && (
                  <div className="bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950/10 border border-blue-900/30 rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-400 uppercase tracking-wider">
                      <BrainCircuit size={16} className="text-blue-400 animate-pulse" />
                      Análisis Contable Inteligente
                    </div>
                    <div className="text-[11px] text-slate-300 font-semibold leading-relaxed whitespace-pre-line border-t border-slate-800/50 pt-3">
                      {selectedSuggestion.ai_analysis}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-500 gap-3">
                <BrainCircuit size={48} className="text-slate-700" />
                <span className="font-bold text-xs">Selecciona un reporte de la izquierda para ver los diagnósticos de regla contable.</span>
              </div>
            )}
          </div>

        </div>

      ) : (

        /* --- AUDITORÍA Y USUARIOS --- */
        <div className="flex flex-col gap-6">
          
          {/* Barra de búsqueda */}
          <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-800/80 px-4 py-3 rounded-2xl max-w-md">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o correo electrónico..."
              className="bg-transparent border-none text-xs font-bold outline-none text-slate-200 w-full placeholder:text-slate-600"
            />
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs font-semibold text-slate-300">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4 text-center">Empresas</th>
                  <th className="px-6 py-4 text-center">Registros (Com/Ven/Dia)</th>
                  <th className="px-6 py-4">Empresas del Usuario (Inspeccionar)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/10">
                    <td className="px-6 py-4 font-bold text-white">{u.name}</td>
                    <td className="px-6 py-4 font-semibold text-slate-400">{u.email}</td>
                    <td className="px-6 py-4">
                      {u.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">ADMIN</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">USER</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-emerald-400">{u.workspaceCount || 0}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-400">
                      {u.purchaseCount} / {u.saleCount} / {u.journalCount}
                    </td>
                    <td className="px-6 py-4">
                      {u.workspaces && u.workspaces.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {u.workspaces.map((w: any) => (
                            <div key={w.ruc} className="flex items-center justify-between gap-4 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-900">
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-white block truncate">{w.name}</span>
                                <span className="text-[9px] font-semibold text-slate-500 block">RUC: {w.ruc}</span>
                              </div>
                              <button
                                onClick={() => startInspectingWorkspace(u.id, w.ruc, w.name)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-blue-500/20 transition-all cursor-pointer shrink-0"
                              >
                                <Eye size={10} />
                                Inspeccionar
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[11px] font-medium">Sin empresas configuradas</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      )}

      {/* Modal Overlay para ver Imagen Ampliada */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-4">
          <button 
            onClick={() => setZoomedImage(null)}
            className="absolute top-6 right-6 p-2 bg-slate-900 border border-slate-800 text-white rounded-full hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
          <img 
            src={zoomedImage} 
            alt="Captura ampliada" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
          />
        </div>
      )}

    </div>
  );
};
