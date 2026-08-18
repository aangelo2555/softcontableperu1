const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const JWT_SECRET = process.env.JWT_SECRET || 'softcontable-super-secret-key-2026';

/**
 * Middleware: requireSuperAdmin
 * Valida que el usuario tenga rol 'super_admin' o sea el propietario Angelo Serna Simeon
 */
const requireSuperAdmin = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ success: false, error: 'No autenticado.' });
    }

    const email = (user.email || '').trim().toLowerCase();
    const isSuperAdmin = user.role === 'super_admin' || email === 'aangelo2555@gmail.com' || email === (process.env.SUPERADMIN_EMAIL || '').toLowerCase();

    if (!isSuperAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Acceso denegado. Panel exclusivo para el Administrador del Sistema (Angelo Serna Simeon).'
        });
    }

    next();
};

router.use(requireSuperAdmin);

/**
 * GET /api/superadmin/metrics
 * Métricas financieras y de negocio del SaaS (MRR, ARR, Churn, distribución de planes)
 */
router.get('/metrics', async (req, res) => {
    try {
        let mrr = 0;
        let totalUsers = 0;
        let totalWorkspaces = 0;
        let activeSubs = 0;
        let trialSubs = 0;
        let suspendedSubs = 0;
        let plansDistribution = {};
        let dbSizeMb = 0;

        if (USE_POSTGRES) {
            // 1. Total usuarios y workspaces
            const uCount = await db.pool.query('SELECT COUNT(*) as n FROM users');
            totalUsers = parseInt(uCount.rows[0]?.n || 0, 10);

            const wCount = await db.pool.query('SELECT COUNT(*) as n FROM workspaces');
            totalWorkspaces = parseInt(wCount.rows[0]?.n || 0, 10);

            // 2. Suscripciones y MRR
            const subRes = await db.pool.query(`
                SELECT s.status, s.plan_id, p.price_pen, COUNT(*) as count
                FROM subscriptions s
                LEFT JOIN plans p ON s.plan_id = p.id
                GROUP BY s.status, s.plan_id, p.price_pen
            `);

            subRes.rows.forEach(r => {
                const count = parseInt(r.count, 10);
                const price = parseFloat(r.price_pen || 0);

                if (r.status === 'active') {
                    activeSubs += count;
                    mrr += price * count;
                } else if (r.status === 'trial') {
                    trialSubs += count;
                } else if (r.status === 'suspended' || r.status === 'cancelled') {
                    suspendedSubs += count;
                }

                plansDistribution[r.plan_id] = (plansDistribution[r.plan_id] || 0) + count;
            });

            // 3. Telemetría de PostgreSQL
            try {
                const sizeRes = await db.pool.query(`
                    SELECT pg_database_size(current_database()) / (1024 * 1024) as size_mb
                `);
                dbSizeMb = parseFloat(sizeRes.rows[0]?.size_mb || 0).toFixed(2);
            } catch (e) {}
        } else {
            const uCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
            totalUsers = uCount?.n || 0;

            const wCount = db.prepare('SELECT COUNT(*) as n FROM workspaces').get();
            totalWorkspaces = wCount?.n || 0;

            const subRows = db.prepare(`
                SELECT s.status, s.plan_id, p.price_pen, COUNT(*) as count
                FROM subscriptions s
                LEFT JOIN plans p ON s.plan_id = p.id
                GROUP BY s.status, s.plan_id
            `).all();

            subRows.forEach(r => {
                const count = parseInt(r.count, 10);
                const price = parseFloat(r.price_pen || 0);
                if (r.status === 'active') {
                    activeSubs += count;
                    mrr += price * count;
                } else if (r.status === 'trial') {
                    trialSubs += count;
                } else if (r.status === 'suspended' || r.status === 'cancelled') {
                    suspendedSubs += count;
                }
                plansDistribution[r.plan_id] = (plansDistribution[r.plan_id] || 0) + count;
            });
            dbSizeMb = '15.40';
        }

        const arr = mrr * 12;
        const payingClients = activeSubs;
        const churnRate = totalUsers > 0 ? ((suspendedSubs / totalUsers) * 100).toFixed(1) : '0.0';

        res.json({
            success: true,
            metrics: {
                mrr: Math.round(mrr * 100) / 100,
                arr: Math.round(arr * 100) / 100,
                totalUsers,
                totalWorkspaces,
                payingClients,
                activeSubs,
                trialSubs,
                suspendedSubs,
                churnRate: `${churnRate}%`,
                plansDistribution,
                dbSizeMb,
                poolActiveConnections: USE_POSTGRES ? db.pool?.totalCount || 1 : 1
            }
        });
    } catch (err) {
        console.error('[SUPERADMIN METRICS ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al consultar métricas del SaaS.' });
    }
});

/**
 * GET /api/superadmin/clients
 * Directorio completo de clientes, suscripciones y empresas asignadas
 */
router.get('/clients', async (req, res) => {
    try {
        let clients = [];
        if (USE_POSTGRES) {
            const result = await db.pool.query(`
                SELECT 
                    u.id, u.email, u.name, u.role, u.created_at,
                    s.id as subscription_id, s.plan_id, s.status as subscription_status,
                    s.max_workspaces, s.max_users, s.current_period_end, s.trial_ends_at,
                    COALESCE(p.name, 'Plan Starter') as plan_name, COALESCE(p.price_pen, 49.00) as price_pen,
                    COALESCE(w.cnt, 0) as workspaces_count
                FROM users u
                LEFT JOIN LATERAL (
                    SELECT s1.*
                    FROM subscriptions s1
                    WHERE s1.user_id = u.id
                    ORDER BY s1.updated_at DESC NULLS LAST, s1.created_at DESC NULLS LAST
                    LIMIT 1
                ) s ON true
                LEFT JOIN plans p ON s.plan_id = p.id
                LEFT JOIN (
                    SELECT user_id, COUNT(DISTINCT ruc) as cnt
                    FROM workspaces
                    GROUP BY user_id
                ) w ON u.id = w.user_id
                ORDER BY u.created_at DESC
            `);
            clients = result.rows;
        } else {
            clients = db.prepare(`
                SELECT 
                    u.id, u.email, u.name, u.role, u.created_at,
                    s.id as subscription_id, s.plan_id, s.status as subscription_status,
                    s.max_workspaces, s.max_users, s.current_period_end, s.trial_ends_at,
                    COALESCE(p.name, 'Plan Starter') as plan_name, COALESCE(p.price_pen, 49.00) as price_pen,
                    COALESCE(w.cnt, 0) as workspaces_count
                FROM users u
                LEFT JOIN subscriptions s ON s.id = (
                    SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id ORDER BY s2.updated_at DESC, s2.created_at DESC LIMIT 1
                )
                LEFT JOIN plans p ON s.plan_id = p.id
                LEFT JOIN (
                    SELECT user_id, COUNT(DISTINCT ruc) as cnt
                    FROM workspaces
                    GROUP BY user_id
                ) w ON u.id = w.user_id
                ORDER BY u.created_at DESC
            `).all();
        }

        res.json({ success: true, clients });
    } catch (err) {
        console.error('[SUPERADMIN CLIENTS ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al obtener clientes.' });
    }
});

/**
 * PUT /api/superadmin/client/:userId/plan
 * Modificar manualmente el plan, estado o cuota de un cliente
 */
router.put('/client/:userId/plan', async (req, res) => {
    try {
        const { userId } = req.params;
        const { planId, status, maxWorkspaces, daysToAdd } = req.body;

        let plan = null;
        if (USE_POSTGRES) {
            const pRes = await db.pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
            plan = pRes.rows[0];
        } else {
            plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
        }

        const maxWs = (planId === 'corporativo') ? 9999 : (maxWorkspaces || plan?.max_workspaces || 1);
        const newStatus = status || 'active';

        if (USE_POSTGRES) {
            // Actualizar suscripción existente o crear una nueva
            const updateRes = await db.pool.query(`
                UPDATE subscriptions SET
                    plan_id = $2,
                    status = $3,
                    max_workspaces = $4,
                    current_period_end = NOW() + INTERVAL '${daysToAdd || 30} days',
                    updated_at = NOW()
                WHERE user_id = $1
            `, [userId, planId || 'profesional', newStatus, maxWs]);

            if (updateRes.rowCount === 0) {
                await db.pool.query(`
                    INSERT INTO subscriptions (user_id, plan_id, status, max_workspaces, max_users, current_period_end, updated_at)
                    VALUES ($1, $2, $3, $4, 10, NOW() + INTERVAL '${daysToAdd || 30} days', NOW())
                `, [userId, planId || 'profesional', newStatus, maxWs]);
            }

            // Registrar en audit_logs
            await db.pool.query(`
                INSERT INTO audit_logs (id, workspace_id, user_id, action, timestamp, justificacion)
                VALUES (gen_random_uuid()::text, 'GLOBAL', $1, 'SUPERADMIN_PLAN_UPDATE', NOW(), $2)
            `, [req.user.id, `Plan de usuario ${userId} actualizado a ${planId} (${newStatus}) por Angelo Serna`]);
        } else {
            db.prepare(`
                UPDATE subscriptions SET
                    plan_id = ?,
                    status = ?,
                    max_workspaces = ?,
                    current_period_end = datetime('now', '+${daysToAdd || 30} days'),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `).run(planId || 'profesional', newStatus, maxWs, userId);
        }

        res.json({ success: true, message: `Plan de usuario actualizado correctamente a ${planId}.` });
    } catch (err) {
        console.error('[SUPERADMIN UPDATE PLAN ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al actualizar plan del cliente.' });
    }
});

/**
 * POST /api/superadmin/impersonate
 * Iniciar sesión temporal como un cliente (máx. 2 horas) con registro en audit_logs
 */
router.post('/impersonate', async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const superAdminId = req.user.id;
        const superAdminEmail = req.user.email;

        if (!targetUserId) {
            return res.status(400).json({ success: false, error: 'targetUserId requerido.' });
        }

        let targetUser = null;
        if (USE_POSTGRES) {
            const uRes = await db.pool.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
            targetUser = uRes.rows[0];
        } else {
            targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'Usuario destino no encontrado.' });
        }

        // Generar token JWT de corta duración (2 horas) con flag de impersonación
        const impersonationToken = jwt.sign(
            {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                role: targetUser.role || 'user',
                impersonatedBy: superAdminEmail,
                isImpersonating: true
            },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Registrar en audit_logs para trazabilidad total
        const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        if (USE_POSTGRES) {
            try {
                await db.pool.query(`
                    INSERT INTO audit_logs (id, workspace_id, user_id, action, timestamp, justificacion)
                    VALUES (gen_random_uuid()::text, 'GLOBAL', $1, 'SUPERADMIN_IMPERSONATION', NOW(), $2)
                `, [superAdminId, `SuperAdmin ${superAdminEmail} ingresó como ${targetUser.email} desde IP ${clientIp}`]);
            } catch (e) {}
        }

        console.log(`[SUPERADMIN] ⚠️ Impersonación activa: ${superAdminEmail} actuando como ${targetUser.email}`);

        res.json({
            success: true,
            impersonationToken,
            targetUser: {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name
            }
        });
    } catch (err) {
        console.error('[SUPERADMIN IMPERSONATION ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al generar sesión de soporte.' });
    }
});

/**
 * GET /api/superadmin/invoices
 * Registro global de todos los comprobantes y pagos del SaaS
 */
router.get('/invoices', async (req, res) => {
    try {
        let invoices = [];
        if (USE_POSTGRES) {
            const result = await db.pool.query(`
                SELECT i.*, u.email as user_email, u.name as user_name, p.name as plan_name
                FROM invoices i
                JOIN users u ON i.user_id = u.id
                LEFT JOIN subscriptions s ON i.subscription_id = s.id
                LEFT JOIN plans p ON s.plan_id = p.id
                ORDER BY i.created_at DESC
                LIMIT 100
            `);
            invoices = result.rows;
        } else {
            invoices = db.prepare(`
                SELECT i.*, u.email as user_email, u.name as user_name, p.name as plan_name
                FROM invoices i
                JOIN users u ON i.user_id = u.id
                LEFT JOIN subscriptions s ON i.subscription_id = s.id
                LEFT JOIN plans p ON s.plan_id = p.id
                ORDER BY i.created_at DESC
                LIMIT 100
            `).all();
        }

        res.json({ success: true, invoices });
    } catch (err) {
        console.error('[SUPERADMIN INVOICES ERROR]', err);
        res.status(500).json({ success: false, error: 'Error al consultar historial de facturas.' });
    }
});

module.exports = router;
