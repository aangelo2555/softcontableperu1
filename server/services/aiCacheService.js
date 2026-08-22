/**
 * aiCacheService.js - Capa de Caché Inteligente de Consultas Contables / Tributarias
 * 
 * Permite responder consultas idénticas o recurrentes de la normativa peruana en <5ms
 * consumiendo 0 tokens de las cuotas de IA.
 */

const crypto = require('crypto');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');

// Caché en memoria para acceso ultra-rápido (Nivel 1)
const inMemoryCache = new Map();
const MAX_MEM_CACHE = 500;

/**
 * Normaliza y genera el hash de una consulta contable
 */
function normalizeAndHash(queryText, workspaceId = '') {
    if (!queryText || typeof queryText !== 'string') return '';
    
    // Normalizar: minúsculas, remover tildes, signos y espacios redundantes
    const clean = queryText
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[¿?¡!.,;:_()\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Solo asociar a workspaceId si la consulta menciona "mis compras", "mis ventas", etc.
    const isCompanySpecific = /\b(mis compras|mis ventas|mi empresa|mi ruc|mis asientos|mi planilla|mi saldo|mi igv)\b/i.test(clean);
    const hashKey = isCompanySpecific ? `${workspaceId}_${clean}` : `global_${clean}`;

    return crypto.createHash('sha256').update(hashKey).digest('hex');
}

/**
 * Busca una respuesta en la caché (Memoria L1 -> Base de Datos L2)
 */
async function getCachedQuery(queryText, workspaceId = '') {
    const hash = normalizeAndHash(queryText, workspaceId);
    if (!hash) return null;

    // 1. Nivel 1: Memoria RAM
    if (inMemoryCache.has(hash)) {
        const memEntry = inMemoryCache.get(hash);
        if (memEntry.expiresAt > Date.now()) {
            console.log(`[AI CACHE] ⚡ Cache HIT en Memoria L1 para: "${queryText.slice(0, 35)}..." (0 Tokens)`);
            return {
                ...memEntry.data,
                fromCache: true
            };
        } else {
            inMemoryCache.delete(hash);
        }
    }

    // 2. Nivel 2: Base de Datos
    try {
        const dbEntry = await db.getCachedAiQuery(hash);
        if (dbEntry) {
            let parsedData = null;
            try {
                parsedData = typeof dbEntry.response_json === 'string' 
                    ? JSON.parse(dbEntry.response_json) 
                    : dbEntry.response_json;
            } catch (_) {
                parsedData = dbEntry.response_json;
            }

            // Subir a Memoria L1
            inMemoryCache.set(hash, {
                data: parsedData,
                expiresAt: Date.now() + 1000 * 60 * 60 * 12 // 12 horas en memoria
            });

            console.log(`[AI CACHE] ⚡ Cache HIT en Base de Datos L2 para: "${queryText.slice(0, 35)}..." (0 Tokens)`);
            return {
                ...parsedData,
                fromCache: true
            };
        }
    } catch (e) {
        console.warn('[AI CACHE] Error buscando en caché:', e.message);
    }

    return null;
}

/**
 * Guarda una respuesta en caché (Memoria L1 + Base de Datos L2)
 */
async function saveCachedQuery(queryText, responseData, providerUsed = '', modelUsed = '', workspaceId = '', ttlHours = 24) {
    const hash = normalizeAndHash(queryText, workspaceId);
    if (!hash || !responseData) return;

    // 1. Guardar en memoria L1 (manteniendo tamaño acotado)
    if (inMemoryCache.size >= MAX_MEM_CACHE) {
        const firstKey = inMemoryCache.keys().next().value;
        inMemoryCache.delete(firstKey);
    }
    inMemoryCache.set(hash, {
        data: responseData,
        expiresAt: Date.now() + 1000 * 60 * 60 * ttlHours
    });

    // 2. Guardar en Base de Datos L2
    try {
        await db.saveCachedAiQuery({
            queryHash: hash,
            queryText: queryText.slice(0, 500),
            responseJson: responseData,
            providerUsed,
            modelUsed,
            ttlHours
        });
    } catch (e) {
        console.warn('[AI CACHE] Error persistiendo caché en BD:', e.message);
    }
}

module.exports = {
    getCachedQuery,
    saveCachedQuery,
    normalizeAndHash
};
