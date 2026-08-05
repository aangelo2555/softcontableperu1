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
 * Normaliza el parámetro de periodo (ej. '2026-08') a patrones SQL de búsqueda de fechas.
 */
function getPeriodPatterns(period) {
    if (!period || typeof period !== 'string') {
        return { isoPattern: '%', slashPattern: '%', sirePattern: '%', isWildcard: true };
    }
    const cleanPeriod = period.trim();
    if (cleanPeriod.includes('-') && cleanPeriod.length >= 7) {
        const parts = cleanPeriod.split('-');
        const year = parts[0];
        const month = parts[1];
        return {
            isoPattern: `${year}-${month}%`,
            slashPattern: `%/${month}/${year}%`,
            sirePattern: `${year}${month}%`,
            isWildcard: false
        };
    } else if (cleanPeriod.length === 6) {
        const year = cleanPeriod.substring(0, 4);
        const month = cleanPeriod.substring(4, 6);
        return {
            isoPattern: `${year}-${month}%`,
            slashPattern: `%/${month}/${year}%`,
            sirePattern: `${cleanPeriod}%`,
            isWildcard: false
        };
    }
    return { isoPattern: `${cleanPeriod}%`, slashPattern: `%${cleanPeriod}%`, sirePattern: `${cleanPeriod}%`, isWildcard: false };
}

/**
 * Obtiene los datos del workspace/empresa por RUC o ID UUID.
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
            `SELECT * FROM public.employees 
             WHERE (workspace_id = $1 
                OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
                OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
               AND ($2::text IS NULL OR $2::text = '' OR $2::text = 'CLIENTE_SISTEMA' OR user_id = $2)
             ORDER BY id DESC`,
            [workspaceId, userId || null]
        );
        return res.rows || [];
    } else {
        return await dbCore.queryAll(
            `SELECT * FROM employees 
             WHERE (workspace_id = ? 
                OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
                OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
               AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
             ORDER BY id DESC`,
            [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId]
        );
    }
}

/**
 * Obtiene las compras de un período para análisis tributario/riesgo.
 */
async function getPurchases(workspaceId, period, userId) {
    if (!workspaceId) return [];
    const { isoPattern, slashPattern, sirePattern, isWildcard } = getPeriodPatterns(period);

    if (USE_POSTGRES) {
        let queryText = `
            SELECT * FROM public.purchases 
            WHERE (workspace_id = $1 
               OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
               OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
              AND ($5::text IS NULL OR $5::text = '' OR $5::text = 'CLIENTE_SISTEMA' OR user_id = $5)
        `;
        let params = [workspaceId, isoPattern, slashPattern, sirePattern, userId || null];
        if (!isWildcard) {
            queryText += ` AND (fecha LIKE $2 OR fecha LIKE $3 OR fecha LIKE $4 OR estado_sire LIKE $2)`;
        }
        queryText += ` ORDER BY fecha ASC`;

        const res = await dbCore.pool.query(queryText, params);
        let rows = res.rows || [];

        // Fallback: Si no hay registros para el periodo específico, retornar todos los registros de la empresa
        if (rows.length === 0 && !isWildcard) {
            const fallbackRes = await dbCore.pool.query(
                `SELECT * FROM public.purchases 
                 WHERE (workspace_id = $1 
                    OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
                    OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
                   AND ($2::text IS NULL OR $2::text = '' OR $2::text = 'CLIENTE_SISTEMA' OR user_id = $2)
                 ORDER BY fecha ASC`,
                [workspaceId, userId || null]
            );
            rows = fallbackRes.rows || [];
        }
        return rows;
    } else {
        let queryText = `
            SELECT * FROM purchases 
            WHERE (workspace_id = ? 
               OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
               OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
              AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
        `;
        let params = [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId];
        if (!isWildcard) {
            queryText += ` AND (fecha LIKE ? OR fecha LIKE ? OR fecha LIKE ? OR estado_sire LIKE ?)`;
            params.push(isoPattern, slashPattern, sirePattern, isoPattern);
        }
        queryText += ` ORDER BY fecha ASC`;

        let rows = await dbCore.queryAll(queryText, params);
        if (rows.length === 0 && !isWildcard) {
            rows = await dbCore.queryAll(
                `SELECT * FROM purchases 
                 WHERE (workspace_id = ? 
                    OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
                    OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
                   AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
                 ORDER BY fecha ASC`,
                [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId]
            );
        }
        return rows;
    }
}

/**
 * Obtiene las ventas de un período para análisis tributario/riesgo.
 */
async function getSales(workspaceId, period, userId) {
    if (!workspaceId) return [];
    const { isoPattern, slashPattern, sirePattern, isWildcard } = getPeriodPatterns(period);

    if (USE_POSTGRES) {
        let queryText = `
            SELECT * FROM public.sales 
            WHERE (workspace_id = $1 
               OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
               OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
              AND ($5::text IS NULL OR $5::text = '' OR $5::text = 'CLIENTE_SISTEMA' OR user_id = $5)
        `;
        let params = [workspaceId, isoPattern, slashPattern, sirePattern, userId || null];
        if (!isWildcard) {
            queryText += ` AND (fecha LIKE $2 OR fecha LIKE $3 OR fecha LIKE $4 OR estado_sire LIKE $2)`;
        }
        queryText += ` ORDER BY fecha ASC`;

        const res = await dbCore.pool.query(queryText, params);
        let rows = res.rows || [];
        if (rows.length === 0 && !isWildcard) {
            const fallbackRes = await dbCore.pool.query(
                `SELECT * FROM public.sales 
                 WHERE (workspace_id = $1 
                    OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
                    OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
                   AND ($2::text IS NULL OR $2::text = '' OR $2::text = 'CLIENTE_SISTEMA' OR user_id = $2)
                 ORDER BY fecha ASC`,
                [workspaceId, userId || null]
            );
            rows = fallbackRes.rows || [];
        }
        return rows;
    } else {
        let queryText = `
            SELECT * FROM sales 
            WHERE (workspace_id = ? 
               OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
               OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
              AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
        `;
        let params = [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId];
        if (!isWildcard) {
            queryText += ` AND (fecha LIKE ? OR fecha LIKE ? OR fecha LIKE ? OR estado_sire LIKE ?)`;
            params.push(isoPattern, slashPattern, sirePattern, isoPattern);
        }
        queryText += ` ORDER BY fecha ASC`;

        let rows = await dbCore.queryAll(queryText, params);
        if (rows.length === 0 && !isWildcard) {
            rows = await dbCore.queryAll(
                `SELECT * FROM sales 
                 WHERE (workspace_id = ? 
                    OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
                    OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
                   AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
                 ORDER BY fecha ASC`,
                [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId]
            );
        }
        return rows;
    }
}

/**
 * Obtiene los asientos de diario de un período.
 */
async function getJournalEntries(workspaceId, period, userId) {
    if (!workspaceId) return [];
    const { isoPattern, slashPattern, sirePattern, isWildcard } = getPeriodPatterns(period);

    if (USE_POSTGRES) {
        let queryText = `
            SELECT * FROM public.journal 
            WHERE (workspace_id = $1 
               OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
               OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
              AND ($5::text IS NULL OR $5::text = '' OR $5::text = 'CLIENTE_SISTEMA' OR user_id = $5)
        `;
        let params = [workspaceId, isoPattern, slashPattern, sirePattern, userId || null];
        if (!isWildcard) {
            queryText += ` AND (fecha LIKE $2 OR fecha LIKE $3 OR fecha LIKE $4)`;
        }
        queryText += ` ORDER BY fecha ASC, asiento ASC`;

        const res = await dbCore.pool.query(queryText, params);
        let rows = res.rows || [];
        if (rows.length === 0 && !isWildcard) {
            const fallbackRes = await dbCore.pool.query(
                `SELECT * FROM public.journal 
                 WHERE (workspace_id = $1 
                    OR workspace_id = (SELECT ruc FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)
                    OR workspace_id = (SELECT id FROM public.workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
                   AND ($2::text IS NULL OR $2::text = '' OR $2::text = 'CLIENTE_SISTEMA' OR user_id = $2)
                 ORDER BY fecha ASC, asiento ASC`,
                [workspaceId, userId || null]
            );
            rows = fallbackRes.rows || [];
        }
        return rows;
    } else {
        let queryText = `
            SELECT * FROM journal 
            WHERE (workspace_id = ? 
               OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
               OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
              AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
        `;
        let params = [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId];
        if (!isWildcard) {
            queryText += ` AND (fecha LIKE ? OR fecha LIKE ? OR fecha LIKE ?)`;
            params.push(isoPattern, slashPattern, sirePattern);
        }
        queryText += ` ORDER BY fecha ASC, asiento ASC`;

        let rows = await dbCore.queryAll(queryText, params);
        if (rows.length === 0 && !isWildcard) {
            rows = await dbCore.queryAll(
                `SELECT * FROM journal 
                 WHERE (workspace_id = ? 
                    OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)
                    OR workspace_id = (SELECT id FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
                   AND (? IS NULL OR ? = '' OR ? = 'CLIENTE_SISTEMA' OR user_id = ?)
                 ORDER BY fecha ASC, asiento ASC`,
                [workspaceId, workspaceId, workspaceId, workspaceId, workspaceId, userId, userId, userId, userId]
            );
        }
        return rows;
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
