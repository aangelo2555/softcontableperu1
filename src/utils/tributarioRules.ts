import type { CompanyData } from '../store';

/**
 * Interface que define el estado de obligatoriedad de los libros contables.
 */
export interface EstadoLibros {
  registroVentas: boolean;
  registroCompras: boolean;
  libroDiarioSimplificado: boolean;
  libroDiarioCompleto: boolean;
  libroMayor: boolean;
  libroInventariosBalances: boolean;
  libroCajaBancos: boolean;
  kardexFisico: boolean;
  kardexValorizado: boolean;
  registroCostos: boolean;
}

/**
 * Calcula la obligatoriedad de libros contables según normativa SUNAT Perú.
 * Implementación exacta del algoritmo de validación.
 * 
 * @param regimen - 'NRUS', 'RER', 'RMT', 'GENERAL'
 * @param sector - 'COMERCIAL', 'SERVICIOS', 'MANUFACTURA'
 * @param ingresos - Ingresos brutos anuales en Soles
 * @param valorUit - Valor oficial de la UIT para el año contable
 * @returns Mapa con los estados de activación de cada libro
 */
export function calcularObligacionesContables(
  regimenInput: string, 
  sector: string, 
  ingresos: number, 
  valorUit: number
): EstadoLibros {
  // 1. Inicialización por defecto: todo deshabilitado
  const libros: EstadoLibros = {
    registroVentas: false,
    registroCompras: false,
    libroDiarioSimplificado: false,
    libroDiarioCompleto: false,
    libroMayor: false,
    libroInventariosBalances: false,
    libroCajaBancos: false,
    kardexFisico: false,
    kardexValorizado: false,
    registroCostos: false
  };

  // Normalizar nombres de régimen para el algoritmo
  const regimen = regimenInput === 'RG' ? 'GENERAL' : regimenInput === 'MYPE' ? 'RMT' : regimenInput;

  // 2. Control de caso base: Nuevo RUS no lleva contabilidad
  if (regimen === 'NRUS') {
    return libros;
  }

  // 3. Control de caso intermedio: Régimen Especial (RER)
  if (regimen === 'RER') {
    libros.registroVentas = true;
    libros.registroCompras = true;
    return libros;
  }

  // Sanitización contra valores cero o indefinidos en UIT
  if (!valorUit || valorUit <= 0) return libros;

  // 4. Conversión analítica a tramos de la Unidad Impositiva Tributaria
  const tramosUit = ingresos / valorUit;

  // 5. Aplicación de reglas para regímenes complejos (RMT y GENERAL)
  if (regimen === 'RMT' || regimen === 'GENERAL') {
    // Ventas y Compras siempre activos desde 0 UIT
    libros.registroVentas = true;
    libros.registroCompras = true;

    // Tramificación por volumen de negocio
    if (tramosUit <= 300) {
      libros.libroDiarioSimplificado = true;
    } else {
      libros.libroDiarioCompleto = true;
      libros.libroMayor = true;
    }

    if (tramosUit > 500) {
      libros.libroInventariosBalances = true;
    }

    if (tramosUit > 1700 && regimen === 'GENERAL') {
      libros.libroCajaBancos = true;
    }
  }

  // 6. Inyección de modificadores por sector de negocio
  const sectorNormalizado = sector.toUpperCase();
  const esManufactura = sectorNormalizado.includes('MANUFACTUR');
  const esComercial = sectorNormalizado === 'COMERCIAL';

  if (esComercial || esManufactura) {
    if (tramosUit > 500 && tramosUit <= 1500) {
      libros.kardexFisico = true;
    } else if (tramosUit > 1500) {
      libros.kardexValorizado = true;
    }
  }

  if (esManufactura && tramosUit > 1500) {
    libros.registroCostos = true;
  }

  return libros;
}

/**
 * Determina si un módulo/pestaña contable debe estar habilitado según las normas de SUNAT.
 * 
 * @param tabId Identificador de la pestaña/módulo
 * @param company Datos de la empresa activa
 */
export function isTabEnabled(tabId: string, company: CompanyData | null | undefined): boolean {
  if (!company) return true;

  // Extraer variables de configuración (Sanitizadas)
  const regimen = company.regimenTributario || 'RG';
  const sector = company.businessType || 'COMERCIAL';
  const ingresosUIT = Number(company.annualIncomeUIT || 0); // En SoftContable se guarda en UIT
  
  // OBTENER VALOR UIT DEL PERIODO
  // Valor actualizado para el año 2026
  const valorUIT = 5500.00;
  const ingresosSoles = ingresosUIT * valorUIT; // Reconstruir soles para la función matemática pura

  // Módulos que NUNCA se deshabilitan (Transversales / No contables de SUNAT)
  const alwaysEnabled = [
    'EMPRESA',       // Panel Principal
    'CLIENTES',      // Mis Empresas
    'CLI_PRO',       // Directorio
    'PLAN',          // Plan Contable
    'DATOS',         // Tablas Generales
    'MANTENIMIENTO', // Configuración
    'BUZON',         // Buzón Electrónico
    'SIRE'           // Módulo SIRE
  ];

  if (alwaysEnabled.includes(tabId)) return true;

  // Calcular las obligaciones utilizando el nuevo Motor de Reglas
  const obligaciones = calcularObligacionesContables(regimen, sector, ingresosSoles, valorUIT);

  // Mapeo exhaustivo de TabId a Regla Contable
  switch (tabId) {
    // 1. Registro de Ventas
    case 'VENTAS':
    case 'VENTAS_141':
      return obligaciones.registroVentas;

    // 2. Registro de Compras y Honorarios
    case 'COMPRAS':
    case 'HONORARIOS':
      return obligaciones.registroCompras;

    // 3. Libro Diario (Cualquier formato)
    // "Regla de Flexibilidad de Software: El sistema debe permitir de forma opcional que el usuario elija"
    // Esto implica que si cualquiera de los dos está activo, habilitamos las pantallas operativas
    case 'ASIENTOS':
    case 'DIARIO':
    case 'PLANILLA': // Las planillas generan asientos de diario
      return obligaciones.libroDiarioSimplificado || obligaciones.libroDiarioCompleto;

    // 4. Libro Mayor
    case 'MAYOR':
      return obligaciones.libroMayor;

    // 5. Libro Caja y Bancos (Y operaciones de Tesorería asociadas)
    case 'CAJA':
    case 'MOVIMIENTOS':
    case 'CAJABANCOS':
      return obligaciones.libroCajaBancos;

    // 6. Libro de Inventarios y Balances (Incluye todos los Estados Financieros y Anexos)
    case 'BALANCE_INICIAL':
    case 'BALANCE':
    case 'EGYP':
    case 'HHTT':
    case 'ESTADOS_SEC':
    case 'ANEXOS':
    case 'CCC':
    case 'ACTIVOS': // Activos Fijos es condicional al Libro de Inventarios y Balances
      return obligaciones.libroInventariosBalances;

    // 7. Registros de Inventario (Kardex)
    case 'PRODUCTOS':
      // El kardex físico (unidades) activa la pestaña de productos. 
      // Nota: Si el valorizado está activo, inherentemente necesita productos también.
      return obligaciones.kardexFisico || obligaciones.kardexValorizado;
    
    case 'KARDEX':
      return obligaciones.kardexValorizado;

    // 8. Registro de Costos
    case 'COSTOS':
      return obligaciones.registroCostos;

    default:
      return false; // Principio de cierre estricto: Todo lo no mapeado se omite
  }
}
