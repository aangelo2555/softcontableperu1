import type { JournalEntry } from '../store';
import type { BankStatementLine } from '../utils/bankImporter';

export interface MatchSuggestion {
  journalEntry: JournalEntry;
  score: number; // 0 to 100
  reason: string;
}

/**
 * Evaluates possible match candidates from the journal for a given bank statement line
 */
export function getMatchSuggestions(
  stmtLine: BankStatementLine,
  journalEntries: JournalEntry[],
  toleranceDays = 3
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  const targetAmount = Math.abs(stmtLine.monto);

  for (const entry of journalEntries) {
    // Check if the entry is bank-related (starts with 10)
    if (!entry.cta.startsWith('10')) continue;

    // Check sign matching: 
    // stmtLine.monto > 0 (deposit) matches contabilidad debe > 0
    // stmtLine.monto < 0 (withdrawal) matches contabilidad haber > 0
    const entryAmount = stmtLine.monto > 0 ? entry.debe : entry.haber;
    if (Math.abs(entryAmount - targetAmount) > 0.01) continue;

    let score = 0;
    const reasons: string[] = [];

    // Base score for matching amount
    score += 50;
    reasons.push('Importe idéntico');

    // Date proximity score
    const stmtDate = new Date(stmtLine.fecha + 'T00:00:00');
    const entryDate = new Date(entry.fecha + 'T00:00:00');
    
    if (!isNaN(stmtDate.getTime()) && !isNaN(entryDate.getTime())) {
      const diffTime = Math.abs(stmtDate.getTime() - entryDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        score += 30;
        reasons.push('Fecha exacta');
      } else if (diffDays <= toleranceDays) {
        score += 20;
        reasons.push(`Fecha próxima (+/- ${diffDays} d.)`);
      } else if (stmtLine.fecha.substring(0, 7) === entry.fecha.substring(0, 7)) {
        score += 10;
        reasons.push('Mismo período');
      }
    }

    // Reference matching score
    const cleanRef = stmtLine.referencia ? stmtLine.referencia.trim().toLowerCase() : '';
    if (cleanRef) {
      if (entry.asiento && entry.asiento.toLowerCase().includes(cleanRef)) {
        score += 20;
        reasons.push('Ref. en asiento');
      } else if (entry.glosa && entry.glosa.toLowerCase().includes(cleanRef)) {
        score += 15;
        reasons.push('Ref. en glosa');
      } else if (entry.desc && entry.desc.toLowerCase().includes(cleanRef)) {
        score += 10;
        reasons.push('Ref. en detalle');
      }
    }

    suggestions.push({
      journalEntry: entry,
      score,
      reason: reasons.join(', ')
    });
  }

  // Sort by score descending
  return suggestions.sort((a, b) => b.score - a.score);
}
