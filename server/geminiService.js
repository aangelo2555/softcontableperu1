const axios = require('axios');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES 
    ? require('./databasePostgres')
    : require('./databaseServer');
const embeddingService = require('./embeddingService');


function getGroqApiConfig() {
    const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || '';
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
const { callFreeAiWithCascade, generateText } = require('./services/aiRouterService');

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
        console.log(`[AI SERVICE] Procesando solicitud de generación de asiento con pool multi-IA gratuito.`);

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

        // 4. Formatear plan contable compacto con subcuentas analíticas (Mínimo 5 dígitos)
        let planPromptSection = '';
        if (!isConversational) {
            const premisaLower = premisa.toLowerCase();
            const keywordsMap = [
                { keys: ['venta', 'cobro', 'ingreso', 'factur', 'bolet', 'cliente', 'anticipo cl'], prefixes: ['121', '701', '401', '104', '101', '691', '201'] },
                { keys: ['compra', 'pago', 'proveedor', 'mercaderia', 'gasto', 'servicio', 'luz', 'agua', 'honorario'], prefixes: ['601', '631', '636', '632', '651', '401', '421', '104', '101', '201', '611'] },
                { keys: ['planilla', 'sueldo', 'remunerac', 'onp', 'afp', 'essalud', 'gratific', 'cts', 'vacac', 'quinta'], prefixes: ['621', '627', '403', '411', '415', '417', '104'] },
                { keys: ['activo', 'depreciac', 'maquinaria', 'equipo', 'mueble', 'vehiculo', 'computo'], prefixes: ['333', '335', '336', '391', '681', '401', '465', '104'] },
                { keys: ['detracc', 'spot', 'retenc', 'percepc'], prefixes: ['104', '421', '401'] },
                { keys: ['prestamo', 'interes', 'financier', 'banco', 'pagare'], prefixes: ['104', '451', '671', '373'] }
            ];

            const matchedPrefixes = new Set();
            for (const map of keywordsMap) {
                if (map.keys.some(k => premisaLower.includes(k))) {
                    map.prefixes.forEach(p => matchedPrefixes.add(p));
                }
            }

            if (matchedPrefixes.size === 0) {
                ['10', '12', '40', '42', '60', '63', '70'].forEach(p => matchedPrefixes.add(p));
            }

            let filteredPlan = [];
            if (Array.isArray(planContable) && planContable.length > 0) {
                filteredPlan = planContable.filter(c => {
                    const code = String(c.cuenta || c.code || '');
                    return Array.from(matchedPrefixes).some(pref => code.startsWith(pref));
                });
            }

            if (filteredPlan.length > 0) {
                const planSample = filteredPlan.slice(0, 45).map(c => `${c.cuenta || c.code}: ${c.descripcion || c.name}`).join(' | ');
                planPromptSection = `\nPLAN CONTABLE:\n${planSample}\n`;
            }
        }

        const systemInstruction = `Eres un Contador Público Colegiado (CPC) y Auditor Tributario experto en el Plan Contable General Empresarial (PCGE 2026) y la normativa SUNAT de Perú.
Debes responder SIEMPRE en formato JSON estricto sin markdown extra.

ESTRUCTURA DE RESPUESTA REQUERIDA:
{
  "asientos": [
    {
      "glosa": "GLOSA CLARA EN MAYÚSCULAS",
      "lines": [
        { "cuenta": "SUB-CUENTA OFICIAL (min 4 o 5 dígitos)", "detalle": "NOMBRE DE LA CUENTA", "debe": 0.00, "haber": 0.00 }
      ]
    }
  ],
  "explicacion": "Explicación técnica y sustento normativo",
  "base_legal": "Norma aplicable (ej: PCGE 2026, TUO LIR, TUO IGV)",
  "advertencias": []
}

REGLAS OBLIGATORIAS:
1. El total DEBE ser igual al total HABER en cada asiento.
2. Usa subcuentas oficiales a 4 o 5 dígitos según el PCGE 2026.
3. Si la transacción incluye IGV, separa la base imponible (Cta 60/70) y el IGV 18% (Cta 40111).
4. Incluye siempre los asientos de destino (Elemento 9 vs Cta 791) si se utiliza una cuenta de la clase 6.`;

        const previousMessages = (history || []).slice(-4).map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
        }));

        const promptText = `PREMISA: "${premisa}"
SECTOR: ${sector} | RÉGIMEN: ${regimen} | UIT 2026: S/ 5,500.00 | IGV: 18%
${examplesPrompt}${regsPrompt}${planPromptSection}`;

        const messages = [
            { role: "system", content: systemInstruction },
            ...previousMessages,
            { role: "user", content: promptText }
        ];

        const aiResponse = await callFreeAiWithCascade({
            messages,
            temperature: 0.1,
            max_tokens: 3000
        });

        const rawText = aiResponse.content;
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
            providerUsed: aiResponse.providerName,
            modelUsed: aiResponse.model,
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
        console.error('[AI SERVICE] Error al generar asiento contable:', error.message);
        throw error;
    }
}

/**
 * Genera una respuesta de texto libre usando el pool de IAs gratuitas con cascada automática.
 */
async function generateResponse(prompt, options = {}) {
    try {
        const systemPrompt = options.systemPrompt || 'Eres un asistente experto contable, tributario y laboral en Perú para el sistema SOFTCONTABLE.';
        const result = await generateText({
            prompt,
            systemPrompt,
            temperature: options.temperature ?? 0.3,
            maxTokens: options.max_tokens ?? 2000
        });
        return result.text;
    } catch (error) {
        console.error('[AI GENERATE RESPONSE ERROR]', error.message);
        throw error;
    }
}

module.exports = {
    generateAsiento,
    retrieveSimilarCases,
    generateResponse
};
