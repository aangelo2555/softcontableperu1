/**
 * Servicio de Embeddings Semánticos
 * Utiliza una red neuronal local (@xenova/transformers) para convertir texto en vectores de 384 dimensiones.
 */

let pipeline = null;
let extractor = null;
let loadingPromise = null;

// Cargar la librería dinámicamente o manejar si falla
try {
    const transformers = require('@xenova/transformers');
    pipeline = transformers.pipeline;
} catch (e) {
    console.error('[EMBEDDING SERVICE] No se pudo requerir @xenova/transformers:', e.message);
}

/**
 * Inicializa el modelo extractor de características.
 * Se descarga/recupera de cache el modelo 'all-MiniLM-L6-v2' (23MB).
 */
async function init() {
    if (extractor) return extractor;
    if (loadingPromise) return loadingPromise;
    if (!pipeline) {
        throw new Error('La librería @xenova/transformers no está disponible.');
    }

    loadingPromise = (async () => {
        try {
            console.log('[EMBEDDING SERVICE] Inicializando modelo de embeddings Xenova/paraphrase-multilingual-MiniLM-L12-v2...');
            // Deshabilitar telemetría innecesaria si la hay
            // feature-extraction genera vectores numéricos que representan el significado semántico
            extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
            console.log('[EMBEDDING SERVICE] Modelo de embeddings cargado exitosamente en memoria.');
            return extractor;
        } catch (error) {
            console.error('[EMBEDDING SERVICE ERROR] Falló la carga del modelo de embeddings:', error);
            extractor = null;
            loadingPromise = null;
            throw error;
        }
    })();
    return loadingPromise;
}

// Inicializar asíncronamente al cargar el archivo
if (pipeline) {
    init().catch(err => {
        console.warn('[EMBEDDING SERVICE] Inicialización automática diferida por error:', err.message);
    });
}

/**
 * Convierte un bloque de texto en un array de 384 números de punto flotante.
 * @param {string} text Texto a vectorizar.
 * @returns {Promise<number[]|null>} Vector de embedding o null si falla.
 */
async function generateEmbedding(text) {
    if (!text || typeof text !== 'string') return null;
    try {
        const pipelineInstance = await init();
        if (!pipelineInstance) return null;

        // Limpieza básica del texto para remover espacios duplicados
        const cleanText = text.replace(/\s+/g, ' ').trim();

        // Generar tensor de características con pooling 'mean' y normalización L2
        const output = await pipelineInstance(cleanText, { pooling: 'mean', normalize: true });
        
        // Convertir el Float32Array interno en un array regular de Javascript
        if (output && output.data) {
            return Array.from(output.data);
        }
        return null;
    } catch (error) {
        console.error('[EMBEDDING SERVICE] Error al generar embedding para el texto:', error.message);
        return null;
    }
}

/**
 * Calcula la similitud coseno entre dos vectores numéricos.
 * Retorna un valor entre -1 y 1 (donde 1 indica significado idéntico).
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} Similitud.
 */
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
 * Determina si el modelo está listo para responder consultas.
 */
function isReady() {
    return extractor !== null;
}

module.exports = {
    init,
    generateEmbedding,
    cosineSimilarity,
    isReady
};
