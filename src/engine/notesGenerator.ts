import type { AppState } from '../store';
import { getTrialBalanceBalances } from './deferredTax';

export interface FinanceNote {
  number: number;
  title: string;
  content: string;
  tableData?: { headers: string[]; rows: any[][] };
}

export function generateNotesTemplates(state: AppState, deferredTaxRows: any[]): FinanceNote[] {
  const { currentCompany, journal } = state;
  const balances = getTrialBalanceBalances(journal);

  const name = currentCompany?.name || 'EMPRESA EJEMPLO S.A.C.';
  const ruc = currentCompany?.ruc || '20000000000';
  const address = currentCompany?.address || 'Av. Principal 123';
  const location = currentCompany?.location || 'Lima, Perú';
  const businessType = currentCompany?.businessType || 'COMERCIAL';
  const period = currentCompany?.period || String(new Date().getFullYear());

  const getBal = (prefix: string) => {
    return Object.entries(balances)
      .filter(([cta]) => cta.startsWith(prefix))
      .reduce((sum, [_, b]) => sum + b.saldo, 0);
  };

  const fmt = (val: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val);
  };

  const notes: FinanceNote[] = [];

  // Nota 1
  notes.push({
    number: 1,
    title: 'Constitución y Actividad Económica',
    content: `La Compañía ${name} identificada con RUC N° ${ruc} se encuentra constituida en la ciudad de ${location}, con domicilio fiscal registrado en ${address}. La actividad principal declarada de la Compañía es la actividad de tipo ${businessType.toUpperCase()}. Sus operaciones se encuentran reguladas por las leyes tributarias del Perú vigentes para el período fiscal ${period}.`
  });

  // Nota 2
  notes.push({
    number: 2,
    title: 'Bases de Preparación y Principales Políticas Contables',
    content: `Los estados financieros adjuntos han sido preparados a partir de los registros de contabilidad de la Compañía, de conformidad con las Normas Internacionales de Información Financiera (NIIF) vigentes en el Perú al 31 de diciembre del año fiscal ${period}. Las políticas contables aplicadas son consistentes con las del año anterior, salvo por el reconocimiento explícito del Impuesto Diferido según la NIC 12 y la reclasificación de activos fijos según la NIC 16.`
  });

  // Nota 3
  const cta10 = getBal('10');
  notes.push({
    number: 3,
    title: 'Efectivo y Equivalentes de Efectivo',
    content: `Al 31 de diciembre del ${period}, el efectivo y equivalentes de efectivo asciende a un total de ${fmt(cta10)}. Comprende principalmente fondos en caja chica, saldos en cuentas corrientes y depósitos de ahorro de libre disponibilidad en instituciones financieras locales, denominados en moneda nacional y moneda extranjera. No existen restricciones significativas sobre el uso de estos fondos.`,
    tableData: {
      headers: ['Concepto', 'Cuenta Contable', 'Saldo al Cierre'],
      rows: [
        ['Caja y Fondos Fijos', '101 / 102', fmt(balances['101']?.saldo || 0 + (balances['102']?.saldo || 0))],
        ['Cuentas Corrientes en Bancos', '104', fmt(balances['104']?.saldo || 0)],
        ['Otros Equivalentes de Efectivo', '107', fmt(balances['107']?.saldo || 0)],
        ['TOTAL EFECTIVO', '10', fmt(cta10)]
      ]
    }
  });

  // Nota 4
  const cta12 = getBal('12');
  const cta19 = getBal('19');
  const net12 = cta12 + cta19; // cta19 is negative
  notes.push({
    number: 4,
    title: 'Cuentas por Cobrar Comerciales',
    content: `El saldo de cuentas por cobrar comerciales representa facturas pendientes de cobro originadas por la venta de mercaderías o prestación de servicios en el curso ordinario de los negocios. Al cierre del ejercicio ${period}, el saldo bruto de clientes asciende a ${fmt(cta12)}, neto de una estimación de cobranza dudosa de ${fmt(Math.abs(cta19))} determinada sobre la base de evaluaciones periódicas de la cobrabilidad de la cartera.`,
    tableData: {
      headers: ['Concepto', 'Cuenta Contable', 'Monto Bruto / Provisión'],
      rows: [
        ['Facturas y Boletas por Cobrar Comerciales', '121 / 123', fmt(cta12)],
        ['Estimación de Cobranza Dudosa (Negativo)', '191 / 192', fmt(cta19)],
        ['TOTAL NETO CUENTAS POR COBRAR', '12 net', fmt(net12)]
      ]
    }
  });

  // Nota 5
  const cta20 = getBal('20');
  const cta29 = getBal('29');
  const netInventory = cta20 + cta29;
  notes.push({
    number: 5,
    title: 'Inventarios (Existencias)',
    content: `Los inventarios se registran al costo de adquisición o al valor neto realizable, el menor. El costo se determina bajo el método de Promedio Ponderado Móvil. Al 31 de diciembre de ${period}, el valor neto de los inventarios asciende a ${fmt(netInventory)}, que comprende existencias de almacén netas de una provisión por desvalorización de existencias de ${fmt(Math.abs(cta29))} por obsolescencia.`,
    tableData: {
      headers: ['Concepto', 'Cuenta Contable', 'Saldo'],
      rows: [
        ['Mercaderías en Almacén', '201', fmt(cta20)],
        ['Provisión por Desvalorización de Existencias', '291', fmt(cta29)],
        ['TOTAL NETO INVENTARIOS', '20 net', fmt(netInventory)]
      ]
    }
  });

  // Nota 6
  const cta33 = getBal('33');
  const cta39 = getBal('39');
  const netPPE = cta33 + cta39;
  notes.push({
    number: 6,
    title: 'Propiedad, Planta y Equipo (Activo Fijo)',
    content: `Los activos fijos se registran al costo de adquisición. La depreciación se calcula bajo el método de línea recta, aplicando tasas estimadas según la vida útil de los bienes correspondientes. Al cierre del período, el costo acumulado de los activos asciende a ${fmt(cta33)}, con una depreciación acumulada que representa ${fmt(Math.abs(cta39))}, resultando en un valor neto en libros de ${fmt(netPPE)}.`,
    tableData: {
      headers: ['Concepto', 'Cuenta Contable', 'Valor en Libros'],
      rows: [
        ['Costo de Propiedad, Planta y Equipo', '33', fmt(cta33)],
        ['Depreciación Acumulada (Negativo)', '39', fmt(cta39)],
        ['TOTAL NETO PROPIEDAD, PLANTA Y EQUIPE', '33/39 net', fmt(netPPE)]
      ]
    }
  });

  // Nota 7
  const cta42 = getBal('42');
  const cta46 = getBal('46');
  const totalPayables = cta42 + cta46;
  notes.push({
    number: 7,
    title: 'Cuentas por Pagar Comerciales y Otras',
    content: `Las cuentas por pagar comerciales se originan principalmente por adquisiciones de bienes y servicios a proveedores nacionales y extranjeros, denominadas en moneda nacional y dólares estadounidenses. Son de vencimiento corriente y no devengan intereses. Al cierre, el total acumulado de pasivos comerciales asciende a ${fmt(Math.abs(totalPayables))}.`,
    tableData: {
      headers: ['Concepto', 'Cuenta Contable', 'Monto de Obligación'],
      rows: [
        ['Facturas y Comprobantes por Pagar (Proveedores)', '421 / 422', fmt(Math.abs(cta42))],
        ['Otras Cuentas por Pagar Diversas', '46', fmt(Math.abs(cta46))],
        ['TOTAL CUENTAS POR PAGAR', '42/46', fmt(Math.abs(totalPayables))]
      ]
    }
  });

  // Nota 8
  const cta40 = getBal('40');
  const cta41 = getBal('41');
  const totalGovAndSocial = cta40 + cta41;
  notes.push({
    number: 8,
    title: 'Tributos, Remuneraciones y Beneficios Sociales',
    content: `Este rubro comprende las obligaciones pendientes de pago con el fisco (SUNAT) correspondientes a IGV, retenciones de renta e Impuesto a la Renta de Tercera Categoría, así como las provisiones de remuneraciones, vacaciones y beneficios de los trabajadores. Al cierre fiscal, el total asciende a ${fmt(Math.abs(totalGovAndSocial))}.`,
    tableData: {
      headers: ['Concepto', 'Cuenta Contable', 'Saldo por Pagar'],
      rows: [
        ['Tributos, Contraprestaciones y Aportes (SUNAT/ESSALUD)', '40', fmt(Math.abs(cta40))],
        ['Remuneraciones y Participaciones por Pagar', '41', fmt(Math.abs(cta41))],
        ['TOTAL OBLIGACIONES TRIBUTARIAS Y SOCIALES', '40/41', fmt(Math.abs(totalGovAndSocial))]
      ]
    }
  });

  // Nota 9
  const cta50 = getBal('50');
  const cta58 = getBal('58');
  const cta59 = getBal('59');
  const totalEquity = cta50 + cta58 + cta59;
  notes.push({
    number: 9,
    title: 'Patrimonio Neto',
    content: `Al 31 de diciembre de ${period}, el patrimonio neto de la Compañía asciende a ${fmt(Math.abs(totalEquity))}. Está constituido por el capital social representado por participaciones de socios, reservas de la empresa, y los resultados acumulados de ejercicios anteriores y del presente ejercicio contable.`,
    tableData: {
      headers: ['Concepto Contable', 'Cuenta', 'Saldo de Capital/Reservas'],
      rows: [
        ['Capital Social suscrito y pagado', '50', fmt(Math.abs(cta50))],
        ['Reservas (Reserva Legal)', '58', fmt(Math.abs(cta58))],
        ['Resultados Acumulados / Utilidades del Ejercicio', '59', fmt(Math.abs(cta59))],
        ['TOTAL PATRIMONIO NETO', '50/58/59', fmt(Math.abs(totalEquity))]
      ]
    }
  });

  // Nota 10
  const cta70 = getBal('70');
  notes.push({
    number: 10,
    title: 'Ventas Netas (Ingresos de Actividades Ordinarias)',
    content: `Los ingresos operacionales provienen principalmente de la venta local de mercaderías e intangibles facturados a clientes netos de devoluciones y descuentos comerciales. Los ingresos se reconocen cuando la transferencia de control del bien o servicio se formaliza. Durante el ejercicio ${period}, el total acumulado asciende a ${fmt(Math.abs(cta70))}.`
  });

  // Nota 11
  const cta62 = getBal('62');
  const cta63 = getBal('63');
  const cta64 = getBal('64');
  const cta65 = getBal('65');
  const cta68 = getBal('68');
  const totalExpenses = cta62 + cta63 + cta64 + cta65 + cta68;
  notes.push({
    number: 11,
    title: 'Gastos por Naturaleza',
    content: `Representa el conjunto de gastos incurridos en el ejercicio ordinario para la operación del negocio agrupados por su naturaleza. El total de gastos corrientes del período asciende a ${fmt(totalExpenses)}.`,
    tableData: {
      headers: ['Naturaleza del Gasto', 'Cuenta', 'Monto Incurrido'],
      rows: [
        ['Gastos de Personal, Directores y Gerentes', '62', fmt(cta62)],
        ['Gastos de Servicios Prestados por Terceros', '63', fmt(cta63)],
        ['Gastos por Tributos (Tasas, Licencias)', '64', fmt(cta64)],
        ['Otros Gastos de Gestión', '65', fmt(cta65)],
        ['Valuación y Deterioro de Activos (Depreciaciones/Provisiones)', '68', fmt(cta68)],
        ['TOTAL GASTOS OPERACIONALES', '62-68', fmt(totalExpenses)]
      ]
    }
  });

  // Nota 12
  const netDeferredTax = deferredTaxRows.reduce((sum, r) => sum + (r.activoDiferido - r.pasivoDiferido), 0);
  notes.push({
    number: 12,
    title: 'Impuesto a la Renta Diferido (NIC 12)',
    content: `El reconocimiento del Impuesto Diferido se determina comparando los saldos contables bajo NIIF frente a las bases fiscales determinadas bajo la Ley del Impuesto a la Renta. Las diferencias temporarias identificadas al ${period} generan un efecto neto en balance general de ${fmt(netDeferredTax)} (${netDeferredTax >= 0 ? 'Activo Diferido neto' : 'Pasivo Diferido neto'}) con impacto directo en el resultado del ejercicio a través de la cuenta 882.`,
    tableData: {
      headers: ['Concepto', 'Base Contable', 'Base Tributaria', 'Diferencia', 'Tipo', 'Impuesto Diferido'],
      rows: deferredTaxRows.map(r => [
        r.concepto,
        fmt(r.accountingBase),
        fmt(r.taxBase),
        fmt(r.diferencia),
        r.tipo,
        r.activoDiferido > 0 ? `Activo: ${fmt(r.activoDiferido)}` : `Pasivo: ${fmt(r.pasivoDiferido)}`
      ])
    }
  });

  return notes;
}
