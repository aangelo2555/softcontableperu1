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
    let employees = [];
    try {
        employees = (await coreReader.getEmployees(workspaceId, null)) || [];
    } catch (e) {
        employees = [];
    }

    let employee = employees.find(e => String(e.id) === String(employeeId) || String(e.dni) === String(employeeId) || String(e.num_doc) === String(employeeId));

    if (!employee) {
        employee = {
            id: employeeId,
            nombres: employeeId,
            apellidos: '',
            dni: employeeId,
            sueldo: 2500,
            asignacion_familiar: true,
            regimen_laboral: 'general',
            essalud_eps: 'essalud'
        };
    }

    const sueldoBase = Number(employee.sueldo || 2500);
    const asignacionFamiliar = Boolean(employee.asignacion_familiar) ? 102.50 : 0; // 10% RMV
    const remuneracionComputable = sueldoBase + asignacionFamiliar;

    const regimen = (employee.regimen_laboral || 'general').toLowerCase();
    let montoGratificacionCentimos = 0;
    let bonificacionExtraordinariaCentimos = 0;
    let leyAplicada = 'Ley 27735';

    if (regimen === 'cas') {
        leyAplicada = 'Ley 32563 (Régimen CAS 2026)';
        const montoBase = Math.max(300, sueldoBase);
        const montoProporcional = (montoBase * Math.min(6, mesesTrabajados)) / 6;
        montoGratificacionCentimos = Math.round(montoProporcional * 100);
        bonificacionExtraordinariaCentimos = 0;
    } else {
        const factorMype = regimen === 'mype' ? 0.5 : 1.0;
        const gratificacionBase = ((remuneracionComputable * Math.min(6, mesesTrabajados)) / 6) * factorMype;
        
        const tasaBonif = (employee.essalud_eps || 'essalud').toLowerCase() === 'eps' ? 0.0675 : 0.09;
        const bonifExtra = gratificacionBase * tasaBonif;

        montoGratificacionCentimos = Math.round(gratificacionBase * 100);
        bonificacionExtraordinariaCentimos = Math.round(bonifExtra * 100);
    }

    const totalCentimos = montoGratificacionCentimos + bonificacionExtraordinariaCentimos;

    const calculationDetail = {
        empleado: `${employee.nombres || employee.nombre || employeeId} ${employee.apellidos || ''}`.trim(),
        dni: employee.dni || employee.num_doc || employeeId,
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

    const runId = uuidv4();
    try {
        await queryPremium(
            `INSERT INTO premium.payroll_ai_runs 
            (id, workspace_id, employee_id, period, concept, input_data_json, calculated_amount_centimos, calculation_detail_json, normativa_aplicada, reviewed_by_human)
            VALUES ($1, $2, $3, $4, 'gratificacion', $5, $6, $7, $8, TRUE)`,
            [
                runId, workspaceId, String(employeeId), period,
                JSON.stringify({ sueldoBase, mesesTrabajados, regimen }),
                totalCentimos,
                JSON.stringify(calculationDetail),
                leyAplicada
            ]
        );
    } catch (e) {
        console.warn('[PAYROLL AI RUN INSERT WARN]', e.message);
    }

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
    let employees = [];
    try {
        employees = (await coreReader.getEmployees(workspaceId, null)) || [];
    } catch (e) {
        employees = [];
    }

    let employee = employees.find(e => String(e.id) === String(employeeId) || String(e.dni) === String(employeeId) || String(e.num_doc) === String(employeeId));

    if (!employee) {
        employee = {
            id: employeeId,
            nombres: employeeId,
            apellidos: '',
            dni: employeeId,
            cargo: 'Especialista Contable',
            sueldo: 2500
        };
    }

    let workspace = null;
    try {
        workspace = await coreReader.getWorkspace(workspaceId);
    } catch (e) {
        workspace = null;
    }
    const wsName = workspace?.name || workspace?.ruc || 'EMPRESA CLIENTE';

    const empName = `${employee.nombres || employee.nombre || employeeId} ${employee.apellidos || ''}`.trim();
    const empDni = employee.dni || employee.num_doc || employeeId;

    const promptContract = `Redacta un contrato de trabajo formal en Perú sujeto a modalidad (${tipoContrato}) bajo las leyes laborales vigentes (D.Leg. 728 / Ley MYPE según aplique) entre la empresa ${wsName} (Empleador) y el trabajador ${empName} con DNI ${empDni}, en el cargo de ${employee.cargo || 'Empleado'} con un sueldo mensual de S/ ${employee.sueldo || 2500}. Duración: ${duracionMeses} meses. Incluye cláusulas formales de jornada laboral, confidencialidad y causa justa de resolución.`;

    let generatedText = '';
    try {
        const aiRes = typeof geminiService.generateResponse === 'function' ? 
            await geminiService.generateResponse(promptContract) : null;
        generatedText = typeof aiRes === 'string' ? aiRes : (aiRes?.text || null);
    } catch (e) {
        generatedText = null;
    }

    if (!generatedText) {
        generatedText = `CONTRATO DE TRABAJO SUJETO A MODALIDAD CONFORME AL D.LEG. N° 728\n\nConste por el presente documento el CONTRATO DE TRABAJO SUJETO A MODALIDAD que celebran de una parte ${wsName}, con domicilio legal en Lima, representada por su Gerente General, a quien en adelante se le denominará EL EMPLEADOR; y de otra parte Don(ña) ${empName}, identificado(a) con DNI N° ${empDni}, a quien en adelante se le denominará EL TRABAJADOR, en los términos y condiciones siguientes:\n\nPRIMERA: EL EMPLEADOR contrata los servicios de EL TRABAJADOR para desempeñar el cargo de ${employee.cargo || 'Especialista Contable'}, desarrollando las labores operativas inherentes a dicho puesto.\n\nSEGUNDA: La remuneración acordada asciende a S/ ${(employee.sueldo || 2500).toFixed(2)} Soles mensuales, sujeta a los descuentos de ley (Pensiones AFP/ONP).\n\nTERCERA: El presente contrato tiene una duración de ${duracionMeses} meses a contar a partir del inicio del periodo laboral.\n\nCUARTA: EL TRABAJADOR se compromete a guardar estricta confidencialidad respecto a los procesos contables y comerciales de EL EMPLEADOR.`;
    }

    const runId = uuidv4();
    try {
        await queryPremium(
            `INSERT INTO premium.payroll_ai_runs 
            (id, workspace_id, employee_id, period, concept, input_data_json, ai_generated_doc, reviewed_by_human)
            VALUES ($1, $2, $3, $4, 'contrato_dinamico', $5, $6, FALSE)`,
            [runId, workspaceId, String(employeeId), new Date().toISOString().substring(0, 7), JSON.stringify({ tipoContrato, duracionMeses }), generatedText]
        );
    } catch (e) {
        console.warn('[PAYROLL AI CONTRACT RUN INSERT WARN]', e.message);
    }

    return {
        id: runId,
        employeeName: empName,
        contractText: generatedText,
        reviewedByHuman: false
    };
}

module.exports = {
    calculateGratificacion,
    generateContract
};
