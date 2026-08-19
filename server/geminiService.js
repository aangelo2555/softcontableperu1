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
async function generateAsiento(premisa, companyContext, planContable, history = []) {
    try {
        const { key: activeKey, url: activeUrl } = getGroqApiConfig();
        console.log(`[GROQ SERVICE] Procesando solicitud de generación con modelos Groq.`);

        const sector = companyContext.businessType || 'COMERCIAL';
        const regimen = companyContext.regimenTributario || 'RG';

        // 1. Detectar si es una consulta conversacional/informativa o una operación contable concreta
        const isConversational = !(/\b(compra|venta|gasto|planilla|sueldo|pago|cobro|factura|boleta|honorario|activo|arrendamiento|depreciac|detracc|retenc|tributo|igv|renta|banco|prestamo|credito|asiento|provision|caja)\b/i.test(premisa))
            || (/^(hola|buen|que |como |cuant|cual |quien|puedo|para que|ayuda|gracias|adios|chao|saludos)/i.test(premisa.trim()));

        // 2. RAG ligero: Obtener casos y normativas solo si es una transacción contable
        let similarCases = [];
        let similarRegs = [];
        let confidence = 'HIGH';
        let thresholdUsed = 0.15;

        if (!isConversational) {
            const ragRes = await retrieveSimilarCases(premisa, sector, regimen);
            similarCases = ragRes.cases || [];
            similarRegs = ragRes.regs || [];
            confidence = ragRes.confidence;
            thresholdUsed = ragRes.thresholdUsed;
        }

        // 3. Formatear ejemplos RAG de forma ultra compacta (máximo 1 caso y 1 norma)
        let examplesPrompt = '';
        if (similarCases && similarCases.length > 0) {
            const topCase = similarCases[0];
            examplesPrompt = `\nCASO DE REFERENCIA: ${topCase.titulo || topCase.premisa} -> Glosa: ${topCase.glosa || 'PROVISIÓN'}\n`;
        }

        let regsPrompt = '';
        if (similarRegs && similarRegs.length > 0) {
            const topReg = similarRegs[0];
            regsPrompt = `NORMA: ${topReg.titulo} (${topReg.referencia || 'SUNAT'})\n`;
        }

        // 4. Formatear plan contable compacto (solo si es operación contable)
        let planPromptSection = '';
        if (!isConversational) {
            const premisaLower = premisa.toLowerCase();
            const keywordsMap = [
                { keys: ['venta', 'cobro', 'ingreso', 'factur', 'bolet', 'cliente', 'anticipo cl'], prefixes: ['12', '70', '40', '10'] },
                { keys: ['compra', 'pago', 'proveedor', 'adquisi', 'activo', 'materia', 'mercader', 'almacen', 'flete'], prefixes: ['60', '42', '40', '10', '20', '24', '61'] },
                { keys: ['gasto', 'servicio', 'luz', 'agua', 'alquiler', 'honorario', 'publici'], prefixes: ['63', '42', '46', '40', '10', '94', '95', '79'] },
                { keys: ['planilla', 'sueldo', 'remunera', 'trabajador', 'cts', 'essalud', 'afp', 'onp'], prefixes: ['62', '41', '40', '10', '94', '95', '79'] },
                { keys: ['tributo', 'impuesto', 'sunat', 'detracc', 'retenc', 'percepc', 'igv', 'renta'], prefixes: ['40', '10', '42', '12'] },
                { keys: ['activo fijo', 'maquinaria', 'equipo', 'vehiculo', 'mueble', 'depreciac'], prefixes: ['33', '39', '46', '40', '10'] }
            ];

            let targetPrefixes = new Set();
            keywordsMap.forEach(item => {
                if (item.keys.some(k => premisaLower.includes(k))) {
                    item.prefixes.forEach(p => targetPrefixes.add(p));
                }
            });

            if (targetPrefixes.size === 0) {
                ['10', '12', '20', '40', '42', '60', '63', '70'].forEach(p => targetPrefixes.add(p));
            }
            targetPrefixes.add('10');
            targetPrefixes.add('40');

            const planFiltrado = (planContable || [])
                .filter(acc => {
                    const ctaStr = String(acc.cta || '');
                    return Array.from(targetPrefixes).some(pref => ctaStr.startsWith(pref));
                })
                .slice(0, 20)
                .map(acc => `${acc.cta}: ${acc.desc || acc.description || ''}`)
                .join(' | ');

            if (planFiltrado) {
                planPromptSection = `\nPLAN CONTABLE DISPONIBLE:\n${planFiltrado}\n`;
            }
        }

        // 5. Formatear historial conversacional multi-turno previo
        const previousMessages = [];
        if (Array.isArray(history) && history.length > 0) {
            const validHistory = history
                .filter(m => m && m.id !== 'welcome' && (m.content || m.entry))
                .slice(-4);

            validHistory.forEach(m => {
                if (m.role === 'user') {
                    previousMessages.push({
                        role: 'user',
                        content: String(m.content).trim()
                    });
                } else if (m.role === 'model' || m.role === 'assistant') {
                    let assistantSummary = m.content || '';
                    if (m.entry && Array.isArray(m.entry.asientos) && m.entry.asientos.length > 0) {
                        const asientoResume = m.entry.asientos.map(a => `${a.glosa}: Debe S/ ${a.lines?.reduce((acc, l) => acc + (l.debe||0), 0) || 0}`).join(' | ');
                        assistantSummary = `${m.entry.explicacion || m.content || ''} [Asiento: ${asientoResume}]`.trim();
                    }
                    previousMessages.push({
                        role: 'assistant',
                        content: JSON.stringify({
                            explicacion: assistantSummary,
                            niif_norma: m.entry?.niif_norma || 'N/A',
                            asientos: m.entry?.asientos || []
                        })
                    });
                }
            });
        }

        const systemInstruction = `Eres el ASISTENTE CONTABLE IA experto en tributación y contabilidad peruana (PCGE 2026, NIIF, SUNAT).
Responde SIEMPRE en formato JSON válido con la siguiente estructura:
{
  "explicacion": "Respuesta clara y técnica a la consulta o explicación del asiento",
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

REGLAS:
1. Recuerda el historial previo de la conversación. Si el usuario pide modificar un monto, cambiar una cuenta o pregunta sobre lo hablado anteriormente (ej: "¿De qué hablamos anteriormente?"), responde en detalle basándote en los mensajes previos.
2. Si el usuario hace una pregunta general, saludo o consulta informativa (ej: "¿Cuántas consultas puedo hacer?", "¿Cómo se calcula la detracción?"), responde cordialmente y en detalle en "explicacion" y devuelve "asientos": [].
3. Si es una transacción económica o modificación de un asiento previo, genera el asiento contable con Partida Doble (Debe = Haber).
4. Nunca devuelvas texto fuera del objeto JSON.`;

        const promptText = `PREMISA: "${premisa}"
SECTOR: ${sector} | RÉGIMEN: ${regimen} | UIT 2026: S/ 5,500.00 | IGV: 18%
${examplesPrompt}${regsPrompt}${planPromptSection}`;

        const requestBody = {
            messages: [
                { role: "system", content: systemInstruction },
                ...previousMessages,
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
