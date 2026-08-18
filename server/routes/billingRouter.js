const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const { getWorkspaceCount } = require('../middleware/billingMiddleware');

const CULQI_SECRET_KEY = process.env.CULQI_SECRET_KEY || 'sk_test_mock_secret_key';
const CULQI_WEBHOOK_SECRET = process.env.CULQI_WEBHOOK_SECRET || '';

/**
 * GET /api/subscription/plans
 * Catálogo público de planes disponibles y características
 */
router.get('/plans', async (req, res) => {
    try {
        let plans = [];
        if (USE_POSTGRES) {
            const result = await db.pool.query(
                'SELECT * FROM plans WHERE is_active = true ORDER BY price_pen ASC'
            );
            plans = result.rows;
        } else {
            plans = db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY price_pen ASC').all();
        }
        res.json({ success: true, plans });
    } catch (err) {
        console.error('[GET PLANS ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al obtener planes.' });
    }
});

/**
 * GET /api/subscription/me
 * Estado de la suscripción y uso de recursos del usuario autenticado
 */
router.get('/me', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'No autenticado.' });
        }

        const isSuperAdminUser = req.user?.role === 'super_admin' || (req.user?.email || '').trim().toLowerCase() === 'aangelo2555@gmail.com';
        if (isSuperAdminUser) {
            const workspacesUsed = await getWorkspaceCount(userId);
            return res.json({
                success: true,
                subscription: {
                    id: 'superadmin-master',
                    user_id: userId,
                    plan_id: 'corporativo',
                    plan_name: 'Corporativo (Master SaaS Propietario)',
                    status: 'active',
                    max_workspaces: 9999,
                    max_users: 9999,
                    maxWorkspaces: 9999,
                    workspacesUsed,
                    daysRemaining: 9999,
                    isTrial: false,
                    isActive: true,
                    isReadOnly: false,
                    includes_premium: true,
                    price_pen: 499.00
                }
            });
        }

        let sub = null;
        if (USE_POSTGRES) {
            const subRes = await db.pool.query(
                `SELECT s.*, p.name as plan_name, p.price_pen, p.price_annual_pen, p.includes_premium, p.features
                 FROM subscriptions s
                 LEFT JOIN plans p ON s.plan_id = p.id
                 WHERE s.user_id = $1
                 ORDER BY s.created_at DESC LIMIT 1`,
                [userId]
            );
            sub = subRes.rows[0];
        } else {
            sub = db.prepare(`
                SELECT s.*, p.name as plan_name, p.price_pen, p.price_annual_pen, p.includes_premium, p.features
                FROM subscriptions s
                LEFT JOIN plans p ON s.plan_id = p.id
                WHERE s.user_id = ?
                ORDER BY s.created_at DESC LIMIT 1
            `).get(userId);
        }

        // Si no existe suscripción, crear una por defecto con plan 'estudiante'
        if (!sub) {
            const subId = crypto.randomUUID();
            if (USE_POSTGRES) {
                await db.pool.query(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, current_period_end)
                     VALUES ($1, $2, 'estudiante', 'active', 1, 1, NOW() + INTERVAL '14 days')`,
                    [subId, userId]
                );
            } else {
                db.prepare(`
                    INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, current_period_end)
                    VALUES (?, ?, 'estudiante', 'active', 1, 1, datetime('now', '+14 days'))
                `).run(subId, userId);
            }
            sub = {
                id: subId,
                user_id: userId,
                plan_id: 'estudiante',
                plan_name: 'Estudiante / Free',
                status: 'active',
                max_workspaces: 1,
                max_users: 1,
                price_pen: 0.00
            };
        }

        const workspacesUsed = await getWorkspaceCount(userId);

        // Calcular días restantes
        let daysRemaining = 0;
        const expiryDate = sub.current_period_end || sub.trial_ends_at;
        if (expiryDate) {
            const diffMs = new Date(expiryDate).getTime() - Date.now();
            daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        }

        const maxWorkspaces = (sub.plan_id === 'corporativo') ? 9999 : (sub.plan_id === 'starter') ? Math.max(3, sub.max_workspaces || 3) : (sub.max_workspaces || 1);

        res.json({
            success: true,
            subscription: {
                ...sub,
                workspacesUsed,
                maxWorkspaces,
                daysRemaining,
                isTrial: sub.status === 'trial',
                isActive: sub.status === 'active' || sub.status === 'trial' || sub.status === 'grace',
                isReadOnly: sub.status === 'suspended' || sub.status === 'cancelled'
            }
        });
    } catch (err) {
        console.error('[GET SUBSCRIPTION ME ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al consultar suscripción.' });
    }
});

/**
 * POST /api/subscription/checkout
 * Procesar cobro con tarjeta mediante Culqi y actualizar suscripción
 */
router.post('/checkout', async (req, res) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email || req.body.email;
        const { planId, culqiToken, billingCycle = 'monthly' } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'No autenticado.' });
        }
        if (!planId || !culqiToken) {
            return res.status(400).json({ success: false, error: 'Plan y Token de pago requeridos.' });
        }

        // 1. Obtener datos del plan seleccionado
        let plan = null;
        if (USE_POSTGRES) {
            const planRes = await db.pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
            plan = planRes.rows[0];
        } else {
            plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
        }

        if (!plan) {
            return res.status(404).json({ success: false, error: 'Plan no encontrado.' });
        }

        const isAnnual = billingCycle === 'annual';
        const amountSol = isAnnual ? (plan.price_annual_pen || plan.price_pen * 12 * 0.8) : plan.price_pen;
        const amountCentimos = Math.round(amountSol * 100);

        let chargeId = `charge_mock_${Date.now()}`;
        let culqiSuccess = true;

        // 2. Si no estamos en modo mock y hay secret key configurada, cobrar via API de Culqi
        if (CULQI_SECRET_KEY && !CULQI_SECRET_KEY.includes('mock')) {
            try {
                const culqiResponse = await axios.post(
                    'https://api.culqi.com/v2/charges',
                    {
                        amount: amountCentimos,
                        currency_code: 'PEN',
                        email: userEmail,
                        source_id: culqiToken,
                        description: `Suscripción SoftContable - Plan ${plan.name} (${isAnnual ? 'Anual' : 'Mensual'})`,
                        antifraud_details: {
                            first_name: req.user?.name || 'Cliente',
                            last_name: 'SoftContable',
                            email: userEmail
                        }
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${CULQI_SECRET_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 20000
                    }
                );
                chargeId = culqiResponse.data.id;
            } catch (culqiErr) {
                const errorData = culqiErr.response?.data || {};
                console.error('[CULQI CHARGE ERROR]', errorData);
                return res.status(400).json({
                    success: false,
                    error: errorData.user_message || errorData.merchant_message || 'El pago fue declinado por su banco.'
                });
            }
        }

        // 3. Calcular nueva fecha de expiración
        const intervalSql = isAnnual ? '1 year' : '1 month';
        const intervalSqlite = isAnnual ? '+1 year' : '+1 month';

        // 4. Actualizar o insertar suscripción en BD
        let subId = crypto.randomUUID();
        if (USE_POSTGRES) {
            const existingSub = await db.pool.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
            if (existingSub.rows.length > 0) {
                subId = existingSub.rows[0].id;
                await db.pool.query(
                    `UPDATE subscriptions SET
                        plan_id = $1,
                        status = 'active',
                        max_workspaces = $2,
                        max_users = $3,
                        current_period_start = NOW(),
                        current_period_end = NOW() + INTERVAL '${intervalSql}',
                        culqi_card_token = $4,
                        updated_at = NOW()
                     WHERE id = $5`,
                    [plan.id, plan.max_workspaces, plan.max_users, culqiToken, subId]
                );
            } else {
                await db.pool.query(
                    `INSERT INTO subscriptions (
                        id, user_id, plan_id, status, max_workspaces, max_users,
                        current_period_start, current_period_end, culqi_card_token
                     ) VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW() + INTERVAL '${intervalSql}', $6)`,
                    [subId, userId, plan.id, plan.max_workspaces, plan.max_users, culqiToken]
                );
            }

            // Registrar comprobante en tabla invoices
            await db.pool.query(
                `INSERT INTO invoices (
                    subscription_id, user_id, amount_pen, status, culqi_charge_id,
                    period_start, period_end, paid_at
                 ) VALUES ($1, $2, $3, 'paid', $4, NOW(), NOW() + INTERVAL '${intervalSql}', NOW())`,
                [subId, userId, amountSol, chargeId]
            );
        } else {
            const existingSub = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(userId);
            if (existingSub) {
                subId = existingSub.id;
                db.prepare(`
                    UPDATE subscriptions SET
                        plan_id = ?,
                        status = 'active',
                        max_workspaces = ?,
                        max_users = ?,
                        current_period_start = CURRENT_TIMESTAMP,
                        current_period_end = datetime('now', '${intervalSqlite}'),
                        culqi_card_token = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(plan.id, plan.max_workspaces, plan.max_users, culqiToken, subId);
            } else {
                db.prepare(`
                    INSERT INTO subscriptions (
                        id, user_id, plan_id, status, max_workspaces, max_users,
                        current_period_start, current_period_end, culqi_card_token
                    ) VALUES (?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, datetime('now', '${intervalSqlite}'), ?)
                `).run(subId, userId, plan.id, plan.max_workspaces, plan.max_users, culqiToken);
            }

            db.prepare(`
                INSERT INTO invoices (
                    id, subscription_id, user_id, amount_pen, status, culqi_charge_id,
                    period_start, period_end, paid_at
                ) VALUES (?, ?, ?, ?, 'paid', ?, CURRENT_TIMESTAMP, datetime('now', '${intervalSqlite}'), CURRENT_TIMESTAMP)
            `).run(crypto.randomUUID(), subId, userId, amountSol, chargeId);
        }

        res.json({
            success: true,
            message: `¡Suscripción al Plan ${plan.name} activada con éxito!`,
            chargeId,
            plan: plan.name,
            maxWorkspaces: plan.max_workspaces
        });
    } catch (err) {
        console.error('[CHECKOUT ERROR]', err);
        res.status(500).json({ success: false, error: 'Error procesando la suscripción.' });
    }
});

/**
 * GET /api/subscription/invoices
 * Historial de comprobantes de pago del usuario
 */
router.get('/invoices', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: 'No autenticado.' });

        let invoices = [];
        if (USE_POSTGRES) {
            const result = await db.pool.query(
                `SELECT i.*, p.name as plan_name
                 FROM invoices i
                 LEFT JOIN subscriptions s ON i.subscription_id = s.id
                 LEFT JOIN plans p ON s.plan_id = p.id
                 WHERE i.user_id = $1
                 ORDER BY i.created_at DESC`,
                [userId]
            );
            invoices = result.rows;
        } else {
            invoices = db.prepare(`
                SELECT i.*, p.name as plan_name
                FROM invoices i
                LEFT JOIN subscriptions s ON i.subscription_id = s.id
                LEFT JOIN plans p ON s.plan_id = p.id
                WHERE i.user_id = ?
                ORDER BY i.created_at DESC
            `).all(userId);
        }

        res.json({ success: true, invoices });
    } catch (err) {
        console.error('[GET INVOICES ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al obtener comprobantes.' });
    }
});

/**
 * PUT /api/subscription/cancel
 * Cancelar la renovación automática
 */
router.put('/cancel', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ success: false, error: 'No autenticado.' });

        if (USE_POSTGRES) {
            await db.pool.query(
                `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1`,
                [userId]
            );
        } else {
            db.prepare(`UPDATE subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).run(userId);
        }

        res.json({
            success: true,
            message: 'Su suscripción ha sido cancelada. Mantendrá acceso a sus empresas hasta el final del período contratado.'
        });
    } catch (err) {
        console.error('[CANCEL SUBSCRIPTION ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al cancelar suscripción.' });
    }
});

/**
 * POST /api/subscription/webhook
 * Webhook de Culqi para eventos en segundo plano con validación HMAC
 */
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-culqi-signature'] || req.headers['x-signature'];
        const event = req.body;

        // Validación HMAC de firma si el secreto está configurado
        if (CULQI_WEBHOOK_SECRET && signature) {
            const rawBody = JSON.stringify(req.body);
            const expectedSig = crypto
                .createHmac('sha256', CULQI_WEBHOOK_SECRET)
                .update(rawBody)
                .digest('hex');

            if (signature !== expectedSig) {
                console.warn('[CULQI WEBHOOK HMAC MISMATCH] Firma inválida');
                return res.status(401).json({ error: 'Firma de webhook inválida' });
            }
        }

        console.log(`[CULQI WEBHOOK EVENT] Tipo: ${event.type || event.event}`);

        if (event.type === 'charge.succeeded' || event.event === 'charge.succeeded') {
            const chargeData = event.data || event;
            const customerEmail = chargeData.email;
            if (customerEmail) {
                console.log(`[CULQI WEBHOOK] Pago exitoso para ${customerEmail}`);
                // Activar suscripción
                if (USE_POSTGRES) {
                    await db.pool.query(
                        `UPDATE subscriptions s
                         SET status = 'active', current_period_end = NOW() + INTERVAL '1 month', updated_at = NOW()
                         FROM users u
                         WHERE s.user_id = u.id AND LOWER(u.email) = LOWER($1)`,
                        [customerEmail]
                    );
                }
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err);
        res.status(500).json({ error: 'Error procesando webhook' });
    }
});

module.exports = router;
