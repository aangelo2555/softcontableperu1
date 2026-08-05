const express = require('express');
const router = express.Router();
const { requirePremium } = require('../authPremium');
const premiumCashflowService = require('../services/premiumCashflowService');
const { queryPremium } = require('../poolPremium');

/**
 * POST /api/premium/finanzas/forecast
 * Genera la proyección de flujo de caja cruzada con vencimientos SUNAT (Pilar 3).
 */
router.post('/forecast', requirePremium('finanzas'), async (req, res) => {
    try {
        const { workspaceId, startDate, endDate, method } = req.body;
        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta workspaceId.' });
        }

        const forecast = await premiumCashflowService.generateCashflowForecast({
            workspaceId,
            startDate,
            endDate,
            method
        });

        res.json({
            success: true,
            message: 'Proyección de flujo de caja generada exitosamente.',
            forecast
        });
    } catch (error) {
        console.error('[FINANZAS FORECAST ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/premium/finanzas/history
 * Historial de proyecciones financieras para un workspace.
 */
router.get('/history', requirePremium('finanzas'), async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta workspaceId.' });
        }

        const subRes = await queryPremium(
            `SELECT * FROM premium.cashflow_forecasts WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 20`,
            [workspaceId]
        );

        res.json({
            success: true,
            forecasts: subRes.rows || []
        });
    } catch (error) {
        console.error('[FINANZAS HISTORY ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
