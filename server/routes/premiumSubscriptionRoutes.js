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
 * Obtiene el estado de la suscripción SoftPremium para el usuario y workspace activo.
 */
router.get('/status', async (req, res) => {
    try {
        const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];
        const userId = req.user?.id;
        const userEmail = (req.user?.email || '').trim().toLowerCase();
        const isAdmin = req.user?.role === 'admin' || userEmail === 'aangelo2555@gmail.com';

        let userEnabled = false;
        if (USE_POSTGRES && (userId || userEmail)) {
            try {
                const uRes = await dbCore.pool.query(
                    `SELECT premium_enabled FROM users WHERE id = $1 OR LOWER(email) = $2 LIMIT 1`,
                    [userId || '', userEmail || '']
                );
                userEnabled = Boolean(uRes.rows[0]?.premium_enabled);
            } catch (e) {
                console.warn('[PREMIUM USER STATUS CHECK WARN]', e.message);
            }
        } else if (userId || userEmail) {
            try {
                const uRes = await dbCore.queryAll(`SELECT premium_enabled FROM users WHERE id = ? OR LOWER(email) = ?`, [userId || '', userEmail || '']);
                userEnabled = Boolean(uRes[0]?.premium_enabled);
            } catch (e) {}
        }

        let workspace = null;
        if (workspaceId) {
            try {
                workspace = await dbCore.getWorkspaceById(workspaceId);
            } catch (e) {
                console.warn('[PREMIUM SUBSCRIPTION STATUS GET WORKSPACE WARN]', e.message);
            }
        }

        let subscriptions = [];
        if (USE_POSTGRES && (workspaceId || userId || userEmail)) {
            try {
                const subRes = await queryPremium(
                    `SELECT * FROM premium.premium_subscriptions WHERE workspace_id = $1 OR user_id = $2 OR LOWER(user_email) = $3 ORDER BY created_at DESC`,
                    [workspaceId || '', userId || '', userEmail || '']
                );
                subscriptions = subRes?.rows || [];
            } catch (err) {
                console.warn('[PREMIUM SUBSCRIPTION READ WARN]', err.message);
            }
        }

        const hasActiveSub = subscriptions.some(s => s.status === 'active');
        const isEnabled = isAdmin || userEnabled || Boolean(workspace?.premium_enabled) || hasActiveSub;

        res.json({
            success: true,
            hasAccess: isEnabled,
            premium_enabled: isEnabled,
            premium_tiers: ['full'],
            subscriptions,
            role: req.user?.role || 'user'
        });
    } catch (error) {
        console.error('[PREMIUM SUBSCRIPTION STATUS ERROR]', error.message);
        res.json({
            success: true,
            hasAccess: false,
            premium_enabled: false,
            premium_tiers: [],
            subscriptions: []
        });
    }
});

/**
 * POST /api/premium/subscription/submit-voucher
 * El usuario registra el pago por Yape / Plin / Transferencia con su comprobante adjunto.
 */
router.post('/submit-voucher', async (req, res) => {
    try {
        const { workspaceId, planTier, billingCycle, priceCentimos, paymentMethod, referenceNumber, voucherBase64 } = req.body;
        const userId = req.user?.id || 'CLIENTE_SISTEMA';
        const userEmail = (req.body.userEmail || req.user?.email || '').toLowerCase().trim();
        const userName = req.body.userName || req.user?.name || req.user?.nombre || userEmail || 'Cliente';

        const subId = uuidv4();
        const price = priceCentimos || 4900;

        if (USE_POSTGRES) {
            try {
                await queryPremium(
                    `INSERT INTO premium.premium_subscriptions 
                    (id, workspace_id, user_id, user_email, user_name, plan_tier, status, billing_cycle, price_centimos, payment_provider, payment_provider_ref, voucher_base64)
                    VALUES ($1, $2, $3, $4, $5, $6, 'trial', $7, $8, $9, $10, $11)`,
                    [
                        subId, 
                        workspaceId || 'GLOBAL', 
                        userId, 
                        userEmail, 
                        userName, 
                        planTier || 'full', 
                        billingCycle || 'monthly', 
                        price, 
                        paymentMethod || 'YAPE', 
                        referenceNumber || 'PENDIENTE',
                        voucherBase64 || null
                    ]
                );
            } catch (e) {
                console.warn('[SUBMIT VOUCHER DB WARN]', e.message);
            }
        }

        res.json({
            success: true,
            message: 'Comprobante y solicitud registrados exitosamente. El administrador revisará tu pago.',
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
 * Activa o desactiva SoftPremium globalmente para un Usuario y todas sus empresas.
 */
router.post('/activate-manual', requireAdmin, async (req, res) => {
    try {
        const { userId, userEmail, workspaceId, enable, tiers } = req.body;
        const isEnabled = enable !== false;

        const targetEmail = (userEmail || '').toLowerCase().trim();
        const targetUserId = userId || '';
        const targetWorkspaceRuc = workspaceId || '';

        if (USE_POSTGRES) {
            // 1. Activar en tabla USERS por ID o EMAIL
            if (targetUserId || targetEmail) {
                await dbCore.pool.query(
                    `UPDATE users SET premium_enabled = $1 WHERE id = $2 OR LOWER(email) = $3`,
                    [isEnabled, targetUserId, targetEmail]
                );

                // 2. Activar en todas las empresas de ese usuario
                await dbCore.pool.query(
                    `UPDATE public.workspaces SET premium_enabled = $1 WHERE user_id = $2 OR user_id = (SELECT id FROM users WHERE LOWER(email) = $3 LIMIT 1)`,
                    [isEnabled, targetUserId, targetEmail]
                );
            }

            // 3. Opcional: Activar por RUC de empresa
            if (targetWorkspaceRuc) {
                await dbCore.pool.query(
                    `UPDATE public.workspaces SET premium_enabled = $1 WHERE ruc = $2`,
                    [isEnabled, targetWorkspaceRuc]
                );
            }

            // Registrar suscripción en schema premium
            try {
                const subId = uuidv4();
                await queryPremium(
                    `INSERT INTO premium.premium_subscriptions 
                    (id, workspace_id, user_id, user_email, plan_tier, status, billing_cycle, price_centimos, payment_provider, payment_provider_ref)
                    VALUES ($1, $2, $3, $4, $5, $6, 'monthly', 0, 'admin_manual', 'ACTIVADO_POR_ADMIN')`,
                    [subId, targetWorkspaceRuc || 'ALL', targetUserId || 'ADMIN', targetEmail, tiers?.[0] || 'full', isEnabled ? 'active' : 'canceled']
                );
            } catch (e) {
                console.warn('[PREMIUM SUBSCRIPTION INSERT WARN]', e.message);
            }
        } else {
            // SQLite local
            if (targetWorkspaceRuc) {
                await dbCore.queryAll(`UPDATE workspaces SET premium_enabled = ? WHERE ruc = ?`, [isEnabled ? 1 : 0, targetWorkspaceRuc]);
            }
        }

        res.json({
            success: true,
            message: `SoftPremium ${isEnabled ? 'activado' : 'desactivado'} correctamente para el usuario y sus empresas.`,
            userEmail: targetEmail,
            premium_enabled: isEnabled
        });
    } catch (error) {
        console.error('[ACTIVATE MANUAL ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/premium/subscription/admin/list-all (Solo Admin)
 * Lista las solicitudes de suscripción con sus imágenes de voucher para el Panel Admin.
 */
router.get('/admin/list-all', requireAdmin, async (req, res) => {
    try {
        let list = [];
        if (USE_POSTGRES) {
            const result = await dbCore.pool.query(`
                SELECT 
                    u.id as user_id,
                    COALESCE(u.name, s.user_name, 'Cliente') as user_name,
                    LOWER(u.email) as user_email,
                    COALESCE(u.premium_enabled, FALSE) as premium_enabled,
                    (SELECT COUNT(DISTINCT ruc) FROM public.workspaces WHERE user_id = u.id) as workspace_count,
                    s.id as subscription_id,
                    COALESCE(s.plan_tier, 'full') as plan_tier,
                    COALESCE(s.payment_provider, 'N/A') as payment_provider,
                    COALESCE(s.payment_provider_ref, 'PENDIENTE') as reference_number,
                    s.voucher_base64,
                    COALESCE(s.status, 'inactive') as subscription_status,
                    COALESCE(s.created_at, u.created_at) as created_at
                FROM users u
                LEFT JOIN LATERAL (
                    SELECT id, user_name, user_email, plan_tier, payment_provider, payment_provider_ref, voucher_base64, status, created_at
                    FROM premium.premium_subscriptions 
                    WHERE user_id = u.id OR LOWER(user_email) = LOWER(u.email)
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) s ON TRUE
                ORDER BY s.created_at DESC NULLS LAST, u.name ASC
            `);
            list = result.rows || [];
        } else {
            list = await dbCore.queryAll(`SELECT id as user_id, name as user_name, email as user_email, 0 as premium_enabled FROM users ORDER BY name ASC`);
        }

        res.json({
            success: true,
            requests: list
        });
    } catch (error) {
        console.error('[ADMIN LIST PREMIUM ERROR]', error.message);
        res.json({
            success: true,
            requests: []
        });
    }
});

module.exports = router;
