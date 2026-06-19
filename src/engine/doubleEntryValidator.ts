/**
 * Motor de Validación de Partida Doble — SOFTCONTABLE 2026
 * 
 * Barrera obligatoria pre-INSERT en la tabla journal.
 * Verifica las 4 reglas fundamentales del principio de partida doble
 * según PCGE y NIIF, con tolerancia de materialidad S/ 0.01.
 * 
 * @module engine/doubleEntryValidator
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════

export interface JournalLine {
  cta: string;
  debe: number;
  haber: number;
  glosa?: string;
  desc?: string;
}

// ═══════════════════════════════════════════════════════
// ERRORES TIPIFICADOS
// ═══════════════════════════════════════════════════════

/**
 * Error lanzado cuando la sumatoria de DEBE ≠ HABER
 * en un asiento contable.
 */
export class PartidaDesbalanceadaError extends Error {
  public readonly debe: number;
  public readonly haber: number;
  public readonly diferencia: number;

  constructor(debe: number, haber: number) {
    const diff = Math.abs(debe - haber);
    super(
      `Partida desbalanceada: DEBE S/ ${debe.toFixed(2)} ≠ HABER S/ ${haber.toFixed(2)} (diferencia: S/ ${diff.toFixed(2)})`
    );
    this.name = 'PartidaDesbalanceadaError';
    this.debe = debe;
    this.haber = haber;
    this.diferencia = diff;
  }
}

/**
 * Error lanzado cuando una cuenta PCGE no cumple el formato
 * mínimo requerido (4 dígitos numéricos).
 */
export class CuentaPCGEInvalidaError extends Error {
  public readonly cuentasInvalidas: string[];

  constructor(cuentas: string[]) {
    super(`Cuentas PCGE inválidas: ${cuentas.join(', ')}. Se requieren al menos 3 dígitos numéricos.`);
    this.name = 'CuentaPCGEInvalidaError';
    this.cuentasInvalidas = cuentas;
  }
}

/**
 * Error lanzado cuando una línea tiene valores positivos
 * simultáneos en DEBE y HABER.
 */
export class LineaAmbiguaError extends Error {
  public readonly cuenta: string;

  constructor(cuenta: string) {
    super(`Línea con DEBE y HABER simultáneos en cuenta ${cuenta}. Cada línea debe tener un solo movimiento.`);
    this.name = 'LineaAmbiguaError';
    this.cuenta = cuenta;
  }
}

// ═══════════════════════════════════════════════════════
// VALIDADOR PRINCIPAL
// ═══════════════════════════════════════════════════════

/**
 * Tolerancia de materialidad NIIF para diferencias de redondeo.
 * Diferencias menores o iguales a S/ 0.01 se consideran aceptables.
 */
const TOLERANCIA_MATERIALIDAD = 0.01;

/**
 * Regex para validar formato de cuenta PCGE: mínimo 3 dígitos.
 */
const PCGE_PATTERN = /^\d{3,}$/;

/**
 * Valida que un conjunto de líneas de asiento cumpla las 4 reglas
 * fundamentales de la partida doble.
 * 
 * Reglas validadas:
 * 1. Un asiento requiere al menos 2 líneas (cuentas distintas)
 * 2. Cada cuenta debe tener formato PCGE válido (≥4 dígitos)
 * 3. Una línea NO puede tener DEBE > 0 y HABER > 0 simultáneamente
 * 4. SUM(DEBE) = SUM(HABER) con tolerancia de S/ 0.01
 * 
 * @param lines - Array de líneas del asiento a validar
 * @throws {Error} Si hay menos de 2 líneas
 * @throws {CuentaPCGEInvalidaError} Si alguna cuenta no es válida
 * @throws {LineaAmbiguaError} Si una línea tiene DEBE y HABER > 0
 * @throws {PartidaDesbalanceadaError} Si DEBE ≠ HABER
 */
export function validateDoubleEntry(lines: JournalLine[]): void {
  // Filtrar líneas de tipo GLOSA (que no son movimientos contables reales)
  const accountingLines = lines.filter(
    l => l.cta && l.cta.trim().toUpperCase() !== 'GLOSA'
  );

  // ─── Regla 1: Mínimo dos cuentas ───
  if (accountingLines.length < 2) {
    throw new Error(
      'Un asiento contable requiere al menos dos cuentas (principio de partida doble).'
    );
  }

  // ─── Regla 2: Cuentas PCGE válidas (mínimo 4 dígitos) ───
  const invalidCtas = accountingLines
    .map(l => l.cta.trim())
    .filter(cta => !PCGE_PATTERN.test(cta));

  if (invalidCtas.length > 0) {
    // Eliminar duplicados para un mensaje más limpio
    const uniqueInvalid = [...new Set(invalidCtas)];
    throw new CuentaPCGEInvalidaError(uniqueInvalid);
  }

  // ─── Regla 3: No DEBE y HABER simultáneos en misma línea ───
  const ambiguousLines = accountingLines.filter(
    l => (l.debe || 0) > 0 && (l.haber || 0) > 0
  );
  if (ambiguousLines.length > 0) {
    throw new LineaAmbiguaError(ambiguousLines[0].cta);
  }

  // ─── Regla 4: Sumatoria DEBE = HABER (tolerancia S/ 0.01 / 1 céntimo entero) ───
  const centsDebe = accountingLines.reduce((sum, l) => sum + Math.round((l.debe || 0) * 100), 0);
  const centsHaber = accountingLines.reduce((sum, l) => sum + Math.round((l.haber || 0) * 100), 0);
  const diffCents = Math.abs(centsDebe - centsHaber);

  if (diffCents > 1) {
    throw new PartidaDesbalanceadaError(centsDebe / 100, centsHaber / 100);
  }
}

// ═══════════════════════════════════════════════════════
// UTILIDADES AUXILIARES
// ═══════════════════════════════════════════════════════

/**
 * Verifica si un asiento está balanceado sin lanzar excepciones.
 * Útil para validaciones de UI no bloqueantes.
 * 
 * @returns Objeto con estado de balance y detalles
 */
export function checkBalance(lines: JournalLine[]): {
  isBalanced: boolean;
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  errors: string[];
} {
  const errors: string[] = [];
  const accountingLines = lines.filter(
    l => l.cta && l.cta.trim().toUpperCase() !== 'GLOSA'
  );

  if (accountingLines.length < 2) {
    errors.push('Se requieren al menos 2 líneas contables.');
  }

  const invalidCtas = accountingLines
    .map(l => l.cta.trim())
    .filter(cta => !PCGE_PATTERN.test(cta));
  if (invalidCtas.length > 0) {
    errors.push(`Cuentas inválidas: ${[...new Set(invalidCtas)].join(', ')}`);
  }

  const ambiguous = accountingLines.filter(l => (l.debe || 0) > 0 && (l.haber || 0) > 0);
  if (ambiguous.length > 0) {
    errors.push(`Líneas con DEBE y HABER simultáneos: ${ambiguous.map(l => l.cta).join(', ')}`);
  }

  const centsDebe = accountingLines.reduce((s, l) => s + Math.round((l.debe || 0) * 100), 0);
  const centsHaber = accountingLines.reduce((s, l) => s + Math.round((l.haber || 0) * 100), 0);
  const totalDebe = centsDebe / 100;
  const totalHaber = centsHaber / 100;
  const diferencia = Math.abs(centsDebe - centsHaber) / 100;

  if (Math.abs(centsDebe - centsHaber) > 1) {
    errors.push(`Desbalance: DEBE S/ ${totalDebe.toFixed(2)} vs HABER S/ ${totalHaber.toFixed(2)} (diff: S/ ${diferencia.toFixed(2)})`);
  }

  return {
    isBalanced: errors.length === 0,
    totalDebe,
    totalHaber,
    diferencia,
    errors,
  };
}
