const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
let safeStorage;
try {
  if (!process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_STATIC_URL) {
    const lib = 'electron';
    safeStorage = require(lib).safeStorage;
  }
} catch (e) {
  safeStorage = null;
}

const dbPath = path.join(process.cwd(), 'database', 'pld_contable.db');

// Asegurar que el directorio existe
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ─── Inicialización de Tablas ───
db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    ruc TEXT PRIMARY KEY,
    name TEXT,
    regimenTributario TEXT,
    location TEXT,
    address TEXT,
    support TEXT,
    period TEXT,
    logoBase64 TEXT,
    sol_user BLOB,
    sol_pass BLOB
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    registro TEXT,
    fecha TEXT,
    fecVcto TEXT,
    tipo_doc TEXT,
    serie TEXT,
    numero TEXT,
    doc_tipo TEXT,
    doc_num TEXT,
    nombre TEXT,
    tipOper TEXT,
    tipOperCode TEXT,
    ctaGasto TEXT,
    ctaAbono TEXT,
    moneda TEXT,
    tc REAL,
    bi REAL,
    igv REAL,
    noGravada REAL,
    isc REAL,
    total REAL,
    glosa TEXT,
    detraccion REAL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    registro TEXT,
    fecha TEXT,
    fecVcto TEXT,
    tipo_doc TEXT,
    serie TEXT,
    numero TEXT,
    doc_tipo TEXT,
    doc_num TEXT,
    nombre TEXT,
    tipOper TEXT,
    tipOperCode TEXT,
    ctaCargo TEXT,
    ctaIngreso TEXT,
    moneda TEXT,
    tc REAL,
    bi REAL,
    igv REAL,
    noGravada REAL,
    isc REAL,
    total REAL,
    glosa TEXT,
    detraccion REAL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS journal (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    source TEXT,
    asiento TEXT,
    fecha TEXT,
    glosa TEXT,
    cta TEXT,
    desc TEXT,
    debe REAL,
    haber REAL,
    medio_pago TEXT,
    nro_transaccion TEXT,
    razon_social TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    fecha TEXT,
    correlativo TEXT,
    glosa TEXT,
    cta TEXT,
    cta_denom TEXT,
    debe REAL,
    haber REAL,
    medio_pago TEXT,
    tipo_formato TEXT, -- '1.1' o '1.2'
    banco_item TEXT, -- Cuenta 104 específica
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS fixed_assets (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    codigo TEXT,
    descripcion TEXT,
    fecha_adquisicion TEXT,
    fecha_uso TEXT,
    costo_adquisicion REAL,
    tasa_depreciacion REAL,
    depreciacion_acumulada REAL,
    metodo TEXT,
    cuenta_activo TEXT,
    cuenta_depreciacion TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    dni TEXT,
    nombre TEXT,
    fecha_ingreso TEXT,
    sueldo_basico REAL,
    asignacion_familiar INTEGER,
    regimen_pensionario TEXT, -- ONP, AFP
    cussp TEXT,
    puesto TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS asientos (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    header_json TEXT,
    lines_json TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    tipo TEXT,
    ruc TEXT,
    descripcion TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plan (
    cta TEXT,
    workspace_id TEXT,
    description TEXT,
    type TEXT,
    reqCenCos INTEGER,
    amarreDebe TEXT,
    amarreHaber TEXT,
    PRIMARY KEY(cta, workspace_id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  -- Crear tabla para Plan Global compartido
  CREATE TABLE IF NOT EXISTS plan_global (
    cta TEXT PRIMARY KEY,
    description TEXT,
    type TEXT,
    reqCenCos INTEGER,
    amarreDebe TEXT,
    amarreHaber TEXT
  );

  -- Migrar datos de la tabla plan antigua a la global si está vacía
  INSERT OR IGNORE INTO plan_global (cta, description, type, reqCenCos, amarreDebe, amarreHaber)
  SELECT cta, description, type, reqCenCos, amarreDebe, amarreHaber FROM plan GROUP BY cta;

  CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    periodo TEXT,
    anexo TEXT,
    descripcion TEXT,
    monto TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS costs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    codigo TEXT,
    descripcion TEXT,
    porcentaje REAL,
    monto REAL,
    cuenta_debe TEXT,
    cuenta_haber TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS honorarios (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    registro TEXT,
    fecha TEXT,
    tipo_doc TEXT,
    serie TEXT,
    numero TEXT,
    doc_tipo TEXT,
    doc_num TEXT,
    nombre TEXT,
    ctaGasto TEXT,
    ctaAbono TEXT,
    bi REAL,
    retencion REAL,
    total REAL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS hhtt_adjustments (
    workspace_id TEXT,
    cta TEXT,
    debe REAL,
    haber REAL,
    PRIMARY KEY(workspace_id, cta),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS movimientos_data (
    workspace_id TEXT,
    period TEXT,
    month INTEGER,
    section TEXT,
    key TEXT,
    value REAL,
    PRIMARY KEY(workspace_id, period, month, section, key),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS glosas_habituales (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    category TEXT,
    glosa TEXT,
    lines_json TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS balance_inicial (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    cta TEXT,
    desc TEXT,
    debe REAL DEFAULT 0,
    haber REAL DEFAULT 0,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    code TEXT,
    name TEXT,
    unit_measure TEXT,
    type_existence TEXT,
    account_id TEXT,
    stock_min REAL,
    sale_price REAL,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    product_id TEXT,
    fecha TEXT,
    tipo_operacion TEXT,
    tipo_doc TEXT,
    serie TEXT,
    numero TEXT,
    cantidad_in REAL DEFAULT 0,
    costo_unit_in REAL DEFAULT 0,
    total_in REAL DEFAULT 0,
    cantidad_out REAL DEFAULT 0,
    costo_unit_out REAL DEFAULT 0,
    total_out REAL DEFAULT 0,
    cantidad_saldo REAL DEFAULT 0,
    costo_unit_saldo REAL DEFAULT 0,
    total_saldo REAL DEFAULT 0,
    reference_id TEXT,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Migration for existing tables
  PRAGMA table_info(glosas_habituales);
`);

// Check if category column exists, if not add it
const info = db.prepare("PRAGMA table_info(glosas_habituales)").all();
if (!info.some(col => col.name === 'category')) {
  db.exec("ALTER TABLE glosas_habituales ADD COLUMN category TEXT");
}

const costsCols = db.prepare("PRAGMA table_info(costs)").all();
if (!costsCols.some(col => col.name === 'cuenta_debe')) {
  db.exec("ALTER TABLE costs ADD COLUMN cuenta_debe TEXT");
}
if (!costsCols.some(col => col.name === 'cuenta_haber')) {
  db.exec("ALTER TABLE costs ADD COLUMN cuenta_haber TEXT");
}

const journalCols = db.prepare("PRAGMA table_info(journal)").all();
if (!journalCols.some(col => col.name === 'medio_pago')) {
  db.exec("ALTER TABLE journal ADD COLUMN medio_pago TEXT");
}
if (!journalCols.some(col => col.name === 'nro_transaccion')) {
  db.exec("ALTER TABLE journal ADD COLUMN nro_transaccion TEXT");
}
if (!journalCols.some(col => col.name === 'razon_social')) {
  db.exec("ALTER TABLE journal ADD COLUMN razon_social TEXT");
}

// Migración para SIRE Credentials en workspaces
const wsCols = db.prepare("PRAGMA table_info(workspaces)").all();
if (!wsCols.some(col => col.name === 'sunatClientId')) {
  db.exec("ALTER TABLE workspaces ADD COLUMN sunatClientId BLOB");
}
if (!wsCols.some(col => col.name === 'sunatClientSecret')) {
  db.exec("ALTER TABLE workspaces ADD COLUMN sunatClientSecret BLOB");
}
if (!wsCols.some(col => col.name === 'businessType')) {
  db.exec("ALTER TABLE workspaces ADD COLUMN businessType TEXT DEFAULT 'COMERCIAL'");
}
if (!wsCols.some(col => col.name === 'annualIncomeUIT')) {
  db.exec("ALTER TABLE workspaces ADD COLUMN annualIncomeUIT REAL DEFAULT 0");
}

const prodCols = db.prepare("PRAGMA table_info(products)").all();
if (!prodCols.some(col => col.name === 'type_existence')) {
  db.exec("ALTER TABLE products ADD COLUMN type_existence TEXT");
}
if (!prodCols.some(col => col.name === 'sale_price')) {
  db.exec("ALTER TABLE products ADD COLUMN sale_price REAL DEFAULT 0");
}

// ─── Migración SIRE (Formatos 8.1 y 14.1) ───
const purchaseCols = db.prepare("PRAGMA table_info(purchases)").all();
const sireCols = ['car', 'estado_sire', 'icbper', 'isc', 'otros_tributos', 'id_referencia', 'cuo', 'hash_sire'];
sireCols.forEach(colName => {
  if (!purchaseCols.some(col => col.name === colName)) {
    let type = "TEXT";
    if (['icbper', 'isc', 'otros_tributos'].includes(colName)) type = "REAL DEFAULT 0";
    if (colName === 'estado_sire') type = "TEXT DEFAULT 'Local'";
    db.exec(`ALTER TABLE purchases ADD COLUMN ${colName} ${type}`);
  }
});

const salesCols = db.prepare("PRAGMA table_info(sales)").all();
sireCols.forEach(colName => {
  if (!salesCols.some(col => col.name === colName)) {
    let type = "TEXT";
    if (['icbper', 'isc', 'otros_tributos'].includes(colName)) type = "REAL DEFAULT 0";
    if (colName === 'estado_sire') type = "TEXT DEFAULT 'Local'";
    db.exec(`ALTER TABLE sales ADD COLUMN ${colName} ${type}`);
  }
});

const assetCols = db.prepare("PRAGMA table_info(fixed_assets)").all();
const assetNewCols = [
  { name: 'marca', type: 'TEXT' },
  { name: 'modelo', type: 'TEXT' },
  { name: 'serie_placa', type: 'TEXT' },
  { name: 'saldo_inicial', type: 'REAL DEFAULT 0' },
  { name: 'adquisiciones', type: 'REAL DEFAULT 0' },
  { name: 'mejoras', type: 'REAL DEFAULT 0' },
  { name: 'retiros_bajas', type: 'REAL DEFAULT 0' },
  { name: 'otros_ajustes', type: 'REAL DEFAULT 0' },
  { name: 'ajuste_inflacion', type: 'REAL DEFAULT 0' },
  { name: 'deprec_ejercicio', type: 'REAL DEFAULT 0' },
  { name: 'deprec_bajas', type: 'REAL DEFAULT 0' },
  { name: 'deprec_otros', type: 'REAL DEFAULT 0' },
  { name: 'deprec_acum_anterior', type: 'REAL DEFAULT 0' }
];

assetNewCols.forEach(col => {
  if (!assetCols.some(c => c.name === col.name)) {
    db.exec(`ALTER TABLE fixed_assets ADD COLUMN ${col.name} ${col.type}`);
  }
});
// ─ Migración para empleados (Libro de Planilla Extendido)
const employeeCols = db.prepare("PRAGMA table_info(employees)").all();
const employeeNewCols = [
  { name: 'fecha_nacimiento', type: 'TEXT' },
  { name: 'edad', type: 'INTEGER' },
  { name: 'fecha_salida', type: 'TEXT' },
  { name: 'fecha_reingreso', type: 'TEXT' },
  { name: 'dias_trabajados', type: 'INTEGER DEFAULT 30' },
  { name: 'jornal_diario', type: 'REAL DEFAULT 0' },
  { name: 'asignacion_familiar_monto', type: 'REAL DEFAULT 0' },
  { name: 'horas_extras_cantidad', type: 'INTEGER DEFAULT 0' },
  { name: 'horas_extras_importe', type: 'REAL DEFAULT 0' },
  { name: 'total_remuneracion', type: 'REAL DEFAULT 0' },
  { name: 'descuento_onp', type: 'REAL DEFAULT 0' },
  { name: 'essalud_vida', type: 'REAL DEFAULT 0' },
  { name: 'impuesto_renta_5ta', type: 'REAL DEFAULT 0' },
  { name: 'retencion_judicial', type: 'REAL DEFAULT 0' },
  { name: 'afp_fondo', type: 'REAL DEFAULT 0' },
  { name: 'afp_seguro', type: 'REAL DEFAULT 0' },
  { name: 'afp_comision', type: 'REAL DEFAULT 0' },
  { name: 'total_descuento', type: 'REAL DEFAULT 0' },
  { name: 'neto_pagar', type: 'REAL DEFAULT 0' },
  { name: 'essalud_empleador', type: 'REAL DEFAULT 0' },
  { name: 'sctr_empleador', type: 'REAL DEFAULT 0' }
];

employeeNewCols.forEach(col => {
  if (!employeeCols.some(c => c.name === col.name)) {
    db.exec(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`);
  }
});

// --- SPOT / Retenciones / Percepciones Columns ---
const workspacesCols = db.prepare("PRAGMA table_info(workspaces)").all();
if (!workspacesCols.some(c => c.name === 'agente_retencion')) {
  db.exec(`ALTER TABLE workspaces ADD COLUMN agente_retencion INTEGER DEFAULT 0`);
}

const purchaseColsForSpot = db.prepare("PRAGMA table_info(purchases)").all();
const purchaseSpotCols = [
  { name: 'spot_tipo', type: 'TEXT' },
  { name: 'spot_monto', type: 'REAL DEFAULT 0' },
  { name: 'spot_constancia', type: 'TEXT' },
  { name: 'spot_fecha', type: 'TEXT' },
  { name: 'retencion_monto', type: 'REAL DEFAULT 0' },
  { name: 'retencion_comprobante', type: 'TEXT' },
  { name: 'retencion_fecha', type: 'TEXT' },
  { name: 'percepcion_monto', type: 'REAL DEFAULT 0' },
  { name: 'percepcion_comprobante', type: 'TEXT' }
];
purchaseSpotCols.forEach(col => {
  if (!purchaseColsForSpot.some(c => c.name === col.name)) {
    db.exec(`ALTER TABLE purchases ADD COLUMN ${col.name} ${col.type}`);
  }
});

const salesColsForSpot = db.prepare("PRAGMA table_info(sales)").all();
const salesSpotCols = [
  { name: 'spot_tipo', type: 'TEXT' },
  { name: 'spot_monto', type: 'REAL DEFAULT 0' },
  { name: 'spot_constancia', type: 'TEXT' },
  { name: 'spot_fecha', type: 'TEXT' },
  { name: 'retencion_monto', type: 'REAL DEFAULT 0' },
  { name: 'retencion_comprobante', type: 'TEXT' },
  { name: 'retencion_fecha', type: 'TEXT' }
];
salesSpotCols.forEach(col => {
  if (!salesColsForSpot.some(c => c.name === col.name)) {
    db.exec(`ALTER TABLE sales ADD COLUMN ${col.name} ${col.type}`);
  }
});

// --- Audit Logs Table ---
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      user_id TEXT,
      timestamp TEXT,
      cuo_afectado TEXT,
      accion TEXT,
      contenido_previo TEXT,
      contenido_nuevo TEXT,
      justificacion TEXT
    )
  `);
  console.log('[DB] Tabla audit_logs verificada/creada.');
} catch (e) {
  console.error('[DB ERROR] No se pudo crear audit_logs:', e.message);
}

// ─── Funciones de cifrado ───
function encrypt(text) {
  if (!text) return null;
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(text);
  return safeStorage.encryptString(text);
}

function decrypt(buffer) {
  if (!buffer) return '';
  if (!safeStorage.isEncryptionAvailable()) return buffer.toString();
  try {
    return safeStorage.decryptString(Buffer.from(buffer));
  } catch (error) {
    console.error('[DB] Error al descifrar datos (posible cambio de equipo):', error.message);
    return ''; // Devolvemos vacío para permitir que la app inicie
  }
}

// ─── API de Base de Datos ───
const dbManager = {
  // --- Workspaces ---
  getWorkspaces: () => {
    const rows = db.prepare('SELECT * FROM workspaces').all();
    return rows.map(r => ({
      ...r,
      sol_user: decrypt(r.sol_user),
      sol_pass: decrypt(r.sol_pass),
      sunatClientId: decrypt(r.sunatClientId),
      sunatClientSecret: decrypt(r.sunatClientSecret)
    }));
  },

  saveWorkspace: (w) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO workspaces 
      (ruc, name, regimenTributario, location, address, support, period, logoBase64, sol_user, sol_pass, sunatClientId, sunatClientSecret, annualIncomeUIT, agente_retencion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      w.ruc, w.name, w.regimenTributario, w.location, w.address, 
      w.support, w.period, w.logoBase64, 
      encrypt(w.sol_user), encrypt(w.sol_pass),
      encrypt(w.sunatClientId), encrypt(w.sunatClientSecret),
      Number(w.annualIncomeUIT || 0),
      w.agente_retencion ? 1 : 0
    );
  },

  deleteWorkspace: (ruc) => {
    db.prepare('DELETE FROM workspaces WHERE ruc = ?').run(ruc);
  },

  getWorkspaceData: (ruc) => {
    const wsInfo = db.prepare('SELECT * FROM workspaces WHERE ruc = ?').get(ruc);
    const purchases = db.prepare('SELECT * FROM purchases WHERE workspace_id = ?').all(ruc);
    const sales = db.prepare('SELECT * FROM sales WHERE workspace_id = ?').all(ruc);
    const journal = db.prepare('SELECT * FROM journal WHERE workspace_id = ?').all(ruc);
    const honorarios = db.prepare('SELECT * FROM honorarios WHERE workspace_id = ?').all(ruc);
    const entities = db.prepare('SELECT * FROM entities WHERE workspace_id = ?').all(ruc);
    const plan = db.prepare('SELECT * FROM plan_global').all();
    const costs = db.prepare('SELECT * FROM costs WHERE workspace_id = ?').all(ruc);
    const maintenance = db.prepare('SELECT * FROM maintenance WHERE workspace_id = ?').all(ruc);
    const hhttAdjustments = db.prepare('SELECT * FROM hhtt_adjustments WHERE workspace_id = ?').all(ruc);
    const movimientosData = db.prepare('SELECT * FROM movimientos_data WHERE workspace_id = ?').all(ruc);
    const asientos = db.prepare('SELECT * FROM asientos WHERE workspace_id = ?').all(ruc).map(a => ({
      ...a,
      header: JSON.parse(a.header_json),
      lines: JSON.parse(a.lines_json)
    }));
    const glosasHabituales = db.prepare('SELECT * FROM glosas_habituales WHERE workspace_id = ?').all(ruc).map(g => ({
      ...g,
      lines: JSON.parse(g.lines_json)
    }));
    const products = db.prepare('SELECT * FROM products WHERE workspace_id = ?').all(ruc);
    const inventoryMovements = db.prepare('SELECT * FROM inventory_movements WHERE workspace_id = ?').all(ruc);
    const cashMovements = db.prepare('SELECT * FROM cash_movements WHERE workspace_id = ?').all(ruc);
    const fixedAssets = db.prepare('SELECT * FROM fixed_assets WHERE workspace_id = ?').all(ruc);
    const employees = db.prepare('SELECT * FROM employees WHERE workspace_id = ?').all(ruc);
    const balanceInicial = db.prepare('SELECT * FROM balance_inicial WHERE workspace_id = ?').all(ruc);

    // Convert hhttAdjustments array to record
    const adjustmentsRecord = {};
    hhttAdjustments.forEach(adj => {
      adjustmentsRecord[adj.cta] = { debe: adj.debe, haber: adj.haber };
    });

    return {
      currentCompany: wsInfo ? {
        ...wsInfo,
        sol_user: decrypt(wsInfo.sol_user),
        sol_pass: decrypt(wsInfo.sol_pass),
        sunatClientId: decrypt(wsInfo.sunatClientId),
        sunatClientSecret: decrypt(wsInfo.sunatClientSecret)
      } : null,
      purchases, sales, journal, honorarios, entities, plan, costs, 
      maintenanceRecords: maintenance, 
      hhttAdjustments: adjustmentsRecord,
      movimientosData,
      asientos,
      glosasHabituales,
      products,
      inventoryMovements,
      cashMovements,
      fixedAssets,
      employees,
      balanceInicial
    };
  },

  // --- Transactions ---
  savePurchase: (ruc, p) => {
    const insertP = db.prepare(`
      INSERT OR REPLACE INTO purchases 
      (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaGasto, ctaAbono, moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Clear existing journal entries for this purchase to avoid duplicates during replacement
    const deleteJ = db.prepare('DELETE FROM journal WHERE workspace_id = ? AND id LIKE ?');
    const insertJ = db.prepare(`
      INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((purchase, journalEntries) => {
      insertP.run(
        purchase.id, ruc, purchase.registro, purchase.fecha, purchase.fecVcto, 
        purchase.tipo_doc, purchase.serie, purchase.numero, purchase.doc_tipo, 
        purchase.doc_num, purchase.nombre, purchase.tipOper, purchase.tipOperCode, 
        purchase.ctaGasto, purchase.ctaAbono, purchase.moneda, purchase.tc, 
        purchase.bi, purchase.igv, purchase.noGravada, purchase.isc, 
        purchase.total, purchase.glosa, purchase.detraccion
      );
      
      deleteJ.run(ruc, `compra-${purchase.id}-%`);
      
      for (const j of journalEntries) {
        insertJ.run(j.id, ruc, j.source, j.asiento, j.fecha, j.glosa, j.cta, j.desc, j.debe, j.haber);
      }
    });

    // Journal entries generation logic should ideally be passed from frontend or shared
    // For now, we assume the frontend sends the journal entries together
  },

  // Helper síncrono para ejecutar cualquier sentencia (útil para migraciones)
  run: (sql, params = []) => db.prepare(sql).run(...params),
  queryAll: (sql, params = []) => db.prepare(sql).all(...params),
  executeTransaction: (fn) => db.transaction(fn)(),

  // Bulk data reset for a workspace
  clearWorkspace: (ruc) => {
    const tables = [
      'purchases', 'sales', 'journal', 'asientos', 'entities', 
      'maintenance', 'costs', 'honorarios', 'hhtt_adjustments',
      'inventory_movements', 'products', 'balance_inicial'
    ];
    const transaction = db.transaction(() => {
      for (const table of tables) {
        db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).run(ruc);
      }
    });
    transaction();
  },

  // --- SIRE Records Bulk Save ---
  saveSirePurchases: (ruc, records) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO purchases 
      (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper, otros_tributos, total, car, estado_sire)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((recs) => {
      for (const r of recs) {
        insert.run(
          r.id, ruc, r.registro, r.fecha, r.fecVcto,
          r.tipo_doc, r.serie, r.numero, r.doc_tipo,
          r.doc_num, r.nombre, r.tc, r.bi, r.igv,
          r.noGravada, r.isc, r.icbper, r.otros_tributos,
          r.total, r.car, r.estado_sire
        );
      }
    });
    transaction(records);
  },

  saveSireSales: (ruc, records) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO sales 
      (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper, otros_tributos, total, car, estado_sire)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((recs) => {
      for (const r of recs) {
        insert.run(
          r.id, ruc, r.registro, r.fecha, r.fecVcto,
          r.tipo_doc, r.serie, r.numero, r.doc_tipo,
          r.doc_num, r.nombre, r.tc, r.bi, r.igv,
          r.noGravada, r.isc, r.icbper, r.otros_tributos,
          r.total, r.car, r.estado_sire
        );
      }
    });
    transaction(records);
  },

  saveBalanceInicial: (ruc, item) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO balance_inicial (id, workspace_id, cta, desc, debe, haber)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(item.id, ruc, item.cta, item.desc, item.debe, item.haber);
  },

  deleteBalanceInicial: (id) => {
    db.prepare('DELETE FROM balance_inicial WHERE id = ?').run(id);
  },

  // --- Backup ---
  backup: async () => {
    const backupName = `backup_pld_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    const backupPath = path.join(process.cwd(), 'database', backupName);
    await db.backup(backupPath);
    return backupPath;
  },

  importBackup: (data) => {
    if (!data || !data.currentCompany || !data.currentCompany.ruc) {
      throw new Error("Datos de backup inválidos: falta empresa o RUC");
    }

    const ruc = data.currentCompany.ruc;
    const w = data.currentCompany;

    const transaction = db.transaction(() => {
      // 1. Guardar/Actualizar Workspace
      const stmtWS = db.prepare(`
        INSERT OR REPLACE INTO workspaces 
        (ruc, name, regimenTributario, location, address, support, period, logoBase64, sol_user, sol_pass, sunatClientId, sunatClientSecret, businessType, annualIncomeUIT, agente_retencion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmtWS.run(
        ruc, w.name, w.regimenTributario || 'RG', w.location || '', w.address || '', 
        w.support || '', w.period || '', w.logoBase64 || null, 
        encrypt(w.sol_user), encrypt(w.sol_pass),
        encrypt(w.sunatClientId), encrypt(w.sunatClientSecret),
        w.businessType || 'COMERCIAL',
        Number(w.annualIncomeUIT || 0),
        w.agente_retencion ? 1 : 0
      );

      // 2. Limpiar datos antiguos
      const tables = [
        'purchases', 'sales', 'journal', 'asientos', 'entities', 
        'maintenance', 'costs', 'honorarios', 'hhtt_adjustments',
        'inventory_movements', 'products', 'balance_inicial',
        'cash_movements', 'fixed_assets', 'employees', 'movimientos_data', 'glosas_habituales'
      ];
      for (const table of tables) {
        db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).run(ruc);
      }

      // 3. Insertar compras
      if (Array.isArray(data.purchases)) {
        const ins = db.prepare(`
          INSERT OR REPLACE INTO purchases (
            id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, 
            doc_tipo, doc_num, nombre, tipOper, tipOperCode, ctaGasto, ctaAbono, 
            moneda, tc, bi, igv, noGravada, isc, total, glosa, detraccion,
            spot_tipo, spot_monto, spot_constancia, spot_fecha,
            retencion_monto, retencion_comprobante, retencion_fecha,
            percepcion_monto, percepcion_comprobante
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);
        for (const p of data.purchases) {
          ins.run(
            p.id, ruc, p.registro, p.fecha, p.fecVcto, p.tipo_doc, p.serie, p.numero, 
            p.doc_tipo, p.doc_num, p.nombre, p.tipOper, p.tipOperCode, p.ctaGasto, p.ctaAbono, 
            p.moneda, p.tc, p.bi, p.igv, p.noGravada, p.isc, p.total, p.glosa, p.detraccion,
            p.spot_tipo || null, p.spot_monto || 0, p.spot_constancia || null, p.spot_fecha || null,
            p.retencion_monto || 0, p.retencion_comprobante || null, p.retencion_fecha || null,
            p.percepcion_monto || 0, p.percepcion_comprobante || null
          );
        }
      }

      // 4. Insertar ventas
      if (Array.isArray(data.sales)) {
        const ins = db.prepare(`
          INSERT OR REPLACE INTO sales (
            id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, 
            doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper, otros_tributos, total, car, estado_sire,
            spot_tipo, spot_monto, spot_constancia, spot_fecha,
            retencion_monto, retencion_comprobante, retencion_fecha
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);
        for (const s of data.sales) {
          ins.run(
            s.id, ruc, s.registro, s.fecha, s.fecVcto, s.tipo_doc, s.serie, s.numero, 
            s.doc_tipo, s.doc_num, s.nombre, s.tc, s.bi, s.igv, s.noGravada, s.isc, s.icbper || 0, s.otros_tributos || 0, s.total, s.car, s.estado_sire,
            s.spot_tipo || null, s.spot_monto || 0, s.spot_constancia || null, s.spot_fecha || null,
            s.retencion_monto || 0, s.retencion_comprobante || null, s.retencion_fecha || null
          );
        }
      }

      // 5. Insertar diario
      if (Array.isArray(data.journal)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, [desc], debe, haber, medio_pago, nro_transaccion, razon_social) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const j of data.journal) {
          ins.run(j.id, ruc, j.source, j.asiento, j.fecha, j.glosa, j.cta, j.desc, j.debe, j.haber, j.medio_pago || null, j.nro_transaccion || null, j.razon_social || null);
        }
      }

      // 6. Inventario y Productos
      if (Array.isArray(data.products)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO products (id, workspace_id, code, name, unit_measure, type_existence, account_id, stock_min, sale_price) VALUES (?,?,?,?,?,?,?,?,?)`);
        for (const pr of data.products) {
          ins.run(pr.id, ruc, pr.code, pr.name, pr.unit_measure, pr.type_existence, pr.account_id, pr.stock_min, pr.sale_price);
        }
      }
      if (Array.isArray(data.inventoryMovements)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO inventory_movements (id, workspace_id, product_id, fecha, tipo_operacion, tipo_doc, serie, numero, cantidad_in, costo_unit_in, total_in, cantidad_out, costo_unit_out, total_out, cantidad_saldo, costo_unit_saldo, total_saldo, reference_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const m of data.inventoryMovements) {
          ins.run(m.id, ruc, m.product_id, m.fecha, m.tipo_operacion, m.tipo_doc, m.serie, m.numero, m.cantidad_in, m.costo_unit_in, m.total_in, m.cantidad_out, m.costo_unit_out, m.total_out, m.cantidad_saldo, m.costo_unit_saldo, m.total_saldo, m.reference_id);
        }
      }

      // 7. Balance Inicial
      if (Array.isArray(data.balanceInicial)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO balance_inicial (id, workspace_id, cta, [desc], debe, haber) VALUES (?, ?, ?, ?, ?, ?)`);
        for (const bi of data.balanceInicial) {
          ins.run(bi.id, ruc, bi.cta, bi.desc, bi.debe, bi.haber);
        }
      }

      // 8. Otros módulos (Honorarios, Activos, Empleados, etc.)
      if (Array.isArray(data.honorarios)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO honorarios (id, workspace_id, registro, fecha, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, ctaGasto, ctaAbono, bi, retencion, total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const h of data.honorarios) ins.run(h.id, ruc, h.registro, h.fecha, h.tipo_doc, h.serie, h.numero, h.doc_tipo, h.doc_num, h.nombre, h.ctaGasto, h.ctaAbono, h.bi, h.retencion, h.total);
      }
      if (Array.isArray(data.fixedAssets)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO fixed_assets (id, workspace_id, codigo, descripcion, marca, modelo, serie_placa, fecha_adquisicion, fecha_uso, costo_adquisicion, saldo_inicial, adquisiciones, mejoras, retiros_bajas, otros_ajustes, ajuste_inflacion, tasa_depreciacion, deprec_ejercicio, deprec_bajas, deprec_otros, deprec_acum_anterior, depreciacion_acumulada, metodo, cuenta_activo, cuenta_depreciacion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const a of data.fixedAssets) ins.run(a.id, ruc, a.codigo, a.descripcion, a.marca, a.modelo, a.serie_placa, a.fecha_adquisicion, a.fecha_uso, a.costo_adquisicion, a.saldo_inicial, a.adquisiciones, a.mejoras, a.retiros_bajas, a.otros_ajustes, a.ajuste_inflacion, a.tasa_depreciacion, a.deprec_ejercicio, a.deprec_bajas, a.deprec_otros, a.deprec_acum_anterior, a.depreciacion_acumulada, a.metodo, a.cuenta_activo, a.cuenta_depreciacion);
      }
      if (Array.isArray(data.employees)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO employees (id, workspace_id, dni, nombre, fecha_nacimiento, edad, puesto, fecha_ingreso, fecha_salida, fecha_reingreso, regimen_pensionario, cussp, dias_trabajados, jornal_diario, sueldo_basico, asignacion_familiar, asignacion_familiar_monto, horas_extras_cantidad, horas_extras_importe, total_remuneracion, descuento_onp, essalud_vida, impuesto_renta_5ta, retencion_judicial, afp_fondo, afp_seguro, afp_comision, total_descuento, neto_pagar, essalud_empleador, sctr_empleador) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const e of data.employees) ins.run(e.id, ruc, e.dni, e.nombre, e.fecha_nacimiento, e.edad, e.puesto, e.fecha_ingreso, e.fecha_salida, e.fecha_reingreso, e.regimen_pensionario, e.cussp, e.dias_trabajados, e.jornal_diario, e.sueldo_basico, e.asignacion_familiar, e.asignacion_familiar_monto, e.horas_extras_cantidad, e.horas_extras_importe, e.total_remuneracion, e.descuento_onp, e.essalud_vida, e.impuesto_renta_5ta, e.retencion_judicial, e.afp_fondo, e.afp_seguro, e.afp_comision, e.total_descuento, e.neto_pagar, e.essalud_empleador, e.sctr_empleador);
      }
      if (Array.isArray(data.cashMovements)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO cash_movements (id, workspace_id, fecha, correlativo, glosa, cta, cta_denom, debe, haber, medio_pago, tipo_formato, banco_item) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const c of data.cashMovements) ins.run(c.id, ruc, c.fecha, c.correlativo, c.glosa, c.cta, c.cta_denom, c.debe, c.haber, c.medio_pago, c.tipo_formato, c.banco_item);
      }
      if (Array.isArray(data.maintenanceRecords)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO maintenance (id, workspace_id, periodo, anexo, descripcion, monto) VALUES (?,?,?,?,?,?)`);
        for (const m of data.maintenanceRecords) ins.run(m.id, ruc, m.periodo, m.anexo, m.descripcion, m.monto);
      }
      if (Array.isArray(data.costs)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO costs (id, workspace_id, codigo, descripcion, porcentaje, monto, cuenta_debe, cuenta_haber) VALUES (?,?,?,?,?,?,?,?)`);
        for (const co of data.costs) ins.run(co.id, ruc, co.codigo, co.descripcion, co.porcentaje, co.monto, co.cuenta_debe || '94111', co.cuenta_haber || '79111');
      }
      if (Array.isArray(data.entities)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO entities (id, workspace_id, tipo, ruc, descripcion) VALUES (?,?,?,?,?)`);
        for (const en of data.entities) ins.run(en.id, ruc, en.tipo, en.ruc, en.descripcion);
      }
      if (Array.isArray(data.asientos)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO asientos (id, workspace_id, header_json, lines_json) VALUES (?,?,?,?)`);
        for (const as of data.asientos) ins.run(as.id, ruc, JSON.stringify(as.header), JSON.stringify(as.lines));
      }
      if (Array.isArray(data.glosasHabituales)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO glosas_habituales (id, workspace_id, category, glosa, lines_json) VALUES (?,?,?,?,?)`);
        for (const g of data.glosasHabituales) ins.run(g.id, ruc, g.category, g.glosa, JSON.stringify(g.lines));
      }
      if (Array.isArray(data.movimientosData)) {
        const ins = db.prepare(`INSERT OR REPLACE INTO movimientos_data (workspace_id, period, month, section, key, value) VALUES (?,?,?,?,?,?)`);
        for (const mv of data.movimientosData) ins.run(ruc, mv.period, mv.month, mv.section, mv.key, mv.value);
      }
      if (data.hhttAdjustments) {
        const ins = db.prepare(`INSERT OR REPLACE INTO hhtt_adjustments (workspace_id, cta, debe, haber) VALUES (?,?,?,?)`);
        for (const [cta, vals] of Object.entries(data.hhttAdjustments)) {
          ins.run(ruc, cta, vals.debe, vals.haber);
        }
      }
    });
    transaction();
  }
};

module.exports = dbManager;
