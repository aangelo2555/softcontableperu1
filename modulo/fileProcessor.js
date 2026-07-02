const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { parse } = require('csv-parse/sync');
const logger = require('./logger');

/**
 * Procesador de archivos ZIP descargados de SUNAT
 */
class FileProcessor {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  /**
   * Asegura que exista el directorio temporal
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Procesa un archivo ZIP descargado
   */
  async procesarZip(zipBuffer, filename) {
    try {
      logger.info('Procesando archivo ZIP', {
        filename,
        bufferSize: zipBuffer ? zipBuffer.length : 0
      });

      // Validar que el buffer no esté vacío
      if (!zipBuffer || zipBuffer.length === 0) {
        throw new Error('El buffer del archivo ZIP está vacío');
      }

      // Asegurar que existe el directorio temporal
      this.ensureTempDir();

      // Guardar ZIP temporalmente
      const zipPath = path.join(this.tempDir, 'temp.zip');

      logger.info('Guardando archivo ZIP', { zipPath });
      fs.writeFileSync(zipPath, zipBuffer);

      // Verificar que el archivo se guardó correctamente
      if (!fs.existsSync(zipPath)) {
        throw new Error('No se pudo guardar el archivo ZIP');
      }

      const stats = fs.statSync(zipPath);
      logger.info('Archivo ZIP guardado', {
        tamaño: stats.size,
        ruta: zipPath
      });

      // Descomprimir
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();

      if (zipEntries.length === 0) {
        throw new Error('El archivo ZIP está vacío');
      }

      // Obtener el primer archivo (debería ser el TXT)
      const entry = zipEntries[0];
      const txtContent = entry.getData().toString('utf8');

      logger.info('Archivo descomprimido', {
        nombre: entry.entryName,
        tamaño: txtContent.length
      });

      // Limpiar archivo temporal
      fs.unlinkSync(zipPath);

      // Procesar contenido
      const datos = await this.procesarTxt(txtContent);

      return {
        success: true,
        datos: datos,
        nombreArchivo: entry.entryName
      };

    } catch (error) {
      logger.error('Error al procesar ZIP', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Procesa el contenido de un archivo TXT/CSV
   */
  async procesarTxt(content) {
    try {
      // Limpiar contenido: eliminar comas y punto y comas dentro de campos
      let cleanContent = content;

      // Reemplazar comas y punto y comas que no son delimitadores
      // (esto es una simplificación, el código VBA usa PowerShell para esto)
      cleanContent = cleanContent.replace(/,(?![^|]*\|)/g, '');
      cleanContent = cleanContent.replace(/;(?![^|]*\|)/g, '');

      // Parsear CSV con delimitador |
      const records = parse(cleanContent, {
        delimiter: '|',
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true
      });

      logger.info('Archivo procesado', {
        registros: records.length - 1 // -1 por el header
      });

      // Separar header y datos
      const headers = records[0];
      const data = records.slice(1);

      return {
        headers: headers,
        data: data,
        totalRegistros: data.length
      };

    } catch (error) {
      logger.error('Error al procesar TXT', { error: error.message });
      throw error;
    }
  }

  /**
   * Valida límites de registros según el proceso
   */
  validarLimites(totalRegistros, proceso, plan = 'basico') {
    const planLower = plan.toLowerCase();

    // Si es plan Premium o Empresarial, no hay límites
    if (['premium', 'empresarial'].includes(planLower)) {
      return { valido: true };
    }

    // Definir límites según el plan
    let limite = 50; // Límite por defecto (Básico)

    if (planLower === 'vip') {
      limite = 150;
    }
    // Si es básico se queda en 50

    // Si el total excede el límite
    if (totalRegistros > limite) {
      return {
        valido: false,
        mensaje: `El archivo tiene ${totalRegistros} registros. Su plan ${plan.toUpperCase()} tiene un límite de ${limite} registros. Actualice su plan para aumentar el límite.`
      };
    }

    return { valido: true };
  }

  /**
   * Limpia archivos temporales
   */
  limpiarTemp() {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.tempDir, file));
        });
        fs.rmdirSync(this.tempDir);
        logger.info('Archivos temporales eliminados');
      }
    } catch (error) {
      logger.warn('Error al limpiar temporales', { error: error.message });
    }
  }
}

module.exports = FileProcessor;
