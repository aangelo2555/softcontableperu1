/**
 * Parser de Comprobantes Electrónicos SUNAT UBL 2.1 (XML & CDR)
 * Compatible con Facturas (01), Boletas (03), Notas de Crédito (07), Notas de Débito (08)
 * y Constancias de Recepción CDR (ApplicationResponse).
 */

export interface CpeItem {
  id: number;
  cantidad: number;
  unidadMedida: string;
  codigo: string;
  descripcion: string;
  valorUnitario: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
  igv: number;
  icbper: number;
  afectacionIgv: string;
}

export interface CpeCuota {
  cuota: number;
  monto: number;
  fechaVencimiento: string;
}

export interface CpeParsedData {
  tipoDoc: string;
  tipoDocDescripcion: string;
  serie: string;
  numero: string;
  comprobanteCompleto: string;
  fechaEmision: string;
  horaEmision?: string;
  fechaVencimiento?: string;
  moneda: string;
  monedaSimbolo: string;
  formaPago: string;
  cuotas: CpeCuota[];

  // Emisor
  emisor: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    direccion?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    ubigeo?: string;
  };

  // Receptor
  receptor: {
    tipoDoc: string;
    numDoc: string;
    razonSocial: string;
    direccion?: string;
  };

  // Items
  items: CpeItem[];

  // Totales
  totales: {
    gravado: number;
    exonerado: number;
    inafecto: number;
    gratuito: number;
    exportacion: number;
    descuentoGlobal: number;
    totalDescuentos: number;
    igv: number;
    isc: number;
    icbper: number;
    otrosCargos: number;
    redondeo: number;
    total: number;
    montoEnLetras: string;
  };

  // Seguridad y Firma
  seguridad: {
    hash: string;
    firma: string;
    qrString?: string;
  };

  // Datos CDR (si está presente)
  cdr?: {
    codigoRespuesta: string;
    descripcionRespuesta: string;
    fechaRecepcion?: string;
    horaRecepcion?: string;
    hashCdr?: string;
    aceptado: boolean;
  };
}

const TIPO_DOC_MAP: Record<string, string> = {
  '01': 'FACTURA ELECTRÓNICA',
  '03': 'BOLETA DE VENTA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA',
  'R1': 'RECIBO POR HONORARIOS ELECTRÓNICO'
};

const MONEDA_SIMBOLO_MAP: Record<string, string> = {
  'PEN': 'S/',
  'USD': '$',
  'EUR': '€'
};

/**
 * Función principal para parsear XML de Factura/Boleta UBL 2.1
 */
export function parseCpeXml(xmlString: string, cdrXmlString?: string): CpeParsedData {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Contenido XML inválido o vacío.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

  // Helper para buscar elementos sin importar el namespace
  const getTag = (parent: Element | Document | null, tagName: string): Element | null => {
    if (!parent) return null;
    const el = parent.getElementsByTagName(tagName)[0] || 
               parent.getElementsByTagName(`cbc:${tagName}`)[0] || 
               parent.getElementsByTagName(`cac:${tagName}`)[0];
    if (el) return el;

    // Fallback: búsqueda por localName
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].localName === tagName) return all[i];
    }
    return null;
  };

  const getText = (parent: Element | Document | null, tagName: string): string => {
    if (!parent) return '';
    const el = getTag(parent, tagName);
    return el?.textContent?.trim() || '';
  };

  const getNumber = (parent: Element | Document | null, tagName: string): number => {
    const txt = getText(parent, tagName);
    const num = parseFloat(txt);
    return isNaN(num) ? 0 : Number(num.toFixed(2));
  };

  // 1. Identificación del Comprobante
  const fullId = getText(xmlDoc, 'ID') || '';
  const [serie = '', numero = ''] = fullId.includes('-') ? fullId.split('-') : ['', ''];
  const tipoDocCode = getText(xmlDoc, 'InvoiceTypeCode') || '01';
  const tipoDocDesc = TIPO_DOC_MAP[tipoDocCode] || 'COMPROBANTE ELECTRÓNICO';
  const fechaEmision = getText(xmlDoc, 'IssueDate') || '';
  const horaEmision = getText(xmlDoc, 'IssueTime') || '';
  const fechaVencimiento = getText(xmlDoc, 'DueDate') || fechaEmision;
  const moneda = getText(xmlDoc, 'DocumentCurrencyCode') || 'PEN';
  const monedaSimbolo = MONEDA_SIMBOLO_MAP[moneda] || 'S/';

  // 2. Datos del Emisor
  const supplierParty = getTag(xmlDoc, 'AccountingSupplierParty');
  const emisorRuc = getText(supplierParty, 'ID') || getText(supplierParty, 'CustomerAssignedAccountID') || '';
  const emisorRazon = getText(supplierParty, 'RegistrationName') || getText(supplierParty, 'Name') || '';
  const emisorComercial = getText(supplierParty, 'Name') || emisorRazon;
  const emisorDir = getText(supplierParty, 'Line') || getText(supplierParty, 'StreetName') || '';
  const emisorDep = getText(supplierParty, 'CitySubdivisionName') || getText(supplierParty, 'CityName') || '';
  const emisorProv = getText(supplierParty, 'CountrySubentity') || '';
  const emisorDist = getText(supplierParty, 'District') || '';
  const emisorUbi = getText(supplierParty, 'ID') || '';

  // 3. Datos del Receptor / Cliente
  const customerParty = getTag(xmlDoc, 'AccountingCustomerParty');
  const receptorRuc = getText(customerParty, 'ID') || '';
  const receptorRazon = getText(customerParty, 'RegistrationName') || getText(customerParty, 'Name') || '';
  const receptorDir = getText(customerParty, 'Line') || getText(customerParty, 'StreetName') || '';
  const receptorTipoDoc = getTag(customerParty, 'ID')?.getAttribute('schemeID') || '6';

  // 4. Forma de Pago y Cuotas
  let formaPago = 'Contado';
  const cuotas: CpeCuota[] = [];
  const paymentTermsElements = xmlDoc.getElementsByTagName('cac:PaymentTerms') || xmlDoc.getElementsByTagName('PaymentTerms');
  
  for (let i = 0; i < paymentTermsElements.length; i++) {
    const pt = paymentTermsElements[i];
    const id = getText(pt, 'ID');
    const desc = getText(pt, 'PaymentMeansID') || getText(pt, 'Note');
    if (id?.toLowerCase().includes('formapago') || desc) {
      if (desc?.toLowerCase().includes('credito') || desc?.toLowerCase().includes('crédito')) {
        formaPago = 'Crédito';
      }
    }
    if (id?.toLowerCase().includes('cuota')) {
      const cuotaNum = parseInt(id.replace(/\D/g, '')) || (cuotas.length + 1);
      const cuotaMonto = getNumber(pt, 'Amount');
      const cuotaFecha = getText(pt, 'PaymentDueDate');
      cuotas.push({ cuota: cuotaNum, monto: cuotaMonto, fechaVencimiento: cuotaFecha });
    }
  }

  // 5. Items / Líneas de Detalle
  const items: CpeItem[] = [];
  const lineNodes = xmlDoc.getElementsByTagName('cac:InvoiceLine').length > 0 ? 
                    xmlDoc.getElementsByTagName('cac:InvoiceLine') : 
                    xmlDoc.getElementsByTagName('cac:CreditNoteLine').length > 0 ?
                    xmlDoc.getElementsByTagName('cac:CreditNoteLine') :
                    xmlDoc.getElementsByTagName('InvoiceLine');

  for (let i = 0; i < lineNodes.length; i++) {
    const line = lineNodes[i];
    const cantidad = getNumber(line, 'InvoicedQuantity') || getNumber(line, 'CreditedQuantity') || getNumber(line, 'DebitedQuantity') || 1;
    const unidadMedida = getTag(line, 'InvoicedQuantity')?.getAttribute('unitCode') || 
                         getTag(line, 'CreditedQuantity')?.getAttribute('unitCode') || 'NIU';
    const subtotal = getNumber(line, 'LineExtensionAmount');
    const descripcion = getText(line, 'Description') || getText(line, 'Name');
    const codigo = getText(line, 'ID') || `ITEM-${i + 1}`;
    const valorUnitario = getNumber(line, 'PriceAmount') || (cantidad > 0 ? Number((subtotal / cantidad).toFixed(4)) : subtotal);
    const precioUnitario = getNumber(getTag(line, 'AlternativeConditionPrice'), 'PriceAmount') || Number((valorUnitario * 1.18).toFixed(4));
    const afectacionIgv = getText(getTag(line, 'TaxScheme'), 'ID') || '10';

    items.push({
      id: i + 1,
      cantidad,
      unidadMedida,
      codigo,
      descripcion,
      valorUnitario,
      precioUnitario,
      descuento: 0,
      subtotal,
      igv: Number((subtotal * 0.18).toFixed(2)),
      icbper: 0,
      afectacionIgv
    });
  }

  // 6. Totales
  const legalMonetaryTotal = getTag(xmlDoc, 'LegalMonetaryTotal') || getTag(xmlDoc, 'RequestedMonetaryTotal');
  const gravado = getNumber(legalMonetaryTotal, 'LineExtensionAmount') || items.reduce((s, it) => s + it.subtotal, 0);
  const total = getNumber(legalMonetaryTotal, 'PayableAmount') || getNumber(legalMonetaryTotal, 'TaxInclusiveAmount');
  const igv = getNumber(getTag(xmlDoc, 'TaxTotal'), 'TaxAmount') || Number((gravado * 0.18).toFixed(2));
  const descuentoGlobal = getNumber(legalMonetaryTotal, 'AllowanceTotalAmount');

  // Monto en letras (Notas)
  let montoEnLetras = '';
  const noteElements = xmlDoc.getElementsByTagName('cbc:Note') || xmlDoc.getElementsByTagName('Note');
  for (let i = 0; i < noteElements.length; i++) {
    const txt = noteElements[i].textContent || '';
    if (txt.toUpperCase().includes('SON:') || txt.toUpperCase().includes('SOLES') || txt.toUpperCase().includes('DOLARES')) {
      montoEnLetras = txt.trim();
      break;
    }
  }
  if (!montoEnLetras && total > 0) {
    montoEnLetras = `SON: ${total.toFixed(2)} ${moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES'}`;
  }

  // 7. Seguridad y Firma Digital
  const hash = getText(xmlDoc, 'DigestValue');
  const firma = getText(xmlDoc, 'SignatureValue');

  // 8. CDR Parsing (si se proporciona)
  let cdrData: CpeParsedData['cdr'] = undefined;
  if (cdrXmlString) {
    try {
      const cdrDoc = parser.parseFromString(cdrXmlString, 'application/xml');
      const responseCode = getText(cdrDoc, 'ResponseCode');
      const responseDesc = getText(cdrDoc, 'Description');
      const cdrDate = getText(cdrDoc, 'IssueDate');
      const cdrTime = getText(cdrDoc, 'IssueTime');
      const cdrHash = getText(cdrDoc, 'DigestValue');

      cdrData = {
        codigoRespuesta: responseCode || '0',
        descripcionRespuesta: responseDesc || 'El comprobante ha sido aceptado por SUNAT.',
        fechaRecepcion: cdrDate,
        horaRecepcion: cdrTime,
        hashCdr: cdrHash,
        aceptado: responseCode === '0' || responseDesc.toLowerCase().includes('aceptad')
      };
    } catch (e) {}
  }

  return {
    tipoDoc: tipoDocCode,
    tipoDocDescripcion: tipoDocDesc,
    serie,
    numero,
    comprobanteCompleto: fullId,
    fechaEmision,
    horaEmision,
    fechaVencimiento,
    moneda,
    monedaSimbolo,
    formaPago,
    cuotas,
    emisor: {
      ruc: emisorRuc,
      razonSocial: emisorRazon,
      nombreComercial: emisorComercial,
      direccion: [emisorDir, emisorDist, emisorProv, emisorDep].filter(Boolean).join(' - '),
      departamento: emisorDep,
      provincia: emisorProv,
      distrito: emisorDist,
      ubigeo: emisorUbi
    },
    receptor: {
      tipoDoc: receptorTipoDoc,
      numDoc: receptorRuc,
      razonSocial: receptorRazon,
      direccion: receptorDir
    },
    items,
    totales: {
      gravado,
      exonerado: 0,
      inafecto: 0,
      gratuito: 0,
      exportacion: 0,
      descuentoGlobal,
      totalDescuentos: descuentoGlobal,
      igv,
      isc: 0,
      icbper: 0,
      otrosCargos: 0,
      redondeo: 0,
      total,
      montoEnLetras
    },
    seguridad: {
      hash,
      firma
    },
    cdr: cdrData
  };
}
