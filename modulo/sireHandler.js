const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';
const db = USE_POSTGRES ? require('../server/databasePostgres') : require('../server/databaseServer');
const SireOrchestrator = require('./sireOrchestrator');
const SireFileGenerator = require('./sireFileGenerator');
const excelReader = require('./excelReader');
const { sireDir } = require('../server/storageConfig');

class SireHandler {
  constructor() {
    this.excelSirePath = path.join(process.cwd(), 'data/API_SIRE.xlsm');
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
          await this.persistirRegistrosSire(ruc, proceso, resultado.datosRaw, datos.userId, periodoInicio);
        }
        
        // Persistir archivo ZIP original en PostgreSQL sire_files
        if (resultado.zipBuffer && resultado.zipFilename && this.db.saveSireFile) {
          try {
            await this.db.saveSireFile(ruc, datos.userId, {
              nombre: resultado.zipFilename,
              periodo: String(periodoInicio),
              proceso: proceso,
              size: resultado.zipBuffer.length,
              content_base64: Buffer.isBuffer(resultado.zipBuffer) ? resultado.zipBuffer.toString('base64') : Buffer.from(resultado.zipBuffer).toString('base64')
            });
            logger.info(`Archivo ZIP ${resultado.zipFilename} persistido en PostgreSQL sire_files`);
          } catch (e) {
            logger.warn('Error guardando archivo ZIP en PostgreSQL:', e);
          }
        }

        // Persistir archivo Excel en PostgreSQL sire_files
        if (resultado.excelPath && fs.existsSync(resultado.excelPath) && this.db.saveSireFile) {
          try {
            const excelBuffer = fs.readFileSync(resultado.excelPath);
            const fileName = path.basename(resultado.excelPath);
            await this.db.saveSireFile(ruc, datos.userId, {
              nombre: fileName,
              periodo: String(periodoInicio),
              proceso: proceso,
              size: excelBuffer.length,
              content_base64: excelBuffer.toString('base64')
            });
            logger.info(`Archivo ${fileName} persistido en PostgreSQL sire_files`);
          } catch (e) {
            logger.warn('Error guardando archivo Excel en PostgreSQL:', e);
          }
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
  async persistirRegistrosSire(ruc, proceso, datosRaw, userId, periodo) {
    try {
      const { headers, data } = datosRaw;
      const strPeriodo = String(periodo || '');
      const normalizedPeriod = strPeriodo.includes('-')
        ? strPeriodo
        : (strPeriodo.length === 6 ? `${strPeriodo.slice(0, 4)}-${strPeriodo.slice(4)}` : strPeriodo);

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
        const tipoDoc = row[6] || '';
        const serie = row[7] || '';
        const numero = isRVIE ? (row[8] || '') : (row[9] || '');
        const docNum = isRVIE ? (row[11] || '') : (row[12] || '');
        const carVal = (row[3] || '').trim();
        const docKey = carVal || `${tipoDoc}_${serie}_${numero}_${docNum}` || `ROW_${index}`;
        const id = `${ruc}-${proceso}-${docKey}`;

        if (isRVIE) {
          // Ventas (RVIE)
          return {
            id,
            periodo_sire: normalizedPeriod,
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
            periodo_sire: normalizedPeriod,
            registro: 'SIRE',
            fecha: row[4] || '', // Fecha Emisión (col5_fecEmision)
            fecVcto: row[5] || '', // Fecha Vcto (col6_fecVence)
            tipo_doc: row[6] || '',
            serie: row[7] || '',
            numero: row[9] || '', // Documento Número (col10_numInicial)
            doc_tipo: row[11] || '', // Tipo Doc Proveedor (col12_tipoDoc)
            doc_num: row[12] || '', // Nro Doc Proveedor (col13_numDoc)
            nombre: row[13] || '', // Razón Social Proveedor (col14_razonSocialProveedor)
            // La base imponible de compras puede estar en col15 (gravado DG), col17 (gravado DGNG) o col19 (gravado DNG)
            bi: parseNum(row[14]) + parseNum(row[16]) + parseNum(row[18]),
            // El IGV puede estar en col16 (IGV DG), col18 (IGV DGNG) o col20 (IGV DNG)
            igv: parseNum(row[15]) + parseNum(row[17]) + parseNum(row[19]),
            // El valor de las adquisiciones no gravadas está en col21 (Valor Adq. NG)
            noGravada: parseNum(row[20]), 
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
        await this.db.saveSirePurchases(ruc, mappedRecords, userId);
      } else {
        await this.db.saveSireSales(ruc, mappedRecords, userId);
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

  /**
   * Carga un archivo previamente guardado en el historial (XLSX o ZIP) directamente a la base de datos de Conciliación
   */
  async cargarArchivoEnConciliacion(ruc, nombreArchivo, userId) {
    try {
      let buffer = null;
      // 1. Obtener contenido Base64 de la base de datos PostgreSQL si existe
      if (this.db && this.db.getSireFileContent) {
        const dbFile = await this.db.getSireFileContent(nombreArchivo, ruc, userId);
        if (dbFile && dbFile.content_base64) {
          buffer = Buffer.from(dbFile.content_base64, 'base64');
        }
      }

      // 2. Fallback a disco local si no está en DB
      if (!buffer) {
        const outputDir = sireDir;
        const findFile = (dir, target) => {
          if (!fs.existsSync(dir)) return null;
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              const found = findFile(fullPath, target);
              if (found) return found;
            } else if (file === target) {
              return fullPath;
            }
          }
          return null;
        };
        const filePath = findFile(outputDir, nombreArchivo);
        if (filePath && fs.existsSync(filePath)) {
          buffer = fs.readFileSync(filePath);
        }
      }

      if (!buffer) {
        throw new Error(`No se encontró el contenido del archivo ${nombreArchivo}`);
      }

      // Determinar proceso (RCE vs RVIE) y período desde el nombre del archivo
      const isRVIE = nombreArchivo.includes('RVIE');
      const proceso = isRVIE ? 'Generar RVIE' : 'Generar RCE';
      const periodMatch = nombreArchivo.match(/(20\d{4})/);
      const periodoRaw = periodMatch ? periodMatch[1] : '';

      let dataRows = [];

      if (nombreArchivo.toLowerCase().endsWith('.zip')) {
        const FileProcessor = require('./fileProcessor');
        const fp = new FileProcessor();
        const zipRes = await fp.procesarZip(buffer, nombreArchivo);
        if (zipRes && zipRes.datos && zipRes.datos.data) {
          dataRows = zipRes.datos.data;
        }
      } else {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Omitir fila de encabezados si existe
        dataRows = (rows.length > 0 && typeof rows[0][0] === 'string' && isNaN(Number(rows[0][0]))) 
          ? rows.slice(1) 
          : rows;
      }

      const datosRaw = { headers: [], data: dataRows };
      await this.persistirRegistrosSire(ruc, proceso, datosRaw, userId, periodoRaw);

      return { success: true, count: dataRows.length, proceso, periodo: periodoRaw };
    } catch (error) {
      logger.error('Error cargando archivo en conciliación:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new SireHandler();
