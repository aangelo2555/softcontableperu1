/**
 * Servicio RAG (Retrieval-Augmented Generation) de Inteligencia Normativa — SoftPremium 4.0
 * 
 * Inyecta la normativa contable, tributaria, laboral y NIIF peruana a 2026
 * para nutrir las auditorías e inferencias de Groq AI.
 */

const geminiService = require('../geminiService');

const NORMATIVA_KNOWLEDGE_BASE = {
  tributario: {
    ratio_compras_ventas: {
      titulo: 'Consistencia de Ventas vs Compras (RIE / SIRE)',
      articulos: [
        'TUO Ley del IGV (D.S. 055-99-EF, Art. 18 y 19) — Requisitos sustanciales y formales para el Crédito Fiscal.',
        'Resolución de Superintendencia N° 000190-2021/SUNAT y RS 000040-2022/SUNAT — Obligatoriedad del SIRE (RVIE y RCE).',
        'Jurisprudencia RTF N° 01245-1-2021 — Fehaciencia de las operaciones y proporcionalidad del gasto frente a los ingresos declarados.'
      ],
      metodologia: 'Ratio de Coherencia = Compras Totales ÷ Ventas Totales. Ratios superiores al 85% activan alertas predictivas de margen operativo inusualmente bajo.'
    },
    bancarizacion: {
      titulo: 'Ley de Bancarización y Medios de Pago (Ley 28194)',
      articulos: [
        'Ley 28194 (Art. 3, 4 y 5) — Obligación del uso de Medios de Pago para obligaciones iguales o superiores a S/ 2,000 o US$ 500.',
        'TUO LIR Art. 44 inc. d) — Inadmisibilidad de costo o gasto deducible si la operación no fue bancarizada en la forma prescrita.',
        'RTF N° 09212-3-2020 — Imposibilidad de subsanar a posteriori transacciones en efectivo que superen los umbrales legales.'
      ],
      metodologia: 'Auditoría automática de comprobantes con monto >= S/ 2,000 pagados en efectivo o sin registro de código de operación bancaria.'
    },
    gastos_deducibles: {
      titulo: 'Causalidad y Fehaciencia del Gasto (Art. 37 LIR)',
      articulos: [
        'TUO Ley del Impuesto a la Renta (D.S. 179-2004-EF, Art. 37) — Principio general de causalidad y gastos indispensables para la producción de la renta.',
        'Art. 44 LIR — Gastos personales, sustentados con comprobantes no válidos o emitidos por sujetos No Habidos.',
        'RTF de Observancia Obligatoria N° 03708-1-2022 — Fehaciencia probatoria adicional al comprobante de pago (contratos, guías de remisión, reportes).'
      ],
      metodologia: 'Verificación del RUC del proveedor (prefijos 10/20), fehaciencia formal de serie-número y sustento documental del gasto.'
    },
    scoring_sunat: {
      titulo: 'Scoring Predictivo de Perfil de Riesgo SUNAT 2026',
      articulos: [
        'Decreto Legislativo N° 1535 — Calificación del Perfil de Cumplimiento de los Deudores Tributarios.',
        'Resolución de Superintendencia N° 000123-2024/SUNAT — Tablas de ponderación de inconsistencias electrónicas.',
        'Art. 175 Código Tributario — Infracciones por llevar libros o registros contables con retraso o sin observar las formas.'
      ],
      metodologia: 'Algoritmo de Scoring 0-100 ponderando salud fiscal, facturas fin de mes, bancarización y aceptación SIRE.'
    }
  },
  planillas: {
    gratificacion: {
      titulo: 'Gratificaciones Legales (Ley 27735 & Ley 32563 CAS 2026)',
      articulos: [
        'Ley N° 27735 y D.S. 005-2002-TR — Gratificaciones en Fiestas Patrias (Julio) y Navidad (Diciembre) para el régimen laboral privado.',
        'Ley N° 29351 y Ley N° 30334 — Inafectación de gratificaciones y otorgamiento de la Bonificación Extraordinaria del 9% (EsSalud) o 6.75% (EPS).',
        'Ley N° 32563 (Marzo 2026) — Régimen CAS: Pago de gratificación completa de 1 remuneración (mínimo S/ 300) por semestre trabajado.'
      ],
      metodologia: 'Remuneración Computable = Sueldo Básico + Asignación Familiar (10% RMV S/ 113) + Promedio HE. Cálculo = (Rem. Computable × Meses ÷ 6) + 9% Bonif.'
    },
    cts: {
      titulo: 'Compensación por Tiempo de Servicios (D.Leg. 650)',
      articulos: [
        'TUO del Decreto Legislativo N° 650 y D.S. 001-97-TR — Depósitos semestrales de CTS en Mayo (periodo Nov-Abr) y Noviembre (periodo May-Oct).',
        'Cálculo de la Sexta Parte de la Gratificación — Integración del 1/6 de la última gratificación percibida a la base computable.',
        'Ley N° 32563 Art. 12 — CTS cancelatoria directa al cese para contratados en el sector público.'
      ],
      metodologia: 'Base Computable = Sueldo Básico + Asig. Familiar + (Gratificación ÷ 6). Depósito Semestral = Base Computable ÷ 12 × Meses Laborados.'
    },
    vacaciones: {
      titulo: 'Descansos Remunerados y Liquidaciones (D.Leg. 713)',
      articulos: [
        'Decreto Legislativo N° 713 y D.S. 012-92-TR — 30 días calendario de descanso vacacional remunerado por cada año completo de servicios.',
        'Vacaciones Truncas — Pago proporcional a los meses y días laborados al momento del cese laboral.',
        'Indemnización Vacacional (Art. 23 D.Leg 713) — Triple remuneración por vacaciones no gozadas en el periodo correspondiente.'
      ],
      metodologia: 'Provisión Mensual = Remuneración Computable ÷ 12. Liquidación Trunca = (Rem. Computable ÷ 12 × Meses) + (Rem. Computable ÷ 360 × Días).'
    },
    contratos: {
      titulo: 'Contratación Laboral y Directivas MINTRA 2026',
      articulos: [
        'TUO del D.Leg. 728 (D.S. 003-97-TR) — Contratos de Trabajo Sujetos a Modalidad (Inicio de Actividad, Necesidad de Mercado, Reconversión).',
        'Directiva Administrativa MINTRA 2026 — Requisitos de registro y cláusulas de desnaturalización de contratos a plazo fijo.',
        'Resolución Ministerial N° 120-2024-TR — Estándares digitales de firma y entrega de boletas/contratos.'
      ],
      metodologia: 'Redacción asistida por Groq AI incluyendo cláusulas obligatorias de causa objetiva, jornada, remuneración y ley aplicable.'
    }
  },
  finanzas: {
    flujo_caja: {
      titulo: 'Proyección de Flujo de Caja & Modelo de Liquidez',
      articulos: [
        'NIC 7 (Estado de Flujos de Efectivo) — Clasificación de flujos en actividades de operación, inversión y financiamiento.',
        'Gestión de Capital de Trabajo — Optimización del ciclo de conversión de efectivo (Días de Cobro + Días de Inventario - Días de Pago).',
        'Modelo Predictivo de Caja — Inserción de obligaciones tributarias (IGV, Renta 29%) y planilla mensual.'
      ],
      metodologia: 'Saldo Proyectado = Saldo Inicial + Ventas Cobradas - Compras Pagadas - Planilla Mensual - IGV a Pagar SUNAT.'
    },
    vencimiento_sunat: {
      titulo: 'Calendario Oficial de Vencimientos SUNAT por RUC',
      articulos: [
        'Resolución de Superintendencia N° 000281-2024/SUNAT — Cronograma para la declaración y pago de obligaciones tributarias mensuales.',
        'Determinación por Último Dígito de RUC — Fechas límites de vencimiento entre los días 12 y 22 del mes subsiguiente.',
        'Código Tributario Art. 176 inc. 1 — Multa por no presentar declaraciones dentro de los plazos establecidos (1 UIT con gradualidad 90%).'
      ],
      metodologia: 'Último dígito del RUC de la empresa determina la fecha exacta de vencimiento y el semáforo de liquidez previa.'
    },
    ratios: {
      titulo: 'Ratios Financieros de Solvencia, Prueba Ácida y EBITDA',
      articulos: [
        'NIC 1 (Presentación de Estados Financieros) — Métricas de liquidez corriente y capacidad de cobertura de pasivos circulantes.',
        'Prueba Ácida (Quick Ratio) = (Activo Corriente - Inventarios) ÷ Pasivo Corriente.',
        'EBITDA Margin = (Utilidad Operativa + Depreciación + Amortización) ÷ Ventas Totales × 100.'
      ],
      metodologia: 'Cálculo automatizado a partir del Libro Diario y Registros de Ventas/Compras de SOFTCONTABLE SaaS.'
    },
    estrategia: {
      titulo: 'Diagnóstico Estratégico y Escudo Fiscal Groq AI',
      articulos: [
        'Planeamiento Tributario Lícito vs Elusión Sustancial (Norma XVI del Título Preliminar del Código Tributario).',
        'Optimización del Escudo Fiscal por Depreciación de Activos Fijos (Art. 38 a 41 LIR).',
        'Aprovechamiento del Saldo a Favor del Exportador o Pérdidas Tributarias Compensables (Art. 50 LIR).'
      ],
      metodologia: 'Inferencia ejecutiva generada por Groq AI proponiendo medidas concretas para maximizar el flujo de caja sin riesgos fiscales.'
    }
  }
};

/**
 * Recupera el contexto normativo RAG para un pilar y módulo específico.
 */
function getNormativeContext(pillar, moduleKey) {
  if (NORMATIVA_KNOWLEDGE_BASE[pillar] && NORMATIVA_KNOWLEDGE_BASE[pillar][moduleKey]) {
    return NORMATIVA_KNOWLEDGE_BASE[pillar][moduleKey];
  }
  return {
    titulo: 'Análisis Normativo Contable 4.0',
    articulos: ['Normativa SUNAT / MINTRA aplicable al periodo vigente 2026.'],
    metodologia: 'Evaluación algorítmica de registros contables y libros electrónicos.'
  };
}

/**
 * Responde una consulta interactiva del usuario utilizando Groq AI + RAG Context.
 */
async function processRAGQuery({ pillar, moduleKey, query, workspaceData }) {
  const normativity = getNormativeContext(pillar, moduleKey);

  const prompt = `Actúa como el Auditor Contable-Tributario y Laboral de nivel Senior en Perú, especialista en Contabilidad 4.0.
Responde de forma concisa, profesional y estructurada (máximo 4 párrafos en Markdown) a la consulta del usuario sobre la empresa "${workspaceData?.companyName || 'EMPRESA'}" (RUC: ${workspaceData?.ruc || 'N/A'}).

[CONTEXTO NORMATIVO RAG APORTADO]:
- Módulo / Tema: ${normativity.titulo}
- Leyes y Artículos Base:
${normativity.articulos.map(a => `  • ${a}`).join('\n')}
- Metodología de Cálculo: ${normativity.metodologia}

[DATOS REALES DEL WORKSPACE EN SOFTCONTABLE SAAS]:
- Ventas Totales: S/ ${workspaceData?.totalVentas || '0.00'}
- Compras Totales: S/ ${workspaceData?.totalCompras || '0.00'}
- IGV Estimado a Pagar: S/ ${workspaceData?.igvEstimado || '0.00'}
- Colaboradores Registrados: ${workspaceData?.colaboradoresCount || 0}
- Sin Bancarizar: S/ ${workspaceData?.sinBancarizar || '0.00'}

[PREGUNTA DEL USUARIO]:
"${query}"

Proporciona una respuesta precisa citando la norma peruana correspondiente y dando una recomendación práctica aplicable para la empresa.`;

  try {
    const aiResponse = await geminiService.generateResponse(prompt);
    return typeof aiResponse === 'string' ? aiResponse : (aiResponse.text || 'Sin respuesta');
  } catch (err) {
    console.error('[RAG SERVICE ERROR]', err.message);
    return `De acuerdo a la normativa peruana (${normativity.articulos[0]}), se recomienda revisar el registro sustentatorio de las operaciones para evitar observaciones en fiscalizaciones.`;
  }
}

module.exports = {
  NORMATIVA_KNOWLEDGE_BASE,
  getNormativeContext,
  processRAGQuery
};
