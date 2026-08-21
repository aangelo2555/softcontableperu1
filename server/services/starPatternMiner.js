/**
 * Motor de Minería de Patrones y Auto-Aprendizaje de STAR (starPatternMiner.js)
 * 
 * Analiza transacciones continuas para aprender automáticamente:
 * - Subcuentas de gasto habituales por proveedor (ej. RUC -> 6363).
 * - Centros de costo preferidos por tipo de operación.
 * - Políticas de pago y bancarización recurrentes.
 * - Regímenes laborales y cómputos de nómina.
 */

const coreReader = require('../coreReader');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');

/**
 * Ejecuta la minería de patrones para un workspace/empresa.
 */
async function minePatternsForWorkspace(workspaceId, userId) {
    if (!workspaceId) return { mined: 0, rules: [] };

    try {
        const learnings = [];

        // 1. Minería sobre Registro de Compras (Asignación de Cuentas por Proveedor)
        const purchases = await coreReader.getPurchases(workspaceId, '%', userId);
        const supplierMap = {};

        for (const p of (purchases || [])) {
            const ruc = (p.doc_num || '').trim();
            const cta = (p.ctaGasto || '').trim();
            const nombre = (p.nombre || '').trim();

            if (!ruc || !cta || ruc.length < 8) continue;

            if (!supplierMap[ruc]) {
                supplierMap[ruc] = {
                    ruc,
                    nombre,
                    cuentas: {},
                    totalTransacciones: 0
                };
            }

            supplierMap[ruc].cuentas[cta] = (supplierMap[ruc].cuentas[cta] || 0) + 1;
            supplierMap[ruc].totalTransacciones++;
        }

        // Sintetizar reglas para proveedores con al menos 2 transacciones consistentes
        for (const ruc of Object.keys(supplierMap)) {
            const data = supplierMap[ruc];
            let topCta = '';
            let maxCount = 0;

            for (const [cta, count] of Object.entries(data.cuentas)) {
                if (count > maxCount) {
                    maxCount = count;
                    topCta = cta;
                }
            }

            const confidence = Number((maxCount / data.totalTransacciones).toFixed(2));
            if (data.totalTransacciones >= 2 && confidence >= 0.60) {
                const ruleId = `lrn_sup_${workspaceId}_${ruc}`;
                const ruleData = {
                    ruc: data.ruc,
                    nombre: data.nombre,
                    cuentaHabitual: topCta,
                    frecuencia: data.totalTransacciones,
                    porcentajeConsistencia: Math.round(confidence * 100) + '%'
                };

                const saved = await db.saveStarLearning({
                    id: ruleId,
                    workspaceId,
                    category: 'PROVEEDOR_CUENTA',
                    entityKey: ruc,
                    learnedRule: ruleData,
                    confidenceScore: Math.min(0.99, confidence)
                });

                if (saved) learnings.push(ruleData);
            }
        }

        // 2. Minería sobre Planillas (Régimen y Proporciones Laborales)
        const employees = await coreReader.getEmployees(workspaceId, userId);
        if (employees && employees.length > 0) {
            const onpCount = employees.filter(e => (e.regimen_pensionario || '').toUpperCase() === 'ONP').length;
            const afpCount = employees.length - onpCount;
            const conAsigFam = employees.filter(e => Boolean(e.asignacion_familiar)).length;

            const payrollRuleId = `lrn_pay_${workspaceId}`;
            const payrollRuleData = {
                totalTrabajadores: employees.length,
                regimenPredominante: onpCount >= afpCount ? 'ONP' : 'AFP',
                porcentajeAsignacionFamiliar: Math.round((conAsigFam / employees.length) * 100) + '%',
                sueldoPromedio: (employees.reduce((acc, e) => acc + Number(e.sueldo_basico || 0), 0) / employees.length).toFixed(2)
            };

            await db.saveStarLearning({
                id: payrollRuleId,
                workspaceId,
                category: 'BENEFICIO_LABORAL',
                entityKey: 'ESTRUCTURA_PLANILLA',
                learnedRule: payrollRuleData,
                confidenceScore: 0.95
            });

            learnings.push(payrollRuleData);
        }

        return {
            success: true,
            mined: learnings.length,
            rules: learnings
        };
    } catch (error) {
        console.error('[STAR PATTERN MINER ERROR]', error.message);
        return { success: false, mined: 0, error: error.message };
    }
}

module.exports = {
    minePatternsForWorkspace
};
