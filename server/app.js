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
        const { sql, params } = req.body;
        // Agregamos el user_id a los parámetros si la consulta lo requiere
        const result = await db.run(sql, params);
        res.json({ success: true, result });
    } catch (error) {
        console.error('[DB ERROR] Error en execute:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/db/backup', async (req, res) => {
    try {
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
        console.log(`[DB] Guardando fila balance inicial para RUC: ${req.params.ruc}`);
        await db.saveBalanceInicial(req.params.ruc, req.user.id, req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('[DB ERROR] Fallo al guardar balance inicial:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/db/balance-inicial/:ruc/:id', async (req, res) => {
    try {
        await db.deleteBalanceInicial(req.params.ruc, req.user.id, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- API Endpoints: Buzon SUNAT ---

app.post('/api/buzon/consultar', async (req, res) => {
    try {
        const result = await buzonHandler.consultarBuzon(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/buzon/descargar-adjunto', async (req, res) => {
    try {
        const result = await buzonHandler.descargarAdjunto(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- API Endpoints: SIRE ---

app.post('/api/sire/ejecutar', async (req, res) => {
    try {
        const result = await sireHandler.ejecutarSire({ ...req.body, userId: req.user.id });
        res.json(result);
    } catch (error) {
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
