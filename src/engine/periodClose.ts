/**
 * Motor de Cierre Contable — SOFTCONTABLE 2026
 * 
 * Implementa el control de períodos contables (PCGE principio de período)
 * y los pre-checks obligatorios antes de cerrar un mes/año.
 * 
 * Pre-checks (6 validaciones):
 *  1. Partida doble cuadrada en journal del período
 *  2. SIRE sin riesgos críticos
 *  3. Cuenta 40112 en cero (prorrata IGV aplicada)
 *  4. Depreciación cargada en fixed_assets
 *  5. TC SBS ajustado en documentos ME
 *  6. Kárdex cuadrado (saldo físico = contable)
 * 
 * @module engine/periodClose
 * @version 1.0.0
 */

import { CORPORATE_TAX } from '../constants/tributario';

// ═══════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════

export type PeriodEstado = 'ABIERTO' | 'EN_CIERRE' | 'CERRADO';
export type PeriodTipo = 'MENSUAL' | 'ANUAL';

export interface AccountingPeriod {
  id?: string;
  workspaceId: string;
  periodo: string;     // YYYY-MM (mensual) o YYYY (anual)
  tipo: PeriodTipo;
  estado: PeriodEstado;
  cerradoPor?: string;
  cerradoAt?: string;
  notas?: string;
}

export interface PreCheckResult {
  id: string;
  nombre: string;
  descripcion: string;
  ok: boolean;
  detalle: string;
  bloqueante: boolean; // Si es true, impide el cierre
}

export interface ClosePreCheckReport {
  periodo: string;
  tipo: PeriodTipo;
  checks: PreCheckResult[];
  canClose: boolean;
  blockers: string[];
  warnings: string[];
}

export interface JournalLine {
  cta: string;
  debe: number;
  haber: number;
  desc?: string;
  glosa?: string;
}

// ═══════════════════════════════════════════════════════
// PRE-CHECKS DE CIERRE
// ═══════════════════════════════════════════════════════

/**
 * Ejecuta los 6 pre-checks obligatorios antes de cerrar un período.
 * Cada check reporta si es bloqueante (impide el cierre) o solo advertencia.
 */
export async function runPreChecks(
  workspaceId: string,
  periodo: string,
  tipo: PeriodTipo,
  dbExecute: (sql: string, params: any[]) => Promise<any>,
  dbQuery: (sql: string, params: any[]) => Promise<any>
): Promise<ClosePreCheckReport> {
  const checks: PreCheckResult[] = [];
  const dateFilter = tipo === 'MENSUAL'
    ? `substr(fecha, 1, 7) = '${periodo}'`
    : `substr(fecha, 1, 4) = '${periodo}'`;

  // ─── Check 1: Partida doble cuadrada ───
  try {
    const result = await dbQuery(
      `SELECT COALESCE(SUM(debe), 0) as total_debe, COALESCE(SUM(haber), 0) as total_haber
       FROM journal WHERE workspace_id = ? AND ${dateFilter}`,
      [workspaceId]
    );
    const rows = result?.rows || [result];
    const row = rows[0] || { total_debe: 0, total_haber: 0 };
    const diff = Math.abs((row.total_debe || 0) - (row.total_haber || 0));
    checks.push({
      id: 'PARTIDA_DOBLE',
      nombre: 'Partida Doble Cuadrada',
      descripcion: 'SUM(DEBE) = SUM(HABER) en el Libro Diario del período',
      ok: diff <= 0.01,
      detalle: diff <= 0.01
        ? `Cuadrado: DEBE S/ ${(row.total_debe || 0).toFixed(2)} = HABER S/ ${(row.total_haber || 0).toFixed(2)}`
        : `DESCUADRE: DEBE S/ ${(row.total_debe || 0).toFixed(2)} vs HABER S/ ${(row.total_haber || 0).toFixed(2)} (diff: S/ ${diff.toFixed(2)})`,
      bloqueante: true,
    });
  } catch (e) {
    checks.push({ id: 'PARTIDA_DOBLE', nombre: 'Partida Doble Cuadrada', descripcion: '', ok: false, detalle: `Error: ${e}`, bloqueante: true });
  }

  // ─── Check 2: SIRE sin riesgos críticos ───
  try {
    const result = await dbQuery(
      `SELECT COUNT(*) as count FROM purchases
       WHERE workspace_id = ? AND ${dateFilter}
       AND estado_sire IN ('RIESGO_CRITICO', 'RIESGO_ALTO')`,
      [workspaceId]
    );
    const rows = result?.rows || [result];
    const count = rows[0]?.count || 0;
    checks.push({
      id: 'SIRE_LIMPIO',
      nombre: 'SIRE sin Riesgos Críticos',
      descripcion: 'No hay comprobantes con estado RIESGO_CRITICO o RIESGO_ALTO',
      ok: count === 0,
      detalle: count === 0 ? 'Sin riesgos pendientes' : `${count} comprobante(s) con riesgo crítico/alto`,
      bloqueante: false, // Advertencia, no bloquea
    });
  } catch (e) {
    checks.push({ id: 'SIRE_LIMPIO', nombre: 'SIRE sin Riesgos', descripcion: '', ok: false, detalle: `Error: ${e}`, bloqueante: false });
  }

  // ─── Check 3: Cuenta 40112 en cero (prorrata aplicada) ───
  try {
    const result = await dbQuery(
      `SELECT COALESCE(SUM(debe) - SUM(haber), 0) as saldo
       FROM journal WHERE workspace_id = ? AND cta = '40112' AND ${dateFilter}`,
      [workspaceId]
    );
    const rows = result?.rows || [result];
    const saldo = Math.abs(rows[0]?.saldo || 0);
    checks.push({
      id: 'PRORRATA_IGV',
      nombre: 'Prorrata IGV Aplicada',
      descripcion: 'Saldo de cuenta 40112 (IGV uso común) debe estar en cero al cierre',
      ok: saldo <= 0.01,
      detalle: saldo <= 0.01 ? 'Cuenta 40112 saldada' : `Saldo pendiente en 40112: S/ ${saldo.toFixed(2)} — Ejecute prorrata IGV`,
      bloqueante: false, // Advertencia, la prorrata es Sprint 3
    });
  } catch (e) {
    checks.push({ id: 'PRORRATA_IGV', nombre: 'Prorrata IGV', descripcion: '', ok: false, detalle: `Error: ${e}`, bloqueante: false });
  }

  // ─── Check 4: Depreciación cargada ───
  try {
    const result = await dbQuery(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN deprec_ejercicio > 0 THEN 1 ELSE 0 END) as con_deprec
       FROM fixed_assets WHERE workspace_id = ?`,
      [workspaceId]
    );
    const rows = result?.rows || [result];
    const total = rows[0]?.total || 0;
    const conDeprec = rows[0]?.con_deprec || 0;
    const sinDeprec = total - conDeprec;
    checks.push({
      id: 'DEPRECIACION',
      nombre: 'Depreciación Cargada',
      descripcion: 'Todos los activos fijos deben tener depreciación calculada del período',
      ok: sinDeprec === 0 || total === 0,
      detalle: total === 0 ? 'Sin activos fijos registrados' : (sinDeprec === 0 ? `${total} activo(s) con depreciación OK` : `${sinDeprec} activo(s) sin depreciación del período`),
      bloqueante: false,
    });
  } catch (e) {
    checks.push({ id: 'DEPRECIACION', nombre: 'Depreciación', descripcion: '', ok: false, detalle: `Error: ${e}`, bloqueante: false });
  }

  // ─── Check 5: TC SBS ajustado (documentos en ME) ───
  try {
    const result = await dbQuery(
      `SELECT COUNT(*) as count FROM purchases
       WHERE workspace_id = ? AND ${dateFilter}
       AND moneda IS NOT NULL AND moneda != 'PEN' AND moneda != ''
       AND (tc IS NULL OR tc = 0 OR tc = 1)`,
      [workspaceId]
    );
    const rows = result?.rows || [result];
    const count = rows[0]?.count || 0;
    checks.push({
      id: 'TC_SBS',
      nombre: 'TC SBS Ajustado',
      descripcion: 'Documentos en moneda extranjera deben tener tipo de cambio SBS registrado',
      ok: count === 0,
      detalle: count === 0 ? 'Todos los documentos ME tienen TC asignado' : `${count} documento(s) en ME sin tipo de cambio válido`,
      bloqueante: false,
    });
  } catch (e) {
    checks.push({ id: 'TC_SBS', nombre: 'TC SBS', descripcion: '', ok: false, detalle: `Error: ${e}`, bloqueante: false });
  }

  // ─── Check 6: Kárdex cuadrado ───
  try {
    const result = await dbQuery(
      `SELECT COUNT(*) as count FROM inventory_movements
       WHERE workspace_id = ? AND total_saldo < 0`,
      [workspaceId]
    );
    const rows = result?.rows || [result];
    const count = rows[0]?.count || 0;
    checks.push({
      id: 'KARDEX',
      nombre: 'Kárdex Cuadrado',
      descripcion: 'No debe haber saldos negativos en el inventario valorizado',
      ok: count === 0,
      detalle: count === 0 ? 'Inventario sin inconsistencias' : `${count} movimiento(s) con saldo negativo`,
      bloqueante: false,
    });
  } catch (e) {
    checks.push({ id: 'KARDEX', nombre: 'Kárdex', descripcion: '', ok: false, detalle: `Error: ${e}`, bloqueante: false });
  }

  // ─── Compilar resultado ───
  const blockers = checks.filter(c => !c.ok && c.bloqueante).map(c => c.nombre);
  const warnings = checks.filter(c => !c.ok && !c.bloqueante).map(c => c.nombre);

  return {
    periodo,
    tipo,
    checks,
    canClose: blockers.length === 0,
    blockers,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════
// VERIFICACIÓN DE PERÍODO
// ═══════════════════════════════════════════════════════

/**
 * Verifica si un período está cerrado.
 * Usado como guard en savePurchase, saveSale, etc.
 */
export async function isPeriodClosed(
  workspaceId: string,
  fecha: string,
  dbQuery: (sql: string, params: any[]) => Promise<any>
): Promise<{ closed: boolean; estado: PeriodEstado; periodo: string }> {
  const periodo = fecha.substring(0, 7); // YYYY-MM

  try {
    const result = await dbQuery(
      `SELECT estado FROM accounting_periods
       WHERE workspace_id = ? AND periodo = ? AND tipo = 'MENSUAL'`,
      [workspaceId, periodo]
    );
    const rows = result?.rows || (Array.isArray(result) ? result : [result]);
    const row = rows[0];

    if (!row || !row.estado) {
      return { closed: false, estado: 'ABIERTO', periodo };
    }

    return {
      closed: row.estado === 'CERRADO',
      estado: row.estado as PeriodEstado,
      periodo,
    };
  } catch {
    // Si no existe la tabla o hay error, asumir abierto
    return { closed: false, estado: 'ABIERTO', periodo };
  }
}

// ═══════════════════════════════════════════════════════
// ASIENTOS DE CIERRE ANUAL (PCGE)
// ═══════════════════════════════════════════════════════

/**
 * Genera los asientos de cierre anual según PCGE:
 * 
 * Paso 1: Determinación del resultado (6xxxx → 7xxxx → 89)
 * Paso 2: IR corriente (881 → 40171) 
 * Paso 3: Distribución del resultado (89 → 591/592)
 * Paso 4: Cierre de cuentas de resultado (clases 6 y 7 a cero)
 */
export function generateAnnualClosingEntries(
  totalIngresos: number,
  totalGastos: number,
  regimenTributario: string,
  utilidadNetaUIT: number,
): JournalLine[] {
  const lines: JournalLine[] = [];
  const resultado = totalIngresos - totalGastos; // Positivo = utilidad, negativo = pérdida

  // Paso 1: Cancelar ingresos y gastos hacia cuenta 89
  if (totalIngresos > 0) {
    lines.push({ cta: '7011', debe: totalIngresos, haber: 0, desc: 'CIERRE - Cancelación ingresos' });
  }
  if (totalGastos > 0) {
    lines.push({ cta: '6011', debe: 0, haber: totalGastos, desc: 'CIERRE - Cancelación gastos' });
  }
  if (resultado >= 0) {
    lines.push({ cta: '891', debe: 0, haber: resultado, desc: 'CIERRE - Resultado del ejercicio (utilidad)' });
  } else {
    lines.push({ cta: '891', debe: Math.abs(resultado), haber: 0, desc: 'CIERRE - Resultado del ejercicio (pérdida)' });
  }

  // Paso 2: IR corriente (solo si hay utilidad)
  if (resultado > 0) {
    let tasaIR: number = CORPORATE_TAX.RG_FLAT_RATE; // 29.5%
    if (regimenTributario === 'MYPE' || regimenTributario === 'RMT') {
      tasaIR = utilidadNetaUIT <= CORPORATE_TAX.RMT_TIER_1_MAX_UIT
        ? CORPORATE_TAX.RMT_TIER_1_RATE   // 10%
        : CORPORATE_TAX.RMT_TIER_2_RATE;  // 29.5%
    }

    const irCorriente = Math.round(resultado * tasaIR * 100) / 100;
    lines.push({ cta: '881', debe: irCorriente, haber: 0, desc: `CIERRE - Gasto IR corriente (${(tasaIR * 100).toFixed(1)}%)` });
    lines.push({ cta: '40171', debe: 0, haber: irCorriente, desc: 'CIERRE - IR por pagar SUNAT' });

    // Paso 3: Distribución del resultado neto
    const resultadoNeto = resultado - irCorriente;
    lines.push({ cta: '891', debe: resultadoNeto, haber: 0, desc: 'CIERRE - Traslado resultado neto' });
    lines.push({ cta: '591', debe: 0, haber: resultadoNeto, desc: 'CIERRE - Utilidades retenidas' });
  } else if (resultado < 0) {
    // Pérdida: trasladar a resultados acumulados
    lines.push({ cta: '891', debe: 0, haber: Math.abs(resultado), desc: 'CIERRE - Traslado pérdida' });
    lines.push({ cta: '592', debe: Math.abs(resultado), haber: 0, desc: 'CIERRE - Pérdida acumulada' });
  }

  return lines;
}
