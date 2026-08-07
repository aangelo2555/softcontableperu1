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

/**
 * GET /api/premium/tributario/kpis
 * Obtiene los KPIs reales dinámicos para la empresa y periodo especificados.
 */
router.get('/kpis', requirePremium('tributario'), async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId || req.query.ruc || req.headers['x-workspace-id'];
        const period = req.query.period || '%';

        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta workspaceId o ruc.' });
        }

        const data = await premiumRiskService.calculateWorkspaceKPIs({
            workspaceId,
            period,
            userId: null
        });

        res.json({
            success: true,
            kpis: data
        });
    } catch (error) {
        console.error('[TRIBUTARIO KPIS ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/premium/tributario/rag-query
 * Consulta interactiva RAG a Groq AI con contexto normativo peruano 2026.
 */
router.post('/rag-query', requirePremium('tributario'), async (req, res) => {
    try {
        const { pillar, moduleKey, query, workspaceData } = req.body;
        const ragService = require('../services/ragKnowledgeService');
        
        if (!query) {
            return res.status(400).json({ success: false, error: 'Falta la consulta (query).' });
        }

        const answer = await ragService.processRAGQuery({
            pillar: pillar || 'tributario',
            moduleKey: moduleKey || 'ratio_compras_ventas',
            query,
            workspaceData: workspaceData || {}
        });

        res.json({
            success: true,
            answer
        });
    } catch (error) {
        console.error('[RAG QUERY ROUTE ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

