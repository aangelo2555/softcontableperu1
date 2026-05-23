import type { PurchaseEntry, SaleEntry, JournalEntry } from '../store';

export interface ProrrataResult {
  periodo: string;
  ventasGravadas: number;
  ventasNoGravadas: number;
  factor: number;
  igvComun: number;
  creditoFiscal: number;
  gastoCosto: number;
  adjustingEntries: JournalEntry[];
}

export function calculateProrrataIGV(
  periodo: string, // YYYY-MM
  purchases: PurchaseEntry[],
  sales: SaleEntry[],
  journal: JournalEntry[]
): ProrrataResult {
  // 1. Filter sales of the period
  const periodSales = sales.filter(s => s.fecha.startsWith(periodo));
  
  // Gravadas: 01 (Venta interna gravada), 02 (Exportación de bienes), 08 (Exportación de servicios)
  const ventasGravadas = periodSales
    .filter(s => ['01', '02', '08'].includes(s.tipOperCode || '01'))
    .reduce((sum, s) => sum + (s.bi || 0), 0);

  // No Gravadas: 03 (Ventas no gravadas), 04 (Ventas exoneradas), 05 (Venta inafecta)
  const ventasNoGravadas = periodSales
    .filter(s => ['03', '04', '05'].includes(s.tipOperCode || ''))
    .reduce((sum, s) => sum + (s.bi || 0), 0);

  // Calculate factor
  const totalVentas = ventasGravadas + ventasNoGravadas;
  const factor = totalVentas > 0 ? Number((ventasGravadas / totalVentas).toFixed(4)) : 1.0;

  // 2. Find common IGV from purchases (Cuenta 40112 in COMPRA entries of the period)
  const periodJournal = journal.filter(j => j.fecha.startsWith(periodo));
  const commonIgvEntries = periodJournal.filter(
    j => j.cta === '40112' && j.source === 'COMPRA'
  );
  
  const igvComun = commonIgvEntries.reduce((sum, j) => sum + (j.debe || 0), 0);

  // Calculate split
  const creditoFiscal = Number((igvComun * factor).toFixed(2));
  const gastoCosto = Number((igvComun - creditoFiscal).toFixed(2));

  // 3. Generate adjusting journal entries
  const adjustingEntries: JournalEntry[] = [];
  
  if (igvComun > 0) {
    const asientoCorrelativo = `AJUS-PRORRATA-${periodo.replace('-', '')}`;
    const fechaAjuste = new Date(
      Number(periodo.split('-')[0]),
      Number(periodo.split('-')[1]),
      0
    ).toISOString().split('T')[0]; // Last day of month

    const baseId = `prorrata-${periodo}`;

    // Credit 40112 to clear common IGV
    adjustingEntries.push({
      id: `${baseId}-clear-40112`,
      source: 'ASIENTO',
      asiento: asientoCorrelativo,
      fecha: fechaAjuste,
      glosa: `AJUSTE PRORRATA IGV MES ${periodo}`,
      cta: '40112',
      desc: 'IGV - PRORRATA (EXTORNO)',
      debe: 0,
      haber: igvComun
    });

    // Debit 40111 for allowed fiscal credit
    if (creditoFiscal > 0) {
      adjustingEntries.push({
        id: `${baseId}-debit-40111`,
        source: 'ASIENTO',
        asiento: asientoCorrelativo,
        fecha: fechaAjuste,
        glosa: `AJUSTE PRORRATA IGV MES ${periodo}`,
        cta: '40111',
        desc: 'IGV - CREDITO FISCAL PLENO',
        debe: creditoFiscal,
        haber: 0
      });
    }

    // Debit 64901 for disallowed IGV (gasto/costo)
    if (gastoCosto > 0) {
      // Ensure perfect balance
      const currentDebitSum = creditoFiscal;
      const difference = Number((igvComun - currentDebitSum).toFixed(2));
      
      adjustingEntries.push({
        id: `${baseId}-debit-64901`,
        source: 'ASIENTO',
        asiento: asientoCorrelativo,
        fecha: fechaAjuste,
        glosa: `AJUSTE PRORRATA IGV MES ${periodo}`,
        cta: '64901',
        desc: 'IGV NO ACEPTADO - GASTO',
        debe: difference,
        haber: 0
      });
    }
  }

  return {
    periodo,
    ventasGravadas: Number(ventasGravadas.toFixed(2)),
    ventasNoGravadas: Number(ventasNoGravadas.toFixed(2)),
    factor,
    igvComun: Number(igvComun.toFixed(2)),
    creditoFiscal,
    gastoCosto,
    adjustingEntries
  };
}
