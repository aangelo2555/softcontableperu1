/**
 * Capa de Base de Datos - PostgreSQL
 * 
 * Reemplaza databaseServer.js para usar PostgreSQL en lugar de SQLite
 */

const { Pool, types } = require('pg');
const { encrypt, decrypt } = require('./cryptoUtils');
const fs = require('fs');
const path = require('path');

// Force node-postgres to return NUMERIC (1700) and FLOAT types as native Numbers to prevent string concatenation bugs
types.setTypeParser(1700, val => val === null ? 0 : parseFloat(val));
types.setTypeParser(700, val => val === null ? 0 : parseFloat(val));
types.setTypeParser(701, val => val === null ? 0 : parseFloat(val));
types.setTypeParser(20, val => val === null ? 0 : parseInt(val, 10));
types.setTypeParser(23, val => val === null ? 0 : parseInt(val, 10));

// Connection Pool optimizado para alta concurrencia (50-100 usuarios simultáneos)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 30, // 30 conexiones activas máximo por nodo Express
    min: 4,  // 4 conexiones calientes en standby
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 20000, // Prevenir consultas colgadas de más de 20s
    keepAlive: true
});

// Event listeners
pool.on('connect', () => {
    console.log('[POSTGRES] Nueva conexión establecida');
});

pool.on('error', (err) => {
    console.error('[POSTGRES ERROR]', err);
});

// Helper to map PostgreSQL lowercase column names to camelCase frontend expected properties
function mapWorkspaceColumns(ws) {
    if (!ws) return null;
    return {
        ...ws,
        ruc: ws.ruc,
        name: ws.name,
        regimenTributario: ws.regimentributario || ws.regimenTributario || 'Régimen General',
        location: ws.location || '',
        address: ws.address || '',
        support: ws.support || '',
        period: ws.period || '',
        logoBase64: ws.logobase64 || ws.logoBase64 || '',
        sol_user: decrypt(ws.sol_user),
        sol_pass: decrypt(ws.sol_pass),
        sunatClientId: decrypt(ws.sunatclientid || ws.sunatClientId),
        sunatClientSecret: decrypt(ws.sunatclientsecret || ws.sunatClientSecret),
        businessType: ws.businesstype || ws.businessType || 'COMERCIAL',
        annualIncomeUIT: Number(ws.annualincomeuit ?? ws.annualIncomeUIT ?? 0),
        agente_retencion: Boolean(ws.agente_retencion),
        ciiuCode: ws.ciiucode || ws.ciiuCode || '',
        fixedAssetsValue: Number(ws.fixedassetsvalue ?? ws.fixedAssetsValue ?? 0),
        employeeCount: Number(ws.employeecount ?? ws.employeeCount ?? 0),
        certificado_pfx: ws.certificado_pfx || '',
        certificado_pass: ws.certificado_pass ? decrypt(ws.certificado_pass) : ''
    };
}

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
        const getConflictColumns = (tbl) => {
            const tblLower = tbl.toLowerCase();
            if (tblLower === 'asientos') return 'id';
            if (tblLower === 'workspaces') return 'ruc, user_id';
            if (tblLower === 'period_versions') return 'workspace_id, periodo, module, user_id';
            if (tblLower === 'plan_global') return 'cta, user_id';
            if (tblLower === 'mapa_pcge_tabla9') return 'codigo_cuenta_prefijo';
            if (tblLower === 'accounting_periods') return 'workspace_id, periodo, user_id';
            if (tblLower === 'formato_54_plan_contable') return 'workspace_id, user_id, periodo, codigo_cuenta';
            return 'id';
        };

        const conflictColumns = getConflictColumns(tableName);
        
        // Generar lista de actualizaciones excluyendo las PK
        const pkColumns = conflictColumns.split(',').map(c => c.trim());
        const updateColumns = columns
            .filter(col => !pkColumns.includes(col))
            .map(col => {
                // CASO ESPECIAL: period_versions.version debe incrementarse
                if (tableName === 'period_versions' && col === 'version') {
                    return `${col} = period_versions.${col} + 1`;
                }
                return `${col} = EXCLUDED.${col}`;
            })
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
            const getConflictColumns = (tbl) => {
                const tblLower = tbl.toLowerCase();
                if (tblLower === 'asientos') return 'id';
                if (tblLower === 'workspaces') return 'ruc, user_id';
                if (tblLower === 'period_versions') return 'workspace_id, periodo, module, user_id';
                if (tblLower === 'plan_global') return 'cta, user_id';
                if (tblLower === 'mapa_pcge_tabla9') return 'codigo_cuenta_prefijo';
                if (tblLower === 'accounting_periods') return 'workspace_id, periodo, user_id';
                if (tblLower === 'formato_54_plan_contable') return 'workspace_id, user_id, periodo, codigo_cuenta';
                return 'id';
            };
            const conflictColumns = getConflictColumns(tableName);
            
            translatedSql = translatedSql.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
            translatedSql += ` ON CONFLICT (${conflictColumns}) DO NOTHING`;
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
        
        return result.rows.map(ws => mapWorkspaceColumns(ws));
    },
    
    // Get workspace data (paginado)
    getWorkspaceData: async (ruc, userId, options = {}) => {
        const page = options.page || 1;
        const limit = options.limit || 1000;
        const offset = (page - 1) * limit;
        
        const wsInfo = await query(
            'SELECT * FROM workspaces WHERE ruc = $1 AND user_id = $2',
            [ruc, userId]
        );
        
        if (!wsInfo.rows[0]) return null;
        
        // Cargar datos de tablas principales con paginación
        const [purchases, sales, journal, honorarios] = await Promise.all([
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
            ),
            query(
                'SELECT * FROM honorarios WHERE workspace_id = $1 AND user_id = $2 ORDER BY fecha DESC LIMIT $3 OFFSET $4',
                [ruc, userId, limit, offset]
            )
        ]);
        
        // Cargar datos auxiliares (asientos, glosas, entidades, maintenance, movimientos_data, etc.)
        const [
            entities, costs, products, maintenance, movimientosData,
            asientos, glosasHabituales, inventoryMovements, cashMovements,
            fixedAssets, employees, balanceInicial, bankStatements
        ] = await Promise.all([
            query('SELECT * FROM entities WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM costs WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM products WHERE workspace_id = $1 AND user_id = $2 LIMIT 1000', [ruc, userId]),
            query('SELECT * FROM maintenance WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM movimientos_data WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM asientos WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM glosas_habituales WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM inventory_movements WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM cash_movements WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM fixed_assets WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM employees WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM balance_inicial WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]),
            query('SELECT * FROM bank_statements WHERE workspace_id = $1 AND user_id = $2', [ruc, userId])
        ]);
        
        // Plan contable del usuario
        let plan = await query('SELECT * FROM plan_global WHERE user_id = $1', [userId]);
        
        // Si el plan contable está vacío para este usuario en Postgres, realizar auto-semillado rápido (server-side seeding)
        if (!plan.rows || plan.rows.length === 0) {
            try {
                const planPath = path.join(__dirname, 'planContable.json');
                if (fs.existsSync(planPath)) {
                    const fullPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
                    console.log(`[DB] Auto-semillado de plan contable para usuario ${userId} (${fullPlan.length} cuentas)...`);
                    
                    // Insertar en lotes de 100 para no exceder el límite de parámetros de PostgreSQL
                    const batchSize = 100;
                    for (let i = 0; i < fullPlan.length; i += batchSize) {
                        const batch = fullPlan.slice(i, i + batchSize);
                        const valueRows = [];
                        const params = [userId];
                        let paramIdx = 2;
                        
                        for (const p of batch) {
                            valueRows.push(`($${paramIdx++}, $1, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
                            params.push(
                                p.cta,
                                p.description || '',
                                p.type || '',
                                p.reqCenCos ? 1 : 0,
                                p.amarreDebe || null,
                                p.amarreHaber || null,
                                p.div !== undefined ? p.div : 1,
                                p.cta_cc1 || p.amarreDebe || null,
                                p.pct_cc1 !== undefined ? p.pct_cc1 : (p.amarreDebe ? 100.0 : 0.0),
                                p.cta_cc2 || null,
                                p.pct_cc2 || 0.0,
                                p.cta_cc3 || null,
                                p.pct_cc3 || 0.0,
                                p.destino_haber || p.amarreHaber || null,
                                p.niif18_category || null
                            );
                        }
                        
                        const queryStr = `
                            INSERT INTO plan_global (
                                cta, user_id, description, type, reqCenCos, amarreDebe, amarreHaber,
                                div, cta_cc1, pct_cc1, cta_cc2, pct_cc2, cta_cc3, pct_cc3, destino_haber, niif18_category
                            ) VALUES ${valueRows.join(',')}
                            ON CONFLICT (cta, user_id) DO NOTHING
                        `;
                        await query(queryStr, params);
                    }
                    console.log(`[DB] Auto-semillado de plan contable completado para usuario ${userId}`);
                    plan = await query('SELECT * FROM plan_global WHERE user_id = $1', [userId]);
                }
            } catch (err) {
                console.error('[DB ERROR] Error en auto-semillado de plan contable:', err);
            }
        }
        
        // Mapear asientos parseando header_json y lines_json
        const mapAsientos = (asientos.rows || []).map(a => {
            let header = a.header || {};
            let lines = a.lines || [];
            try {
                if (a.header_json) header = typeof a.header_json === 'string' ? JSON.parse(a.header_json) : a.header_json;
            } catch (e) {}
            try {
                if (a.lines_json) lines = typeof a.lines_json === 'string' ? JSON.parse(a.lines_json) : a.lines_json;
            } catch (e) {}
            return { ...a, header, lines };
        });

        let glosasList = glosasHabituales.rows || [];
        if (glosasList.length === 0) {
            try {
                console.log(`[DB] Auto-semillado de glosas habituales para workspace ${ruc} (usuario: ${userId})...`);
                const SEED_GLOSAS = [
                    {
                        category: "COMERCIAL",
                        glosa: "3.1. COMERCIAL: ANTICIPOS RECIBIDOS DE CLIENTES (A11)",
                        lines: [
                            { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
                            { cuenta: "122", detalle: "ANTICIPOS DE CLIENTES" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el cobro del anticipo y emisión de factura" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "3.2. COMERCIAL: ANTICIPOS A PROVEEDORES LOCALES (A12-A13)",
                        lines: [
                            { cuenta: "422", detalle: "ANTICIPOS A PROVEEDORES" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "4212", detalle: "EMITIDAS (LIQ. ANTICIPO)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la recepción de la factura por anticipo" },
                            { cuenta: "4212", detalle: "EMITIDAS (PAGO)" },
                            { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el pago del anticipo al proveedor" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "4.1. COMERCIAL: DEVOLUCIÓN MERCADERÍA PROVEEDOR (A14-A15)",
                        lines: [
                            { cuenta: "4212", detalle: "EMITIDAS (NC REVERSIÓN)" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "6011", detalle: "MERCADERÍAS MANUFACTURADAS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de la Nota de Crédito" },
                            { cuenta: "6111", detalle: "MERCADERÍAS MANUFACTURADAS" },
                            { cuenta: "20111", detalle: "COSTO (EXTORNO ALMACÉN)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el extorno del ingreso al almacén" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "4.2. COMERCIAL: DESCUENTOS PRONTO PAGO CONCEDIDOS (A16)",
                        lines: [
                            { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
                            { cuenta: "675", detalle: "DESCUENTOS CONCEDIDOS PRONTO PAGO" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA (REVERSIÓN)" },
                            { cuenta: "1212", detalle: "EMITIDAS EN CARTERA" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el cobro con descuento financiero (Nota de Crédito)" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "5.1. COMERCIAL: VENTA Y CANJE DE GIFT CARDS (A17-A18)",
                        lines: [
                            { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
                            { cuenta: "122", detalle: "ANTICIPOS DE CLIENTES (GIFT CARDS)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la venta y cobro de la Gift Card (Pasivo)" },
                            { cuenta: "122", detalle: "ANTICIPOS DE CLIENTES (CANJE)" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "701", detalle: "MERCADERÍAS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el canje de la Gift Card y reconocimiento de ingreso" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "5.2. COMERCIAL: ENTREGA DE MUESTRAS GRATIS (A19-A20)",
                        lines: [
                            { cuenta: "659", detalle: "OTROS GASTOS DE GESTIÓN (MUESTRAS)" },
                            { cuenta: "6415", detalle: "IGV ASUMIDO (RETIRO BIENES)" },
                            { cuenta: "20111", detalle: "COSTO (MERCADERÍA)" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el gasto de promoción y retiro de bienes" },
                            { cuenta: "951", detalle: "GASTOS DE VENTAS" },
                            { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el destino del gasto por promoción" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "6.1. COMERCIAL: COBRANZA DUDOSA Y CASTIGO (A21-A22)",
                        lines: [
                            { cuenta: "6841", detalle: "ESTIMACIÓN CUENTAS COBRANZA DUDOSA" },
                            { cuenta: "1911", detalle: "FACTURAS POR COBRAR" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de la provisión cobranza dudosa" },
                            { cuenta: "1911", detalle: "FACTURAS POR COBRAR" },
                            { cuenta: "1212", detalle: "EMITIDAS EN CARTERA" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el castigo de la cuenta (Baja en libros)" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "6.2. COMERCIAL: DESMEDRO CON ACTA NOTARIAL (A23-A25)",
                        lines: [
                            { cuenta: "6851", detalle: "DESVALORIZACIÓN DE MERCADERÍAS" },
                            { cuenta: "2911", detalle: "MERCADERÍAS (DETERIORO)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento del deterioro (Desmedro)" },
                            { cuenta: "941", detalle: "GASTOS ADMINISTRATIVOS" },
                            { cuenta: "781", detalle: "CARGAS CUBIERTAS POR PROVISIONES" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el destino del gasto por deterioro" },
                            { cuenta: "2911", detalle: "MERCADERÍAS" },
                            { cuenta: "20111", detalle: "COSTO (BAJA DESTRUC.)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la baja en libros de la mercadería destruida" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "7. COMERCIAL: ALQUILER LOCAL - RETENCIÓN 5% (A26-A27)",
                        lines: [
                            { cuenta: "6351", detalle: "ALQUILER DE EDIFICACIONES" },
                            { cuenta: "40172", detalle: "RETENCIONES 2DA CATEGORÍA" },
                            { cuenta: "4699", detalle: "OTRAS CUENTAS POR PAGAR" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la provisión del alquiler y retención 5%" },
                            { cuenta: "951", detalle: "GASTOS DE VENTAS" },
                            { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el destino del gasto de alquiler" }
                        ]
                    },
                    {
                        category: "COMERCIAL",
                        glosa: "8. COMERCIAL: CIERRE CONTABLE INTEGRAL (A28-A30)",
                        lines: [
                            { cuenta: "6111", detalle: "VARIACIÓN DE INVENTARIOS" },
                            { cuenta: "69121", detalle: "COSTO DE VENTAS (CIERRE)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la cancelación del costo de ventas" },
                            { cuenta: "801", detalle: "MARGEN COMERCIAL" },
                            { cuenta: "6011", detalle: "COMPRAS (CANCELACIÓN)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la determinación del margen comercial" },
                            { cuenta: "70121", detalle: "VENTAS (CANCELACIÓN)" },
                            { cuenta: "801", detalle: "MARGEN COMERCIAL (SALDO)" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la cancelación de ventas al margen comercial" }
                        ]
                    },
                    {
                        category: "INDUSTRIAL",
                        glosa: "2.1. INDUSTRIAL: CONSUMO MATERIA PRIMA (A20-A21)",
                        lines: [
                            { cuenta: "6121", detalle: "VARIACIÓN DE INVENTARIOS" },
                            { cuenta: "2411", detalle: "MATERIAS PRIMAS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el consumo de materia prima por naturaleza" },
                            { cuenta: "90111", detalle: "MATERIA PRIMA - DPTO CORTE" },
                            { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el destino al centro de costos productivo" }
                        ]
                    },
                    {
                        category: "INDUSTRIAL",
                        glosa: "2.2. INDUSTRIAL: PLANILLA OPERARIOS MOD (A22-A23)",
                        lines: [
                            { cuenta: "6211", detalle: "SUELDOS Y SALARIOS" },
                            { cuenta: "6271", detalle: "ESSALUD" },
                            { cuenta: "4031", detalle: "ESSALUD" },
                            { cuenta: "417", detalle: "AFP (RETENCIÓN)" },
                            { cuenta: "4111", detalle: "SUELDOS POR PAGAR" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de la planilla por naturaleza" },
                            { cuenta: "90211", detalle: "MOD - DPTO CORTE" },
                            { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el destino de la mano de obra directa" }
                        ]
                    },
                    {
                        category: "INDUSTRIAL",
                        glosa: "2.3. INDUSTRIAL: CIF Y DEPRECIACIÓN (A24-A25)",
                        lines: [
                            { cuenta: "6361", detalle: "ENERGÍA ELÉCTRICA" },
                            { cuenta: "6814", detalle: "DEPRECIACIÓN PPE" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "4212", detalle: "EMITIDAS" },
                            { cuenta: "3952", detalle: "DEPRECIACIÓN MAQUINARIAS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de depreciación y energía" },
                            { cuenta: "90311", detalle: "CIF - ENERGÍA Y DEPREC." },
                            { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
                            { cuenta: "781", detalle: "CARGAS DEDUCIBLES" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el destino de los CIF" }
                        ]
                    },
                    {
                        category: "INDUSTRIAL",
                        glosa: "2.4. INDUSTRIAL: LIQUIDACIÓN DE PRODUCCIÓN (A26)",
                        lines: [
                            { cuenta: "211", detalle: "PRODUCTOS MANUFACTURADOS" },
                            { cuenta: "7111", detalle: "PRODUCTOS MANUFACTURADOS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la incorporación al inventario de productos terminados" }
                        ]
                    },
                    {
                        category: "SERVICIOS",
                        glosa: "6.1. SERVICIOS: HONORARIOS 4TA CATEGORÍA (A41)",
                        lines: [
                            { cuenta: "632", detalle: "ASESORÍA Y CONSULTORÍA" },
                            { cuenta: "4017", detalle: "RETENCIONES 4TA CATEGORÍA" },
                            { cuenta: "424", detalle: "HONORARIOS POR PAGAR" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la provisión del servicio y retención del 8%" }
                        ]
                    },
                    {
                        category: "SERVICIOS",
                        glosa: "6.2. SERVICIOS: FACTURACIÓN Y DETRACCIÓN 12% (A42-A43)",
                        lines: [
                            { cuenta: "1212", detalle: "EMITIDAS EN CARTERA" },
                            { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
                            { cuenta: "7041", detalle: "PRESTACIÓN DE SERVICIOS" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por la emisión de factura de servicios especializados" },
                            { cuenta: "1041", detalle: "CC OPERATIVAS (NETO)" },
                            { cuenta: "1042", detalle: "CC FINES ESPECÍFICOS (BN)" },
                            { cuenta: "1212", detalle: "COBRO FACTURA" },
                            { cuenta: "GLOSA", detalle: "{FECHA} Por el cobro de factura y depósito detracción 12%" }
                        ]
                    }
                ];
                
                for (const seed of SEED_GLOSAS) {
                    const id = `glh-seed-${seed.glosa.replace(/\s+/g, '-').toLowerCase()}`;
                    await query(
                        `INSERT INTO glosas_habituales (id, workspace_id, category, glosa, lines_json, user_id) 
                         VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (id) DO NOTHING`,
                        [id, ruc, seed.category, seed.glosa, JSON.stringify(seed.lines), userId]
                    );
                }
                
                const freshGlosas = await query('SELECT * FROM glosas_habituales WHERE workspace_id = $1 AND user_id = $2', [ruc, userId]);
                glosasList = freshGlosas.rows || [];
            } catch (err) {
                console.error('[DB ERROR] Error en auto-semillado de glosas habituales:', err);
            }
        }
        
        const mapGlosas = glosasList.map(g => {
            let lines = g.lines || [];
            try {
                if (g.lines_json) lines = typeof g.lines_json === 'string' ? JSON.parse(g.lines_json) : g.lines_json;
            } catch (e) {}
            return { ...g, lines };
        });
        
        return {
            currentCompany: mapWorkspaceColumns(wsInfo.rows[0]),
            purchases: purchases.rows || [],
            sales: sales.rows || [],
            journal: journal.rows || [],
            honorarios: honorarios.rows || [],
            entities: entities.rows || [],
            costs: costs.rows || [],
            products: products.rows || [],
            plan: plan.rows || [],
            maintenanceRecords: maintenance.rows || [],
            movimientosData: movimientosData.rows || [],
            asientos: mapAsientos,
            glosasHabituales: mapGlosas,
            inventoryMovements: inventoryMovements.rows || [],
            cashMovements: cashMovements.rows || [],
            fixedAssets: fixedAssets.rows || [],
            employees: employees.rows || [],
            balanceInicial: balanceInicial.rows || [],
            bankStatements: bankStatements.rows || [],
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
    createSuggestion: async (s) => {
        return query(`
            INSERT INTO suggestions (id, user_id, type, title, description, status)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [s.id, s.user_id, s.type || 'SUGGESTION', s.title || s.view_context || '', s.description || s.user_comment || '', s.status || 'pending']);
    },

    getSuggestions: async () => {
        const result = await query('SELECT * FROM suggestions ORDER BY created_at DESC', []);
        return result.rows;
    },

    resolveSuggestion: async (id) => {
        return query('UPDATE suggestions SET status = \'RESUELTO\', resolved_at = NOW() WHERE id = $1', [id]);
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
    },

    // --- User management ---
    getUserByEmail: async (email) => {
        const normalizedEmail = email ? email.trim().toLowerCase() : '';
        const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
        return result.rows[0] || null;
    },

    createUser: async (u) => {
        const normalizedEmail = u.email ? u.email.trim().toLowerCase() : '';
        const result = await query(
            'INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role',
            [u.id, normalizedEmail, u.password, u.name, u.role || 'user']
        );
        return result;
    },

    // --- CCC Metrics ---
    getCCCMetrics: async (ruc, userId) => {
        const querySaldo = async (ctaPrefix) => {
            const res = await query(`
                SELECT COALESCE(SUM(debe), 0) - COALESCE(SUM(haber), 0) as saldo 
                FROM journal 
                WHERE workspace_id = $1 AND user_id = $2 AND cta LIKE $3
            `, [ruc, userId, `${ctaPrefix}%`]);
            return parseFloat(res.rows[0]?.saldo || 0);
        };

        const inventario = await querySaldo('20');
        const cobrar = await querySaldo('12');
        const pagar = Math.abs(await querySaldo('42'));
        const ventas = Math.abs(await querySaldo('70'));
        const compras = await querySaldo('60');

        return {
            dio: ventas > 0 ? (inventario / (ventas / 360)) : 0,
            dso: ventas > 0 ? (cobrar / (ventas / 360)) : 0,
            dpo: compras > 0 ? (pagar / (compras / 360)) : 0
        };
    },

    // --- Balance Inicial ---
    saveBalanceInicial: async (ruc, userId, item) => {
        return query(`
            INSERT INTO balance_inicial (id, workspace_id, user_id, cta, descripcion, debe, haber)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                cta = EXCLUDED.cta,
                descripcion = EXCLUDED.descripcion,
                debe = EXCLUDED.debe,
                haber = EXCLUDED.haber
        `, [item.id, ruc, userId, item.cta, item.desc || item.descripcion || '', item.debe || 0, item.haber || 0]);
    },

    saveBalanceInicialBulk: async (ruc, userId, items) => {
        return db.transaction(async (client) => {
            for (const item of items) {
                await client.query(`
                    INSERT INTO balance_inicial (id, workspace_id, user_id, cta, descripcion, debe, haber)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (id) DO UPDATE SET
                        cta = EXCLUDED.cta,
                        descripcion = EXCLUDED.descripcion,
                        debe = EXCLUDED.debe,
                        haber = EXCLUDED.haber
                `, [item.id, ruc, userId, item.cta, item.desc || item.descripcion || '', item.debe || 0, item.haber || 0]);
            }
        });
    },

    deleteBalanceInicial: async (ruc, userId, id) => {
        return query('DELETE FROM balance_inicial WHERE id = $1 AND workspace_id = $2 AND user_id = $3', [id, ruc, userId]);
    },

    // --- Finance Notes & Deferred Tax ---
    getFinanceNotes: async (ruc, periodo, userId) => {
        const res = await query('SELECT * FROM finance_notes WHERE workspace_id = $1 AND periodo = $2 AND user_id = $3', [ruc, periodo, userId]);
        return res.rows[0] || null;
    },

    saveFinanceNotes: async (ruc, periodo, notesJson, userId) => {
        const jsonStr = typeof notesJson === 'string' ? notesJson : JSON.stringify(notesJson);
        return query(`
            INSERT INTO finance_notes (workspace_id, periodo, notes_json, user_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (workspace_id, periodo, user_id) DO UPDATE SET
                notes_json = EXCLUDED.notes_json
        `, [ruc, periodo, jsonStr, userId]);
    },

    getDeferredTax: async (ruc, periodo, userId) => {
        const res = await query('SELECT * FROM deferred_tax_computations WHERE workspace_id = $1 AND periodo = $2 AND user_id = $3', [ruc, periodo, userId]);
        return res.rows[0] || null;
    },

    saveDeferredTax: async (ruc, periodo, computationJson, userId) => {
        const jsonStr = typeof computationJson === 'string' ? computationJson : JSON.stringify(computationJson);
        return query(`
            INSERT INTO deferred_tax_computations (workspace_id, periodo, computation_json, user_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (workspace_id, periodo, user_id) DO UPDATE SET
                computation_json = EXCLUDED.computation_json
        `, [ruc, periodo, jsonStr, userId]);
    },

    saveCertificado: async (ruc, userId, pfxBuffer, password) => {
        return query(`
            UPDATE workspaces
            SET certificado_pfx = $1, certificado_pass = $2
            WHERE ruc = $3 AND user_id = $4
        `, [pfxBuffer, encrypt(password), ruc, userId]);
    },

    getCertificado: async (ruc, userId) => {
        const res = await query(`
            SELECT certificado_pfx, certificado_pass FROM workspaces
            WHERE ruc = $1 AND user_id = $2
        `, [ruc, userId]);
        const row = res.rows[0];
        if (!row || !row.certificado_pfx) return null;
        return {
            pfx: row.certificado_pfx,
            pass: decrypt(row.certificado_pass)
        };
    },

    // --- SIRE Persistencia ---
    saveSirePurchases: async (ruc, records, userId) => {
        if (!records || records.length === 0) return;
        return db.transaction(async (client) => {
            // Limpiar únicamente las propuestas del SIRE del PERÍODO ESPECÍFICO
            const targetPeriod = records[0]?.periodo_sire || '';
            if (targetPeriod) {
                await client.query(`DELETE FROM purchases WHERE workspace_id = $1 AND estado_sire = 'Propuesta' AND periodo_sire = $2`, [ruc, targetPeriod]);
            } else {
                await client.query(`DELETE FROM purchases WHERE workspace_id = $1 AND estado_sire = 'Propuesta' AND (periodo_sire IS NULL OR periodo_sire = '')`, [ruc]);
            }

            const chunkSize = 50;
            for (let i = 0; i < records.length; i += chunkSize) {
                const chunk = records.slice(i, i + chunkSize);
                const values = [];
                const valueClauses = [];
                let paramIndex = 1;

                for (const r of chunk) {
                    const rowParams = [
                        r.id, ruc, r.registro, r.fecha, r.fecVcto, r.tipo_doc, r.serie, r.numero, 
                        r.doc_tipo, r.doc_num, r.nombre, r.tc || 1, r.bi || 0, r.igv || 0, r.noGravada || 0, r.isc || 0, 
                        r.icbper || 0, r.otros_tributos || 0, r.total || 0, r.car || '', r.estado_sire || 'Propuesta',
                        '6011', '4212', 'COMPRA INTERNA GRAVADA', '02', 'SOLES', 'POR LA COMPRA DE MERCADERIA', 0, userId
                    ];
                    values.push(...rowParams);
                    const placeholders = rowParams.map(() => `$${paramIndex++}`).join(', ');
                    valueClauses.push(`(${placeholders})`);
                }

                const sql = `
                    INSERT INTO purchases (
                        id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero,
                        doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper,
                        otros_tributos, total, car, estado_sire, ctaGasto, ctaAbono,
                        tipOper, tipOperCode, moneda, glosa, detraccion, user_id
                    ) VALUES ${valueClauses.join(', ')}
                    ON CONFLICT (id) DO UPDATE SET
                        workspace_id = EXCLUDED.workspace_id, registro = EXCLUDED.registro, fecha = EXCLUDED.fecha,
                        fecVcto = EXCLUDED.fecVcto, tipo_doc = EXCLUDED.tipo_doc, serie = EXCLUDED.serie,
                        numero = EXCLUDED.numero, doc_tipo = EXCLUDED.doc_tipo, doc_num = EXCLUDED.doc_num,
                        nombre = EXCLUDED.nombre, tc = EXCLUDED.tc, bi = EXCLUDED.bi, igv = EXCLUDED.igv,
                        noGravada = EXCLUDED.noGravada, isc = EXCLUDED.isc, icbper = EXCLUDED.icbper,
                        otros_tributos = EXCLUDED.otros_tributos, total = EXCLUDED.total, car = EXCLUDED.car,
                        estado_sire = EXCLUDED.estado_sire, user_id = EXCLUDED.user_id
                `;
                await client.query(sql, values);
            }
        });
    },

    saveSireSales: async (ruc, records, userId) => {
        if (!records || records.length === 0) return;
        return db.transaction(async (client) => {
            // Limpiar únicamente las propuestas del SIRE del PERÍODO ESPECÍFICO
            const targetPeriod = records[0]?.periodo_sire || '';
            if (targetPeriod) {
                await client.query(`DELETE FROM sales WHERE workspace_id = $1 AND estado_sire = 'Propuesta' AND periodo_sire = $2`, [ruc, targetPeriod]);
            } else {
                await client.query(`DELETE FROM sales WHERE workspace_id = $1 AND estado_sire = 'Propuesta' AND (periodo_sire IS NULL OR periodo_sire = '')`, [ruc]);
            }

            const chunkSize = 50;
            for (let i = 0; i < records.length; i += chunkSize) {
                const chunk = records.slice(i, i + chunkSize);
                const values = [];
                const valueClauses = [];
                let paramIndex = 1;

                for (const r of chunk) {
                    const rowParams = [
                        r.id, ruc, r.registro, r.fecha, r.fecVcto, r.tipo_doc, r.serie, r.numero, 
                        r.doc_tipo, r.doc_num, r.nombre, r.tc || 1, r.bi || 0, r.igv || 0, r.noGravada || 0, r.isc || 0, 
                        r.icbper || 0, r.otros_tributos || 0, r.total || 0, r.car || '', r.estado_sire || 'Propuesta', userId
                    ];
                    values.push(...rowParams);
                    const placeholders = rowParams.map(() => `$${paramIndex++}`).join(', ');
                    valueClauses.push(`(${placeholders})`);
                }

                const sql = `
                    INSERT INTO sales (
                        id, workspace_id, registro, fecha, fecVcto, tipo_doc, serie, numero,
                        doc_tipo, doc_num, nombre, tc, bi, igv, noGravada, isc, icbper,
                        otros_tributos, total, car, estado_sire, user_id
                    ) VALUES ${valueClauses.join(', ')}
                    ON CONFLICT (id) DO UPDATE SET
                        workspace_id = EXCLUDED.workspace_id, registro = EXCLUDED.registro, fecha = EXCLUDED.fecha,
                        fecVcto = EXCLUDED.fecVcto, tipo_doc = EXCLUDED.tipo_doc, serie = EXCLUDED.serie,
                        numero = EXCLUDED.numero, doc_tipo = EXCLUDED.doc_tipo, doc_num = EXCLUDED.doc_num,
                        nombre = EXCLUDED.nombre, tc = EXCLUDED.tc, bi = EXCLUDED.bi, igv = EXCLUDED.igv,
                        noGravada = EXCLUDED.noGravada, isc = EXCLUDED.isc, icbper = EXCLUDED.icbper,
                        otros_tributos = EXCLUDED.otros_tributos, total = EXCLUDED.total, car = EXCLUDED.car,
                        estado_sire = EXCLUDED.estado_sire, user_id = EXCLUDED.user_id
                `;
                await client.query(sql, values);
            }
        });
    },

    // --- Persistencia Cloud de Archivos SIRE (ZIP/XLSX/TXT) ---
    saveSireFile: async (ruc, userId, fileData) => {
        try {
            const id = fileData.id || `${ruc}_${fileData.nombre}`;
            const fecha = fileData.fecha || new Date().toLocaleString('es-PE');
            const sql = `
                INSERT INTO sire_files (id, workspace_id, user_id, nombre, periodo, proceso, fecha, size_bytes, content_base64)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET
                    fecha = EXCLUDED.fecha,
                    size_bytes = EXCLUDED.size_bytes,
                    content_base64 = EXCLUDED.content_base64;
            `;
            await query(sql, [
                id,
                ruc,
                userId || 'SYSTEM',
                fileData.nombre,
                fileData.periodo || '',
                fileData.proceso || '',
                fecha,
                fileData.size || fileData.size_bytes || 0,
                fileData.content_base64
            ]);
            return { success: true, id };
        } catch (error) {
            console.error('[POSTGRES] Error guardando sire_file:', error.message);
            return { success: false, error: error.message };
        }
    },

    getSireFiles: async (ruc, userId) => {
        try {
            const sql = `
                SELECT id, workspace_id, nombre, periodo, proceso, fecha, size_bytes as size
                FROM sire_files
                WHERE workspace_id = $1 AND (user_id = $2 OR user_id = 'SYSTEM')
                ORDER BY created_at DESC
            `;
            const res = await query(sql, [ruc, userId]);
            return res.rows.map(r => ({
                id: r.id,
                nombre: r.nombre,
                fecha: r.fecha,
                size: Number(r.size || 0),
                periodo: r.periodo,
                proceso: r.proceso
            }));
        } catch (error) {
            console.error('[POSTGRES] Error consultando sire_files:', error.message);
            return [];
        }
    },

    getSireFileContent: async (nombreOrId, ruc, userId) => {
        try {
            const sql = `
                SELECT content_base64, nombre
                FROM sire_files
                WHERE (id = $1 OR nombre = $1) AND workspace_id = $2
                LIMIT 1
            `;
            const res = await query(sql, [nombreOrId, ruc]);
            return res.rows[0] || null;
        } catch (error) {
            console.error('[POSTGRES] Error obteniendo contenido sire_file:', error.message);
            return null;
        }
    },

    deleteSireFile: async (nombreOrId, ruc, userId) => {
        try {
            const sql = `
                DELETE FROM sire_files
                WHERE (id = $1 OR nombre = $1) AND workspace_id = $2
            `;
            await query(sql, [nombreOrId, ruc]);
            return { success: true };
        } catch (error) {
            console.error('[POSTGRES] Error eliminando sire_file:', error.message);
            return { success: false, error: error.message };
        }
    },

    // --- AI Knowledge Base Functions ---
    getAIKnowledge: async (filters = {}) => {
        try {
            let sql = `SELECT * FROM ai_knowledge_base WHERE activo = true`;
            const params = [];
            let paramIndex = 1;

            if (filters.tipo) {
                sql += ` AND tipo = $${paramIndex++}`;
                params.push(filters.tipo);
            }
            if (filters.sector) {
                sql += ` AND sector = $${paramIndex++}`;
                params.push(filters.sector);
            }
            if (filters.regimen) {
                sql += ` AND regimen = $${paramIndex++}`;
                params.push(filters.regimen);
            }
            if (filters.categoria) {
                sql += ` AND categoria = $${paramIndex++}`;
                params.push(filters.categoria);
            }
            if (filters.search) {
                sql += ` AND (premisa ILIKE $${paramIndex} OR tags ILIKE $${paramIndex} OR glosa ILIKE $${paramIndex} OR titulo ILIKE $${paramIndex} OR contenido ILIKE $${paramIndex})`;
                params.push(`%${filters.search}%`);
                paramIndex++;
            }

            sql += ` ORDER BY created_at DESC`;
            const res = await query(sql, params);
            return res.rows.map(r => {
                let asiento = [];
                try {
                    asiento = typeof r.asiento_json === 'string' ? JSON.parse(r.asiento_json) : (r.asiento_json || []);
                } catch (e) {
                    asiento = [];
                }
                let emb = null;
                if (r.embedding) {
                    try {
                        emb = typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding;
                    } catch (e) {
                        emb = null;
                    }
                }
                return {
                    ...r,
                    asiento_json: asiento,
                    embedding: emb
                };
            });
        } catch (error) {
            console.error('[POSTGRES] Error getting ai knowledge:', error.message);
            return [];
        }
    },

    saveAIKnowledge: async (item) => {
        try {
            const id = item.id || `ak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const asientoStr = typeof item.asiento_json === 'string' ? item.asiento_json : JSON.stringify(item.asiento_json || []);
            const embeddingStr = item.embedding ? (typeof item.embedding === 'string' ? item.embedding : JSON.stringify(item.embedding)) : null;
            
            const sql = `
                INSERT INTO ai_knowledge_base (
                    id, sector, regimen, niif_norma, categoria, premisa, glosa, asiento_json, explicacion, tags,
                    tipo, titulo, contenido, referencia, vigencia, aplicacion_peru, embedding,
                    vigente_desde, vigente_hasta, embedding_model, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    sector = EXCLUDED.sector,
                    regimen = EXCLUDED.regimen,
                    niif_norma = EXCLUDED.niif_norma,
                    categoria = EXCLUDED.categoria,
                    premisa = EXCLUDED.premisa,
                    glosa = EXCLUDED.glosa,
                    asiento_json = EXCLUDED.asiento_json,
                    explicacion = EXCLUDED.explicacion,
                    tags = EXCLUDED.tags,
                    tipo = EXCLUDED.tipo,
                    titulo = EXCLUDED.titulo,
                    contenido = EXCLUDED.contenido,
                    referencia = EXCLUDED.referencia,
                    vigencia = EXCLUDED.vigencia,
                    aplicacion_peru = EXCLUDED.aplicacion_peru,
                    embedding = EXCLUDED.embedding,
                    vigente_desde = EXCLUDED.vigente_desde,
                    vigente_hasta = EXCLUDED.vigente_hasta,
                    embedding_model = EXCLUDED.embedding_model,
                    updated_at = NOW();
            `;
            await query(sql, [
                id,
                item.sector || 'COMERCIAL',
                item.regimen || 'RG',
                item.niif_norma || '',
                item.categoria || 'GENERAL',
                item.premisa || '',
                item.glosa || '',
                asientoStr,
                item.explicacion || '',
                item.tags || '',
                item.tipo || 'CASO_PRACTICO',
                item.titulo || '',
                item.contenido || '',
                item.referencia || '',
                item.vigencia || '',
                item.aplicacion_peru || '',
                embeddingStr,
                item.vigente_desde || '2026-01-01',
                item.vigente_hasta || '2099-12-31',
                item.embedding_model || 'paraphrase-multilingual-MiniLM-L12-v2'
            ]);
            return { success: true, id };
        } catch (error) {
            console.error('[POSTGRES] Error saving ai knowledge:', error.message);
            return { success: false, error: error.message };
        }
    },

    deleteAIKnowledge: async (id) => {
        try {
            await query(`DELETE FROM ai_knowledge_base WHERE id = $1`, [id]);
            return { success: true };
        } catch (error) {
            console.error('[POSTGRES] Error deleting ai knowledge:', error.message);
            return { success: false, error: error.message };
        }
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
                        tipOper TEXT,
                        tipOperCode TEXT,
                        ctaGasto TEXT,
                        ctaAbono TEXT,
                        moneda TEXT DEFAULT 'SOLES',
                        tc NUMERIC DEFAULT 0,
                        bi NUMERIC DEFAULT 0,
                        igv NUMERIC DEFAULT 0,
                        noGravada NUMERIC DEFAULT 0,
                        isc NUMERIC DEFAULT 0,
                        total NUMERIC DEFAULT 0,
                        glosa TEXT,
                        detraccion NUMERIC DEFAULT 0,
                        car TEXT,
                        estado_sire TEXT DEFAULT 'Local',
                        icbper NUMERIC DEFAULT 0,
                        otros_tributos NUMERIC DEFAULT 0,
                        spot_tipo TEXT,
                        spot_monto NUMERIC DEFAULT 0,
                        spot_constancia TEXT,
                        spot_fecha TEXT,
                        retencion_monto NUMERIC DEFAULT 0,
                        retencion_comprobante TEXT,
                        retencion_fecha TEXT,
                        percepcion_monto NUMERIC DEFAULT 0,
                        percepcion_comprobante TEXT,
                        pago_monto NUMERIC DEFAULT 0,
                        pago_fecha TEXT,
                        pago_medio TEXT,
                        pago_cuenta TEXT,
                        pago_operacion TEXT,
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
                        tipOper TEXT,
                        tipOperCode TEXT,
                        ctaCargo TEXT,
                        ctaIngreso TEXT,
                        moneda TEXT DEFAULT 'SOLES',
                        tc NUMERIC DEFAULT 0,
                        bi NUMERIC DEFAULT 0,
                        igv NUMERIC DEFAULT 0,
                        noGravada NUMERIC DEFAULT 0,
                        isc NUMERIC DEFAULT 0,
                        total NUMERIC DEFAULT 0,
                        glosa TEXT,
                        detraccion NUMERIC DEFAULT 0,
                        car TEXT,
                        estado_sire TEXT DEFAULT 'Local',
                        icbper NUMERIC DEFAULT 0,
                        otros_tributos NUMERIC DEFAULT 0,
                        spot_tipo TEXT,
                        spot_monto NUMERIC DEFAULT 0,
                        spot_constancia TEXT,
                        spot_fecha TEXT,
                        retencion_monto NUMERIC DEFAULT 0,
                        retencion_comprobante TEXT,
                        retencion_fecha TEXT,
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
                name: 'buzon_messages',
                schema: `
                    CREATE TABLE IF NOT EXISTS buzon_messages (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        fecha TEXT,
                        asunto TEXT,
                        estado TEXT,
                        tiene_adjunto INTEGER DEFAULT 0,
                        contenido TEXT,
                        updated_at TIMESTAMP DEFAULT NOW(),
                        user_id TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_buzon_workspace ON buzon_messages(workspace_id);
                `
            },
            {
                name: 'sire_files',
                schema: `
                    CREATE TABLE IF NOT EXISTS sire_files (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        nombre TEXT NOT NULL,
                        periodo TEXT,
                        proceso TEXT,
                        fecha TEXT,
                        size_bytes BIGINT DEFAULT 0,
                        content_base64 TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_sire_files_ws ON sire_files(workspace_id, user_id);
                    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS periodo_sire TEXT;
                    ALTER TABLE sales ADD COLUMN IF NOT EXISTS periodo_sire TEXT;
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
                        tipo_operacion TEXT,
                        tipo_doc TEXT,
                        serie TEXT,
                        numero TEXT,
                        cantidad NUMERIC DEFAULT 0,
                        costo_unitario NUMERIC DEFAULT 0,
                        cantidad_in NUMERIC DEFAULT 0,
                        costo_unit_in NUMERIC DEFAULT 0,
                        total_in NUMERIC DEFAULT 0,
                        cantidad_out NUMERIC DEFAULT 0,
                        costo_unit_out NUMERIC DEFAULT 0,
                        total_out NUMERIC DEFAULT 0,
                        reference_id TEXT,
                        user_id TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_inventory_workspace ON inventory_movements(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_movements(user_id);
                    CREATE INDEX IF NOT EXISTS idx_inventory_ref ON inventory_movements(reference_id);
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
                        tipo_comprobante TEXT,
                        tipo_documento_identidad TEXT,
                        serie_comprobante TEXT,
                        numero_comprobante TEXT,
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
            },
            {
                name: 'finance_notes',
                schema: `
                    CREATE TABLE IF NOT EXISTS finance_notes (
                        id SERIAL PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        periodo TEXT NOT NULL,
                        notes_json TEXT,
                        user_id TEXT NOT NULL,
                        UNIQUE(workspace_id, periodo, user_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_finance_notes_workspace ON finance_notes(workspace_id, user_id);
                `
            },
            {
                name: 'deferred_tax_computations',
                schema: `
                    CREATE TABLE IF NOT EXISTS deferred_tax_computations (
                        id SERIAL PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        periodo TEXT NOT NULL,
                        computation_json TEXT,
                        user_id TEXT NOT NULL,
                        UNIQUE(workspace_id, periodo, user_id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_deferred_tax_workspace ON deferred_tax_computations(workspace_id, user_id);
                `
            },
            {
                name: 'sire_files',
                schema: `
                    CREATE TABLE IF NOT EXISTS sire_files (
                        id TEXT PRIMARY KEY,
                        workspace_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        nombre TEXT NOT NULL,
                        periodo TEXT,
                        proceso TEXT,
                        fecha TEXT,
                        size_bytes NUMERIC DEFAULT 0,
                        content_base64 TEXT,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_sire_files_workspace ON sire_files(workspace_id);
                    CREATE INDEX IF NOT EXISTS idx_sire_files_user ON sire_files(user_id);
                `
            },
            {
                name: 'ai_knowledge_base',
                schema: `
                    CREATE TABLE IF NOT EXISTS ai_knowledge_base (
                        id TEXT PRIMARY KEY,
                        sector TEXT NOT NULL DEFAULT 'COMERCIAL',
                        regimen TEXT NOT NULL DEFAULT 'RG',
                        niif_norma TEXT DEFAULT '',
                        categoria TEXT NOT NULL DEFAULT 'GENERAL',
                        premisa TEXT DEFAULT '',
                        glosa TEXT DEFAULT '',
                        asiento_json TEXT DEFAULT '[]',
                        explicacion TEXT DEFAULT '',
                        tags TEXT DEFAULT '',
                        tipo TEXT NOT NULL DEFAULT 'CASO_PRACTICO',
                        titulo TEXT NOT NULL DEFAULT '',
                        contenido TEXT NOT NULL DEFAULT '',
                        referencia TEXT DEFAULT '',
                        vigencia TEXT DEFAULT '',
                        aplicacion_peru TEXT DEFAULT '',
                        embedding TEXT,
                        vigente_desde DATE DEFAULT '2026-01-01',
                        vigente_hasta DATE DEFAULT '2099-12-31',
                        embedding_model TEXT DEFAULT 'paraphrase-multilingual-MiniLM-L12-v2',
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW(),
                        activo BOOLEAN DEFAULT true
                    );
                    CREATE INDEX IF NOT EXISTS idx_ai_knowledge_sector ON ai_knowledge_base(sector);
                    CREATE INDEX IF NOT EXISTS idx_ai_knowledge_regimen ON ai_knowledge_base(regimen);
                    CREATE INDEX IF NOT EXISTS idx_ai_knowledge_tipo ON ai_knowledge_base(tipo);
                `
            }
        ];
        
        const alterStatements = [
            `ALTER TABLE purchases ADD COLUMN IF NOT EXISTS periodo_sire TEXT;`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS periodo_sire TEXT;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_id TEXT;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tipo_operacion TEXT;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tipo_doc TEXT;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS serie TEXT;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS numero TEXT;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS cantidad_in NUMERIC DEFAULT 0;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS costo_unit_in NUMERIC DEFAULT 0;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS total_in NUMERIC DEFAULT 0;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS cantidad_out NUMERIC DEFAULT 0;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS costo_unit_out NUMERIC DEFAULT 0;`,
            `ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS total_out NUMERIC DEFAULT 0;`,
            `ALTER TABLE libro_diario_52 ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT;`,
            `ALTER TABLE libro_diario_52 ADD COLUMN IF NOT EXISTS tipo_documento_identidad TEXT;`,
            `ALTER TABLE libro_diario_52 ADD COLUMN IF NOT EXISTS serie_comprobante TEXT;`,
            `ALTER TABLE libro_diario_52 ADD COLUMN IF NOT EXISTS numero_comprobante TEXT;`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'CASO_PRACTICO';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT '';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS contenido TEXT NOT NULL DEFAULT '';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS referencia TEXT DEFAULT '';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS vigencia TEXT DEFAULT '';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS aplicacion_peru TEXT DEFAULT '';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS embedding TEXT;`,
            `ALTER TABLE ai_knowledge_base ALTER COLUMN premisa DROP NOT NULL;`,
            `ALTER TABLE ai_knowledge_base ALTER COLUMN glosa DROP NOT NULL;`,
            `ALTER TABLE ai_knowledge_base ALTER COLUMN asiento_json DROP NOT NULL;`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS vigente_desde DATE DEFAULT '2026-01-01';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS vigente_hasta DATE DEFAULT '2099-12-31';`,
            `ALTER TABLE ai_knowledge_base ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'paraphrase-multilingual-MiniLM-L12-v2';`
        ];

        // 1. Ejecutar alterStatements primero por si las tablas ya existen sin las columnas (evita fallos al crear índices)
        for (const stmt of alterStatements) {
            try {
                await pool.query(stmt);
            } catch (e) {
                // Ignorar si la tabla no existe aún
            }
        }

        // 2. Crear tablas
        for (const table of tables) {
            await pool.query(table.schema);
        }

        // 3. Ejecutar de nuevo para asegurar consistencia
        for (const stmt of alterStatements) {
            try {
                await pool.query(stmt);
            } catch (e) {
                // Ignorar
            }
        }
        
        console.log('[POSTGRES] ✅ Schema, columnas y constraints verificados');
    } catch (error) {
        console.error('[POSTGRES] Error verificando constraints:', error.message);
    }
}
