const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { encrypt, decrypt } = require('./cryptoUtils');

// En Railway, usaremos una carpeta persistente montada en /app/database
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'database', 'pld_contable.db');

// Asegurar que el directorio existe
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// --- Inicialización Multi-Usuario y Esquema Completo ---
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
        sol_pass BLOB,
        sunatClientId BLOB,
        sunatClientSecret BLOB,
        user_id TEXT
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
        tc REAL,
        bi REAL,
        igv REAL,
        noGravada REAL,
        isc REAL,
        total REAL,
        glosa TEXT,
        user_id TEXT,
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
        tc REAL,
        bi REAL,
        igv REAL,
        noGravada REAL,
        isc REAL,
        total REAL,
        glosa TEXT,
        user_id TEXT,
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
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plan_global (
        cta TEXT PRIMARY KEY,
        description TEXT,
        type TEXT,
        reqCenCos INTEGER,
        amarreDebe TEXT,
        amarreHaber TEXT
    );

    CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        tipo TEXT,
        ruc TEXT,
        descripcion TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asientos (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        header_json TEXT,
        lines_json TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS honorarios (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        fecha TEXT,
        tipo_doc TEXT,
        serie TEXT,
        numero TEXT,
        doc_num TEXT,
        nombre TEXT,
        total REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS costs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        codigo TEXT,
        descripcion TEXT,
        porcentaje REAL,
        monto REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS maintenance (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        periodo TEXT,
        anexo TEXT,
        descripcion TEXT,
        monto REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS balance_inicial (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        cta TEXT,
        descripcion TEXT,
        debe REAL DEFAULT 0,
        haber REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_journal_workspace ON journal(workspace_id);

    CREATE TABLE IF NOT EXISTS movimientos_data (
        workspace_id TEXT,
        period TEXT,
        month INTEGER,
        section TEXT,
        key TEXT,
        value REAL,
        user_id TEXT,
        PRIMARY KEY(workspace_id, period, month, section, key, user_id),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS glosas_habituales (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        category TEXT,
        glosa TEXT,
        lines_json TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        code TEXT,
        name TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fixed_assets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        descripcion TEXT,
        costo REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        nombre TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS balance_inicial (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        cta TEXT,
        debe REAL,
        haber REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        product_id TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );
`);

// --- Tabla de Sugerencias y Reportes Inteligentes ---
db.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        workspace_ruc TEXT,
        workspace_name TEXT,
        view_context TEXT,
        user_comment TEXT,
        image_base64 TEXT,
        system_state TEXT,
        ai_analysis TEXT,
        status TEXT DEFAULT 'PENDIENTE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Función auxiliar para añadir columnas si no existen (para migración de tablas existentes)
function ensureColumnExists(tableName, colName, colType) {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        if (!info.some(col => col.name === colName)) {
            db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`);
            console.log(`[MIGRATION] Columna ${colName} añadida a la tabla ${tableName}`);
        }
    } catch (e) {
        console.error(`[MIGRATION ERROR] Error al verificar/añadir ${colName} a ${tableName}:`, e.message);
    }
}

// Asegurar user_id en todas las tablas por si acaso
['workspaces', 'purchases', 'sales', 'journal', 'entities', 'asientos', 'products', 'inventory_movements', 'cash_movements', 'fixed_assets', 'employees', 'balance_inicial', 'maintenance', 'costs', 'honorarios', 'movimientos_data'].forEach(tbl => ensureColumnExists(tbl, 'user_id', 'TEXT'));

// Migraciones generales para sincronizar la base de datos de Railway con todos los campos del sistema local
ensureColumnExists('workspaces', 'businessType', "TEXT DEFAULT 'COMERCIAL'");
ensureColumnExists('workspaces', 'annualIncomeUIT', 'REAL DEFAULT 0');

ensureColumnExists('products', 'type_existence', 'TEXT');
ensureColumnExists('products', 'sale_price', 'REAL DEFAULT 0');

const sireColsDef = [
    { name: 'tipOper', type: 'TEXT' },
    { name: 'tipOperCode', type: 'TEXT' },
    { name: 'ctaGasto', type: 'TEXT' },
    { name: 'ctaAbono', type: 'TEXT' },
    { name: 'moneda', type: 'TEXT' },
    { name: 'detraccion', type: 'REAL' },
    { name: 'car', type: 'TEXT' },
    { name: 'estado_sire', type: "TEXT DEFAULT 'Local'" },
    { name: 'icbper', type: 'REAL DEFAULT 0' },
    { name: 'isc', type: 'REAL DEFAULT 0' },
    { name: 'otros_tributos', type: 'REAL DEFAULT 0' },
    { name: 'id_referencia', type: 'TEXT' },
    { name: 'cuo', type: 'TEXT' },
    { name: 'hash_sire', type: 'TEXT' }
];
sireColsDef.forEach(c => ensureColumnExists('purchases', c.name, c.type));

const sireSalesColsDef = [
    { name: 'tipOper', type: 'TEXT' },
    { name: 'tipOperCode', type: 'TEXT' },
    { name: 'ctaCargo', type: 'TEXT' },
    { name: 'ctaIngreso', type: 'TEXT' },
    { name: 'moneda', type: 'TEXT' },
    { name: 'detraccion', type: 'REAL' },
    { name: 'car', type: 'TEXT' },
    { name: 'estado_sire', type: "TEXT DEFAULT 'Local'" },
    { name: 'icbper', type: 'REAL DEFAULT 0' },
    { name: 'isc', type: 'REAL DEFAULT 0' },
    { name: 'otros_tributos', type: 'REAL DEFAULT 0' },
    { name: 'id_referencia', type: 'TEXT' },
    { name: 'cuo', type: 'TEXT' },
    { name: 'hash_sire', type: 'TEXT' }
];
sireSalesColsDef.forEach(c => ensureColumnExists('sales', c.name, c.type));

const fixedAssetsColsDef = [
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
fixedAssetsColsDef.forEach(c => ensureColumnExists('fixed_assets', c.name, c.type));

const employeesColsDef = [
    { name: 'doc_num', type: 'TEXT' },
    { name: 'cargo', type: 'TEXT' },
    { name: 'sueldo', type: 'REAL' },
    { name: 'fecha_ingreso', type: 'TEXT' },
    { name: 'afp', type: 'TEXT' },
    { name: 'cuspp', type: 'TEXT' },
    { name: 'comision_tipo', type: 'TEXT' },
    { name: 'eps', type: 'INTEGER DEFAULT 0' },
    { name: 'sctr', type: 'INTEGER DEFAULT 0' }
];
employeesColsDef.forEach(c => ensureColumnExists('employees', c.name, c.type));

const inventoryMovementsColsDef = [
    { name: 'fecha', type: 'TEXT' },
    { name: 'tipo_mov', type: 'TEXT' },
    { name: 'cantidad', type: 'REAL' },
    { name: 'costo_unitario', type: 'REAL' },
    { name: 'costo_total', type: 'REAL' },
    { name: 'glosa', type: 'TEXT' },
    { name: 'reference_id', type: 'TEXT' }
];
inventoryMovementsColsDef.forEach(c => ensureColumnExists('inventory_movements', c.name, c.type));

const cashMovementsColsDef = [
    { name: 'fecha', type: 'TEXT' },
    { name: 'tipo', type: 'TEXT' },
    { name: 'glosa', type: 'TEXT' },
    { name: 'monto', type: 'REAL' },
    { name: 'cta', type: 'TEXT' }
];
cashMovementsColsDef.forEach(c => ensureColumnExists('cash_movements', c.name, c.type));

// Asegurar columnas de maintenance
ensureColumnExists('maintenance', 'periodo', 'TEXT');
ensureColumnExists('maintenance', 'anexo', 'TEXT');
ensureColumnExists('costs', 'porcentaje', 'REAL');
ensureColumnExists('glosas_habituales', 'category', 'TEXT');

// --- Migración Forzada: Crear balance_inicial si no existe ---
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS balance_inicial (
            id TEXT PRIMARY KEY,
            workspace_id TEXT,
            user_id TEXT,
            cta TEXT,
            desc TEXT,
            debe REAL DEFAULT 0,
            haber REAL DEFAULT 0
        )
    `);
    console.log('[DB] Tabla balance_inicial verificada/creada.');
} catch (e) {
    console.error('[DB ERROR] No se pudo crear balance_inicial:', e.message);
}

const dbManager = {
    // --- Gestión de Usuarios ---
    createUser: (u) => {
        const stmt = db.prepare('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)');
        return stmt.run(u.id, u.email, u.password, u.name, u.role || 'user');
    },

    getUserByEmail: (email) => {
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    },

    // --- Gestión de Workspaces (Filtrado por Usuario) ---
    getWorkspaces: (userId) => {
        const rows = db.prepare('SELECT * FROM workspaces WHERE user_id = ?').all(userId);
        return rows.map(r => ({
            ...r,
            sol_user: decrypt(r.sol_user),
            sol_pass: decrypt(r.sol_pass),
            sunatClientId: decrypt(r.sunatClientId),
            sunatClientSecret: decrypt(r.sunatClientSecret)
        }));
    },

    saveWorkspace: (w, userId) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO workspaces 
            (ruc, name, regimenTributario, location, address, support, period, logoBase64, sol_user, sol_pass, sunatClientId, sunatClientSecret, user_id, annualIncomeUIT)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            w.ruc, w.name, w.regimenTributario, w.location, w.address,
            w.support, w.period, w.logoBase64,
            encrypt(w.sol_user), encrypt(w.sol_pass),
            encrypt(w.sunatClientId), encrypt(w.sunatClientSecret),
            userId,
            Number(w.annualIncomeUIT || 0)
        );
    },

    deleteWorkspace: (ruc, userId) => {
        db.prepare('DELETE FROM workspaces WHERE ruc = ? AND user_id = ?').run(ruc, userId);
    },

    getWorkspaceData: (ruc, userId) => {
        const wsInfo = db.prepare('SELECT * FROM workspaces WHERE ruc = ? AND user_id = ?').get(ruc, userId);
        if (!wsInfo) return null;

        const purchases = db.prepare('SELECT * FROM purchases WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const sales = db.prepare('SELECT * FROM sales WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const journal = db.prepare('SELECT * FROM journal WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const honorarios = db.prepare('SELECT * FROM honorarios WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const entities = db.prepare('SELECT * FROM entities WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const plan = db.prepare('SELECT * FROM plan_global').all();
        const costs = db.prepare('SELECT * FROM costs WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const maintenance = db.prepare('SELECT * FROM maintenance WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const movimientosData = db.prepare('SELECT * FROM movimientos_data WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const asientos = db.prepare('SELECT * FROM asientos WHERE workspace_id = ? AND user_id = ?').all(ruc, userId).map(a => ({
            ...a,
            header: JSON.parse(a.header_json),
            lines: JSON.parse(a.lines_json)
        }));
        const glosasHabituales = db.prepare('SELECT * FROM glosas_habituales WHERE workspace_id = ? AND user_id = ?').all(ruc, userId).map(g => ({
            ...g,
            lines: JSON.parse(g.lines_json)
        }));
        const products = db.prepare('SELECT * FROM products WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const inventoryMovements = db.prepare('SELECT * FROM inventory_movements WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const cashMovements = db.prepare('SELECT * FROM cash_movements WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const fixedAssets = db.prepare('SELECT * FROM fixed_assets WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const employees = db.prepare('SELECT * FROM employees WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);
        const balanceInicial = db.prepare('SELECT * FROM balance_inicial WHERE workspace_id = ? AND user_id = ?').all(ruc, userId);

        return {
            currentCompany: {
                ...wsInfo,
                sol_user: decrypt(wsInfo.sol_user),
                sol_pass: decrypt(wsInfo.sol_pass),
                sunatClientId: decrypt(wsInfo.sunatClientId),
                sunatClientSecret: decrypt(wsInfo.sunatClientSecret)
            },
            purchases, sales, journal, honorarios, entities, plan, costs,
            maintenanceRecords: maintenance,
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

    run: (sql, params = []) => db.prepare(sql).run(...params),
    queryAll: (sql, params = []) => db.prepare(sql).all(...params),
    
    saveSirePurchases: (ruc, records, userId) => {
        const insert = db.prepare(`
            INSERT OR REPLACE INTO purchases 
            (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper, otros_tributos, total, car, estado_sire, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const transaction = db.transaction((recs) => {
            for (const r of recs) {
                insert.run(r.id, ruc, r.registro, r.fecha, r.fecVcto, r.tipo_doc, r.serie, r.numero, r.doc_tipo, r.doc_num, r.nombre, r.tc, r.bi, r.igv, r.noGravada, r.isc, r.icbper, r.otros_tributos, r.total, r.car, r.estado_sire, userId);
            }
        });
        transaction(records);
    },

    saveSireSales: (ruc, records, userId) => {
        const insert = db.prepare(`
            INSERT OR REPLACE INTO sales 
            (id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero, doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper, otros_tributos, total, car, estado_sire, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const transaction = db.transaction((recs) => {
            for (const r of recs) {
                insert.run(r.id, ruc, r.registro, r.fecha, r.fecVcto, r.tipo_doc, r.serie, r.numero, r.doc_tipo, r.doc_num, r.nombre, r.tc, r.bi, r.igv, r.noGravada, r.isc, r.icbper, r.otros_tributos, r.total, r.car, r.estado_sire, userId);
            }
        });
        transaction(records);
    },

    backup: async () => {
        try {
            const backupName = `backup_softcontable_${Date.now()}.db`;
            const backupPath = path.join(path.dirname(dbPath), backupName);
            await db.backup(backupPath);
            return backupPath;
        } catch (error) {
            console.error('[BACKUP ERROR]:', error);
            throw error;
        }
    },

    getCCCMetrics: (ruc, userId) => {
        // Cálculo simplificado de métricas CCC para la web
        const querySaldo = (ctaPrefix) => {
            const row = db.prepare(`
                SELECT SUM(debe) - SUM(haber) as saldo 
                FROM journal 
                WHERE workspace_id = ? AND user_id = ? AND cta LIKE ?
            `).get(ruc, userId, `${ctaPrefix}%`);
            return row?.saldo || 0;
        };

        const inventario = querySaldo('20');
        const cobrar = querySaldo('12');
        const pagar = Math.abs(querySaldo('42'));
        
        // Ventas y Compras anualizadas (estimado)
        const ventas = Math.abs(querySaldo('70'));
        const compras = querySaldo('60');

        return {
            dio: ventas > 0 ? (inventario / (ventas / 360)) : 0,
            dso: ventas > 0 ? (cobrar / (ventas / 360)) : 0,
            dpo: compras > 0 ? (pagar / (compras / 360)) : 0
        };
    },

    saveBalanceInicial: (ruc, userId, item) => {
        // Asegurar tabla y columna descripcion (Migración robusta)
        db.exec(`CREATE TABLE IF NOT EXISTS balance_inicial (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, cta TEXT, descripcion TEXT, debe REAL DEFAULT 0, haber REAL DEFAULT 0)`);
        try { db.exec(`ALTER TABLE balance_inicial ADD COLUMN descripcion TEXT`); } catch(e) {}

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO balance_inicial (id, workspace_id, user_id, cta, descripcion, debe, haber)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(item.id, ruc, userId, item.cta, item.desc || item.descripcion || '', item.debe || 0, item.haber || 0);
    },

    saveBalanceInicialBulk: (ruc, userId, items) => {
        db.exec(`CREATE TABLE IF NOT EXISTS balance_inicial (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, cta TEXT, descripcion TEXT, debe REAL DEFAULT 0, haber REAL DEFAULT 0)`);
        try { db.exec(`ALTER TABLE balance_inicial ADD COLUMN descripcion TEXT`); } catch(e) {}

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO balance_inicial (id, workspace_id, user_id, cta, descripcion, debe, haber)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const transaction = db.transaction((rows) => {
            for (const item of rows) {
                stmt.run(item.id, ruc, userId, item.cta, item.desc || item.descripcion || '', item.debe || 0, item.haber || 0);
            }
        });
        
        return transaction(items);
    },

    deleteBalanceInicial: (ruc, userId, id) => {
        db.exec(`CREATE TABLE IF NOT EXISTS balance_inicial (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, cta TEXT, descripcion TEXT, debe REAL DEFAULT 0, haber REAL DEFAULT 0)`);
        return db.prepare(`
            DELETE FROM balance_inicial WHERE id = ? AND workspace_id = ? AND user_id = ?
        `).run(id, ruc, userId);
    },

    createSuggestion: (s) => {
        const stmt = db.prepare(`
            INSERT INTO suggestions (id, user_id, user_email, workspace_ruc, workspace_name, view_context, user_comment, image_base64, system_state, ai_analysis, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(s.id, s.user_id, s.user_email, s.workspace_ruc, s.workspace_name, s.view_context, s.user_comment, s.image_base64, s.system_state, s.ai_analysis, s.status || 'PENDIENTE');
    },

    getSuggestions: () => {
        return db.prepare(`SELECT * FROM suggestions ORDER BY created_at DESC`).all();
    },

    resolveSuggestion: (id) => {
        return db.prepare(`UPDATE suggestions SET status = 'RESUELTO' WHERE id = ?`).run(id);
    },

    getAdminUsersSummary: () => {
        const users = db.prepare(`SELECT id, email, name, role, created_at FROM users`).all();
        return users.map(u => {
            const workspaceCount = db.prepare(`SELECT COUNT(*) as count FROM workspaces WHERE user_id = ?`).get(u.id)?.count || 0;
            const workspaces = db.prepare(`SELECT ruc, name FROM workspaces WHERE user_id = ?`).all(u.id);
            const purchaseCount = db.prepare(`SELECT COUNT(*) as count FROM purchases WHERE user_id = ?`).get(u.id)?.count || 0;
            const saleCount = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE user_id = ?`).get(u.id)?.count || 0;
            const journalCount = db.prepare(`SELECT COUNT(*) as count FROM journal WHERE user_id = ?`).get(u.id)?.count || 0;
            return {
                ...u,
                workspaceCount,
                workspaces,
                purchaseCount,
                saleCount,
                journalCount
            };
        });
    }
};

// --- Carga Inicial de Plan Contable (si está vacío) ---
const planCount = db.prepare('SELECT COUNT(*) as count FROM plan_global').get().count;
if (planCount === 0) {
    try {
        const planPath = path.join(__dirname, 'planContable.json');
        if (fs.existsSync(planPath)) {
            const fullPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
            console.log(`[DB] Inicializando Plan Contable con ${fullPlan.length} cuentas...`);
            
            const insertPlan = db.prepare(`
                INSERT INTO plan_global (cta, description, type, reqCenCos, amarreDebe, amarreHaber) 
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            db.transaction(() => {
                for (const p of fullPlan) {
                    insertPlan.run(
                        p.cta, 
                        p.description, 
                        p.type, 
                        p.reqCenCos ? 1 : 0, 
                        p.amarreDebe || null, 
                        p.amarreHaber || null
                    );
                }
            })();
            console.log('[DB] Plan Contable inicializado con éxito.');
        }
    } catch (error) {
        console.error('[DB ERROR] Error cargando planContable.json:', error.message);
    }
}

module.exports = dbManager;
