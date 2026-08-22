/**
 * aiRouterService.js - Motor Inteligente Multi-IA y Enrutador Gratuito para SOFTCONTABLE
 * 
 * Orquesta un pool de Inteligencias Artificiales 100% Gratuitas con alta resiliencia:
 * 1. Google Gemini Free Tier (gemini-2.5-flash, gemini-3.6-flash) - 1,500 req/día, 1M context.
 * 2. OpenRouter Free Auto-Router (openrouter/free, google/gemma-4-31b-it:free, nvidia/nemotron-3-super-120b-a12b:free, stealth/ox-alpha).
 * 3. Groq Cloud Free Tier (llama-3.3-70b-versatile, llama-3.1-8b-instant) - Inferencia ultra-rápida.
 * 4. Ollama Local (opcional, sin costo ni límites).
 * 
 * Cuenta con Failover y Cascada Automática: si un proveedor alcanza su límite 429 por minuto,
 * salta en milisegundos al siguiente sin interrumpir la experiencia del usuario.
 */

const axios = require('axios');

// Definición de Proveedores Gratuitos y sus Modelos
const FREE_PROVIDERS = {
    GEMINI: {
        name: 'Google Gemini (Free Tier)',
        id: 'gemini',
        models: ['gemini-2.5-flash', 'gemini-3.6-flash'],
        getKey: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || ''
    },
    OPENROUTER_FREE: {
        name: 'OpenRouter Free Models',
        id: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        models: [
            'openrouter/free',
            'google/gemma-4-31b-it:free',
            'nvidia/nemotron-3-super-120b-a12b:free',
            'stealth/ox-alpha',
            'z-ai/glm-5.2'
        ],
        getKey: () => process.env.OPENROUTER_API_KEY || ''
    },
    GROQ: {
        name: 'Groq Cloud (Free Tier)',
        id: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        getKey: () => process.env.GROQ_API_KEY || ''
    },
    OLLAMA: {
        name: 'Ollama Local (100% Free)',
        id: 'ollama',
        baseUrl: () => `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/v1/chat/completions`,
        models: ['qwen2.5-coder:7b', 'llama3.3:latest', 'mistral:latest'],
        getKey: () => 'ollama'
    }
};

/**
 * Convierte mensajes de formato OpenAI a formato Gemini REST API
 */
function convertOpenAiMessagesToGemini(messages) {
    let systemInstruction = '';
    const contents = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
        } else if (msg.role === 'user') {
            contents.push({
                role: 'user',
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            });
        } else if (msg.role === 'assistant') {
            contents.push({
                role: 'model',
                parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
            });
        } else if (msg.role === 'tool') {
            contents.push({
                role: 'user',
                parts: [{ text: `[Tool Result for ${msg.name || 'tool'}]: ${msg.content}` }]
            });
        }
    }

    const payload = { contents };
    if (systemInstruction) {
        payload.systemInstruction = {
            parts: [{ text: systemInstruction }]
        };
    }
    return payload;
}

/**
 * Invoca a la API de Google Gemini nativa REST y normaliza la respuesta
 */
async function callGeminiRest({ key, model, messages, temperature = 0.2, maxTokens = 3000, timeoutMs = 25000 }) {
    const payload = convertOpenAiMessagesToGemini(messages);
    payload.generationConfig = {
        temperature,
        maxOutputTokens: maxTokens
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    
    const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: timeoutMs
    });

    const candidate = response.data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';
    
    if (!text && candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini finalizó con estado: ${candidate.finishReason}`);
    }

    return {
        message: {
            role: 'assistant',
            content: text
        },
        content: text,
        tool_calls: null,
        provider: 'gemini',
        providerName: 'Google Gemini (Free Tier)',
        model,
        usage: {
            prompt_tokens: response.data?.usageMetadata?.promptTokenCount || 0,
            completion_tokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: response.data?.usageMetadata?.totalTokenCount || 0
        }
    };
}

/**
 * Obtiene la lista ordenada de configuraciones de IA disponibles para la cascada
 */
function getAvailableFreeProviders() {
    const candidates = [];

    // 1. Google Gemini (Prioridad 1 por ventana de contexto de 1M y cuota generosa)
    const geminiKey = FREE_PROVIDERS.GEMINI.getKey();
    if (geminiKey) {
        for (const model of FREE_PROVIDERS.GEMINI.models) {
            candidates.push({
                providerId: 'gemini',
                providerName: 'Google Gemini (Free Tier)',
                isCustomHandler: true,
                key: geminiKey,
                model
            });
        }
    }

    // 2. OpenRouter Free Tier (Prioridad 2 con el enrutador automático de modelos gratuitos)
    const openrouterKey = FREE_PROVIDERS.OPENROUTER_FREE.getKey();
    if (openrouterKey) {
        for (const model of FREE_PROVIDERS.OPENROUTER_FREE.models) {
            candidates.push({
                providerId: 'openrouter',
                providerName: 'OpenRouter Free Models',
                url: FREE_PROVIDERS.OPENROUTER_FREE.baseUrl,
                key: openrouterKey,
                model,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openrouterKey}`,
                    'HTTP-Referer': 'https://softcontable.com',
                    'X-Title': 'SOFTCONTABLE AI Engine'
                }
            });
        }
    }

    // 3. Groq Cloud (Prioridad 3 por velocidad instantánea)
    const groqKey = FREE_PROVIDERS.GROQ.getKey();
    if (groqKey) {
        for (const model of FREE_PROVIDERS.GROQ.models) {
            candidates.push({
                providerId: 'groq',
                providerName: 'Groq Cloud (Free Tier)',
                url: FREE_PROVIDERS.GROQ.baseUrl,
                key: groqKey,
                model,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqKey}`
                }
            });
        }
    }

    // 4. Ollama Local si está definido OLLAMA_BASE_URL
    if (process.env.OLLAMA_BASE_URL) {
        for (const model of FREE_PROVIDERS.OLLAMA.models) {
            candidates.push({
                providerId: 'ollama',
                providerName: 'Ollama Local (Free)',
                url: typeof FREE_PROVIDERS.OLLAMA.baseUrl === 'function' ? FREE_PROVIDERS.OLLAMA.baseUrl() : FREE_PROVIDERS.OLLAMA.baseUrl,
                key: 'ollama',
                model,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    }

    return candidates;
}

/**
 * Ejecuta una petición de Chat Completion con Cascada Automática y Failover
 */
async function callFreeAiWithCascade({
    messages,
    tools = null,
    tool_choice = 'auto',
    temperature = 0.2,
    max_tokens = 3000,
    timeoutMs = 25000
}) {
    const candidates = getAvailableFreeProviders();

    if (candidates.length === 0) {
        throw new Error(
            'No hay proveedores de Inteligencia Artificial configurados. ' +
            'Por favor agrega GEMINI_API_KEY, GROQ_API_KEY o OPENROUTER_API_KEY.'
        );
    }

    let lastError = null;

    for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        
        try {
            console.log(`[AI ROUTER] 🔄 Ejecutando con ${candidate.providerName} (${candidate.model})...`);

            // Manejo nativo de Gemini REST
            if (candidate.isCustomHandler && candidate.providerId === 'gemini') {
                const res = await callGeminiRest({
                    key: candidate.key,
                    model: candidate.model,
                    messages,
                    temperature,
                    maxTokens: max_tokens,
                    timeoutMs
                });
                console.log(`[AI ROUTER] ✅ Respuesta exitosa recibida de ${candidate.providerName} (${candidate.model})`);
                return res;
            }

            // Construir payload estándar OpenAI-compatible
            const requestBody = {
                model: candidate.model,
                messages,
                temperature,
                max_tokens
            };

            // Inyectar tools si vienen especificadas
            if (tools && Array.isArray(tools) && tools.length > 0) {
                requestBody.tools = tools;
                requestBody.tool_choice = tool_choice;
            }

            const response = await axios.post(
                candidate.url,
                requestBody,
                {
                    headers: candidate.headers,
                    timeout: timeoutMs
                }
            );

            const choice = response.data?.choices?.[0];
            const message = choice?.message;

            if (!message) {
                throw new Error(`Respuesta vacía o formato inválido de ${candidate.model}`);
            }

            console.log(`[AI ROUTER] ✅ Respuesta exitosa recibida de ${candidate.providerName} (${candidate.model})`);

            return {
                message,
                content: message.content || '',
                tool_calls: message.tool_calls || null,
                provider: candidate.providerId,
                providerName: candidate.providerName,
                model: candidate.model,
                usage: response.data?.usage || {}
            };

        } catch (error) {
            const status = error.response?.status;
            const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message;
            lastError = errorMsg;

            console.warn(`[AI ROUTER] ⚠️ Falla en ${candidate.providerName} (${candidate.model}) [HTTP ${status || 'ERR'}]: ${errorMsg}`);

            const isRecoverable = !status || status === 404 || status === 429 || status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
            
            if (isRecoverable && i < candidates.length - 1) {
                console.log(`[AI ROUTER] 🔀 Conmutando automáticamente al siguiente motor de IA en la cola...`);
                continue;
            }
        }
    }

    throw new Error(`Todos los motores de IA del pool gratuito fallaron. Último error: ${lastError}`);
}

/**
 * Genera una respuesta de texto directo libre utilizando el pool gratuito
 */
async function generateText({ prompt, systemPrompt = '', temperature = 0.2, maxTokens = 3000 }) {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await callFreeAiWithCascade({
        messages,
        temperature,
        max_tokens: maxTokens
    });

    return {
        text: result.content,
        provider: result.provider,
        model: result.model
    };
}

/**
 * Retorna el estado y los proveedores gratuitos actualmente activos
 */
function getActiveAiStatus() {
    const geminiKey = FREE_PROVIDERS.GEMINI.getKey();
    const groqKey = FREE_PROVIDERS.GROQ.getKey();
    const openrouterKey = FREE_PROVIDERS.OPENROUTER_FREE.getKey();
    const ollamaConfigured = Boolean(process.env.OLLAMA_BASE_URL);

    return {
        gemini: {
            configured: Boolean(geminiKey),
            name: FREE_PROVIDERS.GEMINI.name,
            models: FREE_PROVIDERS.GEMINI.models
        },
        openrouter: {
            configured: Boolean(openrouterKey),
            name: FREE_PROVIDERS.OPENROUTER_FREE.name,
            models: FREE_PROVIDERS.OPENROUTER_FREE.models
        },
        groq: {
            configured: Boolean(groqKey),
            name: FREE_PROVIDERS.GROQ.name,
            models: FREE_PROVIDERS.GROQ.models
        },
        ollama: {
            configured: ollamaConfigured,
            name: FREE_PROVIDERS.OLLAMA.name,
            models: FREE_PROVIDERS.OLLAMA.models
        },
        totalCandidates: getAvailableFreeProviders().length
    };
}

module.exports = {
    callFreeAiWithCascade,
    generateText,
    getActiveAiStatus,
    getAvailableFreeProviders,
    FREE_PROVIDERS
};
