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
        monto REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS maintenance (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        descripcion TEXT,
        monto REAL,
        user_id TEXT,
        FOREIGN KEY(workspace_id) REFERENCES workspaces(ruc) ON DELETE CASCADE
    );

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

// Función auxiliar para añadir columnas si no existen (para migración de tablas existentes)
function addUserIdColumn(tableName) {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        if (!info.some(col => col.name === 'user_id')) {
            db.exec(`ALTER TABLE ${tableName} ADD COLUMN user_id TEXT`);
            console.log(`Columna user_id añadida a ${tableName}`);
        }
    } catch (e) {
        console.error(`Error al verificar/añadir user_id a ${tableName}:`, e.message);
    }
}

// Asegurar user_id en todas las tablas por si acaso
['workspaces', 'purchases', 'sales', 'journal', 'entities', 'asientos', 'products', 'inventory_movements', 'cash_movements', 'fixed_assets', 'employees', 'balance_inicial', 'maintenance', 'costs', 'honorarios', 'movimientos_data'].forEach(addUserIdColumn);

const dbManager = {
    // --- Gestión de Usuarios ---
    createUser: (u) => {
        const stmt = db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)');
        return stmt.run(u.id, u.email, u.password, u.name);
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
            (ruc, name, regimenTributario, location, address, support, period, logoBase64, sol_user, sol_pass, sunatClientId, sunatClientSecret, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            w.ruc, w.name, w.regimenTributario, w.location, w.address,
            w.support, w.period, w.logoBase64,
            encrypt(w.sol_user), encrypt(w.sol_pass),
            encrypt(w.sunatClientId), encrypt(w.sunatClientSecret),
            userId
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
    }
};

// --- Carga Inicial de Plan Contable (si está vacío) ---
const planCount = db.prepare('SELECT COUNT(*) as count FROM plan_global').get().count;
if (planCount === 0) {
    console.log('[DB] Inicializando Plan Contable básico...');
    const basicPlan = [
        { cta: '101', desc: 'Caja', type: 'Activo' },
        { cta: '1041', desc: 'Cuentas Corrientes Operativas', type: 'Activo' },
        { cta: '1212', desc: 'Facturas por Cobrar - Emitidas', type: 'Activo' },
        { cta: '40111', desc: 'IGV - Cuenta Propia', type: 'Pasivo' },
        { cta: '4212', desc: 'Facturas por Pagar - Emitidas', type: 'Pasivo' },
        { cta: '6011', desc: 'Mercaderías manufacturadas', type: 'Gasto' },
        { cta: '70111', desc: 'Mercaderías manufacturadas - Terceros', type: 'Ingreso' }
    ];
    const insertPlan = db.prepare('INSERT INTO plan_global (cta, description, type, reqCenCos) VALUES (?, ?, ?, 0)');
    db.transaction(() => {
        basicPlan.forEach(p => insertPlan.run(p.cta, p.desc, p.type));
    })();
}

module.exports = dbManager;
