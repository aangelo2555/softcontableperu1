export interface GlosaHabitual {
  id: string;
  category?: string;
  glosa: string;
  lines: { cuenta: string, detalle: string }[];
}

export const SEED_GLOSAS: (Omit<GlosaHabitual, 'id'> & { category: string })[] = [
  // --- SECTOR COMERCIAL (CASOS REALES) ---
  {
    category: "COMERCIAL",
    glosa: "3.1. COMERCIAL: ANTICIPOS RECIBIDOS DE CLIENTES (A11)",
    lines: [
      { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
      { cuenta: "122", detalle: "ANTICIPOS DE CLIENTES" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el cobro del anticipo y emisión de factura" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "3.2. COMERCIAL: ANTICIPOS A PROVEEDORES LOCALES (A12-A13)",
    lines: [
      { cuenta: "422", detalle: "ANTICIPOS A PROVEEDORES" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "4212", detalle: "EMITIDAS (LIQ. ANTICIPO)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la recepción de la factura por anticipo" },
      { cuenta: "4212", detalle: "EMITIDAS (PAGO)" },
      { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el pago del anticipo al proveedor" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "4.1. COMERCIAL: DEVOLUCIÓN MERCADERÍA PROVEEDOR (A14-A15)",
    lines: [
      { cuenta: "4212", detalle: "EMITIDAS (NC REVERSIÓN)" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "6011", detalle: "MERCADERÍAS MANUFACTURADAS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de la Nota de Crédito" },
      { cuenta: "6111", detalle: "MERCADERÍAS MANUFACTURADAS" },
      { cuenta: "20111", detalle: "COSTO (EXTORNO ALMACÉN)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el extorno del ingreso al almacén" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "4.2. COMERCIAL: DESCUENTOS PRONTO PAGO CONCEDIDOS (A16)",
    lines: [
      { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
      { cuenta: "675", detalle: "DESCUENTOS CONCEDIDOS PRONTO PAGO" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA (REVERSIÓN)" },
      { cuenta: "1212", detalle: "EMITIDAS EN CARTERA" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el cobro con descuento financiero (Nota de Crédito)" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "5.1. COMERCIAL: VENTA Y CANJE DE GIFT CARDS (A17-A18)",
    lines: [
      { cuenta: "1041", detalle: "CUENTAS CORRIENTES OPERATIVAS" },
      { cuenta: "122", detalle: "ANTICIPOS DE CLIENTES (GIFT CARDS)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la venta y cobro de la Gift Card (Pasivo)" },
      { cuenta: "122", detalle: "ANTICIPOS DE CLIENTES (CANJE)" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "701", detalle: "MERCADERÍAS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el canje de la Gift Card y reconocimiento de ingreso" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "5.2. COMERCIAL: ENTREGA DE MUESTRAS GRATIS (A19-A20)",
    lines: [
      { cuenta: "659", detalle: "OTROS GASTOS DE GESTIÓN (MUESTRAS)" },
      { cuenta: "6415", detalle: "IGV ASUMIDO (RETIRO BIENES)" },
      { cuenta: "20111", detalle: "COSTO (MERCADERÍA)" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el gasto de promoción y retiro de bienes" },
      { cuenta: "951", detalle: "GASTOS DE VENTAS" },
      { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el destino del gasto por promoción" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "6.1. COMERCIAL: COBRANZA DUDOSA Y CASTIGO (A21-A22)",
    lines: [
      { cuenta: "6841", detalle: "ESTIMACIÓN CUENTAS COBRANZA DUDOSA" },
      { cuenta: "1911", detalle: "FACTURAS POR COBRAR" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de la provisión cobranza dudosa" },
      { cuenta: "1911", detalle: "FACTURAS POR COBRAR" },
      { cuenta: "1212", detalle: "EMITIDAS EN CARTERA" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el castigo de la cuenta (Baja en libros)" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "6.2. COMERCIAL: DESMEDRO CON ACTA NOTARIAL (A23-A25)",
    lines: [
      { cuenta: "6851", detalle: "DESVALORIZACIÓN DE MERCADERÍAS" },
      { cuenta: "2911", detalle: "MERCADERÍAS (DETERIORO)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento del deterioro (Desmedro)" },
      { cuenta: "941", detalle: "GASTOS ADMINISTRATIVOS" },
      { cuenta: "781", detalle: "CARGAS CUBIERTAS POR PROVISIONES" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el destino del gasto por deterioro" },
      { cuenta: "2911", detalle: "MERCADERÍAS" },
      { cuenta: "20111", detalle: "COSTO (BAJA DESTRUC.)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la baja en libros de la mercadería destruida" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "7. COMERCIAL: ALQUILER LOCAL - RETENCIÓN 5% (A26-A27)",
    lines: [
      { cuenta: "6351", detalle: "ALQUILER DE EDIFICACIONES" },
      { cuenta: "40172", detalle: "RETENCIONES 2DA CATEGORÍA" },
      { cuenta: "4699", detalle: "OTRAS CUENTAS POR PAGAR" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la provisión del alquiler y retención 5%" },
      { cuenta: "951", detalle: "GASTOS DE VENTAS" },
      { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el destino del gasto de alquiler" }
    ]
  },
  {
    category: "COMERCIAL",
    glosa: "8. COMERCIAL: CIERRE CONTABLE INTEGRAL (A28-A30)",
    lines: [
      { cuenta: "6111", detalle: "VARIACIÓN DE INVENTARIOS" },
      { cuenta: "69121", detalle: "COSTO DE VENTAS (CIERRE)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la cancelación del costo de ventas" },
      { cuenta: "801", detalle: "MARGEN COMERCIAL" },
      { cuenta: "6011", detalle: "COMPRAS (CANCELACIÓN)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la determinación del margen comercial" },
      { cuenta: "70121", detalle: "VENTAS (CANCELACIÓN)" },
      { cuenta: "801", detalle: "MARGEN COMERCIAL (SALDO)" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la cancelación de ventas al margen comercial" }
    ]
  },

  // --- SECTOR INDUSTRIAL ---
  {
    category: "INDUSTRIAL",
    glosa: "2.1. INDUSTRIAL: CONSUMO MATERIA PRIMA (A20-A21)",
    lines: [
      { cuenta: "6121", detalle: "VARIACIÓN DE INVENTARIOS" },
      { cuenta: "2411", detalle: "MATERIAS PRIMAS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el consumo de materia prima por naturaleza" },
      { cuenta: "90111", detalle: "MATERIA PRIMA - DPTO CORTE" },
      { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el destino al centro de costos productivo" }
    ]
  },
  {
    category: "INDUSTRIAL",
    glosa: "2.2. INDUSTRIAL: PLANILLA OPERARIOS MOD (A22-A23)",
    lines: [
      { cuenta: "6211", detalle: "SUELDOS Y SALARIOS" },
      { cuenta: "6271", detalle: "ESSALUD" },
      { cuenta: "4031", detalle: "ESSALUD" },
      { cuenta: "417", detalle: "AFP (RETENCIÓN)" },
      { cuenta: "4111", detalle: "SUELDOS POR PAGAR" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de la planilla por naturaleza" },
      { cuenta: "90211", detalle: "MOD - DPTO CORTE" },
      { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el destino de la mano de obra directa" }
    ]
  },
  {
    category: "INDUSTRIAL",
    glosa: "2.3. INDUSTRIAL: CIF Y DEPRECIACIÓN (A24-A25)",
    lines: [
      { cuenta: "6361", detalle: "ENERGÍA ELÉCTRICA" },
      { cuenta: "6814", detalle: "DEPRECIACIÓN PPE" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "4212", detalle: "EMITIDAS" },
      { cuenta: "3952", detalle: "DEPRECIACIÓN MAQUINARIAS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el reconocimiento de depreciación y energía" },
      { cuenta: "90311", detalle: "CIF - ENERGÍA Y DEPREC." },
      { cuenta: "791", detalle: "CARGAS IMPUTABLES" },
      { cuenta: "781", detalle: "CARGAS DEDUCIBLES" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el destino de los CIF" }
    ]
  },
  {
    category: "INDUSTRIAL",
    glosa: "2.4. INDUSTRIAL: LIQUIDACIÓN DE PRODUCCIÓN (A26)",
    lines: [
      { cuenta: "211", detalle: "PRODUCTOS MANUFACTURADOS" },
      { cuenta: "7111", detalle: "PRODUCTOS MANUFACTURADOS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la incorporación al inventario de productos terminados" }
    ]
  },

  // --- SECTOR SERVICIOS ---
  {
    category: "SERVICIOS",
    glosa: "6.1. SERVICIOS: HONORARIOS 4TA CATEGORÍA (A41)",
    lines: [
      { cuenta: "632", detalle: "ASESORÍA Y CONSULTORÍA" },
      { cuenta: "4017", detalle: "RETENCIONES 4TA CATEGORÍA" },
      { cuenta: "424", detalle: "HONORARIOS POR PAGAR" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la provisión del servicio y retención del 8%" }
    ]
  },
  {
    category: "SERVICIOS",
    glosa: "6.2. SERVICIOS: FACTURACIÓN Y DETRACCIÓN 12% (A42-A43)",
    lines: [
      { cuenta: "1212", detalle: "EMITIDAS EN CARTERA" },
      { cuenta: "40111", detalle: "IGV - CUENTA PROPIA" },
      { cuenta: "7041", detalle: "PRESTACIÓN DE SERVICIOS" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por la emisión de factura de servicios especializados" },
      { cuenta: "1041", detalle: "CC OPERATIVAS (NETO)" },
      { cuenta: "1042", detalle: "CC FINES ESPECÍFICOS (BN)" },
      { cuenta: "1212", detalle: "COBRO FACTURA" },
      { cuenta: "GLOSA", detalle: "{FECHA} Por el cobro de factura y depósito detracción 12%" }
    ]
  }
];
