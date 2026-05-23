export interface DeferredTaxRow {
  key: string;
  concepto: string;
  cuenta: string;
  accountingBase: number;
  taxBase: number;
  diferencia: number;
  tipo: 'DEDUCIBLE' | 'GRAVABLE';
  activoDiferido: number;
  pasivoDiferido: number;
  isCustom?: boolean;
}

export interface DeferredTaxResult {
  rows: DeferredTaxRow[];
  totalActivoDiferido: number;
  totalPasivoDiferido: number;
  netDeferredTax: number; // Positive = Asset, Negative = Liability
  taxRate: number;
  suggestedJournalEntries: { cuenta: string; debe: number; haber: number; detalle: string }[];
}

/**
 * Calculates trial balance balances for specific accounts/prefixes
 */
export function getTrialBalanceBalances(journal: any[]): Record<string, { debe: number; haber: number; saldo: number }> {
  const balances: Record<string, { debe: number; haber: number; saldo: number }> = {};
  
  journal.forEach(entry => {
    const cta = (entry.cta || '').trim();
    if (!cta || cta.toUpperCase() === 'GLOSA') return;
    
    if (!balances[cta]) {
      balances[cta] = { debe: 0, haber: 0, saldo: 0 };
    }
    balances[cta].debe += Number(entry.debe || 0);
    balances[cta].haber += Number(entry.haber || 0);
  });

  // Calculate net balances (Debit - Credit)
  Object.keys(balances).forEach(cta => {
    const b = balances[cta];
    b.saldo = Number((b.debe - b.haber).toFixed(2));
  });

  return balances;
}

/**
 * Executes the NIC 12 calculation engine based on trial balance and current company details
 */
export function calculateDeferredTaxSchedule(
  journal: any[],
  fixedAssets: any[],
  taxRate: number = 29.5,
  savedComputationOverrides?: Record<string, { taxBase: number; isCustom?: boolean; concepto?: string; cuenta?: string; accountingBase?: number }>
): DeferredTaxResult {
  const balances = getTrialBalanceBalances(journal);
  
  // Helper to sum balances by prefix
  const getSumOfPrefix = (prefix: string) => {
    return Object.entries(balances)
      .filter(([cta]) => cta.startsWith(prefix))
      .reduce((sum, [_, b]) => sum + b.saldo, 0);
  };

  const rows: DeferredTaxRow[] = [];

  // 1. Cobranza Dudosa (Cta 19)
  // Provision is credit balance, so getSumOfPrefix('19') is negative. Carrying amount is negative.
  const cobDudosaBal = getSumOfPrefix('19');
  if (cobDudosaBal !== 0) {
    const override = savedComputationOverrides?.['cobranza_dudosa'];
    const accountingBase = cobDudosaBal;
    const taxBase = override ? override.taxBase : 0; // default tax base is 0 (fully temporary deductible difference)
    const difference = Math.abs(accountingBase - taxBase);
    
    rows.push({
      key: 'cobranza_dudosa',
      concepto: 'Estimación de Cobranza Dudosa (Cuenta 19)',
      cuenta: '19',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo: 'DEDUCIBLE',
      activoDiferido: Number((difference * (taxRate / 100)).toFixed(2)),
      pasivoDiferido: 0
    });
  }

  // 2. Desvalorización de Existencias (Cta 29)
  const existenciasBal = getSumOfPrefix('29');
  if (existenciasBal !== 0) {
    const override = savedComputationOverrides?.['desvalorizacion_existencias'];
    const accountingBase = existenciasBal;
    const taxBase = override ? override.taxBase : 0; // default tax base is 0
    const difference = Math.abs(accountingBase - taxBase);
    
    rows.push({
      key: 'desvalorizacion_existencias',
      concepto: 'Desvalorización de Existencias (Cuenta 29)',
      cuenta: '29',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo: 'DEDUCIBLE',
      activoDiferido: Number((difference * (taxRate / 100)).toFixed(2)),
      pasivoDiferido: 0
    });
  }

  // 3. Provisiones Laborales / Vacaciones (Cta 4115, 415)
  // These accounts are liabilities, so balances are negative (credit).
  const provLaboralesBal = getSumOfPrefix('4115') + getSumOfPrefix('415');
  if (provLaboralesBal !== 0) {
    const override = savedComputationOverrides?.['provisiones_laborales'];
    const accountingBase = provLaboralesBal;
    const taxBase = override ? override.taxBase : 0; // default tax base is 0 (deductible when paid)
    const difference = Math.abs(accountingBase - taxBase);
    
    rows.push({
      key: 'provisiones_laborales',
      concepto: 'Provisiones de Beneficios Sociales y Vacaciones (Cuentas 4115/415)',
      cuenta: '415',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo: 'DEDUCIBLE',
      activoDiferido: Number((difference * (taxRate / 100)).toFixed(2)),
      pasivoDiferido: 0
    });
  }

  // 4. Activos Fijos (Depreciación)
  // Let's sum accounting cost vs depreciation.
  // Cost: Cta 33, Deprec: Cta 39
  const costPPE = getSumOfPrefix('33');
  const deprecPPE = getSumOfPrefix('39');
  
  if (costPPE !== 0 || deprecPPE !== 0) {
    const override = savedComputationOverrides?.['activos_fijos_depreciacion'];
    const accountingBase = costPPE + deprecPPE; // Carrying value
    
    // Default tax base suggestion:
    // If no override, let's assume tax depreciation matches accounting depreciation unless specified
    const taxBase = override ? override.taxBase : accountingBase;
    const diff = accountingBase - taxBase;
    
    const tipo = diff < 0 ? 'DEDUCIBLE' : 'GRAVABLE';
    const difference = Math.abs(diff);
    
    rows.push({
      key: 'activos_fijos_depreciacion',
      concepto: 'Propiedad, Planta y Equipo - Depreciación Diferida (Cta 33 vs 39)',
      cuenta: '39',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo,
      activoDiferido: tipo === 'DEDUCIBLE' ? Number((difference * (taxRate / 100)).toFixed(2)) : 0,
      pasivoDiferido: tipo === 'GRAVABLE' ? Number((difference * (taxRate / 100)).toFixed(2)) : 0
    });
  }

  // 5. Inyectar custom rows (p. ej. Pérdidas tributarias arrastrables o adiciones manuales del usuario)
  if (savedComputationOverrides) {
    Object.entries(savedComputationOverrides).forEach(([key, override]) => {
      if (override.isCustom) {
        const accountingBase = override.accountingBase || 0;
        const taxBase = override.taxBase || 0;
        const diff = accountingBase - taxBase;
        
        // For custom items, let's decide the type based on difference sign or user preference.
        // Usually positive difference on assets = taxable, negative = deductible.
        // Let's make it deductible if diff < 0 (asset with Carrying Value < Tax Base) or if it's explicitly set.
        const difference = Math.abs(diff);
        const tipo = diff < 0 ? 'DEDUCIBLE' : 'GRAVABLE';
        
        rows.push({
          key,
          concepto: override.concepto || 'Diferencia Temporaria Personalizada',
          cuenta: override.cuenta || '37',
          accountingBase: Number(accountingBase.toFixed(2)),
          taxBase: Number(taxBase.toFixed(2)),
          diferencia: Number(difference.toFixed(2)),
          tipo,
          activoDiferido: tipo === 'DEDUCIBLE' ? Number((difference * (taxRate / 100)).toFixed(2)) : 0,
          pasivoDiferido: tipo === 'GRAVABLE' ? Number((difference * (taxRate / 100)).toFixed(2)) : 0,
          isCustom: true
        });
      }
    });
  }

  // Compute totals
  let totalActivoDiferido = 0;
  let totalPasivoDiferido = 0;
  
  rows.forEach(r => {
    totalActivoDiferido += r.activoDiferido;
    totalPasivoDiferido += r.pasivoDiferido;
  });

  const netDeferredTax = Number((totalActivoDiferido - totalPasivoDiferido).toFixed(2));

  // Suggested journal entry
  // If netDeferredTax is positive (Net Activo Diferido), entry is:
  // Debe: 3712 (Activo Diferido)
  // Haber: 882 (Impuesto a la Renta Diferido)
  // If netDeferredTax is negative (Net Pasivo Diferido), entry is:
  // Debe: 882 (Impuesto a la Renta Diferido)
  // Haber: 491 (Pasivo Diferido)
  const suggestedJournalEntries: { cuenta: string; debe: number; haber: number; detalle: string }[] = [];
  if (netDeferredTax > 0) {
    suggestedJournalEntries.push({
      cuenta: '3712',
      debe: netDeferredTax,
      haber: 0,
      detalle: 'ACTIVO DIFERIDO POR IMPUESTO A LA RENTA NIC 12'
    });
    suggestedJournalEntries.push({
      cuenta: '882',
      debe: 0,
      haber: netDeferredTax,
      detalle: 'IMPUESTO A LA RENTA - DIFERIDO (INGRESO)'
    });
  } else if (netDeferredTax < 0) {
    const val = Math.abs(netDeferredTax);
    suggestedJournalEntries.push({
      cuenta: '882',
      debe: val,
      haber: 0,
      detalle: 'IMPUESTO A LA RENTA - DIFERIDO (GASTO)'
    });
    suggestedJournalEntries.push({
      cuenta: '491',
      debe: 0,
      haber: val,
      detalle: 'PASIVO DIFERIDO POR IMPUESTO A LA RENTA NIC 12'
    });
  }

  return {
    rows,
    totalActivoDiferido: Number(totalActivoDiferido.toFixed(2)),
    totalPasivoDiferido: Number(totalPasivoDiferido.toFixed(2)),
    netDeferredTax,
    taxRate,
    suggestedJournalEntries
  };
}
