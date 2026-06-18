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

  // 3a. Vacaciones provistas pero no pagadas (Cuenta 4115)
  const vacProvBal = getSumOfPrefix('4115');
  if (vacProvBal !== 0) {
    const override = savedComputationOverrides?.['vacaciones_no_pagadas'];
    const accountingBase = vacProvBal;
    const taxBase = override ? override.taxBase : 0; // deductible when paid
    const difference = Math.abs(accountingBase - taxBase);
    
    rows.push({
      key: 'vacaciones_no_pagadas',
      concepto: 'Vacaciones provistas pero no pagadas (Cuenta 4115)',
      cuenta: '4115',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo: 'DEDUCIBLE',
      activoDiferido: Number((difference * (taxRate / 100)).toFixed(2)),
      pasivoDiferido: 0
    });
  }

  // 3b. CTS provista pero no pagada (Cuenta 4151 / 415)
  const ctsProvBal = getSumOfPrefix('415');
  if (ctsProvBal !== 0) {
    const override = savedComputationOverrides?.['cts_no_pagada'];
    const accountingBase = ctsProvBal;
    const taxBase = override ? override.taxBase : 0; // deductible when paid
    const difference = Math.abs(accountingBase - taxBase);
    
    rows.push({
      key: 'cts_no_pagada',
      concepto: 'Compensación por Tiempo de Servicios - CTS (Cuenta 415)',
      cuenta: '415',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo: 'DEDUCIBLE',
      activoDiferido: Number((difference * (taxRate / 100)).toFixed(2)),
      pasivoDiferido: 0
    });
  }

  // 3c. Arrendamientos Financieros - Leasing (Cuenta 32 vs 395/396)
  const leasingAssetsBal = getSumOfPrefix('32');
  const leasingDeprecBal = getSumOfPrefix('395') || getSumOfPrefix('396'); // Depreciation of leased assets
  if (leasingAssetsBal !== 0 || leasingDeprecBal !== 0) {
    const override = savedComputationOverrides?.['leasing_acelerado'];
    const accountingBase = leasingAssetsBal + leasingDeprecBal;
    // Tributariamente, con depreciación acelerada leasing, la base es menor
    const taxBase = override ? override.taxBase : Number((accountingBase * 0.5).toFixed(2)); // default half due to acceleration
    const diff = accountingBase - taxBase;
    const tipo = diff < 0 ? 'DEDUCIBLE' : 'GRAVABLE';
    const difference = Math.abs(diff);

    rows.push({
      key: 'leasing_acelerado',
      concepto: 'Arrendamiento Financiero - Leasing (Cuenta 32 vs 395)',
      cuenta: '32',
      accountingBase: Number(accountingBase.toFixed(2)),
      taxBase: Number(taxBase.toFixed(2)),
      diferencia: Number(difference.toFixed(2)),
      tipo,
      activoDiferido: tipo === 'DEDUCIBLE' ? Number((difference * (taxRate / 100)).toFixed(2)) : 0,
      pasivoDiferido: tipo === 'GRAVABLE' ? Number((difference * (taxRate / 100)).toFixed(2)) : 0
    });
  }

  // 4. Activos Fijos (Depreciación)
  // Let's sum accounting cost vs depreciation.
  // Cost: Cta 33, Deprec: Cta 39
  const costPPE = getSumOfPrefix('33');
  const deprecPPE = getSumOfPrefix('39');
  
  if (costPPE !== 0 || deprecPPE !== 0 || (fixedAssets && fixedAssets.length > 0)) {
    const override = savedComputationOverrides?.['activos_fijos_depreciacion'];
    
    let accountingBase = costPPE + deprecPPE; // Default to ledger net value
    let taxBase = override ? override.taxBase : accountingBase; // Default tax base

    if (fixedAssets && fixedAssets.length > 0) {
      let totalAccountingBase = 0;
      let totalTaxBase = 0;

      fixedAssets.forEach(a => {
        const saldoInicial = Number(a.saldo_inicial) || 0;
        const adquisiciones = Number(a.adquisiciones) || 0;
        const mejoras = Number(a.mejoras) || 0;
        const retirosBajas = Number(a.retiros_bajas) || 0;
        const otrosAjustes = Number(a.otros_ajustes) || 0;
        const ajusteInflacion = Number(a.ajuste_inflacion) || 0;
        const costoAdq = Number(a.costo_adquisicion) || Number(a.costo) || 0;
        
        const valorAjustado = costoAdq + saldoInicial + adquisiciones + mejoras - retirosBajas + otrosAjustes + ajusteInflacion;

        // Contable
        const deprecAcumAnt = Number(a.deprec_acum_anterior) || 0;
        const deprecEjec = Number(a.deprec_ejercicio) || 0;
        const deprecBajas = Number(a.deprec_bajas) || 0;
        const deprecOtros = Number(a.deprec_otros) || 0;
        const deprecAcumTotal = deprecAcumAnt + deprecEjec - deprecBajas + deprecOtros;
        const carryingValue = valorAjustado - deprecAcumTotal;

        // Tributaria
        const deprecAcumAntTrib = Number(a.deprec_acum_anterior_tributaria) || deprecAcumAnt;
        const deprecEjecTrib = Number(a.deprec_ejercicio_tributaria) || deprecEjec;
        const deprecAcumTotalTrib = deprecAcumAntTrib + deprecEjecTrib - deprecBajas + deprecOtros;
        const taxValue = valorAjustado - deprecAcumTotalTrib;

        totalAccountingBase += carryingValue;
        totalTaxBase += taxValue;
      });

      accountingBase = totalAccountingBase;
      taxBase = override ? override.taxBase : totalTaxBase;
    }

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
      // 5a. Pérdidas Tributarias Arrastrables (Sistema A o Sistema B)
      if (key === 'perdida_arrastrable_a' || key === 'perdida_arrastrable_b') {
        const isA = key === 'perdida_arrastrable_a';
        const accountingBase = 0; // Contablemente no hay base de activo físico en libros para pérdidas
        const taxBase = override.taxBase || 0; // Pérdida imponible a compensar
        const difference = Math.abs(taxBase);
        
        rows.push({
          key,
          concepto: `Pérdida Tributaria Arrastrable - ${isA ? 'Sistema A (Límite 4 años)' : 'Sistema B (Límite 50% Renta Neta)'}`,
          cuenta: '3712',
          accountingBase,
          taxBase: Number(taxBase.toFixed(2)),
          diferencia: Number(difference.toFixed(2)),
          tipo: 'DEDUCIBLE',
          activoDiferido: Number((difference * (taxRate / 100)).toFixed(2)),
          pasivoDiferido: 0,
          isCustom: false
        });
        return;
      }

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
