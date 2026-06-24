const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const pathResolver = require('./pathResolver');
const db = require('../server/databaseServer');
const SireOrchestrator = require('./sireOrchestrator');
const SireFileGenerator = require('./sireFileGenerator');
const excelReader = require('./excelReader');

class SireHandler {
  constructor() {
    this.excelSirePath = pathResolver.resolve('data/API_SIRE.xlsm');
    this.orchestrator = new SireOrchestrator();
    this.generator = new SireFileGenerator();
    this.db = db;
  }

  /**
   * DEPRECATED: Ya no se usa API_SIRE.xlsm
   * Los clientes se gestionan desde "Gestión de Clientes"
   */
  async abrirExcelSire() {
    return {
      success: false,
      error: 'Esta función ya no está disponible. Los clientes ahora se gestionan desde "Gestión de Clientes".'
    };
  }

  /**
   * Ejecuta el proceso SIRE completo (JavaScript puro, sin Excel)
   * @param {Object} datos - Datos para la ejecución
   * @returns {Promise<Object>} Resultado de la operación
   */
  async ejecutarSire(datos) {
    try {
      const { ruc, empresa, proceso, periodoInicio, periodoFin, rangoActivo } = datos;

      logger.info('Ejecutando proceso SIRE (JavaScript)', {
        ruc,
        proceso,
        periodoInicio,
        periodoFin: rangoActivo ? periodoFin : 'N/A'
      });

      // Obtener credenciales de la empresa
      let credentials;
      
      if (datos.credentials) {
        credentials = { success: true, data: datos.credentials };
      } else {
        credentials = await this.obtenerCredenciales(ruc);
      }

      if (!credentials.success) {
        return {
          success: false,
          error: credentials.error
        };
      }

      // Preparar parámetros para el orquestador
      const params = {
        ruc,
        empresa,
        proceso,
        periodoInicio: parseInt(periodoInicio),
        periodoFin: rangoActivo ? parseInt(periodoFin) : parseInt(periodoInicio),
        rangoActivo,
        rangoActivo,
        credentials: credentials.data,
        plan: datos.plan // Pasar el plan al orquestador
      };

      // Ejecutar proceso
      const resultado = await this.orchestrator.ejecutarDescarga(params);

      if (resultado.success) {
        // Persistir en Base de Datos si hay registros
        if (resultado.datosRaw && resultado.datosRaw.data.length > 0) {
          await this.persistirRegistrosSire(ruc, proceso, resultado.datosRaw, datos.userId);
        }
        
        if (resultado.excelPath) {
          // Abrir Excel automáticamente (opcional, mantenemos por compatibilidad)
          await this.orchestrator.abrirExcelGenerado(resultado.excelPath);
        }
      }

      return resultado;

    } catch (error) {
      logger.error('Error en ejecutarSire', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Persiste los registros descargados del SIRE en la base de datos local
   */
  async persistirRegistrosSire(ruc, proceso, datosRaw, userId) {
    try {
      const { headers, data } = datosRaw;
      
      const parseNum = (val) => {
        if (!val) return 0;
        // Limpiar símbolos de moneda y separadores de miles
        const clean = val.toString().replace(/[S\/$\s,]/g, '').replace(/^[^\d.-]+/, '');
        return parseFloat(clean) || 0;
      };

      // El backend recibe la data limpia del parser de TXT del ZIP, no tiene metadatos adicionales de cabecera.
      const dataRows = data;
      
      const isRVIE = proceso.includes('RVIE');
      
      // Mapeo dinámico basado en proceso (RCE vs RVIE)
      const mappedRecords = dataRows.map((row, index) => {
        const id = `${ruc}-${proceso}-${Date.now()}-${index}`;
        if (isRVIE) {
          // Ventas (RVIE)
          return {
            id,
            registro: 'SIRE',
            fecha: row[4] || '', // Fecha Emisión (col5_fecEmision)
            fecVcto: row[5] || '', // Fecha Vcto (col6_fecVence)
            tipo_doc: row[6] || '',
            serie: row[7] || '',
            numero: row[8] || '', // Documento Número (col9_numInicial)
            doc_tipo: row[10] || '', // Tipo Doc Cliente (col11_tipoDoc)
            doc_num: row[11] || '', // Nro Doc Cliente (col12_numDoc)
            nombre: row[12] || '', // Nombre/Razón Social Cliente (col13_razonSocialCliente)
            bi: parseNum(row[14]), // Base Imponible (col15_baseImponibleGravada)
            igv: parseNum(row[16]), // IGV (col17_igvIpm)
            noGravada: parseNum(row[19]), // Operación Inafecta (col20_operacionInafecta)
            isc: parseNum(row[20]), // ISC (col21_isc)
            icbper: parseNum(row[23]), // ICBPER (col24_icbper)
            otros_tributos: parseNum(row[24]), // Otros Tributos (col25_otrosTributos)
            total: parseNum(row[25]), // Importe Total (col26_importeTotal)
            tc: parseNum(row[27] || 1), // Tipo de Cambio (col28_tipoCambio)
            car: row[3] || '',
            estado_sire: 'Propuesta'
          };
        } else {
          // Compras (RCE)
          return {
            id,
            registro: 'SIRE',
            fecha: row[4] || '', // Fecha Emisión (col5_fecEmision)
            fecVcto: row[5] || '', // Fecha Vcto (col6_fecVence)
            tipo_doc: row[6] || '',
            serie: row[7] || '',
            numero: row[9] || '', // Documento Número (col10_numInicial)
            doc_tipo: row[11] || '', // Tipo Doc Proveedor (col12_tipoDoc)
            doc_num: row[12] || '', // Nro Doc Proveedor (col13_numDoc)
            nombre: row[13] || '', // Razón Social Proveedor (col14_razonSocialProveedor)
            bi: parseNum(row[14]), // Base Imponible (col15_baseImponibleGravada)
            igv: parseNum(row[15]), // IGV (col16_igvGravada)
            noGravada: parseNum(row[18]), // Base Imponible No Gravada (col19_baseImponibleNoGravada)
            isc: parseNum(row[21]), // ISC (col22_isc)
            icbper: parseNum(row[22]), // ICBPER (col23_icbper)
            otros_tributos: parseNum(row[23]), // Otros Tributos (col24_otrosTributos)
            total: parseNum(row[24]), // Importe Total (col25_importeTotal)
            tc: parseNum(row[26] || 1), // Tipo de Cambio (col27_tipoCambio)
            car: row[3] || '',
            estado_sire: 'Propuesta'
          };
        }
      });

      if (proceso === 'Generar RCE') {
        this.db.saveSirePurchases(ruc, mappedRecords, userId);
      } else {
        this.db.saveSireSales(ruc, mappedRecords, userId);
      }

      logger.info(`Persistidos ${mappedRecords.length} registros del SIRE para el RUC ${ruc}`);
    } catch (error) {
      logger.error('Error persistiendo registros SIRE', { error: error.message });
    }
  }

  /**
   * Genera el archivo ZIP para subir a SUNAT (Reemplazo/Ajuste)
   */
  async generarArchivoSireEnvio(args) {
    const { ruc, periodo, proceso, registros } = args;
    try {
      let result;
      if (proceso === 'RCE' || proceso === 'Generar RCE') {
        result = await this.generator.generarArchivoRCE(registros, ruc, periodo);
      } else {
        result = await this.generator.generarArchivoRVIE(registros, ruc, periodo);
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene las credenciales de una empresa desde el clientStorage
   * @param {string} ruc - RUC de la empresa
   * @returns {Promise<Object>} Credenciales
   */
  async obtenerCredenciales(ruc) {
    try {
      // In SOFTCONTABLE, we prefer to pass credentials from the renderer
      // but we could also fetch them from the database if needed.
      // This is a fallback in case they are not passed.
      return {
        success: false,
        error: `Faltan credenciales para el RUC ${ruc}. Asegúrate de configurar Client ID y Secret.`
      };
    } catch (error) {
      logger.error('Error al obtener credenciales', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crea un script VBS para ejecutar la macro de Excel
   * @param {Object} datos - Datos para la macro
   * @returns {string} Script VBS
   */
  crearScriptVBS(datos) {
    const { ruc, proceso, periodoInicio, periodoFin, rangoActivo } = datos;

    return `
Option Explicit

Dim objExcel, objWorkbook
Dim excelPath

excelPath = "${this.excelSirePath.replace(/\\/g, '\\\\')}"

' Crear instancia de Excel
Set objExcel = CreateObject("Excel.Application")
objExcel.Visible = True
objExcel.DisplayAlerts = False

' Abrir el archivo
Set objWorkbook = objExcel.Workbooks.Open(excelPath)

' Esperar a que se cargue
WScript.Sleep 2000

' Establecer valores en el formulario
On Error Resume Next

' Aquí puedes agregar código para interactuar con el UserForm
' Por ejemplo, establecer valores en celdas específicas
objWorkbook.Sheets("CONFIG").Range("A1").Value = "${ruc}"
objWorkbook.Sheets("CONFIG").Range("A2").Value = "${proceso}"
objWorkbook.Sheets("CONFIG").Range("A3").Value = "${periodoInicio}"
objWorkbook.Sheets("CONFIG").Range("A4").Value = "${rangoActivo ? periodoFin : ''}"

' Ejecutar la macro principal
objExcel.Run "EjecutarDescargaSIRE"

' Esperar a que termine
WScript.Sleep 5000

' Cerrar
objWorkbook.Save
objWorkbook.Close
objExcel.Quit

' Limpiar
Set objWorkbook = Nothing
Set objExcel = Nothing

WScript.Echo "Proceso SIRE completado"
`;
  }

  /**
   * Verifica si el archivo Excel SIRE existe
   * @returns {boolean} True si existe
   */
  verificarExcelSire() {
    return fs.existsSync(this.excelSirePath);
  }
}

module.exports = new SireHandler();
