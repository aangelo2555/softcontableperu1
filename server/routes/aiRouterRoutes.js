/**
 * aiRouterRoutes.js - Rutas de diagnóstico y estado para el motor Multi-IA Gratuito
 */

const express = require('express');
const router = express.Router();
const { getActiveAiStatus, callFreeAiWithCascade } = require('../services/aiRouterService');

/**
 * GET /api/ai/status
 * Retorna el estado de los proveedores gratuitos configurados
 */
router.get('/status', (req, res) => {
    try {
        const status = getActiveAiStatus();
        res.json({
            success: true,
            status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/ai/test
 * Ejecuta una prueba de inferencia rápida y mide la latencia de respuesta
 */
router.post('/test', async (req, res) => {
    const startTime = Date.now();
    try {
        const result = await callFreeAiWithCascade({
            messages: [
                { role: 'user', content: 'Responde únicamente la palabra "OK" para verificar conectividad.' }
            ],
            temperature: 0.1,
            max_tokens: 10,
            timeoutMs: 15000
        });

        const latencyMs = Date.now() - startTime;

        res.json({
            success: true,
            provider: result.providerName,
            model: result.model,
            latencyMs,
            reply: result.content.trim()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            latencyMs: Date.now() - startTime,
            error: error.message
        });
    }
});

module.exports = router;
