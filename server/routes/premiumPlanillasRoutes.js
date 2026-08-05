const express = require('express');
const router = express.Router();
const { requirePremium } = require('../authPremium');
const premiumPayrollService = require('../services/premiumPayrollService');
const { queryPremium } = require('../poolPremium');

/**
 * POST /api/premium/planillas/gratificacion
 * Calcula la gratificación determinística (Ley 27735 / Ley 32563 CAS).
 */
router.post('/gratificacion', requirePremium('planillas'), async (req, res) => {
    try {
        const { workspaceId, employeeId, period, mesesTrabajados } = req.body;
        if (!workspaceId || !employeeId) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros (workspaceId, employeeId).' });
        }

        const result = await premiumPayrollService.calculateGratificacion({
            workspaceId,
            employeeId,
            period: period || new Date().toISOString().substring(0, 7),
            mesesTrabajados: Number(mesesTrabajados || 6)
        });

        res.json({
            success: true,
            message: 'Cálculo de gratificación completado.',
            calculation: result
        });
    } catch (error) {
        console.error('[PLANILLAS GRATIFICACION ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/premium/planillas/contrato
 * Genera un contrato de trabajo con IA (requiere revisión humana obligatoria).
 */
router.post('/contrato', requirePremium('planillas'), async (req, res) => {
    try {
        const { workspaceId, employeeId, tipoContrato, duracionMeses } = req.body;
        if (!workspaceId || !employeeId) {
            return res.status(400).json({ success: false, error: 'Faltan parámetros (workspaceId, employeeId).' });
        }

        const result = await premiumPayrollService.generateContract({
            workspaceId,
            employeeId,
            tipoContrato,
            duracionMeses
        });

        res.json({
            success: true,
            message: 'Contrato generado por IA. Recuerda marcarlo como revisado antes de uso legal.',
            contract: result
        });
    } catch (error) {
        console.error('[PLANILLAS CONTRATO ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PATCH /api/premium/planillas/approve-doc/:id
 * Marca un documento o cálculo como revisado por humano.
 */
router.patch('/approve-doc/:id', requirePremium('planillas'), async (req, res) => {
    try {
        const { id } = req.params;
        await queryPremium(
            `UPDATE premium.payroll_ai_runs SET reviewed_by_human = TRUE WHERE id = $1`,
            [id]
        );
        res.json({ success: true, message: 'Documento aprobado y validado por revisión humana.' });
    } catch (error) {
        console.error('[APPROVE DOC ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
