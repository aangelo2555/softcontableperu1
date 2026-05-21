const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./databaseServer');
const buzonHandler = require('../main/buzonHandler');
const sireHandler = require('../modulo/sireHandler');
const { sireDir, buzonDir } = require('./storageConfig');

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

app.post('/api/suggestions', authMiddleware, async (req, res) => {
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
