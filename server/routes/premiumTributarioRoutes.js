const express = require('express');
const router = express.Router();
const { requirePremium } = require('../authPremium');
const premiumRiskService = require('../services/premiumRiskService');
const { queryPremium } = require('../poolPremium');

/**
 * POST /api/premium/tributario/analyze
 * Ejecuta un análisis de riesgo tributario con IA (Pilar 1).
 */
router.post('/analyze', requirePremium('tributario'), async (req, res) => {
    try {
        const { workspaceId, period, runType } = req.body;
        const userId = req.user?.id || 'CLIENTE_SISTEMA';

        if (!workspaceId || !period || !runType) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros obligatorios (workspaceId, period, runType).' });
        }

        const result = await premiumRiskService.runRiskAnalysis({
            workspaceId,
            userId,
            period,
            runType
        });

        res.json({
            success: true,
            message: 'Análisis de riesgo tributario completado exitosamente.',
            analysis: result
        });
    } catch (error) {
        console.error('[TRIBUTARIO ROUTE ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/premium/tributario/runs
 * Obtiene el historial de análisis de riesgo para un workspace.
 */
router.get('/runs', requirePremium('tributario'), async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta workspaceId.' });
        }

        const subRes = await queryPremium(
            `SELECT * FROM premium.risk_analysis_runs 
             WHERE workspace_id = $1 
             ORDER BY created_at DESC LIMIT 50`,
            [workspaceId]
        );

        res.json({
            success: true,
            runs: subRes.rows || []
        });
    } catch (error) {
        console.error('[TRIBUTARIO RUNS ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
