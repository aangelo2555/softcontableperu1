/**
 * Rutas y Controlador de la API de STAR (starAgentRoutes.js)
 * 
 * Endpoints:
 * - POST /api/star/chat           → Chat conversacional con ejecución ReAct de Tools
 * - POST /api/star/audit-sheet    → Auditoría rápida de 1-clic para la hoja activa
 * - GET  /api/star/conversations  → Historial de sesiones STAR
 * - GET  /api/star/messages/:id   → Mensajes de una conversación
 * - GET  /api/star/learnings/:ws  → Reglas aprendidas de la empresa
 * - POST /api/star/reinforce      → Calibración de reglas por feedback
 * - DELETE /api/star/learnings/:id→ Eliminar regla aprendida
 */

const express = require('express');
const router = express.Router();
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const { processStarChat } = require('../services/starAgentService');
const { reinforceLearning } = require('../services/starMemoryService');
const { executeStarTool } = require('../services/starToolRegistry');

// Middleware opcional para extraer usuario si viene JWT
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            req.user = payload;
        } catch (_) {}
    }
    next();
}

router.use(optionalAuth);

/**
 * POST /api/star/chat
 * Procesa una consulta conversacional con ejecución autónoma de herramientas
 */
router.post('/chat', async (req, res) => {
    try {
        const { query, conversationId, workspaceId, activeTab, period, currentCompany, history } = req.body;
        const userId = req.user?.id || req.body.userId || 'CLIENTE_SISTEMA';

        if (!query || !query.trim()) {
            return res.status(400).json({ success: false, error: 'La consulta no puede estar vacía.' });
        }

        const effectiveWorkspaceId = workspaceId || currentCompany?.ruc || 'default';
        let effectiveConvId = conversationId;

        // Si no se pasó conversationId, crear o reutilizar una sesión
        if (!effectiveConvId) {
            effectiveConvId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            await db.createStarConversation({
                id: effectiveConvId,
                workspaceId: effectiveWorkspaceId,
                userId,
                title: query.slice(0, 40) + '...',
                activeTab: activeTab || 'EMPRESA'
            });
        }

        // Guardar mensaje del usuario
        const userMsgId = `msg_${Date.now()}_u`;
        await db.saveStarMessage({
            id: userMsgId,
            conversationId: effectiveConvId,
            role: 'user',
            content: query
        });

        // Procesar razonamiento con STAR ReAct Engine
        const starResult = await processStarChat({
            query,
            conversationHistory: history || [],
            context: {
                workspaceId: effectiveWorkspaceId,
                userId,
                activeTab,
                period,
                currentCompany
            }
        });

        // Guardar respuesta de STAR en BD
        const assistantMsgId = `msg_${Date.now()}_a`;
        await db.saveStarMessage({
            id: assistantMsgId,
            conversationId: effectiveConvId,
            role: 'assistant',
            content: starResult.answer,
            toolCalls: starResult.steps,
            toolResults: starResult.suggestedEntry
        });

        // Actualizar timestamp de la conversación
        await db.updateStarConversationTimestamp(effectiveConvId, activeTab);

        return res.json({
            success: true,
            conversationId: effectiveConvId,
            answer: starResult.answer,
            steps: starResult.steps,
            suggestedEntry: starResult.suggestedEntry,
            activeContext: starResult.activeContext
        });
    } catch (error) {
        console.error('[STAR CHAT ROUTE ERROR]', error.message);
        return res.status(500).json({
            success: false,
            error: 'Error procesando consulta con STAR: ' + error.message
        });
    }
});

/**
 * POST /api/star/audit-sheet
 * Auditoría rápida de 1 clic para la hoja activa
 */
router.post('/audit-sheet', async (req, res) => {
    try {
        const { workspaceId, activeTab, period, currentCompany } = req.body;
        const userId = req.user?.id || 'CLIENTE_SISTEMA';
        const effectiveWorkspaceId = workspaceId || currentCompany?.ruc || 'default';
        const effectivePeriod = period || new Date().toISOString().slice(0, 7);

        const auditData = await executeStarTool('star_crosscheck_audit', { periodo: effectivePeriod }, {
            workspaceId: effectiveWorkspaceId,
            userId,
            period: effectivePeriod,
            currentCompany
        });

        // Guardar log de auditoría
        const auditLogId = `aud_${Date.now()}`;
        const findingsCount = (auditData.observacionesCriticas?.comprasSinBancarizarMayor2000 || 0) + 
                              (auditData.observacionesCriticas?.asientosDescuadradosDiario || 0);

        const riskScore = findingsCount === 0 ? 'BAJO' : findingsCount < 3 ? 'MEDIO' : 'ALTO';

        await db.saveStarAuditLog({
            id: auditLogId,
            workspaceId: effectiveWorkspaceId,
            periodo: effectivePeriod,
            moduleAudited: activeTab || 'AUDITORIA_CRUZADA',
            findingsCount,
            riskScore,
            reportJson: auditData
        });

        return res.json({
            success: true,
            period: effectivePeriod,
            audit: auditData,
            riskScore
        });
    } catch (error) {
        console.error('[STAR AUDIT SHEET ERROR]', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/star/conversations/:workspaceId
 */
router.get('/conversations/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user?.id || 'CLIENTE_SISTEMA';
        const convs = await db.getStarConversations(workspaceId, userId);
        return res.json({ success: true, conversations: convs || [] });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/star/messages/:conversationId
 */
router.get('/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const msgs = await db.getStarMessages(conversationId);
        return res.json({ success: true, messages: msgs || [] });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/star/learnings/:workspaceId
 */
router.get('/learnings/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const { category } = req.query;
        const learnings = await db.getStarLearnings(workspaceId, category);
        return res.json({ success: true, learnings: learnings || [] });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/star/reinforce
 * Retroalimentación del usuario para reforzar o calibrar una regla
 */
router.post('/reinforce', async (req, res) => {
    try {
        const { workspaceId, category, entityKey, ruleData, wasCorrect } = req.body;
        const updated = await reinforceLearning(workspaceId, category, entityKey, ruleData, wasCorrect);
        return res.json({ success: true, learning: updated });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/star/learnings/:id
 */
router.delete('/learnings/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { workspaceId } = req.query;
        await db.deleteStarLearning(id, workspaceId);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
