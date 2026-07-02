let BrowserWindow, ipcMain, dialog;
try {
    if (!process.env.RAILWAY_ENVIRONMENT) {
        const lib = 'electron';
        const electron = require(lib);
        BrowserWindow = electron.BrowserWindow;
        ipcMain = electron.ipcMain;
        dialog = electron.dialog;
    }
} catch (e) {}
const path = require('path');
const fs = require('fs').promises;
const XLSX = require('xlsx');
const logger = require('./logger');
const AdmZip = require('adm-zip');
const axios = require('axios');
const ajustesExcelCreator = require('./ajustesExcelCreator');

const { sireDir } = require('../server/storageConfig');

class SireAjustesHandler {
  constructor() {
    this.ajustesWindow = null;
    this.outputPath = sireDir;
    this.dataPath = path.join(process.cwd(), 'data');
  }

  /**
   * Abre la ventana de SIRE AJUSTES
   */
  async abrirVentanaAjustes() {
    try {
      logger.info('Iniciando apertura de ventana SIRE AJUSTES');

      if (this.ajustesWindow) {
        logger.info('Ventana SIRE AJUSTES ya existe, enfocando...');
        this.ajustesWindow.focus();
        return { success: true, message: 'Ventana ya estaba abierta' };
      }

      logger.info('Creando nueva ventana SIRE AJUSTES');

      this.ajustesWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        },
        title: 'SIRE AJUSTES - Control de Registros',
        show: false,
        resizable: true,
        minimizable: true,
        maximizable: true
      });

      // Cargar la página de SIRE AJUSTES
      const ajustesPath = path.join(__dirname, '../renderer/dist/sire-ajustes.html');
      logger.info('Intentando cargar archivo SIRE AJUSTES', { ajustesPath });

      // Verificar si el archivo existe
      const fs = require('fs').promises;
      try {
        await fs.access(ajustesPath);
        logger.info('Archivo sire-ajustes.html encontrado');
      } catch (accessError) {
        logger.error('Archivo sire-ajustes.html NO encontrado', {
          ajustesPath,
          error: accessError.message
        });

        // Intentar ruta alternativa
        const ajustesPathAlt = path.join(__dirname, '../renderer/sire-ajustes.html');
        logger.info('Intentando ruta alternativa', { ajustesPathAlt });

        try {
          await fs.access(ajustesPathAlt);
          logger.info('Archivo encontrado en ruta alternativa');
          await this.ajustesWindow.loadFile(ajustesPathAlt);
        } catch (altError) {
          logger.error('Archivo tampoco encontrado en ruta alternativa', {
            ajustesPathAlt,
            error: altError.message
          });
          throw new Error(`No se encontró sire-ajustes.html en ninguna ubicación. Rutas probadas: ${ajustesPath}, ${ajustesPathAlt}`);
        }
      }

      if (!this.ajustesWindow.isDestroyed()) {
        try {
          await this.ajustesWindow.loadFile(ajustesPath);
          logger.info('Archivo sire-ajustes.html cargado exitosamente');
        } catch (loadError) {
          logger.error('Error al cargar archivo sire-ajustes.html', { error: loadError.message });
          throw loadError;
        }
      }

      this.ajustesWindow.once('ready-to-show', () => {
        logger.info('Ventana SIRE AJUSTES lista para mostrar');
        this.ajustesWindow.show();
      });

      this.ajustesWindow.on('closed', () => {
        logger.info('Ventana SIRE AJUSTES cerrada');
        this.ajustesWindow = null;
      });

      // Agregar manejo de errores de carga
      this.ajustesWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        logger.error('Error al cargar contenido de SIRE AJUSTES', {
          errorCode,
          errorDescription,
          validatedURL
        });
      });

      logger.info('Ventana SIRE AJUSTES creada exitosamente');
      return { success: true, message: 'Ventana SIRE AJUSTES abierta correctamente' };

    } catch (error) {
      logger.error('Error al abrir ventana SIRE AJUSTES', {
        error: error.message,
        stack: error.stack
      });

      // Limpiar ventana si hay error
      if (this.ajustesWindow && !this.ajustesWindow.isDestroyed()) {
        this.ajustesWindow.close();
        this.ajustesWindow = null;
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Alias para mantener compatibilidad con main.js
   */
  registerHandlers() {
    this.setupAjustesIPC();
  }

  /**
   * Configura los canales IPC específicos para SIRE AJUSTES
   */
  setupAjustesIPC() {
    // Cargar datos iniciales
    ipcMain.handle('sire-ajustes-init', async () => {
      try {
        const datosIniciales = await this.cargarDatosIniciales();
        return { success: true, datos: datosIniciales };
      } catch (error) {
        logger.error('Error al cargar datos iniciales', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Verificar RUC con API
    ipcMain.handle('verificar-ruc', async (event, ruc) => {
      try {
        const resultado = await this.verificarRUC(ruc);
        return resultado;
      } catch (error) {
        logger.error('Error al verificar RUC', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Completar datos según hoja activa
    ipcMain.handle('completar-datos', async (event, { nombreHoja, datosEmpresa }) => {
      try {
        const resultado = await this.completarDatos(nombreHoja, datosEmpresa);
        return resultado;
      } catch (error) {
        logger.error('Error al completar datos', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Cambiar vista (Ventas/Compras)
    ipcMain.handle('cambiar-vista', async (event, modo) => {
      try {
        const resultado = await this.cambiarVista(modo);
        return resultado;
      } catch (error) {
        logger.error('Error al cambiar vista', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Generar archivos TXT y ZIP (desde Excel - método legacy)
    ipcMain.handle('generar-archivo', async (event, { nombreHoja, rutaDestino }) => {
      try {
        const resultado = await this.generarArchivo(nombreHoja, rutaDestino);
        return resultado;
      } catch (error) {
        logger.error('Error al generar archivo', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Generar archivos TXT y ZIP desde datos de la tabla editable
    ipcMain.handle('generar-archivo-desde-tabla', async (event, { nombreHoja, rutaDestino, datosTabla, datosEmpresa, correlativo, indicadorCont, indicadorMoned, comprobPago }) => {
      try {
        const resultado = await this.generarArchivoDesdeTabla(nombreHoja, rutaDestino, datosTabla, datosEmpresa, correlativo, indicadorCont, indicadorMoned, comprobPago);
        return resultado;
      } catch (error) {
        logger.error('Error al generar archivo desde tabla', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Listar archivos de output (ahora SIRE SUNAT)
    ipcMain.handle('listar-archivos-output', async (event, { ruc, rutaBase } = {}) => {
      try {
        const archivos = await this.listarArchivosOutput(ruc, rutaBase);
        return { success: true, archivos };
      } catch (error) {
        logger.error('Error al listar archivos output', { error: error.message });
        return { success: false, error: error.message, archivos: [] };
      }
    });

    // Borrar archivo de output
    ipcMain.handle('borrar-archivo', async (event, { nombreArchivo, ruc }) => {
      try {
        const resultado = await this.borrarArchivo(nombreArchivo, ruc);
        return resultado;
      } catch (error) {
        logger.error('Error al borrar archivo', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Leer contenido de archivo xlsx del output
    ipcMain.handle('leer-archivo-xlsx-output', async (event, { nombreArchivo, ruc, rutaBase }) => {
      try {
        const resultado = await this.leerArchivoXlsxOutput(nombreArchivo, ruc, rutaBase);
        return resultado;
      } catch (error) {
        logger.error('Error al leer archivo xlsx', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Seleccionar carpeta de destino
    ipcMain.handle('seleccionar-carpeta-destino', async () => {
      try {
        const result = await dialog.showOpenDialog(this.ajustesWindow, {
          title: 'Seleccionar Carpeta de Destino',
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return { success: true, ruta: result.filePaths[0] };
        }

        return { success: false, error: 'No se seleccionó carpeta' };
      } catch (error) {
        logger.error('Error al seleccionar carpeta', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Cargar datos de hoja específica
    ipcMain.handle('cargar-datos-hoja', async (event, { nombreHoja }) => {
      try {
        const resultado = await this.cargarDatosHoja(nombreHoja);
        return resultado;
      } catch (error) {
        logger.error('Error al cargar datos de hoja', { error: error.message });
        return { success: false, error: error.message };
      }
    });

    // Cargar lista de clientes desde CLIENTES.xlsx
    ipcMain.handle('cargar-clientes', async () => {
      try {
        const resultado = await this.cargarClientes();
        return resultado;
      } catch (error) {
        logger.error('Error al cargar clientes', { error: error.message });
        return { success: false, error: error.message, clientes: [] };
      }
    });

    // Guardar datos editados en la hoja
    ipcMain.handle('guardar-datos-editados', async (event, { nombreHoja, datosEditados }) => {
      try {
        const resultado = await this.guardarDatosEditados(nombreHoja, datosEditados);
        return resultado;
      } catch (error) {
        logger.error('Error al guardar datos editados', { error: error.message });
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Carga los datos iniciales desde el archivo AJUSTES.xlsm
   */
  async cargarDatosIniciales() {
    try {
      const ajustesPath = path.join(this.dataPath, 'AJUSTES.xlsm');

      // Verificar si existe el archivo
      try {
        await fs.access(ajustesPath);
      } catch {
        // Si no existe, crear archivo de ejemplo
        logger.info('Archivo AJUSTES.xlsm no encontrado, creando archivo de ejemplo...');
        await ajustesExcelCreator.crearArchivoEjemplo();

        // Intentar cargar nuevamente
        try {
          await fs.access(ajustesPath);
        } catch {
          // Si aún no existe, devolver datos por defecto
          return {
            ruc: '',
            razonSocial: '',
            anio: new Date().getFullYear().toString(),
            mes: (new Date().getMonth() + 1).toString().padStart(2, '0'),
            modo: 'COMPRAS'
          };
        }
      }

      const workbook = XLSX.readFile(ajustesPath);
      const inicioSheet = workbook.Sheets['INICIO'];

      if (!inicioSheet) {
        throw new Error('No se encontró la hoja INICIO en AJUSTES.xlsm');
      }

      return {
        ruc: this.getCellValue(inicioSheet, 'D4') || '',
        razonSocial: this.getCellValue(inicioSheet, 'H4') || '',
        anio: this.getCellValue(inicioSheet, 'D6') || new Date().getFullYear().toString(),
        mes: this.getCellValue(inicioSheet, 'D8') || (new Date().getMonth() + 1).toString().padStart(2, '0'),
        modo: this.detectarModo(workbook)
      };
    } catch (error) {
      logger.error('Error al cargar datos iniciales', { error: error.message });
      throw error;
    }
  }

  /**
   * Detecta el modo actual (VENTAS/COMPRAS) basado en hojas visibles
   */
  detectarModo(workbook) {
    try {
      // Verificar si existe hoja RVIE COMPLEMENTA para determinar modo
      const rvieSheet = workbook.Sheets['RVIE COMPLEMENTA'];
      return rvieSheet ? 'VENTAS' : 'COMPRAS';
    } catch {
      return 'COMPRAS';
    }
  }

  /**
   * Obtiene el valor de una celda del Excel
   */
  getCellValue(sheet, cellAddress) {
    const cell = sheet[cellAddress];
    return cell ? cell.v : '';
  }

  /**
   * Verifica RUC usando API externa
   */
  async verificarRUC(ruc) {
    try {
      if (!ruc || ruc.length !== 11 || !/^\d+$/.test(ruc)) {
        return { success: false, error: 'Ingrese un RUC válido de 11 dígitos' };
      }

      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImFhbmdlbG8yNTU1QGdtYWlsLmNvbSJ9.oqXPZP_ielNYSWrNo9p45PUjua1IHKIJ3gBj-tK2irY';
      const url = `https://dniruc.apisperu.com/api/v1/ruc/${ruc}?token=${token}`;

      const response = await axios.get(url, { timeout: 10000 });

      if (response.status === 200 && response.data) {
        const razonSocial = response.data.razonSocial;
        if (razonSocial) {
          return {
            success: true,
            razonSocial: razonSocial.replace(/"/g, ''),
            message: `Consulta Exitosa: ${razonSocial}`
          };
        } else {
          return { success: false, error: 'No se encontró Razón Social' };
        }
      } else {
        return { success: false, error: `Error de conexión API. Código: ${response.status}` };
      }
    } catch (error) {
      logger.error('Error en verificación de RUC', { error: error.message, ruc });
      return { success: false, error: `Error inesperado: ${error.message}` };
    }
  }

  /**
   * Carga la lista de clientes desde CLIENTES.xlsx
   * @returns {Object} - Lista de clientes con RUC y nombre de empresa
   */
  async cargarClientes() {
    try {
      const clientesPath = path.join(this.dataPath, 'CLIENTES.xlsx');

      // Verificar si existe el archivo
      try {
        await fs.access(clientesPath);
      } catch {
        logger.warn('Archivo CLIENTES.xlsx no encontrado');
        return { success: false, error: 'No se encontró el archivo CLIENTES.xlsx', clientes: [] };
      }

      const workbook = XLSX.readFile(clientesPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        return { success: false, error: 'No se encontró ninguna hoja en CLIENTES.xlsx', clientes: [] };
      }

      // Convertir a JSON
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (data.length < 2) {
        return { success: false, error: 'El archivo CLIENTES.xlsx está vacío', clientes: [] };
      }

      // Obtener índices de columnas (primera fila son headers)
      const headers = data[0];
      const empresaIdx = headers.findIndex(h => h && h.toString().toLowerCase().includes('empresa'));
      const rucIdx = headers.findIndex(h => h && h.toString().toLowerCase() === 'ruc');

      if (rucIdx === -1) {
        return { success: false, error: 'No se encontró la columna RUC en CLIENTES.xlsx', clientes: [] };
      }

      // Procesar filas de datos (desde la fila 2)
      const clientes = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const ruc = row[rucIdx];
        const empresa = empresaIdx !== -1 ? row[empresaIdx] : '';

        if (ruc) {
          clientes.push({
            ruc: String(ruc).trim(),
            empresa: empresa ? String(empresa).trim() : ''
          });
        }
      }

      logger.info('Clientes cargados correctamente', { cantidad: clientes.length });
      return { success: true, clientes };

    } catch (error) {
      logger.error('Error al cargar clientes', { error: error.message });
      return { success: false, error: error.message, clientes: [] };
    }
  }

  /**
   * Completa datos según la hoja especificada
   */
  async completarDatos(nombreHoja, datosEmpresa) {
    try {
      logger.info('Iniciando completar datos', { nombreHoja, datosEmpresa });

      const ajustesPath = path.join(this.dataPath, 'AJUSTES.xlsm');

      // Verificar si existe el archivo, si no, crearlo
      try {
        await fs.access(ajustesPath);
        logger.info('Archivo AJUSTES.xlsm encontrado');
      } catch {
        logger.info('Archivo AJUSTES.xlsm no encontrado, creando archivo de ejemplo...');
        try {
          await ajustesExcelCreator.crearArchivoEjemplo();
          logger.info('Archivo AJUSTES.xlsm creado exitosamente');
        } catch (createError) {
          logger.error('Error al crear archivo AJUSTES.xlsm', { error: createError.message });
          return { success: false, error: 'No se pudo crear el archivo AJUSTES.xlsm: ' + createError.message };
        }
      }

      let workbook;
      try {
        workbook = XLSX.readFile(ajustesPath);
        logger.info('Archivo AJUSTES.xlsm leído correctamente');
      } catch (readError) {
        logger.error('Error al leer archivo AJUSTES.xlsm', { error: readError.message });
        return { success: false, error: 'Error al leer AJUSTES.xlsm: ' + readError.message };
      }

      // Verificar si la hoja existe, si no, usar la primera hoja disponible
      let sheet = workbook.Sheets[nombreHoja];
      let hojaUsada = nombreHoja;

      if (!sheet) {
        logger.warn(`Hoja ${nombreHoja} no encontrada, buscando hojas disponibles...`);
        const hojasDisponibles = Object.keys(workbook.Sheets);
        logger.info('Hojas disponibles', { hojas: hojasDisponibles });

        // Buscar una hoja compatible según el modo
        const hojasPosibles = datosEmpresa.modo === 'VENTAS'
          ? ['RVIE COMPLEMENTA', 'RVIE REEMPLAZA', 'RVIE AJUSTES POST 1', 'RVIE AJUSTES POST 2']
          : ['RCE COMPLETA', 'RCE NO DOMICILIADOS', 'RCE COMPLETA TC', 'RCE REEMPLAZA', 'RCE AJUSTES POST 1', 'RCE AJUSTES POST 2'];

        for (const hojaPosible of hojasPosibles) {
          if (workbook.Sheets[hojaPosible]) {
            sheet = workbook.Sheets[hojaPosible];
            hojaUsada = hojaPosible;
            logger.info(`Usando hoja alternativa: ${hojaPosible}`);
            break;
          }
        }

        if (!sheet) {
          // Si no hay hojas compatibles, crear una hoja de ejemplo
          logger.info('No se encontraron hojas compatibles, creando hoja de ejemplo...');
          hojaUsada = datosEmpresa.modo === 'VENTAS' ? 'RVIE COMPLEMENTA' : 'RCE COMPLETA';
          sheet = this.crearHojaEjemplo(hojaUsada);
          workbook.Sheets[hojaUsada] = sheet;
        }
      }

      // Determinar configuración según el tipo de hoja
      let config = this.obtenerConfiguracionHoja(hojaUsada);

      if (!config) {
        logger.warn(`No hay configuración específica para ${hojaUsada}, usando configuración por defecto`);
        config = { filaInicio: 18, columnaReferencia: 'G' };
      }

      // Buscar última fila con datos o crear datos de ejemplo
      let ultimaFila = this.buscarUltimaFila(sheet, config.columnaReferencia);

      if (ultimaFila < config.filaInicio) {
        logger.info('No hay datos suficientes, creando datos de ejemplo...');
        // Crear algunas filas de ejemplo
        ultimaFila = config.filaInicio + 2; // 3 filas de ejemplo
        this.crearDatosEjemplo(sheet, config, ultimaFila);
      }

      logger.info('Completando datos en rango', {
        hojaUsada,
        filaInicio: config.filaInicio,
        ultimaFila,
        filasAfectadas: ultimaFila - config.filaInicio + 1
      });

      // Completar datos
      this.completarDatosEnRango(sheet, config, datosEmpresa, ultimaFila);

      // Guardar archivo
      try {
        XLSX.writeFile(workbook, ajustesPath);
        logger.info('Archivo AJUSTES.xlsm guardado correctamente');
      } catch (saveError) {
        logger.error('Error al guardar archivo AJUSTES.xlsm', { error: saveError.message });
        return { success: false, error: 'Error al guardar archivo: ' + saveError.message };
      }

      const filasAfectadas = ultimaFila - config.filaInicio + 1;
      logger.info('Completar datos finalizado exitosamente', { hojaUsada, filasAfectadas });

      return {
        success: true,
        message: `Datos completados correctamente en: ${hojaUsada}`,
        filasAfectadas: filasAfectadas,
        hojaUsada: hojaUsada
      };

    } catch (error) {
      logger.error('Error al completar datos', { error: error.message, stack: error.stack, nombreHoja });
      return { success: false, error: `Error inesperado: ${error.message}` };
    }
  }

  /**
   * Obtiene la configuración específica para cada tipo de hoja
   */
  obtenerConfiguracionHoja(nombreHoja) {
    const configuraciones = {
      // Hojas RCE (Compras)
      'RCE COMPLETA': { filaInicio: 18, columnaReferencia: 'G' },
      'RCE NO DOMICILIADOS': { filaInicio: 17, columnaReferencia: 'G' },
      'RCE COMPLETA TC': { filaInicio: 17, columnaReferencia: 'G' },
      'RCE REEMPLAZA': { filaInicio: 17, columnaReferencia: 'G' },
      'RCE AJUSTES POST 1': { filaInicio: 18, columnaReferencia: 'G' },
      'RCE AJUSTES POST 2': { filaInicio: 18, columnaReferencia: 'G' },
      'RCE AJUSTES POST DIST 1': { filaInicio: 18, columnaReferencia: 'G' },
      'RCE AJUSTES POST DIST 2': { filaInicio: 18, columnaReferencia: 'G' },

      // Hojas RVIE (Ventas)
      'RVIE COMPLEMENTA': { filaInicio: 18, columnaReferencia: 'G' },
      'RVIE REEMPLAZA': { filaInicio: 18, columnaReferencia: 'G' },
      'RVIE AJUSTES POST 1': { filaInicio: 18, columnaReferencia: 'G' },
      'RVIE AJUSTES POST 2': { filaInicio: 18, columnaReferencia: 'G' }
    };

    return configuraciones[nombreHoja];
  }

  /**
   * Busca la última fila con datos en una columna específica
   */
  buscarUltimaFila(sheet, columnaReferencia) {
    let ultimaFila = 0;
    const range = XLSX.utils.decode_range(sheet['!ref']);

    for (let row = range.e.r; row >= 0; row--) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: XLSX.utils.decode_col(columnaReferencia) });
      if (sheet[cellAddress] && sheet[cellAddress].v) {
        ultimaFila = row + 1; // +1 porque las filas en Excel empiezan en 1
        break;
      }
    }

    return ultimaFila;
  }

  /**
   * Completa los datos en el rango especificado
   */
  completarDatosEnRango(sheet, config, datosEmpresa, ultimaFila) {
    for (let fila = config.filaInicio; fila <= ultimaFila; fila++) {
      // Columna B: Número secuencial
      const cellB = XLSX.utils.encode_cell({ r: fila - 1, c: 1 });
      sheet[cellB] = { v: fila - config.filaInicio + 1, t: 'n' };

      // Columna C: RUC
      const cellC = XLSX.utils.encode_cell({ r: fila - 1, c: 2 });
      sheet[cellC] = { v: datosEmpresa.ruc, t: 's' };

      // Columna D: Razón Social
      const cellD = XLSX.utils.encode_cell({ r: fila - 1, c: 3 });
      sheet[cellD] = { v: datosEmpresa.razonSocial, t: 's' };

      // Columna E: Periodo (YYYYMM)
      const cellE = XLSX.utils.encode_cell({ r: fila - 1, c: 4 });
      const periodo = `${datosEmpresa.anio}${datosEmpresa.mes.padStart(2, '0')}`;
      sheet[cellE] = { v: periodo, t: 's' };
    }
  }

  /**
   * Crea una hoja de ejemplo con estructura básica
   */
  crearHojaEjemplo(nombreHoja) {
    const sheet = {};

    // Crear encabezados básicos
    const encabezados = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'
    ];

    for (let i = 0; i < encabezados.length; i++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 16, c: i }); // Fila 17 (encabezados)
      sheet[cellAddress] = { v: `Col${encabezados[i]}`, t: 's' };
    }

    // Establecer rango de la hoja
    sheet['!ref'] = 'A1:J20';

    return sheet;
  }

  /**
   * Crea datos de ejemplo en la hoja
   */
  crearDatosEjemplo(sheet, config, ultimaFila) {
    for (let fila = config.filaInicio; fila <= ultimaFila; fila++) {
      // Columna G: Datos de ejemplo (para que buscarUltimaFila funcione)
      const cellG = XLSX.utils.encode_cell({ r: fila - 1, c: 6 });
      sheet[cellG] = { v: `Dato${fila}`, t: 's' };

      // Otras columnas con datos de ejemplo
      const cellF = XLSX.utils.encode_cell({ r: fila - 1, c: 5 });
      sheet[cellF] = { v: '01/01/2024', t: 's' };

      const cellH = XLSX.utils.encode_cell({ r: fila - 1, c: 7 });
      sheet[cellH] = { v: '100.00', t: 'n' };
    }

    // Actualizar rango de la hoja
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    range.e.r = Math.max(range.e.r, ultimaFila - 1);
    range.e.c = Math.max(range.e.c, 9); // Hasta columna J
    sheet['!ref'] = XLSX.utils.encode_range(range);
  }

  /**
   * Lista los archivos disponibles en la carpeta output
   * @param {string} ruc - Número de RUC para buscar en subcarpeta específica (opcional)
   * @param {string} rutaBase - Ruta base opcional. Si se omite, usa this.outputPath
   * @returns {Array} - Lista de archivos encontrados
   */
  async listarArchivosOutput(ruc = null, rutaBase = null) {
    try {
      // Determinar ruta de búsqueda base
      const basePath = rutaBase || this.outputPath;

      // Crear carpeta base si no existe
      try {
        await fs.access(basePath);
      } catch {
        // Solo intentamos crear si es la ruta por defecto. Si es ruta custom y no existe, devolvemos vacío.
        if (!rutaBase) {
          await fs.mkdir(basePath, { recursive: true });
        } else {
          return [];
        }
      }

      let rutaBusqueda = basePath;

      // Si se proporciona RUC, buscar en la subcarpeta específica
      if (ruc) {
        rutaBusqueda = path.join(basePath, ruc.toString());
        logger.info('Buscando archivos en subcarpeta de RUC', { ruc, rutaBusqueda });

        // Verificar si existe la subcarpeta del RUC
        try {
          await fs.access(rutaBusqueda);
        } catch {
          logger.warn('No existe carpeta para RUC', { ruc, rutaBusqueda });
          return [];
        }
      }

      const archivos = await fs.readdir(rutaBusqueda);
      const archivosDetalle = [];

      for (const archivo of archivos) {
        const rutaCompleta = path.join(rutaBusqueda, archivo);
        const stats = await fs.stat(rutaCompleta);

        if (stats.isFile()) {
          archivosDetalle.push({
            nombre: archivo,
            tamaño: stats.size,
            fechaModificacion: stats.mtime,
            tipo: path.extname(archivo).toLowerCase()
          });
        }
      }

      logger.info('Archivos encontrados', { cantidad: archivosDetalle.length, rutaBusqueda });
      return archivosDetalle.sort((a, b) => b.fechaModificacion - a.fechaModificacion);
    } catch (error) {
      logger.error('Error al listar archivos output', { error: error.message, ruc });
      return [];
    }
  }

  /**
   * Lee el contenido de un archivo xlsx del output y lo devuelve como datos de tabla
   * @param {string} nombreArchivo - Nombre del archivo xlsx a leer
   * @param {string} ruc - Número de RUC para buscar en subcarpeta específica (opcional)
   * @returns {Object} - Datos del archivo con hojas y contenido
   */
  async leerArchivoXlsxOutput(nombreArchivo, ruc = null, rutaBase = null) {
    try {
      // Determinar ruta base
      const basePath = rutaBase || this.outputPath;

      // Determinar la ruta de búsqueda completa
      let rutaArchivo;
      if (ruc) {
        // Buscar en la subcarpeta del RUC
        rutaArchivo = path.join(basePath, ruc.toString(), nombreArchivo);
        logger.info('Buscando archivo XLSX en subcarpeta de RUC', { ruc, nombreArchivo, rutaArchivo });
      } else {
        // Buscar directamente en base (retrocompatibilidad)
        rutaArchivo = path.join(basePath, nombreArchivo);
      }

      // Verificar que el archivo existe
      try {
        await fs.access(rutaArchivo);
      } catch {
        return { success: false, error: `No se encontró el archivo: ${nombreArchivo}` };
      }

      // Verificar que es un archivo xlsx
      const extension = path.extname(nombreArchivo).toLowerCase();
      if (extension !== '.xlsx' && extension !== '.xls' && extension !== '.xlsm') {
        return { success: false, error: 'El archivo no es un archivo Excel válido' };
      }

      // Leer el archivo Excel
      const workbook = XLSX.readFile(rutaArchivo);
      const hojas = {};

      // Procesar cada hoja del workbook
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];

        // Convertir la hoja a JSON (array de arrays para mantener estructura)
        const datosJson = XLSX.utils.sheet_to_json(sheet, {
          header: 1, // Usar índices numéricos como headers
          defval: '', // Valor por defecto para celdas vacías
          raw: false // Convertir valores a strings para mejor visualización
        });

        // Filtrar filas completamente vacías
        const datosFiltrados = datosJson.filter(row =>
          row.some(cell => cell !== '' && cell !== null && cell !== undefined)
        );

        // Detectar la fila de headers (buscar fila que contenga "Ruc" o "RUC" o "Periodo" como columna)
        // Los archivos SIRE tienen estructura:
        // Fila 1: Periodo:
        // Fila 2: RUC:
        // Fila 3: Empresa:
        // Fila 4: Headers (Ruc, Razon Social, Periodo, CAR SUNAT, etc.)
        // Fila 5+: Datos

        let headerRowIndex = 0;
        const headersConocidos = ['ruc', 'razon social', 'razón social', 'periodo', 'car sunat', 'fecha de emision', 'fecha de emisión', 'tipo cp/doc', 'serie'];

        for (let i = 0; i < Math.min(datosFiltrados.length, 10); i++) {
          const fila = datosFiltrados[i];
          if (Array.isArray(fila) && fila.length > 3) {
            // Verificar si esta fila parece ser la fila de headers
            const primerasCeldas = fila.slice(0, 5).map(c => String(c || '').toLowerCase().trim());
            const esFilaHeaders = primerasCeldas.some(celda =>
              headersConocidos.some(header => celda.includes(header) || header.includes(celda))
            );

            if (esFilaHeaders) {
              headerRowIndex = i;
              logger.info(`Headers detectados en fila ${i + 1}`, { primerasCeldas });
              break;
            }
          }
        }

        // Obtener encabezados de la fila detectada
        const headers = datosFiltrados.length > headerRowIndex ? datosFiltrados[headerRowIndex] : [];

        // Obtener datos (filas después de los headers)
        const rows = datosFiltrados.slice(headerRowIndex + 1);

        // Limpiar headers (quitar espacios extra)
        const headersLimpios = headers.map(h => String(h || '').trim());

        hojas[sheetName] = {
          headers: headersLimpios,
          rows: rows,
          totalFilas: rows.length,
          totalColumnas: headersLimpios.length,
          headerRowIndex: headerRowIndex
        };

        logger.info(`Hoja ${sheetName} procesada`, {
          headerRowIndex,
          headers: headersLimpios.slice(0, 10),
          totalFilas: rows.length
        });
      }

      logger.info('Archivo xlsx leído correctamente', {
        nombreArchivo,
        hojas: Object.keys(hojas),
        totalHojas: workbook.SheetNames.length
      });

      return {
        success: true,
        nombreArchivo: nombreArchivo,
        hojas: hojas,
        nombresHojas: workbook.SheetNames,
        totalHojas: workbook.SheetNames.length
      };

    } catch (error) {
      logger.error('Error al leer archivo xlsx', { error: error.message, nombreArchivo });
      return { success: false, error: `Error al leer archivo: ${error.message}` };
    }
  }

  /**
   * Cambia la vista entre VENTAS y COMPRAS
   */
  async cambiarVista(modo) {
    try {
      // En una implementación real, esto modificaría la visibilidad de las hojas
      // Por ahora, solo retornamos el modo seleccionado
      const mensaje = modo === 'VENTAS'
        ? 'Modo VENTAS Activado. Se muestran hojas RVIE.'
        : 'Modo COMPRAS Activado. Se muestran hojas RCE.';

      return {
        success: true,
        modo,
        message: mensaje
      };
    } catch (error) {
      logger.error('Error al cambiar vista', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Genera archivo TXT y ZIP según la hoja especificada
   */
  async generarArchivo(nombreHoja, rutaDestino) {
    try {
      const ajustesPath = path.join(this.dataPath, 'AJUSTES.xlsm');

      // Verificar archivo AJUSTES.xlsm
      try {
        await fs.access(ajustesPath);
      } catch {
        return { success: false, error: 'No se encontró el archivo AJUSTES.xlsm' };
      }

      const workbook = XLSX.readFile(ajustesPath);
      const sheet = workbook.Sheets[nombreHoja];

      if (!sheet) {
        return { success: false, error: `No se encontró la hoja ${nombreHoja}` };
      }

      // Obtener configuración de generación
      const configGen = this.obtenerConfiguracionGeneracion(nombreHoja, workbook);
      if (!configGen) {
        return { success: false, error: `No hay configuración de generación para ${nombreHoja}` };
      }

      // Generar nombre de archivo
      const nombreArchivo = this.generarNombreArchivo(nombreHoja, workbook, configGen);

      // MODIFICACIÓN: Crear subcarpeta con el RUC
      const ruc = this.getCellValue(workbook.Sheets['INICIO'], 'M4') || 'SIN_RUC';
      const carpetaRuc = path.join(rutaDestino, ruc.toString());

      try {
        await fs.access(carpetaRuc);
      } catch {
        await fs.mkdir(carpetaRuc, { recursive: true });
      }

      const rutaCompleta = path.join(carpetaRuc, nombreArchivo);

      // Generar contenido TXT
      const contenidoTXT = this.generarContenidoTXT(sheet, configGen);

      // Escribir archivo TXT
      await fs.writeFile(rutaCompleta, contenidoTXT, 'utf8');

      // Comprimir archivo
      const rutaZIP = await this.comprimirArchivo(rutaCompleta);

      return {
        success: true,
        message: `Archivo generado con éxito para: ${nombreHoja}`,
        rutaTXT: rutaCompleta,
        rutaZIP: rutaZIP
      };

    } catch (error) {
      logger.error('Error al generar archivo', { error: error.message, nombreHoja });
      return { success: false, error: error.message };
    }
  }

  /**
   * Genera archivo TXT y ZIP desde los datos de la tabla editable (NO desde Excel)
   * Este es el método principal para generar archivos RVIE y RCE
   * 
   * @param {string} nombreHoja - Nombre de la hoja (RVIE COMPLEMENTA, RVIE REEMPLAZA, etc.)
   * @param {string} rutaDestino - Ruta de la carpeta destino
   * @param {Array} datosTabla - Datos editables de la tabla del frontend
   * @param {Object} datosEmpresa - Datos de la empresa (RUC, razón social, año, mes)
   * @param {string} correlativo - N° Correlativo para el nombre del archivo
   * @param {string} indicadorCont - Indicador de contenido (1=SI, 0=NO) para RVIE REEMPLAZA
   * @param {string} indicadorMoned - Indicador de moneda (1=PEN, 2=USD) para RVIE REEMPLAZA
   * @param {string} comprobPago - Tipo de comprobante de pago (CP) para RCE COMPLETA
   */
  async generarArchivoDesdeTabla(nombreHoja, rutaDestino, datosTabla, datosEmpresa, correlativo = '01', indicadorCont = '1', indicadorMoned = '1', comprobPago = 'CP') {
    try {
      logger.info('Generando archivo desde tabla editable', {
        nombreHoja,
        rutaDestino,
        cantidadFilas: datosTabla?.length || 0,
        correlativo,
        indicadorCont,
        indicadorMoned,
        comprobPago
      });

      // Validar datos
      if (!datosTabla || datosTabla.length === 0) {
        return { success: false, error: 'No hay datos en la tabla para generar el archivo' };
      }

      if (!rutaDestino) {
        return { success: false, error: 'No se especificó la carpeta de destino' };
      }

      // Obtener configuración de generación
      const configGen = this.obtenerConfiguracionGeneracionTabla(nombreHoja);
      if (!configGen) {
        return { success: false, error: `No hay configuración de generación para ${nombreHoja}` };
      }

      // Generar nombre de archivo según estándares SUNAT (pasando correlativo e indicadores)
      const nombreArchivo = this.generarNombreArchivoDesdeTabla(nombreHoja, datosEmpresa, configGen, correlativo, indicadorCont, indicadorMoned, comprobPago);

      // MODIFICACIÓN: Crear subcarpeta con el RUC
      const ruc = datosEmpresa?.ruc || 'SIN_RUC';
      const carpetaRuc = path.join(rutaDestino, ruc.toString());

      try {
        await fs.access(carpetaRuc);
      } catch {
        await fs.mkdir(carpetaRuc, { recursive: true });
      }

      const rutaCompleta = path.join(carpetaRuc, nombreArchivo);

      // Generar contenido TXT desde los datos de la tabla
      const contenidoTXT = this.generarContenidoTXTDesdeTabla(datosTabla, nombreHoja, configGen);

      if (!contenidoTXT) {
        return { success: false, error: 'No se pudo generar el contenido del archivo' };
      }

      // Escribir archivo TXT
      await fs.writeFile(rutaCompleta, contenidoTXT, 'utf8');
      logger.info('Archivo TXT generado', { rutaCompleta });

      // Comprimir archivo en ZIP
      const rutaZIP = await this.comprimirArchivo(rutaCompleta);
      logger.info('Archivo ZIP generado', { rutaZIP });

      return {
        success: true,
        message: `Archivos TXT y ZIP generados con éxito`,
        nombreArchivo: nombreArchivo,
        rutaTXT: rutaCompleta,
        rutaZIP: rutaZIP,
        filasGeneradas: datosTabla.length
      };

    } catch (error) {
      logger.error('Error al generar archivo desde tabla', { error: error.message, nombreHoja });
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene la configuración de generación para tablas editables
   */
  obtenerConfiguracionGeneracionTabla(nombreHoja) {
    const configuraciones = {
      // RVIE (Ventas) - Columnas según estructura de la tabla editable
      'RVIE COMPLEMENTA': {
        tipoNombre: 'cpf_rvie',
        columnas: ['col1_ruc', 'col2_razonSocial', 'col3_periodo', 'col4_carSunat',
          'col5_fecEmision', 'col6_fecVence', 'col7_tipo', 'col8_serie',
          'col9_numInicial', 'col10_numFinal', 'col11_tipoDoc', 'col12_numDocCliente',
          'col13_razonSocialCliente', 'col14_valorExportacion', 'col15_baseImponibleGravada',
          'col16_descuentoBaseImponible', 'col17_igvIpm', 'col18_descuentoIgvIpm',
          'col19_operacionExonerada', 'col20_operacionInafecta', 'col21_isc',
          'col22_baseImponibleIvap', 'col23_ivap', 'col24_icbper', 'col25_otrosTributos',
          'col26_importeTotal', 'col27_codigoMoneda', 'col28_tipoCambio',
          'col29_fecEmisionRef', 'col30_tipoRef', 'col31_serieRef', 'col32_numeroRef',
          'col33_identificacionContrato']
      },
      'RVIE REEMPLAZA': {
        tipoNombre: 'le_rvie_reemplaza',
        // 34 columnas totales según estándar SUNAT
        columnas: ['col1_ruc', 'col2_razonSocial', 'col3_periodo', 'col4_carSunat',
          'col5_fecEmision', 'col6_fecVence', 'col7_tipo', 'col8_serie',
          'col9_numInicial', 'col10_numFinal', 'col11_tipoDoc', 'col12_numDoc',
          'col13_razonSocialCliente', 'col14_valorExportacion', 'col15_baseImponibleGravada',
          'col16_descuentoBaseImponible', 'col17_igvIpm', 'col18_descuentoIgvIpm',
          'col19_operacionExonerada', 'col20_operacionInafecta', 'col21_isc',
          'col22_baseImponibleIvap', 'col23_ivap', 'col24_icbper', 'col25_otrosTributos',
          'col26_importeTotal', 'col27_codigoMoneda', 'col28_tipoCambio',
          'col29_fecEmisionRef', 'col30_tipoRef', 'col31_serieRef', 'col32_numeroRef',
          'col33_identificacionContrato', 'col34_libre']
      },
      'RVIE AJUSTES POST 1': {
        tipoNombre: 'le_rvie_ajustes_1',
        columnas: ['col1_ruc', 'col2_razonSocial', 'col3_periodo', 'col4_carSunat',
          'col5_fecEmision', 'col6_fecVence', 'col7_tipo', 'col8_serie',
          'col9_numInicial', 'col10_numFinal', 'col11_tipoDoc', 'col12_numDoc',
          'col13_razonSocialCliente', 'col14_valorExportacion', 'col15_baseImponibleGravada',
          'col16_descuentoBaseImponible', 'col17_igvIpm', 'col18_descuentoIgvIpm',
          'col19_operacionExonerada', 'col20_operacionInafecta', 'col21_isc',
          'col22_baseImponibleIvap', 'col23_ivap', 'col24_icbper', 'col25_otrosTributos',
          'col26_importeTotal', 'col27_codigoMoneda', 'col28_tipoCambio',
          'col29_fecEmisionRef', 'col30_tipoRef', 'col31_serieRef', 'col32_numeroRef',
          'col33_identificacionContrato']
      },
      'RVIE AJUSTES POST 2': {
        tipoNombre: 'le_rvie_ajustes_2',
        columnas: ['col1_periodoAjuste', 'col2_cuo', 'col3_correlativoAsiento',
          'col4_fecEmision', 'col5_fecVence', 'col6_tipo', 'col7_serie',
          'col8_numInicial', 'col9_numFinal', 'col10_tipoDoc', 'col11_numDoc',
          'col12_razonSocialCliente', 'col13_valorExportacion', 'col14_baseImponibleGravada',
          'col15_descuentoBaseImponible', 'col16_igvIpm', 'col17_descuentoIgvIpm',
          'col18_operacionExonerada', 'col19_operacionInafecta', 'col20_isc',
          'col21_baseImponibleIvap', 'col22_ivap', 'col23_icbper', 'col24_otrosTributos',
          'col25_importeTotal', 'col26_codigoMoneda', 'col27_tipoCambio',
          'col28_fecEmisionRef', 'col29_tipoRef', 'col30_serieRef', 'col31_numeroRef',
          'col32_identificacionContrato', 'col33_inconsistenciaTC', 'col34_indicadorMedioPago', 'col35_estado']
      },
      // RCE (Compras) - 36 columnas según estructura SUNAT
      'RCE COMPLETA': {
        tipoNombre: 'le_rce_completa',
        columnas: ['col1_ruc', 'col2_razonSocial', 'col3_periodo', 'col4_carSunat',
          'col5_fecEmision', 'col6_fecVence', 'col7_tipo', 'col8_serie', 'col9_damODsi',
          'col10_numInicial', 'col11_numFinal', 'col12_tipoDoc', 'col13_numDoc',
          'col14_razonSocialProveedor',
          'col15_baseImponibleGravada', 'col16_igvGravada', 'col17_baseImponibleGravadaExport',
          'col18_igvGravadaExport', 'col19_baseImponibleNoGravada', 'col20_igvNoGravada',
          'col21_adquisicionesNoGravadas', 'col22_isc', 'col23_icbper',
          'col24_otrosTributos', 'col25_importeTotal', 'col26_codigoMoneda', 'col27_tipoCambio',
          'col28_fecEmisionRef', 'col29_tipoRef', 'col30_serieRef', 'col31_damODsiRef', 'col32_numeroRef',
          'col33_clasificacionBsSs', 'col34_identificacionContrato', 'col35_porcentajeParticipacion',
          'col36_impuestoMateriaBeneficio']
      },
      // RCE NO DOMICILIADOS - 36 columnas según estructura SUNAT
      'RCE NO DOMICILIADOS': {
        tipoNombre: 'le_rce_no_domiciliados',
        columnas: [
          'col1_periodo', 'col2_carSunat',
          'col3_fecEmision', 'col4_tipo', 'col5_serie', 'col6_numeroCP',
          'col7_valorAdquisiciones', 'col8_otrosConceptos', 'col9_importeTotal',
          'col10_tipo', 'col11_serie', 'col12_damODsi', 'col13_numeroCP',
          'col14_montoRetencionIGV', 'col15_codigoMoneda', 'col16_tipoCambio',
          'col17_pais',
          'col18_apellidosNombresRazonSocial', 'col19_domicilioExtranjero', 'col20_numIdentificacion', 'col21_numIdentifFiscal',
          'col22_apellidosNombresRazonSocial', 'col23_pais', 'col24_vinculoCR',
          'col25_rentaBruta', 'col26_deduccCosto', 'col27_rentaNeta', 'col28_tasaRetencion', 'col29_impuestoRetenido',
          'col30_convenio', 'col31_exoneracionAplicada', 'col32_tipoRenta', 'col33_modalidadServicio', 'col34_aplicacionArt76',
          'col35_carCpModificar', 'col36_libreUtilizacion'
        ]
      },
      // RCE COMPLETA TC - 5 columnas (Tipo de Cambio)
      // Formato nombre: {RUC}-RCETCA-{YYYYMM}-{correlativo}.txt
      'RCE COMPLETA TC': {
        tipoNombre: 'rce_completa_tc',
        columnas: ['col1_periodo', 'col2_fecEmision', 'col3_codigoMoneda', 'col4_tcSoles', 'col5_tcDolares']
      },
      // RCE REEMPLAZA - 50 columnas según estructura SUNAT
      // Formato nombre: LE{RUC}{YYYYMM}00080400021{indicadorCont}{indicadorMoned}2.txt
      'RCE REEMPLAZA': {
        tipoNombre: 'le_rce_reemplaza',
        columnas: [
          'col1_ruc', 'col2_razonSocial', 'col3_periodo', 'col4_carSunat',
          'col5_fecEmision', 'col6_fecVence', 'col7_tipo', 'col8_serie', 'col9_damODsi',
          'col10_numInicial', 'col11_numFinal', 'col12_tipoDoc', 'col13_numDoc',
          'col14_razonSocialProveedor',
          'col15_baseImponibleGravada', 'col16_igvGravada', 'col17_baseImponibleGravadaExport',
          'col18_igvGravadaExport', 'col19_baseImponibleNoGravada', 'col20_igvNoGravada',
          'col21_adquisicionesNoGravadas', 'col22_isc', 'col23_icbper',
          'col24_otrosTributos', 'col25_importeTotal', 'col26_codigoMoneda', 'col27_tipoCambio',
          'col28_fecEmisionRef', 'col29_tipoRef', 'col30_serieRef', 'col31_damODsiRef', 'col32_numeroRef',
          'col33_clasificacionBsSs', 'col34_identificacionContrato', 'col35_porcentajeParticipacion',
          'col36_impuestoMateriaBeneficio', 'col37_carCpModificar', 'col38_libre',
          'col39_tipoNota', 'col40_estComp', 'col41_incal',
          'col42_clu1', 'col43_clu2', 'col44_clu3', 'col45_clu4', 'col46_clu5',
          'col47_clu6', 'col48_clu7', 'col49_clu8', 'col50_clu9'
        ]
      },
      // RCE AJUSTES POST 1 - 37 columnas principales + Libre Utilización (42-80)
      // Formato nombre: LE{RUC}{YYYYMM}00{LLLLLL}{CC}{O}{I}{M}{G}{NN}.txt (35 caracteres)
      // Estructura: Generador, Periodo, CAR-SUNAT, Comprobante, Proveedor, Bases Imponibles, Tributos, Referencia, Clasificación
      'RCE AJUSTES POST 1': {
        tipoNombre: 'le_rce_ajustes_1',
        columnas: [
          'col1_ruc', 'col2_razonSocial', 'col3_periodo', 'col4_carSunat',
          'col5_fecEmision', 'col6_fecVence', 'col7_tipo', 'col8_serie', 'col9_damODsi',
          'col10_numInicial', 'col11_numFinal', 'col12_tipoDoc', 'col13_numDoc',
          'col14_razonSocialProveedor',
          'col15_baseImponibleGravada', 'col16_igvGravada', 'col17_baseImponibleGravadaExport',
          'col18_igvGravadaExport', 'col19_baseImponibleNoGravada', 'col20_igvNoGravada',
          'col21_adquisicionesNoGravadas', 'col22_isc', 'col23_icbper',
          'col24_otrosTributos', 'col25_importeTotal', 'col26_codigoMoneda', 'col27_tipoCambio',
          'col28_fecEmisionRef', 'col29_tipoRef', 'col30_serieRef', 'col31_damODsiRef', 'col32_numeroRef',
          'col33_clasificacionBsSs', 'col34_identificacionContrato', 'col35_porcentajeParticipacion',
          'col36_impuestoMateriaBeneficio', 'col37_carCpModificar',
          // Libre Utilización (columnas 42-80)
          ...Array.from({ length: 39 }, (_, i) => `col${42 + i}_libre`)
        ]
      },
      // RCE AJUSTES POST 2 - 36 columnas (columnas 3-38)
      // Formato nombre: LE{RUC}{YYYYMM}0080500005{indicadorCont}{indicadorMoned}12{correlativo}.txt
      // Estructura: Periodo, CAR-SUNAT, Comprobante, Doc Sustenta, Sujeto No Domiciliado, Beneficiario, Renta
      'RCE AJUSTES POST 2': {
        tipoNombre: 'le_rce_ajustes_2',
        columnas: [
          'col1_periodo', 'col2_carSunat',
          'col3_fecEmision', 'col4_tipo', 'col5_serie', 'col6_damODsi', 'col7_numeroCp',
          'col8_otrosConceptos', 'col9_importeTotal',
          'col10_tipoDocSustenta', 'col11_serieSustenta', 'col12_damODsiSustenta', 'col13_numeroCpSustenta',
          'col14_montoRetencionIgv', 'col15_codigoMoneda', 'col16_tipoCambio',
          'col17_paisNoDomiciliado', 'col18_apellidosNombresNoDom', 'col19_domicilioExtranjero',
          'col20_numIdentificacion', 'col21_numIdentifFiscal',
          'col22_apellidosNombresBenef', 'col23_paisBeneficiario', 'col24_vinculoCR',
          'col25_rentaBruta', 'col26_deduccCosto', 'col27_rentaNeta', 'col28_tasaRetencion',
          'col29_impuestoRetenido', 'col30_convenio', 'col31_exoneracionAplicada', 'col32_tipoRenta',
          'col33_modalidadServicio', 'col34_aplicacionArt76', 'col35_carCpModificar', 'col36_libreUtilizacion'
        ]
      },
      // RCE AJUSTES POST DIST 1 - 42 columnas (columnas 3-44)
      // Formato nombre: LE{RUC}{YYYYMM}00080400041{indicadorCont}{indicadorMoned}20{correlativo}.txt
      'RCE AJUSTES POST DIST 1': {
        tipoNombre: 'le_rce_ajustes_dist_1',
        columnas: [
          'col1_periodoAjuste', 'col2_cuo', 'col3_correlativoAsiento',
          'col4_fecEmision', 'col5_fecVence', 'col6_tipo', 'col7_serie', 'col8_damODsi',
          'col9_numInicial', 'col10_numFinal', 'col11_tipoDoc', 'col12_numDoc',
          'col13_razonSocialProveedor',
          'col14_baseImponibleGravada', 'col15_igvGravada', 'col16_baseImponibleGravadaExport',
          'col17_igvGravadaExport', 'col18_baseImponibleNoGravada', 'col19_igvNoGravada',
          'col20_adquisicionesNoGravadas', 'col21_isc', 'col22_icbper',
          'col23_otrosTributos', 'col24_importeTotal', 'col25_codigoMoneda', 'col26_tipoCambio',
          'col27_fecEmisionRef', 'col28_tipoRef', 'col29_serieRef', 'col30_damODsiRef', 'col31_numeroRef',
          'col32_clasificacionBsSs', 'col33_identificacionContrato', 'col34_porcentajeParticipacion',
          'col35_impuestoMateriaBeneficio', 'col36_carCpModificar',
          'col37_detraccion', 'col38_tipoNcNd', 'col39_estadoCp', 'col40_inconsistencia',
          'col41_libre', 'col42_libre'
        ]
      },
      // RCE AJUSTES POST DIST 2 - 32 columnas (columnas 3-34)
      // Formato nombre: LE{RUC}{YYYYMM}00080500061{indicadorCont}{indicadorMoned}20{correlativo}.txt
      'RCE AJUSTES POST DIST 2': {
        tipoNombre: 'le_rce_ajustes_dist_2',
        columnas: [
          'col1_periodoAjuste', 'col2_cuo', 'col3_correlativoAsiento',
          'col4_fecEmision', 'col5_fecVence', 'col6_tipo', 'col7_serie', 'col8_damODsi',
          'col9_numInicial', 'col10_numFinal', 'col11_tipoDoc', 'col12_numDoc',
          'col13_razonSocialProveedor',
          'col14_baseImponibleGravada', 'col15_igvGravada', 'col16_baseImponibleGravadaExport',
          'col17_igvGravadaExport', 'col18_baseImponibleNoGravada', 'col19_igvNoGravada',
          'col20_adquisicionesNoGravadas', 'col21_isc', 'col22_icbper',
          'col23_otrosTributos', 'col24_importeTotal', 'col25_codigoMoneda', 'col26_tipoCambio',
          'col27_fecEmisionRef', 'col28_tipoRef', 'col29_serieRef', 'col30_damODsiRef', 'col31_numeroRef',
          'col32_estado'
        ]
      }
    };

    return configuraciones[nombreHoja];
  }

  /**
   * Genera el nombre del archivo desde datos de la tabla según estándares SUNAT
   * @param {string} nombreHoja - Nombre de la hoja
   * @param {Object} datosEmpresa - Datos de la empresa
   * @param {Object} config - Configuración de generación
   * @param {string} correlativo - N° Correlativo (para RVIE COMPLEMENTA y RCE COMPLETA)
   * @param {string} indicadorCont - Indicador de contenido (1=SI, 0=NO)
   * @param {string} indicadorMoned - Indicador de moneda (1=PEN, 2=USD)
   * @param {string} comprobPago - Tipo de comprobante de pago (CP) para RCE COMPLETA
   */
  generarNombreArchivoDesdeTabla(nombreHoja, datosEmpresa, config, correlativo = '01', indicadorCont = '1', indicadorMoned = '1', comprobPago = 'CP') {
    const ruc = datosEmpresa?.ruc || '12345678901';
    const anio = datosEmpresa?.anio || new Date().getFullYear().toString();
    const mes = (datosEmpresa?.mes || (new Date().getMonth() + 1).toString()).toString().padStart(2, '0');

    // Usar el correlativo tal como viene (ya formateado desde el frontend)
    const corrFormateado = correlativo !== undefined && correlativo !== null ? correlativo.toString() : '01';

    // Indicadores para RVIE REEMPLAZA (usar !== undefined para manejar '0' correctamente)
    const indCont = indicadorCont !== undefined && indicadorCont !== null ? indicadorCont.toString() : '1';
    const indMoned = indicadorMoned !== undefined && indicadorMoned !== null ? indicadorMoned.toString() : '1';

    // Tipo de comprobante de pago para RCE COMPLETA
    const tipoCP = comprobPago !== undefined && comprobPago !== null ? comprobPago.toString() : 'CP';

    switch (config.tipoNombre) {
      // RVIE COMPLEMENTA: Formato {RUC}-CPF-{YYYYMM}-{CORRELATIVO}.txt
      case 'cpf_rvie':
        return `${ruc}-CPF-${anio}${mes}-${corrFormateado}.txt`;

      // RVIE REEMPLAZA: Formato LE{RUC}{YYYYMM}00140400021{indicadorCont}{indicadorMoned}2.txt
      // Ejemplo: LE1006223758420250500140400021112.txt (con indCont=1, indMoned=1)
      // Sin correlativo al final, termina con 2 fijo
      case 'le_rvie_reemplaza':
        return `LE${ruc}${anio}${mes}00140400021${indCont}${indMoned}2.txt`;

      // RVIE AJUSTES POST 1: Formato LE{RUC}{YYYYMM}000140400031{indicadorCont}{indicadorMoned}20{correlativo}.txt
      // Ejemplo: LE100622375842025050001404000311120001.txt (con indCont=1, indMoned=1, corr=01)
      case 'le_rvie_ajustes_1':
        return `LE${ruc}${anio}${mes}000140400031${indCont}${indMoned}20${corrFormateado.padStart(2, '0')}.txt`;

      // RVIE AJUSTES POST 2: Formato LE{RUC}{YYYYMM}0001404000411{indicadorCont}{indicadorMoned}{correlativo}.txt
      // Ejemplo: LE1006223758420250600014040004111201.txt (con indCont=1, indMoned=1, corr=01)
      case 'le_rvie_ajustes_2':
        return `LE${ruc}${anio}${mes}0001404000411${indCont}${indMoned}${corrFormateado.padStart(2, '0')}.txt`;

      // RCE COMPLETA: Formato {RUC}-{COMPROB_PAGO}-{YYYYMM}-{CORRELATIVO}.txt
      // Ejemplo: 10062237584-CP-202505-1.txt
      case 'le_rce_completa':
        return `${ruc}-${tipoCP}-${anio}${mes}-${corrFormateado}.txt`;

      // RCE NO DOMICILIADOS: Formato LE{RUC}{YYYYMM}00080500001{indicadorCont}{indicadorMoned}2.txt
      case 'le_rce_no_domiciliados':
        return `LE${ruc}${anio}${mes}00080500001${indCont}${indMoned}2.txt`;

      // RCE COMPLETA TC: Formato {RUC}-RCETCA-{YYYYMM}-{correlativo}.txt
      // Ejemplo: 10062237584-RCETCA-202506-1.txt
      case 'rce_completa_tc':
        return `${ruc}-RCETCA-${anio}${mes}-${corrFormateado}.txt`;

      // RCE REEMPLAZA: Formato LE{RUC}{YYYYMM}00080400021{indicadorCont}{indicadorMoned}2.txt
      case 'le_rce_reemplaza':
        return `LE${ruc}${anio}${mes}00080400021${indCont}${indMoned}2.txt`;

      // RCE AJUSTES POST 1: Formato LE{RUC}{YYYYMM}00{LLLLLL}{CC}{O}{I}{M}{G}{NN}.txt
      // LLLLLL=080400, CC=03, O=1, I=indCont, M=indMoned, G=2(fijo), NN=correlativo 2 dígitos
      // Total: 35 caracteres según estándar SUNAT
      case 'le_rce_ajustes_1':
        return `LE${ruc}${anio}${mes}00080400031${indCont}${indMoned}2${corrFormateado.padStart(2, '0')}.txt`;

      // RCE AJUSTES POST 2: Formato LE{RUC}{YYYYMM}0080500005{indicadorCont}{indicadorMoned}12{correlativo}.txt
      case 'le_rce_ajustes_2':
        return `LE${ruc}${anio}${mes}0080500005${indCont}${indMoned}12${corrFormateado}.txt`;

      // RCE AJUSTES POST DIST 1: Formato LE{RUC}{YYYYMM}00080400041{indicadorCont}{indicadorMoned}20{correlativo}.txt
      case 'le_rce_ajustes_dist_1':
        return `LE${ruc}${anio}${mes}00080400041${indCont}${indMoned}20${corrFormateado}.txt`;

      // RCE AJUSTES POST DIST 2: Formato LE{RUC}{YYYYMM}00080500061{indicadorCont}{indicadorMoned}20{correlativo}.txt
      case 'le_rce_ajustes_dist_2':
        return `LE${ruc}${anio}${mes}00080500061${indCont}${indMoned}20${corrFormateado}.txt`;

      default:
        return `${ruc}-${nombreHoja.replace(/\s+/g, '_')}-${anio}${mes}.txt`;
    }
  }

  /**
   * Genera el contenido TXT desde los datos de la tabla editable
   * Formato SUNAT: campo1|campo2|campo3|...|campoN|
   * Nota: RCE NO DOMICILIADOS no lleva pipe final
   */
  generarContenidoTXTDesdeTabla(datosTabla, nombreHoja, config) {
    const lineas = [];

    // RCE NO DOMICILIADOS no lleva pipe final
    const sinPipeFinal = nombreHoja === 'RCE NO DOMICILIADOS';

    for (const fila of datosTabla) {
      const campos = [];

      // Recorrer las columnas definidas en la configuración
      for (const columna of config.columnas) {
        let valor = fila[columna] || '';

        // Formatear valores según tipo
        if (typeof valor === 'number') {
          valor = this.formatearNumeroSUNAT(valor);
        } else {
          valor = valor.toString();
        }

        campos.push(valor);
      }

      // Unir campos con pipe (|) y agregar pipe final según estándar SUNAT (excepto RCE NO DOMICILIADOS)
      const lineaUnida = campos.join('|');
      lineas.push(sinPipeFinal ? lineaUnida : lineaUnida + '|');
    }

    // Retornar sin línea vacía al final
    return lineas.join('\n');
  }

  /**
   * Obtiene la configuración de generación para cada tipo de hoja según estándares SUNAT
   * RVIE COMPLEMENTA: 57 columnas (columnas C a AK = 3 a 35)
   * RVIE REEMPLAZA: 51 columnas (columnas C a AL = 3 a 36)
   * RVIE AJUSTES POST 1: 50 columnas (columnas C a AL = 3 a 36)
   * RVIE AJUSTES POST 2: 50 columnas (columnas C a AN = 3 a 38)
   */
  obtenerConfiguracionGeneracion(nombreHoja, workbook) {
    const configuraciones = {
      // Hojas RCE (Compras)
      'RCE COMPLETA': { filaInicio: 18, columnaInicio: 3, columnaFin: 38, tipoNombre: 'propuesta' },
      'RCE NO DOMICILIADOS': { filaInicio: 17, columnaInicio: 3, columnaFin: 37, tipoNombre: 'le' },
      'RCE COMPLETA TC': { filaInicio: 17, columnaInicio: 3, columnaFin: 7, tipoNombre: 'propuesta_tc' },
      'RCE REEMPLAZA': { filaInicio: 17, columnaInicio: 3, columnaFin: 53, tipoNombre: 'le_reemplaza' },
      'RCE AJUSTES POST 1': { filaInicio: 18, columnaInicio: 3, columnaFin: 39, tipoNombre: 'le_ajustes_1' },
      'RCE AJUSTES POST 2': { filaInicio: 18, columnaInicio: 3, columnaFin: 38, tipoNombre: 'le_ajustes_2' },
      'RCE AJUSTES POST DIST 1': { filaInicio: 18, columnaInicio: 3, columnaFin: 44, tipoNombre: 'le_ajustes_dist_1' },
      'RCE AJUSTES POST DIST 2': { filaInicio: 18, columnaInicio: 3, columnaFin: 34, tipoNombre: 'le_ajustes_dist_2' },

      // Hojas RVIE (Ventas) - Según estándares SUNAT
      // RVIE COMPLEMENTA: columnas C a AK (3 a 35) = 33 campos
      'RVIE COMPLEMENTA': { filaInicio: 18, columnaInicio: 3, columnaFin: 35, tipoNombre: 'cpf_rvie' },
      // RVIE REEMPLAZA: columnas C a AL (3 a 36) = 34 campos
      'RVIE REEMPLAZA': { filaInicio: 18, columnaInicio: 3, columnaFin: 36, tipoNombre: 'le_rvie_reemplaza' },
      // RVIE AJUSTES POST 1: columnas C a AL (3 a 36) = 34 campos
      'RVIE AJUSTES POST 1': { filaInicio: 18, columnaInicio: 3, columnaFin: 36, tipoNombre: 'le_rvie_ajustes_1' },
      // RVIE AJUSTES POST 2: columnas C a AN (3 a 38) = 36 campos
      'RVIE AJUSTES POST 2': { filaInicio: 18, columnaInicio: 3, columnaFin: 38, tipoNombre: 'le_rvie_ajustes_2' }
    };

    return configuraciones[nombreHoja];
  }

  /**
   * Genera el nombre del archivo según el tipo de hoja - Estándares SUNAT
   * 
   * Formato RVIE COMPLEMENTA (CPF): {RUC}-CPF-{YYYYMM}-{CORRELATIVO}.txt
   * Formato RVIE REEMPLAZA (LE): LE{RUC}{YYYYMM}001404{00021}{C6}{C7}2.txt
   * Formato RVIE AJUSTES POST 1 (LE): LE{RUC}{YYYYMM}0001404{00031}{C6}{C7}20{C8}.txt
   * Formato RVIE AJUSTES POST 2 (LE): LE{RUC}{YYYYMM}0001404{00041}{C6}{C7}20{C8}.txt
   */
  generarNombreArchivo(nombreHoja, workbook, config) {
    const inicioSheet = workbook.Sheets['INICIO'];
    const sheet = workbook.Sheets[nombreHoja];

    // Obtener datos de la hoja INICIO
    const ruc = this.getCellValue(inicioSheet, 'M4') || '12345678901';
    const anio = this.getCellValue(inicioSheet, 'D6') || new Date().getFullYear().toString();
    const mes = (this.getCellValue(inicioSheet, 'D8') || (new Date().getMonth() + 1).toString()).toString().padStart(2, '0');

    switch (config.tipoNombre) {
      // ========== HOJAS RCE (COMPRAS) ==========
      case 'propuesta':
        const codigoRCE = this.getCellValue(sheet, 'C6') || '001';
        return `${ruc}-${this.getCellValue(sheet, 'C7') || 'RCE'}-${anio}${mes}-${codigoRCE}.txt`;

      case 'propuesta_tc':
        const codigoTC = this.getCellValue(sheet, 'C6') || '001';
        return `${ruc}-RCETCA-${anio}${mes}-${codigoTC}.txt`;

      case 'le':
        return `LE${ruc}${anio}${mes}000805000011112.txt`;

      case 'le_reemplaza':
        const c6Reemplaza = this.getCellValue(sheet, 'C6') || '01';
        const c7Reemplaza = this.getCellValue(sheet, 'C7') || '01';
        return `LE${ruc}${anio}${mes}00080400021${c6Reemplaza}${c7Reemplaza}2.txt`;

      case 'le_ajustes_1':
        return `LE${ruc}${anio}${mes}00080500031${this.getCellValue(sheet, 'C6') || '01'}${this.getCellValue(sheet, 'C7') || '01'}20${this.getCellValue(sheet, 'C8') || '1'}.txt`;

      case 'le_ajustes_2':
        return `LE${ruc}${anio}${mes}00080500041${this.getCellValue(sheet, 'C6') || '01'}${this.getCellValue(sheet, 'C7') || '01'}20${this.getCellValue(sheet, 'C8') || '1'}.txt`;

      // ========== HOJAS RVIE (VENTAS) - ESTÁNDARES SUNAT ==========

      // RVIE COMPLEMENTA: Formato {RUC}-CPF-{YYYYMM}-{CORRELATIVO}.txt
      case 'cpf_rvie':
        const correlativoCPF = this.getCellValue(sheet, 'C6') || '001';
        return `${ruc}-CPF-${anio}${mes}-${correlativoCPF}.txt`;

      // RVIE REEMPLAZA: Formato LE{RUC}{YYYYMM}001404{00021}{C6}{C7}2.txt
      case 'le_rvie_reemplaza':
        const c6RvieReemplaza = this.getCellValue(sheet, 'C6') || '01';
        const c7RvieReemplaza = this.getCellValue(sheet, 'C7') || '01';
        return `LE${ruc}${anio}${mes}00140400021${c6RvieReemplaza}${c7RvieReemplaza}2.txt`;

      // RVIE AJUSTES POST 1: Formato LE{RUC}{YYYYMM}0001404{00031}{C6}{C7}20{C8}.txt
      case 'le_rvie_ajustes_1':
        const c6RvieAjustes1 = this.getCellValue(sheet, 'C6') || '01';
        const c7RvieAjustes1 = this.getCellValue(sheet, 'C7') || '01';
        const c8RvieAjustes1 = this.getCellValue(sheet, 'C8') || '1';
        return `LE${ruc}${anio}${mes}000140400031${c6RvieAjustes1}${c7RvieAjustes1}20${c8RvieAjustes1}.txt`;

      // RVIE AJUSTES POST 2: Formato LE{RUC}{YYYYMM}0001404{00041}{C6}{C7}20{C8}.txt
      case 'le_rvie_ajustes_2':
        const c6RvieAjustes2 = this.getCellValue(sheet, 'C6') || '01';
        const c7RvieAjustes2 = this.getCellValue(sheet, 'C7') || '01';
        const c8RvieAjustes2 = this.getCellValue(sheet, 'C8') || '1';
        return `LE${ruc}${anio}${mes}000140400041${c6RvieAjustes2}${c7RvieAjustes2}20${c8RvieAjustes2}.txt`;

      default:
        return `${ruc}-${nombreHoja.replace(/\s+/g, '_')}-${anio}${mes}.txt`;
    }
  }

  /**
   * Genera el contenido del archivo TXT según estándares SUNAT
   * Formato: campo1|campo2|campo3|...|campoN|
   * Cada línea termina con pipe (|)
   * Sin línea vacía al final
   */
  generarContenidoTXT(sheet, config) {
    const lineas = [];
    const range = XLSX.utils.decode_range(sheet['!ref']);

    // Buscar última fila con datos (verificando columna B)
    let ultimaFila = 0;
    for (let row = range.e.r; row >= config.filaInicio - 1; row--) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 1 }); // Columna B
      if (sheet[cellAddress] && sheet[cellAddress].v) {
        ultimaFila = row;
        break;
      }
    }

    // Si no hay datos, retornar vacío
    if (ultimaFila < config.filaInicio - 1) {
      logger.warn('No se encontraron datos para generar TXT');
      return '';
    }

    // Generar líneas del archivo según estándar SUNAT
    for (let fila = config.filaInicio - 1; fila <= ultimaFila; fila++) {
      const campos = [];

      // Columna de inicio (generalmente C = índice 2)
      const colInicio = config.columnaInicio ? config.columnaInicio - 1 : 2;

      // Leer desde columna de inicio hasta la columna final especificada
      for (let col = colInicio; col < config.columnaFin; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: fila, c: col });
        let valor = '';

        if (sheet[cellAddress]) {
          const cell = sheet[cellAddress];

          // Manejar diferentes tipos de datos
          if (cell.t === 'n') {
            // Número: formatear sin notación científica
            valor = this.formatearNumeroSUNAT(cell.v);
          } else if (cell.t === 'd') {
            // Fecha: formatear como dd/mm/yyyy
            valor = this.formatearFechaSUNAT(cell.v);
          } else {
            // Texto u otro
            valor = cell.v !== null && cell.v !== undefined ? cell.v.toString() : '';
          }
        }

        campos.push(valor);
      }

      // Unir campos con pipe (|) y agregar pipe final según estándar SUNAT
      lineas.push(campos.join('|') + '|');
    }

    // Retornar sin línea vacía al final
    return lineas.join('\n');
  }

  /**
   * Formatea números según estándar SUNAT (sin notación científica, máximo 2 decimales para montos)
   */
  formatearNumeroSUNAT(valor) {
    if (valor === null || valor === undefined || valor === '') return '';

    const num = parseFloat(valor);
    if (isNaN(num)) return valor.toString();

    // Si es entero, retornar sin decimales
    if (Number.isInteger(num)) {
      return num.toString();
    }

    // Si tiene decimales, formatear con máximo 2 decimales
    return num.toFixed(2);
  }

  /**
   * Formatea fechas según estándar SUNAT (dd/mm/yyyy)
   */
  formatearFechaSUNAT(valor) {
    if (!valor) return '';

    try {
      let fecha;

      if (valor instanceof Date) {
        fecha = valor;
      } else if (typeof valor === 'number') {
        // Fecha de Excel (número de días desde 1900)
        fecha = new Date((valor - 25569) * 86400 * 1000);
      } else {
        fecha = new Date(valor);
      }

      if (isNaN(fecha.getTime())) return valor.toString();

      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const anio = fecha.getFullYear();

      return `${dia}/${mes}/${anio}`;
    } catch {
      return valor.toString();
    }
  }

  /**
   * Comprime el archivo TXT en formato ZIP
   */
  async comprimirArchivo(rutaTXT) {
    try {
      const rutaZIP = rutaTXT.replace('.txt', '.zip');

      // Eliminar ZIP existente si existe
      try {
        await fs.unlink(rutaZIP);
      } catch {
        // Ignorar si no existe
      }

      const zip = new AdmZip();
      zip.addLocalFile(rutaTXT);
      zip.writeZip(rutaZIP);

      return rutaZIP;
    } catch (error) {
      logger.error('Error al comprimir archivo', { error: error.message });
      throw error;
    }
  }

  /**
   * Carga los datos de una hoja específica
   */
  async cargarDatosHoja(nombreHoja) {
    try {
      logger.info('Cargando datos de hoja', { nombreHoja });

      const ajustesPath = path.join(this.dataPath, 'AJUSTES.xlsm');

      // Verificar si existe el archivo, si no, crearlo
      try {
        await fs.access(ajustesPath);
      } catch {
        logger.info('Archivo AJUSTES.xlsm no encontrado, creando archivo de ejemplo...');
        await ajustesExcelCreator.crearArchivoEjemplo();
      }

      const workbook = XLSX.readFile(ajustesPath);
      let sheet = workbook.Sheets[nombreHoja];

      if (!sheet) {
        logger.warn(`Hoja ${nombreHoja} no encontrada, creando hoja de ejemplo...`);
        sheet = this.crearHojaEjemplo(nombreHoja);
        workbook.Sheets[nombreHoja] = sheet;
        XLSX.writeFile(workbook, ajustesPath);
      }

      // Cargar datos reales de la hoja
      const datosReales = this.cargarDatosRealesHoja(sheet, nombreHoja);

      logger.info('Datos de hoja cargados exitosamente', { nombreHoja });

      return {
        success: true,
        datos: datosReales,
        message: `Datos de ${nombreHoja} cargados correctamente`
      };

    } catch (error) {
      logger.error('Error al cargar datos de hoja', { error: error.message, nombreHoja });
      return { success: false, error: error.message };
    }
  }

  /**
   * Carga datos reales de la hoja Excel
   */
  cargarDatosRealesHoja(sheet, nombreHoja) {
    try {
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      const config = this.obtenerConfiguracionHoja(nombreHoja);

      if (!config) {
        return {
          datosGenerador: [],
          datosComprobante: [],
          datosCliente: []
        };
      }

      const datosGenerador = [];
      const datosComprobante = [];
      const datosCliente = [];

      const isRVIE = nombreHoja.startsWith('RVIE');
      const startRow = isRVIE ? 7 : (config.filaInicio - 1);

      // Leer datos desde la fila de inicio hasta la última fila con datos
      for (let row = startRow; row <= range.e.r; row++) {
        // Verificar si la fila tiene datos (columna B no vacía)
        const cellB = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })];
        if (!cellB || !cellB.v) continue;

        // Leer datos del generador (columnas principales)
        const datosRow = {
          id: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 1 })) || row - startRow + 1,
          ruc: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 2 })) || '',
          razonSocial: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 3 })) || '',
          periodo: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 4 })) || '',
          carSunat: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 5 })) || '',
          fechaEmision: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 6 })) || '',
          tipoDoc: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 7 })) || '',
          serie: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 8 })) || '',
          numero: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 9 })) || '',
          tipoDocCliente: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 10 })) || '',
          rucCliente: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 11 })) || '',
          razonSocialCliente: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 12 })) || '',
          baseImponible: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: isRVIE ? 14 : 13 })) || '',
          igv: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: isRVIE ? 16 : 14 })) || '',
          total: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: isRVIE ? 25 : 15 })) || ''
        };

        if (datosRow.ruc || datosRow.razonSocial) {
          datosGenerador.push(datosRow);
        }

        // Datos del comprobante (columnas extendidas)
        const comprobanteRow = {
          valorFacturado: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 16 })) || '',
          baseImponible: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 17 })) || '',
          descuento: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 18 })) || '',
          dvPiem: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 19 })) || '',
          descuentoGlobal: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 20 })) || '',
          operacionExonerada: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 21 })) || '',
          operacionInafecta: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 22 })) || '',
          isc: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 23 })) || '',
          baseImponibleIgv: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 24 })) || '',
          igv: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 25 })) || '',
          icbper: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 26 })) || '',
          otrosTributos: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 27 })) || '',
          importeTotal: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 28 })) || '',
          codigoMoneda: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 29 })) || '',
          tipoOperacion: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 30 })) || '',
          documentoReferencia: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 31 })) || '',
          fechaEmision: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 32 })) || '',
          tipo: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 33 })) || '',
          serie: this.getCellValue(sheet, XLSX.utils.encode_cell({ r: row, c: 34 })) || ''
        };

        if (Object.values(comprobanteRow).some(val => val !== '')) {
          datosComprobante.push(comprobanteRow);
        }

        // Datos del cliente
        const clienteRow = {
          tipoDoc: datosRow.tipoDocCliente,
          numeroDoc: datosRow.rucCliente,
          apellidosNombres: datosRow.razonSocialCliente
        };

        if (clienteRow.numeroDoc && clienteRow.apellidosNombres) {
          // Evitar duplicados
          const existe = datosCliente.find(c => c.numeroDoc === clienteRow.numeroDoc);
          if (!existe) {
            datosCliente.push(clienteRow);
          }
        }
      }

      return {
        nombreHoja,
        datosGenerador,
        datosComprobante,
        datosCliente
      };
    } catch (error) {
      logger.error('Error al cargar datos reales de hoja', { error: error.message, nombreHoja });
      return {
        datosGenerador: [],
        datosComprobante: [],
        datosCliente: []
      };
    }
  }

  /**
   * Guarda los datos editados en la hoja Excel
   * Soporta las estructuras RVIE con 57, 51 y 50 columnas
   */
  async guardarDatosEditados(nombreHoja, datosEditados) {
    try {
      const cantidadFilas = datosEditados.datosUnificados?.length || datosEditados.datosGenerador?.length || 0;
      logger.info('Guardando datos editados', { nombreHoja, cantidadFilas });

      const ajustesPath = path.join(this.dataPath, 'AJUSTES.xlsm');

      // Verificar si existe el archivo
      try {
        await fs.access(ajustesPath);
      } catch {
        logger.info('Archivo AJUSTES.xlsm no encontrado, creando archivo de ejemplo...');
        await ajustesExcelCreator.crearArchivoEjemplo();
      }

      const workbook = XLSX.readFile(ajustesPath);
      let sheet = workbook.Sheets[nombreHoja];

      if (!sheet) {
        // Crear hoja si no existe
        sheet = this.crearHojaEjemplo(nombreHoja);
        workbook.Sheets[nombreHoja] = sheet;
        if (!workbook.SheetNames.includes(nombreHoja)) {
          workbook.SheetNames.push(nombreHoja);
        }
      }

      // Obtener configuración de la hoja
      const config = this.obtenerConfiguracionHoja(nombreHoja) || { filaInicio: 18, columnaReferencia: 'G' };
      const configGen = this.obtenerConfiguracionGeneracion(nombreHoja, workbook);

      // Limpiar datos existentes desde la fila de inicio
      const columnaFin = configGen ? configGen.columnaFin : 60;
      this.limpiarDatosHojaExtendida(sheet, config.filaInicio, columnaFin);

      // Determinar qué datos usar (datosUnificados tiene prioridad para tablas RVIE)
      const datos = datosEditados.datosUnificados || datosEditados.datosGenerador || [];

      if (datos.length > 0) {
        // Guardar según el tipo de hoja
        if (nombreHoja.startsWith('RVIE')) {
          this.guardarDatosRVIE(sheet, config, datos, nombreHoja);
        } else {
          this.guardarDatosRCE(sheet, config, datos);
        }

        // Actualizar rango de la hoja
        const ultimaFila = config.filaInicio + datos.length - 1;
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        range.e.r = Math.max(range.e.r, ultimaFila - 1);
        range.e.c = Math.max(range.e.c, columnaFin - 1);
        sheet['!ref'] = XLSX.utils.encode_range(range);
      }

      // Guardar archivo
      XLSX.writeFile(workbook, ajustesPath);

      logger.info('Datos editados guardados correctamente', { nombreHoja, filasGuardadas: datos.length });

      return {
        success: true,
        message: `Datos guardados correctamente en ${nombreHoja}`,
        filasGuardadas: datos.length
      };

    } catch (error) {
      logger.error('Error al guardar datos editados', { error: error.message, nombreHoja });
      return { success: false, error: error.message };
    }
  }

  /**
   * Guarda datos específicos para hojas RVIE (57, 51 o 50 columnas)
   */
  guardarDatosRVIE(sheet, config, datos, nombreHoja) {
    datos.forEach((row, index) => {
      const fila = config.filaInicio + index;

      // Columna B: ID/Número secuencial
      this.setCellValue(sheet, fila, 1, row.id || index + 1);

      // Columnas según estructura RVIE (C en adelante = índice 2+)
      // Columna C (2): RUC
      this.setCellValue(sheet, fila, 2, row.col1_ruc || '');
      // Columna D (3): Razón Social
      this.setCellValue(sheet, fila, 3, row.col2_razonSocial || '');
      // Columna E (4): Periodo
      this.setCellValue(sheet, fila, 4, row.col3_periodo || '');
      // Columna F (5): CAR SUNAT
      this.setCellValue(sheet, fila, 5, row.col4_carSunat || '');
      // Columna G (6): Fecha Emisión
      this.setCellValue(sheet, fila, 6, row.col5_fecEmision || '');
      // Columna H (7): Fecha Vencimiento
      this.setCellValue(sheet, fila, 7, row.col6_fecVence || '');
      // Columna I (8): Tipo
      this.setCellValue(sheet, fila, 8, row.col7_tipo || '');
      // Columna J (9): Serie
      this.setCellValue(sheet, fila, 9, row.col8_serie || '');
      // Columna K (10): Num Inicial
      this.setCellValue(sheet, fila, 10, row.col9_numInicial || '');
      // Columna L (11): Num Final
      this.setCellValue(sheet, fila, 11, row.col10_numFinal || '');
      // Columna M (12): Tipo Doc
      this.setCellValue(sheet, fila, 12, row.col11_tipoDoc || '');
      // Columna N (13): Num Doc Cliente
      this.setCellValue(sheet, fila, 13, row.col12_numDocCliente || row.col12_numDoc || '');
      // Columna O (14): Razón Social Cliente
      this.setCellValue(sheet, fila, 14, row.col13_razonSocialCliente || '');
      // Columna P (15): Valor Exportación
      this.setCellValue(sheet, fila, 15, row.col14_valorExportacion || '');
      // Columna Q (16): Base Imponible Gravada
      this.setCellValue(sheet, fila, 16, row.col15_baseImponibleGravada || '');
      // Columna R (17): Descuento Base Imponible
      this.setCellValue(sheet, fila, 17, row.col16_descuentoBaseImponible || '');
      // Columna S (18): IGV/IPM
      this.setCellValue(sheet, fila, 18, row.col17_igvIpm || '');
      // Columna T (19): Descuento IGV/IPM
      this.setCellValue(sheet, fila, 19, row.col18_descuentoIgvIpm || '');
      // Columna U (20): Operación Exonerada
      this.setCellValue(sheet, fila, 20, row.col19_operacionExonerada || '');
      // Columna V (21): Operación Inafecta
      this.setCellValue(sheet, fila, 21, row.col20_operacionInafecta || '');
      // Columna W (22): ISC
      this.setCellValue(sheet, fila, 22, row.col21_isc || '');
      // Columna X (23): Base Imponible IVAP
      this.setCellValue(sheet, fila, 23, row.col22_baseImponibleIvap || '');
      // Columna Y (24): IVAP
      this.setCellValue(sheet, fila, 24, row.col23_ivap || '');
      // Columna Z (25): ICBPER
      this.setCellValue(sheet, fila, 25, row.col24_icbper || '');
      // Columna AA (26): Otros Tributos
      this.setCellValue(sheet, fila, 26, row.col25_otrosTributos || '');
      // Columna AB (27): Importe Total
      this.setCellValue(sheet, fila, 27, row.col26_importeTotal || '');
      // Columna AC (28): Código Moneda
      this.setCellValue(sheet, fila, 28, row.col27_codigoMoneda || '');
      // Columna AD (29): Tipo Cambio
      this.setCellValue(sheet, fila, 29, row.col28_tipoCambio || '');
      // Columna AE (30): Fecha Emisión Ref
      this.setCellValue(sheet, fila, 30, row.col29_fecEmisionRef || '');
      // Columna AF (31): Tipo Ref
      this.setCellValue(sheet, fila, 31, row.col30_tipoRef || '');
      // Columna AG (32): Serie Ref
      this.setCellValue(sheet, fila, 32, row.col31_serieRef || '');
      // Columna AH (33): Número Ref
      this.setCellValue(sheet, fila, 33, row.col32_numeroRef || '');
      // Columna AI (34): Identificación Contrato
      this.setCellValue(sheet, fila, 34, row.col33_identificacionContrato || '');

      // Columnas adicionales solo para RVIE COMPLEMENTA (57 columnas)
      if (nombreHoja === 'RVIE COMPLEMENTA') {
        this.setCellValue(sheet, fila, 35, row.col34_tipoNcNd || '');
        this.setCellValue(sheet, fila, 36, row.col35_estadoComprobante || '');
        this.setCellValue(sheet, fila, 37, row.col36_usoInterno || '');
        this.setCellValue(sheet, fila, 38, row.col37_valorOpGratuitas || '');
        this.setCellValue(sheet, fila, 39, row.col38_tipoOperacion || '');
        this.setCellValue(sheet, fila, 40, row.col39_inconsistencias || '');
        this.setCellValue(sheet, fila, 41, row.col40_usoInternoSunat || '');

        // Columnas de libre utilización (41-57)
        for (let i = 41; i <= 57; i++) {
          this.setCellValue(sheet, fila, i + 1, row[`col${i}_libre`] || '');
        }
      } else {
        // Para RVIE REEMPLAZA y AJUSTES POST: columnas de libre utilización
        for (let i = 41; i <= 57; i++) {
          const colIndex = nombreHoja === 'RVIE REEMPLAZA' ? 34 + (i - 41) : 35 + (i - 41);
          if (colIndex < 60) {
            this.setCellValue(sheet, fila, colIndex, row[`col${i}_libre`] || '');
          }
        }
      }
    });
  }

  /**
   * Guarda datos para hojas RCE (formato anterior)
   */
  guardarDatosRCE(sheet, config, datos) {
    datos.forEach((row, index) => {
      const fila = config.filaInicio + index;

      this.setCellValue(sheet, fila, 1, row.id || index + 1);
      this.setCellValue(sheet, fila, 2, row.ruc || row.col1_ruc || '');
      this.setCellValue(sheet, fila, 3, row.razonSocial || row.col2_razonSocial || '');
      this.setCellValue(sheet, fila, 4, row.periodo || row.col3_periodo || '');
      this.setCellValue(sheet, fila, 5, row.carSunat || row.col4_carSunat || '');
      this.setCellValue(sheet, fila, 6, row.fechaEmision || row.col5_fecEmision || '');
      this.setCellValue(sheet, fila, 7, row.tipoDoc || row.col7_tipo || '');
      this.setCellValue(sheet, fila, 8, row.serie || row.col8_serie || '');
      this.setCellValue(sheet, fila, 9, row.numero || row.col9_numInicial || '');
      this.setCellValue(sheet, fila, 10, row.tipoDocCliente || row.col11_tipoDoc || '');
      this.setCellValue(sheet, fila, 11, row.rucCliente || row.col12_numDocCliente || '');
      this.setCellValue(sheet, fila, 12, row.razonSocialCliente || row.col13_razonSocialCliente || '');
      this.setCellValue(sheet, fila, 13, row.baseImponible || row.col15_baseImponibleGravada || '');
      this.setCellValue(sheet, fila, 14, row.igv || row.col17_igvIpm || '');
      this.setCellValue(sheet, fila, 15, row.total || row.col26_importeTotal || '');
    });
  }

  /**
   * Limpia datos de la hoja con rango extendido para tablas RVIE
   */
  limpiarDatosHojaExtendida(sheet, filaInicio, columnaFin) {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');

    for (let row = filaInicio - 1; row <= range.e.r; row++) {
      for (let col = 1; col < columnaFin; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        delete sheet[cellAddress];
      }
    }
  }

  /**
   * Establece el valor de una celda específica
   */
  setCellValue(sheet, fila, columna, valor) {
    const cellAddress = XLSX.utils.encode_cell({ r: fila - 1, c: columna });

    if (valor !== null && valor !== undefined && valor !== '') {
      // Determinar tipo de dato
      const esNumero = !isNaN(valor) && !isNaN(parseFloat(valor)) && valor !== '';

      sheet[cellAddress] = {
        v: esNumero ? parseFloat(valor) : valor.toString(),
        t: esNumero ? 'n' : 's'
      };
    } else {
      // Si el valor está vacío, eliminar la celda
      delete sheet[cellAddress];
    }
  }

  /**
   * Elimina un archivo físicamente
   */
  async borrarArchivo(nombreArchivo, ruc) {
    try {
      const rutaArchivo = ruc 
        ? path.join(this.outputPath, ruc.toString(), nombreArchivo)
        : path.join(this.outputPath, nombreArchivo);

      logger.info('Intentando borrar archivo', { rutaArchivo });

      await fs.unlink(rutaArchivo);

      // Si es un TXT, intentar borrar también el ZIP si existe
      if (nombreArchivo.endsWith('.txt')) {
        const rutaZip = rutaArchivo.replace('.txt', '.zip');
        try {
          await fs.unlink(rutaZip);
        } catch {
          // Ignorar si no existe el ZIP
        }
      }

      return { success: true, message: 'Archivo eliminado correctamente' };
    } catch (error) {
      logger.error('Error al eliminar archivo', { error: error.message });
      return { success: false, error: 'No se pudo eliminar el archivo: ' + error.message };
    }
  }
}

module.exports = new SireAjustesHandler();