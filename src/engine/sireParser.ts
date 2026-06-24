/**
 * SIRE Parser — Ingesta de Anexos 3 y 11 (archivos TXT delimitados por |)
 * Valida longitudes exactas de campos clave (RUC=11, CAR=27).
 */

import sireConfig from './sire_ingestion_config.json';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface SireRecord {
  ruc_emisor: string;
  codigo_car: string;
  tipo_comprobante: string;
  serie: string;
  numero: string;
  fecha_emision: string;
  base_imponible: number;
  igv: number;
  importe_total: number;
  estado_cpe: string;
  /** Línea original para trazabilidad */
  raw_line_number: number;
  /** Errores de validación detectados */
  validation_errors: string[];
}

export interface SireParseResult {
  records: SireRecord[];
  totalLines: number;
  validRecords: number;
  errorRecords: number;
  errors: { line: number; message: string }[];
}

// ═══════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════

const DELIMITER = sireConfig.sire_ingestion_pipeline.delimiter_char;
const BATCH_SIZE = sireConfig.sire_ingestion_pipeline.batch_processing_size;

/**
 * Parsea un archivo TXT del SIRE (Anexo 3 RVIE o Anexo 11 RCE).
 * @param content Contenido completo del archivo TXT
 * @returns Resultado del parseo con registros y errores
 */
export function parseSireTxt(content: string, isRvie: boolean = false): SireParseResult {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const records: SireRecord[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();

    // Saltar líneas de cabecera si las hubiera
    if (line.startsWith('#') || line.startsWith('//')) continue;

    const fields = line.split(DELIMITER);

    // Mínimo de campos esperados
    const minFields = isRvie ? 26 : 25;
    if (fields.length < minFields) {
      errors.push({ line: lineNumber, message: `Campos insuficientes: ${fields.length}/${minFields}+` });
      continue;
    }

    const validationErrors: string[] = [];

    // ─── Extraer campos clave ───
    const ruc = (fields[isRvie ? 0 : 12] || '').trim(); // Para RVIE el emisor es la propia empresa (index 0). Para RCE el emisor es el proveedor (index 12).
    const car = (fields[3] || '').trim();
    const tipoComp = (fields[6] || '').trim();
    const serie = (fields[7] || '').trim();
    const numero = (fields[isRvie ? 8 : 9] || '').trim(); // Para RCE la columna de DUA ocupa index 8, el número de documento está en index 9.
    const fechaEmision = (fields[4] || '').trim(); // Fecha de emisión está en index 4 (col5_fecEmision) para ambos.
    const estadoCPE = (fields[fields.length - 1] || '').trim();

    // ─── Validar longitudes ───
    if (ruc.length !== 11) {
      validationErrors.push(`RUC inválido: "${ruc}" (${ruc.length} chars, esperado 11)`);
    }
    if (car.length !== 27 && car.length > 0) {
      validationErrors.push(`CAR inválido: "${car}" (${car.length} chars, esperado 27)`);
    }
    if (tipoComp.length > 2) {
      validationErrors.push(`Tipo comprobante inválido: "${tipoComp}"`);
    }

    // ─── Parsear campos monetarios ───
    const bi = parseDecimal(fields[isRvie ? 14 : 14]); // col15_baseImponibleGravada es index 14 para ambos.
    const igv = parseDecimal(fields[isRvie ? 16 : 15]); // col17_igvIpm para RVIE (index 16), col16_igvGravada para RCE (index 15).
    const total = parseDecimal(fields[isRvie ? 25 : 24]); // col26_importeTotal para RVIE (index 25), col25_importeTotal para RCE (index 24).

    records.push({
      ruc_emisor: ruc,
      codigo_car: car,
      tipo_comprobante: tipoComp.padStart(2, '0'),
      serie,
      numero,
      fecha_emision: fechaEmision,
      base_imponible: bi,
      igv,
      importe_total: total,
      estado_cpe: estadoCPE,
      raw_line_number: lineNumber,
      validation_errors: validationErrors,
    });

    if (validationErrors.length > 0) {
      errors.push({ line: lineNumber, message: validationErrors.join('; ') });
    }
  }

  return {
    records,
    totalLines: lines.length,
    validRecords: records.filter(r => r.validation_errors.length === 0).length,
    errorRecords: records.filter(r => r.validation_errors.length > 0).length,
    errors,
  };
}

function parseDecimal(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.trim().replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
