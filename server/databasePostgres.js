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
function translateSqliteToPostgres(sql, params) {
    let translatedSql = sql;
    let translatedParams = [...params];
    
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
        
        // Lista de tablas críticas que deben tener PRIMARY KEY
        const criticalTables = [
            { 
                name: 'asientos', 
                pk: 'id',
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
                pk: 'id',
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
                        tc REAL,
                        bi REAL,
                        igv REAL,
                        noGravada REAL,
                        isc REAL,
                        total REAL,
                        glosa TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_purchases_workspace ON purchases(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
                `
            },
            { 
                name: 'sales', 
                pk: 'id',
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
                        tc REAL,
                        bi REAL,
                        igv REAL,
                        noGravada REAL,
                        isc REAL,
                        total REAL,
                        glosa TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_sales_workspace ON sales(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
                `
            },
            { 
                name: 'journal', 
                pk: 'id',
                schema: `
                    CREATE TABLE IF NOT EXISTS journal (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
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
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_journal_workspace ON journal(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_journal_user ON journal(user_id);
                `
            }
        ];
        
        for (const table of criticalTables) {
            // Verificar si existe la tabla
            const tableExists = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [table.name]);
            
            if (!tableExists.rows[0].exists) {
                console.log(`[POSTGRES] Creando tabla ${table.name}...`);
                await pool.query(table.schema);
                console.log(`[POSTGRES] ✅ Tabla ${table.name} creada`);
            } else {
                // Verificar si existe el PRIMARY KEY
                const pkExists = await pool.query(`
                    SELECT constraint_name
                    FROM information_schema.table_constraints
                    WHERE table_name = $1
                    AND constraint_type = 'PRIMARY KEY';
                `, [table.name]);
                
                if (pkExists.rows.length === 0) {
                    console.log(`[POSTGRES] Agregando PRIMARY KEY a ${table.name}...`);
                    try {
                        await pool.query(`ALTER TABLE ${table.name} ADD PRIMARY KEY (${table.pk});`);
                        console.log(`[POSTGRES] ✅ PRIMARY KEY agregado a ${table.name}`);
                    } catch (error) {
                        console.error(`[POSTGRES] Error agregando PK a ${table.name}:`, error.message);
                    }
                }
            }
        }
        
        console.log('[POSTGRES] ✅ Schema constraints verificados y corregidos');
    } catch (error) {
        console.error('[POSTGRES] Error verificando constraints:', error.message);
    }
}
