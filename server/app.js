const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const { sireDir, buzonDir } = require('./storageConfig');

// ====================================================================
// MIGRACIÓN A POSTGRESQL: Configuración dinámica de base de datos
// ====================================================================
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES 
    ? require('./databasePostgres')
    : require('./databaseServer');

console.log(`[DB CONFIG] Usando: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);
console.log(`[DB CONFIG] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
if (USE_POSTGRES) {
    console.log(`[DB CONFIG] DATABASE_URL configurado: ${process.env.DATABASE_URL ? '✅' : '❌'}`);
}

// Exponer rawDb para servicios legacy que lo necesitan
// En PostgreSQL, rawDb será el pool de conexiones
if (!db.rawDb) {
    db.rawDb = USE_POSTGRES ? db.pool : db;
}
// ====================================================================
const createLibroDiario52Service = require('./libroDiario52Service');
const ld52Service = createLibroDiario52Service(db.rawDb);
const createRetenciones41Service = require('./retenciones41Service');
const retenciones41Service = createRetenciones41Service(db.rawDb);
const createPle71Service = require('./ple71Service');
const ple71Service = createPle71Service(db.rawDb);
const createCosts101Service = require('./costs101Service');
const costs101Service = createCosts101Service(db.rawDb);
const createKardex121Service = require('./kardex121Service');
const kardex121Service = createKardex121Service(db.rawDb);
const sbsService = require('./sbsService');
const buzonHandler = require('../main/buzonHandler');
const sireHandler = require('../modulo/sireHandler');
const ublService = require('./ublService');
const autoSyncService = require('./autoSyncService');
const cacheService = require('./cacheService');

const app = express();
const authRoutes = require('./authRoutes');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'softcontable-super-secret-key-2026';

// --- Optimización #4: Compresión GZIP para reducir tamaño de respuestas ---
app.use(compression({
    threshold: 1024, // Solo comprimir respuestas > 1KB
    level: 6 // Nivel de compresión (1-9)
}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Middleware de Autenticación ---
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, error: 'Acceso denegado. No hay token.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Guardamos los datos del usuario en la petición
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'Token inválido' });
    }
};

// --- Rutas Públicas ---
app.use('/api/auth', authRoutes);

// --- Middleware de Inspección Admin ---
// Permite que un admin inspeccione los datos de otro usuario sin absorber su empresa.
// Si el header X-Inspect-User-Id está presente y el usuario es admin, las operaciones
// de base de datos se ejecutan con el user_id del usuario inspeccionado.
const inspectMiddleware = (req, res, next) => {
    const inspectUserId = req.headers['x-inspect-user-id'];
    if (inspectUserId && req.user) {
        const normalizedEmail = (req.user.email || '').trim().toLowerCase();
        const isAdmin = req.user.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com' || normalizedEmail.startsWith('admin');
        if (isAdmin) {
            req.targetUserId = inspectUserId;
        } else {
            req.targetUserId = req.user.id;
        }
    } else {
        req.targetUserId = req.user ? req.user.id : null;
    }
    next();
};

// --- Rutas Protegidas ---
app.use('/api/db', authMiddleware, inspectMiddleware);
app.use('/api/buzon', authMiddleware, inspectMiddleware);
app.use('/api/sire', authMiddleware, inspectMiddleware);

// --- API Endpoints: Database ---

app.get('/api/db/workspaces', async (req, res) => {
    try {
        const cacheKey = `workspaces_${req.targetUserId}`;
        
        // Verificar cache
        let workspaces = cacheService.get(cacheKey);
        
        if (!workspaces) {
            // Si no está en cache, consultar DB
            workspaces = await db.getWorkspaces(req.targetUserId);
            cacheService.set(cacheKey, workspaces, 5 * 60 * 1000); // 5 minutos
        }
        
        res.json({ success: true, workspaces });
    } catch (error) {
        console.error('[DB ERROR] Error en getWorkspaces:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/workspaces', async (req, res) => {
    try {
        await db.saveWorkspace(req.body, req.targetUserId);
        
        // Invalidar cache de workspaces
        cacheService.invalidate(`workspaces_${req.targetUserId}`);
        cacheService.invalidate(`workspace_data_${req.body.ruc}_${req.targetUserId}`);
        
        // --- AUTO-SYNC DESACTIVADO ---
        // El auto-sync ahora se maneja desde el frontend mediante auto-click de botones
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get(['/api/db/workspace/:ruc', '/api/db/workspaces/:ruc'], async (req, res) => {
    try {
        const cacheKey = `workspace_data_${req.params.ruc}_${req.targetUserId}`;
        
        // Verificar cache
        let data = cacheService.get(cacheKey);
        
        if (!data) {
            // Si no está en cache, consultar DB
            data = await db.getWorkspaceData(req.params.ruc, req.targetUserId);
            cacheService.set(cacheKey, data, 2 * 60 * 1000); // 2 minutos
        }
        
        // Enviar respuesta inmediatamente
        res.json({ success: true, data });
        
        // --- AUTO-SYNC DESACTIVADO ---
        // El auto-sync ahora se maneja desde el frontend mediante auto-click de botones
        // Esto evita problemas de sincronización y es más confiable
        
    } catch (error) {
        console.error('[DB ERROR] Error en getWorkspaceData:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete(['/api/db/workspace/:ruc', '/api/db/workspaces/:ruc'], async (req, res) => {
    try {
        await db.deleteWorkspace(req.params.ruc, req.targetUserId);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en delete:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/execute', async (req, res) => {
    try {
        let { sql } = req.body;
        let params = req.body.params || [];
        
        // ✅ CONVERTIR $N a ? para SQLite
        if (!USE_POSTGRES) {
            // Reemplazar $1, $2, $3... con ?
            sql = sql.replace(/\$\d+/g, '?');
        }
        
        // ─── REESCRITURA AUTOMÁTICA DE SQL PARA SAAS (INYECCIÓN DE USER_ID) ───
        // Detectar INSERT, INSERT OR REPLACE, INSERT OR IGNORE, etc.
        const insertMatch = sql.match(/INSERT\s+(?:OR\s+(?:REPLACE|IGNORE|ROLLBACK|ABORT|FAIL)\s+)?INTO\s+(\w+)/i);
        const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
        const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
        
        if (req.targetUserId) {
            if (insertMatch) {
                const tableName = insertMatch[1];
                try {
                    // PostgreSQL: usar information_schema en lugar de PRAGMA
                    const query = USE_POSTGRES 
                        ? `SELECT column_name as name FROM information_schema.columns WHERE table_name = $1`
                        : `PRAGMA table_info(${tableName})`;
                    const checkParams = USE_POSTGRES ? [tableName.toLowerCase()] : [];
                    
                    const cols = await db.queryAll(query, checkParams);
                    const hasUserId = Array.isArray(cols) && cols.some(c => c.name === 'user_id' || c.column_name === 'user_id');
                    
                    if (hasUserId && !sql.toLowerCase().includes('user_id')) {
                        // Buscar la posición de VALUES
                        const valuesIndex = sql.toUpperCase().indexOf('VALUES');
                        if (valuesIndex === -1) {
                            console.error('[REWRITE ERROR] No se encontró VALUES en INSERT');
                        } else {
                            // Extraer la parte de columnas: desde ( hasta VALUES
                            const beforeValues = sql.substring(0, valuesIndex);
                            const afterValues = sql.substring(valuesIndex);
                            
                            // Buscar el último ) antes de VALUES (cierre de columnas)
                            const colParenCloseIndex = beforeValues.lastIndexOf(')');
                            
                            if (colParenCloseIndex === -1) {
                                console.error('[REWRITE ERROR] No se encontró cierre de columnas');
                            } else {
                                // Buscar el primer ) después de VALUES (cierre de valores)
                                const valuesParenOpenIndex = afterValues.indexOf('(');
                                const valuesParenCloseIndex = afterValues.indexOf(')', valuesParenOpenIndex);
                                
                                if (valuesParenCloseIndex === -1) {
                                    console.error('[REWRITE ERROR] No se encontró cierre de valores');
                                } else {
                                    // Reconstruir query
                                    const beforeCols = beforeValues.substring(0, colParenCloseIndex);
                                    const afterValuesComplete = afterValues.substring(valuesParenCloseIndex + 1);
                                    const valuesContent = afterValues.substring(valuesParenOpenIndex + 1, valuesParenCloseIndex);
                                    
                                    const placeholder = USE_POSTGRES ? `$${params.length + 1}` : '?';
                                    
                                    sql = `${beforeCols}, user_id) ${afterValues.substring(0, valuesParenOpenIndex + 1)}${valuesContent}, ${placeholder})${afterValuesComplete}`;
                                    params.push(req.targetUserId);
                                    console.log(`[SAAS DB REWRITE] Inyectado user_id en la tabla ${tableName} para INSERT`);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[REWRITE ERROR] Error inyectando user_id en INSERT:', err.message);
                }
            } else if (updateMatch || deleteMatch) {
                const tableName = updateMatch ? updateMatch[1] : deleteMatch[1];
                try {
                    // PostgreSQL: usar information_schema en lugar de PRAGMA
                    const query = USE_POSTGRES 
                        ? `SELECT column_name as name FROM information_schema.columns WHERE table_name = $1`
                        : `PRAGMA table_info(${tableName})`;
                    const queryParams = USE_POSTGRES ? [tableName.toLowerCase()] : [];
                    
                    const cols = await db.queryAll(query, queryParams);
                    const hasUserId = Array.isArray(cols) && cols.some(c => c.name === 'user_id' || c.column_name === 'user_id');
                    
                    if (hasUserId && !sql.toLowerCase().includes('user_id')) {
                        const hasWhere = sql.toUpperCase().includes('WHERE');
                        // ✅ FIX: Para SQLite simplemente agregar ?, para PostgreSQL calcular posición correcta
                        const placeholder = USE_POSTGRES ? `$${params.length + 1}` : '?';
                        if (hasWhere) {
                            sql = `${sql} AND user_id = ${placeholder}`;
                        } else {
                            sql = `${sql} WHERE user_id = ${placeholder}`;
                        }
                        params.push(req.targetUserId);
                        console.log(`[SAAS DB REWRITE] Inyectado user_id en la tabla ${tableName} para UPDATE/DELETE`);
                    }
                } catch (err) {
                    console.error('[REWRITE ERROR] Error inyectando user_id en UPDATE/DELETE:', err.message);
                }
            }
        }

        const result = await db.run(sql, params);
        
        // ✅ NUEVO: Invalidar cache después de modificaciones
        if (req.targetUserId && (insertMatch || updateMatch || deleteMatch)) {
            // Extraer workspace_id/ruc de los parámetros si existe
            const workspaceId = params[0]; // Primer parámetro suele ser workspace_id/ruc
            
            if (workspaceId && typeof workspaceId === 'string' && workspaceId.length >= 11) {
                console.log('[CACHE] Invalidando cache después de operación DB:', {
                    operación: insertMatch ? 'INSERT' : updateMatch ? 'UPDATE' : 'DELETE',
                    tabla: insertMatch?.[1] || updateMatch?.[1] || deleteMatch?.[1],
                    workspace: workspaceId
                });
                
                cacheService.invalidate(`workspace_data_${workspaceId}_${req.targetUserId}`);
                cacheService.invalidate(`workspaces_${req.targetUserId}`);
            }
        }
        
        res.json({ success: true, result });
    } catch (error) {
        console.error('[DB ERROR] Error en execute:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/backup', async (req, res) => {
    try {
        const normalizedEmail = (req.user?.email || '').trim().toLowerCase();
        const isAdmin = req.user?.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com' || normalizedEmail.startsWith('admin');
        if (!isAdmin) {
            return res.status(403).json({ success: false, error: 'Acceso denegado. Se requieren privilegios de Administrador para descargar la base de datos completa.' });
        }
        const backupPath = await db.backup();
        res.download(backupPath);
    } catch (error) {
        console.error('[DB ERROR] Error en backup:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/db/analytics/ccc/:ruc', async (req, res) => {
    try {
        const metrics = await db.getCCCMetrics(req.params.ruc, req.targetUserId);
        res.json({ success: true, metrics });
    } catch (error) {
        console.error('[DB ERROR] Error en analytics CCC:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/balance-inicial/:ruc', async (req, res) => {
    try {
        console.log(`[DB] POST /balance-inicial/${req.params.ruc} - Body:`, JSON.stringify(req.body));
        await db.saveBalanceInicial(req.params.ruc, req.targetUserId, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en saveBalanceInicial:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/balance-inicial/bulk/:ruc', async (req, res) => {
    try {
        console.log(`[DB] POST /balance-inicial/bulk/${req.params.ruc} - Items: ${req.body.items?.length}`);
        await db.saveBalanceInicialBulk(req.params.ruc, req.targetUserId, req.body.items);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en saveBalanceInicialBulk:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/db/balance-inicial/:ruc/:id', async (req, res) => {
    try {
        console.log(`[DB] DELETE /balance-inicial/${req.params.ruc}/${req.params.id}`);
        await db.deleteBalanceInicial(req.params.ruc, req.targetUserId, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en deleteBalanceInicial:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- ENDPOINT DE PRUEBA MANUAL PARA AUTO-SYNC ---
app.post('/api/debug/force-auto-sync/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        if (!ruc) {
            return res.status(400).json({ success: false, error: 'Falta RUC.' });
        }
        
        // Obtener datos de la empresa
        const data = await db.getWorkspaceData(ruc, req.targetUserId);
        if (!data?.currentCompany) {
            return res.status(404).json({ success: false, error: 'Empresa no encontrada.' });
        }
        
        console.log(`[FORCE AUTO SYNC] Ejecutando sincronización forzada para ${ruc}`);
        
        // Forzar auto-sync sin throttling
        const syncResults = await autoSyncService.checkAndSync(data.currentCompany, req.targetUserId);
        
        console.log(`[FORCE AUTO SYNC] Resultados para ${ruc}:`, syncResults);
        
        res.json({ 
            success: true, 
            results: syncResults,
            company: data.currentCompany.name,
            hasSOL: autoSyncService.hasValidSOLCredentials(data.currentCompany),
            hasSIRE: autoSyncService.hasValidSIRECredentials(data.currentCompany)
        });
    } catch (error) {
        console.error('[FORCE AUTO SYNC ERROR]:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mejora #7: Endpoint de Estado de Auto-Sincronización (Debug) ---
app.get('/api/debug/auto-sync-status/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        if (!ruc) {
            return res.status(400).json({ success: false, error: 'Falta RUC.' });
        }
        
        const status = autoSyncService.getSyncStatus(ruc);
        res.json({ success: true, status });
    } catch (error) {
        console.error('[DEBUG ERROR] Error obteniendo estado de auto-sync:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- ENDPOINT PARA VERIFICAR CREDENCIALES ---
app.get('/api/debug/check-credentials/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        if (!ruc) {
            return res.status(400).json({ success: false, error: 'Falta RUC.' });
        }
        
        // Obtener datos de la empresa
        const data = await db.getWorkspaceData(ruc, req.targetUserId);
        if (!data?.currentCompany) {
            return res.status(404).json({ success: false, error: 'Empresa no encontrada.' });
        }
        
        const company = data.currentCompany;
        const hasSOL = autoSyncService.hasValidSOLCredentials(company);
        const hasSIRE = autoSyncService.hasValidSIRECredentials(company);
        
        res.json({ 
            success: true, 
            ruc: company.ruc,
            name: company.name,
            credentials: {
                sol: {
                    valid: hasSOL,
                    user: company.sol_user ? '***presente***' : 'no configurado',
                    pass: company.sol_pass ? '***presente***' : 'no configurado'
                },
                sire: {
                    valid: hasSIRE,
                    clientId: company.sunatClientId ? '***presente***' : 'no configurado',
                    clientSecret: company.sunatClientSecret ? '***presente***' : 'no configurado'
                }
            }
        });
    } catch (error) {
        console.error('[DEBUG ERROR] Error verificando credenciales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- ENDPOINT PARA RESETEAR THROTTLING ---
app.post('/api/debug/reset-throttling/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        if (!ruc) {
            return res.status(400).json({ success: false, error: 'Falta RUC.' });
        }
        
        autoSyncService.resetThrottling(ruc);
        const status = autoSyncService.getSyncStatus(ruc);
        
        res.json({ 
            success: true, 
            message: 'Throttling reseteado exitosamente',
            status 
        });
    } catch (error) {
        console.error('[DEBUG ERROR] Error reseteando throttling:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mejora #7: Auditoría de Correlatividad Documental ---
// Art. 10 Reglamento de Comprobantes de Pago (R.S. 007-99/SUNAT)

app.get('/api/audit/correlatividad/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const serie = req.query.serie || '';
        const tipo_doc = req.query.tipo_doc || '';
        const table = req.query.table || 'purchases'; // 'purchases' | 'sales'
        const userId = req.targetUserId;

        if (!['purchases', 'sales'].includes(table)) {
            return res.status(400).json({ success: false, error: 'Tabla inválida. Use purchases o sales.' });
        }

        // Obtener todos los números de la serie, excluyendo anulados
        const rows = db.queryAll(
            `SELECT CAST(numero AS INTEGER) as num, numero as numero_raw, serie, tipo_doc
             FROM ${table}
             WHERE workspace_id = ? AND user_id = ?
               AND (serie = ? OR ? = '')
               AND (tipo_doc = ? OR ? = '')
               AND (estado_sire IS NULL OR estado_sire != 'ANULADO')
             ORDER BY CAST(numero AS INTEGER) ASC`,
            [ruc, userId, serie, serie, tipo_doc, tipo_doc]
        );

        if (rows.length === 0) {
            return res.json({
                success: true,
                data: { serie, tipo_doc, primer_numero: 0, ultimo_numero: 0, vacios: [], duplicados: [], total_vacios: 0, total_registros: 0 }
            });
        }

        const numeros = rows.map(r => r.num).filter(n => !isNaN(n));
        const primerNumero = Math.min(...numeros);
        const ultimoNumero = Math.max(...numeros);

        // Detectar vacíos (gap analysis)
        const numerosSet = new Set(numeros);
        const vacios = [];
        let gapStart = null;

        for (let i = primerNumero; i <= ultimoNumero; i++) {
            if (!numerosSet.has(i)) {
                if (gapStart === null) gapStart = i;
            } else if (gapStart !== null) {
                vacios.push({ desde: gapStart, hasta: i - 1 });
                gapStart = null;
            }
        }
        if (gapStart !== null) {
            vacios.push({ desde: gapStart, hasta: ultimoNumero });
        }

        // Detectar duplicados
        const conteo = {};
        numeros.forEach(n => { conteo[n] = (conteo[n] || 0) + 1; });
        const duplicados = Object.entries(conteo)
            .filter(([, count]) => count > 1)
            .map(([num, count]) => ({ numero: parseInt(num), repeticiones: count }));

        const totalVacios = vacios.reduce((sum, v) => sum + (v.hasta - v.desde + 1), 0);

        res.json({
            success: true,
            data: {
                serie: serie || '(todas)',
                tipo_doc: tipo_doc || '(todos)',
                primer_numero: primerNumero,
                ultimo_numero: ultimoNumero,
                vacios,
                duplicados,
                total_vacios: totalVacios,
                total_registros: numeros.length
            }
        });
    } catch (error) {
        console.error('[AUDIT ERROR] Error en correlatividad:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Endpoint genérico de consulta SQL (lectura) para modo SaaS ---
app.post('/api/db/query', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        let { sql } = req.body;
        let params = req.body.params || [];
        
        // ✅ CONVERTIR $N a ? para SQLite
        if (!USE_POSTGRES) {
            // Reemplazar $1, $2, $3... con ?
            sql = sql.replace(/\$\d+/g, '?');
        }
        
        // Solo permitir SELECT para seguridad
        if (!sql.trim().toUpperCase().startsWith('SELECT')) {
            return res.status(403).json({ success: false, error: 'Solo se permiten consultas SELECT en este endpoint.' });
        }
        
        // ─── INYECCIÓN DE USER_ID PARA SELECT QUERIES ───
        if (req.targetUserId) {
            // Detectar la tabla principal del SELECT
            const fromMatch = sql.match(/FROM\s+(\w+)/i);
            
            if (fromMatch) {
                const tableName = fromMatch[1];
                try {
                    // Verificar si la tabla tiene columna user_id
                    const query = USE_POSTGRES 
                        ? `SELECT column_name as name FROM information_schema.columns WHERE table_name = $1`
                        : `PRAGMA table_info(${tableName})`;
                    const checkParams = USE_POSTGRES ? [tableName.toLowerCase()] : [];
                    
                    const cols = await db.queryAll(query, checkParams);
                    const hasUserId = Array.isArray(cols) && cols.some(c => c.name === 'user_id' || c.column_name === 'user_id');
                    
                    if (hasUserId && !sql.toLowerCase().includes('user_id')) {
                        const hasWhere = sql.toUpperCase().includes('WHERE');
                        const placeholder = USE_POSTGRES ? `$${params.length + 1}` : '?';
                        
                        if (hasWhere) {
                            sql = `${sql} AND ${tableName}.user_id = ${placeholder}`;
                        } else {
                            sql = `${sql} WHERE ${tableName}.user_id = ${placeholder}`;
                        }
                        params.push(req.targetUserId);
                        console.log(`[SAAS DB REWRITE] Inyectado user_id en la tabla ${tableName} para SELECT`);
                    }
                } catch (err) {
                    console.error('[REWRITE ERROR] Error inyectando user_id en SELECT:', err.message);
                }
            }
        }
        
        const rows = await db.queryAll(sql, params);
        res.json({ success: true, rows });
    } catch (error) {
        console.error('[DB ERROR] Error en query:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mejora #3: Endpoint de Tipo de Cambio SBS ---
app.get('/api/sbs/tipo-cambio', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) {
            return res.status(400).json({ success: false, error: 'Se requiere el parámetro fecha (YYYY-MM-DD).' });
        }
        
        const rate = await sbsService.getExchangeRate(fecha);
        res.json({ success: true, rate });
    } catch (error) {
        console.error('[SBS SERVICE ERROR] Error al obtener tipo de cambio:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mejora #3: Endpoint de Prorrata IGV ---
app.post('/api/igv/prorrata', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, periodo } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !periodo) {
            return res.status(400).json({ success: false, error: 'Falta ruc o periodo.' });
        }

        const sales = db.queryAll(
            `SELECT * FROM sales WHERE workspace_id = ? AND user_id = ? AND fecha LIKE ?`,
            [ruc, userId, `${periodo}%`]
        );
        const journal = db.queryAll(
            `SELECT * FROM journal WHERE workspace_id = ? AND user_id = ? AND fecha LIKE ?`,
            [ruc, userId, `${periodo}%`]
        );

        const ventasGravadas = sales
            .filter(s => ['01', '02', '08'].includes(s.tipOperCode || '01'))
            .reduce((sum, s) => sum + (s.bi || 0), 0);

        const ventasNoGravadas = sales
            .filter(s => ['03', '04', '05'].includes(s.tipOperCode || ''))
            .reduce((sum, s) => sum + (s.bi || 0), 0);

        const totalVentas = ventasGravadas + ventasNoGravadas;
        const factor = totalVentas > 0 ? Number((ventasGravadas / totalVentas).toFixed(4)) : 1.0;

        const commonIgvEntries = journal.filter(
            j => j.cta === '40112' && j.source === 'COMPRA'
        );
        const igvComun = commonIgvEntries.reduce((sum, j) => sum + (j.debe || 0), 0);

        const creditoFiscal = Number((igvComun * factor).toFixed(2));
        const gastoCosto = Number((igvComun - creditoFiscal).toFixed(2));

        const asientoCorrelativo = `AJUS-PRORRATA-${periodo.replace('-', '')}`;
        const lastDay = new Date(Number(periodo.split('-')[0]), Number(periodo.split('-')[1]), 0).getDate();
        const fechaAjuste = `${periodo}-${String(lastDay).padStart(2, '0')}`;

        db.run(
            `DELETE FROM journal WHERE workspace_id = ? AND user_id = ? AND asiento = ?`,
            [ruc, userId, asientoCorrelativo]
        );

        if (igvComun > 0) {
            db.run(
                `INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, user_id) 
                 VALUES (?, ?, 'ASIENTO', ?, ?, ?, '40112', 'IGV - PRORRATA (EXTORNO)', 0, ?, ?)`,
                [`prorrata-${periodo}-clear-40112`, ruc, asientoCorrelativo, fechaAjuste, `AJUSTE PRORRATA IGV MES ${periodo}`, igvComun, userId]
            );

            if (creditoFiscal > 0) {
                db.run(
                    `INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, user_id) 
                     VALUES (?, ?, 'ASIENTO', ?, ?, ?, '40111', 'IGV - CREDITO FISCAL PLENO', ?, 0, ?)`,
                    [`prorrata-${periodo}-debit-40111`, ruc, asientoCorrelativo, fechaAjuste, `AJUSTE PRORRATA IGV MES ${periodo}`, creditoFiscal, userId]
                );
            }

            if (gastoCosto > 0) {
                const currentDebitSum = creditoFiscal;
                const difference = Number((igvComun - currentDebitSum).toFixed(2));
                db.run(
                    `INSERT INTO journal (id, workspace_id, source, asiento, fecha, glosa, cta, desc, debe, haber, user_id) 
                     VALUES (?, ?, 'ASIENTO', ?, ?, ?, '64901', 'IGV NO ACEPTADO - GASTO', ?, 0, ?)`,
                    [`prorrata-${periodo}-debit-64901`, ruc, asientoCorrelativo, fechaAjuste, `AJUSTE PRORRATA IGV MES ${periodo}`, difference, userId]
                );
            }
        }

        res.json({
            success: true,
            data: {
                periodo,
                ventasGravadas,
                ventasNoGravadas,
                factor,
                igvComun,
                creditoFiscal,
                gastoCosto
            }
        });
    } catch (error) {
        console.error('[PRORRATA ERROR] Error en prorrata calculation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mejora #3: Endpoint de DAOT ---
app.get('/api/daot/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { anio } = req.query;
        const userId = req.targetUserId;
        if (!ruc || !anio) {
            return res.status(400).json({ success: false, error: 'Falta ruc o anio.' });
        }

        const purchases = db.queryAll(
            `SELECT doc_num, doc_tipo, nombre, SUM(total) as total_amount 
             FROM purchases 
             WHERE workspace_id = ? AND user_id = ? AND fecha LIKE ? 
             GROUP BY doc_num`,
            [ruc, userId, `${anio}%`]
        );

        const sales = db.queryAll(
            `SELECT doc_num, doc_tipo, nombre, SUM(total) as total_amount 
             FROM sales 
             WHERE workspace_id = ? AND user_id = ? AND fecha LIKE ? 
             GROUP BY doc_num`,
            [ruc, userId, `${anio}%`]
        );

        res.json({ success: true, purchases, sales });
    } catch (error) {
        console.error('[DAOT ERROR] Error en endpoint DAOT:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Sprint 4: Endpoints de Conciliación Bancaria ---
app.get('/api/bank/statements/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query; // YYYY-MM
        const userId = req.targetUserId;
        if (!ruc) {
            return res.status(400).json({ success: false, error: 'Falta RUC.' });
        }
        let sql = `SELECT * FROM bank_statements WHERE workspace_id = ? AND user_id = ?`;
        let params = [ruc, userId];
        if (periodo) {
            sql += ` AND fecha LIKE ?`;
            params.push(`${periodo}%`);
        }
        const statements = db.queryAll(sql, params);
        res.json({ success: true, statements });
    } catch (error) {
        console.error('[BANK ERROR] Error en GET statements:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bank/statements/import', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, lines } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !Array.isArray(lines)) {
            return res.status(400).json({ success: false, error: 'Falta RUC o líneas inválidas.' });
        }

        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO bank_statements (id, workspace_id, fecha, referencia, glosa, monto, reconciled_journal_id, user_id)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
        `);

        const transaction = db.transaction((rows) => {
            for (const row of rows) {
                const id = row.id || `bank-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                insertStmt.run(id, ruc, row.fecha, row.referencia || '', row.glosa || '', row.monto, userId);
            }
        });

        transaction(lines);

        res.json({ success: true, count: lines.length });
    } catch (error) {
        console.error('[BANK ERROR] Error al importar statements:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bank/reconcile', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, statementId, journalId } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !statementId || !journalId) {
            return res.status(400).json({ success: false, error: 'Falta RUC, statementId o journalId.' });
        }

        db.run(
            `UPDATE bank_statements SET reconciled_journal_id = ? WHERE id = ? AND workspace_id = ? AND user_id = ?`,
            [journalId, statementId, ruc, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[BANK ERROR] Error al conciliar:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bank/unreconcile', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, statementId } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !statementId) {
            return res.status(400).json({ success: false, error: 'Falta RUC o statementId.' });
        }

        db.run(
            `UPDATE bank_statements SET reconciled_journal_id = NULL WHERE id = ? AND workspace_id = ? AND user_id = ?`,
            [statementId, ruc, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[BANK ERROR] Error al desconciliar:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bank/auto-match', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, periodo } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !periodo) {
            return res.status(400).json({ success: false, error: 'Falta RUC o periodo.' });
        }

        const statements = db.queryAll(
            `SELECT * FROM bank_statements 
             WHERE workspace_id = ? AND user_id = ? AND fecha LIKE ? AND reconciled_journal_id IS NULL`,
            [ruc, userId, `${periodo}%`]
        );

        const journal = db.queryAll(
            `SELECT j.* FROM journal j
             LEFT JOIN bank_statements bs ON j.id = bs.reconciled_journal_id AND bs.user_id = j.user_id
             WHERE j.workspace_id = ? AND j.user_id = ? AND j.fecha LIKE ? 
               AND (j.cta LIKE '10%' OR j.cta LIKE '104%')
               AND bs.id IS NULL`,
            [ruc, userId, `${periodo}%`]
        );

        let matchCount = 0;
        const updates = [];

        for (const stmt of statements) {
            const targetAmount = Math.abs(stmt.monto);
            
            const matchedJ = journal.find(j => {
                const amtMatch = stmt.monto > 0 ? (Math.abs(j.debe - targetAmount) < 0.01) : (Math.abs(j.haber - targetAmount) < 0.01);
                if (!amtMatch) return false;

                const stmtDate = new Date(stmt.fecha);
                const jDate = new Date(j.fecha);
                const diffTime = Math.abs(stmtDate.getTime() - jDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return diffDays <= 3;
            });

            if (matchedJ) {
                updates.push({ stmtId: stmt.id, journalId: matchedJ.id });
                const idx = journal.indexOf(matchedJ);
                if (idx > -1) journal.splice(idx, 1);
                matchCount++;
            }
        }

        const updateStmt = db.prepare(`
            UPDATE bank_statements SET reconciled_journal_id = ? 
            WHERE id = ? AND workspace_id = ? AND user_id = ?
        `);
        const updateTransaction = db.transaction((matches) => {
            for (const m of matches) {
                updateStmt.run(m.journalId, m.stmtId, ruc, userId);
            }
        });
        updateTransaction(updates);

        res.json({ success: true, matchCount });
    } catch (error) {
        console.error('[BANK ERROR] Error en auto-match:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Mejora #2 & #5: Endpoints de Gestión de Períodos y Cascada de Cambios ---

// Listar períodos y sus estados
app.get('/api/periods/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const userId = req.targetUserId;
        const periods = db.queryAll(
            `SELECT * FROM accounting_periods WHERE workspace_id = ? AND user_id = ?`,
            [ruc, userId]
        );
        res.json({ success: true, periods });
    } catch (error) {
        console.error('[DB ERROR] Error en getPeriods:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Consultar estado de obsolescencia de los libros contables
app.get('/api/periods/:ruc/stale-status', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query; // YYYY-MM
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Se requiere el parámetro periodo (YYYY-MM).' });
        }
        const rows = db.queryAll(
            `SELECT module, is_stale, stale_since, last_sync, version 
             FROM period_versions 
             WHERE workspace_id = ? AND user_id = ? AND periodo = ?`,
            [ruc, userId, periodo]
        );
        res.json({ success: true, rows });
    } catch (error) {
        console.error('[DB ERROR] Error en stale-status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cerrar período con ejecución de pre-checks contables
app.post('/api/periods/:ruc/close', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo, tipo, notas } = req.body; // periodo: YYYY-MM, tipo: MENSUAL|ANUAL
        const userId = req.targetUserId;

        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Se requiere el parámetro periodo.' });
        }

        const dateFilter = (tipo === 'ANUAL')
            ? `substr(fecha, 1, 4) = '${periodo}'`
            : `substr(fecha, 1, 7) = '${periodo}'`;

        const checks = [];

        // Check 1: Partida Doble Cuadrada
        const journalBalance = db.queryAll(
            `SELECT COALESCE(SUM(debe), 0) as total_debe, COALESCE(SUM(haber), 0) as total_haber
             FROM journal WHERE workspace_id = ? AND user_id = ? AND ${dateFilter}`,
            [ruc, userId]
        )[0] || { total_debe: 0, total_haber: 0 };
        const diff = Math.abs(journalBalance.total_debe - journalBalance.total_haber);
        checks.push({
            id: 'PARTIDA_DOBLE',
            nombre: 'Partida Doble Cuadrada',
            descripcion: 'SUM(DEBE) = SUM(HABER) en el Libro Diario del período',
            ok: diff <= 0.01,
            detalle: diff <= 0.01
                ? `Cuadrado: DEBE S/ ${journalBalance.total_debe.toFixed(2)} = HABER S/ ${journalBalance.total_haber.toFixed(2)}`
                : `DESCUADRE: DEBE S/ ${journalBalance.total_debe.toFixed(2)} vs HABER S/ ${journalBalance.total_haber.toFixed(2)} (diff: S/ ${diff.toFixed(2)})`,
            bloqueante: true
        });

        // Check 2: SIRE sin riesgos críticos
        const sireRisk = db.queryAll(
            `SELECT COUNT(*) as count FROM purchases
             WHERE workspace_id = ? AND user_id = ? AND ${dateFilter}
               AND estado_sire IN ('RIESGO_CRITICO', 'RIESGO_ALTO')`,
            [ruc, userId]
        )[0]?.count || 0;
        checks.push({
            id: 'SIRE_LIMPIO',
            nombre: 'SIRE sin Riesgos Críticos',
            descripcion: 'No hay comprobantes con estado RIESGO_CRITICO o RIESGO_ALTO',
            ok: sireRisk === 0,
            detalle: sireRisk === 0 ? 'Sin riesgos pendientes' : `${sireRisk} comprobante(s) con riesgo crítico/alto`,
            bloqueante: false
        });

        // Check 3: Cuenta 40112 saldada (Uso común)
        const prorrataIGV = db.queryAll(
            `SELECT COALESCE(SUM(debe) - SUM(haber), 0) as saldo
             FROM journal WHERE workspace_id = ? AND user_id = ? AND cta = '40112' AND ${dateFilter}`,
            [ruc, userId]
        )[0]?.saldo || 0;
        checks.push({
            id: 'PRORRATA_IGV',
            nombre: 'Prorrata IGV Aplicada',
            descripcion: 'Saldo de cuenta 40112 (IGV uso común) debe estar en cero',
            ok: Math.abs(prorrataIGV) <= 0.01,
            detalle: Math.abs(prorrataIGV) <= 0.01 ? 'Cuenta 40112 saldada' : `Saldo pendiente en 40112: S/ ${Math.abs(prorrataIGV).toFixed(2)}`,
            bloqueante: false
        });

        // Check 4: Depreciación cargada
        const fixedAssets = db.queryAll(
            `SELECT COUNT(*) as total, SUM(CASE WHEN deprec_ejercicio > 0 THEN 1 ELSE 0 END) as con_deprec
             FROM fixed_assets WHERE workspace_id = ? AND user_id = ?`,
            [ruc, userId]
        )[0] || { total: 0, con_deprec: 0 };
        const sinDeprec = fixedAssets.total - fixedAssets.con_deprec;
        checks.push({
            id: 'DEPRECIACION',
            nombre: 'Depreciación Cargada',
            descripcion: 'Todos los activos fijos deben tener depreciación calculada',
            ok: sinDeprec === 0 || fixedAssets.total === 0,
            detalle: fixedAssets.total === 0 ? 'Sin activos fijos registrados' : (sinDeprec === 0 ? `${fixedAssets.total} activo(s) con depreciación OK` : `${sinDeprec} activo(s) sin depreciación`),
            bloqueante: false
        });

        // Check 5: Tipo de Cambio SBS
        const foreignDocs = db.queryAll(
            `SELECT COUNT(*) as count FROM purchases
             WHERE workspace_id = ? AND user_id = ? AND ${dateFilter}
               AND moneda IS NOT NULL AND moneda != 'PEN' AND moneda != ''
               AND (tc IS NULL OR tc = 0 OR tc = 1)`,
            [ruc, userId]
        )[0]?.count || 0;
        checks.push({
            id: 'TC_SBS',
            nombre: 'TC SBS Ajustado',
            descripcion: 'Documentos en moneda extranjera deben tener tipo de cambio SBS válido',
            ok: foreignDocs === 0,
            detalle: foreignDocs === 0 ? 'Todos los comprobantes en ME tienen TC' : `${foreignDocs} comprobantes en ME sin TC`,
            bloqueante: false
        });

        // Check 6: Kárdex cuadrado
        const kardexInconsistent = db.queryAll(
            `SELECT COUNT(*) as count FROM inventory_movements
             WHERE workspace_id = ? AND user_id = ? AND total_saldo < 0`,
            [ruc, userId]
        )[0]?.count || 0;
        checks.push({
            id: 'KARDEX',
            nombre: 'Kárdex Cuadrado',
            descripcion: 'No debe haber saldos negativos en el inventario valorizado',
            ok: kardexInconsistent === 0,
            detalle: kardexInconsistent === 0 ? 'Inventario sin inconsistencias' : `${kardexInconsistent} movimiento(s) con saldo negativo`,
            bloqueante: false
        });

        const blockers = checks.filter(c => !c.ok && c.bloqueante).map(c => c.nombre);
        const warnings = checks.filter(c => !c.ok && !c.bloqueante).map(c => c.nombre);
        const canClose = blockers.length === 0;

        if (canClose) {
            db.run(
                `INSERT INTO accounting_periods (workspace_id, periodo, tipo, estado, cerrado_por, cerrado_at, notas, user_id)
                 VALUES (?, ?, ?, 'CERRADO', ?, CURRENT_TIMESTAMP, ?, ?)
                 ON CONFLICT(workspace_id, periodo, tipo, user_id)
                 DO UPDATE SET estado = 'CERRADO', cerrado_por = ?, cerrado_at = CURRENT_TIMESTAMP, notas = ?`,
                [ruc, periodo, tipo || 'MENSUAL', req.user.email || req.targetUserId, notas || '', userId, req.user.email || req.targetUserId, notas || '']
            );
        }

        res.json({
            success: true,
            report: {
                periodo,
                tipo: tipo || 'MENSUAL',
                checks,
                canClose,
                blockers,
                warnings
            }
        });
    } catch (error) {
        console.error('[DB ERROR] Error en closePeriod:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reabrir período
app.post('/api/periods/:ruc/reopen', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo, tipo } = req.body;
        const userId = req.targetUserId;

        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Se requiere el parámetro periodo.' });
        }

        db.run(
            `INSERT INTO accounting_periods (workspace_id, periodo, tipo, estado, user_id)
             VALUES (?, ?, ?, 'ABIERTO', ?)
             ON CONFLICT(workspace_id, periodo, tipo, user_id)
             DO UPDATE SET estado = 'ABIERTO', cerrado_por = NULL, cerrado_at = NULL`,
            [ruc, periodo, tipo || 'MENSUAL', userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en reopenPeriod:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- API Endpoints: Buzon SUNAT ---

app.post('/api/buzon/consultar', async (req, res) => {
    try {
        console.log('[BUZON API] Petición de consulta recibida:', {
            ruc: req.body?.ruc,
            usuario: req.body?.usuario,
            hasClave: !!req.body?.clave,
            claveLength: req.body?.clave ? req.body.clave.length : 0,
            empresa: req.body?.empresa
        });
        const result = await buzonHandler.consultarBuzon(req.body);
        res.json(result);
    } catch (error) {
        console.error('[BUZON API ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/buzon/descargar-adjunto', async (req, res) => {
    try {
        const result = await buzonHandler.descargarAdjunto(req.body);
        if (result.success && result.ruta) {
            let filepath = null;
            const fs = require('fs');
            
            if (result.ruta.includes('<b>FUSIÓN:</b>')) {
                // Formato: <b>FUSIÓN:</b> nombre_fusion.pdf<br/><hr/>ruta1<br/>ruta2
                const match = result.ruta.match(/<b>FUSIÓN:<\/b>\s*([^<]+)/);
                if (match) {
                    const mergedName = match[1].trim();
                    const lines = result.ruta.split('<br/>');
                    const sourceLine = lines.find(l => l.includes('/') || l.includes('\\'));
                    if (sourceLine) {
                        const cleanSourcePath = sourceLine.replace(/<\/?[^>]+(>|$)/g, "").trim();
                        const dir = path.dirname(cleanSourcePath);
                        const mergedPath = path.join(dir, mergedName);
                        if (fs.existsSync(mergedPath)) {
                            filepath = mergedPath;
                        }
                    }
                }
            }
            
            // Fallback si no hay fusión o no se encontró la fusión
            if (!filepath) {
                const paths = result.ruta.split('<br/>');
                for (let p of paths) {
                    let cleanPath = p.replace(/<\/?[^>]+(>|$)/g, "").trim();
                    if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
                        filepath = cleanPath;
                        break;
                    }
                }
            }

            if (filepath && fs.existsSync(filepath)) {
                const fileBuffer = fs.readFileSync(filepath);
                result.fileBase64 = fileBuffer.toString('base64');
                result.fileName = path.basename(filepath);
                result.fileType = filepath.toLowerCase().endsWith('.zip') ? 'application/zip' : 'application/pdf';
            }
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/buzon/extraer-detalle', async (req, res) => {
    try {
        const { browserId, mensajeId } = req.body;
        if (!browserId || !mensajeId) {
            return res.status(400).json({ success: false, error: 'Parámetros inválidos.' });
        }
        const result = await buzonHandler.extraerDetalleMensaje(browserId, mensajeId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/buzon/listar-constancias', async (req, res) => {
    try {
        const { ruc } = req.body;
        if (!ruc) {
            return res.status(400).json({ success: false, error: 'RUC inválido.' });
        }
        const result = await buzonHandler.listarConstancias(ruc);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/buzon/cerrar-todas', async (req, res) => {
    try {
        const result = await buzonHandler.cerrarTodasLasSesiones();
        res.json(result || { success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/buzon/descargar-archivo-constancia', async (req, res) => {
    try {
        const { ruta } = req.body;
        if (!ruta) {
            return res.status(400).json({ success: false, error: 'Ruta inválida.' });
        }
        
        const fs = require('fs');
        const safePath = path.resolve(ruta);
        const downloadBase = path.resolve(buzonDir);
        if (!safePath.startsWith(downloadBase)) {
            return res.status(403).json({ success: false, error: 'Acceso no autorizado.' });
        }

        if (!fs.existsSync(safePath)) {
            return res.status(404).json({ success: false, error: 'El archivo ya no existe en el servidor.' });
        }

        const fileBuffer = fs.readFileSync(safePath);
        res.json({
            success: true,
            fileBase64: fileBuffer.toString('base64'),
            fileName: path.basename(safePath),
            fileType: safePath.toLowerCase().endsWith('.zip') ? 'application/zip' : 'application/pdf'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- API Endpoints: SIRE ---

app.post('/api/sire/ejecutar', async (req, res) => {
    try {
        console.log('[SIRE API] Petición de ejecución recibida:', {
            ruc: req.body?.ruc,
            proceso: req.body?.proceso,
            periodoInicio: req.body?.periodoInicio,
            hasCredentials: !!req.body?.credentials,
            usuario_sol: req.body?.credentials?.usuario_sol,
            hasClaveSol: !!req.body?.credentials?.clave_sol,
            clientId: req.body?.credentials?.client_id,
            hasClientSecret: !!req.body?.credentials?.client_secret
        });
        const result = await sireHandler.ejecutarSire({ ...req.body, userId: req.targetUserId });
        res.json(result);
    } catch (error) {
        console.error('[SIRE API ERROR]:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sire/generar-archivo', async (req, res) => {
    try {
        const result = await sireHandler.generarArchivoSireEnvio(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sire/archivos', async (req, res) => {
    try {
        const outputDir = sireDir;
        if (!fs.existsSync(outputDir)) {
            return res.json({ archivos: [] });
        }
        
        let allFiles = [];
        const walk = (dir) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    walk(fullPath);
                } else if (file.endsWith('.xlsx') || file.endsWith('.zip') || file.endsWith('.txt')) {
                    const stats = fs.statSync(fullPath);
                    allFiles.push({
                        nombre: file,
                        fecha: stats.mtime.toLocaleString('es-PE'),
                        fullPath: fullPath,
                        size: stats.size
                    });
                }
            });
        };
        
        walk(outputDir);
        res.json({ archivos: allFiles.sort((a, b) => b.fecha.localeCompare(a.fecha)) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/sire/archivos/:nombre', async (req, res) => {
    try {
        const nombre = req.params.nombre;
        const outputDir = sireDir;
        
        const findFile = (dir, target) => {
            if (!fs.existsSync(dir)) return null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    const found = findFile(fullPath, target);
                    if (found) return found;
                } else if (file === target) {
                    return fullPath;
                }
            }
            return null;
        };

        const filePath = findFile(outputDir, nombre);
        if (filePath) {
            fs.unlinkSync(filePath);
            if (nombre.endsWith('.txt')) {
                const zipPath = filePath.replace('.txt', '.zip');
                if (fs.existsSync(zipPath)) {
                    fs.unlinkSync(zipPath);
                }
            }
            return res.json({ success: true });
        }
        res.status(404).json({ success: false, error: 'Archivo no encontrado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sire/archivos/:nombre/descargar', async (req, res) => {
    try {
        const nombre = req.params.nombre;
        const outputDir = sireDir;
        
        const findFile = (dir, target) => {
            if (!fs.existsSync(dir)) return null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    const found = findFile(fullPath, target);
                    if (found) return found;
                } else if (file === target) {
                    return fullPath;
                }
            }
            return null;
        };

        const filePath = findFile(outputDir, nombre);
        if (filePath) {
            res.download(filePath, nombre);
        } else {
            res.status(404).json({ success: false, error: 'Archivo no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Middleware para verificar rol de Administrador ---
const adminAuthMiddleware = (req, res, next) => {
    const normalizedEmail = (req.user?.email || '').trim().toLowerCase();
    const isAdmin = req.user?.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com' || normalizedEmail.startsWith('admin');
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Se requieren privilegios de Administrador.' });
    }
    next();
};

// --- Diagnóstico Inteligente Local ---
function runAiDiagnostic(userComment, systemState = {}) {
    const analysisLines = [];
    analysisLines.push("### 🧠 Diagnóstico del Asistente Contable Inteligente\n");
    
    let checksPassed = true;
    
    if (systemState.bi !== undefined && systemState.igv !== undefined && systemState.total !== undefined) {
        const bi = parseFloat(systemState.bi) || 0;
        const igv = parseFloat(systemState.igv) || 0;
        const total = parseFloat(systemState.total) || 0;
        const noGravada = parseFloat(systemState.noGravada) || 0;
        const isc = parseFloat(systemState.isc) || 0;
        
        const calculatedIgv = Math.round(bi * 0.18 * 100) / 100;
        const diffIgv = Math.abs(calculatedIgv - igv);
        
        if (bi > 0) {
            if (diffIgv > 0.1) {
                checksPassed = false;
                analysisLines.push(`* **⚠️ Alerta de IGV:** Se detectó una diferencia en el IGV. Registrado: **S/ ${igv.toFixed(2)}**, Esperado (18%): **S/ ${calculatedIgv.toFixed(2)}** (Diferencia: S/ ${diffIgv.toFixed(2)}).`);
            } else {
                analysisLines.push(`* **✅ Cálculo de IGV Correcto:** El IGV de S/ ${igv.toFixed(2)} corresponde al 18% de la base imponible S/ ${bi.toFixed(2)}.`);
            }
        }
        
        const expectedTotal = Math.round((bi + igv + noGravada + isc) * 100) / 100;
        const diffTotal = Math.abs(expectedTotal - total);
        if (diffTotal > 0.1) {
            checksPassed = false;
            analysisLines.push(`* **⚠️ Descuadre en Sumas:** La suma de Base Imponible (S/ ${bi.toFixed(2)}) + IGV (S/ ${igv.toFixed(2)}) + No Gravada (S/ ${noGravada.toFixed(2)}) + ISC (S/ ${isc.toFixed(2)}) es **S/ ${expectedTotal.toFixed(2)}**, pero se registró un total de **S/ ${total.toFixed(2)}**.`);
        } else {
            analysisLines.push(`* **✅ Consistencia en Totales:** La suma de los componentes coincide con el total registrado de S/ ${total.toFixed(2)}.`);
        }
    }
    
    if (systemState.regimenTributario) {
        const regimen = systemState.regimenTributario;
        const total = parseFloat(systemState.total) || 0;
        
        analysisLines.push(`* **Régimen de la Empresa:** ${regimen}`);
        
        if (regimen === 'NRUS') {
            analysisLines.push("* **ℹ️ Regla NRUS:** Recuerda que las empresas en el Nuevo RUS (NRUS) no emiten Facturas, solo Boletas de Venta o Tickets. Tampoco pueden utilizar el crédito fiscal de compras.");
            if (total > 8000) {
                checksPassed = false;
                analysisLines.push(`* **⚠️ Exceso de Límite NRUS:** Las compras/ventas registradas de S/ ${total.toFixed(2)} superan el límite mensual máximo de la Categoría 2 del NRUS (S/ 8,000).`);
            }
        } else if (regimen === 'RER') {
            analysisLines.push("* **ℹ️ Regla RER:** El Régimen Especial de Renta (RER) tiene límites de compras/ventas anuales de S/ 525,000 y restricciones en actividades.");
        }
    }
    
    if (systemState.ctaGasto || systemState.ctaAbono) {
        const ctaG = systemState.ctaGasto;
        if (ctaG) {
            if (ctaG.startsWith('60')) {
                analysisLines.push(`* **Foco Contable (Cuenta de Compra):** Se utilizó la cuenta de gasto/costo **${ctaG}**. Esta cuenta requiere amarres al elemento 20/25 (Ingreso a Almacén) y elemento 61 (Variación de Inventarios) en el Libro Diario.`);
            } else if (ctaG.startsWith('63') || ctaG.startsWith('64') || ctaG.startsWith('65')) {
                analysisLines.push(`* **Foco Contable (Gastos de Servicios/Tributos):** Cuenta **${ctaG}**. Requiere amarre de gastos administrativos (Clase 94) o ventas (Clase 95) contra la cuenta 791.`);
            }
        }
    }
    
    const lowerComment = userComment.toLowerCase();
    if (lowerComment.includes('igv') || lowerComment.includes('impuesto')) {
        analysisLines.push("\n**💡 Recomendación para el Reporte de Impuestos:** Revisa si la operación está gravada o exonerada. Si es una compra no gravada, asegúrate de colocar el monto en el campo 'No Gravada' para evitar que afecte el IGV.");
    } else if (lowerComment.includes('amarre') || lowerComment.includes('destino') || lowerComment.includes('cuenta')) {
        analysisLines.push("\n**💡 Recomendación para Asientos Contables:** Verifica los amarres automáticos configurados en el 'Plan Contable' para la cuenta indicada. Si el asiento de diario no se generó, la cuenta podría no tener configurados los amarres debe/haber.");
    } else if (lowerComment.includes('sire') || lowerComment.includes('sol') || lowerComment.includes('sunat')) {
        analysisLines.push("\n**💡 Recomendación para Buzón/SIRE:** Verifica que las credenciales SOL de la empresa estén vigentes y que el Client ID / Client Secret estén correctamente registrados en la configuración de la empresa.");
    } else {
        analysisLines.push("\n**💡 Recomendación:** El reporte ha sido clasificado para revisión de lógica contable general. Se recomienda al administrador auditar la base de datos de este workspace.");
    }
    
    if (checksPassed) {
        analysisLines.push("\n*Nota del Analizador: No se detectaron inconsistencias matemáticas evidentes basadas en los datos numéricos enviados. Podría tratarse de un problema de interfaz, de flujo o de criterio profesional del usuario.*");
    } else {
        analysisLines.push("\n*Nota del Analizador: Se han identificado discrepancias numéricas o de reglas tributarias. Se sugiere revisar la configuración del asiento o la empresa.*");
    }
    
    return analysisLines.join("\n");
}

// --- API Endpoints: Sugerencias & Administración ---

app.post('/api/suggestions', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { workspace_ruc, workspace_name, view_context, user_comment, image_base64, system_state } = req.body;
        
        // Generar análisis IA local
        const ai_analysis = runAiDiagnostic(user_comment || '', system_state || {});
        
        const suggestion = {
            id: `sug-${Date.now()}`,
            user_id: req.user.id,
            user_email: req.user.email,
            workspace_ruc: workspace_ruc || '',
            workspace_name: workspace_name || '',
            view_context: view_context || 'General',
            user_comment: user_comment || '',
            image_base64: image_base64 || null,
            system_state: JSON.stringify(system_state || {}),
            ai_analysis,
            status: 'PENDIENTE'
        };
        
        await db.createSuggestion(suggestion);
        res.json({ success: true, suggestion });
    } catch (error) {
        console.error('[SUGGESTION ERROR]:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/suggestions', authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const suggestions = await db.getSuggestions();
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('[ADMIN ERROR] Error en getSuggestions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/suggestions/:id/resolve', authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        await db.resolveSuggestion(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[ADMIN ERROR] Error en resolveSuggestion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/users', authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const users = await db.getAdminUsersSummary();
        res.json({ success: true, users });
    } catch (error) {
        console.error('[ADMIN ERROR] Error en getUsersSummary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/user-workspace-data/:userId/:ruc', authMiddleware, adminAuthMiddleware, async (req, res) => {
    try {
        const data = await db.getWorkspaceData(req.params.ruc, req.params.userId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[ADMIN ERROR] Error en inspectWorkspace:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Sprint 5: IFRS/NIIF & NIC 12 Endpoints ---
app.use('/api/finance', authMiddleware, inspectMiddleware);

app.get('/api/finance/notes/:ruc', async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!ruc || !periodo) {
            return res.status(400).json({ success: false, error: 'Falta RUC o periodo.' });
        }
        const row = await db.getFinanceNotes(ruc, periodo, userId);
        res.json({ success: true, notes: row ? JSON.parse(row.notes_json) : null });
    } catch (error) {
        console.error('[DB ERROR] Error en GET finance notes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/finance/notes', async (req, res) => {
    try {
        const { ruc, periodo, notes } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !periodo || !notes) {
            return res.status(400).json({ success: false, error: 'Falta RUC, periodo o notas.' });
        }
        const notesJson = JSON.stringify(notes);
        await db.saveFinanceNotes(ruc, periodo, notesJson, userId);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en POST finance notes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/finance/deferred-tax/:ruc', async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!ruc || !periodo) {
            return res.status(400).json({ success: false, error: 'Falta RUC o periodo.' });
        }
        const row = await db.getDeferredTax(ruc, periodo, userId);
        res.json({ success: true, computation: row ? JSON.parse(row.computation_json) : null });
    } catch (error) {
        console.error('[DB ERROR] Error en GET deferred tax:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/finance/deferred-tax', async (req, res) => {
    try {
        const { ruc, periodo, computation } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !periodo || !computation) {
            return res.status(400).json({ success: false, error: 'Falta RUC, periodo o computación.' });
        }
        const computationJson = JSON.stringify(computation);
        await db.saveDeferredTax(ruc, periodo, computationJson, userId);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en POST deferred tax:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── Endpoints Libro Diario 5.2 (Simplificado) ───
app.get('/api/libro-diario-52/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo (AAAAMM00)' });
        }
        const asientos = ld52Service.obtenerAsientosPeriodo(ruc, userId, periodo);
        res.json({ success: true, data: asientos });
    } catch (error) {
        console.error('[API ERROR] Error en GET libro-diario-52:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/libro-diario-52/:ruc/formato-fisico', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo (AAAAMM00)' });
        }
        const data = ld52Service.obtenerFormatoFisico(ruc, userId, periodo);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[API ERROR] Error en GET formato-fisico 5.2:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/libro-diario-52/:ruc/registrar', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { lineas } = req.body;
        const userId = req.targetUserId;
        const result = ld52Service.registrarAsiento(ruc, userId, lineas);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API ERROR] Error en registrar asiento 5.2:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/libro-diario-52/:ruc/generar-masivo', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.body;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta periodo en el cuerpo de la petición' });
        }
        const result = ld52Service.generarMasivo(ruc, userId, periodo);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API ERROR] Error en generar masivo 5.2:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/libro-diario-52/:ruc/corregir', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { cuoOriginal, tipo, nuevasLineas } = req.body;
        const userId = req.targetUserId;
        const result = ld52Service.corregirAsiento(ruc, userId, cuoOriginal, parseInt(tipo), nuevasLineas);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API ERROR] Error en corregir asiento 5.2:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/libro-diario-52/:ruc/validar-balance', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const result = ld52Service.validarBalancePeriodo(ruc, userId, periodo);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[API ERROR] Error en validar balance 5.2:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/libro-diario-52/:ruc/exportar-txt', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const txt = ld52Service.generarTXT52(ruc, userId, periodo);
        const filename = ld52Service.nombreArchivoTXT(ruc, periodo);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        res.charset = 'UTF-8';
        res.send(txt);
    } catch (error) {
        console.error('[API ERROR] Error en exportar-txt 5.2:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/libro-diario-52/:ruc/exportar-txt-54', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const txt = ld52Service.generarTXT54(ruc, userId, periodo);
        const filename = ld52Service.nombreArchivoTXT54(ruc, periodo);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        res.charset = 'UTF-8';
        res.send(txt);
    } catch (error) {
        console.error('[API ERROR] Error en exportar-txt-54:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/retenciones-41/:ruc', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const data = retenciones41Service.obtenerRetenciones(ruc, userId, periodo);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[API ERROR] Error en obtenerRetenciones 4.1:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/retenciones-41/:ruc/exportar-txt', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const txt = retenciones41Service.generarTXT41(ruc, userId, periodo);
        const tieneDatos = txt.length > 0;
        const filename = retenciones41Service.nombreArchivoTXT(ruc, periodo, tieneDatos);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        res.charset = 'UTF-8';
        res.send(txt);
    } catch (error) {
        console.error('[API ERROR] Error en exportar-txt 4.1:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/ple-71/:ruc/exportar-txt', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const txt = ple71Service.generarTXT71(ruc, userId, periodo);
        const tieneDatos = txt.length > 0;
        const filename = ple71Service.nombreArchivoTXT(ruc, periodo, tieneDatos);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        res.charset = 'UTF-8';
        res.send(txt);
    } catch (error) {
        console.error('[API ERROR] Error en exportar-txt 7.1:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/ple-101/:ruc/exportar-txt', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const txt = costs101Service.generarTXT101(ruc, userId, periodo);
        const tieneDatos = txt.length > 0;
        const filename = costs101Service.nombreArchivoTXT(ruc, periodo, tieneDatos);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        res.charset = 'UTF-8';
        res.send(txt);
    } catch (error) {
        console.error('[API ERROR] Error en exportar-txt 10.1:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/api/ple-121/:ruc/exportar-txt', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { periodo } = req.query;
        const userId = req.targetUserId;
        if (!periodo) {
            return res.status(400).json({ success: false, error: 'Falta parámetro periodo' });
        }
        const txt = kardex121Service.generarTXT121(ruc, userId, periodo);
        const tieneDatos = txt.length > 0;
        const filename = kardex121Service.nombreArchivoTXT(ruc, periodo, tieneDatos);
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'text/plain; charset=utf-8');
        res.charset = 'UTF-8';
        res.send(txt);
    } catch (error) {
        console.error('[API ERROR] Error en exportar-txt 12.1:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/libro-diario-52/:ruc/sync-compra', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { id } = req.body;
        const userId = req.targetUserId;
        db.rawDb.prepare(`DELETE FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND asiento_id_origen=? AND origen_modulo='COMPRAS'`).run(ruc, userId, id);
        const purchase = db.rawDb.prepare(`SELECT * FROM purchases WHERE id=? AND workspace_id=? AND user_id=?`).get(id, ruc, userId);
        if (purchase) {
            ld52Service.generarAsientoDesdeCompra(purchase, ruc, userId);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[API ERROR] Error en sync-compra:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/libro-diario-52/:ruc/sync-venta', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { id } = req.body;
        const userId = req.targetUserId;
        db.rawDb.prepare(`DELETE FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND asiento_id_origen=? AND origen_modulo='VENTAS'`).run(ruc, userId, id);
        const sale = db.rawDb.prepare(`SELECT * FROM sales WHERE id=? AND workspace_id=? AND user_id=?`).get(id, ruc, userId);
        if (sale) {
            ld52Service.generarAsientoDesdeVenta(sale, ruc, userId);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[API ERROR] Error en sync-venta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/libro-diario-52/:ruc/delete-origen', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc } = req.params;
        const { id } = req.body;
        const userId = req.targetUserId;
        db.rawDb.prepare(`DELETE FROM libro_diario_52 WHERE workspace_id=? AND user_id=? AND asiento_id_origen=?`).run(ruc, userId, id);
        res.json({ success: true });
    } catch (error) {
        console.error('[API ERROR] Error en delete-origen:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- API Endpoints: Facturación Electrónica UBL 2.1 ---
app.post('/api/facturacion/configurar-certificado', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, password, pfxBase64 } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !password || !pfxBase64) {
            return res.status(400).json({ success: false, error: 'Parámetros ruc, password y pfxBase64 son requeridos.' });
        }
        const pfxBuffer = Buffer.from(pfxBase64, 'base64');
        db.saveCertificado(ruc, userId, pfxBuffer, password);
        res.json({ success: true, message: 'Certificado digital (.pfx) configurado correctamente ✓' });
    } catch (error) {
        console.error('[API ERROR] Error en configurar-certificado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/facturacion/emitir-comprobante', authMiddleware, inspectMiddleware, async (req, res) => {
    try {
        const { ruc, comprobanteId } = req.body;
        const userId = req.targetUserId;
        if (!ruc || !comprobanteId) {
            return res.status(400).json({ success: false, error: 'Parámetros ruc y comprobanteId son requeridos.' });
        }
        
        // 1. Obtener datos de la empresa (emisor)
        const wsData = await db.getWorkspaceData(ruc, userId);
        if (!wsData || !wsData.currentCompany) {
            return res.status(404).json({ success: false, error: 'No se encontró la empresa emisora.' });
        }
        const emisor = wsData.currentCompany;

        // 2. Obtener comprobante de venta
        const sale = wsData.sales.find(s => s.id === comprobanteId);
        if (!sale) {
            return res.status(404).json({ success: false, error: 'No se encontró la venta con el ID provisto.' });
        }

        // 3. Obtener certificado del contribuyente
        const cert = db.getCertificado(ruc, userId);
        if (!cert) {
            return res.status(400).json({ success: false, error: '⚠️ Debe configurar un certificado digital para esta empresa antes de emitir comprobantes.' });
        }

        // 4. Generar XML UBL 2.1
        const xmlSinFirma = ublService.generarXMLFactura(sale, emisor);

        // 5. Firmar digitalmente con el certificado propio del contribuyente
        const xmlFirmado = ublService.firmarXML(xmlSinFirma, cert.pfx, cert.pass, ruc);

        // 6. Enviar a SUNAT/OSE
        const response = await ublService.enviarSUNATOSE(ruc, sale.tipo_doc || '01', sale.serie, sale.numero, xmlFirmado, emisor.sol_user, emisor.sol_pass);

        res.json({
            success: true,
            cdrXml: response.cdrXml,
            status: response.status,
            mensaje: response.mensaje,
            xmlFirmado: Buffer.from(xmlFirmado).toString('base64')
        });
    } catch (error) {
        console.error('[API ERROR] Error en emitir-comprobante:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Health Check y Monitoreo (ANTES del catch-all) ---
app.get('/health', (req, res) => {
    const fs = require('fs');
    const dbPath = process.env.DATABASE_PATH || require('path').join(process.cwd(), 'database', 'pld_contable.db');
    
    try {
        const dbType = USE_POSTGRES ? 'PostgreSQL' : 'SQLite';
        const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size / (1024 * 1024) : 0;
        const memUsage = process.memoryUsage();
        const cacheStats = cacheService.getStats();
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: USE_POSTGRES ? {
                type: dbType,
                host: process.env.DATABASE_URL ? 'connected' : 'not configured'
            } : {
                type: dbType,
                path: dbPath,
                size_mb: dbSize.toFixed(2),
                max_size_gb: 5,
                usage_percent: ((dbSize / 1024 / 5) * 100).toFixed(2)
            },
            memory: {
                rss_mb: (memUsage.rss / 1024 / 1024).toFixed(2),
                heap_used_mb: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
                heap_total_mb: (memUsage.heapTotal / 1024 / 1024).toFixed(2)
            },
            cache: cacheStats,
            uptime_seconds: Math.floor(process.uptime()),
            node_version: process.version
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

app.get('/api/health', (req, res) => {
    // Alias de /health para compatibilidad
    req.url = '/health';
    app.handle(req, res);
});

// --- Static Files & SPA Routing (DESPUÉS de todas las rutas API) ---

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// --- Endpoint de Limpieza de Cache (Solo Admin) ---
app.post('/api/cache/clear', authMiddleware, (req, res) => {
    const normalizedEmail = (req.user?.email || '').trim().toLowerCase();
    const isAdmin = req.user?.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com';
    
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }
    
    cacheService.clear();
    res.json({ success: true, message: 'Cache limpiado exitosamente' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] SOFTCONTABLE 2 ONLINE en puerto ${PORT}`);
});
