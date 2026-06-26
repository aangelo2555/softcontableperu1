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
    if (!text || text === 'null') return '';
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

// Helper: Ejecutar query
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (duration > 500) {
            console.warn(`[POSTGRES SLOW QUERY] ${duration}ms:`, text.substring(0, 100));
        }
        
        return res;
    } catch (error) {
        console.error('[POSTGRES QUERY ERROR]', error.message);
        console.error('Query:', text);
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
            ruc, name, address, phone, email,
            sol_user, sol_pass, sunatClientId, sunatClientSecret,
            naturaleza_comercial, regime_type, activity_code, start_date
        } = workspace;
        
        // Cifrar credenciales
        const encryptedSolUser = encrypt(sol_user || '');
        const encryptedSolPass = encrypt(sol_pass || '');
        const encryptedClientId = encrypt(sunatClientId || '');
        const encryptedClientSecret = encrypt(sunatClientSecret || '');
        
        await query(`
            INSERT INTO workspaces (
                ruc, user_id, name, address, phone, email,
                sol_user, sol_pass, sunatClientId, sunatClientSecret,
                naturaleza_comercial, regime_type, activity_code, start_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (ruc, user_id) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                sol_user = EXCLUDED.sol_user,
                sol_pass = EXCLUDED.sol_pass,
                sunatClientId = EXCLUDED.sunatClientId,
                sunatClientSecret = EXCLUDED.sunatClientSecret,
                naturaleza_comercial = EXCLUDED.naturaleza_comercial,
                regime_type = EXCLUDED.regime_type,
                activity_code = EXCLUDED.activity_code,
                start_date = EXCLUDED.start_date
        `, [
            ruc, userId, name, address, phone, email,
            encryptedSolUser, encryptedSolPass, encryptedClientId, encryptedClientSecret,
            naturaleza_comercial, regime_type, activity_code, start_date
        ]);
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
    }
});
