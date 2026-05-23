/**
 * Constantes tributarias del sistema contable peruano.
 * Centraliza todos los catálogos, tablas SUNAT y configuraciones fiscales.
 */

// ══════════════════════════════════════════════════════
// REGÍMENES TRIBUTARIOS
// ══════════════════════════════════════════════════════

export interface RegimenTributario {
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  librosObligatorios: string[];
  igvRequired: boolean;
  rentaMensual: string;
  limiteIngresos: string;
}

export const REGIMENES_TRIBUTARIOS: RegimenTributario[] = [
  {
    code: 'RG',
    label: 'Régimen General',
    shortLabel: 'General',
    description: 'Sin límite de ingresos. Todos los libros contables. IR 29.5%.',
    librosObligatorios: ['Diario', 'Mayor', 'Reg. Compras', 'Reg. Ventas', 'Balance', 'HHTT', 'Inventario'],
    igvRequired: true,
    rentaMensual: 'Pagos a cuenta (coef. o 1.5%)',
    limiteIngresos: 'Sin límite',
  },
  {
    code: 'MYPE',
    label: 'Régimen MYPE Tributario',
    shortLabel: 'MYPE',
    description: 'Hasta 1,700 UIT de ingresos anuales. IR 10% hasta 15 UIT, 29.5% exceso.',
    librosObligatorios: ['Diario Simplificado', 'Reg. Compras', 'Reg. Ventas'],
    igvRequired: true,
    rentaMensual: '1% hasta 300 UIT, luego coef.',
    limiteIngresos: '1,700 UIT',
  },
  {
    code: 'RER',
    label: 'Régimen Especial de Renta',
    shortLabel: 'RER',
    description: 'Hasta 525,000 soles de ingresos anuales. IR 1.5% mensual.',
    librosObligatorios: ['Reg. Compras', 'Reg. Ventas'],
    igvRequired: true,
    rentaMensual: '1.5% de ingresos netos',
    limiteIngresos: 'S/ 525,000 anuales',
  },
  {
    code: 'NRUS',
    label: 'Nuevo RUS',
    shortLabel: 'NRUS',
    description: 'Hasta S/ 96,000 anuales. Cuota fija mensual. Sin obligación de libros.',
    librosObligatorios: [],
    igvRequired: false,
    rentaMensual: 'Cuota fija (S/20 o S/50)',
    limiteIngresos: 'S/ 96,000 anuales',
  },
];

// ══════════════════════════════════════════════════════
// TIPO DE DOCUMENTOS (Tabla 10 SUNAT)
// ══════════════════════════════════════════════════════

export const TIPO_COMPROBANTES = [
  { code: '01', label: 'FACTURA' },
  { code: '02', label: 'RECIBO POR HONORARIOS' },
  { code: '03', label: 'BOLETA DE VENTA' },
  { code: '04', label: 'LIQUIDACIÓN DE COMPRA' },
  { code: '05', label: 'BOLETO DE TRANSPORTE' },
  { code: '06', label: 'CARTA DE PORTE AÉREO' },
  { code: '07', label: 'NOTA DE CRÉDITO' },
  { code: '08', label: 'NOTA DE DÉBITO' },
  { code: '10', label: 'RECIBO POR ARRENDAMIENTO' },
  { code: '11', label: 'PÓLIZA BOLSA DE VALORES' },
  { code: '12', label: 'TICKET MÁQUINA REG.' },
  { code: '13', label: 'DOCUMENTO ENTIDADES FINANCIERAS' },
  { code: '14', label: 'RECIBO SERV. PÚBLICOS' },
  { code: '18', label: 'DOCUMENTO EMITIDO POR AFPS' },
  { code: '50', label: 'DUA - IMPORTACIÓN' },
  { code: '52', label: 'DUA - EXPORTACIÓN' },
  { code: '91', label: 'COMPROBANTE INTERNO' },
  { code: '00', label: 'OTROS' },
];

// Subconjunto más usado para compras
export const TIPO_DOCS_COMPRAS = TIPO_COMPROBANTES.filter(t => 
  ['01', '03', '04', '07', '08', '10', '12', '14', '50', '00'].includes(t.code)
);

// Subconjunto más usado para ventas
export const TIPO_DOCS_VENTAS = TIPO_COMPROBANTES.filter(t => 
  ['01', '03', '07', '08', '12', '00'].includes(t.code)
);

// ══════════════════════════════════════════════════════
// TIPO DE DOCUMENTO DE IDENTIDAD (Tabla 2 SUNAT)
// ══════════════════════════════════════════════════════

export const TIPO_DOC_IDENTIDAD = [
  { code: '0', label: 'OTROS', longitud: 15 },
  { code: '1', label: 'DNI', longitud: 8 },
  { code: '4', label: 'CARNET DE EXTRANJERÍA', longitud: 12 },
  { code: '6', label: 'RUC', longitud: 11 },
  { code: '7', label: 'PASAPORTE', longitud: 12 },
  { code: 'A', label: 'CÉDULA DIPLOMÁTICA', longitud: 15 },
];

// ══════════════════════════════════════════════════════
// TIPO DE OPERACIÓN (Tabla 12 SUNAT) — Compras
// ══════════════════════════════════════════════════════

export const TIPO_OPERACION_COMPRAS = [
  { code: '01', label: 'Grav. destino op. gravadas y/o exportación', tipoBi: 'gravada' },
  { code: '02', label: 'Grav. destino op. gravadas y no gravadas', tipoBi: 'mixta' },
  { code: '03', label: 'Grav. destino op. no gravadas', tipoBi: 'gravada_no' },
  { code: '04', label: 'Adquisiciones no gravadas', tipoBi: 'no_gravada' },
  { code: '05', label: 'Adquisiciones de activo fijo grav.', tipoBi: 'gravada' },
  { code: '06', label: 'Adquisiciones de activo fijo mixtas', tipoBi: 'mixta' },
  { code: '07', label: 'Descuento del IGV', tipoBi: 'descuento' },
  { code: '10', label: 'Importaciones', tipoBi: 'importacion' },
  { code: '11', label: 'Importaciones de activo fijo', tipoBi: 'importacion' },
  { code: '30', label: 'Ajuste por retenciones percibidas', tipoBi: 'ajuste' },
];

// ══════════════════════════════════════════════════════
// TIPO DE OPERACIÓN (Tabla 12 SUNAT) — Ventas
// ══════════════════════════════════════════════════════

export const TIPO_OPERACION_VENTAS = [
  { code: '01', label: 'Venta interna gravada' },
  { code: '02', label: 'Exportación de bienes' },
  { code: '03', label: 'Ventas no gravadas' },
  { code: '04', label: 'Ventas exoneradas' },
  { code: '05', label: 'Venta inafecta' },
  { code: '07', label: 'Descuentos y bonificaciones' },
  { code: '08', label: 'Exportación de servicios' },
];

// ══════════════════════════════════════════════════════
// TASAS DE IGV
// ══════════════════════════════════════════════════════

export const TASAS_IGV = [
  { value: 0.18, label: '18.0% (General)' },
  { value: 0.10, label: '10.0% (Reducida 2025)' },
  { value: 0.105, label: '10.5% (Reducida 2026)' },
  { value: 0, label: '0% (Inafecto/Exonerado)' },
];

// ══════════════════════════════════════════════════════
// CUENTAS CONTABLES POR DEFECTO
// ══════════════════════════════════════════════════════

export const CTA_ABONO_COMPRAS = [
  { code: '4212', label: '4212 - EMITIDAS' },
  { code: '4211', label: '4211 - NO EMITIDAS' },
  { code: '421', label: '421 - FACT.BOL. Y OTROS' },
  { code: '423', label: '423 - LETRAS POR PAGAR' },
];

export const CTA_CARGO_VENTAS = [
  { code: '1212', label: '1212 - EMITIDAS EN CARTERA' },
  { code: '1211', label: '1211 - NO EMITIDAS' },
  { code: '1213', label: '1213 - EN COBRANZA' },
  { code: '123', label: '123 - LETRAS POR COBRAR' },
];

// ══════════════════════════════════════════════════════
// MONEDAS
// ══════════════════════════════════════════════════════

export const MONEDAS = [
  { code: 'PEN', label: 'SOLES' },
  { code: 'USD', label: 'DÓLARES' },
];

// ══════════════════════════════════════════════════════
// RETENCIÓN IR 4TA CATEGORÍA (Honorarios)
// ══════════════════════════════════════════════════════

/** Tasa de retención IR 4ta categoría */
export const TASA_RETENCION_4TA = 0.08;

/** Monto mínimo para aplicar retención IR 4ta */
export const UMBRAL_RETENCION_4TA = 1500;

// ══════════════════════════════════════════════════════
// UIT (D.S. N.º 302-2025-EF para 2026)
// ══════════════════════════════════════════════════════

export const UIT_POR_ANIO: Record<string, number> = {
  '2024': 5150,
  '2025': 5350,
  '2026': 5500,
};

export function getUIT(anio: string): number {
  return UIT_POR_ANIO[anio] || UIT_POR_ANIO['2026'];
}

// ══════════════════════════════════════════════════════
// CONSTANTES FISCALES GLOBALES 2026
// ══════════════════════════════════════════════════════

/** Valor UIT vigente para el ejercicio 2026 */
export const UIT_2026 = 5500;

/** Tasa IGV base (sin IPM) */
export const IGV_BASE_RATE = 0.14;

/** Tasa IPM (Impuesto de Promoción Municipal) */
export const IPM_BASE_RATE = 0.04;

/** Tasa total IGV+IPM */
export const TOTAL_TAX_RATE_IGV = 0.18;

/** Umbral NIIF 16: 1/4 UIT para capitalización de activos */
export const UMBRAL_ACTIVO_FIJO_NIIF16 = UIT_2026 / 4; // S/ 1,375.00

/** Tasas de Impuesto a la Renta corporativo */
export const CORPORATE_TAX = {
  RMT_TIER_1_MAX_UIT: 15,
  RMT_TIER_1_RATE: 0.10,
  RMT_TIER_2_RATE: 0.295,
  RG_FLAT_RATE: 0.295,
} as const;

// ══════════════════════════════════════════════════════
// CONSTANTES ADICIONALES SPRINT 3
// ══════════════════════════════════════════════════════

export const UMBRAL_DAOT = 3500;
export const UMBRAL_RETENCION_IR_3RA = 700;
export const ITF_RATE = 0.00005;
export const TIM_SUNAT_MENSUAL = 0.009;
export const IR_RMT_LIMIT_UIT = 1700;
export const IR_RER_LIMIT = 525000;
export const NRUS_CAT1_LIMIT = 5000;
export const NRUS_CAT2_LIMIT = 8000;
