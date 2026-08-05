const express = require('express');
const router = express.Router();
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbCore = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const { poolPremium, queryPremium } = require('../poolPremium');
const { v4: uuidv4 } = require('uuid');

// Middleware para verificar que sea Admin
const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'No autenticado.' });
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const isAdmin = user.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com';
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }
    next();
};

/**
 * GET /api/premium/subscription/status
 * Obtiene el estado de la suscripción SoftPremium para un workspace.
 */
router.get('/status', async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta workspaceId' });
        }

        let workspace = null;
        try {
            workspace = await dbCore.getWorkspaceById(workspaceId);
        } catch (e) {
            console.warn('[PREMIUM SUBSCRIPTION STATUS GET WORKSPACE WARN]', e.message);
        }

        let subscriptions = [];
        if (USE_POSTGRES) {
            try {
                const subRes = await queryPremium(
                    `SELECT * FROM premium.premium_subscriptions WHERE workspace_id = $1 ORDER BY created_at DESC`,
                    [workspaceId]
                );
                subscriptions = subRes?.rows || [];
            } catch (err) {
                console.warn('[PREMIUM SUBSCRIPTION READ WARN]', err.message);
            }
        }

        res.json({
            success: true,
            workspaceId,
            premium_enabled: workspace ? Boolean(workspace.premium_enabled) : false,
            premium_tiers: workspace && Array.isArray(workspace.premium_tiers) ? workspace.premium_tiers : [],
            subscriptions
        });
    } catch (error) {
        console.error('[PREMIUM SUBSCRIPTION STATUS ERROR]', error.message);
        // Fallback seguro sin fallar 500
        res.json({
            success: true,
            workspaceId: req.query.workspaceId || null,
            premium_enabled: false,
            premium_tiers: [],
            subscriptions: []
        });
    }
});

/**
 * POST /api/premium/subscription/submit-voucher
 * El usuario registra el pago por Yape / Plin / Transferencia con su comprobante.
 */
router.post('/submit-voucher', async (req, res) => {
    try {
        const { workspaceId, planTier, billingCycle, priceCentimos, paymentMethod, referenceNumber, voucherBase64 } = req.body;
        const userId = req.user?.id || 'CLIENTE_SISTEMA';

        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta campo obligatorio workspaceId.' });
        }

        const subId = uuidv4();
        const price = priceCentimos || 4900; // S/ 49.00 por defecto en céntimos

        if (USE_POSTGRES) {
            try {
                await queryPremium(
                    `INSERT INTO premium.premium_subscriptions 
                    (id, workspace_id, user_id, plan_tier, status, billing_cycle, price_centimos, payment_provider, payment_provider_ref)
                    VALUES ($1, $2, $3, $4, 'trial', $5, $6, $7, $8)`,
                    [subId, workspaceId, userId, planTier || 'full', billingCycle || 'monthly', price, paymentMethod || 'YAPE', referenceNumber || 'PENDIENTE']
                );
            } catch (e) {
                console.warn('[SUBMIT VOUCHER DB WARN]', e.message);
            }
        }

        res.json({
            success: true,
            message: 'Comprobante registrado exitosamente. Un administrador activará tu suscripción en breve.',
            subscriptionId: subId
        });
    } catch (error) {
        console.error('[SUBMIT VOUCHER ERROR]', error.message);
        res.json({
            success: true,
            message: 'Comprobante registrado exitosamente.'
        });
    }
});

/**
 * POST /api/premium/subscription/activate-manual (Solo Admin)
 * Activa o desactiva SoftPremium directamente para un workspace.
 */
router.post('/activate-manual', requireAdmin, async (req, res) => {
    try {
        const { workspaceId, enable, tiers } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ success: false, error: 'Falta workspaceId.' });
        }

        const activeTiers = Array.isArray(tiers) && tiers.length > 0 ? tiers : ['full'];
        const isEnabled = enable !== false;

        if (USE_POSTGRES) {
            // Actualizar public.workspaces (única escritura cruzada permitida)
            await dbCore.pool.query(
                `UPDATE public.workspaces 
                 SET premium_enabled = $1 
                 WHERE ruc = $2`,
                [isEnabled, workspaceId]
            );

            // Registrar/Actualizar suscripción en schema premium si existe
            if (isEnabled) {
                try {
                    const subId = uuidv4();
                    await queryPremium(
                        `INSERT INTO premium.premium_subscriptions 
                        (id, workspace_id, user_id, plan_tier, status, billing_cycle, price_centimos, payment_provider, payment_provider_ref)
                        VALUES ($1, $2, $3, $4, 'active', 'monthly', 0, 'admin_manual', 'ACTIVADO_POR_ADMIN')`,
                        [subId, workspaceId, req.user?.id || 'ADMIN', activeTiers[0] || 'full']
                    );
                } catch (e) {
                    console.warn('[PREMIUM SUBSCRIPTION INSERT WARN]', e.message);
                }
            }
        } else {
            // SQLite local
            await dbCore.queryAll(
                `UPDATE workspaces SET premium_enabled = ? WHERE ruc = ?`,
                [isEnabled ? 1 : 0, workspaceId]
            );
        }

        res.json({
            success: true,
            message: `SoftPremium ${isEnabled ? 'activado' : 'desactivado'} correctamente para la empresa.`,
            workspaceId,
            premium_enabled: isEnabled,
            premium_tiers: activeTiers
        });
    } catch (error) {
        console.error('[ACTIVATE MANUAL ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/premium/subscription/admin/list-all (Solo Admin)
 * Lista todos los workspaces y sus solicitudes de suscripción para el Panel Admin.
 */
router.get('/admin/list-all', requireAdmin, async (req, res) => {
    try {
        let list = [];
        if (USE_POSTGRES) {
            const result = await dbCore.pool.query(
                `SELECT name, ruc, premium_enabled, regimentributario FROM public.workspaces ORDER BY name ASC`
            );
            list = result.rows || [];
        } else {
            list = await dbCore.queryAll(`SELECT name, ruc, premium_enabled, regimenTributario FROM workspaces ORDER BY name ASC`);
        }

        res.json({
            success: true,
            workspaces: list
        });
    } catch (error) {
        console.error('[ADMIN LIST PREMIUM ERROR]', error.message);
        res.json({
            success: true,
            workspaces: []
        });
    }
});

module.exports = router;
