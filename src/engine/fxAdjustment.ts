import type { PurchaseEntry, SaleEntry, JournalEntry } from '../store';

export interface FxAdjustmentResult {
  periodo: string;
  tcCompraClosing: number;
  tcVentaClosing: number;
  adjustments: {
    documento: string;
    tipo: 'COMPRA' | 'VENTA';
    usdAmount: number;
    tcOrigen: number;
    penOrigen: number;
    penClosing: number;
    diferencia: number;
    ctaAjuste: string;
    ctaDiferencia: string;
  }[];
  adjustingEntries: JournalEntry[];
}

export function calculateFxAdjustment(
  periodo: string, // YYYY-MM
  purchases: PurchaseEntry[],
  sales: SaleEntry[],
  tcCompraClosing: number,
  tcVentaClosing: number
): FxAdjustmentResult {
  const periodPurchases = purchases.filter(
    p => p.fecha.startsWith(periodo) && p.moneda === 'DOLARES'
  );
  const periodSales = sales.filter(
    s => s.fecha.startsWith(periodo) && s.moneda === 'DOLARES'
  );

  const adjustments: FxAdjustmentResult['adjustments'] = [];
  const adjustingEntries: JournalEntry[] = [];
  
  const asientoCorrelativo = `AJUS-DIFCAMBIO-${periodo.replace('-', '')}`;
  const fechaAjuste = new Date(
    Number(periodo.split('-')[0]),
    Number(periodo.split('-')[1]),
    0
  ).toISOString().split('T')[0]; // Last day of month

  let counter = 0;

  // 1. Process Sales (Monetary Asset: Account 12) -> uses Compra rate
  for (const s of periodSales) {
    const usdAmount = s.total || 0;
    const tcOrigen = s.tc || 1.0;
    const penOrigen = Number((usdAmount * tcOrigen).toFixed(2));
    const penClosing = Number((usdAmount * tcCompraClosing).toFixed(2));
    const diferencia = Number((penClosing - penOrigen).toFixed(2));

    if (diferencia !== 0) {
      counter++;
      const baseId = `fx-venta-${s.id}`;
      const ctaCargo = (s.ctaCargo || '1212').trim();

      adjustments.push({
        documento: `${s.tipo_doc} ${s.serie}-${s.numero}`,
        tipo: 'VENTA',
        usdAmount,
        tcOrigen,
        penOrigen,
        penClosing,
        diferencia,
        ctaAjuste: ctaCargo,
        ctaDiferencia: diferencia > 0 ? '776' : '676'
      });

      if (diferencia > 0) {
        // Gain: Debit 1212, Credit 776
        adjustingEntries.push({
          id: `${baseId}-debit-12`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO VENTA ${s.serie}-${s.numero}`,
          cta: ctaCargo,
          desc: 'EMITIDAS (AJUSTE TC)',
          debe: diferencia,
          haber: 0
        });
        adjustingEntries.push({
          id: `${baseId}-credit-776`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO VENTA ${s.serie}-${s.numero}`,
          cta: '776',
          desc: 'DIFERENCIA EN CAMBIO (GANANCIA)',
          debe: 0,
          haber: diferencia
        });
      } else {
        // Loss: Debit 676, Credit 1212
        const absDiff = Math.abs(diferencia);
        adjustingEntries.push({
          id: `${baseId}-debit-676`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO VENTA ${s.serie}-${s.numero}`,
          cta: '676',
          desc: 'DIFERENCIA DE CAMBIO (PERDIDA)',
          debe: absDiff,
          haber: 0
        });
        adjustingEntries.push({
          id: `${baseId}-credit-12`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO VENTA ${s.serie}-${s.numero}`,
          cta: ctaCargo,
          desc: 'EMITIDAS (AJUSTE TC)',
          debe: 0,
          haber: absDiff
        });
      }
    }
  }

  // 2. Process Purchases (Monetary Liability: Account 42) -> uses Venta rate
  for (const p of periodPurchases) {
    const usdAmount = p.total || 0;
    const tcOrigen = p.tc || 1.0;
    const penOrigen = Number((usdAmount * tcOrigen).toFixed(2));
    const penClosing = Number((usdAmount * tcVentaClosing).toFixed(2));
    // liability difference: positive means we owe more soles (Loss)
    const diferencia = Number((penClosing - penOrigen).toFixed(2));

    if (diferencia !== 0) {
      counter++;
      const baseId = `fx-compra-${p.id}`;
      const ctaAbono = (p.ctaAbono || '4212').trim();

      adjustments.push({
        documento: `${p.tipo_doc} ${p.serie}-${p.numero}`,
        tipo: 'COMPRA',
        usdAmount,
        tcOrigen,
        penOrigen,
        penClosing,
        diferencia,
        ctaAjuste: ctaAbono,
        ctaDiferencia: diferencia > 0 ? '676' : '776'
      });

      if (diferencia > 0) {
        // Loss: Debit 676, Credit 4212 (Liability increases)
        adjustingEntries.push({
          id: `${baseId}-debit-676`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO COMPRA ${p.serie}-${p.numero}`,
          cta: '676',
          desc: 'DIFERENCIA DE CAMBIO (PERDIDA)',
          debe: diferencia,
          haber: 0
        });
        adjustingEntries.push({
          id: `${baseId}-credit-42`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO COMPRA ${p.serie}-${p.numero}`,
          cta: ctaAbono,
          desc: 'EMITIDAS (AJUSTE TC)',
          debe: 0,
          haber: diferencia
        });
      } else {
        // Gain: Debit 4212 (Liability decreases), Credit 776
        const absDiff = Math.abs(diferencia);
        adjustingEntries.push({
          id: `${baseId}-debit-42`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO COMPRA ${p.serie}-${p.numero}`,
          cta: ctaAbono,
          desc: 'EMITIDAS (AJUSTE TC)',
          debe: absDiff,
          haber: 0
        });
        adjustingEntries.push({
          id: `${baseId}-credit-776`,
          source: 'ASIENTO',
          asiento: asientoCorrelativo,
          fecha: fechaAjuste,
          glosa: `AJUS. DIF. CAMBIO COMPRA ${p.serie}-${p.numero}`,
          cta: '776',
          desc: 'DIFERENCIA EN CAMBIO (GANANCIA)',
          debe: 0,
          haber: absDiff
        });
      }
    }
  }

  return {
    periodo,
    tcCompraClosing,
    tcVentaClosing,
    adjustments,
    adjustingEntries
  };
}
