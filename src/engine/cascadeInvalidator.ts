/**
 * Motor de Invalidación en Cascada — SOFTCONTABLE 2026
 * 
 * Implementa el pipeline de dependencias entre libros contables:
 *   journal → mayor → hhtt → eeff
 * 
 * Cuando un nodo es modificado, todos los nodos aguas abajo
 * se marcan como obsoletos (is_stale = TRUE) con timestamp.
 * 
 * @module engine/cascadeInvalidator
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════
// CADENA DE DEPENDENCIAS
// ═══════════════════════════════════════════════════════

/**
 * Cadena ordenada de módulos contables.
 * Cada módulo depende de todos los anteriores.
 */
export const BOOK_CHAIN: string[] = ['journal', 'mayor', 'hhtt', 'eeff'];

/**
 * Nombres legibles para cada módulo (para UI).
 */
export const MODULE_LABELS: Record<string, string> = {
  journal: 'Libro Diario (Formato 5.1)',
  mayor: 'Libro Mayor (Formato 6.1)',
  hhtt: 'Balance de Comprobación',
  eeff: 'Estados Financieros (NIC 1)',
};

// ═══════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════

export interface PeriodVersionStatus {
  module: string;
  label: string;
  isStale: boolean;
  staleSince: string | null;
  lastSync: string | null;
  version: number;
}

export interface CascadeResult {
  source: string;
  periodo: string;
  invalidatedModules: string[];
  timestamp: string;
}

// ═══════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════

/**
 * Extrae el período YYYY-MM de una fecha ISO (YYYY-MM-DD).
 */
export function extractPeriodo(fecha: string): string {
  if (!fecha) return '';
  // Soportar formato YYYY-MM-DD y YYYY-MM
  return fecha.substring(0, 7);
}

/**
 * Determina los módulos downstream que deben invalidarse
 * cuando se modifica un módulo fuente.
 * 
 * @param source - Módulo que fue modificado ('journal', 'mayor', etc.)
 * @returns Array de módulos que dependen del source
 */
export function getDownstreamModules(source: string): string[] {
  const idx = BOOK_CHAIN.indexOf(source);
  if (idx === -1) return [];
  return BOOK_CHAIN.slice(idx + 1);
}

/**
 * Propaga la invalidación en cascada vía API (modo SaaS/Railway).
 * Marca todos los módulos downstream como stale.
 * 
 * @param source - Módulo que originó el cambio
 * @param workspaceId - RUC del workspace
 * @param periodo - Período en formato YYYY-MM
 * @param dbExecute - Función de ejecución SQL (store.dbExecute o electron.dbExecute)
 */
export async function propagateInvalidation(
  source: string,
  workspaceId: string,
  periodo: string,
  dbExecute: (sql: string, params: any[]) => Promise<any>
): Promise<CascadeResult> {
  const downstream = getDownstreamModules(source);
  const timestamp = new Date().toISOString();

  for (const mod of downstream) {
    await dbExecute(`
      INSERT INTO period_versions (workspace_id, periodo, module, is_stale, stale_since)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(workspace_id, periodo, module, user_id)
      DO UPDATE SET is_stale = 1, stale_since = ?
    `, [workspaceId, periodo, mod, timestamp, timestamp]);
  }

  // El módulo fuente también se marca como sincronizado
  await dbExecute(`
    INSERT INTO period_versions (workspace_id, periodo, module, is_stale, last_sync, version)
    VALUES (?, ?, ?, 0, ?, 1)
    ON CONFLICT(workspace_id, periodo, module, user_id)
    DO UPDATE SET is_stale = 0, last_sync = ?, version = period_versions.version + 1
  `, [workspaceId, periodo, source, timestamp, timestamp]);

  return {
    source,
    periodo,
    invalidatedModules: downstream,
    timestamp,
  };
}

/**
 * Marca un módulo como sincronizado (ya no stale).
 * Se invoca cuando el usuario recalcula un libro derivado.
 */
export async function markModuleSynced(
  workspaceId: string,
  periodo: string,
  module: string,
  dbExecute: (sql: string, params: any[]) => Promise<any>
): Promise<void> {
  const timestamp = new Date().toISOString();
  await dbExecute(`
    INSERT INTO period_versions (workspace_id, periodo, module, is_stale, last_sync, version)
    VALUES (?, ?, ?, 0, ?, 1)
    ON CONFLICT(workspace_id, periodo, module, user_id)
    DO UPDATE SET is_stale = 0, last_sync = ?, version = period_versions.version + 1
  `, [workspaceId, periodo, module, timestamp, timestamp]);
}

/**
 * Consulta el estado de obsolescencia de todos los módulos
 * para un workspace y período dado.
 * Útil para la UI (StaleWarningBanner).
 */
export function buildStaleStatusFromRows(
  rows: Array<{ module: string; is_stale: number; stale_since: string | null; last_sync: string | null; version: number }>
): PeriodVersionStatus[] {
  return BOOK_CHAIN.map(mod => {
    const row = rows.find(r => r.module === mod);
    return {
      module: mod,
      label: MODULE_LABELS[mod] || mod,
      isStale: row ? row.is_stale === 1 : false,
      staleSince: row?.stale_since || null,
      lastSync: row?.last_sync || null,
      version: row?.version || 0,
    };
  });
}
