import React, { useState, useEffect, Suspense, useRef } from 'react';
import { generateMassiveWorkbook } from './utils/massiveExport';
import { useStore } from './store';
import { runMigration } from './utils/migrationRunner';
import { toast, Toaster } from 'react-hot-toast';
import { isTabEnabled } from './utils/tributarioRules';


// Lazy-loaded views
// Direct imports for stability in production
import EmpresaView from './components/EmpresaView';
import ClientesView from './components/ClientesView';
import ComprasView from './components/ComprasView';
import PlanView from './components/PlanView';
import VentasView from './components/VentasView';
import AsientosView from './components/AsientosView';
import BalanceView from './components/BalanceView';
import EgypView from './components/EgypView';
import DatosView from './components/DatosView';
import DiarioView from './components/DiarioView';
import MayorView from './components/MayorView';
import CliProView from './components/CliProView';
import HHTTView from './components/HHTTView';
import CostosView from './components/CostosView';
import MantenimientoView from './components/MantenimientoView';
import HonorariosView from './components/HonorariosView';
import BuzonView from './components/BuzonModule';
import MovimientosView from './components/MovimientosDashboard';
import CajaView from './components/CajaDashboard';
import SireView from './components/SireView';
import ProductosView from './components/ProductosView';
import KardexView from './components/KardexView';
import LibroCajaBancosView from './components/LibroCajaBancosView';
import ActivosFijosView from './components/ActivosFijosView';
import PlanillaView from './components/PlanillaView';
import BalanceAnexosView from './components/BalanceAnexosView';
import FinanceSecondaryView from './components/FinanceSecondaryView';
import RegistroVentas141View from './components/RegistroVentas141View';
import LibroDiario52View from './components/LibroDiario52View';
import BalanceInicialView from './components/BalanceInicialView';
import CCCDashboard from './components/CCCDashboard';
import FinanceNotesView from './components/FinanceNotesView';
import { Login } from './components/Login';
import { AdminView } from './components/AdminView';
import { SuggestionBox } from './components/SuggestionBox';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

import {
  LayoutDashboard,
  Building2,
  Users,
  ShoppingCart,
  Tag,
  BookText,
  CalendarDays,
  BarChart3,
  Scale,
  Calculator,
  ReceiptText,
  Files,
  Database,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  FileText,
  PieChart,
  Wrench,
  Bell,
  Search,
  BookOpen,
  Landmark,
  Briefcase,
  FolderKanban,
  Loader2,
  Activity,
  CloudDownload,
  Package,
  HardDrive,
  FileSearch,
  TrendingUp,
  FileSpreadsheet,
  LogOut
} from 'lucide-react';

// ─── Types ───

interface TabItem {
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
}

interface TabGroup {
  groupLabel: string;
  groupIcon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
  items: TabItem[];
}

// ─── Sidebar Config ───

const SIDEBAR_GROUPS: TabGroup[] = [
  {
    groupLabel: 'Inicio',
    groupIcon: LayoutDashboard,
    items: [
      { id: 'EMPRESA', label: 'Panel Principal', icon: LayoutDashboard },
    ],
  },
  {
    groupLabel: 'Archivos Maestros',
    groupIcon: Briefcase,
    items: [
      { id: 'CLIENTES', label: 'Mis Empresas', icon: Building2 },
      { id: 'CLI_PRO', label: 'Directorio', icon: Users },
      { id: 'PLAN', label: 'Plan Contable', icon: Files },
      { id: 'DATOS', label: 'Tablas Generales', icon: Database },
      { id: 'COSTOS', label: 'Centros de Costo', icon: FolderKanban },
    ],
  },
  {
    groupLabel: 'Operaciones',
    groupIcon: FileText,
    items: [
      { id: 'BALANCE_INICIAL', label: 'Balance Inicial', icon: BookOpen },
      { id: 'COMPRAS', label: 'Compras', icon: ShoppingCart },
      { id: 'VENTAS', label: 'Ventas', icon: Tag },
      { id: 'HONORARIOS', label: 'Honorarios', icon: ReceiptText },
      { id: 'ASIENTOS', label: 'Asientos Diarios', icon: BookText },
    ],
  },
  {
    groupLabel: 'Tesorería',
    groupIcon: Landmark,
    items: [
      { id: 'CAJA', label: 'Caja (Efectivo)', icon: Landmark },
      { id: 'MOVIMIENTOS', label: 'Bancos (Movimientos)', icon: Activity },
    ],
  },
  {
    groupLabel: 'Módulos Auxiliares',
    groupIcon: Package,
    items: [
      { id: 'PRODUCTOS', label: 'Productos', icon: Package },
      { id: 'KARDEX', label: 'Kárdex Valorizado', icon: BookOpen },
      { id: 'ACTIVOS', label: 'Activos Fijos', icon: HardDrive },
      { id: 'PLANILLA', label: 'Planillas', icon: Users },
    ],
  },
  {
    groupLabel: 'Libros Oficiales',
    groupIcon: BookOpen,
    items: [
      { id: 'VENTAS_141', label: 'Registro de Ventas', icon: BookOpen },
      { id: 'CAJABANCOS', label: 'Libro Caja y Bancos', icon: Landmark },
      { id: 'DIARIO', label: 'Libro Diario', icon: CalendarDays },
      { id: 'DIARIO_52', label: 'Libro Diario 5.2', icon: CalendarDays },
      { id: 'MAYOR', label: 'Libro Mayor', icon: BarChart3 },
    ],
  },
  {
    groupLabel: 'Estados Financieros',
    groupIcon: PieChart,
    items: [
      { id: 'HHTT', label: 'Balance de Comprobación', icon: Scale },
      { id: 'EGYP', label: 'Estado de Resultados', icon: Calculator },
      { id: 'BALANCE', label: 'Situación Financiera', icon: Landmark },
      { id: 'ESTADOS_SEC', label: 'E. Efectivo / Patrimonio', icon: TrendingUp },
      { id: 'ANEXOS', label: 'Anexos de Balance', icon: FileSearch },
      { id: 'CCC', label: 'Ciclo Efectivo (CCC)', icon: Activity },
      { id: 'FINANCE_NOTES', label: 'Notas NIIF & NIC 12', icon: FileText },
    ],
  },
  {
    groupLabel: 'Sistema',
    groupIcon: Settings,
    items: [
      { id: 'MANTENIMIENTO', label: 'Configuración', icon: Settings },
    ],
  },
];

const TAB_LABELS: Record<string, string> = {};
SIDEBAR_GROUPS.forEach(g => g.items.forEach(i => { TAB_LABELS[i.id] = i.label; }));
TAB_LABELS['BUZON'] = 'Buzón Electrónico';

function findGroupForTab(tabId: string): string | null {
  for (const group of SIDEBAR_GROUPS) {
    if (group.items.some(item => item.id === tabId)) return group.groupLabel;
  }
  return null;
}

// ─── App Component ───

const App: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    theme, 
    toggleTheme, 
    buzonMensajes, 
    setShowCompanyConfig, 
    currentCompany,
    isInspectingUser,
    stopInspectingWorkspace
  } = useStore();
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('softcontable_token'));

  const handleOpenCompanyConfig = () => {
    setActiveTab('EMPRESA');
    setShowCompanyConfig(true);
    setTimeout(() => {
      const element = document.getElementById('company-config-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const input = document.getElementById('empresa-ruc-input');
        if (input) input.focus({ preventScroll: true });
      }
    }, 150);
  };

  const token = localStorage.getItem('softcontable_token');
  const userPayload = React.useMemo(() => {
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }, [token]);

  const isAdmin = React.useMemo(() => {
    if (!userPayload) return false;
    const email = (userPayload.email || '').trim().toLowerCase();
    return userPayload.role === 'admin' || email === 'aangelo2555@gmail.com' || email.startsWith('admin');
  }, [userPayload]);

  const userName = React.useMemo(() => {
    return userPayload?.name || 'Usuario Online';
  }, [userPayload]);

  const userInitial = React.useMemo(() => {
    return userPayload?.name ? userPayload.name.trim().charAt(0).toUpperCase() : 'U';
  }, [userPayload]);

  const renderView = () => {
    switch (activeTab) {
      case 'EMPRESA': return <EmpresaView />;
      case 'CLIENTES': return <ClientesView />;
      case 'PLAN': return <PlanView />;
      case 'VENTAS': return <VentasView />;
      case 'COMPRAS': return <ComprasView />;
      case 'ASIENTOS': return <AsientosView />;
      case 'BALANCE': return <BalanceView />;
      case 'EGYP': return <EgypView />;
      case 'DATOS': return <DatosView />;
      case 'DIARIO': return <DiarioView />;
      case 'MAYOR': return <MayorView />;
      case 'CLI_PRO': return <CliProView />;
      case 'HHTT': return <HHTTView />;
      case 'COSTOS': return <CostosView />;
      case 'MANTENIMIENTO': return <MantenimientoView />;
      case 'HONORARIOS': return <HonorariosView />;
      case 'MOVIMIENTOS': return <MovimientosView />;
      case 'CAJA': return <CajaView />;
      case 'BUZON': return <BuzonView />;
      case 'SIRE': return <SireView />;
      case 'PRODUCTOS': return <ProductosView />;
      case 'KARDEX': return <KardexView />;
      case 'CAJABANCOS': return <LibroCajaBancosView />;
      case 'VENTAS_141': return <RegistroVentas141View />;
      case 'DIARIO_52': return <LibroDiario52View />;
      case 'ACTIVOS': return <ActivosFijosView />;
      case 'PLANILLA': return <PlanillaView />;
      case 'ANEXOS': return <BalanceAnexosView />;
      case 'ESTADOS_SEC': return <FinanceSecondaryView />;
      case 'BALANCE_INICIAL': return <BalanceInicialView />;
      case 'CCC': return <CCCDashboard />;
      case 'FINANCE_NOTES': return <FinanceNotesView />;
      case 'ADMIN': return <AdminView />;
      default: return <EmpresaView />;
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const activeGroup = findGroupForTab(activeTab);
    if (activeGroup) initial.add(activeGroup);
    return initial;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingMassive, setIsExportingMassive] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const [isInitializing, setIsInitializing] = useState(true);

  // --- SQLite Initialization ---
  useEffect(() => {
    const init = async () => {
      try {
        // Wait a small bit to ensure electronAPI is injected
        await new Promise(r => setTimeout(r, 500));
        
        await runMigration();
        await useStore.getState().initApp();
      } catch (error) {
        console.error("Error initializing SQLite:", error);
        toast.error("Error al conectar con la base de datos.");
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const group = findGroupForTab(activeTab);
    if (group) setExpandedGroups(new Set([group]));
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!isTabEnabled(activeTab, currentCompany)) {
      setActiveTab('EMPRESA');
    }
  }, [activeTab, currentCompany, setActiveTab]);


  const handleBackup = async () => {
    const loadingToast = toast.loading('Creando respaldo...');
    setIsBackingUp(true);
    try {
      const path = await useStore.getState().backupDatabase();
      if (path) {
        toast.success(`¡Respaldo exitoso!\nGuardado en: ${path}`, { id: loadingToast, duration: 5000 });
      }
    } catch (error) {
      toast.error("Error al crear el respaldo.", { id: loadingToast });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleMassiveExport = async () => {
    const loadingToast = toast.loading('Generando libro contable completo...');
    setIsExportingMassive(true);
    try {
      const storeState = useStore.getState();
      const sheetCount = await generateMassiveWorkbook(storeState);
      toast.success(`¡Excel masivo generado con ${sheetCount} hojas!`, { id: loadingToast, duration: 5000 });
    } catch (error: any) {
      console.error('Error en exportación masiva:', error);
      toast.error(`Error al generar Excel: ${error.message}`, { id: loadingToast });
    } finally {
      setIsExportingMassive(false);
    }
  };



  const toggleGroup = (label: string) => {
    if (isSidebarCollapsed) setIsSidebarCollapsed(false);
    setExpandedGroups(prev => {
      if (prev.has(label)) return new Set();
      return new Set([label]);
    });
  };

  const unreadBuzon = buzonMensajes?.filter(m => m.estado === 'no_leido').length ?? 0;


  const filteredGroups = React.useMemo(() => {
    return SIDEBAR_GROUPS.map(group => {
      const items = group.items.filter(item => isTabEnabled(item.id, currentCompany));
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  }, [currentCompany]);

  const computedSidebarGroups = React.useMemo(() => {
    const groups = [...filteredGroups];
    if (isAdmin) {
      groups.push({
        groupLabel: 'Administración',
        groupIcon: ShieldCheck,
        items: [
          { id: 'ADMIN', label: 'Panel Admin', icon: Settings },
        ],
      });
    }
    return groups;
  }, [filteredGroups, isAdmin]);

  const groupHasActiveTab = (group: TabGroup) => group.items.some(item => item.id === activeTab);

  const allTabs = filteredGroups.flatMap(g => g.items);
  const searchResults = searchQuery 
    ? allTabs.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : (isSearchFocused ? allTabs : []);

  if (!isLoggedIn) {
    return <Login />;
  }

  if (isInitializing) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white p-10 text-center">
        <img 
          src="assets/logo.png" 
          alt="Logo" 
          className="w-24 h-24 object-contain mb-6 drop-shadow-[0_0_15px_rgba(37,99,235,0.3)] animate-fade-in" 
        />
        <h1 className="text-2xl font-black mb-2 tracking-tighter text-blue-500">SOFTCONTABLE ERP</h1>
        <p className="text-sm text-slate-400 animate-pulse">Iniciando motor de base de datos...</p>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden bg-app-bg text-app-text font-sans selection:bg-blue-600 selection:text-white transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="flex-1 flex overflow-hidden">
        <Toaster position="top-right" reverseOrder={false} />



      {/* ═══ MOBILE BACKDROP ═══ */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 md:hidden transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed md:relative flex flex-col bg-app-surface border-r border-app-border shrink-0 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out h-full md:h-auto ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isSidebarCollapsed ? 'md:w-[72px]' : 'md:w-64'} w-64`}>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 bg-app-surface shrink-0 border-b border-app-border overflow-hidden" style={{ justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
            <div className="flex items-center gap-3 w-full">
              <img 
                src="assets/logo.png" 
                alt="Logo" 
                className={`transition-all duration-300 ${isSidebarCollapsed ? 'w-10 h-10' : 'w-8 h-8'} object-contain shrink-0`}
              />
              {!isSidebarCollapsed && (
                <span className="font-black tracking-[0.1em] text-[15px] uppercase text-app-text leading-tight whitespace-nowrap animate-fade-in">
                  Softcontable
                </span>
              )}
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 custom-scrollbar flex flex-col gap-1 w-full px-2 bg-app-surface">
          {computedSidebarGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.groupLabel) && !isSidebarCollapsed;
            const isActiveGroup = groupHasActiveTab(group);
            const isSingleItem = group.items.length === 1;

            if (isSingleItem) {
              const tab = group.items[0];
              const isActive = activeTab === tab.id;
              return (
                <div key={group.groupLabel} className="mb-1">
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    title={isSidebarCollapsed ? tab.label : ''}
                    className={`flex items-center w-full rounded-lg transition-all text-[12px] font-bold tracking-wide uppercase ${
                      isSidebarCollapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3 justify-between'
                    } ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                        : 'text-app-muted hover:bg-app-hover hover:text-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-app-muted'} />
                      {!isSidebarCollapsed && <span className="whitespace-nowrap">{tab.label}</span>}
                    </div>
                  </button>
                </div>
              );
            }

            return (
              <div key={group.groupLabel} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.groupLabel)}
                  title={isSidebarCollapsed ? group.groupLabel : ''}
                  className={`flex items-center w-full rounded-lg transition-all text-[12px] font-bold tracking-wide uppercase ${
                    isSidebarCollapsed ? 'px-0 py-3 justify-center' : 'px-4 py-3 justify-between'
                  } ${
                    isActiveGroup && !isExpanded ? 'text-blue-600 bg-blue-50/50' : 'text-app-muted hover:bg-app-hover hover:text-blue-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <group.groupIcon size={18} strokeWidth={isActiveGroup ? 2.5 : 2} className={isActiveGroup ? 'text-blue-600' : 'text-app-muted'} />
                    {!isSidebarCollapsed && <span className="whitespace-nowrap">{group.groupLabel}</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    <ChevronDown size={14} className={`text-app-muted transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  )}
                </button>

                <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  isExpanded ? 'max-h-96 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'
                }`}>
                  <div className="flex flex-col gap-1 border-l-2 border-app-border ml-[22px] pl-3">
                    {group.items.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                              : 'text-app-muted hover:bg-app-hover hover:text-blue-700'
                          }`}
                        >
                          <tab.icon size={16} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 ${isActive ? 'text-white' : 'text-app-muted'}`} />
                          <span className="whitespace-nowrap">{tab.label === 'Honorarios' ? '+ HONORARIOS' : tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Profile & Logout (Full) */}
        <div className={`p-4 border-t border-app-border flex-col gap-3 shrink-0 bg-app-surface/50 ${isSidebarCollapsed ? 'flex md:hidden' : 'flex'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs uppercase shrink-0 shadow-md shadow-blue-600/10 notranslate" translate="no">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase text-app-text leading-tight truncate notranslate" translate="no">{userName}</p>
              <p className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">Usuario</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm('¿Desea cerrar sesión?')) {
                localStorage.removeItem('softcontable_token');
                window.location.reload();
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            <LogOut size={12} />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* User Profile & Logout (Collapsed) */}
        <div className={`p-4 border-t border-app-border flex-col gap-3 shrink-0 bg-app-surface/50 items-center justify-center ${isSidebarCollapsed ? 'hidden md:flex' : 'hidden'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs uppercase shrink-0 shadow-md shadow-blue-600/10 notranslate animate-fade-in" translate="no" title={userName}>
            {userInitial}
          </div>
          <button
            onClick={() => {
              if (window.confirm('¿Desea cerrar sesión?')) {
                localStorage.removeItem('softcontable_token');
                window.location.reload();
              }
            }}
            className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20 cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Bottom: Theme */}
        <div className={`p-4 flex items-center shrink-0 border-t border-app-border ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <span className="text-[11px] font-black tracking-widest uppercase text-app-muted">
              Modo
            </span>
          )}
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-app-bg rounded-full hover:bg-app-hover transition-colors border border-app-border text-app-muted"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isInspectingUser && (
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-white flex items-center justify-between text-xs font-black uppercase tracking-wider shadow-md shrink-0 z-50">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="animate-bounce shrink-0 text-amber-200" />
              <span>Modo Inspector Activo: Estás visualizando los datos de la empresa <strong className="underline">{currentCompany?.name} (RUC: {currentCompany?.ruc})</strong>.</span>
            </div>
            <button
              onClick={stopInspectingWorkspace}
              className="px-3 py-1 bg-white hover:bg-slate-100 text-orange-600 font-extrabold text-[10px] rounded-lg shadow-sm uppercase tracking-widest transition-all cursor-pointer shrink-0"
            >
              Salir de Inspección
            </button>
          </div>
        )}

        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-3 md:px-6 bg-app-surface border-b border-app-border shrink-0 z-10 shadow-sm relative">
          
          {/* Left: Hamburger + Search Bar */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setIsMobileSidebarOpen(!isMobileSidebarOpen);
                } else {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                }
              }}
              className="p-2 text-app-muted hover:text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:text-blue-600 rounded-lg transition-all"
              title="Alternar panel lateral"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>

            <div ref={searchRef} className="relative w-[120px] sm:w-[280px] lg:w-[360px] group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none transition-transform group-focus-within:scale-110">
                <Search size={18} className="text-app-muted/60" strokeWidth={2.5} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-app-bg border border-app-border text-xs font-semibold rounded-xl text-app-text outline-none focus:bg-app-surface focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner placeholder:text-app-muted/60"
                style={{ paddingLeft: '3.25rem' }}
                placeholder="Buscar..."
              />

              {/* Search Results Dropdown */}
              {isSearchFocused && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-app-surface border border-app-border rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in py-1 glass-dropdown">
                  <div className="px-3 py-2 text-[10px] font-black uppercase text-app-muted tracking-widest border-b border-app-border mb-1">
                    Módulos Encontrados
                  </div>
                  {searchResults.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => { setActiveTab(res.id); setSearchQuery(''); setIsSearchFocused(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-app-hover transition-colors text-left"
                    >
                      <div className="p-1.5 bg-blue-50 dark:bg-blue-600/10 rounded-lg">
                        <res.icon size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-app-text uppercase tracking-wide">{res.label}</span>
                        <span className="block text-[10px] font-medium text-app-muted uppercase">{findGroupForTab(res.id)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {isSearchFocused && searchQuery && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-app-surface border border-app-border rounded-xl shadow-xl overflow-hidden z-50 p-4 text-center glass-dropdown">
                  <p className="text-xs font-bold text-app-muted">No se encontraron opciones para "{searchQuery}"</p>
                </div>
              )}
            </div>
            <button
              onClick={handleOpenCompanyConfig}
              className="group h-9 flex items-center justify-start gap-2 px-0 bg-app-bg hover:bg-blue-50 dark:hover:bg-blue-600/10 border border-app-border rounded-xl text-app-text hover:text-blue-600 dark:hover:text-blue-400 font-bold transition-all duration-300 shadow-sm overflow-hidden whitespace-nowrap w-[36px] hover:w-[240px] hover:px-3 relative"
              title="Configuración de la Empresa"
            >
              <div className="w-[34px] shrink-0 flex items-center justify-center absolute left-0">
                <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 text-[10px] uppercase tracking-widest pl-[34px]">Configuración de la Empresa</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-4 md:gap-5">
            {/* Notifications */}
            <button
              onClick={() => setActiveTab('BUZON')}
              className="relative p-2 text-app-muted hover:text-blue-600 transition-colors"
              title="Buzón Electrónico"
            >
              <Bell size={20} strokeWidth={1.5} />
              {unreadBuzon > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-app-surface shadow-sm" />
              )}
            </button>

            {/* SIRE Button */}
            <button
              onClick={() => setActiveTab('SIRE')}
              className={`p-2 transition-colors ${activeTab === 'SIRE' ? 'text-blue-600 bg-blue-50 dark:bg-blue-600/10 rounded-lg' : 'text-app-muted hover:text-blue-600'}`}
              title="Módulo SIRE (Descargas API)"
            >
              <CloudDownload size={20} strokeWidth={1.5} />
            </button>

            {/* Backup Button */}
            {isAdmin && (
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${
                  isBackingUp 
                    ? 'bg-app-bg text-app-muted border-app-border cursor-not-allowed' 
                    : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20'
                }`}
                title="Crear copia de seguridad"
              >
                {isBackingUp ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
                <span className="text-[10px] font-bold uppercase tracking-wider hidden md:block">
                  {isBackingUp ? 'Procesando...' : 'Backup'}
                </span>
              </button>
            )}

            {/* Massive Excel Download */}
            <button
              onClick={handleMassiveExport}
              disabled={isExportingMassive}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${
                isExportingMassive
                  ? 'bg-app-bg text-app-muted border-app-border cursor-not-allowed'
                  : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20'
              }`}
              title="Descargar libro contable completo en Excel"
            >
              {isExportingMassive ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
              <span className="text-[10px] font-bold uppercase tracking-wider hidden md:block">
                {isExportingMassive ? 'Generando...' : 'Excel Masivo'}
              </span>
            </button>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-hidden relative bg-app-bg">
          <div key={activeTab} className="absolute inset-0 animate-fade-in">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-app-muted">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" strokeWidth={2.5} />
                  <span className="text-xs font-bold uppercase tracking-widest">Cargando...</span>
                </div>
              </div>
            }>
              {renderView()}
            </Suspense>
          </div>
          
        </main>

        {/* Faint Footer */}
        <div className="py-2 bg-app-bg text-center shrink-0 border-t border-app-border">
          <span className="text-[9px] font-black uppercase tracking-widest text-app-muted/85">
            Desarrollado por Softcontable • ERP Contable 2026
          </span>
        </div>
      </div>
      <SuggestionBox />
    </div>
  </div>
);
};

export default App;
