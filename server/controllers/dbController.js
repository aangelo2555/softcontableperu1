const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const cacheService = require('../cacheService');

/**
 * dbController.js - Controlador desacoplado para endpoints de base de datos
 */

const dbController = {
    // GET /api/db/workspaces
    getWorkspaces: async (req, res) => {
        try {
            const cacheKey = `workspaces_${req.targetUserId}`;
            let workspaces = cacheService.get(cacheKey);
            
            if (!workspaces) {
                workspaces = await db.getWorkspaces(req.targetUserId);
                cacheService.set(cacheKey, workspaces, 5 * 60 * 1000); // 5 minutos
            }
            
            res.json({ success: true, workspaces });
        } catch (error) {
            console.error('[DB CONTROLLER ERROR] Error en getWorkspaces:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // POST /api/db/workspaces
    saveWorkspace: async (req, res) => {
        try {
            await db.saveWorkspace(req.body, req.targetUserId);
            
            // Invalidar cache de workspaces y workspace_data
            cacheService.invalidatePattern(`workspaces_.*`);
            cacheService.invalidatePattern(`workspace_data_${req.body.ruc}_.*`);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // GET /api/db/workspace/:ruc
    getWorkspaceData: async (req, res) => {
        try {
            const period = req.query.period || req.query.periodo || null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 1000;

            const cacheKey = `workspace_data_${req.params.ruc}_${req.targetUserId}_${period || 'all'}_${page}_${limit}`;
            
            let data = cacheService.get(cacheKey);
            if (!data) {
                data = await db.getWorkspaceData(req.params.ruc, req.targetUserId, { period, page, limit });
                cacheService.set(cacheKey, data, 2 * 60 * 1000); // 2 minutos
            }
            
            res.json({ success: true, data });
        } catch (error) {
            console.error('[DB CONTROLLER ERROR] Error en getWorkspaceData:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // DELETE /api/db/workspace/:ruc
    deleteWorkspace: async (req, res) => {
        try {
            await db.deleteWorkspace(req.params.ruc, req.targetUserId);
            cacheService.invalidatePattern(`workspace_.*_${req.params.ruc}_${req.targetUserId}`);
            res.json({ success: true });
        } catch (error) {
            console.error('[DB CONTROLLER ERROR] Error en deleteWorkspace:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // GET /api/db/purchases
    getPurchases: async (req, res) => {
        try {
            const { ruc, workspace_id, period, page = 1, limit = 500 } = req.query;
            const targetRuc = ruc || workspace_id;
            const userId = req.targetUserId;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let queryText = 'SELECT * FROM purchases WHERE workspace_id = $1 AND user_id = $2';
            let queryParams = [targetRuc, userId];

            if (period) {
                queryText += ' AND fecha LIKE $' + (queryParams.length + 1);
                queryParams.push(`%${period}%`);
            }

            queryText += ` ORDER BY fecha DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
            queryParams.push(parseInt(limit), offset);

            const rows = await db.queryAll(queryText, queryParams);
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // GET /api/db/sales
    getSales: async (req, res) => {
        try {
            const { ruc, workspace_id, period, page = 1, limit = 500 } = req.query;
            const targetRuc = ruc || workspace_id;
            const userId = req.targetUserId;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let queryText = 'SELECT * FROM sales WHERE workspace_id = $1 AND user_id = $2';
            let queryParams = [targetRuc, userId];

            if (period) {
                queryText += ' AND fecha LIKE $' + (queryParams.length + 1);
                queryParams.push(`%${period}%`);
            }

            queryText += ` ORDER BY fecha DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
            queryParams.push(parseInt(limit), offset);

            const rows = await db.queryAll(queryText, queryParams);
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // GET /api/db/journal
    getJournal: async (req, res) => {
        try {
            const { ruc, workspace_id, period, page = 1, limit = 1000 } = req.query;
            const targetRuc = ruc || workspace_id;
            const userId = req.targetUserId;
            const offset = (parseInt(page) - 1) * parseInt(limit);

            let queryText = 'SELECT * FROM journal WHERE workspace_id = $1 AND user_id = $2';
            let queryParams = [targetRuc, userId];

            if (period) {
                queryText += ' AND fecha LIKE $' + (queryParams.length + 1);
                queryParams.push(`%${period}%`);
            }

            queryText += ` ORDER BY fecha DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
            queryParams.push(parseInt(limit), offset);

            const rows = await db.queryAll(queryText, queryParams);
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = dbController;
