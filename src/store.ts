import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { INITIAL_PLAN, type Account } from './logic/plan';
import { SEED_GLOSAS } from './utils/seedCasuistica';
import { determineIGVSubcuenta } from './engine/igvSegmentation';
import { validateDoubleEntry } from './engine/doubleEntryValidator';
import { propagateInvalidation, markModuleSynced, extractPeriodo } from './engine/cascadeInvalidator';
import { isPeriodClosed } from './engine/periodClose';
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
  // --- SPOT / Retenciones / Percepciones ---
  spot_tipo?: string;
  spot_monto?: number;
  spot_constancia?: string;
  spot_fecha?: string;
  retencion_monto?: number;
  retencion_comprobante?: string;
  retencion_fecha?: string;
  percepcion_monto?: number;
  percepcion_comprobante?: string;
  // --- Pago Bancario ---
  pago_monto?: number;
  pago_fecha?: string;
  pago_medio?: string;
  pago_cuenta?: string;
  pago_operacion?: string;
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
  // --- SPOT / Retenciones ---
  spot_tipo?: string;
  spot_monto?: number;
  spot_constancia?: string;
  spot_fecha?: string;
  retencion_monto?: number;
  retencion_comprobante?: string;
  retencion_fecha?: string;
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
  medio_pago?: string;
  nro_transaccion?: string;
  razon_social?: string;
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
  cuenta_debe?: string;
  cuenta_haber?: string;
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

export interface BankStatementLine {
  id?: string;
  workspace_id?: string;
  fecha: string;
  referencia: string;
  glosa: string;
  monto: number;
  reconciled_journal_id?: string | null;
  user_id?: string;
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
  // --- Dual Rate Tax Depreciation ---
  tasa_depreciacion_tributaria?: number;
  deprec_ejercicio_tributaria?: number;
  depreciacion_acumulada_tributaria?: number;
  deprec_acum_anterior_tributaria?: number;
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
  agente_retencion?: boolean;
  regimen?: RegimenCode;
  ciiuCode?: string;
  fixedAssetsValue?: number;
  employeeCount?: number;
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
  bankStatements: BankStatementLine[];
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
  deletePurchases: (ids: string[]) => Promise<void>;
  saveSale: (data: SaleEntry) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  deleteSales: (ids: string[]) => Promise<void>;
  saveHonorario: (data: HonorarioEntry) => Promise<void>;
  deleteHonorario: (id: string) => Promise<void>;
  
  saveAsiento: (header: AsientoHeader, lines: AsientoLine[]) => Promise<string>;
  deleteAsientoById: (id: string, justificacion?: string) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  saveAuditLog: (cuo: string, accion: string, previo: any, nuevo: any, justificacion: string) => Promise<void>;

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
  resetPlanToBase: () => Promise<void>;

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
  autoCentralizeAllProposals: (ruc: string, proceso: string) => Promise<void>;
  syncMaintenance: () => Promise<void>;
  
  // --- Mejora #2 & #5: Control de Períodos y Obsoleto (stale) ---
  periodsList: any[];
  staleVersions: any[];
  checkIfPeriodClosed: (fecha: string) => Promise<boolean>;
  loadPeriods: () => Promise<void>;
  closePeriodAction: (periodo: string, tipo: 'MENSUAL' | 'ANUAL', notas?: string) => Promise<any>;
  reopenPeriodAction: (periodo: string, tipo: 'MENSUAL' | 'ANUAL') => Promise<boolean>;
  triggerCascadeInvalidation: (source: string, fecha: string) => Promise<void>;
  syncStaleVersions: (periodo: string) => Promise<any[]>;
  markSynced: (module: string, periodo: string) => Promise<void>;
  executeProrrata: (periodo: string) => Promise<void>;
  executeFxAdjustment: (periodo: string, tcCompraClosing: number, tcVentaClosing: number) => Promise<void>;
  
  // --- Bank Reconciliation ---
  loadBankStatements: (periodo?: string) => Promise<void>;
  importBankStatements: (lines: BankStatementLine[]) => Promise<boolean>;
  reconcileTransaction: (statementId: string, journalId: string) => Promise<boolean>;
  unreconcileTransaction: (statementId: string) => Promise<boolean>;
  autoMatchBank: (periodo: string) => Promise<number>;

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

  // --- Sprint 5: IFRS/NIIF & NIC 12 ---
  financeNotes: any[] | null;
  deferredTaxComputation: any | null;
  loadFinanceNotes: (periodo: string) => Promise<any[]>;
  saveFinanceNotes: (periodo: string, notes: any[]) => Promise<void>;
  loadDeferredTax: (periodo: string) => Promise<any>;
  saveDeferredTax: (periodo: string, computation: any) => Promise<void>;
  postDeferredTaxJournalEntry: (periodo: string, data: { lines: any[], glosa: string }) => Promise<void>;

  // --- Libro Diario 5.2 ---
  ld52Entries: any[];
  ld52FisicoEntries: any[];
  ld52TotalDebe: number;
  ld52TotalHaber: number;
  ld52BalanceValido: boolean;
  ld52Descuadrados: any[];
  loadLd52Entries: (periodo: string) => Promise<void>;
  loadLd52FisicoEntries: (periodo: string) => Promise<void>;
  generarLd52Masivo: (periodo: string) => Promise<any>;
  registrarLd52Asiento: (lineas: any[]) => Promise<any>;
  corregirLd52Asiento: (cuoOriginal: string, tipo: number, nuevasLineas: any[]) => Promise<any>;
  validarLd52Balance: (periodo: string) => Promise<any>;
  exportarLd52TXT: (periodo: string) => Promise<void>;
  exportarLd52TXT54: (periodo: string) => Promise<void>;

  // --- Libro de Retenciones 4.1 ---
  exportarRetenciones41TXT: (periodo: string) => Promise<void>;
  // --- Libro de Activos Fijos 7.1 ---
  exportarPle71TXT: (periodo: string) => Promise<void>;
  // --- Libro de Costos 10.1 ---
  exportarPle101TXT: (periodo: string) => Promise<void>;
  // --- Libro de Inventario Físico 12.1 ---
  exportarPle121TXT: (periodo: string) => Promise<void>;
  
  // --- Facturación Electrónica UBL 2.1 ---
  facturacionConfigurarCertificadoAction: (password: string, pfxBase64: string) => Promise<any>;
  facturacionEmitirComprobanteAction: (comprobanteId: string) => Promise<any>;
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

function buildDestinationEntries(
  cta: string,
  amount: number,
  plan: Account[],
  baseId: string,
  source: 'COMPRA' | 'VENTA' | 'HONORARIO' | 'ASIENTO',
  asiento: string,
  fecha: string,
  glosa: string
): JournalEntry[] {
  const destEntries: JournalEntry[] = [];
  if (amount <= 0 || !cta.startsWith('6')) return destEntries;

  // Evitamos destinos circulares si la cuenta ya es de amarre (9x o 79)
  if (cta.startsWith('79') || cta.startsWith('9')) return destEntries;

  const acc = plan.find(a => a.cta === cta);
  if (acc && acc.destino_haber && acc.destino_haber.trim() !== '') {
    const destHaber = acc.destino_haber.trim();
    const ccList = [];
    if (acc.cta_cc1 && acc.cta_cc1.trim() !== '' && Number(acc.pct_cc1) > 0) {
      ccList.push({ cta: acc.cta_cc1.trim(), pct: Number(acc.pct_cc1) });
    }
    if (acc.cta_cc2 && acc.cta_cc2.trim() !== '' && Number(acc.pct_cc2) > 0) {
      ccList.push({ cta: acc.cta_cc2.trim(), pct: Number(acc.pct_cc2) });
    }
    if (acc.cta_cc3 && acc.cta_cc3.trim() !== '' && Number(acc.pct_cc3) > 0) {
      ccList.push({ cta: acc.cta_cc3.trim(), pct: Number(acc.pct_cc3) });
    }

    if (ccList.length > 0) {
      const destinationGlosa = glosa || 'POR EL DESTINO DEL GASTO';
      let totalAsignado = 0;
      
      for (let i = 0; i < ccList.length; i++) {
        const cc = ccList[i];
        let montoCc = Number((amount * (cc.pct / 100.0)).toFixed(2));
        
        if (i === ccList.length - 1) {
          montoCc = Number((amount - totalAsignado).toFixed(2));
        } else {
          totalAsignado = Number((totalAsignado + montoCc).toFixed(2));
        }

        if (montoCc > 0) {
          destEntries.push({
            id: `${baseId}-dest-debe-${cta}-${i}`,
            source,
            asiento,
            fecha,
            glosa: destinationGlosa,
            cta: cc.cta,
            desc: `DESTINO DEBE (${cc.pct}%)`,
            debe: montoCc,
            haber: 0
          });
        }
      }

      destEntries.push({
        id: `${baseId}-dest-haber-${cta}`,
        source,
        asiento,
        fecha,
        glosa: destinationGlosa,
        cta: destHaber,
        desc: 'DESTINO HABER',
        debe: 0,
        haber: amount
      });
    }
  }
  return destEntries;
}

function buildJournalEntries(
  source: 'COMPRA' | 'VENTA' | 'HONORARIO' | 'ASIENTO',
  data: any,
  plan: Account[],
  sbsRates?: { compra: number, venta: number }
): JournalEntry[] {
  if (source === 'COMPRA') {
    const p = data as PurchaseEntry;
    const base = `compra-${p.id}`;
    const entries: JournalEntry[] = [];
    const ctaGasto = (p.ctaGasto || '60111').trim();
    
    // Converted amounts in PEN
    const rate = p.tc || 1;
    const isUsd = p.moneda === 'DOLARES';
    
    // Convert to PEN if USD, else use raw values
    const biPEN = isUsd ? Number((p.bi * rate).toFixed(2)) : p.bi;
    const noGravadaPEN = isUsd ? Number((p.noGravada * rate).toFixed(2)) : p.noGravada;
    const igvPEN = isUsd ? Number((p.igv * rate).toFixed(2)) : p.igv;
    const iscPEN = isUsd ? Number((p.isc * rate).toFixed(2)) : p.isc;
    const icbperPEN = isUsd ? Number(((p.icbper || 0) * rate).toFixed(2)) : (p.icbper || 0);
    const otrosTributosPEN = isUsd ? Number(((p.otros_tributos || 0) * rate).toFixed(2)) : (p.otros_tributos || 0);
    const totalPEN = isUsd ? Number((p.total * rate).toFixed(2)) : p.total;
    
    // Perform rounding/balance adjustment to balance the provisión perfectly:
    // SUM(debit) = SUM(credit)
    let adjustedBiPEN = biPEN;
    const sumDebits = Number((biPEN + noGravadaPEN + igvPEN + iscPEN + icbperPEN + otrosTributosPEN).toFixed(2));
    const diff = Number((totalPEN - sumDebits).toFixed(2));
    if (diff !== 0) {
      if (p.bi > 0) {
        adjustedBiPEN = Number((biPEN + diff).toFixed(2));
      }
    }
    
    // Provisión
    const natureGlosa = p.glosa || `POR LA COMPRA DE MERCADERIA SEGUN ${p.tipo_doc} ${p.serie}-${p.numero}`;
    
    if (p.bi > 0) entries.push({ id: `${base}-bi`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: ctaGasto, desc: 'BASE IMPONIBLE', debe: adjustedBiPEN, haber: 0 });
    if (p.noGravada > 0) entries.push({ id: `${base}-nogravada`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: ctaGasto, desc: 'NO GRAVADA', debe: noGravadaPEN, haber: 0 });
    if (p.igv > 0) {
      const igvSeg = determineIGVSubcuenta(p.tipOperCode);
      entries.push({ id: `${base}-igv`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: igvSeg.subcuenta, desc: igvSeg.description, debe: igvPEN, haber: 0 });
    }
    if (p.isc > 0) entries.push({ id: `${base}-isc`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: '4012', desc: 'I.S.C.', debe: iscPEN, haber: 0 });
    if (icbperPEN > 0) entries.push({ id: `${base}-icbper`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: '6419', desc: 'ICBPER COMPRAS', debe: icbperPEN, haber: 0 });
    if (otrosTributosPEN > 0) entries.push({ id: `${base}-otros`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: '6419', desc: 'OTROS TRIBUTOS COMPRAS', debe: otrosTributosPEN, haber: 0 });
    if (p.total > 0) entries.push({ id: `${base}-total`, source, asiento: p.registro, fecha: p.fecha, glosa: natureGlosa, cta: (p.ctaAbono || '4212').trim(), desc: 'EMITIDAS', debe: 0, haber: totalPEN });

    // Destinos dinámicos para todas las cuentas de clase 6 de la provisión
    const provisEntries = [...entries];
    provisEntries.forEach(entry => {
      if (entry.cta.startsWith('6') && entry.debe > 0) {
        const destGlosa = entry.cta.startsWith('60')
          ? 'POR EL INGRESO FISICO MERCADERIA AL ALMACEN'
          : 'POR EL DESTINO DEL GASTO';
        const dests = buildDestinationEntries(
          entry.cta,
          entry.debe,
          plan,
          entry.id,
          source,
          p.registro,
          p.fecha,
          destGlosa
        );
        entries.push(...dests);
      }
    });

    // --- SPOT (Detracción) ---
    if (p.spot_monto && p.spot_monto > 0 && p.spot_constancia && p.spot_fecha) {
      const spotPEN = isUsd ? Number((p.spot_monto * rate).toFixed(2)) : p.spot_monto;
      entries.push({
        id: `${base}-spot-pay-debe`,
        source,
        asiento: p.registro,
        fecha: p.spot_fecha,
        glosa: `PAGO DE DETRACCION CONSTANCIA ${p.spot_constancia}`,
        cta: (p.ctaAbono || '4212').trim(),
        desc: 'PAGO DETRACCION PROVEEDOR',
        debe: spotPEN,
        haber: 0
      });
      entries.push({
        id: `${base}-spot-pay-haber`,
        source,
        asiento: p.registro,
        fecha: p.spot_fecha,
        glosa: `PAGO DE DETRACCION CONSTANCIA ${p.spot_constancia}`,
        cta: '10411',
        desc: 'BANCO DE LA NACION DETRACCIONES',
        debe: 0,
        haber: spotPEN
      });
    }

    // --- Retención ---
    if (p.retencion_monto && p.retencion_monto > 0 && p.retencion_comprobante && p.retencion_fecha) {
      const retPEN = isUsd ? Number((p.retencion_monto * rate).toFixed(2)) : p.retencion_monto;
      entries.push({
        id: `${base}-ret-debe`,
        source,
        asiento: p.registro,
        fecha: p.retencion_fecha,
        glosa: `RETENCION 3% COMPROBANTE ${p.retencion_comprobante}`,
        cta: (p.ctaAbono || '4212').trim(),
        desc: 'RETENCION IGV PROVEEDOR',
        debe: retPEN,
        haber: 0
      });
      entries.push({
        id: `${base}-ret-haber`,
        source,
        asiento: p.registro,
        fecha: p.retencion_fecha,
        glosa: `RETENCION 3% COMPROBANTE ${p.retencion_comprobante}`,
        cta: '40114',
        desc: 'IGV - REGIMEN DE RETENCIONES',
        debe: 0,
        haber: retPEN
      });
    }

    // --- Percepción ---
    if (p.percepcion_monto && p.percepcion_monto > 0) {
      const percPEN = isUsd ? Number((p.percepcion_monto * rate).toFixed(2)) : p.percepcion_monto;
      entries.push({
        id: `${base}-perc-debe`,
        source,
        asiento: p.registro,
        fecha: p.fecha,
        glosa: `PERCEPCION IGV COMPROBANTE ${p.percepcion_comprobante || ''}`,
        cta: '40113',
        desc: 'IGV - REGIMEN DE PERCEPCIONES',
        debe: percPEN,
        haber: 0
      });
      entries.push({
        id: `${base}-perc-haber`,
        source,
        asiento: p.registro,
        fecha: p.fecha,
        glosa: `PERCEPCION IGV COMPROBANTE ${p.percepcion_comprobante || ''}`,
        cta: (p.ctaAbono || '4212').trim(),
        desc: 'PROVEEDOR POR PERCEPCION',
        debe: 0,
        haber: percPEN
      });
    }

    // --- Pago Bancario ---
    if (p.pago_monto && p.pago_monto > 0 && p.pago_fecha && p.pago_cuenta) {
      const pagoPEN = isUsd ? Number((p.pago_monto * rate).toFixed(2)) : p.pago_monto;
      const pagoGlosa = `PAGO ${p.tipo_doc} ${p.serie}-${p.numero}${p.pago_operacion ? ` OP. ${p.pago_operacion}` : ''}`;
      entries.push({
        id: `${base}-pago-debe`,
        source,
        asiento: p.registro,
        fecha: p.pago_fecha,
        glosa: pagoGlosa,
        cta: (p.ctaAbono || '4212').trim(),
        desc: 'PAGO A PROVEEDOR',
        debe: pagoPEN,
        haber: 0,
        medio_pago: p.pago_medio || '',
        nro_transaccion: p.pago_operacion || '',
        razon_social: p.nombre || ''
      });
      entries.push({
        id: `${base}-pago-haber`,
        source,
        asiento: p.registro,
        fecha: p.pago_fecha,
        glosa: pagoGlosa,
        cta: (p.pago_cuenta || '10411').trim(),
        desc: 'SALIDA DE BANCO',
        debe: 0,
        haber: pagoPEN,
        medio_pago: p.pago_medio || '',
        nro_transaccion: p.pago_operacion || '',
        razon_social: p.nombre || ''
      });
    }

    return entries;
  }
  if (source === 'VENTA') {
    const s = data as SaleEntry;
    const base = `venta-${s.id}`;
    const entries: JournalEntry[] = [];
    
    const isUsd = s.moneda === 'DOLARES';
    const tcCompra = isUsd ? (sbsRates?.compra || s.tc || 1) : 1;
    const tcVenta = isUsd ? (sbsRates?.venta || s.tc || 1) : 1;

    // Converted amounts in PEN
    const cta12_pen = isUsd ? Number((s.total * tcCompra).toFixed(2)) : s.total;
    const cta40_pen = isUsd ? Number((s.igv * tcVenta).toFixed(2)) : s.igv;
    const cta70_pen = isUsd ? Number((s.bi * tcCompra).toFixed(2)) : s.bi;
    const noGravada_pen = isUsd ? Number((s.noGravada * tcCompra).toFixed(2)) : s.noGravada;
    const isc_pen = isUsd ? Number((s.isc * tcCompra).toFixed(2)) : s.isc;
    const icbper_pen = isUsd ? Number(((s.icbper || 0) * tcCompra).toFixed(2)) : (s.icbper || 0);
    const otros_pen = isUsd ? Number(((s.otros_tributos || 0) * tcCompra).toFixed(2)) : (s.otros_tributos || 0);

    // 1. NATURALEZA (Venta: 12, 40, 70)
    const natureGlosa = s.glosa || `VENTA ${s.tipo_doc} ${s.serie}-${s.numero}`;
    
    if (cta12_pen > 0) {
      entries.push({ 
        id: `${base}-total`, 
        source, 
        asiento: s.registro, 
        fecha: s.fecha, 
        glosa: natureGlosa, 
        cta: (s.ctaCargo || '1212').trim(), 
        desc: 'EMITIDAS', 
        debe: cta12_pen, 
        haber: 0 
      });
    }

    let adjustedBiPEN = cta70_pen;
    if (isUsd) {
      // Calculate exchange asymmetry difference
      const credits = Number((cta70_pen + cta40_pen + noGravada_pen + isc_pen + icbper_pen + otros_pen).toFixed(2));
      const descuadre = Number((cta12_pen - credits).toFixed(2));
      
      if (descuadre < 0) {
        // Loss -> Cuenta 676
        entries.push({
          id: `${base}-diff-cambio`,
          source,
          asiento: s.registro,
          fecha: s.fecha,
          glosa: 'AJUSTE DIFERENCIA DE CAMBIO VENTAS (ASIMETRIA SBS)',
          cta: '676',
          desc: 'DIFERENCIA DE CAMBIO',
          debe: Math.abs(descuadre),
          haber: 0
        });
      } else if (descuadre > 0) {
        // Gain -> Cuenta 776
        entries.push({
          id: `${base}-diff-cambio`,
          source,
          asiento: s.registro,
          fecha: s.fecha,
          glosa: 'AJUSTE DIFERENCIA DE CAMBIO VENTAS (ASIMETRIA SBS)',
          cta: '776',
          desc: 'DIFERENCIA EN CAMBIO',
          debe: 0,
          haber: descuadre
        });
      }
    } else {
      // For PEN, adjust the base imponible directly if there is a rounding mismatch
      const credits = Number((cta70_pen + cta40_pen + noGravada_pen + isc_pen + icbper_pen + otros_pen).toFixed(2));
      const descuadre = Number((cta12_pen - credits).toFixed(2));
      if (descuadre !== 0 && s.bi > 0) {
        adjustedBiPEN = Number((cta70_pen + descuadre).toFixed(2));
      }
    }

    if (cta40_pen > 0) {
      entries.push({ 
        id: `${base}-igv`, 
        source, 
        asiento: s.registro, 
        fecha: s.fecha, 
        glosa: 'IGV VENTA', 
        cta: '40112', 
        desc: 'IGV', 
        debe: 0, 
        haber: cta40_pen 
      });
    }

    if (adjustedBiPEN > 0) {
      entries.push({ 
        id: `${base}-bi`, 
        source, 
        asiento: s.registro, 
        fecha: s.fecha, 
        glosa: 'VENTA BI', 
        cta: (s.ctaIngreso || '70111').trim(), 
        desc: 'INGRESOS', 
        debe: 0, 
        haber: adjustedBiPEN 
      });
    }

    if (noGravada_pen > 0) {
      entries.push({ 
        id: `${base}-nogravada`, 
        source, 
        asiento: s.registro, 
        fecha: s.fecha, 
        glosa: 'VENTA NO GRAVADA', 
        cta: (s.ctaIngreso || '70111').trim(), 
        desc: 'INGRESOS NO GRAVADOS', 
        debe: 0, 
        haber: noGravada_pen 
      });
    }

    if (isc_pen > 0) {
      entries.push({ 
        id: `${base}-isc`, 
        source, 
        asiento: s.registro, 
        fecha: s.fecha, 
        glosa: 'VENTA ISC', 
        cta: '4012', 
        desc: 'I.S.C. VENTAS', 
        debe: 0, 
        haber: isc_pen 
      });
    }

    if (icbper_pen > 0) {
      entries.push({
        id: `${base}-icbper`,
        source,
        asiento: s.registro,
        fecha: s.fecha,
        glosa: natureGlosa,
        cta: '40189',
        desc: 'ICBPER VENTAS',
        debe: 0,
        haber: icbper_pen
      });
    }

    if (otros_pen > 0) {
      entries.push({
        id: `${base}-otros`,
        source,
        asiento: s.registro,
        fecha: s.fecha,
        glosa: natureGlosa,
        cta: '40189',
        desc: 'OTROS TRIBUTOS VENTAS',
        debe: 0,
        haber: otros_pen
      });
    }

    // --- SPOT (Detracción) ---
    if (s.spot_monto && s.spot_monto > 0 && s.spot_constancia && s.spot_fecha) {
      const spotPEN = isUsd ? Number((s.spot_monto * tcCompra).toFixed(2)) : s.spot_monto;
      entries.push({
        id: `${base}-spot-rec-debe`,
        source,
        asiento: s.registro,
        fecha: s.spot_fecha,
        glosa: `DEPOSITO DE DETRACCION CONSTANCIA ${s.spot_constancia}`,
        cta: '10411',
        desc: 'BANCO DE LA NACION DETRACCIONES',
        debe: spotPEN,
        haber: 0
      });
      entries.push({
        id: `${base}-spot-rec-haber`,
        source,
        asiento: s.registro,
        fecha: s.spot_fecha,
        glosa: `DEPOSITO DE DETRACCION CONSTANCIA ${s.spot_constancia}`,
        cta: (s.ctaCargo || '1212').trim(),
        desc: 'COBRO DETRACCION CLIENTE',
        debe: 0,
        haber: spotPEN
      });
    }

    // --- Retención ---
    if (s.retencion_monto && s.retencion_monto > 0 && s.retencion_comprobante && s.retencion_fecha) {
      const retPEN = isUsd ? Number((s.retencion_monto * tcCompra).toFixed(2)) : s.retencion_monto;
      entries.push({
        id: `${base}-ret-rec-debe`,
        source,
        asiento: s.registro,
        fecha: s.retencion_fecha,
        glosa: `COMPROBANTE DE RETENCION ${s.retencion_comprobante}`,
        cta: '40114',
        desc: 'IGV - REGIMEN DE RETENCIONES',
        debe: retPEN,
        haber: 0
      });
      entries.push({
        id: `${base}-ret-rec-haber`,
        source,
        asiento: s.registro,
        fecha: s.retencion_fecha,
        glosa: `COMPROBANTE DE RETENCION ${s.retencion_comprobante}`,
        cta: (s.ctaCargo || '1212').trim(),
        desc: 'COBRO RETENCION CLIENTE',
        debe: 0,
        haber: retPEN
      });
    }

    // 2. COSTO DE VENTA (69 / 20)
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
    if (h.bi > 0 && h.ctaGasto.startsWith('6')) {
      const acc = plan.find(a => a.cta === h.ctaGasto);
      if (acc && acc.destino_haber && acc.destino_haber.trim() !== '') {
        const destHaber = acc.destino_haber.trim();
        const ccList = [];
        if (acc.cta_cc1 && acc.cta_cc1.trim() !== '' && Number(acc.pct_cc1) > 0) {
          ccList.push({ cta: acc.cta_cc1.trim(), pct: Number(acc.pct_cc1) });
        }
        if (acc.cta_cc2 && acc.cta_cc2.trim() !== '' && Number(acc.pct_cc2) > 0) {
          ccList.push({ cta: acc.cta_cc2.trim(), pct: Number(acc.pct_cc2) });
        }
        if (acc.cta_cc3 && acc.cta_cc3.trim() !== '' && Number(acc.pct_cc3) > 0) {
          ccList.push({ cta: acc.cta_cc3.trim(), pct: Number(acc.pct_cc3) });
        }

        if (ccList.length > 0) {
          const destinationGlosa = 'POR EL DESTINO DEL GASTO';
          let totalAsignado = 0;
          
          for (let i = 0; i < ccList.length; i++) {
            const cc = ccList[i];
            let montoCc = Number((h.bi * (cc.pct / 100.0)).toFixed(2));
            
            // Si es el último, absorber diferencia para cuadrar exacto
            if (i === ccList.length - 1) {
              montoCc = Number((h.bi - totalAsignado).toFixed(2));
            } else {
              totalAsignado = Number((totalAsignado + montoCc).toFixed(2));
            }

            if (montoCc > 0) {
              entries.push({
                id: `${base}-amd-${i}`,
                source,
                asiento: h.registro,
                fecha: h.fecha,
                glosa: destinationGlosa,
                cta: cc.cta,
                desc: `DESTINO DEBE (${cc.pct}%)`,
                debe: montoCc,
                haber: 0
              });
            }
          }

          entries.push({
            id: `${base}-amh`,
            source,
            asiento: h.registro,
            fecha: h.fecha,
            glosa: destinationGlosa,
            cta: destHaber,
            desc: 'DESTINO HABER',
            debe: 0,
            haber: h.bi
          });
        }
      }
    }

    return entries;
  }
  // Simplified for asientos
  return [];
}

const checkPermission = (actionType: 'WRITE' | 'DELETE' | 'PERIOD_CONTROL'): boolean => {
  const token = localStorage.getItem('softcontable_token');
  if (!token) {
    toast.error('⚠️ No autorizado: Inicie sesión.');
    return false;
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const email = (payload.email || '').trim().toLowerCase();
    const isAdmin = payload.role === 'admin' || email === 'aangelo2555@gmail.com' || email.startsWith('admin');
    const role = isAdmin ? 'contador' : (payload.role || 'user');
    
    if (role === 'contador') {
      return true;
    }
    if (role === 'gerente') {
      toast.error('🚫 Acceso denegado: El perfil de GERENTE es de solo lectura.');
      return false;
    }
    if (role === 'asistente') {
      if (actionType === 'DELETE') {
        toast.error('🚫 Acceso denegado: El ASISTENTE no tiene permisos de eliminación.');
        return false;
      }
      if (actionType === 'PERIOD_CONTROL') {
        toast.error('🚫 Acceso denegado: El ASISTENTE no puede cerrar ni reabrir períodos.');
        return false;
      }
      return true;
    }
    return true;
  } catch {
    toast.error('⚠️ Error al validar permisos de usuario.');
    return false;
  }
};

const EMPTY_WORKSPACE: WorkspaceState = {
  currentCompany: { name: '', ruc: '', regimenTributario: 'RG', location: '', address: '', support: '', period: '', businessType: 'COMERCIAL', annualIncomeUIT: 0 },
  purchases: [], sales: [], journal: [], asientos: [], entities: [], maintenanceRecords: [], costs: [], honorarios: [], plan: INITIAL_PLAN, hhttAdjustments: {}, movimientosData: [], glosasHabituales: [],
  products: [], inventoryMovements: [], cashMovements: [], fixedAssets: [], employees: [],
  balanceInicial: [],
  bankStatements: []
};

const employeeSaveTimeouts = new Map<string, any>();
const fixedAssetSaveTimeouts = new Map<string, any>();

const debouncedSaveEmployee = (ruc: string, e: any) => {
  if (employeeSaveTimeouts.has(e.id)) {
    clearTimeout(employeeSaveTimeouts.get(e.id));
  }
  const timeout = setTimeout(async () => {
    employeeSaveTimeouts.delete(e.id);
    try {
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
    } catch (err) {
      console.error('[STORE] debouncedSaveEmployee failed:', err);
    }
  }, 500);
  employeeSaveTimeouts.set(e.id, timeout);
};

const debouncedSaveFixedAsset = (ruc: string, a: any) => {
  if (fixedAssetSaveTimeouts.has(a.id)) {
    clearTimeout(fixedAssetSaveTimeouts.get(a.id));
  }
  const timeout = setTimeout(async () => {
    fixedAssetSaveTimeouts.delete(a.id);
    try {
      await electron.dbExecute(`
        INSERT OR REPLACE INTO fixed_assets (
          id, workspace_id, codigo, descripcion, marca, modelo, serie_placa,
          fecha_adquisicion, fecha_uso, costo_adquisicion, saldo_inicial, adquisiciones,
          mejoras, retiros_bajas, otros_ajustes, ajuste_inflacion, tasa_depreciacion,
          deprec_ejercicio, deprec_bajas, deprec_otros, deprec_acum_anterior, 
          depreciacion_acumulada, metodo, cuenta_activo, cuenta_depreciacion,
          tasa_depreciacion_tributaria, deprec_ejercicio_tributaria,
          depreciacion_acumulada_tributaria, deprec_acum_anterior_tributaria
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        a.id, ruc, a.codigo, a.descripcion, a.marca || '', a.modelo || '', a.serie_placa || '',
        a.fecha_adquisicion, a.fecha_uso, a.costo_adquisicion, a.saldo_inicial || 0, a.adquisiciones || 0,
        a.mejoras || 0, a.retiros_bajas || 0, a.otros_ajustes || 0, a.ajuste_inflacion || 0, a.tasa_depreciacion,
        a.deprec_ejercicio || 0, a.deprec_bajas || 0, a.deprec_otros || 0, a.deprec_acum_anterior || 0,
        a.depreciacion_acumulada, a.metodo, a.cuenta_activo, a.cuenta_depreciacion,
        a.tasa_depreciacion_tributaria || 0, a.deprec_ejercicio_tributaria || 0,
        a.depreciacion_acumulada_tributaria || 0, a.deprec_acum_anterior_tributaria || 0
      ]);
    } catch (err) {
      console.error('[STORE] debouncedSaveFixedAsset failed:', err);
    }
  }, 500);
  fixedAssetSaveTimeouts.set(a.id, timeout);
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...EMPTY_WORKSPACE,
      ld52Entries: [],
      ld52FisicoEntries: [],
      ld52TotalDebe: 0,
      ld52TotalHaber: 0,
      ld52BalanceValido: true,
      ld52Descuadrados: [],
      activeTab: 'EMPRESA',
      showCompanyConfig: false,
      isProcessing: false,
      theme: 'dark',
      workspaces: [],
      buzonMensajes: [],
      periodsList: [],
      staleVersions: [],
      draftCompra: null, draftVenta: null, draftHonorario: null, draftAsiento: null,
      adminSuggestions: [],
      adminUsers: [],
      isInspectingUser: false,
      originalAdminCompany: null,
      originalAdminWorkspaceData: null,
      financeNotes: null,
      deferredTaxComputation: null,
      
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
              await get().seedInitialPlan();
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
        if (!checkPermission('WRITE')) return;
        const ruc = get().currentCompany?.ruc || '';
        
        // ── Guard de Período Cerrado ──
        if (await get().checkIfPeriodClosed(p.fecha)) {
          toast.error(`⚠️ Compra bloqueada: El período ${p.fecha.substring(0, 7)} está CERRADO.`);
          return;
        }

        let sbsRates = undefined;
        if (p.moneda === 'DOLARES') {
          try {
            const res = await electron.dbQuery('SELECT compra, venta FROM sbs_rates WHERE fecha = ?', [p.fecha]);
            const rows = res?.rows || res || [];
            if (rows && rows.length > 0) {
              sbsRates = { compra: Number(rows[0].compra), venta: Number(rows[0].venta) };
            } else {
              const rate = await electron.sbsGetExchangeRate(p.fecha);
              if (rate) {
                sbsRates = { compra: Number(rate.compra), venta: Number(rate.venta) };
              }
            }
          } catch (err) {
            console.warn('[STORE] sbsRate lookup failed, using p.tc:', err);
          }
        }

        const j = buildJournalEntries('COMPRA', p, get().plan, sbsRates);

        // ── Barrera de partida doble (Mejora #1) ──
        try {
          validateDoubleEntry(j);
        } catch (validationError: any) {
          toast.error(`⚠️ Compra bloqueada: ${validationError.message}`);
          console.error('[VALIDACIÓN] Partida doble falló en savePurchase:', validationError);
          return;
        }

        const monto_me = p.moneda === 'DOLARES' ? p.total : 0;
        const tc_origen = p.moneda === 'DOLARES' ? (p.tc || 1) : 1;

        await electron.dbExecute(
          `INSERT OR REPLACE INTO purchases (
            id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, 
            doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaGasto, ctaAbono, 
            moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion, 
            monto_me, tc_origen,
            spot_tipo, spot_monto, spot_constancia, spot_fecha,
            retencion_monto, retencion_comprobante, retencion_fecha,
            percepcion_monto, percepcion_comprobante,
            pago_monto, pago_fecha, pago_medio, pago_cuenta, pago_operacion
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
          [
            p.id, ruc, p.registro, p.fecha, p.fecVcto, p.tipo_doc, p.serie, p.numero, 
            p.doc_tipo, p.doc_num, p.nombre, p.tipOper, p.tipOperCode, p.ctaGasto, p.ctaAbono, 
            p.moneda, p.tc, p.bi, p.igv, p.noGravada, p.isc, p.total, p.glosa, p.detraccion,
            monto_me, tc_origen,
            p.spot_tipo || null, p.spot_monto || 0, p.spot_constancia || null, p.spot_fecha || null,
            p.retencion_monto || 0, p.retencion_comprobante || null, p.retencion_fecha || null,
            p.percepcion_monto || 0, p.percepcion_comprobante || null,
            p.pago_monto || 0, p.pago_fecha || null, p.pago_medio || null, p.pago_cuenta || null, p.pago_operacion || null
          ]
        );
        
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `compra-${p.id}-%`]);
        for (const entry of j) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber, entry.medio_pago || null, entry.nro_transaccion || null, entry.razon_social || null]);
        }
        
        set({ purchases: [...get().purchases.filter(x => x.id !== p.id), p], journal: [...get().journal.filter(x => !x.id.startsWith(`compra-${p.id}`)), ...j] });
        
        // ── Invalidation Cascade Trigger ──
        await get().triggerCascadeInvalidation('journal', p.fecha);

        try {
          await electron.ld52SyncCompra(ruc, p.id);
        } catch (err) {
          console.warn('[STORE] ld52SyncCompra failed:', err);
        }
      },

      deletePurchase: async (id) => {
        if (!checkPermission('DELETE')) return;
        const ruc = get().currentCompany?.ruc || '';
        const item = get().purchases.find(x => x.id === id);
        if (item) {
          // ── Guard de Período Cerrado ──
          if (await get().checkIfPeriodClosed(item.fecha)) {
            toast.error(`⚠️ Eliminación bloqueada: El período ${item.fecha.substring(0, 7)} está CERRADO.`);
            return;
          }
        }

        await electron.dbExecute('DELETE FROM purchases WHERE id = ?', [id]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `compra-${id}-%`]);
        await electron.dbExecute('DELETE FROM inventory_movements WHERE reference_id = ?', [id]);
        
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ 
          purchases: data.purchases, 
          journal: data.journal,
          inventoryMovements: data.inventoryMovements 
        });

        // ── Invalidation Cascade Trigger ──
        if (item) {
          await get().triggerCascadeInvalidation('journal', item.fecha);
        }

        try {
          await electron.ld52DeleteOrigen(ruc, id);
        } catch (err) {
          console.warn('[STORE] ld52DeleteOrigen failed:', err);
        }
      },

      deletePurchases: async (ids) => {
        if (!checkPermission('DELETE')) return;
        const ruc = get().currentCompany?.ruc || '';
        
        const items = get().purchases.filter(x => ids.includes(x.id));
        const datesToCheck = Array.from(new Set(items.map(x => x.fecha)));
        
        for (const date of datesToCheck) {
          if (await get().checkIfPeriodClosed(date)) {
            toast.error(`⚠️ Eliminación bloqueada: Hay comprobantes en el período ${date.substring(0, 7)} que está CERRADO.`);
            return;
          }
        }

        for (const id of ids) {
          await electron.dbExecute('DELETE FROM purchases WHERE id = ?', [id]);
          await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `compra-${id}-%`]);
          await electron.dbExecute('DELETE FROM inventory_movements WHERE reference_id = ?', [id]);
          
          try {
            await electron.ld52DeleteOrigen(ruc, id);
          } catch (err) {
            console.warn('[STORE] ld52DeleteOrigen failed:', err);
          }
        }

        const data = await electron.dbGetWorkspaceData(ruc);
        set({ 
          purchases: data.purchases, 
          journal: data.journal,
          inventoryMovements: data.inventoryMovements 
        });

        for (const date of datesToCheck) {
          await get().triggerCascadeInvalidation('journal', date);
        }
      },

      saveSale: async (s) => {
        if (!checkPermission('WRITE')) return;
        const ruc = get().currentCompany?.ruc || '';

        // ── Guard de Período Cerrado ──
        if (await get().checkIfPeriodClosed(s.fecha)) {
          toast.error(`⚠️ Venta bloqueada: El período ${s.fecha.substring(0, 7)} está CERRADO.`);
          return;
        }

        let sbsRates = undefined;
        if (s.moneda === 'DOLARES') {
          try {
            const res = await electron.dbQuery('SELECT compra, venta FROM sbs_rates WHERE fecha = ?', [s.fecha]);
            const rows = res?.rows || res || [];
            if (rows && rows.length > 0) {
              sbsRates = { compra: Number(rows[0].compra), venta: Number(rows[0].venta) };
            } else {
              const rate = await electron.sbsGetExchangeRate(s.fecha);
              if (rate) {
                sbsRates = { compra: Number(rate.compra), venta: Number(rate.venta) };
              }
            }
          } catch (err) {
            console.warn('[STORE] sbsRate lookup failed, using s.tc:', err);
          }
        }

        const j = buildJournalEntries('VENTA', s, get().plan, sbsRates);

        // ── Barrera de partida doble (Mejora #1) ──
        try {
          validateDoubleEntry(j);
        } catch (validationError: any) {
          toast.error(`⚠️ Venta bloqueada: ${validationError.message}`);
          console.error('[VALIDACIÓN] Partida doble falló en saveSale:', validationError);
          return;
        }

        const monto_me = s.moneda === 'DOLARES' ? s.total : 0;
        const tc_origen = s.moneda === 'DOLARES' ? (sbsRates?.compra || s.tc || 1) : 1;

        await electron.dbExecute(
          `INSERT OR REPLACE INTO sales (
            id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, 
            doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaCargo, ctaIngreso, 
            moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion, 
            monto_me, tc_origen,
            spot_tipo, spot_monto, spot_constancia, spot_fecha,
            retencion_monto, retencion_comprobante, retencion_fecha
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
          [
            s.id, ruc, s.registro, s.fecha, s.fecVcto, s.tipo_doc, s.serie, s.numero, 
            s.doc_tipo, s.doc_num, s.nombre, s.tipOper, s.tipOperCode, s.ctaCargo, s.ctaIngreso, 
            s.moneda, s.tc, s.bi, s.igv, s.noGravada, s.isc, s.total, s.glosa, s.detraccion,
            monto_me, tc_origen,
            s.spot_tipo || null, s.spot_monto || 0, s.spot_constancia || null, s.spot_fecha || null,
            s.retencion_monto || 0, s.retencion_comprobante || null, s.retencion_fecha || null
          ]
        );
        
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `venta-${s.id}-%`]);
        for (const entry of j) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber, entry.medio_pago || null, entry.nro_transaccion || null, entry.razon_social || null]);
        }
        
        set({ sales: [...get().sales.filter(x => x.id !== s.id), s], journal: [...get().journal.filter(x => !x.id.startsWith(`venta-${s.id}`)), ...j] });

        // ── Invalidation Cascade Trigger ──
        await get().triggerCascadeInvalidation('journal', s.fecha);

        try {
          await electron.ld52SyncVenta(ruc, s.id);
        } catch (err) {
          console.warn('[STORE] ld52SyncVenta failed:', err);
        }
      },

      deleteSale: async (id) => {
        if (!checkPermission('DELETE')) return;
        const ruc = get().currentCompany?.ruc || '';
        const item = get().sales.find(x => x.id === id);
        if (item) {
          // ── Guard de Período Cerrado ──
          if (await get().checkIfPeriodClosed(item.fecha)) {
            toast.error(`⚠️ Eliminación bloqueada: El período ${item.fecha.substring(0, 7)} está CERRADO.`);
            return;
          }
        }

        await electron.dbExecute('DELETE FROM sales WHERE id = ?', [id]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `venta-${id}-%`]);
        await electron.dbExecute('DELETE FROM inventory_movements WHERE reference_id = ?', [id]);

        const data = await electron.dbGetWorkspaceData(ruc);
        set({ 
          sales: data.sales, 
          journal: data.journal,
          inventoryMovements: data.inventoryMovements 
        });

        // ── Invalidation Cascade Trigger ──
        if (item) {
          await get().triggerCascadeInvalidation('journal', item.fecha);
        }

        try {
          await electron.ld52DeleteOrigen(ruc, id);
        } catch (err) {
          console.warn('[STORE] ld52DeleteOrigen failed:', err);
        }
      },

      deleteSales: async (ids) => {
        if (!checkPermission('DELETE')) return;
        const ruc = get().currentCompany?.ruc || '';
        
        const items = get().sales.filter(x => ids.includes(x.id));
        const datesToCheck = Array.from(new Set(items.map(x => x.fecha)));
        
        for (const date of datesToCheck) {
          if (await get().checkIfPeriodClosed(date)) {
            toast.error(`⚠️ Eliminación bloqueada: Hay comprobantes en el período ${date.substring(0, 7)} que está CERRADO.`);
            return;
          }
        }

        for (const id of ids) {
          await electron.dbExecute('DELETE FROM sales WHERE id = ?', [id]);
          await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `venta-${id}-%`]);
          await electron.dbExecute('DELETE FROM inventory_movements WHERE reference_id = ?', [id]);
          
          try {
            await electron.ld52DeleteOrigen(ruc, id);
          } catch (err) {
            console.warn('[STORE] ld52DeleteOrigen failed:', err);
          }
        }

        const data = await electron.dbGetWorkspaceData(ruc);
        set({ 
          sales: data.sales, 
          journal: data.journal,
          inventoryMovements: data.inventoryMovements 
        });

        for (const date of datesToCheck) {
          await get().triggerCascadeInvalidation('journal', date);
        }
      },

      saveHonorario: async (h) => {
        if (!checkPermission('WRITE')) return;
        const ruc = get().currentCompany?.ruc || '';
        if (!electron) return;

        // ── Guard de Período Cerrado ──
        if (await get().checkIfPeriodClosed(h.fecha)) {
          toast.error(`⚠️ Honorario bloqueado: El período ${h.fecha.substring(0, 7)} está CERRADO.`);
          return;
        }
        
        // Generar asientos primero para validar
        const entries = buildJournalEntries('HONORARIO', h, get().plan);

        // ── Barrera de partida doble (Mejora #1) ──
        try {
          validateDoubleEntry(entries);
        } catch (validationError: any) {
          toast.error(`⚠️ Honorario bloqueado: ${validationError.message}`);
          console.error('[VALIDACIÓN] Partida doble falló en saveHonorario:', validationError);
          return;
        }

        await electron.dbExecute(`INSERT OR REPLACE INTO honorarios (id, workspace_id, registro, fecha, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, ctaGasto, ctaAbono, bi, retencion, total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [h.id, ruc, h.registro, h.fecha, h.tipo_doc, h.serie, h.numero, h.doc_tipo, h.doc_num, h.nombre, h.ctaGasto, h.ctaAbono, h.bi, h.retencion, h.total]);
        
        // Guardar asientos validados
        for (const entry of entries) {
           await electron.dbExecute(`
              INSERT OR REPLACE INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, [desc], debe, haber)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber]);
         }
        
        await get().syncCurrentWorkspace();

        // ── Invalidation Cascade Trigger ──
        await get().triggerCascadeInvalidation('journal', h.fecha);
      },

      deleteHonorario: async (id) => {
        if (!checkPermission('DELETE')) return;
        const ruc = get().currentCompany?.ruc || '';
        const item = get().honorarios.find(x => x.id === id);
        if (item) {
          // ── Guard de Período Cerrado ──
          if (await get().checkIfPeriodClosed(item.fecha)) {
            toast.error(`⚠️ Eliminación bloqueada: El período ${item.fecha.substring(0, 7)} está CERRADO.`);
            return;
          }
        }

        await electron.dbExecute('DELETE FROM honorarios WHERE id = ?', [id]);
        set({ honorarios: get().honorarios.filter(h => h.id !== id) });

        // ── Invalidation Cascade Trigger ──
        if (item) {
          await get().triggerCascadeInvalidation('journal', item.fecha);
        }
      },

      saveAsiento: async (header, lines) => {
        if (!checkPermission('WRITE')) return `asiento-blocked-${Date.now()}`;
        const ruc = get().currentCompany?.ruc || '';
        const fecha = header.fecEmi || new Date().toISOString().split('T')[0];

        // ── Guard de Período Cerrado ──
        if (await get().checkIfPeriodClosed(fecha)) {
          toast.error(`⚠️ Asiento bloqueado: El período ${fecha.substring(0, 7)} está CERRADO.`);
          return `asiento-blocked-${Date.now()}`;
        }

        const id = `asiento-${Date.now()}`;
        
        // Generate journal entries
        const journalEntries: JournalEntry[] = lines
          .filter(line => line.cuenta !== 'GLOSA')
          .map((line, index) => ({
            id: `${id}-line-${index}`,
            source: 'ASIENTO',
            asiento: header.asiento || '',
            fecha,
            glosa: header.glosa || 'ASIENTO MANUAL',
            cta: (line.cuenta || '').trim(),
            desc: line.detalle || header.glosa || '',
            debe: line.debe || 0,
            haber: line.haber || 0
          }));

        // ── Barrera de partida doble (Mejora #1) ──
        try {
          validateDoubleEntry(journalEntries);
        } catch (validationError: any) {
          toast.error(`⚠️ Asiento bloqueado: ${validationError.message}`);
          console.error('[VALIDACIÓN] Partida doble falló en saveAsiento:', validationError);
          return id; // Retorna id sin persistir
        }

        await electron.dbExecute(`INSERT OR REPLACE INTO asientos (id, workspace_id, header_json, lines_json) VALUES (?,?,?,?)`, [id, ruc, JSON.stringify(header), JSON.stringify(lines)]);

        for (const entry of journalEntries) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber, entry.medio_pago || null, entry.nro_transaccion || null, entry.razon_social || null]);
        }

        // Trigger a data reload
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ ...data });

        // ── Invalidation Cascade Trigger ──
        await get().triggerCascadeInvalidation('journal', fecha);

        return id;
      },

      deleteAsientoById: async (id, justificacion) => {
        if (!checkPermission('DELETE')) return;
        const ruc = get().currentCompany?.ruc || '';
        const item = get().asientos.find(x => x.id === id);
        if (item) {
          const fecha = item.header?.fecEmi || new Date().toISOString().split('T')[0];
          // ── Guard de Período Cerrado ──
          if (await get().checkIfPeriodClosed(fecha)) {
            toast.error(`⚠️ Eliminación bloqueada: El período ${fecha.substring(0, 7)} está CERRADO.`);
            return;
          }
          if (justificacion) {
            await get().saveAuditLog(item.header?.asiento || id, 'DELETE', item, null, justificacion);
          }
        }

        await electron.dbExecute('DELETE FROM asientos WHERE id = ?', [id]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `${id}-line-%`]);
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ ...data });

        // ── Invalidation Cascade Trigger ──
        if (item) {
          const fecha = item.header?.fecEmi || new Date().toISOString().split('T')[0];
          await get().triggerCascadeInvalidation('journal', fecha);
        }
      },

      saveAuditLog: async (cuo, accion, previo, nuevo, justificacion) => {
        const ruc = get().currentCompany?.ruc || '';
        const userId = (window as any).inspectingUserId || localStorage.getItem('softcontable_user_id') || 'default_user';
        const timestamp = new Date().toISOString();
        const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await electron.dbExecute(
          `INSERT INTO audit_logs (id, workspace_id, user_id, timestamp, cuo_afectado, accion, contenido_previo, contenido_nuevo, justificacion)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            id,
            ruc,
            userId,
            timestamp,
            cuo,
            accion,
            previo ? JSON.stringify(previo) : null,
            nuevo ? JSON.stringify(nuevo) : null,
            justificacion
          ]
        );
      },

      deleteJournalEntry: async (id) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !electron) return;
        const entry = get().journal.find(x => x.id === id);
        if (entry) {
          if (await get().checkIfPeriodClosed(entry.fecha)) {
            toast.error(`⚠️ Eliminación bloqueada: El período ${entry.fecha.substring(0, 7)} está CERRADO.`);
            return;
          }
        }
        await electron.dbExecute(`DELETE FROM journal WHERE id = ? AND workspace_id = ?`, [id, ruc]);
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ ...data });

        if (entry) {
          await get().triggerCascadeInvalidation('journal', entry.fecha);
        }
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

        // Clean up obsolete seed glosas from database
        const activeSeedIds = SEED_GLOSAS.map(seed => `glh-seed-${seed.glosa.replace(/\s+/g, '-').toLowerCase()}`);
        if (activeSeedIds.length > 0) {
          const placeholders = activeSeedIds.map(() => '?').join(',');
          await electron.dbExecute(`DELETE FROM glosas_habituales WHERE workspace_id = ? AND id LIKE 'glh-seed-%' AND id NOT IN (${placeholders})`, [ruc, ...activeSeedIds]);
        } else {
          await electron.dbExecute(`DELETE FROM glosas_habituales WHERE workspace_id = ? AND id LIKE 'glh-seed-%'`, [ruc]);
        }
        
        const data = await electron.dbGetWorkspaceData(ruc);
        set({ glosasHabituales: data.glosasHabituales });
      },
      seedInitialPlan: async () => {
        const existing = get().plan;
        const electron = (window as any).electronAPI;
        if (!electron) return;

        // Si el plan tiene menos cuentas que el plan base 2026, inyectar las faltantes
        if (existing.length < INITIAL_PLAN.length) {
          for (const acc of INITIAL_PLAN) {
            const found = existing.find(a => a.cta === acc.cta);
            if (!found) {
              await electron.dbExecute(
                `INSERT OR IGNORE INTO plan_global (
                  cta, description, type, reqCenCos, amarreDebe, amarreHaber,
                  div, cta_cc1, pct_cc1, cta_cc2, pct_cc2, cta_cc3, pct_cc3, destino_haber, niif18_category
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  acc.cta,
                  acc.description,
                  acc.type,
                  acc.reqCenCos ? 1 : 0,
                  acc.amarreDebe || null,
                  acc.amarreHaber || null,
                  acc.div !== undefined ? acc.div : 1,
                  acc.cta_cc1 || null,
                  acc.pct_cc1 !== undefined ? acc.pct_cc1 : 0.0,
                  acc.cta_cc2 || null,
                  acc.pct_cc2 !== undefined ? acc.pct_cc2 : 0.0,
                  acc.cta_cc3 || null,
                  acc.pct_cc3 !== undefined ? acc.pct_cc3 : 0.0,
                  acc.destino_haber || null,
                  acc.niif18_category || null
                ]
              );
            }
          }
          // Recargar datos
          await get().syncCurrentWorkspace();
        }
      },

      // --- Mejora #2 & #5: Acciones de Gestión de Períodos y Obsoletos ---
      checkIfPeriodClosed: async (fecha: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !fecha) return false;
        const periodo = fecha.substring(0, 7);
        try {
          const res = await electron.dbQuery(
            `SELECT estado FROM accounting_periods WHERE workspace_id = ? AND periodo = ? AND tipo = 'MENSUAL'`,
            [ruc, periodo]
          );
          const rows = res?.rows || res || [];
          return rows.some((r: any) => r.estado === 'CERRADO');
        } catch (e) {
          console.error('[PERIOD GUARD] Error comprobando periodo cerrado:', e);
          return false;
        }
      },

      loadPeriods: async () => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;
        try {
          const periods = await webApiBridge.getPeriods(ruc);
          set({ periodsList: periods });
        } catch (e) {
          console.error('[STORE] Error cargando períodos:', e);
        }
      },

      closePeriodAction: async (periodo: string, tipo: 'MENSUAL' | 'ANUAL', notas?: string) => {
        if (!checkPermission('PERIOD_CONTROL')) return { success: false, error: 'Acceso denegado' };
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return null;
        try {
          const res = await webApiBridge.closePeriod(ruc, { periodo, tipo, notas });
          await get().loadPeriods();
          return res;
        } catch (e) {
          console.error('[STORE] Error al cerrar período:', e);
          return { success: false, error: String(e) };
        }
      },

      reopenPeriodAction: async (periodo: string, tipo: 'MENSUAL' | 'ANUAL') => {
        if (!checkPermission('PERIOD_CONTROL')) return false;
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return false;
        try {
          const res = await webApiBridge.reopenPeriod(ruc, { periodo, tipo });
          await get().loadPeriods();
          return res.success;
        } catch (e) {
          console.error('[STORE] Error al reabrir período:', e);
          return false;
        }
      },

      triggerCascadeInvalidation: async (source: string, fecha: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !fecha) return;
        const periodo = extractPeriodo(fecha);
        try {
          await propagateInvalidation(source, ruc, periodo, electron.dbExecute);
        } catch (e) {
          console.error('[CASCADE] Error en propagación cascada:', e);
        }
      },

      syncStaleVersions: async (periodo: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !periodo) return [];
        try {
          const rows = await webApiBridge.getStaleStatus(ruc, periodo);
          // Actualizar estado en store
          set({ staleVersions: rows });
          return rows;
        } catch (e) {
          console.error('[STORE] Error al sincronizar stale versions:', e);
          return [];
        }
      },

      markSynced: async (module: string, periodo: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc || !periodo) return;
        try {
          await markModuleSynced(ruc, periodo, module, electron.dbExecute);
          await get().syncStaleVersions(periodo);
        } catch (e) {
          console.error('[STORE] Error marcando módulo sincronizado:', e);
        }
      },

      executeProrrata: async (periodo: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;
        
        // ── Guard de Período Cerrado ──
        if (await get().checkIfPeriodClosed(`${periodo}-01`)) {
          toast.error(`⚠️ Prorrata bloqueada: El período ${periodo} está CERRADO.`);
          return;
        }

        try {
          const res = await webApiBridge.executeProrrata(ruc, periodo);
          if (res.success) {
            toast.success(`✅ Prorrata calculada con éxito: Factor ${res.data.factor}`);
            // Sync workspace data
            const data = await electron.dbGetWorkspaceData(ruc);
            set({ ...data });
            await get().triggerCascadeInvalidation('journal', `${periodo}-28`);
          } else {
            toast.error(`⚠️ Error al calcular prorrata: ${res.error}`);
          }
        } catch (e: any) {
          toast.error(`⚠️ Error de red al calcular prorrata: ${e.message || e}`);
        }
      },

      executeFxAdjustment: async (periodo: string, tcCompraClosing: number, tcVentaClosing: number) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;

        // ── Guard de Período Cerrado ──
        if (await get().checkIfPeriodClosed(`${periodo}-01`)) {
          toast.error(`⚠️ Diferencial cambiario bloqueado: El período ${periodo} está CERRADO.`);
          return;
        }

        try {
          const { calculateFxAdjustment } = await import('./engine/fxAdjustment');
          const res = calculateFxAdjustment(periodo, get().purchases, get().sales, tcCompraClosing, tcVentaClosing);
          
          const asientoCorrelativo = `AJUS-DIFCAMBIO-${periodo.replace('-', '')}`;
          const lastDay = new Date(Number(periodo.split('-')[0]), Number(periodo.split('-')[1]), 0).getDate();
          const fechaAjuste = `${periodo}-${String(lastDay).padStart(2, '0')}`;

          await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND asiento = ?', [ruc, asientoCorrelativo]);
          
          if (res.adjustingEntries.length > 0) {
            for (const entry of res.adjustingEntries) {
              await electron.dbExecute(
                `INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [entry.id, ruc, entry.source, entry.asiento, fechaAjuste, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber, entry.medio_pago || null, entry.nro_transaccion || null, entry.razon_social || null]
              );
            }
            toast.success(`✅ Ajuste por diferencia de cambio generado: ${res.adjustments.length} documentos procesados.`);
          } else {
            toast.success(`ℹ️ No se requirieron ajustes por diferencia de cambio para el período ${periodo}.`);
          }

          // Reload workspace
          const data = await electron.dbGetWorkspaceData(ruc);
          set({ ...data });
          await get().triggerCascadeInvalidation('journal', fechaAjuste);
        } catch (e: any) {
          toast.error(`⚠️ Error al calcular diferencia de cambio: ${e.message || e}`);
        }
      },

      loadBankStatements: async (periodo?: string) => {
        try {
          const ruc = get().currentCompany?.ruc;
          if (!ruc) return;
          const statements = await electron.getBankStatements(ruc, periodo);
          set({ bankStatements: statements });
        } catch (error) {
          console.error('[STORE] Error loadBankStatements:', error);
        }
      },

      importBankStatements: async (lines: BankStatementLine[]) => {
        try {
          const ruc = get().currentCompany?.ruc;
          if (!ruc) return false;
          const res = await electron.importBankStatements(ruc, lines);
          if (res && res.success) {
            const data = await electron.dbGetWorkspaceData(ruc);
            if (data) {
              set({ bankStatements: data.bankStatements });
            }
            return true;
          }
          return false;
        } catch (error) {
          console.error('[STORE] Error importBankStatements:', error);
          return false;
        }
      },

      reconcileTransaction: async (statementId: string, journalId: string) => {
        try {
          const ruc = get().currentCompany?.ruc;
          if (!ruc) return false;
          const res = await electron.reconcileTransaction(ruc, statementId, journalId);
          if (res && res.success) {
            const data = await electron.dbGetWorkspaceData(ruc);
            if (data) {
              set({ bankStatements: data.bankStatements });
            }
            return true;
          }
          return false;
        } catch (error) {
          console.error('[STORE] Error reconcileTransaction:', error);
          return false;
        }
      },

      unreconcileTransaction: async (statementId: string) => {
        try {
          const ruc = get().currentCompany?.ruc;
          if (!ruc) return false;
          const res = await electron.unreconcileTransaction(ruc, statementId);
          if (res && res.success) {
            const data = await electron.dbGetWorkspaceData(ruc);
            if (data) {
              set({ bankStatements: data.bankStatements });
            }
            return true;
          }
          return false;
        } catch (error) {
          console.error('[STORE] Error unreconcileTransaction:', error);
          return false;
        }
      },

      autoMatchBank: async (periodo: string) => {
        try {
          const ruc = get().currentCompany?.ruc;
          if (!ruc) return 0;
          const res = await electron.autoMatchBank(ruc, periodo);
          if (res && res.success) {
            const data = await electron.dbGetWorkspaceData(ruc);
            if (data) {
              set({ bankStatements: data.bankStatements });
            }
            return res.matchCount || 0;
          }
          return 0;
        } catch (error) {
          console.error('[STORE] Error autoMatchBank:', error);
          return 0;
        }
      },

      centralizeSireRecords: async (ruc, records, proceso) => {
        let blockedCount = 0;
        let closedCount = 0;
        const periodsToInvalidate = new Set<string>();

        for (const r of records) {
          // ── Guard de Período Cerrado ──
          if (await get().checkIfPeriodClosed(r.fecha)) {
            closedCount++;
            continue;
          }

          const j = buildJournalEntries(proceso === 'Generar RCE' ? 'COMPRA' : 'VENTA', r, get().plan);
          
          // Si el registro está anulado o vacío (sin asientos contables con importes > 0), lo omitimos
          if (j.length === 0 || j.every(line => line.debe === 0 && line.haber === 0)) {
            const table = proceso === 'Generar RCE' ? 'purchases' : 'sales';
            await electron.dbExecute(`UPDATE ${table} SET estado_sire = 'Aceptado' WHERE id = ?`, [r.id]);
            continue;
          }
          
          // ── Barrera de partida doble (Mejora #1) ──
          try {
            validateDoubleEntry(j);
          } catch (validationError: any) {
            console.error(`[VALIDACIÓN SIRE] Registro ${r.id} descuadrado:`, validationError.message);
            blockedCount++;
            continue; // Saltar este registro, procesar el resto
          }

          await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `${proceso === 'Generar RCE' ? 'compra' : 'venta'}-${r.id}-%`]);
          
          for (const entry of j) {
            await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber, entry.medio_pago || null, entry.nro_transaccion || null, entry.razon_social || null]);
          }

          // Actualizar estado en la tabla de compras/ventas
          const table = proceso === 'Generar RCE' ? 'purchases' : 'sales';
          await electron.dbExecute(`UPDATE ${table} SET estado_sire = 'Aceptado' WHERE id = ?`, [r.id]);

          periodsToInvalidate.add(r.fecha);
        }
        
        if (blockedCount > 0) {
          toast.error(`⚠️ ${blockedCount} registro(s) SIRE bloqueados por partida doble descuadrada.`);
        }
        if (closedCount > 0) {
          toast.error(`⚠️ ${closedCount} registro(s) SIRE omitidos por pertenecer a un período CERRADO.`);
        }
        
        await get().syncCurrentWorkspace();

        // ── Invalidation Cascade Trigger para cada periodo afectado ──
        for (const fecha of periodsToInvalidate) {
           await get().triggerCascadeInvalidation('journal', fecha);
        }
      },

      autoCentralizeAllProposals: async (ruc, proceso) => {
        const records = proceso === 'Generar RCE' ? get().purchases : get().sales;
        const propuestas = records.filter(r => r.estado_sire === 'Propuesta');
        if (propuestas.length > 0) {
          console.log(`[STORE] Auto-centralizando ${propuestas.length} propuestas de ${proceso}...`);
          await get().centralizeSireRecords(ruc, propuestas, proceso);
        }
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
          await electron.dbExecute(
            `UPDATE plan_global SET description=?, type=?, reqCenCos=?, amarreDebe=?, amarreHaber=?, div=?, cta_cc1=?, pct_cc1=?, cta_cc2=?, pct_cc2=?, cta_cc3=?, pct_cc3=?, destino_haber=?, niif18_category=? WHERE cta=?`,
            [
              next.description, next.type, next.reqCenCos ? 1 : 0,
              next.cta_cc1 || null, next.destino_haber || null,
              next.div !== undefined ? next.div : 1,
              next.cta_cc1 || null, next.pct_cc1 || 0.0,
              next.cta_cc2 || null, next.pct_cc2 || 0.0,
              next.cta_cc3 || null, next.pct_cc3 || 0.0,
              next.destino_haber || null, next.niif18_category || null,
              cta
            ]
          );
          set({ plan: sortPlan(get().plan.map(a => a.cta === cta ? next : a)) });
        }
      },

      addAccount: async (a) => {
        await electron.dbExecute(
          `INSERT INTO plan_global (cta, description, type, reqCenCos, amarreDebe, amarreHaber, div, cta_cc1, pct_cc1, cta_cc2, pct_cc2, cta_cc3, pct_cc3, destino_haber, niif18_category) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            a.cta, a.description, a.type, a.reqCenCos ? 1 : 0,
            a.cta_cc1 || null, a.destino_haber || null,
            a.div !== undefined ? a.div : 1,
            a.cta_cc1 || null, a.pct_cc1 || 0.0,
            a.cta_cc2 || null, a.pct_cc2 || 0.0,
            a.cta_cc3 || null, a.pct_cc3 || 0.0,
            a.destino_haber || null, a.niif18_category || null
          ]
        );
        set({ plan: sortPlan([...get().plan, a]) });
      },

      deleteAccount: async (cta) => {
        await electron.dbExecute('DELETE FROM plan_global WHERE cta = ?', [cta]);
        set({ plan: get().plan.filter(a => a.cta !== cta) });
      },
      resetPlanToBase: async () => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;
        await electron.dbExecute('DELETE FROM plan_global');
        set({ plan: [] });
        await get().seedInitialPlan();
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
          await electron.dbExecute(`UPDATE costs SET codigo=?, descripcion=?, porcentaje=?, monto=?, cuenta_debe=?, cuenta_haber=? WHERE id=? AND workspace_id=?`, [cost.codigo, cost.descripcion, cost.porcentaje, cost.monto, cost.cuenta_debe || '94111', cost.cuenta_haber || '79111', id, ruc]);
        }
        set({ costs });
      },

      addCost: async (c) => {
        const id = `cost-${Date.now()}`;
        const ruc = get().currentCompany?.ruc || '';
        await electron.dbExecute(`INSERT INTO costs (id, workspace_id, codigo, descripcion, porcentaje, monto, cuenta_debe, cuenta_haber) VALUES (?,?,?,?,?,?,?,?)`, [id, ruc, c.codigo, c.descripcion, c.porcentaje, c.monto, c.cuenta_debe || '94111', c.cuenta_haber || '79111']);
        set({ costs: [...get().costs, { ...c, id, cuenta_debe: c.cuenta_debe || '94111', cuenta_haber: c.cuenta_haber || '79111' }] });
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
        let negativeDetected = false;

        for (const m of movements) {
          if (m.cantidad_in > 0) {
            currentCant += m.cantidad_in;
            currentTotal += m.total_in;
            currentCost = currentCant > 0 ? currentTotal / currentCant : 0;
            
            m.cantidad_saldo = currentCant;
            m.costo_unit_saldo = currentCost;
            m.total_saldo = currentTotal;
          } else if (m.cantidad_out > 0) {
            if (m.cantidad_out > currentCant) {
              negativeDetected = true;
              m.costo_unit_out = currentCost;
              m.total_out = currentCant * currentCost;
              
              currentCant = 0;
              currentTotal = 0;
              
              m.cantidad_saldo = 0;
              m.costo_unit_saldo = currentCost;
              m.total_saldo = 0;
            } else {
              m.costo_unit_out = currentCost;
              m.total_out = m.cantidad_out * currentCost;
              
              currentCant -= m.cantidad_out;
              currentTotal -= m.total_out;
              
              m.cantidad_saldo = currentCant;
              m.costo_unit_saldo = currentCost;
              m.total_saldo = currentTotal;
            }
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

        if (negativeDetected) {
          toast.error('Kárdex: Se detectó stock insuficiente en salidas. Ajustado a cero para evitar distorsión en costo promedio.');
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
          INSERT OR REPLACE INTO movimientos_data (workspace_id, period, month, section, key, value)
          VALUES (?, ?, ?, ?, ?, ?)
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
        // Update local React state instantly (0ms latency)
        set({ fixedAssets: [...get().fixedAssets.filter(x => x.id !== a.id), a] });
        
        // Debounce database write
        debouncedSaveFixedAsset(ruc, a);
      },
      deleteFixedAsset: async (id) => {
        if (fixedAssetSaveTimeouts.has(id)) {
          clearTimeout(fixedAssetSaveTimeouts.get(id));
          fixedAssetSaveTimeouts.delete(id);
        }
        await electron.dbExecute('DELETE FROM fixed_assets WHERE id = ?', [id]);
        set({ fixedAssets: get().fixedAssets.filter(x => x.id !== id) });
      },

      saveEmployee: async (e) => {
        const ruc = get().currentCompany?.ruc || '';
        // Update local React state instantly (0ms latency)
        set({ employees: [...get().employees.filter(x => x.id !== e.id), e] });
        
        // Debounce database write
        debouncedSaveEmployee(ruc, e);
      },
      deleteEmployee: async (id) => {
        if (employeeSaveTimeouts.has(id)) {
          clearTimeout(employeeSaveTimeouts.get(id));
          employeeSaveTimeouts.delete(id);
        }
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
            bankStatements: get().bankStatements,
            financeNotes: get().financeNotes,
            deferredTaxComputation: get().deferredTaxComputation,
          };
          
          // Marcar el userId inspeccionado globalmente para que apiBridge lo envíe como header
          (window as any).inspectingUserId = userId;
          
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
        // Limpiar el userId inspeccionado para que las peticiones vuelvan a usar el del admin
        (window as any).inspectingUserId = null;
        
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

      loadFinanceNotes: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return [];
        try {
          const res = await webApiBridge.getFinanceNotes(ruc, periodo);
          if (res && res.success && res.notes) {
            set({ financeNotes: res.notes });
            return res.notes;
          }
          set({ financeNotes: null });
          return [];
        } catch (e) {
          console.error('[STORE] Error loading finance notes:', e);
          return [];
        }
      },

      saveFinanceNotes: async (periodo, notes) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;
        try {
          const res = await webApiBridge.saveFinanceNotes(ruc, periodo, notes);
          if (res && res.success) {
            set({ financeNotes: notes });
            toast.success('✅ Notas NIIF guardadas con éxito.');
          } else {
            toast.error(`⚠️ Error al guardar Notas: ${res.error || 'Error desconocido'}`);
          }
        } catch (e: any) {
          console.error('[STORE] Error saving finance notes:', e);
          toast.error(`⚠️ Error de red al guardar Notas: ${e.message || e}`);
        }
      },

      loadDeferredTax: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return null;
        try {
          const res = await webApiBridge.getDeferredTax(ruc, periodo);
          if (res && res.success && res.computation) {
            set({ deferredTaxComputation: res.computation });
            return res.computation;
          }
          set({ deferredTaxComputation: null });
          return null;
        } catch (e) {
          console.error('[STORE] Error loading deferred tax:', e);
          return null;
        }
      },

      saveDeferredTax: async (periodo, computation) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;
        try {
          const res = await webApiBridge.saveDeferredTax(ruc, periodo, computation);
          if (res && res.success) {
            set({ deferredTaxComputation: computation });
            toast.success('✅ Cálculo de Impuesto Diferido guardado.');
          } else {
            toast.error(`⚠️ Error al guardar Impuesto Diferido: ${res.error || 'Error desconocido'}`);
          }
        } catch (e: any) {
          console.error('[STORE] Error saving deferred tax:', e);
          toast.error(`⚠️ Error de red al guardar Impuesto Diferido: ${e.message || e}`);
        }
      },

      postDeferredTaxJournalEntry: async (periodo, { lines, glosa }) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return;

        const lastDay = new Date(Number(periodo.split('-')[0]), Number(periodo.split('-')[1]), 0).getDate();
        const fecha = `${periodo}-${String(lastDay).padStart(2, '0')}`;
        if (await get().checkIfPeriodClosed(fecha)) {
          toast.error(`⚠️ Asiento bloqueado: El período ${periodo} está CERRADO.`);
          return;
        }

        const id = `asiento-nic12-${periodo.replace('-', '')}`;
        const header = {
          asiento: `NIC12-${periodo.replace('-', '')}`,
          fecEmi: fecha,
          glosa: glosa || 'AJUSTE IMPUESTO DIFERIDO NIC 12',
          anio: periodo.split('-')[0],
          mes: periodo.split('-')[1]
        };

        const journalEntries: JournalEntry[] = lines.map((line: any, index: number) => ({
          id: `${id}-line-${index}`,
          source: 'ASIENTO',
          asiento: header.asiento,
          fecha,
          glosa: header.glosa,
          cta: line.cuenta.trim(),
          desc: line.detalle || header.glosa,
          debe: line.debe || 0,
          haber: line.haber || 0
        }));

        try {
          validateDoubleEntry(journalEntries);
        } catch (e: any) {
          toast.error(`⚠️ Error de partida doble: ${e.message}`);
          return;
        }

        await electron.dbExecute('DELETE FROM asientos WHERE id = ? AND workspace_id = ?', [id, ruc]);
        await electron.dbExecute('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?', [ruc, `${id}-line-%`]);

        await electron.dbExecute(`INSERT OR REPLACE INTO asientos (id, workspace_id, header_json, lines_json) VALUES (?,?,?,?)`, [id, ruc, JSON.stringify(header), JSON.stringify(lines)]);
        for (const entry of journalEntries) {
          await electron.dbExecute(`INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [entry.id, ruc, entry.source, entry.asiento, entry.fecha, entry.glosa, entry.cta, entry.desc, entry.debe, entry.haber, entry.medio_pago || null, entry.nro_transaccion || null, entry.razon_social || null]);
        }

        await get().syncCurrentWorkspace();
        await get().triggerCascadeInvalidation('journal', fecha);
        toast.success('✅ Asiento NIC 12 contabilizado correctamente.');
      },

      // --- Libro Diario 5.2 Actions ---
      loadLd52Entries: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const res = await electron.ld52GetAsientos(ruc, periodo);
          if (res?.success) {
            const entries = res.data || [];
            let debe = 0;
            let haber = 0;
            for (const e of entries) {
              debe += e.monto_debe;
              haber += e.monto_haber;
            }
            set({
              ld52Entries: entries,
              ld52TotalDebe: debe / 100,
              ld52TotalHaber: haber / 100
            });
            await get().validarLd52Balance(periodo);
          }
        } catch (e: any) {
          console.error('[STORE] loadLd52Entries failed:', e);
        }
      },
      loadLd52FisicoEntries: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const res = await electron.ld52GetFormatoFisico(ruc, periodo);
          if (res?.success) {
            set({ ld52FisicoEntries: res.data || [] });
          }
        } catch (e: any) {
          console.error('[STORE] loadLd52FisicoEntries failed:', e);
        }
      },
      generarLd52Masivo: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const res = await electron.ld52GenerarMasivo(ruc, periodo);
          if (res?.success) {
            toast.success(`✅ Asientos 5.2 generados: ${res.data.compras} compras, ${res.data.ventas} ventas`);
            await get().loadLd52Entries(periodo);
            return res.data;
          }
        } catch (e: any) {
          toast.error(`⚠️ Error al generar asientos masivos: ${e.message}`);
          throw e;
        }
      },
      registrarLd52Asiento: async (lineas) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const res = await electron.ld52Registrar(ruc, lineas);
          if (res?.success) {
            toast.success(`✅ Asiento 5.2 registrado con CUO ${res.data.cuo}`);
            return res.data;
          }
        } catch (e: any) {
          toast.error(`⚠️ Error al registrar asiento: ${e.message}`);
          throw e;
        }
      },
      corregirLd52Asiento: async (cuoOriginal, tipo, nuevasLineas) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const res = await electron.ld52Corregir(ruc, cuoOriginal, tipo, nuevasLineas);
          if (res?.success) {
            toast.success(`✅ Asiento 5.2 corregido con éxito.`);
            return res.data;
          }
        } catch (e: any) {
          toast.error(`⚠️ Error al corregir asiento: ${e.message}`);
          throw e;
        }
      },
      validarLd52Balance: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const res = await electron.ld52ValidarBalance(ruc, periodo);
          if (res?.success) {
            set({
              ld52BalanceValido: res.data.valido,
              ld52Descuadrados: res.data.descuadrados || []
            });
            return res.data;
          }
        } catch (e: any) {
          console.error('[STORE] validarLd52Balance failed:', e);
        }
      },
      exportarLd52TXT: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const data = await electron.ld52ExportarTXT(ruc, periodo);
          const blob = new Blob([data], { type: 'text/plain; charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const y = periodo.substring(0, 4);
          const m = periodo.substring(4, 6);
          link.setAttribute('download', `LE${ruc}${y}${m}00050200001.txt`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('✅ Libro Diario 5.2 exportado con éxito.');
        } catch (e: any) {
          toast.error(`⚠️ Error al exportar TXT 5.2: ${e.message}`);
        }
      },
      exportarLd52TXT54: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const data = await electron.ld52ExportarTXT54(ruc, periodo);
          const blob = new Blob([data], { type: 'text/plain; charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const y = periodo.substring(0, 4);
          const m = periodo.substring(4, 6);
          link.setAttribute('download', `LE${ruc}${y}${m}00050400001.txt`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('✅ Plan de Cuentas 5.4 exportado con éxito.');
        } catch (e: any) {
          toast.error(`⚠️ Error al exportar TXT 5.4: ${e.message}`);
        }
      },
      exportarRetenciones41TXT: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const data = await electron.retenciones41ExportarTXT(ruc, periodo);
          const blob = new Blob([data], { type: 'text/plain; charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const y = periodo.substring(0, 4);
          const m = periodo.substring(4, 6);
          link.setAttribute('download', `LE${ruc}${y}${m}00040100001111.txt`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('✅ Libro de Retenciones 4.1 exportado con éxito.');
        } catch (e: any) {
          toast.error(`⚠️ Error al exportar TXT 4.1: ${e.message}`);
        }
      },
      exportarPle71TXT: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const data = await electron.ple71ExportarTXT(ruc, periodo);
          const blob = new Blob([data], { type: 'text/plain; charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const y = periodo.substring(0, 4);
          const m = periodo.substring(4, 6);
          const tieneDatos = data.length > 0;
          const contentIndicator = tieneDatos ? '1' : '0';
          link.setAttribute('download', `LE${ruc}${y}${m}00070100001${contentIndicator}11.txt`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('✅ Registro de Activos Fijos 7.1 exportado con éxito.');
        } catch (e: any) {
          toast.error(`⚠️ Error al exportar TXT 7.1: ${e.message}`);
        }
      },
      exportarPle101TXT: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const data = await electron.ple101ExportarTXT(ruc, periodo);
          const blob = new Blob([data], { type: 'text/plain; charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const y = periodo.substring(0, 4);
          const m = periodo.substring(4, 6);
          const tieneDatos = data.length > 0;
          const contentIndicator = tieneDatos ? '1' : '0';
          link.setAttribute('download', `LE${ruc}${y}${m}00100100001${contentIndicator}11.txt`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('✅ Registro de Costos 10.1 exportado con éxito.');
        } catch (e: any) {
          toast.error(`⚠️ Error al exportar TXT 10.1: ${e.message}`);
        }
      },
      exportarPle121TXT: async (periodo) => {
        const ruc = get().currentCompany?.ruc || '';
        try {
          const data = await electron.ple121ExportarTXT(ruc, periodo);
          const blob = new Blob([data], { type: 'text/plain; charset=utf-8' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const y = periodo.substring(0, 4);
          const m = periodo.substring(4, 6);
          const tieneDatos = data.length > 0;
          const contentIndicator = tieneDatos ? '1' : '0';
          link.setAttribute('download', `LE${ruc}${y}${m}00120100001${contentIndicator}11.txt`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          toast.success('✅ Registro de Inventario Físico 12.1 exportado con éxito.');
        } catch (e: any) {
          toast.error(`⚠️ Error al exportar TXT 12.1: ${e.message}`);
        }
      },
      facturacionConfigurarCertificadoAction: async (password: string, pfxBase64: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return null;
        try {
          const res = await webApiBridge.facturacionConfigurarCertificado(ruc, { password, pfxBase64 });
          if (res?.success) {
            toast.success('✅ Certificado digital configurado correctamente.');
          }
          return res;
        } catch (e: any) {
          toast.error(`⚠️ Error al configurar certificado: ${e.message || e}`);
          return { success: false, error: String(e) };
        }
      },
      facturacionEmitirComprobanteAction: async (comprobanteId: string) => {
        const ruc = get().currentCompany?.ruc || '';
        if (!ruc) return null;
        try {
          set({ isProcessing: true });
          const res = await webApiBridge.facturacionEmitirComprobante(ruc, comprobanteId);
          if (res?.success) {
            toast.success(`✅ Comprobante enviado y ACEPTADO por SUNAT/OSE.`);
          }
          return res;
        } catch (e: any) {
          const errorMsg = e.response?.data?.error || e.message || e;
          toast.error(`⚠️ Error al emitir comprobante: ${errorMsg}`);
          return { success: false, error: String(errorMsg) };
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


