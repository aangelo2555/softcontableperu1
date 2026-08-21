/**
 * Servicio de Memoria Persistente y Auto-Aprendizaje Evolutivo de STAR (starMemoryService.js)
 * 
 * Gestiona el banco de memoria por RUC:
 * - Recupera patrones contables aprendidos.
 * - Formatea el contexto de memoria para el System Prompt de STAR.
 * - Calibra y actualiza reglas ante retroalimentación del contador.
 */

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const { minePatternsForWorkspace } = require('./starPatternMiner');

/**
 * Obtiene el contexto de memoria enriquecido para inyectar a STAR
 */
async function getStarMemoryContext(workspaceId, userId) {
    if (!workspaceId) return '';

    try {
        let learnings = await db.getStarLearnings(workspaceId);

        // Si la empresa aún no tiene aprendizajes guardados, ejecutar minería inicial
        if (!learnings || learnings.length === 0) {
            await minePatternsForWorkspace(workspaceId, userId);
            learnings = await db.getStarLearnings(workspaceId);
        }

        if (!learnings || learnings.length === 0) {
            return 'No hay reglas contables personalizadas previas aprendidas para esta empresa aún.';
        }

        const lines = ['REGLAS Y PATRONES CONTABLES APRENDIDOS DE ESTA EMPRESA (MEMORIA STAR):'];
        for (const item of learnings.slice(0, 15)) {
            let rule = item.learned_rule;
            if (typeof rule === 'string') {
                try { rule = JSON.parse(rule); } catch (_) {}
            }

            if (item.category === 'PROVEEDOR_CUENTA' && rule) {
                lines.push(`• Proveedor ${rule.nombre || ''} (RUC: ${rule.ruc || item.entity_key}): Usa habitualmente la Cuenta PCGE [${rule.cuentaHabitual}] (Confianza: ${Math.round((item.confidence_score || 0.85) * 100)}%).`);
            } else if (item.category === 'BENEFICIO_LABORAL' && rule) {
                lines.push(`• Estructura de Planilla: Régimen ${rule.regimenPredominante || 'ONP'}, Sueldo Promedio S/ ${rule.sueldoPromedio || '0.00'}.`);
            } else {
                lines.push(`• Regla [${item.category}]: ${item.entity_key} -> ${JSON.stringify(rule)}`);
            }
        }

        return lines.join('\n');
    } catch (error) {
        console.warn('[STAR MEMORY SERVICE WARNING]', error.message);
        return '';
    }
}

/**
 * Registra o recalibra una regla aprendida tras feedback explícito
 */
async function reinforceLearning(workspaceId, category, entityKey, ruleData, wasCorrect = true) {
    if (!workspaceId || !entityKey) return null;

    try {
        const id = `lrn_${workspaceId}_${category}_${entityKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const existing = await db.getStarLearnings(workspaceId, category);
        const match = (existing || []).find(e => e.entity_key === entityKey);

        let newScore = match ? Number(match.confidence_score || 0.85) : 0.85;
        if (wasCorrect) {
            newScore = Math.min(0.99, newScore + 0.05);
        } else {
            newScore = Math.max(0.40, newScore - 0.15);
        }

        return await db.saveStarLearning({
            id,
            workspaceId,
            category,
            entityKey,
            learnedRule: ruleData,
            confidenceScore: newScore
        });
    } catch (error) {
        console.error('[STAR REINFORCE LEARNING ERROR]', error.message);
        return null;
    }
}

module.exports = {
    getStarMemoryContext,
    reinforceLearning
};
