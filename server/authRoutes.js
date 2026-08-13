const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
    max: 15, // Límite por IP por minuto
    message: { success: false, error: 'Demasiados intentos de acceso desde esta IP, por favor intente de nuevo en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
});

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
        const role = (userCount === 0 || normalizedEmail === 'aangelo2555@gmail.com') ? 'admin' : 'user';

        const newUser = {
            id: uuidv4(),
            email,
            password: hashedPassword,
            name,
            role
        };

        await dbManager.createUser(newUser);

        res.json({ success: true, message: 'Usuario registrado exitosamente' });
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

        const newUser = {
            id: uuidv4(),
            email,
            password: hashedPassword,
            name,
            role: 'estudiante'
        };

        await dbManager.createUser(newUser);

        // Auto-login: generar token directamente
        const token = jwt.sign(
            { id: newUser.id, email: newUser.email, name: newUser.name, role: 'estudiante' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
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
        // Preserve estudiante role from DB; only promote to admin for admin emails
        let role = user.role || 'user';
        if (role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com') {
            role = 'admin';
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

        // Crear Token
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, email: user.email, name: user.name, role }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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


