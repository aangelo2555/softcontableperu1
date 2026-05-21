import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { INITIAL_PLAN, type Account } from './logic/plan';
import { SEED_GLOSAS } from './utils/seedCasuistica';
import { determineIGVSubcuenta } from './engine/igvSegmentation';
import toast from 'react-hot-toast';

// --- Shared Interfaces (Sync with DB) ---
export interface PurchaseEntry {
  id: string;
  registro: string;
  fecha: string;
  fecVcto: string;
  tipo_doc: string;
  serie: string;
  numero: string;
  doc_tipo: string;
  doc_num: string;
  nombre: string;
  tipOper: string;
  tipOperCode: string;
  ctaGasto: string;
  ctaAbono: string;
  moneda: string;
  tc: number;
  bi: number;
  igv: number;
  noGravada: number;
  isc: number;
  total: number;
  glosa: string;
  detraccion: number;
  // --- SIRE Fields ---
  car?: string;
  estado_sire?: string;
  icbper?: number;
  otros_tributos?: number;
  id_referencia?: string;
  cuo?: string;
  hash_sire?: string;
  // --- Inventory Association ---
  productId?: string;
  quantity?: number;
}

export interface SaleEntry {
  id: string;
  registro: string;
  fecha: string;
  fecVcto: string;
  tipo_doc: string;
  serie: string;
  numero: string;
  doc_tipo: string;
  doc_num: string;
  nombre: string;
  tipOper: string;
  tipOperCode: string;
  ctaCargo: string;
  ctaIngreso: string;
  moneda: string;
  tc: number;
  bi: number;
  igv: number;
  noGravada: number;
  isc: number;
  total: number;
  glosa: string;
  detraccion: number;
  // --- SIRE Fields ---
  car?: string;
  estado_sire?: string;
  icbper?: number;
  otros_tributos?: number;
  id_referencia?: string;
  cuo?: string;
  hash_sire?: string;
  // --- Inventory Association ---
  productId?: string;
  quantity?: number;
  costo_venta?: number;
}

export interface JournalEntry {
  id: string;
  source: string;
  asiento: string;
  fecha: string;
  glosa: string;
  cta: string;
  desc: string;
  debe: number;
  haber: number;
}

export interface AsientoLine {
  id: number;
  cuenta: string;
  detalle: string;
  debe: number;
  haber: number;
}

export interface AsientoHeader {
  asiento: string;
  fecEmi: string;
  glosa: string;
  anio: string;
  mes: string;
}

export interface AsientoCompleto {
  id: string;
  header: AsientoHeader;
  lines: AsientoLine[];
}

export interface GlosaHabitual {
  id: string;
  category?: string;
  glosa: string;
  lines: { cuenta: string, detalle: string }[];
}

export interface DraftAsiento {
  header: Partial<AsientoHeader>;
  lines: AsientoLine[];
  editingId: string | null;
}

export interface Entity {
  id: string;
  tipo: string;
  ruc: string;
  descripcion: string;
}

export interface MaintenanceRecord {
  id: string;
  periodo: string;
  anexo: string;
  descripcion: string;
  monto: string;
}

export interface CostEntry {
  id: string;
  codigo: string;
  descripcion: string;
  porcentaje: number;
  monto: number;
}

export interface HonorarioEntry {
  id: string;
  registro: string;
  fecha: string;
  tipo_doc: string;
  serie: string;
  numero: string;
  doc_tipo: string;
  doc_num: string;
  nombre: string;
  ctaGasto: string;
  ctaAbono: string;
  bi: number;
  retencion: number;
  total: number;
}

export interface CashMovement {
  id: string;
  fecha: string;
  correlativo: string;
  glosa: string;
  cta: string;
  cta_denom: string;
  debe: number;
  haber: number;
  medio_pago: string;
  tipo_formato: '1.1' | '1.2';
  banco_item?: string;
}

export interface FixedAsset {
  id: string;
  codigo: string;
  descripcion: string;
  marca: string;
  modelo: string;
  serie_placa: string;
  fecha_adquisicion: string;
  fecha_uso: string;
  costo_adquisicion: number;
  saldo_inicial: number;
  adquisiciones: number;
  mejoras: number;
  retiros_bajas: number;
  otros_ajustes: number;
  ajuste_inflacion: number;
  tasa_depreciacion: number;
  deprec_ejercicio: number;
  deprec_bajas: number;
  deprec_otros: number;
  deprec_acum_anterior: number;
  depreciacion_acumulada: number;
  metodo: string;
  cuenta_activo: string;
  cuenta_depreciacion: string;
}

export interface Employee {
  id: string;
  correlativo?: string;
  dni: string;
  nombre: string;
  fecha_nacimiento?: string;
  edad?: number;
  puesto: string;
  fecha_ingreso: string;
  fecha_salida?: string;
  fecha_reingreso?: string;
  regimen_pensionario: string; // ONP, AFP
  cussp?: string;
  dias_trabajados?: number;
  jornal_diario?: number;
  sueldo_basico: number;
  asignacion_familiar: number; // Flag 0/1
  asignacion_familiar_monto?: number;
  horas_extras_cantidad?: number;
  horas_extras_importe?: number;
  total_remuneracion?: number;
  descuento_onp?: number;
  essalud_vida?: number;
  impuesto_renta_5ta?: number;
  retencion_judicial?: number;
  afp_fondo?: number;
  afp_seguro?: number;
  afp_comision?: number;
  total_descuento?: number;
  neto_pagar?: number;
  essalud_empleador?: number;
  sctr_empleador?: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unit_measure: string;
  type_existence: string;
  account_id: string;
  stock_min: number;
  sale_price: number;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  fecha: string;
  tipo_operacion: string;
  tipo_doc: string;
  serie: string;
  numero: string;
  cantidad_in: number;
  costo_unit_in: number;
  total_in: number;
  cantidad_out: number;
  costo_unit_out: number;
  total_out: number;
  cantidad_saldo: number;
  costo_unit_saldo: number;
  total_saldo: number;
  reference_id?: string;
}
export type SectionType = 'ACTIVO_CORRIENTE' | 'ACTIVO_NO_CORRIENTE' | 'PASIVO_CORRIENTE' | 'PASIVO_NO_CORRIENTE' | 'PATRIMONIO';

export interface BalanceInicialItem {
  id: string;
  workspace_id?: string;
  user_id?: string;
  cta: string;
  desc: string;
  debe: number;
  haber: number;
  section: SectionType;
}

export type RegimenCode = 'RG' | 'MYPE' | 'RER' | 'NRUS';

export interface MovimientoData {
  workspace_id: string;
  period: string;
  month: number;
  section: string;
  key: string;
  value: number;
}

export interface CompanyData {
  name: string;
  ruc: string;
  regimenTributario: RegimenCode;
  location: string;
  address: string;
  support: string;
  period: string;
  businessType: 'COMERCIAL' | 'MANUFACTURERA' | 'SERVICIOS';
  logoBase64?: string;
  sol_user?: string;
  sol_pass?: string;
  sunatClientId?: string;
  sunatClientSecret?: string;
  annualIncomeUIT?: number;
}

export interface BuzonMensaje {
  id: string;
  asunto: string;
  fecha: string;
  tieneAdjunto: boolean;
  estado: 'no_leido' | 'leido';
  anexos?: { id: string; nombre: string }[];
}

// ─── Workspace Specific Data ───
export interface WorkspaceState {
  currentCompany: CompanyData;
  purchases: PurchaseEntry[];
  sales: SaleEntry[];
  journal: JournalEntry[];
  asientos: AsientoCompleto[];
  entities: Entity[];
  maintenanceRecords: MaintenanceRecord[];
  costs: CostEntry[];
  honorarios: HonorarioEntry[];
  plan: Account[];
  hhttAdjustments: Record<string, { debe: number, haber: number }>;
  movimientosData: MovimientoData[];
  glosasHabituales: GlosaHabitual[];
  products: Product[];
  inventoryMovements: InventoryMovement[];
  cashMovements: CashMovement[];
  fixedAssets: FixedAsset[];
  employees: Employee[];
  balanceInicial: BalanceInicialItem[];
}

// ─── App Global State ───
export interface AppState extends WorkspaceState {
  activeTab: string;
  showCompanyConfig: boolean;
  isProcessing: boolean;
  theme: 'light' | 'dark';
  workspaces: CompanyData[];
  buzonMensajes: BuzonMensaje[];

  // --- Core Lifecycle ---
  initApp: () => Promise<void>;
  
  // --- Workspace Actions ---
  switchWorkspace: (ruc: string) => Promise<void>;
  createWorkspace: (company: Partial<CompanyData>) => Promise<void>;
  deleteWorkspace: (ruc: string) => Promise<void>;
  updateCompany: (data: Partial<CompanyData>) => Promise<void>;
  
  // --- App Settings ---
  setActiveTab: (tab: string) => void;
  setShowCompanyConfig: (show: boolean) => void;
  toggleTheme: () => void;
  
  // --- Data Actions ---
  savePurchase: (data: PurchaseEntry) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  saveSale: (data: SaleEntry) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  saveHonorario: (data: HonorarioEntry) => Promise<void>;
  deleteHonorario: (id: string) => Promise<void>;
  
  saveAsiento: (header: AsientoHeader, lines: AsientoLine[]) => Promise<string>;
  deleteAsientoById: (id: string) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;

  saveGlosaHabitual: (glosa: string, lines: { cuenta: string, detalle: string }[], category?: string) => Promise<void>;
  deleteGlosaHabitual: (id: string) => Promise<void>;
  seedInitialGlosas: () => Promise<void>;
  seedInitialPlan: () => Promise<void>;

  updateEntity: (id: string, data: Partial<Entity>) => Promise<void>;
  addEntity: (entity: Omit<Entity, 'id'>) => Promise<void>;
  deleteEntity: (id: string) => Promise<void>;

  updateMaintenance: (id: string, data: Partial<MaintenanceRecord>) => Promise<void>;
  updateCost: (id: string, data: Partial<CostEntry>) => Promise<void>;
  addCost: (data: Omit<CostEntry, 'id'>) => Promise<void>;
  deleteCost: (id: string) => Promise<void>;

  setHhttAdjustment: (cta: string, field: 'debe' | 'haber', value: number) => Promise<void>;
  deleteMovimientoData: (month: number, section: string, key: string) => Promise<void>;
  upsertMovimientoData: (data: Omit<MovimientoData, 'workspace_id' | 'period'>) => Promise<void>;
  
  addAccount: (account: Account) => Promise<void>;
  updateAccount: (cta: string, data: Partial<Account>) => Promise<void>;
  deleteAccount: (cta: string) => Promise<void>;

  saveProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  recordInventoryMovement: (m: Omit<InventoryMovement, 'cantidad_saldo' | 'costo_unit_saldo' | 'total_saldo'> & { id?: string }) => Promise<void>;
  deleteInventoryMovement: (id: string) => Promise<void>;
  recalculateKardex: (productId: string) => Promise<void>;

  saveCashMovement: (m: CashMovement) => Promise<void>;
  deleteCashMovement: (id: string) => Promise<void>;

  saveFixedAsset: (a: FixedAsset) => Promise<void>;
  deleteFixedAsset: (id: string) => Promise<void>;

  saveEmployee: (e: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  saveBalanceInicialItem: (item: BalanceInicialItem) => Promise<void>;
  saveBalanceInicialBulk: (items: BalanceInicialItem[]) => Promise<void>;
  deleteBalanceInicialItem: (id: string) => Promise<void>;

  // --- Drafts (Stay in localStorage for UX) ---
  draftCompra: Partial<PurchaseEntry> | null;
  draftVenta: Partial<SaleEntry> | null;
  draftHonorario: Partial<HonorarioEntry> | null;
  draftAsiento: DraftAsiento | null;
  setDraftCompra: (draft: Partial<PurchaseEntry> | null) => void;
  setDraftVenta: (draft: Partial<SaleEntry> | null) => void;
  setDraftHonorario: (draft: Partial<HonorarioEntry> | null) => void;
  setDraftAsiento: (draft: DraftAsiento | null) => void;

  getNextAsientoNumber: () => string;
  getNextPurchaseNumber: () => string;
  getNextSaleNumber: () => string;
  getNextHonorarioNumber: () => string;
  clearAllData: () => Promise<void>;
  backupDatabase: () => Promise<string | null>;
  syncCurrentWorkspace: () => Promise<void>;
  restoreBackup: (data: any) => Promise<void>;
  dbExecute: (sql: string, params?: any[]) => Promise<any>;
  setBuzonMensajes: (mensajes: BuzonMensaje[]) => void;
  markBuzonMensajeAsRead: (id: string) => void;
  centralizeSireRecords: (ruc: string, records: any[], proceso: string) => Promise<void>;
  syncMaintenance: () => Promise<void>;
  // --- Admin & Suggestions ---
  adminSuggestions: any[];
  adminUsers: any[];
  isInspectingUser: boolean;
  originalAdminCompany: CompanyData | null;
  originalAdminWorkspaceData: Partial<WorkspaceState> | null;
  loadAdminSuggestions: () => Promise<void>;
  resolveAdminSuggestion: (id: string) => Promise<void>;
  loadAdminUsers: () => Promise<void>;
  startInspectingWorkspace: (userId: string, ruc: string, companyName: string) => Promise<void>;
  stopInspectingWorkspace: () => Promise<void>;
  sendSuggestion: (comment: string, imageBase64: string | null, category: string, systemState: any) => Promise<void>;
}

// ─── Helpers ───

// ─── Helpers ───

import { webApiBridge } from './services/apiBridge';

// Proxy dinámico para alternar entre modo Escritorio (Electron) y modo Web (Railway)
const electron = new Proxy({}, {
  get(target, prop) {
    const api = (window as any).electronAPI;
    if (!api) {
      // Si no hay electronAPI, usamos el puente web para Railway
      return (webApiBridge as any)[prop] || (() => {
        console.warn(`[STORE] Acción no implementada en modo Web: electron.${String(prop)}`);
        return Promise.resolve(null);
      });
    }
    return api[prop];
  }
}) as any;

const sortPlan = (plan: Account[]): Account[] => {
  return [...plan].sort((a, b) => a.cta.localeCompare(b.cta, undefined, { numeric: true }));
};

function buildJournalEntries(source: 'COMPRA' | 'VENTA' | 'HONORARIO' | 'ASIENTO', data: any, plan: Account[]): JournalEntry[] {
  // Logic from buildPurchaseJournal, buildSaleJournal, etc.
  // Re-implemented here briefly to keep store clean
  if (source === 'COMPRA') {
    const p = data as PurchaseEntry;
    const base = `compra-${p.id}`;
    const entries: JournalEntry[] = [];
    const ctaGasto = (p.ctaGasto || '6011').trim();
    const totalGasto = p.bi + p.noGravada;

    // 1. NATURALEZA (Provisión: 60, 40, 42)
    const natureGlosa = p.glosa || `POR LA COMPRA DE MERCADERIA SEGUN ${p.tipo_doc} ${p.serie}-${p.numero}`;
    
    if (p.bi > 0) entries.push({ id: `${base}-bi`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: ctaGasto, desc: 'BASE IMPONIBLE', debe: p.bi, haber: 0 });
    if (p.noGravada > 0) entries.push({ id: `${base}-nogravada`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: ctaGasto, desc: 'NO GRAVADA', debe: p.noGravada, haber: 0 });
    if (p.igv > 0) {
      const igvSeg = determineIGVSubcuenta(p.tipOperCode);
      entries.push({ id: `${base}-igv`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: igvSeg.subcuenta, desc: igvSeg.description, debe: p.igv, haber: 0 });
    }
    if (p.isc > 0) entries.push({ id: `${base}-isc`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: '4012', desc: 'I.S.C.', debe: p.isc, haber: 0 });
    if (p.total > 0) entries.push({ id: `${base}-total`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: (p.ctaAbono || '4212').trim(), desc: 'EMITIDAS', debe: 0, haber: p.total });

    // 2. DESTINO (Ingreso Almacén: 20, 61)
    if (totalGasto > 0) {
      const acc = plan.find(a => a.cta === ctaGasto);
      if (acc?.amarreDebe && acc?.amarreHaber) {
        const destinationGlosa = 'POR EL INGRESO FISICO MERCADERIA AL ALMACEN';
        entries.push({ id: `${base}-amd`, source, asiento: p.registro, fecha: p.fecha, glosa: destinationGlosa, cta: acc.amarreDebe.trim(), desc: 'DESTINO DEBE', debe: totalGasto, haber: 0 });
        entries.push({ id: `${base}-amh`, source, asiento: p.registro, fecha: p.fecha, glosa: destinationGlosa, cta: acc.amarreHaber.trim(), desc: 'DESTINO HABER', debe: 0, haber: totalGasto });
      }
    }
    return entries;
  }
  if (source === 'VENTA') {
    const s = data as SaleEntry;
    const base = `venta-${s.id}`;
    const entries: JournalEntry[] = [];
    
    // 1. NATURALEZA (Venta: 12, 40, 70)
    if (s.total > 0) entries.push({ id: `${base}-total`, source, asiento: s.registro, fecha: s.fecha, glosa: s.glosa || `VENTA ${s.tipo_doc} ${s.serie}-${s.numero}`, cta: (s.ctaCargo || '1212').trim(), desc: 'EMITIDAS', debe: s.total, haber: 0 });
    if (s.igv > 0) entries.push({ id: `${base}-igv`, source, asiento: s.registro, fecha: s.fecha, glosa: 'IGV VENTA', cta: '40112', desc: 'IGV', debe: 0, haber: s.igv });
    if (s.bi > 0) entries.push({ id: `${base}-bi`, source, asiento: s.registro, fecha: s.fecha, glosa: 'VENTA BI', cta: (s.ctaIngreso || '70111').trim(), desc: 'INGRESOS', debe: 0, haber: s.bi });

    // 2. COSTO DE VENTA (69 / 20) - Solo si hay costo_venta registrado
    if (s.costo_venta && s.costo_venta > 0) {
      const costGlosa = 'Centralización del kárdex Costo de ventas - Formato 13.1';
      entries.push({ id: `${base}-cv-debe`, source, asiento: s.registro, fecha: s.fecha, glosa: costGlosa, cta: '6911', desc: 'COSTO DE VENTAS', debe: s.costo_venta, haber: 0 });
      entries.push({ id: `${base}-cv-haber`, source, asiento: s.registro, fecha: s.fecha, glosa: costGlosa, cta: '2011', desc: 'MERCADERIAS', debe: 0, haber: s.costo_venta });
    }

    return entries;
  }
  if (source === 'HONORARIO') {
    const h = data as HonorarioEntry;
    const base = `honor-${h.id}`;
    const entries: JournalEntry[] = [];
    const glosa = `HONORARIOS ${h.serie}-${h.numero} ${h.nombre}`;

    if (h.bi > 0) entries.push({ id: `${base}-gasto`, source, asiento: h.registro, fecha: h.fecha, glosa, cta: h.ctaGasto || '6322', desc: 'SERVICIOS PRESTADOS', debe: h.bi, haber: 0 });
    if (h.retencion > 0) entries.push({ id: `${base}-ret`, source, asiento: h.registro, fecha: h.fecha, glosa, cta: '40172', desc: 'RETENCION 4TA CATEGORIA', debe: 0, haber: h.retencion });
    if (h.total > 0) entries.push({ id: `${base}-neto`, source, asiento: h.registro, fecha: h.fecha, glosa, cta: h.ctaAbono || '424', desc: 'HONORARIOS POR PAGAR', debe: 0, haber: h.total });

    // Destino (Amarre)
    const acc = plan.find(a => a.cta === h.ctaGasto);
    if (acc?.amarreDebe && acc?.amarreHaber) {
      entries.push({ id: `${base}-amd`, source, asiento: h.registro, fecha: h.fecha, glosa: 'POR EL DESTINO DEL GASTO', cta: acc.amarreDebe, desc: 'GASTO ADMIN', debe: h.bi, haber: 0 });
      entries.push({ id: `${base}-amh`, source, asiento: h.registro, fecha: h.fecha, glosa: 'POR EL DESTINO DEL GASTO', cta: acc.amarreHaber, desc: 'CARGAS IMPUTABLES', debe: 0, haber: h.bi });
    }

    return entries;
  }
  // Simplified for asientos
  return [];
}

const EMPTY_WORKSPACE: WorkspaceState = {
  currentCompany: { name: '', ruc: '', regimenTributario: 'RG', location: '', address: '', support: '', period: '', businessType: 'COMERCIAL', annualIncomeUIT: 0 },
  purchases: [], sales: [], journal: [], asientos: [], entities: [], maintenanceRecords: [], costs: [], honorarios: [], plan: INITIAL_PLAN, hhttAdjustments: {}, movimientosData: [], glosasHabituales: [],
  products: [], inventoryMovements: [], cashMovements: [], fixedAssets: [], employees: [],
  balanceInicial: []
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...EMPTY_WORKSPACE,
      activeTab: 'EMPRESA',
      showCompanyConfig: false,
      isProcessing: false,
      theme: 'dark',
      workspaces: [],
      buzonMensajes: [],
      draftCompra: null, draftVenta: null, draftHonorario: null, draftAsiento: null,
      adminSuggestions: [],
      adminUsers: [],
      isInspectingUser: false,
      originalAdminCompany: null,
      originalAdminWorkspaceData: null,
      
      // --- Lifecycle ---
      initApp: async () => {
        try {
          const workspaces = await electron.dbGetWorkspaces();
          set({ workspaces: workspaces || [] });
          
          const currentRuc = get().currentCompany?.ruc;
          if (currentRuc) {
            const data = await electron.dbGetWorkspaceData(currentRuc);
            if (data) {
              if (!data.plan || data.plan.length === 0) {
                data.plan = INITIAL_PLAN;
              }
              set({ ...data, plan: sortPlan(data.plan) });
            }
          }
        } catch (error) {
          console.error('[STORE] Error en initApp:', error);
        }
      },

      switchWorkspace: async (ruc) => {
        if (!electron) return;
        const data = await electron.dbGetWorkspaceData(ruc);
        const wsInfo = get().workspaces.find(w => w.ruc === ruc);
        if (wsInfo) {
          // Ensure plan is not empty
          if (!data.plan || data.plan.length === 0) {
            data.plan = INITIAL_PLAN;
          }
          set({ currentCompany: wsInfo, ...data, plan: sortPlan(data.plan || []), activeTab: 'EMPRESA' });
          await get().seedInitialGlosas();
          await get().seedInitialPlan();
          set({ plan: sortPlan(get().plan) });
        }
      },

      createWorkspace: async (company) => {
        if (!electron) return;
        await electron.dbSaveWorkspace({ ...company });
        const list = await electron.dbGetWorkspaces();
        set({ workspaces: list });
        await get().switchWorkspace(company.ruc!);
      },

      deleteWorkspace: async (ruc) => {
        if (!electron) return;
        await electron.dbDeleteWorkspace(ruc);
        const list = await electron.dbGetWorkspaces();
        set({ workspaces: list });
      },

      updateCompany: async (data) => {
        if (!electron) return;
        const newInfo = { ...get().currentCompany, ...data };
        await electron.dbSaveWorkspace(newInfo);
        const list = await electron.dbGetWorkspaces();
        set({ currentCompany: newInfo, workspaces: list });
      },

      // --- UI Settings ---
      setActiveTab: (tab) => set({ activeTab: tab }),
      setShowCompanyConfig: (show) => set({ showCompanyConfig: show }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

      // --- Data Persistence (Proxy to DB) ---
      savePurchase: async (p) => {
        const j = buildJournalEntries('COMPRA', p, get().plan);
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT OR REPLACE INTO purchases (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaGasto, ctaAbono, moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [p.id, ruc, p.registro, p.fecha, p.fecVcto, p.tipo_doc, p.serie, p.numero, p.doc_tipo, p.doc_num, p.nombre, p.tipOper, p.tipOperCode, p.ctaGasto, p.ctaAbono, p.moneda, p.tc, p.bi, p.igv, p.noGravada, p.isc, p.total, p.glosa, p.detraccion]);
        
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `compra-${p.id}-%`]);
        for (const entry of j) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber) VALUES (?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber]);
        }
        
        set({ purchases: [...get().purchases.filter(x => x.id !== p.id), p], journal: [...get().journal.filter(x => !x.id.startsWith(`compra-${p.id}`)), ...j] });
      },

      deletePurchase: async (id) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute('DELETE FROM purchases WHERE id = ?', [id]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `compra-${id}-%`]);
        await electron.dbExecute('DELETE FROM inventory_movements WHERE reference_id = ?', [id]);
        
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ 
          purchases: data.purchases, 
          journal: data.journal,
          inventoryMovements: data.inventoryMovements 
        });
      },

      saveSale: async (s) => {
        const j = buildJournalEntries('VENTA', s, get().plan);
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT OR REPLACE INTO sales (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaCargo, ctaIngreso, moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [s.id, ruc, s.registro, s.fecha, s.fecVcto, s.tipo_doc, s.serie, s.numero, s.doc_tipo, s.doc_num, s.nombre, s.tipOper, s.tipOperCode, s.ctaCargo, s.ctaIngreso, s.moneda, s.tc, s.bi, s.igv, s.noGravada, s.isc, s.total, s.glosa, s.detraccion]);
        
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `venta-${s.id}-%`]);
        for (const entry of j) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber) VALUES (?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber]);
        }
        
        set({ sales: [...get().sales.filter(x => x.id !== s.id), s], journal: [...get().journal.filter(x => !x.id.startsWith(`venta-${s.id}`)), ...j] });
      },

      deleteSale: async (id) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute('DELETE FROM sales WHERE id = ?', [id]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `venta-${id}-%`]);
        await electron.dbExecute('DELETE FROM inventory_movements WHERE reference_id = ?', [id]);

        const data = await electron.dbGetWorkspaceData(ruc);
        set({ 
          sales: data.sales, 
          journal: data.journal,
          inventoryMovements: data.inventoryMovements 
        });
      },

      saveHonorario: async (h) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!electron) return;
        
        await electron.dbExecute(`INSERT OR REPLACE INTO honorarios (id, workspace_id, registro, fecha, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, ctaGasto, ctaAbono, bi, retencion, total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [h.id, ruc, h.registro, h.fecha, h.tipo_doc, h.serie, h.numero, h.doc_tipo, h.doc_num, h.nombre, h.ctaGasto, h.ctaAbono, h.bi, h.retencion, h.total]);
        
        // Generar y guardar asientos
        const entries = buildJournalEntries('HONORARIO', h, get().plan);
        for (const entry of entries) {
           await electron.dbExecute(`
             INSERT OR REPLACE INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, [desc], debe, haber)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           `, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber]);
        }
        
        await get().syncCurrentWorkspace();
      },

      deleteHonorario: async (id) => {
        await electron.dbExecute('DELETE FROM honorarios WHERE id = ?', [id]);
        set({ honorarios: get().honorarios.filter(h => h.id !== id) });
      },

      saveAsiento: async (header, lines) => {
        const ruc = get().currentCompany?.ruc || '';
        const id = `asiento-${Date.now()}`;
        await electron.dbExecute(`INSERT OR REPLACE INTO asientos (id, workspace_id, header_json, lines_json) VALUES (?,?,?,?)`, [id, ruc, JSON.stringify(header), JSON.stringify(lines)]);
        
        // Generate journal entries
        const journalEntries: JournalEntry[] = lines
          .filter(line => line.cuenta !== 'GLOSA')
          .map((line, index) => ({
            id: `${id}-line-${index}`,
            source: 'ASIENTO',
            asiento: header.asiento || '',
            fecha: header.fecEmi || new Date().toISOString().split('T')[0],
            glosa: header.glosa || 'ASIENTO MANUAL',
            cta: (line.cuenta || '').trim(),
            desc: line.detalle || header.glosa || '',
            debe: line.debe || 0,
            haber: line.haber || 0
          }));

        for (const entry of journalEntries) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber) VALUES (?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber]);
        }

        // Trigger a data reload
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ ...data });
        return id;
      },

      deleteAsientoById: async (id) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute('DELETE FROM asientos WHERE id = ?', [id]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `${id}-line-%`]);
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ ...data });
      },

      deleteJournalEntry: async (id) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !electron) return;
        await electron.dbExecute(`DELETE FROM journal WHERE id = ? AND workspace_id = ?`, [id, ruc]);
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ ...data });
      },

      saveGlosaHabitual: async (glosa, lines, category) => {
        const ruc = get().currentCompany?.ruc || '';
        const id = `glh-${Date.now()}`;
        const finalCategory = category || 'PERSONAL';
        const newGlosa = { id, glosa, lines, category: finalCategory };
        await electron.dbExecute(`INSERT INTO glosas_habituales (id, workspace_id, category, glosa, lines_json) VALUES (?,?,?,?,?)`, [id, ruc, finalCategory, glosa, JSON.stringify(lines)]);
        set({ glosasHabituales: [...get().glosasHabituales, newGlosa] });
      },

      deleteGlosaHabitual: async (id) => {
        await electron.dbExecute('DELETE FROM glosas_habituales WHERE id = ?', [id]);
        set({ glosasHabituales: get().glosasHabituales.filter(g => g.id !== id) });
      },

      seedInitialGlosas: async () => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;
        
        const existing = get().glosasHabituales;
        for (const seed of SEED_GLOSAS) {
          const found = existing.find(g => g.glosa === seed.glosa);
          if (found) {
            // Update if lines changed
            if (JSON.stringify(found.lines) !== JSON.stringify(seed.lines)) {
              await electron.dbExecute(`UPDATE glosas_habituales SET lines_json = ?, category = ? WHERE id = ?`, [JSON.stringify(seed.lines), seed.category, found.id]);
            }
          } else {
            // Insert as new
            const id = `glh-seed-${seed.glosa.replace(/\s+/g, '-').toLowerCase()}`;
            await electron.dbExecute(`INSERT OR REPLACE INTO glosas_habituales (id, workspace_id, category, glosa, lines_json) VALUES (?,?,?,?,?)`, [id, ruc, seed.category, seed.glosa, JSON.stringify(seed.lines)]);
          }
        }
        
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ glosasHabituales: data.glosasHabituales });
      },

      seedInitialPlan: async () => {
        const existing = get().plan;
        const electron = (window as any).electronAPI;
        if (!electron) return;

        // Si el plan es muy pequeño, inyectar el inicial
        if (existing.length < 200) {
          for (const acc of INITIAL_PLAN) {
            const found = existing.find(a => a.cta === acc.cta);
            if (!found) {
              await electron.dbExecute(`INSERT OR IGNORE INTO plan_global (cta, description, type, reqCenCos, amarreDebe, amarreHaber) VALUES (?,?,?,?,?,?)`, [acc.cta, acc.description, acc.type, acc.reqCenCos ? 1 : 0, acc.amarreDebe, acc.amarreHaber]);
            }
          }
          // Recargar datos
          await get().syncCurrentWorkspace();
        }
      },

      centralizeSireRecords: async (ruc, records, proceso) => {
        for (const r of records) {
          const j = buildJournalEntries(proceso === 'Generar RCE' ? 'COMPRA' : 'VENTA', r, get().plan);
          
          await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `${proceso === 'Generar RCE' ? 'compra' : 'venta'}-${r.id}-%`]);
          
          for (const entry of j) {
            await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber) VALUES (?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber]);
          }

          // Actualizar estado en la tabla de compras/ventas
          const table = proceso === 'Generar RCE' ? 'purchases' : 'sales';
          await electron.dbExecute(`UPDATE ${table} SET estado_sire = 'Aceptado' WHERE id = ?`, [r.id]);
        }
        
        await get().syncCurrentWorkspace();
      },

      updateEntity: async (id, data) => {
        const ruc = get().currentCompany?.ruc || '';
        const entities = get().entities.map(e => e.id === id ? { ...e, ...data } : e);
        const entity = entities.find(e => e.id === id);
        if (entity) {
          await electron.dbExecute(`UPDATE entities SET tipo=?, ruc=?, descripcion=? WHERE id=? AND workspace_id=?`, [entity.tipo, entity.ruc, entity.descripcion, id, ruc]);
        }
        set({ entities });
      },

      addEntity: async (e) => {
        const id = `ent-${Date.now()}`;
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT INTO entities (id, workspace_id, tipo, ruc, descripcion) VALUES (?,?,?,?,?)`, [id, ruc, e.tipo, e.ruc, e.descripcion]);
        set({ entities: [...get().entities, { ...e, id }] });
      },

      deleteEntity: async (id) => {
        await electron.dbExecute('DELETE FROM entities WHERE id = ?', [id]);
        set({ entities: get().entities.filter(e => e.id !== id) });
      },

      setHhttAdjustment: async (cta, field, value) => {
        const ruc = get().currentCompany?.ruc || '';
        const current = get().hhttAdjustments[cta] || { debe: 0, haber: 0 };
        const next = { ...current, [field]: value };
        await electron.dbExecute(`INSERT OR REPLACE INTO hhtt_adjustments (workspace_id, cta, debe, haber) VALUES (?,?,?,?)`, [ruc, cta, next.debe, next.haber]);
        set({ hhttAdjustments: { ...get().hhttAdjustments, [cta]: next } });
      },

      updateAccount: async (cta, data) => {
        const acc = get().plan.find(a => a.cta === cta);
        if (acc) {
          const next = { ...acc, ...data };
          await electron.dbExecute(`UPDATE plan_global SET description=?, type=?, reqCenCos=?, amarreDebe=?, amarreHaber=? WHERE cta=?`, [next.description, next.type, next.reqCenCos ? 1 : 0, next.amarreDebe, next.amarreHaber, cta]);
          set({ plan: sortPlan(get().plan.map(a => a.cta === cta ? next : a)) });
        }
      },

      addAccount: async (a) => {
        await electron.dbExecute(`INSERT INTO plan_global (cta, description, type, reqCenCos, amarreDebe, amarreHaber) VALUES (?,?,?,?,?,?)`, [a.cta, a.description, a.type, a.reqCenCos ? 1 : 0, a.amarreDebe, a.amarreHaber]);
        set({ plan: sortPlan([...get().plan, a]) });
      },

      deleteAccount: async (cta) => {
        await electron.dbExecute('DELETE FROM plan_global WHERE cta = ?', [cta]);
        set({ plan: get().plan.filter(a => a.cta !== cta) });
      },

      updateMaintenance: async (id, data) => {
        const ruc = get().currentCompany?.ruc || '';
        const records = get().maintenanceRecords.map(r => r.id === id ? { ...r, ...data } : r);
        const record = records.find(r => r.id === id);
        if (record) {
          await electron.dbExecute(`UPDATE maintenance SET periodo=?, anexo=?, descripcion=?, monto=? WHERE id=? AND workspace_id=?`, [record.periodo, record.anexo, record.descripcion, record.monto, id, ruc]);
        }
        set({ maintenanceRecords: records });
      },

      updateCost: async (id, data) => {
        const ruc = get().currentCompany?.ruc || '';
        const costs = get().costs.map(c => c.id === id ? { ...c, ...data } : c);
        const cost = costs.find(c => c.id === id);
        if (cost) {
          await electron.dbExecute(`UPDATE costs SET codigo=?, descripcion=?, porcentaje=?, monto=? WHERE id=? AND workspace_id=?`, [cost.codigo, cost.descripcion, cost.porcentaje, cost.monto, id, ruc]);
        }
        set({ costs });
      },

      addCost: async (c) => {
        const id = `cost-${Date.now()}`;
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT INTO costs (id, workspace_id, codigo, descripcion, porcentaje, monto) VALUES (?,?,?,?,?,?)`, [id, ruc, c.codigo, c.descripcion, c.porcentaje, c.monto]);
        set({ costs: [...get().costs, { ...c, id }] });
      },

      deleteCost: async (id) => {
        await electron.dbExecute('DELETE FROM costs WHERE id = ?', [id]);
        set({ costs: get().costs.filter(c => c.id !== id) });
      },

      saveProduct: async (p) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT OR REPLACE INTO products (id, workspace_id, code, name, unit_measure, type_existence, account_id, stock_min, sale_price) VALUES (?,?,?,?,?,?,?,?,?)`, [p.id, ruc, p.code, p.name, p.unit_measure, p.type_existence, p.account_id, p.stock_min, p.sale_price]);
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ products: data.products });
      },

      deleteProduct: async (id) => {
        await electron.dbExecute('DELETE FROM products WHERE id = ?', [id]);
        set({ products: get().products.filter(p => p.id !== id) });
      },

      recordInventoryMovement: async (m) => {
        const ruc = get().currentCompany?.ruc || '';
        
        // Check if movement already exists for this reference (EDIT mode)
        const existing = m.reference_id ? get().inventoryMovements.find(mov => mov.reference_id === m.reference_id) : null;
        
        if (existing) {
          // Update existing movement (recalc will handle balances)
          await electron.dbExecute(`
            UPDATE inventory_movements 
            SET fecha=?, tipo_operacion=?, tipo_doc=?, serie=?, numero=?, 
                cantidad_in=?, costo_unit_in=?, total_in=?, 
                cantidad_out=?, product_id=?
            WHERE id=?`, 
            [m.fecha, m.tipo_operacion, m.tipo_doc, m.serie, m.numero, 
             m.cantidad_in, m.costo_unit_in, m.total_in, 
             m.cantidad_out, m.product_id, existing.id]);
        } else {
          // Insert new
          const id = `inv-${Date.now()}`;
          await electron.dbExecute(`
            INSERT INTO inventory_movements (id, workspace_id, product_id, fecha, tipo_operacion, tipo_doc, serie, numero, cantidad_in, costo_unit_in, total_in, cantidad_out, reference_id) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
            [id, ruc, m.product_id, m.fecha, m.tipo_operacion, m.tipo_doc, m.serie, m.numero, m.cantidad_in, m.costo_unit_in, m.total_in, m.cantidad_out, m.reference_id]);
        }
        
        await get().recalculateKardex(m.product_id);
      },

      deleteInventoryMovement: async (id) => {
        const mov = get().inventoryMovements.find(m => m.id === id);
        await electron.dbExecute('DELETE FROM inventory_movements WHERE id = ?', [id]);
        if (mov) await get().recalculateKardex(mov.product_id);
      },

      recalculateKardex: async (productId: string) => {
        const ruc = get().currentCompany?.ruc || '';
        const data = await electron.dbGetWorkspaceData(ruc);
        let movements = (data.inventoryMovements || [])
          .filter((m: any) => m.product_id === productId)
          .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

        let currentCant = 0;
        let currentTotal = 0;
        let currentCost = 0;

        for (const m of movements) {
          if (m.cantidad_in > 0) {
            currentCant += m.cantidad_in;
            currentTotal += m.total_in;
            currentCost = currentCant > 0 ? currentTotal / currentCant : 0;
            
            m.cantidad_saldo = currentCant;
            m.costo_unit_saldo = currentCost;
            m.total_saldo = currentTotal;
          } else if (m.cantidad_out > 0) {
            m.costo_unit_out = currentCost;
            m.total_out = m.cantidad_out * currentCost;
            
            currentCant -= m.cantidad_out;
            currentTotal -= m.total_out;
            
            m.cantidad_saldo = currentCant;
            m.costo_unit_saldo = currentCost;
            m.total_saldo = currentTotal;
          }

          // Update balances in DB
          await electron.dbExecute(`
            UPDATE inventory_movements 
            SET cantidad_saldo=?, costo_unit_saldo=?, total_saldo=?, 
                costo_unit_out=?, total_out=?
            WHERE id=?`, 
            [m.cantidad_saldo, m.costo_unit_saldo, m.total_saldo, 
             m.costo_unit_out || 0, m.total_out || 0, m.id]);
        }

        const refreshed = await electron.dbGetWorkspaceData(ruc);
        set({ inventoryMovements: refreshed.inventoryMovements });
      },


      deleteMovimientoData: async (month, section, key) => {
        if (!electron) return;
        const current = get().currentCompany || {} as any;
        const ruc = current?.ruc;
        const period = current?.period || new Date().getFullYear().toString();
        
        await electron.dbExecute(`DELETE FROM movimientos_data WHERE workspace_id = ? AND period = ? AND month = ? AND section = ? AND key = ?`, 
          [ruc, period, month, section, key]);
        
        const filtered = get().movimientosData.filter(m => 
          !(m.month === month && m.section === section && m.key === key && m.period === period)
        );
        set({ movimientosData: filtered });
      },

      upsertMovimientoData: async (data) => {
        if (!electron) return;
        const current = get().currentCompany || {} as any;
        const ruc = current?.ruc;
        const period = current?.period || new Date().getFullYear().toString();
        const fullData: MovimientoData = { ...data, workspace_id: ruc, period };
        
        await electron.dbExecute(`
          INSERT INTO movimientos_data (workspace_id, period, month, section, key, value)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(workspace_id, period, month, section, key) DO UPDATE SET value = excluded.value
        `, [fullData.workspace_id, fullData.period, fullData.month, fullData.section, fullData.key, fullData.value]);
        
        const currentList = get().movimientosData;
        const filtered = currentList.filter(m => 
          !(m.month === fullData.month && m.section === fullData.section && m.key === fullData.key && m.period === period)
        );
        set({ movimientosData: [...filtered, fullData] });
      },

      saveCashMovement: async (m) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT OR REPLACE INTO cash_movements (id, workspace_id, fecha, correlativo, glosa, cta, cta_denom, debe, haber, medio_pago, tipo_formato, banco_item) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [m.id, ruc, m.fecha, m.correlativo, m.glosa, m.cta, m.cta_denom, m.debe, m.haber, m.medio_pago, m.tipo_formato, m.banco_item]);
        set({ cashMovements: [...get().cashMovements.filter(x => x.id !== m.id), m] });
      },
      deleteCashMovement: async (id) => {
        await electron.dbExecute('DELETE FROM cash_movements WHERE id = ?', [id]);
        set({ cashMovements: get().cashMovements.filter(x => x.id !== id) });
      },

      saveFixedAsset: async (a) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`
          INSERT OR REPLACE INTO fixed_assets (
            id, workspace_id, codigo, descripcion, marca, modelo, serie_placa,
            fecha_adquisicion, fecha_uso, costo_adquisicion, saldo_inicial, adquisiciones,
            mejoras, retiros_bajas, otros_ajustes, ajuste_inflacion, tasa_depreciacion,
            deprec_ejercicio, deprec_bajas, deprec_otros, deprec_acum_anterior, 
            depreciacion_acumulada, metodo, cuenta_activo, cuenta_depreciacion
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          a.id, ruc, a.codigo, a.descripcion, a.marca || '', a.modelo || '', a.serie_placa || '',
          a.fecha_adquisicion, a.fecha_uso, a.costo_adquisicion, a.saldo_inicial || 0, a.adquisiciones || 0,
          a.mejoras || 0, a.retiros_bajas || 0, a.otros_ajustes || 0, a.ajuste_inflacion || 0, a.tasa_depreciacion,
          a.deprec_ejercicio || 0, a.deprec_bajas || 0, a.deprec_otros || 0, a.deprec_acum_anterior || 0,
          a.depreciacion_acumulada, a.metodo, a.cuenta_activo, a.cuenta_depreciacion
        ]);
        set({ fixedAssets: [...get().fixedAssets.filter(x => x.id !== a.id), a] });
      },
      deleteFixedAsset: async (id) => {
        await electron.dbExecute('DELETE FROM fixed_assets WHERE id = ?', [id]);
        set({ fixedAssets: get().fixedAssets.filter(x => x.id !== id) });
      },

      saveEmployee: async (e) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`
          INSERT OR REPLACE INTO employees (
            id, workspace_id, dni, nombre, fecha_nacimiento, edad, puesto,
            fecha_ingreso, fecha_salida, fecha_reingreso, regimen_pensionario, 
            cussp, dias_trabajados, jornal_diario, sueldo_basico, 
            asignacion_familiar, asignacion_familiar_monto, horas_extras_cantidad,
            horas_extras_importe, total_remuneracion, descuento_onp, essalud_vida,
            impuesto_renta_5ta, retencion_judicial, afp_fondo, afp_seguro, 
            afp_comision, total_descuento, neto_pagar, essalud_empleador, sctr_empleador
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          e.id, ruc, e.dni, e.nombre, e.fecha_nacimiento || '', e.edad || 0, e.puesto,
          e.fecha_ingreso, e.fecha_salida || '', e.fecha_reingreso || '', e.regimen_pensionario,
          e.cussp || '', e.dias_trabajados || 30, e.jornal_diario || 0, e.sueldo_basico,
          e.asignacion_familiar, e.asignacion_familiar_monto || 0, e.horas_extras_cantidad || 0,
          e.horas_extras_importe || 0, e.total_remuneracion || 0, e.descuento_onp || 0, e.essalud_vida || 0,
          e.impuesto_renta_5ta || 0, e.retencion_judicial || 0, e.afp_fondo || 0, e.afp_seguro || 0,
          e.afp_comision || 0, e.total_descuento || 0, e.neto_pagar || 0, e.essalud_empleador || 0, e.sctr_empleador || 0
        ]);
        set({ employees: [...get().employees.filter(x => x.id !== e.id), e] });
      },
      deleteEmployee: async (id) => {
        await electron.dbExecute('DELETE FROM employees WHERE id = ?', [id]);
        set({ employees: get().employees.filter(x => x.id !== id) });
      },

      saveBalanceInicialItem: async (item) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbSaveBalanceInicial(ruc, item);
        set({ balanceInicial: [...get().balanceInicial.filter(x => x.id !== item.id), item] });
      },

      saveBalanceInicialBulk: async (items) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbSaveBalanceInicialBulk(ruc, items);
        set({ balanceInicial: items });
      },

      deleteBalanceInicialItem: async (id) => {
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbDeleteBalanceInicial(ruc, id);
        set({ balanceInicial: get().balanceInicial.filter(x => x.id !== id) });
      },

      // --- Drafts ---
      setDraftCompra: (draft) => set({ draftCompra: draft }),
      setDraftVenta: (draft) => set({ draftVenta: draft }),
      setDraftHonorario: (draft) => set({ draftHonorario: draft }),
      setDraftAsiento: (draft) => set({ draftAsiento: draft }),

      // --- Utils ---
      getNextAsientoNumber: () => `31-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(get().asientos.length + 1).toString().padStart(4, '0')}`,
      getNextPurchaseNumber: () => `02-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(get().purchases.length + 1).toString().padStart(4, '0')}`,
      getNextSaleNumber: () => `01-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(get().sales.length + 1).toString().padStart(4, '0')}`,
      getNextHonorarioNumber: () => `05-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${(get().honorarios.length + 1).toString().padStart(4, '0')}`,
      
      backupDatabase: async () => {
        if (!electron) return null;
        return await electron.dbBackup();
      },

      syncCurrentWorkspace: async () => {
        if (!electron) return;
        const ruc = get().currentCompany?.ruc || '';
        if (ruc) {
          try {
            const data = await electron.dbGetWorkspaceData(ruc);
            if (data) set({ ...data });
          } catch (e) { console.error("Error sincronizando workspace:", e); }
        }
      },

      restoreBackup: async (data) => {
        if (!data || !data.currentCompany?.ruc) {
          toast.error("El archivo de backup no contiene información válida de la empresa.");
          return;
        }

        const ruc = data.currentCompany.ruc;
        
        try {
          set({ isProcessing: true });
          const promise = (async () => {
             // Llamada al nuevo handler atómico del backend
             await electron.dbImportBackup(data);
             
             // Refrescar lista de empresas y cambiar a la nueva
             const list = await electron.dbGetWorkspaces();
             set({ workspaces: list });
             await get().switchWorkspace(ruc);
          })();

          await toast.promise(promise, {
            loading: 'Restaurando y persistiendo backup completo...',
            success: '¡Sistema restaurado y empresa importada con éxito! ✓',
            error: 'Error al restaurar el backup. Verifique el formato del archivo.'
          });
          
        } catch (e: any) {
          console.error("Error crítico persistiendo backup:", e);
          toast.error(`Error crítico: ${e.message || 'Error desconocido'}`);
        } finally {
          set({ isProcessing: false });
        }
      },

      dbExecute: async (sql, params) => {
        return await electron.dbExecute(sql, params);
      },

      clearAllData: async () => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !electron) return;
        
        await electron.dbExecute('DELETE FROM purchases WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM sales WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM asientos WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM honorarios WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM entities WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM maintenance WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM costs WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM hhtt_adjustments WHERE workspace_id = ?', [ruc]);
        await electron.dbExecute('DELETE FROM movimientos_data WHERE workspace_id = ?', [ruc]);
        
        // Reload
        await get().syncCurrentWorkspace();
      },

      setBuzonMensajes: (mensajes) => set({ buzonMensajes: mensajes }),
      markBuzonMensajeAsRead: (id) => set((s) => ({
        buzonMensajes: s.buzonMensajes.map(m => m.id === id ? { ...m, estado: 'leido' } : m)
      })),
      
      syncMaintenance: async () => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !electron) return;
        
        const journal = get().journal;
        // Agrupar por asiento
        const groups = new Map<string, { periodo: string, anexo: string, glosa: string, monto: number }>();
        
        for (const entry of journal) {
          if (!groups.has(entry.asiento)) {
            const parts = entry.asiento.split('-');
            const anexo = parts[0] || '00';
            const periodo = parts.length >= 2 ? parts[1] : '';
            groups.set(entry.asiento, { 
              periodo, 
              anexo, 
              glosa: entry.glosa, 
              monto: 0 
            });
          }
          const g = groups.get(entry.asiento)!;
          if (entry.debe > 0) g.monto += entry.debe;
        }
        
        // Guardar en DB y refrescar store
        for (const [asiento, data] of groups.entries()) {
           await electron.dbExecute(`
             INSERT OR REPLACE INTO maintenance (id, workspace_id, periodo, anexo, descripcion, monto)
             VALUES (?, ?, ?, ?, ?, ?)
           `, [asiento, ruc, data.periodo, data.anexo, data.glosa, data.monto.toString()]);
        }
        
        await get().syncCurrentWorkspace();
      },

      // --- Admin & Suggestions Actions ---
      loadAdminSuggestions: async () => {
        try {
          const suggestions = await webApiBridge.adminGetSuggestions();
          set({ adminSuggestions: suggestions });
        } catch (error) {
          console.error("Error loading admin suggestions:", error);
        }
      },

      resolveAdminSuggestion: async (id) => {
        try {
          await webApiBridge.adminResolveSuggestion(id);
          set({
            adminSuggestions: get().adminSuggestions.map(s => s.id === id ? { ...s, status: 'RESUELTO' } : s)
          });
          toast.success("Sugerencia marcada como resuelta.");
        } catch (error) {
          console.error("Error resolving suggestion:", error);
          toast.error("Error al resolver la sugerencia.");
        }
      },

      loadAdminUsers: async () => {
        try {
          const users = await webApiBridge.adminGetUsers();
          set({ adminUsers: users });
        } catch (error) {
          console.error("Error loading admin users:", error);
        }
      },

      startInspectingWorkspace: async (userId, ruc, companyName) => {
        try {
          set({ isProcessing: true });
          const userWorkspaceData = await webApiBridge.adminGetUserWorkspaceData(userId, ruc);
          
          if (!userWorkspaceData) {
            toast.error("No se pudo obtener la información de esta empresa.");
            return;
          }
          
          // Respaldar estado del admin
          const originalAdminCompany = get().currentCompany;
          const originalAdminWorkspaceData = {
            purchases: get().purchases,
            sales: get().sales,
            journal: get().journal,
            asientos: get().asientos,
            entities: get().entities,
            maintenanceRecords: get().maintenanceRecords,
            costs: get().costs,
            honorarios: get().honorarios,
            plan: get().plan,
            movimientosData: get().movimientosData,
            glosasHabituales: get().glosasHabituales,
            products: get().products,
            inventoryMovements: get().inventoryMovements,
            cashMovements: get().cashMovements,
            fixedAssets: get().fixedAssets,
            employees: get().employees,
            balanceInicial: get().balanceInicial,
          };
          
          // Cargar datos del usuario
          set({
            isInspectingUser: true,
            originalAdminCompany,
            originalAdminWorkspaceData,
            currentCompany: userWorkspaceData.currentCompany || { name: companyName, ruc },
            ...userWorkspaceData,
            activeTab: 'EMPRESA'
          });
          
          toast.success(`Inspeccionando empresa: ${companyName} ✓`);
        } catch (error) {
          console.error("Error inspecting workspace:", error);
          toast.error("Error al entrar en modo inspección.");
        } finally {
          set({ isProcessing: false });
        }
      },

      stopInspectingWorkspace: async () => {
        const originalCompany = get().originalAdminCompany;
        const originalData = get().originalAdminWorkspaceData;
        
        if (originalCompany && originalData) {
          set({
            isInspectingUser: false,
            originalAdminCompany: null,
            originalAdminWorkspaceData: null,
            currentCompany: originalCompany,
            ...originalData,
            activeTab: 'ADMIN' // Volver al panel de admin
          });
          toast.success("Has salido del modo inspección.");
        } else {
          set({ isInspectingUser: false });
          await get().initApp();
        }
      },

      sendSuggestion: async (comment, imageBase64, category, systemState) => {
        try {
          set({ isProcessing: true });
          const ruc = get().currentCompany?.ruc || '';
          const name = get().currentCompany?.name || '';
          
          await webApiBridge.submitSuggestion({
            workspace_ruc: ruc,
            workspace_name: name,
            view_context: get().activeTab,
            user_comment: comment,
            image_base64: imageBase64,
            system_state: {
              ...systemState,
              regimenTributario: get().currentCompany?.regimenTributario || 'RG',
              businessType: get().currentCompany?.businessType || 'COMERCIAL',
            }
          });
          
          toast.success("Sugerencia inteligente enviada con éxito ✓");
        } catch (error: any) {
          console.error("Error submitting suggestion:", error);
          toast.error(`Error al enviar sugerencia: ${error.message || 'Error desconocido'}`);
        } finally {
          set({ isProcessing: false });
        }
      },
    }),
    {
      name: 'pld-ui-preferences', // Separate storage for UI state
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        activeTab: state.activeTab, 
        theme: state.theme, 
        currentCompany: { ruc: state.currentCompany?.ruc || '' },
        draftCompra: state.draftCompra,
        draftVenta: state.draftVenta,
        draftHonorario: state.draftHonorario,
        draftAsiento: state.draftAsiento
      }),
    }
  )
);


