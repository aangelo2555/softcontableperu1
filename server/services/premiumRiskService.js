/**
 * Servicio de Análisis de Riesgo Tributario con IA — SoftPremium Pilar 1
 * 
 * REGLA DE ORO DE LA ARQUITECTURA:
 * Este pilar es 100% ANALÍTICO, NUNCA transaccional. Genera hallazgos y alertas
 * en premium.risk_analysis_runs, JAMÁS genera asientos contables automáticamente.
 */

const coreReader = require('../coreReader');
const { queryPremium } = require('../poolPremium');
const geminiService = require('../geminiService');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Ejecuta el análisis de riesgo tributario según el tipo seleccionado.
 */
async function runRiskAnalysis({ workspaceId, userId, period, runType }) {
    const runId = uuidv4();
    const now = new Date();

    // 1. Crear registro de análisis en estado 'running'
    try {
        await queryPremium(
            `INSERT INTO premium.risk_analysis_runs 
            (id, workspace_id, period, run_type, status, created_at)
            VALUES ($1, $2, $3, $4, 'running', NOW())`,
            [runId, workspaceId, period, runType]
        );
    } catch (e) {
        console.warn('[RISK ANALYSIS DB INSERT WARN]', e.message);
    }

    try {
        // 2. Leer datos del core a través de coreReader (SOLO LECTURA)
        const workspace = await coreReader.getWorkspace(workspaceId);
        const purchases = await coreReader.getPurchases(workspaceId, period, userId);
        const sales = await coreReader.getSales(workspaceId, period, userId);
        const journal = await coreReader.getJournalEntries(workspaceId, period, userId);

        let riskScore = 0;
        let findings = [];
        let promptContext = '';

        // 3. Evaluar reglas algorítmicas tributarias locales (Sunat Rules)
        if (runType === 'inconsistencia_gastos_ventas') {
            const totalCompras = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
            const totalVentas = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            const ratioGastosVentas = totalVentas > 0 ? (totalCompras / totalVentas) : 1;

            if (totalVentas > 0 && ratioGastosVentas > 0.90) {
                riskScore += 40;
                findings.push({
                    codigo: 'RATIO_GASTO_VENTA_ALTO',
                    severidad: 'ALTA',
                    titulo: 'Ratio de compras/gastos vs. ventas supera el 90%',
                    descripcion: `Las compras totales (S/ ${totalCompras.toFixed(2)}) representan el ${(ratioGastosVentas * 100).toFixed(1)}% de las ventas (S/ ${totalVentas.toFixed(2)}). SUNAT suele fiscalizar empresas con márgenes brutos inusualmente bajos o negativos.`
                });
            }

            // Verificar compras registradas los últimos días del mes
            const comprasFinDeMes = purchases.filter(p => {
                const dia = new Date(p.fecha).getDate();
                return dia >= 27;
            });
            if (purchases.length > 0 && (comprasFinDeMes.length / purchases.length) > 0.40) {
                riskScore += 25;
                findings.push({
                    codigo: 'CONCENTRACION_COMPRAS_FIN_MES',
                    severidad: 'MEDIA',
                    titulo: 'Concentración de facturas de compra al cierre del mes',
                    descripcion: `${((comprasFinDeMes.length / purchases.length) * 100).toFixed(1)}% de los comprobantes de compra están fechados entre el día 27 y el fin de mes. Riesgo de comprobantes inflados para reducir IGV.`
                });
            }

            promptContext = `Compras del periodo: S/ ${totalCompras.toFixed(2)} (${purchases.length} comprobantes). Ventas del periodo: S/ ${totalVentas.toFixed(2)} (${sales.length} comprobantes). Ratio Compras/Ventas: ${(ratioGastosVentas * 100).toFixed(1)}%.`;

        } else if (runType === 'comprobantes_pago_deteccion') {
            // Verificar comprobantes sin RUC o con RUCs inválidos (no 10 u 20)
            const rucsSospechosos = purchases.filter(p => {
                const ruc = (p.doc_num || '').trim();
                return ruc.length === 11 && !(ruc.startsWith('10') || ruc.startsWith('20') || ruc.startsWith('15') || ruc.startsWith('17'));
            });

            if (rucsSospechosos.length > 0) {
                riskScore += 50;
                findings.push({
                    codigo: 'RUC_INCORRECTO_FORMATO',
                    severidad: 'ALTA',
                    titulo: 'Proveedores con RUC fuera de estándar SUNAT',
                    descripcion: `Se identificaron ${rucsSospechosos.length} comprobantes con RUCs que no inician con prefijos válidos de persona natural o jurídica (10, 20, 15, 17).`
                });
            }

            // Verificar duplicidad de comprobantes
            const comprobanteMap = new Map();
            purchases.forEach(p => {
                const key = `${p.doc_num}_${p.tipo_doc}_${p.serie}_${p.numero}`;
                if (comprobanteMap.has(key)) {
                    riskScore += 35;
                    findings.push({
                        codigo: 'COMPROBANTE_DUPLICADO',
                        severidad: 'ALTA',
                        titulo: `Posible duplica del comprobante ${p.serie}-${p.numero}`,
                        descripcion: `El proveedor ${p.nombre} (RUC ${p.doc_num}) registra múltiples entradas para la misma serie y número.`
                    });
                } else {
                    comprobanteMap.set(key, true);
                }
            });

            promptContext = `Comprobantes analizados: ${purchases.length}. Duplicados hallados: ${findings.filter(f => f.codigo === 'COMPROBANTE_DUPLICADO').length}.`;

        } else {
            // Estrategia preventiva / Declaraciones vs EEFF / Deducción de gastos
            const totalCompras = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
            const totalVentas = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
            riskScore = 15; // Score base preventivo

            findings.push({
                codigo: 'AUDITORIA_PREVENTIVA_GENERAL',
                severidad: 'BAJA',
                titulo: 'Auditoría preventiva de coherencia documental',
                descripcion: 'Revisión estandarizada del régimen tributario ' + (workspace.regimenTributario || 'Régimen General') + ' para el periodo ' + period + '.'
            });

            promptContext = `Empresa RUC: ${workspace.ruc}, Régimen: ${workspace.regimenTributario}. Compras totales: S/ ${totalCompras.toFixed(2)}, Ventas totales: S/ ${totalVentas.toFixed(2)}.`;
        }

        // Normalizar Risk Score (0 a 100)
        riskScore = Math.min(100, Math.max(0, riskScore));

        // 4. Consultar a IA para generar recomendaciones explicativas en lenguaje profesional
        let aiModel = 'Groq-LLaMA3-8B';
        let recommendationText = '';
        try {
            const promptAI = `Como auditor tributario experto de SUNAT en Perú, brinda un análisis ejecutivo breve (máximo 3 párrafos) con recomendaciones preventivas sobre los siguientes hallazgos de la empresa ${workspace.name || workspace.ruc} para el periodo ${period}:
Contexto: ${promptContext}
Score de Riesgo: ${riskScore}/100.
Hallazgos detectados: ${JSON.stringify(findings)}`;

            const aiResponse = await geminiService.generateResponse ? 
                await geminiService.generateResponse(promptAI) : 
                'Se recomienda revisar la fehaciencia de los gastos y verificar el crédito fiscal ajustado.';

            recommendationText = typeof aiResponse === 'string' ? aiResponse : (aiResponse.text || '');
        } catch (e) {
            console.warn('[AI RISK ANALYSIS WARN] No se pudo generar recomendación IA avanzada:', e.message);
            recommendationText = 'Se recomienda verificar la documentación sustentatoria de los comprobantes observados.';
        }

        const findingsStructured = {
            resumen_ejecutivo: recommendationText,
            hallazgos: findings,
            total_hallazgos: findings.length,
            evaluado_at: new Date().toISOString()
        };

        // 5. Actualizar registro en premium.risk_analysis_runs
        await queryPremium(
            `UPDATE premium.risk_analysis_runs 
             SET status = 'completed', risk_score = $1, findings_json = $2, ai_model_used = $3, completed_at = NOW()
             WHERE id = $4`,
            [riskScore, JSON.stringify(findingsStructured), aiModel, runId]
        );

        // 6. Registrar en auditoría de IA
        const promptHash = crypto.createHash('md5').update(promptContext).digest('hex');
        await queryPremium(
            `INSERT INTO premium.ai_generation_audit
            (id, workspace_id, user_id, source_table, source_id, ai_provider, prompt_hash, output_reviewed)
            VALUES ($1, $2, $3, 'risk_analysis_runs', $4, $5, $6, TRUE)`,
            [uuidv4(), workspaceId, userId, runId, aiModel, promptHash]
        );

        return {
            id: runId,
            workspaceId,
            period,
            runType,
            status: 'completed',
            riskScore,
            findings: findingsStructured
        };

    } catch (error) {
        console.error('[RISK ANALYSIS ERROR]', error.message);
        await queryPremium(
            `UPDATE premium.risk_analysis_runs SET status = 'failed' WHERE id = $1`,
            [runId]
        );
        throw error;
    }
}

module.exports = {
    runRiskAnalysis
};
