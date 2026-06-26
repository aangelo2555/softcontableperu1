/**
 * Capa de Base de Datos - PostgreSQL
 * 
 * Reemplaza databaseServer.js para usar PostgreSQL en lugar de SQLite
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// Encryption (mantener compatibilidad con SQLite)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'softcontable-2026-secret-key-change-this';
const algorithm = 'aes-256-cbc';

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'utf8').subarray(0, 32), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
    if (!text) return '';
    if (text === 'null') return '';
    
    // Convertir Buffer a string si es necesario
    if (Buffer.isBuffer(text)) {
        text = text.toString('utf8');
    }
    
    // Verificar que sea string
    if (typeof text !== 'string') {
        console.error('[DECRYPT ERROR] Expected string, got:', typeof text);
        return '';
    }
    
    try {
        const parts = text.split(':');
        if (parts.length !== 2) return '';
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];
        const decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'utf8').subarray(0, 32), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('[DECRYPT ERROR]', e.message);
        return '';
    }
}

// Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // 20 conexiones máximo
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Event listeners
pool.on('connect', () => {
    console.log('[POSTGRES] Nueva conexión establecida');
});

pool.on('error', (err) => {
    console.error('[POSTGRES ERROR]', err);
});

// Helper: Convertir sintaxis SQLite a PostgreSQL
function translateSqliteToPostgres(sql, params = []) {
    let translatedSql = sql;
    let translatedParams = params ? [...params] : [];
    
    // 0. Mapear columna 'desc' a 'descripcion' (evitar palabra reservada)
    // Solo en contextos de columnas (después de SELECT, INSERT, UPDATE, etc.)
    translatedSql = translatedSql.replace(/(\bSELECT\s+[^F]+?)\bdesc\b/gi, '$1descripcion');
    translatedSql = translatedSql.replace(/(\bINSERT\s+INTO\s+\w+\s*\([^)]*?)\bdesc\b/gi, '$1descripcion');
    translatedSql = translatedSql.replace(/(\bUPDATE\s+\w+\s+SET\s+[^W]*?)\bdesc\b/gi, '$1descripcion');
    translatedSql = translatedSql.replace(/,\s*desc\s*,/gi, ', descripcion,');
    translatedSql = translatedSql.replace(/\(\s*desc\s*,/gi, '(descripcion,');
    translatedSql = translatedSql.replace(/,\s*desc\s*\)/gi, ', descripcion)');
    
    // 1. Convertir placeholders ? a $1, $2, etc.
    let paramIndex = 1;
    translatedSql = translatedSql.replace(/\?/g, () => `$${paramIndex++}`);
    
    // 2. Convertir INSERT OR REPLACE a INSERT ... ON CONFLICT
    const insertOrReplaceMatch = translatedSql.match(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)\s*VALUES/i);
    if (insertOrReplaceMatch) {
        const tableName = insertOrReplaceMatch[1];
        const columns = insertOrReplaceMatch[2].split(',').map(c => c.trim());
        
        // Determinar la primary key según la tabla
        // Para PostgreSQL multi-tenant, usamos PRIMARY KEY compuesta
        let primaryKey = 'id';
        let conflictColumns = 'id';
        
        if (tableName === 'asientos') {
            // Para asientos, solo usamos 'id' como conflict porque es la PK real
            conflictColumns = 'id';
        } else if (tableName === 'workspaces') {
            conflictColumns = 'ruc, user_id';
        } else if (['purchases', 'sales', 'journal', 'honorarios', 'entities', 'costs', 'maintenance', 'products', 'employees', 'fixed_assets'].includes(tableName)) {
            // Para otras tablas, solo ID
            conflictColumns = 'id';
        }
        
        // Generar lista de actualizaciones excluyendo las PK
        const pkColumns = conflictColumns.split(',').map(c => c.trim());
        const updateColumns = columns
            .filter(col => !pkColumns.includes(col))
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');
        
        translatedSql = translatedSql.replace(
            /INSERT OR REPLACE INTO/i,
            `INSERT INTO`
        );
        
        // Agregar ON CONFLICT al final
        if (updateColumns) {
            translatedSql += ` ON CONFLICT (${conflictColumns}) DO UPDATE SET ${updateColumns}`;
        } else {
            translatedSql += ` ON CONFLICT (${conflictColumns}) DO NOTHING`;
        }
    }
    
    // 3. Convertir INSERT OR IGNORE a INSERT ... ON CONFLICT DO NOTHING
    if (translatedSql.match(/INSERT OR IGNORE/i)) {
        const insertOrIgnoreMatch = translatedSql.match(/INSERT OR IGNORE INTO (\w+)\s*\(([^)]+)\)/i);
        if (insertOrIgnoreMatch) {
            const tableName = insertOrIgnoreMatch[1];
            let primaryKey = 'id';
            if (tableName === 'workspaces') {
                primaryKey = 'ruc, user_id';
            }
            
            translatedSql = translatedSql.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
            translatedSql += ` ON CONFLICT (${primaryKey}) DO NOTHING`;
        }
    }
    
    // 4. Convertir AUTOINCREMENT a SERIAL (en CREATE TABLE, por si acaso)
    translatedSql = translatedSql.replace(/AUTOINCREMENT/gi, 'SERIAL');
    
    // 5. Convertir datetime('now') a NOW()
    translatedSql = translatedSql.replace(/datetime\('now'\)/gi, 'NOW()');
    
    return { sql: translatedSql, params: translatedParams };
}

// Helper: Ejecutar query
async function query(text, params) {
    const start = Date.now();
    try {
        // Traducir sintaxis SQLite a PostgreSQL
        const { sql: translatedSql, params: translatedParams } = translateSqliteToPostgres(text, params);
        
        const res = await pool.query(translatedSql, translatedParams);
        const duration = Date.now() - start;
        
        if (duration > 500) {
            console.warn(`[POSTGRES SLOW QUERY] ${duration}ms:`, translatedSql.substring(0, 100));
        }
        
        return res;
    } catch (error) {
        console.error('[POSTGRES QUERY ERROR]', error.message);
        console.error('Original Query:', text);
        console.error('Translated Query:', translateSqliteToPostgres(text, params).sql);
        throw error;
    }
}

// Database API
const db = {
    // Raw pool access
    pool,
    
    // Execute query and return rows
    queryAll: async (sql, params = []) => {
        const result = await query(sql, params);
        return result.rows;
    },
    
    // Execute query and return first row
    queryOne: async (sql, params = []) => {
        const result = await query(sql, params);
        return result.rows[0] || null;
    },
    
    // Execute INSERT/UPDATE/DELETE
    run: async (sql, params = []) => {
        const result = await query(sql, params);
        return {
            changes: result.rowCount,
            lastInsertRowid: result.rows[0]?.id || null
        };
    },
    
    // Execute multiple queries in transaction
    transaction: async (callback) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    },
    
    // Get workspaces for user
    getWorkspaces: async (userId) => {
        const result = await query(
            'SELECT * FROM workspaces WHERE user_id = $1 ORDER BY name ASC',
            [userId]
        );
        
        return result.rows.map(ws => ({
            ...ws,
            sol_user: decrypt(ws.sol_user),
            sol_pass: decrypt(ws.sol_pass),
            sunatClientId: decrypt(ws.sunatclientid),
            sunatClientSecret: decrypt(ws.sunatclientsecret)
        }));
    },
    
    // Get workspace data (paginado)
    getWorkspaceData: async (ruc, userId, options = {}) => {
        const page = options.page || 1;
        const limit = options.limit || 100;
        const offset = (page - 1) * limit;
        
        const wsInfo = await query(
            'SELECT * FROM workspaces WHERE ruc = $1 AND user_id = $2',
            [ruc, userId]
        );
        
        if (!wsInfo.rows[0]) return null;
        
        // Cargar datos con paginación
        const [purchases, sales, journal] = await Promise.all([
            query(
                'SELECT * FROM purchases WHERE workspace_id = $1 AND user_id = $2 ORDER BY fecha DESC LIMIT $3 OFFSET $4',
                [ruc, userId, limit, offset]
            ),
            query(
                'SELECT * FROM sales WHERE workspace_id = $1 AND user_id = $2 ORDER BY fecha DESC LIMIT $3 OFFSET $4',
                [ruc, userId, limit, offset]
            ),
            query(
                'SELECT * FROM journal WHERE workspace_id = $1 AND user_id = $2 ORDER BY fecha DESC LIMIT $3 OFFSET $4',
                [ruc, userId, limit, offset]
            )
        ]);
        
        // Cargar datos ligeros (sin paginación)
        const [entities, costs, products] = await Promise.all([
            query('SELECT * FROM entities WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM costs WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM products WHERE workspace_id = $1 AND user_id = $2 LIMIT 1000', [ruc, userId])
        ]);
        
        // Plan contable del usuario
        let plan = await query('SELECT * FROM plan_global WHERE user_id = $1', [userId]);
        
        return {
            currentCompany: {
                ...wsInfo.rows[0],
                sol_user: decrypt(wsInfo.rows[0].sol_user),
                sol_pass: decrypt(wsInfo.rows[0].sol_pass),
                sunatClientId: decrypt(wsInfo.rows[0].sunatclientid),
                sunatClientSecret: decrypt(wsInfo.rows[0].sunatclientsecret)
            },
            purchases: purchases.rows,
            sales: sales.rows,
            journal: journal.rows,
            entities: entities.rows,
            costs: costs.rows,
            products: products.rows,
            plan: plan.rows,
            // Metadata de paginación
            pagination: {
                page,
                limit,
                hasMore: purchases.rows.length === limit || sales.rows.length === limit
            }
        };
    },
    
    // Save workspace
    saveWorkspace: async (workspace, userId) => {
        const {
            ruc, name, address, location, support, period, logoBase64,
            regimenTributario, businessType, annualIncomeUIT, agente_retencion,
            ciiuCode, fixedAssetsValue, employeeCount,
            sol_user, sol_pass, sunatClientId, sunatClientSecret,
            certificado_pfx, certificado_pass
        } = workspace;
        
        // Cifrar credenciales
        const encryptedSolUser = encrypt(sol_user || '');
        const encryptedSolPass = encrypt(sol_pass || '');
        const encryptedClientId = encrypt(sunatClientId || '');
        const encryptedClientSecret = encrypt(sunatClientSecret || '');
        const encryptedCertPass = certificado_pass ? encrypt(certificado_pass) : null;
        
        try {
            // Primero intentar actualizar
            const updateResult = await query(`
                UPDATE workspaces SET
                    name = $3,
                    regimenTributario = $4,
                    location = $5,
                    address = $6,
                    support = $7,
                    period = $8,
                    logoBase64 = $9,
                    sol_user = $10,
                    sol_pass = $11,
                    sunatClientId = $12,
                    sunatClientSecret = $13,
                    businessType = $14,
                    annualIncomeUIT = $15,
                    agente_retencion = $16,
                    ciiuCode = $17,
                    fixedAssetsValue = $18,
                    employeeCount = $19,
                    certificado_pfx = $20,
                    certificado_pass = $21
                WHERE ruc = $1 AND user_id = $2
            `, [
                ruc, userId, name, regimenTributario, location, address, support, period,
                logoBase64, encryptedSolUser, encryptedSolPass, encryptedClientId, encryptedClientSecret,
                businessType, annualIncomeUIT, agente_retencion, ciiuCode,
                fixedAssetsValue, employeeCount, certificado_pfx, encryptedCertPass
            ]);
            
            // Si no se actualizó ninguna fila, hacer INSERT
            if (updateResult.rowCount === 0) {
                await query(`
                    INSERT INTO workspaces (
                        ruc, user_id, name, regimenTributario, location, address, support, period,
                        logoBase64, sol_user, sol_pass, sunatClientId, sunatClientSecret,
                        businessType, annualIncomeUIT, agente_retencion, ciiuCode,
                        fixedAssetsValue, employeeCount, certificado_pfx, certificado_pass
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                `, [
                    ruc, userId, name, regimenTributario, location, address, support, period,
                    logoBase64, encryptedSolUser, encryptedSolPass, encryptedClientId, encryptedClientSecret,
                    businessType, annualIncomeUIT, agente_retencion, ciiuCode,
                    fixedAssetsValue, employeeCount, certificado_pfx, encryptedCertPass
                ]);
            }
        } catch (error) {
            console.error('[POSTGRES] Error en saveWorkspace:', error.message);
            throw error;
        }
    },
    
    // Delete workspace
    deleteWorkspace: async (ruc, userId) => {
        await db.transaction(async (client) => {
            // Eliminar todos los datos asociados
            const tables = [
                'purchases', 'sales', 'journal', 'asientos', 'honorarios',
                'entities', 'costs', 'maintenance', 'movimientos_data',
                'products', 'inventory_movements', 'cash_movements',
                'fixed_assets', 'employees', 'balance_inicial', 'bank_statements'
            ];
            
            for (const table of tables) {
                await client.query(
                    `DELETE FROM ${table} WHERE workspace_id = $1 AND user_id = $2`,
                    [ruc, userId]
                );
            }
            
            // Eliminar workspace
            await client.query(
                'DELETE FROM workspaces WHERE ruc = $1 AND user_id = $2',
                [ruc, userId]
            );
        });
    },
    
    // Execute raw query (con validación de seguridad)
    execute: async (sql, params = []) => {
        // Validar que no sea query peligrosa
        const upperSql = sql.toUpperCase().trim();
        
        if (upperSql.startsWith('DROP') || upperSql.includes('DROP TABLE')) {
            throw new Error('DROP queries no permitidas por seguridad');
        }
        
        return await db.run(sql, params);
    },
    
    // Admin functions
    getSuggestions: async () => {
        const result = await query('SELECT * FROM suggestions ORDER BY created_at DESC', []);
        return result.rows;
    },
    
    getAdminUsersSummary: async () => {
        const result = await query(`
            SELECT 
                u.id,
                u.email,
                u.name,
                u.role,
                u.created_at,
                COUNT(DISTINCT w.ruc) as workspace_count
            FROM users u
            LEFT JOIN workspaces w ON w.user_id = u.id
            GROUP BY u.id, u.email, u.name, u.role, u.created_at
            ORDER BY u.created_at DESC
        `, []);
        return result.rows;
    }
};

module.exports = db;

// Health check on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('[POSTGRES] ❌ Error de conexión:', err.message);
    } else {
        console.log('[POSTGRES] ✅ Conectado exitosamente. Server time:', res.rows[0].now);
        
        // Ejecutar migraciones de schema si es necesario
        ensureSchemaConstraints();
    }
});

// Asegurar que existen los constraints necesarios
async function ensureSchemaConstraints() {
    try {
        console.log('[POSTGRES] Verificando schema y constraints...');
        
        // Lista de tablas críticas con schema completo y correcto
        const tables = [
            {
                name: 'users',
                schema: `
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        name TEXT,
                        role TEXT DEFAULT 'user',
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                `
            },
            {
                name: 'workspaces',
                schema: `
                    CREATE TABLE IF NOT EXISTS workspaces (
                        ruc TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        name TEXT,
                        regimenTributario TEXT,
                        location TEXT,
                        address TEXT,
                        support TEXT,
                        period TEXT,
                        logoBase64 TEXT,
                        sol_user BYTEA,
                        sol_pass BYTEA,
                        sunatClientId BYTEA,
                        sunatClientSecret BYTEA,
                        businessType TEXT,
                        annualIncomeUIT NUMERIC DEFAULT 0,
                        agente_retencion BOOLEAN DEFAULT false,
                        ciiuCode TEXT,
                        fixedAssetsValue NUMERIC DEFAULT 0,
                        employeeCount INTEGER DEFAULT 0,
                        certificado_pfx BYTEA,
                        certificado_pass BYTEA,
                        PRIMARY KEY (ruc, user_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
                `
            },
            {
                name: 'asientos',
                schema: `
                    CREATE TABLE IF NOT EXISTS asientos (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        header_json TEXT,
                        lines_json TEXT,
                        user_id TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_asientos_workspace ON asientos(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_asientos_user ON asientos(user_id);
                `
            },
            {
                name: 'purchases',
                schema: `
                    CREATE TABLE IF NOT EXISTS purchases (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        registro TEXT,
                        fecha TEXT,
                        fecVcto TEXT,
                        tipo_doc TEXT,
                        serie TEXT,
                        numero TEXT,
                        doc_tipo TEXT,
                        doc_num TEXT,
                        nombre TEXT,
                        tc NUMERIC,
                        bi NUMERIC,
                        igv NUMERIC,
                        noGravada NUMERIC,
                        isc NUMERIC,
                        total NUMERIC,
                        glosa TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_purchases_workspace ON purchases(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
                    CREATE INDEX IF NOT EXISTS idx_purchases_fecha ON purchases(fecha);
                `
            },
            {
                name: 'sales',
                schema: `
                    CREATE TABLE IF NOT EXISTS sales (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        registro TEXT,
                        fecha TEXT,
                        fecVcto TEXT,
                        tipo_doc TEXT,
                        serie TEXT,
                        numero TEXT,
                        doc_tipo TEXT,
                        doc_num TEXT,
                        nombre TEXT,
                        tc NUMERIC,
                        bi NUMERIC,
                        igv NUMERIC,
                        noGravada NUMERIC,
                        isc NUMERIC,
                        total NUMERIC,
                        glosa TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_sales_workspace ON sales(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
                    CREATE INDEX IF NOT EXISTS idx_sales_fecha ON sales(fecha);
                `
            },
            {
                name: 'journal',
                schema: `
                    CREATE TABLE IF NOT EXISTS journal (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        source TEXT,
                        asiento TEXT,
                        fecha TEXT,
                        glosa TEXT,
                        cta TEXT,
                        descripcion TEXT,
                        debe NUMERIC,
                        haber NUMERIC,
                        user_id TEXT NOT NULL,
                        medio_pago TEXT,
                        nro_transaccion TEXT,
                        razon_social TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_journal_workspace ON journal(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_journal_user ON journal(user_id);
                    CREATE INDEX IF NOT EXISTS idx_journal_fecha ON journal(fecha);
                    CREATE INDEX IF NOT EXISTS idx_journal_cuenta ON journal(cta);
                `
            },
            {
                name: 'plan_global',
                schema: `
                    CREATE TABLE IF NOT EXISTS plan_global (
                        cta TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        description TEXT,
                        type TEXT,
                        reqCenCos INTEGER DEFAULT 0,
                        amarreDebe TEXT,
                        amarreHaber TEXT,
                        div INTEGER DEFAULT 1,
                        cta_cc1 TEXT,
                        pct_cc1 NUMERIC DEFAULT 0,
                        cta_cc2 TEXT,
                        pct_cc2 NUMERIC DEFAULT 0,
                        cta_cc3 TEXT,
                        pct_cc3 NUMERIC DEFAULT 0,
                        destino_haber TEXT,
                        niif18_category TEXT,
                        PRIMARY KEY (cta, user_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_plan_user ON plan_global(user_id);
                `
            },
            {
                name: 'entities',
                schema: `
                    CREATE TABLE IF NOT EXISTS entities (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        tipo TEXT,
                        ruc TEXT,
                        descripcion TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_entities_workspace ON entities(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id);
                `
            },
            {
                name: 'honorarios',
                schema: `
                    CREATE TABLE IF NOT EXISTS honorarios (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
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
                        bi NUMERIC,
                        retencion NUMERIC,
                        total NUMERIC,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_honorarios_workspace ON honorarios(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_honorarios_user ON honorarios(user_id);
                `
            },
            {
                name: 'costs',
                schema: `
                    CREATE TABLE IF NOT EXISTS costs (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        codigo TEXT,
                        descripcion TEXT,
                        porcentaje NUMERIC,
                        monto NUMERIC,
                        cuenta_debe TEXT,
                        cuenta_haber TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_costs_workspace ON costs(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_costs_user ON costs(user_id);
                `
            },
            {
                name: 'accounting_periods',
                schema: `
                    CREATE TABLE IF NOT EXISTS accounting_periods (
                        id SERIAL PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        periodo TEXT NOT NULL,
                        tipo TEXT NOT NULL DEFAULT 'MENSUAL',
                        estado TEXT NOT NULL DEFAULT 'ABIERTO',
                        cerrado_por TEXT,
                        cerrado_at TIMESTAMP,
                        notas TEXT,
                        user_id TEXT,
                        UNIQUE(workspace_id, periodo, tipo, user_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_accounting_periods_workspace ON accounting_periods(workspace_id, user_id);
                `
            },
            {
                name: 'period_versions',
                schema: `
                    CREATE TABLE IF NOT EXISTS period_versions (
                        id SERIAL PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        periodo TEXT NOT NULL,
                        tipo TEXT NOT NULL DEFAULT 'MENSUAL',
                        module TEXT,
                        version INTEGER NOT NULL DEFAULT 1,
                        snapshot_data TEXT,
                        is_stale INTEGER DEFAULT 0,
                        stale_since TIMESTAMP,
                        last_sync TIMESTAMP,
                        created_at TIMESTAMP DEFAULT NOW(),
                        created_by TEXT,
                        user_id TEXT
                    );
                `
            },
            {
                name: 'period_versions_indexes',
                schema: `
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_period_versions_unique 
                        ON period_versions(workspace_id, periodo, module, user_id);
                    CREATE INDEX IF NOT EXISTS idx_period_versions_workspace 
                        ON period_versions(workspace_id, user_id);
                    CREATE INDEX IF NOT EXISTS idx_period_versions_module 
                        ON period_versions(workspace_id, module);
                `
            },
            {
                name: 'products',
                schema: `
                    CREATE TABLE IF NOT EXISTS products (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        codigo TEXT,
                        descripcion TEXT,
                        unidad TEXT,
                        precio NUMERIC DEFAULT 0,
                        stock NUMERIC DEFAULT 0,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
                `
            },
            {
                name: 'maintenance',
                schema: `
                    CREATE TABLE IF NOT EXISTS maintenance (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        periodo TEXT,
                        anexo TEXT,
                        descripcion TEXT,
                        monto NUMERIC,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_maintenance_workspace ON maintenance(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_maintenance_user ON maintenance(user_id);
                `
            },
            {
                name: 'movimientos_data',
                schema: `
                    CREATE TABLE IF NOT EXISTS movimientos_data (
                        workspace_id TEXT,
                        period TEXT,
                        month INTEGER,
                        section TEXT,
                        key TEXT,
                        value TEXT,
                        user_id TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_movimientos_workspace ON movimientos_data(workspace_id, user_id);
                `
            },
            {
                name: 'fixed_assets',
                schema: `
                    CREATE TABLE IF NOT EXISTS fixed_assets (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        codigo TEXT,
                        descripcion TEXT,
                        fecha_adquisicion TEXT,
                        costo_adquisicion NUMERIC DEFAULT 0,
                        depreciacion_acumulada NUMERIC DEFAULT 0,
                        valor_neto NUMERIC DEFAULT 0,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_fixed_assets_workspace ON fixed_assets(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_fixed_assets_user ON fixed_assets(user_id);
                `
            },
            {
                name: 'employees',
                schema: `
                    CREATE TABLE IF NOT EXISTS employees (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        nombres TEXT,
                        apellidos TEXT,
                        dni TEXT,
                        cargo TEXT,
                        sueldo NUMERIC DEFAULT 0,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_employees_workspace ON employees(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
                `
            },
            {
                name: 'inventory_movements',
                schema: `
                    CREATE TABLE IF NOT EXISTS inventory_movements (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        product_id TEXT,
                        fecha TEXT,
                        tipo TEXT,
                        cantidad NUMERIC DEFAULT 0,
                        costo_unitario NUMERIC DEFAULT 0,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_inventory_workspace ON inventory_movements(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_movements(user_id);
                `
            },
            {
                name: 'cash_movements',
                schema: `
                    CREATE TABLE IF NOT EXISTS cash_movements (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        fecha TEXT,
                        tipo TEXT,
                        monto NUMERIC DEFAULT 0,
                        descripcion TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_cash_workspace ON cash_movements(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_cash_user ON cash_movements(user_id);
                `
            },
            {
                name: 'bank_statements',
                schema: `
                    CREATE TABLE IF NOT EXISTS bank_statements (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        fecha TEXT,
                        descripcion TEXT,
                        cargo NUMERIC DEFAULT 0,
                        abono NUMERIC DEFAULT 0,
                        saldo NUMERIC DEFAULT 0,
                        reconciled_journal_id TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_bank_statements_workspace ON bank_statements(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_bank_statements_user ON bank_statements(user_id);
                    CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciled ON bank_statements(reconciled_journal_id);
                `
            },
            {
                name: 'suggestions',
                schema: `
                    CREATE TABLE IF NOT EXISTS suggestions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT,
                        type TEXT,
                        title TEXT,
                        description TEXT,
                        status TEXT DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT NOW(),
                        resolved_at TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions(user_id);
                    CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
                `
            },
            {
                name: 'libro_diario_52',
                schema: `
                    CREATE TABLE IF NOT EXISTS libro_diario_52 (
                        id SERIAL PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        user_id TEXT,
                        periodo TEXT NOT NULL,
                        cuo TEXT NOT NULL,
                        correlativo_asiento TEXT NOT NULL,
                        fecha_operacion TEXT NOT NULL,
                        glosa TEXT NOT NULL,
                        codigo_cuenta TEXT NOT NULL,
                        denominacion_cuenta TEXT NOT NULL,
                        codigo_auxiliar TEXT,
                        denominacion_auxiliar TEXT,
                        centro_costos TEXT,
                        moneda TEXT DEFAULT '01',
                        tipo_cambio NUMERIC DEFAULT 0.000,
                        fecha_tipo_cambio TEXT,
                        monto_debe NUMERIC NOT NULL DEFAULT 0,
                        monto_haber NUMERIC NOT NULL DEFAULT 0,
                        dato_estructurado TEXT,
                        estado TEXT NOT NULL DEFAULT '1',
                        origen_modulo TEXT,
                        asiento_id_origen TEXT,
                        ejercicio INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        ref_periodo TEXT,
                        ref_cuo TEXT,
                        ref_codigo_libro TEXT,
                        columna_tabla9 TEXT,
                        grupo_tabla9 TEXT,
                        indicador_operacion TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_ld52_workspace ON libro_diario_52(workspace_id, user_id);
                    CREATE INDEX IF NOT EXISTS idx_ld52_periodo ON libro_diario_52(workspace_id, user_id, periodo);
                    CREATE INDEX IF NOT EXISTS idx_ld52_cuo ON libro_diario_52(workspace_id, cuo);
                    CREATE INDEX IF NOT EXISTS idx_ld52_cuo_periodo ON libro_diario_52(workspace_id, user_id, cuo, periodo);
                    CREATE INDEX IF NOT EXISTS idx_ld52_estado ON libro_diario_52(estado);
                    CREATE INDEX IF NOT EXISTS idx_ld52_origen ON libro_diario_52(origen_modulo, asiento_id_origen);
                    CREATE INDEX IF NOT EXISTS idx_ld52_cuenta ON libro_diario_52(codigo_cuenta);
                `
            },
            {
                name: 'sbs_rates',
                schema: `
                    CREATE TABLE IF NOT EXISTS sbs_rates (
                        fecha TEXT PRIMARY KEY,
                        compra NUMERIC NOT NULL,
                        venta NUMERIC NOT NULL
                    );
                `
            },
            {
                name: 'audit_logs',
                schema: `
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT,
                        user_id TEXT,
                        action TEXT,
                        entity_type TEXT,
                        entity_id TEXT,
                        changes TEXT,
                        timestamp TIMESTAMP DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
                `
            },
            {
                name: 'glosas_habituales',
                schema: `
                    CREATE TABLE IF NOT EXISTS glosas_habituales (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        category TEXT,
                        glosa TEXT,
                        lines_json TEXT,
                        user_id TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_glosas_workspace ON glosas_habituales(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_glosas_user ON glosas_habituales(user_id);
                `
            },
            {
                name: 'balance_inicial',
                schema: `
                    CREATE TABLE IF NOT EXISTS balance_inicial (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        cta TEXT,
                        descripcion TEXT,
                        debe NUMERIC DEFAULT 0,
                        haber NUMERIC DEFAULT 0
                    );
                    CREATE INDEX IF NOT EXISTS idx_balance_inicial_workspace ON balance_inicial(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_balance_inicial_user ON balance_inicial(user_id);
                `
            }
        ];
        
        for (const table of tables) {
            await pool.query(table.schema);
        }
        
        console.log('[POSTGRES] ✅ Schema y constraints verificados');
    } catch (error) {
        console.error('[POSTGRES] Error verificando constraints:', error.message);
    }
}
