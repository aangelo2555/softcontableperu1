import type { PurchaseEntry as Purchase, SaleEntry as Sale, JournalEntry } from '../store';

export interface CrossBookItem {
  id: string;
  fecha: string;
  documento: string; // Serie-Numero
  ruc: string;
  nombre: string;
  total: number;
  totalPagado: number;
  saldo: number;
  estado: 'PAGADO' | 'PARCIAL' | 'PENDIENTE';
  asientosAsociados: string[]; // List of related journal entries
}

export interface CrossBookReport {
  purchases: CrossBookItem[];
  sales: CrossBookItem[];
  purchasesPaidPct: number;
  salesCollectedPct: number;
}

export function validateCrossBook(
  purchases: Purchase[],
  sales: Sale[],
  journalEntries: JournalEntry[]
): CrossBookReport {
  // Helper to extract series and number in lowercase
  const cleanDocNum = (doc: string) => doc.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // 1. Process Purchases (offset account typically starts with 42)
  const purchasesReport: CrossBookItem[] = purchases
    .filter(p => p.estado_sire !== 'Propuesta')
    .map(p => {
      const docRef = `${p.serie}-${p.numero}`;
      
      // Find journal lines matching the offset account 4212 (or starts with 42) and referencing this doc
      const relatedJournal = journalEntries.filter(j => {
        const isOffset = j.cta.startsWith('42') || j.cta.startsWith('10');
        if (!isOffset) return false;

        const content = `${j.glosa || ''} ${j.desc || ''} ${j.asiento || ''}`.toLowerCase();
        
        // Match document number
        const hasNum = content.includes(p.numero.toLowerCase());
        const hasSerie = content.includes(p.serie.toLowerCase()) || content.includes(cleanDocNum(p.serie));
        
        return hasNum && (hasSerie || p.numero.length > 4); // fall back to just number if it is long/unique enough
      });

      // Total payments is the sum of DEBIT entries to accounts starting with 42 (reducing liability)
      const totalPagado = relatedJournal
        .filter(j => j.cta.startsWith('42'))
        .reduce((sum, j) => sum + j.debe, 0);

      const saldo = Number((p.total - totalPagado).toFixed(2));
      let estado: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' = 'PENDIENTE';
      if (totalPagado >= p.total - 0.05) {
        estado = 'PAGADO';
      } else if (totalPagado > 0.05) {
        estado = 'PARCIAL';
      }

      return {
        id: p.id,
        fecha: p.fecha,
        documento: docRef,
        ruc: p.doc_num,
        nombre: p.nombre,
        total: p.total,
        totalPagado,
        saldo: Math.max(0, saldo),
        estado,
        asientosAsociados: Array.from(new Set(relatedJournal.map(j => j.asiento).filter(Boolean))) as string[]
      };
    });

  // 2. Process Sales (offset account typically starts with 12)
  const salesReport: CrossBookItem[] = sales
    .filter(s => s.estado_sire !== 'Propuesta')
    .map(s => {
      const docRef = `${s.serie}-${s.numero}`;

      const relatedJournal = journalEntries.filter(j => {
        const isOffset = j.cta.startsWith('12') || j.cta.startsWith('10');
        if (!isOffset) return false;

        const content = `${j.glosa || ''} ${j.desc || ''} ${j.asiento || ''}`.toLowerCase();
        
        const hasNum = content.includes(s.numero.toLowerCase());
        const hasSerie = content.includes(s.serie.toLowerCase()) || content.includes(cleanDocNum(s.serie));
        
        return hasNum && (hasSerie || s.numero.length > 4);
      });

      // Total collections is the sum of CREDIT entries to accounts starting with 12
      const totalPagado = relatedJournal
        .filter(j => j.cta.startsWith('12'))
        .reduce((sum, j) => sum + j.haber, 0);

      const saldo = Number((s.total - totalPagado).toFixed(2));
      let estado: 'PAGADO' | 'PARCIAL' | 'PENDIENTE' = 'PENDIENTE';
      if (totalPagado >= s.total - 0.05) {
        estado = 'PAGADO';
      } else if (totalPagado > 0.05) {
        estado = 'PARCIAL';
      }

      return {
        id: s.id,
        fecha: s.fecha,
        documento: docRef,
        ruc: s.doc_num,
        nombre: s.nombre,
        total: s.total,
        totalPagado,
        saldo: Math.max(0, saldo),
        estado: estado === 'PAGADO' ? 'PAGADO' : (estado === 'PARCIAL' ? 'PARCIAL' : 'PENDIENTE'),
        asientosAsociados: Array.from(new Set(relatedJournal.map(j => j.asiento).filter(Boolean))) as string[]
      };
    });

  // Summary percentages
  const purchasesPaidCount = purchasesReport.filter(r => r.estado === 'PAGADO').length;
  const purchasesPaidPct = purchasesReport.length > 0 ? Math.round((purchasesPaidCount / purchasesReport.length) * 100) : 100;

  const salesCollectedCount = salesReport.filter(r => r.estado === 'PAGADO').length;
  const salesCollectedPct = salesReport.length > 0 ? Math.round((salesCollectedCount / salesReport.length) * 100) : 100;

  return {
    purchases: purchasesReport,
    sales: salesReport,
    purchasesPaidPct,
    salesCollectedPct
  };
}
