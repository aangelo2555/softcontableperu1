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

// --- LOGIN ---
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[AUTH] Intento de login: ${email}`);

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
        const role = (user.role === 'admin' || normalizedEmail === 'aangelo2555@gmail.com') ? 'admin' : 'user';

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

module.exports = router;
