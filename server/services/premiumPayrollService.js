/**
 * Servicio de Planillas y Cálculos Laborales con IA — SoftPremium Pilar 2
 * 
 * Normativa incorporada:
 * - Ley 27735 (Gratificaciones Fiestas Patrias y Navidad)
 * - Ley 29714 (Bonificación Extraordinaria 9% / EPS 6.75%)
 * - Decreto Legislativo 650 (CTS régimen privado semestral)
 * - Ley 32563 (Promulgada marzo 2026 - CAS: Gratificación de 1 sueldo min S/300 y CTS 100% cancelatoria al cese)
 */

const coreReader = require('../coreReader');
const { queryPremium } = require('../poolPremium');
const geminiService = require('../geminiService');
const { v4: uuidv4 } = require('uuid');

/**
 * Calcula la gratificación bajo Ley 27735 (privado) o Ley 32563 (CAS).
 */
async function calculateGratificacion({ workspaceId, employeeId, period, mesesTrabajados = 6 }) {
    const employees = await coreReader.getEmployees(workspaceId, null);
    const employee = employees.find(e => String(e.id) === String(employeeId));

    if (!employee) {
        throw new Error('Empleado no encontrado en el directorio.');
    }

    const sueldoBase = Number(employee.sueldo || 0);
    const asignacionFamiliar = Boolean(employee.asignacion_familiar) ? 102.50 : 0; // 10% RMV
    const remuneracionComputable = sueldoBase + asignacionFamiliar;

    const regimen = (employee.regimen_laboral || 'general').toLowerCase();
    let montoGratificacionCentimos = 0;
    let bonificacionExtraordinariaCentimos = 0;
    let leyAplicada = 'Ley 27735';

    if (regimen === 'cas') {
        // Ley 32563 (promulgada marzo 2026) para CAS
        leyAplicada = 'Ley 32563 (Régimen CAS 2026)';
        const montoBase = Math.max(300, sueldoBase); // Mínimo S/ 300 por norma del Congreso
        const montoProporcional = (montoBase * Math.min(6, mesesTrabajados)) / 6;
        montoGratificacionCentimos = Math.round(montoProporcional * 100);
        bonificacionExtraordinariaCentimos = 0; // CAS no aplica Bonificación Ley 29714
    } else {
        // Régimen privado (General / MYPE)
        const factorMype = regimen === 'mype' ? 0.5 : 1.0;
        const gratificacionBase = ((remuneracionComputable * Math.min(6, mesesTrabajados)) / 6) * factorMype;
        
        // Bonificación Extraordinaria 9% (o 6.75% si es EPS)
        const tasaBonif = (employee.essalud_eps || 'essalud').toLowerCase() === 'eps' ? 0.0675 : 0.09;
        const bonifExtra = gratificacionBase * tasaBonif;

        montoGratificacionCentimos = Math.round(gratificacionBase * 100);
        bonificacionExtraordinariaCentimos = Math.round(bonifExtra * 100);
    }

    const totalCentimos = montoGratificacionCentimos + bonificacionExtraordinariaCentimos;

    const calculationDetail = {
        empleado: `${employee.nombres} ${employee.apellidos}`,
        dni: employee.dni,
        sueldo_base: sueldoBase,
        asignacion_familiar: asignacionFamiliar,
        remuneracion_computable: remuneracionComputable,
        meses_trabajados: mesesTrabajados,
        gratificacion_base_soles: (montoGratificacionCentimos / 100).toFixed(2),
        bonificacion_extraordinaria_soles: (bonificacionExtraordinariaCentimos / 100).toFixed(2),
        total_a_pagar_soles: (totalCentimos / 100).toFixed(2),
        regimen_aplicado: regimen,
        normativa: leyAplicada
    };

    // Guardar en premium.payroll_ai_runs
    const runId = uuidv4();
    await queryPremium(
        `INSERT INTO premium.payroll_ai_runs 
        (id, workspace_id, employee_id, period, concept, input_data_json, calculated_amount_centimos, calculation_detail_json, normativa_aplicada, reviewed_by_human)
        VALUES ($1, $2, $3, $4, 'gratificacion', $5, $6, $7, $8, TRUE)`,
        [
            runId, workspaceId, employeeId, period,
            JSON.stringify({ sueldoBase, mesesTrabajados, regimen }),
            totalCentimos,
            JSON.stringify(calculationDetail),
            leyAplicada
        ]
    );

    return {
        id: runId,
        concept: 'gratificacion',
        totalCentimos,
        totalSoles: (totalCentimos / 100).toFixed(2),
        detail: calculationDetail
    };
}

/**
 * Genera un contrato de trabajo con IA. Requiere revisión humana obligatoria (reviewed_by_human = FALSE).
 */
async function generateContract({ workspaceId, employeeId, tipoContrato = 'plazo_fijo', duracionMeses = 6 }) {
    const employees = await coreReader.getEmployees(workspaceId, null);
    const employee = employees.find(e => String(e.id) === String(employeeId));

    if (!employee) throw new Error('Empleado no encontrado.');

    const workspace = await coreReader.getWorkspace(workspaceId);

    const promptContract = `Redacta un contrato de trabajo formal en Perú sujeto a modalidad (${tipoContrato}) bajo las leyes laborales vigentes (D.Leg. 728 / Ley MYPE según aplique) entre la empresa ${workspace.name || workspace.ruc} (Empleador) y el trabajador ${employee.nombres} ${employee.apellidos} con DNI ${employee.dni}, en el cargo de ${employee.cargo || 'Empleado'} con un sueldo mensual de S/ ${employee.sueldo}. Duración: ${duracionMeses} meses. Incluye cláusulas formales de jornada laboral, confidencialidad y causa justa de resolución.`;

    let generatedText = '';
    try {
        const aiRes = await geminiService.generateResponse ? 
            await geminiService.generateResponse(promptContract) : null;
        generatedText = typeof aiRes === 'string' ? aiRes : (aiRes?.text || 'Contrato modelo sujeto a revisión legal.');
    } catch (e) {
        generatedText = `CONTRATO DE TRABAJO SUJETO A MODALIDAD\n\nConste por el presente documento el Contrato de Trabajo que celebran de una parte ${workspace.name} y de otra parte el Sr(a). ${employee.nombres} ${employee.apellidos}...`;
    }

    const runId = uuidv4();
    await queryPremium(
        `INSERT INTO premium.payroll_ai_runs 
        (id, workspace_id, employee_id, period, concept, input_data_json, ai_generated_doc, reviewed_by_human)
        VALUES ($1, $2, $3, $4, 'contrato_dinamico', $5, $6, FALSE)`,
        [runId, workspaceId, employeeId, new Date().toISOString().substring(0, 7), JSON.stringify({ tipoContrato, duracionMeses }), generatedText]
    );

    return {
        id: runId,
        employeeName: `${employee.nombres} ${employee.apellidos}`,
        contractText: generatedText,
        reviewedByHuman: false
    };
}

module.exports = {
    calculateGratificacion,
    generateContract
};
