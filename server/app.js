const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./databaseServer');
const buzonHandler = require('../main/buzonHandler');
const sireHandler = require('../modulo/sireHandler');

const app = express();
const authRoutes = require('./authRoutes');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'softcontable-super-secret-key-2026';

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

// --- Rutas Protegidas ---
app.use('/api/db', authMiddleware);
app.use('/api/buzon', authMiddleware);
app.use('/api/sire', authMiddleware);

// --- API Endpoints: Database ---

app.get('/api/db/workspaces', async (req, res) => {
    try {
        const workspaces = await db.getWorkspaces(req.user.id);
        res.json({ success: true, workspaces });
    } catch (error) {
        console.error('[DB ERROR] Error en getWorkspaces:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/workspaces', async (req, res) => {
    try {
        await db.saveWorkspace(req.body, req.user.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get(['/api/db/workspace/:ruc', '/api/db/workspaces/:ruc'], async (req, res) => {
    try {
        const data = await db.getWorkspaceData(req.params.ruc, req.user.id);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[DB ERROR] Error en getWorkspaceData:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete(['/api/db/workspace/:ruc', '/api/db/workspaces/:ruc'], async (req, res) => {
    try {
        await db.deleteWorkspace(req.params.ruc, req.user.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en delete:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/execute', async (req, res) => {
    try {
        let { sql, params } = req.body;
        
        // ─── REESCRITURA AUTOMÁTICA DE SQL PARA SAAS (INYECCIÓN DE USER_ID) ───
        const insertMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
        if (insertMatch && req.user && req.user.id) {
            const tableName = insertMatch[1];
            try {
                const cols = db.queryAll(`PRAGMA table_info(${tableName})`);
                const hasUserId = cols.some(c => c.name === 'user_id');
                if (hasUserId && !sql.toLowerCase().includes('user_id')) {
                    const colParenCloseIndex = sql.indexOf(')');
                    const valuesIndex = sql.toUpperCase().indexOf('VALUES');
                    const valParenCloseIndex = sql.lastIndexOf(')');
                    
                    if (colParenCloseIndex !== -1 && valuesIndex !== -1 && valParenCloseIndex !== -1) {
                        const beforeCols = sql.slice(0, colParenCloseIndex);
                        const afterCols = sql.slice(colParenCloseIndex, valParenCloseIndex);
                        const endStr = sql.slice(valParenCloseIndex);
                        
                        sql = `${beforeCols}, user_id${afterCols}, ?${endStr}`;
                        params.push(req.user.id);
                        console.log(`[SAAS DB REWRITE] Inyectado user_id en la tabla ${tableName}`);
                    }
                }
            } catch (err) {
                console.error('[REWRITE ERROR] Error inyectando user_id:', err.message);
            }
        }

        const result = await db.run(sql, params);
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
        const metrics = await db.getCCCMetrics(req.params.ruc, req.user.id);
        res.json({ success: true, metrics });
    } catch (error) {
        console.error('[DB ERROR] Error en analytics CCC:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/balance-inicial/:ruc', async (req, res) => {
    try {
        console.log(`[DB] POST /balance-inicial/${req.params.ruc} - Body:`, JSON.stringify(req.body));
        await db.saveBalanceInicial(req.params.ruc, req.user.id, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en saveBalanceInicial:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/db/balance-inicial/bulk/:ruc', async (req, res) => {
    try {
        console.log(`[DB] POST /balance-inicial/bulk/${req.params.ruc} - Items: ${req.body.items?.length}`);
        await db.saveBalanceInicialBulk(req.params.ruc, req.user.id, req.body.items);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en saveBalanceInicialBulk:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/db/balance-inicial/:ruc/:id', async (req, res) => {
    try {
        console.log(`[DB] DELETE /balance-inicial/${req.params.ruc}/${req.params.id}`);
        await db.deleteBalanceInicial(req.params.ruc, req.user.id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Error en deleteBalanceInicial:', error.message);
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
        const downloadBase = path.resolve(path.join(process.cwd(), 'descargas_buzon'));
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
        const result = await sireHandler.ejecutarSire({ ...req.body, userId: req.user.id });
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

// --- Static Files & SPA Routing ---

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] SOFTCONTABLE 2 ONLINE en puerto ${PORT}`);
});
