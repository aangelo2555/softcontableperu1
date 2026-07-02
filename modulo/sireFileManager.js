const fs = require('fs');
const path = require('path');
let app;
try {
    if (!process.env.RAILWAY_ENVIRONMENT) {
        const lib = 'electron';
        app = require(lib).app;
    }
} catch (e) {}
const logger = require('./logger');

/**
 * Gestor de archivos SIRE descargados
 */
class SireFileManager {
  constructor() {
    // Usar ruta basada en el directorio de la aplicación
    // Esto funciona tanto en desarrollo como en producción
    const appPath = (app && typeof app.getAppPath === 'function') ? app.getAppPath() : process.cwd();

    // En desarrollo: appPath = /ruta/al/proyecto
    // En producción: appPath = /ruta/al/app.asar o similar
    // Necesitamos ir al directorio raíz del proyecto
    const projectRoot = appPath.includes('app.asar')
      ? path.join(appPath, '..', '..')  // Producción
      : appPath;                          // Desarrollo

    this.outputDir = path.join(projectRoot, 'output');

    // Crear directorio si no existe
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info('Directorio output creado', { path: this.outputDir });
    }

    logger.info('SireFileManager inicializado', {
      appPath,
      projectRoot,
      outputDir: this.outputDir,
      exists: fs.existsSync(this.outputDir)
    });
  }

  /**
   * Obtiene la lista de archivos SIRE descargados
   */
  async listarArchivos() {
    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        return { success: true, archivos: [] };
      }

      // Función para recorrer directorios recursivamente
      const getAllFiles = (dirPath, arrayOfFiles) => {
        const files = fs.readdirSync(dirPath);

        arrayOfFiles = arrayOfFiles || [];

        files.forEach((file) => {
          const fullPath = path.join(dirPath, file);
          if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          } else {
            // Solo procesar archivos Excel relevantes
            if (file.endsWith('.xlsx') && (file.includes('RCE_') || file.includes('RVIE_'))) {
              arrayOfFiles.push(fullPath);
            }
          }
        });

        return arrayOfFiles;
      };

      const allFiles = getAllFiles(this.outputDir, []);

      const archivos = allFiles.map(filePath => {
        const stats = fs.statSync(filePath);
        const file = path.basename(filePath);

        // Obtener nombre relativo (para abrir/eliminar)
        // Ejemplo: "20606080134\RCE_...xlsx"
        const relativePath = path.relative(this.outputDir, filePath);

        // Extraer información del nombre del archivo
        // Formato: RCE_20123456789_202401_timestamp.xlsx
        const parts = file.replace('.xlsx', '').split('_');
        const tipo = parts[0]; // RCE o RVIE
        const ruc = parts[1];
        const periodo = parts[2];

        return {
          nombre: relativePath, // Usar ruta relativa como nombre identificador
          nombreDisplay: file, // Nombre solo del archivo para mostrar
          ruta: filePath,
          tipo: tipo,
          ruc: ruc,
          periodo: periodo,
          fechaCreacion: stats.birthtime,
          tamano: stats.size,
          tamanoFormateado: this.formatearTamano(stats.size)
        };
      })
        .sort((a, b) => b.fechaCreacion - a.fechaCreacion); // Más recientes primero

      logger.info('Archivos SIRE listados', { cantidad: archivos.length });

      return {
        success: true,
        archivos: archivos
      };

    } catch (error) {
      logger.error('Error al listar archivos SIRE', { error: error.message });
      return {
        success: false,
        error: error.message,
        archivos: []
      };
    }
  }

  /**
   * Abre un archivo SIRE específico
   */
  async abrirArchivo(nombreArchivo) {
    try {
      const filePath = path.join(this.outputDir, nombreArchivo);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      const { exec } = require('child_process');
      const comando = process.platform === 'win32'
        ? `start "" "${filePath}"`
        : process.platform === 'darwin'
          ? `open "${filePath}"`
          : `xdg-open "${filePath}"`;

      exec(comando, (error) => {
        if (error) {
          logger.error('Error al abrir archivo', { error: error.message });
        }
      });

      logger.info('Archivo SIRE abierto', { archivo: nombreArchivo });

      return { success: true, message: 'Archivo abierto' };

    } catch (error) {
      logger.error('Error al abrir archivo SIRE', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Elimina un archivo SIRE
   */
  async eliminarArchivo(nombreArchivo) {
    try {
      const filePath = path.join(this.outputDir, nombreArchivo);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      fs.unlinkSync(filePath);
      logger.info('Archivo SIRE eliminado', { archivo: nombreArchivo });

      return { success: true, message: 'Archivo eliminado' };

    } catch (error) {
      logger.error('Error al eliminar archivo SIRE', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Formatea el tamaño del archivo
   */
  formatearTamano(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new SireFileManager();
