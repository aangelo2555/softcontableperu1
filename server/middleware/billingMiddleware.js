/**
 * Billing & Subscription Middlewares
 * Control de cuotas de workspaces y verificación de estado de suscripción SaaS
 */

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');

/**
 * Middleware: checkWorkspaceLimit
 * Valida que el usuario no exceda el número de empresas (workspaces) permitidas según su plan contratado.
 */
async function checkWorkspaceLimit(req, res, next) {
    try {
        const userId = req.user?.id;
        const userEmail = (req.user?.email || '').trim().toLowerCase();
        
        if (!userId) {
            return res.status(401).json({ error: 'No autenticado.', code: 'UNAUTHORIZED' });
        }

        // Si es el SuperAdmin (Angelo), permitir creación ilimitada de workspaces para pruebas y auditoría
        const isSuperAdmin = req.user?.role === 'super_admin' || userEmail === 'aangelo2555@gmail.com';
        if (isSuperAdmin) {
            return next();
        }

        // Si se pasa un RUC y ya existe para este usuario, es una edición (permitir sin validar límite de cuota)
        const targetRuc = req.body?.ruc || req.params?.ruc;
        if (targetRuc) {
            let alreadyExists = false;
            if (USE_POSTGRES) {
                const ex = await db.pool.query('SELECT 1 FROM workspaces WHERE ruc = $1 AND user_id = $2', [targetRuc, userId]);
                alreadyExists = ex.rows.length > 0;
            } else {
                const ex = db.prepare('SELECT 1 FROM workspaces WHERE ruc = ? AND user_id = ?').get(targetRuc, userId);
                alreadyExists = Boolean(ex);
            }
            if (alreadyExists) {
                return next();
            }
        }

        // 1. Obtener la suscripción activa más reciente del usuario
        let subscription = null;
        if (USE_POSTGRES) {
            try {
                const subRes = await db.pool.query(
                    `SELECT s.*, p.name as plan_name, p.max_workspaces as plan_max_workspaces
                     FROM subscriptions s
                     LEFT JOIN plans p ON s.plan_id = p.id
                     WHERE s.user_id = $1
                     ORDER BY s.created_at DESC LIMIT 1`,
                    [userId]
                );
                subscription = subRes.rows[0];
            } catch (e) {
                console.warn('[BILLING MIDDLEWARE PG ERROR]', e.message);
            }
        } else {
            try {
                subscription = db.prepare(`
                    SELECT s.*, p.name as plan_name, p.max_workspaces as plan_max_workspaces
                    FROM subscriptions s
                    LEFT JOIN plans p ON s.plan_id = p.id
                    WHERE s.user_id = ?
                    ORDER BY s.created_at DESC LIMIT 1
                `).get(userId);
            } catch (e) {
                console.warn('[BILLING MIDDLEWARE SQLITE ERROR]', e.message);
            }
        }

        // Si no tiene suscripción creada aún, asignar plan estudiante automáticamente (1 workspace)
        if (!subscription) {
            const defaultMax = 1;
            const currentCount = await getWorkspaceCount(userId);
            if (currentCount >= defaultMax) {
                return res.status(403).json({
                    error: `Límite de empresas alcanzado (${currentCount}/${defaultMax}) en plan Estudiante. Actualice a un plan superior para crear más empresas.`,
                    code: 'WORKSPACE_LIMIT_REACHED',
                    current: currentCount,
                    max: defaultMax
                });
            }
            return next();
        }

        // Verificar estado de la suscripción
        if (subscription.status === 'suspended' || subscription.status === 'cancelled') {
            return res.status(403).json({
                error: 'Su suscripción se encuentra suspendida o cancelada. Regularice su pago para crear nuevas empresas.',
                code: 'NO_ACTIVE_SUBSCRIPTION',
                status: subscription.status
            });
        }

        // Plan Corporativo e Ilimitado (50+ empresas): Sin restricción de límite
        if (subscription.plan_id === 'corporativo' || (subscription.max_workspaces && subscription.max_workspaces >= 50)) {
            return next();
        }

        const maxAllowed = subscription.max_workspaces || subscription.plan_max_workspaces || 1;
        const currentCount = await getWorkspaceCount(userId);

        if (currentCount >= maxAllowed) {
            return res.status(403).json({
                error: `Límite de empresas alcanzado (${currentCount}/${maxAllowed}) para su plan ${subscription.plan_name || subscription.plan_id}. Actualice su plan para gestionar más empresas.`,
                code: 'WORKSPACE_LIMIT_REACHED',
                current: currentCount,
                max: maxAllowed,
                plan: subscription.plan_id
            });
        }

        next();
    } catch (err) {
        console.error('[CHECK WORKSPACE LIMIT ERROR]', err);
        next(err);
    }
}

/**
 * Helper: Contar empresas del usuario
 */
async function getWorkspaceCount(userId) {
    if (USE_POSTGRES) {
        const res = await db.pool.query(
            'SELECT COUNT(*) as total FROM workspaces WHERE user_id = $1',
            [userId]
        );
        return parseInt(res.rows[0]?.total || 0, 10);
    } else {
        const row = db.prepare('SELECT COUNT(*) as total FROM workspaces WHERE user_id = ?').get(userId);
        return parseInt(row?.total || 0, 10);
    }
}

/**
 * Middleware: requireActiveSubscription
 * Bloquea operaciones de escritura si la suscripción está suspendida
 */
async function requireActiveSubscription(req, res, next) {
    try {
        const userId = req.user?.id;
        const userEmail = (req.user?.email || '').trim().toLowerCase();
        if (!userId) return res.status(401).json({ error: 'No autenticado.' });

        if (req.user?.role === 'super_admin' || userEmail === 'aangelo2555@gmail.com') {
            return next();
        }

        let subscription = null;
        if (USE_POSTGRES) {
            const res = await db.pool.query(
                'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
                [userId]
            );
            subscription = res.rows[0];
        } else {
            subscription = db.prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
        }

        if (subscription && (subscription.status === 'suspended' || subscription.status === 'cancelled')) {
            return res.status(403).json({
                error: 'Suscripción inactiva o suspendida. Su cuenta está en modo solo lectura.',
                code: 'SUBSCRIPTION_SUSPENDED',
                readOnly: true
            });
        }

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = {
    checkWorkspaceLimit,
    requireActiveSubscription,
    getWorkspaceCount
};
