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
    options: '-c search_path=premium,public',
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    statement_timeout: 45000,
    keepAlive: true
});

poolPremium.on('error', (err) => {
    console.warn('[POSTGRES PREMIUM WARN]', err.message);
});

/**
 * Ejecutor de consultas seguro para SoftPremium
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
        console.warn('[POSTGRES PREMIUM QUERY WARN]', error.message, 'SQL:', text.substring(0, 80));
        return { rows: [], rowCount: 0 };
    }
}

module.exports = {
    poolPremium,
    queryPremium
};
