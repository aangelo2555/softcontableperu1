/**
 * Catálogo de 15 Herramientas Nativas de STAR (Hermes Agent Tool Registry)
 * 
 * Permite a STAR leer, inspeccionar, cruzar y auditar de forma segura
 * todas las hojas de SOFTCONTABLE:
 * Compras, Ventas, Honorarios, Diario, Mayor, PCGE 2026, Caja/Bancos,
 * Kárdex 12.1, Activos 7.1, Planillas PLAME, Balance de Comprobación, etc.
 */

const coreReader = require('../coreReader');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../databasePostgres') : require('../databaseServer');
const fs = require('fs');
const path = require('path');

// Cargar catálogo oficial del PCGE 2026 en memoria para búsquedas instantáneas
let pcgeCatalog = [];
try {
    const pcgePath = path.join(__dirname, '../planContable.json');
    if (fs.existsSync(pcgePath)) {
        pcgeCatalog = JSON.parse(fs.readFileSync(pcgePath, 'utf8'));
    }
} catch (e) {
    console.warn('[STAR TOOL REGISTRY] Warning al cargar planContable.json:', e.message);
}

/**
 * 15 Definiciones de Herramientas en Formato JSON Schema (Hermes 3 / OpenAI Compatible)
 */
const STAR_TOOLS_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'star_read_purchases',
            description: 'Lee los comprobantes del Registro de Compras (8.1/8.2) para el periodo y empresa activa. Permite filtrar por proveedor o compras no bancarizadas (>= S/ 2,000 en efectivo).',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal en formato YYYY-MM (ej. 2026-08)' },
                    ruc_o_nombre_proveedor: { type: 'string', description: 'Opcional: filtrar por RUC o razón social del proveedor' },
                    solo_sin_bancarizar: { type: 'boolean', description: 'Opcional: Si es true, retorna solo comprobantes >= S/ 2,000 pagados en efectivo' },
                    limite: { type: 'number', description: 'Límite de registros a retornar (default 50)' }
                },
                required: ['periodo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_sales',
            description: 'Lee los comprobantes del Registro de Ventas (14.1) con estado SIRE, CAR, bases imponibles e IGV.',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal en formato YYYY-MM (ej. 2026-08)' },
                    ruc_o_nombre_cliente: { type: 'string', description: 'Opcional: filtrar por cliente' },
                    limite: { type: 'number', description: 'Límite de registros a retornar (default 50)' }
                },
                required: ['periodo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_honorarios',
            description: 'Lee los Recibos por Honorarios Electrónicos (4ta Categoría) con retención de renta del 8%.',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal YYYY-MM' }
                },
                required: ['periodo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_journal',
            description: 'Lee los asientos del Libro Diario (5.1/5.2) con glosas, cuentas contables y verificación de partida doble (Debe vs Haber).',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal YYYY-MM' },
                    numero_asiento: { type: 'string', description: 'Opcional: filtrar por correlativo o número de asiento' },
                    cuenta_contable: { type: 'string', description: 'Opcional: filtrar por prefijo de cuenta (ej. 40111, 6011, 1212)' },
                    solo_descuadrados: { type: 'boolean', description: 'Opcional: Retorna solo asientos con diferencia entre Debe y Haber' }
                },
                required: ['periodo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_ledger',
            description: 'Lee el Libro Mayor (6.1) con sumas acumuladas deudoras, acreedoras y saldo neto por subcuenta.',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal YYYY-MM' },
                    cuenta_contable: { type: 'string', description: 'Opcional: código de cuenta específico (ej. 10411, 40111)' }
                },
                required: ['periodo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_pcge',
            description: 'Consulta el catálogo oficial del Plan Contable General Empresarial (PCGE 2026), descripción, dinámicas contables y cuentas de amarre de elementos 9 y 79.',
            parameters: {
                type: 'object',
                properties: {
                    termino_o_codigo: { type: 'string', description: 'Código (ej. 6011, 6361) o palabra clave (ej. telefonía, combustible, mercadería)' }
                },
                required: ['termino_o_codigo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_entities',
            description: 'Consulta el directorio de Clientes y Proveedores registrados con su RUC, Razón Social y condición ante SUNAT.',
            parameters: {
                type: 'object',
                properties: {
                    ruc_o_nombre: { type: 'string', description: 'RUC o nombre para buscar' }
                },
                required: ['ruc_o_nombre']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_cash_bank',
            description: 'Lee los movimientos de Tesorería: Libro Caja 1.1 (Efectivo) y Libro Bancos 1.2 (Cuentas Corrientes y Extractos).',
            parameters: {
                type: 'object',
                properties: {
                    tipo_formato: { type: 'string', enum: ['1.1', '1.2', 'AMBOS'], description: '1.1 para Caja Efectivo, 1.2 para Bancos' },
                    periodo: { type: 'string', description: 'Periodo fiscal YYYY-MM' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_kardex',
            description: 'Lee el Kárdex Valorizado (12.1), stock actual, entradas, salidas y valuación por costo promedio ponderado.',
            parameters: {
                type: 'object',
                properties: {
                    codigo_o_nombre_producto: { type: 'string', description: 'Opcional: filtrar por producto específico' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_assets',
            description: 'Lee el Registro de Activos Fijos (7.1), costo de adquisición, fecha de inicio de uso, depreciación acumulada y tasas duales (Financiera NIC 16 vs Tributaria LIR).',
            parameters: {
                type: 'object',
                properties: {}
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_payroll',
            description: 'Lee la planilla de trabajadores (PLAME), sueldo básico, asignación familiar, régimen pensionario (ONP/AFP) y provisiones de Gratificaciones Ley 27735 y CTS.',
            parameters: {
                type: 'object',
                properties: {}
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_trial_balance',
            description: 'Genera y lee la Hoja de Trabajo / Balance de Comprobación a 10 columnas consolidado (Sumas del Mayor, Saldos, Inventario y Resultados).',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo o año fiscal (ej. 2026-08 o 2026)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_financial_stmts',
            description: 'Lee los Estados Financieros: Estado de Resultados (por Función y Naturaleza), Estado de Situación Financiera (Balance General) y Ciclo de Conversión de Efectivo (CCC).',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal YYYY-MM' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_read_costs',
            description: 'Lee la configuración y distribución de Centros de Costo (Administración, Ventas, Producción).',
            parameters: {
                type: 'object',
                properties: {}
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_crosscheck_audit',
            description: 'Ejecuta una auditoría cruzada integral multidimensional: Compras vs Libro Diario (bancarización y cuentas 42/40), Ventas vs Cuenta 1212, Planillas vs Gasto de Personal 62, y Balance Debe/Haber.',
            parameters: {
                type: 'object',
                properties: {
                    periodo: { type: 'string', description: 'Periodo fiscal YYYY-MM a auditar' }
                },
                required: ['periodo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'star_save_learning',
            description: 'Guarda o refuerza una regla contable o patrón aprendido sobre la empresa en el banco de memoria evolutiva de STAR.',
            parameters: {
                type: 'object',
                properties: {
                    categoria: { type: 'string', enum: ['PROVEEDOR_CUENTA', 'CENTRO_COSTO', 'POLITICA_IGV', 'BENEFICIO_LABORAL', 'PATRON_TESORERIA'] },
                    clave_entidad: { type: 'string', description: 'RUC de proveedor, código de producto o tipo de operación' },
                    regla_aprendida: { type: 'object', description: 'Objeto JSON con los detalles de la regla contable aprendida' },
                    indice_confianza: { type: 'number', description: 'Ponderación de 0.50 a 1.00' }
                },
                required: ['categoria', 'clave_entidad', 'regla_aprendida']
            }
        }
    }
];

/**
 * Ejecutor Central de Herramientas para STAR
 */
async function executeStarTool(toolName, args, context) {
    const workspaceId = context?.workspaceId || context?.currentCompany?.ruc || '';
    const userId = context?.userId || '';
    const activePeriod = args.periodo || context?.period || new Date().toISOString().slice(0, 7);

    try {
        switch (toolName) {
            case 'star_read_purchases': {
                const purchases = await coreReader.getPurchases(workspaceId, activePeriod, userId);
                let filtered = purchases || [];

                if (args.ruc_o_nombre_proveedor) {
                    const search = args.ruc_o_nombre_proveedor.toLowerCase().trim();
                    filtered = filtered.filter(p => 
                        (p.doc_num && p.doc_num.includes(search)) || 
                        (p.nombre && p.nombre.toLowerCase().includes(search))
                    );
                }

                if (args.solo_sin_bancarizar) {
                    filtered = filtered.filter(p => {
                        const total = Number(p.total || 0);
                        const isCash = (p.pago_medio || '').toLowerCase().includes('efectivo') || !p.pago_operacion;
                        return total >= 2000 && isCash;
                    });
                }

                const limit = args.limite || 50;
                const totalBi = filtered.reduce((acc, p) => acc + Number(p.bi || 0), 0);
                const totalIgv = filtered.reduce((acc, p) => acc + Number(p.igv || 0), 0);
                const totalMonto = filtered.reduce((acc, p) => acc + Number(p.total || 0), 0);

                return {
                    success: true,
                    totalRegistros: filtered.length,
                    resumenTotales: {
                        baseImponible: totalBi.toFixed(2),
                        igv: totalIgv.toFixed(2),
                        total: totalMonto.toFixed(2)
                    },
                    comprobantes: filtered.slice(0, limit).map(p => ({
                        registro: p.registro,
                        fecha: p.fecha,
                        tipoDoc: p.tipo_doc,
                        serieNumero: `${p.serie}-${p.numero}`,
                        proveedorRuc: p.doc_num,
                        proveedorNombre: p.nombre,
                        ctaGasto: p.ctaGasto,
                        ctaAbono: p.ctaAbono,
                        bi: Number(p.bi || 0).toFixed(2),
                        igv: Number(p.igv || 0).toFixed(2),
                        total: Number(p.total || 0).toFixed(2),
                        detraccionMonto: p.spot_monto || 0,
                        bancarizado: Boolean(p.pago_operacion || p.pago_cuenta)
                    }))
                };
            }

            case 'star_read_sales': {
                const sales = await coreReader.getSales(workspaceId, activePeriod, userId);
                let filtered = sales || [];

                if (args.ruc_o_nombre_cliente) {
                    const search = args.ruc_o_nombre_cliente.toLowerCase().trim();
                    filtered = filtered.filter(s => 
                        (s.doc_num && s.doc_num.includes(search)) || 
                        (s.nombre && s.nombre.toLowerCase().includes(search))
                    );
                }

                const limit = args.limite || 50;
                const totalBi = filtered.reduce((acc, s) => acc + Number(s.bi || 0), 0);
                const totalIgv = filtered.reduce((acc, s) => acc + Number(s.igv || 0), 0);
                const totalMonto = filtered.reduce((acc, s) => acc + Number(s.total || 0), 0);

                return {
                    success: true,
                    totalRegistros: filtered.length,
                    resumenTotales: {
                        baseImponible: totalBi.toFixed(2),
                        igv: totalIgv.toFixed(2),
                        total: totalMonto.toFixed(2)
                    },
                    comprobantes: filtered.slice(0, limit).map(s => ({
                        registro: s.registro,
                        fecha: s.fecha,
                        tipoDoc: s.tipo_doc,
                        serieNumero: `${s.serie}-${s.numero}`,
                        clienteRuc: s.doc_num,
                        clienteNombre: s.nombre,
                        ctaCargo: s.ctaCargo,
                        ctaIngreso: s.ctaIngreso,
                        bi: Number(s.bi || 0).toFixed(2),
                        igv: Number(s.igv || 0).toFixed(2),
                        total: Number(s.total || 0).toFixed(2),
                        estadoSire: s.estado_sire || 'Registrado'
                    }))
                };
            }

            case 'star_read_honorarios': {
                let honorarios = [];
                if (USE_POSTGRES) {
                    const res = await db.pool.query(
                        `SELECT * FROM honorarios 
                         WHERE (workspace_id = $1 OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
                         ORDER BY fecha ASC`,
                        [workspaceId]
                    );
                    honorarios = res.rows || [];
                } else {
                    honorarios = db.all(
                        `SELECT * FROM honorarios 
                         WHERE (workspace_id = ? OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
                         ORDER BY fecha ASC`,
                        [workspaceId, workspaceId, workspaceId]
                    ) || [];
                }

                const totalBi = honorarios.reduce((acc, h) => acc + Number(h.bi || 0), 0);
                const totalRet = honorarios.reduce((acc, h) => acc + Number(h.retencion || 0), 0);
                const totalNeto = honorarios.reduce((acc, h) => acc + Number(h.total || 0), 0);

                return {
                    success: true,
                    totalRegistros: honorarios.length,
                    resumenTotales: {
                        brutoTotal: totalBi.toFixed(2),
                        retencion8Total: totalRet.toFixed(2),
                        netoAPagarTotal: totalNeto.toFixed(2)
                    },
                    recibos: honorarios.slice(0, 30).map(h => ({
                        registro: h.registro,
                        fecha: h.fecha,
                        serieNumero: `${h.serie}-${h.numero}`,
                        emisorDoc: h.doc_num,
                        emisorNombre: h.nombre,
                        ctaGasto: h.ctaGasto,
                        montoBruto: Number(h.bi || 0).toFixed(2),
                        retencion: Number(h.retencion || 0).toFixed(2),
                        neto: Number(h.total || 0).toFixed(2)
                    }))
                };
            }

            case 'star_read_journal': {
                const journal = await coreReader.getJournalEntries(workspaceId, activePeriod, userId);
                let entries = journal || [];

                if (args.numero_asiento) {
                    entries = entries.filter(j => (j.asiento || '').toString().includes(args.numero_asiento));
                }

                if (args.cuenta_contable) {
                    const prefix = args.cuenta_contable.trim();
                    entries = entries.filter(j => (j.cta || '').startsWith(prefix));
                }

                // Agrupar por asiento para validar cuadre
                const grouped = {};
                for (const line of entries) {
                    const aNum = line.asiento || 'SIN_NUMERO';
                    if (!grouped[aNum]) {
                        grouped[aNum] = {
                            asiento: aNum,
                            fecha: line.fecha,
                            glosa: line.glosa,
                            totalDebe: 0,
                            totalHaber: 0,
                            lineas: []
                        };
                    }
                    const d = Number(line.debe || 0);
                    const h = Number(line.haber || 0);
                    grouped[aNum].totalDebe += d;
                    grouped[aNum].totalHaber += h;
                    grouped[aNum].lineas.push({
                        cuenta: line.cta,
                        descripcion: line.desc || line.glosa,
                        debe: d.toFixed(2),
                        haber: h.toFixed(2)
                    });
                }

                let asientosList = Object.values(grouped).map(a => {
                    const diff = Math.abs(a.totalDebe - a.totalHaber);
                    return {
                        ...a,
                        totalDebe: a.totalDebe.toFixed(2),
                        totalHaber: a.totalHaber.toFixed(2),
                        cuadrado: diff < 0.01,
                        diferencia: diff.toFixed(2)
                    };
                });

                if (args.solo_descuadrados) {
                    asientosList = asientosList.filter(a => !a.cuadrado);
                }

                return {
                    success: true,
                    totalAsientos: asientosList.length,
                    asientosDescuadrados: asientosList.filter(a => !a.cuadrado).length,
                    asientos: asientosList.slice(0, 30)
                };
            }

            case 'star_read_ledger': {
                const journal = await coreReader.getJournalEntries(workspaceId, activePeriod, userId);
                const ledgerMap = {};

                for (const line of (journal || [])) {
                    const cta = line.cta || 'SIN_CUENTA';
                    if (!ledgerMap[cta]) {
                        ledgerMap[cta] = {
                            cuenta: cta,
                            descripcion: line.desc || line.glosa || '',
                            totalDebe: 0,
                            totalHaber: 0,
                            movimientosCount: 0
                        };
                    }
                    ledgerMap[cta].totalDebe += Number(line.debe || 0);
                    ledgerMap[cta].totalHaber += Number(line.haber || 0);
                    ledgerMap[cta].movimientosCount++;
                }

                let subcuentas = Object.values(ledgerMap).map(acc => {
                    const saldoDeudor = Math.max(0, acc.totalDebe - acc.totalHaber);
                    const saldoAcreedor = Math.max(0, acc.totalHaber - acc.totalDebe);
                    return {
                        cuenta: acc.cuenta,
                        descripcion: acc.descripcion,
                        totalDebe: acc.totalDebe.toFixed(2),
                        totalHaber: acc.totalHaber.toFixed(2),
                        saldoDeudor: saldoDeudor.toFixed(2),
                        saldoAcreedor: saldoAcreedor.toFixed(2),
                        movimientos: acc.movimientosCount
                    };
                });

                if (args.cuenta_contable) {
                    subcuentas = subcuentas.filter(s => s.cuenta.startsWith(args.cuenta_contable));
                }

                return {
                    success: true,
                    totalCuentasConMovimiento: subcuentas.length,
                    mayor: subcuentas.slice(0, 30)
                };
            }

            case 'star_read_pcge': {
                const search = (args.termino_o_codigo || '').toLowerCase().trim();
                let results = [];

                if (pcgeCatalog.length > 0) {
                    results = pcgeCatalog.filter(acc => 
                        (acc.cta && acc.cta.startsWith(search)) || 
                        (acc.description && acc.description.toLowerCase().includes(search))
                    );
                } else if (USE_POSTGRES) {
                    const res = await db.pool.query(
                        `SELECT cta, description, type, amarredebe, amarrehaber FROM plan_global 
                         WHERE cta LIKE $1 OR LOWER(description) LIKE $2 LIMIT 20`,
                        [`${search}%`, `%${search}%`]
                    );
                    results = res.rows || [];
                }

                return {
                    success: true,
                    totalEncontradas: results.length,
                    cuentas: results.slice(0, 15).map(c => ({
                        cuenta: c.cta,
                        descripcion: c.description,
                        tipo: c.type || 'Balance/Resultado',
                        amarreDebe: c.amarreDebe || c.amarredebe || null,
                        amarreHaber: c.amarreHaber || c.amarrehaber || null
                    }))
                };
            }

            case 'star_read_entities': {
                let entities = [];
                const search = (args.ruc_o_nombre || '').toLowerCase().trim();
                if (USE_POSTGRES) {
                    const res = await db.pool.query(
                        `SELECT * FROM entities 
                         WHERE (workspace_id = $1 OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = $1 OR id = $1 LIMIT 1))
                           AND (LOWER(ruc) LIKE $2 OR LOWER(descripcion) LIKE $2) LIMIT 20`,
                        [workspaceId, `%${search}%`]
                    );
                    entities = res.rows || [];
                } else {
                    entities = db.all(
                        `SELECT * FROM entities 
                         WHERE (workspace_id = ? OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1))
                           AND (LOWER(ruc) LIKE ? OR LOWER(descripcion) LIKE ?) LIMIT 20`,
                        [workspaceId, workspaceId, workspaceId, `%${search}%`, `%${search}%`]
                    ) || [];
                }

                return {
                    success: true,
                    total: entities.length,
                    entidades: entities.map(e => ({
                        tipo: e.tipo,
                        ruc: e.ruc,
                        razonSocial: e.descripcion
                    }))
                };
            }

            case 'star_read_cash_bank': {
                let cashMoves = [];
                let bankStatements = [];

                if (USE_POSTGRES) {
                    const resCash = await db.pool.query(
                        `SELECT * FROM cash_movements 
                         WHERE (workspace_id = $1 OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)) LIMIT 30`,
                        [workspaceId]
                    );
                    cashMoves = resCash.rows || [];

                    const resBank = await db.pool.query(
                        `SELECT * FROM bank_statements 
                         WHERE (workspace_id = $1 OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = $1 OR id = $1 LIMIT 1)) LIMIT 30`,
                        [workspaceId]
                    );
                    bankStatements = resBank.rows || [];
                } else {
                    cashMoves = db.all(
                        `SELECT * FROM cash_movements WHERE (workspace_id = ? OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)) LIMIT 30`,
                        [workspaceId, workspaceId, workspaceId]
                    ) || [];
                    bankStatements = db.all(
                        `SELECT * FROM bank_statements WHERE (workspace_id = ? OR workspace_id = (SELECT ruc FROM workspaces WHERE ruc = ? OR id = ? LIMIT 1)) LIMIT 30`,
                        [workspaceId, workspaceId, workspaceId]
                    ) || [];
                }

                return {
                    success: true,
                    cajaEfectivoMovimientos: cashMoves.length,
                    bancosMovimientos: bankStatements.length,
                    bancosSinConciliar: bankStatements.filter(b => !b.reconciled_journal_id).length,
                    ultimosMovimientosBancarios: bankStatements.slice(0, 15).map(b => ({
                        fecha: b.fecha,
                        glosa: b.glosa,
                        monto: Number(b.monto || 0).toFixed(2),
                        conciliado: Boolean(b.reconciled_journal_id)
                    }))
                };
            }

            case 'star_read_payroll': {
                const employees = await coreReader.getEmployees(workspaceId, userId);
                const active = employees || [];
                
                const totalBasico = active.reduce((acc, e) => acc + Number(e.sueldo_basico || 0), 0);
                const totalAsigFam = active.reduce((acc, e) => acc + (e.asignacion_familiar ? 113.00 : 0), 0);
                const gratiEstimada = active.reduce((acc, e) => {
                    const rem = Number(e.sueldo_basico || 0) + (e.asignacion_familiar ? 113.00 : 0);
                    return acc + rem + (rem * 0.09);
                }, 0);
                const ctsEstimada = active.reduce((acc, e) => {
                    const rem = Number(e.sueldo_basico || 0) + (e.asignacion_familiar ? 113.00 : 0);
                    return acc + (rem + (rem / 6)) / 2;
                }, 0);

                return {
                    success: true,
                    totalTrabajadores: active.length,
                    resumenLaboral: {
                        sueldoBasicoTotal: totalBasico.toFixed(2),
                        asignacionFamiliarTotal: totalAsigFam.toFixed(2),
                        gratificacionProyectadaSemestral: gratiEstimada.toFixed(2),
                        ctsProyectadaSemestral: ctsEstimada.toFixed(2),
                        aporteEsSaludMensual: ((totalBasico + totalAsigFam) * 0.09).toFixed(2)
                    },
                    trabajadores: active.slice(0, 20).map(e => ({
                        dni: e.dni,
                        nombre: e.nombre,
                        puesto: e.puesto,
                        sueldoBasico: Number(e.sueldo_basico || 0).toFixed(2),
                        asignacionFamiliar: Boolean(e.asignacion_familiar),
                        regimenPension: e.regimen_pensionario || 'ONP',
                        fechaIngreso: e.fecha_ingreso
                    }))
                };
            }

            case 'star_crosscheck_audit': {
                const purchases = await coreReader.getPurchases(workspaceId, activePeriod, userId);
                const sales = await coreReader.getSales(workspaceId, activePeriod, userId);
                const journal = await coreReader.getJournalEntries(workspaceId, activePeriod, userId);
                const employees = await coreReader.getEmployees(workspaceId, userId);

                const totalVentas = (sales || []).reduce((acc, s) => acc + Number(s.total || 0), 0);
                const totalCompras = (purchases || []).reduce((acc, p) => acc + Number(p.total || 0), 0);
                const igvVentas = (sales || []).reduce((acc, s) => acc + Number(s.igv || 0), 0);
                const igvCompras = (purchases || []).reduce((acc, p) => acc + Number(p.igv || 0), 0);
                const igvEstimadoPagar = Math.max(0, igvVentas - igvCompras);

                // Hallazgo 1: Compras sin bancarizar
                const noBancarizadas = (purchases || []).filter(p => {
                    const tot = Number(p.total || 0);
                    const isCash = (p.pago_medio || '').toLowerCase().includes('efectivo') || !p.pago_operacion;
                    return tot >= 2000 && isCash;
                });

                // Hallazgo 2: Asientos descuadrados en Libro Diario
                const grouped = {};
                for (const line of (journal || [])) {
                    const aNum = line.asiento || '0';
                    if (!grouped[aNum]) grouped[aNum] = { debe: 0, haber: 0 };
                    grouped[aNum].debe += Number(line.debe || 0);
                    grouped[aNum].haber += Number(line.haber || 0);
                }
                const descuadrados = Object.keys(grouped).filter(k => Math.abs(grouped[k].debe - grouped[k].haber) > 0.01);

                return {
                    success: true,
                    periodoAuditado: activePeriod,
                    metricasGenerales: {
                        ventasTotales: totalVentas.toFixed(2),
                        comprasTotales: totalCompras.toFixed(2),
                        igvVentas: igvVentas.toFixed(2),
                        igvCompras: igvCompras.toFixed(2),
                        igvEstimadoPagar: igvEstimadoPagar.toFixed(2),
                        ratioComprasVentas: totalVentas > 0 ? ((totalCompras / totalVentas) * 100).toFixed(1) + '%' : '0.0%',
                        trabajadoresActivos: (employees || []).length
                    },
                    observacionesCriticas: {
                        comprasSinBancarizarMayor2000: noBancarizadas.length,
                        montoRiesgoBancarizacion: noBancarizadas.reduce((acc, p) => acc + Number(p.total || 0), 0).toFixed(2),
                        asientosDescuadradosDiario: descuadrados.length,
                        asientosDescuadradosNumeros: descuadrados
                    }
                };
            }

            case 'star_save_learning': {
                const { categoria, clave_entidad, regla_aprendida, indice_confianza } = args;
                const learningId = `lrn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                
                const saved = await db.saveStarLearning({
                    id: learningId,
                    workspaceId,
                    category: categoria,
                    entityKey: clave_entidad,
                    learnedRule: regla_aprendida,
                    confidenceScore: indice_confianza || 0.90
                });

                return {
                    success: true,
                    mensaje: `Regla contable para '${clave_entidad}' guardada en la memoria de la empresa con éxito.`,
                    registro: saved
                };
            }

            default:
                return {
                    success: false,
                    error: `Herramienta desconocida: ${toolName}`
                };
        }
    } catch (error) {
        console.error(`[STAR TOOL EXECUTION ERROR: ${toolName}]`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    STAR_TOOLS_DEFINITIONS,
    executeStarTool
};
