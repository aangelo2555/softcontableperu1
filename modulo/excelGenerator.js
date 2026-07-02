const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const { sireDir } = require('../server/storageConfig');

/**
 * Generador de archivos Excel para SIRE
 */
class ExcelGenerator {
  constructor() {
    this.outputDir = sireDir;
    this.ensureOutputDir();
  }

  /**
   * Asegura que exista el directorio de salida
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Genera archivo Excel para Registro de Compras
   */
  async generarRegistroCompras(datos, ruc, periodo) {
    try {
      logger.info('Generando Excel de Registro de Compras', { ruc, periodo });

      // Crear workbook
      const wb = XLSX.utils.book_new();

      // Crear hoja con datos
      const ws = this.crearHojaCompras(datos);

      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'REGISTRO_COMPRAS');

      // Generar nombre de archivo
      const filename = `RCE_${ruc}_${periodo}_${Date.now()}.xlsx`;

      // Crear carpeta del cliente
      const clientDir = path.join(this.outputDir, ruc);
      if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true });
      }

      const filepath = path.join(clientDir, filename);

      // Guardar archivo
      XLSX.writeFile(wb, filepath);

      logger.info('Excel generado exitosamente', { filepath });

      return {
        success: true,
        filepath: filepath,
        filename: filename
      };

    } catch (error) {
      logger.error('Error al generar Excel de compras', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera archivo Excel para Registro de Ventas
   */
  async generarRegistroVentas(datos, ruc, periodo) {
    try {
      logger.info('Generando Excel de Registro de Ventas', { ruc, periodo });

      // Crear workbook
      const wb = XLSX.utils.book_new();

      // Crear hoja con datos
      const ws = this.crearHojaVentas(datos);

      // Agregar hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'REGISTRO_VENTAS');

      // Generar nombre de archivo
      const filename = `RVIE_${ruc}_${periodo}_${Date.now()}.xlsx`;

      // Crear carpeta del cliente
      const clientDir = path.join(this.outputDir, ruc);
      if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true });
      }

      const filepath = path.join(clientDir, filename);

      // Guardar archivo
      XLSX.writeFile(wb, filepath);

      logger.info('Excel generado exitosamente', { filepath });

      return {
        success: true,
        filepath: filepath,
        filename: filename
      };

    } catch (error) {
      logger.error('Error al generar Excel de ventas', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crea hoja de Excel para compras
   */
  crearHojaCompras(datos) {
    const { headers, data } = datos;

    // Crear array para la hoja
    const wsData = [];

    // Agregar título
    wsData.push(['REGISTRO DE COMPRAS ELECTRÓNICO']);
    wsData.push([]); // Fila vacía

    // Agregar información
    wsData.push(['Período:', datos.periodo || '']);
    wsData.push(['RUC:', datos.ruc || '']);
    wsData.push(['Empresa:', datos.empresa || '']);
    wsData.push([]); // Fila vacía

    // Agregar headers
    wsData.push(headers);

    // Agregar datos
    data.forEach(row => {
      wsData.push(row);
    });

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Aplicar estilos básicos (ancho de columnas)
    const colWidths = headers.map(() => ({ wch: 15 }));
    ws['!cols'] = colWidths;

    return ws;
  }

  /**
   * Crea hoja de Excel para ventas
   */
  crearHojaVentas(datos) {
    const { headers, data } = datos;

    // Crear array para la hoja
    const wsData = [];

    // Agregar título
    wsData.push(['REGISTRO DE VENTAS E INGRESOS ELECTRÓNICO']);
    wsData.push([]); // Fila vacía

    // Agregar información
    wsData.push(['Período:', datos.periodo || '']);
    wsData.push(['RUC:', datos.ruc || '']);
    wsData.push(['Empresa:', datos.empresa || '']);
    wsData.push([]); // Fila vacía

    // Agregar headers
    wsData.push(headers);

    // Agregar datos
    data.forEach(row => {
      wsData.push(row);
    });

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Aplicar estilos básicos (ancho de columnas)
    const colWidths = headers.map(() => ({ wch: 15 }));
    ws['!cols'] = colWidths;

    return ws;
  }

  /**
   * Agrega datos a un Excel existente (para múltiples períodos)
   */
  async agregarDatosExistente(filepath, nuevosDatos) {
    try {
      logger.info('Agregando datos a Excel existente', { filepath });

      // Leer archivo existente
      const wb = XLSX.readFile(filepath);
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // Convertir a array
      const existingData = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Agregar nuevos datos (sin headers)
      nuevosDatos.data.forEach(row => {
        existingData.push(row);
      });

      // Crear nueva hoja
      const newWs = XLSX.utils.aoa_to_sheet(existingData);

      // Reemplazar hoja
      wb.Sheets[sheetName] = newWs;

      // Guardar
      XLSX.writeFile(wb, filepath);

      logger.info('Datos agregados exitosamente');

      return {
        success: true,
        filepath: filepath
      };

    } catch (error) {
      logger.error('Error al agregar datos', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Abre el archivo Excel generado
   */
  async abrirExcel(filepath) {
    try {
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        return new Promise((resolve, reject) => {
          exec(`start "" "${filepath}"`, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve({ success: true });
            }
          });
        });
      } else {
        // En modo servidor (Linux/Railway), no podemos abrir el Excel nativamente.
        // El usuario deberá descargarlo desde la interfaz web.
        logger.info('Apertura nativa de Excel omitida en plataforma no-Windows.', { filepath });
        return { success: true, message: 'Archivo generado en el servidor. Descárguelo desde la web.' };
      }
    } catch (error) {
      logger.error('Error al abrir Excel', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ExcelGenerator;
