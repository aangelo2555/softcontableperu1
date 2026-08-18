const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbManager = USE_POSTGRES ? require('./databasePostgres') : require('./databaseServer');

const rateLimit = require('express-rate-limit');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL: La variable de entorno JWT_SECRET es obligatoria en producción por motivos de seguridad.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'softcontable-super-secret-key-2026';

const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 20, // Límite por IP por minuto
    message: { success: false, error: 'Demasiados intentos de acceso desde esta IP, por favor intente de nuevo en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
});

/**
 * Helper: Generar y guardar Refresh Token rotativo en BD (30 días de vigencia)
 */
async function generateAndStoreRefreshToken(userId) {
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const tokenId = uuidv4();

    try {
        if (USE_POSTGRES) {
            await dbManager.pool.query(
                `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked)
                 VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', false)`,
                [tokenId, userId, tokenHash]
            );
        } else {
            dbManager.prepare(
                `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked)
                 VALUES (?, ?, ?, datetime('now', '+30 days'), 0)`
            ).run(tokenId, userId, tokenHash);
        }
    } catch (err) {
        console.warn('[AUTH] Error guardando refresh token en BD:', err.message);
    }

    return rawRefreshToken;
}

// --- REGISTRO ---
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, name } = req.body;
        console.log(`[AUTH] Intento de registro: ${email}`);

        // Verificar si ya existe
        const existingUser = await dbManager.getUserByEmail(email);
        if (existingUser) {
            console.warn(`[AUTH] El correo ${email} ya existe.`);
            return res.status(400).json({ success: false, error: 'El correo ya está registrado' });
        }

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const usersList = await dbManager.queryAll('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(usersList[0]?.count || 0);
        const normalizedEmail = email.trim().toLowerCase();
        const role = (userCount === 0 || normalizedEmail === 'aangelo2555@gmail.com') ? 'super_admin' : 'user';

        const userId = uuidv4();
        const newUser = {
            id: userId,
            email,
            password: hashedPassword,
            name: name || 'Usuario',
            role
        };

        await dbManager.createUser(newUser);

        // Crear suscripción inicial de prueba (Trial 14 días con 3 workspaces) o Corporativo para Owner
        try {
            const subId = uuidv4();
            const isOwner = normalizedEmail === 'aangelo2555@gmail.com';
            const initialPlanId = isOwner ? 'corporativo' : 'starter';
            const initialStatus = isOwner ? 'active' : 'trial';
            const initialMaxWs = isOwner ? 9999 : 3;
            const initialMaxUsers = isOwner ? 9999 : 2;

            if (USE_POSTGRES) {
                await dbManager.pool.query(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, trial_ends_at, current_period_end)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '14 days', ${isOwner ? "'2099-12-31'" : "NOW() + INTERVAL '14 days'"})
                     ON CONFLICT DO NOTHING`,
                    [subId, userId, initialPlanId, initialStatus, initialMaxWs, initialMaxUsers]
                );
            } else {
                dbManager.prepare(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, trial_ends_at, current_period_end)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+14 days'), ${isOwner ? "'2099-12-31'" : "datetime('now', '+14 days')"})`
                ).run(subId, userId, initialPlanId, initialStatus, initialMaxWs, initialMaxUsers);
            }
        } catch (subErr) {
            console.warn('[AUTH] Warning creando suscripción trial:', subErr.message);
        }

        const accessToken = jwt.sign(
            { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = await generateAndStoreRefreshToken(newUser.id);

        res.json({
            success: true,
            message: '¡Usuario registrado exitosamente con 14 días de prueba gratuita!',
            accessToken,
            refreshToken,
            token: accessToken,
            user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- REGISTRO ESTUDIANTE ---
router.post('/register-student', authLimiter, async (req, res) => {
    try {
        const { email, password, name } = req.body;
        console.log(`[AUTH] Registro de estudiante: ${email}`);

        const existingUser = await dbManager.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'El correo ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userId = uuidv4();
        const newUser = {
            id: userId,
            email,
            password: hashedPassword,
            name: name || 'Estudiante',
            role: 'estudiante'
        };

        await dbManager.createUser(newUser);

        // Crear suscripción permanente gratuita de Estudiante
        try {
            const subId = uuidv4();
            if (USE_POSTGRES) {
                await dbManager.pool.query(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, current_period_end)
                     VALUES ($1, $2, 'estudiante', 'active', 1, 1, NOW() + INTERVAL '10 years')
                     ON CONFLICT DO NOTHING`,
                    [subId, userId]
                );
            } else {
                dbManager.prepare(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, current_period_end)
                     VALUES (?, ?, 'estudiante', 'active', 1, 1, datetime('now', '+10 years'))`
                ).run(subId, userId);
            }
        } catch (e) {}

        const accessToken = jwt.sign(
            { id: newUser.id, email: newUser.email, name: newUser.name, role: 'estudiante' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = await generateAndStoreRefreshToken(newUser.id);

        res.json({
            success: true,
            accessToken,
            refreshToken,
            token: accessToken,
            user: { id: newUser.id, email: newUser.email, name: newUser.name, role: 'estudiante' }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- LOGIN ---
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password, mode } = req.body;
        console.log(`[AUTH] Intento de login: ${email} (Modo: ${mode || 'profesional'})`);

        const user = await dbManager.getUserByEmail(email);
        if (!user) {
            console.warn(`[AUTH] Usuario no encontrado: ${email}`);
            return res.status(400).json({ success: false, error: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.warn(`[AUTH] Contraseña incorrecta para: ${email}`);
            return res.status(400).json({ success: false, error: 'Contraseña incorrecta' });
        }

        const normalizedEmail = user.email.trim().toLowerCase();
        let role = user.role || 'user';
        if (normalizedEmail === 'aangelo2555@gmail.com') {
            role = 'super_admin';
        } else if (role === 'admin') {
            role = 'user';
        }

        // VALIDACIÓN DE COHERENCIA ENTRE MODO SOLICITADO Y ROL DE LA CUENTA
        if (mode === 'profesional' && role === 'estudiante') {
            console.warn(`[AUTH] Intento de ingresar a cuenta de Estudiante desde Modo Profesional: ${email}`);
            return res.status(400).json({
                success: false,
                error: '🎓 Esta cuenta está registrada en Modo Estudiante. Activa la opción "Acceso Estudiante" en la pantalla de inicio para ingresar.'
            });
        }

        if (mode === 'estudiante' && role !== 'estudiante') {
            console.warn(`[AUTH] Intento de ingresar a cuenta Profesional desde Modo Estudiante: ${email}`);
            return res.status(400).json({
                success: false,
                error: '💼 Esta cuenta es de Modo Profesional. Vuelve al modo "Profesional" para iniciar sesión.'
            });
        }

        // Generar Access Token de 15 minutos + Refresh Token de 30 días
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = await generateAndStoreRefreshToken(user.id);

        res.json({
            success: true,
            accessToken,
            refreshToken,
            token: accessToken, // Retrocompatibilidad
            user: { id: user.id, email: user.email, name: user.name, role }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RENOVACIÓN SILENCIOSA DE TOKEN (REFRESH TOKEN) ---
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ success: false, error: 'Refresh token no proporcionado.', code: 'NO_REFRESH_TOKEN' });
        }

        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        let record = null;
        if (USE_POSTGRES) {
            const result = await dbManager.pool.query(
                `SELECT r.*, u.email, u.name, u.role
                 FROM refresh_tokens r
                 JOIN users u ON r.user_id = u.id
                 WHERE r.token_hash = $1 AND r.revoked = false AND r.expires_at > NOW()`,
                [tokenHash]
            );
            record = result.rows[0];
        } else {
            record = dbManager.prepare(
                `SELECT r.*, u.email, u.name, u.role
                 FROM refresh_tokens r
                 JOIN users u ON r.user_id = u.id
                 WHERE r.token_hash = ? AND r.revoked = 0 AND r.expires_at > datetime('now')`
            ).get(tokenHash);
        }

        if (!record) {
            return res.status(401).json({ success: false, error: 'Refresh token inválido, revocado o expirado.', code: 'INVALID_REFRESH_TOKEN' });
        }

        // Rotación de token: Revocar el token utilizado
        if (USE_POSTGRES) {
            await dbManager.pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);
        } else {
            dbManager.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(record.id);
        }

        const normalizedEmail = (record.email || '').trim().toLowerCase();
        let role = record.role || 'user';
        if (normalizedEmail === 'aangelo2555@gmail.com') {
            role = 'super_admin';
        }

        // Generar nuevo Access Token y nuevo Refresh Token
        const newAccessToken = jwt.sign(
            { id: record.user_id, email: record.email, name: record.name, role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const newRefreshToken = await generateAndStoreRefreshToken(record.user_id);

        res.json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            token: newAccessToken
        });
    } catch (error) {
        console.error('[REFRESH TOKEN ERROR]', error);
        res.status(500).json({ success: false, error: 'Error al renovar sesión.' });
    }
});

// --- LOGOUT / REVOCACIÓN DE SESIÓN ---
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            if (USE_POSTGRES) {
                await dbManager.pool.query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [tokenHash]);
            } else {
                dbManager.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
            }
        }
        res.json({ success: true, message: 'Sesión cerrada correctamente.' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error en logout.' });
    }
});

const { sendResetOtpEmail } = require('./services/emailService');

// Almacenamiento en memoria para códigos OTP de recuperación (expiran en 15 min)
const otpStore = new Map();

// Limpiador automático de OTPs expirados cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [email, record] of otpStore.entries()) {
        if (now > record.expiresAt) {
            otpStore.delete(email);
        }
    }
}, 5 * 60 * 1000);

// --- RECUPERACIÓN DE CONTRASEÑA (PASO 1: Solicitud de Código OTP por Gmail) ---
router.post('/forgot-password/request-otp', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        console.log(`[AUTH OTP] Solicitud de código OTP para: ${email}`);

        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Debe proporcionar un correo electrónico válido.' });
        }

        const user = await dbManager.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'No existe ninguna cuenta registrada con este correo electrónico.' });
        }

        // Generar código OTP aleatorio de 6 dígitos
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

        otpStore.set(email.toLowerCase(), {
            code: otpCode,
            expiresAt,
            verified: false
        });

        // Enviar correo a través de emailService (Nodemailer / Gmail)
        const emailResult = await sendResetOtpEmail({
            toEmail: email,
            otpCode,
            userName: user.name
        });

        res.json({
            success: true,
            message: emailResult.simulated
                ? `Código OTP generado para ${email}.`
                : `Código de verificación enviado a ${email}. Revisa tu bandeja de entrada o spam.`,
            simulated: emailResult.simulated || false,
            devCode: (emailResult.simulated || process.env.NODE_ENV !== 'production') ? otpCode : undefined
        });
    } catch (error) {
        console.error('[AUTH OTP ERROR] Error al solicitar OTP:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RECUPERACIÓN DE CONTRASEÑA (PASO 2: Verificación de Código OTP) ---
router.post('/forgot-password/verify-otp', authLimiter, async (req, res) => {
    try {
        const { email, code } = req.body;
        console.log(`[AUTH OTP] Verificación de código OTP para: ${email}`);

        if (!email || !code) {
            return res.status(400).json({ success: false, error: 'Debe ingresar el correo y el código de 6 dígitos.' });
        }

        const record = otpStore.get(email.toLowerCase());
        if (!record) {
            return res.status(400).json({ success: false, error: 'No hay ninguna solicitud de código activa para este correo. Solicita uno nuevo.' });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({ success: false, error: 'El código de verificación ha expirado. Por favor solicita uno nuevo.' });
        }

        if (record.code !== code.toString().trim()) {
            return res.status(400).json({ success: false, error: 'Código de verificación incorrecto. Revisa tu correo e inténtalo de nuevo.' });
        }

        record.verified = true;
        record.verifiedAt = Date.now();

        // Crear token JWT temporal de restablecimiento (15 min)
        const resetToken = jwt.sign(
            { email: email.toLowerCase(), purpose: 'pwd_reset' },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({
            success: true,
            verified: true,
            resetToken,
            message: '¡Código verificado exitosamente! Ahora puedes crear tu nueva contraseña.'
        });
    } catch (error) {
        console.error('[AUTH OTP ERROR] Error al verificar OTP:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- RECUPERACIÓN DE CONTRASEÑA (PASO 3: Restablecer Contraseña) ---
router.post('/forgot-password/reset', authLimiter, async (req, res) => {
    try {
        const { email, code, newPassword, resetToken } = req.body;
        console.log(`[AUTH OTP] Restablecimiento de clave final para: ${email}`);

        if (!email || !newPassword) {
            return res.status(400).json({ success: false, error: 'Correo y nueva contraseña obligatorios.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        const record = otpStore.get(email.toLowerCase());
        let isAuthorized = false;

        if (resetToken) {
            try {
                const decoded = jwt.verify(resetToken, JWT_SECRET);
                if (decoded.email === email.toLowerCase() && decoded.purpose === 'pwd_reset') {
                    isAuthorized = true;
                }
            } catch (e) {
                // Token inválido
            }
        }

        if (!isAuthorized && record && record.verified && record.code === code?.toString().trim()) {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(401).json({ success: false, error: 'No autorizado. Debes verificar tu código OTP antes de cambiar la clave.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await dbManager.updateUserPassword(email, hashedPassword);

        otpStore.delete(email.toLowerCase());

        res.json({
            success: true,
            message: '¡Tu contraseña ha sido restablecida exitosamente! Ahora puedes iniciar sesión con tu nueva clave.'
        });
    } catch (error) {
        console.error('[AUTH OTP ERROR] Error al actualizar contraseña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- CAMBIO DE CONTRASEÑA DIRECTO (SESIÓN ACTIVA) ---
router.post('/change-password', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No autenticado. Por favor inicia sesión.' });
        }
        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ success: false, error: 'Sesión inválida o expirada.' });
        }

        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
        }

        const user = await dbManager.getUserByEmail(decoded.email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'La contraseña actual ingresada es incorrecta.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await dbManager.updateUserPassword(decoded.email, hashedPassword);

        res.json({ success: true, message: '¡Tu contraseña ha sido actualizada exitosamente!' });
    } catch (error) {
        console.error('[CHANGE PASSWORD ERROR]:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;


