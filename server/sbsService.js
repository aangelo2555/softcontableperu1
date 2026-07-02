const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const dbManager = USE_POSTGRES ? require('./databasePostgres') : require('./databaseServer');

function fetchExchangeRateFromApi(date) {
    return new Promise((resolve) => {
        // Use v1 of apis.net.pe which is public and free
        const url = `https://api.apis.net.pe/v1/tipo-cambio?fecha=${date}`;
        
        const req = https.get(url, { timeout: 4000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed && parsed.compra && parsed.venta) {
                            return resolve({
                                compra: Number(parsed.compra),
                                venta: Number(parsed.venta)
                            });
                        }
                    } catch (e) {
                        // JSON parse error
                    }
                }
                resolve(null);
            });
        });
        
        req.on('error', () => {
            resolve(null);
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

async function getExchangeRate(date, depth = 0) {
    if (depth > 10) {
        // Recursion limit reached: get last rate from DB or use fallback
        try {
            const lastRate = await dbManager.queryAll('SELECT * FROM sbs_rates ORDER BY fecha DESC LIMIT 1');
            if (lastRate && lastRate.length > 0) {
                return {
                    compra: lastRate[0].compra,
                    venta: lastRate[0].venta,
                    fecha: lastRate[0].fecha,
                    is_fallback: true
                };
            }
        } catch (dbError) {
            console.error('[SBS SERVICE] Error reading fallback from DB:', dbError.message);
        }
        return { compra: 3.722, venta: 3.730, fecha: date, is_fallback: true };
    }

    try {
        // 1. Check local cache first
        const cached = await dbManager.queryAll('SELECT * FROM sbs_rates WHERE fecha = ?', [date]);
        if (cached && cached.length > 0) {
            return {
                compra: cached[0].compra,
                venta: cached[0].venta,
                fecha: date,
                is_cached: true
            };
        }
    } catch (dbError) {
        console.error('[SBS SERVICE] DB Cache lookup error:', dbError.message);
    }

    // 2. Fetch from external API
    console.log(`[SBS SERVICE] Fetching TC for ${date} (depth: ${depth})...`);
    const rate = await fetchExchangeRateFromApi(date);
    if (rate) {
        try {
            // Save to local cache
            await dbManager.run('INSERT OR REPLACE INTO sbs_rates (fecha, compra, venta) VALUES (?, ?, ?)', [
                date,
                rate.compra,
                rate.venta
            ]);
            console.log(`[SBS SERVICE] Cached TC for ${date}: Compra: ${rate.compra}, Venta: ${rate.venta}`);
        } catch (dbError) {
            console.error('[SBS SERVICE] Error saving TC to DB:', dbError.message);
        }
        return {
            compra: rate.compra,
            venta: rate.venta,
            fecha: date
        };
    }

    // 3. Fallback: query previous day
    const prevDate = new Date(new Date(date + 'T12:00:00').getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return getExchangeRate(prevDate, depth + 1);
}

module.exports = {
    getExchangeRate
};
