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

            if (!workspaceId) {
                return res.status(400).json({ success: false, error: 'Falta cabecera X-Workspace-Id requerida.' });
            }

            const workspace = await coreReader.getWorkspace(workspaceId);
            if (!workspace) {
                return res.status(404).json({ success: false, error: 'Workspace no encontrado.' });
            }

            const isPremiumEnabled = Boolean(workspace.premium_enabled);
            const tiers = Array.isArray(workspace.premium_tiers) ? workspace.premium_tiers : [];

            if (!isPremiumEnabled && !tiers.includes('full')) {
                return res.status(403).json({ 
                    success: false, 
                    isPremiumLocked: true,
                    error: 'SoftPremium no está activo para este workspace. Activa tu suscripción para acceder a esta función.' 
                });
            }

            if (requiredTier && requiredTier !== 'full') {
                const hasTier = tiers.includes(requiredTier) || tiers.includes('full');
                if (!hasTier) {
                    return res.status(403).json({ 
                        success: false, 
                        isPremiumLocked: true,
                        error: `El módulo SoftPremium ${requiredTier.toUpperCase()} no está incluido en tu suscripción actual.` 
                    });
                }
            }

            req.isPremiumActive = true;
            req.premiumTiers = tiers;
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
