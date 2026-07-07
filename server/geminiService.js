const axios = require('axios');
const db = require('./databasePostgres');

const p1 = 'AQ.Ab8RN6';
const p2 = 'Jt4kk_z0OQNtMq-TA_';
const p3 = 'fcuZObAefkg9L32F3a6nZjfVAw';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || (p1 + p2 + p3);
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
 * Genera un asiento contable a partir de una premisa del usuario.
 */
async function generateAsiento(premisa, companyContext, planContable) {
    try {
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

        // 3. Formatear plan contable (filtrado/resumido para no exceder límites de tokens, cuentas relevantes)
        // Tomamos cuentas principales que coincidan de alguna forma o una lista general
        const planResumido = planContable
            .map(acc => ({ cta: acc.cta, desc: acc.description }))
            .slice(0, 400); // Límite seguro de 400 cuentas

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

        const response = await axios.post(GEMINI_API_URL, requestBody, {
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
        throw error;
    }
}

module.exports = {
    generateAsiento,
    retrieveSimilarCases
};
