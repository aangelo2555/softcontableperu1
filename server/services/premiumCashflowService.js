/**
 * Servicio de Proyección de Flujo de Caja y Finanzas con IA — SoftPremium Pilar 3
 * 
 * DIFERENCIADOR REAL: Cruza el forecast de caja con el CALENDARIO DE VENCIMIENTOS SUNAT
 * del RUC específico del workspace (dígito 0 al 9).
 */

const coreReader = require('../coreReader');
const { queryPremium } = require('../poolPremium');
const { v4: uuidv4 } = require('uuid');

/**
 * Retorna el día hábil estimado de vencimiento SUNAT según el último dígito del RUC (0 a 9).
 */
function getSunatDueDate(ruc, year, month) {
    if (!ruc || ruc.length < 11) return 15; // default día 15
    const lastDigit = parseInt(ruc.substring(10, 11), 10);
    const lastDigitNum = isNaN(lastDigit) ? 0 : lastDigit;

    // Cronograma típico SUNAT: dígito 0 -> día 13, dígito 9 -> día 21
    const baseDay = 12 + (lastDigitNum === 0 ? 1 : lastDigitNum);
    return Math.min(22, baseDay);
}

/**
 * Genera el forecast de flujo de caja cruzado con obligaciones SUNAT.
 */
async function generateCashflowForecast({ workspaceId, startDate, endDate, method = 'directo' }) {
    const workspace = await coreReader.getWorkspace(workspaceId);
    const ruc = workspace ? workspace.ruc : '';

    const currentPeriod = startDate ? startDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
    const purchases = await coreReader.getPurchases(workspaceId, currentPeriod, null);
    const sales = await coreReader.getSales(workspaceId, currentPeriod, null);

    const totalVentasSoles = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalComprasSoles = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const igvAPagarEstimado = Math.max(0, (totalVentasSoles - totalComprasSoles) * 0.18);

    const rucLastDigit = ruc.length === 11 ? ruc.substring(10, 11) : '0';
    const vencimientoDia = getSunatDueDate(ruc, 2026, 8);

    const projectedInflowsCentimos = Math.round(totalVentasSoles * 100);
    const projectedOutflowsCentimos = Math.round((totalComprasSoles + igvAPagarEstimado) * 100);

    const sunatAdjustments = {
        ruc_evaluado: ruc,
        ultimo_digito_ruc: rucLastDigit,
        dia_vencimiento_sunat: vencimientoDia,
        igv_estimado_soles: igvAPagarEstimado.toFixed(2),
        alerta_liquidez: (totalVentasSoles - totalComprasSoles - igvAPagarEstimado) < 0 ? 
            'ALERTA DE CAJA: El flujo de caja neto proyectado es menor que el pago estimado de SUNAT.' : 
            'Flujo de caja saludable para cubrir obligaciones tributarias.'
    };

    let factoringRecommendation = null;
    if (projectedOutflowsCentimos > projectedInflowsCentimos) {
        factoringRecommendation = {
            recomienda_factoring: true,
            monto_sugerido_soles: ((projectedOutflowsCentimos - projectedInflowsCentimos) / 100).toFixed(2),
            explicacion: 'Se sugiere adelantar el cobro de facturas por cobrar mediante factoring para cubrir la brecha de liquidez antes del vencimiento SUNAT.'
        };
    }

    const runId = uuidv4();
    await queryPremium(
        `INSERT INTO premium.cashflow_forecasts 
        (id, workspace_id, forecast_period_start, forecast_period_end, method, projected_inflows_centimos, projected_outflows_centimos, sunat_calendar_adjustments_json, factoring_recommendation_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
            runId,
            workspaceId,
            startDate || '2026-08-01',
            endDate || '2026-08-31',
            method,
            projectedInflowsCentimos,
            projectedOutflowsCentimos,
            JSON.stringify(sunatAdjustments),
            JSON.stringify(factoringRecommendation)
        ]
    );

    return {
        id: runId,
        projectedInflowsSoles: (projectedInflowsCentimos / 100).toFixed(2),
        projectedOutflowsSoles: (projectedOutflowsCentimos / 100).toFixed(2),
        netBalanceSoles: ((projectedInflowsCentimos - projectedOutflowsCentimos) / 100).toFixed(2),
        sunatAdjustments,
        factoringRecommendation
    };
}

module.exports = {
    generateCashflowForecast
};
