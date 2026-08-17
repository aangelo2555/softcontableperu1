const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * Handler para cargar y leer archivos Excel de CPE desde carpeta output
 */
class CPEExcelHandler {
    constructor() {
        this.outputPath = path.join(process.cwd(), 'output');
    }

    /**
     * Cargar Excel automáticamente cuando se selecciona un cliente
     * Busca archivos en output/ que contengan el RUC del cliente
     * @param {Object} params - { ruc, empresa }
     * @returns {Object} { success, excelPath, sheets, message }
     */
    async cargarExcelCliente(params) {
        try {
            const { ruc, empresa } = params;
            logger.info(`Buscando archivos Excel para cliente: ${empresa} (${ruc})`);

            // Verificar que exista la carpeta output
            if (!fs.existsSync(this.outputPath)) {
                return {
                    success: false,
                    error: 'No se encontró la carpeta output/'
                };
            }

            // Estrategia de búsqueda: Preferir carpeta del RUC, sino buscar en raíz
            let targetDir = this.outputPath;
            const rucDir = path.join(this.outputPath, ruc);

            if (fs.existsSync(rucDir)) {
                targetDir = rucDir;
                logger.info(`Buscando archivos en carpeta de cliente: ${targetDir}`);
            } else {
                logger.info(`Carpeta de cliente no existe, buscando en raíz output/`);
            }

            // Leer archivos del directorio objetivo
            const todosLosArchivos = fs.readdirSync(targetDir);

            // Filtrar archivos .xlsx que contengan el RUC
            // IMPORTANTE: Excluir archivos temporales (~$)
            const archivosDelCliente = todosLosArchivos.filter(archivo => {
                return archivo.endsWith('.xlsx') &&
                    archivo.includes(ruc) &&
                    !archivo.startsWith('~$');  // Filtrar archivos temporales
            });

            if (archivosDelCliente.length === 0) {
                logger.warn(`No se encontraron archivos Excel para RUC: ${ruc}`);
                return {
                    success: false,
                    error: `No se encontraron archivos Excel en output/ para el RUC ${ruc}`
                };
            }

            // Crear lista con información de cada archivo
            const archivosConInfo = archivosDelCliente.map(archivo => {
                const rutaCompleta = path.join(targetDir, archivo);
                const stats = fs.statSync(rutaCompleta);
                return {
                    nombre: archivo,
                    ruta: rutaCompleta,
                    fecha: stats.mtime,
                    size: stats.size
                };
            });

            // Ordenar por fecha de modificación (más reciente primero)
            archivosConInfo.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

            logger.info(`Encontrados ${archivosConInfo.length} archivos para el cliente`);

            return {
                success: true,
                archivos: archivosConInfo,
                totalArchivos: archivosConInfo.length,
                message: `Encontrados ${archivosConInfo.length} archivo(s) Excel`
            };

        } catch (error) {
            logger.error('Error al cargar Excel de cliente:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Abrir un archivo Excel específico
     * @param {Object} params - { excelPath }
     * @returns {Object} { success, sheets, excelPath, message }
     */
    async abrirArchivoExcel(params) {
        try {
            const { excelPath } = params;
            logger.info(`Abriendo archivo Excel: ${excelPath}`);

            if (!fs.existsSync(excelPath)) {
                return {
                    success: false,
                    error: 'El archivo no existe'
                };
            }

            // Leer el archivo Excel
            const workbook = XLSX.readFile(excelPath);
            const sheets = workbook.SheetNames;

            logger.info(`Hojas encontradas: ${sheets.join(', ')}`);

            return {
                success: true,
                excelPath: excelPath,
                sheets: sheets,
                message: `Excel abierto con ${sheets.length} hoja(s)`
            };

        } catch (error) {
            logger.error('Error al abrir archivo Excel:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Leer datos de una hoja específica del Excel
     * Extrae columnas H (SERIE), J (NUMERO), M (RUC)
     * @param {Object} params - { excelPath, sheetName }
     * @returns {Object} { success, headers, rows }
     */
    async leerHojaExcel(params) {
        try {
            const { excelPath, sheetName } = params;
            logger.info(`Leyendo hoja: ${sheetName} de ${excelPath}`);

            if (!fs.existsSync(excelPath)) {
                return {
                    success: false,
                    error: 'El archivo Excel no existe'
                };
            }

            const workbook = XLSX.readFile(excelPath);

            if (!workbook.SheetNames.includes(sheetName)) {
                return {
                    success: false,
                    error: `La hoja "${sheetName}" no existe en el archivo`
                };
            }

            const worksheet = workbook.Sheets[sheetName];

            // Convertir hoja a JSON con header row
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,  // Array de arrays
                defval: '', // Valor por defecto para celdas vacías
                raw: false  // Convertir todo a string
            });

            if (jsonData.length === 0) {
                return {
                    success: false,
                    error: 'La hoja está vacía'
                };
            }

            // Primera fila como headers
            const headers = jsonData[0];

            // Resto como datos (filtrar filas vacías)
            const rows = jsonData.slice(1).filter(row => {
                // Filtrar filas completamente vacías
                return row.some(cell => cell && String(cell).trim() !== '');
            });

            logger.info(`Hoja leída: ${rows.length} filas con datos`);

            return {
                success: true,
                headers: headers,
                rows: rows,
                totalRows: rows.length
            };

        } catch (error) {
            logger.error('Error al leer hoja Excel:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extraer datos específicos de una fila
     * Columnas: H=SERIE (índice 7), J=NUMERO (índice 9), M=RUC (índice 12)
     * @param {Array} row - Fila del Excel
     * @returns {Object} { ruc, serie, numero }
     */
    extraerDatosFila(row) {
        return {
            serie: row[7] || '',   // Columna H
            numero: row[9] || '',  // Columna J
            ruc: row[12] || ''     // Columna M
        };
    }
}

// Singleton
const cpeExcelHandler = new CPEExcelHandler();

module.exports = cpeExcelHandler;
