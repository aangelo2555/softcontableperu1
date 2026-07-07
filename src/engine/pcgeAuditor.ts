/**
 * PCGE Auditor & Synchronization Engine
 * Contrasta las cuentas sugeridas por la Inteligencia Artificial contra el
 * catálogo activo de la empresa en la base de datos (plan_global) y detecta discrepancias.
 */

export interface MissingAccountAudit {
  cta: string;
  description: string;
  element: number;
  isValidLength: boolean;
  isNIIFRelated: boolean;
}

/**
 * Analiza un conjunto de asientos/líneas sugeridos por la IA y devuelve las cuentas
 * que no están registradas en el Plan Contable de la empresa activa.
 */
export function auditSuggestedAccounts(
  asientos: any[],
  asientoJsonFlat: any[],
  activePlan: { cta: string; description: string }[]
): MissingAccountAudit[] {
  const suggestedAccountsMap = new Map<string, { cta: string; description: string }>();

  // Auxiliar para normalizar y extraer cuentas
  const processLine = (line: any) => {
    if (!line || !line.cuenta || line.cuenta === 'GLOSA') return;
    const cta = String(line.cuenta).trim();
    if (/^\d+$/.test(cta)) {
      suggestedAccountsMap.set(cta, {
        cta,
        description: line.detalle || `Cuenta ${cta} (Sugerida por IA)`
      });
    }
  };

  // 1. Procesar sub-asientos si existen
  if (asientos && asientos.length > 0) {
    asientos.forEach((asiento: any) => {
      const lines = asiento.lines || asiento.asiento_json || [];
      lines.forEach(processLine);
    });
  }

  // 2. Procesar asiento plano por compatibilidad
  if (asientoJsonFlat && asientoJsonFlat.length > 0) {
    asientoJsonFlat.forEach(processLine);
  }

  const activeCtasSet = new Set(activePlan.map(a => String(a.cta).trim()));
  const missing: MissingAccountAudit[] = [];

  suggestedAccountsMap.forEach((val, cta) => {
    if (!activeCtasSet.has(cta)) {
      const element = parseInt(cta.charAt(0), 10) || 0;
      const isValidLength = cta.length >= 2;
      const isNIIFRelated = ['1', '2', '3', '4', '5'].includes(cta.charAt(0));

      missing.push({
        cta,
        description: val.description,
        element,
        isValidLength,
        isNIIFRelated
      });
    }
  });

  return missing.sort((a, b) => a.cta.localeCompare(b.cta));
}
