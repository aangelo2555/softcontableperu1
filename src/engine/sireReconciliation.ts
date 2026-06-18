/**
 * Motor de Conciliación SIRE — Data Matching por CAR (27 chars)
 * Implementa FULL OUTER JOIN lógico entre propuesta SUNAT y ERP local.
 */

import type { SireRecord } from './sireParser';
import type { PurchaseEntry, SaleEntry } from '../store';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type DiagnosticLevel = 'ESTADO_OK' | 'RIESGO_CRITICO' | 'RIESGO_ALTO' | 'ALERTA_LEGAL_ESTADO' | 'ALERTA_MATEMATICA_VALOR';

export interface ReconciliationResult {
  identificador: string;
  diagnostico: DiagnosticLevel;
  diagnosticoDetalle: string;
  sireRecord: SireRecord | null;
  erpRecord: PurchaseEntry | SaleEntry | null;
  valorSire: number;
  valorERP: number;
  diferencia: number;
}

export interface ReconciliationSummary {
  results: ReconciliationResult[];
  totalRecords: number;
  estadoOK: number;
  riesgoCritico: number;
  riesgoAlto: number;
  alertaLegal: number;
  alertaMatematica: number;
}

// ═══════════════════════════════════════════════════════
// CAR GENERATION
// ═══════════════════════════════════════════════════════

/**
 * Genera el CAR (Código de Anotación de Registro) localmente
 * concatenando: RUC(11) + TipoDoc(2) + Serie(4) + Numero(10) = 27 chars
 */
export function generateLocalCAR(
  record: PurchaseEntry | SaleEntry,
  isSale: boolean = false,
  companyRuc?: string
): string {
  const ruc = isSale && companyRuc 
    ? companyRuc.trim().padStart(11, '0').substring(0, 11)
    : (record.doc_num || '').trim().padStart(11, '0').substring(0, 11);
  const tipo = (record.tipo_doc || '01').trim().padStart(2, '0').substring(0, 2);
  const serie = (record.serie || '0000').trim().padStart(4, '0').substring(0, 4);
  const numero = (record.numero || '0').trim().padStart(10, '0').substring(0, 10);
  return `${ruc}${tipo}${serie}${numero}`;
}

// ═══════════════════════════════════════════════════════
// RECONCILIATION ENGINE
// ═══════════════════════════════════════════════════════

const IGV_TOLERANCE = 0.50; // Umbral de discrepancia S/ 0.50

/**
 * Ejecuta la conciliación masiva entre registros SIRE y ERP.
 * Equivalente funcional del CTE SQL pero ejecutado en memoria (JavaScript).
 */
export function reconcileSireWithERP(
  sireRecords: SireRecord[],
  erpRecords: (PurchaseEntry | SaleEntry)[],
  isSale: boolean = false,
  companyRuc?: string
): ReconciliationSummary {
  const results: ReconciliationResult[] = [];

  // Indexar ERP por CAR generado localmente
  const erpByCAR = new Map<string, PurchaseEntry | SaleEntry>();
  for (const erp of erpRecords) {
    const car = generateLocalCAR(erp, isSale, companyRuc);
    erpByCAR.set(car, erp);
  }

  // Indexar SIRE por CAR oficial
  const sireByCAR = new Map<string, SireRecord>();
  for (const sire of sireRecords) {
    sireByCAR.set(sire.codigo_car, sire);
  }

  const processedERPKeys = new Set<string>();

  // ─── Recorrer registros SIRE ───
  for (const sire of sireRecords) {
    const car = sire.codigo_car;
    const erp = erpByCAR.get(car) || null;

    if (erp) processedERPKeys.add(car);

    const valorSire = sire.importe_total;
    const valorERP = erp?.total || 0;

    let diagnostico: DiagnosticLevel;
    let detalle: string;

    if (!erp) {
      diagnostico = 'RIESGO_ALTO';
      detalle = 'Comprobante Faltante en ERP (Propuesta SUNAT omitida localmente. Riesgo de pérdida de crédito fiscal)';
    } else if (sire.estado_cpe === 'ANULADO' && ['CONTABILIZADO', 'PAGADO', 'Aceptado', 'Local'].includes(erp.estado_sire || '')) {
      diagnostico = 'ALERTA_LEGAL_ESTADO';
      detalle = 'CPE figura como Anulado/Baja en SUNAT pero se mantiene activo en el sistema interno';
    } else if (Math.abs(sire.igv - (erp.igv || 0)) > IGV_TOLERANCE) {
      diagnostico = 'ALERTA_MATEMATICA_VALOR';
      detalle = `Discrepancia IGV: SIRE S/ ${sire.igv.toFixed(2)} vs ERP S/ ${(erp.igv || 0).toFixed(2)} (dif: S/ ${Math.abs(sire.igv - (erp.igv || 0)).toFixed(2)})`;
    } else {
      diagnostico = 'ESTADO_OK';
      detalle = 'Conciliación Estructural Completa';
    }

    results.push({
      identificador: car,
      diagnostico,
      diagnosticoDetalle: detalle,
      sireRecord: sire,
      erpRecord: erp,
      valorSire,
      valorERP,
      diferencia: Math.round((valorSire - valorERP) * 100) / 100,
    });
  }

  // ─── Registros ERP huérfanos (no encontrados en SIRE) ───
  for (const erp of erpRecords) {
    const car = generateLocalCAR(erp, isSale, companyRuc);
    if (!processedERPKeys.has(car)) {
      results.push({
        identificador: car,
        diagnostico: 'RIESGO_CRITICO',
        diagnosticoDetalle: 'Comprobante Faltante en SIRE (Orfandad en ERP. Posible error de envío a OSE)',
        sireRecord: null,
        erpRecord: erp,
        valorSire: 0,
        valorERP: erp.total || 0,
        diferencia: -(erp.total || 0),
      });
    }
  }

  // ─── Generar resumen ───
  return {
    results,
    totalRecords: results.length,
    estadoOK: results.filter(r => r.diagnostico === 'ESTADO_OK').length,
    riesgoCritico: results.filter(r => r.diagnostico === 'RIESGO_CRITICO').length,
    riesgoAlto: results.filter(r => r.diagnostico === 'RIESGO_ALTO').length,
    alertaLegal: results.filter(r => r.diagnostico === 'ALERTA_LEGAL_ESTADO').length,
    alertaMatematica: results.filter(r => r.diagnostico === 'ALERTA_MATEMATICA_VALOR').length,
  };
}
