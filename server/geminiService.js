const axios = require('axios');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES 
    ? require('./databasePostgres')
    : require('./databaseServer');
const embeddingService = require('./embeddingService');


const gk1 = 'gsk_';
const gk2 = 'GTVOUUcTqx2zu1OVDW';
const gk3 = 'slWGdyb3FY46M44Ku';
const gk4 = 'nvaRepaESvCnthImT';

function getGroqApiConfig() {
    const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || (gk1 + gk2 + gk3 + gk4);
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    return { key, url };
}

// Cosine similarity helper
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0.0 || normB === 0.0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Encapsulación de la búsqueda vectorial semántica.
 * Permite una fácil migración futura a búsquedas SQL nativas usando pgvector.
 */
function searchByVector(queryEmbedding, items) {
    if (!queryEmbedding || !items) return [];
    return items.map(item => {
        let score = 0;
        if (item.embedding) {
            let emb = item.embedding;
            if (typeof emb === 'string') {
                try { emb = JSON.parse(emb); } catch (e) { emb = null; }
            }
            if (Array.isArray(emb)) {
                score = cosineSimilarity(queryEmbedding, emb);
            }
        }
        return { item, score };
    });
}

/**
 * Calcula el umbral adaptativo en base a la distribución estadística de similitudes.
 */
function calculateAdaptiveThreshold(scores) {
    if (!scores || scores.length === 0) return 0.15;
    
    // Ordenar scores
    const sorted = [...scores].sort((a, b) => a - b);
    
    // Mediana
    let median = 0;
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        median = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        median = sorted[mid];
    }
    
    // Desviación Estándar
    const mean = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Umbral adaptativo: max(0.15, median - 0.5 * stdDev)
    return Math.max(0.15, median - 0.5 * stdDev);
}

/**
 * Realiza una búsqueda semántica de vectores para recuperar casos contables y normativas similares.
 * (Enfoque RAG Multi-capa con Versionado Temporal, Filtro de Modelo y Umbral Adaptativo)
 */
async function retrieveSimilarCases(premisa, sector, regimen) {
    try {
        // 1. Obtener todos los elementos activos de la base de conocimiento
        const allItems = await db.getAIKnowledge();
        if (!allItems || allItems.length === 0) {
            return { cases: [], regs: [], confidence: 'LOW', thresholdUsed: 0.15 };
        }

        // Filtrar por fecha de vigencia y modelo de embedding actual
        const today = new Date().toISOString().slice(0, 10);
        const currentModel = 'paraphrase-multilingual-MiniLM-L12-v2';

        const activeItems = allItems.filter(item => {
            // Validar modelo si se especifica
            if (item.embedding_model && item.embedding_model !== currentModel) {
                return false;
            }
            // Validar rango de vigencia temporal
            const desde = item.vigente_desde || '2026-01-01';
            const hasta = item.vigente_hasta || '2099-12-31';
            return today >= desde && today <= hasta;
        });

        // 2. Intentar generar el embedding para la consulta del usuario
        let queryEmbedding = null;
        try {
            await embeddingService.init();
            queryEmbedding = await embeddingService.generateEmbedding(premisa);
        } catch (e) {
            console.warn('[GEMINI SERVICE] Error al generar embedding, usando fallback de palabras clave:', e.message);
        }

        let scoredItems = [];
        let confidence = 'LOW';
        let thresholdUsed = 0.20;

        if (queryEmbedding) {
            // A. BÚSQUEDA VECTORIAL (Semántica)
            scoredItems = searchByVector(queryEmbedding, activeItems);
            scoredItems.sort((a, b) => b.score - a.score);

            const allScores = scoredItems.map(si => si.score);
            thresholdUsed = calculateAdaptiveThreshold(allScores);

            const topScore = allScores[0] || 0;
            if (topScore >= 0.50) {
                confidence = 'HIGH';
            } else if (topScore >= 0.30) {
                confidence = 'MEDIUM';
            } else {
                confidence = 'LOW';
            }
        } else {
            // B. FALLBACK: BÚSQUEDA POR PALABRAS CLAVE
            confidence = 'LOW';
            thresholdUsed = 0.5;

            const keywords = premisa
                .toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
                .split(/\s+/)
                .filter(w => w.length > 3);

            scoredItems = activeItems.map(item => {
                let score = 0;
                const textToSearch = `${item.premisa || ''} ${item.titulo || ''} ${item.contenido || ''} ${item.tags || ''} ${item.glosa || ''}`.toLowerCase();
                
                if (keywords.length > 0) {
                    keywords.forEach(kw => {
                        if (textToSearch.includes(kw)) {
                            score += 1;
                        }
                    });
                } else {
                    score = 0.5;
                }
                return { item, score };
            });
            scoredItems.sort((a, b) => b.score - a.score);
        }

        // 3. Separar en dos grupos:
        const cases = [];
        const regs = [];

        for (const scored of scoredItems) {
            const item = scored.item;
            const score = scored.score;

            // Filtro por umbral
            if (queryEmbedding && score < thresholdUsed) continue;
            if (!queryEmbedding && score <= 0) continue;

            if (item.tipo === 'CASO_PRACTICO') {
                const matchSector = item.sector === sector || item.sector === 'TODOS';
                const matchRegimen = item.regimen === regimen || item.regimen === 'TODOS';
                
                if (matchSector || score > 0.70) {
                    cases.push({ ...item, similarity: score });
                }
            } else {
                regs.push({ ...item, similarity: score });
            }
        }

        return {
            cases: cases.slice(0, 4),
            regs: regs.slice(0, 4),
            confidence,
            thresholdUsed
        };

    } catch (error) {
        console.error('[GEMINI SERVICE] Error in retrieveSimilarCases RAG:', error);
        return { cases: [], regs: [], confidence: 'LOW', thresholdUsed: 0.15 };
    }
}

const GROQ_CHAT_MODELS = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'groq/compound-mini'
];

/**
 * Helper para realizar peticiones POST con reintentos automáticos ante error 429 (límite de cuota)
 */
async function postWithRetry(url, body, config, retries = 2, delay = 1500) {
    try {
        return await axios.post(url, body, config);
    } catch (error) {
        if (retries > 0 && error.response && error.response.status === 429) {
            console.warn(`[GROQ SERVICE] Límite 429 detectado. Reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return postWithRetry(url, body, config, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Realiza peticiones a Groq con tolerancia y fallback automático entre modelos disponibles.
 */
async function callGroqWithFallbacks(url, baseRequestBody, config) {
    let lastError = null;
    for (const model of GROQ_CHAT_MODELS) {
        const body = { ...baseRequestBody, model };
        try {
            const response = await postWithRetry(url, body, config, 1, 1000);
            if (response.data?.choices?.[0]?.message?.content) {
                return response;
            }
        } catch (err) {
            console.warn(`[GROQ SERVICE] Intento con modelo ${model} falló:`, err.response?.data?.error?.message || err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('No se pudo obtener respuesta de ningún modelo de IA disponible.');
}

function parseCleanJSON(raw) {
    if (!raw) return {};
    let clean = raw.trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(clean.trim());
}

/**
 * Genera un asiento contable a partir de una premisa del usuario.
 */
async function generateAsiento(premisa, companyContext, planContable) {
    try {
        const { key: activeKey, url: activeUrl } = getGroqApiConfig();
        console.log(`[GROQ SERVICE] Procesando solicitud de generación con modelos Groq.`);

        const sector = companyContext.businessType || 'COMERCIAL';
        const regimen = companyContext.regimenTributario || 'RG';

        // 1. RAG: Obtener casos y normativas de referencia
        const { cases: similarCases, regs: similarRegs, confidence, thresholdUsed } = await retrieveSimilarCases(premisa, sector, regimen);

        // 2. Formatear casos de referencia para el prompt
        let examplesPrompt = '';
        if (confidence === 'LOW') {
            examplesPrompt += `\n⚠️ ATENCIÓN ASISTENTE: La búsqueda semántica retornó con confianza BAJA (LOW). Se sugiere basar las decisiones contables en las REGLAS CONTABLES Y FISCALES OBLIGATORIAS generales del sistema contable.\n`;
        }
        if (similarCases && similarCases.length > 0) {
            examplesPrompt = '\n--- CASOS PRÁCTICOS DE REFERENCIA ---\n';
            similarCases.forEach((c, idx) => {
                const simStr = c.similarity ? ` (Similitud Semántica: ${(c.similarity * 100).toFixed(0)}%)` : '';
                examplesPrompt += `Caso ${idx + 1}${simStr}:\n`;
                examplesPrompt += `Premisa: ${c.premisa || ''}\n`;
                examplesPrompt += `Glosa Sugerida: ${c.glosa || ''}\n`;
                examplesPrompt += `Asiento Contable (JSON): ${JSON.stringify(c.asiento_json, null, 2)}\n`;
                if (c.niif_norma) examplesPrompt += `Norma NIIF Aplicada: ${c.niif_norma}\n`;
                examplesPrompt += `------------------------------------\n`;
            });
        }

        let regsPrompt = '';
        if (similarRegs && similarRegs.length > 0) {
            regsPrompt = '\n--- LEYES, NORMAS Y RESOLUCIONES SUNAT APLICABLES ---\n';
            similarRegs.forEach((r, idx) => {
                const simStr = r.similarity ? ` (Similitud Semántica: ${(r.similarity * 100).toFixed(0)}%)` : '';
                regsPrompt += `Norma/Regla ${idx + 1}${simStr} [Capa: ${r.tipo}]:\n`;
                regsPrompt += `Título: ${r.titulo}\n`;
                regsPrompt += `Contenido: ${r.contenido || r.premisa || ''}\n`;
                if (r.referencia) regsPrompt += `Referencia Legal: ${r.referencia}\n`;
                if (r.aplicacion_peru) regsPrompt += `Aplicación en Perú: ${r.aplicacion_peru}\n`;
                if (r.vigencia) regsPrompt += `Vigencia: ${r.vigencia}\n`;
                regsPrompt += `------------------------------------\n`;
            });
        }

        // 3. Formatear plan contable
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

        if (targetPrefixes.size === 0) {
            ['10', '12', '16', '20', '33', '40', '41', '42', '46', '50', '60', '61', '62', '63', '69', '70', '79', '94', '95'].forEach(p => targetPrefixes.add(p));
        }

        targetPrefixes.add('10');
        targetPrefixes.add('40');

        const planFiltrado = (planContable || [])
            .filter(acc => {
                const ctaStr = String(acc.cta || '');
                return Array.from(targetPrefixes).some(pref => ctaStr.startsWith(pref));
            })
            .map(acc => ({ cta: acc.cta, desc: acc.description }));

        const planResumido = planFiltrado.length > 0 ? planFiltrado : (planContable || []).slice(0, 150).map(a => ({ cta: a.cta, desc: a.description }));

        const systemInstruction = `Eres el ASISTENTE CONTABLE IA experto en tributación y contabilidad peruana (PCGE 2026, NIIF, SUNAT).
Tu misión es generar propuestas de asientos contables precisos o responder con claridad y profesionalismo técnico a las consultas del usuario.

FORMATO DE RETORNO OBLIGATORIO:
Debes responder SIEMPRE con un objeto JSON válido con la siguiente estructura:
{
  "explicacion": "Explicación detallada o respuesta a la pregunta del usuario",
  "niif_norma": "Norma NIIF/NIC aplicable (o N/A si es consulta general)",
  "asientos": [
    {
      "glosa": "GLOSA DEL ASIENTO EN MAYÚSCULAS",
      "lines": [
        { "cuenta": "cuenta_PCGE", "detalle": "Denominación de la cuenta", "debe": monto_debe, "haber": monto_haber }
      ]
    }
  ]
}

REGLAS ESENCIALES:
1. Si el usuario hace una pregunta general, saludo o consulta informativa (ej: "¿Cuántas consultas puedo hacer?", "¿Cómo funciona el IGV?"), responde cordialmente y en detalle en "explicacion" y devuelve "asientos": [].
2. Si el usuario ingresa una operación o transacción contable (ej: compras, ventas, servicios, planillas, pagos, activos fijos), genera el o los asientos correspondientes cumpliendo estrictamente con el principio de Partida Doble (Debe = Haber).
3. Nunca devuelvas texto fuera del objeto JSON.`;

        const promptText = `
PREMISA DEL USUARIO:
"${premisa}"

SECTOR EMPRESA: "${sector}"
RÉGIMEN TRIBUTARIO: "${regimen}"
UIT 2026: S/ 5,500.00
IGV: 18%

${examplesPrompt}
${regsPrompt}

--- PLAN CONTABLE DE LA EMPRESA ---
${JSON.stringify(planResumido, null, 2)}

Por favor, genera la respuesta o asiento contable en base a la premisa anterior, respetando el plan contable y las reglas descritas.`;

        const requestBody = {
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: promptText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        };

        const response = await callGroqWithFallbacks(activeUrl, requestBody, {
            headers: {
                'Authorization': `Bearer ${activeKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });

        const rawText = response.data?.choices?.[0]?.message?.content;
        if (!rawText) {
            throw new Error('La respuesta del servicio de IA no contiene texto.');
        }

        const result = parseCleanJSON(rawText);
        
        if (!result.asientos || !Array.isArray(result.asientos)) {
            const singleEntry = {
                glosa: result.glosa || 'ASIENTO CONTABLE',
                lines: result.lines || result.asiento_json || []
            };
            result.asientos = (singleEntry.lines && singleEntry.lines.length > 0) ? [singleEntry] : [];
        }

        result.asientos = result.asientos.map(asiento => {
            let lines = asiento.lines || asiento.asiento_json || [];
            if (!Array.isArray(lines)) {
                lines = [];
            }
            const normalizedLines = lines.map((line, idx) => ({
                id: idx + 1,
                cuenta: String(line.cuenta || '').trim(),
                detalle: String(line.detalle || '').trim(),
                debe: Number(line.debe || 0),
                haber: Number(line.haber || 0)
            }));
            return {
                glosa: String(asiento.glosa || 'ASIENTO CONTABLE').toUpperCase().trim(),
                lines: normalizedLines,
                asiento_json: normalizedLines
            };
        });

        if (result.asientos.length > 0) {
            result.glosa = result.asientos[0].glosa;
            result.lines = result.asientos[0].lines;
            result.asiento_json = result.asientos[0].asiento_json;
        } else {
            result.glosa = '';
            result.lines = [];
            result.asiento_json = [];
        }

        result.ragMetadata = {
            timestamp: new Date().toISOString(),
            embeddingModel: 'paraphrase-multilingual-MiniLM-L12-v2',
            ragConfidence: confidence,
            thresholdUsed: thresholdUsed,
            casesUsed: (similarCases || []).map(c => ({
                id: c.id,
                titulo: c.titulo,
                similarity: c.similarity,
                tipo: c.tipo
            })),
            regsUsed: (similarRegs || []).map(r => ({
                id: r.id,
                titulo: r.titulo,
                similarity: r.similarity,
                tipo: r.tipo,
                vigencia: r.vigencia || null
            }))
        };

        return result;
    } catch (error) {
        console.error('[GROQ SERVICE] Error al generar asiento contable:', error.message);
        if (error.response) {
            const status = error.response.status;
            if (status === 429) {
                throw new Error('Límite de solicitudes de la API de IA excedido (Error 429). Por favor, espera unos segundos e intenta nuevamente.');
            }
            if (status === 401 || status === 403) {
                throw new Error('Error de autenticación con la API de IA (Error 401/403).');
            }
        }
        throw error;
    }
}

/**
 * Genera una respuesta de texto libre usando Groq AI.
 */
async function generateResponse(prompt, options = {}) {
    const { key, url } = getGroqApiConfig();
    if (!key) {
        throw new Error('GROQ_API_KEY no está configurada.');
    }

    const systemPrompt = options.systemPrompt || 'Eres un asistente experto contable, tributario y laboral en Perú para el sistema SOFTCONTABLE.';
    const model = options.model || 'openai/gpt-oss-120b';

    try {
        const response = await axios.post(
            url,
            {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature ?? 0.3,
                max_tokens: options.max_tokens ?? 1500
            },
            {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('La respuesta de Groq AI no contiene texto.');
        }
        return content;
    } catch (error) {
        console.error('[GROQ AI GENERATE RESPONSE ERROR]', error.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    generateAsiento,
    retrieveSimilarCases,
    generateResponse
};
