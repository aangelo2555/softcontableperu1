/**
 * aiQuotaMiddleware.js - Control de Cuotas de IA y Rate Limiting por Plan SaaS
 */

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');

// Políticas Oficiales de IA por Plan SaaS
const AI_PLAN_POLICIES = {
    estudiante: {
        planName: 'Estudiante / Free',
        dailyLimit: 25,
        rpmLimit: 3,
        tier: 'BASIC',
        priority: 1
    },
    starter: {
        planName: 'Starter / Básico',
        dailyLimit: 75,
        rpmLimit: 6,
        tier: 'STANDARD',
        priority: 2
    },
    profesional: {
        planName: 'Profesional',
        dailyLimit: 250,
        rpmLimit: 15,
        tier: 'PRO',
        priority: 3
    },
    estudio: {
        planName: 'Estudio Contable',
        dailyLimit: 1000,
        rpmLimit: 30,
        tier: 'VIP',
        priority: 4
    },
    corporativo: {
        planName: 'Corporativo / SoftPremium',
        dailyLimit: 2500,
        rpmLimit: 60,
        tier: 'ULTRA_VIP',
        priority: 5
    },
    super_admin: {
        planName: 'Master SaaS Propietario',
        dailyLimit: 99999,
        rpmLimit: 120,
        tier: 'MASTER',
        priority: 6
    }
};

// Historial en memoria de timestamps por usuario para Rate Limiting (RPM)
const userRequestTimestamps = new Map();

/**
 * Obtiene el plan activo del usuario desde la BD
 */
async function getUserPlan(userId, userEmail, userRole) {
    // 1. Super Administrador / Dueño
    const normalizedEmail = (userEmail || '').trim().toLowerCase();
    if (userRole === 'super_admin' || normalizedEmail === 'aangelo2555@gmail.com') {
        return 'super_admin';
    }

    if (!userId || userId === 'CLIENTE_SISTEMA') {
        return 'estudiante';
    }

    try {
        if (USE_POSTGRES) {
            const res = await db.query(
                `SELECT plan_id, status FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
                [userId]
            );
            if (res.rows.length > 0 && res.rows[0].plan_id) {
                return res.rows[0].plan_id;
            }
        } else {
            const row = db.prepare(`SELECT plan_id, status FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`).get(userId);
            if (row && row.plan_id) {
                return row.plan_id;
            }
        }
    } catch (e) {
        console.warn('[AI QUOTA] Error obteniendo suscripción de usuario:', e.message);
    }

    return 'estudiante';
}

/**
 * Middleware para validar cuota diaria y ritmo por minuto
 */
async function validateAiQuota(req, res, next) {
    const userId = req.user?.id || req.body.userId || 'CLIENTE_SISTEMA';
    const userEmail = req.user?.email || '';
    const userRole = req.user?.role || '';

    const planId = await getUserPlan(userId, userEmail, userRole);
    const policy = AI_PLAN_POLICIES[planId] || AI_PLAN_POLICIES.estudiante;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 1. Validar Rate Limit por Minuto (RPM)
    let timestamps = userRequestTimestamps.get(userId) || [];
    timestamps = timestamps.filter(t => t > oneMinuteAgo);

    if (timestamps.length >= policy.rpmLimit && planId !== 'super_admin') {
        return res.status(429).json({
            success: false,
            error: `Has alcanzado el límite de ritmo de tu plan (${policy.rpmLimit} consultas/minuto). Por favor espera unos segundos o mejora tu plan.`,
            quotaExceeded: true,
            type: 'RATE_LIMIT_PER_MINUTE',
            plan: policy.planName,
            rpmLimit: policy.rpmLimit
        });
    }

    // Registrar nuevo timestamp
    timestamps.push(now);
    userRequestTimestamps.set(userId, timestamps);

    // 2. Validar Cuota Diaria (RPD)
    try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const usage = await db.getAiDailyUsage(userId, todayStr);
        const requestsCount = usage?.requests_count || 0;

        if (requestsCount >= policy.dailyLimit && planId !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: `Has completado tu cuota diaria de IA (${policy.dailyLimit} consultas/día para el ${policy.planName}). Se renovará automáticamente a medianoche o puedes ascender a un plan superior.`,
                quotaExceeded: true,
                type: 'DAILY_QUOTA_EXCEEDED',
                plan: policy.planName,
                dailyLimit: policy.dailyLimit,
                dailyUsed: requestsCount
            });
        }

        // Adjuntar información de cuota a la petición
        req.aiQuotaInfo = {
            userId,
            planId,
            policy,
            dailyUsed: requestsCount,
            dailyLimit: policy.dailyLimit,
            remaining: Math.max(0, policy.dailyLimit - requestsCount)
        };

        next();
    } catch (err) {
        console.error('[AI QUOTA MIDDLEWARE ERROR]', err);
        // Permitir continuar en caso de error inesperado en conteo
        next();
    }
}

module.exports = {
    validateAiQuota,
    getUserPlan,
    AI_PLAN_POLICIES
};
