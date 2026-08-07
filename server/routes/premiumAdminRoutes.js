const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbManager = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');

// Middleware para verificar que el usuario es administrador
const requireAdmin = (req, res, next) => {
    const user = req.user;
    const normalizedEmail = (user?.email || '').trim().toLowerCase();
    const isAdmin = user?.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com';
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Se requieren permisos de Administrador.' });
    }
    next();
};

/**
 * GET /api/premium/admin/rag-knowledge
 * Obtener la lista de reglas normativas RAG para SoftPremium.
 */
router.get('/rag-knowledge', requireAdmin, async (req, res) => {
    try {
        let items = [];
        if (USE_POSTGRES) {
            const result = await dbManager.pool.query(
                `SELECT * FROM premium_rag_knowledge ORDER BY updated_at DESC`
            );
            items = result.rows || [];
        } else if (dbManager.rawDb && dbManager.rawDb.prepare) {
            items = dbManager.rawDb.prepare(
                `SELECT * FROM premium_rag_knowledge ORDER BY updated_at DESC`
            ).all();
        }

        res.json({ success: true, items });
    } catch (e) {
        console.error('[ADMIN RAG GET ERROR]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/premium/admin/rag-knowledge
 * Crear o actualizar una regla/norma RAG para SoftPremium.
 */
router.post('/rag-knowledge', requireAdmin, async (req, res) => {
    try {
        const { id, pillar, moduleKey, title, lawArticles, calculationMethodology, customPromptRules } = req.body;

        if (!pillar || !title) {
            return res.status(400).json({ success: false, error: 'pillar y title son requeridos.' });
        }

        const itemId = id || uuidv4();
        const module_key = moduleKey || 'all';
        const law_articles_json = typeof lawArticles === 'object' ? JSON.stringify(lawArticles) : (lawArticles || '[]');

        if (USE_POSTGRES) {
            await dbManager.pool.query(
                `INSERT INTO premium_rag_knowledge (
                    id, pillar, module_key, title, law_articles, calculation_methodology, custom_prompt_rules, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET
                    pillar = EXCLUDED.pillar,
                    module_key = EXCLUDED.module_key,
                    title = EXCLUDED.title,
                    law_articles = EXCLUDED.law_articles,
                    calculation_methodology = EXCLUDED.calculation_methodology,
                    custom_prompt_rules = EXCLUDED.custom_prompt_rules,
                    updated_at = CURRENT_TIMESTAMP`,
                [itemId, pillar, module_key, title, law_articles_json, calculationMethodology || '', customPromptRules || '']
            );
        } else if (dbManager.rawDb && dbManager.rawDb.prepare) {
            dbManager.rawDb.prepare(
                `INSERT OR REPLACE INTO premium_rag_knowledge (
                    id, pillar, module_key, title, law_articles, calculation_methodology, custom_prompt_rules, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
            ).run(itemId, pillar, module_key, title, law_articles_json, calculationMethodology || '', customPromptRules || '');
        }

        res.json({ success: true, message: 'Regla RAG guardada exitosamente.', id: itemId });
    } catch (e) {
        console.error('[ADMIN RAG SAVE ERROR]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * DELETE /api/premium/admin/rag-knowledge/:id
 * Eliminar una regla RAG.
 */
router.delete('/rag-knowledge/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'id es requerido.' });
        }

        if (USE_POSTGRES) {
            await dbManager.pool.query(`DELETE FROM premium_rag_knowledge WHERE id = $1`, [id]);
        } else if (dbManager.rawDb && dbManager.rawDb.prepare) {
            dbManager.rawDb.prepare(`DELETE FROM premium_rag_knowledge WHERE id = ?`).run(id);
        }

        res.json({ success: true, message: 'Regla RAG eliminada correctamente.' });
    } catch (e) {
        console.error('[ADMIN RAG DELETE ERROR]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
