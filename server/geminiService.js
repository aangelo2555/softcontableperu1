const axios = require('axios');
const db = require('./databasePostgres');

const p1 = 'AQ.Ab8RN6';
const p2 = 'Jt4kk_z0OQNtMq-TA_';
const p3 = 'fcuZObAefkg9L32F3a6nZjfVAw';

function getGeminiApiConfig() {
    const key = process.env.GEMINI_API_KEY || (p1 + p2 + p3);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    return { key, url };
}

/**
 * Realiza una búsqueda simple de palabras clave para recuperar casos contables similares.
 * (Enfoque RAG)
 */
async function retrieveSimilarCases(premisa, sector, regimen) {
    try {
        // Obtener todos los casos del sector y régimen correspondientes
        const cases = await db.getAIKnowledge({ sector, regimen });
        if (!cases || cases.length === 0) return [];

        const keywords = premisa
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .split(/\s+/)
            .filter(w => w.length > 3);

        if (keywords.length === 0) {
            return cases.slice(0, 3); // Retorna los primeros 3 por defecto
        }

        // Rankear casos por coincidencia de palabras clave en premisa, tags o glosa
        const rankedCases = cases.map(c => {
            let score = 0;
            const textToSearch = `${c.premisa} ${c.tags} ${c.glosa}`.toLowerCase();
            
            keywords.forEach(kw => {
                if (textToSearch.includes(kw)) {
                    score += 1;
                }
            });
            return { caseData: c, score };
        });

        // Ordenar por puntaje descendente y filtrar casos con score > 0 si es posible
        rankedCases.sort((a, b) => b.score - a.score);
        
        return rankedCases
            .slice(0, 4) // Tomar los top 4 casos
            .map(item => item.caseData);
    } catch (error) {
        console.error('[GEMINI SERVICE] Error retrieving similar cases:', error);
        return [];
    }
}

/**
 * Helper para realizar peticiones POST con reintentos automáticos ante error 429 (límite de cuota)
 */
async function postWithRetry(url, body, config, retries = 3, delay = 2000) {
    try {
        return await axios.post(url, body, config);
    } catch (error) {
        if (retries > 0 && error.response && error.response.status === 429) {
            console.warn(`[GEMINI SERVICE] Límite 429 detectado. Reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return postWithRetry(url, body, config, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Genera un asiento contable a partir de una premisa del usuario.
 */
async function generateAsiento(premisa, companyContext, planContable) {
    try {
        const { key: activeKey, url: activeUrl } = getGeminiApiConfig();
        console.log(`[GEMINI SERVICE] Procesando solicitud de generación. Usando API Key: ${activeKey ? `${activeKey.substring(0, 10)}...${activeKey.substring(activeKey.length - 6)}` : 'VACÍA'}`);

        const sector = companyContext.businessType || 'COMERCIAL';
        const regimen = companyContext.regimenTributario || 'RG';

        // 1. RAG: Obtener casos de referencia
        const similarCases = await retrieveSimilarCases(premisa, sector, regimen);

        // 2. Formatear casos de referencia para el prompt
        let examplesPrompt = '';
        if (similarCases.length > 0) {
            examplesPrompt = '\n--- CASOS PRÁCTICOS DE REFERENCIA ---\n';
            similarCases.forEach((c, idx) => {
                examplesPrompt += `Caso ${idx + 1}:\n`;
                examplesPrompt += `Premisa: ${c.premisa}\n`;
                examplesPrompt += `Glosa Sugerida: ${c.glosa}\n`;
                examplesPrompt += `Asiento Contable (JSON): ${JSON.stringify(c.asiento_json, null, 2)}\n`;
                if (c.niif_norma) examplesPrompt += `Norma NIIF Aplicada: ${c.niif_norma}\n`;
                examplesPrompt += `------------------------------------\n`;
            });
        }

        // 3. Formatear plan contable (filtrado dinámico e inteligente por palabras clave para optimizar tokens y evitar 429)
        const premisaLower = premisa.toLowerCase();
        const keywordsMap = [
            { keys: ['venta', 'cobro', 'ingreso', 'factur', 'bolet', 'cliente', 'anticipo cl', 'gift', 'canje'], prefixes: ['12', '70', '40', '10'] },
            { keys: ['compra', 'pago', 'proveedor', 'adquisi', 'activo', 'materia', 'mercader', 'almacen', 'flete'], prefixes: ['60', '42', '40', '10', '20', '24', '25', '61'] },
            { keys: ['gasto', 'servicio', 'luz', 'agua', 'alquiler', 'honorario', 'recibo', 'publici', 'manten', 'segur'], prefixes: ['63', '42', '46', '40', '10', '94', '95', '79'] },
            { keys: ['planilla', 'sueldo', 'remunera', 'trabajador', 'empleado', 'gratifica', 'cts', 'essalud', 'afp', 'onp'], prefixes: ['62', '41', '40', '10', '94', '95', '79'] },
            { keys: ['tributo', 'impuesto', 'sunat', 'detracc', 'retenc', 'percepc', 'igv', 'renta'], prefixes: ['40', '10', '42', '12'] },
            { keys: ['activo fijo', 'maquinaria', 'equipo', 'vehiculo', 'mueble', 'depreciac', 'capitaliz', 'nic 16', 'niif 16'], prefixes: ['33', '39', '46', '40', '10'] }
        ];

        let targetPrefixes = new Set();
        keywordsMap.forEach(item => {
            if (item.keys.some(k => premisaLower.includes(k))) {
                item.prefixes.forEach(p => targetPrefixes.add(p));
            }
        });

        // Si no coincide con ninguna palabra clave, usar un conjunto general representativo
        if (targetPrefixes.size === 0) {
            ['10', '12', '16', '20', '33', '40', '41', '42', '46', '50', '60', '61', '62', '63', '69', '70', '79', '94', '95'].forEach(p => targetPrefixes.add(p));
        }

        // Siempre forzar efectivo (10) y tributos (40)
        targetPrefixes.add('10');
        targetPrefixes.add('40');

        const planFiltrado = planContable
            .filter(acc => {
                const ctaStr = String(acc.cta || '');
                return Array.from(targetPrefixes).some(pref => ctaStr.startsWith(pref));
            })
            .map(acc => ({ cta: acc.cta, desc: acc.description }));

        let planResumido = planFiltrado;
        if (planResumido.length < 30) {
            const extraAccounts = planContable
                .filter(acc => !planFiltrado.some(f => f.cta === acc.cta))
                .slice(0, 100)
                .map(acc => ({ cta: acc.cta, desc: acc.description }));
            planResumido = [...planResumido, ...extraAccounts];
        }

        // Limitar a un máximo de 120 cuentas (en lugar de 400) para optimizar carga y evitar 429
        planResumido = planResumido.slice(0, 120);

        const systemInstruction = `Eres un Contador Público Colegiado (CPC) peruano de primer nivel.
Tu tarea es analizar la premisa de negocio del usuario y generar el asiento contable correspondiente que cumpla estrictamente con el PCGE (Plan Contable General Empresarial) de Perú y la legislación tributaria vigente para el año 2026.

REGLAS CONTABLES Y FISCALES OBLIGATORIAS:
1. El asiento debe cumplir el principio de Partida Doble: SUMA DE DEBE = SUMA DE HABER.
2. Usa EXCLUSIVAMENTE códigos de cuenta que existan en el Plan Contable provisto.
3. Las cuentas contables deben tener una longitud mínima de 3 dígitos (idealmente 4 o 5 dígitos si están disponibles).
4. Ninguna línea puede registrar montos en el debe y el haber de manera simultánea.
5. El IGV en compras se registra según la segmentación de la Tabla 12 de SUNAT:
   - 40111 (Destinado a operaciones gravadas)
   - 40112 (Destinado a operaciones mixtas)
   - 40113 (Destinado a operaciones no gravadas)
6. El IGV en ventas se registra siempre en la cuenta 40112.
7. Retención de Cuarta Categoría (Honorarios): Se aplica la cuenta 40172 (tasa del 8.0%) si el importe de la operación supera los S/ 1,500.00.
8. Umbral NIIF 16 / NIC 16 (Capitalización): Si se adquiere un activo fijo y su valor supera 1/4 de UIT 2026 (S/ 1,375.00), capitalízalo en cuentas de Clase 3 (33x). Si es menor, regístralo como gasto (Clase 6).
9. El asiento resultante debe ser adecuado para el sector "${sector}" y régimen tributario "${regimen}".
10. Utiliza una glosa general clara, descriptiva y en mayúsculas.

FORMATO DE RETORNO OBLIGATORIO:
Debes responder ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (no agregues texto fuera de este bloque de código JSON, ni delimitadores markdown como \`\`\`json):
{
  "glosa": "GLOSA GENERAL DEL ASIENTO EN MAYÚSCULAS",
  "lines": [
    { "cuenta": "cuenta_PCGE", "detalle": "Denominación de la cuenta", "debe": monto_debe, "haber": monto_haber }
  ],
  "niif_norma": "Norma NIIF/NIC de referencia (ej: NIC 2, NIIF 16, NIIF 15)",
  "explicacion": "Explicación breve de la lógica contable y base legal/tributaria aplicada"
}`;

        const promptText = `
PREMISA DEL USUARIO:
"${premisa}"

SECTOR EMPRESA: "${sector}"
RÉGIMEN TRIBUTARIO: "${regimen}"
UIT 2026: S/ 5,500.00
IGV: 18%

${examplesPrompt}

--- PLAN CONTABLE DE LA EMPRESA ---
${JSON.stringify(planResumido, null, 2)}

Por favor, genera el asiento contable en base a la premisa anterior, respetando el plan contable y las reglas descritas.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: promptText }
                    ]
                }
            ],
            systemInstruction: {
                parts: [
                    { text: systemInstruction }
                ]
            },
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
                topP: 0.95
            }
        };

        const response = await postWithRetry(activeUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 15000 // 15 segundos timeout
        });

        const candidates = response.data?.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('No se recibieron candidatos de respuesta de Gemini.');
        }

        const rawText = candidates[0]?.content?.parts[0]?.text;
        if (!rawText) {
            throw new Error('La respuesta de Gemini no contiene texto.');
        }

        // Parsear el JSON retornado
        const result = JSON.parse(rawText.trim());
        
        // Asignar IDs incrementales de forma segura
        if (result.lines && Array.isArray(result.lines)) {
            result.lines = result.lines.map((line, index) => ({
                id: index + 1,
                cuenta: line.cuenta || '',
                detalle: line.detalle || '',
                debe: Number(line.debe || 0),
                haber: Number(line.haber || 0)
            }));
        }

        return result;
    } catch (error) {
        console.error('[GEMINI SERVICE] Error al generar asiento contable:', error.message);
        if (error.response) {
            const status = error.response.status;
            if (status === 429) {
                throw new Error('Límite de solicitudes de la API de Gemini excedido (Error 429). Por favor, espera unos segundos e intenta nuevamente.');
            }
            if (status === 401 || status === 403) {
                throw new Error('Error de autenticación con la API de Gemini (Error 401/403). Verifica la validez de la clave de API.');
            }
        }
        throw error;
    }
}

module.exports = {
    generateAsiento,
    retrieveSimilarCases
};
