const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbManager = USE_POSTGRES ? require('./databasePostgres') : require('./databaseServer');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '686232326828-5icr0f5eghni2ouvscnging0671v0duf.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

const statusPollingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 120, // Límite amplio para permitir sondeo cross-device cada 2s sin bloqueo
    message: { success: false, error: 'Demasiadas consultas de estado.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
});

const { sendAccountVerificationEmail, sendResetOtpEmail } = require('./services/emailService');

const DISPOSABLE_EMAIL_DOMAINS = new Set([
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'throwawaymail.com', 'trashmail.com', 'getnada.com',
    'mohmal.com', 'sharklasers.com', 'dispostable.com', 'temp-mail.org',
    'fakeinbox.com', 'crazymailing.com', 'generator.email', 'tempail.com',
    'burnermail.io', 'mailnull.com', 'mytemp.email'
]);

function isDisposableEmail(email) {
    if (!email || !email.includes('@')) return false;
    const domain = email.split('@')[1].toLowerCase().trim();
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

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

// --- REGISTRO PROFESIONAL ---
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, name, phone, documentNumber, termsAccepted } = req.body;
        console.log(`[AUTH] Intento de registro profesional: ${email}`);

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'El correo y la contraseña son obligatorios.' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 1. Bloqueo de correos desechables / temporales
        if (isDisposableEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Por motivos de seguridad no se permiten correos temporales. Ingresa tu correo real (Gmail, Outlook o corporativo).'
            });
        }

        // 2. Validación de contraseña
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres.' });
        }

        // 3. Verificar si ya existe usuario
        const existingUser = await dbManager.getUserByEmail(normalizedEmail);
        if (existingUser) {
            const isUserVerified = existingUser.is_verified === true || existingUser.is_verified === 1 || existingUser.is_verified === 't';
            if (isUserVerified) {
                console.warn(`[AUTH] El correo ${normalizedEmail} ya existe y está verificado.`);
                return res.status(400).json({ success: false, error: 'El correo ya está registrado y verificado. Por favor inicia sesión.' });
            }

            console.log(`[AUTH] El correo ${normalizedEmail} ya existía pero NO está verificado. Actualizando datos y reenviando nuevo código OTP...`);
            
            // Actualizar contraseña y datos del usuario existente
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            if (USE_POSTGRES) {
                await dbManager.pool.query(
                    `UPDATE users SET password = $1, name = COALESCE($2, name), phone = COALESCE($3, phone), document_number = COALESCE($4, document_number) WHERE id = $5`,
                    [hashedPassword, name || null, phone || null, documentNumber || null, existingUser.id]
                );
            } else {
                dbManager.prepare(
                    `UPDATE users SET password = ?, name = COALESCE(?, name), phone = COALESCE(?, phone), document_number = COALESCE(?, document_number) WHERE id = ?`
                ).run(hashedPassword, name || null, phone || null, documentNumber || null, existingUser.id);
            }

            // Generar nuevo Token Seguro y Código OTP de 6 dígitos
            const verifyToken = crypto.randomBytes(32).toString('hex');
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const verifId = uuidv4();

            try {
                if (USE_POSTGRES) {
                    await dbManager.pool.query(
                        `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours', false)`,
                        [verifId, existingUser.id, normalizedEmail, verifyToken, otpCode]
                    );
                } else {
                    dbManager.prepare(
                        `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                         VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'), 0)`
                    ).run(verifId, existingUser.id, normalizedEmail, verifyToken, otpCode);
                }
            } catch (verifErr) {
                console.warn('[AUTH] Warning guardando email_verifications:', verifErr.message);
            }

            const host = req.get('host') || 'softcontable.up.railway.app';
            const protocol = (req.protocol === 'https' || host.includes('railway.app') || process.env.NODE_ENV === 'production') ? 'https' : req.protocol;
            const verificationUrl = `${protocol}://${host}/?verify_token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;

            const emailRes = await sendAccountVerificationEmail({
                toEmail: normalizedEmail,
                userName: name || existingUser.name || 'Contador',
                verificationUrl,
                otpCode
            });

            return res.json({
                success: true,
                requireVerification: true,
                email: normalizedEmail,
                isReverification: true,
                message: 'Tu cuenta ya estaba en proceso de registro. Hemos enviado un nuevo código de activación a tu correo.',
                simulated: emailRes.simulated || false,
                devCode: (emailRes.simulated || process.env.NODE_ENV !== 'production') ? otpCode : undefined
            });
        }

        // 4. Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const isOwner = normalizedEmail === 'aangelo2555@gmail.com';
        const role = isOwner ? 'super_admin' : 'user';
        const isVerified = isOwner ? true : false; // El owner queda verificado directamente

        // 5. Verificar si este correo ya usó una prueba gratuita antes (Anti-Abuso)
        let alreadyHadTrial = false;
        if (!isOwner) {
            try {
                if (USE_POSTGRES) {
                    const thRes = await dbManager.pool.query('SELECT id FROM trial_history WHERE email = $1', [normalizedEmail]);
                    alreadyHadTrial = thRes.rows.length > 0;
                } else {
                    const thRes = dbManager.prepare('SELECT id FROM trial_history WHERE email = ?').get(normalizedEmail);
                    alreadyHadTrial = !!thRes;
                }
            } catch (thErr) {
                console.warn('[AUTH] Warning consultando trial_history:', thErr.message);
            }
        }

        const userId = uuidv4();
        const newUser = {
            id: userId,
            email: normalizedEmail,
            password: hashedPassword,
            name: name || 'Usuario',
            phone: phone || null,
            document_number: documentNumber || null,
            is_verified: isVerified,
            role
        };

        await dbManager.createUser(newUser);

        // 6. Asignar Suscripción: Trial 14 días (3 empresas) o Suspended si ya usó trial
        try {
            const subId = uuidv4();
            const initialPlanId = isOwner ? 'corporativo' : 'starter';
            const initialStatus = isOwner ? 'active' : alreadyHadTrial ? 'suspended' : 'trial';
            const initialMaxWs = isOwner ? 9999 : alreadyHadTrial ? 0 : 3;
            const initialMaxUsers = isOwner ? 9999 : 2;

            if (USE_POSTGRES) {
                await dbManager.pool.query(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, trial_ends_at, current_period_end)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '14 days', ${isOwner ? "'2099-12-31'" : "NOW() + INTERVAL '14 days'"})
                     ON CONFLICT DO NOTHING`,
                    [subId, userId, initialPlanId, initialStatus, initialMaxWs, initialMaxUsers]
                );

                if (!isOwner && !alreadyHadTrial) {
                    await dbManager.pool.query(
                        `INSERT INTO trial_history (id, email, user_id, ip_address, started_at, expires_at)
                         VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '14 days')
                         ON CONFLICT DO NOTHING`,
                        [uuidv4(), normalizedEmail, userId, req.ip || null]
                    );
                }
            } else {
                dbManager.prepare(
                    `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, trial_ends_at, current_period_end)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+14 days'), ${isOwner ? "'2099-12-31'" : "datetime('now', '+14 days')"})`
                ).run(subId, userId, initialPlanId, initialStatus, initialMaxWs, initialMaxUsers);

                if (!isOwner && !alreadyHadTrial) {
                    try {
                        dbManager.prepare(
                            `INSERT INTO trial_history (id, email, user_id, ip_address, started_at, expires_at)
                             VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+14 days'))`
                        ).run(uuidv4(), normalizedEmail, userId, req.ip || null);
                    } catch (_) {}
                }
            }
        } catch (subErr) {
            console.warn('[AUTH] Warning creando suscripción:', subErr.message);
        }

        // 7. Si es el propietario Angelo, login directo
        if (isOwner) {
            const accessToken = jwt.sign(
                { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
                JWT_SECRET,
                { expiresIn: '15m' }
            );
            const refreshToken = await generateAndStoreRefreshToken(newUser.id);
            return res.json({
                success: true,
                message: '¡Bienvenido SuperAdmin!',
                accessToken,
                refreshToken,
                token: accessToken,
                user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
            });
        }

        // 8. Generar Token Seguro (32 bytes) y Código OTP (6 dígitos) para verificación
        const verifyToken = crypto.randomBytes(32).toString('hex');
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verifId = uuidv4();

        try {
            if (USE_POSTGRES) {
                await dbManager.pool.query(
                    `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours', false)`,
                    [verifId, userId, normalizedEmail, verifyToken, otpCode]
                );
            } else {
                dbManager.prepare(
                    `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                     VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'), 0)`
                ).run(verifId, userId, normalizedEmail, verifyToken, otpCode);
            }
        } catch (verifErr) {
            console.warn('[AUTH] Warning guardando email_verifications:', verifErr.message);
        }

        // 9. Enviar correo de verificación estilo Flow
        const host = req.get('host') || 'softcontable.up.railway.app';
        const protocol = (req.protocol === 'https' || host.includes('railway.app') || process.env.NODE_ENV === 'production') ? 'https' : req.protocol;
        const verificationUrl = `${protocol}://${host}/?verify_token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;

        await sendAccountVerificationEmail({
            toEmail: normalizedEmail,
            userName: name || 'Contador',
            verificationUrl,
            otpCode
        });

        res.json({
            success: true,
            requireVerification: true,
            email: normalizedEmail,
            alreadyHadTrial,
            message: '¡Cuenta creada! Por favor completa tu registro ingresando el código enviado a tu correo.'
        });
    } catch (error) {
        console.error('[AUTH REGISTER ERROR]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- VERIFICACIÓN DE EMAIL POR TOKEN (AUTO-LOGIN AL HACER CLIC EN ENLACE) ---
router.post('/verify-email-token', authLimiter, async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Token de verificación requerido.' });
        }

        let verif = null;
        if (USE_POSTGRES) {
            const vRes = await dbManager.pool.query(
                `SELECT * FROM email_verifications 
                 WHERE token = $1 AND is_used = false AND expires_at > NOW() 
                 ORDER BY created_at DESC LIMIT 1`,
                [token]
            );
            verif = vRes.rows[0];
        } else {
            verif = dbManager.prepare(
                `SELECT * FROM email_verifications 
                 WHERE token = ? AND is_used = 0 AND expires_at > datetime('now') 
                 ORDER BY created_at DESC LIMIT 1`
            ).get(token);
        }

        // Si ya fue usado recientemente (< 15 min), permitir auto-login idempotente
        if (!verif) {
            let recentVerif = null;
            if (USE_POSTGRES) {
                const rvRes = await dbManager.pool.query(
                    `SELECT * FROM email_verifications 
                     WHERE token = $1 AND created_at > (NOW() - INTERVAL '15 minutes')
                     ORDER BY created_at DESC LIMIT 1`,
                    [token]
                );
                recentVerif = rvRes.rows[0];
            } else {
                recentVerif = dbManager.prepare(
                    `SELECT * FROM email_verifications 
                     WHERE token = ? AND created_at > datetime('now', '-15 minutes')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(token);
            }

            if (recentVerif) {
                const user = await dbManager.getUserByEmail(recentVerif.email);
                if (user && user.is_verified) {
                    const normalizedEmail = (user.email || '').trim().toLowerCase();
                    const role = (normalizedEmail === 'aangelo2555@gmail.com') ? 'super_admin' : (user.role || 'user');
                    const accessToken = jwt.sign(
                        { id: user.id, email: user.email, name: user.name, role },
                        JWT_SECRET,
                        { expiresIn: '15m' }
                    );
                    const refreshToken = await generateAndStoreRefreshToken(user.id);
                    return res.json({
                        success: true,
                        message: '¡Tu cuenta ha sido verificada exitosamente! Bienvenido a SoftContable.',
                        accessToken,
                        refreshToken,
                        token: accessToken,
                        user: { id: user.id, email: user.email, name: user.name, role }
                    });
                }
            }

            return res.status(400).json({
                success: false,
                error: 'El enlace de verificación es inválido o ha expirado. Por favor solicita un nuevo código.'
            });
        }

        // Marcar como verificado
        if (USE_POSTGRES) {
            await dbManager.pool.query('UPDATE email_verifications SET is_used = true WHERE id = $1', [verif.id]);
            await dbManager.pool.query('UPDATE users SET is_verified = true WHERE id = $1', [verif.user_id]);
        } else {
            dbManager.prepare('UPDATE email_verifications SET is_used = 1 WHERE id = ?').run(verif.id);
            dbManager.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(verif.user_id);
        }

        const user = await dbManager.getUserByEmail(verif.email);
        const normalizedEmail = (user.email || '').trim().toLowerCase();
        const role = (normalizedEmail === 'aangelo2555@gmail.com') ? 'super_admin' : (user.role || 'user');

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = await generateAndStoreRefreshToken(user.id);

        res.json({
            success: true,
            message: '¡Tu cuenta ha sido verificada exitosamente! Bienvenido a SoftContable.',
            accessToken,
            refreshToken,
            token: accessToken,
            user: { id: user.id, email: user.email, name: user.name, role }
        });
    } catch (error) {
        console.error('[AUTH VERIFY TOKEN ERROR]', error);
        res.status(500).json({ success: false, error: 'Error al verificar el correo electrónico.' });
    }
});

// --- VERIFICACIÓN DE EMAIL POR CÓDIGO OTP (AUTO-LOGIN MANUAL E IDEMPOTENTE) ---
router.post('/verify-email-otp', authLimiter, async (req, res) => {
    try {
        const { email, otpCode } = req.body;
        if (!email || !otpCode) {
            return res.status(400).json({ success: false, error: 'Correo y código de 6 dígitos requeridos.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const cleanOtp = otpCode.toString().trim();

        let verif = null;
        if (USE_POSTGRES) {
            const vRes = await dbManager.pool.query(
                `SELECT * FROM email_verifications 
                 WHERE email = $1 AND otp_code = $2 AND is_used = false AND expires_at > NOW() 
                 ORDER BY created_at DESC LIMIT 1`,
                [normalizedEmail, cleanOtp]
            );
            verif = vRes.rows[0];
        } else {
            verif = dbManager.prepare(
                `SELECT * FROM email_verifications 
                 WHERE email = ? AND otp_code = ? AND is_used = 0 AND expires_at > datetime('now') 
                 ORDER BY created_at DESC LIMIT 1`
            ).get(normalizedEmail, cleanOtp);
        }

        // Si no está pendiente, verificar si ya fue activado recientemente (< 15 min) por enlace móvil
        if (!verif) {
            let recentVerif = null;
            if (USE_POSTGRES) {
                const rvRes = await dbManager.pool.query(
                    `SELECT * FROM email_verifications 
                     WHERE email = $1 AND otp_code = $2 AND created_at > (NOW() - INTERVAL '15 minutes')
                     ORDER BY created_at DESC LIMIT 1`,
                    [normalizedEmail, cleanOtp]
                );
                recentVerif = rvRes.rows[0];
            } else {
                recentVerif = dbManager.prepare(
                    `SELECT * FROM email_verifications 
                     WHERE email = ? AND otp_code = ? AND created_at > datetime('now', '-15 minutes')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(normalizedEmail, cleanOtp);
            }

            if (recentVerif) {
                const user = await dbManager.getUserByEmail(normalizedEmail);
                if (user && user.is_verified) {
                    const role = (normalizedEmail === 'aangelo2555@gmail.com') ? 'super_admin' : (user.role || 'user');
                    const accessToken = jwt.sign(
                        { id: user.id, email: user.email, name: user.name, role },
                        JWT_SECRET,
                        { expiresIn: '15m' }
                    );
                    const refreshToken = await generateAndStoreRefreshToken(user.id);
                    return res.json({
                        success: true,
                        message: '¡Tu cuenta ha sido verificada exitosamente! Bienvenido a SoftContable.',
                        accessToken,
                        refreshToken,
                        token: accessToken,
                        user: { id: user.id, email: user.email, name: user.name, role }
                    });
                }
            }

            return res.status(400).json({
                success: false,
                error: 'Código de verificación incorrecto o expirado. Revisa tu correo e inténtalo de nuevo.'
            });
        }

        // Marcar como verificado
        if (USE_POSTGRES) {
            await dbManager.pool.query('UPDATE email_verifications SET is_used = true WHERE id = $1', [verif.id]);
            await dbManager.pool.query('UPDATE users SET is_verified = true WHERE id = $1', [verif.user_id]);
        } else {
            dbManager.prepare('UPDATE email_verifications SET is_used = 1 WHERE id = ?').run(verif.id);
            dbManager.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(verif.user_id);
        }

        const user = await dbManager.getUserByEmail(normalizedEmail);
        const role = (normalizedEmail === 'aangelo2555@gmail.com') ? 'super_admin' : (user.role || 'user');

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = await generateAndStoreRefreshToken(user.id);

        res.json({
            success: true,
            message: '¡Tu cuenta ha sido verificada exitosamente! Bienvenido a SoftContable.',
            accessToken,
            refreshToken,
            token: accessToken,
            user: { id: user.id, email: user.email, name: user.name, role }
        });
    } catch (error) {
        console.error('[AUTH VERIFY OTP ERROR]', error);
        res.status(500).json({ success: false, error: 'Error al validar el código OTP.' });
    }
});

// --- SONDEO EN TIEMPO REAL: VERIFICAR ESTADO CROSS-DEVICE (MÓVIL <-> DESKTOP) ---
const handleCheckVerificationStatus = async (req, res) => {
    try {
        const email = req.body?.email || req.query?.email;
        if (!email) {
            return res.status(400).json({ success: false, error: 'Email requerido.' });
        }

        const normalizedEmail = email.toString().trim().toLowerCase();
        const user = await dbManager.getUserByEmail(normalizedEmail);

        if (!user) {
            return res.json({ success: true, verified: false });
        }

        const isUserVerified = user.is_verified === true || user.is_verified === 1 || user.is_verified === 't';

        // Si el usuario ya está verificado, revisar si hubo verificación en los últimos 30 min (o si es super admin)
        if (isUserVerified) {
            let recentVerif = null;
            if (USE_POSTGRES) {
                const rvRes = await dbManager.pool.query(
                    `SELECT * FROM email_verifications 
                     WHERE email = $1 AND created_at > (NOW() - INTERVAL '30 minutes')
                     ORDER BY created_at DESC LIMIT 1`,
                    [normalizedEmail]
                );
                recentVerif = rvRes.rows[0];
            } else {
                recentVerif = dbManager.prepare(
                    `SELECT * FROM email_verifications 
                     WHERE email = ? AND created_at > datetime('now', '-30 minutes')
                     ORDER BY created_at DESC LIMIT 1`
                ).get(normalizedEmail);
            }

            if (recentVerif || normalizedEmail === 'aangelo2555@gmail.com') {
                const role = (normalizedEmail === 'aangelo2555@gmail.com') ? 'super_admin' : (user.role || 'user');
                const accessToken = jwt.sign(
                    { id: user.id, email: user.email, name: user.name, role },
                    JWT_SECRET,
                    { expiresIn: '15m' }
                );
                const refreshToken = await generateAndStoreRefreshToken(user.id);

                return res.json({
                    success: true,
                    verified: true,
                    message: '¡Cuenta verificada exitosamente desde tu dispositivo móvil!',
                    accessToken,
                    refreshToken,
                    token: accessToken,
                    user: { id: user.id, email: user.email, name: user.name, role }
                });
            }
        }

        return res.json({
            success: true,
            verified: false
        });
    } catch (error) {
        console.error('[AUTH CHECK VERIFICATION STATUS ERROR]', error);
        res.status(500).json({ success: false, error: 'Error al verificar estado.' });
    }
};

router.get('/check-verification-status', statusPollingLimiter, handleCheckVerificationStatus);
router.post('/check-verification-status', statusPollingLimiter, handleCheckVerificationStatus);

// --- REENVIAR CORREO DE VERIFICACIÓN ---
router.post('/resend-verification', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, error: 'Correo requerido.' });

        const normalizedEmail = email.trim().toLowerCase();
        const user = await dbManager.getUserByEmail(normalizedEmail);
        if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });

        const isUserVerified = user.is_verified === true || user.is_verified === 1 || user.is_verified === 't';
        if (isUserVerified) {
            return res.json({ success: true, alreadyVerified: true, message: 'Tu cuenta ya está verificada. Puedes iniciar sesión.' });
        }

        const verifyToken = crypto.randomBytes(32).toString('hex');
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verifId = uuidv4();

        if (USE_POSTGRES) {
            await dbManager.pool.query(
                `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                 VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours', false)`,
                [verifId, user.id, normalizedEmail, verifyToken, otpCode]
            );
        } else {
            dbManager.prepare(
                `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                 VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'), 0)`
            ).run(verifId, user.id, normalizedEmail, verifyToken, otpCode);
        }

        const host = req.get('host') || 'softcontable.up.railway.app';
        const protocol = (req.protocol === 'https' || host.includes('railway.app') || process.env.NODE_ENV === 'production') ? 'https' : req.protocol;
        const verificationUrl = `${protocol}://${host}/?verify_token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;

        const emailRes = await sendAccountVerificationEmail({
            toEmail: normalizedEmail,
            userName: user.name || 'Contador',
            verificationUrl,
            otpCode
        });

        res.json({
            success: true,
            message: 'Se ha reenviado el correo de verificación con tu código de 6 dígitos.',
            simulated: emailRes.simulated || false,
            devCode: (emailRes.simulated || process.env.NODE_ENV !== 'production') ? otpCode : undefined
        });
    } catch (error) {
        console.error('[AUTH RESEND VERIF ERROR]', error);
        res.status(500).json({ success: false, error: 'Error al reenviar el correo de verificación.' });
    }
});

// --- REGISTRO ESTUDIANTE ---
router.post('/register-student', authLimiter, async (req, res) => {
    try {
        const { email, password, name } = req.body;
        console.log(`[AUTH] Registro de estudiante: ${email}`);

        const normalizedEmail = (email || '').trim().toLowerCase();
        if (isDisposableEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, error: 'Por favor ingresa un correo real de estudiante (Gmail, Outlook o universitario).' });
        }

        const existingUser = await dbManager.getUserByEmail(normalizedEmail);
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'El correo ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userId = uuidv4();
        const newUser = {
            id: userId,
            email: normalizedEmail,
            password: hashedPassword,
            name: name || 'Estudiante',
            is_verified: true, // Estudiantes acceden directamente
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

// --- GOOGLE OAUTH 2.0 (LOGIN & REGISTRO DIRECTO) ---
router.post('/google', authLimiter, async (req, res) => {
    try {
        const { credential, accessToken: clientAccessToken, mode } = req.body;
        if (!credential && !clientAccessToken) {
            return res.status(400).json({ success: false, error: 'Token de autenticación de Google requerido.' });
        }

        let payload = null;

        // 1. Validar con Access Token (Google Userinfo API)
        const tokenToFetch = clientAccessToken || (!credential?.includes('.') ? credential : null);
        if (tokenToFetch) {
            try {
                let userInfoData = null;
                if (typeof fetch === 'function') {
                    const fetchRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${tokenToFetch}` },
                        signal: AbortSignal.timeout(10000)
                    });
                    if (fetchRes.ok) {
                        userInfoData = await fetchRes.json();
                    }
                }
                if (!userInfoData && axios) {
                    const axiosRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${tokenToFetch}` },
                        timeout: 10000
                    });
                    userInfoData = axiosRes.data;
                }

                if (userInfoData && userInfoData.email) {
                    payload = {
                        email: userInfoData.email,
                        name: userInfoData.name || userInfoData.given_name || 'Usuario Google',
                        picture: userInfoData.picture,
                        email_verified: userInfoData.email_verified
                    };
                }
            } catch (userinfoError) {
                console.warn('[AUTH GOOGLE] Advertencia al obtener userinfo:', userinfoError.message);
            }

            // Fallback: Google OAuth2Client.getTokenInfo
            if (!payload) {
                try {
                    const tokenInfo = await googleClient.getTokenInfo(tokenToFetch);
                    if (tokenInfo && tokenInfo.email) {
                        payload = {
                            email: tokenInfo.email,
                            name: 'Usuario Google',
                            email_verified: tokenInfo.email_verified
                        };
                    }
                } catch (tokenInfoErr) {
                    console.warn('[AUTH GOOGLE] Advertencia al verificar tokenInfo:', tokenInfoErr.message);
                }
            }
        }

        // 2. Validar con ID Token (JWT verifyIdToken)
        if (!payload && credential) {
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: credential,
                    audience: GOOGLE_CLIENT_ID
                });
                const idPayload = ticket.getPayload();
                if (idPayload && idPayload.email) {
                    payload = {
                        email: idPayload.email,
                        name: idPayload.name || idPayload.given_name || 'Usuario Google',
                        picture: idPayload.picture,
                        email_verified: idPayload.email_verified
                    };
                }
            } catch (verifyError) {
                console.warn('[AUTH GOOGLE] Advertencia verificando ID Token:', verifyError.message);
            }
        }

        if (!payload || !payload.email) {
            console.error('[AUTH GOOGLE ERROR] No se pudo verificar el token de Google recibido.');
            return res.status(401).json({ success: false, error: 'No se pudo verificar la cuenta de Google. Por favor intenta de nuevo.' });
        }

        const normalizedEmail = payload.email.trim().toLowerCase();
        const googleName = payload.name || payload.given_name || 'Usuario Google';
        const isOwner = normalizedEmail === 'aangelo2555@gmail.com';
        const requestedMode = mode || 'profesional';

        console.log(`[AUTH GOOGLE] Autenticación con Google para: ${normalizedEmail} (Modo: ${requestedMode})`);

        let user = await dbManager.getUserByEmail(normalizedEmail);

        if (!user) {
            // Auto-registro con Google
            const userId = uuidv4();
            const role = isOwner ? 'super_admin' : (requestedMode === 'estudiante' ? 'estudiante' : 'user');
            
            // Password aleatorio seguro de respaldo
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            // Verificar si ya usó prueba antes
            let alreadyHadTrial = false;
            if (!isOwner && role !== 'estudiante') {
                try {
                    if (USE_POSTGRES) {
                        const thRes = await dbManager.pool.query('SELECT id FROM trial_history WHERE email = $1', [normalizedEmail]);
                        alreadyHadTrial = thRes.rows.length > 0;
                    } else {
                        const thRes = dbManager.prepare('SELECT id FROM trial_history WHERE email = ?').get(normalizedEmail);
                        alreadyHadTrial = !!thRes;
                    }
                } catch (thErr) {
                    console.warn('[AUTH GOOGLE] Warning consultando trial_history:', thErr.message);
                }
            }

            const newUser = {
                id: userId,
                email: normalizedEmail,
                password: hashedPassword,
                name: googleName,
                phone: null,
                document_number: null,
                is_verified: true, // Google garantiza que el correo pertenece al usuario
                role
            };

            await dbManager.createUser(newUser);

            // Asignar Suscripción correspondiente
            try {
                const subId = uuidv4();
                if (role === 'estudiante') {
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
                } else {
                    const initialPlanId = isOwner ? 'corporativo' : 'starter';
                    const initialStatus = isOwner ? 'active' : alreadyHadTrial ? 'suspended' : 'trial';
                    const initialMaxWs = isOwner ? 9999 : alreadyHadTrial ? 0 : 3;
                    const initialMaxUsers = isOwner ? 9999 : 2;

                    if (USE_POSTGRES) {
                        await dbManager.pool.query(
                            `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, trial_ends_at, current_period_end)
                             VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '14 days', ${isOwner ? "'2099-12-31'" : "NOW() + INTERVAL '14 days'"})
                             ON CONFLICT DO NOTHING`,
                            [subId, userId, initialPlanId, initialStatus, initialMaxWs, initialMaxUsers]
                        );

                        if (!isOwner && !alreadyHadTrial) {
                            await dbManager.pool.query(
                                `INSERT INTO trial_history (id, email, user_id, ip_address, started_at, expires_at)
                                 VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '14 days')
                                 ON CONFLICT DO NOTHING`,
                                [uuidv4(), normalizedEmail, userId, req.ip || null]
                            );
                        }
                    } else {
                        dbManager.prepare(
                            `INSERT INTO subscriptions (id, user_id, plan_id, status, max_workspaces, max_users, trial_ends_at, current_period_end)
                             VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+14 days'), ${isOwner ? "'2099-12-31'" : "datetime('now', '+14 days')"})`
                        ).run(subId, userId, initialPlanId, initialStatus, initialMaxWs, initialMaxUsers);

                        if (!isOwner && !alreadyHadTrial) {
                            try {
                                dbManager.prepare(
                                    `INSERT INTO trial_history (id, email, user_id, ip_address, started_at, expires_at)
                                     VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+14 days'))`
                                ).run(uuidv4(), normalizedEmail, userId, req.ip || null);
                            } catch (_) {}
                        }
                    }
                }
            } catch (subErr) {
                console.warn('[AUTH GOOGLE] Warning creando suscripción:', subErr.message);
            }

            user = newUser;
        } else {
            // Usuario existente: si su correo no estaba verificado, verificarlo automáticamente
            if (user.is_verified !== true && user.is_verified !== 1) {
                try {
                    if (USE_POSTGRES) {
                        await dbManager.pool.query('UPDATE users SET is_verified = true WHERE id = $1', [user.id]);
                    } else {
                        dbManager.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(user.id);
                    }
                    user.is_verified = true;
                } catch (_) {}
            }
        }

        // Determinar rol efectivo
        let role = user.role || 'user';
        if (isOwner) {
            role = 'super_admin';
        } else if (role === 'admin') {
            role = 'user';
        }

        // Validar coherencia de rol vs modo seleccionado
        if (requestedMode === 'profesional' && role === 'estudiante') {
            return res.status(400).json({
                success: false,
                error: '🎓 Esta cuenta está registrada en Modo Estudiante. Activa la opción "Estudiante" en la pantalla de inicio para ingresar.'
            });
        }
        if (requestedMode === 'estudiante' && role !== 'estudiante' && !isOwner) {
            return res.status(400).json({
                success: false,
                error: '💼 Esta cuenta es de Modo Profesional. Cambia al modo "Profesional" para iniciar sesión.'
            });
        }

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name || googleName, role },
            JWT_SECRET,
            { expiresIn: '15m' }
        );
        const refreshToken = await generateAndStoreRefreshToken(user.id);

        return res.json({
            success: true,
            message: `¡Bienvenido ${user.name || googleName}!`,
            accessToken,
            refreshToken,
            token: accessToken,
            user: { id: user.id, email: user.email, name: user.name || googleName, role }
        });
    } catch (error) {
        console.error('[AUTH GOOGLE ERROR]', error);
        return res.status(500).json({ success: false, error: 'Error interno en autenticación con Google.' });
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
        const isOwner = normalizedEmail === 'aangelo2555@gmail.com';
        let role = user.role || 'user';
        if (isOwner) {
            role = 'super_admin';
        } else if (role === 'admin') {
            role = 'user';
        }

        // VALIDACIÓN DE VERIFICACIÓN DE CORREO (Excepto Owner y Estudiantes)
        const isVerified = user.is_verified === true || user.is_verified === 1 || user.is_verified === 't' || isOwner || role === 'estudiante';
        if (!isVerified) {
            console.log(`[AUTH] Usuario ${normalizedEmail} intentó ingresar sin verificar. Auto-despachando nuevo código OTP...`);
            
            // Auto-generar y reenviar código OTP para que el usuario pueda verificar de inmediato
            const verifyToken = crypto.randomBytes(32).toString('hex');
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const verifId = uuidv4();

            try {
                if (USE_POSTGRES) {
                    await dbManager.pool.query(
                        `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours', false)`,
                        [verifId, user.id, normalizedEmail, verifyToken, otpCode]
                    );
                } else {
                    dbManager.prepare(
                        `INSERT INTO email_verifications (id, user_id, email, token, otp_code, expires_at, is_used)
                         VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'), 0)`
                    ).run(verifId, user.id, normalizedEmail, verifyToken, otpCode);
                }

                const host = req.get('host') || 'softcontable.up.railway.app';
                const protocol = (req.protocol === 'https' || host.includes('railway.app') || process.env.NODE_ENV === 'production') ? 'https' : req.protocol;
                const verificationUrl = `${protocol}://${host}/?verify_token=${verifyToken}&email=${encodeURIComponent(normalizedEmail)}`;

                await sendAccountVerificationEmail({
                    toEmail: normalizedEmail,
                    userName: user.name || 'Contador',
                    verificationUrl,
                    otpCode
                });
            } catch (e) {
                console.warn('[AUTH] Error enviando código OTP durante login no verificado:', e.message);
            }

            return res.status(403).json({
                success: false,
                requireVerification: true,
                email: user.email,
                error: 'Debes completar la verificación de tu correo electrónico. Te acabamos de enviar un nuevo código de 6 dígitos a tu bandeja de entrada.'
            });
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


