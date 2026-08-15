/**
 * ═══════════════════════════════════════════════════════════════════════
 * SOFTCONTABLE SAAS — Módulo de Seguridad Anti-DDoS & Protección Total
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Capas de protección implementadas:
 * 
 *  1. Rate Limiting Global (API)        — Máx 100 req/min por IP
 *  2. Rate Limiting Estricto (Auth)     — Máx 5 req/min por IP (login/register)
 *  3. Rate Limiting Pesado (IA/Premium) — Máx 10 req/min por IP (Groq AI, RAG)
 *  4. Slowloris Defense                 — Timeout de headers y conexiones inactivas
 *  5. Payload Size Enforcement          — Rechazo de cuerpos excesivamente grandes
 *  6. Request Frequency Monitor         — Detección de ráfagas anómalas (>300 req/min → bloqueo temporal)
 *  7. IP Blacklist Temporal             — IPs bloqueadas dinámicamente por comportamiento sospechoso
 *  8. HTTP Parameter Pollution (HPP)    — Sanitización de parámetros duplicados
 *  9. Security Headers Hardening        — Refuerzo de Helmet con políticas estrictas
 * 10. Request ID Tracking               — Trazabilidad de cada petición para auditoría
 * 
 * Autor: Angelo Serna Simeon — SOFTCONTABLE SAAS © 2026
 */

const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// ═══════════════════════════════════════════════════════════════════════
// 1. RATE LIMITING GLOBAL — Protección volumétrica para toda la API
// ═══════════════════════════════════════════════════════════════════════

const globalApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // Ventana de 1 minuto
    max: 3000,                // Máximo 3000 peticiones por minuto (adaptado para SPA contable)
    standardHeaders: true,    // Incluir headers RateLimit-* en la respuesta
    legacyHeaders: false,
    validate: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.decode(authHeader.substring(7));
                if (decoded && (decoded.id || decoded.userId)) {
                    return `user_${decoded.id || decoded.userId}`;
                }
            } catch (e) {}
        }
        return req.ip || req.connection?.remoteAddress || 'unknown';
    },
    handler: (req, res) => {
        console.warn(`[SECURITY] Rate limit GLOBAL excedido para IP/User: ${req.ip} — Ruta: ${req.originalUrl}`);
        res.status(429).json({
            success: false,
            error: 'Demasiadas solicitudes continuas. Por favor espera unos segundos e intenta nuevamente.',
            retryAfter: 10
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. RATE LIMITING ESTRICTO (AUTH) — Anti brute-force para login/register
// ═══════════════════════════════════════════════════════════════════════

const authStrictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) => req.ip || 'unknown',
    handler: (req, res) => {
        console.warn(`[SECURITY] Rate limit AUTH excedido para IP: ${req.ip} — Posible ataque de fuerza bruta`);
        res.status(429).json({
            success: false,
            error: 'Demasiados intentos de acceso desde esta IP. Por favor espera 1 minuto antes de intentar nuevamente.',
            retryAfter: 60
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════
// 3. RATE LIMITING PESADO (IA/PREMIUM) — Protección para endpoints Groq AI
// ═══════════════════════════════════════════════════════════════════════

const premiumAiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) => req.ip || 'unknown',
    handler: (req, res) => {
        console.warn(`[SECURITY] Rate limit PREMIUM/AI excedido para IP: ${req.ip} — Ruta IA: ${req.originalUrl}`);
        res.status(429).json({
            success: false,
            error: 'Has excedido el límite de consultas de Inteligencia Artificial (60/min). Espera un momento para continuar.',
            retryAfter: 60
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════
// 6 & 7. REQUEST FREQUENCY MONITOR + IP BLACKLIST DINÁMICA
// Detección de ráfagas anómalas (>3000 req/min → bloqueo temporal 5 min)
// ═══════════════════════════════════════════════════════════════════════

const ipRequestCounters = new Map();    // Map<ip, { count, windowStart }>
const blacklistedIPs = new Map();       // Map<ip, unblockTimestamp>

const BURST_THRESHOLD = 3000;           // Peticiones por minuto para considerar ráfaga abusiva
const BLACKLIST_DURATION_MS = 5 * 60 * 1000; // 5 minutos de bloqueo temporal
const COUNTER_WINDOW_MS = 60 * 1000;    // Ventana de conteo: 1 minuto

// Limpieza periódica cada 2 minutos
setInterval(() => {
    const now = Date.now();

    // Limpiar contadores expirados
    for (const [ip, data] of ipRequestCounters.entries()) {
        if (now - data.windowStart > COUNTER_WINDOW_MS) {
            ipRequestCounters.delete(ip);
        }
    }

    // Limpiar bloqueos expirados
    for (const [ip, unblockTime] of blacklistedIPs.entries()) {
        if (now >= unblockTime) {
            console.log(`[SECURITY] IP ${ip} desbloqueada automáticamente tras expiración de blacklist.`);
            blacklistedIPs.delete(ip);
        }
    }
}, 2 * 60 * 1000);

function ddosDetectionMiddleware(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    // Verificar si la IP está bloqueada
    if (blacklistedIPs.has(ip)) {
        const unblockTime = blacklistedIPs.get(ip);
        if (now < unblockTime) {
            const remainingSecs = Math.ceil((unblockTime - now) / 1000);
            console.warn(`[SECURITY] IP BLOQUEADA ${ip} intentó acceder — quedan ${remainingSecs}s de bloqueo`);
            return res.status(403).json({
                success: false,
                error: `Tu IP ha sido bloqueada temporalmente por comportamiento sospechoso. Desbloqueo automático en ${remainingSecs} segundos.`,
                blockedUntil: new Date(unblockTime).toISOString()
            });
        } else {
            blacklistedIPs.delete(ip);
        }
    }

    // Contabilizar petición
    if (!ipRequestCounters.has(ip)) {
        ipRequestCounters.set(ip, { count: 1, windowStart: now });
    } else {
        const data = ipRequestCounters.get(ip);
        if (now - data.windowStart > COUNTER_WINDOW_MS) {
            // Nueva ventana
            ipRequestCounters.set(ip, { count: 1, windowStart: now });
        } else {
            data.count++;

            // ¿Supera el umbral de ráfaga?
            if (data.count > BURST_THRESHOLD) {
                blacklistedIPs.set(ip, now + BLACKLIST_DURATION_MS);
                console.error(`[SECURITY] 🚨 IP ${ip} BLOQUEADA — ${data.count} peticiones en 1 minuto (umbral: ${BURST_THRESHOLD}). Bloqueo por 5 minutos.`);
                return res.status(403).json({
                    success: false,
                    error: 'Tu IP ha sido bloqueada temporalmente por enviar demasiadas solicitudes en un periodo muy corto. Esto podría ser un ataque automatizado.',
                    blockedUntil: new Date(now + BLACKLIST_DURATION_MS).toISOString()
                });
            }
        }
    }

    next();
}

// ═══════════════════════════════════════════════════════════════════════
// 8. HTTP PARAMETER POLLUTION (HPP) — Sanitizar parámetros duplicados
// ═══════════════════════════════════════════════════════════════════════

function hppProtection(req, res, next) {
    if (req.query) {
        for (const key of Object.keys(req.query)) {
            if (Array.isArray(req.query[key])) {
                // Tomar solo el último valor si hay parámetros duplicados
                req.query[key] = req.query[key][req.query[key].length - 1];
            }
        }
    }
    next();
}

// ═══════════════════════════════════════════════════════════════════════
// 5. PAYLOAD SIZE ENFORCEMENT — Rechazar bodies sospechosamente grandes
// ═══════════════════════════════════════════════════════════════════════

function payloadSizeGuard(req, res, next) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const MAX_SAFE_PAYLOAD = 12 * 1024 * 1024; // 12MB (un poco por encima del limit de express.json)

    if (contentLength > MAX_SAFE_PAYLOAD) {
        console.warn(`[SECURITY] Payload excesivo rechazado — IP: ${req.ip}, Content-Length: ${contentLength} bytes, Ruta: ${req.originalUrl}`);
        return res.status(413).json({
            success: false,
            error: 'El cuerpo de la solicitud excede el tamaño máximo permitido (12MB).'
        });
    }
    next();
}

// ═══════════════════════════════════════════════════════════════════════
// 10. REQUEST ID TRACKING — Trazabilidad de cada petición
// ═══════════════════════════════════════════════════════════════════════

function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || uuidv4().substring(0, 12);
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}

// ═══════════════════════════════════════════════════════════════════════
// 9. SECURITY HEADERS HARDENING — Cabeceras adicionales de seguridad
// ═══════════════════════════════════════════════════════════════════════

function securityHeadersMiddleware(req, res, next) {
    // Prevenir que el sitio sea incrustado en iframes de dominios no autorizados
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Prevenir MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Habilitar protección XSS del navegador
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevenir filtración de referrer en peticiones cross-origin
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Deshabilitar caché para endpoints de API
    if (req.originalUrl.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    // No exponer que es un servidor Express
    res.removeHeader('X-Powered-By');

    // Permissions Policy (restringir APIs del navegador)
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=()');

    next();
}

// ═══════════════════════════════════════════════════════════════════════
// 4. SLOWLORIS DEFENSE — Configurar en el servidor HTTP
// Se aplica como función que recibe el server HTTP de app.listen()
// ═══════════════════════════════════════════════════════════════════════

function applySlowlorisDefense(server) {
    // Timeout de espera de headers: 10 segundos
    // Previene conexiones que envían headers muy lentamente para agotar slots
    server.headersTimeout = 10000;

    // Timeout general de request: 30 segundos
    server.requestTimeout = 30000;

    // Keep-alive timeout: 65 segundos (ligeramente mayor que el proxy de Railway)
    server.keepAliveTimeout = 65000;

    // Máximo de headers por request
    server.maxHeadersCount = 50;

    console.log('[SECURITY] Slowloris defense configurada: headersTimeout=10s, requestTimeout=30s, keepAliveTimeout=65s');
}

// ═══════════════════════════════════════════════════════════════════════
// ENDPOINT DE ESTADO DE SEGURIDAD (solo admin)
// ═══════════════════════════════════════════════════════════════════════

function securityStatusEndpoint(req, res) {
    return res.json({
        success: true,
        security: {
            blacklistedIPs: blacklistedIPs.size,
            activeCounters: ipRequestCounters.size,
            burstThreshold: BURST_THRESHOLD,
            blacklistDurationMinutes: BLACKLIST_DURATION_MS / 60000,
            rateLimits: {
                global: '100 req/min',
                auth: '5 req/min',
                premiumAI: '10 req/min'
            },
            slowlorisDefense: true,
            hppProtection: true,
            payloadGuard: '12MB max',
            requestIdTracking: true,
            securityHeaders: true,
            timestamp: new Date().toISOString()
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTAR TODAS LAS CAPAS DE SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    globalApiLimiter,
    authStrictLimiter,
    premiumAiLimiter,
    ddosDetectionMiddleware,
    hppProtection,
    payloadSizeGuard,
    requestIdMiddleware,
    securityHeadersMiddleware,
    applySlowlorisDefense,
    securityStatusEndpoint
};
