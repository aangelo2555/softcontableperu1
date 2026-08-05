/**
 * Pool de Conexiones Independiente para SoftPremium
 * 
 * Aislado del pool principal del core para garantizar que las consultas pesadas
 * de Inteligencia Artificial, scoring de riesgo y proyecciones financieras
 * nunca compitan por conexiones con las transacciones operativas del core.
 */

const { Pool } = require('pg');

const poolPremium = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))) 
        ? false 
        : { rejectUnauthorized: false },
    max: 10, // Aislado a 10 conexiones máximo para analítica de IA
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    statement_timeout: 45000, // Timeout extendido a 45s para análisis complejos de IA
    keepAlive: true
});

poolPremium.on('connect', (client) => {
    // Configurar search_path predeterminado para este pool
    client.query('SET search_path TO premium, public;');
    console.log('[POSTGRES PREMIUM] Nueva conexión establecida en pool premium');
});

poolPremium.on('error', (err) => {
    console.error('[POSTGRES PREMIUM ERROR]', err.message);
});

/**
 * Ejecutor de consultas para SoftPremium
 */
async function queryPremium(text, params = []) {
    const start = Date.now();
    try {
        const res = await poolPremium.query(text, params);
        const duration = Date.now() - start;
        if (duration > 2000) {
            console.warn(`[POSTGRES PREMIUM WARN] Consulta lenta (${duration}ms): ${text.substring(0, 100)}...`);
        }
        return res;
    } catch (error) {
        console.error('[POSTGRES PREMIUM QUERY ERROR]', error.message, 'SQL:', text);
        throw error;
    }
}

module.exports = {
    poolPremium,
    queryPremium
};
