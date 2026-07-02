const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

class AjustesExcelCreator {
  /**
   * Crea un archivo AJUSTES.xlsm de ejemplo si no existe
   */
  async crearArchivoEjemplo() {
    try {
      const dataPath = path.join(process.cwd(), 'data');
      const ajustesPath = path.join(dataPath, 'AJUSTES.xlsm');

      // Verificar si ya existe
      try {
        await fs.access(ajustesPath);
        logger.info('Archivo AJUSTES.xlsm ya existe');
        return { success: true, message: 'Archivo ya existe' };
      } catch {
        // No existe, crear uno nuevo
      }

      // Crear carpeta data si no existe
      try {
        await fs.mkdir(dataPath, { recursive: true });
      } catch {
        // Carpeta ya existe
      }

      // Crear workbook
      const workbook = XLSX.utils.book_new();

      // Crear hoja INICIO
      const inicioData = [
        ['', '', '', 'RUC:', '', '', '', 'RAZÓN SOCIAL:'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '20123456789', '', '', '', 'EMPRESA DE EJEMPLO S.A.C.'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', 'AÑO:', '', '', '', ''],
        ['', '', '', '2024', '', '', '', ''],
        ['', '', '', 'MES:', '', '', '', ''],
        ['', '', '', '01', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', 'GESTION DE COMPRAS', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', 'RUC EMPRESA:', '20123456789', '', '', '', '']
      ];

      const inicioSheet = XLSX.utils.aoa_to_sheet(inicioData);
      XLSX.utils.book_append_sheet(workbook, inicioSheet, 'INICIO');

      // Crear hoja Datos
      const datosData = [
        ['CONFIGURACIÓN', 'VALOR'],
        ['RUC_EMPRESA', '20123456789'],
        ['RAZON_SOCIAL', 'EMPRESA DE EJEMPLO S.A.C.'],
        ['PERIODO_ACTUAL', '202401'],
        ['MODO_ACTUAL', 'COMPRAS']
      ];

      const datosSheet = XLSX.utils.aoa_to_sheet(datosData);
      XLSX.utils.book_append_sheet(workbook, datosSheet, 'Datos');

      // Crear hojas RCE (Compras)
      this.crearHojaRCE(workbook, 'RCE COMPLETA');
      this.crearHojaRCE(workbook, 'RCE NO DOMICILIADOS');
      this.crearHojaRCE(workbook, 'RCE COMPLETA TC');
      this.crearHojaRCE(workbook, 'RCE REEMPLAZA');
      this.crearHojaRCE(workbook, 'RCE AJUSTES POST 1');
      this.crearHojaRCE(workbook, 'RCE AJUSTES POST 2');
      this.crearHojaRCE(workbook, 'RCE AJUSTES POST DIST 1');
      this.crearHojaRCE(workbook, 'RCE AJUSTES POST DIST 2');

      // Crear hojas RVIE (Ventas)
      this.crearHojaRVIE(workbook, 'RVIE COMPLEMENTA');
      this.crearHojaRVIE(workbook, 'RVIE REEMPLAZA');
      this.crearHojaRVIE(workbook, 'RVIE AJUSTES POST 1');
      this.crearHojaRVIE(workbook, 'RVIE AJUSTES POST 2');

      // Guardar archivo
      XLSX.writeFile(workbook, ajustesPath);

      logger.info('Archivo AJUSTES.xlsm creado exitosamente');
      return { success: true, message: 'Archivo AJUSTES.xlsm creado exitosamente' };

    } catch (error) {
      logger.error('Error al crear archivo AJUSTES.xlsm', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Crea una hoja RCE con estructura básica
   */
  crearHojaRCE(workbook, nombreHoja) {
    const data = [
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', 'RUC:', '20123456789', ''],
      ['', '', 'RAZÓN SOCIAL:', 'EMPRESA DE EJEMPLO S.A.C.', ''],
      ['', '', 'PERIODO:', '202401', ''],
      ['', '', 'CÓDIGO:', '001', 'TIPO:', 'RCE'],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      // Fila 18 - Encabezados de datos
      ['', 'ITEM', 'RUC_EMPRESA', 'RAZON_SOCIAL', 'PERIODO', 'FECHA_EMISION', 'TIPO_DOC', 'SERIE', 'NUMERO', 'TIPO_DOC_PROVEEDOR', 'RUC_PROVEEDOR', 'RAZON_SOCIAL_PROVEEDOR', 'BASE_IMPONIBLE', 'IGV', 'TOTAL'],
      // Datos de ejemplo
      ['', '1', '20123456789', 'EMPRESA DE EJEMPLO S.A.C.', '202401', '01/01/2024', '01', 'F001', '00000001', '6', '20456789123', 'PROVEEDOR EJEMPLO S.A.C.', '100.00', '18.00', '118.00']
    ];

    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, nombreHoja);
  }

  /**
   * Crea una hoja RVIE con estructura básica
   */
  crearHojaRVIE(workbook, nombreHoja) {
    const data = [
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', 'RUC:', '20123456789', ''],
      ['', '', 'RAZÓN SOCIAL:', 'EMPRESA DE EJEMPLO S.A.C.', ''],
      ['', '', 'PERIODO:', '202401', ''],
      ['', '', 'CÓDIGO:', '001', 'TIPO:', 'RVIE'],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      // Fila 18 - Encabezados de datos
      ['', 'ITEM', 'RUC_EMPRESA', 'RAZON_SOCIAL', 'PERIODO', 'FECHA_EMISION', 'TIPO_DOC', 'SERIE', 'NUMERO', 'TIPO_DOC_CLIENTE', 'RUC_CLIENTE', 'RAZON_SOCIAL_CLIENTE', 'BASE_IMPONIBLE', 'IGV', 'TOTAL'],
      // Datos de ejemplo
      ['', '1', '20123456789', 'EMPRESA DE EJEMPLO S.A.C.', '202401', '01/01/2024', '01', 'F001', '00000001', '6', '20789123456', 'CLIENTE EJEMPLO S.A.C.', '100.00', '18.00', '118.00']
    ];

    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, nombreHoja);
  }
}

module.exports = new AjustesExcelCreator();