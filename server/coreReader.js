/**
 * Capa de Lectura Segura del Schema Core (public) para SoftPremium
 * 
 * Cumple con el Principio de Acoplamiento de la Arquitectura:
 * Premium LEE del schema public exclusivamente a través de estas funciones de servicio.
 * NUNCA ejecuta consultas SQL ad-hoc dispersas sobre las tablas del core.
 */

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbCore = USE_POSTGRES ? require('./databasePostgres') : require('./databaseServer');

/**
 * Obtiene los datos del workspace/empresa.
 */
async function getWorkspace(workspaceId) {
    if (!workspaceId) return null;
    return await dbCore.getWorkspaceById(workspaceId);
}

/**
 * Obtiene el directorio de empleados de un workspace con sus atributos laborales.
 */
async function getEmployees(workspaceId, userId) {
    if (!workspaceId) return [];
    if (USE_POSTGRES) {
        const res = await dbCore.pool.query(
            `SELECT * FROM public.employees WHERE workspace_id = $1 AND (user_id = $2 OR $2 IS NULL) ORDER BY apellidos, nombres`,
            [workspaceId, userId]
        );
        return res.rows || [];
    } else {
        return await dbCore.queryAll(
            `SELECT * FROM employees WHERE workspace_id = ? AND (user_id = ? OR ? IS NULL) ORDER BY apellidos, nombres`,
            [workspaceId, userId, userId]
        );
    }
}

/**
 * Obtiene las compras de un período para análisis tributario/riesgo.
 */
async function getPurchases(workspaceId, period, userId) {
    if (!workspaceId) return [];
    const periodPattern = period ? `${period}%` : '%';
    if (USE_POSTGRES) {
        const res = await dbCore.pool.query(
            `SELECT * FROM public.purchases WHERE workspace_id = $1 AND fecha LIKE $2 AND (user_id = $3 OR $3 IS NULL) ORDER BY fecha ASC`,
            [workspaceId, periodPattern, userId]
        );
        return res.rows || [];
    } else {
        return await dbCore.queryAll(
            `SELECT * FROM purchases WHERE workspace_id = ? AND fecha LIKE ? AND (user_id = ? OR ? IS NULL) ORDER BY fecha ASC`,
            [workspaceId, periodPattern, userId, userId]
        );
    }
}

/**
 * Obtiene las ventas de un período para análisis tributario/riesgo.
 */
async function getSales(workspaceId, period, userId) {
    if (!workspaceId) return [];
    const periodPattern = period ? `${period}%` : '%';
    if (USE_POSTGRES) {
        const res = await dbCore.pool.query(
            `SELECT * FROM public.sales WHERE workspace_id = $1 AND fecha LIKE $2 AND (user_id = $3 OR $3 IS NULL) ORDER BY fecha ASC`,
            [workspaceId, periodPattern, userId]
        );
        return res.rows || [];
    } else {
        return await dbCore.queryAll(
            `SELECT * FROM sales WHERE workspace_id = ? AND fecha LIKE ? AND (user_id = ? OR ? IS NULL) ORDER BY fecha ASC`,
            [workspaceId, periodPattern, userId, userId]
        );
    }
}

/**
 * Obtiene los asientos de diario de un período.
 */
async function getJournalEntries(workspaceId, period, userId) {
    if (!workspaceId) return [];
    const periodPattern = period ? `${period}%` : '%';
    if (USE_POSTGRES) {
        const res = await dbCore.pool.query(
            `SELECT * FROM public.journal WHERE workspace_id = $1 AND fecha LIKE $2 AND (user_id = $3 OR $3 IS NULL) ORDER BY fecha ASC, asiento ASC`,
            [workspaceId, periodPattern, userId]
        );
        return res.rows || [];
    } else {
        return await dbCore.queryAll(
            `SELECT * FROM journal WHERE workspace_id = ? AND fecha LIKE ? AND (user_id = ? OR ? IS NULL) ORDER BY fecha ASC, asiento ASC`,
            [workspaceId, periodPattern, userId, userId]
        );
    }
}

/**
 * Obtiene el plan contable del usuario.
 */
async function getPlanContable(userId) {
    if (USE_POSTGRES) {
        const res = await dbCore.pool.query(
            `SELECT * FROM public.plan_global WHERE user_id = $1 ORDER BY cta ASC`,
            [userId]
        );
        return res.rows || [];
    } else {
        return await dbCore.queryAll(
            `SELECT * FROM plan_global WHERE user_id = ? ORDER BY cta ASC`,
            [userId]
        );
    }
}

module.exports = {
    getWorkspace,
    getEmployees,
    getPurchases,
    getSales,
    getJournalEntries,
    getPlanContable
};
