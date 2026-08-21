/**
 * Orquestador ReAct de Hermes Agent para STAR (starAgentService.js)
 * 
 * Bucle de razonamiento autónomo multi-turno:
 * 1. Comprende la consulta contable/tributaria y la hoja activa.
 * 2. Inyecta la memoria persistente del RUC.
 * 3. Ejecuta herramientas de lectura sobre Compras, Ventas, Diario, etc.
 * 4. Genera diagnóstico, explicaciones NIIF/SUNAT y asientos estructurados.
 */

const axios = require('axios');
const { STAR_TOOLS_DEFINITIONS, executeStarTool } = require('./starToolRegistry');
const { getStarMemoryContext } = require('./starMemoryService');

function getGroqConfig() {
    const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || '';
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    return { key, url };
}

/**
 * Orquesta una sesión de razonamiento con STAR
 */
async function processStarChat({ query, conversationHistory = [], context = {} }) {
    const { key, url } = getGroqConfig();
    const workspaceId = context.workspaceId || context.currentCompany?.ruc || '';
    const userId = context.userId || '';
    const activeTab = context.activeTab || 'EMPRESA';
    const activePeriod = context.period || new Date().toISOString().slice(0, 7);

    // 1. Obtener la memoria viva de la empresa
    const memoryContext = await getStarMemoryContext(workspaceId, userId);

    // 2. Construir el System Prompt de STAR
    const systemPrompt = `Eres STAR, el Asistente Contable, Tributario y Financiero con Inteligencia Artificial y Auto-Aprendizaje para el sistema SOFTCONTABLE en Perú (Año Fiscal 2026).

IDENTIDAD & ROL:
- Eres un agente inteligente de clase mundial que domina el Plan Contable General Empresarial (PCGE 2026), normativa SUNAT (SIRE RVIE/RCE, Detracciones SPOT, Bancarización Ley 28194, TUO LIR, TUO IGV), NIIF/NIC (NIC 12, NIC 16) y legislación laboral (PLAME, Ley 27735, D.S. 001-97-TR).
- Tu tono es profesional, preciso, pedagógico, proactivo y empático con el contador peruano.

CONTEXTO ACTIVO DEL USUARIO:
- Empresa Activa: ${context.currentCompany?.name || 'Empresa'} (RUC: ${workspaceId})
- Régimen Tributario: ${context.currentCompany?.regimenTributario || 'Régimen General / MYPE'}
- Hoja / Módulo Activo en Pantalla: ${activeTab}
- Periodo Fiscal Actual: ${activePeriod}

${memoryContext}

INSTRUCCIONES DE OPERACIÓN REACT:
1. Si la consulta del usuario requiere datos reales de las hojas (compras, ventas, asientos, planillas, mayor, balance, etc.), USA TUS HERRAMIENTAS (Tools) para consultar la información antes de responder.
2. Si detectas un error o descuadre (ej. compras sin bancarizar, asientos descuadrados, IGV mal direccionado), señala la causa exacta y ofrece el asiento de ajuste correspondiente.
3. Si sugieres un asiento contable, proporciona siempre las subcuentas oficiales a 4 o 5 dígitos, glosa clara y cuadre exacto Debe = Haber.
4. Explica con claridad el sustento normativo (Base Legal SUNAT o PCGE).`;

    // 3. Estructurar mensajes
    const messages = [
        { role: 'system', content: systemPrompt }
    ];

    // Historial previo
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        for (const msg of conversationHistory.slice(-10)) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content || ''
                });
            }
        }
    }

    // Mensaje actual del usuario
    messages.push({ role: 'user', content: query });

    const executionSteps = [];
    let iterations = 0;
    const maxIterations = 5;
    let finalContent = '';
    let suggestedEntry = null;

    // 4. Bucle ReAct Multi-Turno
    while (iterations < maxIterations) {
        iterations++;

        try {
            const response = await axios.post(
                url,
                {
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    tools: STAR_TOOLS_DEFINITIONS,
                    tool_choice: 'auto',
                    temperature: 0.2,
                    max_tokens: 3000
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${key}`
                    },
                    timeout: 25000
                }
            );

            const message = response.data?.choices?.[0]?.message;
            if (!message) break;

            // Si el modelo llama a herramientas (Tool Calling)
            if (message.tool_calls && message.tool_calls.length > 0) {
                messages.push(message);

                for (const toolCall of message.tool_calls) {
                    const funcName = toolCall.function?.name;
                    let funcArgs = {};
                    try {
                        funcArgs = JSON.parse(toolCall.function?.arguments || '{}');
                    } catch (_) {}

                    executionSteps.push({
                        tool: funcName,
                        args: funcArgs,
                        timestamp: new Date()
                    });

                    // Ejecutar la herramienta en el sistema
                    const toolResult = await executeStarTool(funcName, funcArgs, {
                        workspaceId,
                        userId,
                        period: activePeriod,
                        currentCompany: context.currentCompany
                    });

                    // Añadir respuesta de la herramienta a la conversación
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: funcName,
                        content: JSON.stringify(toolResult)
                    });
                }
                // Continuar el bucle para que el modelo sintetice la respuesta
                continue;
            }

            // Si el modelo devuelve contenido final
            if (message.content) {
                finalContent = message.content;
                break;
            }
        } catch (error) {
            console.error(`[STAR AGENT REPO ERROR Iteration ${iterations}]`, error.response?.data || error.message);
            // Fallback en caso de error de llamada de tools
            if (iterations === 1) {
                finalContent = `Hola, soy STAR. He revisado la información de tu empresa (${workspaceId}). ¿En qué puedo asistirte específicamente respecto a la hoja de ${activeTab}?`;
            }
            break;
        }
    }

    // 5. Intentar extraer asiento sugerido estructurado si el modelo lo incluyó en bloque JSON
    try {
        const jsonMatch = finalContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.asiento_json || parsed.lines || (Array.isArray(parsed) && parsed[0]?.cuenta)) {
                suggestedEntry = {
                    glosa: parsed.glosa || `Ajuste sugerido por STAR - ${activeTab}`,
                    lines: parsed.asiento_json || parsed.lines || parsed
                };
            }
        }
    } catch (_) {}

    return {
        success: true,
        answer: finalContent || 'No se pudo generar una respuesta completa. Por favor intenta de nuevo.',
        steps: executionSteps,
        suggestedEntry,
        activeContext: {
            workspaceId,
            activeTab,
            period: activePeriod
        }
    };
}

module.exports = {
    processStarChat
};
