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
    max: 5, // Limitar cada IP a 5 peticiones de login/registro por minuto
    message: { success: false, error: 'Demasiados intentos de acceso desde esta IP, por favor intente de nuevo en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
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
// --- RECUPERACIÓN DE CONTRASEÑA ---
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        console.log(`[AUTH] Solicitud de recuperación de contraseña: ${email}`);

        if (!email) {
            return res.status(400).json({ success: false, error: 'Debe proporcionar un correo electrónico válido.' });
        }

        const user = await dbManager.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ success: false, error: 'No existe ninguna cuenta registrada con este correo electrónico.' });
        }

        if (newPassword) {
            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            await dbManager.query(
                USE_POSTGRES ? 'UPDATE users SET password = $1 WHERE email = $2' : 'UPDATE users SET password = ? WHERE email = ?',
                [hashedPassword, email]
            );
            return res.json({ success: true, message: '¡Tu contraseña ha sido restablecida exitosamente! Ahora puedes iniciar sesión.' });
        } else {
            return res.json({
                success: true,
                message: `Cuenta verificada para ${email}. Ingresa tu nueva contraseña para continuar.`,
                verified: true
            });
        }
    } catch (error) {
        console.error('[AUTH ERROR] Error en recuperación de contraseña:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

