const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const excelReader = require('./excelReader');
const { ipcMain, shell } = require('electron');
const axios = require('axios');

/**
 * Handler para Consulta de CPE via Web Scraping
 * Portal: https://e-factura.sunat.gob.pe
 */
class CPEScrapingHandler {
    constructor() {
        this.activeSessions = new Map();
        this.downloadPath = path.join(process.cwd(), 'descargas_cpe');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath, { recursive: true });
            logger.info('Directorio de descargas CPE creado', { path: this.downloadPath });
        }
        const screenshotsPath = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotsPath)) {
            fs.mkdirSync(screenshotsPath, { recursive: true });
        }
    }

    /**
     * Obtiene credenciales desde API_SIRE.xlsm
     */
    async obtenerCredenciales(ruc) {
        try {
            const apiSirePath = path.join(process.cwd(), 'data', 'API_SIRE.xlsm');

            if (!fs.existsSync(apiSirePath)) {
                return { success: false, error: 'No se encontró API_SIRE.xlsm' };
            }

            const clientes = await excelReader.readClients(apiSirePath);
            const cliente = clientes.find(c => c.ruc === ruc);

            if (!cliente) {
                return { success: false, error: `No se encontró RUC ${ruc} en API_SIRE.xlsm` };
            }

            return {
                success: true,
                data: {
                    ruc: cliente.ruc,
                    razonSocial: cliente.empresa,
                    usuario_sol: cliente.usuario_sol || cliente.usuario,
                    clave_sol: cliente.clave_sol || cliente.clave
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene lista de empresas desde API_SIRE.xlsm
     */
    async obtenerEmpresas() {
        try {
            const apiSirePath = path.join(process.cwd(), 'data', 'API_SIRE.xlsm');

            if (!fs.existsSync(apiSirePath)) {
                return { success: false, error: 'No se encontró API_SIRE.xlsm', empresas: [] };
            }

            const clientes = await excelReader.readClients(apiSirePath);
            const empresas = clientes.map(c => ({
                ruc: c.ruc,
                razonSocial: c.empresa
            }));

            return { success: true, empresas };
        } catch (error) {
            return { success: false, error: error.message, empresas: [] };
        }
    }

    /**
     * Consulta CPE via web scraping
     * Flujo: 1) Login en SOL  2) Navegar al portal CPE  3) Consultar
     */
    async consultarCPE(rucConsultante, { rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' }) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando consulta CPE via web scraping', { rucConsultante, rucEmisor, serie, numero });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            browser = await chromium.launch({
                headless: true, // Headless para entornos Linux/Cloud y Electron
                // slowMo: 0, // Eliminado para mayor velocidad
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--start-maximized'
                ]
            });

            const context = await browser.newContext({
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1366, height: 900 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detección
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // ========== PASO 1: LOGIN EN SUNAT SOL ==========
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('PASO 1: Navegando al login SUNAT', { url: loginUrl });

            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Esperar formulario de login
            logger.info('Esperando formulario de login...');
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Rellenar formulario
            logger.info('Rellenando credenciales...');
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);
            await page.waitForTimeout(500);

            logger.info('Enviando login...', { ruc: cliente.ruc, usuario: cliente.usuario_sol });

            // Click en login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar carga
            await page.waitForTimeout(3000);

            let currentUrl = page.url();
            logger.info('URL después de login:', { url: currentUrl });

            // Si estamos en api-seguridad (OAuth), navegar al menú principal
            if (currentUrl.includes('api-seguridad')) {
                logger.info('Detectada página OAuth, navegando al menú principal...');
                const menuUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
                await page.goto(menuUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(3000);
                currentUrl = page.url();
                logger.info('URL después de navegar al menú:', { url: currentUrl });
            }


            logger.info('Login exitoso, continuando...');

            // ========== PASO 2: NAVEGACIÓN DIRECTA A LA INTERFAZ ==========
            // Navegamos directamente al link de consulta de facturas sin clicks en el menú
            logger.info('PASO 2: Navegando directamente a la interfaz de consulta de facturas...');

            const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
            await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Esperar procesamiento de la navegación directa
            await page.waitForTimeout(3000);

            // Capturar la URL actual
            currentUrl = page.url();
            logger.info('URL después de navegación directa:', { url: currentUrl });

            // ========== PASO 3: NAVEGAR AL PORTAL CPE ==========
            const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
            logger.info('PASO 3: Navegando al portal CPE...', { url: cpeUrl });

            await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Esperar que cargue el formulario Angular
            logger.info('Esperando carga del formulario Angular...');
            await page.waitForTimeout(5000);

            // ========== PASO 4: RELLENAR FORMULARIO DE CONSULTA ==========
            logger.info('PASO 4: Rellenando formulario de consulta...');

            // Seleccionar "Recibido" o "Emitido" según el filtro
            if (filtro === 'recibido') {
                try {
                    await page.click('label[for="recibido"]');
                    logger.info('Seleccionado: Recibido');
                } catch (e) {
                    await page.click('#recibido');
                }
            } else {
                try {
                    await page.click('label[for="emitido"]');
                    logger.info('Seleccionado: Emitido');
                } catch (e) {
                    await page.click('#emitido');
                }
            }
            // await page.waitForTimeout(100);

            // Rellenar RUC Emisor (input[name="rucEmisor"])
            try {
                await page.fill('input[name="rucEmisor"]', rucEmisor);
                logger.info('RUC Emisor rellenado', { ruc: rucEmisor });
            } catch (e) {
                await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
            }
            // await page.waitForTimeout(100);

            // Tipo Comprobante (p-dropdown)
            try {
                const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito' };
                const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

                // Optimización: Click directo y selección rápida
                await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]');
                await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 2000 }).catch(() => page.click(`text=${tipoLabel}`));
                logger.info('Tipo comprobante seleccionado', { tipo: tipoLabel });
            } catch (e) {
                logger.warn('Error seleccionando tipo comprobante:', e.message);
            }
            // await page.waitForTimeout(100);

            // Serie (input[name="serieComprobante"])
            try {
                await page.fill('input[name="serieComprobante"]', serie);
                logger.info('Serie rellenada', { serie });
            } catch (e) {
                await page.fill('input[formcontrolname="serieComprobante"]', serie);
            }
            // await page.waitForTimeout(100);

            // Número (input[name="numeroComprobante"])
            try {
                await page.fill('input[name="numeroComprobante"]', numero);
                logger.info('Número rellenado', { numero });
            } catch (e) {
                await page.fill('input[formcontrolname="numeroComprobante"]', numero);
            }
            // await page.waitForTimeout(100);


            // Click en "Consultar"
            logger.info('Haciendo click en Consultar...');
            try {
                await page.click('button.boton-primary:has-text("Consultar")');
            } catch (e) {
                await page.click('button[type="submit"]:has-text("Consultar")');
            }

            // Esperar resultado
            await page.waitForTimeout(3000);


            // Extraer resultado - mejorado para detectar datos específicos del formato HTML
            const resultado = await page.evaluate(() => {
                const body = document.body.innerText;
                const modal = document.querySelector('div[role="document"].modal-dialog');

                // Si no hay modal de resultado, verificamos mensajes de texto simple
                if (!modal) {
                    if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
                        return { estado: 'NO_ENCONTRADO', encontrado: false };
                    }
                    if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true };
                    return { estado: 'PENDIENTE_REVISION', encontrado: false };
                }

                // Extracción de datos específicos del HTML (si existe el modal)
                const datos = {
                    estado: 'ENCONTRADO',
                    encontrado: true,
                    html: modal.outerHTML, // Guardamos todo el HTML para renderizarlo igual
                    razonSocial: '',
                    rucEmisor: '',
                    fechaEmision: '',
                    importeTotal: ''
                };

                // 1. Razón Social (Clase .emisor)
                const emisorTable = modal.querySelector('table.emisor');
                if (emisorTable) {
                    const bTags = emisorTable.querySelectorAll('b');
                    if (bTags.length > 0) datos.razonSocial = bTags[0].innerText.trim();
                }

                // 2. RUC Emisor y Número (Clase .comprobante-numeracion)
                const numeracionTable = modal.querySelector('table.comprobante-numeracion');
                if (numeracionTable) {
                    const tds = numeracionTable.querySelectorAll('td');
                    tds.forEach(td => {
                        const text = td.innerText;
                        if (text.includes('RUC:')) datos.rucEmisor = text.replace('RUC:', '').trim();
                    });
                }

                // 3. Fecha de Emisión (Clase .comprobante-datosprincipales)
                const filasDatos = modal.querySelectorAll('tr.comprobante-datosprincipales');
                filasDatos.forEach(tr => {
                    const tds = tr.querySelectorAll('td');
                    if (tds.length >= 3 && tds[0].innerText.includes('Fecha de Emisión')) {
                        datos.fechaEmision = tds[2].innerText.trim();
                    }
                });

                // 4. Importe Total (Clase .comprobante-totales)
                const totalesTable = modal.querySelector('table.comprobante-totales');
                if (totalesTable) {
                    const filas = totalesTable.querySelectorAll('tr');
                    filas.forEach(tr => {
                        const tds = tr.querySelectorAll('td');
                        if (tds.length >= 3 && tds[0].innerText.includes('Importe total')) {
                            datos.importeTotal = tds[2].innerText.trim();
                        }
                    });
                }

                // Determinar estado basado en el contenido visual si es posible, sino default ENCONTRADO
                if (body.includes('Estado del comprobante: ACEPTADO') || body.includes('ACTIVO')) {
                    datos.estado = 'ACEPTADO';
                } else if (body.includes('ANULADO') || body.includes('BAJA')) {
                    datos.estado = 'ANULADO';
                }

                return datos;
            });

            // Guardar sesión para descargas
            const sessionId = `cpe_${rucConsultante}_${Date.now()}`;

            this.activeSessions.set(sessionId, { browser, page, context, cliente, cpe: { rucEmisor, tipoDoc, serie, numero } });

            logger.info('Consulta CPE completada', { resultado, sessionId });

            return {
                success: true,
                data: resultado,
                sessionId,
                cpeId: `${rucEmisor}-${tipoDoc}-${serie}-${numero}`
            };
        } catch (error) {
            logger.error('Error en consulta CPE', { error: error.message, stack: error.stack });



            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Helper universal para descargas seguras (Estrategia tipo Buzón: Native Playwright Download)
     * Espera el evento de descarga nativo del navegador en lugar de interceptar red manualmente.
     */
    async _descargarArchivoInterceptado(session, selector, tipoArchivo, extension) {
        const { page, cliente, cpe } = session;
        const tempPath = path.join(this.downloadPath, cliente.ruc);
        if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });

        try {
            logger.info(`Iniciando descarga nativa de ${tipoArchivo}...`);

            // 1. Encontrar el botón (misma lógica robusta)
            let btn = null;
            if (tipoArchivo === 'pdf') {
                btn = await page.$('button[ngbtooltip="Descargar PDF"]') || await page.$('button i.fa-file-pdf');
            } else if (tipoArchivo === 'xml') {
                btn = await page.$('button[ngbtooltip="Descargar XML"]') || await page.$('button i.fa-file-code');
            } else if (tipoArchivo === 'cdr') {
                btn = await page.evaluateHandle(() => {
                    const tilde = document.querySelector('button[ngbtooltip="Descargar CDR"]');
                    if (tilde) return tilde;
                    const icons = Array.from(document.querySelectorAll('i'));
                    const icon = icons.find(i => i.classList.contains('fa-file-contract') || i.classList.contains('fa-file-signature'));
                    return icon ? icon.closest('button') : null;
                });
            }

            if (!btn) throw new Error(`Botón de descarga ${tipoArchivo} no encontrado. Verifique resultados.`);

            // Debug: Loguear el HTML del botón encontrado para verificar
            const btnHtml = await btn.evaluate(b => b.outerHTML);
            logger.info(`Botón ${tipoArchivo} encontrado:`, { html: btnHtml });

            // Verificar si el botón está deshabilitado
            const isDisabled = await btn.evaluate(b => b.hasAttribute('disabled') || b.classList.contains('disabled'));
            if (isDisabled) {
                logger.warn(`El botón de descarga ${tipoArchivo} está deshabilitado (Posiblemente no disponible).`);
                return { success: false, error: `${tipoArchivo.toUpperCase()} no disponible (Botón deshabilitado)` };
            }

            // 2. Preparar espera del evento 'download' (Timeout aumentado a 60s por seguridad)
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

            // 3. Click (intentamos click nativo primero, luego JS)
            let clicked = false;
            try {
                if (btn.click) {
                    await btn.click();
                    clicked = true;
                }
            } catch (e) { }

            if (!clicked) {
                await btn.evaluate(b => b.click());
            }

            // 4. Esperar a que el navegador inicie y complete la descarga
            const download = await downloadPromise;

            // 5. Determinar extensión desde el servidor (IMPORTANTE: SUNAT envía ZIPs incluso si pides XML)
            const suggestedFilename = download.suggestedFilename();
            const serverExtension = path.extname(suggestedFilename) || `.${extension}`;

            // Construir nombre: RUC-TIPO-SERIE-NUMERO + extensión real del servidor
            const filename = `${cpe.rucEmisor}-${cpe.tipoDoc}-${cpe.serie}-${cpe.numero}${serverExtension}`;
            const filePath = path.join(tempPath, filename);

            // Limpiar archivo previo si existe
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { }
            }

            // 6. Guardar en la ruta específica (Playwright maneja el stream temporal)
            await download.saveAs(filePath);

            logger.info(`${tipoArchivo.toUpperCase()} descargado exitosamente`, { filePath, originalName: suggestedFilename });
            shell.showItemInFolder(filePath);
            return { success: true, path: filePath };

        } catch (error) {
            logger.error(`Error en descarga nativa de ${tipoArchivo}`, { error: error.message });
            return { success: false, error: `Error descargando: ${error.message}` };
        }
    }

    async _findSession(sessionId, cpeData = null) {
        // 1. Intento directo por ID
        if (this.activeSessions.has(sessionId)) {
            return this.activeSessions.get(sessionId);
        }

        // 2. Búsqueda por coincidencia de CPE (Fuzzy Match)
        // Esto recupera la sesión si el ID cambió o se perdió pero la ventana sigue abierta con esa factura
        if (cpeData) {
            logger.info('⚠️ Búsqueda por ID falló, intentando recuperar por datos del CPE...', { cpeData });
            for (const [key, session] of this.activeSessions.entries()) {
                const sCpe = session.cpe;
                if (sCpe && cpeData.rucEmisor && sCpe.rucEmisor === cpeData.rucEmisor &&
                    sCpe.serie === cpeData.serie &&
                    sCpe.numero === cpeData.numero) {
                    logger.info(`✅ Sesión recuperada por coincidencia de CPE! ID original: ${sessionId}, ID encontrado: ${key}`);
                    return session;
                }
            }
        }

        // 3. Fallo total
        const activeKeys = Array.from(this.activeSessions.keys());
        logger.warn(`❌ Sesión no encontrada: ${sessionId}. Activas (${this.activeSessions.size}): [${activeKeys.join(', ')}]`);
        return null;
    }

    /**
     * Descarga PDF del CPE
     */
    async descargarPDF(sessionId, cpeData = null) {
        logger.info(`Solicitud descarga PDF para sesión: ${sessionId}`, { cpeData });
        const session = await this._findSession(sessionId, cpeData);
        if (!session) {
            const activeKeys = Array.from(this.activeSessions.keys());
            logger.warn(`Sesión no encontrada o expirada: ${sessionId}. Sesiones activas (${this.activeSessions.size}): [${activeKeys.join(', ')}]`);
            return { success: false, error: 'Sesión expirada' };
        }
        return await this._descargarArchivoInterceptado(session, null, 'pdf', 'pdf');
    }

    async descargarXML(sessionId, cpeData = null) {
        logger.info(`Solicitud descarga XML para sesión: ${sessionId}`, { cpeData });
        const session = await this._findSession(sessionId, cpeData);
        if (!session) {
            logger.warn(`Sesión no encontrada o expirada: ${sessionId}`);
            return { success: false, error: 'Sesión expirada' };
        }
        return await this._descargarArchivoInterceptado(session, null, 'xml', 'xml');
    }

    async descargarCDR(sessionId, cpeData = null) {
        logger.info(`Solicitud descarga CDR para sesión: ${sessionId}`, { cpeData });
        const session = await this._findSession(sessionId, cpeData);
        if (!session) {
            logger.warn(`Sesión no encontrada o expirada: ${sessionId}`);
            return { success: false, error: 'Sesión expirada' };
        }
        return await this._descargarArchivoInterceptado(session, null, 'cdr', 'zip');
    }

    /**
     * Cierra una sesión
     */
    async cerrarSesion(sessionId) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (session) {
                if (session.browser) {
                    await session.browser.close();
                }
                this.activeSessions.delete(sessionId);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Cierra todas las sesiones
     */
    async cerrarTodasLasSesiones() {
        for (const [sessionId, session] of this.activeSessions) {
            try {
                if (session.browser) {
                    await session.browser.close();
                }
            } catch (e) { }
        }
        this.activeSessions.clear();
        return { success: true };
    }

    /**
     * Lista archivos descargados (constancias) para un RUC consultante
     * Lee el directorio descargas_cpe/[RUC] y devuelve la lista de archivos PDF, XML, ZIP
     */
    async listarConstancias(rucConsultante) {
        try {
            const rucPath = path.join(this.downloadPath, rucConsultante);

            // Verificar si existe el directorio
            if (!fs.existsSync(rucPath)) {
                return {
                    success: true,
                    archivos: [],
                    message: 'No hay archivos descargados para este RUC'
                };
            }

            // Leer archivos del directorio
            const files = fs.readdirSync(rucPath);

            // Filtrar solo PDF, XML, ZIP y obtener metadata
            const archivos = files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return ['.pdf', '.xml', '.zip'].includes(ext);
                })
                .map(file => {
                    const filePath = path.join(rucPath, file);
                    const stats = fs.statSync(filePath);

                    return {
                        nombre: file,
                        ruta: filePath,
                        size: stats.size,
                        fechaModificacion: stats.mtime,
                        tipo: path.extname(file).substring(1).toUpperCase() // PDF, XML, ZIP
                    };
                })
                .sort((a, b) => b.fechaModificacion - a.fechaModificacion); // Más recientes primero

            logger.info(`Listadas ${archivos.length} constancias para RUC ${rucConsultante}`);

            return {
                success: true,
                archivos,
                total: archivos.length
            };

        } catch (error) {
            logger.error('Error listando constancias', { error: error.message });
            return {
                success: false,
                error: error.message,
                archivos: []
            };
        }
    }

    /**
     * Consulta masiva usando procesamiento paralelo en cascada
     * Cada browser se inicia inmediatamente después del login del anterior
     * NO hace descargas automáticas - los browsers quedan abiertos
     * Los browsers se cierran automáticamente después de detectar descargas manuales
     * @param {string} sessionId - NO USADO (mantener por compatibilidad)
     * @param {Array} listaComprobantes - Lista de comprobantes [{rucEmisor, tipoDoc, serie, numero, filtro}]
     * @param {Object} cliente - Datos del cliente (puede ser solo {ruc} o {ruc, usuario, clave})
     */
    async consultarMasivo(sessionId, listaComprobantes, cliente) {
        logger.info(`🚀 Iniciando consulta masiva PARALELA de ${listaComprobantes.length} comprobantes...`);

        // Validar que al menos tengamos el RUC
        if (!cliente || !cliente.ruc) {
            return {
                success: false,
                error: 'Se requiere el RUC del cliente consultante'
            };
        }

        // Si no se enviaron credenciales, buscarlas automáticamente en API_SIRE.xlsm
        let credencialesCompletas = cliente;
        if (!cliente.usuario || !cliente.clave) {
            logger.info(`Buscando credenciales para RUC: ${cliente.ruc} en API_SIRE.xlsm...`);
            const credResult = await this.obtenerCredenciales(cliente.ruc);

            if (!credResult.success) {
                return {
                    success: false,
                    error: `No se encontraron credenciales para RUC ${cliente.ruc} en API_SIRE.xlsm`
                };
            }

            credencialesCompletas = credResult.data;
            logger.info(`✅ Credenciales obtenidas exitosamente para ${credResult.data.razonSocial}`);
        }

        const MAX_BROWSERS_SIMULTANEOS = 10; // Máximo de browsers trabajando en paralelo
        const resultados = [];
        let browsersActivos = 0;

        try {
            // Función para procesar una factura individual
            const procesarFactura = async (cpe, idx) => {
                const uniqueSessionId = `cpe_mass_${credencialesCompletas.ruc}_${Date.now()}_${idx}`;
                let browser = null;
                let page = null;
                let descargasRealizadas = 0;

                try {
                    const { rucEmisor, tipoDoc, serie, numero, filtro = 'recibido' } = cpe;
                    logger.info(`🌐 Browser ${idx + 1}: Iniciando para ${rucEmisor}-${tipoDoc}-${serie}-${numero}`);

                    // Lanzar navegador
                    browser = await chromium.launch({
                        headless: true, // Headless para entornos Linux/Cloud y Electron
                        slowMo: 50,
                        args: [
                            '--no-sandbox',
                            '--disable-setuid-sandbox',
                            '--disable-blink-features=AutomationControlled',
                            '--disable-infobars',
                            '--start-maximized'
                        ]
                    });

                    const context = await browser.newContext({
                        acceptDownloads: true,
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        viewport: { width: 1366, height: 900 },
                        extraHTTPHeaders: {
                            'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                        }
                    });

                    page = await context.newPage();

                    // Anti-detección
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    });

                    page.setDefaultTimeout(60000);
                    page.setDefaultNavigationTimeout(90000);

                    // ========== CONFIGURAR LISTENER DE DESCARGAS (AUTO-CLOSE) ==========
                    // Este listener detecta cuando el usuario descarga archivos manualmente
                    page.on('download', async (download) => {
                        descargasRealizadas++;
                        const filename = download.suggestedFilename();
                        logger.info(`📥 Browser ${idx + 1}: Detectada descarga manual: ${filename} (${descargasRealizadas}/3)`);

                        // Crear directorio de descargas si no existe
                        const tempPath = path.join(this.downloadPath, credencialesCompletas.ruc);
                        if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });

                        // Guardar archivo con nomenclatura estándar
                        const ext = path.extname(filename);
                        const finalFilename = `${rucEmisor}-${tipoDoc}-${serie}-${numero}${ext}`;
                        const finalFilePath = path.join(tempPath, finalFilename);

                        try {
                            await download.saveAs(finalFilePath);
                            logger.info(`✅ Browser ${idx + 1}: Archivo guardado: ${finalFilename}`);
                        } catch (err) {
                            logger.warn(`⚠️ Browser ${idx + 1}: Error guardando descarga: ${err.message}`);
                        }

                        // Si se descargaron 3 archivos (PDF, XML, CDR), cerrar browser automáticamente
                        if (descargasRealizadas >= 3) {
                            logger.info(`🔒 Browser ${idx + 1}: 3 archivos descargados, cerrando browser automáticamente...`);
                            setTimeout(async () => {
                                try {
                                    this.activeSessions.delete(uniqueSessionId);
                                    await browser.close();
                                    logger.info(`✅ Browser ${idx + 1}: Cerrado automáticamente`);
                                } catch (e) { }
                            }, 2000); // Esperar 2 segundos para que termine la última descarga
                        }
                    });

                    // ========== PASO 1: LOGIN EN SUNAT SOL ==========
                    const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
                    logger.info(`Browser ${idx + 1}: PASO 1 - Navegando al login SUNAT`);

                    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
                    await page.waitForSelector('#txtRuc', { timeout: 30000 });

                    // Rellenar formulario de login
                    await page.fill('#txtRuc', credencialesCompletas.ruc);
                    await page.waitForTimeout(500);
                    await page.fill('#txtUsuario', credencialesCompletas.usuario_sol);
                    await page.waitForTimeout(500);
                    await page.fill('#txtContrasena', credencialesCompletas.clave_sol);
                    await page.waitForTimeout(500);

                    logger.info(`Browser ${idx + 1}: Enviando login...`);

                    // Click en login
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => { }),
                        page.click('#btnAceptar')
                    ]);

                    await page.waitForTimeout(3000);

                    let currentUrl = page.url();
                    logger.info(`Browser ${idx + 1}: URL después de login: ${currentUrl}`);

                    // Si estamos en api-seguridad (OAuth), navegar al menú principal
                    if (currentUrl.includes('api-seguridad')) {
                        logger.info(`Browser ${idx + 1}: Detectada página OAuth, navegando al menú principal...`);
                        const menuUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
                        await page.goto(menuUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        await page.waitForTimeout(3000);
                    }

                    logger.info(`Browser ${idx + 1}: Login exitoso`);

                    // ========== PASO 2: NAVEGACIÓN DIRECTA A LA INTERFAZ ==========
                    logger.info(`Browser ${idx + 1}: PASO 2 - Navegando directamente a la interfaz de consulta...`);

                    const consultaUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.38.1.1.1&s=ww1';
                    await page.goto(consultaUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
                    await page.waitForTimeout(3000);

                    // ========== PASO 3: NAVEGAR AL PORTAL CPE ==========
                    const cpeUrl = 'https://e-factura.sunat.gob.pe/app/contribuyentems/servicio/consultacpe/consulta/nuevaconsulta/1.0.0/';
                    logger.info(`Browser ${idx + 1}: PASO 3 - Navegando al portal CPE...`);

                    await page.goto(cpeUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
                    await page.waitForTimeout(5000);

                    // ========== PASO 4: RELLENAR FORMULARIO DE CONSULTA ==========
                    logger.info(`Browser ${idx + 1}: PASO 4 - Rellenando formulario...`);

                    // Seleccionar "Recibido" o "Emitido"
                    if (filtro === 'recibido') {
                        try {
                            await page.click('label[for="recibido"]');
                        } catch (e) {
                            await page.click('#recibido');
                        }
                    } else {
                        try {
                            await page.click('label[for="emitido"]');
                        } catch (e) {
                            await page.click('#emitido');
                        }
                    }

                    // Rellenar RUC Emisor
                    try {
                        await page.fill('input[name="rucEmisor"]', rucEmisor);
                    } catch (e) {
                        await page.fill('input[formcontrolname="rucEmisor"]', rucEmisor);
                    }

                    // Tipo Comprobante
                    try {
                        const tipoLabels = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de crédito', '08': 'Nota de débito' };
                        const tipoLabel = tipoLabels[tipoDoc] || 'Factura';

                        await page.click('p-dropdown[formcontrolname="tipoComprobanteI"]');
                        await page.click(`li[aria-label="${tipoLabel}"]`, { timeout: 2000 }).catch(() => page.click(`text=${tipoLabel}`));
                    } catch (e) {
                        logger.warn(`Browser ${idx + 1}: Error seleccionando tipo comprobante: ${e.message}`);
                    }

                    // Serie
                    try {
                        await page.fill('input[name="serieComprobante"]', serie);
                    } catch (e) {
                        await page.fill('input[formcontrolname="serieComprobante"]', serie);
                    }

                    // Número
                    try {
                        await page.fill('input[name="numeroComprobante"]', numero);
                    } catch (e) {
                        await page.fill('input[formcontrolname="numeroComprobante"]', numero);
                    }

                    // Click en "Consultar"
                    logger.info(`Browser ${idx + 1}: Haciendo click en Consultar...`);
                    try {
                        await page.click('button.boton-primary:has-text("Consultar")');
                    } catch (e) {
                        await page.click('button[type="submit"]:has-text("Consultar")');
                    }

                    // Esperar resultado
                    await page.waitForTimeout(3000);

                    // ========== PASO 5: EXTRAER RESULTADO ==========
                    const resultado = await page.evaluate(() => {
                        const body = document.body.innerText;
                        const modal = document.querySelector('div[role="document"].modal-dialog');

                        if (!modal) {
                            if (body.includes('No se encontr') || body.includes('sin resultados') || body.includes('no existe') || body.includes('no existe registro')) {
                                return { estado: 'NO_ENCONTRADO', encontrado: false };
                            }
                            if (body.includes('ACEPTADO')) return { estado: 'ACEPTADO', encontrado: true };
                            return { estado: 'PENDIENTE_REVISION', encontrado: false };
                        }

                        const datos = {
                            estado: 'ENCONTRADO',
                            encontrado: true,
                            html: modal.outerHTML,
                            razonSocial: '',
                            rucEmisor: '',
                            fechaEmision: '',
                            importeTotal: ''
                        };

                        const emisorTable = modal.querySelector('table.emisor');
                        if (emisorTable) {
                            const bTags = emisorTable.querySelectorAll('b');
                            if (bTags.length > 0) datos.razonSocial = bTags[0].innerText.trim();
                        }

                        const numeracionTable = modal.querySelector('table.comprobante-numeracion');
                        if (numeracionTable) {
                            const tds = numeracionTable.querySelectorAll('td');
                            tds.forEach(td => {
                                const text = td.innerText;
                                if (text.includes('RUC:')) datos.rucEmisor = text.replace('RUC:', '').trim();
                            });
                        }

                        const filasDatos = modal.querySelectorAll('tr.comprobante-datosprincipales');
                        filasDatos.forEach(tr => {
                            const tds = tr.querySelectorAll('td');
                            if (tds.length >= 3 && tds[0].innerText.includes('Fecha de Emisión')) {
                                datos.fechaEmision = tds[2].innerText.trim();
                            }
                        });

                        const totalesTable = modal.querySelector('table.comprobante-totales');
                        if (totalesTable) {
                            const filas = totalesTable.querySelectorAll('tr');
                            filas.forEach(tr => {
                                const tds = tr.querySelectorAll('td');
                                if (tds.length >= 3 && tds[0].innerText.includes('Importe total')) {
                                    datos.importeTotal = tds[2].innerText.trim();
                                }
                            });
                        }

                        if (body.includes('Estado del comprobante: ACEPTADO') || body.includes('ACTIVO')) {
                            datos.estado = 'ACEPTADO';
                        } else if (body.includes('ANULADO') || body.includes('BAJA')) {
                            datos.estado = 'ANULADO';
                        }

                        return datos;
                    });

                    logger.info(`✅ Browser ${idx + 1}: Completado ${rucEmisor}-${tipoDoc}-${serie}-${numero} - Estado: ${resultado.estado}`);

                    // Guardar sesión activa (el browser queda abierto para descarga manual)
                    this.activeSessions.set(uniqueSessionId, {
                        browser,
                        page,
                        context,
                        cliente: credencialesCompletas,
                        cpe: cpe
                    });
                    logger.info(`🔓 Browser ${idx + 1}: ABIERTO para descarga manual (Sesión: ${uniqueSessionId})`);

                    return {
                        success: true,
                        data: resultado,
                        request: cpe,
                        sessionId: uniqueSessionId,
                        rucConsultante: credencialesCompletas.ruc
                    };

                } catch (error) {
                    logger.error(`❌ Browser ${idx + 1} Error:`, error.message);

                    // En caso de error, cerrar browser
                    if (browser) {
                        try {
                            await browser.close();
                        } catch (e) { }
                    }

                    return {
                        success: false,
                        error: error.message,
                        request: cpe
                    };
                } finally {
                    browsersActivos--;
                }
            };

            // ========== PROCESAMIENTO PARALELO EN CASCADA ==========
            // Iniciar cada browser después del login del anterior
            const promesas = [];

            for (let i = 0; i < listaComprobantes.length; i++) {
                // Esperar si ya tenemos MAX_BROWSERS_SIMULTANEOS activos
                while (browsersActivos >= MAX_BROWSERS_SIMULTANEOS) {
                    await new Promise(r => setTimeout(r, 1000));
                }

                browsersActivos++;
                const promesa = procesarFactura(listaComprobantes[i], i);
                promesas.push(promesa);

                // Esperar un poco para dar tiempo al login antes de iniciar el siguiente
                // Esto crea el efecto "cascada"
                if (i < listaComprobantes.length - 1) {
                    await new Promise(r => setTimeout(r, 8000)); // 8 segundos entre inicios (tiempo aproximado del login)
                }
            }

            // Esperar a que todos terminen
            const results = await Promise.all(promesas);
            resultados.push(...results);

            logger.info(`🎉 Consulta masiva completada: ${resultados.length}/${listaComprobantes.length} procesados`);
            logger.info(`📊 Total browsers abiertos: ${this.activeSessions.size}`);

            return {
                success: true,
                total: listaComprobantes.length,
                procesados: resultados.length,
                resultados,
                browsersAbiertos: this.activeSessions.size
            };

        } catch (error) {
            logger.error('Error crítico en consulta masiva:', error);
            return {
                success: false,
                error: error.message,
                resultados
            };
        }
    }

    /**
     * Descarga masiva para MODO PRODUCCIÓN (Auto-descarga PDF)
     * Realiza consulta y descarga automáticamente el PDF de cada comprobante.
     * Cierra los browsers al finalizar cada descarga para liberar recursos.
     */
    async descargarMasivoProduccion(sessionId, listaComprobantes, cliente) {
        logger.info(`🚀 Iniciando DESCARGA MASIVA PRODUCCIÓN de ${listaComprobantes.length} comprobantes...`);

        // Validar RUC
        if (!cliente || !cliente.ruc) {
            return { success: false, error: 'Se requiere el RUC del cliente consultante' };
        }

        // Credenciales
        let credencialesCompletas = cliente;
        if (!cliente.usuario || !cliente.clave) {
            const credResult = await this.obtenerCredenciales(cliente.ruc);
            if (!credResult.success) {
                return { success: false, error: `No se encontraron credenciales para RUC ${cliente.ruc}` };
            }
            credencialesCompletas = credResult.data;
        }

        const MAX_BROWSERS_SIMULTANEOS = 5; // Menos concurrencia para asegurar descargas estables
        const resultados = [];
        let browsersActivos = 0;

        try {
            const procesarDescarga = async (cpe, idx) => {
                const uniqueSessionId = `prod_${credencialesCompletas.ruc}_${Date.now()}_${idx}`;
                let browser = null;

                try {
                    // Reutilizamos la lógica de consulta pero forzando una sesión efímera
                    // TODO: Refactorizar para no duplicar todo el código de lanzamiento/login
                    // Por ahora, usamos una versión simplificada que llama a consultarCPE y luego descarga

                    // 1. Lanzamos consulta (esto crea browser y hace login)
                    // Importante: consultarCPE maneja su propio browser. 
                    // Si llamamos a consultarCPE, creará un browser.
                    // Pero necesitamos el sessionId para luego llamar a descargarPDF.

                    // Mejor estrategia: Instanciar browser aquí controladamente.
                    // Copiamos la lógica core de worker.

                    const { rucEmisor, tipoDoc, serie, numero } = cpe;

                    // Usamos consultarCPE para obtener la sesión lista
                    const consultaResult = await this.consultarCPE(credencialesCompletas.ruc, {
                        rucEmisor, tipoDoc, serie, numero, filtro: cpe.filtro
                    });

                    if (!consultaResult.success || !consultaResult.data.encontrado) {
                        // Si no encuentra o error, cerramos esa sesión inmediatamente
                        if (consultaResult.sessionId) await this.cerrarSesion(consultaResult.sessionId);

                        return {
                            ...cpe,
                            status: 'ERROR',
                            error: consultaResult.error || 'No encontrado',
                            data: consultaResult.data
                        };
                    }

                    // 2. Si se encontró, intentamos descargar PDF inmediatamente
                    const downloadResult = await this.descargarPDF(consultaResult.sessionId, cpe);

                    // 3. Cerramos la sesión
                    await this.cerrarSesion(consultaResult.sessionId);

                    if (downloadResult.success) {
                        return {
                            ...cpe,
                            status: 'OK',
                            pdfPath: downloadResult.path,
                            data: consultaResult.data
                        };
                    } else {
                        return {
                            ...cpe,
                            status: 'ERROR_DOWNLOAD',
                            error: downloadResult.error,
                            data: consultaResult.data
                        };
                    }

                } catch (error) {
                    logger.error(`Error procesando descarga ${idx}:`, error);
                    return { ...cpe, status: 'ERROR_SYSTEM', error: error.message };
                } finally {
                    browsersActivos--;
                }
            };

            const promesas = [];
            for (let i = 0; i < listaComprobantes.length; i++) {
                while (browsersActivos >= MAX_BROWSERS_SIMULTANEOS) {
                    await new Promise(r => setTimeout(r, 1000));
                }

                browsersActivos++;
                // Pequeño delay para no saturar inicio de procesos
                await new Promise(r => setTimeout(r, 2000));

                promesas.push(procesarDescarga(listaComprobantes[i], i));
            }

            const results = await Promise.all(promesas);
            logger.info(`✅ Descarga producción finalizada. ${results.length} procesados.`);

            return {
                success: true,
                resultados: results
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Visualizar Facturas - Hace login y devuelve cookies + URL para BrowserView de Electron
     * Playwright autentica y obtiene la sesión, luego Electron usa esa sesión en BrowserView
     */
    async visualizarFacturas(rucConsultante) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando visualización de facturas', { rucConsultante });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            // Lanzar browser en modo headless para obtener cookies
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars'
                ]
            });

            const context = await browser.newContext({
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1200, height: 800 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detección
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // PASO 1: Login en portal principal de SUNAT
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('Navegando a portal principal para login', { url: loginUrl });

            await page.goto(loginUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar formulario de login
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Completar formulario de login
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);

            logger.info('Formulario de login completado, enviando...', { rucConsultante });

            // Enviar login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar a que la página cargue después de login
            await page.waitForTimeout(3000);

            // PASO 2: Navegar a la URL de visualización
            const visualizacionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.3.1.2&s=ww1';
            logger.info('Login exitoso, navegando a portal de visualización', { url: visualizacionUrl });

            await page.goto(visualizacionUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar la redirección de SUNAT - la URL debe cambiar del menú al portal de visualización
            // SUNAT redirige de e-menu.sunat.gob.pe a ww1.sunat.gob.pe con el token de sesión
            logger.info('Esperando redirección de SUNAT...');

            try {
                await page.waitForURL(/ww1\.sunat\.gob\.pe|ol-ti-itconscpemype/, { timeout: 30000 });
                logger.info('Redirección a portal de visualización detectada');
            } catch (e) {
                logger.warn('No se detectó redirección esperada, usando URL actual');
            }

            // Esperar a que la página cargue completamente después de redirección
            await page.waitForTimeout(5000);

            // Capturar la URL final (incluye token de sesión)
            const targetUrl = page.url();
            logger.info('URL de destino capturada (después de redirección)', { targetUrl });

            // PASO 3: Obtener todas las cookies de la sesión
            const cookies = await context.cookies();
            logger.info(`Obtenidas ${cookies.length} cookies de la sesión`);

            // Crear ID de sesión
            const sessionId = `visualizacion_${rucConsultante}_${Date.now()}`;

            // Cerrar browser de Playwright - ya no lo necesitamos
            await browser.close();
            browser = null;

            logger.info('Sesión de login capturada correctamente', {
                sessionId,
                rucConsultante,
                targetUrl,
                cookieCount: cookies.length
            });

            return {
                success: true,
                sessionId,
                targetUrl, // URL con token de sesión para navegarla en BrowserView
                cookies, // Cookies para inyectar en Electron
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial
            };

        } catch (error) {
            logger.error('Error en visualización de facturas', {
                error: error.message,
                stack: error.stack,
                rucConsultante
            });

            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * Emitir Facturas - Hace login y devuelve cookies + URL para BrowserView de Electron
     * Similar a visualizarFacturas pero para el portal de emisión de facturas
     */
    async emitirFacturas(rucConsultante) {
        let browser = null;
        let page = null;

        try {
            logger.info('Iniciando emisión de facturas', { rucConsultante });

            // Obtener credenciales
            const credResult = await this.obtenerCredenciales(rucConsultante);
            if (!credResult.success) {
                return credResult;
            }
            const cliente = credResult.data;

            // Lanzar browser en modo headless para obtener cookies
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars'
                ]
            });

            const context = await browser.newContext({
                acceptDownloads: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1200, height: 800 },
                extraHTTPHeaders: {
                    'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8'
                }
            });
            page = await context.newPage();

            // Anti-detección
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            page.setDefaultTimeout(60000);
            page.setDefaultNavigationTimeout(90000);

            // PASO 1: Login en portal principal de SUNAT
            const loginUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm';
            logger.info('Navegando a portal principal para login', { url: loginUrl });

            await page.goto(loginUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar formulario de login
            await page.waitForSelector('#txtRuc', { timeout: 30000 });

            // Completar formulario de login
            await page.fill('#txtRuc', cliente.ruc);
            await page.waitForTimeout(500);
            await page.fill('#txtUsuario', cliente.usuario_sol);
            await page.waitForTimeout(500);
            await page.fill('#txtContrasena', cliente.clave_sol);

            logger.info('Formulario de login completado, enviando...', { rucConsultante });

            // Enviar login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => { }),
                page.click('#btnAceptar')
            ]);

            // Esperar a que la página cargue después de login
            await page.waitForTimeout(3000);

            // PASO 2: Navegar a la URL de emisión de facturas
            const emisionUrl = 'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm?action=execute&code=11.5.3.1.1&s=ww1';
            logger.info('Login exitoso, navegando a portal de emisión de facturas', { url: emisionUrl });

            await page.goto(emisionUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
            });

            // Esperar la redirección de SUNAT
            logger.info('Esperando redirección de SUNAT...');

            try {
                await page.waitForURL(/ww1\.sunat\.gob\.pe|ol-ti-itemisionmype/, { timeout: 30000 });
                logger.info('Redirección a portal de emisión detectada');
            } catch (e) {
                logger.warn('No se detectó redirección esperada, usando URL actual');
            }

            // Esperar a que la página cargue completamente después de redirección
            await page.waitForTimeout(5000);

            // Capturar la URL final (incluye token de sesión)
            const targetUrl = page.url();
            logger.info('URL de destino capturada (después de redirección)', { targetUrl });

            // PASO 3: Obtener todas las cookies de la sesión
            const cookies = await context.cookies();
            logger.info(`Obtenidas ${cookies.length} cookies de la sesión`);

            // Crear ID de sesión
            const sessionId = `emision_${rucConsultante}_${Date.now()}`;

            // Cerrar browser de Playwright - ya no lo necesitamos
            await browser.close();
            browser = null;

            logger.info('Sesión de login capturada correctamente', {
                sessionId,
                rucConsultante,
                targetUrl,
                cookieCount: cookies.length
            });

            return {
                success: true,
                sessionId,
                targetUrl, // URL con token de sesión para navegarla en BrowserView
                cookies, // Cookies para inyectar en Electron
                clienteRuc: cliente.ruc,
                clienteRazon: cliente.razonSocial
            };

        } catch (error) {
            logger.error('Error en emisión de facturas', {
                error: error.message,
                stack: error.stack,
                rucConsultante
            });

            if (browser) {
                try { await browser.close(); } catch (e) { }
            }

            return { success: false, error: error.message };
        }
    }

}

// Instancia única del handler
const cpeScrapingHandler = new CPEScrapingHandler();

/**
 * Configurar handlers IPC para el módulo CPE
 */
function setupCPEScrapingIPC() {
    ipcMain.handle('cpe-scraping-consultar', async (event, params) => {
        try {
            logger.info('IPC cpe-scraping-consultar recibido', { params });

            if (!params) {
                logger.error('Params is undefined');
                return { success: false, error: 'Parámetros no recibidos' };
            }

            const { rucConsultante, rucEmisor, tipoDoc, serie, numero, filtro } = params;

            if (!rucConsultante) {
                return { success: false, error: 'RUC consultante es requerido' };
            }

            if (!rucEmisor || !tipoDoc || !serie || !numero) {
                return { success: false, error: 'Faltan datos del comprobante (RUC Emisor, Tipo, Serie o Número)' };
            }

            return await cpeScrapingHandler.consultarCPE(rucConsultante, {
                rucEmisor,
                tipoDoc,
                serie,
                numero,
                filtro: filtro || 'recibido'
            });
        } catch (error) {
            logger.error('Error en handler cpe-scraping-consultar', { error: error.message, stack: error.stack });
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('cpe-scraping-descargar-pdf', async (event, { sessionId, cpe }) => {
        return await cpeScrapingHandler.descargarPDF(sessionId, cpe);
    });

    ipcMain.handle('cpe-scraping-descargar-xml', async (event, { sessionId, cpe }) => {
        return await cpeScrapingHandler.descargarXML(sessionId, cpe);
    });

    ipcMain.handle('cpe-scraping-descargar-cdr', async (event, { sessionId, cpe }) => {
        return await cpeScrapingHandler.descargarCDR(sessionId, cpe);
    });

    ipcMain.handle('cpe-scraping-cerrar-sesion', async (event, { sessionId }) => {
        return await cpeScrapingHandler.cerrarSesion(sessionId);
    });

    ipcMain.handle('cpe-scraping-cerrar-todas', async () => {
        return await cpeScrapingHandler.cerrarTodasLasSesiones();
    });

    ipcMain.handle('cpe-scraping-consultar-masivo', async (event, { sessionId, listaComprobantes, cliente }) => {
        return await cpeScrapingHandler.consultarMasivo(sessionId, listaComprobantes, cliente);
    });

    ipcMain.handle('cpe-scraping-descargar-produccion', async (event, { sessionId, listaComprobantes, cliente }) => {
        return await cpeScrapingHandler.descargarMasivoProduccion(sessionId, listaComprobantes, cliente);
    });

    ipcMain.handle('cpe-listar-constancias', async (event, { rucConsultante }) => {
        return await cpeScrapingHandler.listarConstancias(rucConsultante);
    });

    ipcMain.handle('cpe-visualizar-facturas', async (event, { rucConsultante }) => {
        const result = await cpeScrapingHandler.visualizarFacturas(rucConsultante);

        if (result.success && result.cookies && result.cookies.length > 0) {
            try {
                logger.info(`Sincronizando ${result.cookies.length} cookies con sesión de Electron`);

                // Inyectar cookies en la sesión de Electron
                const promises = result.cookies.map(cookie => {
                    // Normalizar dominio
                    let rawDomain = cookie.domain || '';
                    if (rawDomain.startsWith('.')) {
                        rawDomain = rawDomain.substring(1);
                    }

                    const cookieUrl = `https://${rawDomain}`;

                    const electronCookie = {
                        url: cookieUrl,
                        name: cookie.name,
                        value: cookie.value,
                        domain: rawDomain,
                        path: cookie.path || '/',
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        expirationDate: cookie.expires
                    };

                    return event.sender.session.cookies.set(electronCookie).catch(err => {
                        logger.warn(`Fallo al setear cookie ${cookie.name}`, { error: err.message });
                    });
                });

                await Promise.all(promises);
                logger.info('Cookies sincronizadas correctamente con Electron');
            } catch (error) {
                logger.error('Error al sincronizar cookies', { error: error.message });
            }
        }

        return result;
    });

    ipcMain.handle('cpe-emitir-facturas', async (event, { rucConsultante }) => {
        const result = await cpeScrapingHandler.emitirFacturas(rucConsultante);

        if (result.success && result.cookies && result.cookies.length > 0) {
            try {
                logger.info(`Sincronizando ${result.cookies.length} cookies con sesión de Electron`);

                // Inyectar cookies en la sesión de Electron
                const promises = result.cookies.map(cookie => {
                    // Normalizar dominio
                    let rawDomain = cookie.domain || '';
                    if (rawDomain.startsWith('.')) {
                        rawDomain = rawDomain.substring(1);
                    }

                    const cookieUrl = `https://${rawDomain}`;

                    const electronCookie = {
                        url: cookieUrl,
                        name: cookie.name,
                        value: cookie.value,
                        domain: rawDomain,
                        path: cookie.path || '/',
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        expirationDate: cookie.expires
                    };

                    return event.sender.session.cookies.set(electronCookie).catch(err => {
                        logger.warn(`Fallo al setear cookie ${cookie.name}`, { error: err.message });
                    });
                });

                await Promise.all(promises);
                logger.info('Cookies sincronizadas correctamente con Electron');
            } catch (error) {
                logger.error('Error al sincronizar cookies', { error: error.message });
            }
        }

        return result;
    });

    logger.info('Handlers IPC de CPE Scraping configurados');
}

module.exports = {
    CPEScrapingHandler,
    cpeScrapingHandler,
    setupCPEScrapingIPC
};
