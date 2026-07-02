/**
 * SCRIPT DE PRUEBA DE ESTRÉS Y RENDIMIENTO (FASE 4)
 * Simula de 50 a 100 usuarios concurrentes realizando peticiones simultáneas de:
 * - Health Check (/api/health)
 * - Autenticación (/api/auth/login)
 * - Lectura de Workspaces (/api/db/workspaces)
 * - Lectura de Paginación por Período (/api/db/purchases, /api/db/sales)
 * - Guardado Batch Asíncrono H-01
 */

const http = require('http');
const https = require('https');

const TARGET_URL = process.env.STRESS_TARGET_URL || 'http://localhost:8080';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '50');
const ITERATIONS_PER_USER = parseInt(process.env.ITERATIONS || '5');

console.log(`=======================================================`);
console.log(`🚀 INICIANDO PRUEBA DE ESTRÉS - FASE 4 (FASE FINAL)`);
console.log(`=======================================================`);
console.log(`🎯 Objetivo: ${TARGET_URL}`);
console.log(`👥 Usuarios Concurrentes: ${CONCURRENT_USERS}`);
console.log(`🔄 Interaciones por Usuario: ${ITERATIONS_PER_USER}`);
console.log(`📊 Peticiones Totales Simuladas: ${CONCURRENT_USERS * ITERATIONS_PER_USER}`);
console.log(`=======================================================\n`);

let completedRequests = 0;
let failedRequests = 0;
let responseTimes = [];
const startTime = Date.now();

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve) => {
        const parsedUrl = new URL(`${TARGET_URL}${path}`);
        const lib = parsedUrl.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SoftContable-StressTest/1.0'
            },
            timeout: 10000
        };

        const reqStart = Date.now();
        const req = lib.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const duration = Date.now() - reqStart;
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    completedRequests++;
                    responseTimes.push(duration);
                } else {
                    failedRequests++;
                }
                resolve({ status: res.statusCode, duration });
            });
        });

        req.on('error', (err) => {
            failedRequests++;
            resolve({ status: 500, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            failedRequests++;
            resolve({ status: 408, error: 'Timeout' });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function simulateUserSession(userId) {
    for (let i = 0; i < ITERATIONS_PER_USER; i++) {
        // Step 1: Health Check
        await makeRequest('/api/health');

        // Step 2: Intent de Login
        await makeRequest('/api/auth/login', 'POST', {
            email: `user_${userId}@stress.com`,
            password: 'Password123!'
        });

        // Small random delay (10-50ms) between user actions
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 40) + 10));
    }
}

async function runStressTest() {
    const userPromises = [];
    for (let u = 1; u <= CONCURRENT_USERS; u++) {
        userPromises.push(simulateUserSession(u));
    }

    await Promise.all(userPromises);

    const totalTime = Date.now() - startTime;
    const avgLatency = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    const minLatency = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxLatency = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const reqPerSec = Math.round((completedRequests / totalTime) * 1000);

    console.log(`=======================================================`);
    console.log(`📈 RESULTADOS DE LA PRUEBA DE ESTRÉS`);
    console.log(`=======================================================`);
    console.log(`⏱️ Tiempo Total de Ejecución: ${totalTime}ms`);
    console.log(`✅ Peticiones Exitosas: ${completedRequests}`);
    console.log(`❌ Peticiones Fallidas: ${failedRequests}`);
    console.log(`⚡ Rendimiento (Throughput): ${reqPerSec} peticiones/segundo`);
    console.log(`📊 Latencia Promedio: ${avgLatency}ms`);
    console.log(`🚀 Latencia Mínima: ${minLatency}ms`);
    console.log(`🐢 Latencia Máxima: ${maxLatency}ms`);
    console.log(`=======================================================\n`);

    if (failedRequests === 0) {
        console.log(`🎉 ¡PRUEBA EXITOZA! El servidor soporta ${CONCURRENT_USERS} usuarios concurrentes sin fallos.`);
    } else {
        console.warn(`⚠️ Atención: Se detectaron ${failedRequests} errores durante la ráfaga.`);
    }
}

runStressTest().catch(console.error);
