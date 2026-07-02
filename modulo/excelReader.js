const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class ExcelReader {
  constructor() {
    // Columnas requeridas para login básico
    this.requiredColumnsBasic = ['N°', 'Empresa', 'RUC', 'Usuario', 'Clave'];
    // Columnas requeridas para SIRE (formato alternativo)
    this.requiredColumnsSire = ['RUC', 'RAZON SOCIAL', 'USUARIO_SOL', 'CLAVE_SOL', 'CLIENTE_ID', 'CLIENTE_SECRET'];
    this.optionalColumns = ['USUARIO_SOL', 'CLAVE_SOL', 'CLIENTE_ID', 'CLIENTE_SECRET'];
  }

  /**
   * Lee y valida el archivo CLIENTES.xlsx
   * @param {string} filePath - Ruta al archivo Excel
   * @returns {Promise<Array>} Array de objetos cliente
   */
  async readClients(filePath = 'data/CLIENTES.xlsx') {
    try {
      // Resolver la ruta para producción/desarrollo
      const resolvedPath = filePath.startsWith('data/') ? path.join(process.cwd(), filePath) : filePath;

      // Verificar que el archivo existe
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }

      logger.info('Leyendo archivo Excel', { filePath: resolvedPath });

      // Leer el archivo Excel
      const workbook = XLSX.readFile(resolvedPath);

      // Verificar que existe la hoja CLIENTES
      if (!workbook.Sheets['CLIENTES']) {
        throw new Error('No se encontró la hoja "CLIENTES" en el archivo Excel');
      }

      const worksheet = workbook.Sheets['CLIENTES'];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error('El archivo Excel debe tener al menos una fila de encabezados y una fila de datos');
      }

      // Detectar el formato del archivo según el nombre
      const isApiSireFile = filePath.includes('API_SIRE');

      // Determinar la fila de encabezados según el archivo
      let headerRowIndex = 0;
      let dataStartIndex = 1;

      if (isApiSireFile) {
        // API_SIRE.xlsm: encabezados en fila 6, datos desde fila 7
        headerRowIndex = 5;
        dataStartIndex = 6;

        if (jsonData.length < 7) {
          throw new Error('El archivo API_SIRE.xlsm debe tener datos en la fila 7 o posterior');
        }
      } else {
        // CLIENTES.xlsx: encabezados en fila 1, datos desde fila 2
        headerRowIndex = 0;
        dataStartIndex = 1;
      }

      const headers = jsonData[headerRowIndex];

      // Detectar si es formato básico o formato SIRE
      const hasBasicFormat = this.requiredColumnsBasic.every(col => headers.includes(col));
      const hasSireFormat = this.requiredColumnsSire.every(col => headers.includes(col));

      if (!hasBasicFormat && !hasSireFormat) {
        throw new Error(
          'El archivo debe tener uno de estos formatos:\n' +
          `Formato 1: ${this.requiredColumnsBasic.join(', ')}\n` +
          `Formato 2: ${this.requiredColumnsSire.join(', ')}`
        );
      }

      const isSireFormat = hasSireFormat;

      // Procesar datos
      const clients = [];
      const seenRucs = new Set();

      for (let i = dataStartIndex; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Saltar filas vacías
        if (!row || row.every(cell => !cell)) continue;

        const client = this.parseClientRow(row, headers, i + 1, isSireFormat);

        // Validar RUC único
        if (seenRucs.has(client.ruc)) {
          logger.warn(`RUC duplicado encontrado: ${client.ruc} en fila ${i + 1}`);
          continue;
        }

        seenRucs.add(client.ruc);
        clients.push(client);
      }

      logger.info(`Se cargaron ${clients.length} clientes válidos`);
      return clients;

    } catch (error) {
      logger.error('Error al leer archivo Excel', { error: error.message, filePath });
      throw error;
    }
  }

  /**
   * Parsea una fila del Excel y crea un objeto cliente
   * @param {Array} row - Fila de datos
   * @param {Array} headers - Encabezados
   * @param {number} rowNumber - Número de fila
   * @param {boolean} isSireFormat - Si es formato SIRE
   * @returns {Object} Objeto cliente
   */
  parseClientRow(row, headers, rowNumber, isSireFormat = false) {
    const client = { row: rowNumber };

    headers.forEach((header, index) => {
      const value = row[index];

      switch (header) {
        case 'N°':
          client.numero = value;
          break;
        case 'Empresa':
        case 'RAZON SOCIAL':
          client.empresa = value?.toString().trim();
          if (!client.empresa && !isSireFormat) {
            throw new Error(`Empresa vacía en fila ${rowNumber}`);
          }
          break;
        case 'RUC':
          client.ruc = this.validateRuc(value, rowNumber);
          break;
        case 'Usuario':
          client.usuario = value?.toString().trim();
          if (!client.usuario && !isSireFormat) {
            throw new Error(`Usuario vacío en fila ${rowNumber}`);
          }
          break;
        case 'Clave':
          client.clave = value?.toString().trim();
          if (!client.clave && !isSireFormat) {
            throw new Error(`Clave vacía en fila ${rowNumber}`);
          }
          break;
        // Columnas para SIRE
        case 'USUARIO_SOL':
          client.usuario_sol = value?.toString().trim() || '';
          // Si es formato SIRE y no tiene usuario básico, usar USUARIO_SOL
          if (isSireFormat && !client.usuario) {
            client.usuario = client.usuario_sol;
          }
          break;
        case 'CLAVE_SOL':
          client.clave_sol = value?.toString().trim() || '';
          // Si es formato SIRE y no tiene clave básica, usar CLAVE_SOL
          if (isSireFormat && !client.clave) {
            client.clave = client.clave_sol;
          }
          break;
        case 'CLIENTE_ID':
          client.clienteId = value?.toString().trim() || '';
          break;
        case 'CLIENTE_SECRET':
          client.clienteSecret = value?.toString().trim() || '';
          break;
        // Columna Email para notificaciones
        case 'Email':
        case 'EMAIL':
        case 'Correo':
          client.email = value?.toString().trim() || '';
          // Validar formato de email si existe
          if (client.email && !this.validateEmail(client.email)) {
            logger.warn(`Email inválido en fila ${rowNumber}: ${client.email}`);
            client.email = ''; // Limpiar email inválido
          }
          break;
        // Columna WhatsApp para notificaciones
        case 'WhatsApp':
        case 'WHATSAPP':
        case 'Whatsapp':
        case 'Telefono':
        case 'Teléfono':
          client.whatsapp = value?.toString().trim() || '';
          // Limpiar formato (remover espacios, guiones, paréntesis)
          if (client.whatsapp) {
            client.whatsapp = client.whatsapp.replace(/[\s\-\(\)\+]/g, '');
            // Validar que sea un número de 9 dígitos (Perú) o con código de país
            if (!/^\d{9,15}$/.test(client.whatsapp)) {
              logger.warn(`WhatsApp inválido en fila ${rowNumber}: ${client.whatsapp}`);
              client.whatsapp = ''; // Limpiar número inválido
            }
          }
          break;
      }
    });

    // Fallback: Extraer CLIENTE_ID de columna H (índice 7) y CLIENTE_SECRET de columna I (índice 8)
    // si no fueron encontrados mediante los encabezados
    // Log para debugging - mostrar contenido de columnas H e I
    logger.info(`Fila ${rowNumber}: Columna H (7)="${row[7]}", Columna I (8)="${row[8]}"`);

    if (!client.clienteId && row[7]) {
      const valueH = row[7]?.toString().trim();
      if (valueH && valueH.length > 0) {
        client.clienteId = valueH;
        logger.info(`✓ CLIENTE_ID extraído de columna H para fila ${rowNumber}: ${valueH}`);
      }
    }

    if (!client.clienteSecret && row[8]) {
      const valueI = row[8]?.toString().trim();
      if (valueI && valueI.length > 0) {
        client.clienteSecret = valueI;
        logger.info(`✓ CLIENTE_SECRET extraído de columna I para fila ${rowNumber}: ${valueI}`);
      }
    }

    return client;
  }

  /**
   * Valida formato de email
   * @param {string} email - Email a validar
   * @returns {boolean} true si es válido
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida formato de RUC
   * @param {string|number} ruc - RUC a validar
   * @param {number} rowNumber - Número de fila
   * @returns {string} RUC validado
   */
  validateRuc(ruc, rowNumber) {
    if (!ruc) {
      throw new Error(`RUC vacío en fila ${rowNumber}`);
    }

    // Convertir a string y limpiar
    const rucStr = ruc.toString().replace(/[-\s]/g, '');

    // Validar longitud
    if (rucStr.length !== 11) {
      throw new Error(`RUC inválido en fila ${rowNumber}: debe tener 11 dígitos`);
    }

    // Validar que sean solo números
    if (!/^\d{11}$/.test(rucStr)) {
      throw new Error(`RUC inválido en fila ${rowNumber}: debe contener solo números`);
    }

    return rucStr;
  }

  /**
   * Crea un archivo Excel de ejemplo
   * @param {string} filePath - Ruta donde crear el archivo
   */
  createExampleFile(filePath = 'data/CLIENTES.xlsx') {
    try {
      // Resolver la ruta para producción/desarrollo
      const resolvedPath = filePath.startsWith('data/') ? path.join(process.cwd(), filePath) : filePath;

      // Crear directorio si no existe
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const exampleData = [
        ['N°', 'Empresa', 'RUC', 'Usuario', 'Clave', 'Email', 'WhatsApp', 'USUARIO_SOL', 'CLAVE_SOL', 'CLIENTE_ID', 'CLIENTE_SECRET'],
        [1, 'EMPRESA ALFA S.A.C.', '20123456789', 'USUARIO01', 'CLAVE01', 'cliente1@empresa.com', '51987654321', 'MODDATOS', 'CLAVESOL123', 'test-client-id', 'test-client-secret'],
        [2, 'IMPORT BETA EIRL', '20567890123', 'USUARIO02', 'CLAVE02', 'cliente2@empresa.com', '51912345678', 'MODDATOS', 'CLAVESOL456', 'test-client-id-2', 'test-client-secret-2']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(exampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'CLIENTES');

      XLSX.writeFile(workbook, resolvedPath);
      logger.info('Archivo de ejemplo creado', { filePath: resolvedPath });

    } catch (error) {
      logger.error('Error al crear archivo de ejemplo', { error: error.message, filePath });
      throw error;
    }
  }


  /**
   * Obtiene los nombres de las hojas de un archivo Excel
   * @param {string} filePath - Ruta al archivo
   * @returns {Array<string>} Lista de nombres de hojas
   */
  getSheets(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }
      const workbook = XLSX.readFile(filePath);
      return workbook.SheetNames;
    } catch (error) {
      logger.error('Error al obtener hojas de Excel', { error: error.message, filePath });
      throw error;
    }
  }

  /**
   * Lee una hoja específica de un Excel
   * @param {string} filePath - Ruta al archivo
   * @param {string} sheetName - Nombre de la hoja
   * @returns {Array} Datos de la hoja en formato JSON
   */
  readSheet(filePath, sheetName) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo no encontrado: ${filePath}`);
      }
      const workbook = XLSX.readFile(filePath);

      if (!workbook.Sheets[sheetName]) {
        throw new Error(`Hoja "${sheetName}" no encontrada`);
      }

      const worksheet = workbook.Sheets[sheetName];
      // Leer con opción raw: false para obtener strings formateados (fechas, etc)
      // O raw: true para valores crudos. Usaremos raw: false para fechas legibles si es posible.
      return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    } catch (error) {
      logger.error('Error al leer hoja de Excel', { error: error.message, filePath, sheetName });
      throw error;
    }
  }
}

module.exports = new ExcelReader();