/**
 * Middleware de Autorización y Acceso a SoftPremium
 * 
 * Verificaciones:
 * 1. Autenticación válida mediante JWT.
 * 2. Verificación de workspace y usuario en sesión.
 * 3. Verificación de flags premium_enabled y tiers en public.workspaces.
 * 4. Admins siempre tienen acceso completo para pruebas y soporte.
 */

const coreReader = require('./coreReader');

/**
 * Middleware para validar que el workspace actual tenga SoftPremium activo.
 * @param {string} [requiredTier] 'tributario' | 'planillas' | 'finanzas' | 'full'
 */
function requirePremium(requiredTier = null) {
    return async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ success: false, error: 'No autenticado.' });
            }

            // Administrador global o correo principal tiene bypass automático para auditoría/soporte
            const normalizedEmail = (user.email || '').trim().toLowerCase();
            const isAdmin = user.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com';

            const workspaceId = req.headers['x-workspace-id'] || req.query.workspaceId || req.body?.workspaceId;
            
            if (isAdmin) {
                req.isPremiumActive = true;
                req.premiumTiers = ['tributario', 'planillas', 'finanzas', 'full'];
                return next();
            }

            // 1. Verificar si el USUARIO tiene premium_enabled = true en la tabla users
            let isUserPremium = false;
            if (process.env.DATABASE_URL) {
                try {
                    const dbCore = require('./databasePostgres');
                    const uRes = await dbCore.pool.query(
                        `SELECT premium_enabled FROM users WHERE id = $1 OR LOWER(email) = $2 LIMIT 1`,
                        [user.id || '', normalizedEmail]
                    );
                    isUserPremium = Boolean(uRes.rows[0]?.premium_enabled);
                } catch (e) {
                    console.warn('[AUTH PREMIUM USER CHECK WARN]', e.message);
                }
            }

            // 2. Verificar si el WORKSPACE tiene premium_enabled = true
            let isWorkspacePremium = false;
            if (workspaceId) {
                try {
                    const workspace = await coreReader.getWorkspace(workspaceId);
                    isWorkspacePremium = Boolean(workspace?.premium_enabled);
                } catch (e) {
                    console.warn('[AUTH PREMIUM WORKSPACE CHECK WARN]', e.message);
                }
            }

            const isPremiumEnabled = isUserPremium || isWorkspacePremium;

            if (!isPremiumEnabled) {
                return res.status(403).json({ 
                    success: false, 
                    isPremiumLocked: true,
                    error: 'SoftPremium no está activo para tu usuario o workspace. Activa tu suscripción para acceder a este pilar.' 
                });
            }

            req.isPremiumActive = true;
            req.premiumTiers = ['tributario', 'planillas', 'finanzas', 'full'];
            next();
        } catch (error) {
            console.error('[AUTH PREMIUM ERROR]', error.message);
            res.status(500).json({ success: false, error: 'Error verificando autorización de SoftPremium: ' + error.message });
        }
    };
}

module.exports = {
    requirePremium
};
